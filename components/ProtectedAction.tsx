'use client'

import React, { ReactNode } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useVerification } from '@/contexts/VerificationContext'
import toast from 'react-hot-toast'

interface ProtectedActionProps {
  children: ReactNode
  onAuthorized: () => void
  actionName?: string
  /** If true, shows a wrapper div. If false, renders children directly with onClick handler */
  wrapper?: boolean
}

/**
 * ProtectedAction Component
 * 
 * Wraps any UI element and ensures wallet is connected + verified before allowing action.
 * Provides clear feedback at each step of the auth flow.
 * 
 * @example
 * ```tsx
 * <ProtectedAction 
 *   onAuthorized={handleCreateJob}
 *   actionName="create a job"
 * >
 *   <Button>Create Job</Button>
 * </ProtectedAction>
 * ```
 */
export function ProtectedAction({ 
  children, 
  onAuthorized,
  actionName = 'perform this action',
  wrapper = true
}: ProtectedActionProps) {
  const { connected } = useWallet()
  const { setVisible } = useWalletModal()
  const { isVerified, isLoading } = useVerification()

  const handleClick = (e?: React.MouseEvent) => {
    // Prevent default behavior if it's a link or form
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    // Not connected → open wallet modal
    if (!connected) {
      toast.error('Please connect your wallet first')
      setVisible(true)
      return
    }

    // Connected but checking verification
    if (isLoading) {
      toast.loading('Checking verification status...', { duration: 1000 })
      return
    }

    // Not verified → verification flow will auto-trigger from WalletVerificationFlow
    // Just show message to user
    if (!isVerified) {
      toast.error(`Please verify your wallet to ${actionName}`)
      // WalletVerificationFlow auto-triggers when connected + not verified
      return
    }

    // All good → proceed
    onAuthorized()
  }

  if (wrapper) {
    return (
      <div 
        onClick={handleClick}
        style={{ cursor: 'pointer', display: 'inline-block' }}
      >
        {children}
      </div>
    )
  }

  // No wrapper - clone the child and add onClick handler
  if (typeof children === 'object' && children !== null && 'type' in children) {
    const childElement = children as React.ReactElement
    return (
      <>
        {React.cloneElement(childElement, {
          onClick: (e: React.MouseEvent) => {
            // Call original onClick if it exists
            if (childElement.props.onClick) {
              childElement.props.onClick(e)
            }
            handleClick(e)
          }
        } as any)}
      </>
    )
  }

  // Fallback to wrapper if children is not a valid element
  return (
    <div 
      onClick={handleClick}
      style={{ cursor: 'pointer', display: 'inline-block' }}
    >
      {children}
    </div>
  )
}

