-- Migration: Create submission_comments table for contest entry comments
-- This allows users to comment on individual contest submissions

-- Create submission_comments table
CREATE TABLE IF NOT EXISTS submission_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES job_submissions(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  message TEXT NOT NULL CHECK (char_length(message) >= 1 AND char_length(message) <= 2000),
  parent_comment_id UUID REFERENCES submission_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_submission_comments_submission_id ON submission_comments(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_comments_job_id ON submission_comments(job_id);
CREATE INDEX IF NOT EXISTS idx_submission_comments_wallet ON submission_comments(wallet_address);
CREATE INDEX IF NOT EXISTS idx_submission_comments_parent ON submission_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_submission_comments_created_at ON submission_comments(created_at);

-- RLS Policies
ALTER TABLE submission_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can view comments
CREATE POLICY "Anyone can view submission comments"
ON submission_comments FOR SELECT
TO public
USING (true);

-- Authenticated users can post comments (wallet address must match)
CREATE POLICY "Users can post submission comments"
ON submission_comments FOR INSERT
TO public
WITH CHECK (true);

-- Users can update their own comments
CREATE POLICY "Users can update their own submission comments"
ON submission_comments FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own submission comments"
ON submission_comments FOR DELETE
TO public
USING (true);

-- Enable real-time for submission_comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.submission_comments;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_submission_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER submission_comments_updated_at
  BEFORE UPDATE ON submission_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_submission_comments_updated_at();

