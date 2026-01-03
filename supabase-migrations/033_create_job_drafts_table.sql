-- Migration: Create job drafts table for recovery
-- Description: Stores draft job data for recovery when escrow succeeds but job creation fails
-- Created: 2024-11-27

-- Create job drafts table
CREATE TABLE IF NOT EXISTS public.job_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_wallet text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  draft_data jsonb NOT NULL,
  escrow_tx_signature text,
  recovery_status text DEFAULT 'pending' CHECK (recovery_status IN ('pending', 'draft', 'needs_recovery', 'recovered', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_job_drafts_poster_wallet ON public.job_drafts(poster_wallet);
CREATE INDEX IF NOT EXISTS idx_job_drafts_recovery_status ON public.job_drafts(recovery_status);
CREATE INDEX IF NOT EXISTS idx_job_drafts_poster_status ON public.job_drafts(poster_wallet, recovery_status);

-- Enable RLS
ALTER TABLE public.job_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own drafts
CREATE POLICY "Users can view their own drafts"
  ON public.job_drafts
  FOR SELECT
  USING (poster_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can insert their own drafts"
  ON public.job_drafts
  FOR INSERT
  WITH CHECK (poster_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can update their own drafts"
  ON public.job_drafts
  FOR UPDATE
  USING (poster_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can delete their own drafts"
  ON public.job_drafts
  FOR DELETE
  USING (poster_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Add comment
COMMENT ON TABLE public.job_drafts IS 'Stores draft job data for recovery when escrow succeeds but job creation fails';

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_job_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_drafts_updated_at
  BEFORE UPDATE ON public.job_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_job_drafts_updated_at();












