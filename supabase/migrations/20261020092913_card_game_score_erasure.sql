-- Retained room scores must not keep a deleted account's identity after a
-- later match has replaced its private cards. Preserve unrelated live matches.
create or replace function public.lifemate_game_erase_account(p_uid text)
returns void language plpgsql security definer set search_path='' as $$
declare v_room public.lifemate_game_rooms;
begin
  for v_room in select * from public.lifemate_game_rooms r where
    exists(select 1 from jsonb_array_elements(r.state->'members') m where m->>'uid'=p_uid)
    or exists(select 1 from jsonb_array_elements(coalesce(r.state->'game'->'players','[]'::jsonb)) p where p->>'uid'=p_uid)
    or exists(select 1 from jsonb_array_elements(coalesce(r.state->'scoreMembers','[]'::jsonb)) s where s->>'uid'=p_uid)
    order by r.id for update loop
    if exists(select 1 from jsonb_array_elements(v_room.state->'members') m where m->>'uid'=p_uid)
      or exists(select 1 from jsonb_array_elements(coalesce(v_room.state->'game'->'players','[]'::jsonb)) p where p->>'uid'=p_uid) then
      perform realtime.send(jsonb_build_object('closed',true),'invalidate','card-room:'||v_room.id||':'||v_room.epoch,true);
      delete from public.lifemate_game_rooms where id=v_room.id;
    else
      update public.lifemate_game_rooms set state=jsonb_set(state,'{scoreMembers}',(
        select coalesce(jsonb_agg(s.value order by s.position),'[]'::jsonb)
        from jsonb_array_elements(state->'scoreMembers') with ordinality s(value,position)
        where s.value->>'uid' is distinct from p_uid
      )), version=version+1,worker_token=null,worker_until=null
      where id=v_room.id;
      perform realtime.send(jsonb_build_object('version',v_room.version+1),'changed','card-room:'||v_room.id||':'||v_room.epoch,true);
    end if;
  end loop;
  delete from public.lifemate_game_results where p_uid=any(participant_uids);
  delete from public.lifemate_game_receipts where uid=p_uid;
end $$;

revoke all on function public.lifemate_game_erase_account(text) from public,anon,authenticated;
grant execute on function public.lifemate_game_erase_account(text) to service_role;
