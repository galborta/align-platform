-- ============================================================================
-- AUTO-RELEASE PAYMENTS - PRODUCTION CRON JOB SETUP
-- ============================================================================
-- Project: align-platform
-- Project Ref: szunhbkqmfbbcrefycxh
-- Region: eu-north-1
-- Schedule: Every hour at :00 minutes
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop existing job if it exists (for updates/re-runs)
SELECT cron.unschedule('auto-release-payments') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-release-payments'
);

-- ============================================================================
-- IMPORTANT: Replace YOUR_CRON_SECRET before running!
-- Generate a secure secret:
--   openssl rand -base64 32
-- 
-- Then update the Authorization header below with your actual secret.
-- ============================================================================

-- Schedule the cron job to run every hour
SELECT cron.schedule(
  'auto-release-payments',                    -- job name
  '0 * * * *',                                -- every hour at :00 minutes (cron syntax)
  $$
  SELECT
    net.http_post(
      url:='https://szunhbkqmfbbcrefycxh.supabase.co/functions/v1/auto-release-payments',
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
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job 
WHERE jobname = 'auto-release-payments';

-- Expected output:
-- jobid | jobname               | schedule    | active | database
-- ------|----------------------|-------------|--------|----------
-- 123   | auto-release-payments | 0 * * * *   | t      | postgres

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- After the first hour, check execution history:
-- SELECT 
--   jobid,
--   runid,
--   status,
--   start_time,
--   end_time,
--   return_message
-- FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-release-payments')
-- ORDER BY start_time DESC
-- LIMIT 10;

-- ============================================================================
-- CRON SCHEDULE EXPLANATION
-- ============================================================================
-- 
-- '0 * * * *' means:
-- 
-- ┌───────────── minute (0 - 59)         → 0 (run at minute 0)
-- │ ┌─────────── hour (0 - 23)           → * (every hour)
-- │ │ ┌───────── day of month (1 - 31)   → * (every day)
-- │ │ │ ┌─────── month (1 - 12)          → * (every month)
-- │ │ │ │ ┌───── day of week (0 - 6)     → * (every day of week)
-- │ │ │ │ │
-- 0 * * * *
-- 
-- Examples:
-- '0 * * * *'     → Every hour at :00 (e.g., 1:00, 2:00, 3:00)
-- '*/15 * * * *'  → Every 15 minutes (e.g., 1:00, 1:15, 1:30, 1:45)
-- '0 */2 * * *'   → Every 2 hours at :00 (e.g., 2:00, 4:00, 6:00)
-- '0 9 * * *'     → Every day at 9:00 AM
-- '0 9,17 * * *'  → Every day at 9:00 AM and 5:00 PM
-- 
-- ============================================================================

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================
--
-- If cron job is not running:
-- 1. Verify extensions are enabled:
--    SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
--
-- 2. Check if job exists:
--    SELECT * FROM cron.job;
--
-- 3. Check recent execution attempts:
--    SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
--
-- 4. Verify Edge Function is accessible:
--    Run manual test: curl -X POST https://szunhbkqmfbbcrefycxh.supabase.co/functions/v1/auto-release-payments \
--                     -H "Authorization: Bearer YOUR_CRON_SECRET"
--
-- 5. Check Supabase logs:
--    Go to Dashboard → Edge Functions → auto-release-payments → Logs
--
-- ============================================================================


