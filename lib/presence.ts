import { supabase } from '@/lib/supabase'
import { useEffect, useRef, useCallback } from 'react'
import { getOrCreateProfile } from '@/lib/messaging'

const PRESENCE_UPDATE_INTERVAL = 60000 // 60 seconds
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes
const RETRY_DELAY = 5000 // 5 seconds
const DEBOUNCE_DELAY = 1000 // 1 second

// Browser tab coordination using localStorage
const PRESENCE_LEADER_KEY = 'align_presence_leader'
const PRESENCE_LEADER_HEARTBEAT = 'align_presence_heartbeat'
const LEADER_HEARTBEAT_INTERVAL = 30000 // 30 seconds
const LEADER_TIMEOUT = 45000 // 45 seconds

/**
 * Update user's online presence
 * Called periodically to maintain online status
 */
export async function updatePresence(walletAddress: string): Promise<boolean> {
  if (!walletAddress) return false

  try {
    // Ensure profile exists
    await getOrCreateProfile(walletAddress)

    const { error } = await supabase
      .from('user_profiles')
      .update({
        is_online: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', walletAddress)

    if (error) {
      console.error('Error updating presence:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in updatePresence:', error)
    return false
  }
}

/**
 * Set user offline
 * Called on page unload or visibility change
 */
export async function setOffline(walletAddress: string): Promise<boolean> {
  if (!walletAddress) return false

  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        is_online: false,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', walletAddress)

    if (error) {
      console.error('Error setting offline:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in setOffline:', error)
    return false
  }
}

/**
 * Check if a user is currently online
 * Based on last_seen_at timestamp
 */
export function getOnlineStatus(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false

  const lastSeenTime = new Date(lastSeenAt).getTime()
  const now = Date.now()
  const timeDiff = now - lastSeenTime

  return timeDiff < ONLINE_THRESHOLD_MS
}

/**
 * Check if current tab should be the presence leader
 * Only the leader tab sends presence updates to avoid conflicts
 */
function isPresenceLeader(): boolean {
  if (typeof window === 'undefined') return false

  const leaderId = localStorage.getItem(PRESENCE_LEADER_KEY)
  const heartbeat = localStorage.getItem(PRESENCE_LEADER_HEARTBEAT)

  if (!leaderId || !heartbeat) {
    return false
  }

  // Check if current tab is the leader
  const tabId = getTabId()
  if (leaderId === tabId) {
    return true
  }

  // Check if leader's heartbeat is stale
  const heartbeatTime = parseInt(heartbeat, 10)
  const now = Date.now()

  if (now - heartbeatTime > LEADER_TIMEOUT) {
    // Leader is dead, claim leadership
    return false
  }

  return false
}

/**
 * Claim leadership for presence updates
 */
function claimLeadership(): void {
  if (typeof window === 'undefined') return

  const tabId = getTabId()
  localStorage.setItem(PRESENCE_LEADER_KEY, tabId)
  localStorage.setItem(PRESENCE_LEADER_HEARTBEAT, Date.now().toString())
}

/**
 * Release leadership
 */
function releaseLeadership(): void {
  if (typeof window === 'undefined') return

  const tabId = getTabId()
  const currentLeader = localStorage.getItem(PRESENCE_LEADER_KEY)

  if (currentLeader === tabId) {
    localStorage.removeItem(PRESENCE_LEADER_KEY)
    localStorage.removeItem(PRESENCE_LEADER_HEARTBEAT)
  }
}

/**
 * Get or create unique tab ID
 */
function getTabId(): string {
  if (typeof window === 'undefined') return ''

  let tabId = sessionStorage.getItem('align_tab_id')
  if (!tabId) {
    tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('align_tab_id', tabId)
  }
  return tabId
}

/**
 * Update leader heartbeat
 */
function updateLeaderHeartbeat(): void {
  if (typeof window === 'undefined') return

  const tabId = getTabId()
  const currentLeader = localStorage.getItem(PRESENCE_LEADER_KEY)

  if (currentLeader === tabId) {
    localStorage.setItem(PRESENCE_LEADER_HEARTBEAT, Date.now().toString())
  }
}

/**
 * Hook to track user presence automatically
 * Handles periodic updates, visibility changes, and cleanup
 */
export function usePresenceTracking(walletAddress: string | null | undefined) {
  const presenceIntervalRef = useRef<NodeJS.Timeout>()
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>()
  const retryTimeoutRef = useRef<NodeJS.Timeout>()
  const debounceTimeoutRef = useRef<NodeJS.Timeout>()
  const isLeaderRef = useRef(false)
  const lastUpdateRef = useRef<number>(0)

  // Debounced update presence
  const debouncedUpdatePresence = useCallback((wallet: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      const now = Date.now()
      // Prevent updates more frequent than debounce delay
      if (now - lastUpdateRef.current < DEBOUNCE_DELAY) {
        return
      }

      lastUpdateRef.current = now
      const success = await updatePresence(wallet)

      // Retry on failure
      if (!success && retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }

      if (!success) {
        retryTimeoutRef.current = setTimeout(() => {
          debouncedUpdatePresence(wallet)
        }, RETRY_DELAY)
      }
    }, DEBOUNCE_DELAY)
  }, [])

  // Start presence tracking
  const startTracking = useCallback((wallet: string) => {
    // Claim leadership if available
    if (!isPresenceLeader()) {
      claimLeadership()
      isLeaderRef.current = true
    }

    // Initial update
    debouncedUpdatePresence(wallet)

    // Set up periodic updates (only if leader)
    presenceIntervalRef.current = setInterval(() => {
      // Check if still leader
      if (isPresenceLeader() || isLeaderRef.current) {
        debouncedUpdatePresence(wallet)
      } else {
        // Try to become leader if current leader is gone
        if (!localStorage.getItem(PRESENCE_LEADER_KEY)) {
          claimLeadership()
          isLeaderRef.current = true
        }
      }
    }, PRESENCE_UPDATE_INTERVAL)

    // Set up leader heartbeat (only if leader)
    heartbeatIntervalRef.current = setInterval(() => {
      if (isLeaderRef.current) {
        updateLeaderHeartbeat()
      }
    }, LEADER_HEARTBEAT_INTERVAL)
  }, [debouncedUpdatePresence])

  // Stop presence tracking
  const stopTracking = useCallback((wallet: string) => {
    if (presenceIntervalRef.current) {
      clearInterval(presenceIntervalRef.current)
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    // Only set offline if this tab is the leader
    if (isLeaderRef.current) {
      setOffline(wallet)
      releaseLeadership()
      isLeaderRef.current = false
    }
  }, [])

  // Handle visibility change
  useEffect(() => {
    if (!walletAddress) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden, but don't immediately go offline
        // The periodic update will stop while hidden
      } else {
        // Tab is visible again, resume updates
        if (isLeaderRef.current) {
          debouncedUpdatePresence(walletAddress)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [walletAddress, debouncedUpdatePresence])

  // Handle beforeunload
  useEffect(() => {
    if (!walletAddress) return

    const handleBeforeUnload = () => {
      if (isLeaderRef.current) {
        // Use sendBeacon for reliable delivery during page unload
        const blob = new Blob(
          [JSON.stringify({
            wallet_address: walletAddress,
            is_online: false,
            last_seen_at: new Date().toISOString()
          })],
          { type: 'application/json' }
        )

        // Note: This won't work with Supabase directly, but we'll try
        // The interval-based approach will handle most cases
        setOffline(walletAddress)
        releaseLeadership()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [walletAddress])

  // Start/stop tracking based on wallet address
  useEffect(() => {
    if (walletAddress) {
      startTracking(walletAddress)
    }

    return () => {
      if (walletAddress) {
        stopTracking(walletAddress)
      }
    }
  }, [walletAddress, startTracking, stopTracking])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (walletAddress) {
        stopTracking(walletAddress)
      }
    }
  }, [walletAddress, stopTracking])
}











