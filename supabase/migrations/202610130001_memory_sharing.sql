-- Firebase-authenticated social memories. Only the memory-access Edge Function
-- uses the service role; Firebase clients never address these tables directly.
create table if not exists public.lifemate_memory_profiles (
  uid text primary key check (uid ~ '^[A-Za-z0-9_-]{1,128}$'),
  email text not null unique check (char_length(email) between 3 and 254 and email = lower(email)),
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table if not exists public.lifemate_memory_friend_requests (
  requester_uid text not null references public.lifemate_memory_profiles(uid) on delete cascade,
  target_uid text not null references public.lifemate_memory_profiles(uid) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (requester_uid, target_uid),
  check (requester_uid <> target_uid)
);
create index if not exists lifemate_memory_requests_target_idx
  on public.lifemate_memory_friend_requests (target_uid, created_at desc);

-- A recipient may not have opened Memories yet. Claim these by verified email
-- when their Firebase identity first registers its memory profile.
create table if not exists public.lifemate_memory_email_invites (
  requester_uid text not null references public.lifemate_memory_profiles(uid) on delete cascade,
  target_email text not null check (char_length(target_email) between 3 and 254 and target_email = lower(target_email)),
  created_at timestamptz not null default now(),
  primary key (requester_uid, target_email)
);
create index if not exists lifemate_memory_email_invites_target_idx
  on public.lifemate_memory_email_invites (target_email, created_at desc);

create table if not exists public.lifemate_memory_invite_attempts (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,128}$'),
  uid text not null references public.lifemate_memory_profiles(uid) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists lifemate_memory_invites_recent_idx
  on public.lifemate_memory_invite_attempts (uid, created_at desc);

create table if not exists public.lifemate_memory_friendships (
  left_uid text not null references public.lifemate_memory_profiles(uid) on delete cascade,
  right_uid text not null references public.lifemate_memory_profiles(uid) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (left_uid, right_uid),
  check (left_uid < right_uid)
);
create index if not exists lifemate_memory_friends_right_idx
  on public.lifemate_memory_friendships (right_uid);

create table if not exists public.lifemate_shared_memories (
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,128}$'),
  owner_uid text not null references public.lifemate_memory_profiles(uid) on delete cascade,
  date_key text not null check (date_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  body text not null check (char_length(body) <= 2000),
  photo_path text,
  status text not null check (status in ('pending', 'active')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_uid, id),
  check (char_length(trim(body)) > 0 or photo_path is not null),
  check (photo_path is null or photo_path = 'shared/' || owner_uid || '/' || id || '/photo.jpg'),
  check (photo_path is not null or status = 'active')
);
create index if not exists lifemate_shared_memories_feed_idx
  on public.lifemate_shared_memories (owner_uid, status, date_key desc);

alter table public.lifemate_memory_profiles enable row level security;
alter table public.lifemate_memory_friend_requests enable row level security;
alter table public.lifemate_memory_email_invites enable row level security;
alter table public.lifemate_memory_invite_attempts enable row level security;
alter table public.lifemate_memory_friendships enable row level security;
alter table public.lifemate_shared_memories enable row level security;
revoke all on public.lifemate_memory_profiles from public, anon, authenticated;
revoke all on public.lifemate_memory_friend_requests from public, anon, authenticated;
revoke all on public.lifemate_memory_email_invites from public, anon, authenticated;
revoke all on public.lifemate_memory_invite_attempts from public, anon, authenticated;
revoke all on public.lifemate_memory_friendships from public, anon, authenticated;
revoke all on public.lifemate_shared_memories from public, anon, authenticated;
grant all on public.lifemate_memory_profiles to service_role;
grant all on public.lifemate_memory_friend_requests to service_role;
grant all on public.lifemate_memory_email_invites to service_role;
grant all on public.lifemate_memory_invite_attempts to service_role;
grant all on public.lifemate_memory_friendships to service_role;
grant all on public.lifemate_shared_memories to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lifemate-memories', 'lifemate-memories', false, 2097152,
  array['image/jpeg'])
on conflict (id) do nothing;
-- No storage.objects policy: only the function can sign URLs through service_role.

create or replace function public.accept_lifemate_memory_friend_request(
  p_target_uid text, p_requester_uid text
) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.lifemate_memory_friend_requests
    where requester_uid = p_requester_uid and target_uid = p_target_uid
  ) then
    return false;
  end if;
  if (
    select count(*) from public.lifemate_memory_friendships
    where left_uid = p_target_uid or right_uid = p_target_uid
  ) >= 100 or (
    select count(*) from public.lifemate_memory_friendships
    where left_uid = p_requester_uid or right_uid = p_requester_uid
  ) >= 100 then
    return false;
  end if;
  insert into public.lifemate_memory_friendships (left_uid, right_uid)
    values (least(p_target_uid, p_requester_uid), greatest(p_target_uid, p_requester_uid))
    on conflict do nothing;
  delete from public.lifemate_memory_friend_requests
    where requester_uid = p_requester_uid and target_uid = p_target_uid;
  delete from public.lifemate_memory_friend_requests
    where requester_uid = p_target_uid and target_uid = p_requester_uid;
  return true;
end;
$$;
revoke all on function public.accept_lifemate_memory_friend_request(text, text)
  from public, anon, authenticated;
grant execute on function public.accept_lifemate_memory_friend_request(text, text)
  to service_role;

create or replace function public.claim_lifemate_memory_email_invites(
  p_uid text, p_email text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_requester text;
  v_slots integer;
begin
  if not exists (
    select 1 from public.lifemate_memory_profiles
    where uid = p_uid and email = p_email
  ) then
    return;
  end if;
  select greatest(0, 20 - count(*)) into v_slots
    from public.lifemate_memory_friend_requests where target_uid = p_uid;
  for v_requester in
    select requester_uid from public.lifemate_memory_email_invites
    where target_email = p_email and requester_uid <> p_uid
    order by created_at asc limit v_slots
    for update skip locked
  loop
    insert into public.lifemate_memory_friend_requests (requester_uid, target_uid)
      values (v_requester, p_uid) on conflict do nothing;
  end loop;
  delete from public.lifemate_memory_email_invites
    where target_email = p_email;
end;
$$;
revoke all on function public.claim_lifemate_memory_email_invites(text, text)
  from public, anon, authenticated;
grant execute on function public.claim_lifemate_memory_email_invites(text, text)
  to service_role;

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
    where owner_uid = p_owner_uid and id = p_id and status = 'pending';
  return found;
end;
$$;
revoke all on function public.confirm_lifemate_shared_memory_photo(text, text)
  from public, anon, authenticated;
grant execute on function public.confirm_lifemate_shared_memory_photo(text, text)
  to service_role;
