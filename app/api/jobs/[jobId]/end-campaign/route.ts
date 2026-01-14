import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Connection, PublicKey } from '@solana/web3.js'
import { Database } from '@/types/database'
import { rateLimit } from '@/lib/rate-limit'
import { executeInstantSubmissionPayment } from '@/lib/solana/social-job-payments'
import { refundEscrowToPoster } from '@/lib/solana/escrow-refund'
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

/**
 * POST /api/jobs/[jobId]/end-campaign
 * 
 * Ends a social media campaign and handles final wrap-up tasks.
 * 
 * Security:
 * - Requires Supabase JWT authentication
 * - Only the job poster can end the campaign
 * - Validates no payments are currently processing
 * 
 * This endpoint replaces the old finalize-payments flow for instant payment jobs.
 * With instant payments, base payments happen throughout the campaign, so this
 * endpoint only handles:
 * 1. Final impression bonuses (optional bulk addition)
 * 2. Refunding unused budget back to poster
 * 3. Marking campaign as completed
 * 
 * Request body:
 * - impression_bonuses?: { [submission_id: string]: number } (optional bulk bonuses in USD)
 * 
 * @param request - Request with Authorization header
 * @param params - URL params containing jobId
 * @returns Success response with campaign summary or error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const startTime = Date.now()
  const transactionSignatures: string[] = []
  const bonusResults: Array<{ submission_id: string; success: boolean; amount?: number; error?: string }> = []

  try {
    // Await params in Next.js 15+
    const { jobId } = await params
    console.log(`\n${'='.repeat(80)}`)
    console.log(`[End Campaign] Starting for job ${jobId}`)
    console.log(`${'='.repeat(80)}`)

    // ==================== STEP 1: AUTHENTICATION ====================

    console.log('[End Campaign] Step 1: Authentication...')

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[End Campaign] Missing authorization header')
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Verify JWT token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('[End Campaign] Invalid auth token:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    console.log(`[End Campaign] ✓ Authenticated user: ${user.id}`)

    // Get request body to extract poster_wallet (following existing pattern)
    const body = await request.json()
    const { impression_bonuses = {} } = body
    
    // Wallet address must be provided by frontend (consistent with other endpoints)
    const posterWallet = body.poster_wallet
    
    if (!posterWallet) {
      console.error('[End Campaign] Missing poster_wallet in request')
      return NextResponse.json(
        { error: 'Missing poster_wallet in request body' },
        { status: 400 }
      )
    }

    console.log(`[End Campaign] ✓ Poster wallet: ${posterWallet}`)

    // ==================== STEP 2: RATE LIMITING ====================

    console.log('[End Campaign] Step 2: Rate limiting check...')

    const rateLimitResult = rateLimit(user.id, 'payment')
    if (!rateLimitResult.success) {
      console.error('[End Campaign] Rate limit exceeded')
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: rateLimitResult.status }
      )
    }

    console.log('[End Campaign] ✓ Rate limit check passed')

    // ==================== STEP 3: REQUEST VALIDATION ====================

    console.log('[End Campaign] Step 3: Validating request body...')

    // Body already parsed above when extracting poster_wallet
    if (typeof impression_bonuses !== 'object') {
      return NextResponse.json(
        { error: 'Invalid impression_bonuses object' },
        { status: 400 }
      )
    }

    const bonusCount = Object.keys(impression_bonuses).length
    console.log(`[End Campaign] ✓ Request valid: ${bonusCount} bonuses to add`)

    // ==================== STEP 4: FETCH JOB & VALIDATE ====================

    console.log('[End Campaign] Step 4: Fetching job details...')

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('is_social_media_job', true)
      .single()

    if (jobError || !job) {
      console.error('[End Campaign] Job not found:', jobError)
      return NextResponse.json(
        { error: 'Social media job not found' },
        { status: 404 }
      )
    }

    console.log(`[End Campaign] ✓ Job found: ${job.title}`)

    // Verify poster ownership
    if (posterWallet !== job.poster_wallet) {
      console.error('[End Campaign] Unauthorized - not job poster')
      return NextResponse.json(
        { error: 'Only the job poster can end the campaign' },
        { status: 403 }
      )
    }

    console.log('[End Campaign] ✓ Authorization verified')

    // Check if job uses instant payment system
    if (!job.uses_instant_payment) {
      return NextResponse.json(
        { 
          error: 'This job uses the old payment system. Please use the finalize-payments endpoint instead.',
          legacy_endpoint: `/api/jobs/${jobId}/finalize-payments`
        },
        { status: 400 }
      )
    }

    // Check if already completed (idempotency)
    if (job.social_payments_distributed || job.status === 'completed') {
      console.log('[End Campaign] Campaign already ended')
      return NextResponse.json(
        {
          success: true,
          message: 'Campaign was already ended',
          already_completed: true
        },
        { status: 200 }
      )
    }

    // ==================== STEP 5: CHECK FOR PROCESSING PAYMENTS ====================

    console.log('[End Campaign] Step 5: Checking for processing payments...')

    const { data: processingSubmissions, error: processingError } = await supabaseAdmin
      .from('job_submissions')
      .select('id, worker_wallet')
      .eq('job_id', jobId)
      .eq('social_approval_status', 'approved_pending_payment')

    if (processingError) {
      console.error('[End Campaign] Error checking processing payments:', processingError)
      throw new Error('Failed to check processing payments')
    }

    if (processingSubmissions && processingSubmissions.length > 0) {
      console.error(`[End Campaign] ${processingSubmissions.length} payments still processing`)
      return NextResponse.json(
        {
          error: 'Cannot end campaign - payments still processing',
          message: `${processingSubmissions.length} payment(s) are currently being processed. Please wait a moment and try again.`,
          processing_count: processingSubmissions.length,
          processing_submissions: processingSubmissions.map(s => s.id)
        },
        { status: 400 }
      )
    }

    console.log('[End Campaign] ✓ No payments currently processing')

    // ==================== STEP 5B: AUTO-APPROVE & PAY PENDING SUBMISSIONS ====================

    console.log('[End Campaign] Step 5b: Auto-approving and paying pending submissions...')

    const { data: pendingSubmissions, error: pendingError } = await supabaseAdmin
      .from('job_submissions')
      .select('*')
      .eq('job_id', jobId)
      .eq('social_approval_status', 'pending')

    if (pendingError) {
      console.error('[End Campaign] Error fetching pending submissions:', pendingError)
    } else if (pendingSubmissions && pendingSubmissions.length > 0) {
      console.log(`[End Campaign] Found ${pendingSubmissions.length} pending submissions to auto-approve`)

      const platformFeeWallet = await getFeeWallet()
      let platformFeePercentage = job.fee_percentage_at_creation || 0.05
      
      // Safety check: fee should be a decimal between 0 and 1
      if (platformFeePercentage > 1) {
        console.warn(`[End Campaign] ⚠️ Invalid fee percentage: ${platformFeePercentage}. Converting from percentage to decimal.`)
        platformFeePercentage = platformFeePercentage / 100
      }

      if (!platformFeeWallet) {
        console.error('[End Campaign] Platform fee wallet not configured - cannot process payments')
      } else {
        // Process each pending submission
        for (const submission of pendingSubmissions) {
          try {
            console.log(`[End Campaign] Processing pending submission ${submission.id}...`)

            // Calculate base payment
            const basePaymentUSD = submission.social_payment_amount_usd || 0
            
            if (basePaymentUSD > 0) {
              // Convert USD to tokens using escrow rate
              const escrowTokens = job.escrow_amount_tokens || 0
              const budgetUSD = job.social_total_budget_usd || 0
              
              if (escrowTokens <= 0 || budgetUSD <= 0) {
                throw new Error('Invalid escrow or budget configuration for token conversion')
              }
              
              const usdToTokenRate = escrowTokens / budgetUSD
              const basePaymentInTokens = basePaymentUSD * usdToTokenRate
              
              console.log(`[End Campaign] Token conversion: ${basePaymentInTokens} tokens ($${basePaymentUSD} USD)`)
              
              // Update to pending payment status
              await supabaseAdmin
                .from('job_submissions')
                .update({ social_approval_status: 'approved_pending_payment' })
                .eq('id', submission.id)

              // Execute payment
              const paymentResult = await executeInstantSubmissionPayment(connection, {
                tokenMint: new PublicKey(job.escrow_token_mint || process.env.NEXT_PUBLIC_DEFAULT_TOKEN_MINT!),
                workerWallet: new PublicKey(submission.worker_wallet),
                platformFeeWallet: new PublicKey(platformFeeWallet),
                basePaymentAmount: basePaymentInTokens,
                platformFeePercentage,
                impressionBonusAmount: 0,
                jobId: jobId,
                jobTitle: job.title || 'Social Media Campaign'
              })

              if (paymentResult.success) {
                console.log(`[End Campaign] ✅ Payment successful: ${paymentResult.txSignature}`)

                // Update submission with payment details
                await supabaseAdmin
                  .from('job_submissions')
                  .update({
                    social_approval_status: 'auto_approved',
                    social_payment_tx_signature: paymentResult.txSignature
                  })
                  .eq('id', submission.id)

                // Send notification
                await notificationService.createNotification({
                  userWallet: submission.worker_wallet,
                  type: 'social_submission_approved',
                  actorWallet: job.poster_wallet,
                  referenceId: jobId,
                  referenceType: 'job',
                  metadata: {
                    job_title: job.title,
                    project_id: job.project_id,
                    submission_id: submission.id,
                    action: 'approved',
                    is_social_media_job: true,
                    auto_approved: true
                  }
                })
              } else {
                console.error(`[End Campaign] Payment failed for ${submission.id}:`, paymentResult.error)
                // Update to payment_failed status
                await supabaseAdmin
                  .from('job_submissions')
                  .update({
                    social_approval_status: 'payment_failed',
                    social_payment_error: paymentResult.error
                  })
                  .eq('id', submission.id)
              }
            } else {
              // No payment needed, just auto-approve
              await supabaseAdmin
                .from('job_submissions')
                .update({
                  social_approval_status: 'auto_approved'
                })
                .eq('id', submission.id)

              // Send notification
              await notificationService.createNotification({
                userWallet: submission.worker_wallet,
                type: 'social_submission_approved',
                actorWallet: job.poster_wallet,
                referenceId: jobId,
                referenceType: 'job',
                metadata: {
                  job_title: job.title,
                  project_id: job.project_id,
                  submission_id: submission.id,
                  action: 'approved',
                  is_social_media_job: true,
                  auto_approved: true
                }
              })
            }
          } catch (error) {
            console.error(`[End Campaign] Error processing pending submission ${submission.id}:`, error)
            // Continue with next submission
          }
        }

        console.log(`[End Campaign] ✅ Finished processing ${pendingSubmissions.length} pending submissions`)
      }
    } else {
      console.log('[End Campaign] No pending submissions to auto-approve')
    }

    // ==================== STEP 6: FETCH APPROVED SUBMISSIONS ====================

    console.log('[End Campaign] Step 6: Fetching approved submissions...')

    const { data: approvedSubmissions, error: approvedError } = await supabaseAdmin
      .from('job_submissions')
      .select('*')
      .eq('job_id', jobId)
      .eq('social_approval_status', 'approved')

    if (approvedError) {
      console.error('[End Campaign] Error fetching approved submissions:', approvedError)
      throw new Error('Failed to fetch approved submissions')
    }

    const approvedCount = approvedSubmissions?.length || 0
    console.log(`[End Campaign] ✓ Found ${approvedCount} paid submissions`)

    // ==================== STEP 7: ADD IMPRESSION BONUSES ====================

    console.log('[End Campaign] Step 7: Adding impression bonuses...')

    if (bonusCount > 0) {
      console.log(`[End Campaign] Processing ${bonusCount} bonuses...`)

      const platformFeeWallet = await getFeeWallet()
      if (!platformFeeWallet) {
        throw new Error('Platform fee wallet not configured')
      }

      let platformFeePercentage = job.fee_percentage_at_creation || 0.05
      
      // Safety check: fee should be a decimal between 0 and 1
      if (platformFeePercentage > 1) {
        console.warn(`[End Campaign - Bonuses] ⚠️ Invalid fee percentage: ${platformFeePercentage}. Converting from percentage to decimal.`)
        platformFeePercentage = platformFeePercentage / 100
      }
      
      const remainingBudget = job.social_remaining_budget_tokens || 0
      const lockedBudget = job.social_locked_budget_tokens || 0
      let availableBudget = remainingBudget - lockedBudget

      for (const [submissionId, bonusAmount] of Object.entries(impression_bonuses)) {
        console.log(`\n[End Campaign] Processing bonus for ${submissionId}: $${bonusAmount}`)

        try {
          // Find submission
          const submission = approvedSubmissions?.find(s => s.id === submissionId)
          if (!submission) {
            console.error(`[End Campaign] Submission ${submissionId} not found or not paid`)
            bonusResults.push({
              submission_id: submissionId,
              success: false,
              error: 'Submission not found or not in approved status'
            })
            continue
          }

          // Validate bonus amount
          if (typeof bonusAmount !== 'number' || bonusAmount <= 0) {
            console.error(`[End Campaign] Invalid bonus amount: ${bonusAmount}`)
            bonusResults.push({
              submission_id: submissionId,
              success: false,
              error: 'Invalid bonus amount'
            })
            continue
          }

          // Convert USD bonus to tokens using escrow rate
          const escrowTokens = job.escrow_amount_tokens || 0
          const budgetUSD = job.social_total_budget_usd || 0
          
          if (escrowTokens <= 0 || budgetUSD <= 0) {
            throw new Error('Invalid escrow or budget configuration for token conversion')
          }
          
          const usdToTokenRate = escrowTokens / budgetUSD
          const bonusAmountInTokens = bonusAmount * usdToTokenRate

          // Calculate total needed
          const platformFee = bonusAmountInTokens * platformFeePercentage
          const totalFromEscrow = bonusAmountInTokens + platformFee

          console.log(`[End Campaign] Bonus conversion: ${bonusAmountInTokens} tokens ($${bonusAmount} USD)`)

          // Check budget
          if (totalFromEscrow > availableBudget) {
            console.error(`[End Campaign] Insufficient budget for bonus (need ${totalFromEscrow} tokens, have ${availableBudget} tokens)`)
            bonusResults.push({
              submission_id: submissionId,
              success: false,
              error: `Insufficient budget (need ${totalFromEscrow.toFixed(2)} tokens, have ${availableBudget.toFixed(2)} tokens)`
            })
            continue
          }

          // Execute bonus payment
          const paymentResult = await executeInstantSubmissionPayment(connection, {
            tokenMint: new PublicKey(job.escrow_token_mint || process.env.NEXT_PUBLIC_DEFAULT_TOKEN_MINT!),
            workerWallet: new PublicKey(submission.worker_wallet),
            platformFeeWallet: new PublicKey(platformFeeWallet),
            basePaymentAmount: 0, // Only bonus
            platformFeePercentage,
            impressionBonusAmount: bonusAmountInTokens,
            decimals: 9,
            submissionId,
            jobId
          })

          if (paymentResult.success && paymentResult.txSignature) {
            console.log(`[End Campaign] ✅ Bonus payment successful: ${paymentResult.txSignature}`)

            // Update submission
            const currentBonus = submission.social_impression_bonus_usd || 0
            await supabaseAdmin
              .from('job_submissions')
              .update({
                social_impression_bonus_usd: currentBonus + bonusAmount,
                social_payment_amount_usd: (submission.social_payment_amount_usd || 0) + bonusAmount,
                updated_at: new Date().toISOString()
              })
              .eq('id', submissionId)

            // Update job budget
            await supabaseAdmin
              .from('jobs')
              .update({
                social_remaining_budget_tokens: remainingBudget - totalFromEscrow,
                social_actual_budget_released: (job.social_actual_budget_released || 0) + totalFromEscrow,
                updated_at: new Date().toISOString()
              })
              .eq('id', jobId)

            // Update available budget for next bonus
            availableBudget -= totalFromEscrow

            transactionSignatures.push(paymentResult.txSignature)
            bonusResults.push({
              submission_id: submissionId,
              success: true,
              amount: bonusAmount
            })

            // Send notification (non-blocking)
            notificationService.createNotification({
              userWallet: submission.worker_wallet,
              type: 'social_submission_approved',
              referenceId: jobId,
              referenceType: 'job',
              metadata: {
                job_title: job.title,
                social_bonus_amount: bonusAmount,
                message: `Campaign ended. You received a final $${bonusAmount} bonus!`,
                amount: bonusAmount,
                token: 'USD',
                is_final_bonus: true
              }
            }).catch(err => console.error('[End Campaign] Notification error:', err))

          } else {
            console.error(`[End Campaign] ❌ Bonus payment failed: ${paymentResult.error}`)
            bonusResults.push({
              submission_id: submissionId,
              success: false,
              error: paymentResult.error || 'Payment failed'
            })
          }

        } catch (error: any) {
          console.error(`[End Campaign] Error processing bonus for ${submissionId}:`, error)
          bonusResults.push({
            submission_id: submissionId,
            success: false,
            error: error.message || 'Unknown error'
          })
        }
      }

      const successfulBonuses = bonusResults.filter(r => r.success).length
      console.log(`[End Campaign] ✓ Bonuses complete: ${successfulBonuses}/${bonusCount} successful`)
    } else {
      console.log('[End Campaign] ✓ No bonuses to add')
    }

    // ==================== STEP 8: CALCULATE AND EXECUTE REFUND ====================

    console.log('[End Campaign] Step 8: Calculating refund...')

    // Refresh job data to get updated budget after bonuses
    const { data: updatedJob } = await supabaseAdmin
      .from('jobs')
      .select('social_remaining_budget_tokens, social_locked_budget_tokens')
      .eq('id', jobId)
      .single()

    const finalRemaining = updatedJob?.social_remaining_budget_tokens || 0
    const finalLocked = updatedJob?.social_locked_budget_tokens || 0
    const refundAmount = finalRemaining - finalLocked

    console.log(`[End Campaign] Refund calculation:`)
    console.log(`  - Remaining: $${finalRemaining}`)
    console.log(`  - Locked: $${finalLocked}`)
    console.log(`  - Refund: $${refundAmount}`)

    // Safety check: locked budget should be 0
    if (finalLocked > 0) {
      console.error('[End Campaign] ❌ Budget is still locked - this should not happen')
      return NextResponse.json(
        {
          error: 'Cannot end campaign - budget is locked',
          message: 'Some budget is still locked for pending operations. Please wait and try again.',
          locked_amount: finalLocked
        },
        { status: 400 }
      )
    }

    let refundTxSignature: string | undefined

    if (refundAmount > 0) {
      console.log(`[End Campaign] Executing refund of $${refundAmount}...`)

      const refundResult = await refundEscrowToPoster({
        connection,
        jobId,
        posterWallet,
        tokenMint: job.escrow_token_mint || process.env.NEXT_PUBLIC_DEFAULT_TOKEN_MINT!,
        escrowAmount: refundAmount,
        decimals: 9,
        jobTitle: job.title || 'Social Media Campaign'
      })

      if (refundResult.success && refundResult.txSignature) {
        console.log(`[End Campaign] ✅ Refund successful: ${refundResult.txSignature}`)
        refundTxSignature = refundResult.txSignature
        transactionSignatures.push(refundResult.txSignature)

        // Update job budget to 0
        await supabaseAdmin
          .from('jobs')
          .update({
            social_remaining_budget_tokens: 0,
            escrow_locked: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId)

      } else {
        console.error(`[End Campaign] ❌ Refund failed: ${refundResult.error}`)
        // Don't fail the campaign end, but log the error
        console.error('[End Campaign] WARNING: Refund failed but continuing with campaign end')
      }
    } else {
      console.log('[End Campaign] ✓ No refund needed (budget fully used)')
    }

    // ==================== STEP 9: UPDATE JOB STATUS ====================

    console.log('[End Campaign] Step 9: Marking campaign as completed...')

    const { error: statusUpdateError } = await supabaseAdmin
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        social_payments_distributed: true,
        social_payments_distributed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (statusUpdateError) {
      console.error('[End Campaign] Failed to update job status:', statusUpdateError)
      throw new Error('Failed to update job status')
    }

    console.log('[End Campaign] ✓ Job marked as completed')

    // ==================== STEP 10: SEND NOTIFICATIONS ====================

    console.log('[End Campaign] Step 10: Sending notifications...')

    const successfulBonuses = bonusResults.filter(r => r.success).length
    const totalBonusAmount = bonusResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.amount || 0), 0)

    // Notify poster (non-blocking)
    notificationService.createNotification({
      userWallet: posterWallet,
      type: 'social_campaign_completed',
      referenceId: jobId,
      referenceType: 'job',
      metadata: {
        job_title: job.title,
        social_participants: approvedCount,
        social_bonuses_added: successfulBonuses,
        social_total_bonuses: totalBonusAmount,
        social_refunded: refundAmount,
        message: `Campaign completed! ${approvedCount} workers paid${successfulBonuses > 0 ? `, ${successfulBonuses} bonuses added` : ''}${refundAmount > 0 ? `, $${refundAmount.toFixed(2)} refunded` : ''}`,
        amount: refundAmount,
        token: 'USD'
      }
    }).catch(err => console.error('[End Campaign] Notification error:', err))

    // ==================== STEP 11: RETURN SUMMARY ====================

    const duration = Date.now() - startTime

    console.log(`\n${'='.repeat(80)}`)
    console.log(`[End Campaign] ✅ CAMPAIGN ENDED SUCCESSFULLY`)
    console.log(`[End Campaign] Paid submissions: ${approvedCount}`)
    console.log(`[End Campaign] Bonuses added: ${successfulBonuses}/${bonusCount}`)
    console.log(`[End Campaign] Total bonus amount: $${totalBonusAmount}`)
    console.log(`[End Campaign] Refund amount: $${refundAmount}`)
    console.log(`[End Campaign] Duration: ${duration}ms`)
    console.log(`${'='.repeat(80)}\n`)

    return NextResponse.json({
      success: true,
      summary: {
        paid_submissions: approvedCount,
        bonuses_requested: bonusCount,
        bonuses_added: successfulBonuses,
        bonuses_failed: bonusCount - successfulBonuses,
        total_bonus_amount: totalBonusAmount,
        refund_amount: refundAmount,
        duration_ms: duration
      },
      bonus_results: bonusResults,
      transactions: {
        signatures: transactionSignatures,
        refund_signature: refundTxSignature,
        total_transactions: transactionSignatures.length
      }
    })

  } catch (error: any) {
    console.error('[End Campaign] Unexpected error:', error)

    return NextResponse.json(
      {
        error: 'internal_error',
        message: error.message || 'An unexpected error occurred',
        details: error.toString(),
        partial_results: bonusResults.length > 0 ? {
          bonuses_attempted: bonusResults.length,
          bonuses_succeeded: bonusResults.filter(r => r.success).length,
          transactions: transactionSignatures
        } : undefined
      },
      { status: 500 }
    )
  }
}

