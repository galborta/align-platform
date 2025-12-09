import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { releasePaymentWithRetry } from '@/lib/solana/escrow-release'
import { Connection } from '@solana/web3.js'
import { Database } from '@/types/database'
import { rateLimit } from '@/lib/rate-limit'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/admin/jobs/[jobId]/manual-release
 * 
 * Manually release payment for a job (admin only)
 * Bypasses auto-release schedule and immediately processes payment
 * 
 * Security:
 * - CRITICAL: Requires Supabase JWT authentication
 * - ADMIN ONLY - user must be in admin_wallets table
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    // Parse release details
    const body = await request.json()
    const { release_reason } = body

    // ==================== ADMIN AUTHENTICATION ====================

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Admin Manual Release] No auth header')
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Verify token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('[Admin Manual Release] Auth failed:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    console.log(`[Admin Manual Release] Authenticated user: ${user.id}`)

    // Get user's wallet from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.wallet_address) {
      console.error('[Admin Manual Release] No wallet for user:', profileError)
      return NextResponse.json(
        { error: 'No wallet address linked to account' },
        { status: 403 }
      )
    }

    // Verify admin status by checking wallet in admin_wallets table
    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .from('admin_wallets')
      .select('wallet_address')
      .eq('wallet_address', profile.wallet_address)
      .single()

    if (adminError || !adminCheck) {
      console.error('[Admin Manual Release] Not an admin:', adminError)
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const adminWallet = profile.wallet_address
    console.log(`[Admin Manual Release] Admin verified: ${adminWallet}`)

    // ==================== RATE LIMITING ====================

    const rateLimitResult = rateLimit(user.id, 'admin')
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: rateLimitResult.status }
      )
    }

    // ==================== FETCH JOB ====================

    console.log('[Admin Manual Release] Request for job:', jobId)

    // Fetch job details
    const { data: job, error: jobError } = await supabaseAdmin
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
    console.log('[Admin Manual Release] Amount:', job.escrow_amount_tokens, (job as any).token_symbol || 'tokens')

    // Get current retry count from job_escrow_transactions
    const { data: attempts } = await supabaseAdmin
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
      await supabaseAdmin
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
    const { error: updateError } = await supabaseAdmin
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

    const tokenSymbol = (job as any).token_symbol || 'tokens'
    
    // Send notification to worker
    await supabaseAdmin.from('notifications').insert({
      user_wallet: job.assigned_to || '',
      type: 'job_payment_released',
      title: 'Payment Released (Admin)',
      message: `Payment of ${result.workerReceived} ${tokenSymbol} has been manually released by admin for "${job.title}"`,
      job_id: job.id,
      created_at: new Date().toISOString()
    })

    // Send notification to poster
    await supabaseAdmin.from('notifications').insert({
      user_wallet: job.poster_wallet,
      type: 'job_completed',
      title: 'Job Completed',
      message: `Your job "${job.title}" has been completed and payment released.`,
      job_id: job.id,
      created_at: new Date().toISOString()
    })

    // Log admin action for audit trail
    try {
      await supabaseAdmin
        .from('admin_logs')
        .insert({
          admin_wallet: adminWallet,
          action: 'manual_release',
          entity_type: 'job',
          entity_id: jobId,
          details: {
            reason: release_reason || 'Manual release via admin dashboard',
            worker_received: result.workerReceived,
            fee_collected: result.feeCollected,
            worker_tx: result.workerTxSignature,
            fee_tx: result.feeTxSignature
          },
          created_at: new Date().toISOString()
        })
    } catch (auditError) {
      console.error('[Admin Manual Release] Failed to log admin action:', auditError)
      // Non-critical, continue
    }

    return NextResponse.json({
      success: true,
      workerTxSignature: result.workerTxSignature,
      feeTxSignature: result.feeTxSignature,
      workerReceived: result.workerReceived,
      feeCollected: result.feeCollected,
      tokenSymbol: tokenSymbol,
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




