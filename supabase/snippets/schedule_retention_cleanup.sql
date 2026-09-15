-- Run once after all Nook migrations, including 20260915011312, are applied.
-- Linked ordinary temporary sessions move to trash at expiry; purge deadline stays expiry + 7 days.
-- Anonymous/Safety expiry and expired trash are hard-deleted. Verify remote history before enabling.
-- Supabase Cron uses pg_cron. The cleanup runs hourly at minute 17.

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'nook-retention-cleanup-hourly',
  '17 * * * *',
  $$select public.purge_expired_sessions();$$
);

-- To remove the job later:
-- select cron.unschedule('nook-retention-cleanup-hourly');
