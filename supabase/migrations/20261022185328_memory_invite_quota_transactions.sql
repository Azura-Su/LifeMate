-- Only the verified memory-access service invokes these quota transactions.
-- Every participant/email lock is acquired in a common order, including claims.
create function public.lifemate_memory_quota_lock(p_keys text[])
returns void language plpgsql set search_path='' as $$
declare v_key text;
begin
  for v_key in select distinct k from unnest(p_keys) k where k is not null order by k loop
    perform pg_advisory_xact_lock(hashtextextended('memory-quota:'||v_key,0));
  end loop;
end $$;
revoke all on function public.lifemate_memory_quota_lock(text[]) from public,anon,authenticated;
grant execute on function public.lifemate_memory_quota_lock(text[]) to service_role;

create function public.invite_lifemate_memory_friend(p_uid text,p_email text)
returns jsonb language plpgsql set search_path='' as $$
declare v_target text; v_current_target text; v_sender_email text; v_count bigint;
begin
  select email into v_sender_email from public.lifemate_memory_profiles where uid=p_uid;
  if v_sender_email is null or p_email is null or length(p_email)>254 or
    p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_email<>lower(p_email) or p_email=v_sender_email then
    raise exception 'invalid-input';
  end if;
  select uid into v_target from public.lifemate_memory_profiles where email=p_email;
  perform public.lifemate_memory_quota_lock(array['uid:'||p_uid,'email:'||p_email,'uid:'||v_target]);
  select count(*) into v_count from public.lifemate_memory_invite_attempts
    where uid=p_uid and created_at>=clock_timestamp()-interval '24 hours';
  if v_count>=20 then return jsonb_build_object('limited',true); end if;
  insert into public.lifemate_memory_invite_attempts(id,uid) values(gen_random_uuid()::text,p_uid);
  select uid into v_current_target from public.lifemate_memory_profiles where email=p_email;
  -- An email changing owners during lock acquisition must never target a stale UID.
  -- A later request can retry with the new identity and correct participant locks.
  if v_current_target is distinct from v_target then return jsonb_build_object('limited',false); end if;
  -- One snapshot across both tables: a claim can move an invitation between them.
  select count(*) into v_count from (
    select 1 from public.lifemate_memory_friend_requests where requester_uid=p_uid
    union all select 1 from public.lifemate_memory_email_invites where requester_uid=p_uid
  ) pending;
  if v_count>=20 then return jsonb_build_object('limited',false); end if;
  if v_target is null then
    select count(*) into v_count from public.lifemate_memory_email_invites where target_email=p_email;
    if v_count<20 then
      insert into public.lifemate_memory_email_invites(requester_uid,target_email)
        values(p_uid,p_email) on conflict do nothing;
    end if;
  elsif v_target<>p_uid and not exists (
    select 1 from public.lifemate_memory_friendships where left_uid=least(p_uid,v_target) and right_uid=greatest(p_uid,v_target)
  ) then
    select count(*) into v_count from public.lifemate_memory_friend_requests where target_uid=v_target;
    if v_count<20 then
      insert into public.lifemate_memory_friend_requests(requester_uid,target_uid)
        values(p_uid,v_target) on conflict do nothing;
    end if;
  end if;
  -- Full/duplicate/unknown recipients deliberately have the same public response.
  return jsonb_build_object('limited',false);
end $$;
revoke all on function public.invite_lifemate_memory_friend(text,text) from public,anon,authenticated;
grant execute on function public.invite_lifemate_memory_friend(text,text) to service_role;

create or replace function public.accept_lifemate_memory_friend_request(p_target_uid text,p_requester_uid text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  perform public.lifemate_memory_quota_lock(array['uid:'||p_target_uid,'uid:'||p_requester_uid]);
  if not exists(select 1 from public.lifemate_memory_friend_requests where requester_uid=p_requester_uid and target_uid=p_target_uid) then return false; end if;
  if (select count(*) from public.lifemate_memory_friendships where left_uid=p_target_uid or right_uid=p_target_uid)>=100
    or (select count(*) from public.lifemate_memory_friendships where left_uid=p_requester_uid or right_uid=p_requester_uid)>=100 then return false; end if;
  insert into public.lifemate_memory_friendships(left_uid,right_uid)
    values(least(p_target_uid,p_requester_uid),greatest(p_target_uid,p_requester_uid)) on conflict do nothing;
  delete from public.lifemate_memory_friend_requests where
    (requester_uid=p_requester_uid and target_uid=p_target_uid) or
    (requester_uid=p_target_uid and target_uid=p_requester_uid);
  return true;
end $$;
revoke all on function public.accept_lifemate_memory_friend_request(text,text) from public,anon,authenticated;
grant execute on function public.accept_lifemate_memory_friend_request(text,text) to service_role;

create or replace function public.claim_lifemate_memory_email_invites(p_uid text,p_email text)
returns void language plpgsql security definer set search_path='' as $$
declare v_requester text; v_slots integer;
begin
  perform public.lifemate_memory_quota_lock(array['uid:'||p_uid,'email:'||p_email]);
  -- Do not lock profile rows: mutual claims would conflict with FK key-share locks.
  if not exists(select 1 from public.lifemate_memory_profiles where uid=p_uid and email=p_email) then return; end if;
  select greatest(0,20-count(*)) into v_slots from public.lifemate_memory_friend_requests where target_uid=p_uid;
  for v_requester in select requester_uid from public.lifemate_memory_email_invites
    where target_email=p_email order by created_at asc for update skip locked loop
    if v_requester=p_uid or exists(select 1 from public.lifemate_memory_friendships where left_uid=least(v_requester,p_uid) and right_uid=greatest(v_requester,p_uid))
      or exists(select 1 from public.lifemate_memory_friend_requests where requester_uid=v_requester and target_uid=p_uid) then
      delete from public.lifemate_memory_email_invites where requester_uid=v_requester and target_email=p_email;
    elsif v_slots>0 then
      insert into public.lifemate_memory_friend_requests(requester_uid,target_uid) values(v_requester,p_uid) on conflict do nothing;
      if found then
        v_slots:=v_slots-1;
        delete from public.lifemate_memory_email_invites where requester_uid=v_requester and target_email=p_email;
      end if;
    end if;
  end loop;
end $$;
revoke all on function public.claim_lifemate_memory_email_invites(text,text) from public,anon,authenticated;
grant execute on function public.claim_lifemate_memory_email_invites(text,text) to service_role;
