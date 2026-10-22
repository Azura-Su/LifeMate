-- Keep the existing create RPC intact for older clients. The new Edge Function
-- calls this overload and stores the room's server-owned per-card rate.
create function public.lifemate_game_create(
  p_uid text,
  p_auth_time bigint,
  p_session_id uuid,
  p_action_id uuid,
  p_fingerprint text,
  p_room_id uuid,
  p_code text,
  p_name text,
  p_amount_per_card bigint
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ack jsonb;
begin
  if p_amount_per_card is null or p_amount_per_card<0 or p_amount_per_card>1000000000 then
    raise exception 'invalid-input';
  end if;
  v_ack:=public.lifemate_game_create(
    p_uid,p_auth_time,p_session_id,p_action_id,p_fingerprint,p_room_id,p_code,p_name
  );
  update public.lifemate_game_rooms
    set state=state||jsonb_build_object('amountPerCard',p_amount_per_card)
    where id=(v_ack->>'roomId')::uuid;
  return v_ack;
end $$;

revoke all on function public.lifemate_game_create(text,bigint,uuid,uuid,text,uuid,text,text,bigint)
  from public,anon,authenticated;
grant execute on function public.lifemate_game_create(text,bigint,uuid,uuid,text,uuid,text,text,bigint)
  to service_role;
