'use client'

import { useState, useEffect } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { FeedItem as FeedItemType, ActivityFeedProps } from '@/types/feed'
import { FeedItem } from './FeedItem'
import { FeedSkeleton } from './FeedSkeleton'
import { FeedEmptyState } from './FeedEmptyState'
import { BatchedActivityModal } from './BatchedActivityModal'
import { fetchInitialFeed } from '@/lib/feed-queries'
import { transformToFeedItems } from '@/lib/feed-transform'
import { applyBatchingLogic } from '@/lib/feed-batching'


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

  // Load initial feed items
  useEffect(() => {
    async function loadFeed() {
      if (!projectId) return

      setLoading(true)
      setError(null)

      try {
        console.log('🔄 Starting feed load for project:', projectId)

        // Fetch raw data from all tables (10 parallel queries)
        const rawData = await fetchInitialFeed(projectId, 50)
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

        // Take first 20 items
        const initialItems = batched.slice(0, 20)

        setFeedItems(initialItems)
        setHasMore(batched.length > 20)
        setLoading(false)

        console.log('Feed loading state:', {
          loading: false,
          itemsCount: initialItems.length,
          hasMore: batched.length > 20,
          error: null
        })
      } catch (err) {
        console.error('❌ Error loading feed:', err)
        setError('Failed to load activity feed. Please try refreshing.')
        setLoading(false)

        console.log('Feed loading state:', {
          loading: false,
          itemsCount: 0,
          hasMore: false,
          error: 'Failed to load activity feed'
        })
      }
    }

    loadFeed()
  }, [projectId])

  const handleLoadMore = async () => {
    if (!hasMore || loading) return

    setLoading(true)

    try {
      // TODO: Implement pagination with fetchPaginatedFeed
      // For now, just disable "Load more" after first load
      console.log('⏳ Load more not yet implemented')
      setHasMore(false)
    } catch (error) {
      console.error('Error loading more items:', error)
      setError('Failed to load more activities.')
    } finally {
      setLoading(false)
    }
  }

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
          mb: 2, 
          fontWeight: 600,
          color: 'text.primary',
          fontFamily: 'var(--font-display)'
        }}
      >
        Activity Feed
      </Typography>
      
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
      
      {hasMore && !loading && feedItems.length > 0 && (
        <Button 
          variant="outlined" 
          fullWidth 
          sx={{ 
            mt: 2,
            borderColor: '#7C4DFF',
            color: '#7C4DFF',
            '&:hover': {
              borderColor: '#7C4DFF',
              bgcolor: 'rgba(124, 77, 255, 0.08)'
            }
          }}
          onClick={handleLoadMore}
        >
          Load more
        </Button>
      )}
      
      {loading && feedItems.length > 0 && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Loading more activities...
          </Typography>
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

