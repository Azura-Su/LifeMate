-- Add a fixed per-opponent transfer for instant wins. Legacy two-field South
-- configs remain valid and continue to mean an instant-win fee of zero.
create or replace function public.lifemate_game_assert_south_config(p_config jsonb)
returns void language plpgsql set search_path='' as $$
declare v_amount numeric; v_count integer;
begin
  if jsonb_typeof(p_config) is distinct from 'object' then raise exception 'invalid-input'; end if;
  select count(*) into v_count from jsonb_object_keys(p_config);
  if v_count not in (2,3)
    or not (p_config ?& array['finishMode','cutTwoAmount'])
    or (v_count=3 and not (p_config ? 'instantWinAmount'))
    or p_config->>'finishMode' not in ('continue','first-winner')
    or jsonb_typeof(p_config->'cutTwoAmount') is distinct from 'number'
    then raise exception 'invalid-input'; end if;
  v_amount:=(p_config->>'cutTwoAmount')::numeric;
  if v_amount<0 or v_amount>1000000000 or trunc(v_amount)<>v_amount then raise exception 'invalid-input'; end if;
  if p_config ? 'instantWinAmount' then
    if jsonb_typeof(p_config->'instantWinAmount') is distinct from 'number' then raise exception 'invalid-input'; end if;
    v_amount:=(p_config->>'instantWinAmount')::numeric;
    if v_amount<0 or v_amount>1000000000 or trunc(v_amount)<>v_amount then raise exception 'invalid-input'; end if;
  end if;
end $$;
revoke all on function public.lifemate_game_assert_south_config(jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_assert_south_config(jsonb) to service_role;

create or replace function public.lifemate_game_keep_south_config() returns trigger
language plpgsql set search_path='' as $$
declare v_promotion boolean:=false; v_expected jsonb;
begin
  if new.state ? 'nextSouthRules' then
    if coalesce(new.state->>'gameKind','south')<>'south' then raise exception 'invalid-input'; end if;
    perform public.lifemate_game_assert_south_rules(new.state->'nextSouthRules');
  end if;
  if tg_op='UPDATE' then
    if old.state->'nextSouthRules' is distinct from new.state->'nextSouthRules'
      and coalesce(current_setting('lifemate.south_rules',true),'')<>new.id::text
      then raise exception 'invalid-input'; end if;
    if old.state ? 'nextSouthRules' and new.match_id is not null and new.match_id is distinct from old.match_id then
      if old.state->>'phase' not in ('lobby','finished') or new.state->>'phase' not in ('playing','finished')
        or old.state->'nextSouthRules' is distinct from new.state->'nextSouthRules'
        then raise exception 'invalid-input'; end if;
      v_expected:=case when old.state->'nextSouthRules'->'southConfig' in
        ('{"finishMode":"continue","cutTwoAmount":0}'::jsonb,
         '{"finishMode":"continue","cutTwoAmount":0,"instantWinAmount":0}'::jsonb)
        then null else old.state->'nextSouthRules'->'southConfig' end;
      if new.state->'southConfig' is distinct from v_expected
        or new.state->'amountPerCard' is distinct from old.state->'nextSouthRules'->'amountPerCard'
        then raise exception 'invalid-input'; end if;
      v_promotion:=true;
    end if;
    if old.state->'amountPerCard' is distinct from new.state->'amountPerCard' and not (v_promotion or (
      not (old.state ? 'amountPerCard') and old.state->>'phase'='lobby' and old.match_id is null
      and jsonb_typeof(new.state->'amountPerCard')='number' and (new.state->>'amountPerCard') ~ '^[0-9]+$'
      and (new.state->>'amountPerCard')::numeric between 0 and 1000000000
    )) then raise exception 'invalid-input'; end if;
    if old.state->'southConfig' is distinct from new.state->'southConfig' and not (v_promotion or (
      not (old.state ? 'southConfig') and new.state ? 'southConfig'
      and coalesce(current_setting('lifemate.south_create',true),'')=new.id::text
      and old.state->>'phase'='lobby' and old.match_id is null
    )) then raise exception 'invalid-input'; end if;
  elsif new.state ? 'nextSouthRules' then raise exception 'invalid-input';
  end if;
  if new.state ? 'southConfig' then
    if coalesce(new.state->>'gameKind','south')<>'south' then raise exception 'invalid-input'; end if;
    perform public.lifemate_game_assert_south_config(new.state->'southConfig');
    if new.state->'game' is not null and new.state->'game'<>'null'::jsonb and (
      new.state->'game'->>'rulesVersion' is distinct from 'south-v2'
      or new.state->'game'->'southConfig' is distinct from new.state->'southConfig'
    ) then raise exception 'invalid-input'; end if;
  elsif new.state->'game'->>'rulesVersion'='south-v2' then raise exception 'invalid-input';
  end if;
  return new;
end $$;

create or replace function public.lifemate_game_assert_south_rules(p_rules jsonb) returns void
language plpgsql set search_path='' as $$
begin
  if jsonb_typeof(p_rules) is distinct from 'object' then raise exception 'invalid-input'; end if;
  if (select count(*) from jsonb_object_keys(p_rules))<>2
    or not (p_rules ?& array['amountPerCard','southConfig'])
    or jsonb_typeof(p_rules->'amountPerCard') is distinct from 'number'
    or (p_rules->>'amountPerCard') !~ '^[0-9]+$'
    then raise exception 'invalid-input'; end if;
  if (p_rules->>'amountPerCard')::numeric not between 1 and 1000000000
    then raise exception 'invalid-input'; end if;
  perform public.lifemate_game_assert_south_config(p_rules->'southConfig');
end $$;
revoke all on function public.lifemate_game_assert_south_rules(jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_assert_south_rules(jsonb) to service_role;

create or replace function public.lifemate_game_create_south(
 p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
 p_room_id uuid,p_code text,p_name text,p_amount_per_card bigint,p_config jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ack jsonb; v_room public.lifemate_game_rooms;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_assert_south_config(p_config);
  if p_config->>'finishMode'='continue' and (p_config->>'cutTwoAmount')::numeric=0
    and coalesce((p_config->>'instantWinAmount')::numeric,0)=0 then raise exception 'invalid-input'; end if;
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

create or replace function public.lifemate_game_status(p_uid text,p_auth_time bigint,p_session_id uuid,p_room_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_owner text; v_known boolean; v_now timestamptz:=clock_timestamp();
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid);
  select * into v_room from public.lifemate_game_rooms where id=p_room_id
    and id not in (select room_id from public.lifemate_game_deleted_rooms);
  if not found then return jsonb_build_object('roomId',p_room_id,'exists',false,'owner',false,'canRejoin',false,'canReopen',false,'canDelete',false,'expired',true,'phase',null,'version',null,'matchId',null); end if;
  v_owner:=case when v_room.state ? 'ownerUid' then nullif(v_room.state->>'ownerUid','')
    else coalesce(v_room.state->>'host',v_room.state->'scoreMembers'->0->>'uid') end;
  v_known:=coalesce(v_owner=p_uid,false) or exists(select 1 from jsonb_array_elements(coalesce(v_room.state->'scoreMembers','[]'::jsonb)) m where m->>'uid'=p_uid);
  if not v_known then return jsonb_build_object('roomId',p_room_id,'exists',false,'owner',false,'canRejoin',false,'canReopen',false,'canDelete',false,'expired',true,'phase',null,'version',null,'matchId',null); end if;
  return jsonb_build_object('roomId',p_room_id,'minClientVersion',case
    when v_room.state->'southConfig' ? 'instantWinAmount' or v_room.state->'nextSouthRules'->'southConfig' ? 'instantWinAmount' then 12
    when v_room.state->'variantConfig'->>'rulesVersion' in ('north-v2','sam-v2')
      or v_room.state->'nextVariantConfig'->>'rulesVersion' in ('north-v2','sam-v2') then 11
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
  if p_client_version is null or p_client_version not between 1 and 12 then raise exception 'invalid-input'; end if;
  v_min_version:=case
    when v_room.state->'southConfig' ? 'instantWinAmount' or v_room.state->'nextSouthRules'->'southConfig' ? 'instantWinAmount' then 12
    when v_room.state->'variantConfig'->>'rulesVersion' in ('north-v2','sam-v2')
      or v_room.state->'nextVariantConfig'->>'rulesVersion' in ('north-v2','sam-v2') then 11
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
