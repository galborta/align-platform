/**
 * Feed Batching Library
 * 
 * Implements intelligent batching of similar activities within time windows.
 * Groups votes, comments, and milestones to reduce feed clutter.
 * 
 * Batching Rules:
 * - Application upvotes: Same application within 5 minutes
 * - Asset upvotes: Same asset within 5 minutes
 * - Job comments: Same job within 5 minutes
 * - Karma milestones: Same milestone level within 5 minutes
 * 
 * @see /lib/feed-transform.ts for data transformation
 * @see /types/feed.ts for FeedItem type definitions
 */

import { FeedItem } from '@/types/feed'

/**
 * Time window for batching similar activities (5 minutes)
 */
const BATCH_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Apply batching logic to feed items
 * 
 * Groups similar activities that occur within 5-minute windows:
 * - Multiple upvotes on same application → single batched item
 * - Multiple upvotes on same asset → single batched item
 * - Multiple comments on same job → single batched item
 * - Multiple users crossing same karma milestone → single batched item
 * 
 * Features:
 * - Uses latest timestamp for batched items (keeps them at top)
 * - Aggregates vote weights for weighted activities
 * - Preserves individual items in batchedItems array for modal
 * - Non-batchable items pass through unchanged
 * 
 * @param items - Array of FeedItems to batch
 * @returns Array of FeedItems with batching applied
 * 
 * @example
 * ```typescript
 * const items = transformToFeedItems(rawData)
 * const batched = applyBatchingLogic(items)
 * 
 * // Before: 45 individual vote items
 * // After: 12 batched vote groups
 * ```
 */
export function applyBatchingLogic(items: FeedItem[]): FeedItem[] {
  // Group items by batchable type + key
  const batchGroups = new Map<string, FeedItem[]>()
  const nonBatchable: FeedItem[] = []

  items.forEach(item => {
    const batchKey = getBatchKey(item)

    if (batchKey) {
      if (!batchGroups.has(batchKey)) {
        batchGroups.set(batchKey, [])
      }
      batchGroups.get(batchKey)!.push(item)
    } else {
      // Item is not batchable, keep as-is
      nonBatchable.push(item)
    }
  })

  // Process each batch group
  const batched: FeedItem[] = []

  batchGroups.forEach((groupItems, key) => {
    // Sort by timestamp (oldest first for window checking)
    groupItems.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    // Create batches within 5-minute windows
    const windows: FeedItem[][] = []
    let currentWindow: FeedItem[] = []
    let windowStart: Date | null = null

    groupItems.forEach(item => {
      if (!windowStart) {
        // Start first window
        windowStart = item.timestamp
        currentWindow.push(item)
      } else {
        const timeDiff = item.timestamp.getTime() - windowStart.getTime()

        if (timeDiff <= BATCH_WINDOW_MS) {
          // Within window, add to current batch
          currentWindow.push(item)
        } else {
          // Outside window, close current and start new
          windows.push(currentWindow)
          currentWindow = [item]
          windowStart = item.timestamp
        }
      }
    })

    // Don't forget last window
    if (currentWindow.length > 0) {
      windows.push(currentWindow)
    }

    // Create batched items from windows
    windows.forEach(window => {
      if (window.length === 1) {
        // No batching needed for single item
        batched.push(window[0])
      } else {
        // Create batched item
        const batchedItem = createBatchedItem(window)
        batched.push(batchedItem)
      }
    })
  })

  // Combine batched and non-batchable items
  const result = [...batched, ...nonBatchable]

  // Sort by timestamp descending (newest first)
  return result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

/**
 * Determine batch key for grouping similar items
 * 
 * Returns a unique key for items that should be batched together.
 * Items with same key and within time window will be merged.
 * 
 * @param item - FeedItem to get batch key for
 * @returns Batch key string or null if item is not batchable
 * 
 * @example
 * ```typescript
 * // Application vote
 * getBatchKey({
 *   type: 'job_application_upvoted',
 *   data: { applicationId: 'app-123' }
 * })
 * // Returns: 'app_votes_app-123'
 * 
 * // Job posted (not batchable)
 * getBatchKey({ type: 'job_posted', ... })
 * // Returns: null
 * ```
 */
function getBatchKey(item: FeedItem): string | null {
  switch (item.type) {
    case 'job_application_upvoted':
      return `app_votes_${item.data.applicationId}`

    case 'asset_upvoted':
      return `asset_votes_${item.data.assetId}`

    case 'job_comment':
      return `comments_${item.data.jobId}`

    case 'karma_milestone':
      return `karma_${item.data.milestone}`

    default:
      return null // Not batchable
  }
}

/**
 * Create single batched item from multiple items
 * 
 * Merges items within a time window into a single FeedItem with:
 * - batchedCount: Number of items merged
 * - batchedItems: Array of individual item details
 * - Aggregated data (e.g., total vote weight)
 * - Latest timestamp from the batch
 * 
 * @param items - Array of items to batch (sorted by timestamp, oldest first)
 * @returns Single batched FeedItem
 */
function createBatchedItem(items: FeedItem[]): FeedItem {
  const firstItem = items[0]
  const lastItem = items[items.length - 1]

  switch (firstItem.type) {
    case 'job_application_upvoted': {
      const totalWeight = items.reduce((sum, item) => sum + (item.data.voteWeight || 0), 0)
      return {
        id: `batched_app_votes_${firstItem.data.applicationId}`,
        type: 'job_application_upvoted',
        timestamp: lastItem.timestamp, // Use latest timestamp
        data: {
          ...firstItem.data,
          totalVoteWeight: totalWeight
        },
        batchedCount: items.length,
        batchedItems: items.map(item => ({
          wallet: item.data.actorWallet,
          weight: item.data.voteWeight,
          timestamp: item.timestamp
        }))
      }
    }

    case 'asset_upvoted': {
      const totalWeight = items.reduce((sum, item) => sum + (item.data.voteWeight || 0), 0)
      return {
        id: `batched_asset_votes_${firstItem.data.assetId}`,
        type: 'asset_upvoted',
        timestamp: lastItem.timestamp, // Use latest timestamp
        data: {
          ...firstItem.data,
          totalVoteWeight: totalWeight
        },
        batchedCount: items.length,
        batchedItems: items.map(item => ({
          wallet: item.data.voterWallet,
          weight: item.data.voteWeight,
          timestamp: item.timestamp
        }))
      }
    }

    case 'job_comment': {
      return {
        id: `batched_comments_${firstItem.data.jobId}`,
        type: 'job_comment',
        timestamp: lastItem.timestamp, // Use latest timestamp
        data: firstItem.data,
        batchedCount: items.length,
        batchedItems: items.map(item => ({
          wallet: item.data.actorWallet,
          message: item.data.message,
          timestamp: item.timestamp
        }))
      }
    }

    case 'karma_milestone': {
      return {
        id: `batched_karma_${firstItem.data.milestone}`,
        type: 'karma_milestone',
        timestamp: lastItem.timestamp, // Use latest timestamp
        data: firstItem.data,
        batchedCount: items.length,
        batchedItems: items.map(item => ({
          wallet: item.data.wallet,
          totalKarma: item.data.totalKarma,
          timestamp: item.timestamp
        }))
      }
    }

    default:
      // Shouldn't happen, but return first item as fallback
      return firstItem
  }
}

/**
 * Get batching statistics for analytics
 * 
 * Returns info about how much batching reduced the feed size.
 * Useful for debugging and monitoring.
 * 
 * @param beforeItems - Items before batching
 * @param afterItems - Items after batching
 * @returns Statistics object
 * 
 * @example
 * ```typescript
 * const before = transformToFeedItems(rawData)
 * const after = applyBatchingLogic(before)
 * const stats = getBatchingStats(before, after)
 * 
 * console.log(stats)
 * // {
 * //   beforeCount: 87,
 * //   afterCount: 52,
 * //   reductionPercent: 40.2,
 * //   batchedItemsCount: 35
 * // }
 * ```
 */
export function getBatchingStats(
  beforeItems: FeedItem[],
  afterItems: FeedItem[]
): {
  beforeCount: number
  afterCount: number
  reductionPercent: number
  batchedItemsCount: number
} {
  const beforeCount = beforeItems.length
  const afterCount = afterItems.length
  const batchedItemsCount = afterItems.filter(item => item.batchedCount && item.batchedCount > 1).length
  const reductionPercent = beforeCount > 0 ? ((beforeCount - afterCount) / beforeCount) * 100 : 0

  return {
    beforeCount,
    afterCount,
    reductionPercent: Math.round(reductionPercent * 10) / 10,
    batchedItemsCount
  }
}

/**
 * Check if an item is batched
 * 
 * @param item - FeedItem to check
 * @returns True if item contains batched data
 */
export function isBatchedItem(item: FeedItem): boolean {
  return !!(item.batchedCount && item.batchedCount > 1)
}

/**
 * Get total count of individual activities in a batched item
 * 
 * @param item - FeedItem to count
 * @returns Total count (including batched items)
 */
export function getTotalActivityCount(item: FeedItem): number {
  return item.batchedCount || 1
}

/**
 * Extract all individual items from a batched item
 * 
 * Useful for modal display when user clicks on batched item.
 * 
 * @param item - Batched FeedItem
 * @returns Array of individual activity details
 */
export function extractBatchedItems(item: FeedItem): any[] {
  return item.batchedItems || []
}



