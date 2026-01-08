-- Add indexes for duplicate detection performance
-- Sprint 3: Social Media Jobs - Duplicate Detection

/**
 * Job Submissions Duplicate Detection Indexes
 * 
 * These indexes optimize duplicate detection queries:
 * 1. Worker duplicate check (same worker, same job)
 * 2. Tweet duplicate check (same tweet ID, same job)
 * 
 * Why these indexes matter:
 * - Worker duplicate: O(1) lookup instead of full table scan
 * - Tweet duplicate: Faster filtering by job_id before checking URLs
 * - Combined indexes are more efficient than separate ones
 */

-- Index for checking if worker already submitted to a job
-- Used in: /api/jobs/social/[jobId]/submit
-- Query: SELECT * FROM job_submissions WHERE job_id = ? AND worker_wallet = ?
CREATE INDEX IF NOT EXISTS idx_job_submissions_worker_duplicate 
ON job_submissions(job_id, worker_wallet)
WHERE social_tweet_link IS NOT NULL;

-- Index for checking duplicate tweets within a job
-- Used in: /api/jobs/social/[jobId]/submit
-- Query: SELECT * FROM job_submissions WHERE job_id = ? AND social_tweet_link IS NOT NULL
CREATE INDEX IF NOT EXISTS idx_job_submissions_tweet_lookup 
ON job_submissions(job_id, social_tweet_link)
WHERE social_tweet_link IS NOT NULL;

-- Composite index for social job submissions listing
-- Optimizes queries that filter by worker and status
-- Used in: Worker dashboard, submission tracking
CREATE INDEX IF NOT EXISTS idx_job_submissions_worker_status 
ON job_submissions(worker_wallet, social_approval_status, submitted_at DESC)
WHERE social_approval_status IS NOT NULL;

-- Add helpful comments
COMMENT ON INDEX idx_job_submissions_worker_duplicate IS 
  'Optimizes worker duplicate detection: checks if wallet already submitted to a job';

COMMENT ON INDEX idx_job_submissions_tweet_lookup IS 
  'Optimizes tweet duplicate detection: filters submissions by job before URL comparison';

COMMENT ON INDEX idx_job_submissions_worker_status IS 
  'Optimizes worker submission listings: filters by wallet and status with date sorting';

-- Analyze table to update query planner statistics
ANALYZE job_submissions;

