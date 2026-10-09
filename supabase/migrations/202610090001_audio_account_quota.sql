-- Reserve per-user audio capacity before issuing a signed upload URL. Existing
-- objects are included in every check, so the first upload after this migration
-- accounts for audio already stored in the private bucket.
create table if not exists public.lifemate_audio_upload_reservations (
  owner_uid text not null,
  object_path text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  expires_at timestamptz not null,
  primary key (owner_uid, object_path)
);

alter table public.lifemate_audio_upload_reservations enable row level security;
revoke all on table public.lifemate_audio_upload_reservations from public, anon, authenticated;
grant all on table public.lifemate_audio_upload_reservations to service_role;

create or replace function public.reserve_lifemate_audio_upload(
  p_owner_uid text,
  p_object_path text,
  p_size_bytes bigint
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_prefix text;
  v_track_id text;
  v_file_name text;
  v_used_bytes bigint;
  v_track_count bigint;
  v_track_already_counted boolean;
begin
  if p_owner_uid is null or p_owner_uid !~ '^[A-Za-z0-9_-]{1,128}$'
    or p_size_bytes is null or p_size_bytes < 1 or p_size_bytes > 52428800
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
  delete from public.lifemate_audio_upload_reservations
    where owner_uid = p_owner_uid and expires_at <= now();

  with actual_objects as (
    select o.name as object_path,
      case
        when o.metadata ->> 'size' ~ '^[0-9]+$'
          then (o.metadata ->> 'size')::bigint
        else 0::bigint
      end as size_bytes
    from storage.objects o
    where o.bucket_id = 'lifemate-audio'
      and left(o.name, length(v_prefix)) = v_prefix
  ), reservations as (
    select r.object_path, r.size_bytes
    from public.lifemate_audio_upload_reservations r
    where r.owner_uid = p_owner_uid and r.expires_at > now()
  ), quota_objects as (
    select o.object_path,
      greatest(o.size_bytes, coalesce(r.size_bytes, 0)) as size_bytes
    from actual_objects o
    left join reservations r using (object_path)
    union all
    select r.object_path, r.size_bytes
    from reservations r
    where not exists (
      select 1 from actual_objects o where o.object_path = r.object_path
    )
  )
  select coalesce(sum(q.size_bytes), 0),
    count(distinct split_part(q.object_path, '/', 3)),
    coalesce(bool_or(split_part(q.object_path, '/', 3) = v_track_id), false)
  into v_used_bytes, v_track_count, v_track_already_counted
  from quota_objects q
  where q.object_path <> p_object_path;

  if v_used_bytes + p_size_bytes > 1073741824
    or (v_track_count + case when v_track_already_counted then 0 else 1 end) > 200 then
    return false;
  end if;

  insert into public.lifemate_audio_upload_reservations
    (owner_uid, object_path, size_bytes, expires_at)
  values (p_owner_uid, p_object_path, p_size_bytes, now() + interval '24 hours')
  on conflict (owner_uid, object_path) do update
    set size_bytes = excluded.size_bytes, expires_at = excluded.expires_at;
  return true;
end;
$$;

create or replace function public.release_lifemate_audio_upload(
  p_owner_uid text,
  p_object_path text
) returns void
language sql
security definer
set search_path = pg_catalog
as $$
  delete from public.lifemate_audio_upload_reservations
  where owner_uid = p_owner_uid and object_path = p_object_path;
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
    set size_bytes = excluded.size_bytes, expires_at = excluded.expires_at;
  return true;
end;
$$;

revoke all on function public.reserve_lifemate_audio_upload(text, text, bigint) from public, anon, authenticated;
revoke all on function public.release_lifemate_audio_upload(text, text) from public, anon, authenticated;
revoke all on function public.confirm_lifemate_audio_upload(text, text) from public, anon, authenticated;
grant execute on function public.reserve_lifemate_audio_upload(text, text, bigint) to service_role;
grant execute on function public.release_lifemate_audio_upload(text, text) to service_role;
grant execute on function public.confirm_lifemate_audio_upload(text, text) to service_role;
