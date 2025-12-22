-- Migration: Social Asset Review System - Sprint 1
-- Description: Add asset classification, approval tracking, and domain support
-- Date: December 22, 2025

-- ============================================================================
-- 1. Add asset_classification column to pending_assets table
-- ============================================================================

ALTER TABLE pending_assets 
ADD COLUMN IF NOT EXISTS asset_classification TEXT NOT NULL DEFAULT 'official';

-- Add check constraint to enforce valid values
ALTER TABLE pending_assets
ADD CONSTRAINT pending_assets_classification_check 
CHECK (asset_classification IN ('official', 'affiliated'));

COMMENT ON COLUMN pending_assets.asset_classification IS 'Classification of asset: official (project-owned) or affiliated (community/partner)';

-- ============================================================================
-- 2. Add asset_classification column to social_assets table
-- ============================================================================

ALTER TABLE social_assets 
ADD COLUMN IF NOT EXISTS asset_classification TEXT NOT NULL DEFAULT 'official';

-- Add check constraint to enforce valid values
ALTER TABLE social_assets
ADD CONSTRAINT social_assets_classification_check 
CHECK (asset_classification IN ('official', 'affiliated'));

COMMENT ON COLUMN social_assets.asset_classification IS 'Classification of asset: official (project-owned) or affiliated (community/partner)';

-- ============================================================================
-- 3. Add approval tracking columns to pending_assets
-- ============================================================================

ALTER TABLE pending_assets
ADD COLUMN IF NOT EXISTS approved_by TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_by TEXT,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add comments for approval tracking columns
COMMENT ON COLUMN pending_assets.approved_by IS 'Wallet address of editor who approved the asset';
COMMENT ON COLUMN pending_assets.approved_at IS 'Timestamp when asset was approved by editor';
COMMENT ON COLUMN pending_assets.rejected_by IS 'Wallet address of editor who rejected the asset';
COMMENT ON COLUMN pending_assets.rejected_at IS 'Timestamp when asset was rejected by editor';
COMMENT ON COLUMN pending_assets.rejection_reason IS 'Reason provided by editor for rejection';

-- ============================================================================
-- 4. Update asset_data JSONB structure documentation
-- ============================================================================

-- Note: JSONB structure is flexible, no schema changes needed
-- Supported structures:
-- - Social: { "platform": "instagram", "handle": "username", "followerTier": "10k-50k" }
-- - Domain: { "domain": "example.com", "url": "https://example.com" }

COMMENT ON COLUMN pending_assets.asset_data IS 'Asset details: For social: {platform, handle, followerTier}. For domain: {domain, url}';

-- ============================================================================
-- 5. Create performance indexes
-- ============================================================================

-- Index for filtering by classification
CREATE INDEX IF NOT EXISTS idx_pending_assets_classification 
ON pending_assets(asset_classification);

-- Index for filtering by verification status
CREATE INDEX IF NOT EXISTS idx_pending_assets_verification_status 
ON pending_assets(verification_status);

-- Index for filtering verified assets by classification
CREATE INDEX IF NOT EXISTS idx_social_assets_classification 
ON social_assets(asset_classification);

-- Composite index for common queries (project + submitter)
CREATE INDEX IF NOT EXISTS idx_pending_assets_project_submitter 
ON pending_assets(project_id, submitter_wallet);

-- Index for approval/rejection tracking
CREATE INDEX IF NOT EXISTS idx_pending_assets_approved_at 
ON pending_assets(approved_at) 
WHERE approved_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pending_assets_rejected_at 
ON pending_assets(rejected_at) 
WHERE rejected_at IS NOT NULL;

-- ============================================================================
-- 6. Backfill existing records with default classification
-- ============================================================================

-- Update any NULL values to 'official' (in case DEFAULT didn't apply)
UPDATE pending_assets 
SET asset_classification = 'official' 
WHERE asset_classification IS NULL;

UPDATE social_assets 
SET asset_classification = 'official' 
WHERE asset_classification IS NULL;

-- ============================================================================
-- 7. Update RLS policies (if needed for new columns)
-- ============================================================================

-- Note: Approval tracking columns should be readable by anyone
-- but only writable by editors/admins (handled at application level)

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verify the changes
DO $$
BEGIN
  RAISE NOTICE 'Migration 056_social_asset_review_system.sql completed successfully';
  RAISE NOTICE 'New columns added to pending_assets: asset_classification, approved_by, approved_at, rejected_by, rejected_at, rejection_reason';
  RAISE NOTICE 'New column added to social_assets: asset_classification';
  RAISE NOTICE 'Indexes created: 6 performance indexes';
END $$;

