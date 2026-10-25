-- Point-rate settings for North, Sâm, and Tấn are immutable during a match.
-- Existing v1 rooms without these fields continue to use one point per card.
create function public.lifemate_game_assert_variant_config(p_config jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_rate bigint;
begin
  if p_config is null or jsonb_typeof(p_config)<>'object'
    or not (p_config ? 'pointsPerCard') or p_config-'pointsPerCard'<>'{}'::jsonb
    or jsonb_typeof(p_config->'pointsPerCard')<>'number'
    or (p_config->>'pointsPerCard') !~ '^[0-9]+$' then
    raise exception 'invalid-input';
  end if;
  v_rate:=(p_config->>'pointsPerCard')::bigint;
  if v_rate<1 or v_rate>1000000000 then raise exception 'invalid-input'; end if;
end $$;
revoke all on function public.lifemate_game_assert_variant_config(jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_assert_variant_config(jsonb) to service_role;

create function public.lifemate_game_validate_variant_config()
returns trigger language plpgsql set search_path='' as $$
declare
  v_kind text:=coalesce(new.state->>'gameKind','south');
  v_promotion boolean:=false;
  v_initial_config boolean:=false;
begin
  if (new.state ? 'variantConfig' or new.state ? 'nextVariantConfig')
    and v_kind not in ('north','sam','tan') then raise exception 'invalid-input'; end if;
  if new.state ? 'variantConfig' then
    perform public.lifemate_game_assert_variant_config(new.state->'variantConfig');
  end if;
  if new.state ? 'nextVariantConfig' then
    perform public.lifemate_game_assert_variant_config(new.state->'nextVariantConfig');
  end if;
  if tg_op='INSERT' then
    if new.state ? 'variantConfig' and coalesce(current_setting('lifemate.variant_config_create',true),'')<>new.id::text
      then raise exception 'invalid-input'; end if;
    if new.state ? 'nextVariantConfig' then raise exception 'invalid-input'; end if;
    return new;
  end if;
  if old.state ? 'nextVariantConfig'
    and new.match_id is not null and new.match_id is distinct from old.match_id then
    if old.state->>'phase' not in ('lobby','finished')
      or new.state->>'phase' not in ('playing','finished')
      or new.state->'variantConfig' is distinct from old.state->'nextVariantConfig'
      or new.state->'nextVariantConfig' is distinct from old.state->'nextVariantConfig' then
      raise exception 'invalid-input';
    end if;
    v_promotion:=true;
  end if;
  v_initial_config:=coalesce(current_setting('lifemate.variant_config_create',true),'')=new.id::text
    and old.state->>'phase'='lobby' and old.match_id is null
    and not (old.state ? 'variantConfig') and not (old.state ? 'nextVariantConfig')
    and new.state->>'phase'='lobby' and new.match_id is null
    and new.state->>'gameKind' is not distinct from old.state->>'gameKind'
    and new.state->'nextVariantConfig' is not distinct from old.state->'nextVariantConfig';
  if old.state->'variantConfig' is distinct from new.state->'variantConfig'
    and not v_promotion
    and not v_initial_config
    then raise exception 'invalid-input'; end if;
  if old.state->'nextVariantConfig' is distinct from new.state->'nextVariantConfig'
    and coalesce(current_setting('lifemate.variant_rules',true),'')<>new.id::text
    then raise exception 'invalid-input'; end if;
  if old.state ? 'variantConfig' and not (new.state ? 'variantConfig') then
    raise exception 'invalid-input';
  end if;
  return new;
end $$;
revoke all on function public.lifemate_game_validate_variant_config() from public,anon,authenticated;
grant execute on function public.lifemate_game_validate_variant_config() to service_role;
create trigger lifemate_game_variant_config_guard
before insert or update on public.lifemate_game_rooms
for each row execute function public.lifemate_game_validate_variant_config();

create function public.lifemate_game_create_variant_configured(
 p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
 p_room_id uuid,p_code text,p_name text,p_game text,p_config jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ack jsonb; v_room public.lifemate_game_rooms;
begin
  if p_game is null or p_game not in ('north','sam','tan') then raise exception 'invalid-input'; end if;
  perform public.lifemate_game_assert_variant_config(p_config);
  v_ack:=public.lifemate_game_receipt(p_uid,p_auth_time,p_action_id,p_fingerprint);
  if v_ack is not null then
    select * into v_room from public.lifemate_game_rooms where id=(v_ack->>'roomId')::uuid;
    if not found then raise exception 'room-deleted'; end if;
    if v_room.state->>'gameKind' is distinct from p_game then raise exception 'idempotency-conflict'; end if;
    return v_ack;
  end if;
  v_ack:=public.lifemate_game_create_variant(
    p_uid,p_auth_time,p_session_id,p_action_id,p_fingerprint,p_room_id,p_code,p_name,p_game
  );
  select * into strict v_room from public.lifemate_game_rooms where id=(v_ack->>'roomId')::uuid for update;
  if v_room.state->>'gameKind' is distinct from p_game then raise exception 'idempotency-conflict'; end if;
  if not (v_room.state ? 'variantConfig') then
    if v_room.state->>'phase'<>'lobby' or v_room.match_id is not null
      or v_room.state ? 'nextVariantConfig' then raise exception 'invalid-input'; end if;
    perform set_config('lifemate.variant_config_create',v_room.id::text,true);
    update public.lifemate_game_rooms set state=state||jsonb_build_object('variantConfig',p_config),
      version=version+1,updated_at=now(),expires_at=now()+interval '30 minutes'
      where id=v_room.id returning * into v_room;
    perform set_config('lifemate.variant_config_create','',true);
  end if;
  return v_ack;
end $$;
revoke all on function public.lifemate_game_create_variant_configured(text,bigint,uuid,uuid,text,uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_create_variant_configured(text,bigint,uuid,uuid,text,uuid,text,text,text,jsonb) to service_role;

create function public.lifemate_game_set_variant_rules(
  p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
  p_room_id uuid,p_version bigint,p_match_id uuid,p_config jsonb,p_client_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_seat public.lifemate_game_seats; v_ack jsonb; v_state jsonb; v_owner text;
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
  v_owner:=case when v_room.state ? 'ownerUid'
    then nullif(v_room.state->>'ownerUid','')
    else coalesce(nullif(v_room.state->>'host',''),v_room.state->'scoreMembers'->0->>'uid') end;
  if v_owner is distinct from p_uid then raise exception 'not-owner'; end if;
  if v_room.expires_at<=now() then raise exception 'room-expired'; end if;
  if v_room.version is distinct from p_version then raise exception 'version-conflict'; end if;
  if v_room.match_id is distinct from p_match_id then raise exception 'match-conflict'; end if;
  if p_client_version is null or p_client_version<10 then raise exception 'game-update-required'; end if;
  if v_room.state->>'gameKind' not in ('north','sam','tan')
    or v_room.state->>'phase' not in ('lobby','playing','finished') then raise exception 'invalid-input'; end if;
  perform public.lifemate_game_assert_variant_config(p_config);
  v_state:=v_room.state||jsonb_build_object('nextVariantConfig',p_config);
  if v_state->>'phase'<>'playing' then
    v_state:=jsonb_set(v_state,'{members}',(select jsonb_agg(m||'{"ready":false}'::jsonb order by n)
      from jsonb_array_elements(v_state->'members') with ordinality as players(m,n)));
  end if;
  perform set_config('lifemate.variant_rules',p_room_id::text,true);
  update public.lifemate_game_rooms set state=v_state,version=version+1,updated_at=now(),
    expires_at=now()+interval '30 minutes',worker_token=null,worker_until=null
    where id=p_room_id returning * into v_room;
  perform set_config('lifemate.variant_rules','',true);
  update public.lifemate_game_seats set lease_until=now()+interval '90 seconds',auth_time=p_auth_time where uid=p_uid;
  perform public.lifemate_game_schedule(p_room_id);
  perform realtime.send(jsonb_build_object('version',v_room.version),'changed','card-room:'||p_room_id||':'||v_room.epoch,true);
  v_ack:=jsonb_build_object('roomId',p_room_id,'version',v_room.version);
  insert into public.lifemate_game_receipts(uid,action_id,room_id,fingerprint,ack) values(p_uid,p_action_id,p_room_id,p_fingerprint,v_ack);
  return jsonb_build_object('ack',v_ack,'record',to_jsonb(v_room),'controller',true,'now',floor(extract(epoch from clock_timestamp())*1000));
end $$;
revoke all on function public.lifemate_game_set_variant_rules(text,bigint,uuid,uuid,text,uuid,bigint,uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.lifemate_game_set_variant_rules(text,bigint,uuid,uuid,text,uuid,bigint,uuid,jsonb,integer) to service_role;

-- Capability 10 protects strict snapshots and settings from clients that do not
-- understand variantConfig. Legacy variant rooms without config remain v9.
create or replace function public.lifemate_game_status(p_uid text,p_auth_time bigint,p_session_id uuid,p_room_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_owner text; v_known boolean; v_now timestamptz:=clock_timestamp();
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid);
  select * into v_room from public.lifemate_game_rooms where id=p_room_id
    and id not in (select room_id from public.lifemate_game_deleted_rooms);
  if not found then return jsonb_build_object('roomId',p_room_id,'exists',false,'owner',false,'canRejoin',false,'canReopen',false,'canDelete',false,'expired',true,'phase',null,'version',null,'matchId',null); end if;
  v_owner:=case when v_room.state ? 'ownerUid'
    then nullif(v_room.state->>'ownerUid','')
    else coalesce(v_room.state->>'host',v_room.state->'scoreMembers'->0->>'uid') end;
  v_known:=coalesce(v_owner=p_uid,false) or exists(select 1 from jsonb_array_elements(coalesce(v_room.state->'scoreMembers','[]'::jsonb)) m where m->>'uid'=p_uid);
  if not v_known then return jsonb_build_object('roomId',p_room_id,'exists',false,'owner',false,'canRejoin',false,'canReopen',false,'canDelete',false,'expired',true,'phase',null,'version',null,'matchId',null); end if;
  return jsonb_build_object('roomId',p_room_id,'minClientVersion',case
    when v_room.state ? 'variantConfig' or v_room.state ? 'nextVariantConfig' then 10
    when v_room.state->>'gameKind' in ('north','sam','tan') then 9
    when v_room.state->'phomConfig' ? 'options' or v_room.state->'nextPhomConfig' ? 'options' then 7
    when v_room.state ? 'nextPhomConfig' then 6 when v_room.state ? 'nextSouthRules' then 5
    when v_room.state ? 'southConfig' then 4 when v_room.state->>'gameKind'='phom' then 3 else 1 end,
    'gameKind',coalesce(v_room.state->>'gameKind','south'),'exists',true,
    'canRejoin',v_room.expires_at>v_now and v_room.state->>'phase'<>'closed' and (jsonb_array_length(v_room.state->'members')>0 or coalesce(v_owner=p_uid,false)),
    'owner',coalesce(v_owner=p_uid,false),
    'canReopen',coalesce(v_owner=p_uid,false) and v_room.expires_at<=now() and v_room.state->>'phase'<>'playing',
    'canDelete',coalesce(v_owner=p_uid,false) and v_room.state->>'phase'='finished',
    'expired',v_room.expires_at<=v_now,'phase',v_room.state->>'phase','version',v_room.version,'matchId',v_room.match_id);
end $$;
revoke all on function public.lifemate_game_status(text,bigint,uuid,uuid) from public,anon,authenticated;
grant execute on function public.lifemate_game_status(text,bigint,uuid,uuid) to service_role;

create or replace function public.lifemate_game_takeover(p_uid text,p_auth_time bigint,p_session_id uuid,p_room_id uuid,p_client_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_seat_room uuid; v_min_version integer;
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
  if p_client_version is null or p_client_version not between 1 and 10 then raise exception 'invalid-input'; end if;
  v_min_version:=case
    when v_room.state ? 'variantConfig' or v_room.state ? 'nextVariantConfig' then 10
    when v_room.state->>'gameKind' in ('north','sam','tan') then 9
    when v_room.state->'phomConfig' ? 'options' or v_room.state->'nextPhomConfig' ? 'options' then 7
    when v_room.state ? 'nextPhomConfig' then 6 when v_room.state ? 'nextSouthRules' then 5
    when v_room.state ? 'southConfig' then 4 when v_room.state->>'gameKind'='phom' then 3 else 1 end;
  if p_client_version<v_min_version then raise exception 'game-update-required'; end if;
  update public.lifemate_game_seats set session_id=p_session_id,auth_time=p_auth_time,lease_until=now()+interval '90 seconds' where uid=p_uid and room_id=p_room_id;
  if not found then raise exception 'not-member'; end if;
  update public.lifemate_game_rooms set version=version+1 where id=p_room_id;
  perform public.lifemate_game_schedule(p_room_id);
  perform realtime.send(jsonb_build_object('controllerChanged',true),'changed','card-room:'||p_room_id||':'||v_room.epoch,true);
  return jsonb_build_object('roomId',p_room_id);
end $$;
revoke all on function public.lifemate_game_takeover(text,bigint,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.lifemate_game_takeover(text,bigint,uuid,uuid,integer) to service_role;
