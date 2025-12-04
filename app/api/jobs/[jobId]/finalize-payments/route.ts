import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Connection, PublicKey } from '@solana/web3.js'
import { 
  calculateActiveTier, 
  calculateProportionalPayments,
  calculateRefundAmount 
} from '@/lib/social-media-jobs'
import { 
  createSocialJobPaymentTransaction,
  executeSocialJobPayment,
  validateSocialJobEscrowBalance,
  calculateTotalEscrowNeed
} from '@/lib/solana/social-job-payments'
import { getFeeWallet, getFeePercentage } from '@/lib/platform-settings'
import { notificationService } from '@/lib/services/notificationService'
import { Database } from '@/types/database'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Solana connection
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
const connection = new Connection(SOLANA_RPC, 'confirmed')

/**
 * POST /api/jobs/[jobId]/finalize-payments
 * 
 * Finalizes and distributes payments for a social media engagement job.
 * 
 * This endpoint orchestrates the complete payment distribution:
 * 1. Validates job status and poster authorization
 * 2. Fetches all approved submissions
 * 3. Calculates active tier based on participant count
 * 4. Calculates proportional payments based on follower counts
 * 5. Calculates refund for unused budget (if lower tier)
 * 6. Validates escrow balance
 * 7. Creates and executes multi-recipient Solana transaction
 * 8. Updates all submission records with payment amounts
 * 9. Marks job as completed
 * 10. Awards karma to all parties
 * 11. Sends notifications to workers
 * 
 * Request body:
 * - poster_wallet: string (required) - Wallet address of the job poster
 * 
 * Security:
 * - Only the job poster can finalize payments
 * - Payments can only be finalized once
 * - Escrow balance is validated before transaction
 * 
 * @param request - Request containing poster_wallet
 * @param params - URL params containing job id
 * @returns Success response with payment details or error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const startTime = Date.now()

  try {
    // Await params in Next.js 15+
    const { jobId } = await params
    console.log(`[Finalize Payments] Starting for job ${jobId}`)

    // Parse request body
    const body = await request.json()
    const { poster_wallet } = body

    // ==================== VALIDATION ====================

    if (!poster_wallet) {
      return NextResponse.json(
        { error: 'Poster wallet address required' },
        { status: 400 }
      )
    }

    console.log(`[Finalize Payments] Poster wallet: ${poster_wallet}`)

    // ==================== GET JOB DETAILS ====================

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('is_social_media_job', true)
      .single()

    if (jobError || !job) {
      console.error('[Finalize Payments] Job not found:', jobError)
      return NextResponse.json(
        { error: 'Social media job not found' },
        { status: 404 }
      )
    }

    console.log(`[Finalize Payments] Job found: ${job.title}`)
    console.log(`[Finalize Payments] Job status: ${job.status}`)

    // Verify poster authorization
    if (job.poster_wallet !== poster_wallet) {
      console.error(`[Finalize Payments] Unauthorized: ${poster_wallet} is not poster ${job.poster_wallet}`)
      return NextResponse.json(
        { error: 'Only the job poster can finalize payments' },
        { status: 403 }
      )
    }

    // Check if already finalized
    if (job.social_payments_distributed) {
      console.error('[Finalize Payments] Payments already distributed')
      return NextResponse.json(
        { error: 'Payments have already been distributed for this job' },
        { status: 400 }
      )
    }

    // ==================== GET APPROVED SUBMISSIONS ====================

    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from('job_submissions')
      .select('*')
      .eq('job_id', jobId)
      .in('social_approval_status', ['approved', 'auto_approved'])

    if (submissionsError) {
      console.error('[Finalize Payments] Failed to fetch submissions:', submissionsError)
      throw new Error('Failed to fetch submissions')
    }

    if (!submissions || submissions.length === 0) {
      console.error('[Finalize Payments] No approved submissions')
      return NextResponse.json(
        { error: 'No approved submissions to pay' },
        { status: 400 }
      )
    }

    console.log(`[Finalize Payments] Found ${submissions.length} approved submissions`)

    // ==================== CALCULATE ACTIVE TIER ====================

    const budgetTiers = job.social_budget_tiers as Array<{
      min_participants: number
      max_participants: number | null
      budget_tokens: number
      budget_usd: number
    }>

    if (!budgetTiers || budgetTiers.length === 0) {
      console.error('[Finalize Payments] No budget tiers configured')
      return NextResponse.json(
        { error: 'Job has no budget tiers configured' },
        { status: 400 }
      )
    }

    const participantCount = submissions.length
    const activeTier = calculateActiveTier(budgetTiers, participantCount)

    if (!activeTier) {
      console.error('[Finalize Payments] No matching tier for participant count:', participantCount)
      return NextResponse.json(
        { error: `No matching budget tier for ${participantCount} participants` },
        { status: 400 }
      )
    }

    console.log(`[Finalize Payments] Active tier: ${activeTier.min_participants}-${activeTier.max_participants ?? '+'} participants`)
    console.log(`[Finalize Payments] Tier budget: ${activeTier.budget_tokens} tokens`)

    // ==================== CALCULATE PROPORTIONAL PAYMENTS ====================

    // Prepare submissions for payment calculation
    const submissionsForPayment = submissions.map(sub => ({
      id: sub.id,
      worker_wallet: sub.worker_wallet,
      social_follower_count_verified: sub.social_follower_count_verified || sub.social_follower_count_claimed || 0
    }))

    const payments = calculateProportionalPayments(
      submissionsForPayment,
      activeTier.budget_tokens,
      activeTier.budget_usd
    )

    console.log(`[Finalize Payments] Calculated ${payments.length} worker payments`)

    // Calculate totals
    const totalWorkerPayments = payments.reduce(
      (sum, p) => sum + p.payment_amount_tokens,
      0
    )

    console.log(`[Finalize Payments] Total worker payments: ${totalWorkerPayments} tokens`)

    // ==================== CALCULATE PLATFORM FEE ====================

    const feePercentage = await getFeePercentage()
    const platformFeeAmount = activeTier.budget_tokens * (feePercentage / 100)

    console.log(`[Finalize Payments] Platform fee (${feePercentage}%): ${platformFeeAmount} tokens`)

    // ==================== CALCULATE REFUND ====================

    // Max budget is the highest tier's budget (what was locked in escrow)
    const maxTierBudget = Math.max(...budgetTiers.map(t => t.budget_tokens))
    const refund = calculateRefundAmount(
      maxTierBudget,
      activeTier.budget_tokens,
      feePercentage / 100
    )

    console.log(`[Finalize Payments] Max tier budget: ${maxTierBudget} tokens`)
    console.log(`[Finalize Payments] Refund to poster: ${refund.totalRefund} tokens`)

    // ==================== GET PLATFORM WALLETS ====================

    const feeWalletAddress = await getFeeWallet()
    if (!feeWalletAddress) {
      console.error('[Finalize Payments] Fee wallet not configured')
      return NextResponse.json(
        { error: 'Platform fee wallet not configured' },
        { status: 500 }
      )
    }

    console.log(`[Finalize Payments] Fee wallet: ${feeWalletAddress}`)

    // ==================== VALIDATE ESCROW BALANCE ====================

    const tokenMint = new PublicKey(job.escrow_token_mint || 'So11111111111111111111111111111111111111112')
    const totalEscrowNeeded = calculateTotalEscrowNeed(totalWorkerPayments, platformFeeAmount)

    console.log(`[Finalize Payments] Total escrow needed: ${totalEscrowNeeded} tokens`)

    const balanceValidation = await validateSocialJobEscrowBalance(
      connection,
      tokenMint,
      totalEscrowNeeded + refund.totalRefund // Total amount that should be in escrow
    )

    if (!balanceValidation.valid) {
      console.error('[Finalize Payments] Insufficient escrow balance:', balanceValidation.error)
      return NextResponse.json(
        { error: `Escrow validation failed: ${balanceValidation.error}` },
        { status: 400 }
      )
    }

    console.log(`[Finalize Payments] ✅ Escrow balance validated: ${balanceValidation.actualBalance} tokens`)

    // ==================== BUILD AND EXECUTE TRANSACTION ====================

    const platformFeeWallet = new PublicKey(feeWalletAddress)
    const posterWallet = new PublicKey(job.poster_wallet)

    // Prepare recipients for transaction
    const recipients = payments.map(p => ({
      worker_wallet: p.worker_wallet,
      payment_amount_tokens: p.payment_amount_tokens,
      submission_id: p.submission_id
    }))

    console.log(`[Finalize Payments] Building transaction with ${recipients.length} recipients...`)

    const transaction = await createSocialJobPaymentTransaction({
      connection,
      tokenMint,
      platformFeeWallet,
      posterWallet,
      recipients,
      platformFeeAmount,
      refundAmount: refund.totalRefund
    })

    console.log(`[Finalize Payments] Executing transaction...`)

    const txResult = await executeSocialJobPayment(connection, transaction)

    if (!txResult.success) {
      console.error('[Finalize Payments] Transaction failed:', txResult.error)
      return NextResponse.json(
        { error: `Payment transaction failed: ${txResult.error}` },
        { status: 500 }
      )
    }

    console.log(`[Finalize Payments] ✅ Transaction confirmed: ${txResult.txSignature}`)

    // ==================== UPDATE DATABASE RECORDS ====================

    // Update each submission with payment amount
    console.log(`[Finalize Payments] Updating ${payments.length} submission records...`)

    const submissionUpdatePromises = payments.map(payment =>
      supabaseAdmin
        .from('job_submissions')
        .update({
          social_payment_amount_tokens: payment.payment_amount_tokens,
          social_payment_amount_usd: payment.payment_amount_usd,
          social_payment_percentage: payment.percentage_of_total,
          social_payment_tx_signature: txResult.txSignature,
          social_paid_at: new Date().toISOString()
        })
        .eq('id', payment.submission_id)
    )

    const submissionResults = await Promise.all(submissionUpdatePromises)
    const submissionErrors = submissionResults.filter(r => r.error)

    if (submissionErrors.length > 0) {
      console.error('[Finalize Payments] Some submission updates failed:', submissionErrors)
      // Continue - payment was successful, don't fail the whole operation
    } else {
      console.log(`[Finalize Payments] ✅ Updated ${payments.length} submission records`)
    }

    // Update job status
    const { error: jobUpdateError } = await supabaseAdmin
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        social_payments_distributed: true,
        social_payments_distributed_at: new Date().toISOString(),
        social_payment_tx_signature: txResult.txSignature,
        social_actual_participant_count: participantCount,
        social_actual_tier_budget: activeTier.budget_tokens,
        social_platform_fee_collected: platformFeeAmount,
        social_refund_amount: refund.totalRefund,
        escrow_locked: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (jobUpdateError) {
      console.error('[Finalize Payments] ⚠️ CRITICAL: Job update failed:', jobUpdateError)
      // Payment was successful but job update failed - log for manual intervention
      console.error('[Finalize Payments] Job ID:', jobId)
      console.error('[Finalize Payments] Transaction:', txResult.txSignature)
    } else {
      console.log(`[Finalize Payments] ✅ Job marked as completed`)
    }

    // ==================== RECORD TRANSACTIONS ====================

    console.log(`[Finalize Payments] Recording transaction audit trail...`)

    // Record worker payment transactions
    const txRecordPromises = payments.map(payment =>
      supabaseAdmin.from('job_escrow_transactions').insert({
        job_id: jobId,
        transaction_type: 'social_worker_payment',
        from_wallet: process.env.ESCROW_WALLET_ADDRESS || 'ESCROW',
        to_wallet: payment.worker_wallet,
        amount_tokens: payment.payment_amount_tokens,
        token_mint: job.escrow_token_mint || 'So11111111111111111111111111111111111111112',
        token_symbol: 'SOL', // TODO: Get from token metadata
        tx_signature: txResult.txSignature,
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      })
    )

    // Record platform fee transaction
    txRecordPromises.push(
      supabaseAdmin.from('job_escrow_transactions').insert({
        job_id: jobId,
        transaction_type: 'social_platform_fee',
        from_wallet: process.env.ESCROW_WALLET_ADDRESS || 'ESCROW',
        to_wallet: feeWalletAddress,
        amount_tokens: platformFeeAmount,
        token_mint: job.escrow_token_mint || 'So11111111111111111111111111111111111111112',
        token_symbol: 'SOL',
        tx_signature: txResult.txSignature,
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      })
    )

    // Record refund transaction if applicable
    if (refund.totalRefund > 0) {
      txRecordPromises.push(
        supabaseAdmin.from('job_escrow_transactions').insert({
          job_id: jobId,
          transaction_type: 'social_refund',
          from_wallet: process.env.ESCROW_WALLET_ADDRESS || 'ESCROW',
          to_wallet: job.poster_wallet,
          amount_tokens: refund.totalRefund,
          token_mint: job.escrow_token_mint || 'So11111111111111111111111111111111111111112',
          token_symbol: 'SOL',
          tx_signature: txResult.txSignature,
          status: 'confirmed',
          confirmed_at: new Date().toISOString()
        })
      )
    }

    try {
      await Promise.all(txRecordPromises)
      console.log(`[Finalize Payments] ✅ Transaction records created`)
    } catch (txRecordError) {
      console.error('[Finalize Payments] Failed to record some transactions:', txRecordError)
      // Non-critical - payment was successful
    }

    // ==================== AWARD KARMA ====================

    console.log(`[Finalize Payments] Awarding karma...`)

    // Award karma to workers (increment jobs_completed)
    const karmaPromises = payments.map(payment =>
      supabaseAdmin.rpc('increment_karma_field', {
        p_wallet: payment.worker_wallet,
        p_project_id: job.project_id,
        p_field: 'jobs_completed_as_worker_count',
        p_amount: 1
      })
    )

    // Award tokens_earned to workers
    const tokensEarnedPromises = payments.map(payment =>
      supabaseAdmin.rpc('increment_karma_field', {
        p_wallet: payment.worker_wallet,
        p_project_id: job.project_id,
        p_field: 'tokens_earned',
        p_amount: payment.payment_amount_tokens
      })
    )

    try {
      await Promise.all([...karmaPromises, ...tokensEarnedPromises])
      console.log(`[Finalize Payments] ✅ Karma awarded to ${payments.length} workers`)
    } catch (karmaError) {
      console.error('[Finalize Payments] Failed to award karma:', karmaError)
      // Non-critical - payment was successful
    }

    // ==================== SEND NOTIFICATIONS ====================

    console.log(`[Finalize Payments] Sending notifications to workers...`)

    const notificationPromises = payments.map(payment =>
      notificationService.createNotification({
        userWallet: payment.worker_wallet,
        type: 'payment_released',
        actorWallet: job.poster_wallet,
        referenceId: jobId,
        referenceType: 'job',
        metadata: {
          job_title: job.title,
          amount: payment.payment_amount_tokens,
          percentage: payment.percentage_of_total.toFixed(1),
          token: 'tokens',
          is_social_media_job: true
        }
      })
    )

    try {
      await Promise.all(notificationPromises)
      console.log(`[Finalize Payments] ✅ Notifications sent to ${payments.length} workers`)
    } catch (notificationError) {
      console.error('[Finalize Payments] Failed to send some notifications:', notificationError)
      // Non-critical - payment was successful
    }

    // ==================== SUCCESS RESPONSE ====================

    const duration = Date.now() - startTime
    console.log(`[Finalize Payments] ✅ Complete in ${duration}ms`)

    return NextResponse.json({
      success: true,
      data: {
        job_id: jobId,
        transaction_signature: txResult.txSignature,
        participant_count: participantCount,
        active_tier: {
          min_participants: activeTier.min_participants,
          max_participants: activeTier.max_participants,
          budget_tokens: activeTier.budget_tokens,
          budget_usd: activeTier.budget_usd
        },
        payments: payments.map(p => ({
          worker_wallet: p.worker_wallet,
          amount_tokens: p.payment_amount_tokens,
          amount_usd: p.payment_amount_usd,
          percentage: p.percentage_of_total
        })),
        platform_fee: platformFeeAmount,
        refund_to_poster: refund.totalRefund,
        total_distributed: totalWorkerPayments + platformFeeAmount + refund.totalRefund
      }
    })

  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[Finalize Payments] ❌ Error after ${duration}ms:`, error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

