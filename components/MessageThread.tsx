'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import { markConversationAsRead } from '@/lib/messaging'
import { UserProfileView } from '@/components/UserProfileView'
import { 
  format, 
  isToday, 
  isYesterday, 
  isSameDay,
  parseISO 
} from 'date-fns'
import {
  Box,
  Avatar,
  Typography,
  IconButton,
  Button,
  CircularProgress,
  Tooltip,
  Badge
} from '@mui/material'
import DoneIcon from '@mui/icons-material/Done'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import PersonIcon from '@mui/icons-material/Person'

type Message = Database['public']['Tables']['messages']['Row']
type UserProfile = Database['public']['Tables']['user_profiles']['Row']

interface MessageThreadProps {
  conversationId: string
  currentWallet: string
  recipientWallet: string
}

interface GroupedMessages {
  date: string
  messages: Message[]
}

export function MessageThread({
  conversationId,
  currentWallet,
  recipientWallet
}: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [recipientProfile, setRecipientProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [showProfileView, setShowProfileView] = useState(false)
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  
  const MESSAGES_PER_PAGE = 50

  // Scroll to bottom
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: smooth ? 'smooth' : 'auto' 
    })
  }

  // Format address helper
  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  // Check if user is online (within last 5 minutes)
  const isOnline = (lastSeenAt: string | null): boolean => {
    if (!lastSeenAt) return false
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    return new Date(lastSeenAt).getTime() > fiveMinutesAgo
  }

  // Group messages by date
  const groupMessagesByDate = (msgs: Message[]): GroupedMessages[] => {
    const groups: { [key: string]: Message[] } = {}
    
    msgs.forEach(msg => {
      const date = format(parseISO(msg.created_at), 'yyyy-MM-dd')
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(msg)
    })
    
    return Object.keys(groups)
      .sort()
      .map(date => ({
        date,
        messages: groups[date]
      }))
  }

  // Format date label
  const formatDateLabel = (dateStr: string): string => {
    const date = parseISO(dateStr)
    
    if (isToday(date)) return 'Today'
    if (isYesterday(date)) return 'Yesterday'
    
    return format(date, 'MMMM d, yyyy')
  }

  // Format time for hover
  const formatTime = (timestamp: string): string => {
    return format(parseISO(timestamp), 'HH:mm')
  }

  // Load messages
  const loadMessages = useCallback(async (offset = 0) => {
    if (offset === 0) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .range(offset, offset + MESSAGES_PER_PAGE - 1)

      if (error) {
        console.error('Error fetching messages:', error)
        return
      }

      if (!data || data.length < MESSAGES_PER_PAGE) {
        setHasMore(false)
      }

      if (offset === 0) {
        setMessages(data?.reverse() || [])
        // Scroll to bottom on initial load
        setTimeout(() => scrollToBottom(false), 100)
      } else {
        // Prepend older messages
        setMessages(prev => [...(data?.reverse() || []), ...prev])
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [conversationId])

  // Load recipient profile
  useEffect(() => {
    const loadRecipientProfile = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('wallet_address', recipientWallet)
        .maybeSingle()
      
      setRecipientProfile(data)
    }
    
    loadRecipientProfile()
  }, [recipientWallet])

  // Initial load
  useEffect(() => {
    loadMessages()
    
    // Mark conversation as read
    markConversationAsRead(conversationId, currentWallet)
  }, [conversationId, currentWallet, loadMessages])

  // Real-time subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel(`message_thread_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMessage = payload.new as Message
          setMessages(prev => [...prev, newMessage])
          
          // Mark as read if not from current user
          if (newMessage.sender_wallet !== currentWallet) {
            markConversationAsRead(conversationId, currentWallet)
          }
          
          // Auto-scroll to bottom
          setTimeout(() => scrollToBottom(true), 100)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const updatedMessage = payload.new as Message
          setMessages(prev => 
            prev.map(msg => 
              msg.id === updatedMessage.id ? updatedMessage : msg
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, currentWallet])

  // Subscribe to typing indicators
  useEffect(() => {
    const channel = supabase
      .channel(`typing_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          if (payload.new && (payload.new as any).wallet_address === recipientWallet) {
            const lastTypedAt = new Date((payload.new as any).last_typed_at).getTime()
            const now = Date.now()
            
            // Show typing indicator if typed within last 3 seconds
            if (now - lastTypedAt < 3000) {
              setIsTyping(true)
              
              // Clear existing timeout
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
              }
              
              // Hide typing indicator after 3 seconds
              typingTimeoutRef.current = setTimeout(() => {
                setIsTyping(false)
              }, 3000)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [conversationId, recipientWallet])

  // Subscribe to real-time profile updates
  useEffect(() => {
    const channel = supabase
      .channel(`profile_${recipientWallet}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `wallet_address=eq.${recipientWallet}`
        },
        (payload) => {
          setRecipientProfile(payload.new as UserProfile)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [recipientWallet])

  // Load more messages
  const handleLoadMore = () => {
    loadMessages(messages.length)
  }

  // Handle message for user profile
  const handleMessage = () => {
    setShowProfileView(false)
    // Already in message thread, just close profile
  }

  const displayName = recipientProfile?.display_name || formatAddress(recipientWallet)
  const online = isOnline(recipientProfile?.last_seen_at || null)
  const groupedMessages = groupMessagesByDate(messages)

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <>
      {/* Message Thread */}
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Recipient Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <IconButton
            onClick={() => setShowProfileView(true)}
            sx={{ p: 0 }}
          >
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              variant="dot"
              sx={{
                '& .MuiBadge-badge': {
                  backgroundColor: online ? '#44b700' : '#9E9E9E',
                  boxShadow: '0 0 0 2px #fff',
                  width: 12,
                  height: 12,
                  borderRadius: '50%'
                }
              }}
            >
              <Avatar
                src={recipientProfile?.avatar_url || undefined}
                sx={{ 
                  width: 48, 
                  height: 48,
                  bgcolor: '#7C4DFF',
                  cursor: 'pointer'
                }}
              >
                {recipientProfile?.avatar_url ? null : <PersonIcon />}
              </Avatar>
            </Badge>
          </IconButton>

          <Box sx={{ flex: 1, cursor: 'pointer' }} onClick={() => setShowProfileView(true)}>
            <Typography variant="subtitle1" fontWeight={600}>
              {displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {isTyping ? (
                <span style={{ color: '#7C4DFF', fontStyle: 'italic' }}>
                  typing...
                </span>
              ) : online ? (
                'Online'
              ) : (
                'Offline'
              )}
            </Typography>
          </Box>
        </Box>

        {/* Messages Container */}
        <Box
          ref={messagesContainerRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: 2,
            bgcolor: '#F5F5F5',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Load More Button */}
          {hasMore && messages.length >= MESSAGES_PER_PAGE && (
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Button
                onClick={handleLoadMore}
                disabled={loadingMore}
                variant="text"
                size="small"
                sx={{ 
                  textTransform: 'none',
                  color: '#7C4DFF'
                }}
              >
                {loadingMore ? (
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                ) : null}
                Load older messages
              </Button>
            </Box>
          )}

          {/* Messages grouped by date */}
          {groupedMessages.map(group => (
            <Box key={group.date}>
              {/* Date Divider */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  my: 2
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    bgcolor: 'rgba(0, 0, 0, 0.1)',
                    px: 2,
                    py: 0.5,
                    borderRadius: 2,
                    color: 'text.secondary',
                    fontWeight: 500
                  }}
                >
                  {formatDateLabel(group.date)}
                </Typography>
              </Box>

              {/* Messages for this date */}
              {group.messages.map((msg, index) => {
                const isSent = msg.sender_wallet === currentWallet
                const showTime = hoveredMessageId === msg.id

                return (
                  <Box
                    key={msg.id}
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                    sx={{
                      display: 'flex',
                      justifyContent: isSent ? 'flex-end' : 'flex-start',
                      mb: 1.5,
                      alignItems: 'flex-end',
                      gap: 0.5
                    }}
                  >
                    {/* Message Bubble */}
                    <Tooltip 
                      title={formatTime(msg.created_at)}
                      placement={isSent ? 'left' : 'right'}
                      open={showTime}
                    >
                      <Box
                        sx={{
                          maxWidth: '70%',
                          bgcolor: isSent ? '#7C4DFF' : '#2A2A2A',
                          color: '#FFFFFF',
                          px: 2,
                          py: 1.5,
                          borderRadius: 2,
                          borderTopRightRadius: isSent ? 0 : 2,
                          borderTopLeftRadius: isSent ? 2 : 0,
                          wordWrap: 'break-word',
                          position: 'relative'
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ 
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}
                        >
                          {msg.content}
                        </Typography>
                      </Box>
                    </Tooltip>

                    {/* Read Receipt for sent messages */}
                    {isSent && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        {msg.is_read ? (
                          <Tooltip title="Read">
                            <DoneAllIcon 
                              sx={{ 
                                fontSize: 16, 
                                color: '#7C4DFF' 
                              }} 
                            />
                          </Tooltip>
                        ) : (
                          <Tooltip title="Sent">
                            <DoneIcon 
                              sx={{ 
                                fontSize: 16, 
                                color: 'text.secondary' 
                              }} 
                            />
                          </Tooltip>
                        )}
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Box>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-start',
                mb: 1.5
              }}
            >
              <Box
                sx={{
                  bgcolor: '#2A2A2A',
                  color: '#FFFFFF',
                  px: 2,
                  py: 1.5,
                  borderRadius: 2,
                  borderTopLeftRadius: 0,
                  display: 'flex',
                  gap: 0.5,
                  alignItems: 'center'
                }}
              >
                <Box
                  component="span"
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'rgba(255, 255, 255, 0.6)',
                    animation: 'typing 1.4s infinite',
                    '@keyframes typing': {
                      '0%, 60%, 100%': { opacity: 0.3 },
                      '30%': { opacity: 1 }
                    }
                  }}
                />
                <Box
                  component="span"
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'rgba(255, 255, 255, 0.6)',
                    animation: 'typing 1.4s infinite 0.2s',
                    '@keyframes typing': {
                      '0%, 60%, 100%': { opacity: 0.3 },
                      '30%': { opacity: 1 }
                    }
                  }}
                />
                <Box
                  component="span"
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'rgba(255, 255, 255, 0.6)',
                    animation: 'typing 1.4s infinite 0.4s',
                    '@keyframes typing': {
                      '0%, 60%, 100%': { opacity: 0.3 },
                      '30%': { opacity: 1 }
                    }
                  }}
                />
              </Box>
            </Box>
          )}

          {/* Empty state */}
          {messages.length === 0 && (
            <Box
              sx={{
                textAlign: 'center',
                py: 8,
                color: 'text.secondary'
              }}
            >
              <Typography variant="body2">
                No messages yet. Start the conversation!
              </Typography>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Box>
      </Box>

      {/* User Profile Modal */}
      {showProfileView && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
            p: 2,
            overflow: 'auto'
          }}
          onClick={() => setShowProfileView(false)}
        >
          <Box onClick={(e) => e.stopPropagation()}>
            <UserProfileView
              walletAddress={recipientWallet}
              currentUserWallet={currentWallet}
              onClose={() => setShowProfileView(false)}
              onMessage={handleMessage}
            />
          </Box>
        </Box>
      )}
    </>
  )
}

