'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { isAdminWallet } from '@/lib/admin-auth'
import { ConversationList } from '@/components/ConversationList'
import { MessageThread } from '@/components/MessageThread'
import { MessageComposer } from '@/components/MessageComposer'
import { supabase } from '@/lib/supabase'
import {
  Box,
  Container,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  useMediaQuery,
  useTheme
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import RefreshIcon from '@mui/icons-material/Refresh'
import { BackgroundShapes } from '@/components/BackgroundShapes'

export default function AdminMessagesPage() {
  const router = useRouter()
  const { publicKey } = useWallet()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [recipientWallet, setRecipientWallet] = useState<string>('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [loading, setLoading] = useState(true)

  // Check admin authentication
  useEffect(() => {
    if (!publicKey) {
      setIsAdmin(false)
      setLoading(false)
      return
    }

    const adminCheck = isAdminWallet(publicKey)
    setIsAdmin(adminCheck)
    setLoading(false)
    
    if (!adminCheck) {
      // Redirect non-admins after a brief delay
      setTimeout(() => {
        router.push('/')
      }, 2000)
    }
  }, [publicKey, router])

  // Handle conversation selection
  const handleSelectConversation = async (conversationId: string) => {
    if (!publicKey) return

    setSelectedConversationId(conversationId)

    // Get conversation to find recipient
    const { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    if (conversation) {
      const adminWallet = publicKey.toBase58()
      const recipient = 
        conversation.participant_1 === adminWallet
          ? conversation.participant_2
          : conversation.participant_1
      
      setRecipientWallet(recipient)
    }
  }

  // Handle back to list (mobile)
  const handleBackToList = () => {
    setSelectedConversationId(null)
    setRecipientWallet('')
  }

  // Handle refresh
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  // Loading state
  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'var(--page-background)'
        }}
      >
        <CircularProgress sx={{ color: 'var(--accent-primary)' }} />
      </Box>
    )
  }

  // Not authenticated
  if (!publicKey) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'var(--page-background)',
          padding: 3
        }}
      >
        <BackgroundShapes />
        <Alert severity="warning" sx={{ maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>
            Wallet Not Connected
          </Typography>
          <Typography variant="body2">
            Please connect your wallet to access the admin messages page.
          </Typography>
        </Alert>
      </Box>
    )
  }

  // Not admin
  if (isAdmin === false) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'var(--page-background)',
          padding: 3
        }}
      >
        <BackgroundShapes />
        <Alert severity="error" sx={{ maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body2" gutterBottom>
            This page is restricted to administrators only.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Redirecting to homepage...
          </Typography>
        </Alert>
      </Box>
    )
  }

  // Admin messages interface
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'var(--page-background)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <BackgroundShapes />
      
      <Container
        maxWidth="xl"
        sx={{
          py: 4,
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: 'var(--text-primary)',
                mb: 0.5
              }}
            >
              Admin Messages
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'var(--text-secondary)'
              }}
            >
              Manage project submissions and user conversations
            </Typography>
          </Box>
          
          <Tooltip title="Refresh conversations">
            <IconButton
              onClick={handleRefresh}
              sx={{
                bgcolor: 'white',
                '&:hover': {
                  bgcolor: 'var(--subtle-background)'
                }
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Messages Interface */}
        <Paper
          elevation={0}
          sx={{
            height: 'calc(100vh - 180px)',
            minHeight: '600px',
            display: 'flex',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'var(--border-subtle)'
          }}
        >
          {/* Mobile: Show list OR conversation */}
          {isMobile ? (
            <>
              {selectedConversationId ? (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Mobile header */}
                  <Box
                    sx={{
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      bgcolor: 'var(--card-background)',
                      borderBottom: '1px solid',
                      borderColor: 'var(--border-subtle)'
                    }}
                  >
                    <IconButton onClick={handleBackToList} size="small">
                      <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Conversation
                    </Typography>
                  </Box>
                  
                  {/* Message thread */}
                  <Box sx={{ flex: 1, overflow: 'hidden' }}>
                    <MessageThread
                      conversationId={selectedConversationId}
                      currentWallet={publicKey.toBase58()}
                      recipientWallet={recipientWallet}
                      onRefreshList={handleRefresh}
                    />
                  </Box>
                  
                  {/* Message composer */}
                  <Box
                    sx={{
                      borderTop: '1px solid',
                      borderColor: 'var(--border-subtle)',
                      bgcolor: 'var(--card-background)'
                    }}
                  >
                    <MessageComposer
                      conversationId={selectedConversationId}
                      senderWallet={publicKey.toBase58()}
                      recipientWallet={recipientWallet}
                    />
                  </Box>
                </Box>
              ) : (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <ConversationList
                    currentWallet={publicKey.toBase58()}
                    onSelectConversation={handleSelectConversation}
                    refreshTrigger={refreshTrigger}
                  />
                </Box>
              )}
            </>
          ) : (
            /* Desktop: Show list AND conversation side by side */
            <>
              {/* Left sidebar: Conversation list */}
              <Box
                sx={{
                  width: '380px',
                  borderRight: '1px solid',
                  borderColor: 'var(--border-subtle)',
                  bgcolor: 'var(--card-background)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    borderBottom: '1px solid',
                    borderColor: 'var(--border-subtle)'
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    Conversations
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                    Project submissions and messages
                  </Typography>
                </Box>
                
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                  <ConversationList
                    currentWallet={publicKey.toBase58()}
                    onSelectConversation={handleSelectConversation}
                    refreshTrigger={refreshTrigger}
                  />
                </Box>
              </Box>

              {/* Right panel: Message thread or placeholder */}
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: 'var(--subtle-background)'
                }}
              >
                {selectedConversationId ? (
                  <>
                    {/* Message thread */}
                    <Box sx={{ flex: 1, overflow: 'hidden' }}>
                      <MessageThread
                        conversationId={selectedConversationId}
                        currentWallet={publicKey.toBase58()}
                        recipientWallet={recipientWallet}
                        onRefreshList={handleRefresh}
                      />
                    </Box>
                    
                    <Divider />
                    
                    {/* Message composer */}
                    <Box
                      sx={{
                        bgcolor: 'var(--card-background)',
                        borderTop: '1px solid',
                        borderColor: 'var(--border-subtle)'
                      }}
                    >
                      <MessageComposer
                        conversationId={selectedConversationId}
                        senderWallet={publicKey.toBase58()}
                        recipientWallet={recipientWallet}
                      />
                    </Box>
                  </>
                ) : (
                  <Box
                    sx={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      p: 4
                    }}
                  >
                    <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          mb: 2
                        }}
                      >
                        Select a Conversation
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'var(--text-muted)',
                          lineHeight: 1.6
                        }}
                      >
                        Choose a conversation from the list to view messages and respond to project submissions or user inquiries.
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  )
}

