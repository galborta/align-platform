-- Migration: Add Revision Offering Fields to Job Applications Table
-- Created: 2024-12-05
-- Description: Adds revision offering tracking to job applications,
--              allowing workers to specify revision offerings when applying

-- ==================== ADD REVISION OFFERING FIELDS ====================

-- Number of revisions offered (can be a number or 'unlimited')
ALTER TABLE job_applications 
  ADD COLUMN IF NOT EXISTS revisions_offered TEXT;

-- Number of revisions actually used
ALTER TABLE job_applications 
  ADD COLUMN IF NOT EXISTS revisions_used INTEGER DEFAULT 0;

-- Remaining revisions (computed from offered - used, or 'unlimited')
ALTER TABLE job_applications 
  ADD COLUMN IF NOT EXISTS revisions_remaining TEXT;

-- Timestamp of last revision request for this application
ALTER TABLE job_applications 
  ADD COLUMN IF NOT EXISTS last_revision_requested_at TIMESTAMPTZ;

-- ==================== ADD CHECK CONSTRAINTS ====================

-- Constraint: revisions_offered must be NULL, 'unlimited', or valid integer >= 0
ALTER TABLE job_applications
  ADD CONSTRAINT job_applications_revisions_offered_valid 
  CHECK (
    revisions_offered IS NULL 
    OR revisions_offered = 'unlimited' 
    OR (
      revisions_offered ~ '^[0-9]+$' 
      AND revisions_offered::INTEGER >= 0
    )
  );

-- Constraint: revisions_used must be >= 0
ALTER TABLE job_applications
  ADD CONSTRAINT job_applications_revisions_used_non_negative 
  CHECK (revisions_used >= 0);

-- ==================== ADD HELPFUL COMMENTS ====================

COMMENT ON COLUMN job_applications.revisions_offered IS 'Number of revisions offered by worker when applying. Can be NULL (not specified), ''unlimited'', or a number string like ''3''';
COMMENT ON COLUMN job_applications.revisions_used IS 'Number of revisions already used/requested for this worker''s assignment';
COMMENT ON COLUMN job_applications.revisions_remaining IS 'Computed remaining revisions: ''unlimited'' if unlimited, or (offered - used). NULL if no revisions were offered';
COMMENT ON COLUMN job_applications.last_revision_requested_at IS 'Timestamp of the most recent revision request for work from this application';

-- ==================== CREATE INDEX ====================

-- Index for finding applications with remaining revisions
CREATE INDEX IF NOT EXISTS idx_job_applications_revisions 
  ON job_applications(job_id, revisions_offered, revisions_used)
  WHERE revisions_offered IS NOT NULL;

-- ==================== ADD HELPER FUNCTION ====================

-- Function to calculate remaining revisions
CREATE OR REPLACE FUNCTION calculate_revisions_remaining(
  p_offered TEXT,
  p_used INTEGER
) RETURNS TEXT AS $$
BEGIN
  -- If no revisions offered, return NULL
  IF p_offered IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- If unlimited, always return 'unlimited'
  IF p_offered = 'unlimited' THEN
    RETURN 'unlimited';
  END IF;
  
  -- Calculate remaining (offered - used), minimum 0
  RETURN GREATEST(p_offered::INTEGER - COALESCE(p_used, 0), 0)::TEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_revisions_remaining IS 'Calculates remaining revisions based on offered amount and used count';

-- ==================== CREATE TRIGGER FOR AUTO-UPDATE ====================

-- Trigger function to auto-update revisions_remaining
CREATE OR REPLACE FUNCTION update_revisions_remaining()
RETURNS TRIGGER AS $$
BEGIN
  NEW.revisions_remaining := calculate_revisions_remaining(
    NEW.revisions_offered, 
    NEW.revisions_used
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_revisions_remaining ON job_applications;
CREATE TRIGGER trigger_update_revisions_remaining
  BEFORE INSERT OR UPDATE OF revisions_offered, revisions_used
  ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_revisions_remaining();

-- ==================== DATA MIGRATION ====================

-- Backfill revisions_used to 0 for existing applications
UPDATE job_applications 
SET revisions_used = 0 
WHERE revisions_used IS NULL;

-- ==================== VERIFICATION ====================

DO $$
DECLARE
  v_column_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_column_count
  FROM information_schema.columns
  WHERE table_name = 'job_applications'
    AND column_name IN (
      'revisions_offered',
      'revisions_used',
      'revisions_remaining',
      'last_revision_requested_at'
    );

  IF v_column_count != 4 THEN
    RAISE EXCEPTION 'Migration failed: Expected 4 new columns, found %', v_column_count;
  END IF;

  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '✅ Added 4 new columns to job_applications table';
  RAISE NOTICE '✅ Added check constraints for data validation';
  RAISE NOTICE '✅ Created auto-update trigger for revisions_remaining';
  RAISE NOTICE '✅ Backfilled existing data';
END $$;




