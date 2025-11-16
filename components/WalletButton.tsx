'use client'

import React, { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export function WalletButton() {
  const { publicKey, wallet, connect } = useWallet()
  const [mounted, setMounted] = useState(false)
  
  // Only render on client to avoid hydration errors
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Auto-connect when wallet is selected but not connected
  useEffect(() => {
    if (wallet && !publicKey && mounted) {
      connect().catch((err) => {
        console.error('Auto-connect failed:', err)
      })
    }
  }, [wallet, publicKey, connect, mounted])
  
  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <button
        disabled
        style={{
          backgroundColor: '#7C4DFF',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '8px',
          fontFamily: 'var(--font-body)',
          fontWeight: '500',
          fontSize: '16px',
          padding: '10px 20px',
          height: 'auto',
          cursor: 'not-allowed',
          opacity: 0.7,
        }}
      >
        Connect Wallet
      </button>
    )
  }
  
  return (
    <WalletMultiButton style={{
      backgroundColor: publicKey ? '#FFFFFF' : '#7C4DFF',
      color: publicKey ? '#7C4DFF' : '#FFFFFF',
      border: publicKey ? '2px solid #7C4DFF' : 'none',
      borderRadius: '8px',
      fontFamily: 'var(--font-body)',
      fontWeight: '500',
      fontSize: '16px',
      padding: '10px 20px',
      height: 'auto',
    }} />
  )
}

