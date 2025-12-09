// components/VerifyToUnlockButton.tsx
// Button that prompts wallet connection or verification based on user state

'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import { CircularProgress } from '@mui/material'
import { useVerification } from '@/contexts/VerificationContext'
import { useWalletVerification } from '@/hooks/useWalletVerification'
import { GeoCheckModal } from '@/components/modals/GeoCheckModal'
import { TermsModal } from '@/components/modals/TermsModal'

interface VerifyToUnlockButtonProps {
  /** Label to show for the action being unlocked */
  label?: string
  /** Called when verification completes successfully */
  onVerified?: () => void
  /** Custom class name */
  className?: string
  /** Full width button */
  fullWidth?: boolean
  /** Size variant */
  size?: 'small' | 'medium' | 'large'
}

export function VerifyToUnlockButton({
  label = 'this feature',
  onVerified,
  className = '',
  fullWidth = false,
  size = 'medium',
}: VerifyToUnlockButtonProps) {
  const { connected } = useWallet()
  const { setVisible: openWalletModal } = useWalletModal()
  const { isVerified, isLoading: contextLoading } = useVerification()
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

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Call onVerified when verification completes
  useEffect(() => {
    if (currentStep === 'complete' && onVerified) {
      onVerified()
    }
  }, [currentStep, onVerified])

  // Don't show if already verified
  if (isVerified) {
    return null
  }

  const handleClick = () => {
    if (!connected) {
      // Open wallet connection modal
      openWalletModal(true)
    } else {
      // Start verification flow
      startVerification()
    }
  }

  const handleModalClose = () => {
    cancelVerification()
  }

  const isLoading = isVerifying || contextLoading

  // Size variants
  const sizeStyles = {
    small: { padding: '8px 16px', fontSize: '13px', iconSize: 14 },
    medium: { padding: '12px 24px', fontSize: '14px', iconSize: 16 },
    large: { padding: '14px 32px', fontSize: '15px', iconSize: 18 },
  }

  const { padding, fontSize, iconSize } = sizeStyles[size]

  // Button text based on state
  const getButtonText = () => {
    if (isLoading) return 'Verifying...'
    if (!connected) return `Connect to ${label}`
    return `Verify to ${label}`
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`
          inline-flex items-center justify-center gap-2
          transition-all duration-200 ease-out
          disabled:opacity-60 disabled:cursor-not-allowed
          hover:scale-[1.02] active:scale-[0.98]
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        style={{
          background: 'linear-gradient(135deg, #7C4DFF 0%, #9C7CFF 100%)',
          color: 'white',
          fontFamily: 'var(--font-body)',
          fontSize,
          fontWeight: 500,
          padding,
          borderRadius: '999px',
          border: 'none',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 14px rgba(124, 77, 255, 0.35)',
        }}
      >
        {isLoading ? (
          <CircularProgress size={iconSize} sx={{ color: 'white' }} />
        ) : (
          <LockIcon sx={{ fontSize: iconSize }} />
        )}
        <span>{getButtonText()}</span>
      </button>

      {/* Verification Modals - Rendered via Portal */}
      {mounted && showGeoCheck && createPortal(
        <GeoCheckModal
          isOpen={showGeoCheck}
          onClose={handleModalClose}
          onConfirm={handleGeoCheckConfirm}
        />,
        document.body
      )}

      {mounted && showTerms && createPortal(
        <TermsModal
          isOpen={showTerms}
          onClose={handleModalClose}
          onAccept={handleTermsAccept}
        />,
        document.body
      )}
    </>
  )
}

export default VerifyToUnlockButton

