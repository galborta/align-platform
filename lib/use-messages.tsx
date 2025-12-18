'use client'

import { useState, useEffect, useCallback } from 'react'
import { getUnreadCount } from '@/lib/messaging'

/**
 * Hook for managing messages sidebar state
 * 
 * @example
 * ```tsx
 * const { isOpen, openMessages, closeMessages, unreadCount } = useMessages(walletAddress)
 * 
 * return (
 *   <>
 *     <button onClick={openMessages}>
 *       Messages {unreadCount > 0 && `(${unreadCount})`}
 *     </button>
 *     
 *     <MessagesSidebar 
 *       isOpen={isOpen}
 *       onClose={closeMessages}
 *       currentWallet={walletAddress}
 *     />
 *   </>
 * )
 * ```
 */
export function useMessages(walletAddress: string | null | undefined) {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Load unread count
  const loadUnreadCount = useCallback(async () => {
    if (!walletAddress) {
      setUnreadCount(0)
      return
    }
    
    const count = await getUnreadCount(walletAddress)
    setUnreadCount(count)
  }, [walletAddress])

  // Load on mount and wallet change
  useEffect(() => {
    loadUnreadCount()
    
    // Refresh every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000)
    
    return () => clearInterval(interval)
  }, [loadUnreadCount])

  // Keyboard shortcut: Cmd/Ctrl + M to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const openMessages = useCallback(() => setIsOpen(true), [])
  const closeMessages = useCallback(() => setIsOpen(false), [])
  const toggleMessages = useCallback(() => setIsOpen(prev => !prev), [])

  return {
    isOpen,
    unreadCount,
    openMessages,
    closeMessages,
    toggleMessages,
    refreshUnreadCount: loadUnreadCount
  }
}

















