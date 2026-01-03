/**
 * GET /api/wallet/status?wallet=ADDRESS
 * 
 * Fast, public endpoint to check if a wallet is verified.
 * Called frequently - optimized for performance (<100ms).
 * 
 * @module app/api/wallet/status
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Solana address validation regex (base58, 32-44 characters)
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

/**
 * GET /api/wallet/status?wallet=ADDRESS
 * 
 * Check if a wallet is verified.
 * 
 * Query params:
 * - wallet: string (required) - Solana wallet address
 * 
 * Response:
 * - verified: boolean
 * - wallet: string
 * - verifiedAt: string | null (only if verified)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Extract wallet from query params
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get('wallet')
    
    // Validate wallet parameter exists
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet parameter required' },
        { status: 400 }
      )
    }
    
    // Basic wallet format validation
    if (!SOLANA_ADDRESS_REGEX.test(wallet)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      )
    }
    
    // Simple, fast query - only select needed fields
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('wallet_address, wallet_verified, wallet_verified_at')
      .eq('wallet_address', wallet)
      .single()
    
    const duration = Date.now() - startTime
    
    if (error) {
      // PGRST116 = Row not found - this is expected for new/unverified wallets
      if (error.code === 'PGRST116') {
        console.log(`[Wallet Status] Not found: ${wallet.slice(0, 8)}... (${duration}ms)`)
        return NextResponse.json({
          verified: false,
          wallet,
        })
      }
      
      // Actual database error
      console.error(`[Wallet Status] Database error for ${wallet.slice(0, 8)}...:`, error.message)
      return NextResponse.json(
        { error: 'Failed to check wallet status' },
        { status: 500 }
      )
    }
    
    // Profile found - return verification status
    const verified = profile?.wallet_verified === true
    
    if (verified) {
      console.log(`[Wallet Status] ✅ Verified: ${wallet.slice(0, 8)}... (${duration}ms)`)
      return NextResponse.json({
        verified: true,
        wallet,
        verifiedAt: profile.wallet_verified_at,
      })
    } else {
      console.log(`[Wallet Status] ❌ Not verified: ${wallet.slice(0, 8)}... (${duration}ms)`)
      return NextResponse.json({
        verified: false,
        wallet,
      })
    }
    
  } catch (error) {
    console.error('[Wallet Status] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Handle unsupported methods
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET with ?wallet=ADDRESS' },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET with ?wallet=ADDRESS' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET with ?wallet=ADDRESS' },
    { status: 405 }
  )
}




