import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Connection, PublicKey } from '@solana/web3.js'
import { Database } from '@/types/database'
import { rateLimit } from '@/lib/rate-limit'
import { executeInstantSubmissionPayment } from '@/lib/solana/social-job-payments'
import { getFeeWallet } from '@/lib/platform-settings'
import { notificationService } from '@/lib/services/notificationService'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Solana connection
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
const connection = new Connection(SOLANA_RPC, 'confirmed')

// Maximum bonus amount (prevent accidental large payments)
const MAX_BONUS_AMOUNT = 100

/**
 * POST /api/jobs/[jobId]/add-impression-bonus
 * 
 * Add impression bonus to an already-paid submission for exceptional engagement.
 * 
 * Security:
 * - Requires Supabase JWT authentication
 * - Only the job poster can add bonuses
 * - Validates maximum bonus amount to prevent accidents
 * - Bonuses are additive (can be called multiple times)
 * 
 * This endpoint:
 * 1. Authenticates the poster
 * 2. Validates submission is in 'approved' status (already paid base)
 * 3. Validates bonus amount (positive, under max)
 * 4. Checks budget availability
 * 5. Locks budget pessimistically
 * 6. Executes bonus payment transaction
 * 7. Updates cumulative bonus amount in submission
 * 8. Records transaction for audit trail
 * 9. Sends notification to worker
 * 
 * Use case:
 * - Base payment made immediately on approval (follower tier based)
 * - 24 hours later, poster reviews engagement metrics
 * - Poster adds bonus for exceptional performance
 * - Can be called multiple times (bonuses accumulate)
 * 
 * Request body:
 * - submission_id: string (UUID of submission to bonus)
 * - bonus_amount_usd: number (bonus in USD, e.g., 10.50)
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
    console.log(`\n${'='.repeat(80)}`)
    console.log(`[Add Bonus] Starting for job ${jobId}`)
    console.log(`${'='.repeat(80)}`)

    // ==================== STEP 1: AUTHENTICATION ====================

    console.log('[Add Bonus] Step 1: Authentication...')

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Add Bonus] Missing authorization header')
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Verify JWT token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('[Add Bonus] Invalid auth token:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    console.log(`[Add Bonus] ✓ Authenticated user: ${user.id}`)

    // Get user's wallet from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.wallet_address) {
      console.error('[Add Bonus] No wallet found for user:', profileError)
      return NextResponse.json(
        { error: 'No wallet address linked to account' },
        { status: 403 }
      )
    }

    const posterWallet = profile.wallet_address
    console.log(`[Add Bonus] ✓ Poster wallet: ${posterWallet}`)

    // ==================== STEP 2: RATE LIMITING ====================

    console.log('[Add Bonus] Step 2: Rate limiting check...')

    const rateLimitResult = rateLimit(user.id, 'payment')
    if (!rateLimitResult.success) {
      console.error('[Add Bonus] Rate limit exceeded')
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: rateLimitResult.status }
      )
    }

    console.log('[Add Bonus] ✓ Rate limit check passed')

    // ==================== STEP 3: REQUEST VALIDATION ====================

    console.log('[Add Bonus] Step 3: Validating request body...')

    const body = await request.json()
    const { submission_id, bonus_amount_usd } = body

    if (!submission_id || typeof submission_id !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid submission_id' },
        { status: 400 }
      )
    }

    if (typeof bonus_amount_usd !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid bonus_amount_usd' },
        { status: 400 }
      )
    }

    console.log(`[Add Bonus] ✓ Request valid: submission ${submission_id}, bonus $${bonus_amount_usd}`)

    // ==================== STEP 4: VALIDATE BONUS AMOUNT ====================

    console.log('[Add Bonus] Step 4: Validating bonus amount...')

    if (bonus_amount_usd <= 0) {
      return NextResponse.json(
        {
          error: 'Invalid bonus amount',
          message: 'Bonus amount must be positive',
          provided: bonus_amount_usd
        },
        { status: 400 }
      )
    }

    if (bonus_amount_usd > MAX_BONUS_AMOUNT) {
      return NextResponse.json(
        {
          error: 'Bonus exceeds maximum',
          message: `Bonus amount cannot exceed $${MAX_BONUS_AMOUNT} to prevent accidental large payments`,
          provided: bonus_amount_usd,
          maximum: MAX_BONUS_AMOUNT
        },
        { status: 400 }
      )
    }

    console.log(`[Add Bonus] ✓ Bonus amount valid: $${bonus_amount_usd}`)

    // ==================== STEP 5: FETCH JOB & VALIDATE ====================

    console.log('[Add Bonus] Step 5: Fetching job details...')

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('is_social_media_job', true)
      .single()

    if (jobError || !job) {
      console.error('[Add Bonus] Job not found:', jobError)
      return NextResponse.json(
        { error: 'Social media job not found' },
        { status: 404 }
      )
    }

    console.log(`[Add Bonus] ✓ Job found: ${job.title}`)

    // Verify poster ownership
    if (posterWallet !== job.poster_wallet) {
      console.error('[Add Bonus] Unauthorized - not job poster')
      return NextResponse.json(
        { error: 'Only the job poster can add bonuses' },
        { status: 403 }
      )
    }

    console.log('[Add Bonus] ✓ Authorization verified')

    // Check if job uses instant payment system
    if (!job.uses_instant_payment) {
      return NextResponse.json(
        { error: 'Job does not use instant payment system' },
        { status: 400 }
      )
    }

    // ==================== STEP 6: FETCH SUBMISSION & VALIDATE ====================

    console.log('[Add Bonus] Step 6: Fetching submission...')

    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('job_submissions')
      .select('*')
      .eq('id', submission_id)
      .eq('job_id', jobId)
      .single()

    if (submissionError || !submission) {
      console.error('[Add Bonus] Submission not found:', submissionError)
      return NextResponse.json(
        { error: 'Submission not found or does not belong to this job' },
        { status: 404 }
      )
    }

    console.log(`[Add Bonus] ✓ Submission found for worker: ${submission.worker_wallet.slice(0, 8)}`)

    // Verify submission is approved (already paid base amount)
    if (submission.social_approval_status !== 'approved') {
      console.error(`[Add Bonus] Invalid status: ${submission.social_approval_status}`)
      
      let message = 'Can only add bonus to paid submissions'
      if (submission.social_approval_status === 'pending') {
        message = 'Cannot add bonus - submission has not been approved yet'
      } else if (submission.social_approval_status === 'denied') {
        message = 'Cannot add bonus - submission was denied'
      } else if (submission.social_approval_status === 'approved_failed') {
        message = 'Cannot add bonus - base payment failed. Please retry the base payment first'
      } else if (submission.social_approval_status === 'approved_pending_payment') {
        message = 'Cannot add bonus - base payment is still pending confirmation'
      }

      return NextResponse.json(
        {
          error: 'Cannot add bonus to this submission',
          current_status: submission.social_approval_status,
          message
        },
        { status: 400 }
      )
    }

    console.log('[Add Bonus] ✓ Submission is approved and paid')

    // Get current cumulative bonus
    const currentBonus = submission.social_impression_bonus_usd || 0
    const newCumulativeBonus = currentBonus + bonus_amount_usd
    console.log(`[Add Bonus] Current cumulative bonus: $${currentBonus}`)
    console.log(`[Add Bonus] New cumulative bonus will be: $${newCumulativeBonus}`)

    // ==================== STEP 7: CALCULATE PAYMENT ====================

    console.log('[Add Bonus] Step 7: Calculating payment...')

    const platformFeePercentage = job.fee_percentage_at_creation || 0.05
    const platformFee = bonus_amount_usd * platformFeePercentage
    const totalFromEscrow = bonus_amount_usd + platformFee

    console.log(`[Add Bonus] Payment breakdown:`)
    console.log(`  - Bonus: $${bonus_amount_usd}`)
    console.log(`  - Fee: $${platformFee.toFixed(2)} (${(platformFeePercentage * 100).toFixed(1)}%)`)
    console.log(`  - Total from escrow: $${totalFromEscrow.toFixed(2)}`)

    // ==================== STEP 8: BUDGET CHECK ====================

    console.log('[Add Bonus] Step 8: Checking budget availability...')

    const remainingBudget = job.social_remaining_budget_tokens || 0
    const lockedBudget = job.social_locked_budget_tokens || 0
    const availableBudget = remainingBudget - lockedBudget

    console.log(`[Add Bonus] Budget status:`)
    console.log(`  - Remaining: $${remainingBudget}`)
    console.log(`  - Locked: $${lockedBudget}`)
    console.log(`  - Available: $${availableBudget}`)
    console.log(`  - Needed: $${totalFromEscrow.toFixed(2)}`)

    if (totalFromEscrow > availableBudget) {
      const shortage = totalFromEscrow - availableBudget
      console.error(`[Add Bonus] ❌ Insufficient budget - shortage: $${shortage.toFixed(2)}`)
      return NextResponse.json(
        {
          error: 'Insufficient budget for bonus',
          message: 'Not enough budget remaining to add this bonus',
          shortage: shortage,
          available: availableBudget,
          required: totalFromEscrow
        },
        { status: 400 }
      )
    }

    console.log('[Add Bonus] ✓ Budget sufficient')

    // ==================== STEP 9: LOCK BUDGET ====================

    console.log('[Add Bonus] Step 9: Locking budget...')

    const { error: lockError } = await supabaseAdmin
      .from('jobs')
      .update({
        social_locked_budget_tokens: lockedBudget + totalFromEscrow,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (lockError) {
      console.error('[Add Bonus] ❌ Failed to lock budget:', lockError)
      return NextResponse.json(
        { error: 'Failed to lock budget', details: lockError.message },
        { status: 500 }
      )
    }

    budgetLocked = true
    lockedAmount = totalFromEscrow
    console.log(`[Add Bonus] ✓ Budget locked: $${totalFromEscrow.toFixed(2)}`)

    // ==================== STEP 10: EXECUTE BONUS PAYMENT ====================

    console.log('[Add Bonus] Step 10: Executing bonus payment transaction...')

    const platformFeeWallet = await getFeeWallet()

    if (!platformFeeWallet) {
      throw new Error('Platform fee wallet not configured')
    }

    const paymentResult = await executeInstantSubmissionPayment(connection, {
      tokenMint: new PublicKey(job.escrow_token_mint || process.env.NEXT_PUBLIC_DEFAULT_TOKEN_MINT!),
      workerWallet: new PublicKey(submission.worker_wallet),
      platformFeeWallet: new PublicKey(platformFeeWallet),
      basePaymentAmount: 0, // No base payment, only bonus
      platformFeePercentage,
      impressionBonusAmount: bonus_amount_usd,
      decimals: 9, // Most Solana tokens
      submissionId: submission_id,
      jobId
    })

    // ==================== STEP 11: HANDLE PAYMENT RESULT ====================

    if (paymentResult.success && paymentResult.txSignature) {
      // ==================== PAYMENT SUCCESS ====================
      
      console.log(`[Add Bonus] ✅ Bonus payment successful: ${paymentResult.txSignature}`)

      // Update submission with cumulative bonus
      await supabaseAdmin
        .from('job_submissions')
        .update({
          social_impression_bonus_usd: newCumulativeBonus,
          social_payment_amount_usd: (submission.social_payment_amount_usd || 0) + bonus_amount_usd,
          updated_at: new Date().toISOString()
        })
        .eq('id', submission_id)

      // Update job: deduct from remaining, unlock
      await supabaseAdmin
        .from('jobs')
        .update({
          social_remaining_budget_tokens: remainingBudget - totalFromEscrow,
          social_locked_budget_tokens: lockedBudget, // Unlock by not including the locked amount
          social_actual_budget_released: (job.social_actual_budget_released || 0) + totalFromEscrow,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      budgetLocked = false // Successfully unlocked

      // Send notification to worker (non-blocking)
      notificationService.createNotification({
        userWallet: submission.worker_wallet,
        type: 'social_submission_approved', // Reuse approval notification type
        referenceId: jobId,
        referenceType: 'job',
        metadata: {
          job_title: job.title,
          social_bonus_amount: bonus_amount_usd,
          social_cumulative_bonus: newCumulativeBonus,
          social_total_earned: (submission.social_base_payment_amount_usd || 0) + newCumulativeBonus,
          message: `You received a $${bonus_amount_usd} bonus for exceptional engagement!`,
          amount: bonus_amount_usd,
          token: 'USD',
          is_bonus: true
        }
      }).catch(err => {
        console.error('[Add Bonus] Notification error (non-critical):', err)
      })

      const duration = Date.now() - startTime
      const basePayment = submission.social_base_payment_amount_usd || 0
      const newTotalEarned = basePayment + newCumulativeBonus

      console.log(`\n${'='.repeat(80)}`)
      console.log(`[Add Bonus] ✅ BONUS ADDED SUCCESSFULLY`)
      console.log(`[Add Bonus] Transaction: ${paymentResult.txSignature}`)
      console.log(`[Add Bonus] Bonus amount: $${bonus_amount_usd}`)
      console.log(`[Add Bonus] Cumulative bonus: $${newCumulativeBonus}`)
      console.log(`[Add Bonus] Total earned: $${newTotalEarned} (base: $${basePayment} + bonuses: $${newCumulativeBonus})`)
      console.log(`[Add Bonus] Duration: ${duration}ms`)
      console.log(`${'='.repeat(80)}\n`)

      return NextResponse.json({
        success: true,
        payment: {
          submission_id: submission_id,
          worker_wallet: submission.worker_wallet,
          bonus_added: bonus_amount_usd,
          base_payment: basePayment,
          cumulative_bonus: newCumulativeBonus,
          new_total_earned: newTotalEarned
        },
        transaction: {
          signature: paymentResult.txSignature,
          confirmed: true,
          retry_attempts: paymentResult.retryAttempts || 0
        },
        duration_ms: duration
      })

    } else {
      // ==================== PAYMENT FAILED ====================
      
      console.error(`[Add Bonus] ❌ Bonus payment failed: ${paymentResult.error}`)

      // Unlock budget
      await supabaseAdmin
        .from('jobs')
        .update({
          social_locked_budget_tokens: lockedBudget, // Remove the locked amount
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      budgetLocked = false

      const duration = Date.now() - startTime

      console.log(`\n${'='.repeat(80)}`)
      console.log(`[Add Bonus] ❌ BONUS PAYMENT FAILED`)
      console.log(`[Add Bonus] Error: ${paymentResult.error}`)
      console.log(`[Add Bonus] Error code: ${paymentResult.errorCode}`)
      console.log(`[Add Bonus] Duration: ${duration}ms`)
      console.log(`${'='.repeat(80)}\n`)

      // Provide helpful error messages based on error type
      let userMessage = paymentResult.error || 'Bonus payment transaction failed'
      
      if (paymentResult.errorCode === 'RPC_TIMEOUT') {
        userMessage = 'Network timeout. The Solana network may be congested. Please try again in a moment.'
      } else if (paymentResult.errorCode === 'INSUFFICIENT_BALANCE') {
        userMessage = 'Escrow wallet has insufficient balance. Please contact support.'
      } else if (paymentResult.errorCode === 'TRANSACTION_FAILED') {
        userMessage = 'Transaction was rejected by the blockchain. Please try again or contact support.'
      }

      return NextResponse.json(
        {
          error: 'Bonus payment failed',
          message: userMessage,
          error_code: paymentResult.errorCode,
          retry_attempts: paymentResult.retryAttempts || 0,
          suggestion: 'Please try again. If it continues to fail, contact support.'
        },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('[Add Bonus] Unexpected error:', error)

    // ==================== EMERGENCY ROLLBACK ====================

    if (budgetLocked && lockedAmount > 0) {
      console.log('[Add Bonus] Performing emergency rollback...')
      
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
              social_locked_budget_tokens: currentJob.social_locked_budget_tokens - lockedAmount,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId)

          console.log('[Add Bonus] ✓ Budget unlocked in rollback')
        }
      } catch (rollbackError) {
        console.error('[Add Bonus] ❌ Rollback failed:', rollbackError)
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

