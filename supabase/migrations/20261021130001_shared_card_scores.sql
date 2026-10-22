-- Canonical score sheets are independent of ephemeral room/seat lifetimes.
create table public.lifemate_game_score_tables (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique,
  owner_uid text not null,
  member_uids text[] not null,
  document jsonb not null,
  version bigint not null default 1 check(version>0),
  deleted_at bigint,
  created_at bigint not null default (extract(epoch from clock_timestamp())*1000)::bigint,
  updated_at bigint not null default (extract(epoch from clock_timestamp())*1000)::bigint
);
create index lifemate_game_score_members on public.lifemate_game_score_tables using gin(member_uids);
create index lifemate_game_score_owner on public.lifemate_game_score_tables(owner_uid);
create table public.lifemate_game_score_events (
  table_id uuid not null references public.lifemate_game_score_tables(id) on delete cascade,
  version bigint not null,
  actor_uid text,
  actor_name text not null,
  at bigint not null,
  changes jsonb not null,
  primary key(table_id,version)
);
create table public.lifemate_game_score_receipts (
  uid text not null,
  action_id uuid not null,
  table_id uuid not null references public.lifemate_game_score_tables(id) on delete cascade,
  fingerprint text not null,
  primary key(uid,action_id)
);
alter table public.lifemate_game_score_tables enable row level security;
alter table public.lifemate_game_score_events enable row level security;
alter table public.lifemate_game_score_receipts enable row level security;
revoke all on public.lifemate_game_score_tables,public.lifemate_game_score_events,public.lifemate_game_score_receipts from public,anon,authenticated;
grant all on public.lifemate_game_score_tables,public.lifemate_game_score_events,public.lifemate_game_score_receipts to service_role;

create function public.lifemate_game_score_view(p_table public.lifemate_game_score_tables,p_uid text)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('match',p_table.document || jsonb_build_object(
    'id',p_table.id,'onlineRoomId',p_table.room_id,'sharedVersion',p_table.version,
    'createdAt',p_table.created_at,'updatedAt',p_table.updated_at) ||
    case when p_table.deleted_at is null then '{}'::jsonb else jsonb_build_object('deletedAt',p_table.deleted_at) end,
    'canEdit',p_table.owner_uid=p_uid)
$$;

-- Persist only the changed rows/settings; a deleted row retains its old names/scores.
create function public.lifemate_game_score_diff(p_before jsonb,p_after jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare v_changes jsonb:='[]'; v_old jsonb; v_new jsonb; v_row record; v_before jsonb; v_after jsonb;
begin
  for v_row in select r.value,r.ordinality from jsonb_array_elements(coalesce(p_before->'rounds','[]')) with ordinality r loop
    select r into v_new from jsonb_array_elements(coalesce(p_after->'rounds','[]')) r where r->>'id'=v_row.value->>'id';
    if v_new is distinct from v_row.value then
      v_changes:=v_changes||jsonb_build_array(jsonb_build_object('kind',case when v_new is null then 'round-delete' else 'round-edit' end,
        'roundNumber',v_row.ordinality,'players',p_before->'players','before',v_row.value,'after',v_new));
    end if;
  end loop;
  for v_row in select r.value,r.ordinality from jsonb_array_elements(coalesce(p_after->'rounds','[]')) with ordinality r loop
    if not exists(select 1 from jsonb_array_elements(coalesce(p_before->'rounds','[]')) r where r->>'id'=v_row.value->>'id') then
      v_changes:=v_changes||jsonb_build_array(jsonb_build_object('kind','round-add','roundNumber',v_row.ordinality,'players',p_after->'players','after',v_row.value));
    end if;
  end loop;
  select coalesce(jsonb_object_agg(e.key,e.value),'{}') into v_before from jsonb_each(p_before) e
    where e.key in ('title','players','seatOrder','dealerPlayerId','status') and e.value is distinct from p_after->e.key;
  select coalesce(jsonb_object_agg(e.key,e.value),'{}') into v_after from jsonb_each(p_after) e
    where e.key in ('title','players','seatOrder','dealerPlayerId','status') and e.value is distinct from p_before->e.key;
  if v_before<>'{}' or v_after<>'{}' then
    v_changes:=v_changes||jsonb_build_array(jsonb_build_object('kind','settings','before',v_before,'after',v_after));
  end if;
  return v_changes;
end $$;

create function public.lifemate_game_sync_score(p_room public.lifemate_game_rooms)
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
  v_doc:=coalesce(v_table.document,jsonb_build_object('title','Tiến lên miền Nam · '||p_room.code,'players','[]'::jsonb,
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
create function public.lifemate_game_score_roster(p_state jsonb) returns jsonb language sql immutable set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_array(m->'uid',m->'name') order by m->>'uid',m->>'name'),'[]')
    from jsonb_array_elements(coalesce(p_state->'scoreMembers','[]')||coalesce(p_state->'members','[]')||coalesce(p_state->'game'->'players','[]')) m
$$;
create function public.lifemate_game_score_room_trigger() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' and new.match_id is not distinct from old.match_id
    and new.code is not distinct from old.code
    and new.state->'amountPerCard' is not distinct from old.state->'amountPerCard'
    and new.state->'game'->'result' is not distinct from old.state->'game'->'result'
    and coalesce(new.state->>'ownerUid',new.state->>'host',new.state->'scoreMembers'->0->>'uid','')
      is not distinct from coalesce(old.state->>'ownerUid',old.state->>'host',old.state->'scoreMembers'->0->>'uid','')
    and public.lifemate_game_score_roster(new.state)=public.lifemate_game_score_roster(old.state)
    and exists(select 1 from public.lifemate_game_score_tables where room_id=new.id) then return new; end if;
  perform public.lifemate_game_sync_score(new); return new;
end $$;
create trigger lifemate_game_score_room after insert or update of state,match_id on public.lifemate_game_rooms
  for each row execute function public.lifemate_game_score_room_trigger();
do $$ declare r public.lifemate_game_rooms; begin
  for r in select * from public.lifemate_game_rooms order by id for update loop perform public.lifemate_game_sync_score(r); end loop;
end $$;

create function public.lifemate_game_score_list(p_uid text,p_auth_time bigint,p_session_id uuid)
returns jsonb language plpgsql set search_path='' as $$
declare v_result jsonb;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid,false);
  select coalesce(jsonb_agg(public.lifemate_game_score_view(t,p_uid) order by t.updated_at desc,t.id),'[]') into v_result
    from public.lifemate_game_score_tables t where t.owner_uid=p_uid or t.member_uids @> array[p_uid];
  return jsonb_build_object('tables',v_result);
end $$;
create function public.lifemate_game_score_history(p_uid text,p_auth_time bigint,p_session_id uuid,p_table_id uuid,p_before bigint default null)
returns jsonb language plpgsql set search_path='' as $$
declare v_table public.lifemate_game_score_tables; v_events jsonb; v_cursor bigint;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid,false);
  select * into v_table from public.lifemate_game_score_tables where id=p_table_id;
  if not found or not (v_table.owner_uid=p_uid or p_uid=any(v_table.member_uids)) then raise exception 'not-member'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.version::text,'at',e.at,'actorUid',e.actor_uid,'actorName',e.actor_name,'changes',e.changes) order by e.version desc),'[]'),min(e.version)
    into v_events,v_cursor from (select * from public.lifemate_game_score_events where table_id=p_table_id and (p_before is null or version<p_before) order by version desc limit 30) e;
  if not exists(select 1 from public.lifemate_game_score_events where table_id=p_table_id and version<v_cursor) then v_cursor:=null; end if;
  return jsonb_build_object('events',v_events,'nextBefore',v_cursor);
end $$;

create function public.lifemate_game_score_write(p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
  p_table_id uuid,p_version bigint,p_operation text,p_document jsonb default null)
returns jsonb language plpgsql set search_path='' as $$
declare v_table public.lifemate_game_score_tables; v_room public.lifemate_game_rooms; v_room_id uuid;
  v_receipt public.lifemate_game_score_receipts; v_now bigint; v_doc jsonb; v_changes jsonb; v_name text;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid,false);
  select room_id into v_room_id from public.lifemate_game_score_tables where id=p_table_id;
  -- Same lock order as the room trigger. Transfers serialize with this check.
  select * into v_room from public.lifemate_game_rooms where id=v_room_id for update;
  select * into v_table from public.lifemate_game_score_tables where id=p_table_id for update;
  if not found or v_table.owner_uid<>p_uid then raise exception 'not-owner'; end if;
  if v_room.id is not null and coalesce(v_room.state->>'ownerUid',v_room.state->>'host',v_room.state->'scoreMembers'->0->>'uid','')<>p_uid then raise exception 'not-owner'; end if;
  select * into v_receipt from public.lifemate_game_score_receipts where uid=p_uid and action_id=p_action_id;
  if found then
    if v_receipt.fingerprint<>p_fingerprint or v_receipt.table_id<>p_table_id then raise exception 'idempotency-conflict'; end if;
    return public.lifemate_game_score_view(v_table,p_uid);
  end if;
  if v_table.version<>p_version then raise exception 'version-conflict'; end if;
  if p_operation not in ('save','delete','restore') then raise exception 'invalid-input'; end if;
  v_now:=(extract(epoch from clock_timestamp())*1000)::bigint;
  v_doc:=v_table.document;
  if p_operation='save' then
    if v_table.deleted_at is not null then raise exception 'room-deleted'; end if;
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
  elsif p_operation='delete' then
    v_changes:=jsonb_build_array(jsonb_build_object('kind','table-delete'));
    v_table.deleted_at:=v_now;
  else
    v_changes:=jsonb_build_array(jsonb_build_object('kind','table-restore'));
    v_table.deleted_at:=null;
    v_doc:=jsonb_set(v_doc,'{status}','"active"');
  end if;
  select coalesce(nullif(m->>'name',''),'Chủ phòng') into v_name from jsonb_array_elements(
    coalesce(v_room.state->'scoreMembers',v_table.document->'players')) m where coalesce(m->>'uid',m->>'id')=p_uid limit 1;
  update public.lifemate_game_score_tables set document=v_doc,deleted_at=v_table.deleted_at,version=version+1,updated_at=v_now where id=p_table_id returning * into v_table;
  insert into public.lifemate_game_score_events values(p_table_id,v_table.version,p_uid,coalesce(v_name,'Chủ phòng'),v_now,v_changes);
  insert into public.lifemate_game_score_receipts values(p_uid,p_action_id,p_table_id,p_fingerprint);
  return public.lifemate_game_score_view(v_table,p_uid);
end $$;

-- Capture affected IDs before the existing eraser prunes scoreMembers/ownership.
alter function public.lifemate_game_erase_account(text) rename to lifemate_game_erase_account_before_scores;
create function public.lifemate_game_erase_account(p_uid text)
returns void language plpgsql security definer set search_path='' as $$
declare v_ids uuid[];
begin
  select array_agg(id) into v_ids from public.lifemate_game_score_tables where owner_uid=p_uid or member_uids @> array[p_uid]
    or exists(select 1 from public.lifemate_game_score_events e where e.table_id=id and e.actor_uid=p_uid);
  perform set_config('lifemate.score_erasing','1',true);
  perform public.lifemate_game_erase_account_before_scores(p_uid);
  delete from public.lifemate_game_score_tables where id=any(v_ids) or owner_uid=p_uid or member_uids @> array[p_uid]
    or exists(select 1 from public.lifemate_game_score_events e where e.table_id=id and e.actor_uid=p_uid);
  delete from public.lifemate_game_score_receipts where uid=p_uid;
  perform set_config('lifemate.score_erasing','',true);
  -- Later room changes may create a fresh board ID from the sanitized room only.
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'lifemate_game_score_%' or p.proname in ('lifemate_game_sync_score','lifemate_game_erase_account','lifemate_game_erase_account_before_scores')) loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
