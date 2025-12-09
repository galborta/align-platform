/**
 * Solana Signature Verification Utility
 * 
 * Provides cryptographic verification of wallet signatures for Orggly.
 * Uses Ed25519 signatures as per Solana standard.
 * 
 * @module lib/solana-signature
 */

import * as nacl from 'tweetnacl'
import { PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'

/**
 * Verifies a Solana wallet signature
 * 
 * This proves the user controls the private key for the given public key
 * by verifying a cryptographic signature over a message.
 * 
 * @param message - The original message that was signed
 * @param signature - Base58-encoded signature from wallet
 * @param publicKey - Base58-encoded public key (wallet address)
 * @returns true if signature is valid, false otherwise
 * 
 * @example
 * const message = "Welcome to Orggly!..."
 * const signature = "5K7VqJ..." // from wallet.signMessage()
 * const wallet = "7PViwK..." // user's wallet address
 * const valid = verifySolanaSignature(message, signature, wallet)
 */
export function verifySolanaSignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    // Validate inputs
    if (!message || !signature || !publicKey) {
      console.warn('[Signature Verification] ❌ Missing required parameters:', {
        hasMessage: !!message,
        hasSignature: !!signature,
        hasPublicKey: !!publicKey
      })
      return false
    }

    // Log verification attempt (truncated for security)
    console.log('[Signature Verification] Verifying signature...', {
      messageLength: message.length,
      signatureLength: signature.length,
      wallet: `${publicKey.slice(0, 8)}...${publicKey.slice(-4)}`
    })

    // Convert message to bytes using TextEncoder (UTF-8)
    const messageBytes = new TextEncoder().encode(message)
    console.log('[Signature Verification] Message bytes length:', messageBytes.length)

    // Decode signature from base58 to Uint8Array
    let signatureBytes: Uint8Array
    try {
      signatureBytes = bs58.decode(signature)
      console.log('[Signature Verification] Signature bytes length:', signatureBytes.length)
      
      // Ed25519 signatures should be exactly 64 bytes
      if (signatureBytes.length !== 64) {
        console.warn('[Signature Verification] ❌ Invalid signature length:', signatureBytes.length, '(expected 64)')
        return false
      }
    } catch (decodeError) {
      console.error('[Signature Verification] ❌ Failed to decode signature from base58:', decodeError)
      return false
    }

    // Convert public key string to bytes using Solana PublicKey class
    let publicKeyBytes: Uint8Array
    try {
      const solanaPublicKey = new PublicKey(publicKey)
      publicKeyBytes = solanaPublicKey.toBytes()
      console.log('[Signature Verification] Public key bytes length:', publicKeyBytes.length)
      
      // Ed25519 public keys should be exactly 32 bytes
      if (publicKeyBytes.length !== 32) {
        console.warn('[Signature Verification] ❌ Invalid public key length:', publicKeyBytes.length, '(expected 32)')
        return false
      }
    } catch (keyError) {
      console.error('[Signature Verification] ❌ Invalid public key format:', keyError)
      return false
    }

    // Verify the Ed25519 signature using tweetnacl
    const verified = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    )

    if (verified) {
      console.log(`[Signature Verification] ✅ Valid signature for wallet: ${publicKey.slice(0, 8)}...${publicKey.slice(-4)}`)
    } else {
      console.warn(`[Signature Verification] ❌ Invalid signature for wallet: ${publicKey.slice(0, 8)}...${publicKey.slice(-4)}`)
    }

    return verified
  } catch (error) {
    console.error('[Signature Verification] ❌ Unexpected error during verification:', error)
    if (error instanceof Error) {
      console.error('[Signature Verification] Error name:', error.name)
      console.error('[Signature Verification] Error message:', error.message)
      console.error('[Signature Verification] Error stack:', error.stack)
    }
    return false
  }
}

/**
 * Generates the standard verification message format for Orggly
 * 
 * This creates the exact message that users sign during wallet verification.
 * The message includes legal agreements and unique identifiers to prevent replay attacks.
 * 
 * @param wallet - The wallet address being verified
 * @param nonce - Unique random string for this verification attempt
 * @param timestamp - ISO 8601 timestamp of the verification request
 * @returns The formatted message string to be signed
 * 
 * @example
 * const message = generateVerificationMessage(
 *   "7PViwK...",
 *   "abc123xyz789",
 *   "2024-12-08T10:30:00Z"
 * )
 */
export function generateVerificationMessage(
  wallet: string,
  nonce: string,
  timestamp: string
): string {
  return `Welcome to Orggly!

By signing this message, you confirm:
- You have read and agree to the Terms of Service (v2024-12-08)
- You have read and agree to the Privacy Policy
- You are not a US person
- You are 18+ years old

Wallet: ${wallet}
Timestamp: ${timestamp}
Nonce: ${nonce}`
}

/**
 * Generates a cryptographically secure random nonce
 * 
 * Used to prevent replay attacks by ensuring each verification
 * message is unique.
 * 
 * @param length - Length of the nonce in bytes (default: 16, results in 32 hex chars)
 * @returns Hex-encoded random string
 * 
 * @example
 * const nonce = generateNonce() // "a1b2c3d4e5f6..."
 */
export function generateNonce(length: number = 16): string {
  // Use crypto API if available (browser/Node.js 15+)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
  
  // Fallback for older Node.js environments
  const chars = 'abcdef0123456789'
  let nonce = ''
  for (let i = 0; i < length * 2; i++) {
    nonce += chars[Math.floor(Math.random() * chars.length)]
  }
  return nonce
}

/**
 * Validates a wallet address format (basic check)
 * 
 * Performs a quick validation that the address could be a valid Solana address.
 * Does NOT verify the address exists on-chain.
 * 
 * @param address - The wallet address to validate
 * @returns true if format is valid, false otherwise
 * 
 * @example
 * isValidWalletAddress("7PViwK...") // true
 * isValidWalletAddress("invalid") // false
 */
export function isValidWalletAddress(address: string): boolean {
  try {
    if (!address || typeof address !== 'string') {
      return false
    }
    
    // Attempt to create a PublicKey - this validates base58 and length
    const publicKey = new PublicKey(address)
    
    // Additional check: ensure it's on the ed25519 curve
    // PublicKey.isOnCurve() returns true for valid ed25519 public keys
    return PublicKey.isOnCurve(publicKey.toBytes())
  } catch {
    return false
  }
}

/**
 * Truncates a wallet address for display
 * 
 * @param address - Full wallet address
 * @param startChars - Number of characters to show at start (default: 4)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Truncated address like "7PVi...wK4x"
 * 
 * @example
 * truncateAddress("7PViwKaBcDefGhIjKlMnOpQrStUvWxYz") // "7PVi...xYz"
 */
export function truncateAddress(
  address: string,
  startChars: number = 4,
  endChars: number = 4
): string {
  if (!address || address.length <= startChars + endChars + 3) {
    return address || ''
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}
