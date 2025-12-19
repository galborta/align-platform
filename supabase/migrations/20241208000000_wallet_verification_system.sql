-- ============================================================================
-- Migration: 20241208000000_wallet_verification_system.sql
-- Description: Add wallet verification, legal compliance, and audit trails
-- Created: 2024-12-08
-- Purpose: Enable cryptographic wallet ownership verification, ToS tracking,
--          and compliance audit trails for legal protection
-- ============================================================================

-- ============================================================================
-- SECTION 1: MODIFY USER_PROFILES TABLE
-- ============================================================================

-- Add verification columns to existing user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS wallet_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS wallet_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verification_signature TEXT,
ADD COLUMN IF NOT EXISTS is_us_person BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS geo_check_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_terms_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS terms_version_accepted TEXT;

-- Add comments for new columns
COMMENT ON COLUMN user_profiles.wallet_verified IS 'Whether the wallet ownership has been cryptographically verified via message signing';
COMMENT ON COLUMN user_profiles.wallet_verified_at IS 'Timestamp when wallet was last verified';
COMMENT ON COLUMN user_profiles.verification_signature IS 'The signature used to verify wallet ownership';
COMMENT ON COLUMN user_profiles.is_us_person IS 'Self-attestation: user confirms they are a US person (for regulatory compliance)';
COMMENT ON COLUMN user_profiles.geo_check_confirmed_at IS 'When the user confirmed their geographic/regulatory status';
COMMENT ON COLUMN user_profiles.last_terms_accepted_at IS 'When the user last accepted Terms of Service';
COMMENT ON COLUMN user_profiles.terms_version_accepted IS 'Version string of the Terms of Service accepted';

-- Ensure wallet_address is unique (drop and recreate if needed)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_profiles_wallet_address_unique'
    ) THEN
        ALTER TABLE user_profiles 
        ADD CONSTRAINT user_profiles_wallet_address_unique UNIQUE (wallet_address);
    END IF;
END $$;

-- Create unique index: one wallet can only be verified once
-- This is a partial unique index - ensures no duplicate verified wallets
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_verified_wallet 
ON user_profiles(wallet_address) 
WHERE wallet_verified = TRUE;

-- Index for faster verification status lookups (partial index for efficiency)
CREATE INDEX IF NOT EXISTS idx_wallet_verified 
ON user_profiles(wallet_verified) 
WHERE wallet_verified = TRUE;

-- Index for wallet address lookups (if not already exists)
CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet_address 
ON user_profiles(wallet_address);

-- ============================================================================
-- SECTION 2: VERIFICATION NONCES TABLE
-- ============================================================================

-- Nonce management for signature verification
-- Prevents replay attacks by tracking single-use, time-limited nonces
CREATE TABLE IF NOT EXISTS verification_nonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nonce TEXT UNIQUE NOT NULL,
    wallet_address TEXT NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    ip_address TEXT,
    
    -- Constraints
    CONSTRAINT nonce_not_empty CHECK (nonce <> ''),
    CONSTRAINT wallet_not_empty CHECK (wallet_address <> '')
);

-- Add table comment
COMMENT ON TABLE verification_nonces IS 'Single-use nonces for wallet signature verification. Prevents replay attacks.';
COMMENT ON COLUMN verification_nonces.nonce IS 'Unique random string included in the message to sign';
COMMENT ON COLUMN verification_nonces.wallet_address IS 'The wallet address requesting verification';
COMMENT ON COLUMN verification_nonces.used IS 'Whether this nonce has been consumed';
COMMENT ON COLUMN verification_nonces.expires_at IS 'When this nonce expires (typically 5-10 minutes)';
COMMENT ON COLUMN verification_nonces.used_at IS 'When the nonce was consumed for verification';
COMMENT ON COLUMN verification_nonces.ip_address IS 'IP address that requested the nonce (for audit)';

-- Index for looking up unused, unexpired nonces (most common query)
CREATE INDEX IF NOT EXISTS idx_nonce_lookup 
ON verification_nonces(nonce) 
WHERE used = FALSE;

-- Index for wallet-based queries (check existing nonces for a wallet)
CREATE INDEX IF NOT EXISTS idx_nonce_wallet 
ON verification_nonces(wallet_address);

-- Index for cleanup of expired nonces (cron job efficiency)
CREATE INDEX IF NOT EXISTS idx_nonce_expiry 
ON verification_nonces(expires_at) 
WHERE used = FALSE;

-- ============================================================================
-- SECTION 3: WALLET VERIFICATIONS TABLE (AUDIT TRAIL)
-- ============================================================================

-- Complete audit trail of all successful wallet verifications
-- Stores full signature data for compliance, dispute resolution, and legal protection
CREATE TABLE IF NOT EXISTS wallet_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    signature TEXT NOT NULL,
    message TEXT NOT NULL,
    nonce TEXT NOT NULL,
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    previous_verification_id UUID REFERENCES wallet_verifications(id),
    
    -- Constraints
    CONSTRAINT verification_wallet_not_empty CHECK (wallet_address <> ''),
    CONSTRAINT verification_signature_not_empty CHECK (signature <> ''),
    CONSTRAINT verification_message_not_empty CHECK (message <> '')
);

-- Add table comment
COMMENT ON TABLE wallet_verifications IS 'Immutable audit trail of all wallet verifications. Required for compliance and dispute resolution.';
COMMENT ON COLUMN wallet_verifications.signature IS 'The cryptographic signature proving wallet ownership';
COMMENT ON COLUMN wallet_verifications.message IS 'The full message that was signed (includes nonce, timestamp, ToS acknowledgment)';
COMMENT ON COLUMN wallet_verifications.nonce IS 'The nonce used in this verification (references verification_nonces)';
COMMENT ON COLUMN wallet_verifications.previous_verification_id IS 'Links to previous verification if user re-verified (chain of verifications)';

-- Index for wallet-based audit queries
CREATE INDEX IF NOT EXISTS idx_wallet_verification_wallet 
ON wallet_verifications(wallet_address);

-- Index for chronological queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_wallet_verification_date 
ON wallet_verifications(verified_at DESC);

-- ============================================================================
-- SECTION 4: LEGAL ACCEPTANCES TABLE
-- ============================================================================

-- Track Terms of Service and Privacy Policy acceptances
-- Required for GDPR compliance, legal protection, and regulatory requirements
CREATE TABLE IF NOT EXISTS legal_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    terms_version TEXT NOT NULL,
    privacy_version TEXT NOT NULL,
    accepted_at TIMESTAMPTZ DEFAULT NOW(),
    signature TEXT NOT NULL,
    ip_address TEXT,
    is_us_person_confirmed BOOLEAN DEFAULT FALSE,
    
    -- Constraints
    CONSTRAINT legal_wallet_not_empty CHECK (wallet_address <> ''),
    CONSTRAINT legal_terms_version_not_empty CHECK (terms_version <> ''),
    CONSTRAINT legal_privacy_version_not_empty CHECK (privacy_version <> ''),
    CONSTRAINT legal_signature_not_empty CHECK (signature <> '')
);

-- Add table comment
COMMENT ON TABLE legal_acceptances IS 'Immutable record of legal document acceptances. Required for GDPR and regulatory compliance.';
COMMENT ON COLUMN legal_acceptances.terms_version IS 'Version of Terms of Service accepted (e.g., "1.0.0", "2024-12-08")';
COMMENT ON COLUMN legal_acceptances.privacy_version IS 'Version of Privacy Policy accepted';
COMMENT ON COLUMN legal_acceptances.signature IS 'Cryptographic signature proving the user accepted these terms';
COMMENT ON COLUMN legal_acceptances.is_us_person_confirmed IS 'User self-attested US person status at time of acceptance';

-- Index for wallet-based legal queries
CREATE INDEX IF NOT EXISTS idx_legal_acceptance_wallet 
ON legal_acceptances(wallet_address);

-- Index for version-based queries (useful for ToS migrations/re-acceptance requirements)
CREATE INDEX IF NOT EXISTS idx_legal_acceptance_version 
ON legal_acceptances(terms_version);

-- Index for chronological queries
CREATE INDEX IF NOT EXISTS idx_legal_acceptance_date 
ON legal_acceptances(accepted_at DESC);

-- ============================================================================
-- SECTION 5: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE verification_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Verification Nonces: Service role only (API routes create/consume nonces)
CREATE POLICY "Service can manage nonces"
    ON verification_nonces
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Wallet Verifications: Users can view their own, service can insert
CREATE POLICY "Users can view own verifications"
    ON wallet_verifications
    FOR SELECT
    USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet');

CREATE POLICY "Service can insert verifications"
    ON wallet_verifications
    FOR INSERT
    WITH CHECK (true);

-- Legal Acceptances: Users can view their own, service can insert
CREATE POLICY "Users can view own legal acceptances"
    ON legal_acceptances
    FOR SELECT
    USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet');

CREATE POLICY "Service can insert legal acceptances"
    ON legal_acceptances
    FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- SECTION 6: CLEANUP FUNCTIONS
-- ============================================================================

-- Function to clean up expired nonces (run via cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_nonces()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM verification_nonces
    WHERE expires_at < NOW() - INTERVAL '1 day'
    OR (used = TRUE AND used_at < NOW() - INTERVAL '7 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_nonces() IS 'Removes expired and old used nonces. Run daily via cron.';

-- Function to check if a wallet is verified
CREATE OR REPLACE FUNCTION is_wallet_verified(p_wallet_address TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE wallet_address = p_wallet_address
        AND wallet_verified = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_wallet_verified(TEXT) IS 'Checks if a wallet has been cryptographically verified';

-- Function to check if user has accepted current ToS
CREATE OR REPLACE FUNCTION has_accepted_terms(p_wallet_address TEXT, p_required_version TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE wallet_address = p_wallet_address
        AND terms_version_accepted = p_required_version
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION has_accepted_terms(TEXT, TEXT) IS 'Checks if a wallet has accepted the required ToS version';

-- ============================================================================
-- SECTION 7: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_expired_nonces() TO authenticated;
GRANT EXECUTE ON FUNCTION is_wallet_verified(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION has_accepted_terms(TEXT, TEXT) TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- To verify the migration was successful, run:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name LIKE '%verif%';
-- SELECT * FROM pg_indexes WHERE tablename = 'verification_nonces';
-- SELECT * FROM pg_indexes WHERE tablename = 'wallet_verifications';
-- SELECT * FROM pg_indexes WHERE tablename = 'legal_acceptances';
-- SELECT * FROM pg_policies WHERE tablename IN ('verification_nonces', 'wallet_verifications', 'legal_acceptances');



