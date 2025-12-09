// components/WalletVerificationFlow.tsx

'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVerification } from '@/contexts/VerificationContext'
import { useWalletVerification } from '@/hooks/useWalletVerification'
import { GeoCheckModal } from '@/components/modals/GeoCheckModal'
import { TermsModal } from '@/components/modals/TermsModal'

interface WalletVerificationFlowProps {
  onVerificationComplete?: () => void
  /** Delay before auto-triggering (ms) - gives time for status check */
  autoTriggerDelay?: number
}

export function WalletVerificationFlow({
  onVerificationComplete,
  autoTriggerDelay = 1500,
}: WalletVerificationFlowProps) {
  const { connected, publicKey } = useWallet()
  const { isVerified, isLoading: contextLoading, walletAddress } = useVerification()
  const {
    startVerification,
    cancelVerification,
    isVerifying,
    currentStep,
    showGeoCheck,
    showTerms,
    handleGeoCheckConfirm,
    handleTermsAccept,
  } = useWalletVerification()

  // Portal mounting state (for SSR compatibility)
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if we've already triggered verification for this wallet this session
  const getSessionKey = (wallet: string) => `orggly_verification_triggered_${wallet}`
  
  const hasTriggeredThisSession = (wallet: string): boolean => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem(getSessionKey(wallet)) === 'true'
  }
  
  const markAsTriggered = (wallet: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(getSessionKey(wallet), 'true')
    }
  }

  // Call callback when verification completes
  useEffect(() => {
    if (currentStep === 'complete' && onVerificationComplete) {
      onVerificationComplete()
    }
  }, [currentStep, onVerificationComplete])

  // Auto-trigger verification when wallet connects and not verified
  useEffect(() => {
    const currentWallet = publicKey?.toBase58() || null
    const statusCheckComplete = walletAddress === currentWallet && !contextLoading
    const alreadyTriggered = currentWallet ? hasTriggeredThisSession(currentWallet) : false
    
    // Log state for debugging
    console.log('[WalletVerificationFlow] State check:', {
      connected,
      isVerified,
      contextLoading,
      walletAddress,
      currentWallet,
      statusCheckComplete,
      isVerifying,
      alreadyTriggered,
      currentStep
    })
    
    // Wait for status check to complete before deciding whether to trigger
    if (
      connected &&
      currentWallet &&
      statusCheckComplete &&  // Status check must be complete for this wallet
      !isVerified &&
      !isVerifying &&
      !alreadyTriggered &&   // Check sessionStorage instead of ref
      currentStep === 'idle'
    ) {
      console.log('[WalletVerificationFlow] ✅ All conditions met, scheduling auto-trigger...')
      
      // Mark as triggered immediately to prevent race conditions
      markAsTriggered(currentWallet)
      
      // Short delay for smooth UX
      const timer = setTimeout(() => {
        console.log('[WalletVerificationFlow] 🚀 Auto-triggering verification NOW!')
        startVerification()
      }, 500)

      return () => {
        clearTimeout(timer)
      }
    }
  }, [connected, publicKey, walletAddress, isVerified, contextLoading, isVerifying, currentStep, startVerification])

  // Handle modal close - cancel the flow
  const handleGeoCheckClose = () => {
    console.log('[WalletVerificationFlow] GeoCheck modal closed')
    cancelVerification()
  }

  const handleTermsClose = () => {
    console.log('[WalletVerificationFlow] Terms modal closed')
    cancelVerification()
  }

  // Don't render anything visible - this component just manages the verification flow
  // Only render modals when needed
  if (!connected || isVerified) {
    return null
  }

  return (
    <>
      {/* Geo Check Modal - Rendered via Portal to escape header stacking context */}
      {mounted && showGeoCheck && createPortal(
        <GeoCheckModal
          isOpen={showGeoCheck}
          onClose={handleGeoCheckClose}
          onConfirm={handleGeoCheckConfirm}
        />,
        document.body
      )}

      {/* Terms Modal - Rendered via Portal to escape header stacking context */}
      {mounted && showTerms && createPortal(
        <TermsModal
          isOpen={showTerms}
          onClose={handleTermsClose}
          onAccept={handleTermsAccept}
        />,
        document.body
      )}
    </>
  )
}

export default WalletVerificationFlow

