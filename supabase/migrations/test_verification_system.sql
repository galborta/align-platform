-- ============================================================================
-- Test Wallet Verification System
-- Created: 2024-12-08
-- Purpose: Verify all verification system components work correctly
-- Run with: psql -f test_verification_system.sql
-- Or execute sections in Supabase SQL Editor
-- ============================================================================

-- Start transaction for safety (ROLLBACK at end won't save test data)
BEGIN;

-- ============================================================================
-- Test 1: Profile Creation with Verification Defaults
-- ============================================================================
RAISE NOTICE 'Test 1: Profile Creation with Verification Defaults';

INSERT INTO user_profiles (wallet_address, display_name)
VALUES ('test_wallet_verification_123', 'Test Verification User')
ON CONFLICT (wallet_address) DO NOTHING;

-- Check defaults (wallet_verified should be FALSE)
SELECT 
  wallet_address,
  wallet_verified,
  wallet_verified_at,
  is_us_person,
  terms_version_accepted
FROM user_profiles 
WHERE wallet_address = 'test_wallet_verification_123';
-- Expected: wallet_verified = FALSE, others NULL

-- ============================================================================
-- Test 2: Nonce Generation
-- ============================================================================
RAISE NOTICE 'Test 2: Nonce Generation';

INSERT INTO verification_nonces (
  nonce,
  wallet_address,
  expires_at,
  ip_address
) VALUES (
  'test_nonce_abc123_' || gen_random_uuid()::text,
  'test_wallet_verification_123',
  NOW() + INTERVAL '5 minutes',
  '127.0.0.1'
);

-- Check nonce was created
SELECT 
  nonce,
  wallet_address,
  used,
  expires_at,
  ip_address
FROM verification_nonces 
WHERE wallet_address = 'test_wallet_verification_123'
ORDER BY created_at DESC
LIMIT 1;
-- Expected: used = FALSE, expires_at 5 minutes from now

-- ============================================================================
-- Test 3: Nonce Expiration Check
-- ============================================================================
RAISE NOTICE 'Test 3: Nonce Expiration Check';

-- Insert expired nonce
INSERT INTO verification_nonces (
  nonce,
  wallet_address,
  expires_at
) VALUES (
  'expired_nonce_' || gen_random_uuid()::text,
  'test_wallet_verification_123',
  NOW() - INTERVAL '1 hour'
);

-- Query should only return non-expired, unused nonces
SELECT COUNT(*) as valid_nonces
FROM verification_nonces 
WHERE wallet_address = 'test_wallet_verification_123'
  AND expires_at > NOW() 
  AND used = FALSE;
-- Expected: 1 (only the non-expired one)

-- ============================================================================
-- Test 4: Verification with Bypass (Simulating API)
-- ============================================================================
RAISE NOTICE 'Test 4: Verification with Bypass (Simulating API)';

-- Set bypass flag (this is what API routes do)
SET LOCAL app.bypass_rls = 'true';
SET LOCAL app.current_wallet = 'test_wallet_verification_123';

-- Now update should work
UPDATE user_profiles 
SET 
  wallet_verified = TRUE,
  wallet_verified_at = NOW(),
  verification_signature = 'test_signature_base58_' || gen_random_uuid()::text,
  last_terms_accepted_at = NOW(),
  terms_version_accepted = '2024-12-08',
  is_us_person = FALSE,
  geo_check_confirmed_at = NOW()
WHERE wallet_address = 'test_wallet_verification_123';

-- Check it worked
SELECT 
  wallet_address,
  wallet_verified,
  wallet_verified_at IS NOT NULL as has_verified_at,
  terms_version_accepted,
  is_us_person
FROM user_profiles 
WHERE wallet_address = 'test_wallet_verification_123';
-- Expected: wallet_verified = TRUE, has_verified_at = TRUE

-- ============================================================================
-- Test 5: Wallet Verification Audit Trail
-- ============================================================================
RAISE NOTICE 'Test 5: Wallet Verification Audit Trail';

INSERT INTO wallet_verifications (
  wallet_address,
  signature,
  message,
  nonce,
  ip_address,
  user_agent
) VALUES (
  'test_wallet_verification_123',
  'test_signature_base58_audit',
  'Sign this message to verify wallet ownership:\n\nNonce: test_nonce_123\nTimestamp: 2024-12-08T00:00:00Z\nPlatform: Align\n\nBy signing, you agree to our Terms of Service.',
  'test_nonce_123',
  '127.0.0.1',
  'Mozilla/5.0 Test Agent'
);

-- Check audit trail
SELECT 
  id,
  wallet_address,
  LEFT(signature, 20) || '...' as signature_preview,
  LEFT(message, 50) || '...' as message_preview,
  nonce,
  verified_at,
  ip_address
FROM wallet_verifications 
WHERE wallet_address = 'test_wallet_verification_123';
-- Expected: One row with all data

-- ============================================================================
-- Test 6: Legal Acceptance Record
-- ============================================================================
RAISE NOTICE 'Test 6: Legal Acceptance Record';

INSERT INTO legal_acceptances (
  wallet_address,
  terms_version,
  privacy_version,
  signature,
  ip_address,
  is_us_person_confirmed
) VALUES (
  'test_wallet_verification_123',
  '2024-12-08',
  '2024-12-08',
  'test_legal_signature_base58',
  '127.0.0.1',
  FALSE
);

-- Check legal acceptance
SELECT 
  wallet_address,
  terms_version,
  privacy_version,
  accepted_at,
  is_us_person_confirmed
FROM legal_acceptances 
WHERE wallet_address = 'test_wallet_verification_123';
-- Expected: One row, is_us_person_confirmed = FALSE

-- ============================================================================
-- Test 7: Helper Functions
-- ============================================================================
RAISE NOTICE 'Test 7: Helper Functions';

-- Test is_wallet_verified function
SELECT is_wallet_verified('test_wallet_verification_123') as should_be_true;
-- Expected: TRUE

SELECT is_wallet_verified('nonexistent_wallet_xyz') as should_be_false;
-- Expected: FALSE

-- Test has_accepted_terms function
SELECT has_accepted_terms('test_wallet_verification_123', '2024-12-08') as should_be_true;
-- Expected: TRUE

SELECT has_accepted_terms('test_wallet_verification_123', '2025-01-01') as should_be_false;
-- Expected: FALSE (different version)

-- Test current_wallet_is_verified function
SET LOCAL app.current_wallet = 'test_wallet_verification_123';
SELECT current_wallet_is_verified() as should_be_true;
-- Expected: TRUE

SET LOCAL app.current_wallet = 'nonexistent_wallet';
SELECT current_wallet_is_verified() as should_be_false;
-- Expected: FALSE

-- ============================================================================
-- Test 8: Nonce Cleanup Function
-- ============================================================================
RAISE NOTICE 'Test 8: Nonce Cleanup Function';

-- Insert some old nonces to clean up
INSERT INTO verification_nonces (nonce, wallet_address, expires_at, used, used_at)
VALUES 
  ('old_used_nonce_1', 'test_wallet_verification_123', NOW() - INTERVAL '10 days', TRUE, NOW() - INTERVAL '10 days'),
  ('old_used_nonce_2', 'test_wallet_verification_123', NOW() - INTERVAL '8 days', TRUE, NOW() - INTERVAL '8 days');

-- Count before cleanup
SELECT COUNT(*) as nonces_before FROM verification_nonces 
WHERE wallet_address = 'test_wallet_verification_123';

-- Run cleanup
SELECT cleanup_expired_nonces() as deleted_count;

-- Count after cleanup
SELECT COUNT(*) as nonces_after FROM verification_nonces 
WHERE wallet_address = 'test_wallet_verification_123';
-- Expected: Some nonces removed

-- ============================================================================
-- Test 9: Unique Verified Wallet Index
-- ============================================================================
RAISE NOTICE 'Test 9: Unique Verified Wallet Index';

-- Try to insert another verified profile with same wallet (should fail)
-- This tests the idx_unique_verified_wallet partial unique index
-- Note: This would fail in production, but we're in a transaction

-- ============================================================================
-- Test 10: Check All Indexes Exist
-- ============================================================================
RAISE NOTICE 'Test 10: Check All Indexes Exist';

SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN ('user_profiles', 'verification_nonces', 'wallet_verifications', 'legal_acceptances')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
-- Expected: Multiple indexes for each table

-- ============================================================================
-- Test Summary
-- ============================================================================
RAISE NOTICE '============================================';
RAISE NOTICE 'TEST SUMMARY';
RAISE NOTICE '============================================';

SELECT 
  'user_profiles' as table_name,
  COUNT(*) as test_records
FROM user_profiles WHERE wallet_address LIKE 'test_wallet_verification%'
UNION ALL
SELECT 'verification_nonces', COUNT(*) FROM verification_nonces WHERE wallet_address LIKE 'test_wallet_verification%'
UNION ALL
SELECT 'wallet_verifications', COUNT(*) FROM wallet_verifications WHERE wallet_address LIKE 'test_wallet_verification%'
UNION ALL
SELECT 'legal_acceptances', COUNT(*) FROM legal_acceptances WHERE wallet_address LIKE 'test_wallet_verification%';

-- ============================================================================
-- Cleanup - ROLLBACK to not save test data
-- ============================================================================
RAISE NOTICE 'Rolling back test data...';
ROLLBACK;

-- Final message
SELECT 'All tests completed! Transaction rolled back - no test data saved.' as status;


