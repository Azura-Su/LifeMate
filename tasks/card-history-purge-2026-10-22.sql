-- One-off fixed-scope production history purge requested on 2026-10-22.
-- LifeMate project xbhelntqytleiduzicuj; captured cutoff 2026-10-22T04:52:07.495797+00:00
-- Not a migration. Retains room retry markers only, with no names/points/audit.
-- Ends with ROLLBACK for rehearsal; commit only after successful review/rehearsal.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
lock table public.lifemate_game_rooms in exclusive mode;
lock table public.lifemate_game_score_tables,public.lifemate_game_results in share row exclusive mode;
do $purge$
declare
  v_tables uuid[]:=array['0f75111f-62a6-42a0-a051-6e72feac0a57'::uuid,'37c63694-43e8-4c18-aa4a-355440ad39db'::uuid,'4a2a6617-1463-43f2-84c7-89494a48b74c'::uuid,'6a4f2974-9b5c-4f91-b529-759646206634'::uuid,'a9a2d399-d8d4-433e-ac8b-c263e1690b8d'::uuid,'c3961925-eb02-4cf8-ab55-0ae25e059c8c'::uuid];
  v_rooms uuid[]:=array['201fc5c2-3563-4dc0-97a3-2aeb144b548c'::uuid,'764b3ab6-840e-490c-b3bf-f5ce0a5700b7'::uuid,'8e82710a-24af-415a-b58f-0a7dbae7bc7f'::uuid,'8f784221-5c65-413d-94d0-ad77304b0852'::uuid,'d44974c0-67fb-46cd-880c-811de7fc9569'::uuid,'e2650752-6afe-4935-91d9-ba1eed3144ec'::uuid];
  v_results uuid[]:=array['016611a0-c9f7-4f0e-86eb-821eb6ea7947'::uuid,'24da96c2-dda7-4a5f-9d39-48b451752c0e'::uuid,'251d1847-e414-4027-852b-38659f34c177'::uuid,'27f1d91b-bc25-4de2-8e9c-cacb66c096da'::uuid,'42a1a566-4237-4646-8879-f5325074bc15'::uuid,'4dff80f8-5489-4e8d-9542-9fe60d80ba32'::uuid,'5229567b-36c7-4fe8-9e2d-fb1e0b8d2c14'::uuid,'53b73496-982d-446a-a2d2-0cb22afd7c19'::uuid,'572c1fa2-c38e-4552-a08d-23119747a4b8'::uuid,'573d81f1-5b1b-42ea-8115-0a11f82c7aad'::uuid,'8457a011-e1d5-46d3-935f-4e46bf086117'::uuid,'8b737cc6-d336-4ae7-856d-e6a8f4c8c7eb'::uuid,'92e755b1-9539-4561-be5c-57f7a5f9d18e'::uuid,'aac72211-2e45-490b-8978-bc651509da80'::uuid,'ab3e77de-a34c-42d0-b1fc-9013bbf790ce'::uuid,'bc10a6ab-a781-48b9-9675-1064ea689b08'::uuid,'bf92dce4-f187-44f7-9c37-f89377465bd4'::uuid,'c6c7f22c-dd8c-4d53-a63b-b59c30475e92'::uuid,'d416c90b-7722-4d21-a32f-23f78f2467aa'::uuid,'de390682-6bce-433d-ab66-db3592cb79f1'::uuid];
  v_deleted_rooms integer; v_deleted_tables integer; v_deleted_results integer;
begin
  if (select count(*) from public.lifemate_game_score_tables where id=any(v_tables)
      and room_id=any(v_rooms) and (deleted_at is not null or document->>'status'='finished'))<>6
    or (select count(*) from public.lifemate_game_rooms where id=any(v_rooms))<>6 then
    raise exception 'purge-scope-changed';
  end if;
  if exists(select 1 from public.lifemate_game_score_tables where room_id=any(v_rooms) and not(id=any(v_tables)))
    or exists(select 1 from public.lifemate_game_rooms where id=any(v_rooms)
      and (state->>'phase' not in ('closed','finished') or jsonb_array_length(state->'members')<>0))
    or exists(select 1 from public.lifemate_game_seats where room_id=any(v_rooms)) then
    raise exception 'purge-room-in-use';
  end if;
  if not exists(select 1 from public.lifemate_game_score_tables t where id='e3f10764-8c13-47ea-b86e-2620f3588c09' and md5(to_jsonb(t)::text)='e531f593781697a8150f6e23554aafa9') or not exists(select 1 from public.lifemate_game_rooms r where id='17eedd7d-15d3-45f5-8640-f81d757cddf7' and md5(to_jsonb(r)::text)='48c5d8918914715efae35b5d39902ba0') then raise exception 'protected-active-data-changed'; end if;
  if (select count(*) from public.lifemate_game_results where match_id=any(v_results))<>20
    or exists(select 1 from public.lifemate_game_score_tables t
      cross join lateral jsonb_array_elements(t.document->'rounds') q
      where not(t.id=any(v_tables)) and q->>'id'=any(v_results::text[]))
    or exists(select 1 from public.lifemate_game_rooms r
      where not(r.id=any(v_rooms)) and r.match_id=any(v_results)) then
    raise exception 'purge-result-scope-changed';
  end if;
  if (select count(*) from public.lifemate_game_score_events where table_id=any(v_tables))<>15
    or (select count(*) from public.lifemate_game_score_receipts where table_id=any(v_tables))<>12
    or (select count(*) from public.lifemate_game_receipts where room_id=any(v_rooms))<>112 then
    raise exception 'purge-dependent-data-changed';
  end if;

  insert into public.lifemate_game_deleted_rooms(
    room_id,owner_uid,action_id,fingerprint,create_uid,create_action_id,create_fingerprint
  )
  select r.id,t.owner_uid,gen_random_uuid(),'administrative-history-purge-20261022',
    c.uid,c.action_id,c.fingerprint
  from public.lifemate_game_rooms r
  join public.lifemate_game_score_tables t on t.room_id=r.id and t.id=any(v_tables)
  left join lateral (
    select uid,action_id,fingerprint from public.lifemate_game_receipts
    where room_id=r.id order by created_at,action_id limit 1
  ) c on true
  where r.id=any(v_rooms)
  on conflict(room_id) do nothing;

  delete from public.lifemate_game_rooms where id=any(v_rooms);
  get diagnostics v_deleted_rooms=row_count;
  delete from public.lifemate_game_results where match_id=any(v_results);
  get diagnostics v_deleted_results=row_count;
  delete from public.lifemate_game_score_tables where id=any(v_tables);
  get diagnostics v_deleted_tables=row_count;

  if v_deleted_rooms<>6 or v_deleted_tables<>6 or v_deleted_results<>20
    or exists(select 1 from public.lifemate_game_rooms where id=any(v_rooms))
    or exists(select 1 from public.lifemate_game_score_tables where id=any(v_tables) or room_id=any(v_rooms))
    or exists(select 1 from public.lifemate_game_results where match_id=any(v_results))
    or exists(select 1 from public.lifemate_game_score_events where table_id=any(v_tables))
    or exists(select 1 from public.lifemate_game_score_receipts where table_id=any(v_tables))
    or exists(select 1 from public.lifemate_game_receipts where room_id=any(v_rooms))
    or exists(select 1 from public.lifemate_game_seats where room_id=any(v_rooms))
    or (select count(*) from public.lifemate_game_deleted_rooms where room_id=any(v_rooms))<>6 then
    raise exception 'purge-postcondition-failed';
  end if;
  if not exists(select 1 from public.lifemate_game_score_tables t where id='e3f10764-8c13-47ea-b86e-2620f3588c09' and md5(to_jsonb(t)::text)='e531f593781697a8150f6e23554aafa9') or not exists(select 1 from public.lifemate_game_rooms r where id='17eedd7d-15d3-45f5-8640-f81d757cddf7' and md5(to_jsonb(r)::text)='48c5d8918914715efae35b5d39902ba0') then raise exception 'protected-active-data-changed'; end if;
  perform set_config('lifemate.history_purge_summary',jsonb_build_object(
    'deleted_score_tables',v_deleted_tables,'deleted_score_rounds',6,
    'deleted_score_events',15,'deleted_score_receipts',12,'deleted_game_receipts',112,
    'deleted_rooms',v_deleted_rooms,'deleted_results',v_deleted_results,
    'retained_active_tables',1,'retained_active_rooms',1,'verified',true
  )::text,true);
end
$purge$;
select current_setting('lifemate.history_purge_summary')::jsonb as purge_summary;
rollback;

