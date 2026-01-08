import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Connection, PublicKey } from '@solana/web3.js'
import { Database } from '@/types/database'
import { rateLimit } from '@/lib/rate-limit'
import { calculateFollowerTier, formatTierDisplay, type FollowerTier } from '@/lib/social-media-jobs-follower-tiers'
import { calculateImpressionBonus } from '@/lib/social-jobs'
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

/**
 * Individual submission approval result
 */
interface SubmissionResult {
  submission_id: string
  worker_wallet: string
  status: 'paid' | 'failed'
  amount?: number
  base_payment?: number
  impression_bonus?: number
  follower_tier?: string
  tx_signature?: string
  error?: string
  retry_attempts?: number
}

/**
 * POST /api/jobs/[jobId]/batch-approve
 * 
 * Handles batch approval of multiple social media job submissions with instant payment.
 * 
 * Security:
 * - Requires Supabase JWT authentication
 * - Only the job poster can approve submissions
 * - Implements pessimistic budget locking to prevent double-spend
 * - Validates budget before processing any payments
 * 
 * This endpoint:
 * 1. Authenticates the poster
 * 2. Validates all submissions are pending
 * 3. Calculates payments based on follower tiers + impression bonuses
 * 4. Locks budget pessimistically (prevents concurrent over-commitment)
 * 5. Processes payments sequentially with individual error handling
 * 6. Updates submission and job records atomically
 * 7. Sends notifications to workers
 * 8. Handles partial failures gracefully (some succeed, some fail)
 * 
 * Request body:
 * - submission_ids: string[] (array of submission IDs to approve)
 * - impression_bonuses?: { [submission_id: string]: number } (optional bonuses in USD)
 * 
 * @param request - Request with Authorization header
 * @param params - URL params containing jobId
 * @returns Success response with individual payment results or error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const startTime = Date.now()
  let budgetLocked = false
  let totalLocked = 0

  try {
    // Await params in Next.js 15+
    const { jobId } = await params
    console.log(`\n${'='.repeat(80)}`)
    console.log(`[Batch Approval] Starting for job ${jobId}`)
    console.log(`${'='.repeat(80)}`)

    // ==================== STEP 1: AUTHENTICATION ====================

    console.log('[Batch Approval] Step 1: Authentication...')

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

    console.log(`[Batch Approval] ✓ Authenticated user: ${user.id}`)

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
    console.log(`[Batch Approval] ✓ Poster wallet: ${posterWallet}`)

    // ==================== STEP 2: RATE LIMITING ====================

    console.log('[Batch Approval] Step 2: Rate limiting check...')

    const rateLimitResult = rateLimit(user.id, 'payment')
    if (!rateLimitResult.success) {
      console.error('[Batch Approval] Rate limit exceeded for user:', user.id)
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: rateLimitResult.status }
      )
    }

    console.log('[Batch Approval] ✓ Rate limit check passed')

    // ==================== STEP 3: REQUEST VALIDATION ====================

    console.log('[Batch Approval] Step 3: Validating request body...')

    const body = await request.json()
    const { submission_ids, impression_bonuses = {} } = body

    if (!submission_ids || !Array.isArray(submission_ids) || submission_ids.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid submission_ids array' },
        { status: 400 }
      )
    }

    if (typeof impression_bonuses !== 'object') {
      return NextResponse.json(
        { error: 'Invalid impression_bonuses object' },
        { status: 400 }
      )
    }

    console.log(`[Batch Approval] ✓ Request valid: ${submission_ids.length} submissions to approve`)

    // ==================== STEP 4: FETCH JOB & VALIDATE ====================

    console.log('[Batch Approval] Step 4: Fetching job details...')

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

    console.log(`[Batch Approval] ✓ Job found: ${job.title}`)

    // Verify poster ownership
    if (posterWallet !== job.poster_wallet) {
      console.error('[Batch Approval] Unauthorized - not job poster')
      return NextResponse.json(
        { error: 'Only the job poster can approve submissions' },
        { status: 403 }
      )
    }

    console.log('[Batch Approval] ✓ Authorization verified')

    // Check if job uses instant payment system
    if (!job.uses_instant_payment) {
      return NextResponse.json(
        { error: 'Job does not use instant payment system' },
        { status: 400 }
      )
    }

    console.log('[Batch Approval] ✓ Job uses instant payment system')

    // Check if payments already distributed
    if (job.social_payments_distributed) {
      return NextResponse.json(
        { error: 'Payments have already been distributed for this job' },
        { status: 400 }
      )
    }

    // ==================== STEP 5: FETCH SUBMISSIONS & VALIDATE ====================

    console.log('[Batch Approval] Step 5: Fetching submissions...')

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

    console.log(`[Batch Approval] ✓ Fetched ${submissions.length} submissions`)

    // Check all submissions are pending
    const nonPendingSubmissions = submissions.filter(
      s => s.social_approval_status !== 'pending'
    )

    if (nonPendingSubmissions.length > 0) {
      return NextResponse.json(
        {
          error: 'Some submissions are not in pending status',
          non_pending_ids: nonPendingSubmissions.map(s => s.id),
          non_pending_statuses: nonPendingSubmissions.map(s => ({
            id: s.id,
            status: s.social_approval_status
          }))
        },
        { status: 400 }
      )
    }

    console.log('[Batch Approval] ✓ All submissions are pending')

    // ==================== STEP 6: CALCULATE PAYMENTS ====================

    console.log('[Batch Approval] Step 6: Calculating payments...')

    const followerTiers = job.social_follower_tiers as FollowerTier[]
    const platformFeePercentage = job.fee_percentage_at_creation || 0.05

    interface PaymentPlan {
      submission_id: string
      worker_wallet: string
      follower_count: number
      tier: FollowerTier
      base_payment: number
      impression_count: number
      impression_bonus: number
      total_payment: number
      platform_fee: number
      total_from_escrow: number
    }

    const paymentPlans: PaymentPlan[] = []

    for (const submission of submissions) {
      // Get follower count (prefer verified, fallback to claimed)
      const followerCount = submission.social_follower_count_verified 
        || submission.social_follower_count 
        || 0

      // Find matching follower tier
      const tier = calculateFollowerTier(followerCount, followerTiers)

      if (!tier) {
        console.error(`[Batch Approval] No matching tier for submission ${submission.id} (${followerCount} followers)`)
        return NextResponse.json(
          {
            error: 'no_matching_tier',
            submission_id: submission.id,
            follower_count: followerCount,
            message: 'No tier found for this follower count'
          },
          { status: 400 }
        )
      }

      // Calculate impression bonus (if provided)
      const impressionCount = impression_bonuses[submission.id] || 0
      const impressionBonus = impressionCount > 0 
        ? calculateImpressionBonus(impressionCount)
        : 0

      // Calculate totals
      const basePayment = tier.base_payment_usd
      const totalPayment = basePayment + impressionBonus
      const platformFee = basePayment * platformFeePercentage
      const totalFromEscrow = totalPayment + platformFee

      paymentPlans.push({
        submission_id: submission.id,
        worker_wallet: submission.worker_wallet,
        follower_count,
        tier,
        base_payment: basePayment,
        impression_count: impressionCount,
        impression_bonus: impressionBonus,
        total_payment: totalPayment,
        platform_fee: platformFee,
        total_from_escrow: totalFromEscrow
      })

      console.log(`[Batch Approval] Payment plan for ${submission.worker_wallet.slice(0, 8)}:`)
      console.log(`  - Tier: ${tier.tier_name} (${followerCount} followers)`)
      console.log(`  - Base: $${basePayment}`)
      console.log(`  - Bonus: $${impressionBonus} (${impressionCount} impressions)`)
      console.log(`  - Total: $${totalPayment}`)
      console.log(`  - Fee: $${platformFee.toFixed(2)}`)
      console.log(`  - From escrow: $${totalFromEscrow.toFixed(2)}`)
    }

    const totalNeeded = paymentPlans.reduce((sum, p) => sum + p.total_from_escrow, 0)
    console.log(`[Batch Approval] ✓ Total needed from escrow: $${totalNeeded.toFixed(2)}`)

    // ==================== STEP 7: BUDGET CHECK ====================

    console.log('[Batch Approval] Step 7: Checking budget availability...')

    // Calculate available budget (remaining - locked)
    const remainingBudget = job.social_remaining_budget_tokens || 0
    const lockedBudget = job.social_locked_budget_tokens || 0
    const availableBudget = remainingBudget - lockedBudget

    console.log(`[Batch Approval] Budget status:`)
    console.log(`  - Remaining: $${remainingBudget}`)
    console.log(`  - Locked: $${lockedBudget}`)
    console.log(`  - Available: $${availableBudget}`)
    console.log(`  - Needed: $${totalNeeded.toFixed(2)}`)

    if (totalNeeded > availableBudget) {
      const shortage = totalNeeded - availableBudget
      console.error(`[Batch Approval] ❌ Insufficient budget - shortage: $${shortage.toFixed(2)}`)
      return NextResponse.json(
        {
          error: 'budget_exceeded',
          message: 'Insufficient budget for these approvals',
          shortage: shortage,
          available: availableBudget,
          required: totalNeeded
        },
        { status: 400 }
      )
    }

    console.log('[Batch Approval] ✓ Budget sufficient')

    // ==================== STEP 8: PESSIMISTIC BUDGET LOCKING ====================

    console.log('[Batch Approval] Step 8: Locking budget...')

    const { error: lockError } = await supabaseAdmin
      .from('jobs')
      .update({
        social_locked_budget_tokens: lockedBudget + totalNeeded,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (lockError) {
      console.error('[Batch Approval] ❌ Failed to lock budget:', lockError)
      return NextResponse.json(
        { error: 'Failed to lock budget', details: lockError.message },
        { status: 500 }
      )
    }

    budgetLocked = true
    totalLocked = totalNeeded
    console.log(`[Batch Approval] ✓ Budget locked: $${totalNeeded.toFixed(2)}`)

    // ==================== STEP 9: PROCESS EACH SUBMISSION SEQUENTIALLY ====================

    console.log('[Batch Approval] Step 9: Processing payments sequentially...')

    const results: SubmissionResult[] = []
    const platformFeeWallet = await getFeeWallet()

    if (!platformFeeWallet) {
      throw new Error('Platform fee wallet not configured')
    }

    for (let i = 0; i < paymentPlans.length; i++) {
      const plan = paymentPlans[i]
      console.log(`\n[Batch Approval] Processing ${i + 1}/${paymentPlans.length}: ${plan.worker_wallet.slice(0, 8)}...`)

      try {
        // Step 9a: Update submission to 'approved_pending_payment'
        console.log(`[Batch Approval] → Updating submission status to 'approved_pending_payment'...`)

        const { error: updateError } = await supabaseAdmin
          .from('job_submissions')
          .update({
            social_approval_status: 'approved_pending_payment',
            social_follower_count_verified: plan.follower_count,
            social_base_payment_amount_usd: plan.base_payment,
            social_base_payment_amount_tokens: plan.base_payment, // 1:1 for now
            social_follower_tier_at_payment: formatTierDisplay(plan.tier),
            social_impression_count: plan.impression_count,
            social_impression_bonus_usd: plan.impression_bonus,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', plan.submission_id)

        if (updateError) {
          throw new Error(`Failed to update submission: ${updateError.message}`)
        }

        console.log(`[Batch Approval] ✓ Submission status updated`)

        // Step 9b: Execute payment
        console.log(`[Batch Approval] → Executing payment transaction...`)

        const paymentResult = await executeInstantSubmissionPayment(connection, {
          tokenMint: new PublicKey(job.escrow_token_mint || process.env.NEXT_PUBLIC_DEFAULT_TOKEN_MINT!),
          workerWallet: new PublicKey(plan.worker_wallet),
          platformFeeWallet: new PublicKey(platformFeeWallet),
          basePaymentAmount: plan.base_payment,
          platformFeePercentage,
          impressionBonusAmount: plan.impression_bonus,
          decimals: 9, // Most Solana tokens
          submissionId: plan.submission_id,
          jobId
        })

        if (paymentResult.success && paymentResult.txSignature) {
          // Step 9c: Payment SUCCESS - Update submission and job
          console.log(`[Batch Approval] ✅ Payment successful: ${paymentResult.txSignature}`)

          // Update submission to 'approved' (payment confirmed)
          await supabaseAdmin
            .from('job_submissions')
            .update({
              social_approval_status: 'approved',
              social_payment_released: true,
              social_payment_tx_signature: paymentResult.txSignature,
              social_payment_amount_usd: plan.total_payment,
              social_payment_amount_tokens: plan.total_payment, // 1:1 for now
              updated_at: new Date().toISOString()
            })
            .eq('id', plan.submission_id)

          // Update job: deduct from remaining, unlock, increment paid count
          await supabaseAdmin
            .from('jobs')
            .update({
              social_remaining_budget_tokens: remainingBudget - plan.total_from_escrow,
              social_locked_budget_tokens: lockedBudget + totalNeeded - plan.total_from_escrow,
              social_approved_paid_count: (job.social_approved_paid_count || 0) + 1,
              social_actual_budget_released: (job.social_actual_budget_released || 0) + plan.total_from_escrow,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId)

          // Update locked amount tracking
          totalLocked -= plan.total_from_escrow

          // Send notification to worker (non-blocking)
          notifySubmissionApproved(
            plan.worker_wallet,
            jobId,
            job.title || 'Social Media Campaign',
            plan.base_payment,
            plan.impression_bonus,
            plan.total_payment,
            plan.impression_count
          ).catch(err => {
            console.error(`[Batch Approval] Notification error (non-critical):`, err)
          })

          results.push({
            submission_id: plan.submission_id,
            worker_wallet: plan.worker_wallet,
            status: 'paid',
            amount: plan.total_payment,
            base_payment: plan.base_payment,
            impression_bonus: plan.impression_bonus,
            follower_tier: formatTierDisplay(plan.tier),
            tx_signature: paymentResult.txSignature,
            retry_attempts: paymentResult.retryAttempts || 0
          })

          console.log(`[Batch Approval] ✓ Payment recorded successfully`)

        } else {
          // Step 9d: Payment FAILED - Update submission, unlock budget
          console.error(`[Batch Approval] ❌ Payment failed: ${paymentResult.error}`)

          // Update submission to 'approved_failed'
          await supabaseAdmin
            .from('job_submissions')
            .update({
              social_approval_status: 'approved_failed',
              social_payment_failed_reason: paymentResult.error,
              social_payment_retry_count: paymentResult.retryAttempts || 0,
              updated_at: new Date().toISOString()
            })
            .eq('id', plan.submission_id)

          // Unlock budget for this failed payment
          await supabaseAdmin
            .from('jobs')
            .update({
              social_locked_budget_tokens: lockedBudget + totalNeeded - plan.total_from_escrow,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId)

          // Update locked amount tracking
          totalLocked -= plan.total_from_escrow

          results.push({
            submission_id: plan.submission_id,
            worker_wallet: plan.worker_wallet,
            status: 'failed',
            error: paymentResult.error,
            retry_attempts: paymentResult.retryAttempts || 0
          })

          console.log(`[Batch Approval] ✓ Failure recorded for retry`)
        }

      } catch (error: any) {
        console.error(`[Batch Approval] ❌ Error processing submission ${plan.submission_id}:`, error)

        // Mark as failed and unlock budget
        await supabaseAdmin
          .from('job_submissions')
          .update({
            social_approval_status: 'approved_failed',
            social_payment_failed_reason: error.message || 'Unknown error',
            social_payment_retry_count: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', plan.submission_id)

        await supabaseAdmin
          .from('jobs')
          .update({
            social_locked_budget_tokens: lockedBudget + totalNeeded - plan.total_from_escrow,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId)

        totalLocked -= plan.total_from_escrow

        results.push({
          submission_id: plan.submission_id,
          worker_wallet: plan.worker_wallet,
          status: 'failed',
          error: error.message || 'Unknown error'
        })
      }
    }

    budgetLocked = false // All budget adjustments handled in the loop

    // ==================== STEP 10: RETURN RESULTS ====================

    console.log('\n[Batch Approval] Step 10: Generating summary...')

    const successCount = results.filter(r => r.status === 'paid').length
    const failureCount = results.filter(r => r.status === 'failed').length
    const totalPaid = results
      .filter(r => r.status === 'paid')
      .reduce((sum, r) => sum + (r.amount || 0), 0)

    // Fetch updated job state
    const { data: updatedJob } = await supabaseAdmin
      .from('jobs')
      .select('social_remaining_budget_tokens, social_locked_budget_tokens')
      .eq('id', jobId)
      .single()

    const duration = Date.now() - startTime

    console.log(`\n${'='.repeat(80)}`)
    console.log(`[Batch Approval] ✅ BATCH APPROVAL COMPLETE`)
    console.log(`[Batch Approval] Success: ${successCount}/${paymentPlans.length}`)
    console.log(`[Batch Approval] Failed: ${failureCount}/${paymentPlans.length}`)
    console.log(`[Batch Approval] Total paid: $${totalPaid.toFixed(2)}`)
    console.log(`[Batch Approval] Duration: ${duration}ms`)
    console.log(`${'='.repeat(80)}\n`)

    return NextResponse.json({
      success: true,
      summary: {
        total_submissions: paymentPlans.length,
        successful_payments: successCount,
        failed_payments: failureCount,
        total_paid: totalPaid,
        duration_ms: duration
      },
      results,
      budget: {
        remaining: updatedJob?.social_remaining_budget_tokens || 0,
        locked: updatedJob?.social_locked_budget_tokens || 0,
        available: (updatedJob?.social_remaining_budget_tokens || 0) - (updatedJob?.social_locked_budget_tokens || 0)
      }
    })

  } catch (error: any) {
    console.error('[Batch Approval] Unexpected error:', error)

    // ==================== EMERGENCY ROLLBACK ====================

    if (budgetLocked && totalLocked > 0) {
      console.log('[Batch Approval] Performing emergency rollback...')
      
      try {
        await supabaseAdmin
          .from('jobs')
          .update({
            social_locked_budget_tokens: (job?.social_locked_budget_tokens || 0) - totalLocked,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId)

        console.log('[Batch Approval] ✓ Budget unlocked in rollback')
      } catch (rollbackError) {
        console.error('[Batch Approval] ❌ Rollback failed:', rollbackError)
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

