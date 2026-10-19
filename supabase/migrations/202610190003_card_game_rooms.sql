-- Private authoritative state. No client role reads a room row or calls a mutation.
create table public.lifemate_game_config (
  singleton boolean primary key default true check(singleton),
  mode text not null default 'closed' check(mode in ('closed','drain','open')),
  test_uids text[] not null default '{}'
);
insert into public.lifemate_game_config(singleton) values(true);

create table public.lifemate_game_rooms (
  id uuid primary key,
  code text not null unique check(code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'),
  version bigint not null default 1 check(version > 0),
  epoch uuid not null default gen_random_uuid(),
  match_id uuid,
  state jsonb not null,
  expires_at timestamptz not null default now() + interval '30 minutes',
  next_due timestamptz not null default now() + interval '90 seconds',
  worker_token uuid,
  worker_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  private_until timestamptz,
  check(jsonb_typeof(state->'members')='array' and jsonb_array_length(state->'members')<=4),
  check(state->>'phase' in ('lobby','playing','finished','closed'))
);
create index lifemate_game_due on public.lifemate_game_rooms(next_due);
create index lifemate_game_private_retention on public.lifemate_game_rooms(private_until) where private_until is not null;

create table public.lifemate_game_seats (
  uid text primary key check(uid ~ '^[A-Za-z0-9_-]{1,128}$'),
  room_id uuid not null references public.lifemate_game_rooms(id) on delete cascade,
  session_id uuid not null,
  auth_time bigint not null,
  lease_until timestamptz not null default now() + interval '90 seconds'
);
create index lifemate_game_seats_room on public.lifemate_game_seats(room_id);

create table public.lifemate_game_receipts (
  uid text not null,
  action_id uuid not null,
  room_id uuid not null references public.lifemate_game_rooms(id) on delete cascade,
  fingerprint text not null,
  ack jsonb not null,
  created_at timestamptz not null default now(),
  primary key(uid,action_id)
);
create table public.lifemate_game_limits (
  bucket text primary key, window_start timestamptz not null, count integer not null
);
create table public.lifemate_game_results (
  match_id uuid primary key,
  participant_uids text[] not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

do $$ declare v_name text; begin
  foreach v_name in array array['config','rooms','seats','receipts','limits','results'] loop
    execute format('alter table public.lifemate_game_%I enable row level security',v_name);
    execute format('revoke all on public.lifemate_game_%I from public,anon,authenticated',v_name);
    execute format('grant all on public.lifemate_game_%I to service_role',v_name);
  end loop;
end $$;

create function public.lifemate_game_assert_account(p_uid text,p_auth_time bigint)
returns void language plpgsql security definer set search_path='' as $$
declare v_account public.lifemate_account_access;
begin
  if p_uid !~ '^[A-Za-z0-9_-]{1,128}$' or p_auth_time is null or p_auth_time<0
    or p_auth_time>extract(epoch from clock_timestamp())::bigint then
    raise exception 'invalid-session';
  end if;
  insert into public.lifemate_account_access(uid) values(p_uid) on conflict do nothing;
  -- Shared with reads/commits, conflicting with administrative row updates.
  select * into strict v_account from public.lifemate_account_access where uid=p_uid for share;
  if v_account.status<>'active' or v_account.valid_since>p_auth_time then raise exception 'invalid-session'; end if;
end $$;

create function public.lifemate_game_permit(p_uid text,p_new boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare v_config public.lifemate_game_config;
begin
  select * into strict v_config from public.lifemate_game_config where singleton for share;
  if not (p_uid=any(v_config.test_uids) or v_config.mode='open' or (v_config.mode='drain' and not p_new))
    then raise exception 'game-unavailable'; end if;
end $$;

create function public.lifemate_game_limit(p_bucket text,p_max integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  insert into public.lifemate_game_limits(bucket,window_start,count) values(p_bucket,now(),1)
  on conflict(bucket) do update set
    count=case when lifemate_game_limits.window_start<now()-interval '1 minute' then 1 else lifemate_game_limits.count+1 end,
    window_start=case when lifemate_game_limits.window_start<now()-interval '1 minute' then now() else lifemate_game_limits.window_start end
  returning count into v_count;
  if v_count>p_max then raise exception 'rate-limited'; end if;
end $$;

create function public.lifemate_game_receipt(p_uid text,p_auth_time bigint,p_action_id uuid,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_receipt public.lifemate_game_receipts;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  select * into v_receipt from public.lifemate_game_receipts where uid=p_uid and action_id=p_action_id;
  if not found then return null; end if;
  if v_receipt.fingerprint<>p_fingerprint then raise exception 'idempotency-conflict'; end if;
  return v_receipt.ack;
end $$;

create function public.lifemate_game_schedule(p_room uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.lifemate_game_rooms r set next_due=least(
    r.expires_at,
    case when r.state->>'phase'='playing' then to_timestamp((r.state->'game'->>'deadline')::double precision/1000) end,
    (select min(s.lease_until) from public.lifemate_game_seats s where s.room_id=r.id)
  ) where r.id=p_room;
end $$;

create function public.lifemate_game_read(p_uid text,p_auth_time bigint,p_session_id uuid,p_renew boolean default false)
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
  if p_renew and v_seat.session_id=p_session_id then
    update public.lifemate_game_seats set lease_until=now()+interval '90 seconds',auth_time=p_auth_time where uid=p_uid;
    perform public.lifemate_game_schedule(v_room.id);
  end if;
  return jsonb_build_object('room',to_jsonb(v_room),'controller',v_seat.session_id=p_session_id,
    'now',floor(extract(epoch from clock_timestamp())*1000));
end $$;

create function public.lifemate_game_find(p_uid text,p_auth_time bigint,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid,true);
  perform public.lifemate_game_limit('find:'||p_uid,15);
  select * into v_room from public.lifemate_game_rooms where code=p_code and expires_at>now() and state->>'phase'<>'closed';
  -- Return rather than raise, so failed guesses commit the throttle counter.
  if not found then return jsonb_build_object('error','room-not-found'); end if;
  return to_jsonb(v_room);
end $$;

create function public.lifemate_game_create(p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,
  p_fingerprint text,p_room_id uuid,p_code text,p_name text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ack jsonb;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid,true);
  -- UID-scoped serialization also fences concurrent creates with different room IDs.
  perform pg_advisory_xact_lock(hashtextextended('card-game:'||p_uid,0));
  v_ack:=public.lifemate_game_receipt(p_uid,p_auth_time,p_action_id,p_fingerprint);
  if v_ack is not null then return v_ack; end if;
  perform public.lifemate_game_limit('create:'||p_uid,5);
  if exists(select 1 from public.lifemate_game_seats where uid=p_uid) then raise exception 'already-in-room'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 30 then raise exception 'invalid-input'; end if;
  insert into public.lifemate_game_rooms(id,code,state) values(p_room_id,p_code,
    jsonb_build_object('phase','lobby','host',p_uid,'members',jsonb_build_array(
      jsonb_build_object('uid',p_uid,'name',p_name,'ready',false,'wins',0)),'game',null));
  insert into public.lifemate_game_seats(uid,room_id,session_id,auth_time) values(p_uid,p_room_id,p_session_id,p_auth_time);
  v_ack:=jsonb_build_object('roomId',p_room_id,'version',1);
  insert into public.lifemate_game_receipts(uid,action_id,room_id,fingerprint,ack) values(p_uid,p_action_id,p_room_id,p_fingerprint,v_ack);
  return v_ack;
end $$;

create function public.lifemate_game_commit(p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,
  p_fingerprint text,p_room_id uuid,p_version bigint,p_match_id uuid,p_kind text,p_state jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_seat public.lifemate_game_seats; v_ack jsonb; v_epoch uuid; v_match uuid; v_changed boolean;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  if p_kind<>'leave' then perform public.lifemate_game_permit(p_uid,p_kind in ('join','start')); end if;
  perform pg_advisory_xact_lock(hashtextextended('card-game:'||p_uid,0));
  select * into strict v_room from public.lifemate_game_rooms where id=p_room_id for update;
  v_ack:=public.lifemate_game_receipt(p_uid,p_auth_time,p_action_id,p_fingerprint);
  if v_ack is not null then return v_ack; end if;
  if p_kind='join' then
    if exists(select 1 from public.lifemate_game_seats where uid=p_uid) then raise exception 'already-in-room'; end if;
    if v_room.state->>'phase' not in ('lobby','finished') or v_room.expires_at<=now() then raise exception 'room-playing'; end if;
    if jsonb_array_length(v_room.state->'members')>=4 then raise exception 'room-full'; end if;
  else
    select * into v_seat from public.lifemate_game_seats where uid=p_uid and room_id=p_room_id for update;
    if not found then raise exception 'not-member'; end if;
    if v_seat.session_id<>p_session_id then raise exception 'session-replaced'; end if;
  end if;
  if v_room.version<>p_version then raise exception 'version-conflict'; end if;
  if v_room.match_id is distinct from p_match_id then raise exception 'match-conflict'; end if;
  if p_kind in ('play','pass') and (v_room.state->'game'->>'deadline')::double precision<=extract(epoch from clock_timestamp())*1000
    then raise exception 'turn-expired'; end if;
  if p_kind not in ('join','leave','ready','start','play','pass') or p_state is null
    or jsonb_typeof(p_state->'members')<>'array' then raise exception 'invalid-input'; end if;
  if p_kind='join' then
    insert into public.lifemate_game_seats(uid,room_id,session_id,auth_time) values(p_uid,p_room_id,p_session_id,p_auth_time);
  elsif p_kind='leave' then delete from public.lifemate_game_seats where uid=p_uid;
  else update public.lifemate_game_seats set lease_until=now()+interval '90 seconds',auth_time=p_auth_time where uid=p_uid; end if;
  v_changed:=v_room.state->'members' is distinct from p_state->'members' and p_kind in ('join','leave');
  v_epoch:=case when v_changed then gen_random_uuid() else v_room.epoch end;
  v_match:=case when p_kind='start' then gen_random_uuid() else v_room.match_id end;
  update public.lifemate_game_rooms set state=p_state,version=version+1,epoch=v_epoch,match_id=v_match,
    expires_at=now()+case when p_state->>'phase'='closed' then interval '24 hours' else interval '30 minutes' end,
    private_until=case when p_state->>'phase'='playing' then null
      when p_state->>'phase' in ('finished','closed') and (p_kind='start' or v_room.private_until is null)
        then now()+interval '24 hours' else v_room.private_until end,
    updated_at=now(),worker_token=null,worker_until=null where id=p_room_id;
  perform public.lifemate_game_schedule(p_room_id);
  if p_state->>'phase'='finished' and (p_kind='start' or v_room.state->>'phase'='playing') and v_match is not null then
    insert into public.lifemate_game_results(match_id,participant_uids,result)
    values(v_match,array(select m->>'uid' from jsonb_array_elements(p_state->'game'->'players') m),p_state->'game'->'result') on conflict do nothing;
  end if;
  if v_changed then perform realtime.send(jsonb_build_object('version',v_room.version+1),'invalidate','card-room:'||p_room_id||':'||v_room.epoch,true); end if;
  perform realtime.send(jsonb_build_object('version',v_room.version+1),'changed','card-room:'||p_room_id||':'||v_epoch,true);
  v_ack:=jsonb_build_object('roomId',p_room_id,'version',v_room.version+1);
  insert into public.lifemate_game_receipts(uid,action_id,room_id,fingerprint,ack) values(p_uid,p_action_id,p_room_id,p_fingerprint,v_ack);
  return v_ack;
end $$;

create function public.lifemate_game_takeover(p_uid text,p_auth_time bigint,p_session_id uuid,p_room_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room uuid;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid);
  perform pg_advisory_xact_lock(hashtextextended('card-game:'||p_uid,0));
  perform public.lifemate_game_limit('takeover:'||p_uid,6);
  select room_id into v_room from public.lifemate_game_seats where uid=p_uid and room_id=p_room_id;
  if v_room is null then raise exception 'not-member'; end if;
  perform 1 from public.lifemate_game_rooms where id=v_room for update;
  update public.lifemate_game_seats set session_id=p_session_id,auth_time=p_auth_time,lease_until=now()+interval '90 seconds' where uid=p_uid and room_id=v_room;
  if not found then raise exception 'not-member'; end if;
  update public.lifemate_game_rooms set version=version+1 where id=v_room;
  perform public.lifemate_game_schedule(v_room);
  perform realtime.send(jsonb_build_object('controllerChanged',true),'changed','card-room:'||v_room||':'||(select epoch from public.lifemate_game_rooms where id=v_room),true);
  return jsonb_build_object('roomId',v_room);
end $$;

create function public.lifemate_game_can_subscribe(p_topic text)
returns boolean language sql stable security definer set search_path='' as $$
  select (auth.jwt()->>'iss'='https://securetoken.google.com/baseapp-dd227')
    and (auth.jwt()->>'aud'='baseapp-dd227')
    and coalesce((auth.jwt()->>'auth_time') ~ '^[0-9]{1,12}$',false)
    and exists(select 1 from public.lifemate_game_seats s
      join public.lifemate_game_rooms r on r.id=s.room_id
      join public.lifemate_account_access a on a.uid=s.uid
      where s.uid=auth.jwt()->>'sub' and a.status='active'
        and a.valid_since<=case when (auth.jwt()->>'auth_time') ~ '^[0-9]{1,12}$' then (auth.jwt()->>'auth_time')::bigint else -1 end
        and p_topic='card-room:'||r.id||':'||r.epoch
        and r.state->>'phase'<>'closed')
$$;

-- Security-definer helpers default to service-only; this one boolean probe is
-- the only authenticated entry point and never returns another user's data.
do $$ declare v_function record; begin
  for v_function in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'lifemate_game_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',v_function.signature);
    execute format('grant execute on function %s to service_role',v_function.signature);
  end loop;
end $$;
grant execute on function public.lifemate_game_can_subscribe(text) to authenticated;
create policy lifemate_game_receive on realtime.messages for select to authenticated
using(extension='broadcast' and public.lifemate_game_can_subscribe((select realtime.topic())));
