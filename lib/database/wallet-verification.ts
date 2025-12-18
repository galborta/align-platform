// lib/database/wallet-verification.ts
// Helper functions for wallet verification database operations

import { supabase } from '@/lib/supabase'
import { 
  WalletVerification, 
  LegalAcceptance,
  VerificationNonce 
} from '@/types/database'
import crypto from 'crypto'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Data required to record a wallet verification
 */
export interface VerificationData {
  wallet: string
  signature: string
  message: string
  nonce: string
  ipAddress?: string
  userAgent?: string
  isUsPerson?: boolean
  termsVersion?: string
  privacyVersion?: string
}

/**
 * Result of nonce validation
 */
export interface NonceValidationResult {
  valid: boolean
  error?: string
}

/**
 * Generated nonce response
 */
export interface GeneratedNonce {
  nonce: string
  expiresAt: string
}

// ============================================================================
// VERIFICATION STATUS FUNCTIONS
// ============================================================================

/**
 * Check if a wallet is verified
 * @param wallet - The wallet address to check
 * @returns true if wallet is verified, false otherwise
 */
export async function checkWalletVerified(wallet: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('wallet_verified')
      .eq('wallet_address', wallet)
      .single()

    if (error || !data) return false
    return data.wallet_verified || false
  } catch (error) {
    console.error('[checkWalletVerified] Error:', error)
    return false
  }
}

/**
 * Get full verification status for a wallet
 * @param wallet - The wallet address to check
 * @returns Verification status object or null if not found
 */
export async function getVerificationStatus(wallet: string): Promise<{
  isVerified: boolean
  verifiedAt: string | null
  hasAcceptedTerms: boolean
  termsVersion: string | null
  isUsPerson: boolean | null
} | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        wallet_verified,
        wallet_verified_at,
        terms_version_accepted,
        last_terms_accepted_at,
        is_us_person
      `)
      .eq('wallet_address', wallet)
      .single()

    if (error || !data) return null

    return {
      isVerified: data.wallet_verified || false,
      verifiedAt: data.wallet_verified_at,
      hasAcceptedTerms: !!data.terms_version_accepted,
      termsVersion: data.terms_version_accepted,
      isUsPerson: data.is_us_person
    }
  } catch (error) {
    console.error('[getVerificationStatus] Error:', error)
    return null
  }
}

// ============================================================================
// NONCE MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Generate a new verification nonce for a wallet
 * @param wallet - The wallet address requesting verification
 * @param ipAddress - Optional IP address for audit
 * @returns Generated nonce and expiry timestamp
 */
export async function generateNonce(
  wallet: string,
  ipAddress?: string
): Promise<GeneratedNonce> {
  // Generate cryptographically secure random nonce
  const nonce = crypto.randomBytes(16).toString('hex')
  
  // Set expiry to 5 minutes from now
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  const { error } = await supabase
    .from('verification_nonces')
    .insert({
      nonce,
      wallet_address: wallet,
      expires_at: expiresAt.toISOString(),
      ip_address: ipAddress
    })

  if (error) {
    console.error('[generateNonce] Error:', error)
    throw new Error('Failed to generate nonce')
  }

  return {
    nonce,
    expiresAt: expiresAt.toISOString()
  }
}

/**
 * Validate a nonce for a specific wallet
 * @param nonce - The nonce to validate
 * @param wallet - The wallet address that should own this nonce
 * @returns Validation result with error message if invalid
 */
export async function validateNonce(
  nonce: string,
  wallet: string
): Promise<NonceValidationResult> {
  try {
    const { data, error } = await supabase
      .from('verification_nonces')
      .select('*')
      .eq('nonce', nonce)
      .single()

    if (error || !data) {
      return { valid: false, error: 'Nonce not found' }
    }

    // Check wallet matches
    if (data.wallet_address !== wallet) {
      return { valid: false, error: 'Nonce does not belong to this wallet' }
    }

    // Check if already used
    if (data.used) {
      return { valid: false, error: 'Nonce already used' }
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      return { valid: false, error: 'Nonce expired' }
    }

    return { valid: true }
  } catch (error) {
    console.error('[validateNonce] Error:', error)
    return { valid: false, error: 'Validation failed' }
  }
}

/**
 * Mark a nonce as used
 * @param nonce - The nonce to mark as used
 */
export async function markNonceUsed(nonce: string): Promise<void> {
  const { error } = await supabase
    .from('verification_nonces')
    .update({
      used: true,
      used_at: new Date().toISOString()
    })
    .eq('nonce', nonce)

  if (error) {
    console.error('[markNonceUsed] Error:', error)
    throw new Error('Failed to mark nonce as used')
  }
}

/**
 * Clean up expired nonces (call periodically via cron)
 * @returns Number of deleted nonces
 */
export async function cleanupExpiredNonces(): Promise<number> {
  try {
    // Use the database function for cleanup
    const { data, error } = await supabase.rpc('cleanup_expired_nonces')
    
    if (error) {
      console.error('[cleanupExpiredNonces] Error:', error)
      return 0
    }
    
    return data || 0
  } catch (error) {
    console.error('[cleanupExpiredNonces] Error:', error)
    return 0
  }
}

// ============================================================================
// VERIFICATION RECORDING FUNCTIONS
// ============================================================================

/**
 * Record a successful wallet verification
 * Creates audit trail, updates profile, and records legal acceptance
 * @param data - Verification data including signature and message
 */
export async function recordVerification(data: VerificationData): Promise<void> {
  const termsVersion = data.termsVersion || '2024-12-08'
  const privacyVersion = data.privacyVersion || '2024-12-08'
  const now = new Date().toISOString()

  try {
    // 1. Update or create user profile with verification status
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        wallet_address: data.wallet,
        wallet_verified: true,
        wallet_verified_at: now,
        verification_signature: data.signature,
        last_terms_accepted_at: now,
        terms_version_accepted: termsVersion,
        is_us_person: data.isUsPerson ?? false,
        geo_check_confirmed_at: now
      }, {
        onConflict: 'wallet_address'
      })

    if (profileError) {
      console.error('[recordVerification] Profile update error:', profileError)
      throw profileError
    }

    // 2. Create immutable audit record
    const { error: auditError } = await supabase
      .from('wallet_verifications')
      .insert({
        wallet_address: data.wallet,
        signature: data.signature,
        message: data.message,
        nonce: data.nonce,
        ip_address: data.ipAddress,
        user_agent: data.userAgent
      })

    if (auditError) {
      console.error('[recordVerification] Audit record error:', auditError)
      throw auditError
    }

    // 3. Record legal acceptance
    const { error: legalError } = await supabase
      .from('legal_acceptances')
      .insert({
        wallet_address: data.wallet,
        terms_version: termsVersion,
        privacy_version: privacyVersion,
        signature: data.signature,
        ip_address: data.ipAddress,
        is_us_person_confirmed: data.isUsPerson ?? false
      })

    if (legalError) {
      console.error('[recordVerification] Legal acceptance error:', legalError)
      throw legalError
    }

    // 4. Mark the nonce as used
    await markNonceUsed(data.nonce)

    console.log(`[recordVerification] ✅ Wallet verified: ${data.wallet}`)
  } catch (error) {
    console.error('[recordVerification] Error:', error)
    throw new Error('Failed to record verification')
  }
}

// ============================================================================
// AUDIT & HISTORY FUNCTIONS
// ============================================================================

/**
 * Get verification history for a wallet
 * @param wallet - The wallet address to get history for
 * @returns Array of verification records, newest first
 */
export async function getVerificationHistory(
  wallet: string
): Promise<WalletVerification[]> {
  const { data, error } = await supabase
    .from('wallet_verifications')
    .select('*')
    .eq('wallet_address', wallet)
    .order('verified_at', { ascending: false })

  if (error) {
    console.error('[getVerificationHistory] Error:', error)
    return []
  }

  return data || []
}

/**
 * Get legal acceptance history for a wallet
 * @param wallet - The wallet address to get history for
 * @returns Array of legal acceptance records, newest first
 */
export async function getLegalAcceptanceHistory(
  wallet: string
): Promise<LegalAcceptance[]> {
  const { data, error } = await supabase
    .from('legal_acceptances')
    .select('*')
    .eq('wallet_address', wallet)
    .order('accepted_at', { ascending: false })

  if (error) {
    console.error('[getLegalAcceptanceHistory] Error:', error)
    return []
  }

  return data || []
}

/**
 * Check if wallet has accepted the required terms version
 * @param wallet - The wallet address to check
 * @param requiredVersion - The required terms version
 * @returns true if user has accepted the required version
 */
export async function hasAcceptedTermsVersion(
  wallet: string,
  requiredVersion: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('terms_version_accepted')
      .eq('wallet_address', wallet)
      .single()

    if (error || !data) return false
    return data.terms_version_accepted === requiredVersion
  } catch (error) {
    console.error('[hasAcceptedTermsVersion] Error:', error)
    return false
  }
}

/**
 * Get the most recent verification for a wallet
 * @param wallet - The wallet address
 * @returns Most recent verification record or null
 */
export async function getLatestVerification(
  wallet: string
): Promise<WalletVerification | null> {
  const { data, error } = await supabase
    .from('wallet_verifications')
    .select('*')
    .eq('wallet_address', wallet)
    .order('verified_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return data
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Check verification status for multiple wallets
 * @param wallets - Array of wallet addresses
 * @returns Map of wallet address to verification status
 */
export async function checkMultipleWalletsVerified(
  wallets: string[]
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>()
  
  // Initialize all as false
  wallets.forEach(w => result.set(w, false))

  if (wallets.length === 0) return result

  const { data, error } = await supabase
    .from('user_profiles')
    .select('wallet_address, wallet_verified')
    .in('wallet_address', wallets)

  if (error) {
    console.error('[checkMultipleWalletsVerified] Error:', error)
    return result
  }

  // Update with actual values
  data?.forEach(profile => {
    result.set(profile.wallet_address, profile.wallet_verified || false)
  })

  return result
}


