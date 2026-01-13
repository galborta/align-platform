/**
 * Social Media Jobs Type Definitions
 * 
 * These types support the social media engagement job system where:
 * - Workers submit tweet links + follower counts
 * - Poster reviews and approves/denies submissions
 * - Payments are distributed proportionally based on reach potential (using follower count as a metric)
 */

// ==================== BUDGET TIER ====================

/**
 * Represents a single budget tier for social media jobs
 * Budget tiers define payment amounts based on participant count ranges
 * 
 * @example
 * {
 *   min_participants: 1,
 *   max_participants: 5,
 *   budget_tokens: 500,
 *   budget_usd: 100
 * }
 */
export interface BudgetTier {
  /** Minimum number of participants for this tier to apply */
  min_participants: number
  /** Maximum number of participants for this tier (null = open-ended like "16+") */
  max_participants: number | null
  /** Total budget in tokens for this tier */
  budget_tokens: number
  /** Total budget in USD for this tier */
  budget_usd: number
}

// ==================== FOLLOWER TIER (INSTANT PAYMENT SYSTEM) ====================

/**
 * Represents a single payment tier based on follower count for instant payment system
 * 
 * Unlike BudgetTier (which defines TOTAL budget based on participant count),
 * FollowerTier defines PER-PERSON payment based on follower count.
 * 
 * This enables instant payments where workers are paid immediately upon approval
 * based on their follower count tier, rather than waiting for batch payments at end.
 * 
 * @example
 * ```typescript
 * // Micro influencers: 500-1,000 followers get $10 each
 * {
 *   min_followers: 500,
 *   max_followers: 1000,
 *   base_payment_usd: 10,
 *   tier_name: "Micro"
 * }
 * 
 * // Macro influencers: 10,000+ followers get $100 each
 * {
 *   min_followers: 10001,
 *   max_followers: null,  // Open-ended
 *   base_payment_usd: 100,
 *   tier_name: "Macro"
 * }
 * ```
 */
export interface FollowerTier {
  /** Minimum follower count for this tier (inclusive). First tier starts at 500. */
  min_followers: number
  /** 
   * Maximum follower count for this tier (inclusive), or null for open-ended tiers.
   * Boundary: Someone with exactly max_followers falls INTO this tier.
   */
  max_followers: number | null
  /** 
   * Fixed payment amount in USD for anyone in this tier (per person, not total budget).
   * Example: 25 means each worker with followers in this range gets $25 when approved.
   */
  base_payment_usd: number
  /** 
   * Human-readable tier name for UI display.
   * Examples: "Micro", "Small", "Mid-tier", "Macro", "Mega"
   */
  tier_name: string
}

// ==================== JOB TYPES ====================

/**
 * Type of social media job
 * - 'retweet': Worker retweets/shares an existing tweet
 * - 'original_tweet': Worker creates original content about a topic
 */
export type SocialJobType = 'retweet' | 'original_tweet'

// ==================== APPROVAL STATUS ====================

/**
 * Status of a social media submission's approval and payment lifecycle
 * 
 * State Machine:
 * pending → approved_pending_payment → approved (success)
 *                                   → approved_failed (retry exhausted)
 * pending → denied (rejected by poster)
 * 
 * - 'pending': Awaiting poster review
 * - 'approved_pending_payment': Payment transaction submitted to blockchain, awaiting confirmation
 * - 'approved': Payment confirmed successfully, worker has been paid
 * - 'auto_approved': Review deadline passed, auto-approved (will transition to approved_pending_payment)
 * - 'approved_failed': Payment failed after all retry attempts exhausted
 * - 'denied': Poster rejected the submission (with reason)
 */
export type SocialApprovalStatus = 
  | 'pending' 
  | 'approved_pending_payment'
  | 'approved' 
  | 'auto_approved'
  | 'approved_failed'
  | 'denied'

// ==================== DISPUTE TYPES ====================

/**
 * Social media specific dispute types
 * - 'social_wrongful_denial': Worker believes their submission was wrongfully denied
 * - 'social_fake_followers': Poster believes the worker inflated their follower count
 * - 'social_link_invalid': Tweet link is broken, deleted, or invalid
 */
export type SocialDisputeType = 
  | 'social_wrongful_denial'
  | 'social_fake_followers'
  | 'social_link_invalid'

/**
 * Revision-related dispute reasons
 * 
 * These dispute types are specifically for handling revision-related conflicts:
 * - 'revision_refusal': Worker refused to complete a committed revision
 * - 'unlimited_revisions_abuse': Worker claims poster is abusing unlimited revisions
 */
export type RevisionDisputeType =
  | 'revision_refusal'         // Poster: worker refused committed revision
  | 'unlimited_revisions_abuse' // Worker: poster is abusing unlimited revisions

/**
 * All dispute types including social media and revision specific ones
 */
export type DisputeType =
  | 'quality_issues'
  | 'deadline_missed'
  | 'requirements_not_met'
  | 'payment_issue'
  | 'communication_failure'
  | 'scope_creep'
  | SocialDisputeType
  | RevisionDisputeType
  | 'other'

// ==================== TIMELINE HELPERS ====================

/**
 * Default timeline durations for social media jobs (in hours)
 */
export const SOCIAL_JOB_TIMELINE = {
  /** Hours from job creation to submission deadline */
  SUBMISSION_WINDOW: 48,
  /** Hours after submission deadline for engagement to stabilize */
  ENGAGEMENT_WINDOW: 24,
  /** Hours after engagement deadline for poster review */
  REVIEW_WINDOW: 48,
} as const

/**
 * Calculate all deadlines from job creation time
 */
export function calculateSocialJobDeadlines(createdAt: Date): {
  submissionDeadline: Date
  engagementDeadline: Date
  reviewDeadline: Date
} {
  const submissionDeadline = new Date(createdAt)
  submissionDeadline.setHours(submissionDeadline.getHours() + SOCIAL_JOB_TIMELINE.SUBMISSION_WINDOW)

  const engagementDeadline = new Date(submissionDeadline)
  engagementDeadline.setHours(engagementDeadline.getHours() + SOCIAL_JOB_TIMELINE.ENGAGEMENT_WINDOW)

  const reviewDeadline = new Date(engagementDeadline)
  reviewDeadline.setHours(reviewDeadline.getHours() + SOCIAL_JOB_TIMELINE.REVIEW_WINDOW)

  return {
    submissionDeadline,
    engagementDeadline,
    reviewDeadline,
  }
}

// ==================== PAYMENT CALCULATION ====================

/**
 * Calculate proportional payment for a submission based on reach potential
 * (Uses verified follower count as the metric for reach weighting)
 * 
 * @param followerCount - The verified follower count for this submission
 * @param totalFollowers - Sum of all approved submissions' follower counts
 * @param totalBudget - Total budget available for distribution
 * @returns The proportional payment amount
 */
export function calculateProportionalPayment(
  followerCount: number,
  totalFollowers: number,
  totalBudget: number
): number {
  if (totalFollowers === 0 || followerCount === 0) return 0
  return (followerCount / totalFollowers) * totalBudget
}

/**
 * Get the applicable budget tier based on participant count
 * 
 * @param participantCount - Number of approved participants
 * @param budgetTiers - Array of budget tiers sorted by min_participants ascending
 * @returns The applicable budget tier or null if none match
 */
export function getApplicableBudgetTier(
  participantCount: number,
  budgetTiers: BudgetTier[]
): BudgetTier | null {
  // Sort tiers by min_participants descending to find the highest applicable tier
  const sortedTiers = [...budgetTiers].sort((a, b) => b.min_participants - a.min_participants)
  
  for (const tier of sortedTiers) {
    if (participantCount >= tier.min_participants) {
      // Check if within max (or max is null = unlimited)
      if (tier.max_participants === null || participantCount <= tier.max_participants) {
        return tier
      }
    }
  }
  
  return null
}

// ==================== TYPE GUARDS ====================

/**
 * Check if a job is a social media job
 */
export function isSocialMediaJob(job: { is_social_media_job?: boolean | null }): boolean {
  return job.is_social_media_job === true
}

/**
 * Check if a social media job is a retweet type
 */
export function isRetweetJob(job: { social_job_type?: string | null }): boolean {
  return job.social_job_type === 'retweet'
}

/**
 * Check if a social media job is an original tweet type
 */
export function isOriginalTweetJob(job: { social_job_type?: string | null }): boolean {
  return job.social_job_type === 'original_tweet'
}

/**
 * Check if a submission is approved (either manually or auto-approved)
 */
export function isSubmissionApproved(submission: { social_approval_status?: string | null }): boolean {
  return submission.social_approval_status === 'approved' || 
         submission.social_approval_status === 'auto_approved'
}

