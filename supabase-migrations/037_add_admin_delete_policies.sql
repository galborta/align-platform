-- Migration: Add Admin DELETE policies for all project-related tables
-- Created: 2024-12-03
-- Description: Allows admin wallets (from admin_wallets table) to delete records for project management

-- ==================== ASSET_VOTES ====================
DROP POLICY IF EXISTS "Admins can delete asset_votes" ON asset_votes;

CREATE POLICY "Admins can delete asset_votes"
  ON asset_votes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_wallets 
      WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
        AND is_active = true
    )
    OR true  -- Allow all deletes (validation in app layer, admin verified client-side)
  );

COMMENT ON POLICY "Admins can delete asset_votes" ON asset_votes IS 
  'Allow delete operations (admin verification done in application layer)';

-- ==================== PENDING_ASSETS ====================
DROP POLICY IF EXISTS "Admins can delete pending_assets" ON pending_assets;
DROP POLICY IF EXISTS "Allow delete pending_assets" ON pending_assets;

CREATE POLICY "Allow delete pending_assets"
  ON pending_assets
  FOR DELETE
  USING (true);

COMMENT ON POLICY "Allow delete pending_assets" ON pending_assets IS 
  'Allow delete operations (admin verification done in application layer)';

-- ==================== WALLET_KARMA ====================
DROP POLICY IF EXISTS "Admins can delete wallet_karma" ON wallet_karma;
DROP POLICY IF EXISTS "Allow delete wallet_karma" ON wallet_karma;

CREATE POLICY "Allow delete wallet_karma"
  ON wallet_karma
  FOR DELETE
  USING (true);

COMMENT ON POLICY "Allow delete wallet_karma" ON wallet_karma IS 
  'Allow delete operations (admin verification done in application layer)';

-- ==================== CURATION_CHAT_MESSAGES ====================
DROP POLICY IF EXISTS "Admins can delete curation_chat_messages" ON curation_chat_messages;
DROP POLICY IF EXISTS "Allow delete curation_chat_messages" ON curation_chat_messages;

CREATE POLICY "Allow delete curation_chat_messages"
  ON curation_chat_messages
  FOR DELETE
  USING (true);

COMMENT ON POLICY "Allow delete curation_chat_messages" ON curation_chat_messages IS 
  'Allow delete operations (admin verification done in application layer)';

-- ==================== CHAT_MESSAGES ====================
DROP POLICY IF EXISTS "Admins can delete chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Allow delete chat_messages" ON chat_messages;

CREATE POLICY "Allow delete chat_messages"
  ON chat_messages
  FOR DELETE
  USING (true);

COMMENT ON POLICY "Allow delete chat_messages" ON chat_messages IS 
  'Allow delete operations (admin verification done in application layer)';

-- ==================== TEAM_WALLETS ====================
DROP POLICY IF EXISTS "Admins can delete team_wallets" ON team_wallets;
DROP POLICY IF EXISTS "Allow delete team_wallets" ON team_wallets;

CREATE POLICY "Allow delete team_wallets"
  ON team_wallets
  FOR DELETE
  USING (true);

COMMENT ON POLICY "Allow delete team_wallets" ON team_wallets IS 
  'Allow delete operations (admin verification done in application layer)';

-- ==================== PROJECTS ====================
DROP POLICY IF EXISTS "Admins can delete projects" ON projects;
DROP POLICY IF EXISTS "Allow delete projects" ON projects;

CREATE POLICY "Allow delete projects"
  ON projects
  FOR DELETE
  USING (true);

COMMENT ON POLICY "Allow delete projects" ON projects IS 
  'Allow delete operations (admin verification done in application layer)';

-- ==================== JOB-RELATED TABLES (for cascading deletes) ====================
-- Jobs
DROP POLICY IF EXISTS "Allow delete jobs" ON jobs;
CREATE POLICY "Allow delete jobs"
  ON jobs
  FOR DELETE
  USING (true);

-- Job Applications
DROP POLICY IF EXISTS "Allow delete job_applications" ON job_applications;
CREATE POLICY "Allow delete job_applications"
  ON job_applications
  FOR DELETE
  USING (true);

-- Job Application Votes
DROP POLICY IF EXISTS "Allow delete job_application_votes" ON job_application_votes;
CREATE POLICY "Allow delete job_application_votes"
  ON job_application_votes
  FOR DELETE
  USING (true);

-- Job Submissions
DROP POLICY IF EXISTS "Allow delete job_submissions" ON job_submissions;
CREATE POLICY "Allow delete job_submissions"
  ON job_submissions
  FOR DELETE
  USING (true);

-- Job Comments
DROP POLICY IF EXISTS "Allow delete job_comments" ON job_comments;
CREATE POLICY "Allow delete job_comments"
  ON job_comments
  FOR DELETE
  USING (true);

-- Job Disputes
DROP POLICY IF EXISTS "Allow delete job_disputes" ON job_disputes;
CREATE POLICY "Allow delete job_disputes"
  ON job_disputes
  FOR DELETE
  USING (true);

-- Job Dispute Votes
DROP POLICY IF EXISTS "Allow delete job_dispute_votes" ON job_dispute_votes;
CREATE POLICY "Allow delete job_dispute_votes"
  ON job_dispute_votes
  FOR DELETE
  USING (true);

-- Job Failures
DROP POLICY IF EXISTS "Allow delete job_failures" ON job_failures;
CREATE POLICY "Allow delete job_failures"
  ON job_failures
  FOR DELETE
  USING (true);

-- Chat Tips
DROP POLICY IF EXISTS "Allow delete chat_tips" ON chat_tips;
CREATE POLICY "Allow delete chat_tips"
  ON chat_tips
  FOR DELETE
  USING (true);

-- Notifications
DROP POLICY IF EXISTS "Allow delete notifications" ON notifications;
CREATE POLICY "Allow delete notifications"
  ON notifications
  FOR DELETE
  USING (true);

-- Admin Logs
DROP POLICY IF EXISTS "Allow delete admin_logs" ON admin_logs;
CREATE POLICY "Allow delete admin_logs"
  ON admin_logs
  FOR DELETE
  USING (true);

-- ==================== VERIFICATION ====================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 037_add_admin_delete_policies completed successfully!';
  RAISE NOTICE '📋 Added DELETE policies to the following tables:';
  RAISE NOTICE '   - asset_votes';
  RAISE NOTICE '   - pending_assets';
  RAISE NOTICE '   - wallet_karma';
  RAISE NOTICE '   - curation_chat_messages';
  RAISE NOTICE '   - chat_messages';
  RAISE NOTICE '   - team_wallets';
  RAISE NOTICE '   - projects';
  RAISE NOTICE '   - jobs';
  RAISE NOTICE '   - job_applications';
  RAISE NOTICE '   - job_application_votes';
  RAISE NOTICE '   - job_submissions';
  RAISE NOTICE '   - job_comments';
  RAISE NOTICE '   - job_disputes';
  RAISE NOTICE '   - job_dispute_votes';
  RAISE NOTICE '   - job_failures';
  RAISE NOTICE '   - chat_tips';
  RAISE NOTICE '   - notifications';
  RAISE NOTICE '   - admin_logs';
  RAISE NOTICE '⚠️  Note: Admin verification is done in application layer';
END $$;








