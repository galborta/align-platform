'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '@/components/WalletButton'
import { WalletVerificationFlow } from '@/components/WalletVerificationFlow'
import { IconButton, Badge, Tooltip, Popover, Typography, Box, Divider } from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import MailIcon from '@mui/icons-material/Mail'
import LockIcon from '@mui/icons-material/Lock'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import { useMessaging } from '@/lib/MessagingContext'
import { useVerification } from '@/contexts/VerificationContext'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { NotificationBell } from '@/components/notifications'

export function AppHeader() {
  const wallet = useWallet()
  const router = useRouter()
  const { isVerified } = useVerification()
  const [messagePreviewAnchor, setMessagePreviewAnchor] = useState<null | HTMLElement>(null)
  const [latestMessage, setLatestMessage] = useState<{
    content: string
    sender: string
    timestamp: string
  } | null>(null)
  const { openMessages, unreadCount, pendingAssetsCount, totalBadgeCount } = useMessaging()
  const [isMac, setIsMac] = useState(true)

  // Detect OS for keyboard shortcut display
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0)
  }, [])

  // Fetch latest unread message for preview
  useEffect(() => {
    const fetchLatestMessage = async () => {
      if (!wallet?.publicKey) return

      try {
        // Get user's conversations
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id')
          .or(`participant_1.eq.${wallet.publicKey.toString()},participant_2.eq.${wallet.publicKey.toString()}`)

        if (!conversations || conversations.length === 0) return

        const conversationIds = conversations.map(c => c.id)

        // Get latest unread message
        const { data: message } = await supabase
          .from('messages')
          .select('content, sender_wallet, created_at')
          .in('conversation_id', conversationIds)
          .neq('sender_wallet', wallet.publicKey.toString())
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (message) {
          // Get sender profile
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('display_name')
            .eq('wallet_address', message.sender_wallet)
            .maybeSingle()

          setLatestMessage({
            content: message.content,
            sender: profile?.display_name || 
                   `${message.sender_wallet.slice(0, 4)}...${message.sender_wallet.slice(-4)}`,
            timestamp: message.created_at
          })
        } else {
          setLatestMessage(null)
        }
      } catch (error) {
        console.error('Error fetching latest message:', error)
      }
    }

    fetchLatestMessage()

    // Refresh on unread count change
  }, [wallet?.publicKey, unreadCount])

  const handleMessageHover = (event: React.MouseEvent<HTMLElement>) => {
    if (latestMessage && totalBadgeCount > 0) {
      setMessagePreviewAnchor(event.currentTarget)
    }
  }

  const handleMessageLeave = () => {
    setMessagePreviewAnchor(null)
  }

  return (
    <>
      <header className="sticky top-0 bg-page-bg/95 backdrop-blur-sm border-b border-border-subtle z-50" style={{ overflow: 'visible', minHeight: '80px' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4" style={{ overflow: 'visible', minHeight: '64px' }}>
          <div className="flex items-center justify-between" style={{ overflow: 'visible' }}>
          <Link href="/" className="no-underline">
            <h1 
              className="cursor-pointer hover:opacity-80 transition-opacity"
              style={{
                fontFamily: "'Gluten', cursive",
                fontSize: '28px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              ORggly
            </h1>
          </Link>
          
          <div className="flex items-center gap-2" style={{ overflow: 'visible', isolation: 'isolate' }}>
            {/* Profile Icon (only show if wallet connected) */}
            {wallet?.publicKey && (
              <IconButton
                onClick={() => router.push('/profile')}
                sx={{ 
                  color: '#7C4DFF',
                  '&:hover': { bgcolor: 'rgba(124, 77, 255, 0.08)' }
                }}
              >
                <PersonIcon />
              </IconButton>
            )}
            
            {/* Notification Bell (only show if wallet connected) */}
            <NotificationBell />
            
            {/* Messages Button (only show if wallet connected) */}
            {wallet?.publicKey && (
              <>
                <Tooltip 
                  title={
                    isVerified ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <span>Messages</span>
                        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.3)' }} />
                        <KeyboardIcon sx={{ fontSize: 14 }} />
                        <span style={{ fontSize: '11px' }}>{isMac ? '⌘' : 'Ctrl'}+M</span>
                      </Box>
                    ) : (
                      <span>Verify wallet to message</span>
                    )
                  }
                  arrow
                >
                  <IconButton
                    onClick={() => {
                      if (isVerified) {
                        openMessages()
                      } else {
                        toast.error('Please verify your wallet to send messages')
                      }
                    }}
                    onMouseEnter={isVerified ? handleMessageHover : undefined}
                    onMouseLeave={handleMessageLeave}
                    sx={{ 
                      color: isVerified ? '#7C4DFF' : '#A3A7B5',
                      '&:hover': { 
                        bgcolor: 'rgba(124, 77, 255, 0.08)',
                        boxShadow: isVerified ? '0 0 8px rgba(124, 77, 255, 0.3)' : 'none'
                      },
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    <Badge
                      badgeContent={totalBadgeCount}
                      invisible={totalBadgeCount === 0}
                      showZero={false}
                      max={99}
                      anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                      }}
                      sx={{
                        '& .MuiBadge-badge': {
                          // Use yellow if only pending assets, red if messages, or gradient if both
                          bgcolor: pendingAssetsCount > 0 && unreadCount === 0 
                            ? '#FFB800' 
                            : '#EF4444',
                          color: pendingAssetsCount > 0 && unreadCount === 0 
                            ? '#1A1A1E' 
                            : 'white',
                          fontWeight: 700,
                          fontSize: '10px',
                          height: '16px',
                          minWidth: '16px',
                          borderRadius: '8px',
                          border: '2px solid white',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                          transform: 'scale(1) translate(50%, -50%)',
                          transformOrigin: '100% 0%',
                          animation: totalBadgeCount > 0 ? 'pulse 2s infinite' : 'none',
                          '@keyframes pulse': {
                            '0%, 100%': {
                              transform: 'scale(1) translate(50%, -50%)',
                              opacity: 1
                            },
                            '50%': {
                              transform: 'scale(1.1) translate(50%, -50%)',
                              opacity: 0.9
                            }
                          }
                        }
                      }}
                    >
                      <MailIcon sx={{ fontSize: 24 }} />
                    </Badge>
                  </IconButton>
                </Tooltip>
                
                {/* Message Preview Popover */}
                <Popover
                  open={Boolean(messagePreviewAnchor)}
                  anchorEl={messagePreviewAnchor}
                  onClose={handleMessageLeave}
                  disableRestoreFocus
                  sx={{
                    pointerEvents: 'none',
                    '& .MuiPopover-paper': {
                      pointerEvents: 'auto'
                    }
                  }}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  slotProps={{
                    paper: {
                      sx: {
                        mt: 1,
                        width: 300,
                        boxShadow: '0 4px 20px rgba(124, 77, 255, 0.2)',
                        border: '1px solid rgba(124, 77, 255, 0.1)'
                      }
                    }
                  }}
                >
                  {latestMessage && (
                    <Box sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" fontWeight={600} color="text.primary">
                          {latestMessage.sender}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDistanceToNow(new Date(latestMessage.timestamp), { addSuffix: true })}
                        </Typography>
                      </Box>
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}
                      >
                        {latestMessage.content}
                      </Typography>
                      {unreadCount > 1 && (
                        <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                          +{unreadCount - 1} more unread {unreadCount - 1 === 1 ? 'message' : 'messages'}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Popover>
              </>
            )}
            
            <WalletButton />
            
            {/* Wallet Verification - Auto-triggers when wallet connects if not verified */}
            {wallet?.publicKey && (
              <WalletVerificationFlow autoTriggerDelay={2000} />
            )}
          </div>
        </div>
      </div>
    </header>
    </>
  )
}
