/**
 * Social Media Jobs Type Definitions
 * 
 * Type definitions for the social media engagement jobs system.
 * These types extend the base job system to support Twitter retweet
 * and original tweet campaigns with automatic proportional payments
 * based on follower counts and engagement metrics.
 */

import { Database } from './database'

// ==================== BASE TYPES ====================

/**
 * Type of social media job
 * - retweet: Workers retweet an existing tweet provided by the poster
 * - original_tweet: Workers create original content about a topic provided by the poster
 */
export type SocialJobType = 'retweet' | 'original_tweet'

/**
 * Approval status for social media job submissions
 * - pending: Awaiting poster review
 * - approved: Poster manually approved the submission
 * - auto_approved: Automatically approved after review deadline passed
 * - denied: Poster rejected the submission
 */
export type SocialApprovalStatus = 'pending' | 'approved' | 'auto_approved' | 'denied'

// ==================== BUDGET TIER ====================

/**
 * Budget tier configuration for social media jobs
 * 
 * Defines payment structure based on follower count ranges.
 * Posters can set multiple tiers to pay more for accounts with larger reach.
 * 
 * @example
 * ```typescript
 * const tier: BudgetTier = {
 *   min_followers: 1000,
 *   max_followers: 5000,
 *   price_usd: 50
 * }
 * ```
 * 
 * @example Top tier (100K+ followers)
 * ```typescript
 * const topTier: BudgetTier = {
 *   min_followers: 100000,
 *   max_followers: null, // null = unlimited
 *   price_usd: 500
 * }
 * ```
 */
export interface BudgetTier {
  /** Minimum follower count for this tier (inclusive) */
  min_followers: number
  
  /** Maximum follower count for this tier (inclusive). null means unlimited (100K+) */
  max_followers: number | null
  
  /** Base payment in USD for this tier */
  price_usd: number
}

// ==================== JOB CREATION ====================

/**
 * Data required to create a social media job
 * 
 * Extends the base job creation pattern with social media specific fields.
 * All social jobs require budget tiers and deadlines are auto-calculated.
 * 
 * @example Retweet campaign
 * ```typescript
 * const jobData: SocialJobCreationData = {
 *   project_id: 'uuid',
 *   poster_wallet: '5yG3...',
 *   title: 'Retweet our product launch',
 *   description: 'Help us spread the word',
 *   is_social_media_job: true,
 *   social_job_type: 'retweet',
 *   social_tweet_url: 'https://twitter.com/user/status/123',
 *   social_budget_tiers: [
 *     { min_followers: 1000, max_followers: 10000, price_usd: 50 },
 *     { min_followers: 10000, max_followers: null, price_usd: 200 }
 *   ],
 *   social_total_budget_usd: 1000,
 *   social_total_budget_tokens: 5000,
 *   social_min_followers_required: 1000
 * }
 * ```
 */
export interface SocialJobCreationData {
  // Base job fields
  project_id: string
  poster_wallet: string
  title: string
  description: string
  kpis: string
  category: string
  
  // Social media job identification
  is_social_media_job: true
  social_job_type: SocialJobType
  
  // Content (mutually exclusive based on job type)
  social_tweet_url?: string       // Required for 'retweet' jobs
  social_tweet_topic?: string      // Required for 'original_tweet' jobs
  
  // Budget configuration
  social_budget_tiers: BudgetTier[]
  social_total_budget_usd: number
  social_total_budget_tokens: number
  
  // Optional filters
  social_min_followers_required?: number
  
  // Timeline fields (auto-calculated, but can be customized)
  social_submission_deadline?: string    // Default: 48hrs from creation
  social_engagement_deadline?: string    // Default: +24hrs after submission
  social_review_deadline?: string        // Default: +48hrs after engagement
  
  // Payment/escrow fields (inherited from base job system)
  payment_amount_tokens: number
  payment_amount_usd: number
  escrow_locked?: boolean
  escrow_tx_signature?: string | null
  escrow_amount_tokens?: number | null
  escrow_token_mint?: string | null
  fee_percentage_at_creation?: number
}

// ==================== SUBMISSION ====================

/**
 * Data for a worker's social media job submission
 * 
 * Workers submit their tweet link and report their follower count.
 * Payment is calculated based on their tier and actual impressions.
 * 
 * @example
 * ```typescript
 * const submission: SocialSubmissionData = {
 *   job_id: 'uuid',
 *   worker_wallet: '8kL2...',
 *   social_follower_count: 5000,
 *   social_tweet_link: 'https://twitter.com/worker/status/456',
 *   social_payment_amount_usd: 50
 * }
 * ```
 */
export interface SocialSubmissionData {
  /** UUID of the job being submitted to */
  job_id: string
  
  /** Wallet address of the worker submitting */
  worker_wallet: string
  
  /** Follower count reported by worker (determines tier) */
  social_follower_count: number
  
  /** URL of the tweet (retweet or original post) */
  social_tweet_link: string
  
  /** Base payment amount in USD based on tier (before impression bonus) */
  social_payment_amount_usd: number
  
  /** Base payment amount in tokens based on tier (before impression bonus) */
  social_payment_amount_tokens: number
  
  /** Optional delivery message from worker */
  message?: string
}

// ==================== APPROVAL & PAYMENT ====================

/**
 * Impression bonus calculation details
 * 
 * Bonuses are calculated at $5 CPM (cost per thousand impressions).
 * Applied after the poster verifies actual impression counts.
 * 
 * @example
 * ```typescript
 * const bonus: ImpressionBonusCalculation = {
 *   impressions: 50000,
 *   cpm_rate: 5,
 *   bonus_amount: 250  // (50000 / 1000) * $5
 * }
 * ```
 */
export interface ImpressionBonusCalculation {
  /** Actual impressions from Twitter analytics */
  impressions: number
  
  /** Cost per thousand impressions (always $5) */
  cpm_rate: number
  
  /** Calculated bonus amount in USD */
  bonus_amount: number
}

/**
 * Complete approval and payment data for a submission
 * 
 * Used during the review phase when poster approves submissions
 * and verifies impression counts for bonus calculations.
 * 
 * @example
 * ```typescript
 * const approvalData: ApprovalPaymentData = {
 *   submission_id: 'uuid',
 *   impressions: 50000,
 *   base_payment: 50,
 *   impression_bonus: 250,
 *   total_payment: 300
 * }
 * ```
 */
export interface ApprovalPaymentData {
  /** UUID of the submission being approved */
  submission_id: string
  
  /** Verified impression count from Twitter analytics */
  impressions: number
  
  /** Base payment from tier (in USD) */
  base_payment: number
  
  /** Bonus payment from impressions at $5 CPM (in USD) */
  impression_bonus: number
  
  /** Total payment = base_payment + impression_bonus (in USD) */
  total_payment: number
}

// ==================== CAMPAIGN MANAGEMENT ====================

/**
 * Budget status for a social media campaign
 * 
 * Tracks budget allocation across all tiers and submissions.
 * Used to prevent overspending and calculate refunds.
 * 
 * @example
 * ```typescript
 * const budget: CampaignBudgetStatus = {
 *   total_budget: 1000,
 *   remaining_budget: 300,
 *   reserved_budget: 500,  // Pending submissions
 *   actual_released: 200    // Approved payments
 * }
 * ```
 */
export interface CampaignBudgetStatus {
  /** Total budget set by poster (in USD) */
  total_budget: number
  
  /** Remaining budget not yet allocated (in USD) */
  remaining_budget: number
  
  /** Budget reserved for pending submissions (in USD) */
  reserved_budget: number
  
  /** Actual amount paid out to workers (in USD) */
  actual_released: number
}

/**
 * Submission data with calculated review information
 * 
 * Used in the poster's review dashboard to display submissions
 * with pre-calculated payment amounts based on impression input.
 * 
 * @example
 * ```typescript
 * const reviewData: SubmissionReviewData = {
 *   submission: { ...dbRow },
 *   impressions_input: 50000,
 *   calculated_bonus: 250,
 *   total_payment: 300
 * }
 * ```
 */
export interface SubmissionReviewData {
  /** The job submission row from database */
  submission: Database['public']['Tables']['job_submissions']['Row']
  
  /** Poster-provided impression count (null if not yet entered) */
  impressions_input: number | null
  
  /** Calculated impression bonus based on impressions_input */
  calculated_bonus: number
  
  /** Total payment including base + bonus */
  total_payment: number
}

// ==================== EXTENDED DATABASE TYPES ====================

/**
 * Social media job with full details
 * Extends the base jobs table row with typed social fields
 */
export interface SocialJob extends Database['public']['Tables']['jobs']['Row'] {
  is_social_media_job: true
  social_job_type: SocialJobType
  social_budget_tiers: BudgetTier[]
  social_total_budget_tokens: number
  social_total_budget_usd: number
  social_submission_deadline: string
  social_engagement_deadline: string
  social_review_deadline: string
  social_tweet_url?: string
  social_tweet_topic?: string
  social_min_followers_required?: number
  social_actual_budget_released?: number
  social_payments_distributed: boolean
}

/**
 * Social media job submission with full details
 * Extends the base job_submissions table row with typed social fields
 */
export interface SocialSubmission extends Database['public']['Tables']['job_submissions']['Row'] {
  social_tweet_link: string
  social_follower_count: number
  social_follower_count_verified?: number
  social_approval_status: SocialApprovalStatus
  social_denial_reason?: string
  social_payment_amount_tokens?: number
  social_payment_amount_usd?: number
  social_payment_released: boolean
  social_payment_tx_signature?: string
}

// ==================== HELPER FUNCTIONS TYPES ====================

/**
 * Calculate deadline timestamps for a social media job
 * 
 * @param createdAt - Job creation timestamp
 * @returns Object with all three deadline timestamps
 */
export interface SocialJobDeadlines {
  submission_deadline: Date    // createdAt + 48 hours
  engagement_deadline: Date    // submission_deadline + 24 hours
  review_deadline: Date        // engagement_deadline + 48 hours
}

/**
 * Validate if a follower count qualifies for a specific tier
 * 
 * @param followerCount - Worker's follower count
 * @param tier - Budget tier to check against
 * @returns true if follower count is within tier range
 */
export type TierValidator = (followerCount: number, tier: BudgetTier) => boolean

/**
 * Calculate payment amount for a tier
 * 
 * @param tier - Budget tier
 * @param tokenPrice - Current token price in USD
 * @returns Object with USD and token amounts
 */
export interface TierPayment {
  amount_usd: number
  amount_tokens: number
}

// ==================== NOTIFICATION METADATA ====================

/**
 * Metadata for social job notification types
 * Used in the notifications table metadata JSONB field
 */
export interface SocialJobNotificationMetadata {
  job_id: string
  job_title: string
  social_job_type: SocialJobType
  submission_id?: string
  worker_wallet?: string
  poster_wallet?: string
  social_tweet_link?: string
  social_follower_count?: number
  social_payment_amount?: number
  social_denial_reason?: string
}

// ==================== EXPORTS ====================

// Re-export Database type for convenience
export type { Database }

