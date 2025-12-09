// contexts/VerificationContext.tsx

'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

interface VerificationContextType {
  isVerified: boolean
  isLoading: boolean
  walletAddress: string | null
  verifiedAt: string | null
  checkVerificationStatus: (wallet: string) => Promise<void>
  refreshStatus: () => Promise<void>
}

const VerificationContext = createContext<VerificationContextType | undefined>(undefined)

export function VerificationProvider({ children }: { children: ReactNode }) {
  const { publicKey, connected } = useWallet()
  const [isVerified, setIsVerified] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<number>(0)

  // Cache duration: 5 minutes
  const CACHE_DURATION = 5 * 60 * 1000

  const checkVerificationStatus = useCallback(async (wallet: string) => {
    // Check cache first
    const now = Date.now()
    if (now - lastChecked < CACHE_DURATION && walletAddress === wallet) {
      console.log('[VerificationContext] Using cached verification status')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/wallet/status?wallet=${wallet}`)
      const data = await response.json()

      if (response.ok) {
        setIsVerified(data.verified)
        setVerifiedAt(data.verifiedAt || null)
        setWalletAddress(wallet)
        setLastChecked(now)
        
        console.log(`[VerificationContext] Wallet ${wallet.slice(0, 8)}... verified: ${data.verified}`)
      } else {
        console.error('[VerificationContext] Failed to check status:', data.error)
        // Don't update state on error - keep previous state
      }
    } catch (error) {
      console.error('[VerificationContext] Error checking verification:', error)
      // Silent failure - don't disrupt user experience
    } finally {
      setIsLoading(false)
    }
  }, [lastChecked, walletAddress, CACHE_DURATION])

  const refreshStatus = useCallback(async () => {
    if (walletAddress) {
      // Force refresh by clearing cache
      setLastChecked(0)
      await checkVerificationStatus(walletAddress)
    }
  }, [walletAddress, checkVerificationStatus])

  // Auto-check when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      const wallet = publicKey.toBase58()
      checkVerificationStatus(wallet)
    } else {
      // Clear state when wallet disconnects
      setIsVerified(false)
      setWalletAddress(null)
      setVerifiedAt(null)
      setLastChecked(0)
    }
  }, [connected, publicKey]) // Note: intentionally not including checkVerificationStatus to avoid infinite loops

  return (
    <VerificationContext.Provider
      value={{
        isVerified,
        isLoading,
        walletAddress,
        verifiedAt,
        checkVerificationStatus,
        refreshStatus,
      }}
    >
      {children}
    </VerificationContext.Provider>
  )
}

export function useVerification() {
  const context = useContext(VerificationContext)
  if (context === undefined) {
    throw new Error('useVerification must be used within a VerificationProvider')
  }
  return context
}

