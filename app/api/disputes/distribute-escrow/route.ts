import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Connection } from '@solana/web3.js'
import { splitEscrowForDispute, validateDisputeSplitBalance } from '@/lib/solana/escrow-dispute-split'
import { getFeePercentage } from '@/lib/platform-settings'

/**
 * POST /api/disputes/distribute-escrow
 * 
 * Manually distribute escrow for old disputes that were resolved
 * before the token distribution logic was implemented.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { disputeId, adminWallet } = body

    // Validate required fields
    if (!disputeId) {
      return NextResponse.json(
        { error: 'Missing disputeId' },
        { status: 400 }
      )
    }

    if (!adminWallet) {
      return NextResponse.json(
        { error: 'Missing adminWallet' },
        { status: 400 }
      )
    }

    // 1. Verify admin permission
    const { data: admin, error: adminError } = await supabase
      .from('admin_wallets')
      .select('wallet_address')
      .eq('wallet_address', adminWallet)
      .eq('is_active', true)
      .maybeSingle()

    if (adminError || !admin) {
      console.error('Admin verification failed:', adminError)
      return NextResponse.json(
        { error: 'Unauthorized: Admin permission required' },
        { status: 403 }
      )
    }

    // 2. Get dispute details with job info
    const { data: dispute, error: disputeError } = await supabase
      .from('job_disputes')
      .select(`
        id,
        job_id,
        status,
        worker_percentage,
        poster_percentage,
        escrow_distributed,
        admin_resolution_notes,
        jobs (
          id,
          title,
          poster_wallet,
          assigned_to,
          escrow_amount_tokens,
          escrow_token_mint,
          payment_amount_tokens,
          status
        )
      `)
      .eq('id', disputeId)
      .single()

    if (disputeError || !dispute) {
      console.error('Dispute fetch error:', disputeError)
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      )
    }

    // 3. Validate dispute is resolved
    if (dispute.status !== 'resolved') {
      return NextResponse.json(
        { error: 'Dispute is not resolved yet' },
        { status: 400 }
      )
    }

    // 4. Check if already distributed
    if (dispute.escrow_distributed) {
      return NextResponse.json(
        { error: 'Escrow has already been distributed for this dispute' },
        { status: 400 }
      )
    }

    const job = dispute.jobs as any
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found for this dispute' },
        { status: 404 }
      )
    }

    // 5. Validate we have the percentages
    if (dispute.worker_percentage === null || dispute.poster_percentage === null) {
      return NextResponse.json(
        { error: 'Missing resolution percentages for this dispute' },
        { status: 400 }
      )
    }

    // 6. Get escrow amount (fallback to payment_amount_tokens if escrow_amount_tokens not set)
    const escrowAmount = job.escrow_amount_tokens || job.payment_amount_tokens
    if (!escrowAmount) {
      return NextResponse.json(
        { error: 'No escrow amount found for this job' },
        { status: 400 }
      )
    }

    // 7. Execute the escrow distribution
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
                   process.env.SOLANA_RPC_URL || 
                   'https://api.mainnet-beta.solana.com'
    
    if (!rpcUrl) {
      return NextResponse.json(
        { error: 'Solana RPC not configured' },
        { status: 500 }
      )
    }

    const connection = new Connection(rpcUrl, 'confirmed')
    const feePercentage = await getFeePercentage()

    console.log(`[Distribute Escrow API] Starting manual distribution for dispute ${disputeId}`)
    console.log(`[Distribute Escrow API] Job: ${job.id}, Escrow: ${escrowAmount}`)
    console.log(`[Distribute Escrow API] Split: Worker ${dispute.worker_percentage}% / Poster ${dispute.poster_percentage}%`)

    // Validate escrow balance before attempting distribution
    const validation = await validateDisputeSplitBalance(
      connection,
      job.escrow_token_mint,
      escrowAmount,
      9 // decimals
    )
    
    if (!validation.valid) {
      console.error(`[Distribute Escrow API] Balance validation failed: ${validation.error}`)
      console.error(`[Distribute Escrow API] Expected: ${escrowAmount}, Actual: ${validation.actualBalance}`)
      return NextResponse.json(
        { 
          error: validation.error || 'Insufficient escrow balance',
          expected: escrowAmount,
          actual: validation.actualBalance
        },
        { status: 400 }
      )
    }

    console.log(`[Distribute Escrow API] ✅ Balance validated: ${validation.actualBalance} tokens`)

    const splitResult = await splitEscrowForDispute({
      connection,
      jobId: job.id,
      disputeId: disputeId,
      workerWallet: job.assigned_to,
      posterWallet: job.poster_wallet,
      tokenMint: job.escrow_token_mint,
      escrowAmount: escrowAmount,
      decimals: 9, // Assuming 9 decimals for SOL/default token
      feePercentage,
      workerPercentage: dispute.worker_percentage,
      posterPercentage: dispute.poster_percentage
    })

    if (!splitResult.success) {
      console.error('[Distribute Escrow API] Failed:', splitResult.error)
      return NextResponse.json(
        { 
          error: splitResult.error || 'Failed to distribute escrow',
          escrowDistribution: splitResult
        },
        { status: 500 }
      )
    }

    console.log('[Distribute Escrow API] ✅ Distribution successful')
    console.log(`Worker received: ${splitResult.workerReceived}`)
    console.log(`Poster received: ${splitResult.posterReceived}`)
    console.log(`Fee collected: ${splitResult.feeCollected}`)

    // 8. Mark dispute as distributed
    const { error: updateError } = await supabase
      .from('job_disputes')
      .update({
        escrow_distributed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', disputeId)

    if (updateError) {
      console.error('[Distribute Escrow API] Failed to mark as distributed:', updateError)
      // Don't fail the request, tokens were already sent
    }

    // 9. Update job status if it's still 'disputed' or 'completed'
    const newJobStatus = dispute.worker_percentage === 100 ? 'completed' :
                         dispute.poster_percentage === 100 ? 'cancelled' :
                         'dispute_resolved'

    const { error: jobUpdateError } = await supabase
      .from('jobs')
      .update({
        status: newJobStatus,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id)
      .in('status', ['disputed', 'completed', 'cancelled']) // Only update if not already properly set

    if (jobUpdateError) {
      console.error('[Distribute Escrow API] Failed to update job status:', jobUpdateError)
    } else {
      console.log(`[Distribute Escrow API] Job status updated to ${newJobStatus}`)
    }

    // 10. Log admin action
    try {
      await supabase.from('admin_actions').insert({
        admin_wallet: adminWallet,
        action_type: 'manual_escrow_distribution',
        target_type: 'dispute',
        target_id: disputeId,
        details: {
          job_id: job.id,
          worker_percentage: dispute.worker_percentage,
          poster_percentage: dispute.poster_percentage,
          worker_received: splitResult.workerReceived,
          poster_received: splitResult.posterReceived,
          fee_collected: splitResult.feeCollected,
          signatures: {
            worker: splitResult.workerTxSignature,
            poster: splitResult.posterTxSignature,
            fee: splitResult.feeTxSignature
          }
        },
        created_at: new Date().toISOString()
      })
    } catch (logError) {
      console.error('[Distribute Escrow API] Failed to log action:', logError)
    }

    return NextResponse.json({
      success: true,
      message: 'Escrow distributed successfully',
      disputeId,
      jobId: job.id,
      escrowDistribution: {
        success: true,
        workerReceived: splitResult.workerReceived,
        posterRefunded: splitResult.posterReceived,
        feeCollected: splitResult.feeCollected,
        workerTxSignature: splitResult.workerTxSignature,
        posterTxSignature: splitResult.posterTxSignature,
        feeTxSignature: splitResult.feeTxSignature
      }
    })

  } catch (error) {
    console.error('[Distribute Escrow API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

