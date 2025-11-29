'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { canMessageUser } from '@/lib/messaging'
import { toast } from 'react-hot-toast'
import { notificationService } from '@/lib/services/notificationService'
import {
  Box,
  TextField,
  IconButton,
  CircularProgress,
  Tooltip,
  Typography
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn'
import dynamic from 'next/dynamic'

const TipModal = dynamic(() => import('@/components/TipModal'), { ssr: false })

interface MessageComposerProps {
  conversationId: string
  senderWallet: string
  recipientWallet: string
  projectId?: string
  onMessageSent?: () => void
}

interface RateLimitState {
  count: number
  resetTime: number
}

const MAX_CHARS = 5000
const SHOW_COUNTER_THRESHOLD = 4500
const TYPING_DEBOUNCE_MS = 300
const TYPING_INDICATOR_TIMEOUT_MS = 3000
const RATE_LIMIT_MAX = 10 // messages per minute
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute

export function MessageComposer({
  conversationId,
  senderWallet,
  recipientWallet,
  projectId,
  onMessageSent
}: MessageComposerProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [canSend, setCanSend] = useState(true)
  const [blockReason, setBlockReason] = useState<string>()
  const [showTipModal, setShowTipModal] = useState(false)
  const [rateLimit, setRateLimit] = useState<RateLimitState>({
    count: 0,
    resetTime: Date.now() + RATE_LIMIT_WINDOW_MS
  })

  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  const typingIndicatorTimeoutRef = useRef<NodeJS.Timeout>()
  const textFieldRef = useRef<HTMLTextAreaElement>(null)

  // Check if user can send messages
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const result = await canMessageUser(
          senderWallet,
          recipientWallet
        )
        
        setCanSend(result.canMessage)
        setBlockReason(result.reason)
      } catch (error) {
        console.error('Error checking message permissions:', error)
        setCanSend(false)
        setBlockReason('Error checking permissions')
      }
    }
    
    checkPermissions()
  }, [senderWallet, recipientWallet])

  // Update typing indicator
  const updateTypingIndicator = useCallback(async () => {
    try {
      await supabase
        .from('typing_indicators')
        .upsert({
          conversation_id: conversationId,
          wallet_address: senderWallet,
          last_typed_at: new Date().toISOString()
        }, {
          onConflict: 'conversation_id,wallet_address'
        })
    } catch (error) {
      console.error('Error updating typing indicator:', error)
    }
  }, [conversationId, senderWallet])

  // Clear typing indicator
  const clearTypingIndicator = useCallback(async () => {
    try {
      await supabase
        .from('typing_indicators')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('wallet_address', senderWallet)
    } catch (error) {
      console.error('Error clearing typing indicator:', error)
    }
  }, [conversationId, senderWallet])

  // Handle typing with debounce
  const handleTyping = useCallback(() => {
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    // Clear existing indicator timeout
    if (typingIndicatorTimeoutRef.current) {
      clearTimeout(typingIndicatorTimeoutRef.current)
    }

    // Debounce typing indicator update
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingIndicator()
    }, TYPING_DEBOUNCE_MS)

    // Auto-clear typing indicator after inactivity
    typingIndicatorTimeoutRef.current = setTimeout(() => {
      clearTypingIndicator()
    }, TYPING_INDICATOR_TIMEOUT_MS)
  }, [updateTypingIndicator, clearTypingIndicator])

  // Handle text change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value

    // Enforce character limit
    if (newValue.length > MAX_CHARS) {
      toast.error(`Message cannot exceed ${MAX_CHARS} characters`)
      return
    }

    setMessage(newValue)
    
    // Trigger typing indicator
    if (newValue.length > 0) {
      handleTyping()
    }
  }

  // Check rate limit
  const checkRateLimit = (): boolean => {
    const now = Date.now()
    
    // Reset if window expired
    if (now > rateLimit.resetTime) {
      setRateLimit({
        count: 0,
        resetTime: now + RATE_LIMIT_WINDOW_MS
      })
      return true
    }
    
    // Check if exceeded
    if (rateLimit.count >= RATE_LIMIT_MAX) {
      const remainingSeconds = Math.ceil((rateLimit.resetTime - now) / 1000)
      toast.error(`Rate limit exceeded. Try again in ${remainingSeconds} seconds`)
      return false
    }
    
    return true
  }

  // Send message
  const sendMessage = async () => {
    // Trim message
    const trimmedMessage = message.trim()
    
    // Validate not empty
    if (!trimmedMessage) {
      return
    }

    // Check permissions
    if (!canSend) {
      toast.error(blockReason || 'Cannot send message to this user')
      return
    }

    // Check rate limit
    if (!checkRateLimit()) {
      return
    }

    setSending(true)

    try {
      // 1. Insert message to messages table
      const { data: newMessage, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_wallet: senderWallet,
          content: trimmedMessage,
          is_read: false
        })
        .select()
        .single()

      if (messageError) {
        console.error('Error inserting message:', messageError)
        toast.error('Failed to send message')
        return
      }

      // 2. Create database notification record (HIGH PRIORITY - triggers browser notification)
      try {
        // Check recipient's notification preferences
        const { data: recipientProfile } = await supabase
          .from('user_profiles')
          .select('notification_enabled')
          .eq('wallet_address', recipientWallet)
          .maybeSingle()

        // Only create notification if recipient has notifications enabled (default: true)
        if (recipientProfile?.notification_enabled !== false) {
          await notificationService.createNotification({
            userWallet: recipientWallet,
            type: 'message_received',
            actorWallet: senderWallet,
            referenceId: newMessage.id,
            referenceType: 'message',
            metadata: {
              message_preview: trimmedMessage.slice(0, 100),
              conversation_id: conversationId
            }
          })
          console.log('🔔 Message notification created successfully')
        } else {
          console.log('📵 Recipient has notifications disabled')
        }
      } catch (notificationError) {
        console.error('Failed to create message notification:', notificationError)
        // Don't fail the message if notification fails
      }

      // 3. Update conversation.last_message_at
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)

      if (updateError) {
        console.error('Error updating conversation:', updateError)
        // Don't show error to user since message was sent
      }

      // 4. Clear input field
      setMessage('')

      // 5. Update rate limit
      setRateLimit(prev => ({
        ...prev,
        count: prev.count + 1
      }))

      // 6. Send typing indicator stop signal
      await clearTypingIndicator()

      // 7. Call callback
      if (onMessageSent) {
        onMessageSent()
      }

      // Focus back on input
      textFieldRef.current?.focus()

    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Enter without Shift sends message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!sending && message.trim()) {
        sendMessage()
      }
    }
    // Shift+Enter adds new line (default behavior)
  }

  // Clean up typing indicator on unmount
  useEffect(() => {
    return () => {
      clearTypingIndicator()
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      
      if (typingIndicatorTimeoutRef.current) {
        clearTimeout(typingIndicatorTimeoutRef.current)
      }
    }
  }, [clearTypingIndicator])

  const showCharCounter = message.length > SHOW_COUNTER_THRESHOLD
  const isDisabled = !canSend || sending || !message.trim()
  const charCountColor = message.length >= MAX_CHARS ? 'error.main' : 'text.secondary'

  const handleTipClick = () => {
    setShowTipModal(true)
  }

  const handleCloseTipModal = () => {
    setShowTipModal(false)
  }

  return (
    <>
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          p: 2,
          display: 'flex',
          gap: 1,
          alignItems: 'flex-end'
        }}
      >
        {/* Tipping Button - Always available */}
        <Tooltip
          title="Send a tip"
          arrow
        >
          <span>
            <IconButton
              onClick={handleTipClick}
              sx={{
                bgcolor: '#10B981',
                color: 'white',
                width: 48,
                height: 48,
                '&:hover': {
                  bgcolor: '#059669'
                }
              }}
            >
              <MonetizationOnIcon />
            </IconButton>
          </span>
        </Tooltip>

      {/* Text Input */}
      <TextField
        inputRef={textFieldRef}
        multiline
        maxRows={5}
        fullWidth
        placeholder="Type your message..."
        value={message}
        onChange={handleChange}
        onKeyDown={handleKeyPress}
        disabled={sending || !canSend}
        variant="outlined"
        size="small"
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            bgcolor: 'background.paper',
            '&:hover fieldset': {
              borderColor: '#7C4DFF'
            },
            '&.Mui-focused fieldset': {
              borderColor: '#7C4DFF',
              borderWidth: 2
            },
            '&.Mui-disabled': {
              bgcolor: 'action.disabledBackground'
            }
          }
        }}
        helperText={
          showCharCounter ? (
            <Box 
              component="span" 
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>
                {!canSend && blockReason && (
                  <Typography variant="caption" color="error">
                    {blockReason}
                  </Typography>
                )}
              </span>
              <Typography 
                variant="caption" 
                sx={{ color: charCountColor }}
              >
                {message.length}/{MAX_CHARS}
              </Typography>
            </Box>
          ) : !canSend && blockReason ? (
            <Typography variant="caption" color="error">
              {blockReason}
            </Typography>
          ) : null
        }
        FormHelperTextProps={{
          sx: { mx: 0, display: 'flex', justifyContent: 'space-between' }
        }}
      />

      {/* Send Button */}
      <Tooltip
        title={
          !canSend
            ? blockReason || 'Cannot send message'
            : !message.trim()
            ? 'Type a message to send'
            : sending
            ? 'Sending...'
            : 'Send message (Enter)'
        }
        arrow
      >
        <span>
          <IconButton
            onClick={sendMessage}
            disabled={isDisabled}
            sx={{
              bgcolor: '#7C4DFF',
              color: 'white',
              width: 48,
              height: 48,
              '&:hover': {
                bgcolor: '#6C3FEF'
              },
              '&:disabled': {
                bgcolor: 'action.disabledBackground',
                color: 'action.disabled'
              }
            }}
          >
            {sending ? (
              <CircularProgress size={24} sx={{ color: 'white' }} />
            ) : (
              <SendIcon />
            )}
          </IconButton>
        </span>
      </Tooltip>
      </Box>

      {/* Tip Modal */}
      {showTipModal && (
        <TipModal
          open={showTipModal}
          onClose={handleCloseTipModal}
          recipientWallet={recipientWallet}
          projectId={projectId}
          initialMessage={message.trim()}
        />
      )}
    </>
  )
}








