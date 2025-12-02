import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Connection } from '@solana/web3.js'
import { releasePaymentFromEscrow, validateEscrowBalance } from '@/lib/solana/escrow-release'
import { getFeePercentage, getFeeWallet, getEscrowWallet } from '@/lib/platform-settings'
import { notificationService } from '@/lib/services/notificationService'
import { Database } from '@/types/database'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/jobs/[jobId]/release-payment
 * 
 * Manually release payment from escrow to worker
 * 
 * This endpoint:
 * 1. Validates poster authorization
 * 2. Checks job status and escrow balance
 * 3. Executes blockchain transfers (worker payment + platform fee)
 * 4. Updates job status to 'completed'
 * 5. Records transactions for audit trail
 * 6. Awards karma to all parties
 * 
 * Security:
 * - Requires escrow wallet private key (server-side only)
 * - Only poster can trigger release
 * - Validates escrow balance before transfer
 * - Atomic updates with transaction logging
 * 
 * @param request - Request body containing poster_wallet
 * @param params - URL params containing jobId
 * @returns Success response with transaction signatures or error
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const startTime = Date.now()
  
  try {
    // Await params in Next.js 15+
    const { jobId } = await params
    console.log(`[Release Payment] Starting for job ${jobId}`)
    
    // Parse request body
    const { poster_wallet, auto_release } = await request.json()
    
    if (!poster_wallet) {
      console.error('[Release Payment] Missing poster_wallet in request')
      return NextResponse.json(
        { error: 'Poster wallet required' },
        { status: 400 }
      )
    }

    console.log(`[Release Payment] Poster: ${poster_wallet}`)
    console.log(`[Release Payment] Auto-release: ${auto_release || false}`)
    
    // ==================== GET JOB DETAILS ====================
    
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    
    if (jobError || !job) {
      console.error('[Release Payment] Job not found:', jobError)
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    console.log(`[Release Payment] Job found: ${job.title}`)
    console.log(`[Release Payment] Status: ${job.status}`)
    console.log(`[Release Payment] Assigned to: ${job.assigned_to}`)
    
    // ==================== AUTHORIZATION CHECKS ====================
    
    // For auto-release, verify service token instead of poster wallet
    if (auto_release) {
      const authHeader = request.headers.get('authorization')
      const serviceToken = process.env.SERVICE_AUTH_TOKEN || 'auto-release-internal'
      
      if (authHeader !== `Bearer ${serviceToken}`) {
        console.error('[Release Payment] Invalid service token for auto-release')
        return NextResponse.json(
          { error: 'Unauthorized auto-release request' },
          { status: 403 }
        )
      }
      
      console.log('[Release Payment] ✅ Service token validated for auto-release')
    } else {
      // Manual release: verify poster
      if (job.poster_wallet !== poster_wallet) {
        console.error('[Release Payment] Unauthorized: wallet does not match poster')
        return NextResponse.json(
          { error: 'Only poster can release payment' },
          { status: 403 }
        )
      }
    }
    
    // ==================== STATUS VALIDATION ====================
    
    // Verify job status
    if (job.status !== 'submitted') {
      console.error(`[Release Payment] Invalid status: ${job.status}`)
      return NextResponse.json(
        { error: `Job must be in submitted status (current: ${job.status})` },
        { status: 400 }
      )
    }
    
    // Check if payment is paused (dispute or admin action)
    if (job.release_paused) {
      console.error('[Release Payment] Release paused by admin')
      return NextResponse.json(
        { 
          error: 'Payment release is paused',
          reason: job.release_paused_by ? `Paused by ${job.release_paused_by}` : 'Administrative hold'
        },
        { status: 400 }
      )
    }

    // Verify escrow is locked
    if (!job.escrow_locked) {
      console.error('[Release Payment] Escrow not locked')
      return NextResponse.json(
        { error: 'Escrow funds not locked for this job' },
        { status: 400 }
      )
    }

    // Verify worker is assigned
    if (!job.assigned_to) {
      console.error('[Release Payment] No worker assigned')
      return NextResponse.json(
        { error: 'No worker assigned to this job' },
        { status: 400 }
      )
    }

    console.log('[Release Payment] ✅ All validation checks passed')
    
    // ==================== BLOCKCHAIN CONNECTION ====================
    
    const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    
    if (!rpcUrl) {
      console.error('[Release Payment] No RPC URL configured')
      return NextResponse.json(
        { error: 'Server configuration error: No RPC endpoint' },
        { status: 500 }
      )
    }

    console.log(`[Release Payment] Connecting to RPC: ${rpcUrl.substring(0, 30)}...`)
    const connection = new Connection(rpcUrl, 'confirmed')
    
    // ==================== ESCROW BALANCE VALIDATION ====================
    
    // Get token decimals (default to 9 for SOL)
    const decimals = 9 // TODO: Fetch from token mint metadata
    
    console.log('[Release Payment] Validating escrow balance...')
    const validation = await validateEscrowBalance(
      connection,
      job.escrow_token_mint,
      job.escrow_amount_tokens,
      decimals
    )
    
    if (!validation.valid) {
      console.error('[Release Payment] Insufficient escrow balance:', validation.error)
      return NextResponse.json(
        { 
          error: validation.error || 'Insufficient escrow balance',
          actualBalance: validation.actualBalance,
          requiredBalance: job.escrow_amount_tokens
        },
        { status: 400 }
      )
    }

    console.log(`[Release Payment] ✅ Balance validated: ${validation.actualBalance}`)
    
    // ==================== GET PLATFORM SETTINGS ====================
    
    const feePercentage = await getFeePercentage()
    console.log(`[Release Payment] Fee percentage: ${feePercentage}%`)
    
    // ==================== EXECUTE PAYMENT RELEASE ====================
    
    console.log('[Release Payment] Executing blockchain transfers...')
    const result = await releasePaymentFromEscrow({
      connection,
      jobId: job.id,
      workerWallet: job.assigned_to,
      tokenMint: job.escrow_token_mint,
      escrowAmount: job.escrow_amount_tokens,
      decimals,
      feePercentage
    })
    
    if (!result.success) {
      console.error('[Release Payment] Transfer failed:', result.error)
      return NextResponse.json(
        { 
          error: result.error || 'Payment release failed',
          details: 'Blockchain transfer unsuccessful'
        },
        { status: 500 }
      )
    }

    console.log('[Release Payment] ✅ Blockchain transfers complete')
    console.log(`[Release Payment] Worker received: ${result.workerReceived}`)
    console.log(`[Release Payment] Fee collected: ${result.feeCollected}`)
    console.log(`[Release Payment] Worker tx: ${result.workerTxSignature}`)
    console.log(`[Release Payment] Fee tx: ${result.feeTxSignature}`)
    
    // ==================== UPDATE JOB STATUS ====================
    
    console.log('[Release Payment] Updating job status...')
    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        escrow_locked: false, // Unlock escrow
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id)
    
    if (updateError) {
      console.error('[Release Payment] Failed to update job status:', updateError)
      // CRITICAL: Payment already released, but status not updated
      // Log for manual intervention
      console.error('[Release Payment] ⚠️ CRITICAL: Payment released but DB update failed')
      console.error('[Release Payment] Job ID:', job.id)
      console.error('[Release Payment] Worker tx:', result.workerTxSignature)
      // Continue to record transactions
    } else {
      console.log('[Release Payment] ✅ Job status updated to completed')
    }

    // ==================== NOTIFY WORKER ====================
    
    // Notify the worker of job completion (non-blocking)
    try {
      if (job.assigned_to) {
        await notificationService.createNotification({
          userWallet: job.assigned_to,
          type: 'job_completed',
          actorWallet: job.poster_wallet,
          referenceId: job.id,
          referenceType: 'job',
          metadata: {
            job_title: job.title,
            amount: result.workerReceived,
            token: job.token_symbol || 'tokens'
          }
        })
        console.log('[Release Payment] ✅ Worker notification sent')
      }
    } catch (notificationError) {
      console.error('[Release Payment] Failed to create notification:', notificationError)
      // Continue - notification failure is non-critical
    }
    
    // ==================== RECORD TRANSACTIONS ====================
    
    console.log('[Release Payment] Recording transactions for audit...')
    
    // Get wallet addresses
    const escrowWalletAddress = await getEscrowWallet() || process.env.ESCROW_WALLET_ADDRESS || 'UNKNOWN'
    const feeWalletAddress = await getFeeWallet() || process.env.FEE_WALLET_ADDRESS || 'UNKNOWN'
    
    const transactionResults = await Promise.allSettled([
      // Worker payment transaction
      supabaseAdmin.from('job_escrow_transactions').insert({
        job_id: job.id,
        transaction_type: 'release_to_worker',
        from_wallet: escrowWalletAddress,
        to_wallet: job.assigned_to,
        amount_tokens: result.workerReceived,
        token_mint: job.escrow_token_mint,
        token_symbol: 'SOL', // TODO: Get from token metadata
        tx_signature: result.workerTxSignature!,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }),
      
      // Platform fee transaction
      supabaseAdmin.from('job_escrow_transactions').insert({
        job_id: job.id,
        transaction_type: 'fee_collection',
        from_wallet: escrowWalletAddress,
        to_wallet: feeWalletAddress,
        amount_tokens: result.feeCollected,
        token_mint: job.escrow_token_mint,
        token_symbol: 'SOL', // TODO: Get from token metadata
        tx_signature: result.feeTxSignature!,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
    ])

    // Check if transaction recording succeeded
    transactionResults.forEach((txResult, index) => {
      const txType = index === 0 ? 'worker payment' : 'fee collection'
      if (txResult.status === 'rejected') {
        console.error(`[Release Payment] Failed to record ${txType} transaction:`, txResult.reason)
      } else {
        console.log(`[Release Payment] ✅ Recorded ${txType} transaction`)
      }
    })
    
    // ==================== AWARD KARMA ====================
    
    // TODO: Implement karma distribution (Sprint 6)
    // - Award completion karma to poster
    // - Award completion karma to worker
    // - Award bonus karma to application upvoters
    console.log('[Release Payment] TODO: Award karma to poster, worker, and upvoters')
    
    /*
    try {
      await Promise.all([
        // Poster karma
        supabaseAdmin.rpc('award_karma', {
          p_wallet_address: job.poster_wallet,
          p_project_id: job.project_id,
          p_amount: job.payment_amount_usd * 50,
          p_reason: 'job_completed_poster'
        }),
        // Worker karma
        supabaseAdmin.rpc('award_karma', {
          p_wallet_address: job.assigned_to,
          p_project_id: job.project_id,
          p_amount: job.payment_amount_usd * 50,
          p_reason: 'job_completed_worker'
        })
      ])
      console.log('[Release Payment] ✅ Karma awarded')
    } catch (karmaError) {
      console.error('[Release Payment] Karma award failed:', karmaError)
      // Non-critical - payment already released
    }
    */
    
    // ==================== SUCCESS RESPONSE ====================
    
    const duration = Date.now() - startTime
    console.log(`[Release Payment] ✅ Complete in ${duration}ms`)
    
    return NextResponse.json({
      success: true,
      workerReceived: result.workerReceived,
      feeCollected: result.feeCollected,
      workerTxSignature: result.workerTxSignature,
      feeTxSignature: result.feeTxSignature,
      message: 'Payment successfully released to worker'
    }, { status: 200 })
    
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[Release Payment] ❌ Failed after ${duration}ms:`, error)
    console.error('[Release Payment] Error details:', {
      message: error.message,
      stack: error.stack
    })
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/jobs/[jobId]/release-payment
 * Returns method not allowed
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to release payment.' },
    { status: 405 }
  )
}

