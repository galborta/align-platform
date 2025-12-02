/**
 * API Route: Adjust Escrow Amount
 * Handles partial refunds when job payment amount is reduced
 * (For increases, the client handles locking additional tokens)
 */

import { NextRequest, NextResponse } from 'next/server'
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import bs58 from 'bs58'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params
    const { poster_wallet, refund_amount } = await request.json()

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    if (!poster_wallet) {
      return NextResponse.json({ error: 'Poster wallet required' }, { status: 400 })
    }

    if (!refund_amount || refund_amount <= 0) {
      return NextResponse.json({ error: 'Valid refund amount required' }, { status: 400 })
    }

    // Fetch job details
    const { data: job, error: fetchError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (fetchError || !job) {
      console.error('Error fetching job:', fetchError)
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Verify poster
    if (job.poster_wallet !== poster_wallet) {
      return NextResponse.json({ error: 'Only the job poster can adjust escrow' }, { status: 403 })
    }

    // Verify escrow is locked
    if (!job.escrow_locked) {
      return NextResponse.json({ error: 'No escrow to refund from' }, { status: 400 })
    }

    // Initialize Solana connection
    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    )

    // Load escrow wallet keypair from private key
    const escrowPrivateKey = process.env.ESCROW_WALLET_PRIVATE_KEY
    if (!escrowPrivateKey) {
      throw new Error('Escrow wallet private key not configured')
    }

    const escrowKeypair = Keypair.fromSecretKey(
      bs58.decode(escrowPrivateKey)
    )

    const escrowWallet = escrowKeypair.publicKey
    const posterWallet = new PublicKey(poster_wallet)
    const tokenMint = new PublicKey(job.escrow_token_mint)

    // Get token accounts
    const escrowTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      escrowWallet
    )
    const posterTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      posterWallet
    )

    // Create transfer transaction
    const transaction = new Transaction()

    // Convert amount to raw tokens (assuming 9 decimals for now)
    const decimals = 9 // TODO: Get from token metadata
    const rawAmount = Math.floor(refund_amount * Math.pow(10, decimals))

    transaction.add(
      createTransferInstruction(
        escrowTokenAccount,
        posterTokenAccount,
        escrowWallet,
        rawAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    )

    // Get recent blockhash and send transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = escrowWallet

    transaction.sign(escrowKeypair)

    const signature = await connection.sendRawTransaction(
      transaction.serialize()
    )

    // Confirm transaction
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    })

    // Log the transaction
    await supabaseAdmin
      .from('job_escrow_transactions')
      .insert({
        job_id: jobId,
        transaction_type: 'adjustment_refund',
        transaction_signature: signature,
        amount_tokens: refund_amount,
        token_mint: job.escrow_token_mint,
        from_wallet: escrowWallet.toString(),
        to_wallet: poster_wallet,
        status: 'confirmed'
      })

    return NextResponse.json({
      success: true,
      signature,
      amountRefunded: refund_amount
    })

  } catch (error) {
    console.error('Adjust escrow API error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

