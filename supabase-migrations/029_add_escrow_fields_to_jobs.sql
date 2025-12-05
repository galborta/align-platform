-- Migration: Add Escrow Fields to Jobs Table
-- Created: 2024-11-27
-- Description: Extends jobs table with escrow tracking, deadline management, 
--              and revision control for complete job lifecycle management

-- ==================== ADD ESCROW TRACKING FIELDS ====================

-- Core escrow status
ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS escrow_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS escrow_tx_signature TEXT,
  ADD COLUMN IF NOT EXISTS escrow_amount_tokens NUMERIC,
  ADD COLUMN IF NOT EXISTS escrow_token_mint TEXT;

-- Add comments for escrow fields
COMMENT ON COLUMN jobs.escrow_locked IS 'Whether funds are currently locked in escrow (true after successful lock transaction)';
COMMENT ON COLUMN jobs.escrow_tx_signature IS 'Solana transaction signature of the initial escrow lock transaction';
COMMENT ON COLUMN jobs.escrow_amount_tokens IS 'Total amount locked in escrow (job payment + platform fee)';
COMMENT ON COLUMN jobs.escrow_token_mint IS 'Token mint address of the escrowed tokens';

-- ==================== ADD DEADLINE MANAGEMENT FIELDS ====================

-- Timeline tracking
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS poster_desired_completion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worker_committed_completion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hard_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS release_scheduled_at TIMESTAMPTZ;

-- Add comments for deadline fields
COMMENT ON COLUMN jobs.poster_desired_completion IS 'When the poster would like the work completed (informational, not enforced)';
COMMENT ON COLUMN jobs.worker_committed_completion IS 'When the worker commits to completing the work (set on assignment)';
COMMENT ON COLUMN jobs.hard_deadline IS 'Absolute deadline after which job is auto-cancelled/reassigned (optional)';
COMMENT ON COLUMN jobs.release_scheduled_at IS 'Scheduled automatic payment release timestamp (typically submitted_at + 10 days)';

-- ==================== ADD PAYMENT RELEASE CONTROLS ====================

-- Release pause mechanism (for disputes, revisions, etc.)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS release_paused BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS release_paused_by TEXT,
  ADD COLUMN IF NOT EXISTS release_paused_at TIMESTAMPTZ;

-- Add comments for release control fields
COMMENT ON COLUMN jobs.release_paused IS 'Whether automatic payment release is paused (true during disputes or revision requests)';
COMMENT ON COLUMN jobs.release_paused_by TEXT IS 'Wallet address of who paused the release (poster, worker, or admin)';
COMMENT ON COLUMN jobs.release_paused_at IS 'When the release was paused';

-- ==================== ADD REVISION TRACKING ====================

-- Revision request tracking
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS revision_requests_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_revision_requested_at TIMESTAMPTZ;

-- Add comments for revision fields
COMMENT ON COLUMN jobs.revision_requests_count IS 'Number of times the poster has requested revisions (informational)';
COMMENT ON COLUMN jobs.last_revision_requested_at IS 'Timestamp of the most recent revision request';

-- Add check constraint for non-negative revision count
ALTER TABLE jobs
  ADD CONSTRAINT jobs_revision_count_non_negative 
  CHECK (revision_requests_count >= 0);

-- ==================== ADD FEE TRACKING ====================

-- Lock fee at job creation time
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS fee_percentage_at_creation NUMERIC DEFAULT 5.0;

-- Add comment for fee field
COMMENT ON COLUMN jobs.fee_percentage_at_creation IS 'Platform fee percentage locked at job creation time (prevents fee changes affecting existing jobs)';

-- Add check constraint for valid fee percentage
ALTER TABLE jobs
  ADD CONSTRAINT jobs_fee_percentage_valid 
  CHECK (fee_percentage_at_creation >= 0 AND fee_percentage_at_creation <= 100);

-- ==================== CREATE PERFORMANCE INDEXES ====================

-- Index for escrow status queries
CREATE INDEX IF NOT EXISTS idx_jobs_escrow_locked 
  ON jobs(escrow_locked, created_at DESC)
  WHERE escrow_locked = true;

-- Index for deadline monitoring
CREATE INDEX IF NOT EXISTS idx_jobs_hard_deadline 
  ON jobs(hard_deadline, status)
  WHERE hard_deadline IS NOT NULL;

-- Index for scheduled release processing
CREATE INDEX IF NOT EXISTS idx_jobs_release_scheduled 
  ON jobs(release_scheduled_at, release_paused, status)
  WHERE release_scheduled_at IS NOT NULL;

-- Index for paused releases (admin monitoring)
CREATE INDEX IF NOT EXISTS idx_jobs_release_paused 
  ON jobs(release_paused, release_paused_at DESC)
  WHERE release_paused = true;

-- Composite index for escrow + status queries
CREATE INDEX IF NOT EXISTS idx_jobs_escrow_status 
  ON jobs(escrow_locked, status, created_at DESC);

-- ==================== ADD HELPER FUNCTIONS ====================

-- Function to check if job has active escrow
CREATE OR REPLACE FUNCTION job_has_active_escrow(p_job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_escrow_locked BOOLEAN;
BEGIN
  SELECT escrow_locked INTO v_escrow_locked
  FROM jobs
  WHERE id = p_job_id;
  
  RETURN COALESCE(v_escrow_locked, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION job_has_active_escrow IS 'Checks if a job currently has funds locked in escrow';

-- Function to calculate time until scheduled release
CREATE OR REPLACE FUNCTION time_until_release(p_job_id UUID)
RETURNS INTERVAL AS $$
DECLARE
  v_release_scheduled_at TIMESTAMPTZ;
BEGIN
  SELECT release_scheduled_at INTO v_release_scheduled_at
  FROM jobs
  WHERE id = p_job_id;
  
  IF v_release_scheduled_at IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN v_release_scheduled_at - NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION time_until_release IS 'Returns interval until scheduled payment release for a job';

-- Function to check if release is overdue
CREATE OR REPLACE FUNCTION is_release_overdue(p_job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_release_scheduled_at TIMESTAMPTZ;
  v_release_paused BOOLEAN;
  v_status TEXT;
BEGIN
  SELECT release_scheduled_at, release_paused, status
  INTO v_release_scheduled_at, v_release_paused, v_status
  FROM jobs
  WHERE id = p_job_id;
  
  -- Not overdue if no scheduled release
  IF v_release_scheduled_at IS NULL THEN
    RETURN false;
  END IF;
  
  -- Not overdue if paused
  IF v_release_paused = true THEN
    RETURN false;
  END IF;
  
  -- Not overdue if not in submitted status
  IF v_status != 'submitted' THEN
    RETURN false;
  END IF;
  
  -- Check if past scheduled time
  RETURN NOW() >= v_release_scheduled_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_release_overdue IS 'Checks if a job payment release is overdue (past scheduled time and not paused)';

-- Function to get jobs needing auto-release
CREATE OR REPLACE FUNCTION get_jobs_needing_auto_release()
RETURNS TABLE (
  job_id UUID,
  release_scheduled_at TIMESTAMPTZ,
  time_overdue INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id as job_id,
    jobs.release_scheduled_at,
    NOW() - jobs.release_scheduled_at as time_overdue
  FROM jobs
  WHERE 
    status = 'submitted'
    AND release_scheduled_at IS NOT NULL
    AND release_scheduled_at <= NOW()
    AND release_paused = false
    AND escrow_locked = true
  ORDER BY release_scheduled_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_jobs_needing_auto_release IS 'Returns all jobs that are past their scheduled release time and need automatic payment release';

-- ==================== DATA MIGRATION ====================

-- Backfill fee_percentage_at_creation for existing jobs
UPDATE jobs 
SET fee_percentage_at_creation = 5.0 
WHERE fee_percentage_at_creation IS NULL;

-- Backfill escrow_locked for existing jobs (default to false)
UPDATE jobs 
SET escrow_locked = false 
WHERE escrow_locked IS NULL;

-- Backfill release_paused for existing jobs (default to false)
UPDATE jobs 
SET release_paused = false 
WHERE release_paused IS NULL;

-- Backfill revision_requests_count for existing jobs (default to 0)
UPDATE jobs 
SET revision_requests_count = 0 
WHERE revision_requests_count IS NULL;

-- For submitted jobs, set release_scheduled_at if not already set (10 days from submission)
UPDATE jobs
SET release_scheduled_at = submitted_at + INTERVAL '10 days'
WHERE 
  status = 'submitted'
  AND submitted_at IS NOT NULL
  AND release_scheduled_at IS NULL;

-- ==================== VERIFICATION ====================

-- Verify migration success
DO $$
DECLARE
  v_column_count INTEGER;
BEGIN
  -- Count new columns
  SELECT COUNT(*) INTO v_column_count
  FROM information_schema.columns
  WHERE table_name = 'jobs'
    AND column_name IN (
      'escrow_locked',
      'escrow_tx_signature',
      'escrow_amount_tokens',
      'escrow_token_mint',
      'poster_desired_completion',
      'worker_committed_completion',
      'hard_deadline',
      'release_scheduled_at',
      'release_paused',
      'release_paused_by',
      'release_paused_at',
      'revision_requests_count',
      'last_revision_requested_at',
      'fee_percentage_at_creation'
    );

  IF v_column_count != 14 THEN
    RAISE EXCEPTION 'Migration failed: Expected 14 new columns, found %', v_column_count;
  END IF;

  -- Verify indexes exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'jobs' 
    AND indexname = 'idx_jobs_escrow_locked'
  ) THEN
    RAISE EXCEPTION 'Migration failed: idx_jobs_escrow_locked index not created';
  END IF;

  -- Verify helper functions exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'job_has_active_escrow'
  ) THEN
    RAISE EXCEPTION 'Migration failed: job_has_active_escrow function not created';
  END IF;

  RAISE NOTICE 'Migration 029_add_escrow_fields_to_jobs completed successfully!';
  RAISE NOTICE '✅ Added 14 new columns to jobs table';
  RAISE NOTICE '✅ Created 5 performance indexes';
  RAISE NOTICE '✅ Created 4 helper functions';
  RAISE NOTICE '✅ Backfilled existing data';
  RAISE NOTICE '✅ Added check constraints';
END $$;






