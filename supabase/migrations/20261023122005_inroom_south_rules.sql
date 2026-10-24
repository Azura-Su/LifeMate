-- Current room settings stay pinned through settlement; pending settings survive
-- until the next deal. Only the owner RPC may change pending settings.
create function public.lifemate_game_assert_south_rules(p_rules jsonb) returns void
language plpgsql set search_path='' as $$
begin
  if jsonb_typeof(p_rules) is distinct from 'object' then raise exception 'invalid-input'; end if;
  if (select count(*) from jsonb_object_keys(p_rules))<>2
    or not (p_rules ?& array['amountPerCard','southConfig'])
    or jsonb_typeof(p_rules->'amountPerCard') is distinct from 'number'
    or (p_rules->>'amountPerCard') !~ '^[0-9]+$'
    then raise exception 'invalid-input'; end if;
  if (p_rules->>'amountPerCard')::numeric not between 1 and 1000000000
    then raise exception 'invalid-input'; end if;
  perform public.lifemate_game_assert_south_config(p_rules->'southConfig');
end $$;
revoke all on function public.lifemate_game_assert_south_rules(jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_assert_south_rules(jsonb) to service_role;

create or replace function public.lifemate_game_keep_south_config() returns trigger
language plpgsql set search_path='' as $$
declare v_promotion boolean:=false; v_expected jsonb;
begin
  if new.state ? 'nextSouthRules' then
    if coalesce(new.state->>'gameKind','south')<>'south' then raise exception 'invalid-input'; end if;
    perform public.lifemate_game_assert_south_rules(new.state->'nextSouthRules');
  end if;
  if tg_op='UPDATE' then
    if old.state->'nextSouthRules' is distinct from new.state->'nextSouthRules'
      and coalesce(current_setting('lifemate.south_rules',true),'')<>new.id::text
      then raise exception 'invalid-input'; end if;
    if old.state ? 'nextSouthRules' and new.match_id is not null and new.match_id is distinct from old.match_id then
      if old.state->>'phase' not in ('lobby','finished') or new.state->>'phase' not in ('playing','finished')
        or old.state->'nextSouthRules' is distinct from new.state->'nextSouthRules'
        then raise exception 'invalid-input'; end if;
      v_expected:=case when old.state->'nextSouthRules'->'southConfig'='{"finishMode":"continue","cutTwoAmount":0}'::jsonb
        then null else old.state->'nextSouthRules'->'southConfig' end;
      if new.state->'southConfig' is distinct from v_expected
        or new.state->'amountPerCard' is distinct from old.state->'nextSouthRules'->'amountPerCard'
        then raise exception 'invalid-input'; end if;
      v_promotion:=true;
    end if;
    if old.state->'amountPerCard' is distinct from new.state->'amountPerCard' and not (v_promotion or (
      not (old.state ? 'amountPerCard') and old.state->>'phase'='lobby' and old.match_id is null
      and jsonb_typeof(new.state->'amountPerCard')='number' and (new.state->>'amountPerCard') ~ '^[0-9]+$'
      and (new.state->>'amountPerCard')::numeric between 0 and 1000000000
    ))
      then raise exception 'invalid-input'; end if;
    if old.state->'southConfig' is distinct from new.state->'southConfig' and not (v_promotion or (
      not (old.state ? 'southConfig') and new.state ? 'southConfig'
      and coalesce(current_setting('lifemate.south_create',true),'')=new.id::text
      and old.state->>'phase'='lobby' and old.match_id is null
    )) then raise exception 'invalid-input'; end if;
  elsif new.state ? 'nextSouthRules' then raise exception 'invalid-input';
  end if;
  if new.state ? 'southConfig' then
    if coalesce(new.state->>'gameKind','south')<>'south' then raise exception 'invalid-input'; end if;
    perform public.lifemate_game_assert_south_config(new.state->'southConfig');
    if new.state->'game' is not null and new.state->'game'<>'null'::jsonb and (
      new.state->'game'->>'rulesVersion' is distinct from 'south-v2'
      or new.state->'game'->'southConfig' is distinct from new.state->'southConfig'
    ) then raise exception 'invalid-input'; end if;
  elsif new.state->'game'->>'rulesVersion'='south-v2' then raise exception 'invalid-input';
  end if;
  return new;
end $$;

create function public.lifemate_game_set_south_rules(
  p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
  p_room_id uuid,p_version bigint,p_match_id uuid,p_amount_per_card bigint,p_config jsonb
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
  if coalesce(v_room.state->>'gameKind','south')<>'south'
    or v_room.state->>'phase' not in ('lobby','playing','finished') then raise exception 'invalid-input'; end if;
  v_state:=v_room.state||jsonb_build_object('nextSouthRules',jsonb_build_object('amountPerCard',p_amount_per_card,'southConfig',p_config));
  perform public.lifemate_game_assert_south_rules(v_state->'nextSouthRules');
  if v_state->>'phase'<>'playing' then
    v_state:=jsonb_set(v_state,'{members}',(select jsonb_agg(m||'{"ready":false}'::jsonb order by n)
      from jsonb_array_elements(v_state->'members') with ordinality as players(m,n)));
  end if;
  perform set_config('lifemate.south_rules',p_room_id::text,true);
  update public.lifemate_game_rooms set state=v_state,version=version+1,updated_at=now(),
    expires_at=now()+interval '30 minutes',worker_token=null,worker_until=null
    where id=p_room_id returning * into v_room;
  perform set_config('lifemate.south_rules','',true);
  update public.lifemate_game_seats set lease_until=now()+interval '90 seconds',auth_time=p_auth_time where uid=p_uid;
  perform public.lifemate_game_schedule(p_room_id);
  perform realtime.send(jsonb_build_object('version',v_room.version),'changed','card-room:'||p_room_id||':'||v_room.epoch,true);
  v_ack:=jsonb_build_object('roomId',p_room_id,'version',v_room.version);
  insert into public.lifemate_game_receipts(uid,action_id,room_id,fingerprint,ack) values(p_uid,p_action_id,p_room_id,p_fingerprint,v_ack);
  return jsonb_build_object('ack',v_ack,'record',to_jsonb(v_room),'controller',true,'now',floor(extract(epoch from clock_timestamp())*1000));
end $$;
revoke all on function public.lifemate_game_set_south_rules(text,bigint,uuid,uuid,text,uuid,bigint,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_set_south_rules(text,bigint,uuid,uuid,text,uuid,bigint,uuid,bigint,jsonb) to service_role;

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
  return jsonb_build_object('roomId',p_room_id,'minClientVersion',case when v_room.state ? 'nextSouthRules' then 5 when v_room.state ? 'southConfig' then 4 when v_room.state->>'gameKind'='phom' then 3 else 1 end,'gameKind',coalesce(v_room.state->>'gameKind','south'),'exists',true,'owner',v_owner=p_uid,
    'canRejoin',v_room.expires_at>v_now and v_room.state->>'phase'<>'closed'
      and (jsonb_array_length(v_room.state->'members')>0 or v_owner=p_uid),
    'canReopen',v_owner=p_uid and v_room.expires_at<=v_now and v_room.state->>'phase'<>'playing',
    'canDelete',v_owner=p_uid and v_room.state->>'phase'='finished',
    'expired',v_room.expires_at<=v_now,'phase',v_room.state->>'phase','version',v_room.version,'matchId',v_room.match_id);
end $$;

revoke all on function public.lifemate_game_status(text,bigint,uuid,uuid) from public,anon,authenticated;
grant execute on function public.lifemate_game_status(text,bigint,uuid,uuid) to service_role;
