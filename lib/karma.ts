/**
 * KARMA SYSTEM - NEW SYSTEM (December 2024)
 * - Removed tier multipliers from all job-related actions
 * - Worker completion karma: USD × 50
 * - Poster completion karma: USD × 20
 * - Voting bonuses: flat 50 karma
 * - Penalties scale with job value
 * - Old karma is grandfathered (not recalculated)
 */

// Tier multipliers based on token percentage
// NOTE: These are still used for SOCIAL ASSET curation (add/upvote/report)
// but NO LONGER used for job-related actions as of December 2024
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
  // Social assets - tier multipliers still apply for curation quality
  ADD_ASSET: 100,
  UPVOTE: 10,
  REPORT: 5,
  
  // Job System Karma - NEW SYSTEM (no base karma, only completion rewards)
  POST_JOB: 0,              // Poster gets only completion karma
  APPLY_TO_JOB: 0,          // Worker gets only completion karma
  UPVOTE_APPLICATION: 5,    // Reduced from 10
  COMPLETE_JOB_POSTER: 0,   // Calculated separately
  COMPLETE_JOB_WORKER: 0,   // Calculated separately
  VOTE_ON_DISPUTE: 5,
  CANCEL_JOB: 0,            // Calculated based on USD value
  FAIL_TO_DELIVER: 0        // Calculated based on USD value
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
 * Worker earns: USD × 50
 * Poster earns: USD × 20
 * NEW SYSTEM (2024): No tier multipliers on job completion
 */
export function calculateJobCompletionKarma(usdValue: number, isWorker: boolean = true): number {
  if (isWorker) {
    return Math.floor(usdValue * 50)  // Worker: full reward for doing the work
  } else {
    return Math.floor(usdValue * 20)  // Poster: reduced reward for creating opportunity
  }
}

/**
 * Calculate bonus karma for correct application upvote
 * Flat 50 karma bonus if your pick wins and completes
 * NEW SYSTEM (2024): Flat bonus instead of USD-based to prevent voting farming
 */
export function calculateApplicationUpvoteBonusKarma(usdValue: number): number {
  return 50  // Flat bonus regardless of job value
}

/**
 * Calculate bonus karma for correct dispute vote
 * Flat 50 karma bonus if you voted with winning side
 * NEW SYSTEM (2024): Flat bonus instead of USD-based to prevent voting farming
 */
export function calculateDisputeVoteBonusKarma(usdValue: number): number {
  return 50  // Flat bonus regardless of job value
}

/**
 * Calculate penalty for job cancellation
 * NEW SYSTEM (2024): Scales with job value to properly deter cancellations
 */
export function calculateCancellationPenalty(usdValue: number): number {
  return -Math.floor(usdValue * 5)  // Example: $100 job = -500 karma
}

/**
 * Calculate penalty for failing to deliver
 * NEW SYSTEM (2024): Scales with job value, higher than cancellation
 */
export function calculateFailurePenalty(usdValue: number): number {
  return -Math.floor(usdValue * 10)  // Example: $100 job = -1,000 karma
}

/**
 * Calculate karma for job-related action
 * NEW SYSTEM (2024): NO tier multipliers on job actions - everyone earns same for same work
 * 
 * @param action - The job action being performed
 * @param isImmediate - True for immediate 25%, false for delayed 75%
 * @returns Calculated karma points
 */
export function calculateJobKarma(
  action: keyof typeof BASE_KARMA,
  isImmediate: boolean = true
): number {
  const baseKarma = BASE_KARMA[action]
  if (baseKarma === 0) return 0 // USD-based, calculated separately

  // Apply immediate/delayed split (25% immediate, 75% delayed)
  const splitMultiplier = isImmediate ? 0.25 : 0.75

  return Math.floor(baseKarma * splitMultiplier)
}
