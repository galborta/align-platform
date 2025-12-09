'use client'

import { ReactNode } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { MessagingProvider } from '@/lib/MessagingContext'
import { MessagesSidebar } from '@/components/MessagesSidebar'
import { useMessaging } from '@/lib/MessagingContext'
import { usePresenceTracking } from '@/lib/presence'
import { useMessageNotifications } from '@/lib/notifications'
import { useAutoSignIn } from '@/hooks/useAutoSignIn'

function MessagesSidebarWrapper() {
  const wallet = useWallet()
  const { isOpen, closeMessages, targetWallet, openMessages } = useMessaging()
  
  // Enable message notifications
  useMessageNotifications(
    wallet.publicKey?.toBase58(),
    (conversationId) => {
      // When notification is clicked, open messages sidebar
      // The targetWallet will be determined from the conversation
      openMessages()
    }
  )
  
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
  
  // Automatically sign in to Supabase when wallet connects
  useAutoSignIn()
  
  return (
    <MessagingProvider currentWallet={wallet.publicKey?.toBase58()}>
      {children}
      <MessagesSidebarWrapper />
    </MessagingProvider>
  )
}
