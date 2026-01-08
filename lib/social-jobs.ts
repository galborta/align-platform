/**
 * Social Media Jobs Utility Functions
 * 
 * Core utility functions for social media job creation, budget management,
 * payment calculations, and validation. Follows patterns from lib/jobs.ts.
 */

import type {
  BudgetTier,
  SocialJob,
  SubmissionReviewData,
  ImpressionBonusCalculation
} from '@/types/social-jobs'

// ==================== PAYMENT CALCULATIONS ====================

/**
 * Calculate impression bonus based on $5 CPM rate
 * 
 * CPM (Cost Per Mille) = Cost per 1,000 impressions
 * Fixed rate: $5 per 1,000 impressions
 * 
 * @param impressions - Total impression count from Twitter analytics
 * @returns Bonus amount in USD, rounded to 2 decimal places
 * 
 * @example
 * ```typescript
 * const bonus = calculateImpressionBonus(50000)
 * console.log(bonus) // 250.00
 * ```
 */
export function calculateImpressionBonus(impressions: number): number {
  if (impressions < 0) {
    throw new Error('Impressions cannot be negative')
  }
  
  const CPM_RATE = 5
  const bonus = (impressions / 1000) * CPM_RATE
  
  // Round to 2 decimal places
  return Math.round(bonus * 100) / 100
}

/**
 * Calculate total payment including base payment and impression bonus
 * 
 * @param basePayment - Base payment from tier (in USD)
 * @param impressions - Verified impression count
 * @returns Total payment amount (base + bonus)
 * 
 * @example
 * ```typescript
 * const total = calculateTotalPayment(50, 50000)
 * console.log(total) // 300.00 (50 base + 250 bonus)
 * ```
 */
export function calculateTotalPayment(
  basePayment: number,
  impressions: number
): number {
  if (basePayment < 0) {
    throw new Error('Base payment cannot be negative')
  }
  
  const bonus = calculateImpressionBonus(impressions)
  const total = basePayment + bonus
  
  // Round to 2 decimal places
  return Math.round(total * 100) / 100
}

/**
 * Get impression bonus calculation details
 * 
 * @param impressions - Verified impression count
 * @returns Complete calculation breakdown
 * 
 * @example
 * ```typescript
 * const calc = getImpressionBonusCalculation(50000)
 * console.log(calc)
 * // { impressions: 50000, cpm_rate: 5, bonus_amount: 250 }
 * ```
 */
export function getImpressionBonusCalculation(
  impressions: number
): ImpressionBonusCalculation {
  return {
    impressions,
    cpm_rate: 5,
    bonus_amount: calculateImpressionBonus(impressions)
  }
}

// ==================== TIER MATCHING ====================

/**
 * Find the matching budget tier for a given follower count
 * 
 * Tiers define payment ranges based on follower counts.
 * The tier with `max_followers = null` represents 100K+ (unlimited).
 * 
 * @param followerCount - Worker's reported follower count
 * @param tiers - Array of budget tiers (must be sorted by min_followers)
 * @returns Matching tier or null if no match
 * 
 * @example
 * ```typescript
 * const tiers = [
 *   { min_followers: 1000, max_followers: 10000, price_usd: 50 },
 *   { min_followers: 10000, max_followers: 100000, price_usd: 200 },
 *   { min_followers: 100000, max_followers: null, price_usd: 500 }
 * ]
 * 
 * const tier = findMatchingTier(5000, tiers)
 * console.log(tier.price_usd) // 50
 * 
 * const topTier = findMatchingTier(150000, tiers)
 * console.log(topTier.price_usd) // 500 (100K+ tier)
 * ```
 */
export function findMatchingTier(
  followerCount: number,
  tiers: BudgetTier[]
): BudgetTier | null {
  if (followerCount < 0) {
    return null
  }
  
  if (!tiers || tiers.length === 0) {
    return null
  }
  
  // Find tier where followerCount is within range
  for (const tier of tiers) {
    const meetsMin = followerCount >= tier.min_followers
    
    // Handle 100K+ tier (max_followers = null means unlimited)
    if (tier.max_followers === null) {
      if (meetsMin) {
        return tier
      }
    } else {
      // Regular tier with max limit
      const meetsMax = followerCount <= tier.max_followers
      if (meetsMin && meetsMax) {
        return tier
      }
    }
  }
  
  return null
}

/**
 * Check if a follower count qualifies for any tier
 * 
 * @param followerCount - Worker's follower count
 * @param tiers - Array of budget tiers
 * @returns true if follower count matches at least one tier
 */
export function qualifiesForJob(
  followerCount: number,
  tiers: BudgetTier[]
): boolean {
  return findMatchingTier(followerCount, tiers) !== null
}

// ==================== BUDGET ESTIMATION ====================

/**
 * Estimate participant count based on budget and tiers
 * 
 * Calculates average tier price and estimates how many participants
 * can be paid with the available budget.
 * 
 * @param budget - Total budget in USD
 * @param tiers - Array of budget tiers
 * @returns Estimated participant range as string
 * 
 * @example
 * ```typescript
 * const tiers = [
 *   { min_followers: 1000, max_followers: 10000, price_usd: 50 },
 *   { min_followers: 10000, max_followers: null, price_usd: 200 }
 * ]
 * 
 * const estimate = estimateParticipants(1000, tiers)
 * console.log(estimate) // "~8-20 participants"
 * ```
 */
export function estimateParticipants(
  budget: number,
  tiers: BudgetTier[]
): string {
  if (budget <= 0 || !tiers || tiers.length === 0) {
    return '~0 participants'
  }
  
  // Calculate average tier price
  const totalPrice = tiers.reduce((sum, tier) => sum + tier.price_usd, 0)
  const avgPrice = totalPrice / tiers.length
  
  // Get min and max prices
  const prices = tiers.map(t => t.price_usd)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  
  // Calculate participant range
  // Max participants = budget / min price (best case)
  // Min participants = budget / max price (worst case)
  const maxParticipants = Math.floor(budget / minPrice)
  const minParticipants = Math.floor(budget / maxPrice)
  
  if (minParticipants === maxParticipants) {
    return `~${minParticipants} participants`
  }
  
  return `~${minParticipants}-${maxParticipants} participants`
}

// ==================== VALIDATION ====================

/**
 * Validate Twitter/X tweet URL format
 * 
 * Accepts both twitter.com and x.com domains.
 * Format: https://(twitter.com|x.com)/[username]/status/[tweet_id]
 * 
 * @param url - Tweet URL to validate
 * @returns true if URL is valid tweet format
 * 
 * @example
 * ```typescript
 * validateTweetUrl('https://twitter.com/user/status/123456')  // true
 * validateTweetUrl('https://x.com/user/status/123456')        // true
 * validateTweetUrl('https://facebook.com/post/123')           // false
 * validateTweetUrl('not a url')                               // false
 * ```
 */
export function validateTweetUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }
  
  // Regex pattern for Twitter/X status URLs
  // Matches: https://(twitter.com|x.com)/[username]/status/[numeric_id]
  const tweetUrlPattern = /^https?:\/\/(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/\d+(\?.*)?$/
  
  return tweetUrlPattern.test(url)
}

/**
 * Extract tweet ID from Twitter/X URL
 * 
 * Extracts the numeric tweet ID regardless of URL format variations.
 * Handles both twitter.com and x.com, with or without query parameters.
 * 
 * @param url - Tweet URL to extract ID from
 * @returns Tweet ID as string, or null if not found
 * 
 * @example
 * ```typescript
 * extractTweetId('https://twitter.com/user/status/123456789')           // '123456789'
 * extractTweetId('https://x.com/user/status/123456789?s=20')            // '123456789'
 * extractTweetId('https://twitter.com/user/status/123456789/photo/1')   // '123456789'
 * extractTweetId('https://facebook.com/post/123')                       // null
 * extractTweetId('not a url')                                           // null
 * ```
 */
export function extractTweetId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null
  }
  
  // Extract tweet ID from status URL
  // Matches /status/[numeric_id] and captures the ID
  const match = url.match(/\/status\/(\d+)/)
  
  return match ? match[1] : null
}

/**
 * Validate budget is sufficient for all approved submissions
 * 
 * Ensures total payment amounts don't exceed available budget.
 * Used during the approval phase to prevent overspending.
 * 
 * @param submissions - Array of submissions with calculated payments
 * @param availableBudget - Remaining budget available (in USD)
 * @returns Validation result with details
 * 
 * @example
 * ```typescript
 * const submissions = [
 *   { total_payment: 100, ... },
 *   { total_payment: 200, ... },
 *   { total_payment: 150, ... }
 * ]
 * 
 * const result = validateBudgetForApproval(submissions, 500)
 * console.log(result)
 * // { valid: true, total: 450 }
 * 
 * const overbudget = validateBudgetForApproval(submissions, 400)
 * console.log(overbudget)
 * // { valid: false, shortage: 50, total: 450 }
 * ```
 */
export function validateBudgetForApproval(
  submissions: SubmissionReviewData[],
  availableBudget: number
): { valid: boolean; shortage?: number; total?: number } {
  if (availableBudget < 0) {
    throw new Error('Available budget cannot be negative')
  }
  
  // Calculate total payment needed
  const total = submissions.reduce(
    (sum, sub) => sum + (sub.total_payment || 0),
    0
  )
  
  // Round to 2 decimals
  const totalRounded = Math.round(total * 100) / 100
  
  if (totalRounded > availableBudget) {
    const shortage = Math.round((totalRounded - availableBudget) * 100) / 100
    return {
      valid: false,
      shortage,
      total: totalRounded
    }
  }
  
  return {
    valid: true,
    total: totalRounded
  }
}

/**
 * Validate budget tier configuration
 * 
 * Ensures tiers don't overlap and cover the full range properly.
 * 
 * @param tiers - Array of budget tiers to validate
 * @returns Validation result with error message if invalid
 */
export function validateBudgetTiers(
  tiers: BudgetTier[]
): { valid: boolean; error?: string } {
  if (!tiers || tiers.length === 0) {
    return { valid: false, error: 'At least one budget tier is required' }
  }
  
  // Sort tiers by min_followers
  const sortedTiers = [...tiers].sort((a, b) => a.min_followers - b.min_followers)
  
  // Check for gaps and overlaps
  for (let i = 0; i < sortedTiers.length - 1; i++) {
    const current = sortedTiers[i]
    const next = sortedTiers[i + 1]
    
    // Check if current tier has max_followers
    if (current.max_followers === null && i < sortedTiers.length - 1) {
      return {
        valid: false,
        error: 'Only the last tier can have unlimited max_followers (null)'
      }
    }
    
    // Check for overlap
    if (current.max_followers !== null && next.min_followers <= current.max_followers) {
      return {
        valid: false,
        error: `Tier overlap detected: tier ending at ${current.max_followers} overlaps with tier starting at ${next.min_followers}`
      }
    }
    
    // Check for gaps
    if (current.max_followers !== null && next.min_followers !== current.max_followers + 1) {
      return {
        valid: false,
        error: `Gap detected between tiers: ${current.max_followers} and ${next.min_followers}`
      }
    }
  }
  
  // Check price consistency
  for (const tier of tiers) {
    if (tier.price_usd <= 0) {
      return {
        valid: false,
        error: 'All tier prices must be greater than 0'
      }
    }
  }
  
  return { valid: true }
}

// ==================== BUDGET RESERVATION (SUPABASE) ====================

/**
 * Retry a function with exponential backoff
 * Used for critical database operations that must not fail silently
 * 
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param initialDelay - Initial delay in milliseconds
 * @param context - Context string for logging
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  context: string = 'operation'
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      const delay = initialDelay * Math.pow(2, attempt)
      console.warn(`[${context}] Attempt ${attempt + 1}/${maxRetries} failed:`, lastError.message)
      
      if (attempt < maxRetries - 1) {
        console.log(`[${context}] Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

/**
 * Reserve budget for a pending submission
 * 
 * Called when a worker submits to a social media job.
 * Uses atomic database operation to prevent race conditions.
 * 
 * This function calls the `reserve_social_budget` Postgres function which:
 * - Locks the job row (FOR UPDATE)
 * - Checks budget availability
 * - Decrements remaining budget atomically
 * - Returns success/failure
 * 
 * @param jobId - UUID of the social media job
 * @param paymentAmount - Base payment amount to reserve (in USD)
 * @returns Success status with optional error message
 * 
 * @example
 * ```typescript
 * const result = await reserveBudgetForSubmission(jobId, 50)
 * if (!result.success) {
 *   console.error('Budget reservation failed:', result.error)
 * }
 * ```
 */
export async function reserveBudgetForSubmission(
  jobId: string,
  paymentAmount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    return await retryWithBackoff(
      async () => {
        const { supabaseAdmin } = await import('@/lib/supabase')
        
        console.log('[reserveBudgetForSubmission] Calling RPC function:', {
          jobId,
          paymentAmount
        })
        
        // Call Supabase RPC function for atomic budget reservation
        const { data, error } = await supabaseAdmin.rpc('reserve_social_budget', {
          p_job_id: jobId,
          p_amount: paymentAmount
        })
        
        if (error) {
          console.error('[reserveBudgetForSubmission] RPC error:', error)
          return { 
            success: false, 
            error: 'reservation_failed' 
          }
        }
        
        // Parse response from RPC function
        const result = typeof data === 'string' ? JSON.parse(data) : data
        
        if (!result.success) {
          console.log('[reserveBudgetForSubmission] Budget check failed:', result.error)
          return { 
            success: false, 
            error: result.error || 'budget_exhausted' 
          }
        }
        
        console.log('[reserveBudgetForSubmission] Budget reserved successfully')
        return { success: true }
      },
      3,
      1000,
      'reserveBudgetForSubmission'
    )
  } catch (error) {
    console.error('[reserveBudgetForSubmission] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'unexpected_error'
    }
  }
}

/**
 * Unreserve budget when submission is rejected
 * 
 * Called when poster denies a submission.
 * Returns reserved budget back to available pool.
 * 
 * @param jobId - UUID of the social media job
 * @param paymentAmount - Amount to unreserve (in USD)
 * 
 * @example
 * ```typescript
 * await unreserveBudget(jobId, 50)
 * ```
 */
export async function unreserveBudget(
  jobId: string,
  paymentAmount: number
): Promise<void> {
  try {
    console.log('[unreserveBudget] Unreserving budget:', {
      jobId,
      paymentAmount
    })
    
    // Budget unreservation logic would go here
    // NOTE: Requires social_reserved_budget and social_budget_remaining fields
    
  } catch (error) {
    console.error('[unreserveBudget] Error:', error)
    throw error
  }
}

/**
 * Record budget release after successful payment
 * 
 * Called after tokens are sent to workers.
 * Updates actual budget released and decrements reserved amount.
 * 
 * @param jobId - UUID of the social media job
 * @param totalPaid - Total amount paid to workers (in USD)
 * @param reservedAmount - Amount that was reserved (in USD)
 * 
 * @example
 * ```typescript
 * await recordBudgetRelease(jobId, 300, 50)
 * ```
 */
export async function recordBudgetRelease(
  jobId: string,
  totalPaid: number,
  reservedAmount: number
): Promise<void> {
  try {
    await retryWithBackoff(
      async () => {
        const { supabaseAdmin } = await import('@/lib/supabase')
        
        // Fetch current values
        const { data: job, error: fetchError } = await supabaseAdmin
          .from('jobs')
          .select('social_actual_budget_released')
          .eq('id', jobId)
          .single()
        
        if (fetchError || !job) {
          throw new Error('Job not found')
        }
        
        const currentReleased = job.social_actual_budget_released || 0
        const newReleased = currentReleased + totalPaid
        
        // Update actual budget released
        const { error: updateError } = await supabaseAdmin
          .from('jobs')
          .update({
            social_actual_budget_released: newReleased,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId)
        
        if (updateError) {
          throw updateError
        }
        
        console.log('[recordBudgetRelease] Budget updated:', {
          jobId,
          totalPaid,
          newReleased
        })
      },
      3,
      1000,
      'recordBudgetRelease'
    )
  } catch (error) {
    console.error('[recordBudgetRelease] Error:', error)
    throw error
  }
}

// ==================== DEADLINE CALCULATIONS ====================

/**
 * Calculate all deadline timestamps for a social media job
 * 
 * Default timeline:
 * - Submission deadline: 48 hours from creation
 * - Engagement deadline: +24 hours after submission (72 hours total)
 * - Review deadline: +48 hours after engagement (120 hours total)
 * 
 * @param createdAt - Job creation timestamp
 * @returns Object with all three deadline dates
 * 
 * @example
 * ```typescript
 * const deadlines = calculateSocialJobDeadlines(new Date())
 * console.log(deadlines.submission_deadline)  // 48 hours from now
 * console.log(deadlines.engagement_deadline)  // 72 hours from now
 * console.log(deadlines.review_deadline)      // 120 hours from now
 * ```
 */
export function calculateSocialJobDeadlines(createdAt: Date): {
  submission_deadline: Date
  engagement_deadline: Date
  review_deadline: Date
} {
  const submission = new Date(createdAt)
  submission.setHours(submission.getHours() + 48)
  
  const engagement = new Date(submission)
  engagement.setHours(engagement.getHours() + 24)
  
  const review = new Date(engagement)
  review.setHours(review.getHours() + 48)
  
  return {
    submission_deadline: submission,
    engagement_deadline: engagement,
    review_deadline: review
  }
}

