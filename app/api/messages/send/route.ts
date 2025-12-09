import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { conversation_id, content, sender_wallet } = await request.json()

    if (!sender_wallet) {
      return NextResponse.json({ error: 'Unauthorized: Wallet address is required' }, { status: 401 })
    }
    
    const senderWallet = sender_wallet

    if (!conversation_id || !content) {
      return NextResponse.json({ error: 'Missing required fields: conversation_id and content' }, { status: 400 })
    }

    // Trim and validate content
    const trimmedContent = content.trim()
    if (!trimmedContent || trimmedContent.length === 0) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 })
    }

    if (trimmedContent.length > 5000) {
      return NextResponse.json({ error: 'Message content exceeds maximum length of 5000 characters' }, { status: 400 })
    }

    // Verify the sender is a participant in this conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('participant_1, participant_2')
      .eq('id', conversation_id)
      .single()

    if (convError || !conversation) {
      console.error('[Messages API] Conversation not found:', convError)
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    if (senderWallet !== conversation.participant_1 && senderWallet !== conversation.participant_2) {
      return NextResponse.json({ error: 'Unauthorized: You are not a participant in this conversation' }, { status: 403 })
    }

    // Check if sender is verified
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('wallet_verified')
      .eq('wallet_address', senderWallet)
      .single()

    if (profileError || !profile?.wallet_verified) {
      return NextResponse.json({ error: 'Unauthorized: Wallet not verified' }, { status: 403 })
    }

    // Insert the message
    const { data: message, error: insertError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id,
        sender_wallet: senderWallet,
        content: trimmedContent,
        is_read: false
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Messages API] Error inserting message:', insertError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Update conversation last_message_at
    await supabaseAdmin
      .from('conversations')
      .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', conversation_id)

    console.log('[Messages API] Message sent:', message.id)
    return NextResponse.json(message, { status: 200 })

  } catch (error) {
    console.error('[Messages API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

