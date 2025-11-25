// Tier multipliers based on token percentage
export const TIER_MULTIPLIERS = {
  mega: { min: 5.0, multiplier: 7 },
  whale: { min: 1.0, multiplier: 5.5 },
  holder: { min: 0.1, multiplier: 3 },
  small: { min: 0.0, multiplier: 1 }
}

export function getTier(supplyPercentage: number): {
  name: string
  multiplier: number
} {
  if (supplyPercentage >= 5.0) return { name: 'mega', multiplier: 7 }
  if (supplyPercentage >= 1.0) return { name: 'whale', multiplier: 5.5 }
  if (supplyPercentage >= 0.1) return { name: 'holder', multiplier: 3 }
  return { name: 'small', multiplier: 1 }
}

// Base karma points (before tier multiplier)
export const BASE_KARMA = {
  ADD_ASSET: 100,
  UPVOTE: 10,
  REPORT: 5,
  // Job System Karma
  POST_JOB: 50,              // Posting a job
  APPLY_TO_JOB: 50,          // Applying to a job
  UPVOTE_APPLICATION: 10,    // Upvoting an application
  COMPLETE_JOB_POSTER: 0,    // Base for poster (calculated from USD)
  COMPLETE_JOB_WORKER: 0,    // Base for worker (calculated from USD)
  VOTE_ON_DISPUTE: 5,        // Voting on a dispute
  CANCEL_JOB: -50,           // Cancelling a job (penalty)
  FAIL_TO_DELIVER: -50       // Worker ghost/dispute lost
}

// Immediate reward percentage (rest awarded on verification)
export const IMMEDIATE_REWARD_PCT = 0.25 // 25%

export function calculateKarma(
  action: 'add' | 'upvote' | 'report',
  supplyPercentage: number,
  immediate: boolean = false
): number {
  const tier = getTier(supplyPercentage)
  
  let baseAmount = 0
  if (action === 'add') baseAmount = BASE_KARMA.ADD_ASSET
  if (action === 'upvote') baseAmount = BASE_KARMA.UPVOTE
  if (action === 'report') baseAmount = BASE_KARMA.REPORT
  
  const totalKarma = baseAmount * tier.multiplier
  
  if (immediate) {
    return totalKarma * IMMEDIATE_REWARD_PCT
  }
  
  return totalKarma * (1 - IMMEDIATE_REWARD_PCT)
}

// Verification thresholds
export const THRESHOLDS = {
  BACKED: {
    supply: 0.5, // 0.5% of supply
    voters: 5    // OR 5 unique voters
  },
  VERIFIED: {
    supply: 5.0, // 5% of supply
    voters: 10   // OR 10 unique voters
  }
}

export function checkVerificationStatus(
  supplyWeight: number,
  voterCount: number
): 'pending' | 'backed' | 'verified' {
  if (
    supplyWeight >= THRESHOLDS.VERIFIED.supply ||
    voterCount >= THRESHOLDS.VERIFIED.voters
  ) {
    return 'verified'
  }
  
  if (
    supplyWeight >= THRESHOLDS.BACKED.supply ||
    voterCount >= THRESHOLDS.BACKED.voters
  ) {
    return 'backed'
  }
  
  return 'pending'
}

// Hidden thresholds (for reports)
export const HIDDEN_THRESHOLDS = {
  PENDING: {
    supply: 2.0,  // 2% supply
    reporters: 3  // OR 3 reporters
  },
  BACKED: {
    supply: 3.0,  // 3% supply
    reporters: 5  // OR 5 reporters
  },
  VERIFIED: {
    supply: 10.0, // 10% supply
    reporters: 15 // OR 15 reporters
  }
}

export function checkHiddenStatus(
  currentStatus: 'pending' | 'backed' | 'verified',
  reportWeight: number,
  reporterCount: number
): boolean {
  const threshold = HIDDEN_THRESHOLDS[currentStatus.toUpperCase() as keyof typeof HIDDEN_THRESHOLDS]
  
  return (
    reportWeight >= threshold.supply ||
    reporterCount >= threshold.reporters
  )
}

// Warning system
export const WARNING_CONFIG = {
  BAN_AT_ZERO_KARMA: 2,  // 2 warnings when karma = 0
  BAN_WITH_KARMA: 3,      // 3 warnings when karma > 0
  WARNING_DECAY_DAYS: 30, // Warnings expire after 30 days
  WARNING_ACTIVE_DAYS: 90 // Only warnings within 90 days count toward ban
}

export function checkBanStatus(
  karma: number,
  warnings: Array<{ timestamp: string; reason: string }>
): { shouldBan: boolean; reason?: string } {
  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  
  // Count active warnings (within 90 days)
  const activeWarnings = warnings.filter(w => 
    new Date(w.timestamp) > ninetyDaysAgo
  )
  
  if (karma <= 0 && activeWarnings.length >= WARNING_CONFIG.BAN_AT_ZERO_KARMA) {
    return { shouldBan: true, reason: 'Zero karma with 2+ warnings' }
  }
  
  if (activeWarnings.length >= WARNING_CONFIG.BAN_WITH_KARMA) {
    return { shouldBan: true, reason: '3+ active warnings' }
  }
  
  return { shouldBan: false }
}

// ==================== JOB SYSTEM KARMA FUNCTIONS ====================

/**
 * Calculate karma for job completion based on USD value
 * Both poster and worker earn: (USD value × 50) karma
 * Example: $50 job = 2,500 karma each
 */
export function calculateJobCompletionKarma(usdValue: number): number {
  return Math.floor(usdValue * 50)
}

/**
 * Calculate bonus karma for correct application upvote
 * Voter earns: (USD value × 10) karma if their pick wins and completes
 * Example: $50 job completes, you upvoted winner = +500 bonus
 */
export function calculateApplicationUpvoteBonusKarma(usdValue: number): number {
  return Math.floor(usdValue * 10)
}

/**
 * Calculate bonus karma for correct dispute vote
 * Voter earns: (USD value × 10) karma if they voted with winning side
 */
export function calculateDisputeVoteBonusKarma(usdValue: number): number {
  return Math.floor(usdValue * 10)
}

/**
 * Calculate total karma for job-related action
 * Applies tier multiplier to base karma (except USD-based calculations)
 * 
 * @param action - The job action being performed
 * @param tokenPercentage - User's token percentage of supply
 * @param isImmediate - True for immediate 25%, false for delayed 75%
 * @returns Calculated karma points
 */
export function calculateJobKarma(
  action: keyof typeof BASE_KARMA,
  tokenPercentage: number,
  isImmediate: boolean = true
): number {
  const baseKarma = BASE_KARMA[action]
  if (baseKarma === 0) return 0 // USD-based, calculated separately

  const tier = getTier(tokenPercentage)
  const multiplier = tier.multiplier

  // Apply immediate/delayed split (25% immediate, 75% delayed)
  const splitMultiplier = isImmediate ? 0.25 : 0.75

  return Math.floor(baseKarma * multiplier * splitMultiplier)
}


