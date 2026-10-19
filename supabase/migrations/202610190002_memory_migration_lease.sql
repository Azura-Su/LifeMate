-- Apply before the matching memory-access handler. Coordinate legacy object
-- copies with revocation/deletion while preserving active friend-feed rows.
alter table public.lifemate_shared_memories
  add column migration_token uuid,
  add column migration_until timestamptz,
  add constraint lifemate_shared_memories_migration_check check (
    (migration_token is null and migration_until is null)
    or (migration_token is not null and migration_until is not null
      and status = 'active' and photo_backend = 'supabase' and photo_path is not null)
  );

create function public.claim_lifemate_memory_migration(
  p_owner_uid text, p_id text, p_expected_token uuid, p_token uuid
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.lifemate_shared_memories;
begin
  if p_token is null or p_expected_token is null then raise exception 'Missing migration token'; end if;
  perform pg_advisory_xact_lock(hashtextextended('lifemate-memory:' || p_owner_uid, 0));
  select * into v_row from public.lifemate_shared_memories
    where owner_uid = p_owner_uid and id = p_id for update;
  if not found or v_row.status <> 'active' or v_row.photo_backend <> 'supabase'
    or v_row.photo_path is null or v_row.reservation_token <> p_expected_token then
    return '{"missing":true}'::jsonb;
  end if;
  if v_row.migration_until > clock_timestamp() then return '{"busy":true}'::jsonb; end if;
  update public.lifemate_shared_memories
    set migration_token = p_token, migration_until = clock_timestamp() + interval '5 minutes'
    where owner_uid = p_owner_uid and id = p_id returning * into v_row;
  return to_jsonb(v_row);
end;
$$;
revoke all on function public.claim_lifemate_memory_migration(text,text,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.claim_lifemate_memory_migration(text,text,uuid,uuid)
  to service_role;

create or replace function public.claim_lifemate_memory_revocation(
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
  if v_row.migration_until > clock_timestamp() then
    return '{"busy":true,"migrating":true}'::jsonb;
  end if;
  if v_row.status = 'revoking' and v_row.revoke_until > clock_timestamp() then
    return '{"busy":true}'::jsonb;
  end if;
  update public.lifemate_shared_memories
    set status = 'revoking', revoke_token = p_token,
      revoke_until = clock_timestamp() + interval '5 minutes', updated_at = now(),
      migration_token = null, migration_until = null
    where owner_uid = p_owner_uid and id = p_id returning * into v_row;
  return to_jsonb(v_row);
end;
$$;
revoke all on function public.claim_lifemate_memory_revocation(text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.claim_lifemate_memory_revocation(text,text,uuid)
  to service_role;

create or replace function public.tombstone_lifemate_shared_memory(p_owner_uid text, p_id text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.lifemate_shared_memories;
  v_marker public.lifemate_memory_deletions;
begin
  perform pg_advisory_xact_lock(hashtextextended('lifemate-memory:' || p_owner_uid, 0));
  select * into v_row from public.lifemate_shared_memories
    where owner_uid = p_owner_uid and id = p_id for update;
  if found and v_row.migration_until > clock_timestamp() then
    return '{"busy":true}'::jsonb;
  end if;
  delete from public.lifemate_shared_memories
    where owner_uid = p_owner_uid and id = p_id returning * into v_row;
  insert into public.lifemate_memory_deletions
    (owner_uid, id, photo_path, photo_backend, supabase_cleanup_pending)
    values (p_owner_uid, p_id, v_row.photo_path, v_row.photo_backend,
      coalesce(v_row.supabase_cleanup_pending, false))
    on conflict (owner_uid, id) do nothing;
  select * into v_marker from public.lifemate_memory_deletions
    where owner_uid = p_owner_uid and id = p_id;
  return to_jsonb(v_marker);
end;
$$;
revoke all on function public.tombstone_lifemate_shared_memory(text,text)
  from public, anon, authenticated;
grant execute on function public.tombstone_lifemate_shared_memory(text,text)
  to service_role;
