-- Add social media submission fields to job_submissions table

-- Submission proof
ALTER TABLE job_submissions ADD COLUMN social_tweet_link TEXT;

-- Follower count tracking
ALTER TABLE job_submissions ADD COLUMN social_follower_count INTEGER;  -- Worker-reported

ALTER TABLE job_submissions ADD COLUMN social_follower_count_verified INTEGER;  -- Poster can adjust

-- Approval workflow
ALTER TABLE job_submissions ADD COLUMN social_approval_status TEXT 
  CHECK (social_approval_status IN ('pending', 'approved', 'denied', 'auto_approved'));

ALTER TABLE job_submissions ADD COLUMN social_denial_reason TEXT;

-- Payment tracking
ALTER TABLE job_submissions ADD COLUMN social_payment_amount_tokens NUMERIC(20,8);

ALTER TABLE job_submissions ADD COLUMN social_payment_amount_usd NUMERIC(20,2);

ALTER TABLE job_submissions ADD COLUMN social_payment_released BOOLEAN DEFAULT FALSE;

ALTER TABLE job_submissions ADD COLUMN social_payment_tx_signature TEXT;

-- Add index for finding approved submissions efficiently
CREATE INDEX idx_job_submissions_social_approved 
  ON job_submissions(job_id, social_approval_status) 
  WHERE social_approval_status IN ('approved', 'auto_approved');

-- Add helpful comments
COMMENT ON COLUMN job_submissions.social_tweet_link IS 'URL of the tweet submitted as proof of work';
COMMENT ON COLUMN job_submissions.social_follower_count IS 'Follower count reported by the worker at submission time';
COMMENT ON COLUMN job_submissions.social_follower_count_verified IS 'Poster can manually verify and adjust the follower count during review period';
COMMENT ON COLUMN job_submissions.social_approval_status IS 'Approval status: pending (awaiting review), approved (poster accepted), denied (poster rejected), auto_approved (deadline passed)';
COMMENT ON COLUMN job_submissions.social_denial_reason IS 'Reason provided by poster when denying a submission';
COMMENT ON COLUMN job_submissions.social_payment_amount_tokens IS 'Calculated payment amount in tokens based on proportional follower share';
COMMENT ON COLUMN job_submissions.social_payment_amount_usd IS 'Calculated payment amount in USD based on proportional follower share';
COMMENT ON COLUMN job_submissions.social_payment_released IS 'Whether the payment has been released to this worker';
COMMENT ON COLUMN job_submissions.social_payment_tx_signature IS 'Solana transaction signature for the payment release';

