-- Schedule Auto-Release Payments Cron Job
-- Run this in Supabase SQL Editor after deploying the Edge Function

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop existing job if it exists (for updates)
SELECT cron.unschedule('auto-release-payments');

-- Schedule the cron job to run every 15 minutes
SELECT cron.schedule(
  'auto-release-payments',                    -- job name
  '*/15 * * * *',                             -- every 15 minutes (cron syntax)
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-release-payments',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_CRON_SECRET'
      ),
      body:='{}'::jsonb,
      timeout_milliseconds:=60000              -- 60 second timeout
    ) as request_id;
  $$
);

-- Verify the job was scheduled
SELECT * FROM cron.job WHERE jobname = 'auto-release-payments';

-- Expected output:
-- jobid | schedule      | command | nodename | nodeport | database | username | active | jobname
-- ------|---------------|---------|----------|----------|----------|----------|--------|--------
-- 123   | */15 * * * *  | ...     | ...      | ...      | ...      | ...      | t      | auto-release-payments

-- Check recent execution history (after first run)
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-release-payments')
-- ORDER BY start_time DESC
-- LIMIT 10;






