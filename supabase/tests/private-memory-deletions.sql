-- Execute inside a transaction; fixtures and schema changes must be rolled back.
do $$
declare
  v_uid text := 'sync_regression_' || replace(gen_random_uuid()::text, '-', '');
  v_memory jsonb;
  v_marker jsonb;
begin
  if has_table_privilege('anon', 'public.lifemate_memory_deletions', 'SELECT')
    or has_table_privilege('authenticated', 'public.lifemate_memory_deletions', 'INSERT')
    or has_function_privilege('anon', 'public.tombstone_lifemate_shared_memory(text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.reserve_lifemate_shared_memory(jsonb)', 'EXECUTE') then
    raise exception 'Client must not access deletion markers/RPCs';
  end if;
  insert into public.lifemate_memory_profiles(uid,email,display_name)
    values(v_uid, v_uid || '@example.invalid', 'Regression fixture');
  v_memory := jsonb_build_object('owner_uid',v_uid,'id','reserved-first',
    'date_key','2026-10-16','body','Fixture','status','pending',
    'photo_path','shared/' || v_uid || '/reserved-first/photo.jpg',
    'photo_backend','r2','photo_size_bytes',10,'supabase_cleanup_pending',true);
  if public.reserve_lifemate_shared_memory(v_memory) <> 'saved' then raise exception 'Reserve failed'; end if;
  v_marker := public.tombstone_lifemate_shared_memory(v_uid,'reserved-first');
  if v_marker->>'photo_path' is null or (v_marker->>'supabase_cleanup_pending')::boolean <> true
    then raise exception 'Cleanup pointers missing'; end if;
  if public.tombstone_lifemate_shared_memory(v_uid,'reserved-first') <> v_marker
    then raise exception 'Retry lost cleanup pointers'; end if;
  if exists(select 1 from public.lifemate_shared_memories where owner_uid=v_uid)
    then raise exception 'Deleted memory still visible'; end if;
  if public.reserve_lifemate_shared_memory(v_memory) <> 'memory-deleted'
    then raise exception 'Deleted memory republished'; end if;
  perform public.tombstone_lifemate_shared_memory(v_uid,'deleted-first');
  if public.reserve_lifemate_shared_memory(v_memory || '{"id":"deleted-first"}') <> 'memory-deleted'
    then raise exception 'Late reserve bypassed tombstone'; end if;
  -- Deleting a never-shared private item must not need a verified-email profile.
  perform public.tombstone_lifemate_shared_memory(v_uid || '_private','never-shared');
end;
$$;
select 'private-memory deletion SQL regression passed' as result;

-- Revocation hides metadata, fences workers, and blocks quota reservation until
-- cleanup completes. Run after 202610190001, inside the rollback transaction.
do $$
declare
  v_uid text := 'revoke_regression_' || replace(gen_random_uuid()::text, '-', '');
  v_memory jsonb;
  v_claim jsonb;
  v_token uuid := gen_random_uuid();
  v_next_token uuid := gen_random_uuid();
begin
  if has_function_privilege('anon', 'public.claim_lifemate_memory_revocation(text,text,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.confirm_lifemate_shared_memory_photo(text,text,uuid)', 'EXECUTE') then
    raise exception 'Client must not execute revocation or confirmation RPCs';
  end if;
  insert into public.lifemate_memory_profiles(uid,email,display_name)
    values(v_uid, v_uid || '@example.invalid', 'Revocation fixture');
  v_memory := jsonb_build_object('owner_uid',v_uid,'id','memory',
    'date_key','2026-10-19','body','Fixture','status','pending',
    'photo_path','shared/' || v_uid || '/memory/photo.jpg',
    'photo_backend','r2','photo_size_bytes',10,'supabase_cleanup_pending',false);
  if public.reserve_lifemate_shared_memory(v_memory) <> 'saved' then raise exception 'Reserve failed'; end if;
  if public.reserve_lifemate_shared_memory(v_memory || '{"photo_path":null,"status":"active"}'::jsonb) <> 'memory-pending' then
    raise exception 'Text reservation discarded pending photo';
  end if;
  v_claim := public.claim_lifemate_memory_revocation(v_uid,'memory',v_token);
  if v_claim->>'status' <> 'revoking' or v_claim->>'photo_path' is null then
    raise exception 'Revocation did not retain cleanup pointers';
  end if;
  if public.reserve_lifemate_shared_memory(v_memory) <> 'memory-revoking' then
    raise exception 'Republish bypassed revocation';
  end if;
  if public.claim_lifemate_memory_revocation(v_uid,'memory',v_next_token) <> '{"busy":true}'::jsonb then
    raise exception 'Concurrent worker acquired live lease';
  end if;
  update public.lifemate_shared_memories set revoke_until = now() - interval '1 second'
    where owner_uid=v_uid and id='memory';
  v_claim := public.claim_lifemate_memory_revocation(v_uid,'memory',v_next_token);
  if v_claim->>'revoke_token' <> v_next_token::text then raise exception 'Expired lease not reclaimed'; end if;
  delete from public.lifemate_shared_memories where owner_uid=v_uid and id='memory' and revoke_token=v_token;
  if found then raise exception 'Obsolete worker deleted current row'; end if;
  delete from public.lifemate_shared_memories where owner_uid=v_uid and id='memory' and revoke_token=v_next_token;
  if public.claim_lifemate_memory_revocation(v_uid,'memory',v_token) <> '{"missing":true}'::jsonb then
    raise exception 'Removed memory not idempotent';
  end if;
  -- Text-only memories must also be revocable under the expanded constraint.
  v_memory := v_memory || '{"id":"text-only","photo_path":null,"photo_size_bytes":null,"status":"active"}'::jsonb;
  if public.reserve_lifemate_shared_memory(v_memory) <> 'saved' then raise exception 'Text reserve failed'; end if;
  v_claim := public.claim_lifemate_memory_revocation(v_uid,'text-only',v_token);
  if v_claim->>'status' <> 'revoking' then raise exception 'Text-only revocation failed'; end if;
end;
$$;
select 'memory revocation SQL regression passed' as result;

-- Run after 202610190002 in the same rollback transaction.
do $$
declare
  v_uid text := 'migration_regression_' || replace(gen_random_uuid()::text, '-', '');
  v_reservation uuid := gen_random_uuid();
  v_token uuid := gen_random_uuid();
  v_next uuid := gen_random_uuid();
  v_claim jsonb;
begin
  if has_function_privilege('anon', 'public.claim_lifemate_memory_migration(text,text,uuid,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.claim_lifemate_memory_migration(text,text,uuid,uuid)', 'EXECUTE') then
    raise exception 'Client can claim migration';
  end if;
  insert into public.lifemate_memory_profiles(uid,email,display_name)
    values(v_uid, v_uid || '@example.invalid', 'Migration fixture');
  insert into public.lifemate_shared_memories(owner_uid,id,date_key,body,status,photo_path,photo_backend,reservation_token)
    values(v_uid,'legacy','2026-10-19','Fixture','active','shared/' || v_uid || '/legacy/photo.jpg','supabase',v_reservation);
  if public.claim_lifemate_memory_migration(v_uid,'legacy',gen_random_uuid(),v_token) <> '{"missing":true}'::jsonb then
    raise exception 'Stale source snapshot acquired lease';
  end if;
  v_claim := public.claim_lifemate_memory_migration(v_uid,'legacy',v_reservation,v_token);
  if v_claim->>'status' <> 'active' or v_claim->>'migration_token' <> v_token::text then
    raise exception 'Migration must retain active feed while owning lease';
  end if;
  if public.claim_lifemate_memory_migration(v_uid,'legacy',v_reservation,v_next) <> '{"busy":true}'::jsonb
    or not (public.claim_lifemate_memory_revocation(v_uid,'legacy',v_next)->>'busy')::boolean
    or public.tombstone_lifemate_shared_memory(v_uid,'legacy') <> '{"busy":true}'::jsonb then
    raise exception 'Migration lease did not block competing mutation';
  end if;
  if exists(select 1 from public.lifemate_memory_deletions where owner_uid=v_uid) then
    raise exception 'Busy delete created a tombstone';
  end if;
  update public.lifemate_shared_memories set migration_until=now()-interval '1 second' where owner_uid=v_uid;
  v_claim := public.claim_lifemate_memory_migration(v_uid,'legacy',v_reservation,v_next);
  if v_claim->>'migration_token' <> v_next::text then raise exception 'Expired migration not reclaimed'; end if;
  update public.lifemate_shared_memories set photo_backend='r2', migration_token=null, migration_until=null
    where owner_uid=v_uid and migration_token=v_token;
  if found then raise exception 'Stale migration worker changed backend'; end if;
  update public.lifemate_shared_memories set migration_until=now()-interval '1 second' where owner_uid=v_uid;
  v_claim := public.claim_lifemate_memory_revocation(v_uid,'legacy',gen_random_uuid());
  if v_claim->>'status' <> 'revoking' or v_claim->>'migration_token' is not null then
    raise exception 'Revocation did not clear expired migration lease';
  end if;
end;
$$;
select 'memory migration SQL regression passed' as result;
