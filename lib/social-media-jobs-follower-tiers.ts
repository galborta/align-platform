/**
 * Follower-Based Tier System for Instant Payments
 * 
 * This module implements a follower-count-based tier system for social media jobs
 * that enables instant payments upon approval. This replaces the participant-count-based
 * batch payment system with per-person fixed payments based on reach potential.
 * 
 * **Key Differences from Participant-Based System:**
 * 
 * OLD (Participant-based, batch payments):
 * - Tiers define TOTAL budget based on how many people join
 * - Example: "1-10 people = $500 total", "11-25 people = $1000 total"
 * - Payment distributed proportionally at campaign end
 * 
 * NEW (Follower-based, instant payments):
 * - Tiers define PER-PERSON payment based on follower count
 * - Example: "500-1K followers = $10 each", "1K-5K followers = $25 each"
 * - Workers paid instantly when approved based on their tier
 * 
 * **Benefits:**
 * - Workers know payment upfront based on their follower count
 * - No waiting for campaign to end
 * - No complex proportional calculations
 * - Creates urgency with real-time budget countdown
 * - Transparent and predictable earnings
 * 
 * @module lib/social-media-jobs-follower-tiers
 */

// ==================== FOLLOWER TIER TYPE ====================

/**
 * Represents a single payment tier based on follower count
 * 
 * Each tier defines a follower range and the fixed payment amount
 * for anyone with follower count in that range.
 * 
 * @example
 * ```typescript
 * // Micro influencers: 500-1,000 followers get $10
 * const microTier: FollowerTier = {
 *   min_followers: 500,
 *   max_followers: 1000,
 *   base_payment_usd: 10,
 *   tier_name: "Micro"
 * }
 * 
 * // Macro influencers: 10,000+ followers get $100
 * const macroTier: FollowerTier = {
 *   min_followers: 10001,
 *   max_followers: null,  // Open-ended "10K+" tier
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
   * 
   * Boundary handling: Someone with exactly max_followers falls INTO this tier.
 * Example: If tier is 500-1000, someone with 1000 followers gets this tier.
 * Next tier must start at 1001.
   */
  max_followers: number | null
  
  /** 
   * Fixed payment amount in USD for anyone in this tier.
   * This is per-person, not total budget.
   * 
   * Example: base_payment_usd = 25 means each worker with followers in
   * this range gets $25 when approved.
   */
  base_payment_usd: number
  
  /** 
   * Human-readable tier name for UI display
   * Examples: "Micro", "Small", "Mid-tier", "Macro", "Mega"
   */
  tier_name: string
}

// ==================== TIER VALIDATION ====================

/**
 * Validates that follower tiers follow all required rules
 * 
 * Follower tiers must form a continuous range with no gaps, ensuring every
 * possible follower count (500 to infinity) maps to exactly one tier.
 * 
 * **Validation Rules:**
 * 
 * 1. **At least one tier required** - Cannot create a job with no tiers
 * 
 * 2. **First tier must start at 500** - Minimum follower count is 500
 *    (Prevents new account exploitation; requires established accounts)
 * 
 * 3. **Tiers must be continuous** - No gaps between tiers
 *    - If tier 1 ends at 1000, tier 2 must start at 1001
 *    - Example: `[500-1000, 1001-5000, 5001-10000, 10001+]` ✓
 *    - Example: `[500-1000, 1500-5000, ...]` ✗ (gap at 1001-1499)
 * 
 * 4. **Only last tier can be open-ended** - Final tier has `max_followers = null`
 *    - This represents "10,000+" or "unlimited" style tiers
 *    - Middle tiers must have explicit max values
 * 
 * 5. **Positive payments** - All base_payment_usd must be > 0
 * 
 * 6. **Ascending payments warning** - Payments typically increase with followers
 *    - Not enforced, but logs a warning if payments decrease
 *    - Larger audiences should earn more for greater reach
 * 
 * @param tiers - Array of follower tier configurations
 * @throws {Error} If validation fails with descriptive message explaining the issue
 * 
 * @example
 * ```typescript
 * // Valid tier configuration
 * const validTiers: FollowerTier[] = [
 *   { min_followers: 500,   max_followers: 1000,  base_payment_usd: 10,  tier_name: "Micro" },
 *   { min_followers: 1001,  max_followers: 5000,  base_payment_usd: 25,  tier_name: "Small" },
 *   { min_followers: 5001,  max_followers: 10000, base_payment_usd: 50,  tier_name: "Mid" },
 *   { min_followers: 10001, max_followers: null,  base_payment_usd: 100, tier_name: "Macro" },
 * ]
 * 
 * validateFollowerTiers(validTiers) // ✓ Passes
 * ```
 * 
 * @example
 * ```typescript
 * // Invalid: Gap between tier 1 (ends at 1000) and tier 2 (starts at 1500)
 * const invalidTiers: FollowerTier[] = [
 *   { min_followers: 500,  max_followers: 1000, base_payment_usd: 10, tier_name: "Micro" },
 *   { min_followers: 1500, max_followers: null, base_payment_usd: 25, tier_name: "Small" },
 * ]
 * 
 * validateFollowerTiers(invalidTiers)
 * // Throws: "Tiers must be continuous: Tier ending at 1000 followers must be 
 * //         followed by tier starting at 1001, but next tier starts at 1500.
 * //         Gap detected: follower counts 1001-1499 have no tier."
 * ```
 * 
 * @example
 * ```typescript
 * // Invalid: First tier starts at 100 instead of 500
 * const invalidTiers: FollowerTier[] = [
 *   { min_followers: 100,  max_followers: 1000, base_payment_usd: 10, tier_name: "Small" },
 *   { min_followers: 1001, max_followers: null, base_payment_usd: 25, tier_name: "Large" },
 * ]
 * 
 * validateFollowerTiers(invalidTiers)
 * // Throws: "First tier must start at 500 followers, but starts at 100.
 * //         Accounts with fewer than 500 followers cannot participate to prevent exploitation.
 * //         Minimum 500 followers required to prevent new account exploitation."
 * ```
 */
export function validateFollowerTiers(tiers: FollowerTier[]): void {
  // Rule 1: At least one tier required
  if (tiers.length === 0) {
    throw new Error(
      'At least one follower tier is required. ' +
      'Define payment amounts for different follower count ranges.'
    )
  }

  // Sort tiers by min_followers for validation
  const sortedTiers = [...tiers].sort(
    (a, b) => a.min_followers - b.min_followers
  )

  // Rule 2: First tier must start at 500 followers (prevent new account exploitation)
  const firstTier = sortedTiers[0]
  if (firstTier.min_followers !== 500) {
    throw new Error(
      `First tier must start at 500 followers, but starts at ${firstTier.min_followers.toLocaleString()}. ` +
      `${firstTier.min_followers < 500 ? 'Accounts with fewer than 500 followers cannot participate to prevent exploitation.' : `This would leave follower counts 500-${(firstTier.min_followers - 1).toLocaleString()} without a tier.`} ` +
      'Minimum 500 followers required to prevent new account exploitation.'
    )
  }

  // Rule 3 & 4: Check continuity and open-ended constraint
  for (let i = 0; i < sortedTiers.length - 1; i++) {
    const current = sortedTiers[i]
    const next = sortedTiers[i + 1]

    // Only last tier can be open-ended
    if (current.max_followers === null) {
      throw new Error(
        'Only the last tier can be open-ended (max_followers = null). ' +
        `Tier ${i + 1} "${current.tier_name}" (starting at ${current.min_followers.toLocaleString()} followers) ` +
        'is open-ended but is not the last tier. ' +
        'Move this tier to the end or add a max_followers value.'
      )
    }

    // Check for gaps (tiers must be continuous)
    // If current tier ends at 1000, next tier must start at 1001
    if (current.max_followers + 1 !== next.min_followers) {
      const isGap = current.max_followers + 1 < next.min_followers
      throw new Error(
        `Tiers must be continuous: Tier "${current.tier_name}" ending at ${current.max_followers.toLocaleString()} followers ` +
        `must be followed by tier starting at ${(current.max_followers + 1).toLocaleString()}, ` +
        `but next tier "${next.tier_name}" starts at ${next.min_followers.toLocaleString()}. ` +
        (isGap 
          ? `Gap detected: follower counts ${(current.max_followers + 1).toLocaleString()}-${(next.min_followers - 1).toLocaleString()} have no tier.`
          : `Overlap detected: follower ranges overlap.`)
      )
    }
  }

  // Last tier must be open-ended (represents "10,000+" style unlimited tier)
  const lastTier = sortedTiers[sortedTiers.length - 1]
  if (lastTier.max_followers !== null) {
    throw new Error(
      'Final tier must be open-ended (set max_followers to null for "10,000+" style tiers). ' +
      `Current final tier "${lastTier.tier_name}" ends at ${lastTier.max_followers.toLocaleString()} followers. ` +
      'If someone has more followers, they would have no applicable tier.'
    )
  }

  // Rule 5: All payments must be positive
  for (const tier of tiers) {
    if (tier.base_payment_usd <= 0) {
      throw new Error(
        `Tier "${tier.tier_name}" has invalid payment amount: $${tier.base_payment_usd}. ` +
        'All payment amounts must be greater than 0.'
      )
    }
  }

  // Rule 6: Warn if payments are not in ascending order (common mistake but not invalid)
  for (let i = 0; i < sortedTiers.length - 1; i++) {
    if (sortedTiers[i].base_payment_usd > sortedTiers[i + 1].base_payment_usd) {
      console.warn(
        '[validateFollowerTiers] Warning: Tier payments are not in ascending order. ' +
        `Tier "${sortedTiers[i].tier_name}" ($${sortedTiers[i].base_payment_usd}) ` +
        `pays more than tier "${sortedTiers[i + 1].tier_name}" ($${sortedTiers[i + 1].base_payment_usd}). ` +
        'Typically, larger audiences earn more for greater reach. Verify this is intentional.'
      )
      break // Only warn once
    }
  }
}

// ==================== TIER CALCULATION ====================

/**
 * Determines which payment tier applies based on follower count
 * 
 * Used to calculate instant payment amount when approving submissions.
 * The function finds the tier whose follower range contains the given count.
 * 
 * **Boundary Handling:**
 * - Boundaries are INCLUSIVE: If tier is 500-1000, then 1000 falls IN this tier
 * - Next tier starts at max + 1: If tier ends at 1000, next starts at 1001
 * - Someone with 500 followers falls in first tier (500-1000)
 * - Someone with exactly 1000 followers falls in first tier (500-1000)
 * - Someone with 1001 followers falls in second tier (1001-5000)
 * 
 * **How it works:**
 * - Iterates through tiers to find one where `min <= followerCount <= max`
 * - For open-ended tiers (max = null), any count >= min matches
 * - With properly validated tiers, exactly one tier will always match
 * 
 * @param followerCount - Verified follower count of the worker
 * @param tiers - Array of follower tier configurations (should be validated first)
 * @returns The matching FollowerTier, or null if no tier matches
 * 
 * @example
 * ```typescript
 * const tiers: FollowerTier[] = [
 *   { min_followers: 500,   max_followers: 1000,  base_payment_usd: 10,  tier_name: "Micro" },
 *   { min_followers: 1001,  max_followers: 5000,  base_payment_usd: 25,  tier_name: "Small" },
 *   { min_followers: 5001,  max_followers: 10000, base_payment_usd: 50,  tier_name: "Mid" },
 *   { min_followers: 10001, max_followers: null,  base_payment_usd: 100, tier_name: "Macro" },
 * ]
 * 
 * calculateFollowerTier(500, tiers)    // → Micro tier ($10) - boundary: exactly min
 * calculateFollowerTier(750, tiers)    // → Micro tier ($10)
 * calculateFollowerTier(1000, tiers)   // → Micro tier ($10) - boundary: exactly max
 * calculateFollowerTier(1001, tiers)   // → Small tier ($25) - boundary: exactly min
 * calculateFollowerTier(3500, tiers)   // → Small tier ($25)
 * calculateFollowerTier(8000, tiers)   // → Mid tier ($50)
 * calculateFollowerTier(10001, tiers)  // → Macro tier ($100) - boundary: min of open-ended
 * calculateFollowerTier(50000, tiers)  // → Macro tier ($100) - open-ended tier
 * calculateFollowerTier(1000000, tiers)// → Macro tier ($100) - mega influencer
 * ```
 * 
 * @example
 * ```typescript
 * // Usage in approval flow
 * const submission = await getSubmission(submissionId)
 * const job = await getJob(submission.job_id)
 * 
 * const tier = calculateFollowerTier(
 *   submission.social_follower_count_verified,
 *   job.social_follower_tiers
 * )
 * 
 * if (!tier) {
 *   throw new Error('No matching tier found - invalid tier configuration')
 * }
 * 
 * console.log(`Worker qualifies for ${tier.tier_name} tier: $${tier.base_payment_usd}`)
 * // Proceed with instant payment...
 * ```
 * 
 * @example
 * ```typescript
 * // Edge case handling
 * calculateFollowerTier(-100, tiers)  // → null (negative followers invalid)
 * calculateFollowerTier(500, [])      // → null (no tiers defined)
 * ```
 */
export function calculateFollowerTier(
  followerCount: number,
  tiers: FollowerTier[]
): FollowerTier | null {
  // Edge case: negative follower count is invalid
  if (followerCount < 0) {
    console.error(
      `[calculateFollowerTier] Invalid follower count: ${followerCount}. ` +
      'Follower count must be >= 0.'
    )
    return null
  }

  // Edge case: no tiers defined
  if (tiers.length === 0) {
    console.error('[calculateFollowerTier] No tiers defined')
    return null
  }

  // Sort tiers by min_followers ascending to ensure correct matching
  // This prevents issues if tiers arrive from database in unexpected order
  const sortedTiers = [...tiers].sort(
    (a, b) => a.min_followers - b.min_followers
  )

  for (const tier of sortedTiers) {
    // Check if follower count falls within this tier's range
    // Boundary is INCLUSIVE: min <= followerCount <= max
    if (followerCount >= tier.min_followers) {
      // If max is null (open-ended tier like "10,000+"), or count is within range
      if (tier.max_followers === null || followerCount <= tier.max_followers) {
        return tier
      }
    }
  }

  // Should never reach here with properly validated tiers
  // This can happen if:
  // - Tiers weren't validated (gaps exist)
  // - Invalid follower count
  console.error(
    `[calculateFollowerTier] No matching tier found for ${followerCount.toLocaleString()} followers. ` +
    'Tiers may not be properly validated.'
  )
  return null
}

// ==================== TIER DISPLAY UTILITIES ====================

/**
 * Formats follower tier range for UI display
 * 
 * Creates human-readable strings for displaying tier ranges in UI components.
 * Handles both bounded ranges and open-ended tiers with proper number formatting.
 * 
 * @param tier - Follower tier to format
 * @returns Human-readable range string with thousand separators
 * 
 * @example
 * ```typescript
 * formatFollowerTierRange({ 
 *   min_followers: 500, 
 *   max_followers: 1000, 
 *   base_payment_usd: 10,
 *   tier_name: "Micro" 
 * })
 * // → "500-1,000 followers"
 * 
 * formatFollowerTierRange({ 
 *   min_followers: 1001, 
 *   max_followers: 5000, 
 *   base_payment_usd: 25,
 *   tier_name: "Small" 
 * })
 * // → "1,001-5,000 followers"
 * 
 * formatFollowerTierRange({ 
 *   min_followers: 10001, 
 *   max_followers: null, 
 *   base_payment_usd: 100,
 *   tier_name: "Macro" 
 * })
 * // → "10,001+ followers"
 * ```
 * 
 * @example
 * ```typescript
 * // Usage in job creation form
 * const tierDisplay = tiers.map(tier => ({
 *   range: formatFollowerTierRange(tier),
 *   payment: `$${tier.base_payment_usd}`,
 *   name: tier.tier_name
 * }))
 * 
 * // Display as:
 * // "Micro (500-1,000 followers): $10"
 * // "Small (1,001-5,000 followers): $25"
 * // "Mid (5,001-10,000 followers): $50"
 * // "Macro (10,001+ followers): $100"
 * ```
 */
export function formatFollowerTierRange(tier: FollowerTier): string {
  if (tier.max_followers === null) {
    // Open-ended tier: "10,001+ followers"
    return `${tier.min_followers.toLocaleString()}+ followers`
  }
  
  // Bounded tier: "500-1,000 followers" or "1,001-5,000 followers"
  return `${tier.min_followers.toLocaleString()}-${tier.max_followers.toLocaleString()} followers`
}

/**
 * Creates a complete tier display string with name, range, and payment
 * 
 * Combines tier name, follower range, and payment amount into a single
 * formatted string for UI display.
 * 
 * @param tier - Follower tier to format
 * @returns Complete display string with all tier information
 * 
 * @example
 * ```typescript
 * formatTierDisplay({ 
 *   min_followers: 500, 
 *   max_followers: 1000, 
 *   base_payment_usd: 10,
 *   tier_name: "Micro" 
 * })
 * // → "Micro (500-1,000 followers): $10"
 * 
 * formatTierDisplay({ 
 *   min_followers: 10001, 
 *   max_followers: null, 
 *   base_payment_usd: 100,
 *   tier_name: "Macro" 
 * })
 * // → "Macro (10,001+ followers): $100"
 * ```
 */
export function formatTierDisplay(tier: FollowerTier): string {
  const range = formatFollowerTierRange(tier)
  return `${tier.tier_name} (${range}): $${tier.base_payment_usd}`
}

