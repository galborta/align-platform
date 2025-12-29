import { NextRequest, NextResponse } from 'next/server'
import { Connection } from '@solana/web3.js'
import { supabase } from '@/lib/supabase'
import { notifyDisputeResolved } from '@/lib/notifications/dispute-notifications'
import { sendDisputeResolvedEmail } from '@/lib/emails/dispute-emails'
import { splitEscrowForDispute, validateDisputeSplitBalance } from '@/lib/solana/escrow-dispute-split'
import { getFeePercentage } from '@/lib/platform-settings'

/**
 * POST /api/disputes/resolve
 * 
 * Resolves a dispute as an admin
 * - Calls record_admin_resolution RPC
 * - Executes escrow split (distributes tokens to worker, poster, and fee wallet)
 * - Updates job status
 * - Creates in-app notifications for poster and worker
 * - Sends email notifications
 * - Requires global admin permissions
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await req.json()
    const { 
      disputeId, 
      adminWallet,
      workerPercentage,
      posterPercentage,
      resolutionNotes 
    } = body

    console.log(`[Dispute Resolve] Starting resolution for dispute ${disputeId}`)
    console.log(`[Dispute Resolve] Split: Worker ${workerPercentage}% / Poster ${posterPercentage}%`)

    // Validate required fields
    if (!disputeId || !adminWallet || workerPercentage === undefined || posterPercentage === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: disputeId, adminWallet, workerPercentage, posterPercentage' },
        { status: 400 }
      )
    }

    // Validate percentages sum to 100
    if (workerPercentage + posterPercentage !== 100) {
      return NextResponse.json(
        { error: 'Worker and poster percentages must sum to 100' },
        { status: 400 }
      )
    }

    // 1. Verify admin permission
    console.log(`[Dispute Resolve] Verifying admin: ${adminWallet}`)
    const { data: adminData, error: adminError } = await supabase
      .from('admin_wallets')
      .select('wallet_address')
      .eq('wallet_address', adminWallet)
      .eq('is_active', true)
      .maybeSingle()

    if (adminError || !adminData) {
      return NextResponse.json(
        { error: 'Unauthorized: Not a global admin' },
        { status: 403 }
      )
    }

    // 2. Get dispute details (with FULL job info including escrow details)
    console.log(`[Dispute Resolve] Fetching dispute and job details...`)
    const { data: dispute, error: disputeError } = await supabase
      .from('job_disputes')
      .select(`
        id,
        job_id,
        status,
        jobs (
          id,
          title,
          poster_wallet,
          assigned_to,
          escrow_amount_tokens,
          escrow_token_mint,
          escrow_locked,
          fee_percentage_at_creation,
          status
        )
      `)
      .eq('id', disputeId)
      .single()

    if (disputeError || !dispute) {
      console.error('[Dispute Resolve] Dispute not found:', disputeError)
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      )
    }

    const job = dispute.jobs as any
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found for this dispute' },
        { status: 404 }
      )
    }

    console.log(`[Dispute Resolve] Job: ${job.title}`)
    console.log(`[Dispute Resolve] Escrow amount: ${job.escrow_amount_tokens}`)
    console.log(`[Dispute Resolve] Token mint: ${job.escrow_token_mint}`)
    console.log(`[Dispute Resolve] Worker: ${job.assigned_to}`)
    console.log(`[Dispute Resolve] Poster: ${job.poster_wallet}`)

    // 3. Call the resolution RPC function (records the admin decision)
    console.log(`[Dispute Resolve] Recording admin resolution in database...`)
    const { error: rpcError } = await supabase.rpc('record_admin_resolution', {
      p_dispute_id: disputeId,
      p_admin_wallet: adminWallet,
      p_worker_percentage: workerPercentage,
      p_poster_percentage: posterPercentage,
      p_resolution_notes: resolutionNotes || ''
    })

    if (rpcError) {
      console.error('[Dispute Resolve] Resolution RPC error:', rpcError)
      return NextResponse.json(
        { error: rpcError.message || 'Failed to record resolution' },
        { status: 500 }
      )
    }
    console.log(`[Dispute Resolve] ✅ Admin resolution recorded`)

    // 4. Execute escrow split (distribute tokens)
    let splitResult = null
    
    // Only execute split if escrow exists and is locked
    if (job.escrow_amount_tokens && job.escrow_token_mint && job.escrow_locked) {
      console.log(`[Dispute Resolve] Executing escrow split...`)
      
      // Get RPC endpoint
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
                     process.env.SOLANA_RPC_URL || 
                     'https://api.mainnet-beta.solana.com'
      
      const connection = new Connection(rpcUrl, 'confirmed')
      
      // Get fee percentage (use job's stored fee or fetch current)
      const feePercentage = job.fee_percentage_at_creation || await getFeePercentage()
      
      // Default to 9 decimals (SOL) - could be enhanced to look up token decimals
      const decimals = 9
      
      // Validate escrow balance before attempting split
      console.log(`[Dispute Resolve] Validating escrow balance...`)
      const validation = await validateDisputeSplitBalance(
        connection,
        job.escrow_token_mint,
        job.escrow_amount_tokens,
        decimals
      )
      
      if (!validation.valid) {
        console.error(`[Dispute Resolve] Escrow balance validation failed:`, validation.error)
        // Don't fail the whole resolution - just log the error
        // The resolution is recorded, tokens can be manually transferred
        console.warn(`[Dispute Resolve] ⚠️ Proceeding without token distribution - manual intervention may be required`)
      } else {
        // Execute the split
        splitResult = await splitEscrowForDispute({
          connection,
          jobId: job.id,
          disputeId: disputeId,
          workerWallet: job.assigned_to,
          posterWallet: job.poster_wallet,
          tokenMint: job.escrow_token_mint,
          escrowAmount: job.escrow_amount_tokens,
          decimals,
          workerPercentage,
          posterPercentage,
          feePercentage
        })
        
        if (splitResult.success) {
          console.log(`[Dispute Resolve] ✅ Escrow split successful`)
          console.log(`[Dispute Resolve] Worker received: ${splitResult.workerReceived}`)
          console.log(`[Dispute Resolve] Poster refunded: ${splitResult.posterRefunded}`)
          console.log(`[Dispute Resolve] Fee collected: ${splitResult.feeCollected}`)
          
          // Mark escrow as distributed
          const { error: distUpdateError } = await supabase
            .from('job_disputes')
            .update({ escrow_distributed: true })
            .eq('id', disputeId)
          
          if (distUpdateError) {
            console.error('[Dispute Resolve] Failed to mark escrow_distributed:', distUpdateError)
          }
        } else {
          console.error(`[Dispute Resolve] ❌ Escrow split failed:`, splitResult.error)
          // Continue with resolution - tokens can be manually transferred
        }
      }
    } else {
      console.log(`[Dispute Resolve] No escrow to distribute (amount: ${job.escrow_amount_tokens}, locked: ${job.escrow_locked})`)
      
      // If no escrow, mark as distributed anyway (nothing to distribute)
      if (!job.escrow_amount_tokens) {
        await supabase
          .from('job_disputes')
          .update({ escrow_distributed: true })
          .eq('id', disputeId)
      }
    }

    // 5. Update job status based on resolution
    console.log(`[Dispute Resolve] Updating job status...`)
    
    // Determine the appropriate job status
    let newJobStatus: string
    if (workerPercentage === 100) {
      // Worker wins completely - job completed
      newJobStatus = 'completed'
    } else if (posterPercentage === 100) {
      // Poster wins completely - job cancelled/refunded
      newJobStatus = 'cancelled'
    } else {
      // Split resolution - use 'dispute_resolved' status
      newJobStatus = 'dispute_resolved'
    }
    
    const jobUpdateData: any = {
      status: newJobStatus,
      escrow_locked: false,
      updated_at: new Date().toISOString()
    }
    
    // Set appropriate timestamp based on outcome
    if (newJobStatus === 'completed') {
      jobUpdateData.completed_at = new Date().toISOString()
    } else if (newJobStatus === 'cancelled') {
      jobUpdateData.cancelled_at = new Date().toISOString()
    }
    
    const { error: jobUpdateError } = await supabase
      .from('jobs')
      .update(jobUpdateData)
      .eq('id', job.id)
    
    if (jobUpdateError) {
      console.error('[Dispute Resolve] Failed to update job status:', jobUpdateError)
      // Don't fail - resolution is recorded
    } else {
      console.log(`[Dispute Resolve] ✅ Job status updated to: ${newJobStatus}`)
    }

    // 6. Create in-app notifications for poster and worker
    console.log(`[Dispute Resolve] Sending notifications...`)
    await notifyDisputeResolved(
      disputeId,
      dispute.job_id,
      job.poster_wallet,
      job.assigned_to,
      adminWallet,
      workerPercentage,
      posterPercentage,
      resolutionNotes || ''
    )

    // 7. Send email notifications
    try {
      // Get user profiles with emails
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('wallet_address, email')
        .in('wallet_address', [job.poster_wallet, job.assigned_to])

      const resolutionData = {
        disputeId,
        jobTitle: job.title,
        workerPercentage,
        posterPercentage,
        resolutionNotes: resolutionNotes || '',
        resolvedAt: new Date().toISOString()
      }

      // Send to poster
      const posterProfile = profiles?.find(p => p.wallet_address === job.poster_wallet)
      if (posterProfile?.email) {
        await sendDisputeResolvedEmail(posterProfile.email, resolutionData)
      }

      // Send to worker
      const workerProfile = profiles?.find(p => p.wallet_address === job.assigned_to)
      if (workerProfile?.email) {
        await sendDisputeResolvedEmail(workerProfile.email, resolutionData)
      }

      console.log('[Dispute Resolve] ✅ Resolution emails sent')
    } catch (emailError) {
      console.error('[Dispute Resolve] Failed to send resolution emails:', emailError)
      // Don't fail the whole operation if email fails
    }

    // 8. Log admin action
    await supabase
      .from('admin_logs')
      .insert({
        admin_wallet: adminWallet,
        action: 'dispute_resolved',
        entity_type: 'dispute',
        entity_id: disputeId,
        details: {
          job_id: dispute.job_id,
          job_title: job.title,
          worker_percentage: workerPercentage,
          poster_percentage: posterPercentage,
          resolution_notes: resolutionNotes,
          new_job_status: newJobStatus,
          escrow_split: splitResult ? {
            success: splitResult.success,
            worker_received: splitResult.workerReceived,
            poster_refunded: splitResult.posterRefunded,
            fee_collected: splitResult.feeCollected,
            worker_tx: splitResult.workerTxSignature,
            poster_tx: splitResult.posterTxSignature,
            fee_tx: splitResult.feeTxSignature,
            error: splitResult.error
          } : null
        }
      })

    const duration = Date.now() - startTime
    console.log(`[Dispute Resolve] ✅ Complete in ${duration}ms`)

    return NextResponse.json({
      success: true,
      message: 'Dispute resolved successfully',
      disputeId,
      workerPercentage,
      posterPercentage,
      newJobStatus,
      escrowDistribution: splitResult ? {
        success: splitResult.success,
        workerReceived: splitResult.workerReceived,
        posterRefunded: splitResult.posterRefunded,
        feeCollected: splitResult.feeCollected,
        error: splitResult.error
      } : null
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Dispute Resolve] ❌ Error after ${duration}ms:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
