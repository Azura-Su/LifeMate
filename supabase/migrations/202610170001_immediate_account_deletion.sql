-- Keep login deletion separate from retryable data cleanup, without a grace wait.
alter table public.lifemate_account_access
  add column deletion_requested_at timestamptz,
  add column auth_deleted_at timestamptz;
-- Old jobs stored request time + 8 days in final_after. Preserve that cutoff.
update public.lifemate_account_access set
  deletion_requested_at = coalesce(final_after - interval '8 days', updated_at),
  final_after = null,
  next_run = now()
  where status in ('deleting','deleted');
