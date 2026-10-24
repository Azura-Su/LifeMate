-- Pending Phỏm settings only affect the next match.
create or replace function public.lifemate_game_keep_kind() returns trigger
language plpgsql set search_path='' as $$
declare v_kind text:=coalesce(new.state->>'gameKind','south'); v_promotion boolean:=false;
begin
  if v_kind not in ('south','phom') then raise exception 'invalid-input'; end if;
  if new.state ? 'nextPhomConfig' then
    if v_kind<>'phom' then raise exception 'invalid-input'; end if;
    perform public.lifemate_game_assert_phom_config(new.state->'nextPhomConfig');
  end if;
  if tg_op='INSERT' and new.state ? 'nextPhomConfig' then raise exception 'invalid-input'; end if;
  if tg_op='UPDATE' then
    if old.state->'nextPhomConfig' is distinct from new.state->'nextPhomConfig'
      and coalesce(current_setting('lifemate.phom_rules',true),'')<>new.id::text
      then raise exception 'invalid-input'; end if;
    if old.state ? 'nextPhomConfig' and new.match_id is not null and new.match_id is distinct from old.match_id then
      if old.state->>'phase' not in ('lobby','finished') or new.state->>'phase' not in ('playing','finished')
        or old.state->'nextPhomConfig' is distinct from new.state->'nextPhomConfig'
        or new.state->'phomConfig' is distinct from old.state->'nextPhomConfig'
        then raise exception 'invalid-input'; end if;
      v_promotion:=true;
    end if;
    if coalesce(old.state->>'gameKind','south')<>v_kind and not (
      v_kind='phom' and coalesce(old.state->>'gameKind','south')='south'
      and coalesce(current_setting('lifemate.phom_create',true),'')=new.id::text
      and old.state->>'phase'='lobby' and old.match_id is null
    ) then raise exception 'invalid-input'; end if;
    if old.state->>'gameKind'='phom' and old.state->'phomConfig' is distinct from new.state->'phomConfig' and not v_promotion
      then raise exception 'invalid-input'; end if;
  end if;
  if v_kind='phom' then
    perform public.lifemate_game_assert_phom_config(new.state->'phomConfig');
    if new.state->'game' is not null and new.state->'game'<>'null'::jsonb and (
      new.state->'game'->>'rulesVersion' is distinct from 'phom-v1'
      or new.state->'game'->'config' is distinct from new.state->'phomConfig'
    ) then raise exception 'invalid-input'; end if;
  end if;
  return new;
end $$;

create function public.lifemate_game_set_phom_rules(
  p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
  p_room_id uuid,p_version bigint,p_match_id uuid,p_config jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_seat public.lifemate_game_seats; v_ack jsonb; v_state jsonb;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid,false);
  perform pg_advisory_xact_lock(hashtextextended('card-game:'||p_uid,0));
  select * into strict v_room from public.lifemate_game_rooms where id=p_room_id for update;
  v_ack:=public.lifemate_game_receipt(p_uid,p_auth_time,p_action_id,p_fingerprint);
  if v_ack is not null then return v_ack; end if;
  select * into v_seat from public.lifemate_game_seats where uid=p_uid and room_id=p_room_id for update;
  if not found then raise exception 'not-member'; end if;
  if v_seat.session_id is distinct from p_session_id then raise exception 'session-replaced'; end if;
  if (case when v_room.state ? 'ownerUid' then v_room.state->>'ownerUid' else v_room.state->>'host' end)
    is distinct from p_uid then raise exception 'not-owner'; end if;
  if v_room.expires_at<=now() then raise exception 'room-expired'; end if;
  if v_room.version is distinct from p_version then raise exception 'version-conflict'; end if;
  if v_room.match_id is distinct from p_match_id then raise exception 'match-conflict'; end if;
  if v_room.state->>'gameKind' is distinct from 'phom'
    or v_room.state->>'phase' not in ('lobby','playing','finished') then raise exception 'invalid-input'; end if;
  v_state:=v_room.state||jsonb_build_object('nextPhomConfig',p_config);
  perform public.lifemate_game_assert_phom_config(v_state->'nextPhomConfig');
  if v_state->>'phase'<>'playing' then
    v_state:=jsonb_set(v_state,'{members}',(select jsonb_agg(m||'{"ready":false}'::jsonb order by n)
      from jsonb_array_elements(v_state->'members') with ordinality as players(m,n)));
  end if;
  perform set_config('lifemate.phom_rules',p_room_id::text,true);
  update public.lifemate_game_rooms set state=v_state,version=version+1,updated_at=now(),
    expires_at=now()+interval '30 minutes',worker_token=null,worker_until=null
    where id=p_room_id returning * into v_room;
  perform set_config('lifemate.phom_rules','',true);
  update public.lifemate_game_seats set lease_until=now()+interval '90 seconds',auth_time=p_auth_time where uid=p_uid;
  perform public.lifemate_game_schedule(p_room_id);
  perform realtime.send(jsonb_build_object('version',v_room.version),'changed','card-room:'||p_room_id||':'||v_room.epoch,true);
  v_ack:=jsonb_build_object('roomId',p_room_id,'version',v_room.version);
  insert into public.lifemate_game_receipts(uid,action_id,room_id,fingerprint,ack) values(p_uid,p_action_id,p_room_id,p_fingerprint,v_ack);
  return jsonb_build_object('ack',v_ack,'record',to_jsonb(v_room),'controller',true,'now',floor(extract(epoch from clock_timestamp())*1000));
end $$;
revoke all on function public.lifemate_game_set_phom_rules(text,bigint,uuid,uuid,text,uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_set_phom_rules(text,bigint,uuid,uuid,text,uuid,bigint,uuid,jsonb) to service_role;


create or replace function public.lifemate_game_takeover(p_uid text,p_auth_time bigint,p_session_id uuid,p_room_id uuid)
returns jsonb language sql security definer set search_path='' as $$
  select public.lifemate_game_takeover(p_uid,p_auth_time,p_session_id,p_room_id,1);
$$;

create or replace function public.lifemate_game_status(p_uid text,p_auth_time bigint,p_session_id uuid,p_room_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_owner text; v_known boolean; v_now timestamptz:=clock_timestamp();
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid);
  select * into v_room from public.lifemate_game_rooms where id=p_room_id
    and id not in (select room_id from public.lifemate_game_deleted_rooms);
  if not found then return jsonb_build_object('roomId',p_room_id,'exists',false,'owner',false,
    'canRejoin',false,'canReopen',false,'canDelete',false,'expired',true,'phase',null,'version',null,'matchId',null); end if;
  v_owner:=coalesce(v_room.state->>'ownerUid',v_room.state->>'host',(v_room.state->'scoreMembers'->0->>'uid'));
  v_known:=v_owner=p_uid or exists(select 1 from jsonb_array_elements(coalesce(v_room.state->'scoreMembers','[]'::jsonb)) m where m->>'uid'=p_uid);
  if not v_known then return jsonb_build_object('roomId',p_room_id,'exists',false,'owner',false,
    'canRejoin',false,'canReopen',false,'canDelete',false,'expired',true,'phase',null,'version',null,'matchId',null); end if;
  return jsonb_build_object('roomId',p_room_id,'minClientVersion',case when v_room.state ? 'nextPhomConfig' then 6 when v_room.state ? 'nextSouthRules' then 5 when v_room.state ? 'southConfig' then 4 when v_room.state->>'gameKind'='phom' then 3 else 1 end,'gameKind',coalesce(v_room.state->>'gameKind','south'),'exists',true,'owner',v_owner=p_uid,
    'canRejoin',v_room.expires_at>v_now and v_room.state->>'phase'<>'closed'
      and (jsonb_array_length(v_room.state->'members')>0 or v_owner=p_uid),
    'canReopen',v_owner=p_uid and v_room.expires_at<=v_now and v_room.state->>'phase'<>'playing',
    'canDelete',v_owner=p_uid and v_room.state->>'phase'='finished',
    'expired',v_room.expires_at<=v_now,'phase',v_room.state->>'phase','version',v_room.version,'matchId',v_room.match_id);
end $$;

revoke all on function public.lifemate_game_status(text,bigint,uuid,uuid) from public,anon,authenticated;
grant execute on function public.lifemate_game_status(text,bigint,uuid,uuid) to service_role;
