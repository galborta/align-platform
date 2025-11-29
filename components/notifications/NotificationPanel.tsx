'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Drawer, 
  IconButton, 
  Button, 
  Tabs, 
  Tab, 
  CircularProgress 
} from '@mui/material'
import { X } from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { notificationService } from '@/lib/services/notificationService'
import { NotificationItem } from './NotificationItem'
import { BatchedNotification } from './BatchedNotification'
import type { EnrichedNotification } from '@/lib/services/notificationService'

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
}

/**
 * NotificationPanel Component
 * 
 * Full-screen slideout panel that displays all notifications with infinite scroll.
 * 
 * Features:
 * - Slides in from right (Material UI Drawer)
 * - 400px wide on desktop, full screen on mobile
 * - Filter tabs: All | Unread
 * - Infinite scroll (loads 50 at a time)
 * - Mark all as read button
 * - Empty and loading states
 * - Uses NotificationItem and BatchedNotification components
 * 
 * @param open - Whether the panel is open
 * @param onClose - Handler for closing the panel
 */
export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const { publicKey } = useWallet()
  const walletAddress = publicKey?.toBase58()
  const { 
    notifications, 
    loading,
    error,
    refreshing,
    markAsRead, 
    markAllAsRead,
    refreshNotifications,
    adminNotifications,
    adminUnreadCount 
  } = useNotifications()
  const [filter, setFilter] = useState<'all' | 'unread' | 'admin'>('all')
  const [displayedNotifications, setDisplayedNotifications] = useState<EnrichedNotification[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!walletAddress) {
        setIsAdmin(false)
        return
      }

      try {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('is_admin')
          .eq('wallet_address', walletAddress)
          .maybeSingle()

        setIsAdmin(userProfile?.is_admin || false)
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      }
    }

    checkAdminStatus()
  }, [walletAddress])

  // Filter notifications
  const filteredNotifications = 
    filter === 'unread' 
      ? notifications.filter(n => !n.is_read)
      : filter === 'admin'
        ? adminNotifications
        : notifications

  // Update displayed notifications when filter changes
  useEffect(() => {
    setDisplayedNotifications(filteredNotifications.slice(0, page * 50))
    setHasMore(filteredNotifications.length > page * 50)
  }, [filteredNotifications, page])

  // Reset when panel opens
  useEffect(() => {
    if (open) {
      setPage(1)
      setFilter('all')
    }
  }, [open])

  // Infinite scroll handler
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100

    if (bottom && hasMore && !loadingMore) {
      loadMore()
    }
  }

  const loadMore = async () => {
    setLoadingMore(true)
    // Simulate delay (in real app, would fetch from API)
    await new Promise(resolve => setTimeout(resolve, 500))
    setPage(prev => prev + 1)
    setLoadingMore(false)
  }

  const handleNotificationClick = (notification: EnrichedNotification) => {
    // Mark as read
    if (!notification.is_read) {
      markAsRead(notification.id)
    }
    
    // Close panel (navigation is handled by NotificationItem/BatchedNotification)
    onClose()
  }

  const handleMarkAllRead = () => {
    markAllAsRead()
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 400 },
          maxWidth: '100%'
        }
      }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="flex items-center justify-between p-3 sm:p-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Notifications</h2>
            <IconButton onClick={onClose} size="small" sx={{ minWidth: 44, minHeight: 44 }}>
              <X size={24} />
            </IconButton>
          </div>

          {/* Tabs */}
          <Tabs
            value={filter}
            onChange={(_, value) => setFilter(value)}
            sx={{
              px: { xs: 1, sm: 2 },
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                fontSize: { xs: '0.875rem', sm: '1rem' },
                minHeight: { xs: 44, sm: 48 },
                color: '#6B7280',
                '&.Mui-selected': {
                  color: '#7C4DFF'
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#7C4DFF'
              }
            }}
          >
            <Tab label="All" value="all" />
            <Tab 
              label={`Unread (${notifications.filter(n => !n.is_read).length})`} 
              value="unread" 
            />
            {isAdmin && (
              <Tab 
                label={`Admin (${adminUnreadCount})`} 
                value="admin" 
              />
            )}
          </Tabs>

          {/* Mark all read button */}
          {filteredNotifications.some(n => !n.is_read) && (
            <div className="px-3 sm:px-4 pb-3">
              <Button
                size="small"
                fullWidth
                variant="outlined"
                onClick={handleMarkAllRead}
                disabled={refreshing}
                sx={{
                  textTransform: 'none',
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  padding: { xs: '8px 12px', sm: '10px 16px' },
                  minHeight: 44,
                  borderColor: '#7C4DFF',
                  color: '#7C4DFF',
                  '&:hover': {
                    borderColor: '#6A3FDD',
                    backgroundColor: 'rgba(124, 77, 255, 0.05)'
                  }
                }}
              >
                Mark all as read
              </Button>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="px-3 sm:px-4 pt-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 mb-2">{error}</p>
              <Button 
                size="small" 
                fullWidth
                onClick={refreshNotifications}
                disabled={refreshing}
                sx={{ 
                  color: '#EF4444', 
                  textTransform: 'none',
                  borderColor: '#EF4444',
                  minHeight: 44,
                  '&:hover': {
                    borderColor: '#DC2626',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)'
                  }
                }}
                variant="outlined"
              >
                {refreshing ? 'Retrying...' : 'Try Again'}
              </Button>
            </div>
          </div>
        )}

        {/* Body */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="flex gap-3 p-4 rounded-lg bg-white border border-gray-100 animate-pulse">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-5/6" />
                  </div>
                  <div className="space-y-2 flex-shrink-0">
                    <div className="w-16 h-3 bg-gray-200 rounded" />
                    <div className="w-3 h-3 bg-gray-200 rounded-full ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayedNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="text-5xl sm:text-6xl mb-4">
                {filter === 'admin' ? '🛡️' : '🔔'}
              </div>
              <p className="text-gray-500 text-center text-sm sm:text-base">
                {filter === 'unread' 
                  ? 'No unread notifications' 
                  : filter === 'admin'
                    ? 'No admin notifications'
                    : 'No notifications yet'
                }
              </p>
            </div>
          ) : (
            <div className="p-2 sm:p-4 space-y-2">
              {displayedNotifications.map(notification => (
                notification.batch_count > 1 ? (
                  <BatchedNotification
                    key={notification.id}
                    notification={notification}
                    onClick={handleNotificationClick}
                  />
                ) : (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={handleNotificationClick}
                    showActions={false}
                  />
                )
              ))}

              {/* Refreshing Indicator */}
              {refreshing && (
                <div className="flex justify-center items-center py-3 border-t border-gray-200">
                  <CircularProgress size={20} sx={{ color: '#7C4DFF' }} />
                  <span className="text-sm text-gray-500 ml-2">Refreshing...</span>
                </div>
              )}

              {/* Load more indicator */}
              {loadingMore && (
                <div className="flex justify-center py-4">
                  <CircularProgress size={20} sx={{ color: '#7C4DFF' }} />
                </div>
              )}

              {!hasMore && displayedNotifications.length > 0 && (
                <p className="text-center text-gray-500 text-sm py-4">
                  No more notifications
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  )
}

