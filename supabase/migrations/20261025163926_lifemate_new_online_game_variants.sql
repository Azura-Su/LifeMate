-- New online variants are tagged only once, while creating an untouched lobby.
-- Existing rooms (including legacy rooms with no gameKind) retain their rules.
create or replace function public.lifemate_game_keep_kind() returns trigger
language plpgsql set search_path='' as $$
declare
  v_kind text:=coalesce(new.state->>'gameKind','south');
  v_promotion boolean:=false;
  v_rules_version text;
begin
  if v_kind not in ('south','phom','north','sam','tan') then raise exception 'invalid-input'; end if;
  if new.state ? 'nextPhomConfig' then
    if v_kind<>'phom' then raise exception 'invalid-input'; end if;
    perform public.lifemate_game_assert_phom_config(new.state->'nextPhomConfig');
  end if;
  if tg_op='INSERT' and new.state ? 'nextPhomConfig' then raise exception 'invalid-input'; end if;
  if tg_op='UPDATE' then
    if old.state->'nextPhomConfig' is distinct from new.state->'nextPhomConfig'
      and coalesce(current_setting('lifemate.phom_rules',true),'')<>new.id::text
      then raise exception 'invalid-input'; end if;
    if old.state ? 'nextPhomConfig' and new.match_id is not null and new.match_id is distinct from old.match_id then
      if old.state->>'phase' not in ('lobby','finished') or new.state->>'phase' not in ('playing','finished')
        or old.state->'nextPhomConfig' is distinct from new.state->'nextPhomConfig'
        or new.state->'phomConfig' is distinct from old.state->'nextPhomConfig'
        then raise exception 'invalid-input'; end if;
      v_promotion:=true;
    end if;
    if coalesce(old.state->>'gameKind','south')<>v_kind and not (
      v_kind='phom' and coalesce(old.state->>'gameKind','south')='south'
      and coalesce(current_setting('lifemate.phom_create',true),'')=new.id::text
      and old.state->>'phase'='lobby' and old.match_id is null
    ) and not (
      v_kind in ('north','sam','tan') and coalesce(old.state->>'gameKind','south')='south'
      and coalesce(current_setting('lifemate.variant_create',true),'')=new.id::text
      and old.state->>'phase'='lobby' and old.match_id is null
    ) then raise exception 'invalid-input'; end if;
    if old.state->>'gameKind'='phom' and old.state->'phomConfig' is distinct from new.state->'phomConfig' and not v_promotion
      then raise exception 'invalid-input'; end if;
  end if;
  if v_kind='phom' then
    perform public.lifemate_game_assert_phom_config(new.state->'phomConfig');
    if new.state->'game' is not null and new.state->'game' is distinct from 'null'::jsonb and (
      new.state->'game'->>'rulesVersion' is distinct from 'phom-v1'
      or new.state->'game'->'config' is distinct from new.state->'phomConfig'
    ) then raise exception 'invalid-input'; end if;
  end if;
  if v_kind in ('north','sam','tan') and new.state->'game' is not null
    and new.state->'game' is distinct from 'null'::jsonb then
    v_rules_version:=case v_kind when 'north' then 'north-v1' when 'sam' then 'sam-v1' else 'tan-v1' end;
    if new.state->'game'->>'rulesVersion' is distinct from v_rules_version then raise exception 'invalid-input'; end if;
  end if;
  return new;
end $$;
revoke all on function public.lifemate_game_keep_kind() from public,anon,authenticated;
grant execute on function public.lifemate_game_keep_kind() to service_role;

-- Keep generated score-sheet names accurate if the sheet is recreated later.
create or replace function public.lifemate_game_sync_score(p_room public.lifemate_game_rooms)
returns void language plpgsql set search_path='' as $$
declare v_table public.lifemate_game_score_tables; v_doc jsonb; v_players jsonb; v_member jsonb;
  v_owner text; v_uids text[]; v_name text; v_base text; v_suffix integer; v_now bigint;
  v_scores jsonb; v_changes jsonb; v_round jsonb; v_title text;
begin
  if coalesce(current_setting('lifemate.score_erasing',true),'')='1' then return; end if;
  v_owner:=coalesce(p_room.state->>'ownerUid',p_room.state->>'host',p_room.state->'scoreMembers'->0->>'uid','');
  select array_agg(distinct m->>'uid') into v_uids from jsonb_array_elements(
    coalesce(p_room.state->'scoreMembers','[]')||coalesce(p_room.state->'members','[]')||coalesce(p_room.state->'game'->'players','[]')) m
    where m->>'uid' is not null;
  if coalesce(cardinality(v_uids),0)=0 then return; end if;
  select * into v_table from public.lifemate_game_score_tables where room_id=p_room.id for update;
  v_title:=case p_room.state->>'gameKind'
    when 'phom' then 'Phỏm · '
    when 'north' then 'Tiến lên miền Bắc · '
    when 'sam' then 'Sâm · '
    when 'tan' then 'Tấn · '
    else 'Tiến lên miền Nam · ' end;
  v_doc:=coalesce(v_table.document,jsonb_build_object('title',v_title||p_room.code,'players','[]'::jsonb,
    'seatOrder','[]'::jsonb,'dealerPlayerId','','rounds','[]'::jsonb,'status','active',
    'onlineRoomCode',p_room.code,'amountPerCard',coalesce(p_room.state->'amountPerCard','0'::jsonb),
    'ignoredOnlineRoundIds','[]'::jsonb,'ignoredOnlinePlayerIds','[]'::jsonb));
  v_players:=v_doc->'players';
  for v_member in select m from jsonb_array_elements(coalesce(p_room.state->'scoreMembers','[]')||coalesce(p_room.state->'members','[]')||coalesce(p_room.state->'game'->'players','[]')) m loop
    if not exists(select 1 from jsonb_array_elements(v_players) p where p->>'id'=v_member->>'uid')
      and not (coalesce(v_doc->'ignoredOnlinePlayerIds','[]') ? (v_member->>'uid')) then
      v_base:=left(coalesce(nullif(trim(v_member->>'name'),''),'Người chơi'),24); v_name:=v_base; v_suffix:=2;
      while exists(select 1 from jsonb_array_elements(v_players) p where lower(p->>'name')=lower(v_name)) loop
        v_name:=v_base||' · '||v_suffix; v_suffix:=v_suffix+1;
      end loop;
      v_players:=v_players||jsonb_build_array(jsonb_build_object('id',v_member->>'uid','name',v_name));
      v_doc:=jsonb_set(v_doc,'{seatOrder}',(v_doc->'seatOrder')||jsonb_build_array(v_member->>'uid'));
    end if;
  end loop;
  if jsonb_array_length(v_players)=0 then return; end if;
  v_doc:=jsonb_set(v_doc,'{players}',v_players);
  v_doc:=v_doc||jsonb_build_object('onlineRoomCode',p_room.code,'amountPerCard',coalesce(p_room.state->'amountPerCard','0'::jsonb));
  if v_doc->>'dealerPlayerId'='' then v_doc:=jsonb_set(v_doc,'{dealerPlayerId}',v_players->0->'id'); end if;
  v_now:=(extract(epoch from clock_timestamp())*1000)::bigint;
  if v_table.deleted_at is null and p_room.match_id is not null and p_room.state->'game'->>'status'='finished'
    and jsonb_typeof(p_room.state->'game'->'result'->'ranking')='array' and jsonb_array_length(p_room.state->'game'->'result'->'ranking')>0
    and not (coalesce(v_doc->'ignoredOnlineRoundIds','[]') ? p_room.match_id::text)
    and not exists(select 1 from jsonb_array_elements(v_doc->'rounds') r where r->>'id'=p_room.match_id::text) then
    select coalesce(jsonb_object_agg(r->>'uid',coalesce(r->'moneyDelta','0'::jsonb)),'{}') into v_scores
      from jsonb_array_elements(p_room.state->'game'->'result'->'ranking') r
      where exists(select 1 from jsonb_array_elements(v_players) p where p->>'id'=r->>'uid');
    v_round:=jsonb_build_object('id',p_room.match_id,'createdAt',v_now,'scores',v_scores);
    v_doc:=jsonb_set(v_doc,'{rounds}',(v_doc->'rounds')||jsonb_build_array(v_round));
  end if;
  if v_table.id is null then
    insert into public.lifemate_game_score_tables(room_id,owner_uid,member_uids,document) values(p_room.id,v_owner,v_uids,v_doc);
  elsif v_doc is distinct from v_table.document or v_owner is distinct from v_table.owner_uid
    or not v_uids<@v_table.member_uids then
    update public.lifemate_game_score_tables set document=v_doc,owner_uid=v_owner,
      member_uids=array(select distinct unnest(v_table.member_uids||v_uids)),version=version+1,updated_at=v_now where id=v_table.id;
    v_changes:=public.lifemate_game_score_diff(v_table.document,v_doc);
    if v_changes<>'[]' then insert into public.lifemate_game_score_events values(v_table.id,v_table.version+1,null,'Hệ thống',v_now,v_changes); end if;
  end if;
end $$;

create function public.lifemate_game_create_variant(
 p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
 p_room_id uuid,p_code text,p_name text,p_game text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ack jsonb; v_room public.lifemate_game_rooms; v_title text;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  if p_game is null or p_game not in ('north','sam','tan') then raise exception 'invalid-input'; end if;
  v_ack:=public.lifemate_game_receipt(p_uid,p_auth_time,p_action_id,p_fingerprint);
  if v_ack is not null then
    select * into v_room from public.lifemate_game_rooms where id=(v_ack->>'roomId')::uuid;
    if not found then raise exception 'room-deleted'; end if;
    if v_room.state->>'gameKind' is distinct from p_game then raise exception 'idempotency-conflict'; end if;
    return v_ack;
  end if;
  v_ack:=public.lifemate_game_create(p_uid,p_auth_time,p_session_id,p_action_id,p_fingerprint,p_room_id,p_code,p_name,0::bigint);
  perform set_config('lifemate.variant_create',v_ack->>'roomId',true);
  update public.lifemate_game_rooms set state=state||jsonb_build_object('gameKind',p_game)
    where id=(v_ack->>'roomId')::uuid;
  perform set_config('lifemate.variant_create','',true);
  v_title:=case p_game when 'north' then 'Tiến lên miền Bắc · ' when 'sam' then 'Sâm · ' else 'Tấn · ' end||p_code;
  update public.lifemate_game_score_tables set document=jsonb_set(document,'{title}',to_jsonb(v_title)),version=version+1
    where room_id=(v_ack->>'roomId')::uuid and document->>'title'='Tiến lên miền Nam · '||p_code;
  return v_ack;
end $$;
revoke all on function public.lifemate_game_create_variant(text,bigint,uuid,uuid,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.lifemate_game_create_variant(text,bigint,uuid,uuid,text,uuid,text,text,text) to service_role;

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
  return jsonb_build_object('roomId',p_room_id,'minClientVersion',case
    when v_room.state->>'gameKind' in ('north','sam','tan') then 9
    when v_room.state->'phomConfig' ? 'options' or v_room.state->'nextPhomConfig' ? 'options' then 7
    when v_room.state ? 'nextPhomConfig' then 6 when v_room.state ? 'nextSouthRules' then 5
    when v_room.state ? 'southConfig' then 4 when v_room.state->>'gameKind'='phom' then 3 else 1 end,
    'gameKind',coalesce(v_room.state->>'gameKind','south'),'exists',true,'owner',v_owner=p_uid,
    'canRejoin',v_room.expires_at>v_now and v_room.state->>'phase'<>'closed'
      and (jsonb_array_length(v_room.state->'members')>0 or v_owner=p_uid),
    'canReopen',v_owner=p_uid and v_room.expires_at<=v_now and v_room.state->>'phase'<>'playing',
    'canDelete',v_owner=p_uid and v_room.state->>'phase'='finished',
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
  if p_client_version is null or p_client_version not between 1 and 9 then raise exception 'invalid-input'; end if;
  v_min_version:=case
    when v_room.state->>'gameKind' in ('north','sam','tan') then 9
    when v_room.state->'phomConfig' ? 'options' or v_room.state->'nextPhomConfig' ? 'options' then 7
    when v_room.state ? 'nextPhomConfig' then 6 when v_room.state ? 'nextSouthRules' then 5
    when v_room.state ? 'southConfig' then 4 when v_room.state->>'gameKind'='phom' then 3 else 1 end;
  if p_client_version<v_min_version then raise exception 'game-update-required'; end if;
  update public.lifemate_game_seats set session_id=p_session_id,auth_time=p_auth_time,
    lease_until=now()+interval '90 seconds' where uid=p_uid and room_id=p_room_id;
  if not found then raise exception 'not-member'; end if;
  update public.lifemate_game_rooms set version=version+1 where id=p_room_id;
  perform public.lifemate_game_schedule(p_room_id);
  perform realtime.send(jsonb_build_object('controllerChanged',true),'changed',
    'card-room:'||p_room_id||':'||v_room.epoch,true);
  return jsonb_build_object('roomId',p_room_id);
end $$;
revoke all on function public.lifemate_game_takeover(text,bigint,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.lifemate_game_takeover(text,bigint,uuid,uuid,integer) to service_role;

-- `game-action` is the typed action path for Sâm and Tấn. The commit result
-- carries the authoritative snapshot so clients do not immediately reread.
create or replace function public.lifemate_game_commit(
  p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
  p_room_id uuid,p_version bigint,p_match_id uuid,p_kind text,p_state jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_updated public.lifemate_game_rooms;
  v_seat public.lifemate_game_seats; v_ack jsonb; v_epoch uuid; v_match uuid; v_changed boolean; v_target text; v_target_seat public.lifemate_game_seats;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  if p_kind<>'leave' then perform public.lifemate_game_permit(p_uid,p_kind in ('join','start')); end if;
  perform pg_advisory_xact_lock(hashtextextended('card-game:'||p_uid,0));
  select * into strict v_room from public.lifemate_game_rooms where id=p_room_id for update;
  v_ack:=public.lifemate_game_receipt(p_uid,p_auth_time,p_action_id,p_fingerprint);
  if v_ack is not null then return v_ack; end if;
  if p_kind not in ('join','leave','ready','start','play','pass','transfer-owner','kick','game-action')
    or p_state is null or jsonb_typeof(p_state->'members')<>'array' or jsonb_array_length(p_state->'members')>4 or jsonb_array_length(p_state->'members')<>(select count(distinct m->>'uid') from jsonb_array_elements(p_state->'members') m) then raise exception 'invalid-input'; end if;
  if p_kind='game-action' and v_room.state->>'gameKind' not in ('sam','tan') then raise exception 'invalid-input'; end if;
  if v_room.expires_at<=now() then raise exception 'room-expired'; end if;
  if p_kind='join' then
    if exists(select 1 from public.lifemate_game_seats where uid=p_uid) then raise exception 'already-in-room'; end if;
    if v_room.state->>'phase' not in ('lobby','finished','closed') then raise exception 'room-playing'; end if;
    if v_room.state->>'phase'='closed' and coalesce(v_room.state->>'ownerUid',(v_room.state->'scoreMembers'->0->>'uid'))<>p_uid then raise exception 'room-not-found'; end if;
    if jsonb_array_length(v_room.state->'members')>=4 then raise exception 'room-full'; end if;
  else
    select * into v_seat from public.lifemate_game_seats where uid=p_uid and room_id=p_room_id for update;
    if not found then raise exception 'not-member'; end if;
    if v_seat.session_id<>p_session_id then raise exception 'session-replaced'; end if;
  end if;
  if v_room.version<>p_version then raise exception 'version-conflict'; end if;
  if v_room.match_id is distinct from p_match_id then raise exception 'match-conflict'; end if;
  if p_kind in ('play','pass','game-action') and (v_room.state->'game'->>'deadline')::double precision<=extract(epoch from clock_timestamp())*1000 then raise exception 'turn-expired'; end if;
  if p_kind='transfer-owner' and coalesce(v_room.state->>'ownerUid',v_room.state->>'host',(v_room.state->'scoreMembers'->0->>'uid')) is distinct from p_uid then raise exception 'not-owner'; end if;
  if p_kind='transfer-owner' and (
    p_state->>'ownerUid' is null or p_state->>'ownerUid'=p_uid or
    not exists(select 1 from jsonb_array_elements(v_room.state->'members') member
      where member->>'uid'=p_state->>'ownerUid')
  ) then raise exception 'invalid-input'; end if;
  if p_kind='kick' then
    if (case when v_room.state ? 'ownerUid' then v_room.state->>'ownerUid' else v_room.state->>'host' end) is distinct from p_uid then raise exception 'not-owner'; end if;
    if jsonb_array_length(p_state->'members')<>jsonb_array_length(v_room.state->'members')-1
      or p_state->>'ownerUid' is distinct from coalesce(v_room.state->>'ownerUid',v_room.state->>'host')
      or exists(select 1 from jsonb_array_elements(p_state->'members') m
        where not exists(select 1 from jsonb_array_elements(v_room.state->'members') old where old->>'uid'=m->>'uid'))
      then raise exception 'invalid-input'; end if;
    select m->>'uid' into v_target from jsonb_array_elements(v_room.state->'members') m
      where not exists(select 1 from jsonb_array_elements(p_state->'members') n where n->>'uid'=m->>'uid');
    if v_target is null or v_target=p_uid then raise exception 'invalid-input'; end if;
    select * into v_target_seat from public.lifemate_game_seats where uid=v_target and room_id=p_room_id for update;
    delete from public.lifemate_game_seats where uid=v_target and room_id=p_room_id;
    if v_target_seat.uid is not null then
      insert into public.lifemate_game_receipts(uid,action_id,room_id,fingerprint,ack)
        values(v_target,gen_random_uuid(),p_room_id,'room-kicked',jsonb_build_object(
          'id',p_action_id,'roomId',p_room_id,'reason','kicked','sessionId',v_target_seat.session_id));
    end if;
  end if;
  if p_kind='join' then
    insert into public.lifemate_game_seats(uid,room_id,session_id,auth_time) values(p_uid,p_room_id,p_session_id,p_auth_time);
  elsif p_kind='leave' then
    delete from public.lifemate_game_seats where uid=p_uid;
  else
    update public.lifemate_game_seats set lease_until=now()+interval '90 seconds',auth_time=p_auth_time where uid=p_uid;
  end if;
  v_changed:=v_room.state->'members' is distinct from p_state->'members' and p_kind in ('join','leave','kick');
  v_epoch:=case when v_changed then gen_random_uuid() else v_room.epoch end;
  v_match:=case when p_kind='start' then gen_random_uuid() else v_room.match_id end;
  update public.lifemate_game_rooms set state=p_state,version=version+1,epoch=v_epoch,match_id=v_match,
    expires_at=case when p_kind in ('join','ready','start','play','pass','game-action','transfer-owner','kick')
      then now()+interval '30 minutes' else expires_at end,
    private_until=case when p_state->>'phase'='playing' then null
      when p_state->>'phase' in ('finished','closed') and (p_kind='start' or v_room.private_until is null)
        then now()+interval '24 hours' else v_room.private_until end,
    updated_at=now(),worker_token=null,worker_until=null
    where id=p_room_id returning * into v_updated;
  perform public.lifemate_game_schedule(p_room_id);
  if p_state->>'phase'='finished' and (p_kind='start' or v_room.state->>'phase'='playing') and v_match is not null then
    insert into public.lifemate_game_results(match_id,participant_uids,result)
    values(v_match,array(select m->>'uid' from jsonb_array_elements(p_state->'game'->'players') m),p_state->'game'->'result') on conflict do nothing;
  end if;
  if v_changed then perform realtime.send(jsonb_build_object('version',v_room.version+1),'invalidate','card-room:'||p_room_id||':'||v_room.epoch,true); end if;
  perform realtime.send(jsonb_build_object('version',v_room.version+1),'changed','card-room:'||p_room_id||':'||v_epoch,true);
  v_ack:=jsonb_build_object('roomId',p_room_id,'version',v_room.version+1);
  insert into public.lifemate_game_receipts(uid,action_id,room_id,fingerprint,ack) values(p_uid,p_action_id,p_room_id,p_fingerprint,v_ack);
  if p_kind in ('ready','start','play','pass','game-action','transfer-owner','kick') then
    return jsonb_build_object('ack',v_ack,'record',to_jsonb(v_updated),'controller',v_seat.session_id=p_session_id,
      'now',floor(extract(epoch from clock_timestamp())*1000));
  end if;
  return v_ack;
end $$;
revoke all on function public.lifemate_game_commit(text,bigint,uuid,uuid,text,uuid,bigint,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_commit(text,bigint,uuid,uuid,text,uuid,bigint,uuid,text,jsonb) to service_role;
