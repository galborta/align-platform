import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Connection, PublicKey } from '@solana/web3.js'
import { Database } from '@/types/database'
import { rateLimit } from '@/lib/rate-limit'
import { executeInstantSubmissionPayment } from '@/lib/solana/social-job-payments'
import { getFeeWallet } from '@/lib/platform-settings'
import { notifySubmissionApproved } from '@/lib/social-job-notifications'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Solana connection
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
const connection = new Connection(SOLANA_RPC, 'confirmed')

// Maximum retry attempts (auto + manual)
const MAX_TOTAL_RETRIES = 8 // 3 auto-retry + 5 manual retry

/**
 * POST /api/jobs/[jobId]/retry-payment
 * 
 * Manually retry a failed payment for a social media job submission.
 * 
 * Security:
 * - Requires Supabase JWT authentication
 * - Only the job poster can retry payments
 * - Rate limited to prevent abuse (10 retries per hour per job)
 * - Validates maximum retry attempts (8 total)
 * 
 * This endpoint:
 * 1. Authenticates the poster
 * 2. Validates submission is in 'approved_failed' status
 * 3. Checks retry limit hasn't been exceeded
 * 4. Uses stored payment amounts (no recalculation)
 * 5. Locks budget pessimistically
 * 6. Attempts payment with automatic retry logic
 * 7. Updates submission and job records based on result
 * 8. Sends notification to worker if successful
 * 
 * Request body:
 * - submission_id: string (UUID of submission to retry)
 * 
 * @param request - Request with Authorization header
 * @param params - URL params containing jobId
 * @returns Success response with payment result or error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const startTime = Date.now()
  let budgetLocked = false
  let lockedAmount = 0

  try {
    // Await params in Next.js 15+
    const { jobId } = await params
    
    // ==================== PARSE REQUEST BODY ====================
    
    const body = await request.json()
    const { submission_id, poster_wallet } = body

    console.log(`\n${'='.repeat(80)}`)
    console.log(`[Retry Payment] Starting for job ${jobId}`)
    console.log(`[Retry Payment] Submission: ${submission_id}`)
    console.log(`${'='.repeat(80)}`)

    // ==================== STEP 1: AUTHENTICATION ====================

    console.log('[Retry Payment] Step 1: Authentication...')

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Retry Payment] Missing authorization header')
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Verify JWT token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('[Retry Payment] Invalid auth token:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    console.log(`[Retry Payment] ✓ Authenticated user: ${user.id}`)

    // ==================== STEP 2: VALIDATE REQUEST ====================

    if (!submission_id || typeof submission_id !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid submission_id' },
        { status: 400 }
      )
    }

    // Use wallet address from request body (provided by frontend)
    if (!poster_wallet) {
      console.error('[Retry Payment] Missing poster_wallet in request')
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      )
    }

    const posterWallet = poster_wallet
    console.log(`[Retry Payment] ✓ Poster wallet: ${posterWallet}`)

    // ==================== STEP 3: RATE LIMITING ====================

    console.log('[Retry Payment] Step 3: Rate limiting check...')

    // Use custom rate limit key for retry attempts
    const rateLimitKey = `${user.id}-retry-${jobId}`
    const rateLimitResult = rateLimit(rateLimitKey, 'payment')
    if (!rateLimitResult.success) {
      console.error('[Retry Payment] Rate limit exceeded')
      return NextResponse.json(
        { 
          error: 'Too many retry attempts. Please wait a moment before retrying again.',
          retry_after_ms: 60000 // Suggest 1 minute wait
        },
        { status: 429 }
      )
    }

    console.log('[Retry Payment] ✓ Rate limit check passed')

    // ==================== STEP 4: FETCH JOB & VALIDATE ====================

    console.log('[Retry Payment] Step 4: Fetching job details...')

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('is_social_media_job', true)
      .single()

    if (jobError || !job) {
      console.error('[Retry Payment] Job not found:', jobError)
      return NextResponse.json(
        { error: 'Social media job not found' },
        { status: 404 }
      )
    }

    console.log(`[Retry Payment] ✓ Job found: ${job.title}`)

    // Verify poster ownership
    if (posterWallet !== job.poster_wallet) {
      console.error('[Retry Payment] Unauthorized - not job poster')
      return NextResponse.json(
        { error: 'Only the job poster can retry payments' },
        { status: 403 }
      )
    }

    console.log('[Retry Payment] ✓ Authorization verified')

    // Check if job uses instant payment system
    if (!job.uses_instant_payment) {
      return NextResponse.json(
        { error: 'Job does not use instant payment system' },
        { status: 400 }
      )
    }

    // ==================== STEP 5: FETCH SUBMISSION & VALIDATE ====================

    console.log('[Retry Payment] Step 5: Fetching submission...')

    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('job_submissions')
      .select('*')
      .eq('id', submission_id)
      .eq('job_id', jobId)
      .single()

    if (submissionError || !submission) {
      console.error('[Retry Payment] Submission not found:', submissionError)
      return NextResponse.json(
        { error: 'Submission not found or does not belong to this job' },
        { status: 404 }
      )
    }

    console.log(`[Retry Payment] ✓ Submission found for worker: ${submission.worker_wallet.slice(0, 8)}`)
    
    // Debug: Log all payment-related fields
    console.log(`[Retry Payment] Submission payment fields:`, {
      social_payment_amount_usd: submission.social_payment_amount_usd,
      social_payment_amount_tokens: submission.social_payment_amount_tokens,
      social_base_payment_amount_usd: submission.social_base_payment_amount_usd,
      social_base_payment_amount_tokens: submission.social_base_payment_amount_tokens,
      social_follower_count: submission.social_follower_count,
      social_follower_count_verified: submission.social_follower_count_verified
    })

    // Verify submission is in 'approved_failed' or 'approved_pending_payment' status
    const validStatuses = ['approved_failed', 'approved_pending_payment']
    if (!validStatuses.includes(submission.social_approval_status)) {
      console.error(`[Retry Payment] Invalid status: ${submission.social_approval_status}`)
      return NextResponse.json(
        {
          error: 'Cannot retry - submission is not in a retryable state',
          current_status: submission.social_approval_status,
          message: submission.social_approval_status === 'approved' 
            ? 'This submission has already been paid'
            : submission.social_approval_status === 'pending'
            ? 'This submission has not been approved yet'
            : `This submission is in ${submission.social_approval_status} status`
        },
        { status: 400 }
      )
    }

    console.log(`[Retry Payment] ✓ Submission is in retryable state: ${submission.social_approval_status}`)

    // ==================== STEP 6: CHECK RETRY LIMIT ====================

    console.log('[Retry Payment] Step 6: Checking retry limit...')

    const currentRetryCount = submission.social_payment_retry_count || 0
    console.log(`[Retry Payment] Current retry count: ${currentRetryCount}/${MAX_TOTAL_RETRIES}`)

    if (currentRetryCount >= MAX_TOTAL_RETRIES) {
      console.error('[Retry Payment] Maximum retry attempts reached')
      return NextResponse.json(
        {
          error: 'Maximum retry attempts reached',
          message: `This payment has been attempted ${currentRetryCount} times and continues to fail. Please contact support for assistance.`,
          retry_count: currentRetryCount,
          max_retries: MAX_TOTAL_RETRIES
        },
        { status: 400 }
      )
    }

    console.log('[Retry Payment] ✓ Retry limit not exceeded')

    // ==================== STEP 7: CALCULATE PAYMENT ====================

    console.log('[Retry Payment] Step 7: Calculating payment...')

    // Convert escrow rate for USD to token conversion
    const escrowTokens = job.escrow_amount_tokens || 0
    const budgetUSD = job.social_total_budget_usd || 0
    
    if (escrowTokens <= 0 || budgetUSD <= 0) {
      throw new Error('Invalid escrow or budget configuration for token conversion')
    }
    
    const usdToTokenRate = escrowTokens / budgetUSD
    console.log(`[Retry Payment] USD to Token rate: ${usdToTokenRate}`)

    // Try to use stored payment amounts first (check both fields)
    let basePaymentUSD = submission.social_base_payment_amount_usd || submission.social_payment_amount_usd || 0
    console.log(`[Retry Payment] Stored base payment (from social_base_payment_amount_usd): $${submission.social_base_payment_amount_usd}`)
    console.log(`[Retry Payment] Stored payment (from social_payment_amount_usd): $${submission.social_payment_amount_usd}`)
    console.log(`[Retry Payment] Using base payment: $${basePaymentUSD}`)
    console.log(`[Retry Payment] Has follower tiers: ${job.social_follower_tiers ? 'YES' : 'NO'}`)
    console.log(`[Retry Payment] Submission follower count: ${submission.social_follower_count}`)
    console.log(`[Retry Payment] Submission follower count verified: ${submission.social_follower_count_verified}`)
    
    // If not stored, calculate from follower tier (for old submissions before the fix)
    if (basePaymentUSD <= 0) {
      console.log('[Retry Payment] No stored payment amount, attempting to calculate from follower tier...')
      
      if (job.social_follower_tiers && Array.isArray(job.social_follower_tiers)) {
        console.log(`[Retry Payment] Found ${job.social_follower_tiers.length} follower tiers`)
        
        const { calculateFollowerTier } = await import('@/lib/social-media-jobs-follower-tiers')
        const followerTiers = job.social_follower_tiers as any[]
        const actualFollowerCount = submission.social_follower_count || 0
        
        console.log(`[Retry Payment] Calculating tier for ${actualFollowerCount} followers...`)
        
        if (actualFollowerCount > 0) {
          const tier = calculateFollowerTier(actualFollowerCount, followerTiers)
          if (tier) {
            basePaymentUSD = tier.base_payment_usd
            console.log(`[Retry Payment] ✓ Calculated payment from tier "${tier.tier_name}": $${basePaymentUSD} for ${actualFollowerCount} followers`)
          } else {
            console.error('[Retry Payment] No matching follower tier found')
            throw new Error('No matching follower tier found for this submission')
          }
        } else {
          console.error('[Retry Payment] Submission has 0 or null follower count')
          throw new Error('Submission has no follower count - cannot calculate payment')
        }
      } else {
        console.error('[Retry Payment] Job has no follower tiers configured')
        throw new Error('Job does not have follower tiers configured')
      }
    }
    
    // Convert USD to tokens
    const basePayment = basePaymentUSD * usdToTokenRate
    
    // Calculate impression bonus
    const impressionBonusUSD = submission.social_impression_bonus_usd || 0
    const impressionBonus = impressionBonusUSD * usdToTokenRate
    
    const totalPayment = basePayment + impressionBonus
    let platformFeePercentage = job.fee_percentage_at_creation || 0.05
    
    // Safety check: fee should be a decimal between 0 and 1
    if (platformFeePercentage > 1) {
      console.warn(`[Retry Payment] ⚠️ Invalid fee percentage: ${platformFeePercentage}. Converting from percentage to decimal.`)
      platformFeePercentage = platformFeePercentage / 100
    }
    
    const platformFee = basePayment * platformFeePercentage
    const totalFromEscrow = totalPayment + platformFee

    console.log(`[Retry Payment] Payment breakdown:`)
    console.log(`  - Base: ${basePayment.toFixed(2)} tokens ($${basePaymentUSD})`)
    console.log(`  - Bonus: ${impressionBonus.toFixed(2)} tokens ($${impressionBonusUSD})`)
    console.log(`  - Total: ${totalPayment.toFixed(2)} tokens`)
    console.log(`  - Fee: ${platformFee.toFixed(2)} tokens`)
    console.log(`  - From escrow: ${totalFromEscrow.toFixed(2)} tokens`)

    if (totalPayment <= 0) {
      console.error('[Retry Payment] Invalid payment amount - cannot pay $0')
      return NextResponse.json(
        { error: 'Invalid payment amount calculated' },
        { status: 500 }
      )
    }

    console.log('[Retry Payment] ✓ Payment amounts validated')

    // ==================== STEP 8: BUDGET CHECK ====================

    console.log('[Retry Payment] Step 8: Checking budget availability...')

    const remainingBudget = job.social_remaining_budget_tokens || 0
    const lockedBudget = job.social_locked_budget_tokens || 0
    const availableBudget = remainingBudget - lockedBudget

    console.log(`[Retry Payment] Budget status:`)
    console.log(`  - Remaining: $${remainingBudget}`)
    console.log(`  - Locked: $${lockedBudget}`)
    console.log(`  - Available: $${availableBudget}`)
    console.log(`  - Needed: $${totalFromEscrow.toFixed(2)}`)

    if (totalFromEscrow > availableBudget) {
      const shortage = totalFromEscrow - availableBudget
      console.error(`[Retry Payment] ❌ Insufficient budget - shortage: $${shortage.toFixed(2)}`)
      return NextResponse.json(
        {
          error: 'Insufficient budget for retry',
          message: 'Not enough budget remaining to retry this payment',
          shortage: shortage,
          available: availableBudget,
          required: totalFromEscrow
        },
        { status: 400 }
      )
    }

    console.log('[Retry Payment] ✓ Budget sufficient')

    // ==================== STEP 9: LOCK BUDGET ====================

    console.log('[Retry Payment] Step 9: Locking budget...')

    const { error: lockError } = await supabaseAdmin
      .from('jobs')
      .update({
        social_locked_budget_tokens: lockedBudget + totalFromEscrow
      })
      .eq('id', jobId)

    if (lockError) {
      console.error('[Retry Payment] ❌ Failed to lock budget:', lockError)
      return NextResponse.json(
        { error: 'Failed to lock budget', details: lockError.message },
        { status: 500 }
      )
    }

    budgetLocked = true
    lockedAmount = totalFromEscrow
    console.log(`[Retry Payment] ✓ Budget locked: $${totalFromEscrow.toFixed(2)}`)

    // ==================== STEP 10: UPDATE SUBMISSION TO PENDING ====================

    console.log('[Retry Payment] Step 10: Updating submission to pending payment...')

    const { error: updateError } = await supabaseAdmin
      .from('job_submissions')
      .update({
        social_approval_status: 'approved_pending_payment'
      })
      .eq('id', submission_id)

    if (updateError) {
      console.error('[Retry Payment] Failed to update submission:', updateError)
      
      // Rollback: unlock budget
      await supabaseAdmin
        .from('jobs')
        .update({
          social_locked_budget_tokens: lockedBudget
        })
        .eq('id', jobId)

      return NextResponse.json(
        { error: 'Failed to update submission status', details: updateError.message },
        { status: 500 }
      )
    }

    console.log('[Retry Payment] ✓ Submission status updated')

    // ==================== STEP 11: ATTEMPT PAYMENT ====================

    console.log('[Retry Payment] Step 11: Attempting payment transaction...')

    const platformFeeWallet = await getFeeWallet()

    if (!platformFeeWallet) {
      throw new Error('Platform fee wallet not configured')
    }

    const paymentResult = await executeInstantSubmissionPayment(connection, {
      tokenMint: new PublicKey(job.escrow_token_mint || process.env.NEXT_PUBLIC_DEFAULT_TOKEN_MINT!),
      workerWallet: new PublicKey(submission.worker_wallet),
      platformFeeWallet: new PublicKey(platformFeeWallet),
      basePaymentAmount: basePayment,
      platformFeePercentage,
      impressionBonusAmount: impressionBonus,
      decimals: 9, // Most Solana tokens
      submissionId: submission_id,
      jobId
    })

    // ==================== STEP 12: HANDLE PAYMENT RESULT ====================

    if (paymentResult.success && paymentResult.txSignature) {
      // ==================== PAYMENT SUCCESS ====================
      
      console.log(`[Retry Payment] ✅ Payment successful: ${paymentResult.txSignature}`)

      // Update submission to 'approved' (payment confirmed)
      const totalPaymentUSD = (submission.social_base_payment_amount_usd || 0) + impressionBonusUSD
      
      await supabaseAdmin
        .from('job_submissions')
        .update({
        social_approval_status: 'approved',
        social_payment_released: true,
        social_payment_tx_signature: paymentResult.txSignature,
        social_payment_amount_usd: totalPaymentUSD,
        social_payment_amount_tokens: totalPayment,
        social_payment_retry_count: currentRetryCount + (paymentResult.retryAttempts || 0),
        social_payment_failed_reason: null // Clear error message
        })
        .eq('id', submission_id)

      // Update job: deduct from remaining, unlock, increment paid count
      await supabaseAdmin
        .from('jobs')
        .update({
        social_remaining_budget_tokens: remainingBudget - totalFromEscrow,
        social_locked_budget_tokens: lockedBudget, // Unlock by not including the locked amount
        social_approved_paid_count: (job.social_approved_paid_count || 0) + 1,
        social_actual_budget_released: (job.social_actual_budget_released || 0) + totalFromEscrow
        })
        .eq('id', jobId)

      budgetLocked = false // Successfully unlocked

      // Send notification to worker (non-blocking)
      notifySubmissionApproved(
        submission.worker_wallet,
        jobId,
        job.title || 'Social Media Campaign',
        basePayment,
        impressionBonus,
        totalPayment,
        submission.social_impression_count || 0
      ).catch(err => {
        console.error('[Retry Payment] Notification error (non-critical):', err)
      })

      const duration = Date.now() - startTime

      console.log(`\n${'='.repeat(80)}`)
      console.log(`[Retry Payment] ✅ RETRY SUCCESSFUL`)
      console.log(`[Retry Payment] Transaction: ${paymentResult.txSignature}`)
      console.log(`[Retry Payment] Amount: $${totalPayment}`)
      console.log(`[Retry Payment] Duration: ${duration}ms`)
      console.log(`[Retry Payment] Total retry attempts: ${currentRetryCount + (paymentResult.retryAttempts || 0)}`)
      console.log(`${'='.repeat(80)}\n`)

      return NextResponse.json({
        success: true,
        status: 'paid',
        payment: {
          submission_id: submission_id,
          worker_wallet: submission.worker_wallet,
          base_payment: basePayment,
          impression_bonus: impressionBonus,
          total_amount: totalPayment,
          follower_tier: submission.social_follower_tier_at_payment
        },
        transaction: {
          signature: paymentResult.txSignature,
          confirmed: true,
          retry_attempts: paymentResult.retryAttempts || 0,
          total_attempts: currentRetryCount + (paymentResult.retryAttempts || 0)
        },
        duration_ms: duration
      })

    } else {
      // ==================== PAYMENT FAILED ====================
      
      console.error(`[Retry Payment] ❌ Payment failed: ${paymentResult.error}`)

      const newRetryCount = currentRetryCount + (paymentResult.retryAttempts || 1)
      const retriesRemaining = MAX_TOTAL_RETRIES - newRetryCount

      // Update submission back to 'approved_failed'
      await supabaseAdmin
        .from('job_submissions')
        .update({
          social_approval_status: 'approved_failed',
          social_payment_failed_reason: paymentResult.error,
          social_payment_retry_count: newRetryCount
        })
        .eq('id', submission_id)

      // Unlock budget
      await supabaseAdmin
        .from('jobs')
        .update({
          social_locked_budget_tokens: lockedBudget // Remove the locked amount
        })
        .eq('id', jobId)

      budgetLocked = false

      const duration = Date.now() - startTime

      console.log(`\n${'='.repeat(80)}`)
      console.log(`[Retry Payment] ❌ RETRY FAILED`)
      console.log(`[Retry Payment] Error: ${paymentResult.error}`)
      console.log(`[Retry Payment] Error code: ${paymentResult.errorCode}`)
      console.log(`[Retry Payment] Duration: ${duration}ms`)
      console.log(`[Retry Payment] Total retry attempts: ${newRetryCount}`)
      console.log(`[Retry Payment] Retries remaining: ${retriesRemaining}`)
      console.log(`${'='.repeat(80)}\n`)

      // Provide helpful error messages based on error type
      let userMessage = paymentResult.error || 'Payment transaction failed'
      
      if (paymentResult.errorCode === 'RPC_TIMEOUT') {
        userMessage = 'Network timeout. The Solana network may be congested. Please try again in a moment.'
      } else if (paymentResult.errorCode === 'INSUFFICIENT_BALANCE') {
        userMessage = 'Escrow wallet has insufficient balance. Please contact support.'
      } else if (paymentResult.errorCode === 'TRANSACTION_FAILED') {
        userMessage = 'Transaction was rejected by the blockchain. Please try again or contact support.'
      }

      return NextResponse.json({
        success: false,
        status: 'still_failed',
        error: userMessage,
        error_code: paymentResult.errorCode,
        retry_info: {
          retry_count: newRetryCount,
          max_retries: MAX_TOTAL_RETRIES,
          retries_remaining: retriesRemaining,
          can_retry_again: retriesRemaining > 0,
          suggestion: retriesRemaining > 0 
            ? 'You can try again. If it continues to fail, please contact support.'
            : 'Maximum retry attempts reached. Please contact support for assistance.'
        },
        duration_ms: duration
      }, { status: 200 }) // Return 200 even on payment failure (request succeeded)
    }

  } catch (error: any) {
    console.error('[Retry Payment] Unexpected error:', error)

    // ==================== EMERGENCY ROLLBACK ====================

    if (budgetLocked && lockedAmount > 0) {
      console.log('[Retry Payment] Performing emergency rollback...')
      
      try {
        const { data: currentJob } = await supabaseAdmin
          .from('jobs')
          .select('social_locked_budget_tokens')
          .eq('id', jobId)
          .single()

        if (currentJob) {
          await supabaseAdmin
            .from('jobs')
            .update({
              social_locked_budget_tokens: currentJob.social_locked_budget_tokens - lockedAmount
            })
            .eq('id', jobId)

          console.log('[Retry Payment] ✓ Budget unlocked in rollback')
        }
      } catch (rollbackError) {
        console.error('[Retry Payment] ❌ Rollback failed:', rollbackError)
      }
    }

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

