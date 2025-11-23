'use client'

import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import { IconButton, Tooltip } from '@mui/material'
import MessageIcon from '@mui/icons-material/Message'
import { useMessaging } from '@/lib/MessagingContext'

interface WalletKarma {
  wallet_address: string
  total_karma_points: number
  assets_added_count: number
  upvotes_given_count: number
  reports_given_count: number
}

export function KarmaLeaderboard({ projectId }: { projectId: string }) {
  const [leaders, setLeaders] = useState<WalletKarma[]>([])
  const [loading, setLoading] = useState(true)
  const currentWallet = useWallet().publicKey?.toString()
  const { openMessages } = useMessaging()
  
  useEffect(() => {
    async function fetchLeaders() {
      const { data, error } = await supabase
        .from('wallet_karma')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_banned', false)
        .order('total_karma_points', { ascending: false })
        .limit(50)
      
      if (data) {
        setLeaders(data)
      }
      setLoading(false)
    }
    
    fetchLeaders()
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('karma-leaderboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallet_karma',
          filter: `project_id=eq.${projectId}`
        },
        () => {
          fetchLeaders()
        }
      )
      .subscribe()
    
    return () => {
      channel.unsubscribe()
    }
  }, [projectId])
  
  // Find current wallet's rank
  const currentRank = leaders.findIndex(
    l => l.wallet_address === currentWallet
  ) + 1
  
  const currentWalletData = leaders.find(l => l.wallet_address === currentWallet)
  
  if (loading) {
    return <div className="animate-pulse bg-gray-100 rounded-lg h-64" />
  }
  
  return (
    <div>
      {currentWallet && currentRank > 0 && (
        <div className="mb-4 p-3 bg-purple-50 rounded-lg">
          <p className="text-sm text-purple-900">
            Your rank: <strong>#{currentRank}</strong>
            {' '}with{' '}
            <strong>
              {currentWalletData?.total_karma_points.toFixed(0) || 0}
            </strong>
            {' '}karma
          </p>
        </div>
      )}
      
      {leaders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No contributors yet</p>
          <p className="text-sm mt-2">Be the first to add an asset!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaders.map((leader, index) => (
            <div
              key={leader.wallet_address}
              className={`
                flex items-center justify-between p-3 rounded-lg transition-all
                ${index < 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : 'bg-gray-50'}
                ${leader.wallet_address === currentWallet ? 'ring-2 ring-purple-500' : ''}
                hover:shadow-md
              `}
            >
              <div className="flex items-center gap-3">
                <div className="text-lg font-bold text-gray-400 min-w-[2rem]">
                  #{index + 1}
                </div>
                
                {index === 0 && <span className="text-2xl">🥇</span>}
                {index === 1 && <span className="text-2xl">🥈</span>}
                {index === 2 && <span className="text-2xl">🥉</span>}
                
                <div>
                  <div className="font-mono text-sm">
                    {leader.wallet_address.slice(0, 4)}...{leader.wallet_address.slice(-4)}
                    {leader.wallet_address === currentWallet && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600">
                    {leader.assets_added_count} assets •{' '}
                    {leader.upvotes_given_count} upvotes •{' '}
                    {leader.reports_given_count} reports
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="font-bold text-purple-600">
                    {leader.total_karma_points.toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-500">karma</div>
                </div>
                
                {/* Message Button (don't show for own wallet) */}
                {leader.wallet_address !== currentWallet && currentWallet && (
                  <Tooltip title="Send message">
                    <IconButton
                      size="small"
                      onClick={() => openMessages(leader.wallet_address)}
                      sx={{
                        color: '#7C4DFF',
                        '&:hover': { bgcolor: 'rgba(124, 77, 255, 0.1)' }
                      }}
                    >
                      <MessageIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

