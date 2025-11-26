-- Migration: Create job_failures table
-- Description: Tracks worker failures for job assignments (disputed losses, reassignments, ghosting)
-- Created: 2025-11-25

-- Create job_failures table
CREATE TABLE IF NOT EXISTS job_failures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_wallet TEXT NOT NULL,
  failure_type TEXT NOT NULL CHECK (failure_type IN ('disputed_lost', 'reassigned', 'ghosted')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_job_failures_worker ON job_failures(worker_wallet);
CREATE INDEX IF NOT EXISTS idx_job_failures_job ON job_failures(job_id);
CREATE INDEX IF NOT EXISTS idx_job_failures_type ON job_failures(failure_type);
CREATE INDEX IF NOT EXISTS idx_job_failures_created ON job_failures(created_at DESC);

-- Enable Row Level Security
ALTER TABLE job_failures ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view failure records (public accountability)
DROP POLICY IF EXISTS "Anyone can view job failures" ON job_failures;
CREATE POLICY "Anyone can view job failures"
  ON job_failures FOR SELECT
  USING (true);

-- Only system/admin can insert failure records (prevent abuse)
-- For now, authenticated users can insert (will be restricted to backend in production)
DROP POLICY IF EXISTS "Authenticated users can record failures" ON job_failures;
CREATE POLICY "Authenticated users can record failures"
  ON job_failures FOR INSERT
  WITH CHECK (true);

-- Add table and column comments for documentation
COMMENT ON TABLE job_failures IS 'Tracks worker failures: disputed losses, manual reassignments, and ghosting incidents';
COMMENT ON COLUMN job_failures.failure_type IS 'Type of failure: disputed_lost (lost dispute vote), reassigned (poster reassigned job), ghosted (never submitted after 2x estimated time)';
COMMENT ON COLUMN job_failures.worker_wallet IS 'Wallet address of worker who failed to deliver';
COMMENT ON COLUMN job_failures.job_id IS 'Reference to the job that was not completed successfully';



