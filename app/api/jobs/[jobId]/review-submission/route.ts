import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Connection, PublicKey } from '@solana/web3.js'
import { notificationService } from '@/lib/services/notificationService'
import { calculateImpressionBonus } from '@/lib/social-jobs'
import { calculateFollowerTier, type FollowerTier } from '@/lib/social-media-jobs-follower-tiers'
import { executeInstantSubmissionPayment } from '@/lib/solana/social-job-payments'
import { getFeeWallet } from '@/lib/platform-settings'
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
 * POST /api/jobs/[jobId]/review-submission
 * 
 * Handles approving or denying individual submissions for social media jobs.
 * 
 * Security:
 * - CRITICAL: Requires Supabase JWT authentication for manual reviews
 * - Supports SERVICE_AUTH_TOKEN for auto-approval cron jobs
 * - Only the authenticated job poster can review submissions
 * 
 * Request body:
 * - submission_id: string (required)
 * - action: 'approve' | 'deny' (required)
 * - denial_reason: string (required if action is 'deny')
 * - auto_approve: boolean (optional - for cron job auto-approval)
 * 
 * Validations:
 * - Job must be a social media job
 * - Payments must not already be distributed
 * - Submission must exist and belong to the job
 * 
 * Side effects:
 * - Updates submission approval status
 * - Creates notification for worker
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    const body = await request.json()
    const { submission_id, action, denial_reason, auto_approve, poster_wallet, impression_count } = body

    // === VALIDATION ===

    if (!submission_id || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: submission_id and action' },
        { status: 400 }
      )
    }

    if (!['approve', 'deny'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "deny"' },
        { status: 400 }
      )
    }

    if (action === 'deny' && !denial_reason) {
      return NextResponse.json(
        { error: 'Denial reason is required when denying submissions' },
        { status: 400 }
      )
    }

    // === AUTHENTICATION ===

    let authenticatedWallet: string

    if (auto_approve) {
      // Service token auth for automated approvals (cron jobs)
      const authHeader = request.headers.get('authorization')
      const serviceToken = process.env.SERVICE_AUTH_TOKEN || 'auto-approve-internal'
      
      if (authHeader !== `Bearer ${serviceToken}`) {
        console.error('[Review Submission] Invalid service token for auto-approve')
        return NextResponse.json(
          { error: 'Unauthorized auto-approve request' },
          { status: 403 }
        )
      }
      
      console.log('[Review Submission] ✅ Service token validated for auto-approve')
      // For auto-approve, we'll verify against job poster after fetching job
      authenticatedWallet = 'SERVICE_AUTO_APPROVE'
    } else {
      // Manual review: Require Supabase JWT authentication
      const authHeader = request.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        console.error('[Review Submission] Missing authorization header')
        return NextResponse.json(
          { error: 'Unauthorized - Authentication required' },
          { status: 401 }
        )
      }

      const token = authHeader.substring(7)
      
      // Verify JWT token
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

      if (authError || !user) {
        console.error('[Review Submission] Invalid auth token:', authError)
        return NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        )
      }

      console.log(`[Review Submission] Authenticated user: ${user.id}`)

      // Use wallet address from request body (provided by frontend)
      if (!poster_wallet) {
        console.error('[Review Submission] Missing poster_wallet in request')
        return NextResponse.json(
          { error: 'Wallet address required' },
          { status: 400 }
        )
      }

      authenticatedWallet = poster_wallet
      console.log(`[Review Submission] User wallet: ${authenticatedWallet}`)

      // Rate limiting for manual reviews
      const rateLimitResult = rateLimit(user.id, 'mutation')
      if (!rateLimitResult.success) {
        return NextResponse.json(
          { error: rateLimitResult.error },
          { status: rateLimitResult.status }
        )
      }
    }

    // === GET JOB DETAILS ===

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('is_social_media_job', true)
      .single()

    if (jobError || !job) {
      console.error('[Review Submission] Job fetch error:', jobError)
      return NextResponse.json(
        { error: 'Social media job not found' },
        { status: 404 }
      )
    }

    // === AUTHORIZATION ===

    // For manual reviews, verify user is the job poster
    if (!auto_approve && authenticatedWallet !== job.poster_wallet) {
      console.error('[Review Submission] Unauthorized - not job poster')
      return NextResponse.json(
        { error: 'Only the job poster can review submissions' },
        { status: 403 }
      )
    }

    console.log('[Review Submission] ✅ Authorization verified')

    // Check if payments already distributed
    if (job.social_payments_distributed) {
      return NextResponse.json(
        { error: 'Payments have already been distributed for this campaign' },
        { status: 400 }
      )
    }

    // === GET SUBMISSION ===

    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('job_submissions')
      .select('*')
      .eq('id', submission_id)
      .eq('job_id', jobId)
      .single()

    if (submissionError || !submission) {
      console.error('[Review Submission] Submission fetch error:', submissionError)
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      )
    }

    // Check if submission is still pending
    if (submission.social_approval_status !== 'pending') {
      return NextResponse.json(
        { error: `Submission has already been ${submission.social_approval_status}` },
        { status: 400 }
      )
    }

    // === UPDATE SUBMISSION ===

    const approvalStatus = auto_approve ? 'auto_approved' : 'approved'

    if (action === 'approve') {
      // Calculate impression bonus if impressions provided
      const impressions = impression_count || 0
      const impressionBonus = impressions > 0 ? calculateImpressionBonus(impressions) : 0

      console.log(`[Review Submission] Impressions: ${impressions}, Bonus: $${impressionBonus}`)

      const { error: updateError } = await supabaseAdmin
        .from('job_submissions')
        .update({
          social_approval_status: approvalStatus,
          social_impression_count: impressions,
          social_impression_bonus_usd: impressionBonus
        })
        .eq('id', submission_id)

      if (updateError) {
        console.error('[Review Submission] Update error:', updateError)
        throw new Error('Failed to approve submission')
      }

      // === INSTANT PAYMENT (if enabled) ===
      
      if (job.uses_instant_payment) {
        console.log('[Review Submission] Job uses instant payment - processing payment...')
        
        try {
          // Get platform fee wallet and percentage
          const platformFeeWallet = await getFeeWallet()
          let platformFeePercentage = job.fee_percentage_at_creation || 0.05
          
          // Safety check: fee should be a decimal between 0 and 1
          if (platformFeePercentage > 1) {
            console.warn(`[Review Submission] ⚠️ Invalid fee percentage: ${platformFeePercentage}. Converting from percentage to decimal.`)
            platformFeePercentage = platformFeePercentage / 100
          }

          if (!platformFeeWallet) {
            throw new Error('Platform fee wallet not configured')
          }

          // Calculate base payment from follower tier
          let basePayment = submission.social_payment_amount_usd || 0
          
          // If job uses follower tiers, recalculate based on actual follower count
          if (job.social_follower_tiers && Array.isArray(job.social_follower_tiers)) {
            const followerTiers = job.social_follower_tiers as FollowerTier[]
            const actualFollowerCount = submission.social_follower_count || 0
            
            if (actualFollowerCount > 0) {
              const tier = calculateFollowerTier(actualFollowerCount, followerTiers)
              if (tier) {
                basePayment = tier.base_payment_usd
                console.log(`[Review Submission] Calculated payment from tier: $${basePayment}`)
              }
            }
          }

          const totalPayment = basePayment + impressionBonus
          console.log(`[Review Submission] Payment: base=$${basePayment}, bonus=$${impressionBonus}, total=$${totalPayment}`)

          if (totalPayment > 0) {
            // Convert USD amounts to tokens using escrow rate
            const escrowTokens = job.escrow_amount_tokens || 0
            const budgetUSD = job.social_total_budget_usd || 0
            
            if (escrowTokens <= 0 || budgetUSD <= 0) {
              throw new Error('Invalid escrow or budget configuration for token conversion')
            }
            
            const usdToTokenRate = escrowTokens / budgetUSD
            const basePaymentInTokens = basePayment * usdToTokenRate
            const impressionBonusInTokens = impressionBonus * usdToTokenRate
            
            console.log(`[Review Submission] Token conversion: rate=${usdToTokenRate}, base=${basePaymentInTokens} tokens, bonus=${impressionBonusInTokens} tokens`)

            // Update submission to pending payment status
            await supabaseAdmin
              .from('job_submissions')
              .update({ social_approval_status: 'approved_pending_payment' })
              .eq('id', submission_id)

            // Execute payment
            const paymentResult = await executeInstantSubmissionPayment(connection, {
              tokenMint: new PublicKey(job.escrow_token_mint || process.env.NEXT_PUBLIC_DEFAULT_TOKEN_MINT!),
              workerWallet: new PublicKey(submission.worker_wallet),
              platformFeeWallet: new PublicKey(platformFeeWallet),
              basePaymentAmount: basePaymentInTokens,
              platformFeePercentage,
              impressionBonusAmount: impressionBonusInTokens,
              jobId: jobId,
              jobTitle: job.title || 'Social Media Campaign'
            })

            if (!paymentResult.success) {
              console.error('[Review Submission] Payment failed:', paymentResult.error)
              
              // Update submission to payment_failed status
              await supabaseAdmin
                .from('job_submissions')
                .update({ 
                  social_approval_status: 'payment_failed',
                  social_payment_error: paymentResult.error
                })
                .eq('id', submission_id)
              
              throw new Error(`Payment failed: ${paymentResult.error}`)
            }

            console.log(`[Review Submission] ✅ Payment successful: ${paymentResult.txSignature}`)

            // Update submission with payment details
            const totalPaymentInTokens = basePaymentInTokens + impressionBonusInTokens
            
            const { error: paymentUpdateError } = await supabaseAdmin
              .from('job_submissions')
              .update({
                social_approval_status: 'approved',
                social_payment_amount_usd: totalPayment,
                social_payment_amount_tokens: totalPaymentInTokens,
                social_base_payment_amount_usd: basePayment,
                social_base_payment_amount_tokens: basePaymentInTokens,
                social_payment_tx_signature: paymentResult.txSignature
              })
              .eq('id', submission_id)

            if (paymentUpdateError) {
              console.error('[Review Submission] ❌ Failed to update submission with payment details:', paymentUpdateError)
              throw new Error(`Failed to update submission: ${paymentUpdateError.message}`)
            }

            console.log('[Review Submission] ✅ Submission updated with payment details')

            // Update job's budget tracking and payment counts
            await supabaseAdmin
              .from('jobs')
              .update({
                social_actual_budget_released: (job.social_actual_budget_released || 0) + totalPayment,
                social_remaining_budget_tokens: (job.social_remaining_budget_tokens || 0) - totalPaymentInTokens,
                social_approved_paid_count: (job.social_approved_paid_count || 0) + 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', jobId)
            
            console.log(`[Review Submission] ✅ Budget updated: -${totalPaymentInTokens.toFixed(2)} tokens, remaining: ${((job.social_remaining_budget_tokens || 0) - totalPaymentInTokens).toFixed(2)} tokens`)
          } else {
            console.log('[Review Submission] No payment needed (amount is $0)')
          }
        } catch (paymentError: any) {
          console.error('[Review Submission] Payment error:', paymentError)
          // Don't fail the whole request - submission is still approved
          // Payment can be retried via retry-payment endpoint
        }
      } else {
        console.log('[Review Submission] Job uses manual payment system - no instant payment')
      }

      // Notify worker (non-blocking)
      try {
        await notificationService.createNotification({
          userWallet: submission.worker_wallet,
          type: 'social_submission_approved',
          actorWallet: job.poster_wallet,
          referenceId: jobId,
          referenceType: 'job',
          metadata: {
            job_title: job.title,
            project_id: job.project_id, // For proper navigation
            submission_id: submission_id,
            action: 'approved',
            is_social_media_job: true,
            auto_approved: auto_approve || false
          }
        })
      } catch (notificationError) {
        console.error('[Review Submission] Notification error (non-critical):', notificationError)
      }

    } else if (action === 'deny') {
      const { error: updateError } = await supabaseAdmin
        .from('job_submissions')
        .update({
          social_approval_status: 'denied',
          social_denial_reason: denial_reason
        })
        .eq('id', submission_id)

      if (updateError) {
        console.error('[Review Submission] Update error:', updateError)
        throw new Error('Failed to deny submission')
      }

      // Notify worker (non-blocking)
      try {
        await notificationService.createNotification({
          userWallet: submission.worker_wallet,
          type: 'dispute_opened', // Reusing existing type for denial
          actorWallet: job.poster_wallet,
          referenceId: jobId,
          referenceType: 'job',
          metadata: {
            job_title: job.title,
            submission_id: submission_id,
            action: 'denied',
            denial_reason: denial_reason,
            is_social_media_job: true,
            can_dispute: true
          }
        })
      } catch (notificationError) {
        console.error('[Review Submission] Notification error (non-critical):', notificationError)
      }
    }

    // === SUCCESS RESPONSE ===

    console.log(`[Review Submission] ✅ Submission ${submission_id} ${action}d successfully`)

    return NextResponse.json({
      success: true,
      action,
      submission_id,
      auto_approved: auto_approve || false
    })

  } catch (error: any) {
    console.error('[Review Submission] API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

