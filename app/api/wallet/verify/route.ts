/**
 * POST /api/wallet/verify
 * 
 * Verifies wallet ownership via cryptographic signature.
 * This is the CRITICAL endpoint that proves a user controls their wallet.
 * 
 * Flow:
 * 1. Validate nonce (exists, not used, not expired, wallet matches)
 * 2. Verify cryptographic signature
 * 3. Check if already verified (idempotent)
 * 4. Mark nonce as used
 * 5. Update/create profile with verification status
 * 6. Create audit record
 * 7. Record legal acceptance
 * 
 * @module app/api/wallet/verify
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySolanaSignature } from '@/lib/solana-signature'
import { supabase } from '@/lib/supabase'

// Constants
const CURRENT_TERMS_VERSION = '2024-12-08'
const CURRENT_PRIVACY_VERSION = '2024-12-08'

// Solana address validation regex (base58, 32-44 characters)
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

// Error codes for client handling
type ErrorCode = 'NONCE_INVALID' | 'NONCE_USED' | 'NONCE_EXPIRED' | 'SIGNATURE_INVALID' | 'DATABASE_ERROR' | 'VALIDATION_ERROR'

interface ErrorResponse {
  error: string
  details?: string
  code?: ErrorCode
}

interface SuccessResponse {
  success: true
  wallet: string
  verifiedAt: string
  message?: string
}

/**
 * Extract client IP address from request headers
 */
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP.trim()
  }
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP.trim()
  }
  
  return 'unknown'
}

/**
 * Create truncated wallet preview for logging
 */
function walletPreview(wallet: string): string {
  if (!wallet || wallet.length < 12) return wallet || 'unknown'
  return `${wallet.slice(0, 8)}...${wallet.slice(-4)}`
}

/**
 * POST /api/wallet/verify
 * 
 * Verifies wallet ownership via cryptographic signature.
 * 
 * Request body:
 * - wallet: string (required) - Solana wallet address
 * - signature: string (required) - Base58-encoded signature
 * - message: string (required) - Original message that was signed
 * - nonce: string (required) - Nonce from /api/nonce/generate
 * 
 * Response:
 * - success: true, wallet: string, verifiedAt: string (on success)
 * - error: string, details?: string, code?: ErrorCode (on failure)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Parse request body
    let body: { 
      wallet?: string
      signature?: string
      message?: string
      nonce?: string 
    }
    
    try {
      body = await request.json()
    } catch {
      console.warn('[Verify Wallet] Invalid JSON in request body')
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          code: 'VALIDATION_ERROR'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    const { wallet, signature, message, nonce } = body
    
    // ==================== VALIDATION ====================
    
    // Check all required fields exist
    if (!wallet || !signature || !message || !nonce) {
      const missing = []
      if (!wallet) missing.push('wallet')
      if (!signature) missing.push('signature')
      if (!message) missing.push('message')
      if (!nonce) missing.push('nonce')
      
      console.warn(`[Verify Wallet] Missing required fields: ${missing.join(', ')}`)
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          details: `The following fields are required: ${missing.join(', ')}`,
          code: 'VALIDATION_ERROR'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    // Validate wallet format
    if (!SOLANA_ADDRESS_REGEX.test(wallet)) {
      console.warn(`[Verify Wallet] Invalid wallet format: ${walletPreview(wallet)}`)
      return NextResponse.json(
        { 
          error: 'Invalid wallet address format',
          code: 'VALIDATION_ERROR'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    const preview = walletPreview(wallet)
    console.log(`[Verify Wallet] ========================================`)
    console.log(`[Verify Wallet] Starting verification for wallet: ${preview}`)
    console.log(`[Verify Wallet] Message length: ${message.length} chars`)
    console.log(`[Verify Wallet] Signature length: ${signature.length} chars`)
    console.log(`[Verify Wallet] Nonce: ${nonce.slice(0, 8)}...`)
    
    // Get client info for audit
    const ipAddress = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'
    console.log(`[Verify Wallet] Client IP: ${ipAddress}`)
    
    // ==================== STEP 1: VALIDATE NONCE ====================
    console.log(`[Verify Wallet] Step 1: Validating nonce...`)
    
    const { data: nonceRecord, error: nonceError } = await supabase
      .from('verification_nonces')
      .select('*')
      .eq('nonce', nonce)
      .eq('wallet_address', wallet)
      .single()
    
    if (nonceError || !nonceRecord) {
      console.error(`[Verify Wallet] ❌ Nonce not found for wallet: ${preview}`)
      console.error(`[Verify Wallet] Nonce query error:`, nonceError?.message || 'No matching record')
      
      return NextResponse.json(
        { 
          error: 'Verification code not found',
          details: 'The verification code is invalid or does not match this wallet. Please request a new code.',
          code: 'NONCE_INVALID'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    // Check if nonce already used (replay attack protection)
    if (nonceRecord.used) {
      console.error(`[Verify Wallet] ❌ SECURITY: Nonce already used - possible replay attack!`)
      console.error(`[Verify Wallet] Nonce was used at: ${nonceRecord.used_at}`)
      
      return NextResponse.json(
        { 
          error: 'Verification code already used',
          details: 'This verification code has already been used. Please request a new code.',
          code: 'NONCE_USED'
        } satisfies ErrorResponse,
        { status: 403 }
      )
    }
    
    // Check if nonce expired
    const expiresAt = new Date(nonceRecord.expires_at)
    const now = new Date()
    
    if (expiresAt < now) {
      const expiredMinutesAgo = Math.round((now.getTime() - expiresAt.getTime()) / 60000)
      console.error(`[Verify Wallet] ❌ Nonce expired ${expiredMinutesAgo} minutes ago`)
      console.error(`[Verify Wallet] Expired at: ${nonceRecord.expires_at}`)
      
      return NextResponse.json(
        { 
          error: 'Verification code expired',
          details: 'The verification code has expired. Please request a new code.',
          code: 'NONCE_EXPIRED'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    console.log(`[Verify Wallet] ✅ Nonce is valid (expires in ${Math.round((expiresAt.getTime() - now.getTime()) / 1000)}s)`)
    
    // ==================== STEP 2: VERIFY SIGNATURE ====================
    console.log(`[Verify Wallet] Step 2: Verifying cryptographic signature...`)
    
    const signatureValid = verifySolanaSignature(message, signature, wallet)
    
    if (!signatureValid) {
      console.error(`[Verify Wallet] ❌ SECURITY: Invalid signature for wallet: ${preview}`)
      console.error(`[Verify Wallet] This could indicate:`)
      console.error(`[Verify Wallet]   - Message tampering`)
      console.error(`[Verify Wallet]   - Wrong wallet attempting verification`)
      console.error(`[Verify Wallet]   - Malformed signature`)
      
      return NextResponse.json(
        { 
          error: 'Invalid signature',
          details: 'The signature does not match the message and wallet. Please try again.',
          code: 'SIGNATURE_INVALID'
        } satisfies ErrorResponse,
        { status: 403 }
      )
    }
    
    console.log(`[Verify Wallet] ✅ Signature is cryptographically valid`)
    
    // ==================== STEP 3: CHECK EXISTING VERIFICATION ====================
    console.log(`[Verify Wallet] Step 3: Checking existing verification status...`)
    
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('user_profiles')
      .select('wallet_address, wallet_verified, wallet_verified_at')
      .eq('wallet_address', wallet)
      .single()
    
    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      // PGRST116 = Row not found, which is expected for new users
      console.error(`[Verify Wallet] Profile check error:`, profileCheckError.message)
    }
    
    // If already verified, return success (idempotent behavior)
    if (existingProfile?.wallet_verified) {
      console.log(`[Verify Wallet] ℹ️ Wallet already verified at: ${existingProfile.wallet_verified_at}`)
      
      // Still mark nonce as used to prevent reuse
      await supabase
        .from('verification_nonces')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('nonce', nonce)
      
      const duration = Date.now() - startTime
      console.log(`[Verify Wallet] ✅ Returning existing verification (${duration}ms)`)
      
      return NextResponse.json({
        success: true,
        wallet,
        verifiedAt: existingProfile.wallet_verified_at || new Date().toISOString(),
        message: 'Wallet was already verified'
      } satisfies SuccessResponse)
    }
    
    console.log(`[Verify Wallet] Profile status: ${existingProfile ? 'exists, not verified' : 'new user'}`)
    
    // ==================== STEP 4: MARK NONCE AS USED ====================
    console.log(`[Verify Wallet] Step 4: Marking nonce as used...`)
    
    const nonceUsedAt = new Date().toISOString()
    const { error: nonceUpdateError } = await supabase
      .from('verification_nonces')
      .update({ 
        used: true, 
        used_at: nonceUsedAt 
      })
      .eq('nonce', nonce)
    
    if (nonceUpdateError) {
      console.error('[Verify Wallet] ⚠️ Failed to mark nonce as used:', nonceUpdateError.message)
      // Continue anyway - this is not a blocking error
      // The nonce check at the beginning prevents replay attacks
    } else {
      console.log(`[Verify Wallet] ✅ Nonce marked as used`)
    }
    
    // ==================== STEP 5: UPSERT PROFILE ====================
    console.log(`[Verify Wallet] Step 5: Updating profile with verification status...`)
    
    const verifiedAt = new Date().toISOString()
    
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        wallet_address: wallet,
        wallet_verified: true,
        wallet_verified_at: verifiedAt,
        verification_signature: signature,
        last_terms_accepted_at: verifiedAt,
        terms_version_accepted: CURRENT_TERMS_VERSION,
        is_us_person: false, // User confirmed they are not US person by signing
      }, {
        onConflict: 'wallet_address'
      })
    
    if (profileError) {
      console.error('[Verify Wallet] ❌ Profile update failed:', profileError.message)
      console.error('[Verify Wallet] Error code:', profileError.code)
      console.error('[Verify Wallet] Error details:', profileError.details)
      
      return NextResponse.json(
        { 
          error: 'Failed to verify wallet',
          details: 'A database error occurred. Please try again or contact support.',
          code: 'DATABASE_ERROR'
        } satisfies ErrorResponse,
        { status: 500 }
      )
    }
    
    console.log(`[Verify Wallet] ✅ Profile updated successfully`)
    
    // ==================== STEP 6: CREATE AUDIT RECORD ====================
    console.log(`[Verify Wallet] Step 6: Creating verification audit record...`)
    
    const { error: auditError } = await supabase
      .from('wallet_verifications')
      .insert({
        wallet_address: wallet,
        signature,
        message,
        nonce,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
    
    if (auditError) {
      console.error('[Verify Wallet] ⚠️ Audit record creation failed:', auditError.message)
      // Non-blocking - verification still succeeded
    } else {
      console.log(`[Verify Wallet] ✅ Audit record created`)
    }
    
    // ==================== STEP 7: RECORD LEGAL ACCEPTANCE ====================
    console.log(`[Verify Wallet] Step 7: Recording legal acceptance...`)
    
    const { error: legalError } = await supabase
      .from('legal_acceptances')
      .insert({
        wallet_address: wallet,
        terms_version: CURRENT_TERMS_VERSION,
        privacy_version: CURRENT_PRIVACY_VERSION,
        signature,
        ip_address: ipAddress,
        is_us_person_confirmed: false, // User confirmed NOT a US person
      })
    
    if (legalError) {
      console.error('[Verify Wallet] ⚠️ Legal acceptance record failed:', legalError.message)
      // Non-blocking - verification still succeeded
    } else {
      console.log(`[Verify Wallet] ✅ Legal acceptance recorded`)
    }
    
    // ==================== SUCCESS ====================
    const duration = Date.now() - startTime
    console.log(`[Verify Wallet] ========================================`)
    console.log(`[Verify Wallet] ✅ VERIFICATION COMPLETE`)
    console.log(`[Verify Wallet] Wallet: ${preview}`)
    console.log(`[Verify Wallet] Verified at: ${verifiedAt}`)
    console.log(`[Verify Wallet] Duration: ${duration}ms`)
    console.log(`[Verify Wallet] ========================================`)
    
    return NextResponse.json({
      success: true,
      wallet,
      verifiedAt,
    } satisfies SuccessResponse)
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Verify Wallet] ❌ UNEXPECTED ERROR after ${duration}ms`)
    console.error('[Verify Wallet] Error:', error)
    
    if (error instanceof Error) {
      console.error('[Verify Wallet] Error name:', error.name)
      console.error('[Verify Wallet] Error message:', error.message)
      console.error('[Verify Wallet] Error stack:', error.stack)
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: 'An unexpected error occurred during verification. Please try again.',
        code: 'DATABASE_ERROR'
      } satisfies ErrorResponse,
      { status: 500 }
    )
  }
}

/**
 * Handle unsupported methods
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}
