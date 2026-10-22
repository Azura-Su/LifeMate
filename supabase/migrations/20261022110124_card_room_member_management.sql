-- Owner-managed removal, authoritative capacity and durable session-bound notices.

-- Successful seat creation supersedes a prior kick. Notices are never consumed
-- by reads, so an interrupted bootstrap cannot lose the notification.
create function public.lifemate_game_clear_removal() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  delete from public.lifemate_game_receipts where uid=new.uid and fingerprint='room-kicked';
  return new;
end $$;
revoke all on function public.lifemate_game_clear_removal() from public,anon,authenticated;
create trigger lifemate_game_clear_removal after insert on public.lifemate_game_seats
for each row execute function public.lifemate_game_clear_removal();

create or replace function public.lifemate_game_read(
  p_uid text,p_auth_time bigint,p_session_id uuid,p_renew boolean default false
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_seat public.lifemate_game_seats; v_notice jsonb;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid);
  perform pg_advisory_xact_lock(hashtextextended('card-game:'||p_uid,0));
  perform public.lifemate_game_limit('read:'||p_uid,240);
  select * into v_seat from public.lifemate_game_seats where uid=p_uid;
  if not found then
    select ack-'sessionId' into v_notice from public.lifemate_game_receipts
      where uid=p_uid and fingerprint='room-kicked' and ack->>'sessionId'=p_session_id::text
      order by created_at desc,action_id desc limit 1;
    return jsonb_build_object('room',null,'now',floor(extract(epoch from clock_timestamp())*1000))
      ||case when v_notice is null then '{}'::jsonb else jsonb_build_object('removal',v_notice) end;
  end if;
  select * into strict v_room from public.lifemate_game_rooms where id=v_seat.room_id for update;
  select * into v_seat from public.lifemate_game_seats where uid=p_uid and room_id=v_room.id for update;
  if not found then
    select ack-'sessionId' into v_notice from public.lifemate_game_receipts
      where uid=p_uid and fingerprint='room-kicked' and ack->>'sessionId'=p_session_id::text
      order by created_at desc,action_id desc limit 1;
    return jsonb_build_object('room',null,'now',floor(extract(epoch from clock_timestamp())*1000))
      ||case when v_notice is null then '{}'::jsonb else jsonb_build_object('removal',v_notice) end;
  end if;
  if v_room.expires_at<=now() then return jsonb_build_object('room',null,'now',floor(extract(epoch from clock_timestamp())*1000)); end if;
  if p_renew and v_seat.session_id=p_session_id and v_room.expires_at>now()
    and v_room.state->>'phase'<>'closed' then
    update public.lifemate_game_seats set lease_until=now()+interval '90 seconds',auth_time=p_auth_time where uid=p_uid;
    perform public.lifemate_game_schedule(v_room.id);
  end if;
  return jsonb_build_object('room',to_jsonb(v_room),'controller',v_seat.session_id=p_session_id,
    'now',floor(extract(epoch from clock_timestamp())*1000));
end $$;


create or replace function public.lifemate_game_commit(
  p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
  p_room_id uuid,p_version bigint,p_match_id uuid,p_kind text,p_state jsonb
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
  if p_kind not in ('join','leave','ready','start','play','pass','transfer-owner','kick')
    or p_state is null or jsonb_typeof(p_state->'members')<>'array' or jsonb_array_length(p_state->'members')>4 or jsonb_array_length(p_state->'members')<>(select count(distinct m->>'uid') from jsonb_array_elements(p_state->'members') m) then raise exception 'invalid-input'; end if;
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
    expires_at=case when p_kind in ('join','ready','start','play','pass','transfer-owner','kick')
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
  if p_kind in ('ready','start','play','pass','transfer-owner','kick') then
    return jsonb_build_object('ack',v_ack,'record',to_jsonb(v_updated),'controller',v_seat.session_id=p_session_id,
      'now',floor(extract(epoch from clock_timestamp())*1000));
  end if;
  return v_ack;
end $$;


-- Recovery is an idempotent join action too. Persist its receipt so a lost
-- response retried after a kick cannot silently enroll the player again.
create function public.lifemate_game_rejoin(
  p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,
  p_fingerprint text,p_room_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_seat public.lifemate_game_seats; v_ack jsonb;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid,true);
  perform pg_advisory_xact_lock(hashtextextended('card-game:'||p_uid,0));
  select * into strict v_room from public.lifemate_game_rooms where id=p_room_id for update;
  v_ack:=public.lifemate_game_receipt(p_uid,p_auth_time,p_action_id,p_fingerprint);
  if v_ack is not null then return jsonb_build_object('ack',v_ack); end if;
  if v_room.expires_at<=now() then raise exception 'room-expired'; end if;
  select * into v_seat from public.lifemate_game_seats where uid=p_uid and room_id=p_room_id for update;
  if not found or not exists(select 1 from jsonb_array_elements(v_room.state->'members') m where m->>'uid'=p_uid)
    then raise exception 'not-member'; end if;
  v_ack:=jsonb_build_object('roomId',p_room_id,'version',v_room.version);
  insert into public.lifemate_game_receipts(uid,action_id,room_id,fingerprint,ack)
    values(p_uid,p_action_id,p_room_id,p_fingerprint,v_ack);
  if v_seat.session_id=p_session_id then
    update public.lifemate_game_seats set lease_until=now()+interval '90 seconds',auth_time=p_auth_time where uid=p_uid;
    perform public.lifemate_game_schedule(p_room_id);
  end if;
  return jsonb_build_object('ack',v_ack,'record',to_jsonb(v_room),'controller',v_seat.session_id=p_session_id,
    'now',floor(extract(epoch from clock_timestamp())*1000));
end $$;
revoke all on function public.lifemate_game_rejoin(text,bigint,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.lifemate_game_rejoin(text,bigint,uuid,uuid,text,uuid) to service_role;
