-- Add field to track when judging notification was sent for contests
-- This prevents duplicate notifications being sent to posters

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS judging_notification_sent_at TIMESTAMPTZ;

-- Add index for efficient cron job queries
CREATE INDEX IF NOT EXISTS idx_jobs_contest_judging_notifications 
ON jobs (is_contest, contest_winners_selected_at, judging_notification_sent_at, contest_submission_deadline)
WHERE is_contest = TRUE;

-- Add helpful comment
COMMENT ON COLUMN jobs.judging_notification_sent_at IS 'Timestamp when the poster was notified that their contest is ready for judging (submission deadline passed)';








