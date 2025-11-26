'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { AssetVotingCard } from './AssetVotingCard'
import { Database } from '@/types/database'
import { Dialog, Box } from '@mui/material'
import { UserProfileView } from '@/components/UserProfileView'

const getPlatformUrl = (platform: string, handle: string): string => {
  const urls: Record<string, string> = {
    twitter: `https://x.com/${handle}`,
    x: `https://x.com/${handle}`,
    instagram: `https://instagram.com/${handle}`,
    youtube: `https://youtube.com/@${handle}`,
    tiktok: `https://tiktok.com/@${handle}`,
  }
  return urls[platform.toLowerCase()] || `https://${platform}.com/${handle}`
}

type CurationMessage = Database['public']['Tables']['curation_chat_messages']['Row'] & {
  pending_assets?: Database['public']['Tables']['pending_assets']['Row']
}

interface CurationChatFeedProps {
  projectId: string
}

export function CurationChatFeed({ projectId }: CurationChatFeedProps) {
  const wallet = useWallet()
  const [messages, setMessages] = useState<CurationMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [showProfileView, setShowProfileView] = useState(false)
  const [selectedProfileWallet, setSelectedProfileWallet] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [displayCount, setDisplayCount] = useState(2)
  
  // Fetch messages function
  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('curation_chat_messages')
      .select(`
        *,
        pending_assets(*)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setMessages(data)
      setHasMore(data.length > displayCount)
    }
  }, [projectId, displayCount])
  
  // Load more function
  const loadMore = () => {
    setLoadingMore(true)
    setDisplayCount(prev => prev + 5)
    setTimeout(() => {
      setLoadingMore(false)
      setHasMore(messages.length > displayCount + 5)
    }, 300)
  }
  
  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('curation-chat')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'curation_chat_messages',
          filter: `project_id=eq.${projectId}`
        },
        () => {
          // Refetch all messages to get complete data with relations
          fetchMessages()
        }
      )
      .subscribe()
    
    return () => {
      channel.unsubscribe()
    }
  }, [projectId, fetchMessages])
  
  // Fetch initial messages
  useEffect(() => {
    fetchMessages().then(() => setLoading(false))
  }, [fetchMessages])
  
  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>
  }
  
  if (messages.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-600">No activity yet. Be the first to add an asset!</p>
      </div>
    )
  }
  
  const displayedMessages = messages.slice(0, displayCount)
  
  return (
    <>
      <div 
        className="space-y-3 overflow-y-auto" 
        style={{ 
          maxHeight: '400px',
          overflowY: 'scroll',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {displayedMessages.map(msg => (
          <CurationChatMessage
            key={msg.id}
            message={msg}
            currentWallet={wallet.publicKey?.toString()}
            projectId={projectId}
          />
        ))}
        
        {/* Load More Button */}
        {hasMore && displayedMessages.length < messages.length && (
          <div className="text-center py-3">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? 'Loading...' : '↓ Load more assets'}
            </button>
          </div>
        )}
      </div>

      {/* Profile View Modal */}
      {selectedProfileWallet && (
        <Dialog
          open={showProfileView}
          onClose={() => {
            setShowProfileView(false)
            setSelectedProfileWallet(null)
          }}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              maxHeight: '90vh'
            }
          }}
          BackdropProps={{
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.7)'
            }
          }}
        >
          <Box 
            onClick={(e) => e.stopPropagation()}
            sx={{ 
              bgcolor: 'background.paper',
              overflow: 'auto'
            }}
          >
            <UserProfileView
              walletAddress={selectedProfileWallet}
              currentUserWallet={wallet.publicKey?.toString()}
              projectId={projectId}
              onClose={() => {
                setShowProfileView(false)
                setSelectedProfileWallet(null)
              }}
              onMessage={() => {
                setShowProfileView(false)
                setSelectedProfileWallet(null)
              }}
            />
          </Box>
        </Dialog>
      )}
    </>
  )
}

function CurationChatMessage({
  message,
  currentWallet,
  projectId
}: {
  message: CurationMessage
  currentWallet?: string
  projectId: string
}) {
  const { pending_assets: asset } = message
  
  if (message.message_type === 'asset_added') {
    // Parse asset summary for social accounts (format: "platform:handle")
    const isSocial = message.asset_type === 'social' && message.asset_summary?.includes(':')
    let displayText = message.asset_summary
    let socialUrl = ''
    
    if (isSocial) {
      const [platform, handle] = message.asset_summary!.split(':')
      displayText = `${platform} @${handle}`
      socialUrl = getPlatformUrl(platform, handle)
    }
    
    return (
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
          <div className="flex-1">
            <p className="text-sm">
              <span 
                className="font-mono text-purple-600 font-medium cursor-pointer hover:text-purple-800 underline decoration-dotted transition-colors"
                onClick={() => {
                  if (message.wallet_address) {
                    setSelectedProfileWallet(message.wallet_address)
                    setShowProfileView(true)
                  }
                }}
                title="View profile"
              >
                {message.wallet_address?.slice(0, 4)}...{message.wallet_address?.slice(-4)}
              </span>
              <span className="text-gray-400 mx-2">•</span>
              <span className="text-gray-500">
                {message.token_percentage?.toFixed(3)}%
              </span>
              <span className="text-gray-700 ml-2">
                added {isSocial ? (
                  <a 
                    href={socialUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-semibold text-purple-600 hover:text-purple-800 hover:underline"
                  >
                    {displayText}
                  </a>
                ) : (
                  <strong>{displayText}</strong>
                )}
              </span>
            </p>
            
            {asset && (
              <AssetVotingCard
                asset={asset}
                currentWallet={currentWallet}
                projectId={projectId}
              />
            )}
          </div>
          
          <span className="text-xs text-gray-400 whitespace-nowrap sm:mt-0 -mt-1">
            {formatDistanceToNow(
              new Date(Math.min(new Date(message.created_at).getTime(), Date.now())),
              { addSuffix: true }
            )}
          </span>
        </div>
      </div>
    )
  }
  
  if (message.message_type === 'asset_backed') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <p className="text-sm text-green-900">
          <span className="font-bold">✓ Community Backed:</span> {message.asset_summary}
          <span className="text-green-700 ml-2">
            ({message.supply_percentage?.toFixed(2)}% supply, {message.vote_count} votes)
          </span>
        </p>
      </div>
    )
  }
  
  if (message.message_type === 'asset_verified') {
    return (
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
        <p className="text-sm text-purple-900">
          <span className="font-bold">✓✓ Verified:</span> {message.asset_summary}
          <span className="text-purple-700 ml-2">
            ({message.supply_percentage?.toFixed(2)}% supply, {message.vote_count} votes)
          </span>
        </p>
      </div>
    )
  }
  
  if (message.message_type === 'asset_hidden') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <p className="text-sm text-red-900">
          <span className="font-bold">✗ Rejected:</span> {message.asset_summary}
          <span className="text-red-700 ml-2">
            (hidden by community reports)
          </span>
        </p>
      </div>
    )
  }
  
  if (message.message_type === 'wallet_banned') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <p className="text-sm text-red-900">
          <span className="font-bold">🚫 Wallet Banned:</span>{' '}
          <span 
            className="font-mono cursor-pointer hover:text-red-700 underline decoration-dotted transition-colors"
            onClick={() => {
              if (message.wallet_address) {
                setSelectedProfileWallet(message.wallet_address)
                setShowProfileView(true)
              }
            }}
            title="View profile"
          >
            {message.wallet_address?.slice(0, 4)}...{message.wallet_address?.slice(-4)}
          </span>
        </p>
      </div>
    )
  }
  
  return null
}

