-- Run once after all Nook migrations, including 20260915011312, are applied.
-- Linked ordinary temporary sessions move to trash at expiry; purge deadline stays expiry + 7 days.
-- Anonymous/Safety expiry and expired trash are hard-deleted. Verify remote history before enabling.
-- Rejoin blocks left by withdrawals are swept on the same schedule, so a
-- withdrawn sign-in method is forgotten within an hour of its window closing.
-- Supabase Cron uses pg_cron. The cleanup runs hourly at minute 17.

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'nook-retention-cleanup-hourly',
  '17 * * * *',
  $$select public.purge_expired_sessions(); select public.purge_expired_rejoin_blocks();$$
);

-- On a project where the job already exists, point it at both functions instead
-- of scheduling a second one:
-- select cron.alter_job(
--   job_id := (select jobid from cron.job where jobname = 'nook-retention-cleanup-hourly'),
--   command := 'select public.purge_expired_sessions(); select public.purge_expired_rejoin_blocks();'
-- );

-- To remove the job later:
-- select cron.unschedule('nook-retention-cleanup-hourly');
