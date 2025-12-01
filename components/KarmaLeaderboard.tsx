'use client'

import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import { IconButton, Tooltip, CircularProgress, Chip, Dialog } from '@mui/material'
import MessageIcon from '@mui/icons-material/Message'
import BlockIcon from '@mui/icons-material/Block'
import { useMessaging } from '@/lib/MessagingContext'
import { canMessageUser } from '@/lib/messaging'
import { toast } from 'react-hot-toast'
import { UserProfileView } from '@/components/UserProfileView'

interface WalletKarma {
  wallet_address: string
  total_karma_points: number
  assets_added_count: number
  upvotes_given_count: number
  reports_given_count: number
}

interface MessageStatus {
  canMessage: boolean
  reason?: string
  checking: boolean
  opening: boolean
}

export function KarmaLeaderboard({ projectId }: { projectId: string }) {
  const [leaders, setLeaders] = useState<WalletKarma[]>([])
  const [loading, setLoading] = useState(true)
  const [messageStatuses, setMessageStatuses] = useState<Record<string, MessageStatus>>({})
  const [showProfileView, setShowProfileView] = useState(false)
  const [selectedProfileWallet, setSelectedProfileWallet] = useState<string | null>(null)
  const currentWallet = useWallet().publicKey?.toString()
  const { openMessages } = useMessaging()
  
  useEffect(() => {
    async function fetchLeaders() {
      const { data, error } = await supabase
        .from('wallet_karma')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_banned', false)
        .gt('total_karma_points', 0) // Only show users with >0 karma
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
  
  // Check message permissions for all leaders
  useEffect(() => {
    const checkAllPermissions = async () => {
      if (!currentWallet || leaders.length === 0) return
      
      const statuses: Record<string, MessageStatus> = {}
      
      for (const leader of leaders) {
        if (leader.wallet_address === currentWallet) {
          // Can't message yourself
          statuses[leader.wallet_address] = {
            canMessage: false,
            reason: 'Cannot message yourself',
            checking: false,
            opening: false
          }
          continue
        }
        
        statuses[leader.wallet_address] = {
          canMessage: false,
          checking: true,
          opening: false
        }
      }
      
      setMessageStatuses(statuses)
      
      // Check permissions in batches
      for (const leader of leaders) {
        if (leader.wallet_address === currentWallet) continue
        
        try {
          const result = await canMessageUser(currentWallet, leader.wallet_address, projectId)
          
          setMessageStatuses(prev => ({
            ...prev,
            [leader.wallet_address]: {
              canMessage: result.canMessage,
              reason: result.reason,
              checking: false,
              opening: false
            }
          }))
        } catch (error) {
          console.error(`Error checking permissions for ${leader.wallet_address}:`, error)
          setMessageStatuses(prev => ({
            ...prev,
            [leader.wallet_address]: {
              canMessage: false,
              reason: 'Error checking permissions',
              checking: false,
              opening: false
            }
          }))
        }
      }
    }
    
    checkAllPermissions()
  }, [leaders, currentWallet, projectId])
  
  // Handle opening message
  const handleOpenMessage = async (walletAddress: string) => {
    const status = messageStatuses[walletAddress]
    
    if (!status?.canMessage) {
      toast.error(status?.reason || 'Cannot message this user')
      return
    }
    
    // Set opening state
    setMessageStatuses(prev => ({
      ...prev,
      [walletAddress]: {
        ...prev[walletAddress],
        opening: true
      }
    }))
    
    try {
      await openMessages(walletAddress)
    } catch (error) {
      console.error('Error opening message:', error)
      toast.error('Failed to open message')
    } finally {
      setMessageStatuses(prev => ({
        ...prev,
        [walletAddress]: {
          ...prev[walletAddress],
          opening: false
        }
      }))
    }
  }
  
  // Sort leaders: messageable users first
  const sortedLeaders = [...leaders].sort((a, b) => {
    const aStatus = messageStatuses[a.wallet_address]
    const bStatus = messageStatuses[b.wallet_address]
    
    // Messageable users first
    if (aStatus?.canMessage && !bStatus?.canMessage) return -1
    if (!aStatus?.canMessage && bStatus?.canMessage) return 1
    
    // Then by karma
    return b.total_karma_points - a.total_karma_points
  })
  
  // Find current wallet's rank
  const currentRank = sortedLeaders.findIndex(
    l => l.wallet_address === currentWallet
  ) + 1
  
  const currentWalletData = sortedLeaders.find(l => l.wallet_address === currentWallet)
  
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
      
      {sortedLeaders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No contributors yet</p>
          <p className="text-sm mt-2">Be the first to add an asset!</p>
        </div>
      ) : (
        <div>
          {/* Table Header */}
          <div className="mb-2 px-3 py-2 flex items-center justify-between text-xs font-semibold text-gray-600 uppercase">
            <div>Contributor</div>
            <div className="flex items-center gap-8">
              <div>Karma</div>
              <div className="w-8 text-center">Contact</div>
            </div>
          </div>
          
          {/* Leaders List */}
          <div className="space-y-2">
            {sortedLeaders.map((leader, index) => {
              const status = messageStatuses[leader.wallet_address]
              const isOwn = leader.wallet_address === currentWallet
              
              return (
                <div
                  key={leader.wallet_address}
                  className={`
                    flex items-center justify-between p-3 rounded-lg transition-all
                    ${index < 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : 'bg-gray-50'}
                    ${isOwn ? 'ring-2 ring-purple-500' : ''}
                    hover:shadow-md cursor-pointer
                  `}
                  onClick={() => {
                    setSelectedProfileWallet(leader.wallet_address)
                    setShowProfileView(true)
                  }}
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
                        {isOwn && (
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
                    
                    {/* Message Button/Status (don't show for own wallet) */}
                    {!isOwn && currentWallet && (
                      <div className="w-8 flex justify-center" onClick={(e) => e.stopPropagation()}>
                        {status?.checking ? (
                          <CircularProgress size={18} sx={{ color: '#7C4DFF' }} />
                        ) : !status?.canMessage ? (
                          <Tooltip title={status?.reason || "Can't message"} arrow>
                            <IconButton
                              size="small"
                              disabled
                              sx={{
                                color: '#9E9E9E',
                                cursor: 'not-allowed'
                              }}
                            >
                              <BlockIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Send message" arrow>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenMessage(leader.wallet_address)}
                              disabled={status?.opening}
                              sx={{
                                color: '#7C4DFF',
                                '&:hover': { 
                                  bgcolor: 'rgba(124, 77, 255, 0.1)',
                                  boxShadow: '0 0 8px rgba(124, 77, 255, 0.4)' // Purple glow
                                },
                                transition: 'all 0.2s ease-in-out'
                              }}
                            >
                              {status?.opening ? (
                                <CircularProgress size={18} sx={{ color: '#7C4DFF' }} />
                              ) : (
                                <MessageIcon sx={{ fontSize: 18 }} />
                              )}
                            </IconButton>
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Profile View Modal */}
      <Dialog
        open={showProfileView}
        onClose={() => setShowProfileView(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            maxHeight: '90vh'
          }
        }}
      >
        {selectedProfileWallet && (
          <UserProfileView
            walletAddress={selectedProfileWallet}
            onClose={() => setShowProfileView(false)}
          />
        )}
      </Dialog>
    </div>
  )
}

