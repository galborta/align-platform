'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import { getUnreadCount, markAsRead, markAllAsRead } from '@/lib/job-notifications'
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  Button,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Tooltip
} from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import InfoIcon from '@mui/icons-material/Info'
import CloseIcon from '@mui/icons-material/Close'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  job_id: string | null
  is_read: boolean
  priority: string
  created_at: string
}

export function NotificationBell() {
  const { publicKey } = useWallet()
  const router = useRouter()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [markingAllRead, setMarkingAllRead] = useState(false)

  const open = Boolean(anchorEl)
  const walletAddress = publicKey?.toBase58()

  // Load unread count
  const loadUnreadCount = useCallback(async () => {
    if (!walletAddress) {
      setUnreadCount(0)
      return
    }

    const count = await getUnreadCount(walletAddress)
    setUnreadCount(count)
  }, [walletAddress])

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!walletAddress) {
      setNotifications([])
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        // If table doesn't exist (PostgREST error PGRST205 or Postgres error 42P01), show empty state gracefully
        if (error.code === 'PGRST205' || error.code === '42P01') {
          console.warn('[NotificationBell] ⚠️ Notifications table does not exist. Run migration 034 to create it.')
          setNotifications([])
          setLoading(false)
          return
        }
        
        // For other errors, log them
        console.error('[NotificationBell] Error loading notifications:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        
        // Set empty notifications array to show "No notifications" message
        setNotifications([])
        setLoading(false)
        return
      }

      setNotifications((data || []) as Notification[])
    } catch (error) {
      console.error('[NotificationBell] Exception:', error)
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!walletAddress) return

    loadUnreadCount()

    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `wallet_address=eq.${walletAddress}`
        },
        () => {
          loadUnreadCount()
          if (open) {
            loadNotifications()
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [walletAddress, open, loadUnreadCount, loadNotifications])

  // Handle menu open
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
    loadNotifications()
  }

  // Handle menu close
  const handleClose = () => {
    setAnchorEl(null)
  }

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read && walletAddress) {
      await markAsRead(walletAddress, [notification.id])
      loadUnreadCount()
      loadNotifications()
    }

    // Navigate to job if job_id exists
    if (notification.job_id) {
      // Try to find the job to get project_id
      const { data: job } = await supabase
        .from('jobs')
        .select('project_id')
        .eq('id', notification.job_id)
        .single()

      if (job) {
        router.push(`/project/${job.project_id}/jobs/${notification.job_id}`)
      }
    }

    handleClose()
  }

  // Mark all as read
  const handleMarkAllRead = async () => {
    if (!walletAddress) return

    setMarkingAllRead(true)
    try {
      await markAllAsRead(walletAddress)
      await loadUnreadCount()
      await loadNotifications()
    } catch (error) {
      console.error('[NotificationBell] Failed to mark all as read:', error)
    } finally {
      setMarkingAllRead(false)
    }
  }

  // Get icon for notification type
  const getNotificationIcon = (type: string, priority: string) => {
    const iconProps = {
      sx: {
        fontSize: 20,
        color:
          priority === 'urgent'
            ? '#ef4444'
            : priority === 'high'
            ? '#f59e0b'
            : '#3b82f6'
      }
    }

    if (type.includes('failed') || type.includes('error')) {
      return <ErrorIcon {...iconProps} />
    }
    if (type.includes('success') || type.includes('released') || type.includes('completed')) {
      return <CheckCircleIcon {...iconProps} />
    }
    return <InfoIcon {...iconProps} />
  }

  // Format time ago
  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 1000 / 60)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Don't show if not connected
  if (!publicKey) return null

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          onClick={handleClick}
          sx={{
            color: '#7C4DFF',
            '&:hover': { bgcolor: 'rgba(124, 77, 255, 0.08)' }
          }}
        >
          <Badge
            badgeContent={unreadCount}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: '#7C4DFF',
                color: 'white',
                fontSize: '10px',
                fontWeight: 700,
                minWidth: '16px',
                height: '16px',
                borderRadius: '8px',
                border: '2px solid white',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                top: '-8px',
                right: '-8px',
              }
            }}
          >
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            bgcolor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: 2,
            minWidth: 380,
            maxWidth: 480,
            maxHeight: 600,
            mt: 1
          }
        }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #27272a' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Button
                size="small"
                onClick={handleMarkAllRead}
                disabled={markingAllRead}
                startIcon={markingAllRead ? <CircularProgress size={16} /> : <DoneAllIcon />}
                sx={{
                  color: '#3b82f6',
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.1)' }
                }}
              >
                Mark all read
              </Button>
            )}
          </Box>
        </Box>

        {/* Notifications List */}
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={32} sx={{ color: '#3b82f6' }} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
            <NotificationsNoneIcon sx={{ fontSize: 48, color: '#52525b', mb: 1 }} />
            <Typography sx={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              No notifications yet
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 480, overflowY: 'auto' }}>
            {notifications.map((notification, index) => (
              <MenuItem
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  px: 2,
                  py: 1.5,
                  bgcolor: notification.is_read ? 'transparent' : 'rgba(59, 130, 246, 0.05)',
                  borderLeft: notification.is_read ? 'none' : '3px solid #3b82f6',
                  borderBottom: index < notifications.length - 1 ? '1px solid #27272a' : 'none',
                  '&:hover': {
                    bgcolor: notification.is_read
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(59, 130, 246, 0.1)'
                  },
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 0.5
                }}
              >
                <Box display="flex" alignItems="flex-start" width="100%" gap={1.5}>
                  <ListItemIcon sx={{ minWidth: 'auto', mt: 0.5 }}>
                    {getNotificationIcon(notification.type, notification.priority)}
                  </ListItemIcon>
                  <Box flex={1}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'white',
                        fontWeight: notification.is_read ? 'normal' : 'bold',
                        fontSize: '0.875rem',
                        mb: 0.5
                      }}
                    >
                      {notification.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#9ca3af',
                        fontSize: '0.75rem',
                        display: 'block',
                        lineHeight: 1.4
                      }}
                    >
                      {notification.message}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#6b7280',
                        fontSize: '0.7rem',
                        display: 'block',
                        mt: 0.5
                      }}
                    >
                      {getTimeAgo(notification.created_at)}
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            ))}
          </Box>
        )}

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <Divider sx={{ borderColor: '#27272a' }} />
            <Box sx={{ px: 2, py: 1, textAlign: 'center' }}>
              <Button
                size="small"
                onClick={() => {
                  handleClose()
                  router.push('/notifications')
                }}
                sx={{
                  color: '#3b82f6',
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.1)' }
                }}
              >
                View all notifications
              </Button>
            </Box>
          </>
        )}
      </Menu>
    </>
  )
}

