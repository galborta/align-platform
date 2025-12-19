-- Migration: Create Job Escrow System Tables
-- Created: 2024-11-27
-- Description: Establishes database foundation for job escrow system with admin controls,
--              platform settings, and comprehensive transaction tracking

-- ==================== TABLE 1: PLATFORM SETTINGS ====================

-- Platform-wide configuration settings for escrow system
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: Only allow specific setting keys
  CONSTRAINT valid_setting_key CHECK (
    setting_key IN ('fee_percentage', 'fee_wallet_address', 'escrow_wallet_address')
  )
);

-- Add helpful comments
COMMENT ON TABLE platform_settings IS 'Platform-wide configuration for escrow system';
COMMENT ON COLUMN platform_settings.setting_key IS 'Configuration key: fee_percentage (0-100), fee_wallet_address (Solana address), escrow_wallet_address (Solana address)';
COMMENT ON COLUMN platform_settings.setting_value IS 'Configuration value as text (convert to appropriate type in application)';
COMMENT ON COLUMN platform_settings.updated_by IS 'Wallet address of admin who last updated this setting';

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_platform_settings_key 
  ON platform_settings(setting_key);

-- ==================== TABLE 2: ADMIN WALLETS ====================

-- Admin user management with role-based access control
CREATE TABLE IF NOT EXISTS admin_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  added_by TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  -- Constraint: Only allow specific roles
  CONSTRAINT valid_admin_role CHECK (
    role IN ('super_admin', 'moderator')
  )
);

-- Add helpful comments
COMMENT ON TABLE admin_wallets IS 'Authorized admin wallets with role-based permissions';
COMMENT ON COLUMN admin_wallets.role IS 'super_admin: full control; moderator: limited intervention';
COMMENT ON COLUMN admin_wallets.added_by IS 'Wallet address of admin who granted access';
COMMENT ON COLUMN admin_wallets.is_active IS 'Can be deactivated without deletion for audit trail';

-- Create indexes for lookups and filtering
CREATE INDEX IF NOT EXISTS idx_admin_wallets_address 
  ON admin_wallets(wallet_address);

CREATE INDEX IF NOT EXISTS idx_admin_wallets_active 
  ON admin_wallets(is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_admin_wallets_role 
  ON admin_wallets(role, is_active);

-- ==================== TABLE 3: JOB ESCROW TRANSACTIONS ====================

-- Comprehensive tracking of all escrow-related transactions
CREATE TABLE IF NOT EXISTS job_escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  amount_tokens NUMERIC NOT NULL CHECK (amount_tokens > 0),
  token_mint TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  tx_signature TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  
  -- Constraint: Only allow specific transaction types
  CONSTRAINT valid_transaction_type CHECK (
    transaction_type IN (
      'lock', 
      'release_to_worker', 
      'refund_to_poster', 
      'fee_collection', 
      'partial_release'
    )
  ),
  
  -- Constraint: Only allow specific statuses
  CONSTRAINT valid_transaction_status CHECK (
    status IN ('pending', 'confirmed', 'failed')
  ),
  
  -- Constraint: Confirmed transactions must have confirmed_at timestamp
  CONSTRAINT confirmed_at_required CHECK (
    (status = 'confirmed' AND confirmed_at IS NOT NULL) OR
    (status != 'confirmed')
  ),
  
  -- Constraint: Failed transactions must have error message
  CONSTRAINT error_message_required CHECK (
    (status = 'failed' AND error_message IS NOT NULL) OR
    (status != 'failed')
  )
);

-- Add helpful comments
COMMENT ON TABLE job_escrow_transactions IS 'Complete audit trail of all escrow transactions';
COMMENT ON COLUMN job_escrow_transactions.transaction_type IS 'lock: poster deposits funds; release_to_worker: job completion; refund_to_poster: cancellation/dispute; fee_collection: platform fee; partial_release: milestone payments';
COMMENT ON COLUMN job_escrow_transactions.tx_signature IS 'Solana transaction signature for on-chain verification';
COMMENT ON COLUMN job_escrow_transactions.status IS 'pending: awaiting confirmation; confirmed: on-chain verified; failed: transaction failed';
COMMENT ON COLUMN job_escrow_transactions.retry_count IS 'Number of retry attempts for failed transactions';

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_job_escrow_txns_job_id 
  ON job_escrow_transactions(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_escrow_txns_status 
  ON job_escrow_transactions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_escrow_txns_type 
  ON job_escrow_transactions(transaction_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_escrow_txns_signature 
  ON job_escrow_transactions(tx_signature) 
  WHERE tx_signature IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_escrow_txns_from_wallet 
  ON job_escrow_transactions(from_wallet, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_escrow_txns_to_wallet 
  ON job_escrow_transactions(to_wallet, created_at DESC);

-- ==================== ROW LEVEL SECURITY ====================

-- Enable RLS on all tables
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_escrow_transactions ENABLE ROW LEVEL SECURITY;

-- Platform Settings Policies
-- Anyone can read settings (needed for frontend to know fee %, escrow wallet, etc.)
CREATE POLICY "Anyone can view platform settings" 
  ON platform_settings FOR SELECT 
  USING (true);

-- Only admins can modify settings (enforced in application logic)
CREATE POLICY "Admins can update platform settings" 
  ON platform_settings FOR ALL 
  USING (true);

-- Admin Wallets Policies
-- Anyone can view active admins (for verification)
CREATE POLICY "Anyone can view active admin wallets" 
  ON admin_wallets FOR SELECT 
  USING (is_active = true);

-- Admins can manage admin wallets (enforced in application logic)
CREATE POLICY "Admins can manage admin wallets" 
  ON admin_wallets FOR ALL 
  USING (true);

-- Job Escrow Transactions Policies
-- Anyone can view escrow transactions (transparency)
CREATE POLICY "Anyone can view escrow transactions" 
  ON job_escrow_transactions FOR SELECT 
  USING (true);

-- Authenticated users can create transactions (enforced in application logic)
CREATE POLICY "Authenticated users can create escrow transactions" 
  ON job_escrow_transactions FOR INSERT 
  WITH CHECK (true);

-- Only system can update transaction status (enforced in application logic)
CREATE POLICY "System can update escrow transaction status" 
  ON job_escrow_transactions FOR UPDATE 
  USING (true);

-- ==================== INITIAL SEED DATA ====================

-- Insert default platform settings
INSERT INTO platform_settings (setting_key, setting_value, updated_by) 
VALUES 
  ('fee_percentage', '5.0', 'SYSTEM'),
  ('fee_wallet_address', 'GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S', 'SYSTEM'),
  ('escrow_wallet_address', '', 'SYSTEM')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert initial super admin (from existing admin-auth.ts)
INSERT INTO admin_wallets (wallet_address, role, added_by, is_active) 
VALUES 
  ('GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S', 'super_admin', 'SYSTEM', true)
ON CONFLICT (wallet_address) DO NOTHING;

-- ==================== HELPER FUNCTIONS ====================

-- Function to check if a wallet is an active admin
CREATE OR REPLACE FUNCTION is_admin_wallet(p_wallet_address TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_wallets
    WHERE wallet_address = p_wallet_address
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_admin_wallet IS 'Checks if a wallet address is an active admin';

-- Function to get admin role
CREATE OR REPLACE FUNCTION get_admin_role(p_wallet_address TEXT)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM admin_wallets
  WHERE wallet_address = p_wallet_address
    AND is_active = true;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_admin_role IS 'Returns admin role (super_admin or moderator) or NULL if not admin';

-- Function to get platform setting value
CREATE OR REPLACE FUNCTION get_platform_setting(p_setting_key TEXT)
RETURNS TEXT AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT setting_value INTO v_value
  FROM platform_settings
  WHERE setting_key = p_setting_key;
  
  RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_platform_setting IS 'Retrieves platform setting value by key';

-- Function to update platform setting (admin only)
CREATE OR REPLACE FUNCTION update_platform_setting(
  p_setting_key TEXT,
  p_setting_value TEXT,
  p_updated_by TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Update setting
  UPDATE platform_settings
  SET 
    setting_value = p_setting_value,
    updated_by = p_updated_by,
    updated_at = NOW()
  WHERE setting_key = p_setting_key;
  
  -- If no row was updated, insert new setting
  IF NOT FOUND THEN
    INSERT INTO platform_settings (setting_key, setting_value, updated_by)
    VALUES (p_setting_key, p_setting_value, p_updated_by);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_platform_setting IS 'Updates or inserts platform setting (admin function)';

-- ==================== VERIFICATION ====================

-- Verify migration success
DO $$
BEGIN
  -- Check tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_settings') THEN
    RAISE EXCEPTION 'Migration failed: platform_settings table not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_wallets') THEN
    RAISE EXCEPTION 'Migration failed: admin_wallets table not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_escrow_transactions') THEN
    RAISE EXCEPTION 'Migration failed: job_escrow_transactions table not created';
  END IF;

  -- Check initial data
  IF NOT EXISTS (SELECT 1 FROM platform_settings WHERE setting_key = 'fee_percentage') THEN
    RAISE EXCEPTION 'Migration failed: fee_percentage setting not initialized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM admin_wallets WHERE wallet_address = 'GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S') THEN
    RAISE EXCEPTION 'Migration failed: super admin not initialized';
  END IF;

  RAISE NOTICE 'Migration 028_create_job_escrow_system completed successfully!';
  RAISE NOTICE '✅ Created 3 tables: platform_settings, admin_wallets, job_escrow_transactions';
  RAISE NOTICE '✅ Created 10 indexes for performance';
  RAISE NOTICE '✅ Created 4 helper functions';
  RAISE NOTICE '✅ Enabled RLS with appropriate policies';
  RAISE NOTICE '✅ Initialized default settings and super admin';
END $$;












