-- Fix job_comments RLS policy to use correct table
-- Issue: Policy was checking wallet_token_holdings instead of wallet_token_balances
-- This prevented token holders from posting comments

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Token holders can insert comments" ON job_comments;

-- Create correct policy using wallet_token_balances table
CREATE POLICY "Token holders can insert comments"
  ON job_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wallet_token_balances wtb
      JOIN jobs j ON j.id = job_comments.job_id
      WHERE wtb.wallet_address = job_comments.commenter_wallet
        AND wtb.project_id = j.project_id
        AND wtb.balance > 0
    )
  );

COMMENT ON POLICY "Token holders can insert comments" ON job_comments IS 
  'Only users who hold project tokens (balance > 0) can post comments on jobs';











