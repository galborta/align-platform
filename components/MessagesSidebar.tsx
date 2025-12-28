'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUnreadCount, getOrCreateConversation, getExistingConversation } from '@/lib/messaging'
import { ConversationList } from '@/components/ConversationList'
import { MessageThread } from '@/components/MessageThread'
import { MessageComposer } from '@/components/MessageComposer'
import { SocialAssetFeed } from '@/components/admin/SocialAssetFeed'
import { DisputeFeed } from '@/components/admin/DisputeFeed'
import { countPendingSocialAssets } from '@/lib/feed-queries-social-assets'
import { getPendingDisputesCount } from '@/lib/notifications/dispute-notifications'
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
  Tooltip,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import SettingsIcon from '@mui/icons-material/Settings'
import SearchIcon from '@mui/icons-material/Search'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ClearIcon from '@mui/icons-material/Clear'
import HistoryIcon from '@mui/icons-material/History'
import { toast } from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

type SidebarView = 'list' | 'thread' | 'new'

interface SearchResult {
  message_id: string
  conversation_id: string
  sender_wallet: string
  content: string
  created_at: string
  sender_display_name?: string
}

interface MessagesSidebarProps {
  isOpen: boolean
  onClose: () => void
  currentWallet: string
  targetWallet?: string | null
  // New context props from MessagingContext
  initialSection?: 'messages' | 'social-assets' | 'disputes'
  initialProjectId?: string | null
  initialHighlightAssetId?: string | null
  initialDisputeId?: string | null
}

export function MessagesSidebar({
  isOpen,
  onClose,
  currentWallet,
  targetWallet,
  initialSection,
  initialProjectId,
  initialHighlightAssetId,
  initialDisputeId
}: MessagesSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  // Read URL parameters
  const urlProject = searchParams.get('project')
  const urlSection = searchParams.get('section')
  
  // If targetWallet is provided, we'll be loading a thread - don't show list flash
  const [view, setView] = useState<SidebarView>('list')
  const [isLoadingThread, setIsLoadingThread] = useState(false)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [recipientWallet, setRecipientWallet] = useState<string>('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all')
  const [newMessageInput, setNewMessageInput] = useState('')
  const [creatingConversation, setCreatingConversation] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  
  // Project context state (for social asset feed)
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || null)
  const [isCreatorOrEditor, setIsCreatorOrEditor] = useState(false)  // For specific project in URL
  const [hasAnyProjectRole, setHasAnyProjectRole] = useState(false)  // For ANY project (used to show asset reviews)
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false)
  const [pendingAssetsCount, setPendingAssetsCount] = useState(0)
  const [pendingDisputesCount, setPendingDisputesCount] = useState(0)
  const [activeSection, setActiveSection] = useState<'messages' | 'social-assets' | 'disputes'>(initialSection || 'messages')
  const [highlightAssetId, setHighlightAssetId] = useState<string | null>(initialHighlightAssetId || null)
  const [highlightDisputeId, setHighlightDisputeId] = useState<string | null>(initialDisputeId || null)
  
  // Force refresh conversation list when sidebar opens
  useEffect(() => {
    if (isOpen) {
      setRefreshTrigger(prev => prev + 1)
    }
  }, [isOpen])

  // Apply initial props when sidebar opens (from MessagingContext)
  useEffect(() => {
    if (isOpen) {
      if (initialSection) {
        setActiveSection(initialSection)
      }
      if (initialProjectId) {
        setProjectId(initialProjectId)
      }
      if (initialHighlightAssetId) {
        setHighlightAssetId(initialHighlightAssetId)
      }
      if (initialDisputeId) {
        setHighlightDisputeId(initialDisputeId)
      }
    }
  }, [isOpen, initialSection, initialProjectId, initialHighlightAssetId, initialDisputeId])

  // Check if current user is a global admin
  useEffect(() => {
    if (!currentWallet) {
      setIsGlobalAdmin(false)
      return
    }

    async function checkGlobalAdmin() {
      try {
        const { data: admin } = await supabase
          .from('admin_wallets')
          .select('wallet_address')
          .eq('wallet_address', currentWallet)
          .eq('is_active', true)
          .single()

        setIsGlobalAdmin(!!admin)
      } catch (error) {
        setIsGlobalAdmin(false)
      }
    }

    checkGlobalAdmin()
  }, [currentWallet])
  
  // Check if user is creator or editor of ANY project (for showing asset reviews regardless of current page)
  useEffect(() => {
    if (!currentWallet) {
      setHasAnyProjectRole(false)
      return
    }

    async function checkAnyProjectRole() {
      try {
        // Check if user is creator of any project
        const { data: creatorProjects, error: creatorError } = await supabase
          .from('projects')
          .select('id')
          .eq('creator_wallet', currentWallet)
          .limit(1)

        if (!creatorError && creatorProjects && creatorProjects.length > 0) {
          setHasAnyProjectRole(true)
          return
        }

        // Check if user is editor of any project
        const { data: editorProjects, error: editorError } = await supabase
          .from('projects')
          .select('id')
          .contains('editor_wallets', [currentWallet])
          .limit(1)

        if (!editorError && editorProjects && editorProjects.length > 0) {
          setHasAnyProjectRole(true)
          return
        }

        setHasAnyProjectRole(false)
      } catch (error) {
        console.error('Error checking project roles:', error)
        setHasAnyProjectRole(false)
      }
    }

    checkAnyProjectRole()
  }, [currentWallet])
  
  // Message search state
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [showSearchHistory, setShowSearchHistory] = useState(false)

  // Load search history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('message_search_history')
    if (history) {
      try {
        setSearchHistory(JSON.parse(history))
      } catch (e) {
        console.error('Failed to parse search history:', e)
      }
    }
  }, [])

  // Detect if we're on a project page and extract projectId
  useEffect(() => {
    // First check URL parameter (takes priority)
    if (urlProject) {
      setProjectId(urlProject)
    } else {
      // Fall back to pathname detection
      const match = pathname?.match(/\/project\/([^\/]+)/)
      if (match) {
        setProjectId(match[1])
      } else {
        setProjectId(null)
        setIsCreatorOrEditor(false)
        setPendingAssetsCount(0)
      }
    }
  }, [pathname, urlProject])

  // Apply URL section parameter on mount
  useEffect(() => {
    if (urlSection && (urlSection === 'messages' || urlSection === 'social-assets' || urlSection === 'disputes')) {
      setActiveSection(urlSection as 'messages' | 'social-assets' | 'disputes')
    }
  }, [urlSection])

  // Helper function to handle section changes and update URL
  const handleSectionChange = useCallback((section: 'messages' | 'social-assets' | 'disputes') => {
    setActiveSection(section)
    
    // Update URL without full page reload
    const params = new URLSearchParams(searchParams.toString())
    if (projectId) {
      params.set('project', projectId)
    }
    params.set('section', section)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }, [projectId, pathname, searchParams, router])

  // Check if user is creator or editor for current project
  useEffect(() => {
    if (!projectId || !currentWallet) {
      setIsCreatorOrEditor(false)
      return
    }

    async function checkPermissions() {
      try {
        const { data: project } = await supabase
          .from('projects')
          .select('creator_wallet, editor_wallets')
          .eq('id', projectId)
          .single()

        if (!project) {
          setIsCreatorOrEditor(false)
          return
        }

        const isCreator = project.creator_wallet === currentWallet
        const isEditor = project.editor_wallets?.includes(currentWallet) || false

        setIsCreatorOrEditor(isCreator || isEditor)
      } catch (error) {
        console.error('Error checking permissions:', error)
        setIsCreatorOrEditor(false)
      }
    }

    checkPermissions()
  }, [projectId, currentWallet])

  // Fetch pending social assets count (for global admins or project editors/creators)
  useEffect(() => {
    // Global admins can see all pending assets, project editors can see their project's
    if (!isGlobalAdmin && (!projectId || !isCreatorOrEditor)) {
      setPendingAssetsCount(0)
      return
    }

    async function loadPendingCount() {
      // Global admins see all pending assets, others see project-specific
      const targetProjectId = isGlobalAdmin && !projectId ? 'all' : projectId
      const count = await countPendingSocialAssets(targetProjectId)
      setPendingAssetsCount(count)
    }

    loadPendingCount()

    // Subscribe to changes
    const channelName = isGlobalAdmin && !projectId 
      ? 'pending-assets-count:global' 
      : `pending-assets-count:${projectId}`
    
    const subscriptionConfig: any = {
      event: '*',
      schema: 'public',
      table: 'pending_assets'
    }

    // Only filter by project_id for non-global admins
    if (!isGlobalAdmin && projectId) {
      subscriptionConfig.filter = `project_id=eq.${projectId}`
    }

    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', subscriptionConfig, () => {
        loadPendingCount()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [projectId, isCreatorOrEditor, isGlobalAdmin])

  // Fetch pending disputes count (for global admins only)
  useEffect(() => {
    if (!isGlobalAdmin) {
      setPendingDisputesCount(0)
      return
    }

    async function loadPendingDisputesCount() {
      const count = await getPendingDisputesCount()
      setPendingDisputesCount(count)
    }

    loadPendingDisputesCount()

    // Subscribe to dispute changes
    const subscription = supabase
      .channel('pending-disputes-count')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'job_disputes'
      }, () => {
        loadPendingDisputesCount()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [isGlobalAdmin])

  // Save search to history
  const saveSearchToHistory = useCallback((query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return

    setSearchHistory(prev => {
      // Remove duplicates and add to front
      const filtered = prev.filter(q => q !== trimmed)
      const newHistory = [trimmed, ...filtered].slice(0, 5)
      localStorage.setItem('message_search_history', JSON.stringify(newHistory))
      return newHistory
    })
  }, [])

  // Perform message search
  const performSearch = useCallback(async (query: string) => {
    const trimmed = query.trim()
    
    if (!trimmed) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    // Check minimum length
    if (trimmed.length < 3) {
      return // Don't search for very short queries
    }

    setIsSearching(true)

    try {
      // Search messages where content matches and conversation includes current wallet
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_1.eq.${currentWallet},participant_2.eq.${currentWallet}`)

      if (convError) throw convError

      const conversationIds = conversations?.map(c => c.id) || []

      if (conversationIds.length === 0) {
        setSearchResults([])
        setIsSearching(false)
        return
      }

      // Search messages in these conversations
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_wallet, content, created_at')
        .in('conversation_id', conversationIds)
        .ilike('content', `%${trimmed}%`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (msgError) throw msgError

      // Get sender profiles
      const senderWallets = [...new Set(messages?.map(m => m.sender_wallet) || [])]
      
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('wallet_address, display_name')
        .in('wallet_address', senderWallets)

      const profileMap = new Map(
        profiles?.map(p => [p.wallet_address, p.display_name]) || []
      )

      // Map results with sender names
      const results: SearchResult[] = messages?.map(msg => ({
        message_id: msg.id,
        conversation_id: msg.conversation_id,
        sender_wallet: msg.sender_wallet,
        content: msg.content,
        created_at: msg.created_at,
        sender_display_name: profileMap.get(msg.sender_wallet)
      })) || []

      setSearchResults(results)
      saveSearchToHistory(trimmed)
    } catch (error) {
      console.error('Search error:', error)
      toast.error('Failed to search messages')
    } finally {
      setIsSearching(false)
    }
  }, [currentWallet, saveSearchToHistory])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 3) {
        performSearch(searchQuery)
      } else if (searchQuery.trim().length === 0) {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, performSearch])

  // Highlight search matches in text
  const highlightMatches = useCallback((text: string, query: string) => {
    if (!query.trim()) return text

    const parts = text.split(new RegExp(`(${query.trim()})`, 'gi'))
    
    return parts.map((part, index) => {
      if (part.toLowerCase() === query.trim().toLowerCase()) {
        return `<mark style="background-color: #FEF08A; padding: 0 2px; border-radius: 2px;">${part}</mark>`
      }
      return part
    }).join('')
  }, [])

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

  // Clean up empty conversations when closing sidebar
  const handleCloseSidebarWithCleanup = useCallback(async () => {
    // If we have a conversation open, check if it has messages
    if (selectedConversationId) {
      try {
        const { data: messages, error } = await supabase
          .from('messages')
          .select('id')
          .eq('conversation_id', selectedConversationId)
          .limit(1)

        // If no messages exist, delete the conversation
        if (!error && (!messages || messages.length === 0)) {
          await supabase
            .from('conversations')
            .delete()
            .eq('id', selectedConversationId)
        }
      } catch (error) {
        console.error('Error cleaning up empty conversation:', error)
      }
    }

    // Close the sidebar
    onClose()
  }, [selectedConversationId, onClose])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC: close sidebar or go back to list
      if (e.key === 'Escape') {
        if (view === 'thread' || view === 'new') {
          handleBackToList()
        } else {
          handleCloseSidebarWithCleanup()
        }
      }
      
      // Cmd/Ctrl + M: toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault()
        if (isOpen) {
          handleCloseSidebarWithCleanup()
        } else {
          // Can't open from here, but parent can handle this
        }
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, view, handleCloseSidebarWithCleanup])

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

  // Handle search result click
  const handleSearchResultClick = async (result: SearchResult) => {
    try {
      // Get conversation details
      const { data: conversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', result.conversation_id)
        .single()

      if (conversation) {
        const recipient = 
          conversation.participant_1 === currentWallet
            ? conversation.participant_2
            : conversation.participant_1
        
        setSelectedConversationId(result.conversation_id)
        setRecipientWallet(recipient)
        setView('thread')
        
        // Clear search after opening
        setSearchQuery('')
        setSearchResults([])
      }
    } catch (error) {
      console.error('Error opening search result:', error)
      toast.error('Failed to open conversation')
    }
  }

  // Handle back to list
  const handleBackToList = () => {
    setView('list')
    setSelectedConversationId(null)
    setRecipientWallet('')
    setSearchQuery('')
    setSearchResults([])
    setShowSearchHistory(false)
  }

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
    setShowSearchHistory(false)
  }

  // Use search history suggestion
  const handleSearchHistoryClick = (query: string) => {
    setSearchQuery(query)
    setShowSearchHistory(false)
    performSearch(query)
  }

  // Handle new message
  const handleNewMessage = () => {
    setView('new')
    setNewMessageInput('')
  }

  // Handle settings
  const handleSettings = () => {
    router.push('/profile/settings')
    handleCloseSidebarWithCleanup()
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

  // Track which targetWallet we've already processed to prevent duplicate calls
  const processedTargetWalletRef = useRef<string | null>(null)
  const isOpeningRef = useRef(false)

  // Handle targetWallet from context - open conversation directly
  useEffect(() => {
    // Only process if we have all required values and haven't processed this target yet
    if (
      isOpen && 
      targetWallet && 
      currentWallet && 
      !isOpeningRef.current &&
      processedTargetWalletRef.current !== targetWallet
    ) {
      console.log('[MessagesSidebar] targetWallet detected:', targetWallet)
      processedTargetWalletRef.current = targetWallet
      isOpeningRef.current = true
      setIsLoadingThread(true) // Show loading state instead of list
      
      // Auto-open conversation with target wallet
      const openConversation = async () => {
        try {
          const conversation = await getOrCreateConversation(currentWallet, targetWallet)
          
          if (conversation) {
            console.log('[MessagesSidebar] Got conversation:', conversation.id)
            setSelectedConversationId(conversation.id)
            setRecipientWallet(targetWallet)
            setView('thread')
          } else {
            console.log('[MessagesSidebar] Failed to get/create conversation')
            toast.error('Could not start conversation')
            setView('list') // Fall back to list on error
          }
        } catch (error) {
          console.error('[MessagesSidebar] Error opening conversation:', error)
          toast.error('Failed to open conversation')
          setView('list') // Fall back to list on error
        } finally {
          isOpeningRef.current = false
          setIsLoadingThread(false)
        }
      }
      
      openConversation()
    }
  }, [isOpen, targetWallet, currentWallet])
  
  // Reset processed wallet when sidebar closes
  useEffect(() => {
    if (!isOpen) {
      processedTargetWalletRef.current = null
      isOpeningRef.current = false
      setIsLoadingThread(false)
    }
  }, [isOpen])

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
      onClose={handleCloseSidebarWithCleanup}
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
                      ml: 2,
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
          <IconButton onClick={handleCloseSidebarWithCleanup} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Loading Thread State - Show while opening conversation from profile */}
        {isLoadingThread && (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            flex: 1,
            gap: 2
          }}>
            <CircularProgress size={32} sx={{ color: '#7C4DFF' }} />
            <Typography variant="body2" color="text.secondary">
              Opening conversation...
            </Typography>
          </Box>
        )}

        {/* List View */}
        {view === 'list' && !isLoadingThread && (
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Tabs removed - navigation is now done via conversation list items */}

            {/* Messages Section */}
            {activeSection === 'messages' && (
              <>
            {/* Search Bar */}
            <Box sx={{ p: 2, position: 'relative' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearchHistory(searchQuery.length === 0 && searchHistory.length > 0)}
                onBlur={() => setTimeout(() => setShowSearchHistory(false), 200)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={handleClearSearch}
                        edge="end"
                        sx={{ color: 'text.secondary' }}
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
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

              {/* Search History Dropdown */}
              {showSearchHistory && searchHistory.length > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 16,
                    right: 16,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mt: 0.5,
                    boxShadow: 2,
                    zIndex: 1000,
                    maxHeight: 200,
                    overflow: 'auto'
                  }}
                >
                  <List dense>
                    {searchHistory.map((query, index) => (
                      <ListItem
                        key={index}
                        button
                        onClick={() => handleSearchHistoryClick(query)}
                        sx={{
                          '&:hover': {
                            bgcolor: 'rgba(124, 77, 255, 0.04)'
                          }
                        }}
                      >
                        <HistoryIcon
                          fontSize="small"
                          sx={{ mr: 1, color: 'text.secondary' }}
                        />
                        <ListItemText
                          primary={query}
                          primaryTypographyProps={{
                            fontSize: 14,
                            color: 'text.primary'
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Search warning for short queries */}
              {searchQuery.length > 0 && searchQuery.length < 3 && (
                <Typography
                  variant="caption"
                  sx={{ 
                    display: 'block', 
                    mt: 1, 
                    color: 'warning.main',
                    fontSize: 11
                  }}
                >
                  Type at least 3 characters to search
                </Typography>
              )}
            </Box>

            {/* Conditional Content: Search Results or Conversation List */}
            {searchQuery.trim().length >= 3 ? (
              /* Search Results View */
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                {isSearching ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <CircularProgress size={32} sx={{ color: '#7C4DFF' }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      Searching messages...
                    </Typography>
                  </Box>
                ) : searchResults.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <SearchIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      No messages found for '{searchQuery}'
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Try different keywords or check spelling
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    {/* Results header */}
                    <Box sx={{ p: 2, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="body2" color="text.secondary">
                        {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} found
                      </Typography>
                    </Box>

                    {/* Results list */}
                    <List sx={{ p: 0 }}>
                      {searchResults.map((result) => {
                        const highlightedContent = highlightMatches(result.content, searchQuery)
                        const snippet = result.content.length > 100 
                          ? result.content.substring(0, 100) + '...' 
                          : result.content
                        const highlightedSnippet = highlightMatches(snippet, searchQuery)

                        return (
                          <ListItem
                            key={result.message_id}
                            button
                            onClick={() => handleSearchResultClick(result)}
                            sx={{
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              borderBottom: '1px solid',
                              borderColor: 'divider',
                              py: 2,
                              '&:hover': {
                                bgcolor: 'rgba(124, 77, 255, 0.04)'
                              }
                            }}
                          >
                            {/* Sender info */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, width: '100%' }}>
                              <Typography variant="body2" fontWeight={500}>
                                {result.sender_display_name || formatAddress(result.sender_wallet)}
                              </Typography>
                              {result.sender_wallet === currentWallet && (
                                <Chip label="You" size="small" sx={{ height: 18, fontSize: 10 }} />
                              )}
                              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                {formatDistanceToNow(new Date(result.created_at), { addSuffix: true })}
                              </Typography>
                            </Box>

                            {/* Message snippet with highlighted matches */}
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ 
                                width: '100%',
                                '& mark': {
                                  backgroundColor: '#FEF08A',
                                  padding: '0 2px',
                                  borderRadius: '2px'
                                }
                              }}
                              dangerouslySetInnerHTML={{ __html: highlightedSnippet }}
                            />
                          </ListItem>
                        )
                      })}
                    </List>
                  </Box>
                )}
              </Box>
            ) : (
              /* Regular Conversation List View */
              <>
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
                      onSelectAssetReviews={() => {
                        // Switch to social-assets section when clicking "Social Asset Reviews" entry
                        setActiveSection('social-assets')
                        setHighlightAssetId(null) // Clear any specific highlight
                      }}
                      onSelectDisputeReviews={() => {
                        // Switch to disputes section when clicking "Dispute Reviews" entry
                        setActiveSection('disputes')
                        setHighlightDisputeId(null) // Clear any specific highlight
                      }}
                      filter={filterTab}
                      refreshTrigger={refreshTrigger}
                      showAssetReviews={isGlobalAdmin || hasAnyProjectRole}
                      showDisputeReviews={isGlobalAdmin}
                    />
                  ) : (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Connect your wallet to view messages
                      </Typography>
                    </Box>
                  )}
                </Box>
              </>
            )}
              </>
            )}

            {/* Social Asset Feed Section - For global admins OR project creators/editors */}
            {activeSection === 'social-assets' && (isGlobalAdmin || hasAnyProjectRole) && (
              <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                {/* Back Button Header */}
                <Box sx={{ 
                  p: 2, 
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <IconButton 
                    onClick={() => setActiveSection('messages')}
                    size="small"
                    sx={{ 
                      color: 'text.secondary',
                      '&:hover': {
                        color: '#FFB800',
                        bgcolor: 'rgba(255, 184, 0, 0.08)'
                      }
                    }}
                  >
                    <ArrowBackIcon fontSize="small" />
                  </IconButton>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                      🔶 {isGlobalAdmin && !projectId ? 'All Asset Reviews' : 'Social Asset Reviews'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {isGlobalAdmin && !projectId 
                        ? 'Review assets across all projects'
                        : 'Review submitted assets for your project'
                      }
                    </Typography>
                  </Box>
                </Box>
                
                {/* Asset Feed */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                <SocialAssetFeed
                  projectId={isGlobalAdmin ? (projectId || 'all') : (isCreatorOrEditor && projectId ? projectId : 'all')}
                  editorWallet={currentWallet}
                  highlightAssetId={highlightAssetId}
                  isGlobalAdmin={isGlobalAdmin}
                />
                </Box>
              </Box>
            )}

            {/* Disputes Section - For global admins only */}
            {activeSection === 'disputes' && isGlobalAdmin && (
              <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                {/* Back Button Header */}
                <Box sx={{ 
                  p: 2, 
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <IconButton 
                    onClick={() => setActiveSection('messages')}
                    size="small"
                    sx={{ 
                      color: 'text.secondary',
                      '&:hover': {
                        color: '#FF6B35',
                        bgcolor: 'rgba(255, 107, 53, 0.08)'
                      }
                    }}
                  >
                    <ArrowBackIcon fontSize="small" />
                  </IconButton>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                        ⚖️ Dispute Resolutions
                      </Typography>
                      {pendingDisputesCount > 0 && (
                        <Badge
                          badgeContent={pendingDisputesCount}
                          sx={{
                            '& .MuiBadge-badge': {
                              bgcolor: '#FF6B35',
                              color: 'white',
                              fontWeight: 700,
                              fontSize: '11px'
                            }
                          }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Review and resolve pending disputes
                    </Typography>
                  </Box>
                </Box>
                
                {/* Dispute Feed */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                  <DisputeFeed
                    editorWallet={currentWallet}
                    highlightDisputeId={highlightDisputeId}
                    isGlobalAdmin={isGlobalAdmin}
                  />
                </Box>
              </Box>
            )}
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

