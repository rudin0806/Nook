-- Run once after both Nook migrations are applied.
-- Supabase Cron uses pg_cron. The cleanup runs hourly at minute 17.

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'nook-retention-cleanup-hourly',
  '17 * * * *',
  $$select public.purge_expired_sessions();$$
);

-- To remove the job later:
-- select cron.unschedule('nook-retention-cleanup-hourly');
