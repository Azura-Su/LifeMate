-- Room activity expiry hides rejoin access but does not delete the room.
-- Explicit owner deletion writes a tombstone so retries cannot recreate it.
create table public.lifemate_game_deleted_rooms (
  room_id uuid primary key,
  owner_uid text not null,
  action_id uuid not null,
  fingerprint text not null,
  create_uid text,
  create_action_id uuid,
  create_fingerprint text,
  deleted_at timestamptz not null default now()
);
alter table public.lifemate_game_deleted_rooms enable row level security;
revoke all on public.lifemate_game_deleted_rooms from public, anon, authenticated;
grant all on public.lifemate_game_deleted_rooms to service_role;

update public.lifemate_game_rooms r set state=r.state||jsonb_build_object('ownerUid',coalesce(
  r.state->>'ownerUid',r.state->>'host',r.state->'scoreMembers'->0->>'uid',r.state->'members'->0->>'uid'))
where r.state->>'ownerUid' is null and coalesce(
  r.state->>'host',r.state->'scoreMembers'->0->>'uid',r.state->'members'->0->>'uid') is not null;

-- Older rooms created before scoreMembers existed still need a durable owner
-- entry so the owner can reopen an expired room even before any match starts.
update public.lifemate_game_rooms r set state=jsonb_set(state,'{scoreMembers}',(
  select coalesce(jsonb_agg(member.value||jsonb_build_object('balance',coalesce((member.value->>'balance')::bigint,0))), '[]'::jsonb)
    || case when exists(select 1 from jsonb_array_elements(coalesce(r.state->'members','[]'::jsonb)) member(value)
      where member.value->>'uid'=r.state->>'ownerUid') then '[]'::jsonb
      else jsonb_build_array(jsonb_build_object('uid',r.state->>'ownerUid','name','Người chơi','wins',0,'balance',0)) end
  from jsonb_array_elements(coalesce(r.state->'members','[]'::jsonb)) member(value)
),true)
where (jsonb_typeof(r.state->'scoreMembers') is distinct from 'array'
  or jsonb_array_length(coalesce(r.state->'scoreMembers','[]'::jsonb))=0)
  and nullif(r.state->>'ownerUid','') is not null;

-- Keep the legacy create signature usable while initializing lifecycle state.
alter function public.lifemate_game_create(text,bigint,uuid,uuid,text,uuid,text,text)
  rename to lifemate_game_create_legacy;

create or replace function public.lifemate_game_create(
  p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
  p_room_id uuid,p_code text,p_name text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ack jsonb; v_tombstone public.lifemate_game_deleted_rooms;
begin
  select * into v_tombstone from public.lifemate_game_deleted_rooms
    where create_uid=p_uid and create_action_id=p_action_id;
  if found then
    if v_tombstone.create_fingerprint<>p_fingerprint then raise exception 'idempotency-conflict'; end if;
    raise exception 'room-deleted';
  end if;
  v_ack:=public.lifemate_game_create_legacy(
    p_uid,p_auth_time,p_session_id,p_action_id,p_fingerprint,p_room_id,p_code,p_name
  );
  update public.lifemate_game_rooms r set state=state||jsonb_build_object(
    'ownerUid',coalesce(state->>'ownerUid',p_uid),
    'scoreMembers',coalesce(nullif(state->'scoreMembers','[]'::jsonb),(
      select jsonb_agg(member.value||jsonb_build_object('balance',coalesce((member.value->>'balance')::bigint,0)))
      from jsonb_array_elements(state->'members') member(value)
    ))
  ) where id=(v_ack->>'roomId')::uuid;
  return v_ack;
end $$;

revoke all on function public.lifemate_game_create(text,bigint,uuid,uuid,text,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.lifemate_game_create(text,bigint,uuid,uuid,text,uuid,text,text)
  to service_role;
revoke all on function public.lifemate_game_create_legacy(text,bigint,uuid,uuid,text,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.lifemate_game_create_legacy(text,bigint,uuid,uuid,text,uuid,text,text)
  to service_role;

-- New rooms also retain the creator's score identity from the first commit.
create or replace function public.lifemate_game_create(
  p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
  p_room_id uuid,p_code text,p_name text,p_amount_per_card bigint
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ack jsonb; v_tombstone public.lifemate_game_deleted_rooms;
begin
  if p_amount_per_card is null or p_amount_per_card<0 or p_amount_per_card>1000000000 then
    raise exception 'invalid-input';
  end if;
  select * into v_tombstone from public.lifemate_game_deleted_rooms
    where create_uid=p_uid and create_action_id=p_action_id;
  if found then
    if v_tombstone.create_fingerprint<>p_fingerprint then raise exception 'idempotency-conflict'; end if;
    raise exception 'room-deleted';
  end if;
  v_ack:=public.lifemate_game_create(
    p_uid,p_auth_time,p_session_id,p_action_id,p_fingerprint,p_room_id,p_code,p_name
  );
  update public.lifemate_game_rooms r set state=state||jsonb_build_object(
    'amountPerCard',p_amount_per_card,
    'ownerUid',coalesce(state->>'ownerUid',p_uid),
    'scoreMembers',coalesce(nullif(state->'scoreMembers','[]'::jsonb),(
      select jsonb_agg(member.value||jsonb_build_object('balance',coalesce((member.value->>'balance')::bigint,0)))
      from jsonb_array_elements(state->'members') member(value)
    ))
  ) where id=(v_ack->>'roomId')::uuid;
  return v_ack;
end $$;

create or replace function public.lifemate_game_schedule(p_room uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.lifemate_game_rooms r set next_due=case
    when r.expires_at<=now() then 'infinity'::timestamptz
    else least(
      r.expires_at,
      case when r.state->>'phase'='playing'
        then to_timestamp((r.state->'game'->>'deadline')::double precision/1000) end,
      (select min(s.lease_until) from public.lifemate_game_seats s where s.room_id=r.id)
    ) end
  where r.id=p_room;
end $$;

-- Reads/leases maintain the 90-second seat lease only. They are not room activity.
create or replace function public.lifemate_game_read(
  p_uid text,p_auth_time bigint,p_session_id uuid,p_renew boolean default false
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_seat public.lifemate_game_seats;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid);
  perform pg_advisory_xact_lock(hashtextextended('card-game:'||p_uid,0));
  perform public.lifemate_game_limit('read:'||p_uid,240);
  select * into v_seat from public.lifemate_game_seats where uid=p_uid;
  if not found then return jsonb_build_object('room',null,'now',floor(extract(epoch from clock_timestamp())*1000)); end if;
  select * into strict v_room from public.lifemate_game_rooms where id=v_seat.room_id for update;
  select * into v_seat from public.lifemate_game_seats where uid=p_uid and room_id=v_room.id for update;
  if not found then return jsonb_build_object('room',null,'now',floor(extract(epoch from clock_timestamp())*1000)); end if;
  if v_room.expires_at<=now() then return jsonb_build_object('room',null,'now',floor(extract(epoch from clock_timestamp())*1000)); end if;
  if p_renew and v_seat.session_id=p_session_id and v_room.expires_at>now()
    and v_room.state->>'phase'<>'closed' then
    update public.lifemate_game_seats set lease_until=now()+interval '90 seconds',auth_time=p_auth_time where uid=p_uid;
    perform public.lifemate_game_schedule(v_room.id);
  end if;
  return jsonb_build_object('room',to_jsonb(v_room),'controller',v_seat.session_id=p_session_id,
    'now',floor(extract(epoch from clock_timestamp())*1000));
end $$;

create or replace function public.lifemate_game_takeover(p_uid text,p_auth_time bigint,p_session_id uuid,p_room_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_seat_room uuid;
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
  update public.lifemate_game_seats set session_id=p_session_id,auth_time=p_auth_time,
    lease_until=now()+interval '90 seconds' where uid=p_uid and room_id=p_room_id;
  if not found then raise exception 'not-member'; end if;
  update public.lifemate_game_rooms set version=version+1 where id=p_room_id;
  perform public.lifemate_game_schedule(p_room_id);
  perform realtime.send(jsonb_build_object('controllerChanged',true),'changed',
    'card-room:'||p_room_id||':'||v_room.epoch,true);
  return jsonb_build_object('roomId',p_room_id);
end $$;

-- A retained but inactive room is only discoverable by its current owner.
create or replace function public.lifemate_game_find(p_uid text,p_auth_time bigint,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_owner text;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid,true);
  perform public.lifemate_game_limit('find:'||p_uid,15);
  select * into v_room from public.lifemate_game_rooms
    where code=p_code and expires_at>now()
      and id not in (select room_id from public.lifemate_game_deleted_rooms);
  if not found then return jsonb_build_object('error','room-not-found'); end if;
  if jsonb_array_length(v_room.state->'members')=0 then
    v_owner:=coalesce(v_room.state->>'ownerUid',v_room.state->>'host',(v_room.state->'scoreMembers'->0->>'uid'));
    if v_owner is distinct from p_uid then return jsonb_build_object('error','room-not-found'); end if;
  end if;
  return to_jsonb(v_room);
end $$;

create or replace function public.lifemate_game_commit(
  p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
  p_room_id uuid,p_version bigint,p_match_id uuid,p_kind text,p_state jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_updated public.lifemate_game_rooms;
  v_seat public.lifemate_game_seats; v_ack jsonb; v_epoch uuid; v_match uuid; v_changed boolean;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  if p_kind<>'leave' then perform public.lifemate_game_permit(p_uid,p_kind in ('join','start')); end if;
  perform pg_advisory_xact_lock(hashtextextended('card-game:'||p_uid,0));
  select * into strict v_room from public.lifemate_game_rooms where id=p_room_id for update;
  v_ack:=public.lifemate_game_receipt(p_uid,p_auth_time,p_action_id,p_fingerprint);
  if v_ack is not null then return v_ack; end if;
  if p_kind not in ('join','leave','ready','start','play','pass','transfer-owner')
    or p_state is null or jsonb_typeof(p_state->'members')<>'array' then raise exception 'invalid-input'; end if;
  if v_room.expires_at<=now() then raise exception 'room-expired'; end if;
  if p_kind='join' then
    if exists(select 1 from public.lifemate_game_seats where uid=p_uid) then raise exception 'already-in-room'; end if;
    if v_room.state->>'phase' not in ('lobby','finished','closed') then raise exception 'room-playing'; end if;
    if v_room.state->>'phase'='closed' and coalesce(v_room.state->>'ownerUid',(v_room.state->'scoreMembers'->0->>'uid'))<>p_uid then raise exception 'room-not-found'; end if;
    if jsonb_array_length(v_room.state->'members')>=4 then raise exception 'room-full'; end if;
  else
    select * into v_seat from public.lifemate_game_seats where uid=p_uid and room_id=p_room_id for update;
    if not found then raise exception 'not-member'; end if;
    if v_seat.session_id<>p_session_id then raise exception 'session-replaced'; end if;
  end if;
  if v_room.version<>p_version then raise exception 'version-conflict'; end if;
  if v_room.match_id is distinct from p_match_id then raise exception 'match-conflict'; end if;
  if p_kind in ('play','pass') and (v_room.state->'game'->>'deadline')::double precision<=extract(epoch from clock_timestamp())*1000 then raise exception 'turn-expired'; end if;
  if p_kind='transfer-owner' and coalesce(v_room.state->>'ownerUid',v_room.state->>'host',(v_room.state->'scoreMembers'->0->>'uid')) is distinct from p_uid then raise exception 'not-owner'; end if;
  if p_kind='transfer-owner' and (
    p_state->>'ownerUid' is null or p_state->>'ownerUid'=p_uid or
    not exists(select 1 from jsonb_array_elements(v_room.state->'members') member
      where member->>'uid'=p_state->>'ownerUid')
  ) then raise exception 'invalid-input'; end if;
  if p_kind='join' then
    insert into public.lifemate_game_seats(uid,room_id,session_id,auth_time) values(p_uid,p_room_id,p_session_id,p_auth_time);
  elsif p_kind='leave' then
    delete from public.lifemate_game_seats where uid=p_uid;
  else
    update public.lifemate_game_seats set lease_until=now()+interval '90 seconds',auth_time=p_auth_time where uid=p_uid;
  end if;
  v_changed:=v_room.state->'members' is distinct from p_state->'members' and p_kind in ('join','leave');
  v_epoch:=case when v_changed then gen_random_uuid() else v_room.epoch end;
  v_match:=case when p_kind='start' then gen_random_uuid() else v_room.match_id end;
  update public.lifemate_game_rooms set state=p_state,version=version+1,epoch=v_epoch,match_id=v_match,
    expires_at=case when p_kind in ('join','ready','start','play','pass','transfer-owner')
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
  if p_kind in ('ready','start','play','pass','transfer-owner') then
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
  if not found then return jsonb_build_object('roomId',p_room_id,'exists',false,'owner',false,
    'canRejoin',false,'canReopen',false,'canDelete',false,'expired',true,'phase',null,'version',null,'matchId',null); end if;
  v_owner:=coalesce(v_room.state->>'ownerUid',v_room.state->>'host',(v_room.state->'scoreMembers'->0->>'uid'));
  v_known:=v_owner=p_uid or exists(select 1 from jsonb_array_elements(coalesce(v_room.state->'scoreMembers','[]'::jsonb)) m where m->>'uid'=p_uid);
  if not v_known then return jsonb_build_object('roomId',p_room_id,'exists',false,'owner',false,
    'canRejoin',false,'canReopen',false,'canDelete',false,'expired',true,'phase',null,'version',null,'matchId',null); end if;
  return jsonb_build_object('roomId',p_room_id,'exists',true,'owner',v_owner=p_uid,
    'canRejoin',v_room.expires_at>v_now and v_room.state->>'phase'<>'closed',
    'canReopen',v_owner=p_uid and v_room.expires_at<=v_now and v_room.state->>'phase'<>'playing',
    'canDelete',v_owner=p_uid and v_room.state->>'phase'='finished',
    'expired',v_room.expires_at<=v_now,'phase',v_room.state->>'phase','version',v_room.version,'matchId',v_room.match_id);
end $$;

create or replace function public.lifemate_game_reopen(
  p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
  p_room_id uuid,p_version bigint,p_match_id uuid,p_name text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_member jsonb; v_ack jsonb; v_epoch uuid; v_old_epoch uuid;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid);
  perform pg_advisory_xact_lock(hashtextextended('card-game:'||p_uid,0));
  select * into strict v_room from public.lifemate_game_rooms where id=p_room_id
    and id not in (select room_id from public.lifemate_game_deleted_rooms) for update;
  v_ack:=public.lifemate_game_receipt(p_uid,p_auth_time,p_action_id,p_fingerprint);
  if v_ack is not null then return v_ack; end if;
  if coalesce(v_room.state->>'ownerUid',v_room.state->>'host',(v_room.state->'scoreMembers'->0->>'uid'))<>p_uid then raise exception 'not-owner'; end if;
  if v_room.expires_at>now() then raise exception 'room-not-expired'; end if;
  if v_room.version<>p_version then raise exception 'version-conflict'; end if;
  if v_room.match_id is distinct from p_match_id then raise exception 'match-conflict'; end if;
  if v_room.state->>'phase'='playing' then raise exception 'room-playing'; end if;
  if exists(select 1 from public.lifemate_game_seats where uid=p_uid and room_id<>p_room_id) then raise exception 'already-in-room'; end if;
  select score.member into v_member from jsonb_array_elements(coalesce(v_room.state->'scoreMembers','[]'::jsonb)) as score(member) where score.member->>'uid'=p_uid;
  if v_member is null then raise exception 'not-owner'; end if;
  -- Expiration invalidates every old seat even if the cleanup worker has not
  -- run yet. Reopening starts with the owner only; former players can rejoin.
  delete from public.lifemate_game_seats where room_id=p_room_id;
  v_old_epoch:=v_room.epoch;
  v_epoch:=gen_random_uuid();
  update public.lifemate_game_rooms set state=jsonb_set(jsonb_set(jsonb_set(state,'{members}',jsonb_build_array(
      jsonb_build_object('uid',p_uid,'name',coalesce(nullif(trim(p_name),''),v_member->>'name'),'ready',false,
        'wins',coalesce((v_member->>'wins')::integer,0),'balance',coalesce((v_member->>'balance')::bigint,0)))),
      '{phase}',to_jsonb(case when state->'game' is null or state->'game'='null'::jsonb then 'lobby'
        when state->>'phase'='closed' then 'finished' else state->>'phase' end),true),
      '{host}',to_jsonb(p_uid),true),version=version+1,epoch=v_epoch,expires_at=now()+interval '30 minutes',
      worker_token=null,worker_until=null,updated_at=now() where id=p_room_id returning * into v_room;
  insert into public.lifemate_game_seats(uid,room_id,session_id,auth_time) values(p_uid,p_room_id,p_session_id,p_auth_time);
  v_ack:=jsonb_build_object('roomId',p_room_id,'version',v_room.version);
  insert into public.lifemate_game_receipts(uid,action_id,room_id,fingerprint,ack) values(p_uid,p_action_id,p_room_id,p_fingerprint,v_ack);
  perform public.lifemate_game_schedule(p_room_id);
  perform realtime.send(jsonb_build_object('version',v_room.version),'invalidate','card-room:'||p_room_id||':'||v_old_epoch,true);
  return v_ack;
end $$;

create or replace function public.lifemate_game_delete(p_uid text,p_auth_time bigint,p_session_id uuid,
  p_action_id uuid,p_fingerprint text,p_room_id uuid,p_version bigint,p_match_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_owner text; v_ack jsonb; v_deleted public.lifemate_game_deleted_rooms;
  v_create_uid text; v_create_action_id uuid; v_create_fingerprint text;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid);
  select * into v_deleted from public.lifemate_game_deleted_rooms where room_id=p_room_id;
  if found then
    if v_deleted.owner_uid<>p_uid then raise exception 'room-not-found'; end if;
    if v_deleted.action_id=p_action_id and v_deleted.fingerprint<>p_fingerprint then raise exception 'idempotency-conflict'; end if;
    return jsonb_build_object('roomId',p_room_id,'deleted',true);
  end if;
  select * into strict v_room from public.lifemate_game_rooms where id=p_room_id for update;
  v_owner:=coalesce(v_room.state->>'ownerUid',v_room.state->>'host',(v_room.state->'scoreMembers'->0->>'uid'));
  if v_owner is distinct from p_uid then raise exception 'not-owner'; end if;
  if v_room.state->>'phase'<>'finished' then raise exception 'room-not-finished'; end if;
  if v_room.version<>p_version then raise exception 'version-conflict'; end if;
  if v_room.match_id is distinct from p_match_id then raise exception 'match-conflict'; end if;
  select uid,action_id,fingerprint into v_create_uid,v_create_action_id,v_create_fingerprint
    from public.lifemate_game_receipts where room_id=p_room_id order by created_at limit 1;
  insert into public.lifemate_game_deleted_rooms(room_id,owner_uid,action_id,fingerprint,
    create_uid,create_action_id,create_fingerprint)
    values(p_room_id,p_uid,p_action_id,p_fingerprint,v_create_uid,v_create_action_id,v_create_fingerprint);
  delete from public.lifemate_game_rooms where id=p_room_id;
  return jsonb_build_object('roomId',p_room_id,'deleted',true);
end $$;

create or replace function public.lifemate_game_claim_due(p_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb; v_expired record;
begin
  for v_expired in
    update public.lifemate_game_rooms set state=jsonb_set(state,'{game}','null'::jsonb),
      private_until=null,version=version+1
    where id in (select id from public.lifemate_game_rooms
      where private_until<=now() order by private_until for update skip locked limit 100)
    returning id,epoch,version
  loop
    perform realtime.send(jsonb_build_object('version',v_expired.version),'changed','card-room:'||v_expired.id||':'||v_expired.epoch,true);
  end loop;
  delete from public.lifemate_game_results where match_id in (select match_id from public.lifemate_game_results where created_at<now()-interval '30 days' limit 100);
  delete from public.lifemate_game_limits where bucket in (select bucket from public.lifemate_game_limits where window_start<now()-interval '10 minutes' limit 100);
  update public.lifemate_game_rooms r set next_due='infinity'::timestamptz
    where r.expires_at<=now() and r.next_due<=now()
      and not exists(select 1 from public.lifemate_game_seats s where s.room_id=r.id)
      and r.id not in (select room_id from public.lifemate_game_deleted_rooms);
  with due as (select r.id from public.lifemate_game_rooms r where r.next_due<=now()
    and (r.worker_until is null or r.worker_until<now()) and r.state->>'phase'<>'closed'
    and (r.expires_at>now() or exists(select 1 from public.lifemate_game_seats s where s.room_id=r.id))
    and r.id not in (select room_id from public.lifemate_game_deleted_rooms)
    order by r.next_due for update of r skip locked limit 8), claimed as (
    update public.lifemate_game_rooms r set worker_token=p_token,worker_until=now()+interval '15 seconds'
    from due where r.id=due.id returning r.*)
  select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('expired',coalesce((
      select jsonb_agg(s.uid) from public.lifemate_game_seats s
      left join public.lifemate_account_access a on a.uid=s.uid
      cross join public.lifemate_game_config c
      where s.room_id=r.id and (s.lease_until<=now() or a.status is distinct from 'active'
        or a.valid_since>s.auth_time or (c.mode='closed' and not s.uid=any(c.test_uids)))
    ),'[]'::jsonb))),'[]'::jsonb) into v_rows from claimed r;
  return jsonb_build_object('rooms',v_rows,'now',floor(extract(epoch from clock_timestamp())*1000));
end $$;

create or replace function public.lifemate_game_commit_worker(p_room_id uuid,p_token uuid,p_version bigint,p_state jsonb,p_remove_uids text[])
returns boolean language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_epoch uuid;
begin
  select * into v_room from public.lifemate_game_rooms where id=p_room_id for update;
  if not found or v_room.worker_token is distinct from p_token or v_room.version<>p_version then return false; end if;
  if exists(select 1 from public.lifemate_game_seats s join public.lifemate_account_access a on a.uid=s.uid
    cross join public.lifemate_game_config c where s.room_id=p_room_id and s.uid=any(p_remove_uids)
    and s.lease_until>now() and a.status='active' and a.valid_since<=s.auth_time
    and not (c.mode='closed' and not s.uid=any(c.test_uids))) and v_room.expires_at>now() then
    update public.lifemate_game_rooms set worker_token=null,worker_until=null where id=p_room_id;
    perform public.lifemate_game_schedule(p_room_id); return false;
  end if;
  delete from public.lifemate_game_seats where room_id=p_room_id and uid=any(p_remove_uids);
  v_epoch:=case when cardinality(p_remove_uids)>0 then gen_random_uuid() else v_room.epoch end;
  update public.lifemate_game_rooms set state=p_state,epoch=v_epoch,version=version+1,
    expires_at=v_room.expires_at,private_until=case when p_state->>'phase'='playing' then null
      when p_state->>'phase' in ('finished','closed') and v_room.private_until is null then now()+interval '24 hours'
      else v_room.private_until end,worker_token=null,worker_until=null,updated_at=now()
    where id=p_room_id;
  perform public.lifemate_game_schedule(p_room_id);
  if p_state->>'phase'='finished' and v_room.state->>'phase'='playing' and v_room.match_id is not null then
    insert into public.lifemate_game_results(match_id,participant_uids,result)
    values(v_room.match_id,array(select m->>'uid' from jsonb_array_elements(p_state->'game'->'players') m),p_state->'game'->'result') on conflict do nothing;
  end if;
  if v_epoch<>v_room.epoch then perform realtime.send(jsonb_build_object('version',v_room.version+1),'invalidate','card-room:'||p_room_id||':'||v_room.epoch,true); end if;
  perform realtime.send(jsonb_build_object('version',v_room.version+1),'changed','card-room:'||p_room_id||':'||v_epoch,true);
  return true;
end $$;

-- The tombstone is only needed while its owner account exists.
create or replace function public.lifemate_game_erase_account(p_uid text)
returns void language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_owner text;
begin
  for v_room in select * from public.lifemate_game_rooms r where
    exists(select 1 from jsonb_array_elements(r.state->'members') m where m->>'uid'=p_uid)
    or exists(select 1 from jsonb_array_elements(coalesce(r.state->'game'->'players','[]'::jsonb)) p where p->>'uid'=p_uid)
    or exists(select 1 from jsonb_array_elements(coalesce(r.state->'scoreMembers','[]'::jsonb)) s where s->>'uid'=p_uid)
    or r.state->>'ownerUid'=p_uid
    order by r.id for update loop
    if exists(select 1 from jsonb_array_elements(v_room.state->'members') m where m->>'uid'=p_uid)
      or exists(select 1 from jsonb_array_elements(coalesce(v_room.state->'game'->'players','[]'::jsonb)) p where p->>'uid'=p_uid) then
      perform realtime.send(jsonb_build_object('closed',true),'invalidate','card-room:'||v_room.id||':'||v_room.epoch,true);
      delete from public.lifemate_game_rooms where id=v_room.id;
    else
      v_owner:=coalesce(v_room.state->>'ownerUid',v_room.state->'scoreMembers'->0->>'uid');
      update public.lifemate_game_rooms set state=case when v_owner=p_uid then jsonb_set(
        jsonb_set(state,'{scoreMembers}',(
          select coalesce(jsonb_agg(s.value order by s.position),'[]'::jsonb)
          from jsonb_array_elements(coalesce(state->'scoreMembers','[]'::jsonb)) with ordinality s(value,position)
          where s.value->>'uid' is distinct from p_uid
        )), '{ownerUid}', '""'::jsonb, true
      ) else jsonb_set(state,'{scoreMembers}',(
        select coalesce(jsonb_agg(s.value order by s.position),'[]'::jsonb)
        from jsonb_array_elements(coalesce(state->'scoreMembers','[]'::jsonb)) with ordinality s(value,position)
        where s.value->>'uid' is distinct from p_uid
      )) end,
      version=version+1,worker_token=null,worker_until=null
      where id=v_room.id;
      perform realtime.send(jsonb_build_object('version',v_room.version+1),'changed','card-room:'||v_room.id||':'||v_room.epoch,true);
    end if;
  end loop;
  update public.lifemate_game_deleted_rooms set
    owner_uid=case when owner_uid=p_uid then '' else owner_uid end,
    create_uid=case when create_uid=p_uid then null else create_uid end,
    create_action_id=case when create_uid=p_uid then null else create_action_id end,
    create_fingerprint=case when create_uid=p_uid then null else create_fingerprint end
    where owner_uid=p_uid or create_uid=p_uid;
  delete from public.lifemate_game_results where p_uid=any(participant_uids);
  delete from public.lifemate_game_receipts where uid=p_uid;
end $$;

revoke all on function public.lifemate_game_status(text,bigint,uuid,uuid) from public,anon,authenticated;
revoke all on function public.lifemate_game_takeover(text,bigint,uuid,uuid) from public,anon,authenticated;
revoke all on function public.lifemate_game_reopen(text,bigint,uuid,uuid,text,uuid,bigint,uuid,text) from public,anon,authenticated;
revoke all on function public.lifemate_game_delete(text,bigint,uuid,uuid,text,uuid,bigint,uuid) from public,anon,authenticated;
revoke all on function public.lifemate_game_claim_due(uuid) from public,anon,authenticated;
revoke all on function public.lifemate_game_commit_worker(uuid,uuid,bigint,jsonb,text[]) from public,anon,authenticated;
grant execute on function public.lifemate_game_status(text,bigint,uuid,uuid) to service_role;
grant execute on function public.lifemate_game_takeover(text,bigint,uuid,uuid) to service_role;
grant execute on function public.lifemate_game_reopen(text,bigint,uuid,uuid,text,uuid,bigint,uuid,text) to service_role;
grant execute on function public.lifemate_game_delete(text,bigint,uuid,uuid,text,uuid,bigint,uuid) to service_role;
grant execute on function public.lifemate_game_claim_due(uuid) to service_role;
grant execute on function public.lifemate_game_commit_worker(uuid,uuid,bigint,jsonb,text[]) to service_role;
revoke all on function public.lifemate_game_erase_account(text) from public,anon,authenticated;
grant execute on function public.lifemate_game_erase_account(text) to service_role;
