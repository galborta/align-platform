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
      
      // Mock data for Sprint 1 testing
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const mockFeedItems: FeedItemType[] = [
        {
          id: 'mock-1',
          type: 'job_posted',
          timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 mins ago
          data: {
            actorWallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
            jobId: 'job-1',
            jobTitle: 'Logo Design',
            category: 'design'
          }
        },
        {
          id: 'mock-2',
          type: 'job_applied',
          timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
          data: {
            actorWallet: '8yKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsV',
            jobId: 'job-1',
            jobTitle: 'Logo Design',
            applicationId: 'app-1'
          }
        },
        {
          id: 'mock-3',
          type: 'job_application_upvoted',
          timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
          data: {
            actorWallet: '9zKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsW',
            voteWeight: 1.2,
            applicationId: 'app-1',
            applicantWallet: '8yKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsV',
            jobId: 'job-1',
            jobTitle: 'Logo Design'
          },
          batchedCount: 3
        },
        {
          id: 'mock-4',
          type: 'asset_submitted',
          timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          data: {
            submitterWallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
            assetType: 'social',
            assetName: 'Twitter @example'
          }
        },
        {
          id: 'mock-5',
          type: 'tip_sent',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          data: {
            fromWallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
            toWallet: '8yKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsV',
            amountTokens: 1000,
            tokenSymbol: 'NUBCAT'
          }
        },
        {
          id: 'mock-6',
          type: 'karma_milestone',
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
          data: {
            wallet: '9zKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsW',
            milestone: 1000
          }
        }
      ]
      
      setFeedItems(mockFeedItems)
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

