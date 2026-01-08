import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Connection, PublicKey } from '@solana/web3.js'
import { calculateImpressionBonus } from '@/lib/social-jobs'
import { 
  createSocialJobPaymentTransaction,
  executeSocialJobPayment,
  PaymentRecipient
} from '@/lib/solana/social-job-payments'
import { notifySubmissionApproved } from '@/lib/social-job-notifications'
import { getFeeWallet, getFeePercentage } from '@/lib/platform-settings'
import { Database } from '@/types/database'
import { rateLimit } from '@/lib/rate-limit'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Solana connection
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
const connection = new Connection(SOLANA_RPC, 'confirmed')

/**
 * Payment details for a single submission
 */
interface PaymentDetails {
  submission_id: string
  worker_wallet: string
  base_amount: number
  bonus_amount: number
  total_amount: number
  impressions: number
}

/**
 * POST /api/jobs/social/[jobId]/approve
 * 
 * Handles manual batch approval of social media job submissions with immediate payment.
 * 
 * Security:
 * - Requires Supabase JWT authentication
 * - Only the job poster can approve submissions
 * - Validates budget before processing payments
 * 
 * This endpoint:
 * 1. Authenticates the poster
 * 2. Validates all submissions are pending
 * 3. Calculates payments including impression bonuses
 * 4. Validates budget availability
 * 5. Executes Solana payment transaction
 * 6. Updates submission and job records
 * 7. Sends notifications to workers
 * 
 * Request body:
 * - submission_ids: string[] (array of submission IDs to approve)
 * - impression_counts: Record<string, number> (map of submission_id -> impression count)
 * 
 * @param request - Request with Authorization header
 * @param params - URL params containing jobId
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
    console.log(`[Batch Approval] Starting for job ${jobId}`)

    // ==================== AUTHENTICATION ====================

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Batch Approval] Missing authorization header')
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Verify JWT token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('[Batch Approval] Invalid auth token:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    console.log(`[Batch Approval] Authenticated user: ${user.id}`)

    // Get user's wallet from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.wallet_address) {
      console.error('[Batch Approval] No wallet found for user:', profileError)
      return NextResponse.json(
        { error: 'No wallet address linked to account' },
        { status: 403 }
      )
    }

    const posterWallet = profile.wallet_address
    console.log(`[Batch Approval] Poster wallet: ${posterWallet}`)

    // ==================== RATE LIMITING ====================

    const rateLimitResult = rateLimit(user.id, 'payment')
    if (!rateLimitResult.success) {
      console.error('[Batch Approval] Rate limit exceeded for user:', user.id)
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: rateLimitResult.status }
      )
    }

    // ==================== REQUEST VALIDATION ====================

    const body = await request.json()
    const { submission_ids, impression_counts } = body

    if (!submission_ids || !Array.isArray(submission_ids) || submission_ids.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid submission_ids array' },
        { status: 400 }
      )
    }

    if (!impression_counts || typeof impression_counts !== 'object') {
      return NextResponse.json(
        { error: 'Missing or invalid impression_counts object' },
        { status: 400 }
      )
    }

    console.log(`[Batch Approval] Approving ${submission_ids.length} submissions`)

    // ==================== GET JOB DETAILS ====================

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('is_social_media_job', true)
      .single()

    if (jobError || !job) {
      console.error('[Batch Approval] Job not found:', jobError)
      return NextResponse.json(
        { error: 'Social media job not found' },
        { status: 404 }
      )
    }

    console.log(`[Batch Approval] Job found: ${job.title}`)

    // ==================== AUTHORIZATION ====================

    // Verify user is the job poster
    if (posterWallet !== job.poster_wallet) {
      console.error('[Batch Approval] Unauthorized - not job poster')
      return NextResponse.json(
        { error: 'Only the job poster can approve submissions' },
        { status: 403 }
      )
    }

    // Check if payments already distributed
    if (job.social_payments_distributed) {
      return NextResponse.json(
        { error: 'Payments have already been distributed for this job' },
        { status: 400 }
      )
    }

    // ==================== GET SUBMISSIONS ====================

    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from('job_submissions')
      .select('*')
      .in('id', submission_ids)
      .eq('job_id', jobId)

    if (submissionsError || !submissions) {
      console.error('[Batch Approval] Error fetching submissions:', submissionsError)
      return NextResponse.json(
        { error: 'Failed to fetch submissions' },
        { status: 500 }
      )
    }

    if (submissions.length !== submission_ids.length) {
      return NextResponse.json(
        { error: 'Some submissions not found or do not belong to this job' },
        { status: 404 }
      )
    }

    console.log(`[Batch Approval] Fetched ${submissions.length} submissions`)

    // ==================== VALIDATE SUBMISSIONS ====================

    // Check all submissions are pending
    const nonPendingSubmissions = submissions.filter(
      s => s.social_approval_status !== 'pending'
    )

    if (nonPendingSubmissions.length > 0) {
      return NextResponse.json(
        {
          error: 'Some submissions are not in pending status',
          non_pending_ids: nonPendingSubmissions.map(s => s.id)
        },
        { status: 400 }
      )
    }

    // ==================== CALCULATE PAYMENTS ====================

    let totalRequired = 0
    const paymentDetails: PaymentDetails[] = []

    for (const submission of submissions) {
      const impressions = impression_counts[submission.id] || 0
      const bonus = impressions > 0 ? calculateImpressionBonus(impressions) : 0
      const baseAmount = submission.social_payment_amount_usd || 0
      const totalAmount = baseAmount + bonus

      totalRequired += totalAmount

      paymentDetails.push({
        submission_id: submission.id,
        worker_wallet: submission.worker_wallet,
        base_amount: baseAmount,
        bonus_amount: bonus,
        total_amount: totalAmount,
        impressions
      })

      console.log(
        `[Batch Approval] Payment for ${submission.worker_wallet.slice(0, 8)}: ` +
        `Base: $${baseAmount}, Bonus: $${bonus}, Total: $${totalAmount} (${impressions} impressions)`
      )
    }

    console.log(`[Batch Approval] Total payment required: $${totalRequired}`)

    // ==================== VALIDATE BUDGET ====================

    // Calculate available budget (remaining + reserved amounts being released)
    const totalReserved = submissions.reduce((sum, s) => sum + (s.social_payment_amount_usd || 0), 0)
    const remainingBudget = job.social_budget_remaining || 0
    const available = remainingBudget + totalReserved

    console.log(`[Batch Approval] Budget check - Available: $${available}, Required: $${totalRequired}`)

    if (totalRequired > available) {
      const shortage = totalRequired - available
      console.error(`[Batch Approval] Budget exceeded - Shortage: $${shortage}`)
      return NextResponse.json(
        {
          error: 'budget_exceeded',
          message: 'Insufficient budget for these approvals',
          shortage,
          total_required: totalRequired,
          available
        },
        { status: 400 }
      )
    }

    // ==================== PREPARE SOLANA PAYMENT ====================

    console.log('[Batch Approval] Preparing Solana payment transaction...')

    // Convert payment details to recipient format
    const recipients: PaymentRecipient[] = paymentDetails.map(p => ({
      worker_wallet: p.worker_wallet,
      payment_amount_tokens: p.total_amount, // In USD for now, will convert in payment function
      submission_id: p.submission_id
    }))

    // Get platform fee settings
    const platformFeeWallet = await getFeeWallet()
    const feePercentage = await getFeePercentage()
    
    // Calculate platform fee (only on bonuses, not base payment)
    const totalBonuses = paymentDetails.reduce((sum, p) => sum + p.bonus_amount, 0)
    const platformFeeAmount = totalBonuses * feePercentage

    console.log(`[Batch Approval] Platform fee: $${platformFeeAmount} (${feePercentage * 100}% of bonuses)`)

    // No refund for manual approvals (full budget allocated)
    const refundAmount = 0

    // Get token mint and decimals
    const tokenMint = new PublicKey(job.project_token_mint || process.env.NEXT_PUBLIC_DEFAULT_TOKEN_MINT!)
    const tokenDecimals = 9 // Most Solana tokens use 9 decimals

    // ==================== EXECUTE PAYMENT TRANSACTION ====================

    console.log('[Batch Approval] Executing payment transaction...')

    try {
      const paymentResult = await executeSocialJobPayment({
        connection,
        tokenMint,
        platformFeeWallet: new PublicKey(platformFeeWallet),
        posterWallet: new PublicKey(posterWallet),
        recipients,
        platformFeeAmount,
        refundAmount,
        decimals: tokenDecimals
      })

      if (!paymentResult.success || !paymentResult.txSignature) {
        throw new Error(paymentResult.error || 'Payment transaction failed')
      }

      console.log(`[Batch Approval] Payment successful - TX: ${paymentResult.txSignature}`)

      // ==================== UPDATE DATABASE ====================

      console.log('[Batch Approval] Updating database records...')

      // Update each submission
      for (const payment of paymentDetails) {
        const { error: updateError } = await supabaseAdmin
          .from('job_submissions')
          .update({
            social_approval_status: 'approved',
            social_follower_count_verified: payment.impressions || null,
            social_payment_amount_tokens: payment.total_amount,
            social_payment_amount_usd: payment.total_amount,
            social_payment_released: true,
            social_payment_tx_signature: paymentResult.txSignature,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.submission_id)

        if (updateError) {
          console.error(`[Batch Approval] Error updating submission ${payment.submission_id}:`, updateError)
          // Continue with other updates even if one fails
        } else {
          console.log(`[Batch Approval] Updated submission ${payment.submission_id}`)
        }
      }

      // Update job budget
      const newActualBudgetReleased = (job.social_actual_budget_released || 0) + totalRequired
      const newReservedBudget = (job.social_reserved_budget || 0) - totalReserved

      const { error: jobUpdateError } = await supabaseAdmin
        .from('jobs')
        .update({
          social_reserved_budget: Math.max(0, newReservedBudget),
          social_actual_budget_released: newActualBudgetReleased,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      if (jobUpdateError) {
        console.error('[Batch Approval] Error updating job budget:', jobUpdateError)
      } else {
        console.log('[Batch Approval] Updated job budget')
      }

      // ==================== SEND NOTIFICATIONS ====================

      console.log('[Batch Approval] Sending notifications...')

      // Send notification to each worker (don't block on failures)
      const notificationPromises = paymentDetails.map(payment =>
        notifySubmissionApproved(
          payment.worker_wallet,
          jobId,
          job.title || 'Social Media Campaign',
          payment.base_amount,
          payment.bonus_amount,
          payment.total_amount,
          payment.impressions
        ).catch(err => {
          console.error(`[Batch Approval] Notification error for ${payment.worker_wallet}:`, err)
          return null
        })
      )

      await Promise.allSettled(notificationPromises)

      // ==================== SUCCESS RESPONSE ====================

      const duration = Date.now() - startTime
      console.log(`[Batch Approval] Completed successfully in ${duration}ms`)

      return NextResponse.json({
        success: true,
        payments_sent: paymentDetails,
        tx_signature: paymentResult.txSignature,
        total_paid: totalRequired,
        platform_fee: platformFeeAmount,
        workers_paid: paymentDetails.length,
        duration_ms: duration
      })

    } catch (paymentError: any) {
      console.error('[Batch Approval] Payment execution failed:', paymentError)
      return NextResponse.json(
        {
          error: 'payment_failed',
          message: paymentError.message || 'Failed to execute payment transaction',
          details: paymentError.toString()
        },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('[Batch Approval] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'internal_error',
        message: error.message || 'An unexpected error occurred',
        details: error.toString()
      },
      { status: 500 }
    )
  }
}

