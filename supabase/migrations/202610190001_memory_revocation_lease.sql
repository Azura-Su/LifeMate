-- Expand before deploying memory-access. Existing fixed photo paths and clients
-- remain compatible; only the service role may claim revocation leases.
alter table public.lifemate_shared_memories
  add column reservation_token uuid not null default gen_random_uuid(),
  add column revoke_token uuid,
  add column revoke_until timestamptz;
alter table public.lifemate_shared_memories
  drop constraint lifemate_shared_memories_status_check,
  drop constraint lifemate_shared_memories_check2,
  add constraint lifemate_shared_memories_status_check
    check (status in ('pending', 'active', 'revoking')),
  add constraint lifemate_shared_memories_photo_status_check
    check (photo_path is not null or status in ('active', 'revoking')),
  add constraint lifemate_shared_memories_revocation_check
    check ((status = 'revoking' and revoke_token is not null and revoke_until is not null)
      or (status <> 'revoking' and revoke_token is null and revoke_until is null));

create function public.claim_lifemate_memory_revocation(
  p_owner_uid text, p_id text, p_token uuid
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.lifemate_shared_memories;
begin
  if p_token is null then raise exception 'Missing revocation token'; end if;
  perform pg_advisory_xact_lock(hashtextextended('lifemate-memory:' || p_owner_uid, 0));
  select * into v_row from public.lifemate_shared_memories
    where owner_uid = p_owner_uid and id = p_id for update;
  if not found then return '{"missing":true}'::jsonb; end if;
  if v_row.status = 'revoking' and v_row.revoke_until > clock_timestamp() then
    return '{"busy":true}'::jsonb;
  end if;
  update public.lifemate_shared_memories
    set status = 'revoking', revoke_token = p_token,
      revoke_until = clock_timestamp() + interval '5 minutes', updated_at = now()
    where owner_uid = p_owner_uid and id = p_id returning * into v_row;
  return to_jsonb(v_row);
end;
$$;
revoke all on function public.claim_lifemate_memory_revocation(text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.claim_lifemate_memory_revocation(text,text,uuid)
  to service_role;

create or replace function public.reserve_lifemate_shared_memory(p_memory jsonb)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.lifemate_shared_memories;
  v_status text;
  v_photo_path text;
begin
  v_row := jsonb_populate_record(null::public.lifemate_shared_memories, p_memory);
  if v_row.owner_uid is null or v_row.id is null then
    raise exception 'Missing memory owner or ID';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('lifemate-memory:' || v_row.owner_uid, 0));
  if exists (select 1 from public.lifemate_memory_deletions
      where owner_uid = v_row.owner_uid and id = v_row.id) then
    return 'memory-deleted';
  end if;
  select status, photo_path into v_status, v_photo_path from public.lifemate_shared_memories
    where owner_uid = v_row.owner_uid and id = v_row.id for update;
  if found then
    if v_status = 'active' then return 'already-shared'; end if;
    if v_status = 'revoking' then return 'memory-revoking'; end if;
    if v_photo_path is not null and v_row.photo_path is null then
      return 'memory-pending';
    end if;
    update public.lifemate_shared_memories set
      date_key = v_row.date_key, body = v_row.body,
      photo_path = v_row.photo_path, photo_backend = v_row.photo_backend,
      photo_size_bytes = v_row.photo_size_bytes,
      supabase_cleanup_pending = v_row.supabase_cleanup_pending
        or lifemate_shared_memories.supabase_cleanup_pending
        or (lifemate_shared_memories.photo_backend = 'supabase' and lifemate_shared_memories.photo_path is not null),
      reservation_token = gen_random_uuid(),
      status = v_row.status, updated_at = now()
      where owner_uid = v_row.owner_uid and id = v_row.id;
  else
    if (select count(*) from public.lifemate_shared_memories
        where owner_uid = v_row.owner_uid) >= 100 then
      return 'memory-limit';
    end if;
    insert into public.lifemate_shared_memories
      (owner_uid, id, date_key, body, photo_path, photo_backend,
       photo_size_bytes, supabase_cleanup_pending, status)
      values (v_row.owner_uid, v_row.id, v_row.date_key, v_row.body,
        v_row.photo_path, v_row.photo_backend, v_row.photo_size_bytes,
        v_row.supabase_cleanup_pending, v_row.status);
  end if;
  return 'saved';
end;
$$;
revoke all on function public.reserve_lifemate_shared_memory(jsonb)
  from public, anon, authenticated;
grant execute on function public.reserve_lifemate_shared_memory(jsonb)
  to service_role;

-- Snapshot-fenced legacy Supabase confirmation; keep the 2-argument overload
-- during rollout for the previous function version. New handler uses this one.
create or replace function public.confirm_lifemate_shared_memory_photo(
  p_owner_uid text, p_id text, p_expected_token uuid
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_path text := 'shared/' || p_owner_uid || '/' || p_id || '/photo.jpg';
begin
  if not exists (
    select 1 from public.lifemate_shared_memories
    where owner_uid = p_owner_uid and id = p_id
      and photo_path = v_path and status = 'pending'
      and reservation_token = p_expected_token
      and photo_backend = 'supabase'
  ) then
    return false;
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'lifemate-memories' and name = v_path
      and coalesce((metadata->>'size')::bigint, 0) between 1 and 2097152
      and metadata->>'mimetype' = 'image/jpeg'
  ) then
    return false;
  end if;
  update public.lifemate_shared_memories
    set status = 'active', updated_at = now()
    where owner_uid = p_owner_uid and id = p_id
      and status = 'pending' and photo_backend = 'supabase'
      and reservation_token = p_expected_token;
  return found;
end;
$$;
revoke all on function public.confirm_lifemate_shared_memory_photo(text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.confirm_lifemate_shared_memory_photo(text, text, uuid)
  to service_role;
