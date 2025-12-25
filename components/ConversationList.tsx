'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import { canSeeOnlineStatus } from '@/lib/privacy'
import { formatDistanceToNow } from 'date-fns'
import {
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Badge,
  Typography,
  Box,
  CircularProgress,
  Chip
} from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import DeleteIcon from '@mui/icons-material/Delete'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import { keyframes } from '@mui/system'

// Pulse animation for unread submission tags
const pulseAnimation = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
`

type Message = Database['public']['Tables']['messages']['Row']
type Conversation = Database['public']['Tables']['conversations']['Row']
type UserProfile = Database['public']['Tables']['user_profiles']['Row']

interface ConversationWithDetails extends Conversation {
  lastMessage?: Message
  otherParticipant?: UserProfile
  unreadCount: number
  isUnread: boolean
  canSeeStatus: boolean
  tags?: string[]
  submission_id?: string | null
}

// Social Asset Reviews aggregated entry (single item like Project Submissions)
interface SocialAssetReviewsEntry {
  type: 'social_asset_reviews'
  pendingCount: number
  totalCount: number  // Total manageable assets (pending + verified + rejected + hidden)
  latestSubmitter?: string
  latestSubmitterProfile?: UserProfile
  latestAssetSummary?: string
  latestAssetStatus?: string  // Status of latest asset
  latestCreatedAt: string
  isUnread: boolean
}

// Combined list item type
type ListItemData = 
  | { type: 'conversation'; data: ConversationWithDetails }
  | { type: 'social_asset_reviews'; data: SocialAssetReviewsEntry }

interface ConversationListProps {
  currentWallet: string
  onSelectConversation: (conversationId: string) => void
  onSelectAssetReviews?: () => void  // Called when clicking "Social Asset Reviews" entry
  filter?: 'all' | 'unread'
  refreshTrigger?: number // Change this to force a refresh
  showAssetReviews?: boolean // Whether to show social asset reviews entry in the list
}

export function ConversationList({ 
  currentWallet, 
  onSelectConversation,
  onSelectAssetReviews,
  filter = 'all',
  refreshTrigger,
  showAssetReviews = false
}: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [assetReviewsEntry, setAssetReviewsEntry] = useState<SocialAssetReviewsEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null)
  const [userPermissions, setUserPermissions] = useState<{
    isGlobalAdmin: boolean
    editorProjects: string[]
    creatorProjects: string[]
  }>({ isGlobalAdmin: false, editorProjects: [], creatorProjects: [] })
  
  const CONVERSATIONS_PER_PAGE = 20

  // Check user permissions for asset reviews
  useEffect(() => {
    if (!currentWallet || !showAssetReviews) return

    async function checkPermissions() {
      // Check if global admin
      const { data: admin } = await supabase
        .from('admin_wallets')
        .select('wallet_address')
        .eq('wallet_address', currentWallet)
        .eq('is_active', true)
        .maybeSingle()

      // Get projects where user is creator
      const { data: creatorProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('creator_wallet', currentWallet)

      // Get projects where user is editor
      const { data: editorProjects } = await supabase
        .from('projects')
        .select('id, editor_wallets')
        .contains('editor_wallets', [currentWallet])

      setUserPermissions({
        isGlobalAdmin: !!admin,
        creatorProjects: creatorProjects?.map(p => p.id) || [],
        editorProjects: editorProjects?.map(p => p.id) || []
      })
    }

    checkPermissions()
  }, [currentWallet, showAssetReviews])

  // Load social asset reviews entry (aggregated - single item)
  useEffect(() => {
    if (!showAssetReviews || !currentWallet) return
    if (!userPermissions.isGlobalAdmin && 
        userPermissions.creatorProjects.length === 0 && 
        userPermissions.editorProjects.length === 0) {
      setAssetReviewsEntry(null)
      return
    }

    async function loadAssetReviewsEntry() {
      try {
        // Build query for counting PENDING assets (for badge) and ALL assets (to show entry)
        let pendingCountQuery = supabase
          .from('pending_assets')
          .select('id', { count: 'exact', head: true })
          .eq('verification_status', 'pending')

        // Count ALL manageable assets (to determine if entry should show)
        let totalCountQuery = supabase
          .from('pending_assets')
          .select('id', { count: 'exact', head: true })
          .in('verification_status', ['pending', 'verified', 'rejected', 'hidden'])

        let latestQuery = supabase
          .from('pending_assets')
          .select(`
            id,
            asset_type,
            asset_data,
            submitter_wallet,
            created_at,
            verification_status
          `)
          .in('verification_status', ['pending', 'verified', 'rejected', 'hidden'])
          .order('created_at', { ascending: false })
          .limit(1)

        // If not global admin, filter by projects user can review
        if (!userPermissions.isGlobalAdmin) {
          const allProjects = [...userPermissions.creatorProjects, ...userPermissions.editorProjects]
          if (allProjects.length > 0) {
            pendingCountQuery = pendingCountQuery.in('project_id', allProjects)
            totalCountQuery = totalCountQuery.in('project_id', allProjects)
            latestQuery = latestQuery.in('project_id', allProjects)
          } else {
            setAssetReviewsEntry(null)
            return
          }
        }

        const [pendingCountResult, totalCountResult, latestResult] = await Promise.all([
          pendingCountQuery, totalCountQuery, latestQuery
        ])

        if (pendingCountResult.error || totalCountResult.error || latestResult.error) {
          console.error('Error loading asset reviews:', pendingCountResult.error || totalCountResult.error || latestResult.error)
          return
        }

        const pendingCount = pendingCountResult.count || 0
        const totalCount = totalCountResult.count || 0
        
        // Show entry if there are ANY assets to manage (not just pending)
        if (totalCount === 0) {
          setAssetReviewsEntry(null)
          return
        }

        const latestAsset = latestResult.data?.[0]
        
        // Get profile for latest submitter
        let latestProfile: UserProfile | undefined
        if (latestAsset?.submitter_wallet) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('wallet_address, display_name, avatar_url')
            .eq('wallet_address', latestAsset.submitter_wallet)
            .maybeSingle()
          
          latestProfile = profile as UserProfile | undefined
        }

        // Build asset summary
        const assetData = latestAsset?.asset_data as any
        const latestAssetSummary = latestAsset?.asset_type === 'social'
          ? `@${assetData?.handle} on ${assetData?.platform}`
          : assetData?.domain || 'Domain'

        setAssetReviewsEntry({
          type: 'social_asset_reviews',
          pendingCount,
          totalCount,
          latestSubmitter: latestAsset?.submitter_wallet,
          latestSubmitterProfile: latestProfile,
          latestAssetSummary,
          latestAssetStatus: latestAsset?.verification_status,
          latestCreatedAt: latestAsset?.created_at || new Date().toISOString(),
          isUnread: pendingCount > 0 // Only unread if there are pending items
        })
      } catch (error) {
        console.error('Error in loadAssetReviewsEntry:', error)
      }
    }

    loadAssetReviewsEntry()

    // Subscribe to changes
    const channel = supabase
      .channel(`asset-reviews-entry-${currentWallet}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_assets'
        },
        () => {
          loadAssetReviewsEntry()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [showAssetReviews, currentWallet, userPermissions])

  // Load conversations with pagination and optimization
  const loadConversations = useCallback(async (loadMore = false) => {
    if (!currentWallet) return

    if (loadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const offset = loadMore ? conversations.length : 0
      
      // 1. Fetch conversations with limit (only needed columns)
      // Only show conversations that have at least one message and are not archived
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('id, participant_1, participant_2, last_message_at, created_at, updated_at, archived_by_participant_1, archived_by_participant_2, tags, submission_id')
        .or(`participant_1.eq.${currentWallet},participant_2.eq.${currentWallet}`)
        .not('last_message_at', 'is', null)
        .order('last_message_at', { ascending: false })
        .range(offset, offset + CONVERSATIONS_PER_PAGE - 1)
      
      // Filter out archived conversations client-side (more reliable than complex OR query)
      const filteredConvData = convData?.filter(conv => {
        const isParticipant1 = conv.participant_1 === currentWallet
        return isParticipant1 
          ? !conv.archived_by_participant_1 
          : !conv.archived_by_participant_2
      }) || []

      if (convError) {
        console.error('Error fetching conversations:', convError)
        return
      }

      if (!filteredConvData || filteredConvData.length === 0) {
        if (!loadMore) {
          setConversations([])
        }
        setHasMore(false)
        return
      }

      // Check if there are more conversations
      setHasMore(filteredConvData.length === CONVERSATIONS_PER_PAGE)

      // Get all unique participant wallets for batch fetching
      const participantWallets = new Set<string>()
      filteredConvData.forEach(conv => {
        const otherWallet = 
          conv.participant_1 === currentWallet 
            ? conv.participant_2 
            : conv.participant_1
        participantWallets.add(otherWallet)
      })

      // 2. Batch fetch all participant profiles
      const { data: profilesData } = await supabase
        .from('user_profiles')
        .select('wallet_address, display_name, avatar_url, is_online, last_seen_at, privacy_level')
        .in('wallet_address', Array.from(participantWallets))

      const profileMap = new Map(
        profilesData?.map(p => [p.wallet_address, p]) || []
      )

      // 3. Batch fetch last messages for all conversations
      const conversationIds = filteredConvData.map(c => c.id)
      const { data: messagesData } = await supabase
        .from('messages')
        .select('id, conversation_id, content, sender_wallet, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })

      // Group messages by conversation (take only the latest)
      const lastMessageMap = new Map<string, any>()
      messagesData?.forEach(msg => {
        if (!lastMessageMap.has(msg.conversation_id)) {
          lastMessageMap.set(msg.conversation_id, msg)
        }
      })

      // 4. Batch count unread messages
      const { data: unreadData } = await supabase
        .from('messages')
        .select('conversation_id, id')
        .in('conversation_id', conversationIds)
        .neq('sender_wallet', currentWallet)
        .eq('is_read', false)

      const unreadCountMap = new Map<string, number>()
      unreadData?.forEach(msg => {
        unreadCountMap.set(
          msg.conversation_id,
          (unreadCountMap.get(msg.conversation_id) || 0) + 1
        )
      })

      // 5. Build conversations with details
      const conversationsWithDetails = await Promise.all(
        filteredConvData.map(async (conv) => {
          const otherWallet = 
            conv.participant_1 === currentWallet 
              ? conv.participant_2 
              : conv.participant_1

          const profileData = profileMap.get(otherWallet)
          const unreadCount = unreadCountMap.get(conv.id) || 0

          // Check if current user can see other user's online status
          const statusCheck = profileData 
            ? await canSeeOnlineStatus(currentWallet, profileData)
            : false

          // Debug logging for tags
          if (conv.tags && conv.tags.length > 0) {
            console.log(`Conversation ${conv.id} has tags:`, conv.tags)
          }
          
          return {
            ...conv,
            lastMessage: lastMessageMap.get(conv.id) || undefined,
            otherParticipant: profileData || undefined,
            unreadCount,
            isUnread: unreadCount > 0,
            canSeeStatus: statusCheck,
            tags: conv.tags || [],
            submission_id: conv.submission_id
          }
        })
      )

      // Sort: unread first, then by most recent message
      const sorted = conversationsWithDetails.sort((a, b) => {
        // Unread conversations first
        if (a.isUnread && !b.isUnread) return -1
        if (!a.isUnread && b.isUnread) return 1
        
        // Then by most recent message
        const aTime = new Date(a.last_message_at).getTime()
        const bTime = new Date(b.last_message_at).getTime()
        return bTime - aTime
      })

      if (loadMore) {
        setConversations(prev => [...prev, ...sorted])
      } else {
        setConversations(sorted)
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [currentWallet, conversations.length])

  // Initial load and refresh on trigger change
  useEffect(() => {
    loadConversations()
  }, [loadConversations, refreshTrigger])

  // Real-time subscription for new messages
  useEffect(() => {
    if (!currentWallet) return

    // Subscribe to messages table changes
    const channel = supabase
      .channel(`conversations_${currentWallet}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          console.log('Message change detected:', payload)
          
          // Reload conversations to update list
          await loadConversations()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        async (payload) => {
          console.log('Conversation change detected:', payload)
          await loadConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentWallet, loadConversations])

  // Archive conversation handler (doesn't delete, just hides from view)
  const handleDeleteConversation = async (
    e: React.MouseEvent, 
    conversationId: string
  ) => {
    e.stopPropagation()
    
    if (!confirm('Archive this conversation? You can restore it later from settings.')) {
      return
    }

    try {
      // Find the conversation to determine which participant is archiving
      const conversation = conversations.find(c => c.id === conversationId)
      if (!conversation) return

      // Determine which archive field to update
      const isParticipant1 = conversation.participant_1 === currentWallet
      const archiveField = isParticipant1 
        ? 'archived_by_participant_1' 
        : 'archived_by_participant_2'

      // Archive the conversation (don't delete)
      const { error } = await supabase
        .from('conversations')
        .update({ [archiveField]: true })
        .eq('id', conversationId)

      if (error) {
        console.error('Error archiving conversation:', error)
        return
      }

      // Update local state (remove from view)
      setConversations(prev => prev.filter(c => c.id !== conversationId))
    } catch (error) {
      console.error('Error archiving conversation:', error)
    }
  }

  // Format address helper
  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  // Format timestamp helper
  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    } catch {
      return ''
    }
  }

  // Truncate message preview
  const truncateMessage = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  // Get display name for participant
  const getDisplayName = (conv: ConversationWithDetails) => {
    const otherWallet = 
      conv.participant_1 === currentWallet 
        ? conv.participant_2 
        : conv.participant_1

    return conv.otherParticipant?.display_name || formatAddress(otherWallet)
  }

  // Loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  // Filter conversations based on selected tab
  const filteredConversations = filter === 'unread' 
    ? conversations.filter(conv => conv.isUnread)
    : conversations

  // Include asset reviews entry (single item) if showing and has pending items
  const showAssetReviewsEntry = showAssetReviews && assetReviewsEntry && 
    (filter !== 'unread' || assetReviewsEntry.isUnread)

  // Combine and sort all items by date
  const allItems: ListItemData[] = [
    ...(showAssetReviewsEntry ? [{ type: 'social_asset_reviews' as const, data: assetReviewsEntry }] : []),
    ...filteredConversations.map(c => ({ type: 'conversation' as const, data: c }))
  ].sort((a, b) => {
    const dateA = a.type === 'conversation' 
      ? new Date(a.data.last_message_at).getTime()
      : new Date(a.data.latestCreatedAt).getTime()
    const dateB = b.type === 'conversation'
      ? new Date(b.data.last_message_at).getTime()
      : new Date(b.data.latestCreatedAt).getTime()
    return dateB - dateA
  })

  // Empty state
  if (allItems.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          px: 3
        }}
      >
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {filter === 'unread' ? 'No unread messages' : 'No messages yet'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {filter === 'unread' 
            ? 'All caught up! You have no unread conversations.'
            : "Start a conversation by visiting a user's profile!"
          }
        </Typography>
      </Box>
    )
  }

  // Helper to get display name for latest asset review submitter
  const getAssetReviewDisplayName = (entry: SocialAssetReviewsEntry) => {
    if (entry.latestSubmitterProfile?.display_name) {
      return entry.latestSubmitterProfile.display_name
    }
    return entry.latestSubmitter ? formatAddress(entry.latestSubmitter) : 'Unknown'
  }

  // Conversations list (with asset reviews entry)
  return (
    <>
      <List sx={{ width: '100%', bgcolor: 'background.paper', p: 0 }}>
        {allItems.map((item) => {
          // Render Social Asset Reviews Entry (single aggregated item like Project Submissions)
          if (item.type === 'social_asset_reviews') {
            const entry = item.data
            const latestDisplayName = getAssetReviewDisplayName(entry)
            
            return (
                <ListItem
                key="social-asset-reviews"
                disablePadding
                sx={{
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'rgba(255, 184, 0, 0.08)',
                  '&:hover': {
                    bgcolor: 'rgba(255, 184, 0, 0.15)'
                  }
                }}
              >
                <ListItemButton
                  onClick={() => onSelectAssetReviews?.()}
                  sx={{ py: 2 }}
                >
                  <ListItemAvatar>
                    <Badge
                      badgeContent={entry.pendingCount > 0 ? entry.pendingCount : entry.totalCount}
                      max={99}
                      sx={{
                        '& .MuiBadge-badge': {
                          bgcolor: '#FFB800',
                          color: '#1A1A1E',
                          fontWeight: 700,
                          fontSize: '11px',
                          minWidth: 20,
                          height: 20
                        }
                      }}
                    >
                      <Avatar
                        sx={{ 
                          bgcolor: '#FFB800',
                          width: 48,
                          height: 48
                        }}
                      >
                        <VerifiedUserIcon />
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>

                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography
                          variant="subtitle1"
                          component="span"
                          sx={{
                            fontWeight: 700,
                            color: 'text.primary'
                          }}
                        >
                          Social Asset Reviews
                        </Typography>
                        
                        {/* Asset Review Tag - Always yellow */}
                        <Chip
                          label="Asset Review"
                          size="small"
                          sx={{
                            background: 'linear-gradient(135deg, #FFB800, #FFC933)',
                            color: '#1A1A1E',
                            borderRadius: '20px',
                            height: '22px',
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.3px',
                            padding: '0 4px',
                            flexShrink: 0,
                            '& .MuiChip-label': {
                              padding: '0 8px',
                              lineHeight: '22px',
                              whiteSpace: 'nowrap',
                              overflow: 'visible'
                            },
                            animation: entry.pendingCount > 0 ? `${pulseAnimation} 2s ease-in-out infinite` : 'none'
                          }}
                        />

                        {entry.pendingCount > 0 && (
                          <FiberManualRecordIcon
                            sx={{
                              fontSize: 10,
                              color: '#FFB800'
                            }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography
                          variant="body2"
                          component="span"
                          sx={{
                            color: 'text.secondary',
                            fontWeight: 600,
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {entry.pendingCount > 0 
                            ? `${entry.pendingCount} pending ${entry.pendingCount === 1 ? 'review' : 'reviews'}`
                            : `${entry.totalCount} ${entry.totalCount === 1 ? 'asset' : 'assets'} to manage`
                          }
                        </Typography>
                        <Typography
                          variant="caption"
                          component="span"
                          sx={{
                            color: 'text.disabled',
                            display: 'block',
                            mt: 0.25
                          }}
                        >
                          Latest: {entry.latestAssetSummary} by {latestDisplayName}
                          {entry.latestAssetStatus === 'hidden' && ' (User Banned)'}
                          {entry.latestAssetStatus === 'verified' && ' (Approved)'}
                          {entry.latestAssetStatus === 'rejected' && ' (Rejected)'}
                        </Typography>
                      </Box>
                    }
                    secondaryTypographyProps={{
                      component: 'div'
                    }}
                  />
                </ListItemButton>
              </ListItem>
            )
          }

          // Render Conversation Item
          const conv = item.data as ConversationWithDetails
          const displayName = getDisplayName(conv)
          const lastMessagePreview = conv.lastMessage
            ? truncateMessage(conv.lastMessage.content)
            : 'No messages yet'
          const timestamp = conv.lastMessage
            ? formatTimestamp(conv.lastMessage.created_at)
            : ''
          const isOnline = conv.otherParticipant?.is_online || false
          const showOnlineStatus = conv.canSeeStatus && isOnline

          return (
            <ListItem
              key={conv.id}
              disablePadding
              onMouseEnter={() => setHoveredConvId(conv.id)}
              onMouseLeave={() => setHoveredConvId(null)}
              secondaryAction={
                hoveredConvId === conv.id ? (
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                    sx={{
                      color: 'error.main',
                      '&:hover': {
                        bgcolor: 'error.light',
                        color: 'error.dark'
                      }
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                ) : null
              }
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: conv.isUnread ? 'action.hover' : 'transparent',
                '&:hover': {
                  bgcolor: 'action.selected'
                }
              }}
            >
            <ListItemButton
              onClick={() => onSelectConversation(conv.id)}
              sx={{ py: 2 }}
            >
              <ListItemAvatar>
                {conv.canSeeStatus ? (
                  <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    variant="dot"
                    sx={{
                      '& .MuiBadge-badge': {
                        backgroundColor: isOnline ? '#44b700' : '#9E9E9E',
                        color: isOnline ? '#44b700' : '#9E9E9E',
                        boxShadow: `0 0 0 2px #fff`,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        '&::after': isOnline ? {
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          animation: 'ripple 1.2s infinite ease-in-out',
                          border: '1px solid currentColor',
                          content: '""',
                        } : {}
                      },
                      '@keyframes ripple': {
                        '0%': {
                          transform: 'scale(.8)',
                          opacity: 1,
                        },
                        '100%': {
                          transform: 'scale(2.4)',
                          opacity: 0,
                        },
                      },
                    }}
                  >
                    <Avatar
                      src={conv.otherParticipant?.avatar_url || undefined}
                      sx={{ 
                        bgcolor: '#7C4DFF',
                        width: 48,
                        height: 48
                      }}
                    >
                      {conv.otherParticipant?.avatar_url ? null : <PersonIcon />}
                    </Avatar>
                  </Badge>
                ) : (
                  <Avatar
                    src={conv.otherParticipant?.avatar_url || undefined}
                    sx={{ 
                      bgcolor: '#7C4DFF',
                      width: 48,
                      height: 48
                    }}
                  >
                    {conv.otherParticipant?.avatar_url ? null : <PersonIcon />}
                  </Avatar>
                )}
              </ListItemAvatar>

              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography
                      variant="subtitle1"
                      component="span"
                      sx={{
                        fontWeight: conv.isUnread ? 700 : 500,
                        color: 'text.primary'
                      }}
                    >
                      {displayName}
                    </Typography>
                    
                    {/* Project Submission Tag - Check both tags array and participant */}
                    {((conv.tags && conv.tags.includes('Project Submission')) || 
                      conv.participant_1 === 'project-submissions' || 
                      conv.participant_2 === 'project-submissions') && (
                      <Chip
                        label="Project Submission"
                        size="small"
                        sx={{
                          background: 'linear-gradient(135deg, #7C4DFF, #9D6CFF)',
                          color: 'white',
                          borderRadius: '20px',
                          height: '22px',
                          fontSize: '11px',
                          fontWeight: 600,
                          letterSpacing: '0.3px',
                          padding: '0 4px',
                          flexShrink: 0,
                          '& .MuiChip-label': {
                            padding: '0 8px',
                            lineHeight: '22px',
                            whiteSpace: 'nowrap',
                            overflow: 'visible'
                          },
                          animation: conv.isUnread ? `${pulseAnimation} 2s ease-in-out infinite` : 'none'
                        }}
                      />
                    )}
                    
                    {conv.isUnread && (
                      <FiberManualRecordIcon
                        sx={{
                          fontSize: 10,
                          color: '#7C4DFF'
                        }}
                      />
                    )}
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 0.5 }}>
                    <Typography
                      variant="body2"
                      component="span"
                      sx={{
                        color: 'text.secondary',
                        fontWeight: conv.isUnread ? 600 : 400,
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {lastMessagePreview}
                    </Typography>
                    <Typography
                      variant="caption"
                      component="span"
                      sx={{
                        color: 'text.disabled',
                        display: 'block',
                        mt: 0.25
                      }}
                    >
                      {timestamp}
                    </Typography>
                  </Box>
                }
                secondaryTypographyProps={{
                  component: 'div'
                }}
              />

              {conv.unreadCount > 0 && (
                <Badge
                  badgeContent={conv.unreadCount}
                  color="primary"
                  sx={{
                    ml: 2,
                    '& .MuiBadge-badge': {
                      bgcolor: '#7C4DFF',
                      color: 'white',
                      fontWeight: 700,
                      minWidth: 20,
                      height: 20
                    }
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
        )
      })}
    </List>
    
    {/* Load More Button */}
    {hasMore && !loading && (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography
          variant="body2"
          onClick={() => loadConversations(true)}
          sx={{
            color: '#7C4DFF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            '&:hover': {
              textDecoration: 'underline'
            }
          }}
        >
          {loadingMore ? (
            <>
              <CircularProgress size={16} sx={{ color: '#7C4DFF' }} />
              Loading...
            </>
          ) : (
            'Load more conversations'
          )}
        </Typography>
      </Box>
    )}
  </>
  )
}

