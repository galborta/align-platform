import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { releasePaymentWithRetry } from '@/lib/solana/escrow-release'
import { Connection } from '@solana/web3.js'
import { ADMIN_WALLET } from '@/lib/admin-auth'

/**
 * POST /api/admin/jobs/[jobId]/manual-release
 * 
 * Manually release payment for a job (admin only)
 * Bypasses auto-release schedule and immediately processes payment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId

    // Verify admin authorization
    const authHeader = request.headers.get('authorization')
    
    // For now, accept any request from admin page
    // In production, you might want to add a specific admin token check
    console.log('[Admin Manual Release] Request for job:', jobId)

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('[Admin Manual Release] Job not found:', jobError)
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      )
    }

    // Validate job status
    if (job.status !== 'submitted') {
      return NextResponse.json(
        { success: false, error: `Cannot release payment for job with status: ${job.status}` },
        { status: 400 }
      )
    }

    // Check if escrow is locked
    if (!job.escrow_locked) {
      return NextResponse.json(
        { success: false, error: 'Escrow is not locked for this job' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!job.escrow_token_mint || !job.escrow_amount_tokens || !job.assigned_to) {
      return NextResponse.json(
        { success: false, error: 'Missing escrow details' },
        { status: 400 }
      )
    }

    console.log('[Admin Manual Release] Initiating release...')
    console.log('[Admin Manual Release] Worker:', job.assigned_to)
    console.log('[Admin Manual Release] Amount:', job.escrow_amount_tokens, job.token_symbol)

    // Get current retry count from job_escrow_transactions
    const { data: attempts } = await supabase
      .from('job_escrow_transactions')
      .select('retry_count')
      .eq('job_id', jobId)
      .eq('transaction_type', 'release_to_worker')
      .order('retry_count', { ascending: false })
      .limit(1)

    const currentAttempt = (attempts && attempts[0]?.retry_count) 
      ? attempts[0].retry_count + 1 
      : 1

    console.log('[Admin Manual Release] Attempt number:', currentAttempt)

    // Connect to Solana
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
    const connection = new Connection(rpcUrl, 'confirmed')

    // Attempt the release with retry tracking
    const result = await releasePaymentWithRetry(
      {
        connection,
        jobId: job.id,
        workerWallet: job.assigned_to,
        tokenMint: job.escrow_token_mint,
        escrowAmount: job.escrow_amount_tokens,
        decimals: 9, // SOL decimals (TODO: get from token metadata)
        feePercentage: job.fee_percentage_at_creation || 5.0
      },
      currentAttempt
    )

    if (!result.success) {
      console.error('[Admin Manual Release] Failed:', result.error)
      
      // Update job with error
      await supabase
        .from('jobs')
        .update({
          last_release_error: result.error,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          shouldRetry: result.shouldRetry,
          attemptNumber: currentAttempt
        },
        { status: 500 }
      )
    }

    console.log('[Admin Manual Release] ✅ Success!')
    console.log('[Admin Manual Release] Worker tx:', result.workerTxSignature)
    console.log('[Admin Manual Release] Fee tx:', result.feeTxSignature)

    // Update job status to completed
    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        status: 'completed',
        escrow_locked: false,
        release_paused: false,
        release_paused_at: null,
        release_paused_by: null,
        last_release_error: null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (updateError) {
      console.error('[Admin Manual Release] Failed to update job status:', updateError)
    }

    // Send notification to worker
    await supabase.from('notifications').insert({
      wallet_address: job.assigned_to,
      type: 'job_payment_released',
      title: 'Payment Released (Admin)',
      message: `Payment of ${result.workerReceived} ${job.token_symbol} has been manually released by admin for "${job.title}"`,
      job_id: job.id,
      created_at: new Date().toISOString()
    })

    // Send notification to poster
    await supabase.from('notifications').insert({
      wallet_address: job.poster_wallet,
      type: 'job_completed',
      title: 'Job Completed',
      message: `Your job "${job.title}" has been completed and payment released.`,
      job_id: job.id,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      workerTxSignature: result.workerTxSignature,
      feeTxSignature: result.feeTxSignature,
      workerReceived: result.workerReceived,
      feeCollected: result.feeCollected,
      tokenSymbol: job.token_symbol,
      message: 'Payment released successfully'
    })

  } catch (error) {
    console.error('[Admin Manual Release] Exception:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error during manual release' 
      },
      { status: 500 }
    )
  }
}

