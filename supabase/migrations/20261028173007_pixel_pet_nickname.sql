alter table public.lifemate_pet_adoptions
  add column nickname text,
  add constraint lifemate_pet_adoptions_nickname_check check (
    nickname is null or (
      nickname = btrim(nickname)
      and char_length(nickname) between 1 and 24
      and nickname !~ '[[:cntrl:]]'
    )
  );

comment on column public.lifemate_pet_adoptions.nickname is
  'Owner-selected display name for this adoption; cleared when the adoption is revoked.';

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
      'nickname',v_pet.nickname,
      'adoptedAt',floor(extract(epoch from v_pet.adopted_at)*1000),
      'totalExp',v_pet.total_exp,
      'caredToday',exists(select 1 from public.lifemate_pet_exp_grants g where g.adoption_id=v_pet.adoption_id
        and g.source_type='care_day' and g.period_key=public.lifemate_pet_today()::text and g.amount>0)) end,
    'availability',jsonb_build_object('total',15,'owned',v_owned,'reserved',v_reserved),
    'now',floor(extract(epoch from now())*1000));
end $$;

create function public.lifemate_pet_rename(
  p_uid text,
  p_auth_time bigint,
  p_adoption_id uuid,
  p_nickname text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_pet public.lifemate_pet_adoptions;
begin
  perform public.lifemate_pet_lock(p_uid,p_auth_time);
  if p_adoption_id is null then raise exception 'invalid-input'; end if;
  if p_nickname is null or p_nickname<>btrim(p_nickname)
    or char_length(p_nickname) not between 1 and 24
    or p_nickname ~ '[[:cntrl:]]' then
    raise exception 'pet-name-invalid';
  end if;
  perform public.lifemate_game_limit('pet-rename:'||p_uid,30);
  select * into v_pet from public.lifemate_pet_adoptions
    where uid=p_uid for update;
  if v_pet.uid is null then raise exception 'no-pet'; end if;
  if v_pet.adoption_id is distinct from p_adoption_id then
    raise exception 'stale-snapshot';
  end if;
  update public.lifemate_pet_adoptions set nickname=p_nickname
    where uid=p_uid and adoption_id=p_adoption_id;
  return public.lifemate_pet_state(p_uid);
end $$;

revoke all on function public.lifemate_pet_rename(text,bigint,uuid,text)
  from public,anon,authenticated;
grant execute on function public.lifemate_pet_rename(text,bigint,uuid,text)
  to service_role;
