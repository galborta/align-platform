/**
 * Feed Utilities Library
 * 
 * Helper functions for managing real-time feed updates.
 * Handles deduplication, batching, memory management, and freshness.
 * 
 * @see /components/ActivityFeed.tsx for usage
 * @see /lib/feed-batching.ts for initial batching logic
 */

import { FeedItem } from '@/types/feed'

/**
 * Deduplicate feed items by ID
 * 
 * Removes duplicate items from array while preserving order.
 * Uses Set for O(n) performance.
 * 
 * @param items - Array of feed items (may contain duplicates)
 * @returns Array with duplicates removed
 * 
 * @example
 * ```typescript
 * const items = [item1, item2, item1] // item1 appears twice
 * const unique = deduplicateFeedItems(items)
 * // Returns: [item1, item2]
 * ```
 */
export function deduplicateFeedItems(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>()
  const unique: FeedItem[] = []
  
  items.forEach(item => {
    if (!seen.has(item.id)) {
      seen.add(item.id)
      unique.push(item)
    }
  })
  
  return unique
}

/**
 * Check if two items should be batched together
 * 
 * Determines if items are similar enough to merge based on:
 * - Same activity type
 * - Within 5-minute time window
 * - Same target (application, asset, job, milestone)
 * 
 * @param item1 - First feed item
 * @param item2 - Second feed item
 * @returns True if items should be batched
 * 
 * @example
 * ```typescript
 * const vote1 = { type: 'job_application_upvoted', data: { applicationId: '123' }, ... }
 * const vote2 = { type: 'job_application_upvoted', data: { applicationId: '123' }, ... }
 * shouldBatch(vote1, vote2) // true - same application, same type
 * ```
 */
export function shouldBatch(item1: FeedItem, item2: FeedItem): boolean {
  // Same type check
  if (item1.type !== item2.type) return false
  
  // Time window check (5 minutes = 300000ms)
  const timeDiff = Math.abs(item1.timestamp.getTime() - item2.timestamp.getTime())
  if (timeDiff > 5 * 60 * 1000) return false
  
  // Type-specific target matching
  switch (item1.type) {
    case 'job_application_upvoted':
      return item1.data.applicationId === item2.data.applicationId
    
    case 'asset_upvoted':
      return item1.data.assetId === item2.data.assetId
    
    case 'job_comment':
      return item1.data.jobId === item2.data.jobId
    
    case 'karma_milestone':
      return item1.data.milestone === item2.data.milestone
    
    default:
      return false
  }
}

/**
 * Merge a new item into existing batched item
 * 
 * Combines a real-time item with an existing batch or creates new batch.
 * Updates batch count, aggregates vote weights, and uses latest timestamp.
 * 
 * @param existing - Existing feed item (may or may not be batched)
 * @param newItem - New item to merge in
 * @returns Updated batched item
 * 
 * @example
 * ```typescript
 * const existing = { type: 'asset_upvoted', batchedCount: 2, ... }
 * const newVote = { type: 'asset_upvoted', data: { voteWeight: 5 }, ... }
 * const merged = mergeIntoBatch(existing, newVote)
 * // merged.batchedCount === 3
 * // merged.data.totalVoteWeight updated
 * ```
 */
export function mergeIntoBatch(existing: FeedItem, newItem: FeedItem): FeedItem {
  // If existing isn't batched yet, convert it
  if (!existing.batchedItems) {
    existing = {
      ...existing,
      batchedCount: 1,
      batchedItems: [{
        wallet: existing.data.actorWallet || existing.data.voterWallet || existing.data.wallet,
        weight: existing.data.voteWeight,
        timestamp: existing.timestamp,
        message: existing.data.message
      }]
    }
  }
  
  // Create batched item entry for new item
  const newBatchedItem: any = {
    wallet: newItem.data.actorWallet || newItem.data.voterWallet || newItem.data.wallet,
    timestamp: newItem.timestamp
  }
  
  // Add weight if it's a vote
  if (newItem.data.voteWeight !== undefined) {
    newBatchedItem.weight = newItem.data.voteWeight
  }
  
  // Add message if it's a comment
  if (newItem.data.message) {
    newBatchedItem.message = newItem.data.message
  }
  
  // Merge into existing batch
  return {
    ...existing,
    timestamp: newItem.timestamp, // Use latest timestamp to bubble to top
    batchedCount: (existing.batchedCount || 1) + 1,
    batchedItems: [...(existing.batchedItems || []), newBatchedItem],
    data: {
      ...existing.data,
      // Update aggregated vote weight if applicable
      totalVoteWeight: newItem.data.voteWeight 
        ? (existing.data.totalVoteWeight || existing.data.voteWeight || 0) + newItem.data.voteWeight
        : existing.data.totalVoteWeight
    }
  }
}

/**
 * Limit feed items to prevent memory bloat
 * 
 * Truncates feed to maximum number of items.
 * Keeps newest items (assumes already sorted by timestamp desc).
 * 
 * @param items - Array of feed items
 * @param maxItems - Maximum items to keep (default: 100)
 * @returns Truncated array
 * 
 * @example
 * ```typescript
 * const items = [...150 items...]
 * const limited = limitFeedItems(items, 100)
 * // Returns first 100 items (newest)
 * ```
 */
export function limitFeedItems(items: FeedItem[], maxItems: number = 100): FeedItem[] {
  if (items.length <= maxItems) return items
  return items.slice(0, maxItems)
}

/**
 * Check if item is fresh (< 10 seconds old)
 * 
 * Used to show "NEW" badges or highlight recent items.
 * 
 * @param item - Feed item to check
 * @returns True if item created within last 10 seconds
 * 
 * @example
 * ```typescript
 * const item = { timestamp: new Date(), ... }
 * if (isFreshItem(item)) {
 *   // Show "NEW" badge
 * }
 * ```
 */
export function isFreshItem(item: FeedItem): boolean {
  return (Date.now() - item.timestamp.getTime()) < 10000
}

/**
 * Sort feed items by timestamp descending (newest first)
 * 
 * Creates new sorted array without mutating original.
 * 
 * @param items - Array of feed items
 * @returns New sorted array (newest first)
 * 
 * @example
 * ```typescript
 * const items = [oldItem, newItem, midItem]
 * const sorted = sortFeedItems(items)
 * // Returns: [newItem, midItem, oldItem]
 * ```
 */
export function sortFeedItems(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

/**
 * Find existing item that should batch with new item
 * 
 * Searches through existing items to find batch target.
 * Returns first match found.
 * 
 * @param newItem - New item to find batch target for
 * @param existingItems - Array of existing feed items
 * @returns Matching item or null if no match
 * 
 * @example
 * ```typescript
 * const newVote = { type: 'asset_upvoted', data: { assetId: '123' }, ... }
 * const existing = [item1, item2, matchingVote, item4]
 * const target = findBatchTarget(newVote, existing)
 * // Returns: matchingVote
 * ```
 */
export function findBatchTarget(
  newItem: FeedItem, 
  existingItems: FeedItem[]
): FeedItem | null {
  for (const existing of existingItems) {
    if (shouldBatch(existing, newItem)) {
      return existing
    }
  }
  return null
}

/**
 * Get a unique stable ID for a feed item (handles timestamp collisions)
 * 
 * Combines item ID with timestamp to ensure uniqueness.
 * Useful for React keys in scenarios where IDs might repeat.
 * 
 * @param item - Feed item
 * @returns Stable unique ID string
 * 
 * @example
 * ```typescript
 * const item = { id: 'job_posted_123', timestamp: new Date(), ... }
 * const stableId = getStableItemId(item)
 * // Returns: 'job_posted_123_1732645200000'
 * ```
 */
export function getStableItemId(item: FeedItem): string {
  return `${item.id}_${item.timestamp.getTime()}`
}

/**
 * Smart merge of new items into existing feed
 * 
 * Handles:
 * - Deduplication
 * - Batch detection and merging
 * - Sorting
 * - Memory limits
 * 
 * This is the main function to use when adding real-time items.
 * 
 * @param newItems - Array of new items to add
 * @param existingItems - Current feed items
 * @param maxItems - Maximum feed size (default: 100)
 * @returns Updated feed with new items merged
 * 
 * @example
 * ```typescript
 * const newVotes = [vote1, vote2, vote3]
 * const currentFeed = [...50 items...]
 * const updated = smartMergeFeedItems(newVotes, currentFeed)
 * // Returns merged, batched, sorted, and limited feed
 * ```
 */
export function smartMergeFeedItems(
  newItems: FeedItem[],
  existingItems: FeedItem[],
  maxItems: number = 100
): FeedItem[] {
  // Start with existing items
  let merged = [...existingItems]
  
  // Process each new item
  newItems.forEach(newItem => {
    // Check if item already exists (deduplication)
    const isDuplicate = merged.some(item => item.id === newItem.id)
    if (isDuplicate) {
      console.log('Skipping duplicate item:', newItem.id)
      return
    }
    
    // Check if new item should batch with existing
    const batchTarget = findBatchTarget(newItem, merged)
    
    if (batchTarget) {
      // Merge into existing batch
      console.log('Batching item with existing:', newItem.id, '→', batchTarget.id)
      const batchIndex = merged.findIndex(item => item.id === batchTarget.id)
      merged[batchIndex] = mergeIntoBatch(batchTarget, newItem)
    } else {
      // Add as new item
      console.log('Adding new item to feed:', newItem.id)
      merged.push(newItem)
    }
  })
  
  // Sort by timestamp (newest first)
  merged = sortFeedItems(merged)
  
  // Limit to max items
  merged = limitFeedItems(merged, maxItems)
  
  return merged
}

/**
 * Calculate statistics about feed composition
 * 
 * Useful for analytics and debugging.
 * 
 * @param items - Array of feed items
 * @returns Statistics object
 * 
 * @example
 * ```typescript
 * const stats = getFeedStats(feedItems)
 * console.log(stats)
 * // {
 * //   totalItems: 45,
 * //   batchedItems: 8,
 * //   individualItems: 37,
 * //   totalActivities: 103,
 * //   freshItems: 2
 * // }
 * ```
 */
export function getFeedStats(items: FeedItem[]): {
  totalItems: number
  batchedItems: number
  individualItems: number
  totalActivities: number
  freshItems: number
} {
  const totalItems = items.length
  const batchedItems = items.filter(item => item.batchedCount && item.batchedCount > 1).length
  const individualItems = totalItems - batchedItems
  const totalActivities = items.reduce((sum, item) => sum + (item.batchedCount || 1), 0)
  const freshItems = items.filter(isFreshItem).length
  
  return {
    totalItems,
    batchedItems,
    individualItems,
    totalActivities,
    freshItems
  }
}

/**
 * Validate feed item structure
 * 
 * Checks if item has required fields and valid data.
 * Useful for error handling and debugging.
 * 
 * @param item - Feed item to validate
 * @returns True if valid, false otherwise
 * 
 * @example
 * ```typescript
 * if (!isValidFeedItem(item)) {
 *   console.error('Invalid item:', item)
 *   return
 * }
 * ```
 */
export function isValidFeedItem(item: any): item is FeedItem {
  return !!(
    item &&
    typeof item.id === 'string' &&
    typeof item.type === 'string' &&
    item.timestamp instanceof Date &&
    item.data &&
    typeof item.data === 'object'
  )
}

/**
 * Get batching type for an activity type
 * 
 * Returns whether an activity type can be batched.
 * 
 * @param type - Activity type
 * @returns 'batchable' or 'individual'
 */
export function getBatchingType(type: FeedItem['type']): 'batchable' | 'individual' {
  const batchableTypes: FeedItem['type'][] = [
    'job_application_upvoted',
    'asset_upvoted',
    'job_comment',
    'karma_milestone'
  ]
  
  return batchableTypes.includes(type) ? 'batchable' : 'individual'
}









