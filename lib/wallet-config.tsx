'use client'

import { useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'

/**
 * Get test wallet if in test mode (for Playwright E2E tests)
 * Returns null in production or if no test wallet is configured
 */
export function getTestWallet() {
  if (typeof window === 'undefined') return null
  if (process.env.NODE_ENV === 'production') return null
  
  try {
    const testAddress = sessionStorage.getItem('test-wallet-address')
    const testConnected = sessionStorage.getItem('test-wallet-connected')
    
    if (testAddress && testConnected === 'true') {
      return {
        publicKey: {
          toString: () => testAddress,
          toBase58: () => testAddress,
        },
        connected: true,
        signMessage: async () => new Uint8Array(64),
      }
    }
  } catch (error) {
    // sessionStorage might not be available
    console.debug('Test wallet not available:', error)
  }
  
  return null
}

/**
 * Check if we're in test mode
 */
export function isTestMode(): boolean {
  if (typeof window === 'undefined') return false
  if (process.env.NODE_ENV === 'production') return false
  
  try {
    return sessionStorage.getItem('test-wallet-connected') === 'true'
  } catch {
    return false
  }
}

export function WalletConfigProvider({ children }: { children: React.ReactNode }) {
  const network = WalletAdapterNetwork.Mainnet
  // Using Helius RPC endpoint configured in .env.local
  const endpoint = useMemo(() => 
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(network)
  , [network])

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  )
}

