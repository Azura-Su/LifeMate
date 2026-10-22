-- Signed upload URLs remain valid after DELETE or confirm, and permit upsert.
-- Keep the existing conservative 24-hour maximum-size hold until it expires.
-- Actual storage usage is always counted by reserve_lifemate_audio_upload.
create or replace function public.release_lifemate_audio_upload(
  p_owner_uid text,
  p_object_path text
) returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner_uid, 0));
  delete from public.lifemate_audio_upload_reservations
    where owner_uid = p_owner_uid and object_path = p_object_path
      and expires_at <= now();
end;
$$;

create or replace function public.confirm_lifemate_audio_upload(
  p_owner_uid text,
  p_object_path text
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_prefix text;
  v_track_id text;
  v_file_name text;
  v_size_bytes bigint;
begin
  if p_owner_uid is null or p_owner_uid !~ '^[A-Za-z0-9_-]{1,128}$'
    or p_object_path is null then
    return false;
  end if;

  v_prefix := 'audio/' || p_owner_uid || '/';
  v_track_id := split_part(p_object_path, '/', 3);
  v_file_name := split_part(p_object_path, '/', 4);
  if left(p_object_path, length(v_prefix)) <> v_prefix
    or p_object_path <> (v_prefix || v_track_id || '/' || v_file_name)
    or v_track_id !~ '^[A-Za-z0-9_-]{1,128}$'
    or v_file_name !~ ('^' || v_track_id || '\.(mp3|m4a|aac|wav|flac|ogg|opus|aif|aiff|caf)$') then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner_uid, 0));
  select case
    when o.metadata ->> 'size' ~ '^[0-9]+$'
      then (o.metadata ->> 'size')::bigint
    else 0::bigint
  end
  into v_size_bytes
  from storage.objects o
  where o.bucket_id = 'lifemate-audio' and o.name = p_object_path;

  if not found or v_size_bytes < 1 or v_size_bytes > 52428800 then
    return false;
  end if;

  insert into public.lifemate_audio_upload_reservations
    (owner_uid, object_path, size_bytes, expires_at)
  values (p_owner_uid, p_object_path, v_size_bytes, now() + interval '24 hours')
  on conflict (owner_uid, object_path) do update
    set size_bytes = case
      when lifemate_audio_upload_reservations.expires_at > now()
        then greatest(lifemate_audio_upload_reservations.size_bytes, excluded.size_bytes)
      else excluded.size_bytes
    end,
    expires_at = greatest(lifemate_audio_upload_reservations.expires_at, excluded.expires_at);
  return true;
end;
$$;

revoke all on function public.release_lifemate_audio_upload(text, text) from public, anon, authenticated;
revoke all on function public.confirm_lifemate_audio_upload(text, text) from public, anon, authenticated;
grant execute on function public.release_lifemate_audio_upload(text, text) to service_role;
grant execute on function public.confirm_lifemate_audio_upload(text, text) to service_role;
