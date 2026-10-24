-- Widen client capability before Edge upgrade; options remain rejected until final migration.
CREATE OR REPLACE FUNCTION public.lifemate_game_takeover(p_uid text, p_auth_time bigint, p_session_id uuid, p_room_id uuid, p_client_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if p_client_version is null or p_client_version not between 1 and 7 then raise exception 'invalid-input'; end if;
  if p_client_version < (case when v_room.state->'phomConfig' ? 'options' or v_room.state->'nextPhomConfig' ? 'options' then 7
    when v_room.state ? 'nextPhomConfig' then 6
    when v_room.state ? 'nextSouthRules' then 5 when v_room.state ? 'southConfig' then 4
    when v_room.state->>'gameKind'='phom' then 3 else 1 end)
    then raise exception 'game-update-required'; end if;
  update public.lifemate_game_seats set session_id=p_session_id,auth_time=p_auth_time,
    lease_until=now()+interval '90 seconds' where uid=p_uid and room_id=p_room_id;
  if not found then raise exception 'not-member'; end if;
  update public.lifemate_game_rooms set version=version+1 where id=p_room_id;
  perform public.lifemate_game_schedule(p_room_id);
  perform realtime.send(jsonb_build_object('controllerChanged',true),'changed',
    'card-room:'||p_room_id||':'||v_room.epoch,true);
  return jsonb_build_object('roomId',p_room_id);
end $function$
;
revoke all on function public.lifemate_game_takeover(text,bigint,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.lifemate_game_takeover(text,bigint,uuid,uuid,integer) to service_role;

