'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
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
  CircularProgress
} from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import DeleteIcon from '@mui/icons-material/Delete'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'

type Message = Database['public']['Tables']['messages']['Row']
type Conversation = Database['public']['Tables']['conversations']['Row']
type UserProfile = Database['public']['Tables']['user_profiles']['Row']

interface ConversationWithDetails extends Conversation {
  lastMessage?: Message
  otherParticipant?: UserProfile
  unreadCount: number
  isUnread: boolean
}

interface ConversationListProps {
  currentWallet: string
  onSelectConversation: (conversationId: string) => void
}

export function ConversationList({ 
  currentWallet, 
  onSelectConversation 
}: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null)

  // Load conversations with all details
  const loadConversations = useCallback(async () => {
    if (!currentWallet) return

    try {
      // 1. Fetch all conversations for current user
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1.eq.${currentWallet},participant_2.eq.${currentWallet}`)
        .order('last_message_at', { ascending: false })

      if (convError) {
        console.error('Error fetching conversations:', convError)
        return
      }

      if (!convData || convData.length === 0) {
        setConversations([])
        return
      }

      // 2. Fetch details for each conversation
      const conversationsWithDetails = await Promise.all(
        convData.map(async (conv) => {
          // Get other participant's wallet address
          const otherWallet = 
            conv.participant_1 === currentWallet 
              ? conv.participant_2 
              : conv.participant_1

          // Fetch other participant's profile
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('wallet_address', otherWallet)
            .maybeSingle()

          // Fetch last message
          const { data: lastMessageData } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          // Count unread messages (messages from other person)
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('sender_wallet', otherWallet)
            .eq('is_read', false)

          return {
            ...conv,
            lastMessage: lastMessageData || undefined,
            otherParticipant: profileData || undefined,
            unreadCount: unreadCount || 0,
            isUnread: (unreadCount || 0) > 0
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

      setConversations(sorted)
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoading(false)
    }
  }, [currentWallet])

  // Initial load
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

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

  // Delete conversation handler
  const handleDeleteConversation = async (
    e: React.MouseEvent, 
    conversationId: string
  ) => {
    e.stopPropagation()
    
    if (!confirm('Delete this conversation? This cannot be undone.')) {
      return
    }

    try {
      // Delete all messages first
      await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId)

      // Delete conversation
      await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)

      // Update local state
      setConversations(prev => prev.filter(c => c.id !== conversationId))
    } catch (error) {
      console.error('Error deleting conversation:', error)
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

  // Empty state
  if (conversations.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          px: 3
        }}
      >
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No messages yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Start a conversation by visiting a user's profile!
        </Typography>
      </Box>
    )
  }

  // Conversations list
  return (
    <List sx={{ width: '100%', bgcolor: 'background.paper', p: 0 }}>
      {conversations.map((conv) => {
        const displayName = getDisplayName(conv)
        const lastMessagePreview = conv.lastMessage
          ? truncateMessage(conv.lastMessage.content)
          : 'No messages yet'
        const timestamp = conv.lastMessage
          ? formatTimestamp(conv.lastMessage.created_at)
          : ''
        const isOnline = conv.otherParticipant?.is_online || false

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
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  variant="dot"
                  sx={{
                    '& .MuiBadge-badge': {
                      backgroundColor: isOnline ? '#44b700' : 'transparent',
                      color: isOnline ? '#44b700' : 'transparent',
                      boxShadow: `0 0 0 2px ${isOnline ? '#fff' : 'transparent'}`,
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
              </ListItemAvatar>

              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
  )
}

