'use client'

import { useEffect, useRef } from 'react'
import { Popover, Button, Avatar, CircularProgress } from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { notificationService } from '@/lib/services/notificationService'
import { handleNotificationNavigation } from '@/lib/notifications/navigationHandler'
import type { EnrichedNotification } from '@/lib/services/notificationService'

interface NotificationDropdownProps {
  anchorEl: HTMLElement | null
  open: boolean
  onClose: () => void
}

/**
 * NotificationDropdown Component
 * 
 * Displays a popover with the last 4 notifications.
 * 
 * Features:
 * - Shows last 4 notifications with actor avatar, text, and time
 * - Auto-marks as read after 10 seconds
 * - Mark all read button
 * - View all button (navigation TBD)
 * - Empty state for no notifications
 * - Loading state while fetching
 */
export function NotificationDropdown({ anchorEl, open, onClose }: NotificationDropdownProps) {
  const router = useRouter()
  const { 
    notifications, 
    loading, 
    error,
    refreshing,
    markAsRead, 
    markAllAsRead,
    refreshNotifications 
  } = useNotifications()
  const autoReadTimerRef = useRef<NodeJS.Timeout>()

  // Show fewer notifications on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const displayCount = isMobile ? 2 : 4
  const recentNotifications = notifications.slice(0, displayCount)

  // Auto-mark as read after 10 seconds
  useEffect(() => {
    if (open && recentNotifications.length > 0) {
      autoReadTimerRef.current = setTimeout(() => {
        console.log('⏰ 10 seconds elapsed - marking unread notifications as read')
        
        // Mark unread notifications as read
        recentNotifications.forEach(notification => {
          if (!notification.is_read) {
            markAsRead(notification.id)
          }
        })
      }, 10000) // 10 seconds
    }

    return () => {
      if (autoReadTimerRef.current) {
        clearTimeout(autoReadTimerRef.current)
      }
    }
  }, [open, recentNotifications, markAsRead])

  const handleNotificationClick = (notification: EnrichedNotification) => {
    // Navigate to the appropriate page
    handleNotificationNavigation(notification, router)
    
    // Mark as read
    if (!notification.is_read) {
      markAsRead(notification.id)
    }

    // Close dropdown
    onClose()
  }

  const handleMarkAllRead = () => {
    markAllAsRead()
  }

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      sx={{
        mt: 1,
        '& .MuiPopover-paper': {
          width: { xs: '100vw', sm: 380 },
          maxWidth: { xs: '100vw', sm: 380 },
          maxHeight: { xs: '70vh', sm: 500 },
          borderRadius: { xs: 0, sm: 2 },
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          bgcolor: '#ffffff',
          left: { xs: '0 !important', sm: 'auto' },
          right: { xs: '0 !important', sm: 'auto' }
        }
      }}
    >
      <div className="p-3 sm:p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Notifications</h3>
          {recentNotifications.some(n => !n.is_read) && (
            <Button 
              size="small" 
              onClick={handleMarkAllRead}
              sx={{ 
                color: '#7C4DFF', 
                textTransform: 'none',
                fontWeight: 600,
                fontSize: { xs: '0.75rem', sm: '0.875rem' }
              }}
            >
              Mark all read
            </Button>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
            <p className="text-sm text-red-800 mb-2">{error}</p>
            <Button 
              size="small" 
              onClick={refreshNotifications}
              disabled={refreshing}
              sx={{ 
                color: '#EF4444', 
                textTransform: 'none',
                fontSize: '0.875rem'
              }}
            >
              {refreshing ? 'Retrying...' : 'Try Again'}
            </Button>
          </div>
        )}

        {/* Notifications List */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex gap-3 p-3 animate-pulse">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
                <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                </div>
                <div className="w-12 h-4 bg-gray-200 rounded flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : recentNotifications.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentNotifications.map(notification => {
              const text = notificationService.generateNotificationText(notification)
              
              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`
                    p-3 rounded-lg cursor-pointer transition-colors
                    hover:bg-gray-50 flex items-start gap-3
                    ${!notification.is_read ? 'bg-purple-50' : 'bg-white'}
                  `}
                >
                  {/* Avatar */}
                  <Avatar 
                    src={notification.actor_avatar_url || undefined} 
                    sx={{ 
                      width: 40, 
                      height: 40,
                      bgcolor: '#7C4DFF'
                    }}
                  >
                    {notification.actor_username?.[0]?.toUpperCase() || 
                     notification.user_wallet?.slice(0, 2).toUpperCase() || '?'}
                  </Avatar>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">
                      {text.body}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>

                  {/* Unread indicator */}
                  {!notification.is_read && (
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
                  )}
                </div>
              )
            })}

            {/* Refreshing Indicator */}
            {refreshing && (
              <div className="flex justify-center py-2 border-t border-gray-200 mt-2 pt-2">
                <CircularProgress size={16} sx={{ color: '#7C4DFF' }} />
                <span className="text-xs text-gray-500 ml-2">Refreshing...</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {recentNotifications.length > 0 && !loading && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <Button
              fullWidth
              variant="text"
              sx={{ 
                color: '#7C4DFF', 
                textTransform: 'none',
                fontWeight: 600,
                fontSize: { xs: '0.875rem', sm: '1rem' },
                padding: { xs: '8px 12px', sm: '10px 16px' },
                '&:hover': {
                  bgcolor: 'rgba(124, 77, 255, 0.05)'
                }
              }}
              onClick={onClose}
            >
              View All Notifications
            </Button>
          </div>
        )}
      </div>
    </Popover>
  )
}

