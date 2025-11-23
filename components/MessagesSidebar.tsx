'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUnreadCount, getOrCreateConversation } from '@/lib/messaging'
import { ConversationList } from '@/components/ConversationList'
import { MessageThread } from '@/components/MessageThread'
import { MessageComposer } from '@/components/MessageComposer'
import {
  Drawer,
  Box,
  IconButton,
  Typography,
  Badge,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Button,
  CircularProgress,
  Divider,
  Tooltip
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import SettingsIcon from '@mui/icons-material/Settings'
import SearchIcon from '@mui/icons-material/Search'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { toast } from 'react-hot-toast'

type SidebarView = 'list' | 'thread' | 'new'

interface MessagesSidebarProps {
  isOpen: boolean
  onClose: () => void
  currentWallet: string
  targetWallet?: string | null
}

export function MessagesSidebar({
  isOpen,
  onClose,
  currentWallet,
  targetWallet
}: MessagesSidebarProps) {
  const router = useRouter()
  const [view, setView] = useState<SidebarView>('list')
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [recipientWallet, setRecipientWallet] = useState<string>('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all')
  const [newMessageInput, setNewMessageInput] = useState('')
  const [creatingConversation, setCreatingConversation] = useState(false)

  // Load unread count
  const loadUnreadCount = useCallback(async () => {
    if (!currentWallet) return
    
    const count = await getUnreadCount(currentWallet)
    setUnreadCount(count)
  }, [currentWallet])

  // Initial load and refresh unread count
  useEffect(() => {
    if (isOpen && currentWallet) {
      loadUnreadCount()
    }
  }, [isOpen, currentWallet, loadUnreadCount])

  // Subscribe to messages for unread count updates
  useEffect(() => {
    if (!currentWallet) return

    const channel = supabase
      .channel(`messages_sidebar_${currentWallet}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          loadUnreadCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentWallet, loadUnreadCount])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC: close sidebar or go back to list
      if (e.key === 'Escape') {
        if (view === 'thread' || view === 'new') {
          handleBackToList()
        } else {
          onClose()
        }
      }
      
      // Cmd/Ctrl + M: toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault()
        if (isOpen) {
          onClose()
        } else {
          // Can't open from here, but parent can handle this
        }
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, view, onClose])

  // Handle conversation selection
  const handleSelectConversation = async (conversationId: string) => {
    // Get conversation to find recipient
    const { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    if (conversation) {
      const recipient = 
        conversation.participant_1 === currentWallet
          ? conversation.participant_2
          : conversation.participant_1
      
      setSelectedConversationId(conversationId)
      setRecipientWallet(recipient)
      setView('thread')
    }
  }

  // Handle back to list
  const handleBackToList = () => {
    setView('list')
    setSelectedConversationId(null)
    setRecipientWallet('')
    setSearchQuery('')
  }

  // Handle new message
  const handleNewMessage = () => {
    setView('new')
    setNewMessageInput('')
  }

  // Handle settings
  const handleSettings = () => {
    router.push('/profile/settings')
    onClose()
  }

  // Start new conversation
  const handleStartConversation = async () => {
    const walletAddress = newMessageInput.trim()
    
    if (!walletAddress) {
      toast.error('Please enter a wallet address')
      return
    }
    
    // Basic validation
    if (walletAddress === currentWallet) {
      toast.error('Cannot message yourself')
      return
    }

    setCreatingConversation(true)

    try {
      // Get or create conversation
      const conversation = await getOrCreateConversation(currentWallet, walletAddress)
      
      if (!conversation) {
        toast.error('Failed to create conversation')
        return
      }

      // Switch to thread view
      setSelectedConversationId(conversation.id)
      setRecipientWallet(walletAddress)
      setView('thread')
      
    } catch (error) {
      console.error('Error creating conversation:', error)
      toast.error('Failed to start conversation')
    } finally {
      setCreatingConversation(false)
    }
  }

  // Handle message sent
  const handleMessageSent = () => {
    loadUnreadCount()
  }

  // Handle targetWallet from context
  useEffect(() => {
    if (isOpen && targetWallet && currentWallet) {
      // Auto-open conversation with target wallet
      handleStartConversationWithWallet(targetWallet)
    }
  }, [isOpen, targetWallet, currentWallet])

  // Helper to start conversation with specific wallet
  const handleStartConversationWithWallet = async (walletAddress: string) => {
    try {
      const conversation = await getOrCreateConversation(currentWallet, walletAddress)
      
      if (conversation) {
        setSelectedConversationId(conversation.id)
        setRecipientWallet(walletAddress)
        setView('thread')
      }
    } catch (error) {
      console.error('Error opening conversation:', error)
    }
  }

  // Reset when closing
  useEffect(() => {
    if (!isOpen) {
      // Small delay to allow closing animation
      setTimeout(() => {
        setView('list')
        setSelectedConversationId(null)
        setRecipientWallet('')
        setSearchQuery('')
        setFilterTab('all')
        setNewMessageInput('')
      }, 300)
    }
  }, [isOpen])

  // Format wallet address
  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 400 },
          maxWidth: '100vw'
        }
      }}
    >
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default'
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          {/* Back button for thread/new message views */}
          {(view === 'thread' || view === 'new') && (
            <IconButton onClick={handleBackToList} size="small">
              <ArrowBackIcon />
            </IconButton>
          )}

          {/* Title */}
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
            {view === 'list' && (
              <>
                Messages
                {unreadCount > 0 && (
                  <Badge
                    badgeContent={unreadCount}
                    color="error"
                    sx={{
                      ml: 1,
                      '& .MuiBadge-badge': {
                        bgcolor: '#7C4DFF',
                        color: 'white'
                      }
                    }}
                  />
                )}
              </>
            )}
            {view === 'thread' && 'Message'}
            {view === 'new' && 'New Message'}
          </Typography>

          {/* Action Buttons (only in list view) */}
          {view === 'list' && (
            <>
              <Tooltip title="New Message">
                <IconButton onClick={handleNewMessage} size="small">
                  <AddIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Settings">
                <IconButton onClick={handleSettings} size="small">
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
            </>
          )}

          {/* Close Button */}
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* List View */}
        {view === 'list' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Search Bar */}
            <Box sx={{ p: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  )
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover fieldset': {
                      borderColor: '#7C4DFF'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#7C4DFF'
                    }
                  }
                }}
              />
            </Box>

            {/* Filter Tabs */}
            <Box sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Tabs
                value={filterTab}
                onChange={(_, newValue) => setFilterTab(newValue)}
                sx={{
                  minHeight: 40,
                  '& .MuiTab-root': {
                    minHeight: 40,
                    textTransform: 'none',
                    fontWeight: 500
                  },
                  '& .Mui-selected': {
                    color: '#7C4DFF'
                  },
                  '& .MuiTabs-indicator': {
                    bgcolor: '#7C4DFF'
                  }
                }}
              >
                <Tab label="All" value="all" />
                <Tab 
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Unread
                      {unreadCount > 0 && (
                        <Badge
                          badgeContent={unreadCount}
                          sx={{
                            '& .MuiBadge-badge': {
                              bgcolor: '#7C4DFF',
                              color: 'white',
                              fontSize: 10,
                              minWidth: 16,
                              height: 16
                            }
                          }}
                        />
                      )}
                    </Box>
                  }
                  value="unread" 
                />
              </Tabs>
            </Box>

            {/* Conversation List */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {currentWallet ? (
                <ConversationList
                  currentWallet={currentWallet}
                  onSelectConversation={handleSelectConversation}
                />
              ) : (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Connect your wallet to view messages
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Thread View */}
        {view === 'thread' && selectedConversationId && recipientWallet && (
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Message Thread */}
            <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <MessageThread
                conversationId={selectedConversationId}
                currentWallet={currentWallet}
                recipientWallet={recipientWallet}
              />
            </Box>

            {/* Message Composer */}
            <MessageComposer
              conversationId={selectedConversationId}
              senderWallet={currentWallet}
              recipientWallet={recipientWallet}
              onMessageSent={handleMessageSent}
            />
          </Box>
        )}

        {/* New Message View */}
        {view === 'new' && (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter a wallet address to start a conversation
            </Typography>

            <TextField
              fullWidth
              placeholder="Wallet address (e.g., 8kK...xyz)"
              value={newMessageInput}
              onChange={(e) => setNewMessageInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !creatingConversation) {
                  handleStartConversation()
                }
              }}
              disabled={creatingConversation}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: '#7C4DFF'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#7C4DFF'
                  }
                }
              }}
            />

            <Button
              fullWidth
              variant="contained"
              onClick={handleStartConversation}
              disabled={!newMessageInput.trim() || creatingConversation}
              sx={{
                bgcolor: '#7C4DFF',
                '&:hover': {
                  bgcolor: '#6C3FEF'
                },
                textTransform: 'none',
                py: 1.5
              }}
            >
              {creatingConversation ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                  Starting conversation...
                </>
              ) : (
                'Start Conversation'
              )}
            </Button>

            <Divider sx={{ my: 3 }} />

            <Typography variant="caption" color="text.secondary">
              💡 Tip: You can also start a conversation by visiting a user's profile
              and clicking the "Message" button.
            </Typography>
          </Box>
        )}
      </Box>
    </Drawer>
  )
}

