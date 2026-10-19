-- Reserve a memory and its quota slot in one transaction. Only the trusted
-- Edge Function can call this; Firebase identities are verified there.
create or replace function public.reserve_lifemate_shared_memory(p_memory jsonb)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.lifemate_shared_memories;
  v_status text;
begin
  v_row := jsonb_populate_record(null::public.lifemate_shared_memories, p_memory);
  if v_row.owner_uid is null or v_row.id is null then
    raise exception 'Missing memory owner or ID';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('lifemate-memory:' || v_row.owner_uid, 0));
  select status into v_status from public.lifemate_shared_memories
    where owner_uid = v_row.owner_uid and id = v_row.id for update;
  if found then
    if v_status = 'active' then return 'already-shared'; end if;
    update public.lifemate_shared_memories set
      date_key = v_row.date_key, body = v_row.body,
      photo_path = v_row.photo_path, photo_backend = v_row.photo_backend,
      photo_size_bytes = v_row.photo_size_bytes,
      supabase_cleanup_pending = v_row.supabase_cleanup_pending,
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
