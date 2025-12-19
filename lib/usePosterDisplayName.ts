'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Hook to fetch the display name for a wallet address
 * Returns the display name if available, otherwise returns the truncated wallet address
 */
export function usePosterDisplayName(walletAddress: string) {
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false)
      return
    }

    const fetchDisplayName = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('display_name')
          .eq('wallet_address', walletAddress)
          .maybeSingle()

        if (!error && data?.display_name) {
          setDisplayName(data.display_name)
        }
      } catch (error) {
        console.error('Error fetching display name:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDisplayName()
  }, [walletAddress])

  const truncatedWallet = walletAddress 
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : '...'

  return {
    displayName,
    truncatedWallet,
    // Returns display name if available, otherwise truncated wallet
    displayNameOrWallet: displayName || truncatedWallet,
    // Whether the displayNameOrWallet is a display name (true) or wallet address (false)
    hasDisplayName: !!displayName,
    loading
  }
}

/**
 * Utility function to truncate a wallet address
 */
export function truncateWalletAddress(address: string): string {
  if (!address) return '...'
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}








