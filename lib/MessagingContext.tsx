'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { getUnreadCount } from '@/lib/messaging'
import { countPendingSocialAssets } from '@/lib/feed-queries-social-assets'
import { supabase } from '@/lib/supabase'

// Section types for the messaging sidebar
export type MessagingSidebarSection = 'messages' | 'social-assets'

// Options for opening the messages sidebar
export interface OpenMessagesOptions {
  walletAddress?: string
  section?: MessagingSidebarSection
  projectId?: string
  highlightAssetId?: string
}

interface MessagingContextType {
  isOpen: boolean
  targetWallet: string | null
  activeSection: MessagingSidebarSection
  projectContext: string | null
  highlightAssetId: string | null
  unreadCount: number
  pendingAssetsCount: number  // Pending social asset reviews count
  totalBadgeCount: number  // Combined count for header badge
  openMessages: (options?: string | OpenMessagesOptions) => Promise<void>
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
  const [activeSection, setActiveSection] = useState<MessagingSidebarSection>('messages')
  const [projectContext, setProjectContext] = useState<string | null>(null)
  const [highlightAssetId, setHighlightAssetId] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingAssetsCount, setPendingAssetsCount] = useState(0)
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false)
  const [userProjects, setUserProjects] = useState<string[]>([]) // Projects user is creator/editor of

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

  // Check user permissions (global admin, project creator/editor)
  useEffect(() => {
    if (!currentWallet) {
      setIsGlobalAdmin(false)
      setUserProjects([])
      return
    }

    async function checkPermissions() {
      try {
        // Check if global admin
        const { data: adminData } = await supabase
          .from('global_admins')
          .select('wallet_address')
          .eq('wallet_address', currentWallet)
          .maybeSingle()

        setIsGlobalAdmin(!!adminData)

        // Get projects where user is creator or editor
        const { data: creatorProjects } = await supabase
          .from('projects')
          .select('id')
          .eq('creator_wallet', currentWallet)

        const { data: editorProjects } = await supabase
          .from('projects')
          .select('id')
          .contains('editor_wallets', [currentWallet])

        const allProjects = [
          ...(creatorProjects || []).map(p => p.id),
          ...(editorProjects || []).map(p => p.id)
        ]
        setUserProjects([...new Set(allProjects)])
      } catch (error) {
        console.error('[MessagingContext] Error checking permissions:', error)
      }
    }

    checkPermissions()
  }, [currentWallet])

  // Load pending assets count for users who can review
  const loadPendingAssetsCount = useCallback(async () => {
    if (!currentWallet) {
      setPendingAssetsCount(0)
      return
    }

    // Global admins see all pending assets
    if (isGlobalAdmin) {
      const count = await countPendingSocialAssets('all')
      console.log('[MessagingContext] Pending assets count (global admin):', count)
      setPendingAssetsCount(count)
      return
    }

    // Project creators/editors see their projects' pending assets
    if (userProjects.length > 0) {
      let totalCount = 0
      for (const projectId of userProjects) {
        const count = await countPendingSocialAssets(projectId)
        totalCount += count
      }
      console.log('[MessagingContext] Pending assets count (project editor):', totalCount)
      setPendingAssetsCount(totalCount)
      return
    }

    // Regular users don't see pending assets
    setPendingAssetsCount(0)
  }, [currentWallet, isGlobalAdmin, userProjects])

  // Initial load
  useEffect(() => {
    loadUnreadCount()
    
    // Refresh every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000)
    
    return () => clearInterval(interval)
  }, [loadUnreadCount])

  // Load pending assets count when permissions change
  useEffect(() => {
    loadPendingAssetsCount()
    
    // Refresh every 30 seconds
    const interval = setInterval(loadPendingAssetsCount, 30000)
    
    return () => clearInterval(interval)
  }, [loadPendingAssetsCount])

  // Subscribe to pending_assets changes for real-time updates
  useEffect(() => {
    if (!currentWallet || (!isGlobalAdmin && userProjects.length === 0)) return

    const channel = supabase
      .channel(`pending_assets_count_${currentWallet}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_assets'
        },
        () => {
          console.log('[MessagingContext] Pending assets change detected, refreshing count')
          loadPendingAssetsCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentWallet, isGlobalAdmin, userProjects, loadPendingAssetsCount])

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

  // Open messages with optional target wallet or options object
  const openMessages = useCallback(async (options?: string | OpenMessagesOptions) => {
    // Handle legacy string parameter (wallet address)
    if (typeof options === 'string') {
      setTargetWallet(options)
      setActiveSection('messages')
      setProjectContext(null)
      setHighlightAssetId(null)
    } else if (options) {
      // Handle new options object
      if (options.walletAddress) {
        setTargetWallet(options.walletAddress)
      } else {
        setTargetWallet(null)
      }
      setActiveSection(options.section || 'messages')
      setProjectContext(options.projectId || null)
      setHighlightAssetId(options.highlightAssetId || null)
    } else {
      // No options - just open to messages list
      setTargetWallet(null)
      setActiveSection('messages')
      setProjectContext(null)
      setHighlightAssetId(null)
    }
    setIsOpen(true)
  }, [])

  // Close messages
  const closeMessages = useCallback(() => {
    setIsOpen(false)
    // Clear state after animation
    setTimeout(() => {
      setTargetWallet(null)
      setActiveSection('messages')
      setProjectContext(null)
      setHighlightAssetId(null)
    }, 300)
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

  // Calculate total badge count (messages + pending assets)
  const totalBadgeCount = unreadCount + pendingAssetsCount

  const value: MessagingContextType = {
    isOpen,
    targetWallet,
    activeSection,
    projectContext,
    highlightAssetId,
    unreadCount,
    pendingAssetsCount,
    totalBadgeCount,
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



