'use client'

import { ReactNode } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { MessagingProvider } from '@/lib/MessagingContext'
import { MessagesSidebar } from '@/components/MessagesSidebar'
import { useMessaging } from '@/lib/MessagingContext'
import { usePresenceTracking } from '@/lib/presence'

function MessagesSidebarWrapper() {
  const wallet = useWallet()
  const { isOpen, closeMessages, targetWallet } = useMessaging()
  
  return (
    <MessagesSidebar
      isOpen={isOpen}
      onClose={closeMessages}
      currentWallet={wallet.publicKey?.toBase58() || ''}
      targetWallet={targetWallet}
    />
  )
}

export function LayoutClient({ children }: { children: ReactNode }) {
  const wallet = useWallet()
  
  // Track user presence (online status)
  usePresenceTracking(wallet.publicKey?.toBase58())
  
  return (
    <MessagingProvider currentWallet={wallet.publicKey?.toBase58()}>
      {children}
      <MessagesSidebarWrapper />
    </MessagingProvider>
  )
}

