-- Emergency shutdown blocks client actions, but the service worker must still
-- close active rooms and start private-state retention.
create or replace function public.lifemate_game_claim_due(p_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb; v_expired record;
begin
  for v_expired in
    update public.lifemate_game_rooms set state=jsonb_set(state,'{game}','null'::jsonb),
      private_until=null,version=version+1
    where id in (select id from public.lifemate_game_rooms where private_until<=now() order by private_until for update skip locked limit 100)
    returning id,epoch,version
  loop
    perform realtime.send(jsonb_build_object('version',v_expired.version),'changed','card-room:'||v_expired.id||':'||v_expired.epoch,true);
  end loop;
  delete from public.lifemate_game_rooms where id in (
    select id from public.lifemate_game_rooms where state->>'phase'='closed' and expires_at<now() limit 100);
  delete from public.lifemate_game_results where match_id in (
    select match_id from public.lifemate_game_results where created_at<now()-interval '30 days' limit 100);
  delete from public.lifemate_game_limits where bucket in (
    select bucket from public.lifemate_game_limits where window_start<now()-interval '10 minutes' limit 100);
  with due as (
    select r.id from public.lifemate_game_rooms r
    where r.next_due<=now() and (r.worker_until is null or r.worker_until<now())
      and r.state->>'phase'<>'closed'
    order by r.next_due for update of r skip locked limit 8
  ), claimed as (
    update public.lifemate_game_rooms r set worker_token=p_token,worker_until=now()+interval '15 seconds'
    from due where r.id=due.id returning r.*
  ) select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('expired',coalesce((
      select jsonb_agg(s.uid) from public.lifemate_game_seats s
      left join public.lifemate_account_access a on a.uid=s.uid
      cross join public.lifemate_game_config c
      where s.room_id=r.id and (s.lease_until<=now() or a.status is distinct from 'active'
        or a.valid_since>s.auth_time or (c.mode='closed' and not s.uid=any(c.test_uids)))
    ),'[]'::jsonb))),'[]'::jsonb) into v_rows from claimed r;
  return jsonb_build_object('rooms',v_rows,'now',floor(extract(epoch from clock_timestamp())*1000));
end $$;

create or replace function public.lifemate_game_commit_worker(p_room_id uuid,p_token uuid,p_version bigint,p_state jsonb,p_remove_uids text[])
returns boolean language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_epoch uuid;
begin
  select * into v_room from public.lifemate_game_rooms where id=p_room_id for update;
  if not found or v_room.worker_token is distinct from p_token or v_room.version<>p_version then return false; end if;
  if exists(select 1 from public.lifemate_game_seats s join public.lifemate_account_access a on a.uid=s.uid
    cross join public.lifemate_game_config c
    where s.room_id=p_room_id and s.uid=any(p_remove_uids) and s.lease_until>now()
      and a.status='active' and a.valid_since<=s.auth_time
      and not (c.mode='closed' and not s.uid=any(c.test_uids)))
    and v_room.expires_at>now() then
    update public.lifemate_game_rooms set worker_token=null,worker_until=null where id=p_room_id;
    perform public.lifemate_game_schedule(p_room_id);
    return false;
  end if;
  delete from public.lifemate_game_seats where room_id=p_room_id and uid=any(p_remove_uids);
  v_epoch:=case when cardinality(p_remove_uids)>0 then gen_random_uuid() else v_room.epoch end;
  update public.lifemate_game_rooms set state=p_state,epoch=v_epoch,version=version+1,
    expires_at=case when p_state->>'phase'='closed' then now()+interval '24 hours' else now()+interval '30 minutes' end,
    private_until=case when p_state->>'phase'='playing' then null
      when p_state->>'phase' in ('finished','closed') and v_room.private_until is null then now()+interval '24 hours'
      else v_room.private_until end,
    worker_token=null,worker_until=null,updated_at=now() where id=p_room_id;
  perform public.lifemate_game_schedule(p_room_id);
  if p_state->>'phase'='finished' and v_room.state->>'phase'='playing' and v_room.match_id is not null then
    insert into public.lifemate_game_results(match_id,participant_uids,result)
    values(v_room.match_id,array(select m->>'uid' from jsonb_array_elements(p_state->'game'->'players') m),p_state->'game'->'result') on conflict do nothing;
  end if;
  if v_epoch<>v_room.epoch then perform realtime.send(jsonb_build_object('version',v_room.version+1),'invalidate','card-room:'||p_room_id||':'||v_room.epoch,true); end if;
  perform realtime.send(jsonb_build_object('version',v_room.version+1),'changed','card-room:'||p_room_id||':'||v_epoch,true);
  return true;
end $$;

revoke all on function public.lifemate_game_claim_due(uuid) from public,anon,authenticated;
revoke all on function public.lifemate_game_commit_worker(uuid,uuid,bigint,jsonb,text[]) from public,anon,authenticated;
grant execute on function public.lifemate_game_claim_due(uuid) to service_role;
grant execute on function public.lifemate_game_commit_worker(uuid,uuid,bigint,jsonb,text[]) to service_role;
