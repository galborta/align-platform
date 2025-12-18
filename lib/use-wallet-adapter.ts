'use client'

import { useWallet as useWalletOriginal } from '@solana/wallet-adapter-react'
import { useMemo } from 'react'
import { getTestWallet, isTestMode } from './wallet-config'

/**
 * Custom hook that wraps useWallet to support test mode
 * In test mode, returns mock wallet from session storage
 * In production, returns real Solana wallet adapter
 * 
 * Usage: Replace `useWallet()` imports with this hook in components
 */
export function useWallet() {
  const realWallet = useWalletOriginal()
  
  // Check if we're in test mode
  const testWallet = useMemo(() => {
    if (!isTestMode()) return null
    return getTestWallet()
  }, [])
  
  // Return test wallet if available, otherwise real wallet
  if (testWallet) {
    return {
      ...realWallet,
      publicKey: testWallet.publicKey,
      connected: testWallet.connected,
      signMessage: testWallet.signMessage,
      // Mark as test mode for debugging
      isTestMode: true,
    }
  }
  
  return {
    ...realWallet,
    isTestMode: false,
  }
}















