// components/WalletVerificationFlow.tsx

'use client'

import { useEffect, useState, useRef } from 'react'
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
  
  // Track last connected wallet to clear on disconnect
  const lastWalletRef = useRef<string | null>(null)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  // Session storage helpers - now tracks timestamp to allow re-triggering after timeout
  const getSessionKey = (wallet: string) => `orggly_verification_triggered_${wallet}`
  const TRIGGER_TIMEOUT = 60 * 1000 // Allow re-trigger after 60 seconds if still unverified
  
  const hasTriggeredThisSession = (wallet: string): boolean => {
    if (typeof window === 'undefined') return false
    const value = sessionStorage.getItem(getSessionKey(wallet))
    if (!value) return false
    
    // Handle old format ("true") - clear it and allow trigger
    if (value === 'true') {
      console.log('[WalletVerificationFlow] Old trigger format detected, clearing and allowing re-trigger')
      sessionStorage.removeItem(getSessionKey(wallet))
      return false
    }
    
    // If triggered more than TRIGGER_TIMEOUT ago, allow re-triggering
    const triggeredAt = parseInt(value, 10)
    if (isNaN(triggeredAt) || Date.now() - triggeredAt > TRIGGER_TIMEOUT) {
      console.log('[WalletVerificationFlow] Trigger timeout expired, allowing re-trigger')
      return false
    }
    
    return true
  }
  
  const markAsTriggered = (wallet: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(getSessionKey(wallet), Date.now().toString())
    }
  }
  
  const clearTriggered = (wallet: string) => {
    if (typeof window !== 'undefined') {
      console.log('[WalletVerificationFlow] Clearing trigger status for:', wallet.slice(0, 8))
      sessionStorage.removeItem(getSessionKey(wallet))
    }
  }
  
  // Track wallet changes and clear trigger status on disconnect
  useEffect(() => {
    const currentWallet = publicKey?.toBase58() || null
    
    // If wallet was connected and now disconnected, clear the trigger flag
    if (lastWalletRef.current && !currentWallet) {
      console.log('[WalletVerificationFlow] Wallet disconnected, clearing trigger for:', lastWalletRef.current.slice(0, 8))
      clearTriggered(lastWalletRef.current)
    }
    
    // Update ref to current wallet
    lastWalletRef.current = currentWallet
  }, [publicKey])

  // Call callback when verification completes
  useEffect(() => {
    if (currentStep === 'complete' && onVerificationComplete) {
      onVerificationComplete()
    }
  }, [currentStep, onVerificationComplete])

  // Auto-trigger verification when wallet connects and not verified
  useEffect(() => {
    const currentWallet = publicKey?.toBase58() || null
    // Status check is complete when context has checked THIS wallet (walletAddress matches)
    const statusCheckComplete = !contextLoading && walletAddress === currentWallet
    const alreadyTriggered = currentWallet ? hasTriggeredThisSession(currentWallet) : false
    
    // Log ALL state for debugging
    console.log('[WalletVerificationFlow] === STATE CHECK ===')
    console.log('  connected:', connected)
    console.log('  currentWallet:', currentWallet)
    console.log('  contextLoading:', contextLoading)
    console.log('  walletAddress:', walletAddress)
    console.log('  statusCheckComplete:', statusCheckComplete)
    console.log('  isVerified:', isVerified)
    console.log('  isVerifying:', isVerifying)
    console.log('  currentStep:', currentStep)
    console.log('  alreadyTriggered:', alreadyTriggered)
    
    // Don't do anything if not connected
    if (!connected || !currentWallet) {
      console.log('[WalletVerificationFlow] ❌ SKIP: wallet not connected')
      return
    }
    
    // Wait for status check to complete for THIS wallet
    if (!statusCheckComplete) {
      console.log('[WalletVerificationFlow] ❌ SKIP: status check not complete yet')
      return
    }
    
    // Check if already triggered this session
    if (alreadyTriggered) {
      console.log('[WalletVerificationFlow] ❌ SKIP: already triggered this session (within 60s)')
      return
    }
    
    // If verified, no need to trigger
    if (isVerified) {
      console.log('[WalletVerificationFlow] ❌ SKIP: wallet is verified')
      return
    }
    
    // If already verifying, skip
    if (isVerifying || currentStep !== 'idle') {
      console.log('[WalletVerificationFlow] ❌ SKIP: verification in progress (isVerifying:', isVerifying, 'currentStep:', currentStep, ')')
      return
    }
    
    // All conditions met - trigger verification!
    console.log('[WalletVerificationFlow] ✅✅✅ ALL CONDITIONS MET - TRIGGERING!')
    
    // Mark as triggered immediately
    markAsTriggered(currentWallet)
    
    // Small delay for UX
    const timer = setTimeout(() => {
      console.log('[WalletVerificationFlow] 🚀 Starting verification NOW!')
      startVerification()
    }, 500)

    return () => clearTimeout(timer)
  }, [connected, publicKey, contextLoading, walletAddress, isVerified, isVerifying, currentStep, startVerification])

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

