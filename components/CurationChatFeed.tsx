'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { AssetVotingCard } from './AssetVotingCard'
import { Database } from '@/types/database'

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
        (payload) => {
          setMessages(prev => [payload.new as CurationMessage, ...prev])
        }
      )
      .subscribe()
    
    return () => {
      channel.unsubscribe()
    }
  }, [projectId])
  
  // Fetch initial messages
  useEffect(() => {
    async function fetchMessages() {
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
      setLoading(false)
    }
    
    fetchMessages()
  }, [projectId])
  
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
    return (
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
        <div className="flex items-start gap-3">
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
                added <strong>{message.asset_summary}</strong>
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
          
          <span className="text-xs text-gray-400 whitespace-nowrap">
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

