-- Pixel Pet: exactly 15 unique mythical pets. Private authoritative state; only
-- service_role (pet-access / user-admin Edge Functions) calls these RPCs.
create table public.lifemate_pet_species (
  id text primary key check(id ~ '^[a-z0-9_]{1,40}$'),
  sort smallint not null unique,
  owner_uid text unique,
  reserved_by text unique,
  reservation_id uuid,
  reserved_until timestamptz,
  check(owner_uid is null or reserved_by is null),
  check((reserved_by is null)=(reservation_id is null) and (reserved_by is null)=(reserved_until is null))
);
insert into public.lifemate_pet_species(id,sort) values
  ('nine_tail_fox',1),('qilin',2),('alicorn',3),('rune_wolf',4),('black_tortoise',5),
  ('sphinx',6),('centaur',7),('white_tiger',8),('azure_dragon',9),('koi_dragon',10),
  ('scylla',11),('lac_bird',12),('phoenix',13),('anubis',14),('garuda',15);
-- The catalog is closed: no 16th pet can ever be inserted.
create function public.lifemate_pet_species_closed() returns trigger language plpgsql as $$
begin raise exception 'pet-catalog-closed'; end $$;
create trigger lifemate_pet_species_closed before insert or delete on public.lifemate_pet_species
  for each statement execute function public.lifemate_pet_species_closed();

create table public.lifemate_pet_accounts (
  uid text primary key check(uid ~ '^[A-Za-z0-9_-]{1,128}$'),
  rolls_used smallint not null default 0 check(rolls_used between 0 and 3),
  restores_used smallint not null default 0 check(restores_used between 0 and 3),
  last_species text references public.lifemate_pet_species(id),
  last_read_ms bigint not null default 0
);
create table public.lifemate_pet_adoptions (
  uid text primary key references public.lifemate_pet_accounts(uid) on delete cascade,
  adoption_id uuid not null unique,
  species_id text not null unique references public.lifemate_pet_species(id),
  adopted_at timestamptz not null default now(),
  adopted_day date not null,
  total_exp integer not null default 0 check(total_exp>=0)
);
-- A recorded day becomes EXP-eligible only when first seen while recent; this
-- blocks farming by backdating client-written transaction timestamps.
create table public.lifemate_pet_day_claims (
  adoption_id uuid not null references public.lifemate_pet_adoptions(adoption_id) on delete cascade,
  day date not null,
  primary key(adoption_id,day)
);
create table public.lifemate_pet_exp_grants (
  adoption_id uuid not null references public.lifemate_pet_adoptions(adoption_id) on delete cascade,
  source_type text not null,
  period_key text not null,
  amount integer not null check(amount>=0),
  revision integer not null check(revision>0),
  primary key(adoption_id,source_type,period_key)
);
-- Append-only: rows are never updated; they are only removed with the account.
create table public.lifemate_pet_exp_ledger (
  id bigint generated always as identity primary key,
  owner_uid text not null,
  pet_id text not null,
  adoption_id uuid not null,
  source_type text not null,
  source_id text not null,
  period_key text not null,
  exp_delta integer not null check(exp_delta<>0),
  reason text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index lifemate_pet_ledger_owner on public.lifemate_pet_exp_ledger(owner_uid);
create table public.lifemate_pet_receipts (
  uid text not null references public.lifemate_pet_accounts(uid) on delete cascade,
  action_id uuid not null,
  fingerprint text not null,
  ack jsonb not null,
  created_at timestamptz not null default now(),
  primary key(uid,action_id)
);

do $$ declare v_name text; begin
  foreach v_name in array array['species','accounts','adoptions','day_claims','exp_grants','exp_ledger','receipts'] loop
    execute format('alter table public.lifemate_pet_%I enable row level security',v_name);
    execute format('revoke all on public.lifemate_pet_%I from public,anon,authenticated',v_name);
    execute format('grant all on public.lifemate_pet_%I to service_role',v_name);
  end loop;
end $$;

create function public.lifemate_pet_today() returns date language sql stable as
  $$ select (now() at time zone 'Asia/Ho_Chi_Minh')::date $$;

create function public.lifemate_pet_state(p_uid text)
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
    'restoresLeft',3-coalesce(v_acc.restores_used,0),
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

-- Moves one grant to its recalculated target and logs only the difference.
create function public.lifemate_pet_set_grant(p_pet public.lifemate_pet_adoptions,
  p_source text,p_period text,p_target integer,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_grant public.lifemate_pet_exp_grants; v_delta integer; v_revision integer;
begin
  select * into v_grant from public.lifemate_pet_exp_grants
    where adoption_id=p_pet.adoption_id and source_type=p_source and period_key=p_period;
  v_delta:=p_target-coalesce(v_grant.amount,0);
  if v_delta=0 then return; end if;
  v_revision:=coalesce(v_grant.revision,0)+1;
  insert into public.lifemate_pet_exp_grants(adoption_id,source_type,period_key,amount,revision)
    values(p_pet.adoption_id,p_source,p_period,p_target,v_revision)
    on conflict(adoption_id,source_type,period_key) do update set amount=excluded.amount,revision=excluded.revision;
  insert into public.lifemate_pet_exp_ledger(owner_uid,pet_id,adoption_id,source_type,source_id,period_key,exp_delta,reason,idempotency_key)
    values(p_pet.uid,p_pet.species_id,p_pet.adoption_id,p_source,p_source||':'||p_period,p_period,v_delta,p_reason,
      p_pet.adoption_id||':'||p_source||':'||p_period||':'||v_revision);
  update public.lifemate_pet_adoptions set total_exp=total_exp+v_delta where uid=p_pet.uid;
end $$;

create function public.lifemate_pet_lock(p_uid text,p_auth_time bigint)
returns public.lifemate_pet_accounts language plpgsql security definer set search_path='' as $$
declare v_acc public.lifemate_pet_accounts;
begin
  -- Holds a share lock on account access until commit, so a deletion status
  -- change (and the later erase) is ordered after this transaction.
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  insert into public.lifemate_pet_accounts(uid) values(p_uid) on conflict do nothing;
  select * into strict v_acc from public.lifemate_pet_accounts where uid=p_uid for update;
  return v_acc;
end $$;

create function public.lifemate_pet_expire() returns void language sql security definer set search_path='' as $$
  update public.lifemate_pet_species set reserved_by=null,reservation_id=null,reserved_until=null
    where reserved_until<=now() $$;

-- Reserves a random free pet (never the excluded one). Returns false if none.
create function public.lifemate_pet_reserve(p_uid text,p_exclude text,p_prefer text)
returns text language plpgsql security definer set search_path='' as $$
declare v_id text; v_try integer;
begin
  for v_try in 1..6 loop
    select id into v_id from public.lifemate_pet_species
      where owner_uid is null and reserved_by is null and id is distinct from p_exclude
      order by (id=p_prefer) desc nulls last, random() limit 1;
    if not found then return null; end if;
    -- A concurrent winner makes this update match 0 rows; pick again.
    update public.lifemate_pet_species set reserved_by=p_uid,reservation_id=gen_random_uuid(),
      reserved_until=now()+interval '5 minutes'
      where id=v_id and owner_uid is null and reserved_by is null;
    if found then return v_id; end if;
  end loop;
  raise exception 'pet-busy';
end $$;

create function public.lifemate_pet_command(p_uid text,p_auth_time bigint,p_action_id uuid,
  p_fingerprint text,p_command text,p_args jsonb,p_rules jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_acc public.lifemate_pet_accounts; v_receipt public.lifemate_pet_receipts;
  v_pet public.lifemate_pet_adoptions; v_res public.lifemate_pet_species; v_id text; v_ack jsonb;
begin
  v_acc:=public.lifemate_pet_lock(p_uid,p_auth_time);
  select * into v_receipt from public.lifemate_pet_receipts where uid=p_uid and action_id=p_action_id;
  if found then
    if v_receipt.fingerprint<>p_fingerprint then raise exception 'idempotency-conflict'; end if;
    return v_receipt.ack;
  end if;
  perform public.lifemate_game_limit('pet:'||p_uid,30);
  select * into v_pet from public.lifemate_pet_adoptions where uid=p_uid;
  if p_command in ('roll','restore','confirm') and v_pet.uid is null then
    select * into v_res from public.lifemate_pet_species where reserved_by=p_uid;
    if p_command='confirm' then
      if v_res.id is null or v_res.reservation_id::text is distinct from p_args->>'reservationId' then
        raise exception 'reservation-missing'; end if;
      if v_res.reserved_until<=now() then raise exception 'reservation-expired'; end if;
      update public.lifemate_pet_species set reserved_by=null,reservation_id=null,reserved_until=null,owner_uid=p_uid
        where id=v_res.id;
      insert into public.lifemate_pet_adoptions(uid,adoption_id,species_id,adopted_day)
        values(p_uid,gen_random_uuid(),v_res.id,public.lifemate_pet_today());
    else
      perform public.lifemate_pet_expire();
      select * into v_res from public.lifemate_pet_species where reserved_by=p_uid;
      if (select count(*) from public.lifemate_pet_species where owner_uid is not null)>=15 then
        raise exception 'all-adopted'; end if;
      if p_command='roll' then
        if v_acc.rolls_used>=3 then raise exception 'no-rolls'; end if;
        update public.lifemate_pet_species set reserved_by=null,reservation_id=null,reserved_until=null
          where reserved_by=p_uid;
        v_id:=public.lifemate_pet_reserve(p_uid,v_res.id,null);
        -- Nothing could be reserved: roll back the release, keep the roll.
        if v_id is null then raise exception 'all-reserved'; end if;
        update public.lifemate_pet_accounts set rolls_used=rolls_used+1,last_species=v_id where uid=p_uid;
      else
        if v_res.id is not null then null;
        elsif v_acc.rolls_used<3 then raise exception 'rolls-remaining';
        elsif v_acc.restores_used>=3 then raise exception 'no-restores';
        else
          v_id:=public.lifemate_pet_reserve(p_uid,null,v_acc.last_species);
          if v_id is null then raise exception 'all-reserved'; end if;
          update public.lifemate_pet_accounts set restores_used=restores_used+1,last_species=v_id where uid=p_uid;
        end if;
      end if;
    end if;
  elsif p_command='care' then
    if v_pet.uid is null then raise exception 'no-pet'; end if;
    perform public.lifemate_pet_set_grant(v_pet,'care_day',public.lifemate_pet_today()::text,
      (p_rules->>'care_day')::integer,'care');
  elsif p_command not in ('roll','restore','confirm') then
    raise exception 'invalid-input';
  end if;
  v_ack:=public.lifemate_pet_state(p_uid);
  insert into public.lifemate_pet_receipts(uid,action_id,fingerprint,ack) values(p_uid,p_action_id,p_fingerprint,v_ack);
  return v_ack;
end $$;

create function public.lifemate_pet_read(p_uid text,p_auth_time bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  return public.lifemate_pet_state(p_uid);
end $$;

-- p_days: distinct recorded days from a server-side Firestore read started at
-- p_read_ms. Targets are recomputed from scratch; only differences are logged.
create function public.lifemate_pet_reconcile(p_uid text,p_auth_time bigint,p_read_ms bigint,
  p_days date[],p_rules jsonb,p_grace_days integer,p_weekly_days integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_acc public.lifemate_pet_accounts; v_pet public.lifemate_pet_adoptions;
  v_today date:=public.lifemate_pet_today(); v_row record;
begin
  v_acc:=public.lifemate_pet_lock(p_uid,p_auth_time);
  select * into v_pet from public.lifemate_pet_adoptions where uid=p_uid;
  if v_pet.uid is null then return public.lifemate_pet_state(p_uid); end if;
  if p_read_ms<v_acc.last_read_ms then raise exception 'stale-snapshot'; end if;
  perform public.lifemate_game_limit('pet-sync:'||p_uid,20);
  update public.lifemate_pet_accounts set last_read_ms=p_read_ms where uid=p_uid;
  insert into public.lifemate_pet_day_claims(adoption_id,day)
    select v_pet.adoption_id,d from unnest(p_days) d
    where d between greatest(v_pet.adopted_day,v_today-p_grace_days) and v_today
    on conflict do nothing;
  create temp table if not exists pg_temp.pet_targets(source text,period text,amount integer) on commit drop;
  truncate pg_temp.pet_targets;
  with eligible as (
    select distinct d from unnest(p_days) d
    join public.lifemate_pet_day_claims c on c.adoption_id=v_pet.adoption_id and c.day=d
    where d between v_pet.adopted_day and v_today
  ), runs as (
    select min(d) start_day,count(*) len from (
      select d,d-(row_number() over(order by d))::integer grp from eligible) x group by grp
  )
  insert into pg_temp.pet_targets
    select 'record_day',d::text,(p_rules->>'record_day')::integer from eligible
    union all select 'streak_3',start_day::text,(p_rules->>'streak_3')::integer from runs where len>=3
    union all select 'streak_7',start_day::text,(p_rules->>'streak_7')::integer from runs where len>=7
    union all select 'weekly_record',to_char(d,'IYYY-"W"IW'),(p_rules->>'weekly_record')::integer
      from eligible group by 2 having count(*)>=p_weekly_days;
  for v_row in
    select coalesce(t.source,g.source_type) source,coalesce(t.period,g.period_key) period,coalesce(t.amount,0) amount
    from pg_temp.pet_targets t
    full join (select * from public.lifemate_pet_exp_grants where adoption_id=v_pet.adoption_id
      and source_type in ('record_day','streak_3','streak_7','weekly_record')) g
      on g.source_type=t.source and g.period_key=t.period
    order by 1,2
  loop
    perform public.lifemate_pet_set_grant(v_pet,v_row.source,v_row.period,v_row.amount,'finance-sync');
  end loop;
  return public.lifemate_pet_state(p_uid);
end $$;

-- Idempotent revocation for completed account deletion (called by user-admin).
create function public.lifemate_pet_erase_account(p_uid text)
returns void language plpgsql security definer set search_path='' as $$
declare v_status text;
begin
  -- Waits for in-flight pet commands (they hold this row for share) and
  -- refuses to revoke a pet from an account that is still active.
  select status into v_status from public.lifemate_account_access where uid=p_uid for update;
  if coalesce(v_status,'active')='active' then raise exception 'account-active'; end if;
  update public.lifemate_pet_species set owner_uid=null where owner_uid=p_uid;
  update public.lifemate_pet_species set reserved_by=null,reservation_id=null,reserved_until=null where reserved_by=p_uid;
  delete from public.lifemate_pet_exp_ledger where owner_uid=p_uid;
  delete from public.lifemate_pet_accounts where uid=p_uid; -- cascades adoption, grants, claims, receipts
end $$;

do $$ declare v_fn text; begin
  foreach v_fn in array array['lifemate_pet_species_closed()','lifemate_pet_today()','lifemate_pet_state(text)',
    'lifemate_pet_set_grant(public.lifemate_pet_adoptions,text,text,integer,text)','lifemate_pet_lock(text,bigint)',
    'lifemate_pet_expire()','lifemate_pet_reserve(text,text,text)',
    'lifemate_pet_command(text,bigint,uuid,text,text,jsonb,jsonb)','lifemate_pet_read(text,bigint)',
    'lifemate_pet_reconcile(text,bigint,bigint,date[],jsonb,integer,integer)','lifemate_pet_erase_account(text)'] loop
    execute format('revoke all on function public.%s from public,anon,authenticated',v_fn);
    execute format('grant execute on function public.%s to service_role',v_fn);
  end loop;
end $$;
