-- Add social media dispute reason types to job_disputes table

-- Note: The existing job_disputes_reason_check constraint only validates character length (<=1000)
-- The reason column was previously free-text. This migration adds a new column for categorized dispute types
-- while keeping the existing reason column for detailed explanations.

-- Add a new column for categorized dispute types
ALTER TABLE job_disputes ADD COLUMN dispute_type TEXT;

-- Add constraint for valid dispute types (including social media specific ones)
ALTER TABLE job_disputes ADD CONSTRAINT check_dispute_type 
  CHECK (dispute_type IS NULL OR dispute_type IN (
    -- General dispute types
    'quality_issues',
    'deadline_missed',
    'requirements_not_met',
    'payment_issue',
    'communication_failure',
    'scope_creep',
    -- Social media specific dispute reasons
    'social_wrongful_denial',  -- Worker believes denial was unjust
    'social_fake_followers',   -- Poster believes follower count inflated
    'social_link_invalid',     -- Tweet link broken or deleted
    'other'
  ));

-- Add helpful comments
COMMENT ON COLUMN job_disputes.dispute_type IS 'Categorized dispute type for filtering and analytics. Includes social media types: social_wrongful_denial (worker disputes denial), social_fake_followers (poster disputes follower count), social_link_invalid (broken tweet link)';

