'use client'

import { useState, useEffect, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import { getTierDisplay, getTierStyles } from '@/lib/token-balance'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import SendIcon from '@mui/icons-material/Send'
import CircularProgress from '@mui/material/CircularProgress'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import MessageIcon from '@mui/icons-material/Message'
import BlockIcon from '@mui/icons-material/Block'
import LocalAtmIcon from '@mui/icons-material/LocalAtm'
import ReplyIcon from '@mui/icons-material/Reply'
import CloseIcon from '@mui/icons-material/Close'
import { IconButton, Tooltip, Dialog, Box } from '@mui/material'
import { useMessaging } from '@/lib/MessagingContext'
import { canMessageUser } from '@/lib/messaging'
import { toast } from 'react-hot-toast'
import { UserProfileView } from '@/components/UserProfileView'
import TipModal from '@/components/TipModal'

interface Message {
  id: string
  wallet_address: string
  message_text: string
  token_percentage: number
  holding_tier: string
  reply_to_id: string | null
  created_at: string
  pending?: boolean // For optimistic UI
}

interface ProjectChatProps {
  projectId: string
  tokenMint: string
}

export function ProjectChat({ projectId, tokenMint }: ProjectChatProps) {
  const { publicKey } = useWallet()
  const { openMessages } = useMessaging()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewMessagesIndicator, setShowNewMessagesIndicator] = useState(false)
  const [openingMessageFor, setOpeningMessageFor] = useState<string | null>(null)
  const [showProfileView, setShowProfileView] = useState(false)
  const [selectedProfileWallet, setSelectedProfileWallet] = useState<string | null>(null)
  const [tipModalOpen, setTipModalOpen] = useState(false)
  const [tipRecipient, setTipRecipient] = useState('')
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [oldestMessageDate, setOldestMessageDate] = useState<string | null>(null)
  const [displayNames, setDisplayNames] = useState<Map<string, string>>(new Map())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Check if user is near bottom of chat
  const isNearBottom = () => {
    if (!messagesContainerRef.current) return true
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    return scrollHeight - scrollTop - clientHeight < 100
  }

  // Auto-scroll to bottom when new messages arrive (only if near bottom)
  const scrollToBottom = (force = false) => {
    if (force || isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      setShowNewMessagesIndicator(false)
    } else {
      setShowNewMessagesIndicator(true)
    }
  }

  // Handle scroll events to hide new message indicator
  const handleScroll = () => {
    if (isNearBottom()) {
      setShowNewMessagesIndicator(false)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Auto-dismiss errors after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [error])

  // Load initial messages on mount
  useEffect(() => {
    loadMessages()
  }, [projectId])

  // Subscribe to new messages via Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`chat_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => [...prev, newMsg])
          // Fetch display name for new message sender
          fetchDisplayNames([newMsg.wallet_address])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId])

  // Fetch display names for wallet addresses
  const fetchDisplayNames = async (walletAddresses: string[]) => {
    if (walletAddresses.length === 0) return

    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('wallet_address, display_name')
        .in('wallet_address', walletAddresses)
      
      if (data) {
        setDisplayNames(prev => {
          const newMap = new Map(prev)
          data.forEach(profile => {
            if (profile.display_name) {
              newMap.set(profile.wallet_address, profile.display_name)
            }
          })
          return newMap
        })
      }
    } catch (error) {
      console.error('Error fetching display names:', error)
    }
  }

  async function loadMessages() {
    setIsLoadingMessages(true)
    try {
      // Load last 50 messages (most recent)
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Failed to load messages:', error)
        return
      }

      // Fetch display names for all message senders
      if (data) {
        const uniqueWallets = [...new Set(data.map(msg => msg.wallet_address))]
        await fetchDisplayNames(uniqueWallets)
      }

      const messages = (data || []).reverse() // Reverse to show oldest first
      setMessages(messages)
      
      // Check if there are more messages
      if (messages.length > 0) {
        setOldestMessageDate(messages[0].created_at)
        // Check if there are older messages
        const { count } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .lt('created_at', messages[0].created_at)
        
        setHasMoreMessages((count || 0) > 0)
      } else {
        setHasMoreMessages(false)
      }
    } finally {
      setIsLoadingMessages(false)
    }
  }

  async function loadMoreMessages() {
    if (!oldestMessageDate || loadingMore || !hasMoreMessages) return
    
    setLoadingMore(true)
    try {
      // Load 50 more messages before the oldest one we have
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('project_id', projectId)
        .lt('created_at', oldestMessageDate)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Failed to load more messages:', error)
        return
      }

      if (data && data.length > 0) {
        const olderMessages = data.reverse()
        setMessages(prev => [...olderMessages, ...prev])
        setOldestMessageDate(olderMessages[0].created_at)
        
        // Fetch display names for newly loaded messages
        const uniqueWallets = [...new Set(olderMessages.map(msg => msg.wallet_address))]
        await fetchDisplayNames(uniqueWallets)
        
        // Check if there are even more messages
        const { count } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .lt('created_at', olderMessages[0].created_at)
        
        setHasMoreMessages((count || 0) > 0)
      } else {
        setHasMoreMessages(false)
      }
    } finally {
      setLoadingMore(false)
    }
  }

  async function sendMessage() {
    if (!publicKey || !newMessage.trim()) return
    
    setLoading(true)
    setError(null)

    // Optimistic UI: Add message immediately
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      wallet_address: publicKey.toBase58(),
      message_text: newMessage.trim(),
      token_percentage: 0,
      holding_tier: 'small',
      reply_to_id: replyingTo?.id || null,
      created_at: new Date().toISOString(),
      pending: true
    }

    setMessages(prev => [...prev, optimisticMessage])
    const messageToSend = newMessage
    const replyToId = replyingTo?.id || null
    setNewMessage('')
    setReplyingTo(null) // Clear reply state
    scrollToBottom(true)

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          walletAddress: publicKey.toBase58(),
          messageText: messageToSend,
          tokenMint,
          replyToId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id))
        setError(data.error || 'Failed to send message')
        setNewMessage(messageToSend) // Restore message text
        setReplyingTo(replyToId ? messages.find(m => m.id === replyToId) || null : null) // Restore reply state
        return
      }

      // Replace optimistic message with real one from realtime
      // (Realtime will handle adding the actual message)
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id))
      
    } catch (err) {
      console.error('Send error:', err)
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id))
      setError('Failed to send message')
      setNewMessage(messageToSend)
      setReplyingTo(replyToId ? messages.find(m => m.id === replyToId) || null : null)
    } finally {
      setLoading(false)
    }
  }

  function formatAddress(address: string) {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  function getDisplayName(address: string): string {
    return displayNames.get(address) || formatAddress(address)
  }

  function formatTimestamp(timestamp: string) {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)
    
    if (diffMinutes < 1) return 'just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    return date.toLocaleDateString()
  }

  // Handle opening direct message with user
  async function handleOpenMessage(targetWallet: string) {
    if (!publicKey) {
      toast.error('Please connect your wallet to send messages')
      return
    }

    if (targetWallet === publicKey.toBase58()) {
      toast.error('Cannot message yourself')
      return
    }

    setOpeningMessageFor(targetWallet)

    try {
      // Check if user can be messaged
      const result = await canMessageUser(publicKey.toBase58(), targetWallet, projectId)
      
      if (!result.canMessage) {
        toast.error(result.reason || 'Cannot message this user')
        return
      }

      // Open messages sidebar
      await openMessages(targetWallet)
    } catch (error) {
      console.error('Error opening message:', error)
      toast.error('Failed to open message')
    } finally {
      setOpeningMessageFor(null)
    }
  }

  return (
    <Card className="h-[500px] flex flex-col relative overflow-hidden">
      {/* Header - Enhanced */}
      <div className="bg-gradient-to-r from-accent-primary to-purple-600 p-3 shadow-md">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xl">💬</span>
          <h3 className="font-display text-lg font-bold text-white">
            Holder Chat
          </h3>
          <span className="ml-auto bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2 py-0.5 rounded-full">
            Live
          </span>
        </div>
        <p className="font-body text-xs text-white/90 ml-9">
          {publicKey ? 'Chat with other token holders in real-time' : 'Connect your wallet to join the conversation'}
        </p>
      </div>
      
      <CardContent className="p-3 flex-1 flex flex-col min-h-0">
        {/* Messages Container */}
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto space-y-1.5 mb-3"
          style={{ 
            overflowY: 'scroll',
            WebkitOverflowScrolling: 'touch',
            height: '100%',
            minHeight: 0
          }}
        >
          {/* Load More Button */}
          {hasMoreMessages && !isLoadingMessages && (
            <div className="text-center py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMoreMessages}
                disabled={loadingMore}
                className="text-xs"
              >
                {loadingMore ? (
                  <>
                    <CircularProgress size={14} className="mr-2" />
                    Loading...
                  </>
                ) : (
                  '↑ Load older messages'
                )}
              </Button>
            </div>
          )}
          {isLoadingMessages ? (
            // Skeleton loading placeholders
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-2.5 rounded-lg border border-border-subtle bg-subtle-bg animate-pulse">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-4 h-4 bg-gray-300 rounded"></div>
                    <div className="w-20 h-3 bg-gray-300 rounded"></div>
                    <div className="w-12 h-3 bg-gray-300 rounded"></div>
                  </div>
                  <div className="w-3/4 h-3 bg-gray-300 rounded"></div>
                </div>
              ))}
              <div className="text-center py-3">
                <CircularProgress size={24} />
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-text-muted font-body">
              No messages yet. Be the first to chat!
            </div>
          ) : (
            messages.map((msg) => {
              const tierDisplay = getTierDisplay(msg.holding_tier)
              const tierStyles = getTierStyles(msg.holding_tier)
              const isOwnMessage = msg.wallet_address === publicKey?.toBase58()
              
              return (
                <div
                  key={msg.id}
                  className={`p-2.5 rounded-lg ${tierStyles.border} ${tierStyles.bg} ${
                    msg.pending ? 'opacity-60' : ''
                  }`}
                >
                  {/* Reply indicator (if this is a reply) */}
                  {msg.reply_to_id && (() => {
                    const repliedToMsg = messages.find(m => m.id === msg.reply_to_id)
                    if (repliedToMsg) {
                      return (
                        <div className="mb-1.5 pl-2 border-l-2 border-purple-400">
                          <div className="flex items-center gap-1 text-xs text-text-muted mb-0.5">
                            <ReplyIcon sx={{ fontSize: 10 }} />
                            <span className="text-[10px]">Replying to {getDisplayName(repliedToMsg.wallet_address)}</span>
                          </div>
                          <p className="text-xs text-text-muted italic truncate">
                            {repliedToMsg.message_text}
                          </p>
                        </div>
                      )
                    }
                    return null
                  })()}

                  {/* Username and timestamp row */}
                  <div className="flex items-center justify-between mb-0.5">
                    <div className={`flex items-center gap-1 md:gap-2 ${tierStyles.text} font-medium text-sm`}>
                      <span className="text-base md:text-lg">{tierDisplay.emoji}</span>
                      <span 
                        className="text-xs md:text-sm cursor-pointer hover:text-purple-600 underline decoration-dotted transition-colors"
                        onClick={() => {
                          setSelectedProfileWallet(msg.wallet_address)
                          setShowProfileView(true)
                        }}
                        title="View profile"
                        style={{ fontFamily: displayNames.has(msg.wallet_address) ? 'inherit' : 'monospace' }}
                      >
                        {getDisplayName(msg.wallet_address)}
                      </span>
                      <span className="text-xs">•</span>
                      <span className="text-xs">{msg.token_percentage.toFixed(3)}%</span>
                      
                      {/* Message Icon (always visible, not for own messages) */}
                      {!isOwnMessage && (
                        <>
                          <Tooltip 
                            title="Send direct message"
                            arrow
                            placement="top"
                          >
                            <IconButton
                              size="small"
                              onClick={() => handleOpenMessage(msg.wallet_address)}
                              disabled={openingMessageFor === msg.wallet_address}
                              sx={{
                                p: 0.5,
                                ml: 0.5,
                                color: '#7C4DFF',
                                '&:hover': { 
                                  bgcolor: 'rgba(124, 77, 255, 0.1)',
                                  boxShadow: '0 0 8px rgba(124, 77, 255, 0.4)' // Purple glow
                                },
                                transition: 'all 0.2s ease-in-out',
                                '&:disabled': {
                                  color: '#9E9E9E'
                                }
                              }}
                            >
                              {openingMessageFor === msg.wallet_address ? (
                                <CircularProgress size={14} sx={{ color: '#7C4DFF' }} />
                              ) : (
                                <MessageIcon sx={{ fontSize: 14 }} />
                              )}
                            </IconButton>
                          </Tooltip>
                          
                          {/* Tip Icon */}
                          <Tooltip 
                            title="Send tip"
                            arrow
                            placement="top"
                          >
                            <IconButton
                              size="small"
                              onClick={() => {
                                setTipRecipient(msg.wallet_address)
                                setTipModalOpen(true)
                              }}
                              sx={{
                                p: 0.5,
                                ml: 0.5,
                                color: '#36C170',
                                '&:hover': { 
                                  bgcolor: 'rgba(54, 193, 112, 0.1)',
                                  boxShadow: '0 0 8px rgba(54, 193, 112, 0.4)' // Green glow
                                },
                                transition: 'all 0.2s ease-in-out'
                              }}
                            >
                              <LocalAtmIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {msg.pending && (
                        <CircularProgress size={10} className="text-text-muted" />
                      )}
                      <span className="text-xs text-text-muted">
                        {msg.pending ? 'sending...' : formatTimestamp(msg.created_at)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Message text */}
                  <p className="font-body text-sm text-text-primary mb-1">
                    {msg.message_text}
                  </p>

                  {/* Reply button (for logged-in users) */}
                  {publicKey && !msg.pending && (
                    <div className="flex justify-end -mb-1">
                      <Tooltip title="Reply to this message" arrow placement="top">
                        <IconButton
                          size="small"
                          onClick={() => setReplyingTo(msg)}
                          sx={{
                            p: 0.25,
                            color: '#7C4DFF',
                            '&:hover': { 
                              bgcolor: 'rgba(124, 77, 255, 0.1)',
                            },
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          <ReplyIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Tooltip>
                    </div>
                  )}
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* New Messages Indicator */}
        {showNewMessagesIndicator && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-accent-primary text-white px-4 py-2 rounded-full shadow-lg hover:bg-accent-primary-hover transition-all flex items-center gap-2 font-body text-sm font-medium z-10"
          >
            New messages
            <KeyboardArrowDownIcon fontSize="small" />
          </button>
        )}

        {/* Input Area */}
        {publicKey ? (
          <div>
            {/* Replying To Indicator */}
            {replyingTo && (
              <div 
                className="mb-2 p-2 rounded-lg flex items-start justify-between"
                style={{ backgroundColor: '#F8F5FF', borderLeft: '3px solid #7C4DFF' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    <ReplyIcon sx={{ fontSize: 14, color: '#7C4DFF' }} />
                    <span className="text-xs font-medium" style={{ color: '#7C4DFF' }}>
                      Replying to {formatAddress(replyingTo.wallet_address)}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted truncate">
                    {replyingTo.message_text}
                  </p>
                </div>
                <IconButton
                  size="small"
                  onClick={() => setReplyingTo(null)}
                  sx={{
                    ml: 1,
                    p: 0.5,
                    color: '#6F7280',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' }
                  }}
                >
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value.slice(0, 500))}
                onKeyPress={(e) => e.key === 'Enter' && !loading && sendMessage()}
                placeholder={replyingTo ? "Type your reply..." : "Type your message..."}
                className="flex-1 px-4 py-2 border border-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary font-body"
                disabled={loading}
              />
              <Button
                onClick={sendMessage}
                disabled={loading || !newMessage.trim()}
                variant="primary"
              >
                {loading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <SendIcon fontSize="small" />
                )}
              </Button>
            </div>

            {/* Character counter */}
            {newMessage && (
              <div className="mt-1 text-xs text-text-muted text-right">
                {newMessage.length}/500
              </div>
            )}

            {/* Error message with auto-dismiss animation */}
            {error && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 animate-pulse">
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-text-secondary font-body">
            Connect your wallet to join the chat
          </div>
        )}
      </CardContent>

      {/* Profile View Modal */}
      {selectedProfileWallet && (
        <Dialog
          open={showProfileView}
          onClose={(event, reason) => {
            // Stop propagation when clicking backdrop to prevent click-through
            if (reason === 'backdropClick' && event) {
              event.stopPropagation()
            }
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
            onClick: (e) => e.stopPropagation(), // Additional safety layer
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
              currentUserWallet={publicKey?.toString()}
              projectId={projectId}
              tokenMint={tokenMint}
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

      {/* Tip Modal */}
      <TipModal
        open={tipModalOpen}
        onClose={() => setTipModalOpen(false)}
        recipientWallet={tipRecipient}
        projectId={projectId}
        tokenMint={tokenMint}
      />
    </Card>
  )
}

