/**
 * Centralized caching utility with TTL support
 * Used across the application for consistent caching behavior
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
}

export class Cache<T> {
  private cache: Map<string, CacheEntry<T>>
  private ttl: number

  constructor(ttlMs: number) {
    this.cache = new Map()
    this.ttl = ttlMs
  }

  /**
   * Get cached value if exists and not expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }

  /**
   * Set cache value
   */
  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  /**
   * Check if key exists and not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Delete specific key
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Clean up expired entries (call periodically)
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get or set pattern: fetch from cache or compute and cache
   */
  async getOrSet(
    key: string,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const cached = this.get(key)
    if (cached !== null) {
      return cached
    }

    const data = await fetchFn()
    this.set(key, data)
    return data
  }
}

// Pre-configured caches for different use cases
export const tokenHolderCache = new Cache<{ balance: number; percentage: number }>(
  5 * 60 * 1000 // 5 minutes
)

export const profileCache = new Cache<any>(
  10 * 60 * 1000 // 10 minutes
)

export const presenceCache = new Cache<{ isOnline: boolean; lastSeen: string }>(
  30 * 1000 // 30 seconds
)

// Cleanup expired entries every minute
if (typeof window !== 'undefined') {
  setInterval(() => {
    tokenHolderCache.cleanup()
    profileCache.cleanup()
    presenceCache.cleanup()
  }, 60 * 1000)
}

// Clear all caches on wallet disconnect
export function clearAllCaches(): void {
  tokenHolderCache.clear()
  profileCache.clear()
  presenceCache.clear()
}









