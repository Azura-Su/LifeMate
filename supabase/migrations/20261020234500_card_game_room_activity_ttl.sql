create or replace function public.lifemate_game_read(
  p_uid text,
  p_auth_time bigint,
  p_session_id uuid,
  p_renew boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_room public.lifemate_game_rooms;
  v_seat public.lifemate_game_seats;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid);
  perform pg_advisory_xact_lock(hashtextextended('card-game:'||p_uid,0));
  perform public.lifemate_game_limit('read:'||p_uid,240);
  select * into v_seat from public.lifemate_game_seats where uid=p_uid;
  if not found then
    return jsonb_build_object('room',null,'now',floor(extract(epoch from clock_timestamp())*1000));
  end if;
  select * into strict v_room from public.lifemate_game_rooms where id=v_seat.room_id for update;
  select * into v_seat from public.lifemate_game_seats where uid=p_uid and room_id=v_room.id for update;
  if not found then
    return jsonb_build_object('room',null,'now',floor(extract(epoch from clock_timestamp())*1000));
  end if;
  if p_renew and v_seat.session_id=p_session_id and v_room.expires_at>now()
    and v_room.state->>'phase'<>'closed' then
    update public.lifemate_game_seats
      set lease_until=now()+interval '90 seconds',auth_time=p_auth_time
      where uid=p_uid and room_id=v_room.id and session_id=p_session_id;
    update public.lifemate_game_rooms
      set expires_at=now()+interval '30 minutes',updated_at=now()
      where id=v_room.id and expires_at>now() and state->>'phase'<>'closed';
    perform public.lifemate_game_schedule(v_room.id);
    select * into strict v_room from public.lifemate_game_rooms where id=v_room.id;
  end if;
  return jsonb_build_object('room',to_jsonb(v_room),'controller',v_seat.session_id=p_session_id,
    'now',floor(extract(epoch from clock_timestamp())*1000));
end $$;

create or replace function public.lifemate_game_record_closed_result()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.state->>'phase'='playing'
    and new.state->>'phase'='closed'
    and new.state->'game'->>'status'='finished'
    and new.match_id is not null then
    insert into public.lifemate_game_results(match_id,participant_uids,result)
    values (
      new.match_id,
      array(select player->>'uid' from jsonb_array_elements(new.state->'game'->'players') player),
      new.state->'game'->'result'
    ) on conflict(match_id) do nothing;
  end if;
  return new;
end $$;

revoke all on function public.lifemate_game_record_closed_result() from public,anon,authenticated;
drop trigger if exists lifemate_game_record_closed_result on public.lifemate_game_rooms;
create trigger lifemate_game_record_closed_result
  after update of state on public.lifemate_game_rooms
  for each row execute function public.lifemate_game_record_closed_result();
