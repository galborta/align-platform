-- Add performance indexes for social media jobs
-- Sprint 1: Foundation & Database Setup

-- Index for filtering jobs by social job type
-- Useful for listing all retweet jobs or original tweet jobs
CREATE INDEX IF NOT EXISTS idx_jobs_social_type 
  ON jobs(social_job_type) 
  WHERE is_social_media_job = true;

-- Index for finding submissions by tweet link
-- Useful for detecting duplicate submissions and verification
CREATE INDEX IF NOT EXISTS idx_job_submissions_social_tweet 
  ON job_submissions(social_tweet_link) 
  WHERE social_tweet_link IS NOT NULL;

-- Index for social job queries by status
-- Useful for poster review dashboard and payment distribution
CREATE INDEX IF NOT EXISTS idx_job_submissions_social_status 
  ON job_submissions(job_id, social_approval_status) 
  WHERE social_approval_status IS NOT NULL;

-- Index for jobs by submission deadline (for cron jobs)
-- Useful for auto-approval after deadline passes
CREATE INDEX IF NOT EXISTS idx_jobs_social_submission_deadline 
  ON jobs(social_submission_deadline) 
  WHERE is_social_media_job = true 
    AND social_submission_deadline IS NOT NULL;

-- Index for jobs by review deadline (for cron jobs)
-- Useful for auto-approval of pending submissions
CREATE INDEX IF NOT EXISTS idx_jobs_social_review_deadline 
  ON jobs(social_review_deadline) 
  WHERE is_social_media_job = true 
    AND social_review_deadline IS NOT NULL 
    AND social_payments_distributed = false;

-- Add helpful comments
COMMENT ON INDEX idx_jobs_social_type IS 'Speeds up queries filtering social jobs by type (retweet vs original_tweet)';
COMMENT ON INDEX idx_job_submissions_social_tweet IS 'Prevents duplicate submissions and speeds up tweet link lookups';
COMMENT ON INDEX idx_job_submissions_social_status IS 'Optimizes poster review dashboard queries and payment distribution';
COMMENT ON INDEX idx_jobs_social_submission_deadline IS 'Enables efficient cron job queries for deadline enforcement';
COMMENT ON INDEX idx_jobs_social_review_deadline IS 'Enables efficient cron job queries for auto-approval of pending submissions';

