-- Job comments table
CREATE TABLE IF NOT EXISTS job_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_comments_job_id ON job_comments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_comments_wallet ON job_comments(wallet_address);
CREATE INDEX IF NOT EXISTS idx_job_comments_created_at ON job_comments(created_at DESC);

-- Chat tips table
CREATE TABLE IF NOT EXISTS chat_tips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  amount_nub NUMERIC NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_tips_project_id ON chat_tips(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_tips_from_wallet ON chat_tips(from_wallet);
CREATE INDEX IF NOT EXISTS idx_chat_tips_to_wallet ON chat_tips(to_wallet);
CREATE INDEX IF NOT EXISTS idx_chat_tips_created_at ON chat_tips(created_at DESC);

-- RLS policies for job_comments
ALTER TABLE job_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view job comments" ON job_comments;
CREATE POLICY "Anyone can view job comments"
  ON job_comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert comments" ON job_comments;
CREATE POLICY "Authenticated users can insert comments"
  ON job_comments FOR INSERT
  WITH CHECK (true);

-- RLS policies for chat_tips
ALTER TABLE chat_tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view tips" ON chat_tips;
CREATE POLICY "Anyone can view tips"
  ON chat_tips FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can tip" ON chat_tips;
CREATE POLICY "Authenticated users can tip"
  ON chat_tips FOR INSERT
  WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE job_comments IS 'Comments on job postings for questions and discussions';
COMMENT ON TABLE chat_tips IS 'Tips sent between users in chat conversations';
COMMENT ON COLUMN chat_tips.amount_nub IS 'Amount in NUB tokens (project native token)';







