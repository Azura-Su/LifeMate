-- Only the room creator may claim an empty, still-live room. Keep the creator
-- identity in server state even when host control is transferred or the room
-- has no seated members.
create or replace function public.lifemate_game_create(
  p_uid text,
  p_auth_time bigint,
  p_session_id uuid,
  p_action_id uuid,
  p_fingerprint text,
  p_room_id uuid,
  p_code text,
  p_name text,
  p_amount_per_card bigint
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ack jsonb;
begin
  if p_amount_per_card is null or p_amount_per_card<0 or p_amount_per_card>1000000000 then
    raise exception 'invalid-input';
  end if;
  v_ack:=public.lifemate_game_create(
    p_uid,p_auth_time,p_session_id,p_action_id,p_fingerprint,p_room_id,p_code,p_name
  );
  update public.lifemate_game_rooms
    set state=state||jsonb_build_object(
      'amountPerCard',p_amount_per_card,
      'ownerUid',coalesce(state->>'ownerUid',p_uid)
    )
    where id=(v_ack->>'roomId')::uuid;
  return v_ack;
end $$;

revoke all on function public.lifemate_game_create(text,bigint,uuid,uuid,text,uuid,text,text,bigint)
  from public,anon,authenticated;
grant execute on function public.lifemate_game_create(text,bigint,uuid,uuid,text,uuid,text,text,bigint)
  to service_role;

create or replace function public.lifemate_game_find(p_uid text,p_auth_time bigint,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_owner text;
begin
  perform public.lifemate_game_assert_account(p_uid,p_auth_time);
  perform public.lifemate_game_permit(p_uid,true);
  perform public.lifemate_game_limit('find:'||p_uid,15);
  select * into v_room from public.lifemate_game_rooms
    where code=p_code and expires_at>now() and state->>'phase'<>'closed';
  -- Return rather than raise, so failed guesses commit the throttle counter.
  if not found then return jsonb_build_object('error','room-not-found'); end if;

  if jsonb_array_length(v_room.state->'members')=0 then
    -- Backfill older rooms from their original score member ordering.
    v_owner:=coalesce(
      v_room.state->>'ownerUid',
      v_room.state->'scoreMembers'->0->>'uid'
    );
    if v_owner is distinct from p_uid then
      return jsonb_build_object('error','room-not-found');
    end if;
  end if;
  return to_jsonb(v_room);
end $$;

revoke all on function public.lifemate_game_find(text,bigint,text)
  from public,anon,authenticated;
grant execute on function public.lifemate_game_find(text,bigint,text)
  to service_role;

-- Account deletion must also clear an owner identity retained only to prevent
-- another player from claiming an empty room. The empty-string marker fails
-- closed and prevents the legacy scoreMembers fallback from choosing a new owner.
create or replace function public.lifemate_game_erase_account(p_uid text)
returns void language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms; v_owner text;
begin
  for v_room in select * from public.lifemate_game_rooms r where
    exists(select 1 from jsonb_array_elements(r.state->'members') m where m->>'uid'=p_uid)
    or exists(select 1 from jsonb_array_elements(coalesce(r.state->'game'->'players','[]'::jsonb)) p where p->>'uid'=p_uid)
    or exists(select 1 from jsonb_array_elements(coalesce(r.state->'scoreMembers','[]'::jsonb)) s where s->>'uid'=p_uid)
    or r.state->>'ownerUid'=p_uid
    order by r.id for update loop
    if exists(select 1 from jsonb_array_elements(v_room.state->'members') m where m->>'uid'=p_uid)
      or exists(select 1 from jsonb_array_elements(coalesce(v_room.state->'game'->'players','[]'::jsonb)) p where p->>'uid'=p_uid) then
      perform realtime.send(jsonb_build_object('closed',true),'invalidate','card-room:'||v_room.id||':'||v_room.epoch,true);
      delete from public.lifemate_game_rooms where id=v_room.id;
    else
      v_owner:=coalesce(v_room.state->>'ownerUid',v_room.state->'scoreMembers'->0->>'uid');
      update public.lifemate_game_rooms set state=case when v_owner=p_uid then jsonb_set(
        jsonb_set(state,'{scoreMembers}',(
          select coalesce(jsonb_agg(s.value order by s.position),'[]'::jsonb)
          from jsonb_array_elements(coalesce(state->'scoreMembers','[]'::jsonb)) with ordinality s(value,position)
          where s.value->>'uid' is distinct from p_uid
        )), '{ownerUid}', '""'::jsonb, true
      ) else jsonb_set(state,'{scoreMembers}',(
        select coalesce(jsonb_agg(s.value order by s.position),'[]'::jsonb)
        from jsonb_array_elements(coalesce(state->'scoreMembers','[]'::jsonb)) with ordinality s(value,position)
        where s.value->>'uid' is distinct from p_uid
      )) end,
      version=version+1,worker_token=null,worker_until=null
      where id=v_room.id;
      perform realtime.send(jsonb_build_object('version',v_room.version+1),'changed','card-room:'||v_room.id||':'||v_room.epoch,true);
    end if;
  end loop;
  delete from public.lifemate_game_results where p_uid=any(participant_uids);
  delete from public.lifemate_game_receipts where uid=p_uid;
end $$;

revoke all on function public.lifemate_game_erase_account(text) from public,anon,authenticated;
grant execute on function public.lifemate_game_erase_account(text) to service_role;
