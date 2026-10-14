-- Existing photos keep their Supabase object until each one has been copied
-- and verified in R2. New photos use R2 after the function is deployed.
alter table public.lifemate_shared_memories
  add column if not exists photo_backend text not null default 'supabase'
    check (photo_backend in ('supabase', 'r2')),
  add column if not exists photo_size_bytes integer
    check (photo_size_bytes between 1 and 2097152);

create or replace function public.confirm_lifemate_shared_memory_photo(
  p_owner_uid text, p_id text
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
      and status = 'pending' and photo_backend = 'supabase';
  return found;
end;
$$;
revoke all on function public.confirm_lifemate_shared_memory_photo(text, text)
  from public, anon, authenticated;
grant execute on function public.confirm_lifemate_shared_memory_photo(text, text)
  to service_role;
