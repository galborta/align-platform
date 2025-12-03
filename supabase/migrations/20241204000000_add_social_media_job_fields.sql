-- Add social media job-specific fields to jobs table

-- Social media job identification and type
ALTER TABLE jobs ADD COLUMN is_social_media_job BOOLEAN DEFAULT FALSE;

ALTER TABLE jobs ADD COLUMN social_job_type TEXT CHECK (social_job_type IN ('retweet', 'original_tweet'));

-- Job content (mutually exclusive based on type)
ALTER TABLE jobs ADD COLUMN social_tweet_url TEXT;  -- For retweets

ALTER TABLE jobs ADD COLUMN social_tweet_topic TEXT;  -- For original tweets

-- Timeline fields (all auto-calculated on creation)
ALTER TABLE jobs ADD COLUMN social_submission_deadline TIMESTAMPTZ;  -- 48hrs from creation

ALTER TABLE jobs ADD COLUMN social_engagement_deadline TIMESTAMPTZ;  -- +24hrs after submission

ALTER TABLE jobs ADD COLUMN social_review_deadline TIMESTAMPTZ;  -- +48hrs after engagement

-- Budget configuration
ALTER TABLE jobs ADD COLUMN social_total_budget_tokens NUMERIC(20,8);  -- Maximum budget

ALTER TABLE jobs ADD COLUMN social_total_budget_usd NUMERIC(20,2);

ALTER TABLE jobs ADD COLUMN social_budget_tiers JSONB;  -- Array of tier objects

ALTER TABLE jobs ADD COLUMN social_actual_budget_released NUMERIC(20,8);  -- Calculated later

-- Requirements and tracking
ALTER TABLE jobs ADD COLUMN social_min_followers_required INTEGER;  -- Optional filter

ALTER TABLE jobs ADD COLUMN social_payments_distributed BOOLEAN DEFAULT FALSE;

-- Add check constraint to ensure required fields when is_social_media_job = TRUE
ALTER TABLE jobs ADD CONSTRAINT check_social_job_fields 
  CHECK (
    (is_social_media_job = FALSE) OR 
    (is_social_media_job = TRUE AND 
     social_job_type IS NOT NULL AND 
     social_submission_deadline IS NOT NULL AND
     social_total_budget_tokens > 0 AND
     social_budget_tiers IS NOT NULL)
  );

-- Add helpful comments
COMMENT ON COLUMN jobs.is_social_media_job IS 'Whether this job is a social media engagement job (automatic proportional payments based on follower counts)';
COMMENT ON COLUMN jobs.social_job_type IS 'Type of social media job: retweet (share existing tweet) or original_tweet (create new content about topic)';
COMMENT ON COLUMN jobs.social_tweet_url IS 'URL of the tweet to retweet (required for retweet type jobs)';
COMMENT ON COLUMN jobs.social_tweet_topic IS 'Topic/prompt for original tweet content (required for original_tweet type jobs)';
COMMENT ON COLUMN jobs.social_submission_deadline IS 'Deadline for workers to submit their tweet links (auto-set to 48hrs from job creation)';
COMMENT ON COLUMN jobs.social_engagement_deadline IS 'Deadline for engagement metrics to stabilize (auto-set to +24hrs after submission deadline)';
COMMENT ON COLUMN jobs.social_review_deadline IS 'Deadline for poster to review and approve/reject submissions (auto-set to +48hrs after engagement deadline)';
COMMENT ON COLUMN jobs.social_total_budget_tokens IS 'Maximum budget in tokens for this social media job';
COMMENT ON COLUMN jobs.social_total_budget_usd IS 'Maximum budget in USD for this social media job';
COMMENT ON COLUMN jobs.social_budget_tiers IS 'Array of tier objects: [{min_participants, max_participants, budget_tokens, budget_usd}]. Example: [{"min_participants": 1, "max_participants": 5, "budget_tokens": 500, "budget_usd": 100}]';
COMMENT ON COLUMN jobs.social_actual_budget_released IS 'Actual amount released after proportional calculation (may be less than total budget)';
COMMENT ON COLUMN jobs.social_min_followers_required IS 'Minimum Twitter follower count required to participate (optional filter)';
COMMENT ON COLUMN jobs.social_payments_distributed IS 'Whether proportional payments have been calculated and distributed';

