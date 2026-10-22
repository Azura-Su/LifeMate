-- Return the committed room from the write RPC so the Edge handler can project
-- the response snapshot without issuing a second database request. The raw row
-- stays inside the service-role Edge function and is filtered by roomSnapshot.
create or replace function public.lifemate_game_commit(
  p_uid text,
  p_auth_time bigint,
  p_session_id uuid,
  p_action_id uuid,
  p_fingerprint text,
  p_room_id uuid,
  p_version bigint,
  p_match_id uuid,
  p_kind text,
  p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.lifemate_game_rooms;
  v_updated public.lifemate_game_rooms;
  v_seat public.lifemate_game_seats;
  v_ack jsonb;
  v_epoch uuid;
  v_match uuid;
  v_changed boolean;
begin
  perform public.lifemate_game_assert_account(p_uid, p_auth_time);
  if p_kind <> 'leave' then
    perform public.lifemate_game_permit(p_uid, p_kind in ('join', 'start'));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('card-game:' || p_uid, 0));
  select * into strict v_room
  from public.lifemate_game_rooms
  where id = p_room_id
  for update;

  v_ack := public.lifemate_game_receipt(
    p_uid, p_auth_time, p_action_id, p_fingerprint
  );
  if v_ack is not null then return v_ack; end if;

  if p_kind = 'join' then
    if exists(select 1 from public.lifemate_game_seats where uid = p_uid) then
      raise exception 'already-in-room';
    end if;
    if v_room.state->>'phase' not in ('lobby', 'finished')
      or v_room.expires_at <= now() then
      raise exception 'room-playing';
    end if;
    if jsonb_array_length(v_room.state->'members') >= 4 then
      raise exception 'room-full';
    end if;
  else
    select * into v_seat
    from public.lifemate_game_seats
    where uid = p_uid and room_id = p_room_id
    for update;
    if not found then raise exception 'not-member'; end if;
    if v_seat.session_id <> p_session_id then
      raise exception 'session-replaced';
    end if;
  end if;

  if v_room.version <> p_version then raise exception 'version-conflict'; end if;
  if v_room.match_id is distinct from p_match_id then
    raise exception 'match-conflict';
  end if;
  if p_kind in ('play', 'pass')
    and (v_room.state->'game'->>'deadline')::double precision
      <= extract(epoch from clock_timestamp()) * 1000 then
    raise exception 'turn-expired';
  end if;
  if p_kind not in ('join', 'leave', 'ready', 'start', 'play', 'pass')
    or p_state is null
    or jsonb_typeof(p_state->'members') <> 'array' then
    raise exception 'invalid-input';
  end if;

  if p_kind = 'join' then
    insert into public.lifemate_game_seats(uid, room_id, session_id, auth_time)
    values (p_uid, p_room_id, p_session_id, p_auth_time);
  elsif p_kind = 'leave' then
    delete from public.lifemate_game_seats where uid = p_uid;
  else
    update public.lifemate_game_seats
    set lease_until = now() + interval '90 seconds', auth_time = p_auth_time
    where uid = p_uid;
  end if;

  v_changed := v_room.state->'members' is distinct from p_state->'members'
    and p_kind in ('join', 'leave');
  v_epoch := case when v_changed then gen_random_uuid() else v_room.epoch end;
  v_match := case when p_kind = 'start' then gen_random_uuid() else v_room.match_id end;

  update public.lifemate_game_rooms
  set state = p_state,
      version = version + 1,
      epoch = v_epoch,
      match_id = v_match,
      expires_at = now() + case
        when p_state->>'phase' = 'closed' then interval '24 hours'
        else interval '30 minutes'
      end,
      private_until = case
        when p_state->>'phase' = 'playing' then null
        when p_state->>'phase' in ('finished', 'closed')
          and (p_kind = 'start' or v_room.private_until is null)
          then now() + interval '24 hours'
        else v_room.private_until
      end,
      updated_at = now(),
      worker_token = null,
      worker_until = null
  where id = p_room_id
  returning * into v_updated;

  perform public.lifemate_game_schedule(p_room_id);
  if p_state->>'phase' = 'finished'
    and (p_kind = 'start' or v_room.state->>'phase' = 'playing')
    and v_match is not null then
    insert into public.lifemate_game_results(match_id, participant_uids, result)
    values (
      v_match,
      array(select m->>'uid' from jsonb_array_elements(p_state->'game'->'players') m),
      p_state->'game'->'result'
    )
    on conflict do nothing;
  end if;

  if v_changed then
    perform realtime.send(
      jsonb_build_object('version', v_room.version + 1),
      'invalidate',
      'card-room:' || p_room_id || ':' || v_room.epoch,
      true
    );
  end if;
  perform realtime.send(
    jsonb_build_object('version', v_room.version + 1),
    'changed',
    'card-room:' || p_room_id || ':' || v_epoch,
    true
  );

  v_ack := jsonb_build_object('roomId', p_room_id, 'version', v_room.version + 1);
  insert into public.lifemate_game_receipts(uid, action_id, room_id, fingerprint, ack)
  values (p_uid, p_action_id, p_room_id, p_fingerprint, v_ack);

  if p_kind in ('ready', 'start', 'play', 'pass') then
    return jsonb_build_object(
      'ack', v_ack,
      'record', to_jsonb(v_updated),
      'controller', v_seat.session_id = p_session_id,
      'now', floor(extract(epoch from clock_timestamp()) * 1000)
    );
  end if;
  return v_ack;
end;
$$;
