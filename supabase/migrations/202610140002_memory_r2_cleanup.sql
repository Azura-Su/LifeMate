-- Keep a durable reminder until a copied legacy object is removed from
-- Supabase Storage. A failed delete must not orphan the old photo.
alter table public.lifemate_shared_memories
  add column if not exists supabase_cleanup_pending boolean not null default false;

alter table public.lifemate_shared_memories
  add constraint lifemate_memory_cleanup_requires_r2
    check (not supabase_cleanup_pending or photo_backend = 'r2');

-- The first R2 rollout could have left an old Supabase object after a failed
-- delete. Recheck every R2 photo once; deleting a missing object is safe.
update public.lifemate_shared_memories
  set supabase_cleanup_pending = true
  where photo_backend = 'r2' and photo_path is not null;
