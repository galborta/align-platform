'use client'

import { useState, useEffect } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { FeedItem as FeedItemType, ActivityFeedProps } from '@/types/feed'
import { FeedItem } from './FeedItem'
import { FeedSkeleton } from './FeedSkeleton'
import { FeedEmptyState } from './FeedEmptyState'
import { BatchedActivityModal } from './BatchedActivityModal'


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

  // Load initial feed items
  useEffect(() => {
    loadFeedItems()
  }, [projectId])

  const loadFeedItems = async () => {
    setLoading(true)
    
    try {
      // TODO: Implement API call to fetch feed items
      // const response = await fetch(`/api/feed?projectId=${projectId}`)
      // const data = await response.json()
      
      // Mock data for now
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setFeedItems([])
      setHasMore(false)
    } catch (error) {
      console.error('Error loading feed items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadMore = async () => {
    setLoading(true)
    
    try {
      // TODO: Implement pagination
      // const oldestItem = feedItems[feedItems.length - 1]
      // const response = await fetch(`/api/feed?projectId=${projectId}&before=${oldestItem.timestamp}`)
      // const data = await response.json()
      
      // Mock data for now
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setHasMore(false)
    } catch (error) {
      console.error('Error loading more items:', error)
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
      
      {!loading && feedItems.length === 0 && (
        <FeedEmptyState projectId={projectId} />
      )}
      
      {!loading && feedItems.length > 0 && (
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

