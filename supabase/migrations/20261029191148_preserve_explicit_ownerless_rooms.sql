-- Explicit JSON null and the erased-owner sentinel both mean ownerless. Only
-- legacy rooms missing ownerUid may fall back to host/scoreMembers. Keep all
-- existing signatures, invoker privileges, search paths and table contracts.

create or replace function public.lifemate_game_sync_score(p_room public.lifemate_game_rooms)
returns void language plpgsql set search_path='' as $$
declare v_table public.lifemate_game_score_tables; v_doc jsonb; v_players jsonb; v_member jsonb;
  v_owner text; v_uids text[]; v_name text; v_base text; v_suffix integer; v_now bigint;
  v_scores jsonb; v_changes jsonb; v_round jsonb; v_title text;
begin
  if coalesce(current_setting('lifemate.score_erasing',true),'')='1' then return; end if;
  v_owner:=case when p_room.state ? 'ownerUid' then coalesce(p_room.state->>'ownerUid','') else coalesce(p_room.state->>'host',p_room.state->'scoreMembers'->0->>'uid','') end;
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

create or replace function public.lifemate_game_score_write(p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
  p_table_id uuid,p_version bigint,p_operation text,p_document jsonb default null)
returns jsonb language plpgsql set search_path='' as $$
declare v_table public.lifemate_game_score_tables; v_room public.lifemate_game_rooms; v_room_id uuid;
  v_receipt public.lifemate_game_score_receipts; v_now bigint; v_doc jsonb; v_changes jsonb; v_name text; v_rounds jsonb;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid,false);
  select room_id into v_room_id from public.lifemate_game_score_tables where id=p_table_id;
  -- Same lock order as the room trigger. Transfers serialize with this check.
  select * into v_room from public.lifemate_game_rooms where id=v_room_id for update;
  select * into v_table from public.lifemate_game_score_tables where id=p_table_id for update;
  if not found or v_table.owner_uid<>p_uid then raise exception 'not-owner'; end if;
  if v_room.id is not null and (case when v_room.state ? 'ownerUid' then coalesce(v_room.state->>'ownerUid','') else coalesce(v_room.state->>'host',v_room.state->'scoreMembers'->0->>'uid','') end) is distinct from p_uid then raise exception 'not-owner'; end if;
  if p_operation is null or p_operation not in ('save','patch','delete') then raise exception 'invalid-input'; end if;
  select * into v_receipt from public.lifemate_game_score_receipts where uid=p_uid and action_id=p_action_id;
  if found then
    if v_receipt.fingerprint<>p_fingerprint or v_receipt.table_id<>p_table_id then raise exception 'idempotency-conflict'; end if;
    return public.lifemate_game_score_view(v_table,p_uid);
  end if;
  -- Deletion is terminal; only an existing receipt may replay the result.
  if v_table.deleted_at is not null then raise exception 'room-deleted'; end if;
  if v_table.version<>p_version then raise exception 'version-conflict'; end if;
  v_now:=(extract(epoch from clock_timestamp())*1000)::bigint;
  v_doc:=v_table.document;
  if p_operation in ('save','patch') then
    if p_operation='patch' then
      if p_document is null or jsonb_typeof(p_document) is distinct from 'object'
        or not (p_document ?& array['settings','upsertRounds','deleteRoundIds'])
        or exists(select 1 from jsonb_object_keys(p_document) k where k not in ('settings','upsertRounds','deleteRoundIds'))
        or jsonb_typeof(p_document->'settings') is distinct from 'object'
        or not ((p_document->'settings') ?& array['title','players','seatOrder','dealerPlayerId','status'])
        or exists(select 1 from jsonb_object_keys(p_document->'settings') k where k not in ('title','players','seatOrder','dealerPlayerId','status'))
        or jsonb_typeof(p_document->'settings'->'players') is distinct from 'array'
        or jsonb_typeof(p_document->'upsertRounds') is distinct from 'array'
        or jsonb_typeof(p_document->'deleteRoundIds') is distinct from 'array' then raise exception 'invalid-input'; end if;
      if jsonb_array_length(p_document->'upsertRounds')>100 or jsonb_array_length(p_document->'deleteRoundIds')>100
        or jsonb_array_length(p_document->'upsertRounds')<>(select count(distinct r->>'id') from jsonb_array_elements(p_document->'upsertRounds') r)
        or jsonb_array_length(p_document->'deleteRoundIds')<>(select count(distinct r) from jsonb_array_elements(p_document->'deleteRoundIds') r)
        or exists(select 1 from jsonb_array_elements(p_document->'upsertRounds') r where (p_document->'deleteRoundIds') ? (r->>'id'))
        then raise exception 'invalid-input'; end if;
      select coalesce(jsonb_agg(coalesce(u.value,jsonb_set(b.value,'{scores}',(
        select coalesce(jsonb_object_agg(s.key,s.value),'{}') from jsonb_each(b.value->'scores') s
        where exists(select 1 from jsonb_array_elements(p_document->'settings'->'players') player where player->>'id'=s.key)
      ))) order by b.ordinality),'[]') into v_rounds
      from jsonb_array_elements(v_doc->'rounds') with ordinality b(value,ordinality)
      left join lateral (select value from jsonb_array_elements(p_document->'upsertRounds') where value->>'id'=b.value->>'id') u on true
      where not ((p_document->'deleteRoundIds') ? (b.value->>'id'));
      v_rounds:=v_rounds||(select coalesce(jsonb_agg(r order by ord),'[]')
        from jsonb_array_elements(p_document->'upsertRounds') with ordinality edits(r,ord)
        where not exists(select 1 from jsonb_array_elements(v_doc->'rounds') old where old->>'id'=r->>'id'));
      p_document:=(p_document->'settings')||jsonb_build_object('rounds',v_rounds);
    end if;
    if p_document is null or jsonb_typeof(p_document)<>'object' or exists(select 1 from jsonb_object_keys(p_document) k where k not in ('title','players','seatOrder','dealerPlayerId','rounds','status'))
      or not (p_document ?& array['title','players','seatOrder','dealerPlayerId','rounds','status']) then raise exception 'invalid-input'; end if;
    v_doc:=v_doc||p_document;
    -- Removed server rounds/players are tombstoned by the server, never by a trusted client flag.
    v_doc:=jsonb_set(v_doc,'{ignoredOnlineRoundIds}',(select coalesce(jsonb_agg(distinct x),'[]') from (
      select value x from jsonb_array_elements(coalesce(v_table.document->'ignoredOnlineRoundIds','[]'))
      union select r->'id' from jsonb_array_elements(v_table.document->'rounds') r where not exists(select 1 from jsonb_array_elements(v_doc->'rounds') n where n->>'id'=r->>'id')) s));
    v_doc:=jsonb_set(v_doc,'{ignoredOnlinePlayerIds}',(select coalesce(jsonb_agg(distinct x),'[]') from (
      select value x from jsonb_array_elements(coalesce(v_table.document->'ignoredOnlinePlayerIds','[]'))
      union select r->'id' from jsonb_array_elements(v_table.document->'players') r where not exists(select 1 from jsonb_array_elements(v_doc->'players') n where n->>'id'=r->>'id')) s));
    v_changes:=public.lifemate_game_score_diff(v_table.document,v_doc);
  else
    v_changes:=jsonb_build_array(jsonb_build_object('kind','table-delete'));
    v_table.deleted_at:=v_now;
  end if;
  select coalesce(nullif(m->>'name',''),'Chủ phòng') into v_name from jsonb_array_elements(
    coalesce(v_room.state->'scoreMembers',v_table.document->'players')) m where coalesce(m->>'uid',m->>'id')=p_uid limit 1;
  update public.lifemate_game_score_tables set document=v_doc,deleted_at=v_table.deleted_at,version=version+1,updated_at=v_now where id=p_table_id returning * into v_table;
  insert into public.lifemate_game_score_events values(p_table_id,v_table.version,p_uid,coalesce(v_name,'Chủ phòng'),v_now,v_changes);
  insert into public.lifemate_game_score_receipts values(p_uid,p_action_id,p_table_id,p_fingerprint);
  return public.lifemate_game_score_view(v_table,p_uid);
end $$;

create or replace function public.lifemate_game_score_room_trigger() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' and new.match_id is not distinct from old.match_id
    and new.code is not distinct from old.code
    and new.state->'amountPerCard' is not distinct from old.state->'amountPerCard'
    and new.state->'game'->'result' is not distinct from old.state->'game'->'result'
    and (case when new.state ? 'ownerUid' then coalesce(new.state->>'ownerUid','') else coalesce(new.state->>'host',new.state->'scoreMembers'->0->>'uid','') end)
      is not distinct from (case when old.state ? 'ownerUid' then coalesce(old.state->>'ownerUid','') else coalesce(old.state->>'host',old.state->'scoreMembers'->0->>'uid','') end)
    and public.lifemate_game_score_roster(new.state)=public.lifemate_game_score_roster(old.state)
    and exists(select 1 from public.lifemate_game_score_tables where room_id=new.id) then return new; end if;
  perform public.lifemate_game_sync_score(new); return new;
end $$;

-- Repair only a stale ownership projection for rooms that are still retained.
-- Keep document, membership, audit, receipts and deleted-room score sheets.
update public.lifemate_game_score_tables t
set owner_uid='',version=t.version+1,
  updated_at=(extract(epoch from clock_timestamp())*1000)::bigint
from public.lifemate_game_rooms r
where t.room_id=r.id and r.state ? 'ownerUid'
  and coalesce(r.state->>'ownerUid','')='' and t.owner_uid<>'';
