/**
 * Social Media Jobs Business Logic
 * 
 * Core functions for social media engagement jobs including:
 * - Timeline auto-calculation (48+24+48 hour periods)
 * - Tier validation (ensure tiers are continuous, no gaps)
 * - Active tier calculation (which tier applies based on participant count)
 * - Proportional payment calculation (distribute budget by follower weight)
 * 
 * @module lib/social-media-jobs
 */

import { addHours } from 'date-fns'
import { BudgetTier } from '@/types/social-media-jobs'

// ==================== TIMELINE TYPES ====================

/**
 * Timeline structure for social media jobs
 * Contains all three phase deadlines
 */
export interface SocialJobTimeline {
  /** End of Phase 1: Workers must submit tweets before this time */
  submission_deadline: Date
  /** End of Phase 2: Engagement metrics stabilize by this time */
  engagement_deadline: Date
  /** End of Phase 3: Poster must complete review by this time (auto-approve after) */
  review_deadline: Date
}

// ==================== TIMELINE CONSTANTS ====================

/**
 * Duration of each phase in hours
 * Total job duration: 120 hours (5 days)
 */
export const SOCIAL_JOB_PHASE_HOURS = {
  /** Phase 1: Submission window - workers submit their tweets */
  SUBMISSION: 48,
  /** Phase 2: Engagement window - metrics accumulate and stabilize */
  ENGAGEMENT: 24,
  /** Phase 3: Review window - poster approves/denies submissions */
  REVIEW: 48,
} as const

// ==================== TIMELINE CALCULATION ====================

/**
 * Calculates the three-phase timeline for social media jobs
 * 
 * Timeline Structure:
 * ```
 * |-- Phase 1 (48hrs) --|-- Phase 2 (24hrs) --|-- Phase 3 (48hrs) --|
 * |    Submission       |    Engagement       |      Review         |
 * 0                    48                    72                   120 hours
 * ```
 * 
 * **Phase 1 - Submission Window (0-48 hours)**
 * Workers can submit their tweet links and follower counts.
 * After this deadline, no new submissions are accepted.
 * 
 * **Phase 2 - Engagement Window (48-72 hours)**
 * Tweet engagement metrics (likes, retweets, replies) accumulate.
 * This buffer ensures fair measurement - early and late submissions
 * have time for engagement to stabilize.
 * 
 * **Phase 3 - Review Window (72-120 hours)**
 * Poster reviews submissions and approves or denies each one.
 * If poster doesn't act by review_deadline, remaining pending
 * submissions are auto-approved.
 * 
 * @param creationTime - The timestamp when the job was created
 * @returns Object containing all three deadline timestamps
 * 
 * @example
 * ```typescript
 * // Job created on Dec 4th at 10:00 AM UTC
 * const timeline = calculateSocialJobTimeline(new Date('2024-12-04T10:00:00Z'))
 * 
 * // Results:
 * // submission_deadline: Dec 6th 10:00 AM UTC  (48 hours later)
 * // engagement_deadline: Dec 7th 10:00 AM UTC  (72 hours later)
 * // review_deadline:     Dec 9th 10:00 AM UTC  (120 hours later)
 * ```
 * 
 * @example
 * ```typescript
 * // Use with job creation API
 * const now = new Date()
 * const timeline = calculateSocialJobTimeline(now)
 * 
 * await supabase.from('jobs').insert({
 *   ...jobData,
 *   social_submission_deadline: timeline.submission_deadline.toISOString(),
 *   social_engagement_deadline: timeline.engagement_deadline.toISOString(),
 *   social_review_deadline: timeline.review_deadline.toISOString(),
 * })
 * ```
 */
export function calculateSocialJobTimeline(creationTime: Date): SocialJobTimeline {
  const { SUBMISSION, ENGAGEMENT, REVIEW } = SOCIAL_JOB_PHASE_HOURS
  
  // Phase 1 ends after SUBMISSION hours
  const submission_deadline = addHours(creationTime, SUBMISSION)
  
  // Phase 2 ends ENGAGEMENT hours after Phase 1
  const engagement_deadline = addHours(creationTime, SUBMISSION + ENGAGEMENT)
  
  // Phase 3 ends REVIEW hours after Phase 2
  const review_deadline = addHours(creationTime, SUBMISSION + ENGAGEMENT + REVIEW)
  
  return {
    submission_deadline,
    engagement_deadline,
    review_deadline,
  }
}

// ==================== TIER VALIDATION ====================

/**
 * Validates that budget tiers follow all required rules for social media jobs
 * 
 * Budget tiers define how much budget is released based on participant count.
 * They must form a continuous range with no gaps, ensuring every possible
 * participant count maps to exactly one tier.
 * 
 * **Validation Rules:**
 * 
 * 1. **At least one tier required** - Cannot create a job with no budget tiers
 * 
 * 2. **First tier must start at 1** - Minimum participant count is 1
 * 
 * 3. **Tiers must be continuous** - No gaps between tiers
 *    - If tier 1 ends at 5, tier 2 must start at 6
 *    - Example: `[1-5, 6-10, 11-15, 16+]` ✓
 *    - Example: `[1-5, 7-10, ...]` ✗ (gap at 6)
 * 
 * 4. **Only last tier can be open-ended** - Final tier has `max_participants = null`
 *    - This represents "16+" or "unlimited" style tiers
 *    - Middle tiers must have explicit max values
 * 
 * 5. **Budget limits** - Each tier's budget must not exceed maxBudget
 * 
 * 6. **Ascending order warning** - Budgets typically increase with participation
 *    - Not enforced, but logs a warning if budgets decrease
 * 
 * @param tiers - Array of budget tier configurations
 * @param maxBudget - Maximum total budget for the campaign (in tokens)
 * @throws {Error} If validation fails with descriptive message explaining the issue
 * 
 * @example
 * ```typescript
 * // Valid tier configuration
 * const validTiers: BudgetTier[] = [
 *   { min_participants: 1,  max_participants: 5,    budget_tokens: 100, budget_usd: 50 },
 *   { min_participants: 6,  max_participants: 10,   budget_tokens: 200, budget_usd: 100 },
 *   { min_participants: 11, max_participants: 15,   budget_tokens: 300, budget_usd: 150 },
 *   { min_participants: 16, max_participants: null, budget_tokens: 400, budget_usd: 200 },
 * ]
 * 
 * validateBudgetTiers(validTiers, 500) // ✓ Passes
 * ```
 * 
 * @example
 * ```typescript
 * // Invalid: Gap between tier 1 (ends at 5) and tier 2 (starts at 7)
 * const invalidTiers: BudgetTier[] = [
 *   { min_participants: 1, max_participants: 5,    budget_tokens: 100, budget_usd: 50 },
 *   { min_participants: 7, max_participants: null, budget_tokens: 200, budget_usd: 100 },
 * ]
 * 
 * validateBudgetTiers(invalidTiers, 500)
 * // Throws: "Tiers must be continuous: Tier ending at 5 must be followed by
 * //         tier starting at 6, but next tier starts at 7"
 * ```
 */
export function validateBudgetTiers(
  tiers: BudgetTier[],
  maxBudget: number
): void {
  // Rule 1: At least one tier required
  if (tiers.length === 0) {
    throw new Error('At least one budget tier is required')
  }

  // Sort tiers by min_participants for validation
  const sortedTiers = [...tiers].sort(
    (a, b) => a.min_participants - b.min_participants
  )

  // Rule 2: First tier must start at 1
  const firstTier = sortedTiers[0]
  if (firstTier.min_participants !== 1) {
    throw new Error(
      `First tier must start at 1 participant, but starts at ${firstTier.min_participants}. ` +
      `This would leave participant counts 1-${firstTier.min_participants - 1} without a tier.`
    )
  }

  // Rule 3 & 4: Check continuity and open-ended constraint
  for (let i = 0; i < sortedTiers.length - 1; i++) {
    const current = sortedTiers[i]
    const next = sortedTiers[i + 1]

    // Only last tier can be open-ended
    if (current.max_participants === null) {
      throw new Error(
        'Only the last tier can be open-ended (max_participants = null). ' +
        `Tier ${i + 1} (starting at ${current.min_participants} participants) ` +
        'is open-ended but is not the last tier.'
      )
    }

    // Check for gaps (tiers must be continuous)
    // If current tier ends at 5, next tier must start at 6
    if (current.max_participants + 1 !== next.min_participants) {
      const isGap = current.max_participants + 1 < next.min_participants
      throw new Error(
        `Tiers must be continuous: Tier ending at ${current.max_participants} ` +
        `must be followed by tier starting at ${current.max_participants + 1}, ` +
        `but next tier starts at ${next.min_participants}. ` +
        (isGap 
          ? `Gap detected: participants ${current.max_participants + 1}-${next.min_participants - 1} have no tier.`
          : `Overlap detected: participant ranges overlap.`)
      )
    }
  }

  // Last tier must be open-ended (represents "16+" style unlimited tier)
  const lastTier = sortedTiers[sortedTiers.length - 1]
  if (lastTier.max_participants !== null) {
    throw new Error(
      'Final tier must be open-ended (set max_participants to null for "16+" style tiers). ' +
      `Current final tier ends at ${lastTier.max_participants} participants. ` +
      'If more participants join, they would have no applicable tier.'
    )
  }

  // Rule 5: All tier budgets <= maxBudget
  for (const tier of tiers) {
    if (tier.budget_tokens > maxBudget) {
      throw new Error(
        `Tier budget (${tier.budget_tokens} tokens) exceeds maximum campaign budget (${maxBudget} tokens). ` +
        `Tier: ${tier.min_participants}-${tier.max_participants ?? '+'} participants.`
      )
    }
  }

  // Rule 6: Warn if budgets are not in ascending order (common mistake but not invalid)
  for (let i = 0; i < sortedTiers.length - 1; i++) {
    if (sortedTiers[i].budget_tokens > sortedTiers[i + 1].budget_tokens) {
      console.warn(
        '[validateBudgetTiers] Warning: Tier budgets are not in ascending order. ' +
        'This is allowed but unusual - verify this is intentional.'
      )
      break // Only warn once
    }
  }
}

// ==================== ACTIVE TIER CALCULATION ====================

/**
 * Determines which budget tier applies based on actual participant count
 * 
 * Used during payment distribution to determine which budget amount to release.
 * The function finds the tier whose participant range contains the given count.
 * 
 * **How it works:**
 * - Iterates through tiers to find one where `min <= participantCount <= max`
 * - For open-ended tiers (max = null), any count >= min matches
 * - With properly validated tiers, exactly one tier will always match
 * 
 * @param tiers - Array of budget tier configurations (should be validated first)
 * @param participantCount - Number of approved participants
 * @returns The matching BudgetTier, or null if no tier matches
 * 
 * @example
 * ```typescript
 * const tiers: BudgetTier[] = [
 *   { min_participants: 1,  max_participants: 5,    budget_tokens: 500,  budget_usd: 100 },
 *   { min_participants: 6,  max_participants: 15,   budget_tokens: 1500, budget_usd: 300 },
 *   { min_participants: 16, max_participants: null, budget_tokens: 5000, budget_usd: 1000 },
 * ]
 * 
 * calculateActiveTier(tiers, 3)   // → Tier 1 (1-5, 500 tokens)
 * calculateActiveTier(tiers, 8)   // → Tier 2 (6-15, 1500 tokens)
 * calculateActiveTier(tiers, 20)  // → Tier 3 (16+, 5000 tokens)
 * calculateActiveTier(tiers, 100) // → Tier 3 (16+, 5000 tokens) - open-ended
 * ```
 * 
 * @example
 * ```typescript
 * // Usage in payment distribution
 * const approvedSubmissions = submissions.filter(s => s.social_approval_status === 'approved')
 * const participantCount = approvedSubmissions.length
 * 
 * const activeTier = calculateActiveTier(job.social_budget_tiers, participantCount)
 * if (activeTier) {
 *   const totalBudget = activeTier.budget_tokens
 *   // Distribute totalBudget proportionally among participants
 * }
 * ```
 */
export function calculateActiveTier(
  tiers: BudgetTier[],
  participantCount: number
): BudgetTier | null {
  // Edge case: no participants means no tier applies
  if (participantCount <= 0) {
    return null
  }

  for (const tier of tiers) {
    // Check if participant count falls within this tier's range
    if (participantCount >= tier.min_participants) {
      // If max is null (open-ended tier like "16+"), or count is within range
      if (tier.max_participants === null || participantCount <= tier.max_participants) {
        return tier
      }
    }
  }

  // Should never reach here with properly validated tiers
  // This can happen if:
  // - Tiers weren't validated (gaps exist)
  // - participantCount is 0 or negative
  return null
}

// ==================== PAYMENT TYPES ====================

/**
 * Calculated payment information for a single submission
 * Used for distributing budget proportionally based on follower counts
 */
export interface SubmissionPayment {
  /** UUID of the submission */
  submission_id: string
  /** Wallet address of the worker receiving payment */
  worker_wallet: string
  /** Verified follower count used for calculation */
  follower_count_verified: number
  /** Payment amount in tokens */
  payment_amount_tokens: number
  /** Payment amount in USD equivalent */
  payment_amount_usd: number
  /** Percentage of total pool (0-100) - for UI display like "You'll receive 25.7% of the pool" */
  percentage_of_total: number
}

// ==================== PROPORTIONAL PAYMENT CALCULATION ====================

/**
 * Calculates proportional payments based on verified follower counts
 * 
 * Each worker's payment is calculated as:
 * ```
 * payment = (worker_followers / total_followers) × tier_budget
 * ```
 * 
 * This ensures fair distribution where workers with larger audiences
 * receive proportionally larger payments for their greater reach.
 * 
 * **Validation:**
 * - All follower counts must be >= 0
 * - Total follower count must be > 0
 * - Empty submissions array returns empty array
 * 
 * **Precision:**
 * - Payments are calculated with full floating point precision
 * - Round to desired precision when storing or displaying
 * 
 * @param submissions - Array of approved submissions with verified follower counts
 * @param tierBudget - The budget amount to distribute in tokens (from active tier)
 * @param tierBudgetUsd - USD equivalent of tier budget for display
 * @returns Array of calculated payment amounts for each submission
 * @throws {Error} If any follower count is negative
 * @throws {Error} If total follower count is zero (no one can receive payment)
 * 
 * @example
 * ```typescript
 * // 3 workers: 1000, 2000, 2000 followers | 500 token budget
 * // Total followers: 5000
 * //
 * // Worker 1: (1000/5000) × 500 = 100 tokens (20%)
 * // Worker 2: (2000/5000) × 500 = 200 tokens (40%)
 * // Worker 3: (2000/5000) × 500 = 200 tokens (40%)
 * 
 * const submissions = [
 *   { id: 'sub-1', worker_wallet: 'wallet1', social_follower_count_verified: 1000 },
 *   { id: 'sub-2', worker_wallet: 'wallet2', social_follower_count_verified: 2000 },
 *   { id: 'sub-3', worker_wallet: 'wallet3', social_follower_count_verified: 2000 },
 * ]
 * 
 * const payments = calculateProportionalPayments(submissions, 500, 100)
 * // payments[0]: { payment_amount_tokens: 100, percentage_of_total: 20, ... }
 * // payments[1]: { payment_amount_tokens: 200, percentage_of_total: 40, ... }
 * // payments[2]: { payment_amount_tokens: 200, percentage_of_total: 40, ... }
 * ```
 * 
 * @example
 * ```typescript
 * // Full workflow with tier calculation
 * const approvedSubs = allSubmissions.filter(
 *   s => s.social_approval_status === 'approved'
 * )
 * 
 * const activeTier = calculateActiveTier(job.social_budget_tiers, approvedSubs.length)
 * if (!activeTier) throw new Error('No matching tier')
 * 
 * const payments = calculateProportionalPayments(
 *   approvedSubs,
 *   activeTier.budget_tokens,
 *   activeTier.budget_usd
 * )
 * 
 * // Update each submission with its calculated payment
 * for (const payment of payments) {
 *   await supabase
 *     .from('job_submissions')
 *     .update({
 *       social_payment_amount_tokens: payment.payment_amount_tokens,
 *       social_payment_amount_usd: payment.payment_amount_usd,
 *     })
 *     .eq('id', payment.submission_id)
 * }
 * ```
 */
export function calculateProportionalPayments(
  submissions: Array<{
    id: string
    worker_wallet: string
    social_follower_count_verified: number
  }>,
  tierBudget: number,
  tierBudgetUsd: number
): SubmissionPayment[] {
  // Edge case: no submissions means no payments
  if (submissions.length === 0) {
    return []
  }

  // Validate all follower counts are non-negative
  for (const submission of submissions) {
    if (submission.social_follower_count_verified < 0) {
      throw new Error(
        `Invalid follower count: submission ${submission.id} has negative follower count ` +
        `(${submission.social_follower_count_verified}). Verified counts must be >= 0.`
      )
    }
  }

  // Calculate total follower weight
  const totalFollowers = submissions.reduce(
    (sum, sub) => sum + sub.social_follower_count_verified,
    0
  )

  // Edge case: zero total followers (shouldn't happen but handle it)
  if (totalFollowers === 0) {
    throw new Error(
      'Cannot calculate proportional payments: total follower count is zero. ' +
      'At least one submission must have verified followers > 0.'
    )
  }

  // Calculate payment for each submission
  return submissions.map(submission => {
    const followerWeight = submission.social_follower_count_verified / totalFollowers
    const paymentTokens = tierBudget * followerWeight
    const paymentUsd = tierBudgetUsd * followerWeight
    const percentage = followerWeight * 100

    return {
      submission_id: submission.id,
      worker_wallet: submission.worker_wallet,
      follower_count_verified: submission.social_follower_count_verified,
      payment_amount_tokens: paymentTokens,
      payment_amount_usd: paymentUsd,
      percentage_of_total: percentage,
    }
  })
}

// ==================== TIER DISPLAY UTILITIES ====================

/**
 * Formats tier participant range for UI display
 * 
 * @param tier - Budget tier to format
 * @returns Human-readable range string
 * 
 * @example
 * ```typescript
 * formatTierRange({ min_participants: 1, max_participants: 5, ... })
 * // → "1-5 participants"
 * 
 * formatTierRange({ min_participants: 16, max_participants: null, ... })
 * // → "16+ participants"
 * ```
 */
export function formatTierRange(tier: BudgetTier): string {
  if (tier.max_participants === null) {
    return `${tier.min_participants}+ participants`
  }
  return `${tier.min_participants}-${tier.max_participants} participants`
}

/**
 * Information about the next tier that could be unlocked
 */
export interface NextTierInfo {
  /** The next tier that would activate */
  tier: BudgetTier
  /** Number of additional participants needed to reach this tier */
  participantsNeeded: number
}

/**
 * Gets the next tier that would activate with more participants
 * 
 * Used for progress messaging like "3 more participants to unlock next tier!"
 * Returns null if already at the highest (open-ended) tier.
 * 
 * @param tiers - Array of budget tier configurations
 * @param currentParticipantCount - Current number of approved participants
 * @returns Next tier info with participants needed, or null if at highest tier
 * 
 * @example
 * ```typescript
 * const tiers = [
 *   { min_participants: 1,  max_participants: 5,    budget_tokens: 500, ... },
 *   { min_participants: 6,  max_participants: 15,   budget_tokens: 1500, ... },
 *   { min_participants: 16, max_participants: null, budget_tokens: 5000, ... },
 * ]
 * 
 * getNextTier(tiers, 3)
 * // → { tier: Tier 2, participantsNeeded: 3 }  // Need 3 more to reach 6
 * 
 * getNextTier(tiers, 8)
 * // → { tier: Tier 3, participantsNeeded: 8 }  // Need 8 more to reach 16
 * 
 * getNextTier(tiers, 20)
 * // → null  // Already at highest tier
 * ```
 * 
 * @example
 * ```typescript
 * // Usage in UI
 * const nextTier = getNextTier(job.social_budget_tiers, participantCount)
 * if (nextTier) {
 *   console.log(`${nextTier.participantsNeeded} more to unlock ${formatTierRange(nextTier.tier)}!`)
 *   console.log(`Budget increases to ${nextTier.tier.budget_tokens} tokens`)
 * } else {
 *   console.log('Maximum tier reached!')
 * }
 * ```
 */
export function getNextTier(
  tiers: BudgetTier[],
  currentParticipantCount: number
): NextTierInfo | null {
  // Sort tiers by min_participants ascending
  const sortedTiers = [...tiers].sort(
    (a, b) => a.min_participants - b.min_participants
  )

  // Find the first tier whose min is greater than current count
  for (const tier of sortedTiers) {
    if (tier.min_participants > currentParticipantCount) {
      return {
        tier,
        participantsNeeded: tier.min_participants - currentParticipantCount,
      }
    }
  }

  // Already at highest tier (current count is in the open-ended tier)
  return null
}

/**
 * Estimated payment per person for a tier
 */
export interface EstimatedPerPerson {
  /** Estimated tokens each participant would receive */
  tokensPerPerson: number
  /** Estimated USD each participant would receive */
  usdPerPerson: number
}

/**
 * Calculates estimated payment per person for a tier
 * 
 * Used in UI to show estimates like "Est. ~$50 per person" before
 * actual participant counts are known. This helps workers understand
 * potential earnings.
 * 
 * **Estimation logic:**
 * - If `estimatedParticipants` provided, uses that exact number
 * - For open-ended tiers (16+), estimates at minimum (conservative)
 * - For bounded tiers, estimates at midpoint of range
 * 
 * @param tier - Budget tier to estimate for
 * @param estimatedParticipants - Optional specific participant count to use
 * @returns Estimated tokens and USD per person
 * 
 * @example
 * ```typescript
 * // Tier: 1-5 participants, 500 tokens
 * calculateEstimatedPerPerson({ min: 1, max: 5, budget_tokens: 500, budget_usd: 100 })
 * // Midpoint = 3, so: { tokensPerPerson: 166.67, usdPerPerson: 33.33 }
 * 
 * // Tier: 16+ participants, 5000 tokens
 * calculateEstimatedPerPerson({ min: 16, max: null, budget_tokens: 5000, budget_usd: 1000 })
 * // Uses min (16), so: { tokensPerPerson: 312.5, usdPerPerson: 62.5 }
 * 
 * // With specific estimate
 * calculateEstimatedPerPerson(tier, 10)
 * // Uses 10: { tokensPerPerson: 50, usdPerPerson: 10 }
 * ```
 * 
 * @example
 * ```typescript
 * // Usage in job creation form
 * const estimate = calculateEstimatedPerPerson(selectedTier)
 * console.log(`Est. ~$${estimate.usdPerPerson.toFixed(2)} per person`)
 * ```
 */
export function calculateEstimatedPerPerson(
  tier: BudgetTier,
  estimatedParticipants?: number
): EstimatedPerPerson {
  let participants: number

  if (estimatedParticipants && estimatedParticipants > 0) {
    // Use provided estimate
    participants = estimatedParticipants
  } else if (tier.max_participants === null) {
    // For open-ended tiers, estimate at min_participants (conservative)
    participants = tier.min_participants
  } else {
    // For bounded tiers, use midpoint of range
    participants = Math.floor((tier.min_participants + tier.max_participants) / 2)
    // Ensure at least 1 participant
    participants = Math.max(1, participants)
  }

  return {
    tokensPerPerson: tier.budget_tokens / participants,
    usdPerPerson: tier.budget_usd / participants,
  }
}

// ==================== REFUND CALCULATION ====================

/**
 * Refund breakdown for unused budget
 */
export interface RefundAmount {
  /** Amount of unused budget to refund */
  budgetRefund: number
  /** Proportional platform fee refund */
  feeRefund: number
  /** Total refund (budget + fee) */
  totalRefund: number
}

/**
 * Calculates refund amount when actual tier budget < maximum budget
 * 
 * When a social media job completes with fewer participants than the maximum
 * tier, the unused budget difference is refunded to the poster. The platform
 * fee is also proportionally refunded since it was calculated on the max budget.
 * 
 * **Refund formula:**
 * ```
 * budgetRefund = maxBudget - tierBudget
 * feeRefund    = (maxBudget × feeRate) - (tierBudget × feeRate)
 * totalRefund  = budgetRefund + feeRefund
 * ```
 * 
 * @param maxBudget - Total budget locked in escrow (highest tier amount)
 * @param tierBudget - Actual tier budget being distributed to workers
 * @param feePercentage - Platform fee as decimal (e.g., 0.05 for 5%)
 * @returns Object with budget refund, fee refund, and total refund amounts
 * 
 * @example
 * ```typescript
 * // Scenario: Poster locked highest tier (5000 tokens + 5% fee)
 * // Only Tier 2 (1500 tokens) was reached
 * 
 * // Original lock:
 * //   Budget: 5000 tokens
 * //   Fee:    250 tokens (5%)
 * //   Total:  5250 tokens in escrow
 * 
 * // Actual distribution:
 * //   Budget: 1500 tokens to workers
 * //   Fee:    75 tokens to platform (5%)
 * //   Total:  1575 tokens used
 * 
 * const refund = calculateRefundAmount(5000, 1500, 0.05)
 * // refund = {
 * //   budgetRefund: 3500,    // 5000 - 1500
 * //   feeRefund: 175,        // 250 - 75
 * //   totalRefund: 3675      // returned to poster
 * // }
 * ```
 * 
 * @example
 * ```typescript
 * // No refund when using highest tier
 * const refund = calculateRefundAmount(5000, 5000, 0.05)
 * // refund = { budgetRefund: 0, feeRefund: 0, totalRefund: 0 }
 * ```
 * 
 * @example
 * ```typescript
 * // Full workflow
 * const activeTier = calculateActiveTier(tiers, participantCount)
 * const refund = calculateRefundAmount(
 *   job.social_total_budget_tokens,
 *   activeTier.budget_tokens,
 *   0.05
 * )
 * 
 * if (refund.totalRefund > 0) {
 *   console.log(`Refunding ${refund.totalRefund} tokens to poster`)
 *   // Execute refund transaction
 * }
 * ```
 */
export function calculateRefundAmount(
  maxBudget: number,
  tierBudget: number,
  feePercentage: number
): RefundAmount {
  // Calculate unused budget
  const budgetRefund = maxBudget - tierBudget

  // Calculate proportional fee refund
  // Fee was charged on maxBudget, but only tierBudget is being used
  const maxFee = maxBudget * feePercentage
  const actualFee = tierBudget * feePercentage
  const feeRefund = maxFee - actualFee

  return {
    budgetRefund,
    feeRefund,
    totalRefund: budgetRefund + feeRefund,
  }
}

