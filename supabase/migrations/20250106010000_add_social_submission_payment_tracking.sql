-- Migration: Add Submission Payment Lifecycle Tracking
-- Created: 2025-01-06
-- Description: Adds payment state tracking to job submissions for instant payment system.
--              Enables tracking of payment attempts, failures, and audit trail.
--
-- State Machine:
-- pending → approved_pending_payment → approved (success)
--                                   → approved_failed (retry exhausted)
-- pending → denied (rejected by poster)
--
-- Why we need this:
-- 1. Distinguish "approved awaiting payment" from "approved and paid"
-- 2. Handle payment failures (network, RPC issues) with retry logic
-- 3. Audit trail showing exact payment amount and follower tier used

-- ==================== UPDATE APPROVAL STATUS ENUM ====================

-- Drop existing check constraint
ALTER TABLE job_submissions 
DROP CONSTRAINT IF EXISTS job_submissions_social_approval_status_check;

-- Add new check constraint with expanded status values
ALTER TABLE job_submissions 
ADD CONSTRAINT job_submissions_social_approval_status_check
CHECK (social_approval_status IN (
  'pending',                    -- Initial state: awaiting poster review
  'approved_pending_payment',   -- Payment transaction submitted, awaiting confirmation
  'approved',                   -- Payment confirmed and successful
  'auto_approved',              -- Auto-approved after deadline (will transition to approved_pending_payment)
  'approved_failed',            -- Payment failed after retry attempts exhausted
  'denied'                      -- Rejected by poster
));

-- ==================== ADD PAYMENT TRACKING FIELDS ====================

-- Payment retry tracking
ALTER TABLE job_submissions 
ADD COLUMN social_payment_retry_count INTEGER DEFAULT 0 NOT NULL;

-- Base payment amounts (excludes bonuses like impressions)
ALTER TABLE job_submissions 
ADD COLUMN social_base_payment_amount_tokens NUMERIC(20,8);

ALTER TABLE job_submissions 
ADD COLUMN social_base_payment_amount_usd NUMERIC(20,2);

-- Audit trail: which follower tier was used for payment calculation
ALTER TABLE job_submissions 
ADD COLUMN social_follower_tier_at_payment TEXT;

-- Error tracking for failed payments
ALTER TABLE job_submissions 
ADD COLUMN social_payment_failed_reason TEXT;

-- ==================== UPDATE EXISTING INDEXES ====================

-- Drop old index that only included 'approved' and 'auto_approved'
DROP INDEX IF EXISTS idx_job_submissions_social_approved;

-- Create new comprehensive index for all approved-related statuses
CREATE INDEX idx_job_submissions_social_approval_status 
  ON job_submissions(job_id, social_approval_status)
  WHERE social_approval_status IN (
    'approved', 
    'auto_approved', 
    'approved_pending_payment', 
    'approved_failed'
  );

-- Index for finding submissions pending payment (for retry worker)
CREATE INDEX idx_job_submissions_pending_payment 
  ON job_submissions(social_approval_status, created_at)
  WHERE social_approval_status = 'approved_pending_payment';

-- Index for finding failed payments (for monitoring/alerts)
CREATE INDEX idx_job_submissions_failed_payments 
  ON job_submissions(social_approval_status, social_payment_retry_count)
  WHERE social_approval_status = 'approved_failed';

-- ==================== ADD COMMENTS ====================

COMMENT ON COLUMN job_submissions.social_approval_status IS 
  'Payment lifecycle state: pending (awaiting review) → approved_pending_payment (transaction submitted) → approved (payment confirmed) OR approved_failed (payment failed). Also: auto_approved (deadline passed), denied (rejected).';

COMMENT ON COLUMN job_submissions.social_payment_retry_count IS 
  'Number of payment retry attempts. Used to prevent infinite retries. Max retries typically set to 3-5.';

COMMENT ON COLUMN job_submissions.social_base_payment_amount_tokens IS 
  'Base payment amount in tokens (excludes bonuses). Stored for audit trail. This is what they earned from their follower tier.';

COMMENT ON COLUMN job_submissions.social_base_payment_amount_usd IS 
  'Base payment amount in USD equivalent (excludes bonuses). Stored for audit trail and dispute resolution.';

COMMENT ON COLUMN job_submissions.social_follower_tier_at_payment IS 
  'Which follower tier bracket they were paid at (e.g., "1000-5000 followers: $50"). Stored for transparency and dispute resolution. Format: "{min}-{max} followers: ${amount}".';

COMMENT ON COLUMN job_submissions.social_payment_failed_reason IS 
  'Error message if payment failed. Used for debugging RPC issues, insufficient balance, network timeouts, etc. Example: "RPC timeout after 30s" or "Insufficient SOL for transaction fee".';

-- ==================== DATA VALIDATION ====================

-- Verify no existing submissions are in invalid state
DO $$
DECLARE
  v_invalid_count INTEGER;
BEGIN
  -- Check if any existing submissions have values outside the new constraint
  SELECT COUNT(*) INTO v_invalid_count
  FROM job_submissions
  WHERE social_approval_status IS NOT NULL
    AND social_approval_status NOT IN (
      'pending', 
      'approved_pending_payment', 
      'approved', 
      'auto_approved', 
      'approved_failed', 
      'denied'
    );
  
  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % submissions have invalid approval status', v_invalid_count;
  END IF;
  
  RAISE NOTICE 'Migration successful: All submission approval statuses are valid';
END $$;

-- ==================== ROLLBACK INSTRUCTIONS ====================

-- To rollback this migration (NOT automatically executed):
--
-- -- Drop new indexes
-- DROP INDEX IF EXISTS idx_job_submissions_social_approval_status;
-- DROP INDEX IF EXISTS idx_job_submissions_pending_payment;
-- DROP INDEX IF EXISTS idx_job_submissions_failed_payments;
--
-- -- Restore old index
-- CREATE INDEX idx_job_submissions_social_approved 
--   ON job_submissions(job_id, social_approval_status) 
--   WHERE social_approval_status IN ('approved', 'auto_approved');
--
-- -- Drop new columns
-- ALTER TABLE job_submissions DROP COLUMN IF EXISTS social_payment_retry_count;
-- ALTER TABLE job_submissions DROP COLUMN IF EXISTS social_base_payment_amount_tokens;
-- ALTER TABLE job_submissions DROP COLUMN IF EXISTS social_base_payment_amount_usd;
-- ALTER TABLE job_submissions DROP COLUMN IF EXISTS social_follower_tier_at_payment;
-- ALTER TABLE job_submissions DROP COLUMN IF EXISTS social_payment_failed_reason;
--
-- -- Restore original check constraint
-- ALTER TABLE job_submissions DROP CONSTRAINT IF EXISTS job_submissions_social_approval_status_check;
-- ALTER TABLE job_submissions ADD CONSTRAINT job_submissions_social_approval_status_check
--   CHECK (social_approval_status IN ('pending', 'approved', 'denied', 'auto_approved'));

