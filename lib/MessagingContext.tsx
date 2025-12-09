'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { getUnreadCount } from '@/lib/messaging'
import { supabase } from '@/lib/supabase'

interface MessagingContextType {
  isOpen: boolean
  targetWallet: string | null
  unreadCount: number
  openMessages: (walletAddress?: string) => Promise<void>
  closeMessages: () => void
  toggleMessages: () => void
  refreshUnreadCount: () => Promise<void>
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined)

interface MessagingProviderProps {
  children: ReactNode
  currentWallet: string | null | undefined
}

export function MessagingProvider({ children, currentWallet }: MessagingProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [targetWallet, setTargetWallet] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  // Load unread count
  const loadUnreadCount = useCallback(async () => {
    if (!currentWallet) {
      setUnreadCount(0)
      return
    }
    
    const count = await getUnreadCount(currentWallet)
    console.log('[MessagingContext] Unread count for', currentWallet.slice(0, 8), ':', count)
    setUnreadCount(count)
  }, [currentWallet])

  // Initial load
  useEffect(() => {
    loadUnreadCount()
    
    // Refresh every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000)
    
    return () => clearInterval(interval)
  }, [loadUnreadCount])

  // Subscribe to real-time message AND conversation updates
  useEffect(() => {
    if (!currentWallet) return

    const channel = supabase
      .channel(`messaging_context_${currentWallet}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          console.log('[MessagingContext] Message change detected, refreshing unread count')
          loadUnreadCount()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations'
        },
        (payload) => {
          // Check if current wallet is a participant in the new conversation
          const newConv = payload.new as { participant_1: string; participant_2: string }
          if (newConv.participant_1 === currentWallet || newConv.participant_2 === currentWallet) {
            console.log('[MessagingContext] New conversation detected, refreshing unread count')
            loadUnreadCount()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentWallet, loadUnreadCount])

  // Open messages with optional target wallet
  const openMessages = useCallback(async (walletAddress?: string) => {
    if (walletAddress) {
      // Just set the target wallet, don't create conversation yet
      // Conversation will be created when first message is sent
      setTargetWallet(walletAddress)
    } else {
      setTargetWallet(null)
    }
    setIsOpen(true)
  }, [])

  // Close messages
  const closeMessages = useCallback(() => {
    setIsOpen(false)
    // Clear target wallet after animation
    setTimeout(() => setTargetWallet(null), 300)
  }, [])

  // Toggle messages
  const toggleMessages = useCallback(() => {
    if (isOpen) {
      closeMessages()
    } else {
      openMessages()
    }
  }, [isOpen, openMessages, closeMessages])

  // Keyboard shortcut: Cmd/Ctrl + M
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault()
        toggleMessages()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleMessages])

  const value: MessagingContextType = {
    isOpen,
    targetWallet,
    unreadCount,
    openMessages,
    closeMessages,
    toggleMessages,
    refreshUnreadCount: loadUnreadCount
  }

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  )
}

// Hook to use messaging context
export function useMessaging() {
  const context = useContext(MessagingContext)
  if (context === undefined) {
    throw new Error('useMessaging must be used within a MessagingProvider')
  }
  return context
}



