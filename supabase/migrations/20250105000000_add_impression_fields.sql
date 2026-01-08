-- Add impression tracking fields to job_submissions table
-- This enables tracking Twitter impressions for social media jobs
-- and calculating impression bonuses at $5 CPM rate

ALTER TABLE job_submissions
ADD COLUMN IF NOT EXISTS social_impression_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS social_impression_bonus_usd DECIMAL(10, 2) DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN job_submissions.social_impression_count IS 'Verified impression count from Twitter analytics for social media jobs';
COMMENT ON COLUMN job_submissions.social_impression_bonus_usd IS 'Calculated impression bonus at $5 CPM rate (social_impression_count / 1000 * $5)';

