'use client'

import { ReactNode, Suspense } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { MessagingProvider } from '@/lib/MessagingContext'
import { MessagesSidebar } from '@/components/MessagesSidebar'
import { useMessaging } from '@/lib/MessagingContext'
import { usePresenceTracking } from '@/lib/presence'
import { useMessageNotifications } from '@/lib/notifications'
import { useAutoSignIn } from '@/hooks/useAutoSignIn'

function MessagesSidebarWrapper() {
  const wallet = useWallet()
  const { 
    isOpen, 
    closeMessages, 
    targetWallet, 
    openMessages,
    activeSection,
    projectContext,
    highlightAssetId,
    highlightDisputeId
  } = useMessaging()
  
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
      initialSection={activeSection}
      initialProjectId={projectContext}
      initialHighlightAssetId={highlightAssetId}
      initialDisputeId={highlightDisputeId}
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
      <Suspense fallback={null}>
        <MessagesSidebarWrapper />
      </Suspense>
    </MessagingProvider>
  )
}
