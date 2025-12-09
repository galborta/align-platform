/**
 * Simple in-memory rate limiting for API endpoints
 * 
 * Note: For production with multiple server instances,
 * consider using Redis or a distributed rate limiting solution
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

interface RateLimitStore {
  [key: string]: RateLimitEntry
}

const store: RateLimitStore = {}

export const RATE_LIMITS = {
  payment: { requests: 5, window: 60000 },   // 5 requests per minute
  admin: { requests: 20, window: 60000 },    // 20 requests per minute
  mutation: { requests: 30, window: 60000 }, // 30 requests per minute
  submission: { requests: 10, window: 60000 }, // 10 submissions per minute
  tip: { requests: 20, window: 60000 }       // 20 tips per minute
} as const

export type RateLimitType = keyof typeof RATE_LIMITS

interface RateLimitResult {
  success: boolean
  error?: string
  status?: number
  remaining?: number
  resetIn?: number
}

/**
 * Check rate limit for an identifier (user ID, wallet, or IP)
 * 
 * @param identifier - Unique identifier for the requester
 * @param limitType - Type of rate limit to apply
 * @returns Object with success status and optional error
 */
export function rateLimit(
  identifier: string,
  limitType: RateLimitType = 'mutation'
): RateLimitResult {
  const now = Date.now()
  const limit = RATE_LIMITS[limitType]
  const key = `${identifier}:${limitType}`

  // Initialize or reset if window expired
  if (!store[key] || now > store[key].resetTime) {
    store[key] = {
      count: 1,
      resetTime: now + limit.window
    }
    return { 
      success: true,
      remaining: limit.requests - 1,
      resetIn: Math.ceil(limit.window / 1000)
    }
  }

  // Increment counter
  store[key].count++

  // Check if over limit
  if (store[key].count > limit.requests) {
    const resetIn = Math.ceil((store[key].resetTime - now) / 1000)
    return {
      success: false,
      error: `Rate limit exceeded. Try again in ${resetIn} seconds`,
      status: 429,
      remaining: 0,
      resetIn
    }
  }

  return { 
    success: true,
    remaining: limit.requests - store[key].count,
    resetIn: Math.ceil((store[key].resetTime - now) / 1000)
  }
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(
  identifier: string,
  limitType: RateLimitType = 'mutation'
): { remaining: number; resetIn: number } {
  const now = Date.now()
  const limit = RATE_LIMITS[limitType]
  const key = `${identifier}:${limitType}`

  if (!store[key] || now > store[key].resetTime) {
    return {
      remaining: limit.requests,
      resetIn: Math.ceil(limit.window / 1000)
    }
  }

  return {
    remaining: Math.max(0, limit.requests - store[key].count),
    resetIn: Math.ceil((store[key].resetTime - now) / 1000)
  }
}

/**
 * Reset rate limit for an identifier (useful for testing)
 */
export function resetRateLimit(identifier: string, limitType?: RateLimitType): void {
  if (limitType) {
    const key = `${identifier}:${limitType}`
    delete store[key]
  } else {
    // Reset all limits for this identifier
    Object.keys(store).forEach(key => {
      if (key.startsWith(`${identifier}:`)) {
        delete store[key]
      }
    })
  }
}

// Clean up old entries periodically (every 5 minutes)
// Only runs in Node.js environment (server-side)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    Object.keys(store).forEach(key => {
      if (now > store[key].resetTime) {
        delete store[key]
      }
    })
  }, 300000)
}
