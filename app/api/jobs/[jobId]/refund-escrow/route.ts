import { NextRequest, NextResponse } from 'next/server'
import { Connection, clusterApiUrl } from '@solana/web3.js'
import { refundEscrowToPoster } from '@/lib/solana/escrow-refund'
import { supabase } from '@/lib/supabase'

/**
 * POST /api/jobs/[jobId]/refund-escrow
 * 
 * Refunds all tokens locked in escrow back to the job poster when a job is cancelled.
 * 
 * Request body:
 * - poster_wallet: string (required) - Wallet address of the job poster
 * 
 * Returns:
 * - 200: { success: true, txSignature: string, amountRefunded: number }
 * - 400: { error: string } - Invalid request
 * - 403: { error: string } - Unauthorized (not the poster)
 * - 404: { error: string } - Job not found
 * - 500: { error: string } - Internal server error
 * 
 * Process:
 * 1. Validates poster_wallet is provided
 * 2. Fetches job details from database
 * 3. Verifies caller is the job poster
 * 4. Verifies escrow is locked
 * 5. Processes full refund (payment + fee) back to poster
 * 6. Logs transaction to job_escrow_transactions table
 * 
 * Security:
 * - Only the job poster can request a refund
 * - Requires escrow to be locked (escrow_locked = true)
 * - Uses secure escrow wallet private key from environment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { jobId } = await params
    const { poster_wallet } = await request.json()

    // Validate required fields
    if (!poster_wallet) {
      return NextResponse.json(
        { error: 'Poster wallet required' },
        { status: 400 }
      )
    }

    // Validate jobId is provided
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID required' },
        { status: 400 }
      )
    }

    console.log(`[Refund API] Processing refund for job ${jobId}`)
    console.log(`[Refund API] Requested by: ${poster_wallet}`)

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError) {
      console.error('[Refund API] Job fetch error:', jobError)
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Verify poster
    if (job.poster_wallet !== poster_wallet) {
      console.warn(`[Refund API] Unauthorized refund attempt by ${poster_wallet}`)
      return NextResponse.json(
        { error: 'Only the job poster can request a refund' },
        { status: 403 }
      )
    }

    // Verify escrow is locked
    if (!job.escrow_locked) {
      console.log('[Refund API] No escrow locked for this job')
      return NextResponse.json(
        { error: 'No escrow to refund. Tokens may have already been refunded.' },
        { status: 400 }
      )
    }

    // Verify escrow data exists
    if (!job.escrow_amount_tokens || !job.escrow_token_mint) {
      console.error('[Refund API] Missing escrow data')
      return NextResponse.json(
        { error: 'Invalid escrow data. Please contact support.' },
        { status: 400 }
      )
    }

    console.log(`[Refund API] Escrow amount: ${job.escrow_amount_tokens}`)
    console.log(`[Refund API] Token mint: ${job.escrow_token_mint}`)

    // Create Solana connection
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('devnet')
    const connection = new Connection(rpcUrl, 'confirmed')
    console.log(`[Refund API] Using RPC: ${rpcUrl}`)

    // Process refund
    const result = await refundEscrowToPoster({
      connection,
      jobId: job.id,
      posterWallet: poster_wallet,
      tokenMint: job.escrow_token_mint,
      escrowAmount: job.escrow_amount_tokens,
      decimals: 9, // TODO: Get from token metadata or store in job
      jobTitle: job.title
    })

    if (!result.success) {
      console.error('[Refund API] Refund failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Refund transaction failed' },
        { status: 500 }
      )
    }

    console.log(`[Refund API] ✅ Refund successful`)
    console.log(`[Refund API] Tx signature: ${result.txSignature}`)
    console.log(`[Refund API] Amount refunded: ${result.amountRefunded}`)

    return NextResponse.json({
      success: true,
      txSignature: result.txSignature,
      amountRefunded: result.amountRefunded
    })

  } catch (error) {
    console.error('[Refund API] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: 'Please contact support if this persists'
      },
      { status: 500 }
    )
  }
}

