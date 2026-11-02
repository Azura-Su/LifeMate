-- Larger tables preserve the single-deck rules and all legacy room data.
create or replace function public.lifemate_game_capacity(p_state jsonb)
returns integer language sql immutable set search_path='' as $$
  select case p_state->>'gameKind' when 'sam' then 5 when 'tan' then 6 else 4 end
$$;
create or replace function public.lifemate_game_large_table(p_state jsonb)
returns boolean language sql immutable set search_path='' as $$
  select coalesce(jsonb_array_length(p_state->'members'),0)>4
    or coalesce(jsonb_array_length(p_state->'game'->'players'),0)>4
$$;
revoke all on function public.lifemate_game_capacity(jsonb), public.lifemate_game_large_table(jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_capacity(jsonb), public.lifemate_game_large_table(jsonb) to service_role;

alter table public.lifemate_game_rooms drop constraint lifemate_game_rooms_state_check;
alter table public.lifemate_game_rooms add constraint lifemate_game_rooms_capacity_check check (
  jsonb_typeof(state->'members')='array'
  and jsonb_array_length(state->'members')<=public.lifemate_game_capacity(state)
  and coalesce(jsonb_array_length(state->'game'->'players'),0)<=public.lifemate_game_capacity(state)
);

create or replace function public.lifemate_game_commit(
  p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
  p_room_id uuid,p_version bigint,p_match_id uuid,p_kind text,p_state jsonb,p_client_version integer
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_updated public.lifemate_game_rooms;
  v_seat public.lifemate_game_seats; v_ack jsonb; v_epoch uuid; v_match uuid; v_changed boolean; v_target text; v_target_seat public.lifemate_game_seats;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  if p_kind<>'leave' then perform public.lifemate_game_permit(p_uid,p_kind in ('join','start')); end if;
  perform pg_advisory_xact_lock(hashtextextended('card-game:'||p_uid,0));
  select * into strict v_room from public.lifemate_game_rooms where id=p_room_id for update;
  v_ack:=public.lifemate_game_receipt(p_uid,p_auth_time,p_action_id,p_fingerprint);
  if v_ack is not null then return v_ack; end if;
  if p_kind not in ('join','leave','ready','start','play','pass','transfer-owner','kick','game-action')
    or p_state is null or jsonb_typeof(p_state->'members')<>'array' or jsonb_array_length(p_state->'members')>public.lifemate_game_capacity(v_room.state) or jsonb_array_length(p_state->'members')<>(select count(distinct m->>'uid') from jsonb_array_elements(p_state->'members') m) then raise exception 'invalid-input'; end if;
  if coalesce(p_state->>'gameKind','south') is distinct from coalesce(v_room.state->>'gameKind','south') then raise exception 'invalid-input'; end if;
  if p_client_version is null or p_client_version not between 1 and 13 then raise exception 'invalid-input'; end if;
  if p_kind<>'leave' and p_client_version<13 and
    (public.lifemate_game_large_table(v_room.state) or public.lifemate_game_large_table(p_state)) then raise exception 'game-update-required'; end if;
  if p_kind='game-action' and v_room.state->>'gameKind' not in ('sam','tan') then raise exception 'invalid-input'; end if;
  if v_room.expires_at<=now() then raise exception 'room-expired'; end if;
  if p_kind='join' then
    if exists(select 1 from public.lifemate_game_seats where uid=p_uid) then raise exception 'already-in-room'; end if;
    if v_room.state->>'phase' not in ('lobby','finished','closed') then raise exception 'room-playing'; end if;
    if v_room.state->>'phase'='closed' and coalesce(v_room.state->>'ownerUid',(v_room.state->'scoreMembers'->0->>'uid'))<>p_uid then raise exception 'room-not-found'; end if;
    if jsonb_array_length(v_room.state->'members')>=public.lifemate_game_capacity(v_room.state) then raise exception 'room-full'; end if;
  else
    select * into v_seat from public.lifemate_game_seats where uid=p_uid and room_id=p_room_id for update;
    if not found then raise exception 'not-member'; end if;
    if v_seat.session_id<>p_session_id then raise exception 'session-replaced'; end if;
  end if;
  if v_room.version<>p_version then raise exception 'version-conflict'; end if;
  if v_room.match_id is distinct from p_match_id then raise exception 'match-conflict'; end if;
  if p_kind in ('play','pass','game-action') and (v_room.state->'game'->>'deadline')::double precision<=extract(epoch from clock_timestamp())*1000 then raise exception 'turn-expired'; end if;
  if p_kind='transfer-owner' and coalesce(v_room.state->>'ownerUid',v_room.state->>'host',(v_room.state->'scoreMembers'->0->>'uid')) is distinct from p_uid then raise exception 'not-owner'; end if;
  if p_kind='transfer-owner' and (
    p_state->>'ownerUid' is null or p_state->>'ownerUid'=p_uid or
    not exists(select 1 from jsonb_array_elements(v_room.state->'members') member
      where member->>'uid'=p_state->>'ownerUid')
  ) then raise exception 'invalid-input'; end if;
  if p_kind='kick' then
    if (case when v_room.state ? 'ownerUid' then v_room.state->>'ownerUid' else v_room.state->>'host' end) is distinct from p_uid then raise exception 'not-owner'; end if;
    if jsonb_array_length(p_state->'members')<>jsonb_array_length(v_room.state->'members')-1
      or p_state->>'ownerUid' is distinct from coalesce(v_room.state->>'ownerUid',v_room.state->>'host')
      or exists(select 1 from jsonb_array_elements(p_state->'members') m
        where not exists(select 1 from jsonb_array_elements(v_room.state->'members') old where old->>'uid'=m->>'uid'))
      then raise exception 'invalid-input'; end if;
    select m->>'uid' into v_target from jsonb_array_elements(v_room.state->'members') m
      where not exists(select 1 from jsonb_array_elements(p_state->'members') n where n->>'uid'=m->>'uid');
    if v_target is null or v_target=p_uid then raise exception 'invalid-input'; end if;
    select * into v_target_seat from public.lifemate_game_seats where uid=v_target and room_id=p_room_id for update;
    delete from public.lifemate_game_seats where uid=v_target and room_id=p_room_id;
    if v_target_seat.uid is not null then
      insert into public.lifemate_game_receipts(uid,action_id,room_id,fingerprint,ack)
        values(v_target,gen_random_uuid(),p_room_id,'room-kicked',jsonb_build_object(
          'id',p_action_id,'roomId',p_room_id,'reason','kicked','sessionId',v_target_seat.session_id));
    end if;
  end if;
  if p_kind='join' then
    insert into public.lifemate_game_seats(uid,room_id,session_id,auth_time) values(p_uid,p_room_id,p_session_id,p_auth_time);
  elsif p_kind='leave' then
    delete from public.lifemate_game_seats where uid=p_uid;
  else
    update public.lifemate_game_seats set lease_until=now()+interval '90 seconds',auth_time=p_auth_time where uid=p_uid;
  end if;
  v_changed:=v_room.state->'members' is distinct from p_state->'members' and p_kind in ('join','leave','kick');
  v_epoch:=case when v_changed then gen_random_uuid() else v_room.epoch end;
  v_match:=case when p_kind='start' then gen_random_uuid() else v_room.match_id end;
  update public.lifemate_game_rooms set state=p_state,version=version+1,epoch=v_epoch,match_id=v_match,
    expires_at=case when p_kind in ('join','ready','start','play','pass','game-action','transfer-owner','kick')
      then now()+interval '30 minutes' else expires_at end,
    private_until=case when p_state->>'phase'='playing' then null
      when p_state->>'phase' in ('finished','closed') and (p_kind='start' or v_room.private_until is null)
        then now()+interval '24 hours' else v_room.private_until end,
    updated_at=now(),worker_token=null,worker_until=null
    where id=p_room_id returning * into v_updated;
  perform public.lifemate_game_schedule(p_room_id);
  if p_state->>'phase'='finished' and (p_kind='start' or v_room.state->>'phase'='playing') and v_match is not null then
    insert into public.lifemate_game_results(match_id,participant_uids,result)
    values(v_match,array(select m->>'uid' from jsonb_array_elements(p_state->'game'->'players') m),p_state->'game'->'result') on conflict do nothing;
  end if;
  if v_changed then perform realtime.send(jsonb_build_object('version',v_room.version+1),'invalidate','card-room:'||p_room_id||':'||v_room.epoch,true); end if;
  perform realtime.send(jsonb_build_object('version',v_room.version+1),'changed','card-room:'||p_room_id||':'||v_epoch,true);
  v_ack:=jsonb_build_object('roomId',p_room_id,'version',v_room.version+1);
  insert into public.lifemate_game_receipts(uid,action_id,room_id,fingerprint,ack) values(p_uid,p_action_id,p_room_id,p_fingerprint,v_ack);
  if p_kind in ('ready','start','play','pass','game-action','transfer-owner','kick') then
    return jsonb_build_object('ack',v_ack,'record',to_jsonb(v_updated),'controller',v_seat.session_id=p_session_id,
      'now',floor(extract(epoch from clock_timestamp())*1000));
  end if;
  return v_ack;
end $$;

create or replace function public.lifemate_game_status(p_uid text,p_auth_time bigint,p_session_id uuid,p_room_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_owner text; v_known boolean; v_now timestamptz:=clock_timestamp();
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid);
  select * into v_room from public.lifemate_game_rooms where id=p_room_id
    and id not in (select room_id from public.lifemate_game_deleted_rooms);
  if not found then return jsonb_build_object('roomId',p_room_id,'exists',false,'owner',false,'canRejoin',false,'canReopen',false,'canDelete',false,'expired',true,'phase',null,'version',null,'matchId',null); end if;
  v_owner:=case when v_room.state ? 'ownerUid' then nullif(v_room.state->>'ownerUid','')
    else coalesce(v_room.state->>'host',v_room.state->'scoreMembers'->0->>'uid') end;
  v_known:=coalesce(v_owner=p_uid,false) or exists(select 1 from jsonb_array_elements(coalesce(v_room.state->'scoreMembers','[]'::jsonb)) m where m->>'uid'=p_uid);
  if not v_known then return jsonb_build_object('roomId',p_room_id,'exists',false,'owner',false,'canRejoin',false,'canReopen',false,'canDelete',false,'expired',true,'phase',null,'version',null,'matchId',null); end if;
  return jsonb_build_object('roomId',p_room_id,'minClientVersion',case
    when public.lifemate_game_large_table(v_room.state) then 13
    when v_room.state->'southConfig' ? 'instantWinAmount' or v_room.state->'nextSouthRules'->'southConfig' ? 'instantWinAmount' then 12
    when v_room.state->'variantConfig'->>'rulesVersion' in ('north-v2','sam-v2')
      or v_room.state->'nextVariantConfig'->>'rulesVersion' in ('north-v2','sam-v2') then 11
    when v_room.state ? 'variantConfig' or v_room.state ? 'nextVariantConfig' then 10
    when v_room.state->>'gameKind' in ('north','sam','tan') then 9
    when v_room.state->'phomConfig' ? 'options' or v_room.state->'nextPhomConfig' ? 'options' then 7
    when v_room.state ? 'nextPhomConfig' then 6 when v_room.state ? 'nextSouthRules' then 5
    when v_room.state ? 'southConfig' then 4 when v_room.state->>'gameKind'='phom' then 3 else 1 end,
    'gameKind',coalesce(v_room.state->>'gameKind','south'),'exists',true,
    'canRejoin',v_room.expires_at>v_now and v_room.state->>'phase'<>'closed' and (jsonb_array_length(v_room.state->'members')>0 or coalesce(v_owner=p_uid,false)),
    'owner',coalesce(v_owner=p_uid,false),
    'canReopen',coalesce(v_owner=p_uid,false) and v_room.expires_at<=now() and v_room.state->>'phase'<>'playing',
    'canDelete',coalesce(v_owner=p_uid,false) and v_room.state->>'phase'='finished',
    'expired',v_room.expires_at<=v_now,'phase',v_room.state->>'phase','version',v_room.version,'matchId',v_room.match_id);
end $$;

create or replace function public.lifemate_game_takeover(p_uid text,p_auth_time bigint,p_session_id uuid,p_room_id uuid,p_client_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_seat_room uuid; v_min_version integer;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid);
  perform pg_advisory_xact_lock(hashtextextended('card-game:'||p_uid,0));
  perform public.lifemate_game_limit('takeover:'||p_uid,6);
  select room_id into v_seat_room from public.lifemate_game_seats where uid=p_uid and room_id=p_room_id;
  if not found then raise exception 'not-member'; end if;
  select * into v_room from public.lifemate_game_rooms where id=p_room_id for update;
  if not found then raise exception 'not-member'; end if;
  if v_room.expires_at<=now() or exists(select 1 from public.lifemate_game_deleted_rooms where room_id=p_room_id) then raise exception 'room-expired'; end if;
  if p_client_version is null or p_client_version not between 1 and 13 then raise exception 'invalid-input'; end if;
  v_min_version:=case
    when public.lifemate_game_large_table(v_room.state) then 13
    when v_room.state->'southConfig' ? 'instantWinAmount' or v_room.state->'nextSouthRules'->'southConfig' ? 'instantWinAmount' then 12
    when v_room.state->'variantConfig'->>'rulesVersion' in ('north-v2','sam-v2')
      or v_room.state->'nextVariantConfig'->>'rulesVersion' in ('north-v2','sam-v2') then 11
    when v_room.state ? 'variantConfig' or v_room.state ? 'nextVariantConfig' then 10
    when v_room.state->>'gameKind' in ('north','sam','tan') then 9
    when v_room.state->'phomConfig' ? 'options' or v_room.state->'nextPhomConfig' ? 'options' then 7
    when v_room.state ? 'nextPhomConfig' then 6 when v_room.state ? 'nextSouthRules' then 5
    when v_room.state ? 'southConfig' then 4 when v_room.state->>'gameKind'='phom' then 3 else 1 end;
  if p_client_version<v_min_version then raise exception 'game-update-required'; end if;
  update public.lifemate_game_seats set session_id=p_session_id,auth_time=p_auth_time,lease_until=now()+interval '90 seconds' where uid=p_uid and room_id=p_room_id;
  if not found then raise exception 'not-member'; end if;
  update public.lifemate_game_rooms set version=version+1 where id=p_room_id;
  perform public.lifemate_game_schedule(p_room_id);
  perform realtime.send(jsonb_build_object('controllerChanged',true),'changed','card-room:'||p_room_id||':'||v_room.epoch,true);
  return jsonb_build_object('roomId',p_room_id);
end $$;

create or replace function public.lifemate_game_set_variant_rules(
 p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
 p_room_id uuid,p_version bigint,p_match_id uuid,p_config jsonb,p_client_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_seat public.lifemate_game_seats; v_ack jsonb; v_state jsonb; v_owner text; v_profile text; v_required_version integer;
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
  v_owner:=case when v_room.state ? 'ownerUid' then nullif(v_room.state->>'ownerUid','')
    else coalesce(nullif(v_room.state->>'host',''),v_room.state->'scoreMembers'->0->>'uid') end;
  if v_owner is distinct from p_uid then raise exception 'not-owner'; end if;
  if v_room.expires_at<=now() then raise exception 'room-expired'; end if;
  if v_room.version is distinct from p_version then raise exception 'version-conflict'; end if;
  if v_room.match_id is distinct from p_match_id then raise exception 'match-conflict'; end if;
  if p_client_version is null or p_client_version not in (10,11,12,13) then raise exception 'game-update-required'; end if;
  if v_room.state->>'gameKind' not in ('north','sam','tan')
    or v_room.state->>'phase' not in ('lobby','playing','finished') then raise exception 'invalid-input'; end if;
  v_required_version:=case when
    v_room.state->'variantConfig'->>'rulesVersion' in ('north-v2','sam-v2')
    or v_room.state->'nextVariantConfig'->>'rulesVersion' in ('north-v2','sam-v2')
    then 11 else 10 end;
  if p_client_version<v_required_version then raise exception 'game-update-required'; end if;
  if public.lifemate_game_large_table(v_room.state) and p_client_version<13 then raise exception 'game-update-required'; end if;
  perform public.lifemate_game_assert_variant_config(p_config);
  v_profile:=p_config->>'rulesVersion';
  if (v_profile='north-v2' and v_room.state->>'gameKind'<>'north')
    or (v_profile='sam-v2' and v_room.state->>'gameKind'<>'sam')
    or (v_profile in ('north-v2','sam-v2') and p_client_version<11)
    or (v_profile is null and p_client_version<10) then raise exception 'game-update-required'; end if;
  v_state:=v_room.state||jsonb_build_object('nextVariantConfig',p_config);
  if v_state->>'phase'<>'playing' then
    v_state:=jsonb_set(v_state,'{members}',(select jsonb_agg(m||'{"ready":false}'::jsonb order by n)
      from jsonb_array_elements(v_state->'members') with ordinality as players(m,n)));
  end if;
  perform set_config('lifemate.variant_rules',p_room_id::text,true);
  update public.lifemate_game_rooms set state=v_state,version=version+1,updated_at=now(),
    expires_at=now()+interval '30 minutes',worker_token=null,worker_until=null
    where id=p_room_id returning * into v_room;
  perform set_config('lifemate.variant_rules','',true);
  update public.lifemate_game_seats set lease_until=now()+interval '90 seconds',auth_time=p_auth_time where uid=p_uid;
  perform public.lifemate_game_schedule(p_room_id);
  perform realtime.send(jsonb_build_object('version',v_room.version),'changed','card-room:'||p_room_id||':'||v_room.epoch,true);
  v_ack:=jsonb_build_object('roomId',p_room_id,'version',v_room.version);
  insert into public.lifemate_game_receipts(uid,action_id,room_id,fingerprint,ack) values(p_uid,p_action_id,p_room_id,p_fingerprint,v_ack);
  return jsonb_build_object('ack',v_ack,'record',to_jsonb(v_room),'controller',true,'now',floor(extract(epoch from clock_timestamp())*1000));
end $$;
-- Older Edge instances must also respect the retained game's roster after
-- players leave. Delegate the legacy signature through the same guarded path.
create or replace function public.lifemate_game_commit(
  p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
  p_room_id uuid,p_version bigint,p_match_id uuid,p_kind text,p_state jsonb
)
returns jsonb language sql security definer set search_path='' as $$
  select public.lifemate_game_commit(p_uid,p_auth_time,p_session_id,p_action_id,p_fingerprint,
    p_room_id,p_version,p_match_id,p_kind,p_state,12)
$$;
revoke all on function public.lifemate_game_commit(text,bigint,uuid,uuid,text,uuid,bigint,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_commit(text,bigint,uuid,uuid,text,uuid,bigint,uuid,text,jsonb) to service_role;

-- No new public/anonymous RPC access.
revoke all on function public.lifemate_game_commit(text,bigint,uuid,uuid,text,uuid,bigint,uuid,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.lifemate_game_commit(text,bigint,uuid,uuid,text,uuid,bigint,uuid,text,jsonb,integer) to service_role;
