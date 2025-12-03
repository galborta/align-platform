-- Migration: Add committed_completion_date to job_applications
-- Created: 2024-11-27
-- Description: Adds committed_completion_date field to track when applicants commit to completing work

-- Add committed_completion_date column with temporary default
ALTER TABLE job_applications 
ADD COLUMN committed_completion_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days');

-- Add comment explaining the field
COMMENT ON COLUMN job_applications.committed_completion_date IS 
  'Timestamp when the applicant commits to completing the work (calculated from estimated_completion during application)';

-- Remove default after backfilling existing records
ALTER TABLE job_applications 
ALTER COLUMN committed_completion_date DROP DEFAULT;

-- Add performance index for deadline queries
CREATE INDEX idx_job_applications_committed_completion 
ON job_applications(committed_completion_date);

-- Add composite index for job + deadline queries
CREATE INDEX idx_job_applications_job_deadline 
ON job_applications(job_id, committed_completion_date);

-- Verification
DO $$
DECLARE
  v_column_exists BOOLEAN;
  v_index_exists BOOLEAN;
BEGIN
  -- Check column was added
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'job_applications' 
    AND column_name = 'committed_completion_date'
  ) INTO v_column_exists;

  IF NOT v_column_exists THEN
    RAISE EXCEPTION 'Migration failed: committed_completion_date column not created';
  END IF;

  -- Check index was created
  SELECT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE tablename = 'job_applications' 
    AND indexname = 'idx_job_applications_committed_completion'
  ) INTO v_index_exists;

  IF NOT v_index_exists THEN
    RAISE EXCEPTION 'Migration failed: idx_job_applications_committed_completion index not created';
  END IF;

  RAISE NOTICE 'Migration 033_add_committed_completion_date completed successfully!';
  RAISE NOTICE '✅ Added committed_completion_date column to job_applications table';
  RAISE NOTICE '✅ Created 2 performance indexes';
  RAISE NOTICE '✅ Backfilled existing applications with 7-day default';
END $$;




