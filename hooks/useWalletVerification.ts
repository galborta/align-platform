// hooks/useWalletVerification.ts

'use client'

import { useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVerification } from '@/contexts/VerificationContext'
import { generateVerificationMessage } from '@/lib/solana-signature'
import toast from 'react-hot-toast'

type VerificationStep = 
  | 'idle' 
  | 'nonce' 
  | 'geo-check' 
  | 'terms' 
  | 'signing' 
  | 'verifying' 
  | 'complete'

export function useWalletVerification() {
  const { publicKey, signMessage } = useWallet()
  const { refreshStatus } = useVerification()

  const [currentStep, setCurrentStep] = useState<VerificationStep>('idle')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showGeoCheck, setShowGeoCheck] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [nonce, setNonce] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)

  // Reset flow to initial state
  const resetFlow = useCallback(() => {
    setCurrentStep('idle')
    setIsVerifying(false)
    setError(null)
    setShowGeoCheck(false)
    setShowTerms(false)
    setNonce(null)
    setMessage(null)
    setSignature(null)
  }, [])

  // Step 1: Generate nonce from API
  const generateNonce = useCallback(async (): Promise<boolean> => {
    if (!publicKey) {
      toast.error('Please connect your wallet first')
      return false
    }

    const wallet = publicKey.toBase58()
    setCurrentStep('nonce')

    const toastId = toast.loading('Generating verification code...')

    try {
      const response = await fetch('/api/nonce/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to generate verification code')
      }

      // Generate message to sign using the utility function
      const verificationMessage = generateVerificationMessage(
        wallet,
        data.nonce,
        new Date().toISOString()
      )

      setNonce(data.nonce)
      setMessage(verificationMessage)
      
      toast.success('Verification code generated', { id: toastId })
      console.log(`[Verification] Nonce generated for wallet: ${wallet.slice(0, 8)}...`)
      return true

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate verification code'
      console.error('[Verification] Nonce generation error:', err)
      setError(errorMsg)
      toast.error(errorMsg, { id: toastId })
      resetFlow()
      return false
    }
  }, [publicKey, resetFlow])

  // Step 5: Submit verification to backend
  const submitVerification = useCallback(async (sig: string): Promise<void> => {
    if (!publicKey || !message || !nonce) {
      toast.error('Missing verification data')
      resetFlow()
      return
    }

    const wallet = publicKey.toBase58()
    const toastId = toast.loading('Verifying signature...')

    try {
      const response = await fetch('/api/wallet/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          signature: sig,
          message,
          nonce,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Verification failed')
      }

      // Success!
      console.log(`[Verification] ✅ Wallet verified successfully: ${wallet.slice(0, 8)}...`)
      toast.success('Wallet verified successfully! 🎉', { id: toastId })
      setCurrentStep('complete')

      // Refresh verification status in context
      await refreshStatus()

      // Reset flow after short delay
      setTimeout(() => {
        resetFlow()
      }, 1000)

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Verification failed'
      console.error('[Verification] Verification error:', err)
      setError(errorMsg)
      toast.error(errorMsg, { id: toastId })
      resetFlow()
    }
  }, [publicKey, message, nonce, refreshStatus, resetFlow])

  // Step 4: Request wallet signature
  const requestSignature = useCallback(async (): Promise<void> => {
    if (!signMessage || !message || !publicKey) {
      toast.error('Wallet not ready for signing')
      resetFlow()
      return
    }

    const toastId = toast.loading('Please sign the message in your wallet...')

    try {
      // Convert message to Uint8Array
      const messageBytes = new TextEncoder().encode(message)
      
      // Request signature from wallet
      const signatureBytes = await signMessage(messageBytes)
      
      // Convert signature to base58
      const bs58 = await import('bs58')
      const signatureBase58 = bs58.default.encode(signatureBytes)
      
      setSignature(signatureBase58)
      toast.success('Message signed!', { id: toastId })
      console.log('[Verification] Message signed successfully')

      // Move to verification step
      setCurrentStep('verifying')
      await submitVerification(signatureBase58)

    } catch (err) {
      console.error('[Verification] Signature error:', err)
      
      // Check if user rejected the signature request
      const errorMessage = err instanceof Error ? err.message.toLowerCase() : ''
      
      if (
        errorMessage.includes('rejected') || 
        errorMessage.includes('cancelled') ||
        errorMessage.includes('user rejected') ||
        errorMessage.includes('user denied')
      ) {
        toast.error('Signature request cancelled', { id: toastId })
      } else if (errorMessage.includes('wallet')) {
        toast.error('Wallet connection error. Please reconnect.', { id: toastId })
      } else {
        toast.error('Failed to sign message. Please try again.', { id: toastId })
      }
      
      resetFlow()
    }
  }, [signMessage, message, publicKey, submitVerification, resetFlow])

  // Step 2: Handle geo-check confirmation
  const handleGeoCheckConfirm = useCallback(() => {
    console.log('[Verification] Geo-check confirmed')
    setShowGeoCheck(false)
    setCurrentStep('terms')
    setShowTerms(true)
  }, [])

  // Step 3: Handle terms acceptance
  const handleTermsAccept = useCallback(async () => {
    console.log('[Verification] Terms accepted')
    setShowTerms(false)
    setCurrentStep('signing')

    // Request signature from wallet
    await requestSignature()
  }, [requestSignature])

  // Main entry point: Start verification flow
  const startVerification = useCallback(async (): Promise<void> => {
    if (!publicKey) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!signMessage) {
      toast.error('Your wallet does not support message signing')
      return
    }

    if (isVerifying) {
      console.log('[Verification] Already verifying, ignoring duplicate call')
      return
    }

    console.log(`[Verification] Starting verification flow for wallet: ${publicKey.toBase58().slice(0, 8)}...`)
    
    setIsVerifying(true)
    setError(null)

    // Step 1: Generate nonce
    const nonceGenerated = await generateNonce()
    if (!nonceGenerated) {
      setIsVerifying(false)
      return
    }

    // Step 2: Show geo-check modal
    console.log('[Verification] Opening GeoCheck modal...')
    setCurrentStep('geo-check')
    setShowGeoCheck(true)
    setIsVerifying(false) // Allow user to interact with modals
  }, [publicKey, signMessage, isVerifying, generateNonce])

  // Cancel verification flow (user can call this to abort)
  const cancelVerification = useCallback(() => {
    console.log('[Verification] Verification cancelled by user')
    resetFlow()
    toast.error('Verification cancelled')
  }, [resetFlow])

  return {
    // Main actions
    startVerification,
    cancelVerification,
    
    // State
    isVerifying,
    currentStep,
    error,
    
    // Modal visibility
    showGeoCheck,
    showTerms,
    
    // Modal handlers
    handleGeoCheckConfirm,
    handleTermsAccept,
    
    // Data (for debugging/display)
    nonce,
    message,
  }
}

