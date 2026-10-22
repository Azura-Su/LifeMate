-- Deleted score sheets leave the UI permanently. Keep tombstones/audit for
-- synchronization and result replay suppression, with no restore operation.
create or replace function public.lifemate_game_score_write(p_uid text,p_auth_time bigint,p_session_id uuid,p_action_id uuid,p_fingerprint text,
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
  if p_operation is null or p_operation not in ('save','delete') then raise exception 'invalid-input'; end if;
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
  if p_operation='save' then
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

revoke all on function public.lifemate_game_score_write(text,bigint,uuid,uuid,text,uuid,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.lifemate_game_score_write(text,bigint,uuid,uuid,text,uuid,bigint,text,jsonb) to service_role;
