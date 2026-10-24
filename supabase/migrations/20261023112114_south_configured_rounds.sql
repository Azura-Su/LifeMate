-- Configured South rooms are opt-in; legacy create RPCs and rooms stay unchanged.
create function public.lifemate_game_assert_south_config(p_config jsonb)
returns void language plpgsql set search_path='' as $$
declare v_amount numeric;
begin
  if jsonb_typeof(p_config) is distinct from 'object' then raise exception 'invalid-input'; end if;
  if (select count(*) from jsonb_object_keys(p_config))<>2
    or p_config->>'finishMode' is null or p_config->>'finishMode' not in ('continue','first-winner')
    or jsonb_typeof(p_config->'cutTwoAmount') is distinct from 'number'
    then raise exception 'invalid-input'; end if;
  v_amount:=(p_config->>'cutTwoAmount')::numeric;
  if v_amount<0 or v_amount>1000000000 or trunc(v_amount)<>v_amount then raise exception 'invalid-input'; end if;
end $$;
revoke all on function public.lifemate_game_assert_south_config(jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_assert_south_config(jsonb) to service_role;

create function public.lifemate_game_keep_south_config() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' and old.state->'southConfig' is distinct from new.state->'southConfig' and not (
    not (old.state ? 'southConfig') and new.state ? 'southConfig'
    and coalesce(current_setting('lifemate.south_create',true),'')=new.id::text
    and old.state->>'phase'='lobby' and old.match_id is null
  ) then raise exception 'invalid-input'; end if;
  if new.state ? 'southConfig' then
    if coalesce(new.state->>'gameKind','south')<>'south' then raise exception 'invalid-input'; end if;
    perform public.lifemate_game_assert_south_config(new.state->'southConfig');
    if new.state->'game' is not null and new.state->'game'<>'null'::jsonb and (
      new.state->'game'->>'rulesVersion' is distinct from 'south-v2'
      or new.state->'game'->'southConfig' is distinct from new.state->'southConfig'
    ) then raise exception 'invalid-input'; end if;
  end if;
  return new;
end $$;
revoke all on function public.lifemate_game_keep_south_config() from public,anon,authenticated;
grant execute on function public.lifemate_game_keep_south_config() to service_role;
create trigger lifemate_game_keep_south_config before insert or update of state on public.lifemate_game_rooms
for each row execute function public.lifemate_game_keep_south_config();

create function public.lifemate_game_create_south(
 p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
 p_room_id uuid,p_code text,p_name text,p_amount_per_card bigint,p_config jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ack jsonb; v_room public.lifemate_game_rooms;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_assert_south_config(p_config);
  if p_config->>'finishMode'='continue' and (p_config->>'cutTwoAmount')::numeric=0 then raise exception 'invalid-input'; end if;
  if p_amount_per_card is null or p_amount_per_card<0 or p_amount_per_card>1000000000 then raise exception 'invalid-input'; end if;
  v_ack:=public.lifemate_game_receipt(p_uid,p_auth_time,p_action_id,p_fingerprint);
  if v_ack is not null then
    select * into v_room from public.lifemate_game_rooms where id=(v_ack->>'roomId')::uuid;
    if not found then raise exception 'room-deleted'; end if;
    if v_room.state->'southConfig' is distinct from p_config
      or v_room.state->'amountPerCard' is distinct from to_jsonb(p_amount_per_card)
      then raise exception 'idempotency-conflict'; end if;
    return v_ack;
  end if;
  v_ack:=public.lifemate_game_create(p_uid,p_auth_time,p_session_id,p_action_id,p_fingerprint,p_room_id,p_code,p_name,p_amount_per_card);
  perform set_config('lifemate.south_create',v_ack->>'roomId',true);
  update public.lifemate_game_rooms set state=state||jsonb_build_object('southConfig',p_config) where id=(v_ack->>'roomId')::uuid;
  perform set_config('lifemate.south_create','',true);
  return v_ack;
end $$;
revoke all on function public.lifemate_game_create_south(text,bigint,uuid,uuid,text,uuid,text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_create_south(text,bigint,uuid,uuid,text,uuid,text,text,bigint,jsonb) to service_role;

-- Authorized history metadata fences older clients before reopening a lobby.
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
  return jsonb_build_object('roomId',p_room_id,'minClientVersion',case when v_room.state ? 'southConfig' then 4 when v_room.state->>'gameKind'='phom' then 3 else 1 end,'gameKind',coalesce(v_room.state->>'gameKind','south'),'exists',true,'owner',v_owner=p_uid,
    'canRejoin',v_room.expires_at>v_now and v_room.state->>'phase'<>'closed'
      and (jsonb_array_length(v_room.state->'members')>0 or v_owner=p_uid),
    'canReopen',v_owner=p_uid and v_room.expires_at<=v_now and v_room.state->>'phase'<>'playing',
    'canDelete',v_owner=p_uid and v_room.state->>'phase'='finished',
    'expired',v_room.expires_at<=v_now,'phase',v_room.state->>'phase','version',v_room.version,'matchId',v_room.match_id);
end $$;

revoke all on function public.lifemate_game_status(text,bigint,uuid,uuid) from public,anon,authenticated;
grant execute on function public.lifemate_game_status(text,bigint,uuid,uuid) to service_role;
