-- Additive Phỏm rooms. Existing rooms and create signatures remain Tiến lên.
create function public.lifemate_game_assert_phom_config(p_config jsonb)
returns void language plpgsql set search_path='' as $$
declare v_key text; v_value numeric;
begin
  if jsonb_typeof(p_config) is distinct from 'object' then raise exception 'invalid-input'; end if;
  if (select count(*) from jsonb_object_keys(p_config))<>10 then raise exception 'invalid-input'; end if;
  foreach v_key in array array['second','third','last','eat','chot','mom','u','uTron','den','forfeit'] loop
    if jsonb_typeof(p_config->v_key) is distinct from 'number' then raise exception 'invalid-input'; end if;
    v_value:=(p_config->>v_key)::numeric;
    if v_value<0 or v_value>1000000000 or trunc(v_value)<>v_value then raise exception 'invalid-input'; end if;
  end loop;
end $$;
revoke all on function public.lifemate_game_assert_phom_config(jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_assert_phom_config(jsonb) to service_role;

-- Covers user commits, workers and reopen paths without forking those RPCs.
create function public.lifemate_game_keep_kind() returns trigger
language plpgsql set search_path='' as $$
declare v_kind text:=coalesce(new.state->>'gameKind','south');
begin
  if v_kind not in ('south','phom') then raise exception 'invalid-input'; end if;
  if tg_op='UPDATE' then
    if coalesce(old.state->>'gameKind','south')<>v_kind and not (
      v_kind='phom' and coalesce(old.state->>'gameKind','south')='south'
      and coalesce(current_setting('lifemate.phom_create',true),'')=new.id::text
      and old.state->>'phase'='lobby' and old.match_id is null
    ) then raise exception 'invalid-input'; end if;
    if old.state->>'gameKind'='phom' and old.state->'phomConfig' is distinct from new.state->'phomConfig'
      then raise exception 'invalid-input'; end if;
  end if;
  if v_kind='phom' then
    perform public.lifemate_game_assert_phom_config(new.state->'phomConfig');
    if new.state->'game' is not null and new.state->'game'<>'null'::jsonb and (
      new.state->'game'->>'rulesVersion' is distinct from 'phom-v1'
      or new.state->'game'->'config' is distinct from new.state->'phomConfig'
    ) then raise exception 'invalid-input'; end if;
  end if;
  return new;
end $$;
revoke all on function public.lifemate_game_keep_kind() from public,anon,authenticated;
grant execute on function public.lifemate_game_keep_kind() to service_role;
create trigger lifemate_game_keep_kind before insert or update of state on public.lifemate_game_rooms
for each row execute function public.lifemate_game_keep_kind();

create function public.lifemate_game_create_phom(
 p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
 p_room_id uuid,p_code text,p_name text,p_config jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ack jsonb; v_room public.lifemate_game_rooms;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_assert_phom_config(p_config);
  v_ack:=public.lifemate_game_receipt(p_uid,p_auth_time,p_action_id,p_fingerprint);
  if v_ack is not null then
    select * into v_room from public.lifemate_game_rooms where id=(v_ack->>'roomId')::uuid;
    if not found then raise exception 'room-deleted'; end if;
    if v_room.state->>'gameKind' is distinct from 'phom' or v_room.state->'phomConfig' is distinct from p_config then raise exception 'idempotency-conflict'; end if;
    return v_ack;
  end if;
  v_ack:=public.lifemate_game_create(p_uid,p_auth_time,p_session_id,p_action_id,p_fingerprint,p_room_id,p_code,p_name,0::bigint);
  perform set_config('lifemate.phom_create',(v_ack->>'roomId'),true);
  update public.lifemate_game_rooms set state=state||jsonb_build_object('gameKind','phom','phomConfig',p_config)
    where id=(v_ack->>'roomId')::uuid;
  perform set_config('lifemate.phom_create','',true);
  -- The legacy insert trigger creates the initial score sheet before tagging kind.
  -- Only its original generated title may be corrected; never a later user edit.
  update public.lifemate_game_score_tables set document=jsonb_set(document,'{title}',to_jsonb('Phỏm · '||p_code)),version=version+1
    where room_id=(v_ack->>'roomId')::uuid and document->>'title'='Tiến lên miền Nam · '||p_code;
  return v_ack;
end $$;
revoke all on function public.lifemate_game_create_phom(text,bigint,uuid,uuid,text,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_create_phom(text,bigint,uuid,uuid,text,uuid,text,text,jsonb) to service_role;

-- Correct defaults for score sheets recreated after erasure, preserving edited titles.
create or replace function public.lifemate_game_sync_score(p_room public.lifemate_game_rooms)
returns void language plpgsql set search_path='' as $$
declare v_table public.lifemate_game_score_tables; v_doc jsonb; v_players jsonb; v_member jsonb;
  v_owner text; v_uids text[]; v_name text; v_base text; v_suffix integer; v_now bigint;
  v_scores jsonb; v_changes jsonb; v_round jsonb;
begin
  -- Erasure owns cleanup and must not rebuild the old identities during roster edits.
  if coalesce(current_setting('lifemate.score_erasing',true),'')='1' then return; end if;
  v_owner:=coalesce(p_room.state->>'ownerUid',p_room.state->>'host',p_room.state->'scoreMembers'->0->>'uid','');
  select array_agg(distinct m->>'uid') into v_uids from jsonb_array_elements(
    coalesce(p_room.state->'scoreMembers','[]')||coalesce(p_room.state->'members','[]')||coalesce(p_room.state->'game'->'players','[]')) m
    where m->>'uid' is not null;
  if coalesce(cardinality(v_uids),0)=0 then return; end if;
  select * into v_table from public.lifemate_game_score_tables where room_id=p_room.id for update;
  v_doc:=coalesce(v_table.document,jsonb_build_object('title',(case when p_room.state->>'gameKind'='phom' then 'Phỏm · ' else 'Tiến lên miền Nam · ' end)||p_room.code,'players','[]'::jsonb,
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

-- Kind metadata is exposed only to already authorized room-history members.
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
  return jsonb_build_object('roomId',p_room_id,'gameKind',coalesce(v_room.state->>'gameKind','south'),'exists',true,'owner',v_owner=p_uid,
    'canRejoin',v_room.expires_at>v_now and v_room.state->>'phase'<>'closed'
      and (jsonb_array_length(v_room.state->'members')>0 or v_owner=p_uid),
    'canReopen',v_owner=p_uid and v_room.expires_at<=v_now and v_room.state->>'phase'<>'playing',
    'canDelete',v_owner=p_uid and v_room.state->>'phase'='finished',
    'expired',v_room.expires_at<=v_now,'phase',v_room.state->>'phase','version',v_room.version,'matchId',v_room.match_id);
end $$;

revoke all on function public.lifemate_game_status(text,bigint,uuid,uuid) from public,anon,authenticated;
grant execute on function public.lifemate_game_status(text,bigint,uuid,uuid) to service_role;
