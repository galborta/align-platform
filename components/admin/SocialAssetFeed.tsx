'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Box, Typography, CircularProgress, Button } from '@mui/material'
import { SocialAssetFeedItem } from './SocialAssetFeedItem'
import { 
  fetchPendingSocialAssets, 
  transformPendingAsset,
  type SocialAssetFeedItem as SocialAssetFeedItemType 
} from '@/lib/feed-queries-social-assets'
import { supabase } from '@/lib/supabase'
import { FeedSkeleton } from '@/components/FeedSkeleton'

interface SocialAssetFeedProps {
  projectId: string  // 'all' for global admin view
  editorWallet: string
  highlightAssetId?: string | null  // Can be passed directly as prop
}

export function SocialAssetFeed({ projectId, editorWallet, highlightAssetId: propHighlightId }: SocialAssetFeedProps) {
  const [items, setItems] = useState<SocialAssetFeedItemType[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  
  // Check if this is a global admin view
  const isGlobalAdmin = projectId === 'all'
  
  // Highlight ID passed as prop from parent
  const highlightId = propHighlightId
  const [highlightedAssetId, setHighlightedAssetId] = useState<string | null>(null)
  const highlightedRef = useRef<HTMLDivElement | null>(null)

  const ITEMS_PER_PAGE = 20

  // Load initial feed
  const loadFeed = useCallback(async () => {
    try {
      setLoading(true)
      // Global admins (projectId === 'all') see ALL assets across all projects
      const rawAssets = await fetchPendingSocialAssets(
        projectId === 'all' ? null : projectId, 
        ITEMS_PER_PAGE, 
        0
      )
      const transformed = rawAssets.map(transformPendingAsset)
      
      setItems(transformed)
      setHasMore(rawAssets.length >= ITEMS_PER_PAGE)
      setOffset(0)
    } catch (error) {
      console.error('Error loading social asset feed:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // Load more items
  const loadMore = async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    try {
      const nextOffset = offset + ITEMS_PER_PAGE
      // Global admins see ALL assets across all projects
      const rawAssets = await fetchPendingSocialAssets(
        projectId === 'all' ? null : projectId, 
        ITEMS_PER_PAGE, 
        nextOffset
      )
      const transformed = rawAssets.map(transformPendingAsset)
      
      setItems(prev => [...prev, ...transformed])
      setHasMore(rawAssets.length >= ITEMS_PER_PAGE)
      setOffset(nextOffset)
    } catch (error) {
      console.error('Error loading more assets:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  // Reload feed after action
  const handleActionComplete = useCallback(() => {
    loadFeed()
  }, [loadFeed])

  // Initial load
  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  // Handle asset highlighting from URL
  useEffect(() => {
    if (highlightId && items.length > 0) {
      const assetExists = items.find(item => item.id === highlightId)
      
      if (assetExists) {
        setHighlightedAssetId(highlightId)
        
        // Scroll to highlighted asset after render
        setTimeout(() => {
          if (highlightedRef.current) {
            highlightedRef.current.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            })
          }
        }, 100)
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
          setHighlightedAssetId(null)
        }, 3000)
      }
    }
  }, [highlightId, items])

  // Setup real-time subscription
  useEffect(() => {
    console.log('🔌 Setting up social asset feed subscription')

    const channelName = projectId === 'all' 
      ? 'social-assets:global'
      : `social-assets:${projectId}`

    const subscriptionConfig: any = {
      event: '*',
      schema: 'public',
      table: 'pending_assets'
    }

    // Only add project filter for specific projects (not for global admins)
    if (projectId !== 'all') {
      subscriptionConfig.filter = `project_id=eq.${projectId}`
    }

    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', subscriptionConfig, (payload) => {
        console.log('🔔 Social asset change:', payload)
        
        if (payload.eventType === 'INSERT') {
          // New asset submitted - prepend to feed
          const transformed = transformPendingAsset(payload.new)
          setItems(prev => [transformed, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          // Asset approved/rejected - update in place
          const transformed = transformPendingAsset(payload.new)
          setItems(prev => prev.map(item => 
            item.id === transformed.id ? transformed : item
          ))
        } else if (payload.eventType === 'DELETE') {
          // Asset deleted - remove from feed
          setItems(prev => prev.filter(item => item.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      console.log('🔌 Cleaning up social asset feed subscription')
      subscription.unsubscribe()
    }
  }, [projectId])

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <FeedSkeleton count={3} />
      </Box>
    )
  }

  if (items.length === 0) {
    return (
      <Box sx={{ 
        p: 4, 
        textAlign: 'center',
        bgcolor: 'background.paper',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider'
      }}>
        <Typography variant="h6" sx={{ mb: 1, color: 'text.secondary' }}>
          No asset submissions yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          When community members submit social accounts or domains for verification,
          they'll appear here for review.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Feed Items */}
      {items.map(item => (
        <Box
          key={item.id}
          ref={item.id === highlightedAssetId ? highlightedRef : null}
        >
          <SocialAssetFeedItem
            item={item}
            projectId={isGlobalAdmin && item.projectId ? item.projectId : projectId}
            editorWallet={editorWallet}
            onActionComplete={handleActionComplete}
            isHighlighted={item.id === highlightedAssetId}
            isGlobalAdmin={isGlobalAdmin}
          />
        </Box>
      ))}

      {/* Load More Button */}
      {hasMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button
            variant="outlined"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </Box>
      )}

      {/* End of Feed */}
      {!hasMore && items.length > 0 && (
        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ textAlign: 'center', mt: 2 }}
        >
          No more submissions to review
        </Typography>
      )}
    </Box>
  )
}

