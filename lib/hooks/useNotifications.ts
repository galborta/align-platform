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
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  refreshNotifications: () => Promise<void>
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

  // Fetch initial notifications
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
      setError('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId)

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))

      console.log(`✅ Marked notification ${notificationId} as read`)
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }, [])

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

  // Set up real-time subscription for new notifications and updates
  useEffect(() => {
    if (!walletAddress) return

    let channel: RealtimeChannel

    const setupRealtimeSubscription = async () => {
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

              // Note: Browser notification is handled by existing system in /lib/notifications.ts
              // based on notification type and BROWSER_NOTIFICATION_TYPES array
            } catch (err) {
              console.error('Error enriching new notification:', err)
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
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Real-time notification subscription error')
          }
        })
    }

    setupRealtimeSubscription()

    // Cleanup subscription on unmount or wallet change
    return () => {
      if (channel) {
        console.log('🔌 Unsubscribing from notification updates')
        supabase.removeChannel(channel)
      }
    }
  }, [walletAddress])

  // Fetch notifications on wallet change
  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refreshNotifications: fetchNotifications
  }
}

