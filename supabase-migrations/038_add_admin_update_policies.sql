-- Migration: Add Admin UPDATE policies for pending_assets and related tables
-- Created: 2024-12-03
-- Description: Allows admin wallets to update records for project management

-- ==================== PENDING_ASSETS ====================
DROP POLICY IF EXISTS "Allow update pending_assets" ON pending_assets;
DROP POLICY IF EXISTS "Admins can update pending_assets" ON pending_assets;

CREATE POLICY "Allow update pending_assets"
  ON pending_assets
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Allow update pending_assets" ON pending_assets IS 
  'Allow update operations (admin verification done in application layer)';

-- ==================== ASSET_VOTES ====================
DROP POLICY IF EXISTS "Allow update asset_votes" ON asset_votes;

CREATE POLICY "Allow update asset_votes"
  ON asset_votes
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Allow update asset_votes" ON asset_votes IS 
  'Allow update operations (admin verification done in application layer)';

-- ==================== WALLET_KARMA ====================
DROP POLICY IF EXISTS "Allow update wallet_karma" ON wallet_karma;

CREATE POLICY "Allow update wallet_karma"
  ON wallet_karma
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Allow update wallet_karma" ON wallet_karma IS 
  'Allow update operations (admin verification done in application layer)';

-- ==================== CURATION_CHAT_MESSAGES ====================
DROP POLICY IF EXISTS "Allow update curation_chat_messages" ON curation_chat_messages;

CREATE POLICY "Allow update curation_chat_messages"
  ON curation_chat_messages
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Allow update curation_chat_messages" ON curation_chat_messages IS 
  'Allow update operations (admin verification done in application layer)';

-- ==================== CHAT_MESSAGES ====================
DROP POLICY IF EXISTS "Allow update chat_messages" ON chat_messages;

CREATE POLICY "Allow update chat_messages"
  ON chat_messages
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Allow update chat_messages" ON chat_messages IS 
  'Allow update operations (admin verification done in application layer)';

-- ==================== TEAM_WALLETS ====================
DROP POLICY IF EXISTS "Allow update team_wallets" ON team_wallets;

CREATE POLICY "Allow update team_wallets"
  ON team_wallets
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Allow update team_wallets" ON team_wallets IS 
  'Allow update operations (admin verification done in application layer)';

-- ==================== NOTIFICATIONS ====================
DROP POLICY IF EXISTS "Allow update notifications" ON notifications;

CREATE POLICY "Allow update notifications"
  ON notifications
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Allow update notifications" ON notifications IS 
  'Allow update operations (admin verification done in application layer)';

-- ==================== VERIFICATION ====================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration add_admin_update_policies completed successfully!';
  RAISE NOTICE '📋 Added UPDATE policies to the following tables:';
  RAISE NOTICE '   - pending_assets';
  RAISE NOTICE '   - asset_votes';
  RAISE NOTICE '   - wallet_karma';
  RAISE NOTICE '   - curation_chat_messages';
  RAISE NOTICE '   - chat_messages';
  RAISE NOTICE '   - team_wallets';
  RAISE NOTICE '   - notifications';
  RAISE NOTICE '⚠️  Note: Admin verification is done in application layer';
END $$;







