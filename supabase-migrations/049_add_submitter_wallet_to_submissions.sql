-- Migration: Add submitter_wallet to project_submissions table
-- Created: 2024-12-19
-- Description: Adds submitter_wallet column to track the wallet address of the person who submitted the project

-- Add submitter_wallet column to project_submissions
ALTER TABLE project_submissions 
ADD COLUMN IF NOT EXISTS submitter_wallet TEXT;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_project_submissions_submitter_wallet 
  ON project_submissions(submitter_wallet);

-- Add comment
COMMENT ON COLUMN project_submissions.submitter_wallet IS 'Wallet address of the user who submitted the project - becomes the project creator';

-- Note: This column may be NULL for existing submissions (created before this migration)
-- Future submissions will require a wallet connection and will have this populated


