-- One-off follow-up for the last visible card-score history item.
-- Supabase LifeMate project xbhelntqytleiduzicuj; fixed IDs verified 2026-10-22.
-- Keeps a minimal deleted-room retry marker so delayed requests cannot recreate it.
-- This rehearsal intentionally ends in ROLLBACK.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
lock table public.lifemate_game_rooms in exclusive mode;
lock table public.lifemate_game_seats,public.lifemate_game_receipts in share row exclusive mode;
lock table public.lifemate_game_score_tables,public.lifemate_game_score_events,
  public.lifemate_game_score_receipts,public.lifemate_game_results,
  public.lifemate_game_deleted_rooms in share row exclusive mode;

do $purge$
declare
  v_room constant uuid:='17eedd7d-15d3-45f5-8640-f81d757cddf7';
  v_table constant uuid:='e3f10764-8c13-47ea-b86e-2620f3588c09';
  v_match constant uuid:='b9e8f509-0716-4467-b35b-a09a44b34658';
  v_deleted_rooms integer;
  v_deleted_tables integer;
  v_deleted_results integer;
begin
  if (select count(*) from public.lifemate_game_rooms r
      where r.id=v_room and r.match_id=v_match
        and r.state->>'phase'='closed'
        and jsonb_array_length(coalesce(r.state->'members','[]'::jsonb))=0
        and md5(to_jsonb(r)::text)='48c5d8918914715efae35b5d39902ba0')<>1
    or (select count(*) from public.lifemate_game_score_tables t
      where t.id=v_table and t.room_id=v_room
        and t.document->>'status'='active'
        and md5(to_jsonb(t)::text)='e531f593781697a8150f6e23554aafa9')<>1
    or (select count(*) from public.lifemate_game_score_tables where room_id=v_room)<>1
    or (select count(*) from public.lifemate_game_results where match_id=v_match)<>1
    or exists(select 1 from public.lifemate_game_rooms where match_id=v_match and id<>v_room)
    or (select count(*) from public.lifemate_game_seats where room_id=v_room)<>0
    or (select count(*) from public.lifemate_game_receipts where room_id=v_room)<>17
    or (select count(*) from public.lifemate_game_score_events where table_id=v_table)<>0
    or (select count(*) from public.lifemate_game_score_receipts where table_id=v_table)<>0
    or exists(select 1 from public.lifemate_game_deleted_rooms where room_id=v_room) then
    raise exception 'purge-scope-changed';
  end if;

  if not exists(
    select 1 from public.lifemate_game_receipts
    where room_id=v_room and action_id='3421e25b-4642-422d-80c5-af85739c6a4e'
      and fingerprint='39de30df0f925d94a201b2c6b64454531c7fac9db17f0a15ecbe991f82962bb8'
  ) then
    raise exception 'room-creation-receipt-changed';
  end if;

  insert into public.lifemate_game_deleted_rooms(
    room_id,owner_uid,action_id,fingerprint,create_uid,create_action_id,create_fingerprint
  )
  select r.id,t.owner_uid,gen_random_uuid(),'administrative-history-purge-20261022-followup',
    c.uid,c.action_id,c.fingerprint
  from public.lifemate_game_rooms r
  join public.lifemate_game_score_tables t on t.room_id=r.id and t.id=v_table
  join lateral (
    select uid,action_id,fingerprint from public.lifemate_game_receipts
    where room_id=r.id order by created_at,action_id limit 1
  ) c on true
  where r.id=v_room;

  delete from public.lifemate_game_rooms where id=v_room;
  get diagnostics v_deleted_rooms=row_count;
  delete from public.lifemate_game_results where match_id=v_match;
  get diagnostics v_deleted_results=row_count;
  delete from public.lifemate_game_score_tables where id=v_table;
  get diagnostics v_deleted_tables=row_count;

  if v_deleted_rooms<>1 or v_deleted_results<>1 or v_deleted_tables<>1
    or exists(select 1 from public.lifemate_game_rooms where id=v_room)
    or exists(select 1 from public.lifemate_game_score_tables where id=v_table or room_id=v_room)
    or exists(select 1 from public.lifemate_game_results where match_id=v_match)
    or exists(select 1 from public.lifemate_game_seats where room_id=v_room)
    or exists(select 1 from public.lifemate_game_receipts where room_id=v_room)
    or exists(select 1 from public.lifemate_game_score_events where table_id=v_table)
    or exists(select 1 from public.lifemate_game_score_receipts where table_id=v_table)
    or (select count(*) from public.lifemate_game_deleted_rooms where room_id=v_room)<>1 then
    raise exception 'purge-postcondition-failed';
  end if;

  perform set_config('lifemate.history_purge_summary',jsonb_build_object(
    'deleted_score_tables',v_deleted_tables,'deleted_rooms',v_deleted_rooms,
    'deleted_results',v_deleted_results,'deleted_game_receipts',17,
    'deleted_score_events',0,'deleted_score_receipts',0,
    'retained_retry_marker',true,'verified',true
  )::text,true);
end
$purge$;
select current_setting('lifemate.history_purge_summary')::jsonb as purge_summary;
rollback;
