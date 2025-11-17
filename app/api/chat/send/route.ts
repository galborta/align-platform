import { NextRequest, NextResponse } from 'next/server'
import { Connection } from '@solana/web3.js'
import { supabase } from '@/lib/supabase'
import { getHolderInfo } from '@/lib/token-balance'

// In-memory rate limiting (consider moving to Redis/Upstash for production)
const messageTimestamps = new Map<string, number[]>()
const MAX_MESSAGES_PER_MINUTE = 5

function checkRateLimit(walletAddress: string): boolean {
  const now = Date.now()
  const timestamps = messageTimestamps.get(walletAddress) || []
  
  // Remove timestamps older than 1 minute
  const recentTimestamps = timestamps.filter(t => now - t < 60000)
  
  if (recentTimestamps.length >= MAX_MESSAGES_PER_MINUTE) {
    return false // Rate limited
  }
  
  recentTimestamps.push(now)
  messageTimestamps.set(walletAddress, recentTimestamps)
  return true
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, walletAddress, messageText, tokenMint } = body

    // Validation
    if (!projectId || !walletAddress || !messageText || !tokenMint) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (messageText.length > 500) {
      return NextResponse.json(
        { error: 'Message too long (max 500 characters)' },
        { status: 400 }
      )
    }

    // Rate limiting check
    if (!checkRateLimit(walletAddress)) {
      return NextResponse.json(
        { error: 'Too many messages. Please wait a moment.' },
        { status: 429 }
      )
    }

    // Get RPC connection
    const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com'
    const connection = new Connection(rpcEndpoint, 'confirmed')

    console.log(`Checking token holdings for wallet: ${walletAddress}`)
    console.log(`Token mint: ${tokenMint}`)
    console.log(`RPC endpoint: ${rpcEndpoint}`)

    // Verify token holdings
    const holderInfo = await getHolderInfo(walletAddress, tokenMint, connection)

    if (!holderInfo) {
      console.error(`No holder info returned for wallet ${walletAddress}`)
      return NextResponse.json(
        { error: 'You must hold tokens to chat in this project. Make sure you are connected to the correct network (devnet/mainnet).' },
        { status: 403 }
      )
    }

    console.log(`Holder validated: ${walletAddress} holds ${Number(holderInfo.balance)} tokens (${holderInfo.percentage.toFixed(6)}%)`)


    // Insert message to database
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        project_id: projectId,
        wallet_address: walletAddress,
        message_text: messageText.trim(),
        token_balance: holderInfo.balance.toString(),
        token_percentage: holderInfo.percentage,
        holding_tier: holderInfo.tier
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: data })

  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

