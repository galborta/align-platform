-- Migration: Add Follower-Based Tier Support for Instant Payment System
-- Created: 2025-01-06
-- Description: Adds social_follower_tiers field to support follower-based payment tiers
--              for the new instant payment system. This enables per-person payments based
--              on follower count instead of batch proportional payments.
--
-- Architecture: Follower tiers define fixed per-person payments (e.g., "500-1000 followers = $10")
--              instead of total budget pools (e.g., "1-10 people = $500 total").
--              Minimum 500 followers required to prevent new account exploitation.

-- ==================== ADD FOLLOWER TIERS FIELD ====================

-- Add JSONB field to store follower-based tier configuration
ALTER TABLE jobs 
ADD COLUMN social_follower_tiers JSONB;

-- Add flag to indicate which payment system this job uses
ALTER TABLE jobs 
ADD COLUMN uses_instant_payment BOOLEAN DEFAULT FALSE;

-- ==================== ADD COMMENTS ====================

COMMENT ON COLUMN jobs.social_follower_tiers IS 
  'Follower-based payment tiers for instant payment system. Array of tier objects: [{min_followers, max_followers, base_payment_usd, tier_name}]. Example: [{"min_followers": 500, "max_followers": 1000, "base_payment_usd": 10, "tier_name": "Micro"}]. Workers paid instantly based on their follower tier upon approval. Minimum 500 followers required to prevent new account exploitation.';

COMMENT ON COLUMN jobs.uses_instant_payment IS 
  'Whether this job uses the instant payment system (true) or legacy batch payment system (false). All new jobs with social_follower_tiers use instant payment. Legacy jobs without follower tiers use batch payment until they complete.';

-- ==================== ADD INDEX ====================

-- Index for finding jobs using follower tiers (for analytics and migration tracking)
CREATE INDEX idx_jobs_has_follower_tiers 
  ON jobs((social_follower_tiers IS NOT NULL))
  WHERE is_social_media_job = TRUE;

-- ==================== DATA VALIDATION ====================

-- Verify table structure is correct
DO $$
BEGIN
  -- Check if column was created successfully
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'social_follower_tiers'
  ) THEN
    RAISE EXCEPTION 'Failed to add social_follower_tiers column';
  END IF;
  
  RAISE NOTICE 'Migration successful: social_follower_tiers column added';
END $$;

-- ==================== ROLLBACK INSTRUCTIONS ====================

-- To rollback this migration (NOT automatically executed):
--
-- DROP INDEX IF EXISTS idx_jobs_has_follower_tiers;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS uses_instant_payment;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS social_follower_tiers;

