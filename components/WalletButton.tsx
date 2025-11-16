'use client'

import React, { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

export function WalletButton() {
  const { publicKey, wallet, wallets, select, connect, disconnect, connected, connecting } = useWallet()
  const [mounted, setMounted] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  
  // Only render on client to avoid hydration errors
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Auto-connect when wallet is selected but not connected
  useEffect(() => {
    if (wallet && !connected && !connecting && mounted) {
      connect().catch((err) => {
        console.error('Auto-connect failed:', err)
      })
    }
  }, [wallet, connected, connecting, connect, mounted])

  // Force re-render when connection state changes
  useEffect(() => {
    if (connected && publicKey) {
      // Connection successful - component will re-render automatically
      console.log('Wallet connected:', publicKey.toString())
    }
  }, [connected, publicKey])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showDropdown && !target.closest('[data-wallet-dropdown]')) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])
  
  const handleWalletSelect = async (walletName: string) => {
    select(walletName)
    setShowDropdown(false)
  }

  const handleDisconnect = async () => {
    await disconnect()
    setShowDropdown(false)
  }

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  // Get unique installed wallets (deduplicate by name)
  const getUniqueInstalledWallets = () => {
    const installed = wallets.filter(w => w.readyState === 'Installed')
    const seen = new Set<string>()
    return installed.filter(w => {
      const name = w.adapter.name
      if (seen.has(name)) {
        return false
      }
      seen.add(name)
      return true
    })
  }
  
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

  if (connected && publicKey) {
    return (
      <div style={{ position: 'relative' }} data-wallet-dropdown>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          style={{
            backgroundColor: '#FFFFFF',
            color: '#7C4DFF',
            border: '2px solid #7C4DFF',
            borderRadius: '8px',
            fontFamily: 'var(--font-body)',
            fontWeight: '500',
            fontSize: '16px',
            padding: '10px 20px',
            height: 'auto',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {wallet?.adapter.icon && (
            <img src={wallet.adapter.icon} alt={wallet.adapter.name} style={{ width: '20px', height: '20px' }} />
          )}
          {shortenAddress(publicKey.toString())}
        </button>
        {showDropdown && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7F0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              minWidth: '200px',
              zIndex: 1000,
            }}
          >
            <button
              onClick={handleDisconnect}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                cursor: 'pointer',
                color: '#DC2626',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FEE2E2'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    )
  }

  if (connecting) {
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
        Connecting...
      </button>
    )
  }

  return (
    <div style={{ position: 'relative' }} data-wallet-dropdown>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
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
          cursor: 'pointer',
        }}
      >
        Connect Wallet
      </button>
      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7F0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            minWidth: '200px',
            zIndex: 1000,
          }}
        >
          {getUniqueInstalledWallets().map((wallet, index) => (
            <button
              key={`${wallet.adapter.name}-${index}`}
              onClick={() => handleWalletSelect(wallet.adapter.name)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F3F4F6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {wallet.adapter.icon && (
                <img src={wallet.adapter.icon} alt={wallet.adapter.name} style={{ width: '24px', height: '24px' }} />
              )}
              {wallet.adapter.name}
            </button>
          ))}
          {getUniqueInstalledWallets().length === 0 && (
            <div style={{ padding: '12px 16px', fontFamily: 'var(--font-body)', fontSize: '14px', color: '#6B7280' }}>
              No wallets installed
            </div>
          )}
        </div>
      )}
    </div>
  )
}

