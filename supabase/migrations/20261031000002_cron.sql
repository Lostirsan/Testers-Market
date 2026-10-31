-- Expire stale slots, auto-accept unreviewed reports, finalize undisputed rejections.
create extension if not exists pg_cron;
select cron.schedule('process-timeouts', '*/15 * * * *', $$select public.process_timeouts()$$);
