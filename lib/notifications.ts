'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'

type Message = Database['public']['Tables']['messages']['Row']
type UserProfile = Database['public']['Tables']['user_profiles']['Row']

// ============================================================================
// PERMISSION MANAGEMENT
// ============================================================================

/**
 * Request browser notification permission from the user
 * Stores preference in localStorage for tracking
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  // Check if Notification API is available
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications')
    return 'denied'
  }

  // If already granted or denied, return current status
  if (Notification.permission !== 'default') {
    return Notification.permission
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission()
    
    // Store user's choice in localStorage
    localStorage.setItem('align_notification_permission', permission)
    localStorage.setItem('align_notification_permission_time', new Date().toISOString())
    
    return permission
  } catch (error) {
    console.error('Error requesting notification permission:', error)
    return 'denied'
  }
}

/**
 * Check if notifications are supported and permitted
 */
export function canShowNotifications(): boolean {
  if (!('Notification' in window)) {
    return false
  }
  
  return Notification.permission === 'granted'
}

/**
 * Get user's notification preferences from localStorage
 */
export function getNotificationPreference(): boolean {
  if (typeof window === 'undefined') return false
  
  const pref = localStorage.getItem('align_notifications_enabled')
  return pref === 'true' || pref === null // Default to enabled
}

/**
 * Set user's notification preference in localStorage
 */
export function setNotificationPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return
  
  localStorage.setItem('align_notifications_enabled', enabled.toString())
}

// ============================================================================
// NOTIFICATION DISPLAY
// ============================================================================

/**
 * Show a notification for a new message
 */
export async function showMessageNotification(
  message: Message,
  senderProfile: UserProfile | null,
  conversationId: string,
  currentWallet: string,
  onNotificationClick?: () => void
): Promise<void> {
  // Don't notify if it's your own message
  if (message.sender_wallet === currentWallet) {
    return
  }

  // Check if notifications are enabled
  if (!canShowNotifications()) {
    return
  }

  // Check user preference
  if (!getNotificationPreference()) {
    return
  }

  // Check if tab is in focus (don't notify if user is already looking)
  if (!document.hidden) {
    return
  }

  // Check if this conversation is muted
  const mutedConversations = getMutedConversations()
  if (mutedConversations.includes(conversationId)) {
    return
  }

  try {
    // Get sender display name
    const senderName = senderProfile?.display_name || 
                      `${message.sender_wallet.slice(0, 4)}...${message.sender_wallet.slice(-4)}`
    
    // Truncate message content based on preview preference
    const previewPref = getNotificationPreviewPreference()
    let body = ''
    
    switch (previewPref) {
      case 'full':
        body = message.content.length > 100 
          ? message.content.slice(0, 100) + '...' 
          : message.content
        break
      case 'sender':
        body = 'Sent you a message'
        break
      case 'none':
        body = 'New message'
        break
      default:
        body = message.content.length > 100 
          ? message.content.slice(0, 100) + '...' 
          : message.content
    }

    // Create notification
    const notification = new Notification(senderName, {
      body,
      icon: senderProfile?.avatar_url || '/icons/message-icon.png',
      badge: '/icons/badge-icon.png',
      tag: `conversation-${conversationId}`, // Replace old notifications from same conversation
      requireInteraction: false,
      silent: !getNotificationSoundPreference(),
      timestamp: new Date(message.created_at).getTime(),
      data: {
        conversationId,
        messageId: message.id,
        senderWallet: message.sender_wallet,
      }
    })

    // Handle notification click
    notification.onclick = (event) => {
      event.preventDefault()
      
      // Focus the window
      window.focus()
      
      // Close notification
      notification.close()
      
      // Call custom handler if provided
      if (onNotificationClick) {
        onNotificationClick()
      }
    }

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close()
    }, 5000)

    // Play sound if enabled
    if (getNotificationSoundPreference()) {
      playNotificationSound()
    }
  } catch (error) {
    console.error('Error showing notification:', error)
  }
}

// ============================================================================
// SOUND
// ============================================================================

/**
 * Play notification sound
 */
function playNotificationSound(): void {
  try {
    // Create audio context for a simple beep
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    // Configure sound: short, pleasant beep at 800Hz
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    
    // Volume envelope: fade in and out
    gainNode.gain.setValueAtTime(0, audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05)
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.15)
    
    // Play for 150ms
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.15)
  } catch (error) {
    console.error('Error playing notification sound:', error)
  }
}

// ============================================================================
// PREFERENCES
// ============================================================================

/**
 * Get notification preview preference
 * Options: 'full' | 'sender' | 'none'
 */
export function getNotificationPreviewPreference(): 'full' | 'sender' | 'none' {
  if (typeof window === 'undefined') return 'full'
  
  const pref = localStorage.getItem('align_notification_preview')
  if (pref === 'sender' || pref === 'none') return pref
  return 'full' // Default
}

/**
 * Set notification preview preference
 */
export function setNotificationPreviewPreference(preview: 'full' | 'sender' | 'none'): void {
  if (typeof window === 'undefined') return
  
  localStorage.setItem('align_notification_preview', preview)
}

/**
 * Get notification sound preference
 */
export function getNotificationSoundPreference(): boolean {
  if (typeof window === 'undefined') return true
  
  const pref = localStorage.getItem('align_notification_sound')
  return pref !== 'false' // Default to enabled
}

/**
 * Set notification sound preference
 */
export function setNotificationSoundPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return
  
  localStorage.setItem('align_notification_sound', enabled.toString())
}

/**
 * Get muted conversations list
 */
export function getMutedConversations(): string[] {
  if (typeof window === 'undefined') return []
  
  const muted = localStorage.getItem('align_muted_conversations')
  return muted ? JSON.parse(muted) : []
}

/**
 * Mute a conversation
 */
export function muteConversation(conversationId: string): void {
  if (typeof window === 'undefined') return
  
  const muted = getMutedConversations()
  if (!muted.includes(conversationId)) {
    muted.push(conversationId)
    localStorage.setItem('align_muted_conversations', JSON.stringify(muted))
  }
}

/**
 * Unmute a conversation
 */
export function unmuteConversation(conversationId: string): void {
  if (typeof window === 'undefined') return
  
  const muted = getMutedConversations()
  const filtered = muted.filter(id => id !== conversationId)
  localStorage.setItem('align_muted_conversations', JSON.stringify(filtered))
}

/**
 * Check if conversation is muted
 */
export function isConversationMuted(conversationId: string): boolean {
  return getMutedConversations().includes(conversationId)
}

// ============================================================================
// REACT HOOK
// ============================================================================

/**
 * Hook to enable message notifications for the current user
 * Subscribes to new messages in real-time and shows notifications
 */
export function useMessageNotifications(
  walletAddress: string | null | undefined,
  onNotificationClick?: (conversationId: string) => void
) {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default')
  const [isEnabled, setIsEnabled] = useState(false)

  // Check permission status on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }

    setPermissionStatus(Notification.permission)
    setIsEnabled(getNotificationPreference())
  }, [])

  // Request permission callback
  const requestPermission = useCallback(async () => {
    const permission = await requestNotificationPermission()
    setPermissionStatus(permission)
    
    if (permission === 'granted') {
      setIsEnabled(true)
      setNotificationPreference(true)
    }
    
    return permission
  }, [])

  // Toggle notifications
  const toggleNotifications = useCallback((enabled: boolean) => {
    setIsEnabled(enabled)
    setNotificationPreference(enabled)
  }, [])

  // Subscribe to new messages
  useEffect(() => {
    if (!walletAddress || !isEnabled || permissionStatus !== 'granted') {
      return
    }

    // Get all conversations where this wallet is a participant
    const setupSubscription = async () => {
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_1.eq.${walletAddress},participant_2.eq.${walletAddress}`)

      if (!conversations || conversations.length === 0) {
        return
      }

      const conversationIds = conversations.map(c => c.id)

      // Subscribe to new messages in these conversations
      const channel = supabase
        .channel(`notifications_${walletAddress}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=in.(${conversationIds.join(',')})`
          },
          async (payload) => {
            const newMessage = payload.new as Message

            // Don't notify for own messages
            if (newMessage.sender_wallet === walletAddress) {
              return
            }

            // Get sender profile
            const { data: senderProfile } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('wallet_address', newMessage.sender_wallet)
              .maybeSingle()

            // Show notification
            await showMessageNotification(
              newMessage,
              senderProfile,
              newMessage.conversation_id,
              walletAddress,
              onNotificationClick ? () => onNotificationClick(newMessage.conversation_id) : undefined
            )
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }

    setupSubscription()
  }, [walletAddress, isEnabled, permissionStatus, onNotificationClick])

  return {
    permissionStatus,
    isEnabled,
    requestPermission,
    toggleNotifications,
    canShowNotifications: permissionStatus === 'granted' && isEnabled,
  }
}

// ============================================================================
// TEST NOTIFICATION
// ============================================================================

/**
 * Show a test notification to verify setup
 */
export function showTestNotification(): void {
  if (!canShowNotifications()) {
    console.error('Notifications not permitted')
    return
  }

  const notification = new Notification('Align - Test Notification', {
    body: 'Notifications are working correctly! 🎉',
    icon: '/icons/message-icon.png',
    badge: '/icons/badge-icon.png',
    tag: 'test-notification',
  })

  notification.onclick = () => {
    notification.close()
  }

  setTimeout(() => {
    notification.close()
  }, 3000)

  if (getNotificationSoundPreference()) {
    playNotificationSound()
  }
}







