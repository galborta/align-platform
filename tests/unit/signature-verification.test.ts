// tests/unit/signature-verification.test.ts
// Unit tests for Solana signature verification utility

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import * as nacl from 'tweetnacl'
import bs58 from 'bs58'
import {
  verifySolanaSignature,
  generateVerificationMessage,
  generateNonce,
  isValidWalletAddress,
  truncateAddress
} from '@/lib/solana-signature'

// Test vectors - we'll generate real signatures for testing
// Using nacl.sign.keyPair() to create deterministic test keys
const TEST_SEED = new Uint8Array(32).fill(42) // Deterministic seed for reproducible tests
const testKeyPair = nacl.sign.keyPair.fromSeed(TEST_SEED)
const TEST_PUBLIC_KEY_BYTES = testKeyPair.publicKey
const TEST_SECRET_KEY = testKeyPair.secretKey
const TEST_PUBLIC_KEY_BASE58 = bs58.encode(TEST_PUBLIC_KEY_BYTES)

// Helper to sign a message with test keys
function signTestMessage(message: string): string {
  const messageBytes = new TextEncoder().encode(message)
  const signature = nacl.sign.detached(messageBytes, TEST_SECRET_KEY)
  return bs58.encode(signature)
}

// Spy on console for logging verification
let consoleSpy: ReturnType<typeof vi.spyOn>
let consoleWarnSpy: ReturnType<typeof vi.spyOn>
let consoleErrorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleSpy.mockRestore()
  consoleWarnSpy.mockRestore()
  consoleErrorSpy.mockRestore()
})

describe('verifySolanaSignature', () => {
  describe('Valid signatures', () => {
    test('should return true for valid signature', () => {
      const message = 'Hello, Orggly!'
      const signature = signTestMessage(message)
      
      console.log('[Test] Testing valid signature verification...')
      console.log('[Test] Public key:', TEST_PUBLIC_KEY_BASE58)
      console.log('[Test] Message:', message)
      console.log('[Test] Signature:', signature.slice(0, 20) + '...')
      
      const result = verifySolanaSignature(message, signature, TEST_PUBLIC_KEY_BASE58)
      
      expect(result).toBe(true)
    })

    test('should verify long message correctly', () => {
      const message = generateVerificationMessage(
        TEST_PUBLIC_KEY_BASE58,
        'test-nonce-12345678',
        '2024-12-08T12:00:00Z'
      )
      const signature = signTestMessage(message)
      
      console.log('[Test] Testing long message verification...')
      console.log('[Test] Message length:', message.length)
      
      const result = verifySolanaSignature(message, signature, TEST_PUBLIC_KEY_BASE58)
      
      expect(result).toBe(true)
    })

    test('should verify message with special characters', () => {
      const message = 'Message with émojis 🚀 and spëcial chars: @#$%^&*()'
      const signature = signTestMessage(message)
      
      const result = verifySolanaSignature(message, signature, TEST_PUBLIC_KEY_BASE58)
      
      expect(result).toBe(true)
    })

    test('should verify message with newlines', () => {
      const message = 'Line 1\nLine 2\nLine 3'
      const signature = signTestMessage(message)
      
      const result = verifySolanaSignature(message, signature, TEST_PUBLIC_KEY_BASE58)
      
      expect(result).toBe(true)
    })
  })

  describe('Invalid signatures', () => {
    test('should return false for tampered message', () => {
      const originalMessage = 'Original message'
      const signature = signTestMessage(originalMessage)
      const tamperedMessage = 'Tampered message'
      
      console.log('[Test] Testing tampered message detection...')
      
      const result = verifySolanaSignature(tamperedMessage, signature, TEST_PUBLIC_KEY_BASE58)
      
      expect(result).toBe(false)
    })

    test('should return false for wrong wallet', () => {
      const message = 'Test message'
      const signature = signTestMessage(message)
      
      // Generate a different key pair
      const differentSeed = new Uint8Array(32).fill(99)
      const differentKeyPair = nacl.sign.keyPair.fromSeed(differentSeed)
      const wrongPublicKey = bs58.encode(differentKeyPair.publicKey)
      
      console.log('[Test] Testing wrong wallet detection...')
      console.log('[Test] Correct wallet:', TEST_PUBLIC_KEY_BASE58.slice(0, 8) + '...')
      console.log('[Test] Wrong wallet:', wrongPublicKey.slice(0, 8) + '...')
      
      const result = verifySolanaSignature(message, signature, wrongPublicKey)
      
      expect(result).toBe(false)
    })

    test('should return false for corrupted signature', () => {
      const message = 'Test message'
      const signature = signTestMessage(message)
      
      // Corrupt the signature by changing some characters
      const corruptedSignature = 'A' + signature.slice(1)
      
      console.log('[Test] Testing corrupted signature detection...')
      
      const result = verifySolanaSignature(message, corruptedSignature, TEST_PUBLIC_KEY_BASE58)
      
      expect(result).toBe(false)
    })

    test('should return false for completely fake signature', () => {
      const message = 'Test message'
      // Generate a random 64-byte fake signature
      const fakeSignatureBytes = new Uint8Array(64).fill(0)
      const fakeSignature = bs58.encode(fakeSignatureBytes)
      
      const result = verifySolanaSignature(message, fakeSignature, TEST_PUBLIC_KEY_BASE58)
      
      expect(result).toBe(false)
    })
  })

  describe('Invalid inputs', () => {
    test('should return false for empty message', () => {
      const signature = signTestMessage('anything')
      
      const result = verifySolanaSignature('', signature, TEST_PUBLIC_KEY_BASE58)
      
      expect(result).toBe(false)
    })

    test('should return false for empty signature', () => {
      const result = verifySolanaSignature('Test message', '', TEST_PUBLIC_KEY_BASE58)
      
      expect(result).toBe(false)
    })

    test('should return false for empty public key', () => {
      const signature = signTestMessage('Test message')
      
      const result = verifySolanaSignature('Test message', signature, '')
      
      expect(result).toBe(false)
    })

    test('should return false for null/undefined inputs', () => {
      // @ts-expect-error Testing invalid input
      expect(verifySolanaSignature(null, 'sig', 'key')).toBe(false)
      
      // @ts-expect-error Testing invalid input
      expect(verifySolanaSignature('msg', undefined, 'key')).toBe(false)
      
      // @ts-expect-error Testing invalid input
      expect(verifySolanaSignature('msg', 'sig', null)).toBe(false)
    })

    test('should return false for invalid base58 signature', () => {
      const result = verifySolanaSignature(
        'Test message',
        'not-valid-base58!!!',
        TEST_PUBLIC_KEY_BASE58
      )
      
      expect(result).toBe(false)
    })

    test('should return false for signature with wrong length', () => {
      // Ed25519 signatures must be exactly 64 bytes
      const shortSignature = bs58.encode(new Uint8Array(32)) // 32 bytes instead of 64
      
      const result = verifySolanaSignature(
        'Test message',
        shortSignature,
        TEST_PUBLIC_KEY_BASE58
      )
      
      expect(result).toBe(false)
    })

    test('should return false for invalid public key format', () => {
      const signature = signTestMessage('Test message')
      
      const result = verifySolanaSignature(
        'Test message',
        signature,
        'invalid-public-key'
      )
      
      expect(result).toBe(false)
    })

    test('should return false for public key with wrong length', () => {
      const signature = signTestMessage('Test message')
      // Create an invalid public key (wrong length)
      const shortKeyBytes = new Uint8Array(16) // 16 bytes instead of 32
      const shortKey = bs58.encode(shortKeyBytes)
      
      const result = verifySolanaSignature(
        'Test message',
        signature,
        shortKey
      )
      
      expect(result).toBe(false)
    })
  })

  describe('Error handling', () => {
    test('should never throw, always return false on error', () => {
      // Test with various malformed inputs
      const testCases = [
        { message: '', signature: '', publicKey: '' },
        { message: 'test', signature: 'invalid', publicKey: 'invalid' },
        { message: 123 as unknown as string, signature: 'sig', publicKey: 'key' },
        { message: 'test', signature: {} as unknown as string, publicKey: 'key' },
      ]
      
      for (const testCase of testCases) {
        expect(() => {
          verifySolanaSignature(testCase.message, testCase.signature, testCase.publicKey)
        }).not.toThrow()
      }
    })

    test('should log errors with [Signature Verification] prefix', () => {
      // Call with invalid input to trigger error logging
      verifySolanaSignature('test', 'invalid-signature!!!', TEST_PUBLIC_KEY_BASE58)
      
      // Check that console.error was called with the prefix
      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorCall = consoleErrorSpy.mock.calls.find(call => 
        typeof call[0] === 'string' && call[0].includes('[Signature Verification]')
      )
      expect(errorCall).toBeDefined()
    })
  })
})

describe('generateVerificationMessage', () => {
  test('generates message with correct format', () => {
    const wallet = '7PViwKTestWallet123456789'
    const nonce = 'abc123xyz789'
    const timestamp = '2024-12-08T10:30:00Z'
    
    const message = generateVerificationMessage(wallet, nonce, timestamp)
    
    expect(message).toContain('Welcome to Orggly!')
    expect(message).toContain('Terms of Service')
    expect(message).toContain('Privacy Policy')
    expect(message).toContain('not a US person')
    expect(message).toContain('18+ years old')
    expect(message).toContain(`Wallet: ${wallet}`)
    expect(message).toContain(`Timestamp: ${timestamp}`)
    expect(message).toContain(`Nonce: ${nonce}`)
  })

  test('generates different messages for different nonces', () => {
    const wallet = '7PViwKTestWallet123456789'
    const timestamp = '2024-12-08T10:30:00Z'
    
    const message1 = generateVerificationMessage(wallet, 'nonce1', timestamp)
    const message2 = generateVerificationMessage(wallet, 'nonce2', timestamp)
    
    expect(message1).not.toBe(message2)
  })

  test('generates different messages for different timestamps', () => {
    const wallet = '7PViwKTestWallet123456789'
    const nonce = 'same-nonce'
    
    const message1 = generateVerificationMessage(wallet, nonce, '2024-12-08T10:30:00Z')
    const message2 = generateVerificationMessage(wallet, nonce, '2024-12-08T10:31:00Z')
    
    expect(message1).not.toBe(message2)
  })
})

describe('generateNonce', () => {
  test('generates 32-character hex string by default', () => {
    const nonce = generateNonce()
    
    expect(nonce).toHaveLength(32)
    expect(/^[0-9a-f]+$/i.test(nonce)).toBe(true)
  })

  test('generates nonces of specified length', () => {
    const nonce8 = generateNonce(8)
    const nonce32 = generateNonce(32)
    
    expect(nonce8).toHaveLength(16) // 8 bytes = 16 hex chars
    expect(nonce32).toHaveLength(64) // 32 bytes = 64 hex chars
  })

  test('generates unique nonces', () => {
    const nonces = new Set<string>()
    
    // Generate 100 nonces and verify uniqueness
    for (let i = 0; i < 100; i++) {
      nonces.add(generateNonce())
    }
    
    expect(nonces.size).toBe(100)
  })
})

describe('isValidWalletAddress', () => {
  test('returns true for valid Solana address', () => {
    expect(isValidWalletAddress(TEST_PUBLIC_KEY_BASE58)).toBe(true)
  })

  test('returns false for empty string', () => {
    expect(isValidWalletAddress('')).toBe(false)
  })

  test('returns false for null/undefined', () => {
    // @ts-expect-error Testing invalid input
    expect(isValidWalletAddress(null)).toBe(false)
    // @ts-expect-error Testing invalid input
    expect(isValidWalletAddress(undefined)).toBe(false)
  })

  test('returns false for invalid base58 string', () => {
    expect(isValidWalletAddress('invalid!!!characters')).toBe(false)
  })

  test('returns false for too short address', () => {
    expect(isValidWalletAddress('short')).toBe(false)
  })

  test('returns false for too long address', () => {
    const tooLong = 'A'.repeat(100)
    expect(isValidWalletAddress(tooLong)).toBe(false)
  })
})

describe('truncateAddress', () => {
  test('truncates address correctly with defaults', () => {
    const address = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij'
    const truncated = truncateAddress(address)
    
    expect(truncated).toBe('ABCD...ghij')
  })

  test('truncates with custom lengths', () => {
    const address = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij'
    
    expect(truncateAddress(address, 6, 6)).toBe('ABCDEF...efghij')
    expect(truncateAddress(address, 2, 2)).toBe('AB...ij')
  })

  test('returns full address if too short', () => {
    const shortAddress = 'ABCD'
    expect(truncateAddress(shortAddress)).toBe('ABCD')
  })

  test('handles empty string', () => {
    expect(truncateAddress('')).toBe('')
  })

  test('handles null/undefined', () => {
    // @ts-expect-error Testing invalid input
    expect(truncateAddress(null)).toBe('')
    // @ts-expect-error Testing invalid input
    expect(truncateAddress(undefined)).toBe('')
  })
})

// Integration test with realistic verification flow
describe('Integration: Full Verification Flow', () => {
  test('complete verification flow with generated message', () => {
    // 1. Generate verification components
    const wallet = TEST_PUBLIC_KEY_BASE58
    const nonce = generateNonce()
    const timestamp = new Date().toISOString()
    
    console.log('[Integration Test] Starting verification flow...')
    console.log('[Integration Test] Wallet:', truncateAddress(wallet))
    console.log('[Integration Test] Nonce:', nonce)
    console.log('[Integration Test] Timestamp:', timestamp)
    
    // 2. Generate the verification message
    const message = generateVerificationMessage(wallet, nonce, timestamp)
    console.log('[Integration Test] Message generated, length:', message.length)
    
    // 3. Sign the message (simulating wallet)
    const signature = signTestMessage(message)
    console.log('[Integration Test] Signature generated:', signature.slice(0, 20) + '...')
    
    // 4. Verify the signature
    const isValid = verifySolanaSignature(message, signature, wallet)
    console.log('[Integration Test] Verification result:', isValid)
    
    expect(isValid).toBe(true)
  })

  test('detects replay attack with different nonce', () => {
    const wallet = TEST_PUBLIC_KEY_BASE58
    const originalNonce = 'original-nonce-12345'
    const timestamp = new Date().toISOString()
    
    // Sign with original nonce
    const message = generateVerificationMessage(wallet, originalNonce, timestamp)
    const signature = signTestMessage(message)
    
    // Try to use signature with different nonce (replay attack)
    const replayNonce = 'different-nonce-99999'
    const replayMessage = generateVerificationMessage(wallet, replayNonce, timestamp)
    
    const isValid = verifySolanaSignature(replayMessage, signature, wallet)
    
    expect(isValid).toBe(false)
  })
})
