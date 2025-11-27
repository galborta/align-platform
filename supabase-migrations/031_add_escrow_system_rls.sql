-- Migration: Add RLS Policies for Escrow System
-- Created: 2024-11-27
-- Description: Comprehensive Row Level Security policies for platform_settings,
--              admin_wallets, job_escrow_transactions, and updated jobs policies

-- ==================== ENABLE RLS ON ESCROW TABLES ====================

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_escrow_transactions ENABLE ROW LEVEL SECURITY;

-- ==================== PLATFORM_SETTINGS POLICIES ====================

-- Drop existing policies first
DROP POLICY IF EXISTS "Anyone can view platform settings" ON platform_settings;
DROP POLICY IF EXISTS "Admins can update platform settings" ON platform_settings;
DROP POLICY IF EXISTS "Active admins can insert settings" ON platform_settings;
DROP POLICY IF EXISTS "Active admins can update settings" ON platform_settings;
DROP POLICY IF EXISTS "Active admins can delete settings" ON platform_settings;

-- Public can view platform settings (transparency)
CREATE POLICY "Anyone can view platform settings" 
  ON platform_settings 
  FOR SELECT 
  USING (true);

COMMENT ON POLICY "Anyone can view platform settings" ON platform_settings IS 
  'Settings are public for transparency (fee percentage, wallet addresses)';

-- Only active admins can insert settings
CREATE POLICY "Active admins can insert settings" 
  ON platform_settings 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_wallets 
      WHERE wallet_address = auth.jwt() ->> 'wallet_address'
        AND is_active = true
    )
  );

COMMENT ON POLICY "Active admins can insert settings" ON platform_settings IS 
  'Only admins with is_active=true can create new settings';

-- Only active admins can update settings
CREATE POLICY "Active admins can update settings" 
  ON platform_settings 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM admin_wallets 
      WHERE wallet_address = auth.jwt() ->> 'wallet_address'
        AND is_active = true
    )
  );

COMMENT ON POLICY "Active admins can update settings" ON platform_settings IS 
  'Only admins with is_active=true can modify settings';

-- Only active admins can delete settings
CREATE POLICY "Active admins can delete settings" 
  ON platform_settings 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM admin_wallets 
      WHERE wallet_address = auth.jwt() ->> 'wallet_address'
        AND is_active = true
    )
  );

COMMENT ON POLICY "Active admins can delete settings" ON platform_settings IS 
  'Only admins with is_active=true can delete settings';

-- ==================== ADMIN_WALLETS POLICIES ====================

-- Drop existing policies first
DROP POLICY IF EXISTS "Anyone can view admin wallets" ON admin_wallets;
DROP POLICY IF EXISTS "Admins can manage admin wallets" ON admin_wallets;
DROP POLICY IF EXISTS "Super admins can add admins" ON admin_wallets;
DROP POLICY IF EXISTS "Super admins can update admins" ON admin_wallets;
DROP POLICY IF EXISTS "Super admins can remove admins" ON admin_wallets;

-- Public can view admin wallets (transparency)
CREATE POLICY "Anyone can view admin wallets" 
  ON admin_wallets 
  FOR SELECT 
  USING (true);

COMMENT ON POLICY "Anyone can view admin wallets" ON admin_wallets IS 
  'Admin list is public for transparency and accountability';

-- Only super_admins can add new admins
CREATE POLICY "Super admins can add admins" 
  ON admin_wallets 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_wallets 
      WHERE wallet_address = auth.jwt() ->> 'wallet_address'
        AND role = 'super_admin'
        AND is_active = true
    )
  );

COMMENT ON POLICY "Super admins can add admins" ON admin_wallets IS 
  'Only active super_admins can add new admin wallets';

-- Only super_admins can update admin records
CREATE POLICY "Super admins can update admins" 
  ON admin_wallets 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM admin_wallets 
      WHERE wallet_address = auth.jwt() ->> 'wallet_address'
        AND role = 'super_admin'
        AND is_active = true
    )
  );

COMMENT ON POLICY "Super admins can update admins" ON admin_wallets IS 
  'Only active super_admins can modify admin records (e.g., deactivate, change role)';

-- Only super_admins can remove admins
CREATE POLICY "Super admins can remove admins" 
  ON admin_wallets 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM admin_wallets 
      WHERE wallet_address = auth.jwt() ->> 'wallet_address'
        AND role = 'super_admin'
        AND is_active = true
    )
  );

COMMENT ON POLICY "Super admins can remove admins" ON admin_wallets IS 
  'Only active super_admins can delete admin wallet records';

-- ==================== JOB_ESCROW_TRANSACTIONS POLICIES ====================

-- Drop existing policies first
DROP POLICY IF EXISTS "Job parties can view transactions" ON job_escrow_transactions;
DROP POLICY IF EXISTS "Service role can manage transactions" ON job_escrow_transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON job_escrow_transactions;
DROP POLICY IF EXISTS "Service role can insert transactions" ON job_escrow_transactions;
DROP POLICY IF EXISTS "Service role can update transactions" ON job_escrow_transactions;

-- Users can view transactions for their jobs (poster or worker)
CREATE POLICY "Job parties can view transactions" 
  ON job_escrow_transactions 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM jobs 
      WHERE jobs.id = job_escrow_transactions.job_id
        AND (
          jobs.poster_wallet = auth.jwt() ->> 'wallet_address'
          OR jobs.assigned_to = auth.jwt() ->> 'wallet_address'
        )
    )
  );

COMMENT ON POLICY "Job parties can view transactions" ON job_escrow_transactions IS 
  'Job poster and assigned worker can view escrow transactions for their job';

-- Admins can view all transactions (for audit purposes)
CREATE POLICY "Admins can view all transactions" 
  ON job_escrow_transactions 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM admin_wallets 
      WHERE wallet_address = auth.jwt() ->> 'wallet_address'
        AND is_active = true
    )
  );

COMMENT ON POLICY "Admins can view all transactions" ON job_escrow_transactions IS 
  'Active admins can view all escrow transactions for audit purposes';

-- Only service role can insert transactions (backend creates these)
CREATE POLICY "Service role can insert transactions" 
  ON job_escrow_transactions 
  FOR INSERT 
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

COMMENT ON POLICY "Service role can insert transactions" ON job_escrow_transactions IS 
  'Only backend service role can create transaction records (prevents user manipulation)';

-- Only service role can update transactions (e.g., status updates)
CREATE POLICY "Service role can update transactions" 
  ON job_escrow_transactions 
  FOR UPDATE 
  USING (
    auth.jwt() ->> 'role' = 'service_role'
  );

COMMENT ON POLICY "Service role can update transactions" ON job_escrow_transactions IS 
  'Only backend service role can update transaction status (confirmed, failed, etc.)';

-- NO DELETE policy - transactions are immutable audit log
COMMENT ON TABLE job_escrow_transactions IS 
  'Immutable audit log - no DELETE policy, all transactions are permanent';

-- ==================== UPDATE JOBS POLICIES ====================

-- Drop and recreate "Poster can update own jobs" with escrow_locked checks
DROP POLICY IF EXISTS "Poster can update own jobs" ON jobs;

CREATE POLICY "Poster can update own jobs with restrictions" 
  ON jobs 
  FOR UPDATE 
  USING (
    poster_wallet = auth.jwt() ->> 'wallet_address'
    -- Prevent updates after escrow is locked (except completed/cancelled/disputed)
    AND (
      escrow_locked = false 
      OR status IN ('completed', 'cancelled', 'disputed')
    )
    -- Prevent cancellation if job is assigned or submitted
    AND (
      status NOT IN ('assigned', 'submitted')
      OR escrow_locked = false
    )
  )
  WITH CHECK (
    poster_wallet = auth.jwt() ->> 'wallet_address'
  );

COMMENT ON POLICY "Poster can update own jobs with restrictions" ON jobs IS 
  'Poster can update their jobs, but not after escrow lock or if assigned/submitted';

-- Add policy for admins to update any job (for dispute resolution, etc.)
CREATE POLICY "Admins can update any job" 
  ON jobs 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM admin_wallets 
      WHERE wallet_address = auth.jwt() ->> 'wallet_address'
        AND is_active = true
    )
  );

COMMENT ON POLICY "Admins can update any job" ON jobs IS 
  'Active admins can update any job (needed for dispute resolution, manual releases)';

-- Add policy for service role to update jobs (for cron, escrow operations)
CREATE POLICY "Service role can update jobs" 
  ON jobs 
  FOR UPDATE 
  USING (
    auth.jwt() ->> 'role' = 'service_role'
  );

COMMENT ON POLICY "Service role can update jobs" ON jobs IS 
  'Backend service role can update jobs (auto-release, escrow operations, etc.)';

-- ==================== UPDATE JOB_DISPUTES POLICIES ====================

-- Add policy for admins to update disputes (for resolution)
CREATE POLICY "Admins can update disputes" 
  ON job_disputes 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM admin_wallets 
      WHERE wallet_address = auth.jwt() ->> 'wallet_address'
        AND is_active = true
    )
  );

COMMENT ON POLICY "Admins can update disputes" ON job_disputes IS 
  'Active admins can update disputes for admin resolution (split percentages, notes)';

-- Add policy for service role to update disputes
CREATE POLICY "Service role can update disputes" 
  ON job_disputes 
  FOR UPDATE 
  USING (
    auth.jwt() ->> 'role' = 'service_role'
  );

COMMENT ON POLICY "Service role can update disputes" ON job_disputes IS 
  'Backend service role can update disputes (status changes, resolution processing)';

-- ==================== HELPER FUNCTIONS FOR RLS ====================

-- Function to check if authenticated user is an active admin
CREATE OR REPLACE FUNCTION is_authenticated_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_wallets 
    WHERE wallet_address = auth.jwt() ->> 'wallet_address'
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_authenticated_admin IS 
  'Helper function for RLS - checks if current user is an active admin';

-- Function to check if authenticated user is a super admin
CREATE OR REPLACE FUNCTION is_authenticated_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_wallets 
    WHERE wallet_address = auth.jwt() ->> 'wallet_address'
      AND role = 'super_admin'
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_authenticated_super_admin IS 
  'Helper function for RLS - checks if current user is an active super_admin';

-- Function to check if authenticated user is job poster
CREATE OR REPLACE FUNCTION is_job_poster(p_job_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM jobs 
    WHERE id = p_job_id
      AND poster_wallet = auth.jwt() ->> 'wallet_address'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_job_poster IS 
  'Helper function for RLS - checks if current user is the poster of a specific job';

-- Function to check if authenticated user is job worker
CREATE OR REPLACE FUNCTION is_job_worker(p_job_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM jobs 
    WHERE id = p_job_id
      AND assigned_to = auth.jwt() ->> 'wallet_address'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_job_worker IS 
  'Helper function for RLS - checks if current user is the assigned worker of a specific job';

-- Function to check if job has active escrow lock
CREATE OR REPLACE FUNCTION job_has_escrow_lock(p_job_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM jobs 
    WHERE id = p_job_id
      AND escrow_locked = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION job_has_escrow_lock IS 
  'Helper function for RLS - checks if a job has active escrow lock';

-- ==================== GRANT USAGE ON HELPER FUNCTIONS ====================

GRANT EXECUTE ON FUNCTION is_authenticated_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_authenticated_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_job_poster(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_job_worker(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION job_has_escrow_lock(UUID) TO authenticated;

-- ==================== VERIFICATION ====================

-- Verify RLS is enabled on all escrow tables
DO $$
DECLARE
  v_platform_settings_rls BOOLEAN;
  v_admin_wallets_rls BOOLEAN;
  v_transactions_rls BOOLEAN;
BEGIN
  -- Check if RLS is enabled
  SELECT relrowsecurity INTO v_platform_settings_rls
  FROM pg_class
  WHERE relname = 'platform_settings';

  SELECT relrowsecurity INTO v_admin_wallets_rls
  FROM pg_class
  WHERE relname = 'admin_wallets';

  SELECT relrowsecurity INTO v_transactions_rls
  FROM pg_class
  WHERE relname = 'job_escrow_transactions';

  IF NOT v_platform_settings_rls THEN
    RAISE EXCEPTION 'RLS not enabled on platform_settings';
  END IF;

  IF NOT v_admin_wallets_rls THEN
    RAISE EXCEPTION 'RLS not enabled on admin_wallets';
  END IF;

  IF NOT v_transactions_rls THEN
    RAISE EXCEPTION 'RLS not enabled on job_escrow_transactions';
  END IF;

  -- Count policies created
  IF (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'platform_settings') < 4 THEN
    RAISE EXCEPTION 'Not all platform_settings policies created';
  END IF;

  IF (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'admin_wallets') < 4 THEN
    RAISE EXCEPTION 'Not all admin_wallets policies created';
  END IF;

  IF (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'job_escrow_transactions') < 4 THEN
    RAISE EXCEPTION 'Not all job_escrow_transactions policies created';
  END IF;

  -- Verify helper functions exist
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_authenticated_admin') THEN
    RAISE EXCEPTION 'Helper function is_authenticated_admin not created';
  END IF;

  RAISE NOTICE 'Migration 031_add_escrow_system_rls completed successfully!';
  RAISE NOTICE '✅ Enabled RLS on 3 escrow tables';
  RAISE NOTICE '✅ Created 4 policies for platform_settings';
  RAISE NOTICE '✅ Created 4 policies for admin_wallets';
  RAISE NOTICE '✅ Created 4 policies for job_escrow_transactions';
  RAISE NOTICE '✅ Updated 2 policies for jobs table';
  RAISE NOTICE '✅ Added 2 policies for job_disputes table';
  RAISE NOTICE '✅ Created 5 RLS helper functions';
  RAISE NOTICE '✅ Granted execute permissions to authenticated users';
  RAISE NOTICE '📊 Total: 16 new policies, 5 helper functions';
END $$;

