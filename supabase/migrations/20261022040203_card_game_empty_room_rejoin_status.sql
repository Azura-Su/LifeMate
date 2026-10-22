-- Match status to find/join: only the owner may enter an empty live room first.
-- Expired-room reactivation and all account/ownership checks stay unchanged.
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
    'canRejoin',v_room.expires_at>v_now and v_room.state->>'phase'<>'closed'
      and (jsonb_array_length(v_room.state->'members')>0 or v_owner=p_uid),
    'canReopen',v_owner=p_uid and v_room.expires_at<=v_now and v_room.state->>'phase'<>'playing',
    'canDelete',v_owner=p_uid and v_room.state->>'phase'='finished',
    'expired',v_room.expires_at<=v_now,'phase',v_room.state->>'phase','version',v_room.version,'matchId',v_room.match_id);
end $$;

revoke all on function public.lifemate_game_status(text,bigint,uuid,uuid) from public,anon,authenticated;
grant execute on function public.lifemate_game_status(text,bigint,uuid,uuid) to service_role;
