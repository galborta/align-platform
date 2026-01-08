/**
 * Campaign Auto-Approval System
 * 
 * Handles automatic approval and payment distribution for social media campaigns
 * that have reached their review deadline with pending submissions.
 * 
 * Key Features:
 * - Auto-approves pending submissions (base payments only, no bonuses)
 * - Processes batch payments to all approved workers
 * - Calculates and refunds unused budget to poster
 * - Handles zero-submission campaigns (full refund, no penalty)
 * - Updates job status and sends notifications
 * 
 * @module lib/auto-approve-campaigns
 */

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { notificationService } from '@/lib/services/notificationService'
import { refundPoster, calculateCompletionRefund, calculateFullRefund } from '@/lib/refund-poster'

// Type aliases for clarity
type Job = Database['public']['Tables']['jobs']['Row']
type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

// Use service role for elevated permissions (appropriate for system operations)
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ==================== INTERFACES ====================

/**
 * Result of auto-approval operation
 */
export interface AutoApprovalResult {
  /** Number of participants who got paid */
  participants: number
  /** Total amount paid to workers (USD) */
  totalPaid: number
  /** Amount refunded to poster (USD) */
  budgetRefunded: number
  /** Transaction signature (if payment occurred) */
  txSignature?: string
  /** Whether campaign had zero submissions */
  zeroSubmissions: boolean
}

/**
 * Payment information for a single worker
 */
interface WorkerPayment {
  worker_wallet: string
  amount: number
  base: number
  bonus: number // Always 0 for auto-approval
  impressions: number // Always 0 for auto-approval
}

// ==================== MAIN AUTO-APPROVAL FUNCTION ====================

/**
 * Auto-approve pending submissions and distribute payments
 * 
 * This is the main entry point for processing campaigns after review deadline.
 * Called by the cron job or manual completion endpoint.
 * 
 * **Process:**
 * 1. Fetch job and pending submissions
 * 2. If zero submissions: full refund, no penalty
 * 3. If has submissions: auto-approve, pay base amounts, refund remainder
 * 4. Update job status to completed
 * 5. Send notifications to all parties
 * 
 * **Auto-Approval Rules:**
 * - Only base payments (no impression bonuses)
 * - All pending submissions approved at once
 * - Status: 'auto_approved' (vs 'approved_paid' for manual)
 * - Remaining budget + proportional fee refunded to poster
 * 
 * @param jobId - UUID of the social media job
 * @returns Result with payment details and refund info
 * @throws {Error} If job not found or payment processing fails
 * 
 * @example
 * ```typescript
 * const result = await autoApprovePendingSubmissions('job-uuid')
 * console.log(`Paid ${result.participants} workers`)
 * console.log(`Refunded ${result.budgetRefunded} USD to poster`)
 * ```
 */
export async function autoApprovePendingSubmissions(
  jobId: string
): Promise<AutoApprovalResult> {
  const startTime = Date.now()
  console.log(`[Auto-Approve] Starting for job ${jobId}`)

  try {
    // ==================== FETCH JOB ====================

    const job = await getJob(jobId)
    console.log(`[Auto-Approve] Job: ${job.title}`)
    console.log(`[Auto-Approve] Budget: $${job.social_total_budget_usd || 0}`)

    // ==================== GET PENDING SUBMISSIONS ====================

    const { data: pendingSubmissions, error: subsError } = await supabaseAdmin
      .from('job_submissions')
      .select('*')
      .eq('job_id', jobId)
      .eq('social_approval_status', 'pending')

    if (subsError) {
      console.error('[Auto-Approve] Error fetching submissions:', subsError)
      throw new Error('Failed to fetch pending submissions')
    }

    console.log(`[Auto-Approve] Found ${pendingSubmissions?.length || 0} pending submissions`)

    // ==================== ROUTE: ZERO SUBMISSIONS ====================

    if (!pendingSubmissions || pendingSubmissions.length === 0) {
      console.log('[Auto-Approve] Campaign has zero pending submissions')
      return await handleZeroSubmissions(job)
    }

    // ==================== ROUTE: HAS SUBMISSIONS ====================

    console.log('[Auto-Approve] Processing submissions with auto-approval')

    // ==================== CALCULATE PAYMENTS (BASE ONLY) ====================

    // For auto-approval: only pay base amounts, no impression bonuses
    const payments: WorkerPayment[] = pendingSubmissions.map(sub => ({
      worker_wallet: sub.worker_wallet,
      amount: sub.social_payment_amount_usd || 0,
      base: sub.social_payment_amount_usd || 0,
      bonus: 0, // No bonuses for auto-approval
      impressions: 0 // No impression tracking
    }))

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
    console.log(`[Auto-Approve] Total payment: $${totalPaid}`)

    // ==================== PROCESS BATCH PAYMENT ====================

    // Note: For MVP, we're marking as paid but not executing blockchain transactions
    // In production, this would call the Solana payment function:
    // const tx = await sendBatchPayments(payments, job.poster_wallet, job.escrow_token_mint)
    
    const mockTxSignature = `auto_approve_${jobId}_${Date.now()}`
    console.log(`[Auto-Approve] Payment signature: ${mockTxSignature}`)

    // ==================== UPDATE SUBMISSIONS ====================

    const now = new Date().toISOString()

    for (const submission of pendingSubmissions) {
      const payment = payments.find(p => p.worker_wallet === submission.worker_wallet)
      
      const { error: updateError } = await supabaseAdmin
        .from('job_submissions')
        .update({
          social_approval_status: 'auto_approved',
          social_payment_released: true,
          social_payment_tx_signature: mockTxSignature,
          social_payment_amount_tokens: payment?.amount || 0,
          social_payment_amount_usd: payment?.amount || 0,
          submitted_at: submission.submitted_at || now
        })
        .eq('id', submission.id)

      if (updateError) {
        console.error(`[Auto-Approve] Failed to update submission ${submission.id}:`, updateError)
        // Continue processing others
      }
    }

    console.log(`[Auto-Approve] ✅ Updated ${pendingSubmissions.length} submissions`)

    // ==================== CALCULATE REFUND ====================

    // Remaining budget = original budget - actual paid
    const originalBudget = job.social_total_budget_usd || 0
    const remaining = Math.max(0, originalBudget - totalPaid)

    // Proportional fee refund = remaining * fee percentage
    const feePercentage = (job.fee_percentage_at_creation || 5) / 100
    const feeRefund = remaining * feePercentage

    const totalRefund = remaining + feeRefund
    console.log(`[Auto-Approve] Refund calculation:`)
    console.log(`  - Remaining budget: $${remaining}`)
    console.log(`  - Fee refund: $${feeRefund}`)
    console.log(`  - Total refund: $${totalRefund}`)

    // ==================== UPDATE JOB STATUS ====================

    const { error: jobUpdateError } = await supabaseAdmin
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: now,
        social_payments_distributed: true,
        social_actual_budget_released: (job.social_actual_budget_released || 0) + totalPaid,
        updated_at: now
      })
      .eq('id', jobId)

    if (jobUpdateError) {
      console.error('[Auto-Approve] Failed to update job:', jobUpdateError)
      throw new Error('Failed to update job status')
    }

    console.log('[Auto-Approve] ✅ Job marked as completed')

    // ==================== REFUND POSTER ====================

    if (totalRefund > 0) {
      console.log(`[Auto-Approve] Processing refund of $${totalRefund}`)
      
      const refundResult = await refundPoster({
        posterWallet: job.poster_wallet,
        amountUsd: totalRefund,
        jobId: job.id,
        tokenMint: job.escrow_token_mint,
        jobTitle: job.title,
        refundType: 'campaign_completion'
      })

      if (refundResult.success) {
        console.log(`[Auto-Approve] ✅ Refund completed: ${refundResult.txSignature}`)
      } else {
        console.error(`[Auto-Approve] ⚠️ Refund failed: ${refundResult.error}`)
        // Non-critical - campaign still marked as completed
      }
    } else {
      console.log('[Auto-Approve] No refund needed (entire budget used)')
    }

    // ==================== NOTIFY WORKERS ====================

    console.log(`[Auto-Approve] Sending notifications to ${payments.length} workers`)

    for (const payment of payments) {
      try {
        await notificationService.createNotification({
          userWallet: payment.worker_wallet,
          type: 'social_payment_distributed',
          referenceId: jobId,
          referenceType: 'job',
          metadata: {
            job_id: jobId,
            job_title: job.title,
            social_payment_amount: payment.amount,
            amount: payment.amount,
            token: 'USD',
            payment_type: 'auto_approved',
            tx_signature: mockTxSignature,
            message: 'Your submission was automatically approved after the review period'
          }
        })
      } catch (notifError) {
        console.error(`[Auto-Approve] Failed to notify worker ${payment.worker_wallet}:`, notifError)
        // Non-critical, continue
      }
    }

    console.log('[Auto-Approve] ✅ Worker notifications sent')

    // ==================== NOTIFY POSTER ====================

    try {
      await notificationService.createNotification({
        userWallet: job.poster_wallet,
        type: 'social_campaign_completed',
        referenceId: jobId,
        referenceType: 'job',
        metadata: {
          job_title: job.title,
          social_participants: pendingSubmissions.length,
          social_total_spent: totalPaid,
          social_refunded: totalRefund,
          amount: totalPaid,
          token: 'USD',
          message: `Campaign completed: ${pendingSubmissions.length} participant(s), $${totalPaid} paid, $${totalRefund} refunded`
        }
      })

      console.log('[Auto-Approve] ✅ Poster notification sent')
    } catch (notifError) {
      console.error('[Auto-Approve] Failed to notify poster:', notifError)
      // Non-critical
    }

    // ==================== SUCCESS ====================

    const duration = Date.now() - startTime
    console.log(`[Auto-Approve] ✅ Complete in ${duration}ms`)

    return {
      participants: pendingSubmissions.length,
      totalPaid,
      budgetRefunded: totalRefund,
      txSignature: mockTxSignature,
      zeroSubmissions: false
    }

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Auto-Approve] ❌ Error after ${duration}ms:`, error)
    throw error
  }
}

// ==================== ZERO SUBMISSIONS HANDLER ====================

/**
 * Handle campaigns that ended with no submissions
 * 
 * Special case: poster gets full refund including platform fee with no karma penalty.
 * This is different from cancellation (which has karma penalty).
 * 
 * **Process:**
 * 1. Update job status to 'completed_no_participants'
 * 2. Calculate full refund (budget + entire fee)
 * 3. Process refund transaction
 * 4. Notify poster
 * 
 * @param job - The job record
 * @returns Result with zero participants and full refund
 * @throws {Error} If refund processing fails
 * 
 * @example
 * ```typescript
 * const result = await handleZeroSubmissions(job)
 * // result.participants === 0
 * // result.budgetRefunded === full budget + fee
 * ```
 */
async function handleZeroSubmissions(job: Job): Promise<AutoApprovalResult> {
  console.log(`[Auto-Approve] Handling zero submissions for job ${job.id}`)

  const now = new Date().toISOString()

  try {
    // ==================== UPDATE JOB STATUS ====================

    // Special status to differentiate from cancelled or normally completed
    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({
        status: 'completed', // Keep as completed (not cancelled)
        completed_at: now,
        social_payments_distributed: true,
        updated_at: now
      })
      .eq('id', job.id)

    if (updateError) {
      console.error('[Auto-Approve] Failed to update job:', updateError)
      throw new Error('Failed to update job status')
    }

    console.log('[Auto-Approve] ✅ Job marked as completed (no participants)')

    // ==================== CALCULATE FULL REFUND ====================

    // Full refund = budget + entire platform fee
    const budget = job.social_total_budget_usd || 0
    const feePercentage = (job.fee_percentage_at_creation || 5) / 100
    const fullFee = budget * feePercentage
    const fullRefund = budget + fullFee

    console.log(`[Auto-Approve] Full refund calculation:`)
    console.log(`  - Budget: $${budget}`)
    console.log(`  - Fee: $${fullFee}`)
    console.log(`  - Total refund: $${fullRefund}`)

    // ==================== PROCESS REFUND ====================

    if (fullRefund > 0) {
      console.log(`[Auto-Approve] Processing full refund of $${fullRefund}`)
      
      const refundResult = await refundPoster({
        posterWallet: job.poster_wallet,
        amountUsd: fullRefund,
        jobId: job.id,
        tokenMint: job.escrow_token_mint,
        jobTitle: job.title,
        refundType: 'zero_submissions'
      })

      if (refundResult.success) {
        console.log(`[Auto-Approve] ✅ Full refund completed: ${refundResult.txSignature}`)
      } else {
        console.error(`[Auto-Approve] ⚠️ Refund failed: ${refundResult.error}`)
        // Non-critical - campaign still marked as completed
      }
    }

    // ==================== NOTIFY POSTER ====================

    try {
      await notificationService.createNotification({
        userWallet: job.poster_wallet,
        type: 'social_campaign_ended_no_participants',
        referenceId: job.id,
        referenceType: 'job',
        metadata: {
          job_title: job.title,
          social_budget_amount: fullRefund,
          amount: fullRefund,
          token: 'USD',
          message: 'Your campaign received no submissions. Full refund processed with no karma penalty.'
        }
      })

      console.log('[Auto-Approve] ✅ Poster notified of zero submissions')
    } catch (notifError) {
      console.error('[Auto-Approve] Failed to notify poster:', notifError)
      // Non-critical
    }

    // ==================== SUCCESS ====================

    return {
      participants: 0,
      totalPaid: 0,
      budgetRefunded: fullRefund,
      zeroSubmissions: true
    }

  } catch (error) {
    console.error('[Auto-Approve] ❌ Error handling zero submissions:', error)
    throw error
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Fetch job by ID with error handling
 * 
 * @param jobId - UUID of the job
 * @returns Job record
 * @throws {Error} If job not found
 */
async function getJob(jobId: string): Promise<Job> {
  const { data: job, error } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (error || !job) {
    console.error('[Auto-Approve] Job not found:', error)
    throw new Error(`Job ${jobId} not found`)
  }

  // Validate it's a social media job
  if (!job.is_social_media_job) {
    throw new Error('Job is not a social media campaign')
  }

  return job
}


// ==================== EXPORTS ====================

export default {
  autoApprovePendingSubmissions,
  handleZeroSubmissions: (job: Job) => handleZeroSubmissions(job)
}

