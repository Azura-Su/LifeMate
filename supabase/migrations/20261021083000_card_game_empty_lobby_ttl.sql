-- Lease cleanup for an empty lobby is maintenance, not room activity. Keep
-- the room's existing inactivity deadline instead of silently adding 30 min.
create or replace function public.lifemate_game_commit_worker(
  p_room_id uuid,
  p_token uuid,
  p_version bigint,
  p_state jsonb,
  p_remove_uids text[]
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_room public.lifemate_game_rooms;
  v_epoch uuid;
begin
  select * into v_room
  from public.lifemate_game_rooms
  where id = p_room_id
  for update;

  if not found
    or v_room.worker_token is distinct from p_token
    or v_room.version <> p_version then
    return false;
  end if;

  if exists (
    select 1
    from public.lifemate_game_seats s
    join public.lifemate_account_access a on a.uid = s.uid
    cross join public.lifemate_game_config c
    where s.room_id = p_room_id
      and s.uid = any(p_remove_uids)
      and s.lease_until > now()
      and a.status = 'active'
      and a.valid_since <= s.auth_time
      and not (c.mode = 'closed' and not s.uid = any(c.test_uids))
  ) and v_room.expires_at > now() then
    update public.lifemate_game_rooms
    set worker_token = null, worker_until = null
    where id = p_room_id;
    perform public.lifemate_game_schedule(p_room_id);
    return false;
  end if;

  delete from public.lifemate_game_seats
  where room_id = p_room_id and uid = any(p_remove_uids);
  v_epoch := case
    when cardinality(p_remove_uids) > 0 then gen_random_uuid()
    else v_room.epoch
  end;

  update public.lifemate_game_rooms
  set state = p_state,
      epoch = v_epoch,
      version = version + 1,
      expires_at = case
        when p_state->>'phase' = 'closed' then now() + interval '24 hours'
        when p_state->>'phase' in ('lobby', 'finished')
          and jsonb_array_length(p_state->'members') = 0 then v_room.expires_at
        else now() + interval '30 minutes'
      end,
      private_until = case
        when p_state->>'phase' = 'playing' then null
        when p_state->>'phase' in ('finished', 'closed')
          and v_room.private_until is null then now() + interval '24 hours'
        else v_room.private_until
      end,
      worker_token = null,
      worker_until = null,
      updated_at = now()
  where id = p_room_id;

  perform public.lifemate_game_schedule(p_room_id);

  if p_state->>'phase' = 'finished'
    and v_room.state->>'phase' = 'playing'
    and v_room.match_id is not null then
    insert into public.lifemate_game_results(match_id, participant_uids, result)
    values (
      v_room.match_id,
      array(select m->>'uid' from jsonb_array_elements(p_state->'game'->'players') m),
      p_state->'game'->'result'
    ) on conflict do nothing;
  end if;

  if v_epoch <> v_room.epoch then
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
  return true;
end
$$;

revoke all on function public.lifemate_game_commit_worker(uuid, uuid, bigint, jsonb, text[])
  from public, anon, authenticated;
grant execute on function public.lifemate_game_commit_worker(uuid, uuid, bigint, jsonb, text[])
  to service_role;
