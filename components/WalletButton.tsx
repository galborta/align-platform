'use client'

import React, { useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export function WalletButton() {
  const { publicKey, wallet, connect } = useWallet()
  
  // Auto-connect when wallet is selected but not connected
  useEffect(() => {
    if (wallet && !publicKey) {
      connect().catch((err) => {
        console.error('Auto-connect failed:', err)
      })
    }
  }, [wallet, publicKey, connect])
  
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

