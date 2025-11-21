'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { AssetVotingCard } from './AssetVotingCard'
import { Database } from '@/types/database'

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
      .limit(50)
    
    if (!error && data) {
      setMessages(data)
    }
  }, [projectId])
  
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
  
  return (
    <div className="space-y-3">
      {messages.map(msg => (
        <CurationChatMessage
          key={msg.id}
          message={msg}
          currentWallet={wallet.publicKey?.toString()}
          projectId={projectId}
        />
      ))}
    </div>
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
              <span className="font-mono text-purple-600 font-medium">
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
          <span className="font-mono">
            {message.wallet_address?.slice(0, 4)}...{message.wallet_address?.slice(-4)}
          </span>
        </p>
      </div>
    )
  }
  
  return null
}

