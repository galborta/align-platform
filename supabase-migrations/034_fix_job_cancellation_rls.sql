-- Migration: Fix Job Cancellation RLS Policy  
-- Created: 2024-12-02
-- Description: Simplify RLS to allow job status updates (cancellation/completion) even when 
--              escrow is locked. Application logic handles the actual refund/payment separately.

-- Drop the existing overly restrictive policy
DROP POLICY IF EXISTS "Poster can update own jobs with restrictions" ON jobs;

-- Recreate with simplified logic that trusts application-level controls
CREATE POLICY "Poster can update own jobs" 
  ON jobs 
  FOR UPDATE 
  USING (
    poster_wallet = auth.jwt() ->> 'wallet_address'
  )
  WITH CHECK (
    poster_wallet = auth.jwt() ->> 'wallet_address'
  );

COMMENT ON POLICY "Poster can update own jobs" ON jobs IS 
  'Poster can update their own jobs. Escrow refund/payment is handled in application layer before status updates.';

