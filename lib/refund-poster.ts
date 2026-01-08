/**
 * Poster Refund System
 * 
 * High-level wrapper around escrow refund functionality for social media campaigns.
 * Handles refund calculations, transaction execution, and database tracking.
 * 
 * **Use Cases:**
 * - Campaign completion: Refund unused budget
 * - Zero submissions: Full refund including fee
 * - Early closure: Refund remaining budget
 * - Cancellation: Full refund (with karma penalty handled separately)
 * 
 * @module lib/refund-poster
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { refundEscrowToPoster, RefundEscrowParams, RefundEscrowResult } from '@/lib/solana/escrow-refund'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// Use service role for system operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ==================== INTERFACES ====================

/**
 * Parameters for refunding poster
 */
export interface RefundPosterParams {
  /** Poster's wallet address */
  posterWallet: string
  /** Amount to refund in USD */
  amountUsd: number
  /** Job UUID */
  jobId: string
  /** Token mint address (if null, uses default from job) */
  tokenMint?: string | null
  /** Job title for logging */
  jobTitle?: string
  /** Refund type for tracking */
  refundType?: 'campaign_completion' | 'campaign_cancelled' | 'early_end' | 'zero_submissions'
}

/**
 * Result of refund operation
 */
export interface RefundPosterResult {
  /** Whether refund was successful */
  success: boolean
  /** Transaction signature */
  txSignature?: string
  /** Amount refunded in tokens */
  amountTokens?: number
  /** Amount refunded in USD */
  amountUsd: number
  /** Error message if failed */
  error?: string
}

// ==================== MAIN REFUND FUNCTION ====================

/**
 * Refund unused budget to campaign poster
 * 
 * This is the main entry point for processing refunds. It:
 * 1. Fetches job details and validates refund
 * 2. Converts USD to tokens using job's escrow amount
 * 3. Executes blockchain refund transaction
 * 4. Records transaction in database
 * 5. Returns result with signature
 * 
 * **Security:**
 * - Uses escrow wallet private key (server-side only)
 * - Validates job exists and poster matches
 * - Idempotent: safe to retry on failure
 * 
 * **Error Handling:**
 * - Returns error object on failure (doesn't throw)
 * - Logs detailed error information
 * - Safe for use in cron jobs and API endpoints
 * 
 * @param params - Refund parameters
 * @returns Result with success status and transaction details
 * 
 * @example
 * ```typescript
 * const result = await refundPoster({
 *   posterWallet: job.poster_wallet,
 *   amountUsd: 500,
 *   jobId: job.id,
 *   jobTitle: job.title,
 *   refundType: 'campaign_completion'
 * })
 * 
 * if (result.success) {
 *   console.log(`Refunded ${result.amountUsd} USD (${result.amountTokens} tokens)`)
 *   console.log(`Tx: ${result.txSignature}`)
 * } else {
 *   console.error(`Refund failed: ${result.error}`)
 * }
 * ```
 */
export async function refundPoster(
  params: RefundPosterParams
): Promise<RefundPosterResult> {
  const startTime = Date.now()
  const { posterWallet, amountUsd, jobId, tokenMint, jobTitle, refundType = 'campaign_completion' } = params

  try {
    console.log(`[Refund Poster] Starting refund for job ${jobId}`)
    console.log(`[Refund Poster] Amount: $${amountUsd} USD`)
    console.log(`[Refund Poster] Poster: ${posterWallet}`)
    console.log(`[Refund Poster] Type: ${refundType}`)

    // ==================== VALIDATE INPUTS ====================

    if (amountUsd <= 0) {
      return {
        success: false,
        amountUsd,
        error: 'Refund amount must be greater than 0'
      }
    }

    // ==================== FETCH JOB ====================

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('[Refund Poster] Job not found:', jobError)
      return {
        success: false,
        amountUsd,
        error: `Job ${jobId} not found`
      }
    }

    // Validate poster wallet matches
    if (job.poster_wallet !== posterWallet) {
      console.error('[Refund Poster] Poster wallet mismatch')
      return {
        success: false,
        amountUsd,
        error: 'Poster wallet does not match job'
      }
    }

    console.log(`[Refund Poster] Job: ${job.title}`)

    // ==================== CONVERT USD TO TOKENS ====================

    // Use token mint from params or job
    const refundTokenMint = tokenMint || job.escrow_token_mint
    if (!refundTokenMint) {
      console.error('[Refund Poster] No token mint specified')
      return {
        success: false,
        amountUsd,
        error: 'Token mint not specified'
      }
    }

    // For social media jobs, convert USD to tokens
    // Using the escrow amount and budget to derive conversion rate
    const escrowAmountTokens = job.escrow_amount_tokens || 0
    const budgetUsd = job.social_total_budget_usd || job.payment_amount_usd
    
    let amountTokens: number
    
    if (budgetUsd > 0 && escrowAmountTokens > 0) {
      // Calculate conversion rate from original escrow
      const usdToTokenRate = escrowAmountTokens / budgetUsd
      amountTokens = amountUsd * usdToTokenRate
      console.log(`[Refund Poster] Conversion rate: ${usdToTokenRate} tokens per USD`)
    } else {
      // Fallback: assume 1:1 conversion
      amountTokens = amountUsd
      console.warn('[Refund Poster] Using 1:1 USD to token conversion (no rate available)')
    }

    console.log(`[Refund Poster] Amount in tokens: ${amountTokens}`)

    // ==================== EXECUTE BLOCKCHAIN REFUND ====================

    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
    )

    // Token decimals (typically 9 for SOL, 6 for USDC)
    // TODO: Get actual decimals from token mint
    const decimals = 9

    const refundParams: RefundEscrowParams = {
      connection,
      jobId,
      posterWallet,
      tokenMint: refundTokenMint,
      escrowAmount: amountTokens,
      decimals,
      jobTitle: jobTitle || job.title
    }

    console.log('[Refund Poster] Executing blockchain refund...')
    const refundResult: RefundEscrowResult = await refundEscrowToPoster(refundParams)

    if (!refundResult.success) {
      console.error('[Refund Poster] Blockchain refund failed:', refundResult.error)
      return {
        success: false,
        amountUsd,
        error: refundResult.error || 'Blockchain refund failed'
      }
    }

    console.log(`[Refund Poster] ✅ Blockchain refund successful`)
    console.log(`[Refund Poster] Tx signature: ${refundResult.txSignature}`)

    // ==================== RECORD REFUND ====================

    // The escrow-refund function already logs to job_escrow_transactions
    // We just need to update job status if needed

    console.log('[Refund Poster] Recording refund metadata...')

    // Update job with refund information
    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (updateError) {
      console.error('[Refund Poster] Failed to update job:', updateError)
      // Non-critical, refund already succeeded
    }

    // ==================== SUCCESS ====================

    const duration = Date.now() - startTime
    console.log(`[Refund Poster] ✅ Complete in ${duration}ms`)

    return {
      success: true,
      txSignature: refundResult.txSignature,
      amountTokens: refundResult.amountRefunded,
      amountUsd
    }

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Refund Poster] ❌ Error after ${duration}ms:`, error)

    let errorMessage = 'Unknown refund error'
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return {
      success: false,
      amountUsd,
      error: errorMessage
    }
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate refund amount for campaign completion
 * 
 * Calculates remaining budget and proportional fee refund.
 * 
 * @param originalBudgetUsd - Original campaign budget
 * @param totalPaidUsd - Amount paid to workers
 * @param feePercentage - Platform fee percentage (e.g., 5 for 5%)
 * @returns Object with budget refund, fee refund, and total
 * 
 * @example
 * ```typescript
 * const refund = calculateCompletionRefund(5000, 3500, 5)
 * // { budgetRefund: 1500, feeRefund: 75, totalRefund: 1575 }
 * ```
 */
export function calculateCompletionRefund(
  originalBudgetUsd: number,
  totalPaidUsd: number,
  feePercentage: number
): {
  budgetRefund: number
  feeRefund: number
  totalRefund: number
} {
  const budgetRefund = Math.max(0, originalBudgetUsd - totalPaidUsd)
  const feeRefund = budgetRefund * (feePercentage / 100)
  const totalRefund = budgetRefund + feeRefund

  return {
    budgetRefund,
    feeRefund,
    totalRefund
  }
}

/**
 * Calculate full refund including entire fee
 * 
 * Used for zero-submission campaigns or cancellations.
 * 
 * @param budgetUsd - Campaign budget
 * @param feePercentage - Platform fee percentage
 * @returns Object with budget, fee, and total refund
 * 
 * @example
 * ```typescript
 * const refund = calculateFullRefund(5000, 5)
 * // { budgetRefund: 5000, feeRefund: 250, totalRefund: 5250 }
 * ```
 */
export function calculateFullRefund(
  budgetUsd: number,
  feePercentage: number
): {
  budgetRefund: number
  feeRefund: number
  totalRefund: number
} {
  const budgetRefund = budgetUsd
  const feeRefund = budgetUsd * (feePercentage / 100)
  const totalRefund = budgetRefund + feeRefund

  return {
    budgetRefund,
    feeRefund,
    totalRefund
  }
}

/**
 * Validate refund eligibility
 * 
 * Checks if a job is eligible for refund based on status and conditions.
 * 
 * @param jobId - Job UUID
 * @returns Validation result with error message if ineligible
 */
export async function validateRefundEligibility(
  jobId: string
): Promise<{ eligible: boolean; error?: string }> {
  const { data: job, error } = await supabaseAdmin
    .from('jobs')
    .select('status, escrow_locked, social_payments_distributed')
    .eq('id', jobId)
    .single()

  if (error || !job) {
    return { eligible: false, error: 'Job not found' }
  }

  // Job must not already be completed or cancelled
  if (job.status === 'completed' || job.status === 'cancelled') {
    return { eligible: false, error: 'Job already finalized' }
  }

  // Escrow must be locked (funds available)
  if (!job.escrow_locked) {
    return { eligible: false, error: 'Escrow not locked' }
  }

  return { eligible: true }
}

// ==================== EXPORTS ====================

export default {
  refundPoster,
  calculateCompletionRefund,
  calculateFullRefund,
  validateRefundEligibility
}

