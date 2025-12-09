/**
 * POST /api/auth/migrate-wallet
 * 
 * Creates a Supabase auth account for wallets that were verified before the auth system was added.
 * This allows existing users to get JWT sessions without re-verifying their wallet.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/auth-helpers'

export async function POST(request: NextRequest) {
  try {
    const { wallet } = await request.json()

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    console.log(`[Auth Migration] Starting migration for wallet: ${wallet.slice(0, 8)}...`)

    // Check if wallet is verified
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('wallet_address, wallet_verified')
      .eq('wallet_address', wallet)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Wallet not found or not verified' },
        { status: 404 }
      )
    }

    if (!profile.wallet_verified) {
      return NextResponse.json(
        { error: 'Wallet is not verified. Please verify your wallet first.' },
        { status: 400 }
      )
    }

    // Check if auth user already exists
    const authEmail = `${wallet}@align.solana`
    const { data: { users: existingAuthUsers } } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUser = existingAuthUsers.find(u => u.email === authEmail)

    if (existingAuthUser) {
      console.log(`[Auth Migration] Auth user already exists for wallet`)
      return NextResponse.json({
        success: true,
        message: 'Auth account already exists',
        authEmail,
      })
    }

    // Create auth user with admin privileges
    const authPassword = wallet // Use wallet as password
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: authPassword,
      email_confirm: true,
      user_metadata: {
        wallet_address: wallet,
        verified_via_wallet: true,
        migrated: true,
      }
    })

    if (createUserError || !newUser.user) {
      console.error('[Auth Migration] Failed to create auth user:', createUserError?.message)
      return NextResponse.json(
        { error: 'Failed to create auth account', details: createUserError?.message },
        { status: 500 }
      )
    }

    console.log(`[Auth Migration] ✅ Created auth user: ${newUser.user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Auth account created successfully',
      authEmail,
      userId: newUser.user.id,
    })

  } catch (error) {
    console.error('[Auth Migration] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

