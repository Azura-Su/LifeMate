-- Only Edge Functions using service_role may address account administration.
create table public.lifemate_account_access (
  uid text primary key check (uid ~ '^[A-Za-z0-9_-]{1,128}$'),
  status text not null default 'active' check (status in ('active','disabled','deleting','deleted')),
  valid_since bigint not null default 0,
  email text,
  phase text not null default 'ready' check (phase in ('ready','blocking','sweeping','waiting','complete')),
  final_after timestamptz,
  next_run timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.lifemate_account_access enable row level security;
revoke all on public.lifemate_account_access from public, anon, authenticated;
grant all on public.lifemate_account_access to service_role;

create function public.claim_lifemate_account(p_uid text, p_lease uuid)
returns setof public.lifemate_account_access
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.lifemate_account_access(uid) values(p_uid) on conflict do nothing;
  return query update public.lifemate_account_access
    set lease_id=p_lease, lease_until=now()+interval '5 minutes'
    where uid=p_uid and (lease_until is null or lease_until<now()) returning *;
end;
$$;
revoke all on function public.claim_lifemate_account(text,uuid) from public, anon, authenticated;
grant execute on function public.claim_lifemate_account(text,uuid) to service_role;

-- The Vault secret is installed separately, never committed to source.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('lifemate-user-cleanup', '* * * * *', $$
  select net.http_post(
    url := 'https://xbhelntqytleiduzicuj.supabase.co/functions/v1/user-admin',
    headers := jsonb_build_object('Content-Type','application/json','Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='lifemate_user_cleanup_secret')),
    body := '{"action":"sweep"}'::jsonb,
    timeout_milliseconds := 50000
  ) where exists(select 1 from public.lifemate_account_access
    where next_run<=now() and (lease_until is null or lease_until<now())
      and (status in ('deleting','deleted') or phase='blocking'));
$$);
