/**
 * POST /api/nonce/generate
 * 
 * Generates a cryptographically secure, single-use nonce for wallet verification.
 * The nonce must be signed by the user's wallet to prove ownership.
 * 
 * @module app/api/nonce/generate
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

// Constants
const NONCE_EXPIRY_MINUTES = 5
const MAX_NONCES_PER_HOUR = 10
const NONCE_BYTES = 16 // 16 bytes = 32 hex characters

// Solana address validation regex (base58, 32-44 characters)
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

/**
 * Generate a cryptographically secure nonce
 */
function generateSecureNonce(): string {
  return crypto.randomBytes(NONCE_BYTES).toString('hex')
}

/**
 * Extract client IP address from request headers
 */
function getClientIP(request: NextRequest): string {
  // Check common headers for client IP (in order of priority)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
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
 * POST /api/nonce/generate
 * 
 * Generates a single-use nonce for wallet verification.
 * 
 * Request body:
 * - wallet: string (required) - Solana wallet address
 * 
 * Response:
 * - success: true, nonce: string, expiresAt: string (ISO 8601)
 * - error: string (on failure)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Parse request body
    let body: { wallet?: string }
    try {
      body = await request.json()
    } catch {
      console.warn('[Nonce Generate] Invalid JSON in request body')
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }
    
    const { wallet } = body
    
    // Validate wallet parameter exists
    if (!wallet) {
      console.warn('[Nonce Generate] Missing wallet parameter')
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }
    
    // Validate wallet is a string
    if (typeof wallet !== 'string') {
      console.warn('[Nonce Generate] Wallet parameter is not a string')
      return NextResponse.json(
        { error: 'Wallet address must be a string' },
        { status: 400 }
      )
    }
    
    // Validate wallet format (Solana addresses are 32-44 characters, base58)
    if (!SOLANA_ADDRESS_REGEX.test(wallet)) {
      console.warn(`[Nonce Generate] Invalid wallet format: ${wallet.slice(0, 8)}...`)
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      )
    }
    
    const walletPreview = `${wallet.slice(0, 8)}...${wallet.slice(-4)}`
    console.log(`[Nonce Generate] Request received for wallet: ${walletPreview}`)
    
    // Get client IP for logging and storage
    const ipAddress = getClientIP(request)
    console.log(`[Nonce Generate] Client IP: ${ipAddress}`)
    
    // Rate limiting: Check recent nonces for this wallet in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const { data: recentNonces, error: rateLimitError } = await supabase
      .from('verification_nonces')
      .select('id, created_at')
      .eq('wallet_address', wallet)
      .gte('created_at', oneHourAgo)
    
    if (rateLimitError) {
      console.error('[Nonce Generate] Rate limit check failed:', rateLimitError.message)
      // Continue anyway - don't block users due to rate limit check failures
    }
    
    // Check if rate limit exceeded
    if (recentNonces && recentNonces.length >= MAX_NONCES_PER_HOUR) {
      console.warn(`[Nonce Generate] ❌ Rate limit exceeded for wallet: ${walletPreview}`)
      console.warn(`[Nonce Generate] Recent nonces count: ${recentNonces.length}/${MAX_NONCES_PER_HOUR}`)
      
      return NextResponse.json(
        { 
          error: 'Too many verification attempts',
          details: 'Please wait before requesting another verification code. Maximum 5 requests per hour.'
        },
        { status: 429 }
      )
    }
    
    // Generate cryptographically secure nonce
    const nonce = generateSecureNonce()
    console.log(`[Nonce Generate] Generated nonce: ${nonce.slice(0, 8)}...`)
    
    // Calculate expiry time (5 minutes from now)
    const expiresAt = new Date(Date.now() + NONCE_EXPIRY_MINUTES * 60 * 1000)
    const expiresAtISO = expiresAt.toISOString()
    
    // Store nonce in database
    const { data: insertedNonce, error: insertError } = await supabase
      .from('verification_nonces')
      .insert({
        nonce,
        wallet_address: wallet,
        expires_at: expiresAtISO,
        ip_address: ipAddress,
        used: false,
      })
      .select('id')
      .single()
    
    if (insertError) {
      // Check for duplicate nonce (extremely unlikely with crypto.randomBytes)
      if (insertError.code === '23505') {
        console.warn('[Nonce Generate] ⚠️ Duplicate nonce collision detected, regenerating...')
        
        // Retry once with a new nonce
        const retryNonce = generateSecureNonce()
        const { error: retryError } = await supabase
          .from('verification_nonces')
          .insert({
            nonce: retryNonce,
            wallet_address: wallet,
            expires_at: expiresAtISO,
            ip_address: ipAddress,
            used: false,
          })
        
        if (retryError) {
          console.error('[Nonce Generate] ❌ Retry insert also failed:', retryError.message)
          return NextResponse.json(
            { error: 'Failed to generate verification code. Please try again.' },
            { status: 500 }
          )
        }
        
        console.log(`[Nonce Generate] ✅ Retry successful, nonce: ${retryNonce.slice(0, 8)}...`)
        
        const duration = Date.now() - startTime
        console.log(`[Nonce Generate] ✅ Completed in ${duration}ms for wallet: ${walletPreview}`)
        
        return NextResponse.json({
          success: true,
          nonce: retryNonce,
          expiresAt: expiresAtISO,
        })
      }
      
      // Other database errors
      console.error('[Nonce Generate] ❌ Database insert error:', insertError.message)
      console.error('[Nonce Generate] Error code:', insertError.code)
      console.error('[Nonce Generate] Error details:', insertError.details)
      
      return NextResponse.json(
        { error: 'Failed to generate verification code' },
        { status: 500 }
      )
    }
    
    const duration = Date.now() - startTime
    console.log(`[Nonce Generate] ✅ Success! Nonce ID: ${insertedNonce?.id || 'unknown'}`)
    console.log(`[Nonce Generate] ✅ Expires at: ${expiresAtISO}`)
    console.log(`[Nonce Generate] ✅ Completed in ${duration}ms for wallet: ${walletPreview}`)
    
    return NextResponse.json({
      success: true,
      nonce,
      expiresAt: expiresAtISO,
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Nonce Generate] ❌ Unexpected error after ${duration}ms:`, error)
    
    if (error instanceof Error) {
      console.error('[Nonce Generate] Error name:', error.name)
      console.error('[Nonce Generate] Error message:', error.message)
      console.error('[Nonce Generate] Error stack:', error.stack)
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
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

