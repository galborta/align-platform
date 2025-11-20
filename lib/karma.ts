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
  REPORT: 5
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

