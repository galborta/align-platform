'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import { notificationService } from '@/lib/services/notificationService'
import type { EnrichedNotification } from '@/lib/services/notificationService'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UseNotificationsReturn {
  notifications: EnrichedNotification[]
  unreadCount: number
  loading: boolean
  error: string | null
  refreshing: boolean
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  refreshNotifications: () => Promise<void>
  adminNotifications: EnrichedNotification[]
  adminUnreadCount: number
}

/**
 * Hook for managing notification state and real-time subscriptions
 * 
 * Features:
 * - Fetches initial notifications on mount (last 50)
 * - Real-time updates via Supabase subscriptions
 * - Tracks unread count
 * - Provides methods to mark notifications as read
 * 
 * @returns Notification state and methods
 */
export function useNotifications(): UseNotificationsReturn {
  const { publicKey } = useWallet()
  const walletAddress = publicKey?.toBase58()

  const [notifications, setNotifications] = useState<EnrichedNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Fetch initial notifications with error handling
  const fetchNotifications = useCallback(async () => {
    if (!walletAddress) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Fetch last 50 notifications
      const enrichedNotifications = await notificationService.getNotifications(
        walletAddress,
        50,
        0
      )

      setNotifications(enrichedNotifications)

      // Calculate unread count
      const unread = enrichedNotifications.filter(n => !n.is_read).length
      setUnreadCount(unread)

      console.log(`📬 Loaded ${enrichedNotifications.length} notifications (${unread} unread)`)
    } catch (err) {
      console.error('Error fetching notifications:', err)
      setError(err instanceof Error ? err.message : 'Failed to load notifications')
      // Keep existing data on error (don't clear)
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  // Manual refresh with refreshing state
  const refreshNotifications = useCallback(async () => {
    if (!walletAddress) return

    setRefreshing(true)
    setError(null)
    
    try {
      const enrichedNotifications = await notificationService.getNotifications(
        walletAddress,
        50,
        0
      )

      setNotifications(enrichedNotifications)
      const unread = enrichedNotifications.filter(n => !n.is_read).length
      setUnreadCount(unread)

      console.log(`🔄 Refreshed ${enrichedNotifications.length} notifications`)
    } catch (err) {
      console.error('Error refreshing notifications:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh notifications')
    } finally {
      setRefreshing(false)
    }
  }, [walletAddress])

  // Mark single notification as read with optimistic update
  const markAsRead = useCallback(async (notificationId: string) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, is_read: true } : n
      )
    )
    setUnreadCount(prev => Math.max(0, prev - 1))

    try {
      await notificationService.markAsRead(notificationId)
      console.log(`✅ Marked notification ${notificationId} as read`)
    } catch (err) {
      console.error('Error marking notification as read:', err)
      // Revert on error
      fetchNotifications()
    }
  }, [fetchNotifications])

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!walletAddress) return

    try {
      await notificationService.markAllAsRead(walletAddress)

      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      )
      setUnreadCount(0)

      console.log('✅ Marked all notifications as read')
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
  }, [walletAddress])

  // Set up real-time subscription with error handling and reconnect
  useEffect(() => {
    if (!walletAddress) return

    let channel: RealtimeChannel
    let reconnectTimer: NodeJS.Timeout

    const setupRealtimeSubscription = async () => {
      try {
        console.log(`🔔 Setting up real-time notifications for ${walletAddress}`)

        channel = supabase
          .channel(`notifications:${walletAddress}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_wallet=eq.${walletAddress}`
            },
            async (payload) => {
              console.log('🔔 New notification received:', payload.new)

              try {
                // Enrich the new notification with actor profile data
                const enriched = await notificationService.enrichNotification(
                  payload.new as any
                )

                // Add to state (keep only last 50)
                setNotifications(prev => [enriched, ...prev].slice(0, 50))
                
                // Increment unread count if notification is unread
                if (!enriched.is_read) {
                  setUnreadCount(prev => prev + 1)
                }

                console.log(`✅ Added new notification to state (unread: ${!enriched.is_read})`)
              } catch (err) {
                console.error('Error handling new notification:', err)
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'notifications',
              filter: `user_wallet=eq.${walletAddress}`
            },
            (payload) => {
              console.log('🔄 Notification updated:', payload.new)

              const updated = payload.new as any

              // Update notification in state
              setNotifications(prev =>
                prev.map(n => (n.id === updated.id ? { ...n, ...updated } : n))
              )

              // Recalculate unread count
              setNotifications(prev => {
                const unread = prev.filter(n => !n.is_read).length
                setUnreadCount(unread)
                return prev
              })

              console.log('✅ Updated notification in state')
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Real-time notification subscription active')
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.error('❌ Subscription error, retrying in 5s...')
              // Retry connection after 5 seconds
              reconnectTimer = setTimeout(() => {
                setupRealtimeSubscription()
              }, 5000)
            }
          })
      } catch (err) {
        console.error('Error setting up real-time subscription:', err)
        // Retry after 10 seconds on setup error
        reconnectTimer = setTimeout(() => {
          setupRealtimeSubscription()
        }, 10000)
      }
    }

    setupRealtimeSubscription()

    // Cleanup subscription on unmount or wallet change
    return () => {
      if (channel) {
        console.log('🔌 Unsubscribing from notification updates')
        supabase.removeChannel(channel)
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
    }
  }, [walletAddress])

  // Fetch notifications on wallet change
  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Filter admin notifications
  const adminNotifications = notifications.filter(n => n.type.startsWith('admin_'))
  const adminUnreadCount = adminNotifications.filter(n => !n.is_read).length

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refreshing,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    adminNotifications,
    adminUnreadCount
  }
}

