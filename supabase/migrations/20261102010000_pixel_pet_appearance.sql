-- Cosmetic selections belong to an adoption, never to an EXP or skill grant.
alter table public.lifemate_pet_adoptions
  add column appearance_level smallint check (appearance_level between 1 and 20),
  add column sleep_scene_level smallint check (sleep_scene_level between 2 and 20),
  add column max_unlocked_level smallint not null default 1 check (max_unlocked_level between 1 and 20);

create function public.lifemate_pet_level_for_exp(p_exp bigint)
returns smallint language sql immutable set search_path='' as $$
  select count(*)::smallint from unnest(array[
    0,30,80,150,240,350,480,630,800,1000,1230,1490,1780,2100,2450,2830,3240,3680,4150,4650
  ]) threshold where threshold <= greatest(0,p_exp)
$$;
revoke all on function public.lifemate_pet_level_for_exp(bigint) from public,anon,authenticated;

-- Reconcile does not write receipts. Its immutable ledger rows share the
-- insertion transaction and now() timestamp, so recover only complete batches.
-- Include old species rows: the exclusive Stag swap preserves the adoption.
with batches as (
  select a.adoption_id,l.xmin::text insertion_tx,l.created_at,min(l.id) first_id,sum(l.exp_delta) delta
  from public.lifemate_pet_adoptions a join public.lifemate_pet_exp_ledger l
    on l.adoption_id=a.adoption_id and l.owner_uid=a.uid
  group by a.adoption_id,l.xmin::text,l.created_at
), totals as (
  select adoption_id,sum(delta) over(partition by adoption_id order by first_id rows unbounded preceding) total
  from batches
), peaks as (select adoption_id,max(total) total from totals group by adoption_id)
update public.lifemate_pet_adoptions a set max_unlocked_level=public.lifemate_pet_level_for_exp(greatest(
  a.total_exp::bigint,
  coalesce((select p.total::bigint from peaks p where p.adoption_id=a.adoption_id),0),
  coalesce((select max(case when r.ack#>>'{pet,totalExp}' ~ '^[0-9]{1,10}$'
    then (r.ack#>>'{pet,totalExp}')::bigint else 0 end)
    from public.lifemate_pet_receipts r
    where r.uid=a.uid and r.ack#>>'{pet,adoptionId}'=a.adoption_id::text),0)
));

create or replace function public.lifemate_pet_state(p_uid text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_acc public.lifemate_pet_accounts; v_pet public.lifemate_pet_adoptions;
  v_res public.lifemate_pet_species; v_owned integer; v_reserved integer;
begin
  -- All public RPC callers hold the account lock. Promote only the final state
  -- they present, not intermediate EXP updates inside a reconciliation.
  update public.lifemate_pet_adoptions set max_unlocked_level=public.lifemate_pet_level_for_exp(total_exp)
    where uid=p_uid and max_unlocked_level<public.lifemate_pet_level_for_exp(total_exp)
    returning * into v_pet;
  if not found then select * into v_pet from public.lifemate_pet_adoptions where uid=p_uid; end if;
  select * into v_acc from public.lifemate_pet_accounts where uid=p_uid;
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
      'speciesId',v_pet.species_id,'adoptionId',v_pet.adoption_id,'nickname',v_pet.nickname,
      'adoptedAt',floor(extract(epoch from v_pet.adopted_at)*1000),'totalExp',v_pet.total_exp,
      'appearanceLevel',v_pet.appearance_level,'sleepSceneLevel',v_pet.sleep_scene_level,
      'maxUnlockedLevel',v_pet.max_unlocked_level,
      'caredToday',exists(select 1 from public.lifemate_pet_exp_grants g where g.adoption_id=v_pet.adoption_id
        and g.source_type='care_day' and g.period_key=public.lifemate_pet_today()::text and g.amount>0)) end,
    'availability',jsonb_build_object('total',15,'owned',v_owned,'reserved',v_reserved),
    'now',floor(extract(epoch from now())*1000));
end $$;

create function public.lifemate_pet_set_appearance(
  p_uid text,p_auth_time bigint,p_adoption_id uuid,p_appearance_level integer,p_sleep_scene_level integer
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_pet public.lifemate_pet_adoptions; v_max smallint; v_shapes integer[]; v_scenes integer[];
begin
  perform public.lifemate_pet_lock(p_uid,p_auth_time);
  if p_adoption_id is null then raise exception 'invalid-input'; end if;
  perform public.lifemate_game_limit('pet-appearance:'||p_uid,30);
  select * into v_pet from public.lifemate_pet_adoptions where uid=p_uid for update;
  if v_pet.uid is null then raise exception 'no-pet'; end if;
  if v_pet.adoption_id is distinct from p_adoption_id then raise exception 'stale-snapshot'; end if;
  v_max:=greatest(v_pet.max_unlocked_level,public.lifemate_pet_level_for_exp(v_pet.total_exp));
  v_shapes:=case when v_pet.species_id='celestial_stag' then array[1,3,4,5,7,8,9,11,13,15,17,19] else array[1,4,8] end;
  v_scenes:=case when v_pet.species_id='celestial_stag' then array[2,4,6,8,10,12,14,16,18,20]
    when v_pet.species_id in ('nine_tail_fox','rune_wolf','garuda') then array[2] else array[]::integer[] end;
  if (p_appearance_level is not null and not (p_appearance_level=any(v_shapes)))
    or (p_sleep_scene_level is not null and not (p_sleep_scene_level=any(v_scenes))) then
    raise exception 'appearance-invalid';
  end if;
  if p_appearance_level>v_max or p_sleep_scene_level>v_max then raise exception 'appearance-locked'; end if;
  update public.lifemate_pet_adoptions set appearance_level=p_appearance_level,
    sleep_scene_level=p_sleep_scene_level,max_unlocked_level=v_max
    where uid=p_uid and adoption_id=p_adoption_id;
  return public.lifemate_pet_state(p_uid);
end $$;
revoke all on function public.lifemate_pet_set_appearance(text,bigint,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.lifemate_pet_set_appearance(text,bigint,uuid,integer,integer) to service_role;

-- Replaying an idempotent care/confirm must not restore stale cosmetic fields.
-- Fingerprint and revocation checks remain before returning canonical state.
create or replace function public.lifemate_pet_command(p_uid text,p_auth_time bigint,p_action_id uuid,
  p_fingerprint text,p_command text,p_args jsonb,p_rules jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_acc public.lifemate_pet_accounts; v_receipt public.lifemate_pet_receipts; v_current jsonb;
begin
  v_acc:=public.lifemate_pet_lock(p_uid,p_auth_time);
  select * into v_receipt from public.lifemate_pet_receipts where uid=p_uid and action_id=p_action_id;
  if found then
    if v_receipt.fingerprint<>p_fingerprint then raise exception 'idempotency-conflict'; end if;
    v_current:=public.lifemate_pet_state(p_uid);
    if v_receipt.invalidated or v_current->'pet'<>'null'::jsonb or v_receipt.ack->'pet'<>'null'::jsonb then
      return v_current;
    end if;
    return v_receipt.ack;
  end if;
  if v_acc.revoked_at is not null then
    if p_command='restore' then raise exception 'no-restores'; end if;
    if p_command='roll' then update public.lifemate_pet_accounts set revoked_at=null where uid=p_uid; end if;
  end if;
  return public.lifemate_pet_command_before_admin(p_uid,p_auth_time,p_action_id,p_fingerprint,p_command,p_args,p_rules);
end $$;
