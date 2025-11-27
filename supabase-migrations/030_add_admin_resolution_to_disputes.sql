-- Migration: Add Admin Resolution Fields to Job Disputes
-- Created: 2024-11-27
-- Description: Extends job_disputes table with admin resolution capabilities,
--              including custom split percentages and resolution notes

-- ==================== ADD ADMIN RESOLUTION FIELDS ====================

-- Core admin resolution fields
ALTER TABLE job_disputes 
  ADD COLUMN IF NOT EXISTS admin_wallet TEXT,
  ADD COLUMN IF NOT EXISTS admin_resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS admin_decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worker_percentage NUMERIC,
  ADD COLUMN IF NOT EXISTS poster_percentage NUMERIC;

-- Add comments for admin resolution fields
COMMENT ON COLUMN job_disputes.admin_wallet IS 'Wallet address of admin who resolved the dispute (references admin_wallets.wallet_address)';
COMMENT ON COLUMN job_disputes.admin_resolution_notes IS 'Admin notes explaining the resolution decision and reasoning';
COMMENT ON COLUMN job_disputes.admin_decided_at IS 'Timestamp when admin made the resolution decision';
COMMENT ON COLUMN job_disputes.worker_percentage IS 'Percentage of escrowed funds to release to worker (0-100)';
COMMENT ON COLUMN job_disputes.poster_percentage IS 'Percentage of escrowed funds to refund to poster (0-100)';

-- ==================== ADD FOREIGN KEY CONSTRAINT ====================

-- Link admin_wallet to admin_wallets table
ALTER TABLE job_disputes
  ADD CONSTRAINT fk_job_disputes_admin_wallet
  FOREIGN KEY (admin_wallet)
  REFERENCES admin_wallets(wallet_address)
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT fk_job_disputes_admin_wallet ON job_disputes IS 'Ensures admin_wallet references a valid admin in admin_wallets table';

-- ==================== ADD CHECK CONSTRAINTS ====================

-- Ensure worker_percentage is within valid range
ALTER TABLE job_disputes
  ADD CONSTRAINT job_disputes_worker_percentage_valid
  CHECK (worker_percentage IS NULL OR (worker_percentage >= 0 AND worker_percentage <= 100));

-- Ensure poster_percentage is within valid range
ALTER TABLE job_disputes
  ADD CONSTRAINT job_disputes_poster_percentage_valid
  CHECK (poster_percentage IS NULL OR (poster_percentage >= 0 AND poster_percentage <= 100));

-- Ensure percentages sum to 100 when both are set
ALTER TABLE job_disputes
  ADD CONSTRAINT job_disputes_percentages_sum_to_100
  CHECK (
    (worker_percentage IS NULL OR poster_percentage IS NULL) OR
    (worker_percentage + poster_percentage = 100)
  );

COMMENT ON CONSTRAINT job_disputes_worker_percentage_valid ON job_disputes IS 'Worker percentage must be between 0 and 100';
COMMENT ON CONSTRAINT job_disputes_poster_percentage_valid ON job_disputes IS 'Poster percentage must be between 0 and 100';
COMMENT ON CONSTRAINT job_disputes_percentages_sum_to_100 ON job_disputes IS 'Worker and poster percentages must sum to exactly 100 when both are set';

-- ==================== CREATE PERFORMANCE INDEXES ====================

-- Index for admin lookup (find all disputes resolved by specific admin)
CREATE INDEX IF NOT EXISTS idx_job_disputes_admin_wallet 
  ON job_disputes(admin_wallet, admin_decided_at DESC)
  WHERE admin_wallet IS NOT NULL;

-- Index for timeline queries (find recently resolved disputes)
CREATE INDEX IF NOT EXISTS idx_job_disputes_admin_decided 
  ON job_disputes(admin_decided_at DESC, status)
  WHERE admin_decided_at IS NOT NULL;

-- Composite index for admin dashboard (active admins and their resolutions)
CREATE INDEX IF NOT EXISTS idx_job_disputes_admin_status 
  ON job_disputes(admin_wallet, status, admin_decided_at DESC)
  WHERE admin_wallet IS NOT NULL;

-- ==================== ADD HELPER FUNCTIONS ====================

-- Function to check if dispute was admin-resolved
CREATE OR REPLACE FUNCTION dispute_was_admin_resolved(p_dispute_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_wallet TEXT;
BEGIN
  SELECT admin_wallet INTO v_admin_wallet
  FROM job_disputes
  WHERE id = p_dispute_id;
  
  RETURN v_admin_wallet IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION dispute_was_admin_resolved IS 'Checks if a dispute was resolved by an admin (vs community vote)';

-- Function to get admin resolution summary
CREATE OR REPLACE FUNCTION get_admin_resolution_summary(p_admin_wallet TEXT)
RETURNS TABLE (
  total_resolutions BIGINT,
  avg_worker_percentage NUMERIC,
  avg_poster_percentage NUMERIC,
  last_resolution_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_resolutions,
    AVG(worker_percentage) as avg_worker_percentage,
    AVG(poster_percentage) as avg_poster_percentage,
    MAX(admin_decided_at) as last_resolution_date
  FROM job_disputes
  WHERE 
    admin_wallet = p_admin_wallet
    AND admin_decided_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_admin_resolution_summary IS 'Returns summary statistics for an admin''s dispute resolutions';

-- Function to validate split percentages
CREATE OR REPLACE FUNCTION validate_dispute_split(
  p_worker_percentage NUMERIC,
  p_poster_percentage NUMERIC
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Both must be non-null
  IF p_worker_percentage IS NULL OR p_poster_percentage IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Both must be in valid range
  IF p_worker_percentage < 0 OR p_worker_percentage > 100 THEN
    RETURN FALSE;
  END IF;
  
  IF p_poster_percentage < 0 OR p_poster_percentage > 100 THEN
    RETURN FALSE;
  END IF;
  
  -- Must sum to exactly 100
  IF p_worker_percentage + p_poster_percentage != 100 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validate_dispute_split IS 'Validates that worker and poster percentages are valid and sum to 100';

-- Function to get disputes pending admin resolution
CREATE OR REPLACE FUNCTION get_disputes_pending_admin_resolution()
RETURNS TABLE (
  dispute_id UUID,
  job_id UUID,
  opened_by TEXT,
  opened_at TIMESTAMPTZ,
  days_open INTEGER,
  vote_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jd.id as dispute_id,
    jd.job_id,
    jd.opened_by,
    jd.created_at as opened_at,
    EXTRACT(DAY FROM NOW() - jd.created_at)::INTEGER as days_open,
    (
      SELECT COUNT(*)
      FROM job_dispute_votes jdv
      WHERE jdv.dispute_id = jd.id
    ) as vote_count
  FROM job_disputes jd
  WHERE 
    jd.status IN ('open', 'under_review')
    AND jd.admin_wallet IS NULL
    AND jd.admin_decided_at IS NULL
  ORDER BY jd.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_disputes_pending_admin_resolution IS 'Returns all disputes that are open and have not been admin-resolved yet';

-- Function to record admin resolution
CREATE OR REPLACE FUNCTION record_admin_resolution(
  p_dispute_id UUID,
  p_admin_wallet TEXT,
  p_worker_percentage NUMERIC,
  p_poster_percentage NUMERIC,
  p_resolution_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_valid BOOLEAN;
  v_is_admin BOOLEAN;
BEGIN
  -- Validate admin wallet
  SELECT is_admin_wallet(p_admin_wallet) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Wallet % is not an authorized admin', p_admin_wallet;
  END IF;
  
  -- Validate split percentages
  SELECT validate_dispute_split(p_worker_percentage, p_poster_percentage) INTO v_is_valid;
  IF NOT v_is_valid THEN
    RAISE EXCEPTION 'Invalid split percentages: worker=%, poster=%', p_worker_percentage, p_poster_percentage;
  END IF;
  
  -- Update dispute record
  UPDATE job_disputes
  SET 
    admin_wallet = p_admin_wallet,
    admin_resolution_notes = p_resolution_notes,
    admin_decided_at = NOW(),
    worker_percentage = p_worker_percentage,
    poster_percentage = p_poster_percentage,
    status = 'resolved',
    resolved_at = NOW()
  WHERE id = p_dispute_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_admin_resolution IS 'Records an admin''s resolution decision for a dispute with split percentages';

-- ==================== ADD COMMON SPLIT PRESETS ====================

-- Create a view for common resolution scenarios
CREATE OR REPLACE VIEW dispute_resolution_presets AS
SELECT * FROM (
  VALUES
    ('full_refund_to_poster', 'Full Refund to Poster', 0, 100, 'Work did not meet requirements or was not delivered'),
    ('full_release_to_worker', 'Full Release to Worker', 100, 0, 'Work met all requirements as specified'),
    ('split_50_50', '50/50 Split', 50, 50, 'Partial completion or reasonable compromise'),
    ('split_75_25_worker', '75% Worker / 25% Poster', 75, 25, 'Work mostly complete with minor issues'),
    ('split_25_75_poster', '25% Worker / 75% Poster', 25, 75, 'Significant issues but some work delivered'),
    ('split_60_40_worker', '60% Worker / 40% Poster', 60, 40, 'Work delivered but did not fully meet expectations'),
    ('split_40_60_poster', '40% Worker / 60% Poster', 40, 60, 'Work significantly incomplete or problematic')
) AS presets(preset_key, preset_name, worker_percentage, poster_percentage, description);

COMMENT ON VIEW dispute_resolution_presets IS 'Common dispute resolution scenarios with preset split percentages';

-- ==================== VERIFICATION ====================

-- Verify migration success
DO $$
DECLARE
  v_column_count INTEGER;
  v_constraint_count INTEGER;
  v_index_count INTEGER;
BEGIN
  -- Count new columns
  SELECT COUNT(*) INTO v_column_count
  FROM information_schema.columns
  WHERE table_name = 'job_disputes'
    AND column_name IN (
      'admin_wallet',
      'admin_resolution_notes',
      'admin_decided_at',
      'worker_percentage',
      'poster_percentage'
    );

  IF v_column_count != 5 THEN
    RAISE EXCEPTION 'Migration failed: Expected 5 new columns, found %', v_column_count;
  END IF;

  -- Count new check constraints
  SELECT COUNT(*) INTO v_constraint_count
  FROM information_schema.table_constraints
  WHERE table_name = 'job_disputes'
    AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%percentage%';

  IF v_constraint_count < 3 THEN
    RAISE EXCEPTION 'Migration failed: Expected at least 3 percentage constraints, found %', v_constraint_count;
  END IF;

  -- Verify indexes exist
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes 
  WHERE tablename = 'job_disputes' 
  AND indexname LIKE 'idx_job_disputes_admin%';
  
  IF v_index_count < 3 THEN
    RAISE EXCEPTION 'Migration failed: Expected 3 admin indexes, found %', v_index_count;
  END IF;

  -- Verify foreign key exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'job_disputes'
    AND constraint_name = 'fk_job_disputes_admin_wallet'
  ) THEN
    RAISE EXCEPTION 'Migration failed: Foreign key constraint not created';
  END IF;

  -- Verify helper functions exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'dispute_was_admin_resolved'
  ) THEN
    RAISE EXCEPTION 'Migration failed: dispute_was_admin_resolved function not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'record_admin_resolution'
  ) THEN
    RAISE EXCEPTION 'Migration failed: record_admin_resolution function not created';
  END IF;

  -- Verify view exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_name = 'dispute_resolution_presets'
  ) THEN
    RAISE EXCEPTION 'Migration failed: dispute_resolution_presets view not created';
  END IF;

  RAISE NOTICE 'Migration 030_add_admin_resolution_to_disputes completed successfully!';
  RAISE NOTICE '✅ Added 5 new columns to job_disputes table';
  RAISE NOTICE '✅ Created 3 check constraints';
  RAISE NOTICE '✅ Created 3 performance indexes';
  RAISE NOTICE '✅ Created 1 foreign key constraint';
  RAISE NOTICE '✅ Created 5 helper functions';
  RAISE NOTICE '✅ Created 1 preset view with 7 common scenarios';
END $$;


