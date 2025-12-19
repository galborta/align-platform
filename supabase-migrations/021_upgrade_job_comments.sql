-- Upgrade job_comments table to new schema
-- This migration updates column names, adds constraints, and improves RLS policies

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view job comments" ON job_comments;
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON job_comments;

-- Rename columns to match new schema
ALTER TABLE job_comments RENAME COLUMN wallet_address TO commenter_wallet;
ALTER TABLE job_comments RENAME COLUMN message TO comment_text;

-- Add character length constraint
ALTER TABLE job_comments 
  ADD CONSTRAINT check_comment_length 
  CHECK (char_length(comment_text) <= 2000);

-- Create new RLS policies with token holder restrictions
CREATE POLICY "Anyone can view comments"
  ON job_comments FOR SELECT
  USING (true);

CREATE POLICY "Token holders can insert comments"
  ON job_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wallet_token_holdings wth
      JOIN jobs j ON j.id = job_comments.job_id
      WHERE wth.wallet_address = job_comments.commenter_wallet
        AND wth.token_mint = (SELECT token_mint FROM projects WHERE id = j.project_id)
        AND wth.balance > 0
    )
  );

CREATE POLICY "Users can update their own comments"
  ON job_comments FOR UPDATE
  USING (commenter_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can delete their own comments"
  ON job_comments FOR DELETE
  USING (commenter_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Update comment
COMMENT ON TABLE job_comments IS 'Comments on job postings - token holder discussions with 2000 char limit';
COMMENT ON COLUMN job_comments.commenter_wallet IS 'Wallet address of the commenter (must hold project tokens)';
COMMENT ON COLUMN job_comments.comment_text IS 'Comment content (max 2000 characters)';














