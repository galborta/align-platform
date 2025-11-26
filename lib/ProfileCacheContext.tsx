'use client'

import { createContext, useContext, useCallback, ReactNode, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import { profileCache } from '@/lib/cache'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']

interface ProfileCacheContextType {
  getProfile: (walletAddress: string) => Promise<UserProfile | null>
  prefetchProfiles: (walletAddresses: string[]) => Promise<void>
  invalidateProfile: (walletAddress: string) => void
  clearCache: () => void
}

const ProfileCacheContext = createContext<ProfileCacheContextType | undefined>(undefined)

interface ProfileCacheProviderProps {
  children: ReactNode
}

export function ProfileCacheProvider({ children }: ProfileCacheProviderProps) {
  
  /**
   * Get profile from cache or fetch from database
   */
  const getProfile = useCallback(async (walletAddress: string): Promise<UserProfile | null> => {
    // Check cache first
    const cached = profileCache.get(walletAddress)
    if (cached) {
      return cached
    }

    try {
      // Fetch from database with only needed columns
      const { data, error } = await supabase
        .from('user_profiles')
        .select('wallet_address, display_name, avatar_url, bio, is_online, last_seen_at, privacy_level, allow_messages_from')
        .eq('wallet_address', walletAddress)
        .maybeSingle()

      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }

      if (data) {
        profileCache.set(walletAddress, data)
      }

      return data
    } catch (error) {
      console.error('Error in getProfile:', error)
      return null
    }
  }, [])

  /**
   * Prefetch multiple profiles in a single query
   */
  const prefetchProfiles = useCallback(async (walletAddresses: string[]): Promise<void> => {
    // Filter out already cached profiles
    const uncached = walletAddresses.filter(addr => !profileCache.has(addr))
    
    if (uncached.length === 0) {
      return
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('wallet_address, display_name, avatar_url, bio, is_online, last_seen_at, privacy_level, allow_messages_from')
        .in('wallet_address', uncached)

      if (error) {
        console.error('Error prefetching profiles:', error)
        return
      }

      // Cache all fetched profiles
      data?.forEach(profile => {
        profileCache.set(profile.wallet_address, profile)
      })
    } catch (error) {
      console.error('Error in prefetchProfiles:', error)
    }
  }, [])

  /**
   * Invalidate a specific profile (e.g., after update)
   */
  const invalidateProfile = useCallback((walletAddress: string): void => {
    profileCache.delete(walletAddress)
  }, [])

  /**
   * Clear entire cache
   */
  const clearCache = useCallback((): void => {
    profileCache.clear()
  }, [])

  // Subscribe to profile updates to invalidate cache
  useEffect(() => {
    const channel = supabase
      .channel('profile_cache_invalidation')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles'
        },
        (payload) => {
          const updatedProfile = payload.new as UserProfile
          // Invalidate cache for updated profile
          invalidateProfile(updatedProfile.wallet_address)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [invalidateProfile])

  const value: ProfileCacheContextType = {
    getProfile,
    prefetchProfiles,
    invalidateProfile,
    clearCache
  }

  return (
    <ProfileCacheContext.Provider value={value}>
      {children}
    </ProfileCacheContext.Provider>
  )
}

/**
 * Hook to access profile cache
 */
export function useProfileCache() {
  const context = useContext(ProfileCacheContext)
  if (context === undefined) {
    throw new Error('useProfileCache must be used within a ProfileCacheProvider')
  }
  return context
}




