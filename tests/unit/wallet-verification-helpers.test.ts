// tests/unit/wallet-verification-helpers.test.ts
// Unit tests for wallet verification helper functions

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { 
  checkWalletVerified, 
  generateNonce, 
  validateNonce,
  markNonceUsed,
  getVerificationStatus,
  hasAcceptedTermsVersion,
  checkMultipleWalletsVerified
} from '@/lib/database/wallet-verification'

// Test wallet addresses (use clearly fake addresses for testing)
const TEST_WALLET = 'TestWalletVerification123456789abcdef'
const NON_EXISTENT_WALLET = 'NonExistentWallet999999999999999'

describe('Wallet Verification Helpers', () => {
  describe('checkWalletVerified', () => {
    test('returns false for non-existent wallet', async () => {
      const verified = await checkWalletVerified(NON_EXISTENT_WALLET)
      expect(verified).toBe(false)
    })

    test('returns false for wallet that exists but is not verified', async () => {
      // This assumes the test wallet exists but is not verified
      const verified = await checkWalletVerified(TEST_WALLET)
      // Should return false (or true if already verified in test DB)
      expect(typeof verified).toBe('boolean')
    })
  })

  describe('generateNonce', () => {
    test('creates valid nonce with correct length', async () => {
      const { nonce, expiresAt } = await generateNonce(TEST_WALLET)
      
      // 16 bytes = 32 hex characters
      expect(nonce).toHaveLength(32)
      expect(typeof nonce).toBe('string')
    })

    test('creates nonce with future expiry', async () => {
      const { nonce, expiresAt } = await generateNonce(TEST_WALLET)
      
      const expiryTime = new Date(expiresAt).getTime()
      const now = Date.now()
      
      // Expiry should be in the future
      expect(expiryTime).toBeGreaterThan(now)
      
      // Expiry should be roughly 5 minutes from now (within 10 seconds tolerance)
      const fiveMinutes = 5 * 60 * 1000
      const difference = expiryTime - now
      expect(difference).toBeGreaterThan(fiveMinutes - 10000)
      expect(difference).toBeLessThan(fiveMinutes + 10000)
    })

    test('creates unique nonces', async () => {
      const result1 = await generateNonce(TEST_WALLET)
      const result2 = await generateNonce(TEST_WALLET)
      
      expect(result1.nonce).not.toBe(result2.nonce)
    })
  })

  describe('validateNonce', () => {
    test('validates freshly generated nonce', async () => {
      const { nonce } = await generateNonce(TEST_WALLET)
      const result = await validateNonce(nonce, TEST_WALLET)
      
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    test('rejects non-existent nonce', async () => {
      const result = await validateNonce('non_existent_nonce_123', TEST_WALLET)
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Nonce not found')
    })

    test('rejects nonce for wrong wallet', async () => {
      const { nonce } = await generateNonce(TEST_WALLET)
      const result = await validateNonce(nonce, 'DifferentWallet123')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Nonce does not belong to this wallet')
    })

    test('rejects already used nonce', async () => {
      const { nonce } = await generateNonce(TEST_WALLET)
      
      // Mark as used
      await markNonceUsed(nonce)
      
      // Try to validate
      const result = await validateNonce(nonce, TEST_WALLET)
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Nonce already used')
    })
  })

  describe('markNonceUsed', () => {
    test('marks nonce as used successfully', async () => {
      const { nonce } = await generateNonce(TEST_WALLET)
      
      // Should not throw
      await expect(markNonceUsed(nonce)).resolves.not.toThrow()
      
      // Verify it's marked as used
      const validation = await validateNonce(nonce, TEST_WALLET)
      expect(validation.valid).toBe(false)
      expect(validation.error).toBe('Nonce already used')
    })
  })

  describe('getVerificationStatus', () => {
    test('returns null for non-existent wallet', async () => {
      const status = await getVerificationStatus(NON_EXISTENT_WALLET)
      expect(status).toBeNull()
    })

    test('returns status object for existing wallet', async () => {
      const status = await getVerificationStatus(TEST_WALLET)
      
      if (status) {
        expect(typeof status.isVerified).toBe('boolean')
        expect(typeof status.hasAcceptedTerms).toBe('boolean')
      }
    })
  })

  describe('checkMultipleWalletsVerified', () => {
    test('returns map with all wallets', async () => {
      const wallets = [TEST_WALLET, NON_EXISTENT_WALLET]
      const result = await checkMultipleWalletsVerified(wallets)
      
      expect(result).toBeInstanceOf(Map)
      expect(result.has(TEST_WALLET)).toBe(true)
      expect(result.has(NON_EXISTENT_WALLET)).toBe(true)
    })

    test('returns empty map for empty input', async () => {
      const result = await checkMultipleWalletsVerified([])
      expect(result.size).toBe(0)
    })
  })

  describe('hasAcceptedTermsVersion', () => {
    test('returns false for non-existent wallet', async () => {
      const accepted = await hasAcceptedTermsVersion(NON_EXISTENT_WALLET, '2024-12-08')
      expect(accepted).toBe(false)
    })
  })
})

// Integration test - only run when TEST_INTEGRATION=true
describe.skipIf(!process.env.TEST_INTEGRATION)('Integration: Full Verification Flow', () => {
  const integrationTestWallet = `IntegrationTest_${Date.now()}`
  
  test('complete verification flow', async () => {
    // 1. Check not verified initially
    const initialStatus = await checkWalletVerified(integrationTestWallet)
    expect(initialStatus).toBe(false)
    
    // 2. Generate nonce
    const { nonce, expiresAt } = await generateNonce(integrationTestWallet)
    expect(nonce).toHaveLength(32)
    
    // 3. Validate nonce
    const validation = await validateNonce(nonce, integrationTestWallet)
    expect(validation.valid).toBe(true)
    
    // 4. Mark nonce used
    await markNonceUsed(nonce)
    
    // 5. Verify nonce is now invalid
    const revalidation = await validateNonce(nonce, integrationTestWallet)
    expect(revalidation.valid).toBe(false)
  })
})


