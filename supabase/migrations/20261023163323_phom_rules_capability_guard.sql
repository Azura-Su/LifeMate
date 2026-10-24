-- Fence edits under the room lock, before a legacy payload can remove options.
create function public.lifemate_game_set_phom_rules(
  p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
  p_room_id uuid,p_version bigint,p_match_id uuid,p_config jsonb,p_client_version integer
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
  if p_client_version is null or p_client_version not between 6 and 7 then raise exception 'invalid-input'; end if;
  if p_client_version < (case when v_room.state->'phomConfig' ? 'options'
    or v_room.state->'nextPhomConfig' ? 'options' or p_config ? 'options' then 7 else 6 end)
    then raise exception 'game-update-required'; end if;
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
revoke all on function public.lifemate_game_set_phom_rules(text,bigint,uuid,uuid,text,uuid,bigint,uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.lifemate_game_set_phom_rules(text,bigint,uuid,uuid,text,uuid,bigint,uuid,jsonb,integer) to service_role;

-- During Edge rollout, old requests carrying options already passed its v7 check.
-- Ten-rate payloads remain v6 and cannot overwrite current or pending options.
create or replace function public.lifemate_game_set_phom_rules(
  p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
  p_room_id uuid,p_version bigint,p_match_id uuid,p_config jsonb
) returns jsonb language sql security definer set search_path='' as $$
  select public.lifemate_game_set_phom_rules(p_uid,p_auth_time,p_session_id,p_action_id,p_fingerprint,
    p_room_id,p_version,p_match_id,p_config,case when p_config ? 'options' then 7 else 6 end);
$$;
revoke all on function public.lifemate_game_set_phom_rules(text,bigint,uuid,uuid,text,uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_set_phom_rules(text,bigint,uuid,uuid,text,uuid,bigint,uuid,jsonb) to service_role;
