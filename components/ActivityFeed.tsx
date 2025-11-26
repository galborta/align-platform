'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { FeedItem as FeedItemType, ActivityFeedProps } from '@/types/feed'
import { FeedItem } from './FeedItem'
import { FeedSkeleton } from './FeedSkeleton'
import { FeedEmptyState } from './FeedEmptyState'
import { BatchedActivityModal } from './BatchedActivityModal'
import { fetchInitialFeed } from '@/lib/feed-queries'
import { transformToFeedItems, transformSubscriptionEvent } from '@/lib/feed-transform'
import { applyBatchingLogic } from '@/lib/feed-batching'
import { setupFeedSubscriptions } from '@/lib/feed-subscriptions'
import { 
  deduplicateFeedItems,
  findBatchTarget,
  mergeIntoBatch,
  limitFeedItems,
  sortFeedItems,
  getFeedStats
} from '@/lib/feed-utils'


/**
 * ActivityFeed - Main container component for the activity feed
 * 
 * Displays a real-time feed of project activities including:
 * - Job postings, applications, and completions
 * - Asset submissions and verifications
 * - Tips and karma milestones
 * 
 * Features:
 * - Infinite scroll with "Load more" button
 * - Batching of similar activities
 * - Real-time updates via Supabase subscriptions
 * - Loading and empty states
 * 
 * @example
 * ```tsx
 * <ActivityFeed projectId="project-uuid-123" />
 * ```
 */
export function ActivityFeed({ projectId }: ActivityFeedProps) {
  const [feedItems, setFeedItems] = useState<FeedItemType[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<FeedItemType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const subscriptionCleanup = useRef<(() => void) | null>(null)
  
  // Pagination state
  const [currentOffset, setCurrentOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [allItemsLoaded, setAllItemsLoaded] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  
  // Refs for optimization
  const loadMoreTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null)
  
  // Analytics tracking
  const initialLoadTime = useRef<number>(Date.now())
  
  // Adaptive batch size based on screen height
  const ITEMS_PER_PAGE = typeof window !== 'undefined' && window.innerHeight > 1000 ? 30 : 20
  const MAX_RETRIES = 3

  // Handler for new real-time events
  const handleNewActivity = useCallback((event: any) => {
    console.log('🔔 New activity event:', event)
    
    // Transform subscription event to FeedItem(s)
    const newItems = transformSubscriptionEvent(event)
    
    if (newItems.length === 0) {
      console.warn('No items transformed from event:', event)
      return
    }
    
    const newItem = newItems[0]
    
    // Real-time items are prepended to the TOP of the feed
    // This does NOT affect pagination offset tracking
    // Pagination offset tracks items loaded via "load more" only
    // This separation ensures pagination stays consistent even with real-time updates
    setFeedItems(prevItems => {
      // Check if this item should batch with an existing item
      const batchTarget = findBatchTarget(newItem, prevItems)
      
      if (batchTarget) {
        // Merge into existing batch
        console.log('📦 Batching new item with existing:', batchTarget.id)
        const updated = prevItems.map(item => 
          item.id === batchTarget.id ? mergeIntoBatch(item, newItem) : item
        )
        
        // Sort to move updated batch to top
        return sortFeedItems(updated)
      } else {
        // Add as new item at top (prepend)
        console.log('➕ Adding new feed item:', newItem.id)
        const combined = [newItem, ...prevItems]
        
        // Deduplicate, limit, and sort
        const deduplicated = deduplicateFeedItems(combined)
        const limited = limitFeedItems(deduplicated, 100)
        return sortFeedItems(limited)
      }
    })
  }, [])

  // Load initial feed items and setup real-time subscriptions
  useEffect(() => {
    async function loadFeed() {
      if (!projectId) return

      setLoading(true)
      setError(null)
      
      // Reset analytics timestamp for this load
      initialLoadTime.current = Date.now()

      try {
        console.log('🔄 Starting feed load for project:', projectId)

        // Fetch raw data from all tables (10 parallel queries)
        // Using adaptive batch size based on screen height
        const rawData = await fetchInitialFeed(projectId, ITEMS_PER_PAGE, 0)
        console.log('✅ Raw data fetched:', {
          jobs: rawData.jobs.length,
          applications: rawData.applications.length,
          applicationVotes: rawData.applicationVotes.length,
          comments: rawData.comments.length,
          submissions: rawData.submissions.length,
          disputes: rawData.disputes.length,
          assets: rawData.assets.length,
          assetVotes: rawData.assetVotes.length,
          tips: rawData.tips.length,
          karmaMilestones: rawData.karmaMilestones.length
        })

        // Transform to unified FeedItem format
        const items = transformToFeedItems(rawData)
        console.log('✅ Items transformed:', items.length)

        // Apply intelligent batching
        const batched = applyBatchingLogic(items)
        console.log('✅ Batching applied:', {
          before: items.length,
          after: batched.length,
          reduction: `${Math.round(((items.length - batched.length) / items.length) * 100)}%`
        })

        // Take first batch of items for initial display (adaptive based on screen size)
        const initialItems = batched.slice(0, ITEMS_PER_PAGE)

        setFeedItems(initialItems)
        setHasMore(batched.length > ITEMS_PER_PAGE)
        setCurrentOffset(0) // Reset offset for pagination
        setAllItemsLoaded(false) // Reset all loaded flag
        setLoading(false)

        console.log('Feed loading state:', {
          loading: false,
          itemsCount: initialItems.length,
          hasMore: batched.length > 20,
          error: null
        })

        // Setup real-time subscriptions AFTER initial load
        // Small delay to avoid race conditions with initial data
        setTimeout(() => {
          console.log('🔌 Setting up real-time subscriptions')
          try {
            const cleanup = setupFeedSubscriptions(projectId, handleNewActivity)
            subscriptionCleanup.current = cleanup
            setIsConnected(true)
          } catch (err) {
            console.error('Failed to setup subscriptions:', err)
            setIsConnected(false)
          }
        }, 1000)

      } catch (err) {
        console.error('❌ Error loading feed:', err)
        setError('Failed to load activity feed. Please try refreshing.')
        setLoading(false)
        setIsConnected(false)

        console.log('Feed loading state:', {
          loading: false,
          itemsCount: 0,
          hasMore: false,
          error: 'Failed to load activity feed'
        })
      }
    }

    loadFeed()

    // Cleanup subscriptions on unmount or projectId change
    return () => {
      if (subscriptionCleanup.current) {
        console.log('🔌 Cleaning up subscriptions')
        subscriptionCleanup.current()
        subscriptionCleanup.current = null
        setIsConnected(false)
      }
    }
  }, [projectId, handleNewActivity])

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || allItemsLoaded || !projectId) return

    setLoadingMore(true)
    const nextOffset = currentOffset + ITEMS_PER_PAGE
    console.log('📖 Loading more items, offset:', nextOffset, 'batch size:', ITEMS_PER_PAGE)

    // Analytics: Track performance
    const loadStartTime = Date.now()

    try {
      // Fetch next batch of items (adaptive batch size)
      const rawData = await fetchInitialFeed(projectId, ITEMS_PER_PAGE, nextOffset)
      const newItems = transformToFeedItems(rawData)
      const batched = applyBatchingLogic(newItems)

      console.log(`📥 Loaded ${batched.length} new items`)

      // Analytics: Calculate performance metrics
      const loadTime = Date.now() - loadStartTime
      console.log('⚡ Pagination Performance:', {
        loadTimeMs: loadTime,
        itemsLoaded: batched.length,
        itemsPerSecond: batched.length / (loadTime / 1000)
      })

      // Alert if performance is slow
      if (loadTime > 2000) {
        console.warn('⚠️ Slow pagination load detected:', loadTime, 'ms')
      }

      if (batched.length === 0) {
        // No more items to load
        setAllItemsLoaded(true)
        setHasMore(false)
        setLoadingMore(false)
        
        // Analytics: Track end of feed reached
        console.log('🏁 User reached end of feed:', {
          totalItemsViewed: feedItems.length,
          paginationLoads: Math.floor(currentOffset / ITEMS_PER_PAGE),
          timeFromInitialLoad: Date.now() - initialLoadTime.current,
          timestamp: new Date().toISOString()
        })
        
        return
      }

      // Append new items to existing feed
      setFeedItems(prevItems => {
        const combined = [...prevItems, ...batched]

        // Deduplicate in case of overlap with real-time items
        const deduplicated = deduplicateFeedItems(combined)

        // Limit to 200 total items in memory to prevent bloat
        const limited = limitFeedItems(deduplicated, 200)

        return limited
      })

      // Update offset for next load (tracks pagination items only, not real-time)
      setCurrentOffset(nextOffset)

      // Analytics: Track successful pagination usage
      // TODO: Replace console.log with actual analytics service
      // analytics.track('pagination_load_more', { items_loaded: batched.length, current_offset: nextOffset })
      console.log('📊 Pagination Analytics:', {
        event: 'load_more_clicked',
        currentItemsCount: feedItems.length,
        newItemsLoaded: batched.length,
        currentOffset: nextOffset,
        batchSize: ITEMS_PER_PAGE,
        timestamp: new Date().toISOString()
      })

      // Check if we should disable load more
      if (batched.length < ITEMS_PER_PAGE) {
        setAllItemsLoaded(true)
        setHasMore(false)
        
        // Analytics: Track end of feed reached (partial batch)
        console.log('🏁 User reached end of feed (partial batch):', {
          totalItemsViewed: feedItems.length + batched.length,
          paginationLoads: Math.floor(nextOffset / ITEMS_PER_PAGE),
          timeFromInitialLoad: Date.now() - initialLoadTime.current,
          lastBatchSize: batched.length,
          timestamp: new Date().toISOString()
        })
      } else {
        setHasMore(true)
      }

      // Reset retry count on success
      setRetryCount(0)

    } catch (err) {
      console.error('❌ Error loading more items:', err)
      
      // Analytics: Track pagination errors
      // TODO: Replace console.error with actual analytics/error tracking service
      // errorTracking.log('pagination_error', { error: err, offset: nextOffset })
      console.error('❌ Pagination Error:', {
        error: err instanceof Error ? err.message : String(err),
        offset: nextOffset,
        retryAttempt: retryCount,
        batchSize: ITEMS_PER_PAGE,
        timestamp: new Date().toISOString()
      })
      
      // Retry logic with exponential backoff
      if (retryCount < MAX_RETRIES) {
        console.log(`🔄 Retrying... (${retryCount + 1}/${MAX_RETRIES})`)
        setRetryCount(prev => prev + 1)
        setLoadingMore(false)
        
        // Exponential backoff: 1s, 2s, 3s
        setTimeout(() => handleLoadMore(), 1000 * (retryCount + 1))
      } else {
        // Max retries reached, show error to user
        setError('Failed to load more activities. Please try again later.')
        setLoadingMore(false)
        
        // Analytics: Track max retries reached
        console.error('❌ Max retries reached:', {
          offset: nextOffset,
          totalAttempts: MAX_RETRIES + 1,
          timestamp: new Date().toISOString()
        })
      }
    } finally {
      // Only set loading false if not retrying
      if (retryCount >= MAX_RETRIES || retryCount === 0) {
        setLoadingMore(false)
      }
    }
  }, [loadingMore, allItemsLoaded, projectId, currentOffset, ITEMS_PER_PAGE, retryCount, MAX_RETRIES])

  // Debounced version to prevent rapid clicking
  const handleLoadMoreDebounced = useCallback(() => {
    if (loadMoreTimeoutRef.current) {
      clearTimeout(loadMoreTimeoutRef.current)
    }
    
    loadMoreTimeoutRef.current = setTimeout(() => {
      handleLoadMore()
    }, 300)
  }, [handleLoadMore])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current)
      }
    }
  }, [])

  // Intersection Observer for infinite scroll (optional enhancement)
  useEffect(() => {
    if (!loadMoreTriggerRef.current || allItemsLoaded) return
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          console.log('📍 Intersection triggered - loading more')
          handleLoadMore()
        }
      },
      { threshold: 0.5, rootMargin: '100px' }
    )
    
    observer.observe(loadMoreTriggerRef.current)
    
    return () => observer.disconnect()
  }, [allItemsLoaded, loadingMore, hasMore, handleLoadMore])

  const handleBatchedItemClick = (item: FeedItemType) => {
    setSelectedItem(item)
    setModalOpen(true)
  }

  return (
    <Box 
      className="activity-feed max-w-full p-4 bg-white rounded-lg border border-border-subtle" 
      sx={{ width: '100%' }}
    >
      <Typography 
        variant="h6" 
        sx={{ 
          mb: 1, 
          fontWeight: 600,
          color: 'text.primary',
          fontFamily: 'var(--font-display)'
        }}
      >
        Activity Feed
      </Typography>

      {/* Connection Status Indicator */}
      {isConnected && !loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
          <Box 
            sx={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              bgcolor: 'success.main',
              animation: 'pulse 2s infinite'
            }} 
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
            Live updates active
          </Typography>
        </Box>
      )}

      {/* Pulse animation styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      
      {loading && feedItems.length === 0 && <FeedSkeleton count={5} />}
      
      {error && !loading && (
        <Box 
          sx={{ 
            p: 3, 
            textAlign: 'center',
            bgcolor: 'error.light',
            borderRadius: 2
          }}
        >
          <Typography variant="body2" color="error">
            {error}
          </Typography>
          <Button 
            size="small" 
            onClick={() => window.location.reload()}
            sx={{ mt: 1 }}
          >
            Refresh Page
          </Button>
        </Box>
      )}
      
      {!loading && !error && feedItems.length === 0 && (
        <FeedEmptyState projectId={projectId} />
      )}
      
      {!loading && !error && feedItems.length > 0 && (
        <Box 
          className="feed-items" 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 1.5 
          }}
        >
          {feedItems.map(item => (
            <FeedItem 
              key={item.id} 
              item={item}
              onClickBatched={handleBatchedItemClick}
            />
          ))}
        </Box>
      )}
      
      {/* Load More Section */}
      {!loading && feedItems.length > 0 && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          {/* Intersection Observer Trigger (for infinite scroll) */}
          {!allItemsLoaded && hasMore && (
            <div 
              ref={loadMoreTriggerRef} 
              style={{ height: 1, visibility: 'hidden' }} 
              aria-hidden="true"
            />
          )}
          
          {/* Loading State with Skeleton */}
          {loadingMore && (
            <Box sx={{ mt: 2 }}>
              <FeedSkeleton count={3} />
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ display: 'block', textAlign: 'center', mt: 1 }}
              >
                Loading more activities...
              </Typography>
            </Box>
          )}
          
          {/* Load More Button */}
          {!loadingMore && !allItemsLoaded && hasMore && (
            <Button 
              variant="outlined" 
              fullWidth 
              onClick={handleLoadMoreDebounced}
              sx={{ 
                borderColor: 'divider',
                color: 'text.primary',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover'
                }
              }}
            >
              Load more activity
            </Button>
          )}
          
          {/* All Caught Up Message */}
          {allItemsLoaded && (
            <Box sx={{ py: 2 }}>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 1 
                }}
              >
                <span>🎉</span> You're all caught up!
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Batched Activity Modal */}
      {selectedItem && (
        <BatchedActivityModal
          item={selectedItem}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </Box>
  )
}

