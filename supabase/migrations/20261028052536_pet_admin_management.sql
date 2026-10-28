-- Admin ownership management. All entry points remain private to Edge Functions.
alter table public.lifemate_pet_accounts add column revoked_at timestamptz;
alter table public.lifemate_pet_receipts add column invalidated boolean not null default false;
create table public.lifemate_pet_admin_revocations (
  actor_uid text not null,
  action_id uuid not null,
  target_uid text not null references public.lifemate_pet_accounts(uid) on delete cascade,
  species_id text not null references public.lifemate_pet_species(id),
  adoption_id uuid not null,
  total_exp integer not null,
  revoked_at timestamptz not null default now(),
  primary key(actor_uid,action_id)
);
alter table public.lifemate_pet_admin_revocations enable row level security;
revoke all on public.lifemate_pet_admin_revocations from public,anon,authenticated;
grant all on public.lifemate_pet_admin_revocations to service_role;

-- Keep the existing command implementation owner-only. The public signature is
-- unchanged; replayed pre-revocation receipts return canonical current state.
alter function public.lifemate_pet_command(text,bigint,uuid,text,text,jsonb,jsonb)
  rename to lifemate_pet_command_before_admin;
revoke all on function public.lifemate_pet_command_before_admin(text,bigint,uuid,text,text,jsonb,jsonb)
  from public,anon,authenticated,service_role;
create function public.lifemate_pet_command(p_uid text,p_auth_time bigint,p_action_id uuid,
  p_fingerprint text,p_command text,p_args jsonb,p_rules jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_acc public.lifemate_pet_accounts; v_receipt public.lifemate_pet_receipts;
begin
  v_acc:=public.lifemate_pet_lock(p_uid,p_auth_time);
  select * into v_receipt from public.lifemate_pet_receipts where uid=p_uid and action_id=p_action_id;
  if found then
    if v_receipt.fingerprint<>p_fingerprint then raise exception 'idempotency-conflict'; end if;
    if v_receipt.invalidated then return public.lifemate_pet_state(p_uid); end if;
    return v_receipt.ack;
  end if;
  if v_acc.revoked_at is not null then
    if p_command='restore' then raise exception 'no-restores'; end if;
    -- Failure rolls this back, so an exhausted/failed roll cannot unlock restore.
    if p_command='roll' then
      update public.lifemate_pet_accounts set revoked_at=null where uid=p_uid;
    end if;
  end if;
  return public.lifemate_pet_command_before_admin(p_uid,p_auth_time,p_action_id,p_fingerprint,p_command,p_args,p_rules);
end $$;

-- Preserve old Edge callers, but fence reads begun before a replacement adoption.
alter function public.lifemate_pet_reconcile(text,bigint,bigint,date[],jsonb,integer,integer)
  rename to lifemate_pet_reconcile_before_admin;
revoke all on function public.lifemate_pet_reconcile_before_admin(text,bigint,bigint,date[],jsonb,integer,integer)
  from public,anon,authenticated,service_role;
create function public.lifemate_pet_reconcile(p_uid text,p_auth_time bigint,p_read_ms bigint,
  p_days date[],p_rules jsonb,p_grace_days integer,p_weekly_days integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_pet public.lifemate_pet_adoptions;
begin
  perform public.lifemate_pet_lock(p_uid,p_auth_time);
  select * into v_pet from public.lifemate_pet_adoptions where uid=p_uid;
  if v_pet.uid is not null and p_read_ms<ceil(extract(epoch from v_pet.adopted_at)*1000) then
    raise exception 'stale-snapshot';
  end if;
  return public.lifemate_pet_reconcile_before_admin(p_uid,p_auth_time,p_read_ms,p_days,p_rules,p_grace_days,p_weekly_days);
end $$;
create function public.lifemate_pet_reconcile_current(p_uid text,p_auth_time bigint,p_adoption_id uuid,
  p_read_ms bigint,p_days date[],p_rules jsonb,p_grace_days integer,p_weekly_days integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform public.lifemate_pet_lock(p_uid,p_auth_time);
  select adoption_id into v_id from public.lifemate_pet_adoptions where uid=p_uid;
  if v_id is distinct from p_adoption_id then raise exception 'stale-snapshot'; end if;
  return public.lifemate_pet_reconcile(p_uid,p_auth_time,p_read_ms,p_days,p_rules,p_grace_days,p_weekly_days);
end $$;

create function public.lifemate_pet_admin_list(p_admin_uid text,p_auth_time bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_admin_uid is distinct from 'CQmmT9iJvKPP79UZqYbvmZ3gXZQ2' then raise exception 'admin-required'; end if;
  perform public.lifemate_game_assert_account(p_admin_uid,p_auth_time);
  perform public.lifemate_game_limit('pet-admin-list:'||p_admin_uid,60);
  return jsonb_build_object('pets',(
    select jsonb_agg(jsonb_build_object(
      'speciesId',s.id,
      'status',case when a.uid is not null then 'owned' when s.reserved_until>now() then 'reserved' else 'available' end,
      'holderUid',coalesce(a.uid,case when s.reserved_until>now() then s.reserved_by end),
      'reservedUntil',case when s.reserved_until>now() then floor(extract(epoch from s.reserved_until)*1000) end,
      'adoption',case when a.uid is null then null else jsonb_build_object(
        'id',a.adoption_id,'adoptedAt',floor(extract(epoch from a.adopted_at)*1000),'totalExp',a.total_exp) end
    ) order by s.sort) from public.lifemate_pet_species s left join public.lifemate_pet_adoptions a on a.species_id=s.id
  ),'serverTime',floor(extract(epoch from now())*1000));
end $$;

create function public.lifemate_pet_admin_revoke(p_admin_uid text,p_auth_time bigint,p_action_id uuid,
  p_target_uid text,p_species_id text,p_adoption_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_old public.lifemate_pet_admin_revocations; v_pet public.lifemate_pet_adoptions; v_status text;
begin
  if p_admin_uid is distinct from 'CQmmT9iJvKPP79UZqYbvmZ3gXZQ2' then raise exception 'admin-required'; end if;
  perform public.lifemate_game_assert_account(p_admin_uid,p_auth_time);
  if p_action_id is null or p_adoption_id is null or p_target_uid is null or p_species_id is null then
    raise exception 'invalid-input'; end if;
  -- Serialize action IDs even if a malformed retry targets a different owner.
  perform pg_advisory_xact_lock(hashtextextended('pet-admin:'||p_admin_uid||':'||p_action_id,0));
  select * into v_old from public.lifemate_pet_admin_revocations where actor_uid=p_admin_uid and action_id=p_action_id;
  if found then
    if v_old.target_uid<>p_target_uid or v_old.species_id<>p_species_id or v_old.adoption_id<>p_adoption_id then
      raise exception 'idempotency-conflict'; end if;
    return jsonb_build_object('ok',true);
  end if;
  perform public.lifemate_game_limit('pet-admin-revoke:'||p_admin_uid,30);
  -- Same order as commands/erasure: access -> pet account -> adoption/species.
  select status into v_status from public.lifemate_account_access where uid=p_target_uid for share;
  if v_status is null or v_status not in ('active','disabled') then raise exception 'account-busy'; end if;
  perform 1 from public.lifemate_pet_accounts where uid=p_target_uid for update;
  select * into v_pet from public.lifemate_pet_adoptions where uid=p_target_uid;
  if v_pet.adoption_id is distinct from p_adoption_id or v_pet.species_id is distinct from p_species_id then
    raise exception 'pet-changed'; end if;
  update public.lifemate_pet_species set owner_uid=null where id=p_species_id and owner_uid=p_target_uid;
  if not found then raise exception 'pet-changed'; end if;
  delete from public.lifemate_pet_adoptions where uid=p_target_uid and adoption_id=p_adoption_id;
  update public.lifemate_pet_accounts set revoked_at=now(),last_species=null,
    last_read_ms=greatest(last_read_ms,ceil(extract(epoch from now())*1000)::bigint) where uid=p_target_uid;
  update public.lifemate_pet_receipts set invalidated=true where uid=p_target_uid;
  insert into public.lifemate_pet_admin_revocations(actor_uid,action_id,target_uid,species_id,adoption_id,total_exp)
    values(p_admin_uid,p_action_id,p_target_uid,p_species_id,p_adoption_id,v_pet.total_exp);
  return jsonb_build_object('ok',true);
end $$;

do $$ declare v_fn text; begin
  foreach v_fn in array array[
    'lifemate_pet_command(text,bigint,uuid,text,text,jsonb,jsonb)',
    'lifemate_pet_reconcile(text,bigint,bigint,date[],jsonb,integer,integer)',
    'lifemate_pet_reconcile_current(text,bigint,uuid,bigint,date[],jsonb,integer,integer)',
    'lifemate_pet_admin_list(text,bigint)','lifemate_pet_admin_revoke(text,bigint,uuid,text,text,uuid)'] loop
    execute format('revoke all on function public.%s from public,anon,authenticated',v_fn);
    execute format('grant execute on function public.%s to service_role',v_fn);
  end loop;
end $$;

create or replace function public.lifemate_pet_state(p_uid text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_acc public.lifemate_pet_accounts; v_pet public.lifemate_pet_adoptions;
  v_res public.lifemate_pet_species; v_owned integer; v_reserved integer;
begin
  select * into v_acc from public.lifemate_pet_accounts where uid=p_uid;
  select * into v_pet from public.lifemate_pet_adoptions where uid=p_uid;
  select * into v_res from public.lifemate_pet_species where reserved_by=p_uid and reserved_until>now();
  select count(*) filter(where owner_uid is not null),
         count(*) filter(where owner_uid is null and reserved_until>now())
    into v_owned,v_reserved from public.lifemate_pet_species;
  return jsonb_build_object(
    'status',case when v_pet.uid is not null then 'owned' when v_res.id is not null then 'reserved' else 'none' end,
    'rollsLeft',3-coalesce(v_acc.rolls_used,0),
    'restoresLeft',case when v_acc.revoked_at is not null then 0 else 3-coalesce(v_acc.restores_used,0) end,
    'reservation',case when v_res.id is null or v_pet.uid is not null then null else jsonb_build_object(
      'id',v_res.reservation_id,'speciesId',v_res.id,
      'expiresAt',floor(extract(epoch from v_res.reserved_until)*1000)) end,
    'pet',case when v_pet.uid is null then null else jsonb_build_object(
      'speciesId',v_pet.species_id,'adoptionId',v_pet.adoption_id,
      'adoptedAt',floor(extract(epoch from v_pet.adopted_at)*1000),
      'totalExp',v_pet.total_exp,
      'caredToday',exists(select 1 from public.lifemate_pet_exp_grants g where g.adoption_id=v_pet.adoption_id
        and g.source_type='care_day' and g.period_key=public.lifemate_pet_today()::text and g.amount>0)) end,
    'availability',jsonb_build_object('total',15,'owned',v_owned,'reserved',v_reserved),
    'now',floor(extract(epoch from now())*1000));
end $$;

