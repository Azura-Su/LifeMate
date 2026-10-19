-- Install after the migrations, GAME_WORKER_SECRET Edge secret and matching
-- Vault lifemate_game_worker_secret exist. The endpoint validates this secret;
-- clients never receive it. One shared job handles all rooms.
begin;
create or replace function public.lifemate_game_wake_worker()
returns void language plpgsql security definer set search_path='' as $$
declare v_secret text;
begin
  if not (
    exists(select 1 from public.lifemate_game_rooms r
      where r.next_due<=now() and r.state->>'phase'<>'closed'
        and (r.worker_until is null or r.worker_until<now()))
    or exists(select 1 from public.lifemate_game_rooms where private_until<=now())
    or exists(select 1 from public.lifemate_game_rooms where state->>'phase'='closed' and expires_at<now())
    or exists(select 1 from public.lifemate_game_results where created_at<now()-interval '30 days')
    or exists(select 1 from public.lifemate_game_limits where window_start<now()-interval '10 minutes')
  ) then return; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='lifemate_game_worker_secret';
  if v_secret is null or length(v_secret)<32 then raise exception 'Missing game worker secret'; end if;
  perform net.http_post(
    url := 'https://xbhelntqytleiduzicuj.supabase.co/functions/v1/game-access',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_secret),
    body := '{"type":"tick"}'::jsonb, timeout_milliseconds := 20000);
end $$;
revoke all on function public.lifemate_game_wake_worker() from public,anon,authenticated;
do $$ begin
  if exists(select 1 from cron.job where jobname='lifemate-game-deadlines') then
    perform cron.unschedule('lifemate-game-deadlines');
  end if;
end $$;
select cron.schedule('lifemate-game-deadlines','5 seconds','select public.lifemate_game_wake_worker()');
commit;
