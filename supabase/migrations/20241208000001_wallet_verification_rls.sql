-- ============================================================================
-- Migration: 20241208000001_wallet_verification_rls.sql
-- Description: Enhanced RLS policies for wallet verification system
-- Created: 2024-12-08
-- Purpose: Secure access based on wallet verification status
-- ============================================================================

-- ============================================================================
-- ENABLE RLS ON TABLES (ensure all are enabled)
-- ============================================================================

-- New verification tables (may already be enabled from previous migration)
ALTER TABLE verification_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Existing tables (ensure RLS is enabled)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DROP EXISTING POLICIES TO RECREATE WITH ENHANCED LOGIC
-- ============================================================================

-- Drop verification table policies (from previous migration)
DROP POLICY IF EXISTS "Service can manage nonces" ON verification_nonces;
DROP POLICY IF EXISTS "Users can view own verifications" ON wallet_verifications;
DROP POLICY IF EXISTS "Service can insert verifications" ON wallet_verifications;
DROP POLICY IF EXISTS "Users can view own legal acceptances" ON legal_acceptances;
DROP POLICY IF EXISTS "Service can insert legal acceptances" ON legal_acceptances;

-- ============================================================================
-- SECTION 1: USER_PROFILES TABLE POLICIES
-- ============================================================================

-- Keep existing "Anyone can read user profiles" policy (needed for leaderboard, profiles)
-- Don't drop it - it's already correct

-- Drop and recreate update policy to protect verification fields
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Users can update their own profile (but NOT verification fields)
-- Verification fields are protected and can only be set via API bypass
CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE
USING (
    wallet_address = current_setting('app.current_wallet', true)
    OR current_setting('app.bypass_rls', true) = 'true'
)
WITH CHECK (
    -- Either API bypass is enabled
    current_setting('app.bypass_rls', true) = 'true'
    OR (
        -- Or user owns this profile AND verification fields unchanged
        wallet_address = current_setting('app.current_wallet', true)
        -- Note: verification field protection is handled at application level
        -- since RLS cannot compare OLD vs NEW values in WITH CHECK
    )
);

-- API/Service can insert profiles (for new user registration)
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

CREATE POLICY "Users can insert own profile"
ON user_profiles FOR INSERT
WITH CHECK (
    wallet_address = current_setting('app.current_wallet', true)
    OR current_setting('app.bypass_rls', true) = 'true'
);

-- ============================================================================
-- SECTION 2: MESSAGES TABLE POLICIES (Verified Wallets Only)
-- ============================================================================

-- Drop existing message policies to add verification requirement
DROP POLICY IF EXISTS "Users can read messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update own messages" ON messages;

-- Verified wallets can read messages in their conversations
CREATE POLICY "Verified wallets can read messages"
ON messages FOR SELECT
USING (
    -- API bypass
    current_setting('app.bypass_rls', true) = 'true'
    OR (
        -- User must be verified AND part of the conversation
        EXISTS (
            SELECT 1 FROM user_profiles p
            WHERE p.wallet_address = current_setting('app.current_wallet', true)
            AND p.wallet_verified = TRUE
        )
        AND EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = messages.conversation_id
            AND (
                c.participant_1 = current_setting('app.current_wallet', true)
                OR c.participant_2 = current_setting('app.current_wallet', true)
            )
        )
    )
);

-- Verified wallets can send messages
CREATE POLICY "Verified wallets can send messages"
ON messages FOR INSERT
WITH CHECK (
    -- API bypass
    current_setting('app.bypass_rls', true) = 'true'
    OR (
        -- Sender must be verified
        EXISTS (
            SELECT 1 FROM user_profiles p
            WHERE p.wallet_address = messages.sender_wallet
            AND p.wallet_verified = TRUE
        )
        AND messages.sender_wallet = current_setting('app.current_wallet', true)
    )
);

-- Users can update their own messages (mark as read)
CREATE POLICY "Users can update own messages"
ON messages FOR UPDATE
USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = messages.conversation_id
        AND (
            c.participant_1 = current_setting('app.current_wallet', true)
            OR c.participant_2 = current_setting('app.current_wallet', true)
        )
    )
);

-- ============================================================================
-- SECTION 3: CONVERSATIONS TABLE POLICIES (Verified Wallets Only)
-- ============================================================================

-- Drop existing conversation policies
DROP POLICY IF EXISTS "Users can read own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;

-- Verified wallets can read their conversations
CREATE POLICY "Verified wallets can read conversations"
ON conversations FOR SELECT
USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR (
        EXISTS (
            SELECT 1 FROM user_profiles p
            WHERE p.wallet_address = current_setting('app.current_wallet', true)
            AND p.wallet_verified = TRUE
        )
        AND (
            participant_1 = current_setting('app.current_wallet', true)
            OR participant_2 = current_setting('app.current_wallet', true)
        )
    )
);

-- Verified wallets can create conversations
CREATE POLICY "Verified wallets can create conversations"
ON conversations FOR INSERT
WITH CHECK (
    current_setting('app.bypass_rls', true) = 'true'
    OR (
        EXISTS (
            SELECT 1 FROM user_profiles p
            WHERE p.wallet_address = current_setting('app.current_wallet', true)
            AND p.wallet_verified = TRUE
        )
        AND (
            participant_1 = current_setting('app.current_wallet', true)
            OR participant_2 = current_setting('app.current_wallet', true)
        )
    )
);

-- Users can update their own conversations (archive, etc)
CREATE POLICY "Users can update own conversations"
ON conversations FOR UPDATE
USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR (
        participant_1 = current_setting('app.current_wallet', true)
        OR participant_2 = current_setting('app.current_wallet', true)
    )
);

-- ============================================================================
-- SECTION 4: JOBS TABLE POLICIES
-- ============================================================================

-- Keep existing "Anyone can view jobs" SELECT policy (public browse)
-- Don't modify existing admin and service policies

-- Drop and recreate INSERT policy to require verification
DROP POLICY IF EXISTS "Poster can create jobs" ON jobs;

-- Verified wallets can create jobs
CREATE POLICY "Verified wallets can create jobs"
ON jobs FOR INSERT
WITH CHECK (
    current_setting('app.bypass_rls', true) = 'true'
    OR (
        poster_wallet = current_setting('app.current_wallet', true)
        AND EXISTS (
            SELECT 1 FROM user_profiles p
            WHERE p.wallet_address = jobs.poster_wallet
            AND p.wallet_verified = TRUE
        )
    )
);

-- Update "Poster can update own jobs" to require verification
DROP POLICY IF EXISTS "Poster can update own jobs" ON jobs;

CREATE POLICY "Verified poster can update own jobs"
ON jobs FOR UPDATE
USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR (
        poster_wallet = current_setting('app.current_wallet', true)
        AND EXISTS (
            SELECT 1 FROM user_profiles p
            WHERE p.wallet_address = jobs.poster_wallet
            AND p.wallet_verified = TRUE
        )
    )
);

-- ============================================================================
-- SECTION 5: VERIFICATION NONCES (API-Only)
-- ============================================================================

-- No direct public access - all operations via API with bypass
CREATE POLICY "API manages verification nonces"
ON verification_nonces FOR ALL
USING (current_setting('app.bypass_rls', true) = 'true')
WITH CHECK (current_setting('app.bypass_rls', true) = 'true');

-- ============================================================================
-- SECTION 6: WALLET VERIFICATIONS (API-Only with Read Access)
-- ============================================================================

-- Users can view their own verification history
CREATE POLICY "Users can view own verifications"
ON wallet_verifications FOR SELECT
USING (
    wallet_address = current_setting('app.current_wallet', true)
    OR current_setting('app.bypass_rls', true) = 'true'
);

-- Only API can insert verification records
CREATE POLICY "API manages wallet verifications"
ON wallet_verifications FOR INSERT
WITH CHECK (current_setting('app.bypass_rls', true) = 'true');

-- No updates or deletes allowed (immutable audit log)
-- Implicitly denied by not having UPDATE/DELETE policies

-- ============================================================================
-- SECTION 7: LEGAL ACCEPTANCES (User Read, API Write)
-- ============================================================================

-- Users can view their own legal acceptance history
CREATE POLICY "Users can view own legal acceptances"
ON legal_acceptances FOR SELECT
USING (
    wallet_address = current_setting('app.current_wallet', true)
    OR current_setting('app.bypass_rls', true) = 'true'
);

-- Only API can insert legal acceptance records
CREATE POLICY "API records legal acceptances"
ON legal_acceptances FOR INSERT
WITH CHECK (current_setting('app.bypass_rls', true) = 'true');

-- No updates or deletes allowed (immutable legal record)
-- Implicitly denied by not having UPDATE/DELETE policies

-- ============================================================================
-- SECTION 8: HELPER FUNCTION FOR SETTING SESSION VARIABLES
-- ============================================================================

-- Function to set the current wallet session variable
-- Called by API middleware before database operations
CREATE OR REPLACE FUNCTION set_current_wallet(wallet_address TEXT)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_wallet', wallet_address, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_current_wallet(TEXT) IS 'Sets the current wallet for RLS policy evaluation. Call from API middleware.';

-- Function to enable RLS bypass (for API routes that need it)
CREATE OR REPLACE FUNCTION enable_rls_bypass()
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.bypass_rls', 'true', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION enable_rls_bypass() IS 'Enables RLS bypass for privileged API operations. Use sparingly.';

-- Function to disable RLS bypass
CREATE OR REPLACE FUNCTION disable_rls_bypass()
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.bypass_rls', 'false', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION disable_rls_bypass() IS 'Disables RLS bypass after privileged operation completes.';

-- Function to check if current user is verified
CREATE OR REPLACE FUNCTION current_wallet_is_verified()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE wallet_address = current_setting('app.current_wallet', true)
        AND wallet_verified = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION current_wallet_is_verified() IS 'Checks if the current session wallet is verified.';

-- ============================================================================
-- SECTION 9: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION set_current_wallet(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION enable_rls_bypass() TO service_role;
GRANT EXECUTE ON FUNCTION disable_rls_bypass() TO service_role;
GRANT EXECUTE ON FUNCTION current_wallet_is_verified() TO authenticated;

-- ============================================================================
-- USAGE NOTES FOR API MIDDLEWARE
-- ============================================================================

-- In your Next.js API routes, set session variables before queries:
--
-- For regular user operations:
--   await supabaseAdmin.rpc('set_current_wallet', { wallet_address: userWallet })
--
-- For privileged API operations (verification, admin):
--   await supabaseAdmin.rpc('enable_rls_bypass')
--   // ... do privileged operations ...
--   await supabaseAdmin.rpc('disable_rls_bypass')
--
-- Or use raw SQL:
--   await supabaseAdmin.from('_').select().then(() => {
--     return supabaseAdmin.rpc('set_config', {
--       setting_name: 'app.current_wallet',
--       new_value: userWallet,
--       is_local: true
--     })
--   })

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================


