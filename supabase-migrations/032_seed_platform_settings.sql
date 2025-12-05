-- Migration: Seed Platform Settings
-- Created: 2024-11-27
-- Description: Initialize platform settings and admin wallet with production values

-- ==================== SEED PLATFORM SETTINGS ====================

-- Platform fee percentage (default: 5%)
-- This fee is charged on top of job payments and goes to the platform fee wallet
-- Formula: total_escrow = job_payment * (1 + fee_percentage / 100)
-- Example: 100 token job with 5% fee = 105 tokens locked in escrow
INSERT INTO platform_settings (setting_key, setting_value, updated_by) VALUES
  ('fee_percentage', '5', 'system')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();

COMMENT ON COLUMN platform_settings.setting_value IS 
  'For fee_percentage: percentage charged on job payments (e.g., 5 = 5%)';

-- Platform fee collection wallet
-- All platform fees are transferred to this wallet address
-- This should be a secure wallet controlled by the platform team
-- Used for: Platform revenue, operational costs, token buybacks
INSERT INTO platform_settings (setting_key, setting_value, updated_by) VALUES
  ('fee_wallet_address', 'GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S', 'system')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();

COMMENT ON COLUMN platform_settings.setting_value IS 
  'For fee_wallet_address: Solana wallet address where platform fees are sent';

-- Escrow holding wallet
-- All job payments are temporarily held in this wallet during job execution
-- This wallet should be controlled by a secure backend service
-- Funds flow: Poster → Escrow Wallet → Worker (on completion) or Poster (on refund)
INSERT INTO platform_settings (setting_key, setting_value, updated_by) VALUES
  ('escrow_wallet_address', 'GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S', 'system')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();

COMMENT ON COLUMN platform_settings.setting_value IS 
  'For escrow_wallet_address: Solana wallet address that holds escrowed funds during job execution';

-- ==================== SEED ADMIN WALLET ====================

-- Add primary super admin wallet
-- This wallet has full admin privileges including:
-- - Managing other admins (add/remove/modify)
-- - Updating platform settings
-- - Resolving disputes with custom split percentages
-- - Viewing all escrow transactions
-- - Manual escrow release/refund
INSERT INTO admin_wallets (wallet_address, role, added_by, is_active) VALUES
  ('GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S', 'super_admin', 'system', true)
ON CONFLICT (wallet_address) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  role = EXCLUDED.role;

COMMENT ON TABLE admin_wallets IS 
  'Admin wallet addresses with their roles. Public for transparency.';

COMMENT ON COLUMN admin_wallets.role IS 
  'super_admin: Full control (manage admins, settings). moderator: Limited control (resolve disputes only).';

-- ==================== VERIFICATION ====================

-- Verify all settings were created/updated
DO $$
DECLARE
  v_fee_percentage TEXT;
  v_fee_wallet TEXT;
  v_escrow_wallet TEXT;
  v_admin_exists BOOLEAN;
BEGIN
  -- Check platform settings
  SELECT setting_value INTO v_fee_percentage
  FROM platform_settings
  WHERE setting_key = 'fee_percentage';

  SELECT setting_value INTO v_fee_wallet
  FROM platform_settings
  WHERE setting_key = 'fee_wallet_address';

  SELECT setting_value INTO v_escrow_wallet
  FROM platform_settings
  WHERE setting_key = 'escrow_wallet_address';

  IF v_fee_percentage IS NULL THEN
    RAISE EXCEPTION 'Failed to seed fee_percentage setting';
  END IF;

  IF v_fee_wallet IS NULL THEN
    RAISE EXCEPTION 'Failed to seed fee_wallet_address setting';
  END IF;

  IF v_escrow_wallet IS NULL THEN
    RAISE EXCEPTION 'Failed to seed escrow_wallet_address setting';
  END IF;

  -- Check admin wallet
  SELECT EXISTS (
    SELECT 1 FROM admin_wallets 
    WHERE wallet_address = 'GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S'
      AND role = 'super_admin'
      AND is_active = true
  ) INTO v_admin_exists;

  IF NOT v_admin_exists THEN
    RAISE EXCEPTION 'Failed to seed admin wallet';
  END IF;

  RAISE NOTICE 'Migration 032_seed_platform_settings completed successfully!';
  RAISE NOTICE '✅ Platform Settings:';
  RAISE NOTICE '   - Fee Percentage: %', v_fee_percentage;
  RAISE NOTICE '   - Fee Wallet: %', v_fee_wallet;
  RAISE NOTICE '   - Escrow Wallet: %', v_escrow_wallet;
  RAISE NOTICE '✅ Admin Wallet:';
  RAISE NOTICE '   - Address: GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S';
  RAISE NOTICE '   - Role: super_admin';
  RAISE NOTICE '   - Status: active';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT SECURITY NOTES:';
  RAISE NOTICE '   1. Escrow wallet private key must be secured in backend environment';
  RAISE NOTICE '   2. Fee wallet should be a cold storage wallet';
  RAISE NOTICE '   3. Admin wallet has full platform control';
  RAISE NOTICE '   4. All settings are public (RLS allows SELECT by anyone)';
  RAISE NOTICE '   5. Only active admins can modify settings';
END $$;

-- ==================== DISPLAY CURRENT CONFIGURATION ====================

-- Show final platform configuration
SELECT 
  setting_key,
  setting_value,
  updated_by,
  updated_at
FROM platform_settings
ORDER BY setting_key;

SELECT 
  wallet_address,
  role,
  added_by,
  is_active,
  added_at
FROM admin_wallets
WHERE is_active = true
ORDER BY added_at;






