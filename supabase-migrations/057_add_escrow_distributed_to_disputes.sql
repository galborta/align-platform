-- Migration 057: Add escrow_distributed column to job_disputes
-- This tracks whether the escrow tokens have been distributed after dispute resolution

-- Add escrow_distributed column
ALTER TABLE job_disputes 
ADD COLUMN IF NOT EXISTS escrow_distributed BOOLEAN DEFAULT false;

-- Add index for quick lookups of unresolved distributions
CREATE INDEX IF NOT EXISTS idx_job_disputes_pending_distribution 
ON job_disputes (status, escrow_distributed) 
WHERE status = 'resolved' AND escrow_distributed = false;

-- Add comment
COMMENT ON COLUMN job_disputes.escrow_distributed IS 'Whether escrow tokens have been distributed after resolution';

-- Backfill: Mark old disputes without percentages as distributed (they likely had no escrow)
-- Keep disputes with percentages as NOT distributed so admin can manually trigger
UPDATE job_disputes 
SET escrow_distributed = true 
WHERE status = 'resolved' 
AND worker_percentage IS NULL 
AND poster_percentage IS NULL;

-- For resolved disputes that have percentages but were resolved before this migration,
-- we leave escrow_distributed as false so admin can manually trigger distribution

