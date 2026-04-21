-- pg_cron is installed in the extensions schema per Supabase convention
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage so the cron schema is accessible from migrations
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================================
-- Job 1: Hourly — expire abandoned drafts past 24 h inactivity
-- ============================================================

-- Safely drop the job if it already exists so db:reset is idempotent
DO $$
BEGIN
  PERFORM cron.unschedule('limenfit_expire_inprogress_workouts');
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

SELECT cron.schedule(
  'limenfit_expire_inprogress_workouts',
  '0 * * * *',
  $$
    UPDATE public.workouts
    SET status = 'expired', expired_at = NOW()
    WHERE status = 'in_progress'
      AND last_activity_at < NOW() - INTERVAL '24 hours';
  $$
);

-- ============================================================
-- Job 2: Daily at 03:00 UTC — hard-delete past 7-day grace period
-- ============================================================

DO $$
BEGIN
  PERFORM cron.unschedule('limenfit_delete_expired_workouts');
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

SELECT cron.schedule(
  'limenfit_delete_expired_workouts',
  '0 3 * * *',
  $$
    DELETE FROM public.workouts
    WHERE status = 'expired'
      AND expired_at < NOW() - INTERVAL '7 days';
  $$
);
