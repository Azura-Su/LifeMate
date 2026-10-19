-- Keep email invitations that cannot yet fit in the recipient's request inbox.
create or replace function public.claim_lifemate_memory_email_invites(
  p_uid text, p_email text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_requester text;
  v_slots integer;
begin
  -- Serialize claims for one recipient before counting available slots.
  perform 1 from public.lifemate_memory_profiles
    where uid = p_uid and email = p_email for update;
  if not found then
    return;
  end if;

  select greatest(0, 20 - count(*)) into v_slots
    from public.lifemate_memory_friend_requests where target_uid = p_uid;

  for v_requester in
    select requester_uid from public.lifemate_memory_email_invites
    where target_email = p_email
    order by created_at asc
    for update skip locked
  loop
    if v_requester = p_uid or exists (
      select 1 from public.lifemate_memory_friendships
      where (left_uid = least(v_requester, p_uid)
        and right_uid = greatest(v_requester, p_uid))
    ) or exists (
      select 1 from public.lifemate_memory_friend_requests
      where requester_uid = v_requester and target_uid = p_uid
    ) then
      delete from public.lifemate_memory_email_invites
        where requester_uid = v_requester and target_email = p_email;
    elsif v_slots > 0 then
      insert into public.lifemate_memory_friend_requests (requester_uid, target_uid)
        values (v_requester, p_uid) on conflict do nothing;
      if found then
        v_slots := v_slots - 1;
        delete from public.lifemate_memory_email_invites
          where requester_uid = v_requester and target_email = p_email;
      elsif exists (
        select 1 from public.lifemate_memory_friend_requests
        where requester_uid = v_requester and target_uid = p_uid
      ) then
        delete from public.lifemate_memory_email_invites
          where requester_uid = v_requester and target_email = p_email;
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.claim_lifemate_memory_email_invites(text, text)
  from public, anon, authenticated;
grant execute on function public.claim_lifemate_memory_email_invites(text, text)
  to service_role;
