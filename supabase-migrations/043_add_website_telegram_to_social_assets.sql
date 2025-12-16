-- Add website and telegram columns to social_assets table
-- These fields store basic info from Step 1 (no verification required)
-- while platform/handle fields store verified social accounts from Step 2

ALTER TABLE social_assets
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS telegram TEXT;

-- Add helpful comment
COMMENT ON COLUMN social_assets.website IS 'Project official website URL (from Step 1, shows immediately)';
COMMENT ON COLUMN social_assets.telegram IS 'Telegram community link or username (from Step 1, shows immediately)';
