'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  Card,
  CardContent,
  Button,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Avatar,
  Divider,
  Paper,
  Typography,
  Box,
  Grid
} from '@mui/material'
import {
  Close as CloseIcon,
  Message as MessageIcon,
  Block as BlockIcon,
  Star as StarIcon,
  CheckCircle as CheckCircleIcon,
  LocalAtm as LocalAtmIcon
} from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import { getTier } from '@/lib/karma'
import { canMessageUser, blockUser, unblockUser, isBlocked } from '@/lib/messaging'
import { getWalletTokenData } from '@/lib/token-balance'
import { canViewProfile, canSeeOnlineStatus, getPrivacyLevelInfo } from '@/lib/privacy'
import { toast } from 'react-hot-toast'
import { useMessaging } from '@/lib/MessagingContext'
import { BlockUserModal } from '@/components/BlockUserModal'
import TipModal from '@/components/TipModal'

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
  tokenMint?: string
  onClose: () => void
  onMessage: (walletAddress: string) => void
}

export function UserProfileView({
  walletAddress,
  currentUserWallet,
  projectId,
  tokenMint,
  onClose,
  onMessage
}: UserProfileViewProps) {
  const { openMessages } = useMessaging()
  const [showTipModal, setShowTipModal] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [karma, setKarma] = useState<WalletKarma | null>(null)
  const [topProjects, setTopProjects] = useState<ProjectKarma[]>([])
  const [loading, setLoading] = useState(true)
  const [canMessage, setCanMessage] = useState(false)
  const [messageReason, setMessageReason] = useState<string>()
  const [checkingMessage, setCheckingMessage] = useState(false)
  const [tokenPercentage, setTokenPercentage] = useState(0)
  const [loadingTier, setLoadingTier] = useState(false)
  const [conversationExists, setConversationExists] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [lastMessage, setLastMessage] = useState<{ content: string; timestamp: string } | null>(null)
  const [openingMessage, setOpeningMessage] = useState(false)
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [blockStatus, setBlockStatus] = useState<{
    isBlocked: boolean
    blockedBy?: string
    blockedUser?: string
  }>({ isBlocked: false })
  const [privacyCheck, setPrivacyCheck] = useState<{
    canView: boolean
    reason?: string
    hiddenSections?: string[]
  }>({ canView: true })
  const [canSeeStatus, setCanSeeStatus] = useState(true)
  const [jobStats, setJobStats] = useState<{
    poster: {
      jobsPosted: number
      completedJobs: number
      disputedJobs: number
      winRate: number
    }
    worker: {
      jobsCompleted: number
      failures: number
      winRate: number
    }
  } | null>(null)
  const [completedJobs, setCompletedJobs] = useState<any[]>([])
  const [showAllJobs, setShowAllJobs] = useState(false)
  const [scrollIndicatorVisible, setScrollIndicatorVisible] = useState(false)
  const router = useRouter()
  
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
  
  // Get reputation badge based on worker stats
  const getReputationBadge = (stats: { jobsCompleted: number; failures: number }) => {
    const total = stats.jobsCompleted + stats.failures
    if (total === 0) return null
    
    const completionRate = stats.jobsCompleted / total
    
    if (completionRate >= 0.9 && stats.jobsCompleted >= 5) {
      return (
        <Chip 
          label="🟢 Trusted" 
          size="small"
          sx={{ bgcolor: '#E3F8ED', color: '#36C170', fontWeight: 600 }}
        />
      )
    } else if (completionRate >= 0.7) {
      return (
        <Chip 
          label="🟡 Reliable" 
          size="small"
          sx={{ bgcolor: '#FFF8E1', color: '#FFC857', fontWeight: 600 }}
        />
      )
    } else {
      return (
        <Chip 
          label="🔴 Risky" 
          size="small"
          sx={{ bgcolor: '#FFEBEE', color: '#E74C3C', fontWeight: 600 }}
        />
      )
    }
  }
  
  // Check if content is scrollable and show indicator
  useEffect(() => {
    const timer = setTimeout(() => {
      const cardContent = document.querySelector('.user-profile-content')
      if (cardContent) {
        const isScrollable = cardContent.scrollHeight > cardContent.clientHeight
        setScrollIndicatorVisible(isScrollable)
        if (isScrollable) {
          cardContent.classList.add('show-scroll-indicator')
          // Hide indicator after 3 seconds
          setTimeout(() => {
            cardContent.classList.remove('show-scroll-indicator')
            setScrollIndicatorVisible(false)
          }, 3000)
        }
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [loading, profile, jobStats])
  
  // Load job statistics
  const loadJobStats = async () => {
    try {
      // Poster stats
      const { data: postedJobs } = await supabase
        .from('jobs')
        .select('*')
        .eq('poster_wallet', walletAddress)

      const completedPosted = postedJobs?.filter(j => j.status === 'completed').length || 0
      const disputedPosted = postedJobs?.filter(j => j.status === 'disputed').length || 0
      
      // Worker stats
      const { data: workerJobs } = await supabase
        .from('jobs')
        .select('*')
        .eq('assigned_to', walletAddress)
        .eq('status', 'completed')

      const completedWorker = workerJobs?.length || 0
      
      const { data: failures } = await supabase
        .from('job_failures')
        .select('*')
        .eq('worker_wallet', walletAddress)

      // Calculate win rates
      const posterWinRate = disputedPosted > 0 
        ? Math.round((completedPosted / (completedPosted + disputedPosted)) * 100) 
        : 100

      setJobStats({
        poster: {
          jobsPosted: postedJobs?.length || 0,
          completedJobs: completedPosted,
          disputedJobs: disputedPosted,
          winRate: posterWinRate
        },
        worker: {
          jobsCompleted: completedWorker,
          failures: failures?.length || 0,
          winRate: 95 // TODO: Calculate from dispute outcomes
        }
      })
      
      // Load completed jobs for portfolio
      if (workerJobs) {
        setCompletedJobs(workerJobs)
      }
    } catch (error) {
      console.error('Error loading job stats:', error)
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
        
        // 1a. Check privacy permissions if profile exists
        if (profileData) {
          const viewCheck = await canViewProfile(currentUserWallet, profileData)
          setPrivacyCheck(viewCheck)
          
          const statusCheck = await canSeeOnlineStatus(currentUserWallet, profileData)
          setCanSeeStatus(statusCheck)
        }
        
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
  
  // Load job statistics
  useEffect(() => {
    loadJobStats()
  }, [walletAddress])
  
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
  
  // Check block status
  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!currentUserWallet) return
      
      const status = await isBlocked(currentUserWallet, walletAddress)
      setBlockStatus(status)
    }
    
    checkBlockStatus()
  }, [currentUserWallet, walletAddress])

  // Check for existing conversation
  useEffect(() => {
    const checkConversation = async () => {
      if (!currentUserWallet) return
      
      try {
        // Find conversation
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id')
          .or(`and(participant_1.eq.${currentUserWallet},participant_2.eq.${walletAddress}),and(participant_1.eq.${walletAddress},participant_2.eq.${currentUserWallet})`)
          .maybeSingle()
        
        if (conversations) {
          setConversationExists(true)
          
          // Get unread count
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversations.id)
            .eq('sender_wallet', walletAddress) // Messages from them
            .eq('is_read', false)
          
          setUnreadCount(count || 0)
          
          // Get last message
          const { data: messages } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', conversations.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (messages) {
            setLastMessage({
              content: messages.content,
              timestamp: messages.created_at
            })
          }
        }
      } catch (error) {
        console.error('Error checking conversation:', error)
      }
    }
    
    checkConversation()
  }, [currentUserWallet, walletAddress])
  
  // Handle message button click
  const handleMessage = async () => {
    if (!canMessage) {
      toast.error(messageReason || 'Cannot message this user')
      return
    }
    
    setOpeningMessage(true)
    
    try {
      await openMessages(walletAddress)
      onClose() // Close profile view
      if (onMessage) {
        onMessage(walletAddress)
      }
    } catch (error) {
      console.error('Error opening message:', error)
      toast.error('Failed to open message')
    } finally {
      setOpeningMessage(false)
    }
  }
  
  // Format time ago
  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)
    
    if (diffMinutes < 1) return 'just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString()
  }
  
  // Handle block button click
  const handleBlock = async (deleteHistory: boolean, reason?: string) => {
    if (!currentUserWallet) {
      toast.error('Please connect your wallet to block users')
      return
    }
    
    const result = await blockUser(currentUserWallet, walletAddress, reason, deleteHistory)
    
    if (result.success) {
      toast.success('User blocked')
      setBlockStatus({
        isBlocked: true,
        blockedBy: currentUserWallet,
        blockedUser: walletAddress
      })
      setShowBlockModal(false)
      onClose() // Close profile view after blocking
    } else {
      toast.error(result.error || 'Failed to block user')
    }
  }

  // Handle unblock button click
  const handleUnblock = async () => {
    if (!currentUserWallet) {
      toast.error('Please connect your wallet')
      return
    }
    
    const result = await unblockUser(currentUserWallet, walletAddress)
    
    if (result.success) {
      toast.success('User unblocked')
      setBlockStatus({ isBlocked: false })
    } else {
      toast.error(result.error || 'Failed to unblock user')
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
  const youBlockedThem = blockStatus.isBlocked && blockStatus.blockedBy === currentUserWallet
  const theyBlockedYou = blockStatus.isBlocked && blockStatus.blockedBy === walletAddress
  const privacyLevel = profile?.privacy_level || 'public'
  const privacyInfo = getPrivacyLevelInfo(privacyLevel as any)
  
  // Restricted view for holder-only profiles when viewer can't access
  if (!privacyCheck.canView && privacyCheck.hiddenSections) {
    return (
      <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4, borderRadius: 3, boxShadow: '0 20px 40px rgba(15, 23, 42, 0.06)' }}>
        <CardContent 
          sx={{ 
            p: 3,
            maxHeight: '85vh',
            overflowY: 'auto',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#F3F4F6',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#7C4DFF',
              borderRadius: '4px',
              '&:hover': {
                background: '#6A3FE8',
              }
            }
          }}
        >
          {/* Header with Close Button */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
              <Avatar
                sx={{ 
                  width: 80, 
                  height: 80,
                  bgcolor: '#7C4DFF',
                  fontSize: '2rem'
                }}
              >
                {displayName[0]?.toUpperCase()}
              </Avatar>
              
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#1A1A1E', fontFamily: 'var(--font-heading)' }}>
                  {displayName}
                </Typography>
                <Typography variant="body2" sx={{ color: '#6F7280', fontFamily: 'monospace', mt: 0.5 }}>
                  {truncateWallet(walletAddress)}
                </Typography>
                <Chip 
                  label="Holder-Only Profile" 
                  size="small" 
                  icon={<span>{privacyInfo.icon}</span>}
                  sx={{ mt: 1, bgcolor: '#FFC857', color: '#000', fontWeight: 600 }}
                />
              </Box>
            </Box>
            
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
          
          {/* Restricted Message */}
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box sx={{ fontSize: '4rem', mb: 2 }}>{privacyInfo.icon}</Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: '#1A1A1E' }}>
              This is a Holder-Only Profile
            </Typography>
            <Typography variant="body2" sx={{ color: '#6F7280', mb: 2, maxWidth: 400, mx: 'auto' }}>
              {privacyCheck.reason || 'Hold tokens in a common project to view full profile details.'}
            </Typography>
            {!currentUserWallet && (
              <Typography variant="caption" sx={{ color: '#A3A7B5' }}>
                Connect your wallet to see if you have access
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    )
  }
  
  // Fully restricted view for private profiles
  if (!privacyCheck.canView && !privacyCheck.hiddenSections) {
    return (
      <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4, borderRadius: 3, boxShadow: '0 20px 40px rgba(15, 23, 42, 0.06)' }}>
        <CardContent 
          sx={{ 
            p: 3,
            maxHeight: '85vh',
            overflowY: 'auto',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#F3F4F6',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#7C4DFF',
              borderRadius: '4px',
              '&:hover': {
                background: '#6A3FE8',
              }
            }
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1A1A1E', fontFamily: 'var(--font-heading)' }}>
                Private Profile
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
          
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box sx={{ fontSize: '4rem', mb: 2 }}>🔐</Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: '#1A1A1E' }}>
              This Profile is Private
            </Typography>
            <Typography variant="body2" sx={{ color: '#6F7280' }}>
              {privacyCheck.reason || 'This user has set their profile to private.'}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4, borderRadius: 3, boxShadow: '0 20px 40px rgba(15, 23, 42, 0.06)' }}>
      <CardContent 
        className="user-profile-content"
        sx={{ 
          p: 3,
          maxHeight: '85vh',
          overflowY: 'auto',
          position: 'relative',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#F3F4F6',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#7C4DFF',
            borderRadius: '4px',
            '&:hover': {
              background: '#6A3FE8',
            }
          },
          // Scroll indicator shadow at bottom
          '&::after': {
            content: '""',
            position: 'sticky',
            bottom: 0,
            left: 0,
            right: 0,
            height: '40px',
            background: 'linear-gradient(to top, rgba(255, 255, 255, 0.95) 0%, transparent 100%)',
            pointerEvents: 'none',
            opacity: 0,
            transition: 'opacity 0.3s',
          },
          '&.show-scroll-indicator::after': {
            opacity: 1,
          }
        }}
        onScroll={(e: any) => {
          const element = e.currentTarget
          const isScrollable = element.scrollHeight > element.clientHeight
          const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 20
          
          if (isScrollable && !isNearBottom) {
            element.classList.add('show-scroll-indicator')
          } else {
            element.classList.remove('show-scroll-indicator')
          }
        }}
      >
        {/* Header with Close Button */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            {/* Avatar with Online Indicator */}
            <Box sx={{ position: 'relative' }}>
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
              
              {/* Online Indicator - only show if allowed */}
              {canSeeStatus && (
                <Tooltip title={online ? 'Online' : 'Offline'}>
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 4,
                      right: 4,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: '4px solid white',
                      bgcolor: online ? '#36C170' : '#A3A7B5',
                      transition: 'all 0.3s',
                      boxShadow: online ? '0 0 8px rgba(54, 193, 112, 0.6)' : 'none',
                      animation: online ? 'pulse 2s ease-in-out infinite' : 'none',
                      '@keyframes pulse': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.5 }
                      }
                    }}
                  />
                </Tooltip>
              )}
            </Box>
            
            {/* Name and Wallet */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1A1A1E', fontFamily: 'var(--font-heading)' }}>
                {displayName}
              </Typography>
              <Typography variant="body2" sx={{ color: '#6F7280', fontFamily: 'monospace', mt: 0.5 }}>
                {truncateWallet(walletAddress)}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                {profile?.privacy_level === 'private' && (
                  <Chip 
                    label="Private Profile" 
                    size="small"
                    sx={{ bgcolor: '#F7F8FB', color: '#6F7280' }}
                  />
                )}
                {youBlockedThem && (
                  <Chip 
                    label="Blocked" 
                    size="small"
                    sx={{ bgcolor: '#FFEBEE', color: '#E74C3C' }}
                    icon={<BlockIcon />}
                  />
                )}
                {theyBlockedYou && (
                  <Chip 
                    label="Blocked You" 
                    size="small"
                    sx={{ bgcolor: '#DC2626', color: 'white' }}
                    icon={<BlockIcon sx={{ color: 'white !important' }} />}
                  />
                )}
              </Box>
            </Box>
          </Box>
          
          {/* Close Button */}
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        
        {/* Stats Section */}
        {karma && (
          <Paper sx={{ mb: 3, p: 3, bgcolor: '#EEE7FF', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#7C4DFF', fontFamily: 'var(--font-heading)' }}>
                Project Stats
              </Typography>
              {karma.is_banned && (
                <Chip 
                  label="BANNED" 
                  sx={{ bgcolor: '#FFEBEE', color: '#E74C3C', fontWeight: 600 }}
                  size="small"
                />
              )}
            </Box>
            
            <Grid container spacing={3}>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#7C4DFF' }}>
                    {karma.total_karma_points.toFixed(0)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6F7280', mt: 0.5, display: 'block' }}>
                    Total Karma
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#7C4DFF' }}>
                    {karma.assets_added_count}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6F7280', mt: 0.5, display: 'block' }}>
                    Assets Added
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#7C4DFF' }}>
                    {karma.upvotes_given_count}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6F7280', mt: 0.5, display: 'block' }}>
                    Votes Given
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            
            {/* Holder Tier Badge */}
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
              {loadingTier ? (
                <Chip
                  label="Loading tier..."
                  size="small"
                  sx={{ fontSize: '0.75rem', bgcolor: '#F7F8FB', color: '#6F7280' }}
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
            </Box>
          </Paper>
        )}
        
        {/* Job Stats Section */}
        {jobStats && (jobStats.poster.jobsPosted > 0 || jobStats.worker.jobsCompleted > 0) && (
          <Paper sx={{ p: 3, mb: 3, bgcolor: '#FAFBFC' }}>
            <Typography variant="h6" sx={{ mb: 2, fontFamily: 'Space Grotesk', fontWeight: 700 }}>
              Job Activity
            </Typography>

            {/* As Poster */}
            {jobStats.poster.jobsPosted > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#7C4DFF', fontWeight: 600 }}>
                  As Job Poster
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {jobStats.poster.jobsPosted}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6F7280' }}>
                      Jobs Posted
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#36C170' }}>
                      {jobStats.poster.completedJobs}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6F7280' }}>
                      Completed
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#FFC857' }}>
                      {jobStats.poster.disputedJobs}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6F7280' }}>
                      Disputed
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {jobStats.poster.winRate}%
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6F7280' }}>
                      Win Rate
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* As Worker */}
            {jobStats.worker.jobsCompleted > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#7C4DFF', fontWeight: 600 }}>
                  As Worker
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {jobStats.worker.jobsCompleted}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6F7280' }}>
                      Jobs Completed
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#E74C3C' }}>
                      {jobStats.worker.failures}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6F7280' }}>
                      Failed to Deliver
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {jobStats.worker.winRate}%
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6F7280' }}>
                      Dispute Win Rate
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                      {getReputationBadge(jobStats.worker)}
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Paper>
        )}
        
        {/* Completed Jobs Portfolio */}
        {jobStats && jobStats.worker.jobsCompleted > 0 && completedJobs.length > 0 && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontFamily: 'Space Grotesk', fontWeight: 700 }}>
              Portfolio ({jobStats.worker.jobsCompleted} jobs)
            </Typography>
            
            <Grid container spacing={2}>
              {completedJobs.slice(0, showAllJobs ? completedJobs.length : 6).map(job => (
                <Grid item xs={12} sm={6} md={4} key={job.id}>
                  <Card 
                    sx={{ 
                      p: 2, 
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': { 
                        boxShadow: 3,
                        transform: 'translateY(-2px)'
                      }
                    }}
                    onClick={() => router.push(`/project/${job.project_id}/jobs/${job.id}`)}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, lineClamp: 2 }}>
                      {job.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6F7280' }}>
                      {job.category} • ${job.payment_amount_usd}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#36C170' }}>
                      ✓ Completed {job.completed_at ? formatDistanceToNow(new Date(job.completed_at), { addSuffix: true }) : ''}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {jobStats.worker.jobsCompleted > 6 && !showAllJobs && (
              <Button 
                fullWidth 
                sx={{ 
                  mt: 2,
                  textTransform: 'none',
                  color: '#7C4DFF',
                  '&:hover': {
                    bgcolor: '#F8F5FF'
                  }
                }}
                onClick={() => setShowAllJobs(true)}
              >
                View All {jobStats.worker.jobsCompleted} Jobs
              </Button>
            )}
            
            {showAllJobs && jobStats.worker.jobsCompleted > 6 && (
              <Button 
                fullWidth 
                sx={{ 
                  mt: 2,
                  textTransform: 'none',
                  color: '#7C4DFF',
                  '&:hover': {
                    bgcolor: '#F8F5FF'
                  }
                }}
                onClick={() => setShowAllJobs(false)}
              >
                Show Less
              </Button>
            )}
          </Paper>
        )}
        
        {/* Bio Section */}
        {profile?.bio && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#6F7280', mb: 1 }}>
              Bio
            </Typography>
            <Typography variant="body1" sx={{ color: '#1A1A1E', whiteSpace: 'pre-wrap' }}>
              {profile.bio}
            </Typography>
          </Box>
        )}
        
        <Divider sx={{ my: 3 }} />
        
        {/* Action Buttons */}
        <Box sx={{ mb: 3 }}>
          {/* Tip Button */}
          {currentUserWallet && currentUserWallet !== walletAddress && projectId && tokenMint && (
            <Button
              variant="contained"
              startIcon={<LocalAtmIcon />}
              onClick={() => setShowTipModal(true)}
              fullWidth
              sx={{
                bgcolor: '#36C170',
                mb: 2,
                '&:hover': { 
                  bgcolor: '#2EA860',
                  boxShadow: '0 0 12px rgba(54, 193, 112, 0.5)' // Green glow
                },
                textTransform: 'none',
                fontSize: '16px',
                py: 1.5,
                transition: 'all 0.2s ease-in-out',
                boxShadow: '0 2px 8px rgba(54, 193, 112, 0.3)'
              }}
            >
              Send Tip
            </Button>
          )}
          
          {/* Primary Message CTA */}
          <Tooltip 
            title={
              blockStatus.isBlocked 
                ? theyBlockedYou 
                  ? 'This user has blocked you' 
                  : 'You have blocked this user'
                : !canMessage 
                ? messageReason 
                : ''
            }
            arrow
            placement="top"
          >
            <Box sx={{ display: 'block', mb: 2 }}>
              <Button
                variant="contained"
                startIcon={openingMessage ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <MessageIcon />}
                onClick={handleMessage}
                disabled={blockStatus.isBlocked || !canMessage || checkingMessage || openingMessage}
                fullWidth
                sx={{
                  bgcolor: '#7C4DFF',
                  '&:hover': { 
                    bgcolor: '#6C3FEF',
                    boxShadow: '0 0 12px rgba(124, 77, 255, 0.5)' // Purple glow
                  },
                  '&:disabled': {
                    bgcolor: 'rgba(0, 0, 0, 0.12)'
                  },
                  textTransform: 'none',
                  fontSize: '16px',
                  py: 1.5,
                  transition: 'all 0.2s ease-in-out',
                  boxShadow: '0 2px 8px rgba(124, 77, 255, 0.3)'
                }}
              >
                {checkingMessage ? (
                  'Checking permissions...'
                ) : openingMessage ? (
                  'Opening...'
                ) : blockStatus.isBlocked ? (
                  theyBlockedYou ? 'User blocked you' : 'You blocked this user'
                ) : conversationExists ? (
                  unreadCount > 0 ? `Continue conversation (${unreadCount} unread)` : 'Continue conversation'
                ) : (
                  'Start conversation'
                )}
              </Button>
            </Box>
          </Tooltip>
          
          {/* Conversation Preview */}
          {conversationExists && lastMessage && (
            <Paper sx={{ mb: 2, p: 2, bgcolor: '#EEE7FF', borderRadius: 2, border: '1px solid #D4C5F9' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#7C4DFF', display: 'block', mb: 0.5 }}>
                Last message • {formatTimeAgo(lastMessage.timestamp)}
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#1A1A1E',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}
              >
                {lastMessage.content.length > 80 
                  ? lastMessage.content.substring(0, 80) + '...' 
                  : lastMessage.content}
              </Typography>
            </Paper>
          )}
          
          {/* Secondary Actions */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {youBlockedThem ? (
              <Button
                variant="contained"
                startIcon={<CheckCircleIcon />}
                onClick={handleUnblock}
                fullWidth
                sx={{
                  bgcolor: '#36C170',
                  '&:hover': {
                    bgcolor: '#2DA760'
                  },
                  textTransform: 'none'
                }}
              >
                Unblock User
              </Button>
            ) : !theyBlockedYou ? (
              <Button
                variant="outlined"
                startIcon={<BlockIcon />}
                onClick={() => setShowBlockModal(true)}
                fullWidth
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
            ) : null}
          </Box>
        </Box>
        
        {/* Reputation - Top Projects */}
        {topProjects.length > 0 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <StarIcon sx={{ fontSize: 20, color: '#F59E0B' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#6F7280' }}>
                Top Projects by Karma
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {topProjects.map((proj, index) => (
                <Paper
                  key={proj.project_id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 2,
                    bgcolor: index === 0 ? '#FFF8E6' : '#F7F8FB',
                    borderRadius: 2,
                    border: index === 0 ? '1px solid #F59E0B' : '1px solid #E5E7F0',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: index === 0 ? '#FFF4D6' : '#EEEFF5',
                      transform: 'translateX(4px)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#A3A7B5', minWidth: '32px' }}>
                      #{index + 1}
                    </Typography>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1A1A1E' }}>
                        {proj.project_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6F7280' }}>
                        {proj.total_karma_points.toFixed(0)} karma
                      </Typography>
                    </Box>
                  </Box>
                  
                  {index === 0 && (
                    <StarIcon sx={{ color: '#F59E0B', fontSize: 24 }} />
                  )}
                </Paper>
              ))}
            </Box>
          </Box>
        )}
        
        {/* No Activity Message */}
        {!karma && topProjects.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No activity found for this user</p>
          </div>
        )}
      </CardContent>

      {/* Block User Modal */}
      <BlockUserModal
        open={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        onConfirm={handleBlock}
        userName={displayName}
        walletAddress={walletAddress}
      />

      {/* Tip Modal */}
      {projectId && tokenMint && (
        <TipModal
          open={showTipModal}
          onClose={() => setShowTipModal(false)}
          recipientWallet={walletAddress}
          projectId={projectId}
          tokenMint={tokenMint}
        />
      )}
    </Card>
  )
}

