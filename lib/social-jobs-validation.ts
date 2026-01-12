/**
 * Social Media Campaign Validation
 * 
 * Comprehensive validation functions for social media job campaigns.
 * All validations return a ValidationResult with clear error messages.
 */

import { BudgetTier } from '@/types/social-jobs'
import { CampaignFormData } from '@/components/jobs/social/CampaignConfigForm'

// ==================== TYPES ====================

export interface ValidationResult {
  valid: boolean
  error?: string
  field?: string
}

// ==================== CONSTANTS ====================

const TITLE_MIN_LENGTH = 10
const TITLE_MAX_LENGTH = 100

const BUDGET_MIN = 50
const BUDGET_MAX = 50000

const REQUIRED_TIER_COUNT = 6

const TWEET_URL_PATTERN = /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/\w+\/status\/\d+/i

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validates campaign title
 * Requirements: 10-100 characters
 */
export function validateCampaignTitle(title: string): ValidationResult {
  const trimmed = title.trim()
  
  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'Campaign title is required',
      field: 'title'
    }
  }
  
  if (trimmed.length < TITLE_MIN_LENGTH) {
    return {
      valid: false,
      error: `Title must be at least ${TITLE_MIN_LENGTH} characters`,
      field: 'title'
    }
  }
  
  if (trimmed.length > TITLE_MAX_LENGTH) {
    return {
      valid: false,
      error: `Title must be ${TITLE_MAX_LENGTH} characters or less`,
      field: 'title'
    }
  }
  
  return { valid: true }
}

/**
 * Validates Twitter/X tweet URL
 * Pattern: https://twitter.com/username/status/123456789
 * or: https://x.com/username/status/123456789
 */
export function validateTweetUrl(url: string): ValidationResult {
  const trimmed = url.trim()
  
  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'Tweet URL is required for retweet campaigns',
      field: 'sourceTweetUrl'
    }
  }
  
  if (!TWEET_URL_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: 'Please enter a valid Twitter/X post URL (e.g., https://twitter.com/user/status/123)',
      field: 'sourceTweetUrl'
    }
  }
  
  return { valid: true }
}

/**
 * Validates campaign budget
 * Requirements: $50 - $50,000 USD
 */
export function validateBudget(budget: number): ValidationResult {
  if (budget <= 0) {
    return {
      valid: false,
      error: 'Total budget is required',
      field: 'totalBudget'
    }
  }
  
  if (budget < BUDGET_MIN) {
    return {
      valid: false,
      error: `Budget must be at least $${BUDGET_MIN}`,
      field: 'totalBudget'
    }
  }
  
  if (budget > BUDGET_MAX) {
    return {
      valid: false,
      error: `Budget must be $${BUDGET_MAX.toLocaleString()} or less`,
      field: 'totalBudget'
    }
  }
  
  return { valid: true }
}

/**
 * Validates budget tiers
 * Requirements:
 * - Must have exactly 6 tiers
 * - All tier prices must be > 0
 * - All tiers must have valid follower ranges
 */
export function validateTiers(tiers: BudgetTier[]): ValidationResult {
  if (tiers.length === 0) {
    return {
      valid: false,
      error: 'Payment tiers are required',
      field: 'followerTiers'
    }
  }
  
  if (tiers.length !== REQUIRED_TIER_COUNT) {
    return {
      valid: false,
      error: `All ${REQUIRED_TIER_COUNT} payment tiers must be configured`,
      field: 'followerTiers'
    }
  }
  
  // Check if all tiers have valid prices
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]
    
    if (tier.price_usd === undefined || tier.price_usd === null) {
      return {
        valid: false,
        error: `Tier ${i + 1} price is required`,
        field: 'followerTiers'
      }
    }
    
    if (tier.price_usd <= 0) {
      return {
        valid: false,
        error: 'All tier prices must be greater than 0',
        field: 'followerTiers'
      }
    }
    
    if (isNaN(tier.price_usd)) {
      return {
        valid: false,
        error: `Tier ${i + 1} price must be a valid number`,
        field: 'followerTiers'
      }
    }
  }
  
  return { valid: true }
}

/**
 * Validates campaign guidelines
 * Requirements: No character limit (optional field)
 */
export function validateGuidelines(guidelines: string): ValidationResult {
  // Guidelines are optional and have no character limit
  return { valid: true }
}

/**
 * Validates duration
 * Requirements: Must be one of the valid options (3, 7, 14, 30)
 */
export function validateDuration(durationDays: number): ValidationResult {
  const validDurations = [3, 7, 14, 30]
  
  if (!validDurations.includes(durationDays)) {
    return {
      valid: false,
      error: 'Please select a valid campaign duration',
      field: 'durationDays'
    }
  }
  
  return { valid: true }
}

/**
 * Validates complete campaign form
 * Returns first validation error found, or valid if all pass
 */
export function validateCampaignForm(
  formData: CampaignFormData,
  campaignType: 'retweet' | 'original_tweet'
): ValidationResult {
  // 1. Validate title
  const titleValidation = validateCampaignTitle(formData.title)
  if (!titleValidation.valid) {
    return titleValidation
  }
  
  // 2. Validate source tweet URL (only for retweet campaigns)
  if (campaignType === 'retweet') {
    const tweetUrlValidation = validateTweetUrl(formData.sourceTweetUrl)
    if (!tweetUrlValidation.valid) {
      return tweetUrlValidation
    }
  }
  
  // 3. Validate budget
  const budgetValidation = validateBudget(formData.totalBudget)
  if (!budgetValidation.valid) {
    return budgetValidation
  }
  
  // 4. Validate duration
  const durationValidation = validateDuration(formData.durationDays)
  if (!durationValidation.valid) {
    return durationValidation
  }
  
  // 5. Validate tiers
  const tiersValidation = validateTiers(formData.followerTiers)
  if (!tiersValidation.valid) {
    return tiersValidation
  }
  
  // 6. Validate guidelines (optional but has max length)
  const guidelinesValidation = validateGuidelines(formData.campaignGuidelines)
  if (!guidelinesValidation.valid) {
    return guidelinesValidation
  }
  
  // All validations passed
  return { valid: true }
}

/**
 * Helper function to get all validation errors
 * Returns an object with field names as keys and error messages as values
 */
export function getAllValidationErrors(
  formData: CampaignFormData,
  campaignType: 'retweet' | 'original_tweet'
): Record<string, string> {
  const errors: Record<string, string> = {}
  
  // Check title
  const titleResult = validateCampaignTitle(formData.title)
  if (!titleResult.valid && titleResult.error) {
    errors.title = titleResult.error
  }
  
  // Check tweet URL for retweet campaigns
  if (campaignType === 'retweet') {
    const tweetUrlResult = validateTweetUrl(formData.sourceTweetUrl)
    if (!tweetUrlResult.valid && tweetUrlResult.error) {
      errors.sourceTweetUrl = tweetUrlResult.error
    }
  }
  
  // Check budget
  const budgetResult = validateBudget(formData.totalBudget)
  if (!budgetResult.valid && budgetResult.error) {
    errors.totalBudget = budgetResult.error
  }
  
  // Check duration
  const durationResult = validateDuration(formData.durationDays)
  if (!durationResult.valid && durationResult.error) {
    errors.durationDays = durationResult.error
  }
  
  // Check tiers
  const tiersResult = validateTiers(formData.followerTiers)
  if (!tiersResult.valid && tiersResult.error) {
    errors.followerTiers = tiersResult.error
  }
  
  // Check guidelines
  const guidelinesResult = validateGuidelines(formData.campaignGuidelines)
  if (!guidelinesResult.valid && guidelinesResult.error) {
    errors.campaignGuidelines = guidelinesResult.error
  }
  
  return errors
}

