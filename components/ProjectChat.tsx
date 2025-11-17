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

interface Message {
  id: string
  wallet_address: string
  message_text: string
  token_percentage: number
  holding_tier: string
  created_at: string
  pending?: boolean // For optimistic UI
}

interface ProjectChatProps {
  projectId: string
  tokenMint: string
}

export function ProjectChat({ projectId, tokenMint }: ProjectChatProps) {
  const { publicKey } = useWallet()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewMessagesIndicator, setShowNewMessagesIndicator] = useState(false)
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
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId])

  async function loadMessages() {
    setIsLoadingMessages(true)
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
        .limit(100) // Load last 100 messages

      if (error) {
        console.error('Failed to load messages:', error)
        return
      }

      setMessages(data || [])
    } finally {
      setIsLoadingMessages(false)
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
      created_at: new Date().toISOString(),
      pending: true
    }

    setMessages(prev => [...prev, optimisticMessage])
    const messageToSend = newMessage
    setNewMessage('')
    scrollToBottom(true)

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          walletAddress: publicKey.toBase58(),
          messageText: messageToSend,
          tokenMint
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id))
        setError(data.error || 'Failed to send message')
        setNewMessage(messageToSend) // Restore message text
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
    } finally {
      setLoading(false)
    }
  }

  function formatAddress(address: string) {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
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

  return (
    <Card className="h-[400px] md:h-[600px] flex flex-col relative">
      <CardContent className="p-4 flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border-subtle pb-3 mb-4">
          <h3 className="font-display text-lg font-semibold text-text-primary">
            Holder Chat
          </h3>
          <p className="font-body text-sm text-text-secondary">
            {publicKey ? 'Any holder can chat' : 'Connect wallet to chat'}
          </p>
        </div>

        {/* Messages Container */}
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto space-y-3 mb-4"
        >
          {isLoadingMessages ? (
            // Skeleton loading placeholders
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 rounded-lg border border-border-subtle bg-subtle-bg animate-pulse">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 bg-gray-300 rounded"></div>
                    <div className="w-20 h-3 bg-gray-300 rounded"></div>
                    <div className="w-12 h-3 bg-gray-300 rounded"></div>
                  </div>
                  <div className="w-3/4 h-3 bg-gray-300 rounded"></div>
                </div>
              ))}
              <div className="text-center py-4">
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
              
              return (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg ${tierStyles.border} ${tierStyles.bg} ${
                    msg.pending ? 'opacity-60' : ''
                  }`}
                >
                  {/* Username and timestamp row */}
                  <div className="flex items-center justify-between mb-1">
                    <div className={`flex items-center gap-1 md:gap-2 ${tierStyles.text} font-medium text-sm`}>
                      <span className="text-base md:text-lg">{tierDisplay.emoji}</span>
                      <span className="text-xs md:text-sm">{formatAddress(msg.wallet_address)}</span>
                      <span className="text-xs">•</span>
                      <span className="text-xs">{msg.token_percentage.toFixed(3)}%</span>
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
                  <p className="font-body text-sm text-text-primary">
                    {msg.message_text}
                  </p>
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
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value.slice(0, 500))}
                onKeyPress={(e) => e.key === 'Enter' && !loading && sendMessage()}
                placeholder="Type your message..."
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
    </Card>
  )
}

