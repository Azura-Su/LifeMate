-- Celestial Stag: a 16th pet bound to the admin account. It sits outside the
-- 15-pet random pool: never rolled, restored, counted in availability, listed
-- for revocation, or adopted by anyone else. owner_uid stays null on purpose so
-- the "15 owned" availability maths and the all-adopted check are unchanged.
-- Lock the admin account before taking the species table's DDL lock. Pet
-- commands take locks in that order, so an in-flight admin request finishes
-- before this migration continues rather than deadlocking with the swap.
do $$
begin
  insert into public.lifemate_pet_accounts(uid) values('CQmmT9iJvKPP79UZqYbvmZ3gXZQ2')
    on conflict do nothing;
  perform 1 from public.lifemate_pet_accounts
    where uid='CQmmT9iJvKPP79UZqYbvmZ3gXZQ2' for update;
end $$;

alter table public.lifemate_pet_species add column exclusive_uid text unique
  check(exclusive_uid is null or exclusive_uid ~ '^[A-Za-z0-9_-]{1,128}$');

-- The catalog is closed for everyone else; open it for exactly this one row.
alter table public.lifemate_pet_species disable trigger lifemate_pet_species_closed;
insert into public.lifemate_pet_species(id,sort,exclusive_uid)
  values('celestial_stag',16,'CQmmT9iJvKPP79UZqYbvmZ3gXZQ2');
alter table public.lifemate_pet_species enable trigger lifemate_pet_species_closed;
do $$ begin
  if not exists(select 1 from pg_trigger where tgname='lifemate_pet_species_closed'
    and tgrelid='public.lifemate_pet_species'::regclass and tgenabled='O') then
    raise exception 'pet-catalog-trigger-disabled'; end if;
end $$;

-- Random reservations (roll and restore) skip exclusive pets.
create or replace function public.lifemate_pet_reserve(p_uid text,p_exclude text,p_prefer text)
returns text language plpgsql security definer set search_path='' as $$
declare v_id text; v_try integer;
begin
  for v_try in 1..6 loop
    select id into v_id from public.lifemate_pet_species
      where owner_uid is null and reserved_by is null and exclusive_uid is null
        and id is distinct from p_exclude
      order by (id=p_prefer) desc nulls last, random() limit 1;
    if not found then return null; end if;
    update public.lifemate_pet_species set reserved_by=p_uid,reservation_id=gen_random_uuid(),
      reserved_until=now()+interval '5 minutes'
      where id=v_id and owner_uid is null and reserved_by is null and exclusive_uid is null;
    if found then return v_id; end if;
  end loop;
  raise exception 'pet-busy';
end $$;

-- Defence in depth: only the bound account can ever hold an exclusive pet.
create function public.lifemate_pet_exclusive_guard() returns trigger
language plpgsql set search_path='' as $$
declare v_owner text;
begin
  select exclusive_uid into v_owner from public.lifemate_pet_species where id=new.species_id;
  if v_owner is not null and v_owner is distinct from new.uid then raise exception 'exclusive-pet'; end if;
  return new;
end $$;
create trigger lifemate_pet_exclusive_guard before insert or update of uid,species_id
  on public.lifemate_pet_adoptions for each row execute function public.lifemate_pet_exclusive_guard();

-- The admin inventory stays the 15 pool pets and cannot revoke an exclusive pet.
alter function public.lifemate_pet_admin_list(text,bigint)
  rename to lifemate_pet_admin_list_before_exclusive;
revoke all on function public.lifemate_pet_admin_list_before_exclusive(text,bigint)
  from public,anon,authenticated,service_role;
create function public.lifemate_pet_admin_list(p_admin_uid text,p_auth_time bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_all jsonb;
begin
  v_all:=public.lifemate_pet_admin_list_before_exclusive(p_admin_uid,p_auth_time);
  return jsonb_set(v_all,'{pets}',coalesce((
    select jsonb_agg(t.e order by t.ord) from jsonb_array_elements(v_all->'pets') with ordinality t(e,ord)
    where not exists(select 1 from public.lifemate_pet_species s
      where s.id=t.e->>'speciesId' and s.exclusive_uid is not null)
  ),'[]'::jsonb));
end $$;

alter function public.lifemate_pet_admin_revoke(text,bigint,uuid,text,text,uuid)
  rename to lifemate_pet_admin_revoke_before_exclusive;
revoke all on function public.lifemate_pet_admin_revoke_before_exclusive(text,bigint,uuid,text,text,uuid)
  from public,anon,authenticated,service_role;
create function public.lifemate_pet_admin_revoke(p_admin_uid text,p_auth_time bigint,p_action_id uuid,
  p_target_uid text,p_species_id text,p_adoption_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_admin_uid is distinct from 'CQmmT9iJvKPP79UZqYbvmZ3gXZQ2' then raise exception 'admin-required'; end if;
  if exists(select 1 from public.lifemate_pet_species where id=p_species_id and exclusive_uid is not null) then
    raise exception 'invalid-input'; end if;
  return public.lifemate_pet_admin_revoke_before_exclusive(p_admin_uid,p_auth_time,p_action_id,
    p_target_uid,p_species_id,p_adoption_id);
end $$;

do $$ declare v_fn text; begin
  foreach v_fn in array array[
    'lifemate_pet_admin_list(text,bigint)',
    'lifemate_pet_admin_revoke(text,bigint,uuid,text,text,uuid)'] loop
    execute format('revoke all on function public.%s from public,anon,authenticated',v_fn);
    execute format('grant execute on function public.%s to service_role',v_fn);
  end loop;
  revoke all on function public.lifemate_pet_exclusive_guard() from public,anon,authenticated;
end $$;

-- Give the admin the stag. An existing pet is swapped in place, so its adoption,
-- level and EXP carry over; the previous species returns to the random pool.
do $$
declare v_uid constant text:='CQmmT9iJvKPP79UZqYbvmZ3gXZQ2'; v_old public.lifemate_pet_adoptions;
begin
  update public.lifemate_pet_species set reserved_by=null,reservation_id=null,reserved_until=null
    where reserved_by=v_uid;
  select * into v_old from public.lifemate_pet_adoptions where uid=v_uid;
  if found then
    update public.lifemate_pet_species set owner_uid=null where id=v_old.species_id and owner_uid=v_uid;
    update public.lifemate_pet_adoptions set species_id='celestial_stag' where uid=v_uid;
  else
    insert into public.lifemate_pet_adoptions(uid,adoption_id,species_id,adopted_day)
      values(v_uid,gen_random_uuid(),'celestial_stag',public.lifemate_pet_today());
  end if;
  -- Replays of pre-swap receipts must return the current state, not the old pet.
  update public.lifemate_pet_receipts set invalidated=true where uid=v_uid;
end $$;
