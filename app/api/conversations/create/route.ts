// app/api/conversations/create/route.ts
// API route to create or get a conversation between two wallets
// Uses server-side RLS bypass for verified users

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client with service role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { currentWallet, targetWallet } = body

    // Validate inputs
    if (!currentWallet || !targetWallet) {
      return NextResponse.json(
        { error: 'Missing required fields: currentWallet and targetWallet' },
        { status: 400 }
      )
    }

    if (currentWallet === targetWallet) {
      return NextResponse.json(
        { error: 'Cannot create conversation with yourself' },
        { status: 400 }
      )
    }

    console.log('[Conversations API] Creating conversation:', { currentWallet: currentWallet.slice(0, 8), targetWallet: targetWallet.slice(0, 8) })

    // Check if current wallet is verified
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('wallet_verified')
      .eq('wallet_address', currentWallet)
      .single()

    if (profileError || !profile) {
      console.error('[Conversations API] Profile not found:', profileError)
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    if (!profile.wallet_verified) {
      console.log('[Conversations API] Wallet not verified')
      return NextResponse.json(
        { error: 'Please verify your wallet to send messages' },
        { status: 403 }
      )
    }

    // Order wallets alphabetically for consistency
    const participant1 = currentWallet < targetWallet ? currentWallet : targetWallet
    const participant2 = currentWallet < targetWallet ? targetWallet : currentWallet

    // Check if conversation already exists
    const { data: existingConv, error: selectError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('participant_1', participant1)
      .eq('participant_2', participant2)
      .maybeSingle()

    if (selectError) {
      console.error('[Conversations API] Error checking existing conversation:', selectError)
      return NextResponse.json(
        { error: 'Failed to check existing conversation' },
        { status: 500 }
      )
    }

    // Return existing conversation
    if (existingConv) {
      console.log('[Conversations API] Returning existing conversation:', existingConv.id)
      return NextResponse.json({ conversation: existingConv })
    }

    // Create new conversation
    const { data: newConv, error: insertError } = await supabaseAdmin
      .from('conversations')
      .insert({
        participant_1: participant1,
        participant_2: participant2
      })
      .select()
      .single()

    if (insertError) {
      // Handle duplicate key error (race condition - conversation was created between check and insert)
      if (insertError.code === '23505') {
        console.log('[Conversations API] Race condition detected, fetching existing conversation')
        
        // Fetch the conversation that was just created by another request
        const { data: raceConv, error: raceError } = await supabaseAdmin
          .from('conversations')
          .select('*')
          .eq('participant_1', participant1)
          .eq('participant_2', participant2)
          .single()
        
        if (raceConv) {
          console.log('[Conversations API] Found conversation after race:', raceConv.id)
          return NextResponse.json({ conversation: raceConv })
        }
        
        console.error('[Conversations API] Could not find conversation after race:', raceError)
      }
      
      console.error('[Conversations API] Error creating conversation:', insertError)
      return NextResponse.json(
        { error: 'Failed to create conversation' },
        { status: 500 }
      )
    }

    console.log('[Conversations API] Created new conversation:', newConv.id)
    return NextResponse.json({ conversation: newConv })

  } catch (error) {
    console.error('[Conversations API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

