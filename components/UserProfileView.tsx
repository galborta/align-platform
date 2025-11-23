'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  Button,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Avatar,
  Divider
} from '@mui/material'
import {
  Close as CloseIcon,
  Message as MessageIcon,
  Block as BlockIcon,
  Star as StarIcon
} from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import { getTier } from '@/lib/karma'
import { canMessageUser } from '@/lib/messaging'
import { getWalletTokenData } from '@/lib/token-balance'
import { toast } from 'react-hot-toast'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']
type WalletKarma = {
  wallet_address: string
  project_id: string
  total_karma_points: number
  assets_added_count: number
  upvotes_given_count: number
  is_banned: boolean
}

interface ProjectKarma {
  project_id: string
  project_name: string
  total_karma_points: number
}

interface UserProfileViewProps {
  walletAddress: string
  currentUserWallet?: string
  projectId?: string
  onClose: () => void
  onMessage: (walletAddress: string) => void
}

export function UserProfileView({
  walletAddress,
  currentUserWallet,
  projectId,
  onClose,
  onMessage
}: UserProfileViewProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [karma, setKarma] = useState<WalletKarma | null>(null)
  const [topProjects, setTopProjects] = useState<ProjectKarma[]>([])
  const [loading, setLoading] = useState(true)
  const [canMessage, setCanMessage] = useState(false)
  const [messageReason, setMessageReason] = useState<string>()
  const [checkingMessage, setCheckingMessage] = useState(false)
  const [tokenPercentage, setTokenPercentage] = useState(0)
  const [loadingTier, setLoadingTier] = useState(false)
  
  // Truncate wallet address
  const truncateWallet = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }
  
  // Check if user is online (within last 5 minutes)
  const isOnline = (lastSeenAt: string | null): boolean => {
    if (!lastSeenAt) return false
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    return new Date(lastSeenAt).getTime() > fiveMinutesAgo
  }
  
  // Get tier badge styling
  const getTierBadge = (percentage: number) => {
    const tier = getTier(percentage)
    
    const tierColors: Record<string, { bg: string; text: string }> = {
      mega: { bg: '#7C4DFF', text: '#FFFFFF' },    // Purple
      whale: { bg: '#E3F06F', text: '#000000' },   // Lime
      holder: { bg: '#36C170', text: '#FFFFFF' },  // Green
      small: { bg: '#E0E0E0', text: '#666666' }    // Gray
    }
    
    const colors = tierColors[tier.name] || tierColors.small
    
    return {
      name: tier.name.toUpperCase(),
      multiplier: tier.multiplier,
      ...colors
    }
  }
  
  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true)
      
      try {
        // 1. Fetch user profile
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('wallet_address', walletAddress)
          .maybeSingle()
        
        setProfile(profileData)
        
        // 2. Fetch karma for specific project (if provided)
        if (projectId) {
          const { data: karmaData } = await supabase
            .from('wallet_karma')
            .select('*')
            .eq('wallet_address', walletAddress)
            .eq('project_id', projectId)
            .maybeSingle()
          
          setKarma(karmaData)
        }
        
        // 3. Fetch top 3 projects by karma
        const { data: allKarma } = await supabase
          .from('wallet_karma')
          .select(`
            wallet_address,
            project_id,
            total_karma_points,
            projects (
              id,
              name
            )
          `)
          .eq('wallet_address', walletAddress)
          .eq('is_banned', false)
          .order('total_karma_points', { ascending: false })
          .limit(3)
        
        if (allKarma) {
          const formatted: ProjectKarma[] = allKarma
            .filter(k => k.projects)
            .map(k => ({
              project_id: k.project_id,
              project_name: (k.projects as any)?.name || 'Unknown Project',
              total_karma_points: k.total_karma_points
            }))
          
          setTopProjects(formatted)
        }
        
      } catch (error) {
        console.error('Error fetching user data:', error)
        toast.error('Failed to load user profile')
      } finally {
        setLoading(false)
      }
    }
    
    fetchUserData()
  }, [walletAddress, projectId])
  
  // Check if current user can message this user
  useEffect(() => {
    const checkMessagePermission = async () => {
      // Skip check if no current user wallet
      if (!currentUserWallet) {
        setCanMessage(true)
        return
      }
      
      // Skip check if no projectId
      if (!projectId) {
        setCanMessage(true)
        return
      }
      
      setCheckingMessage(true)
      
      try {
        const result = await canMessageUser(
          currentUserWallet,
          walletAddress,
          projectId
        )
        
        setCanMessage(result.canMessage)
        setMessageReason(result.reason)
      } catch (error) {
        console.error('Error checking message permission:', error)
        setCanMessage(false)
      } finally {
        setCheckingMessage(false)
      }
    }
    
    checkMessagePermission()
  }, [walletAddress, projectId, currentUserWallet])
  
  // Fetch token balance for tier calculation
  useEffect(() => {
    const fetchTokenBalance = async () => {
      if (!projectId) return
      
      setLoadingTier(true)
      
      try {
        // Get project's token mint
        const { data: project } = await supabase
          .from('projects')
          .select('token_mint')
          .eq('id', projectId)
          .single()
        
        if (project) {
          // Get user's token balance
          const tokenData = await getWalletTokenData(
            walletAddress,
            project.token_mint
          )
          
          if (tokenData) {
            setTokenPercentage(tokenData.percentage)
          }
        }
      } catch (error) {
        console.error('Error fetching token balance:', error)
      } finally {
        setLoadingTier(false)
      }
    }
    
    fetchTokenBalance()
  }, [walletAddress, projectId])
  
  // Handle message button click
  const handleMessage = () => {
    if (canMessage) {
      onMessage(walletAddress)
    } else {
      toast.error(messageReason || 'Cannot message this user')
    }
  }
  
  // Handle block button click
  const handleBlock = async () => {
    if (!currentUserWallet) {
      toast.error('Please connect your wallet to block users')
      return
    }
    
    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert({
          blocker_wallet: currentUserWallet,
          blocked_wallet: walletAddress
        })
      
      if (error) {
        console.error('Block error:', error)
        toast.error('Failed to block user')
      } else {
        toast.success('User blocked')
        onClose() // Close profile view after blocking
      }
    } catch (error) {
      console.error('Error blocking user:', error)
      toast.error('Failed to block user')
    }
  }
  
  if (loading) {
    return (
      <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <CardContent className="text-center py-12">
          <CircularProgress />
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </CardContent>
      </Card>
    )
  }
  
  const online = profile ? isOnline(profile.last_seen_at) : false
  const displayName = profile?.display_name || truncateWallet(walletAddress)
  
  return (
    <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <CardContent className="p-6">
        {/* Header with Close Button */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4 flex-1">
            {/* Avatar with Online Indicator */}
            <div className="relative">
              <Avatar
                src={profile?.avatar_url || undefined}
                sx={{ 
                  width: 80, 
                  height: 80,
                  bgcolor: '#7C4DFF',
                  fontSize: '2rem'
                }}
              >
                {displayName[0]?.toUpperCase()}
              </Avatar>
              
              {/* Online Indicator */}
              <Tooltip title={online ? 'Online' : 'Offline'}>
                <div
                  className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-4 border-white transition-colors duration-300 ${
                    online ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                  style={{
                    boxShadow: online ? '0 0 8px rgba(34, 197, 94, 0.6)' : 'none'
                  }}
                />
              </Tooltip>
            </div>
            
            {/* Name and Wallet */}
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">
                {displayName}
              </h2>
              <p className="text-sm text-gray-500 font-mono mt-1">
                {truncateWallet(walletAddress)}
              </p>
              {profile?.privacy_level === 'private' && (
                <Chip 
                  label="Private Profile" 
                  size="small" 
                  sx={{ mt: 1 }}
                />
              )}
            </div>
          </div>
          
          {/* Close Button */}
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </div>
        
        {/* Stats Section */}
        {karma && (
          <div className="mb-6 p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-purple-900">
                Project Stats
              </h3>
              {karma.is_banned && (
                <Chip 
                  label="BANNED" 
                  color="error" 
                  size="small"
                />
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {karma.total_karma_points.toFixed(0)}
                </p>
                <p className="text-xs text-gray-600 mt-1">Total Karma</p>
              </div>
              
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {karma.assets_added_count}
                </p>
                <p className="text-xs text-gray-600 mt-1">Assets Added</p>
              </div>
              
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {karma.upvotes_given_count}
                </p>
                <p className="text-xs text-gray-600 mt-1">Votes Given</p>
              </div>
            </div>
            
            {/* Holder Tier Badge */}
            <div className="mt-4 flex justify-center">
              {loadingTier ? (
                <Chip
                  label="Loading tier..."
                  size="small"
                  sx={{ fontSize: '0.75rem' }}
                />
              ) : (
                <Chip
                  label={getTierBadge(tokenPercentage).name}
                  sx={{
                    bgcolor: getTierBadge(tokenPercentage).bg,
                    color: getTierBadge(tokenPercentage).text,
                    fontWeight: 'bold',
                    fontSize: '0.75rem'
                  }}
                  size="small"
                />
              )}
            </div>
          </div>
        )}
        
        {/* Bio Section */}
        {profile?.bio && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Bio</h3>
            <p className="text-gray-900 whitespace-pre-wrap">
              {profile.bio}
            </p>
          </div>
        )}
        
        <Divider sx={{ my: 3 }} />
        
        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <Tooltip 
            title={!canMessage ? messageReason : ''}
            arrow
          >
            <span className="flex-1">
              <Button
                variant="contained"
                startIcon={<MessageIcon />}
                onClick={handleMessage}
                disabled={!canMessage || checkingMessage}
                fullWidth
                sx={{
                  bgcolor: '#7C4DFF',
                  '&:hover': { bgcolor: '#6C3FEF' },
                  '&:disabled': {
                    bgcolor: 'rgba(0, 0, 0, 0.12)'
                  },
                  textTransform: 'none',
                  fontSize: '16px'
                }}
              >
                {checkingMessage ? 'Checking...' : 'Message'}
              </Button>
            </span>
          </Tooltip>
          
          <Button
            variant="outlined"
            startIcon={<BlockIcon />}
            onClick={handleBlock}
            sx={{
              borderColor: '#DC2626',
              color: '#DC2626',
              '&:hover': {
                borderColor: '#B91C1C',
                bgcolor: 'rgba(220, 38, 38, 0.04)'
              },
              textTransform: 'none'
            }}
          >
            Block
          </Button>
        </div>
        
        {/* Reputation - Top Projects */}
        {topProjects.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <StarIcon sx={{ fontSize: 18, color: '#F59E0B' }} />
              Top Projects by Karma
            </h3>
            <div className="space-y-2">
              {topProjects.map((proj, index) => (
                <div
                  key={proj.project_id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">
                        {proj.project_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {proj.total_karma_points.toFixed(0)} karma
                      </p>
                    </div>
                  </div>
                  
                  {index === 0 && (
                    <StarIcon sx={{ color: '#F59E0B', fontSize: 24 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* No Activity Message */}
        {!karma && topProjects.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No activity found for this user</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

