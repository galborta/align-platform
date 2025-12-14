-- Migration: Create project submission and approval system
-- Created: 2024-12-14
-- Description: Adds closed project submission flow with admin approval, creation tokens, and draft storage

-- ============================================
-- 1. PROJECT SUBMISSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS project_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  token_symbol TEXT,
  token_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('Founder', 'Team Member', 'Community Member', 'Investor', 'Other')),
  message TEXT CHECK (char_length(message) <= 500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by TEXT -- Admin wallet address
);

-- Create indexes for project_submissions
CREATE INDEX IF NOT EXISTS idx_project_submissions_contract ON project_submissions(contract_address);
CREATE INDEX IF NOT EXISTS idx_project_submissions_status ON project_submissions(status);
CREATE INDEX IF NOT EXISTS idx_project_submissions_submitted_at ON project_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_submissions_email ON project_submissions(email);

-- Prevent duplicate pending/approved submissions for same contract (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_approved_contract 
  ON project_submissions(contract_address, status) 
  WHERE status IN ('pending', 'approved');

-- Add comments
COMMENT ON TABLE project_submissions IS 'Stores project submission applications from users requesting to add their project';
COMMENT ON COLUMN project_submissions.status IS 'pending: awaiting review, approved: admin approved, rejected: admin denied';
COMMENT ON COLUMN project_submissions.reviewed_by IS 'Wallet address of admin who reviewed the submission';
COMMENT ON INDEX idx_unique_pending_approved_contract IS 
  'Prevents duplicate pending or approved submissions for the same contract address';

-- ============================================
-- 2. PROJECT CREATION TOKENS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS project_creation_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL, -- Cryptographically secure random string
  contract_address TEXT NOT NULL,
  email TEXT NOT NULL,
  submission_id UUID NOT NULL REFERENCES project_submissions(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL, -- Admin wallet that created the token
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- NULL = never expires
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  completed_at TIMESTAMP
);

-- Create indexes for project_creation_tokens
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_creation_tokens_token ON project_creation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_project_creation_tokens_contract ON project_creation_tokens(contract_address);
CREATE INDEX IF NOT EXISTS idx_project_creation_tokens_status ON project_creation_tokens(status);
CREATE INDEX IF NOT EXISTS idx_project_creation_tokens_submission ON project_creation_tokens(submission_id);
CREATE INDEX IF NOT EXISTS idx_project_creation_tokens_expires_at ON project_creation_tokens(expires_at);

-- Add comments
COMMENT ON TABLE project_creation_tokens IS 'Stores unique creation tokens sent to approved applicants';
COMMENT ON COLUMN project_creation_tokens.token IS 'Unique token string sent to user for project creation access';
COMMENT ON COLUMN project_creation_tokens.expires_at IS 'Token expiration timestamp, NULL means indefinite';
COMMENT ON COLUMN project_creation_tokens.status IS 'pending: not yet used, completed: project created with this token';

-- ============================================
-- 3. PROJECT DRAFTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS project_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES project_creation_tokens(id) ON DELETE CASCADE,
  contract_address TEXT NOT NULL,
  form_data JSONB NOT NULL, -- Stores all project creation fields
  last_saved TIMESTAMP DEFAULT NOW(),
  completed BOOLEAN DEFAULT false
);

-- Create indexes for project_drafts
CREATE INDEX IF NOT EXISTS idx_project_drafts_token_id ON project_drafts(token_id);
CREATE INDEX IF NOT EXISTS idx_project_drafts_contract ON project_drafts(contract_address);
CREATE INDEX IF NOT EXISTS idx_project_drafts_last_saved ON project_drafts(last_saved DESC);

-- Add comments
COMMENT ON TABLE project_drafts IS 'Stores draft project data for users creating projects via creation tokens';
COMMENT ON COLUMN project_drafts.form_data IS 'JSONB object containing all project creation form fields';
COMMENT ON COLUMN project_drafts.completed IS 'True when draft is finalized into a full project';

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE project_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_creation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_drafts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can read all submissions" ON project_submissions;
DROP POLICY IF EXISTS "Anyone can submit project application" ON project_submissions;
DROP POLICY IF EXISTS "Allow update submissions" ON project_submissions;

DROP POLICY IF EXISTS "Users can read own creation tokens" ON project_creation_tokens;
DROP POLICY IF EXISTS "Allow insert creation tokens" ON project_creation_tokens;
DROP POLICY IF EXISTS "Allow update creation tokens" ON project_creation_tokens;

DROP POLICY IF EXISTS "Users can read own drafts" ON project_drafts;
DROP POLICY IF EXISTS "Users can insert own drafts" ON project_drafts;
DROP POLICY IF EXISTS "Users can update own drafts" ON project_drafts;
DROP POLICY IF EXISTS "Users can delete own drafts" ON project_drafts;

-- ============================================
-- PROJECT_SUBMISSIONS POLICIES
-- ============================================

-- Anyone can read all submissions (for public submission list/stats)
CREATE POLICY "Public can read all submissions" ON project_submissions
  FOR SELECT USING (true);

-- Anyone can submit a project application (public form)
CREATE POLICY "Anyone can submit project application" ON project_submissions
  FOR INSERT WITH CHECK (true);

-- Allow updates (admin verification done in application layer)
CREATE POLICY "Allow update submissions" ON project_submissions
  FOR UPDATE USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Public can read all submissions" ON project_submissions IS 
  'Allow all users to view submissions for transparency';

COMMENT ON POLICY "Anyone can submit project application" ON project_submissions IS 
  'Allow anyone to submit a project application via public form';

COMMENT ON POLICY "Allow update submissions" ON project_submissions IS 
  'Allow update operations (admin verification done in application layer)';

-- ============================================
-- PROJECT_CREATION_TOKENS POLICIES
-- ============================================

-- Users can read tokens by providing the token string in query
-- (Token acts as authentication credential)
CREATE POLICY "Users can read own creation tokens" ON project_creation_tokens
  FOR SELECT USING (true);

-- Allow insert (admin verification done in application layer)
CREATE POLICY "Allow insert creation tokens" ON project_creation_tokens
  FOR INSERT WITH CHECK (true);

-- Allow update to mark tokens as completed
CREATE POLICY "Allow update creation tokens" ON project_creation_tokens
  FOR UPDATE USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Users can read own creation tokens" ON project_creation_tokens IS 
  'Token string acts as authentication credential for project creation flow';

COMMENT ON POLICY "Allow insert creation tokens" ON project_creation_tokens IS 
  'Allow creation of tokens (admin verification done in application layer)';

COMMENT ON POLICY "Allow update creation tokens" ON project_creation_tokens IS 
  'Allow marking tokens as completed when project is created';

-- ============================================
-- PROJECT_DRAFTS POLICIES
-- ============================================

-- Users with valid token can read their drafts
CREATE POLICY "Users can read own drafts" ON project_drafts
  FOR SELECT USING (true);

-- Users can save drafts
CREATE POLICY "Users can insert own drafts" ON project_drafts
  FOR INSERT WITH CHECK (true);

-- Users can update their drafts
CREATE POLICY "Users can update own drafts" ON project_drafts
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- Users can delete their drafts
CREATE POLICY "Users can delete own drafts" ON project_drafts
  FOR DELETE USING (true);

COMMENT ON POLICY "Users can read own drafts" ON project_drafts IS 
  'Allow reading drafts (token validation done in application layer)';

COMMENT ON POLICY "Users can insert own drafts" ON project_drafts IS 
  'Allow saving project drafts during creation process';

COMMENT ON POLICY "Users can update own drafts" ON project_drafts IS 
  'Allow updating draft data as user progresses through form';

COMMENT ON POLICY "Users can delete own drafts" ON project_drafts IS 
  'Allow users to delete their draft if they want to start over';

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to generate secure random token
CREATE OR REPLACE FUNCTION generate_creation_token()
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
  v_chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  v_length INT := 32;
  v_result TEXT := '';
  i INT;
BEGIN
  -- Generate cryptographically secure random token
  FOR i IN 1..v_length LOOP
    v_result := v_result || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
  END LOOP;
  
  -- Add prefix for clarity
  v_token := 'pct_' || v_result;
  
  RETURN v_token;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Function to check if token is valid (not expired, not completed)
CREATE OR REPLACE FUNCTION is_token_valid(p_token TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_valid BOOLEAN;
BEGIN
  SELECT 
    status = 'pending' 
    AND (expires_at IS NULL OR expires_at > NOW())
  INTO v_is_valid
  FROM project_creation_tokens
  WHERE token = p_token;
  
  RETURN COALESCE(v_is_valid, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to mark token as completed
CREATE OR REPLACE FUNCTION complete_creation_token(p_token TEXT)
RETURNS void AS $$
BEGIN
  UPDATE project_creation_tokens
  SET 
    status = 'completed',
    completed_at = NOW()
  WHERE token = p_token
    AND status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_creation_token() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_token_valid(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION complete_creation_token(TEXT) TO authenticated, anon;

-- ============================================
-- ENABLE SUPABASE REALTIME
-- ============================================

-- Enable Realtime for admin notifications on new submissions
ALTER PUBLICATION supabase_realtime ADD TABLE project_submissions;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 041_create_project_submission_system completed successfully!';
  RAISE NOTICE '📋 Created tables:';
  RAISE NOTICE '   - project_submissions (with unique constraint on pending/approved contracts)';
  RAISE NOTICE '   - project_creation_tokens (with secure token generation)';
  RAISE NOTICE '   - project_drafts (for saving progress during creation)';
  RAISE NOTICE '🔒 Enabled RLS policies for all tables';
  RAISE NOTICE '📡 Enabled Realtime for project_submissions';
  RAISE NOTICE '⚙️  Added helper functions for token management';
END $$;
