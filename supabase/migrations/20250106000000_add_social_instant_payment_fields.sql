-- Migration: Add Instant Payment Budget Tracking Fields
-- Created: 2025-01-06
-- Description: Adds real-time budget tracking fields to support instant payment system
--              for social media jobs. This enables:
--              1. Real-time budget countdown visible to workers (creates urgency)
--              2. Pessimistic locking to prevent double-spend during concurrent approvals
--              3. Tracking count of successfully paid workers
--
-- Architecture: Instant payment model where workers are paid immediately upon approval
--              rather than batch payments at campaign end. Budget decrements in real-time.

-- ==================== ADD NEW COLUMNS ====================

-- Add missing reserved budget column (required by existing reserve_social_budget function)
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS social_reserved_budget NUMERIC(20,8) DEFAULT 0 NOT NULL;

-- Add real-time budget tracking fields
ALTER TABLE jobs 
ADD COLUMN social_remaining_budget_tokens NUMERIC(20,8);

ALTER TABLE jobs 
ADD COLUMN social_locked_budget_tokens NUMERIC(20,8) DEFAULT 0 NOT NULL;

ALTER TABLE jobs 
ADD COLUMN social_approved_paid_count INTEGER DEFAULT 0 NOT NULL;

-- ==================== INITIALIZE EXISTING DATA ====================

-- For existing social media jobs, initialize the new budget tracking fields
-- This ensures smooth transition from old batch payment model to new instant payment model
UPDATE jobs
SET 
  social_remaining_budget_tokens = COALESCE(social_total_budget_tokens, 0),
  social_locked_budget_tokens = 0,
  social_approved_paid_count = 0,
  social_reserved_budget = 0
WHERE is_social_media_job = TRUE
  AND social_remaining_budget_tokens IS NULL;

-- Make remaining budget NOT NULL after initialization
ALTER TABLE jobs
ALTER COLUMN social_remaining_budget_tokens SET NOT NULL;

-- ==================== ADD INDEXES ====================

-- Index for budget queries (workers checking if budget is available)
-- This query pattern: WHERE is_social_media_job = true AND social_remaining_budget_tokens > 0
CREATE INDEX idx_jobs_social_remaining_budget 
  ON jobs(social_remaining_budget_tokens) 
  WHERE is_social_media_job = TRUE;

-- Composite index for finding open social jobs with available budget
CREATE INDEX idx_jobs_social_open_with_budget 
  ON jobs(is_social_media_job, social_remaining_budget_tokens, created_at DESC)
  WHERE is_social_media_job = TRUE 
    AND social_remaining_budget_tokens > 0;

-- Index for tracking paid worker count (for analytics and tier thresholds)
CREATE INDEX idx_jobs_social_paid_count 
  ON jobs(social_approved_paid_count) 
  WHERE is_social_media_job = TRUE;

-- ==================== ADD COMMENTS ====================

COMMENT ON COLUMN jobs.social_reserved_budget IS 
  'Budget reserved for pending transactions (used by reserve_social_budget function). Prevents double-spending when multiple approvals happen simultaneously.';

COMMENT ON COLUMN jobs.social_remaining_budget_tokens IS 
  'Real-time remaining budget in tokens. Decrements with each approved payment. Displayed to workers to create urgency. Formula: Total Budget - (Released + Locked).';

COMMENT ON COLUMN jobs.social_locked_budget_tokens IS 
  'Budget currently locked in pending blockchain transactions. Prevents over-committing during concurrent approvals. Unlocked on transaction confirm/fail.';

COMMENT ON COLUMN jobs.social_approved_paid_count IS 
  'Count of workers who have been successfully paid (transaction confirmed). Used for tier thresholds and analytics. Increments only on payment confirmation, not approval.';

-- ==================== VALIDATION CHECK ====================

-- Verify all existing social jobs have been initialized
DO $$
DECLARE
  v_uninitialized_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_uninitialized_count
  FROM jobs
  WHERE is_social_media_job = TRUE
    AND (
      social_remaining_budget_tokens IS NULL 
      OR social_locked_budget_tokens IS NULL 
      OR social_approved_paid_count IS NULL
      OR social_reserved_budget IS NULL
    );
  
  IF v_uninitialized_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % social media jobs have uninitialized budget fields', v_uninitialized_count;
  END IF;
  
  RAISE NOTICE 'Migration successful: All social media jobs initialized with budget tracking fields';
END $$;

-- ==================== ROLLBACK INSTRUCTIONS ====================

-- To rollback this migration (NOT automatically executed):
--
-- DROP INDEX IF EXISTS idx_jobs_social_remaining_budget;
-- DROP INDEX IF EXISTS idx_jobs_social_open_with_budget;
-- DROP INDEX IF EXISTS idx_jobs_social_paid_count;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS social_reserved_budget;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS social_remaining_budget_tokens;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS social_locked_budget_tokens;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS social_approved_paid_count;

