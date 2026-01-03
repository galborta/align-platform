-- Migration: Create editor_sessions table
-- Created: 2024-12-19
-- Purpose: Cache editor verification signatures for 24 hours to reduce friction
-- Sprint 1: Database Foundation - Project Editors System

-- ============================================
-- CREATE EDITOR_SESSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS editor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  signature text NOT NULL,
  message text NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure one active session per wallet per project
  CONSTRAINT unique_project_wallet UNIQUE (project_id, wallet_address)
);

-- ============================================
-- CREATE INDEXES
-- ============================================

-- Index for wallet-based queries
CREATE INDEX IF NOT EXISTS idx_editor_sessions_wallet 
  ON editor_sessions(wallet_address);

-- Index for project-based queries
CREATE INDEX IF NOT EXISTS idx_editor_sessions_project 
  ON editor_sessions(project_id);

-- Index for expiry cleanup queries
CREATE INDEX IF NOT EXISTS idx_editor_sessions_expires 
  ON editor_sessions(expires_at);

-- Composite index for common session validation queries
CREATE INDEX IF NOT EXISTS idx_editor_sessions_project_wallet 
  ON editor_sessions(project_id, wallet_address);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE editor_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Editors can view their own sessions
CREATE POLICY "Editors can view their own sessions"
  ON editor_sessions
  FOR SELECT
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Policy: Editors can create their own sessions (handled by API)
CREATE POLICY "Editors can create sessions"
  ON editor_sessions
  FOR INSERT
  WITH CHECK (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Policy: Editors can delete their own sessions (logout)
CREATE POLICY "Editors can delete their own sessions"
  ON editor_sessions
  FOR DELETE
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function: Check if wallet has valid active session for project
CREATE OR REPLACE FUNCTION is_valid_editor_session(
  p_project_id uuid,
  p_wallet_address text
) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM editor_sessions 
    WHERE project_id = p_project_id 
      AND wallet_address = p_wallet_address
      AND expires_at > now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Cleanup expired sessions (call via cron or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_editor_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM editor_sessions WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DOCUMENTATION
-- ============================================

COMMENT ON TABLE editor_sessions IS 
  'Caches editor verification signatures for 24 hours to reduce signature frequency. Stores session metadata for security auditing.';

COMMENT ON COLUMN editor_sessions.signature IS 
  'Cryptographic signature proving wallet ownership at session creation';

COMMENT ON COLUMN editor_sessions.message IS 
  'Original message that was signed, stored for audit trail';

COMMENT ON COLUMN editor_sessions.expires_at IS 
  'Session expiry timestamp, defaults to 24 hours from creation';

COMMENT ON FUNCTION is_valid_editor_session IS 
  'Check if wallet has valid active session for project. Returns true if session exists and has not expired.';

COMMENT ON FUNCTION cleanup_expired_editor_sessions IS 
  'Removes all expired sessions from the table. Should be called periodically via cron job.';

-- ============================================
-- ROLLBACK (for reference only)
-- ============================================

-- To rollback this migration, run:
-- DROP FUNCTION IF EXISTS cleanup_expired_editor_sessions();
-- DROP FUNCTION IF EXISTS is_valid_editor_session(uuid, text);
-- DROP TABLE IF EXISTS editor_sessions CASCADE;


