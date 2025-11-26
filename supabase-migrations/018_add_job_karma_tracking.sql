-- Migration: Add Job Karma Tracking to wallet_karma
-- Description: Extends wallet_karma table to track job system participation and success rates

-- Add job tracking columns to wallet_karma
ALTER TABLE wallet_karma
ADD COLUMN IF NOT EXISTS applications_submitted_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS jobs_completed_as_worker_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS jobs_posted_as_poster_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS dispute_votes_cast_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS dispute_votes_won_count INTEGER DEFAULT 0;

-- Add check constraints to ensure non-negative values
ALTER TABLE wallet_karma
ADD CONSTRAINT applications_submitted_non_negative CHECK (applications_submitted_count >= 0);

ALTER TABLE wallet_karma
ADD CONSTRAINT jobs_completed_worker_non_negative CHECK (jobs_completed_as_worker_count >= 0);

ALTER TABLE wallet_karma
ADD CONSTRAINT jobs_posted_non_negative CHECK (jobs_posted_as_poster_count >= 0);

ALTER TABLE wallet_karma
ADD CONSTRAINT dispute_votes_cast_non_negative CHECK (dispute_votes_cast_count >= 0);

ALTER TABLE wallet_karma
ADD CONSTRAINT dispute_votes_won_non_negative CHECK (dispute_votes_won_count >= 0);

-- Add check to ensure dispute_votes_won_count <= dispute_votes_cast_count
ALTER TABLE wallet_karma
ADD CONSTRAINT dispute_votes_won_lte_cast CHECK (dispute_votes_won_count <= dispute_votes_cast_count);

-- Create index for job stats queries and leaderboards
CREATE INDEX IF NOT EXISTS idx_wallet_karma_job_stats 
ON wallet_karma(project_id, jobs_posted_as_poster_count DESC, jobs_completed_as_worker_count DESC);

-- Create index for dispute accuracy queries
CREATE INDEX IF NOT EXISTS idx_wallet_karma_dispute_stats 
ON wallet_karma(project_id, dispute_votes_cast_count DESC, dispute_votes_won_count DESC);

-- Comment the columns for documentation
COMMENT ON COLUMN wallet_karma.applications_submitted_count IS 'Total number of job applications submitted by this wallet';
COMMENT ON COLUMN wallet_karma.jobs_completed_as_worker_count IS 'Number of jobs successfully completed as the worker';
COMMENT ON COLUMN wallet_karma.jobs_posted_as_poster_count IS 'Number of jobs posted by this wallet';
COMMENT ON COLUMN wallet_karma.dispute_votes_cast_count IS 'Total dispute votes cast (both release and refund)';
COMMENT ON COLUMN wallet_karma.dispute_votes_won_count IS 'Number of dispute votes where user voted with winning side';




