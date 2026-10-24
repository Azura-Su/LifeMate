-- Additive config: missing options retain fixed-turn/send/den legacy rules.
create or replace function public.lifemate_game_assert_phom_config(p_config jsonb)
returns void language plpgsql set search_path='' as $$
declare v_key text; v_value numeric;
begin
  if jsonb_typeof(p_config) is distinct from 'object' then raise exception 'invalid-input'; end if;
  if (select count(*) from jsonb_object_keys(p_config)) <> (case when p_config ? 'options' then 11 else 10 end)
    then raise exception 'invalid-input'; end if;
  foreach v_key in array array['second','third','last','eat','chot','mom','u','uTron','den','forfeit'] loop
    if jsonb_typeof(p_config->v_key) is distinct from 'number' then raise exception 'invalid-input'; end if;
    v_value:=(p_config->>v_key)::numeric;
    if v_value<0 or v_value>1000000000 or trunc(v_value)<>v_value then raise exception 'invalid-input'; end if;
  end loop;
  if p_config ? 'options' then
    if jsonb_typeof(p_config->'options') is distinct from 'object' then raise exception 'invalid-input'; end if;
    if (select count(*) from jsonb_object_keys(p_config->'options'))<>3 then raise exception 'invalid-input'; end if;
    foreach v_key in array array['tai','send','uDen'] loop
      if jsonb_typeof(p_config->'options'->v_key) is distinct from 'boolean' then raise exception 'invalid-input'; end if;
    end loop;
  end if;
end $$;
revoke all on function public.lifemate_game_assert_phom_config(jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_assert_phom_config(jsonb) to service_role;

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
  return jsonb_build_object('roomId',p_room_id,'minClientVersion',case when v_room.state->'phomConfig' ? 'options' or v_room.state->'nextPhomConfig' ? 'options' then 7 when v_room.state ? 'nextPhomConfig' then 6 when v_room.state ? 'nextSouthRules' then 5 when v_room.state ? 'southConfig' then 4 when v_room.state->>'gameKind'='phom' then 3 else 1 end,'gameKind',coalesce(v_room.state->>'gameKind','south'),'exists',true,'owner',v_owner=p_uid,
    'canRejoin',v_room.expires_at>v_now and v_room.state->>'phase'<>'closed'
      and (jsonb_array_length(v_room.state->'members')>0 or v_owner=p_uid),
    'canReopen',v_owner=p_uid and v_room.expires_at<=v_now and v_room.state->>'phase'<>'playing',
    'canDelete',v_owner=p_uid and v_room.state->>'phase'='finished',
    'expired',v_room.expires_at<=v_now,'phase',v_room.state->>'phase','version',v_room.version,'matchId',v_room.match_id);
end $$;

revoke all on function public.lifemate_game_status(text,bigint,uuid,uuid) from public,anon,authenticated;
grant execute on function public.lifemate_game_status(text,bigint,uuid,uuid) to service_role;
