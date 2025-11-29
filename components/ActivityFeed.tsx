'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Box, Typography, Button, CircularProgress } from '@mui/material'
import { FeedItem as FeedItemType, ActivityFeedProps } from '@/types/feed'
import { FeedItem } from './FeedItem'
import { FeedSkeleton } from './FeedSkeleton'
import { FeedEmptyState } from './FeedEmptyState'

// Lazy load modal for better performance
const BatchedActivityModal = dynamic(() => import('./BatchedActivityModal').then(mod => ({ default: mod.BatchedActivityModal })), {
  ssr: false,
  loading: () => <CircularProgress />
})
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
  getFeedStats,
  getStableItemId
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
export function ActivityFeed({ projectId, tokenMint }: ActivityFeedProps) {
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
  const [displayedItemsCount, setDisplayedItemsCount] = useState(4) // Start with 4 items
  
  // Refs for optimization
  const loadMoreTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null)
  
  // Analytics tracking
  const initialLoadTime = useRef<number>(Date.now())
  
  // Feed display configuration
  const INITIAL_ITEMS = 4  // Show 4 items initially
  const AUTO_LOAD_LIMIT = 15  // Auto-load up to 15 items
  const ITEMS_PER_PAGE = 20  // Load 20 items per page after manual "Load more"
  const MAX_RETRIES = 3
  
  // Pull-to-refresh state (mobile only)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const PULL_THRESHOLD = 80  // Distance to trigger refresh

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

  // Pull-to-refresh touch handlers (mobile only)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only enable pull-to-refresh if scrolled to top
    const container = containerRef.current
    if (!container || container.scrollTop > 0) return
    
    touchStartY.current = e.touches[0].clientY
  }, [])
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === 0) return
    
    const container = containerRef.current
    if (!container || container.scrollTop > 0) return
    
    const touchY = e.touches[0].clientY
    const distance = touchY - touchStartY.current
    
    // Only pull down, not up
    if (distance > 0) {
      setPullDistance(Math.min(distance, PULL_THRESHOLD))
      
      // Prevent default scroll behavior while pulling
      if (distance > 10) {
        e.preventDefault()
      }
    }
  }, [PULL_THRESHOLD])
  
  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      // Trigger refresh
      setIsRefreshing(true)
      console.log('🔄 Pull-to-refresh triggered')
      
      try {
        // Reload feed data
        const rawData = await fetchInitialFeed(projectId, ITEMS_PER_PAGE, 0)
        const items = transformToFeedItems(rawData)
        const batched = applyBatchingLogic(items)
        const initialItems = batched.slice(0, ITEMS_PER_PAGE)
        
        setFeedItems(initialItems)
        setDisplayedItemsCount(INITIAL_ITEMS) // Reset to initial display count
        setHasMore(batched.length > ITEMS_PER_PAGE)
        setCurrentOffset(0)
        setAllItemsLoaded(false)
        
        // Show success feedback
        console.log('✅ Feed refreshed successfully')
      } catch (err) {
        console.error('❌ Refresh failed:', err)
        setError('Failed to refresh feed. Please try again.')
      } finally {
        setIsRefreshing(false)
      }
    }
    
    // Reset pull state
    setPullDistance(0)
    touchStartY.current = 0
  }, [pullDistance, isRefreshing, projectId, ITEMS_PER_PAGE, PULL_THRESHOLD])

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

        // Load more items initially but only display the first 4
        const initialItems = batched.slice(0, AUTO_LOAD_LIMIT)

        setFeedItems(initialItems)
        setDisplayedItemsCount(INITIAL_ITEMS) // Show only 4 items initially
        setHasMore(batched.length > AUTO_LOAD_LIMIT)
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
      
      // Update displayed items count to show newly loaded items
      setDisplayedItemsCount(prev => prev + batched.length)

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

  // Unified Intersection Observer for both auto-scroll and manual load more
  useEffect(() => {
    if (!loadMoreTriggerRef.current) return
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return
        
        // Phase 1: Auto-load up to 15 items (from already fetched data)
        if (displayedItemsCount < AUTO_LOAD_LIMIT && feedItems.length > displayedItemsCount) {
          console.log('📍 Auto-loading more items (scroll-triggered)')
          setDisplayedItemsCount(prev => Math.min(prev + 4, AUTO_LOAD_LIMIT, feedItems.length))
        }
        // Phase 2: Manual load more from server (after 15 items)
        else if (displayedItemsCount >= AUTO_LOAD_LIMIT && !loadingMore && hasMore && !allItemsLoaded) {
          console.log('📍 Loading more data from server')
          // Only load if we've displayed all current items
          if (displayedItemsCount >= feedItems.length) {
            handleLoadMore()
          }
        }
      },
      { threshold: 0.5, rootMargin: '50px' }
    )
    
    observer.observe(loadMoreTriggerRef.current)
    
    return () => observer.disconnect()
  }, [displayedItemsCount, feedItems.length, AUTO_LOAD_LIMIT, loadingMore, hasMore, allItemsLoaded, handleLoadMore])

  // Performance monitoring - track feed render times
  useEffect(() => {
    if (typeof window !== 'undefined' && window.performance) {
      performance.mark('feed-render-start')
      
      return () => {
        performance.mark('feed-render-end')
        try {
          performance.measure(
            'feed-render',
            'feed-render-start',
            'feed-render-end'
          )
          
          const measure = performance.getEntriesByName('feed-render')[0]
          if (measure) {
            console.log(`📊 Feed render time: ${measure.duration.toFixed(2)}ms (${feedItems.length} items)`)
            
            // Alert if slow
            if (measure.duration > 500) {
              console.warn(`⚠️ Slow feed render detected: ${measure.duration.toFixed(2)}ms`)
            }
          }
          
          // Clean up marks
          performance.clearMarks('feed-render-start')
          performance.clearMarks('feed-render-end')
          performance.clearMeasures('feed-render')
        } catch (err) {
          // Performance API might not be fully supported
          console.debug('Performance measurement not available')
        }
      }
    }
  }, [feedItems.length])

  const handleBatchedItemClick = (item: FeedItemType) => {
    setSelectedItem(item)
    setModalOpen(true)
  }

  return (
    <Box 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      sx={{ 
        width: '100%',
        bgcolor: 'background.paper',
        borderRadius: { xs: 1, md: 2 },  // Smaller radius on mobile
        border: '1px solid',
        borderColor: 'divider',
        p: { xs: 1.5, md: 2 },  // Less padding on mobile
        maxWidth: '100%',
        overflow: 'auto',
        position: 'relative',
        // Pull indicator styling
        paddingTop: pullDistance > 0 ? `${pullDistance}px` : undefined,
        transition: pullDistance > 0 ? 'none' : 'padding-top 0.3s ease'
      }}
    >
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: pullDistance || 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          borderRadius: '8px 8px 0 0',
          zIndex: 1
        }}>
          {isRefreshing ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Refreshing...
              </Typography>
            </>
          ) : (
            <Box sx={{
              transform: `rotate(${Math.min(pullDistance / PULL_THRESHOLD * 180, 180)}deg)`,
              transition: 'transform 0.2s',
              fontSize: 20,
              color: pullDistance >= PULL_THRESHOLD ? 'success.main' : 'text.secondary'
            }}>
              ↓
            </Box>
          )}
        </Box>
      )}

      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: { xs: 1.5, md: 2 },
        flexWrap: 'wrap',  // Allow wrapping on tiny screens
        gap: 1
      }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 600,
            fontSize: { xs: '1rem', md: '1.25rem' },  // Smaller on mobile
            color: 'text.primary',
            fontFamily: 'var(--font-display)'
          }}
        >
          Activity Feed
        </Typography>

        {/* Connection Status Indicator - hide on xs */}
        {isConnected && !loading && (
          <Box sx={{ 
            display: { xs: 'none', sm: 'flex' },  // Hide on xs screens
            alignItems: 'center', 
            gap: 0.5 
          }}>
            <Box 
              sx={{ 
                width: 8, 
                height: 8, 
                borderRadius: '50%', 
                bgcolor: 'success.main',
                animation: 'pulse 2s infinite'
              }} 
            />
            <Typography variant="caption" sx={{ 
              color: 'text.secondary', 
              fontSize: { xs: 10, md: 11 }
            }}>
              Live updates active
            </Typography>
          </Box>
        )}
      </Box>

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
        <>
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: { xs: 1, md: 1.5 },  // Tighter spacing on mobile
              maxHeight: '500px',  // Always keep scrollable
              overflowY: 'auto',  // Always scrollable
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'rgba(0,0,0,0.05)',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: '4px',
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.3)',
                },
              },
            }}
          >
            {feedItems.slice(0, displayedItemsCount).map(item => (
              <FeedItem 
                key={getStableItemId(item)} 
                item={item}
                projectId={projectId}
                tokenMint={tokenMint}
                onClickBatched={handleBatchedItemClick}
                isMobile={typeof window !== 'undefined' && window.innerWidth < 900}
              />
            ))}
            
            {/* Intersection Observer Trigger for auto-load - inside scrollable container */}
            {displayedItemsCount < AUTO_LOAD_LIMIT && feedItems.length > displayedItemsCount && (
              <Box 
                ref={loadMoreTriggerRef}
                sx={{ 
                  height: '20px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 1
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Scroll for more...
                </Typography>
              </Box>
            )}
            
            {/* Load More trigger for after 15 items - inside scrollable container */}
            {displayedItemsCount >= AUTO_LOAD_LIMIT && (displayedItemsCount < feedItems.length || hasMore) && (
              <Box 
                ref={loadMoreTriggerRef}
                sx={{ 
                  height: '1px',
                  width: '100%',
                  visibility: 'hidden'
                }}
                aria-hidden="true"
              />
            )}
          </Box>
        </>
      )}
      
      {/* Load More Section - Shows after reaching 15 items, OUTSIDE scrollable container */}
      {!loading && feedItems.length > 0 && displayedItemsCount >= AUTO_LOAD_LIMIT && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          {/* Loading State */}
          {loadingMore && (
            <Box sx={{ py: 2 }}>
              <CircularProgress size={24} sx={{ mb: 1 }} />
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ display: 'block' }}
              >
                Loading more activities...
              </Typography>
            </Box>
          )}
          
          {/* Load More Button - Only shown after AUTO_LOAD_LIMIT (15 items) reached */}
          {!loadingMore && (displayedItemsCount < feedItems.length || hasMore) && !allItemsLoaded && (
            <Button 
              variant="outlined" 
              fullWidth 
              onClick={() => {
                // If we have more items in feedItems, display them
                if (displayedItemsCount < feedItems.length) {
                  setDisplayedItemsCount(prev => Math.min(prev + ITEMS_PER_PAGE, feedItems.length))
                } else if (hasMore && !allItemsLoaded) {
                  // Otherwise, load more from server
                  handleLoadMoreDebounced()
                }
              }}
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
          {allItemsLoaded && displayedItemsCount >= feedItems.length && (
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
          onClose={() => {
            setModalOpen(false)
            setSelectedItem(null)
          }}
          projectId={projectId}
          tokenMint={tokenMint}
        />
      )}
    </Box>
  )
}

