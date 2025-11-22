'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useWallet } from '@solana/wallet-adapter-react'
import { 
  Tabs, 
  Tab, 
  Box, 
  Chip, 
  Alert,
  AlertTitle,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button as MuiButton,
  CircularProgress,
  LinearProgress
} from '@mui/material'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { WalletButton } from '@/components/WalletButton'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import { isAdminWallet } from '@/lib/admin-auth'
import { getAdminSession, isSessionValid } from '@/lib/admin-session'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import LockIcon from '@mui/icons-material/Lock'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'react-hot-toast'

type Project = Database['public']['Tables']['projects']['Row']
type SocialAsset = Database['public']['Tables']['social_assets']['Row']
type CreativeAsset = Database['public']['Tables']['creative_assets']['Row']
type LegalAsset = Database['public']['Tables']['legal_assets']['Row']
type TeamWallet = Database['public']['Tables']['team_wallets']['Row']
type ChatMessage = Database['public']['Tables']['chat_messages']['Row']
type PendingAsset = Database['public']['Tables']['pending_assets']['Row']
type AssetVote = Database['public']['Tables']['asset_votes']['Row']
type WalletKarma = Database['public']['Tables']['wallet_karma']['Row']
type CurationMessage = Database['public']['Tables']['curation_chat_messages']['Row']

interface ProjectDetails extends Project {
  social_assets: SocialAsset[]
  creative_assets: CreativeAsset[]
  legal_assets: LegalAsset[]
  team_wallets: TeamWallet[]
}

interface OverviewStats {
  totalChatMessages: number
  pendingAssetsCount: number
  verifiedAssetsCount: number
  totalKarmaDistributed: number
  activeVotersCount: number
  bannedWalletsCount: number
}

type TabValue = 'overview' | 'profile' | 'chat' | 'pending-assets' | 'verified-assets' | 'karma' | 'team' | 'activity' | 'danger'

type AdminLog = Database['public']['Tables']['admin_logs']['Row']

export default function AdminProjectPage() {
  const params = useParams()
  const router = useRouter()
  const { publicKey } = useWallet()
  const [project, setProject] = useState<ProjectDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTab, setCurrentTab] = useState<TabValue>('overview')
  const [isVerified, setIsVerified] = useState(false)

  // Tab data states
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [curationMessages, setCurationMessages] = useState<CurationMessage[]>([])
  const [pendingAssets, setPendingAssets] = useState<PendingAsset[]>([])
  const [karmaLeaderboard, setKarmaLeaderboard] = useState<WalletKarma[]>([])
  const [tabLoading, setTabLoading] = useState(false)

  // Chat tab state
  interface MergedMessage {
    id: string
    type: 'user' | 'system'
    timestamp: string
    wallet: string | null
    tier: string | null
    tokenPercentage: number | null
    content: string
    messageType?: string // For system messages
    originalData: ChatMessage | CurationMessage
  }
  const [mergedMessages, setMergedMessages] = useState<MergedMessage[]>([])
  const [filteredMessages, setFilteredMessages] = useState<MergedMessage[]>([])
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())
  const [messageTypeFilter, setMessageTypeFilter] = useState<'all' | 'user' | 'system'>('all')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [walletSearch, setWalletSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [deletingMessages, setDeletingMessages] = useState(false)

  // Verified Assets tab state
  const [verifiedSocialAssets, setVerifiedSocialAssets] = useState<SocialAsset[]>([])
  const [verifiedCreativeAssets, setVerifiedCreativeAssets] = useState<CreativeAsset[]>([])
  const [verifiedLegalAssets, setVerifiedLegalAssets] = useState<LegalAsset[]>([])
  const [selectedSocialAssets, setSelectedSocialAssets] = useState<Set<string>>(new Set())
  const [selectedCreativeAssets, setSelectedCreativeAssets] = useState<Set<string>>(new Set())
  const [selectedLegalAssets, setSelectedLegalAssets] = useState<Set<string>>(new Set())
  const [socialExpanded, setSocialExpanded] = useState(true)
  const [creativeExpanded, setCreativeExpanded] = useState(true)
  const [legalExpanded, setLegalExpanded] = useState(true)
  const [editingSocialAsset, setEditingSocialAsset] = useState<SocialAsset | null>(null)
  const [editingCreativeAsset, setEditingCreativeAsset] = useState<CreativeAsset | null>(null)
  const [editingLegalAsset, setEditingLegalAsset] = useState<LegalAsset | null>(null)
  const [socialFormData, setSocialFormData] = useState<any>({})
  const [creativeFormData, setCreativeFormData] = useState<any>({})
  const [legalFormData, setLegalFormData] = useState<any>({})
  const [addingSocial, setAddingSocial] = useState(false)
  const [addingCreative, setAddingCreative] = useState(false)
  const [addingLegal, setAddingLegal] = useState(false)
  const [processingAsset, setProcessingAsset] = useState(false)

  // Pending Assets tab state
  interface PendingAssetWithVotes extends PendingAsset {
    votes: AssetVote[]
  }
  const [pendingAssetsWithVotes, setPendingAssetsWithVotes] = useState<PendingAssetWithVotes[]>([])
  const [filteredPendingAssets, setFilteredPendingAssets] = useState<PendingAssetWithVotes[]>([])
  const [selectedPendingAssets, setSelectedPendingAssets] = useState<Set<string>>(new Set())
  const [viewingAsset, setViewingAsset] = useState<PendingAssetWithVotes | null>(null)
  const [editingPendingAsset, setEditingPendingAsset] = useState<PendingAssetWithVotes | null>(null)
  const [pendingAssetFormData, setPendingAssetFormData] = useState<any>({})
  const [pendingStatusFilter, setPendingStatusFilter] = useState<string>('all')
  const [pendingTypeFilter, setPendingTypeFilter] = useState<string>('all')
  const [pendingSort, setPendingSort] = useState<string>('newest')
  const [pendingWalletSearch, setPendingWalletSearch] = useState('')
  const [processingPendingAction, setProcessingPendingAction] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAsset, setDeletingAsset] = useState<PendingAssetWithVotes | null>(null)

  // Karma & Votes tab state
  const [karmaRecords, setKarmaRecords] = useState<WalletKarma[]>([])
  const [filteredKarmaRecords, setFilteredKarmaRecords] = useState<WalletKarma[]>([])
  const [selectedKarmaWallets, setSelectedKarmaWallets] = useState<Set<string>>(new Set())
  const [viewingKarmaWallet, setViewingKarmaWallet] = useState<WalletKarma | null>(null)
  const [adjustingKarmaWallet, setAdjustingKarmaWallet] = useState<WalletKarma | null>(null)
  const [banningWallet, setBanningWallet] = useState<WalletKarma | null>(null)
  const [karmaAdjustAmount, setKarmaAdjustAmount] = useState(0)
  const [karmaAdjustReason, setKarmaAdjustReason] = useState('')
  const [banDuration, setBanDuration] = useState<'7d' | '30d' | 'permanent'>('7d')
  const [banReason, setBanReason] = useState('')
  const [karmaTierFilter, setKarmaTierFilter] = useState<string>('all')
  const [karmaStatusFilter, setKarmaStatusFilter] = useState<string>('all')
  const [karmaSort, setKarmaSort] = useState<string>('karma-desc')
  const [karmaWalletSearch, setKarmaWalletSearch] = useState('')
  const [processingKarmaAction, setProcessingKarmaAction] = useState(false)
  const [walletDetailedActivity, setWalletDetailedActivity] = useState<any>(null)

  // Vote History subsection state
  interface VoteWithAsset extends AssetVote {
    pending_asset?: PendingAsset
  }
  const [allVotes, setAllVotes] = useState<VoteWithAsset[]>([])
  const [filteredVotes, setFilteredVotes] = useState<VoteWithAsset[]>([])
  const [voteAnalytics, setVoteAnalytics] = useState<any>(null)
  const [viewingVote, setViewingVote] = useState<VoteWithAsset | null>(null)
  const [voteTypeFilter, setVoteTypeFilter] = useState<string>('all')
  const [voteOutcomeFilter, setVoteOutcomeFilter] = useState<string>('all')
  const [voteVoterSearch, setVoteVoterSearch] = useState('')
  const [voteAssetSearch, setVoteAssetSearch] = useState('')
  const [votesPage, setVotesPage] = useState(0)
  const [votesPerPage] = useState(50)
  const [suspiciousActivity, setSuspiciousActivity] = useState<any[]>([])
  const [showSuspiciousModal, setShowSuspiciousModal] = useState(false)
  const [loadingVotes, setLoadingVotes] = useState(false)

  // Activity Log tab state
  interface AdminLogWithProject extends AdminLog {
    projects?: { name: string; token_symbol: string } | null
  }
  const [activityLogs, setActivityLogs] = useState<AdminLogWithProject[]>([])
  const [filteredLogs, setFilteredLogs] = useState<AdminLogWithProject[]>([])
  const [logAdminFilter, setLogAdminFilter] = useState<string>('all')
  const [logActionFilter, setLogActionFilter] = useState<string[]>([])
  const [logProjectFilter, setLogProjectFilter] = useState<string>('all')
  const [logDateFrom, setLogDateFrom] = useState('')
  const [logDateTo, setLogDateTo] = useState('')
  const [logEntitySearch, setLogEntitySearch] = useState('')
  const [logsPage, setLogsPage] = useState(0)
  const [logsPerPage] = useState(50)
  const [viewingLogDetails, setViewingLogDetails] = useState<AdminLogWithProject | null>(null)
  const [logStats, setLogStats] = useState<any>(null)
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Danger Zone tab state
  const [resetConfirmDialog, setResetConfirmDialog] = useState<string | null>(null)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [processingReset, setProcessingReset] = useState(false)
  const [resetCooldownUntil, setResetCooldownUntil] = useState<Date | null>(null)
  const [resetCooldownSeconds, setResetCooldownSeconds] = useState(0)
  const [resetPreviews, setResetPreviews] = useState<Record<string, any>>({})
  const [loadingPreviews, setLoadingPreviews] = useState<Record<string, boolean>>({})
  const [includeSystemMessages, setIncludeSystemMessages] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, { deleted: boolean; safe: boolean }>>({})
  const [lastResetResult, setLastResetResult] = useState<any>(null)

  // Edit modals
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [editFormData, setEditFormData] = useState<Partial<Project>>({})
  const [newStatus, setNewStatus] = useState<'draft' | 'pending' | 'live' | 'rejected'>('live')

  // Profile tab form state
  const [profileFormData, setProfileFormData] = useState<any>({})
  const [originalFormData, setOriginalFormData] = useState<any>({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [showImageUrlInput, setShowImageUrlInput] = useState(false)
  const [showDescriptionPreview, setShowDescriptionPreview] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [savingProfile, setSavingProfile] = useState(false)

  const isAdmin = isAdminWallet(publicKey)

  // Check admin authentication
  useEffect(() => {
    if (isAdmin && publicKey) {
      const session = getAdminSession()
      if (session && isSessionValid(publicKey.toBase58())) {
        setIsVerified(true)
      } else {
        router.push('/admin')
      }
    }
  }, [publicKey, isAdmin, router])

  // Fetch project data
  useEffect(() => {
    if (isVerified && params.id) {
      fetchProject()
    }
  }, [isVerified, params.id])

  // Load tab data when tab changes
  useEffect(() => {
    if (isVerified && project) {
      loadTabData(currentTab)
    }
  }, [currentTab, isVerified, project])

  const fetchProject = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          social_assets(*),
          creative_assets(*),
          legal_assets(*),
          team_wallets(*)
        `)
        .eq('id', params.id as string)
        .single()

      if (error) throw error
      if (!data) throw new Error('Project not found')

      setProject(data as ProjectDetails)
      setEditFormData({
        token_name: data.token_name,
        token_symbol: data.token_symbol,
        description: data.description,
        profile_image_url: data.profile_image_url
      })

      // Initialize profile form
      const formData = {
        token_name: data.token_name || '',
        token_symbol: data.token_symbol || '',
        token_mint: data.token_mint || '',
        creator_wallet: data.creator_wallet || '',
        status: data.status || 'draft',
        description: data.description || '',
        profile_image_url: data.profile_image_url || '',
        website: '',
        twitter: '',
        discord: '',
        telegram: '',
        metadata: {}
      }
      setProfileFormData(formData)
      setOriginalFormData(JSON.parse(JSON.stringify(formData)))
      setImagePreviewUrl(data.profile_image_url || null)
    } catch (error) {
      console.error('Error fetching project:', error)
      toast.error('Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  // Helper function to log admin actions
  const logAdminAction = async (
    action: string,
    entityType: string | null,
    entityId: string | null,
    details: any
  ) => {
    if (!publicKey || !project) return

    try {
      await supabase.from('admin_logs').insert({
        admin_wallet: publicKey.toBase58(),
        action,
        project_id: project.id,
        entity_type: entityType,
        entity_id: entityId,
        details
      })
    } catch (error) {
      console.error('Error logging admin action:', error)
      // Don't throw - logging failure shouldn't break the main action
    }
  }

  const loadTabData = async (tab: TabValue) => {
    if (!project) return

    setTabLoading(true)
    try {
      switch (tab) {
        case 'overview':
          await loadOverviewStats()
          break
        case 'chat':
          await loadChatMessages()
          break
        case 'pending-assets':
          await loadPendingAssets()
          break
        case 'verified-assets':
          await loadVerifiedAssets()
          break
        case 'karma':
          await loadKarmaData()
          break
        case 'activity':
          await loadActivityLogs()
          break
        default:
          // Other tabs use data already loaded in project
          break
      }
    } catch (error) {
      console.error(`Error loading ${tab} data:`, error)
      toast.error('Failed to load tab data')
    } finally {
      setTabLoading(false)
    }
  }

  const loadOverviewStats = async () => {
    if (!project) return

    try {
      // Get chat message count (both user chat and curation chat)
      const { count: chatCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)

      const { count: curationCount } = await supabase
        .from('curation_chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)

      // Get pending assets count
      const { count: pendingCount } = await supabase
        .from('pending_assets')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .in('verification_status', ['pending', 'backed'])

      // Get verified assets count
      const { data: verifiedAssets } = await supabase
        .from('pending_assets')
        .select('*')
        .eq('project_id', project.id)
        .eq('verification_status', 'verified')

      // Get karma stats
      const { data: karmaData } = await supabase
        .from('wallet_karma')
        .select('total_karma_points')
        .eq('project_id', project.id)

      const totalKarma = karmaData?.reduce((sum, k) => sum + k.total_karma_points, 0) || 0

      // Get active voters count (wallets with votes)
      const { data: voters } = await supabase
        .from('asset_votes')
        .select('voter_wallet')
        .in('pending_asset_id', (await supabase
          .from('pending_assets')
          .select('id')
          .eq('project_id', project.id)
        ).data?.map(p => p.id) || [])

      const uniqueVoters = new Set(voters?.map(v => v.voter_wallet) || [])

      // Get banned wallets count
      const { count: bannedCount } = await supabase
        .from('wallet_karma')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('is_banned', true)

      setOverviewStats({
        totalChatMessages: (chatCount || 0) + (curationCount || 0),
        pendingAssetsCount: pendingCount || 0,
        verifiedAssetsCount: verifiedAssets?.length || 0,
        totalKarmaDistributed: totalKarma,
        activeVotersCount: uniqueVoters.size,
        bannedWalletsCount: bannedCount || 0
      })
    } catch (error) {
      console.error('Error loading overview stats:', error)
    }
  }

  const loadChatMessages = async () => {
    if (!project) return

    try {
      // Load user chat messages (ALL, not limited)
      const { data: userChat } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })

      // Load curation messages (ALL, not limited)
      const { data: curationChat } = await supabase
        .from('curation_chat_messages')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })

      setChatMessages(userChat || [])
      setCurationMessages(curationChat || [])

      // Merge and sort messages
      const merged: MergedMessage[] = []

      // Add user messages
      userChat?.forEach((msg) => {
        merged.push({
          id: `user-${msg.id}`,
          type: 'user',
          timestamp: msg.created_at,
          wallet: msg.wallet_address,
          tier: msg.holding_tier,
          tokenPercentage: msg.token_percentage,
          content: msg.message_text,
          originalData: msg
        })
      })

      // Add system messages
      curationChat?.forEach((msg) => {
        let content = ''
        if (msg.message_type === 'asset_added') {
          content = `Asset added: ${msg.asset_summary || 'Unknown'}`
        } else if (msg.message_type === 'asset_backed') {
          content = `Asset backed: ${msg.asset_summary || 'Unknown'}`
        } else if (msg.message_type === 'asset_verified') {
          content = `Asset verified: ${msg.asset_summary || 'Unknown'}`
        } else if (msg.message_type === 'asset_hidden') {
          content = `Asset hidden: ${msg.asset_summary || 'Unknown'}`
        } else if (msg.message_type === 'wallet_banned') {
          content = `Wallet banned: ${msg.wallet_address ? shortenAddress(msg.wallet_address) : 'Unknown'}`
        } else {
          content = msg.message_type || 'System event'
        }

        merged.push({
          id: `system-${msg.id}`,
          type: 'system',
          timestamp: msg.created_at,
          wallet: msg.wallet_address || null,
          tier: null,
          tokenPercentage: msg.token_percentage || null,
          content,
          messageType: msg.message_type,
          originalData: msg
        })
      })

      // Sort by timestamp DESC (newest first)
      merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setMergedMessages(merged)
      setFilteredMessages(merged)
    } catch (error) {
      console.error('Error loading chat messages:', error)
    }
  }

  const loadPendingAssets = async () => {
    if (!project) return

    try {
      // Fetch pending assets with all their votes
      const { data: assets, error } = await supabase
        .from('pending_assets')
        .select(`
          *,
          asset_votes (*)
        `)
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Type assertion for votes relationship
      const assetsWithVotes = (assets || []).map((asset: any) => ({
        ...asset,
        votes: asset.asset_votes || []
      }))

      setPendingAssets(assets || [])
      setPendingAssetsWithVotes(assetsWithVotes)
      setFilteredPendingAssets(assetsWithVotes)
    } catch (error) {
      console.error('Error loading pending assets:', error)
      toast.error('Failed to load pending assets')
    }
  }

  const loadKarmaData = async () => {
    if (!project) return

    try {
      const { data } = await supabase
        .from('wallet_karma')
        .select('*')
        .eq('project_id', project.id)
        .order('total_karma_points', { ascending: false })

      setKarmaLeaderboard(data || [])
      setKarmaRecords(data || [])
      setFilteredKarmaRecords(data || [])
    } catch (error) {
      console.error('Error loading karma data:', error)
      toast.error('Failed to load karma data')
    }
  }

  const loadVerifiedAssets = async () => {
    if (!project) return

    try {
      // Load verified social assets
      const { data: social } = await supabase
        .from('social_assets')
        .select('*')
        .eq('project_id', project.id)
        .eq('verified', true)
        .order('created_at', { ascending: false })

      // Load creative assets
      const { data: creative } = await supabase
        .from('creative_assets')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })

      // Load legal assets
      const { data: legal } = await supabase
        .from('legal_assets')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })

      setVerifiedSocialAssets(social || [])
      setVerifiedCreativeAssets(creative || [])
      setVerifiedLegalAssets(legal || [])
    } catch (error) {
      console.error('Error loading verified assets:', error)
    }
  }

  const loadActivityLogs = async () => {
    if (!project) return

    try {
      setLoadingLogs(true)
      
      // Fetch logs with project info
      const { data: logs } = await supabase
        .from('admin_logs')
        .select(`
          *,
          projects (name, token_symbol)
        `)
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })

      setActivityLogs(logs || [])
      setFilteredLogs(logs || [])
      
      // Calculate stats
      await calculateLogStats(logs || [])
    } catch (error) {
      console.error('Error loading activity logs:', error)
      toast.error('Failed to load activity logs')
    } finally {
      setLoadingLogs(false)
    }
  }

  const calculateLogStats = async (logs: AdminLogWithProject[]) => {
    if (!project) return

    try {
      // Total actions
      const totalActions = logs.length

      // Actions today
      const today = new Date().toISOString().split('T')[0]
      const actionsToday = logs.filter(log => 
        log.created_at.startsWith(today)
      ).length

      // Most active admin
      const adminCounts = logs.reduce((acc, log) => {
        acc[log.admin_wallet] = (acc[log.admin_wallet] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      const mostActiveAdmin = Object.entries(adminCounts)
        .sort((a, b) => b[1] - a[1])[0]

      // Most common action
      const actionCounts = logs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      const mostCommonAction = Object.entries(actionCounts)
        .sort((a, b) => b[1] - a[1])[0]

      setLogStats({
        totalActions,
        actionsToday,
        mostActiveAdmin: mostActiveAdmin ? {
          wallet: mostActiveAdmin[0],
          count: mostActiveAdmin[1]
        } : null,
        mostCommonAction: mostCommonAction ? {
          action: mostCommonAction[0],
          count: mostCommonAction[1]
        } : null
      })
    } catch (error) {
      console.error('Error calculating log stats:', error)
    }
  }

  const handleUpdateProject = async () => {
    if (!project) return

    try {
      // OPTIMISTIC UPDATE: Update UI immediately
      setProject({
        ...project,
        token_name: editFormData.token_name,
        token_symbol: editFormData.token_symbol,
        description: editFormData.description,
        profile_image_url: editFormData.profile_image_url,
        updated_at: new Date().toISOString()
      })
      setShowEditModal(false)
      
      const { error } = await supabase
        .from('projects')
        .update({
          token_name: editFormData.token_name,
          token_symbol: editFormData.token_symbol,
          description: editFormData.description,
          profile_image_url: editFormData.profile_image_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id)

      if (error) throw error

      // Log the action
      await logAdminAction(
        'project_edited',
        'project',
        project.id,
        {
          changes: {
            token_name: { old: project.token_name, new: editFormData.token_name },
            token_symbol: { old: project.token_symbol, new: editFormData.token_symbol },
            description: { old: project.description, new: editFormData.description },
            profile_image_url: { old: project.profile_image_url, new: editFormData.profile_image_url }
          }
        }
      )

      toast.success('Project updated successfully')
    } catch (error) {
      console.error('Error updating project:', error)
      toast.error('Failed to update project')
      // ROLLBACK: Reload on error
      fetchProject()
    }
  }

  const handleChangeStatus = async () => {
    if (!project) return

    try {
      // OPTIMISTIC UPDATE: Update UI immediately
      setProject({
        ...project,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      setShowStatusModal(false)
      
      const { error } = await supabase
        .from('projects')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id)

      if (error) throw error

      // Log the action
      await logAdminAction(
        'status_changed',
        'project',
        project.id,
        {
          old_status: project.status,
          new_status: newStatus
        }
      )

      toast.success(`Project status changed to ${newStatus}`)
    } catch (error) {
      console.error('Error changing status:', error)
      toast.error('Failed to change status')
      // ROLLBACK: Reload on error
      fetchProject()
    }
  }

  const handleDeleteProject = async () => {
    if (!project) return

    try {
      // Delete in order: votes, pending_assets, karma, curation_messages, chat_messages, 
      // team_wallets, legal_assets, creative_assets, social_assets, project
      await supabase.from('asset_votes').delete().in(
        'pending_asset_id',
        (await supabase.from('pending_assets').select('id').eq('project_id', project.id)).data?.map(p => p.id) || []
      )
      await supabase.from('pending_assets').delete().eq('project_id', project.id)
      await supabase.from('wallet_karma').delete().eq('project_id', project.id)
      await supabase.from('curation_chat_messages').delete().eq('project_id', project.id)
      await supabase.from('chat_messages').delete().eq('project_id', project.id)
      await supabase.from('team_wallets').delete().eq('project_id', project.id)
      await supabase.from('legal_assets').delete().eq('project_id', project.id)
      await supabase.from('creative_assets').delete().eq('project_id', project.id)
      await supabase.from('social_assets').delete().eq('project_id', project.id)
      
      const { error } = await supabase.from('projects').delete().eq('id', project.id)
      if (error) throw error

      toast.success('Project deleted successfully')
      router.push('/admin')
    } catch (error) {
      console.error('Error deleting project:', error)
      toast.error('Failed to delete project')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  // Check for unsaved changes
  useEffect(() => {
    if (currentTab === 'profile' && Object.keys(originalFormData).length > 0) {
      const hasChanges = JSON.stringify(profileFormData) !== JSON.stringify(originalFormData)
      setHasUnsavedChanges(hasChanges)
    }
  }, [profileFormData, originalFormData, currentTab])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (hasUnsavedChanges) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = ''
      }
      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  // Handle image file selection
  const handleImageFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('Image must be less than 5MB')
      return
    }

    setImageFile(file)
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(file)
    setImagePreviewUrl(previewUrl)
    
    toast.success('Image selected. Click "Save All Changes" to upload.')
  }

  // Handle image URL change
  const handleImageUrlChange = (url: string) => {
    setProfileFormData({ ...profileFormData, profile_image_url: url })
    setImagePreviewUrl(url || null)
  }

  // Upload image to Supabase Storage
  const uploadImageToStorage = async (file: File): Promise<string | null> => {
    try {
      setUploadingImage(true)
      setUploadProgress(0)

      const fileExt = file.name.split('.').pop()
      const fileName = `${project!.id}-${Date.now()}.${fileExt}`
      const filePath = `project-profiles/${fileName}`

      // Simulate progress
      setUploadProgress(30)

      const { error: uploadError } = await supabase.storage
        .from('project-assets')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type
        })

      if (uploadError) throw uploadError

      setUploadProgress(70)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('project-assets')
        .getPublicUrl(filePath)

      setUploadProgress(100)

      return publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error('Failed to upload image')
      return null
    } finally {
      setUploadingImage(false)
      setUploadProgress(0)
    }
  }

  // Save all profile changes
  const handleSaveProfileChanges = async () => {
    if (!project) return

    try {
      setSavingProfile(true)

      let imageUrl = profileFormData.profile_image_url

      // Upload new image if selected
      if (imageFile) {
        const uploadedUrl = await uploadImageToStorage(imageFile)
        if (uploadedUrl) {
          imageUrl = uploadedUrl
          setImageFile(null)
        } else {
          toast.error('Failed to upload image. Other changes will still be saved.')
        }
      }

      // OPTIMISTIC UPDATE: Update UI immediately
      setProject({
        ...project,
        token_name: profileFormData.token_name,
        token_symbol: profileFormData.token_symbol,
        creator_wallet: profileFormData.creator_wallet,
        description: profileFormData.description,
        profile_image_url: imageUrl,
        status: profileFormData.status,
        updated_at: new Date().toISOString()
      })
      setOriginalFormData(JSON.parse(JSON.stringify(profileFormData)))
      setHasUnsavedChanges(false)

      // Update project
      const { error } = await supabase
        .from('projects')
        .update({
          token_name: profileFormData.token_name,
          token_symbol: profileFormData.token_symbol,
          creator_wallet: profileFormData.creator_wallet,
          description: profileFormData.description,
          profile_image_url: imageUrl,
          status: profileFormData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id)

      if (error) throw error

      toast.success('Profile updated successfully!')
    } catch (error) {
      console.error('Error saving profile:', error)
      toast.error('Failed to save profile changes')
      // ROLLBACK: Reload on error
      await fetchProject()
    } finally {
      setSavingProfile(false)
    }
  }

  // Discard changes
  const handleDiscardChanges = () => {
    if (confirm('Are you sure you want to discard all changes?')) {
      setProfileFormData(JSON.parse(JSON.stringify(originalFormData)))
      setImageFile(null)
      setImagePreviewUrl(originalFormData.profile_image_url || null)
      setHasUnsavedChanges(false)
      toast.success('Changes discarded')
    }
  }

  // Remove image
  const handleRemoveImage = () => {
    if (confirm('Remove profile image?')) {
      setProfileFormData({ ...profileFormData, profile_image_url: null })
      setImagePreviewUrl(null)
      setImageFile(null)
      toast.success('Image will be removed when you save')
    }
  }

  // Clear description
  const handleClearDescription = () => {
    if (confirm('Clear description?')) {
      setProfileFormData({ ...profileFormData, description: '' })
      toast.success('Description cleared')
    }
  }

  // Get changes diff
  const getChangesDiff = () => {
    const changes: string[] = []
    Object.keys(profileFormData).forEach(key => {
      if (profileFormData[key] !== originalFormData[key]) {
        changes.push(key)
      }
    })
    if (imageFile) changes.push('profile_image (new file)')
    return changes
  }

  // Apply filters to messages
  useEffect(() => {
    let filtered = [...mergedMessages]

    // Filter by message type
    if (messageTypeFilter === 'user') {
      filtered = filtered.filter(m => m.type === 'user')
    } else if (messageTypeFilter === 'system') {
      filtered = filtered.filter(m => m.type === 'system')
    }

    // Filter by tier
    if (tierFilter !== 'all') {
      filtered = filtered.filter(m => m.tier?.toLowerCase() === tierFilter.toLowerCase())
    }

    // Filter by wallet search
    if (walletSearch.trim()) {
      const search = walletSearch.toLowerCase()
      filtered = filtered.filter(m => 
        m.wallet?.toLowerCase().includes(search)
      )
    }

    // Filter by date range
    if (dateFrom) {
      const fromDate = new Date(dateFrom).getTime()
      filtered = filtered.filter(m => new Date(m.timestamp).getTime() >= fromDate)
    }
    if (dateTo) {
      const toDate = new Date(dateTo).getTime() + 86400000 // Add 1 day
      filtered = filtered.filter(m => new Date(m.timestamp).getTime() <= toDate)
    }

    setFilteredMessages(filtered)
  }, [mergedMessages, messageTypeFilter, tierFilter, walletSearch, dateFrom, dateTo])

  // Handle individual message delete
  const handleDeleteMessage = async (message: MergedMessage) => {
    if (!confirm('Delete this message? This cannot be undone.')) return

    try {
      setDeletingMessages(true)

      // OPTIMISTIC UPDATE: Remove from UI immediately
      setMergedMessages(prev => prev.filter(m => m.id !== message.id))

      if (message.type === 'user') {
        const originalId = (message.originalData as ChatMessage).id
        const { error } = await supabase
          .from('chat_messages')
          .delete()
          .eq('id', originalId)

        if (error) throw error
      } else {
        const originalId = (message.originalData as CurationMessage).id
        const { error } = await supabase
          .from('curation_chat_messages')
          .delete()
          .eq('id', originalId)

        if (error) throw error
      }

      toast.success('Message deleted')
    } catch (error) {
      console.error('Error deleting message:', error)
      toast.error('Failed to delete message')
      // ROLLBACK: Reload on error
      await loadChatMessages()
    } finally {
      setDeletingMessages(false)
    }
  }

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedMessages.size === 0) return

    const count = selectedMessages.size
    if (!confirm(`Delete ${count} message${count > 1 ? 's' : ''}? This cannot be undone.`)) return

    try {
      setDeletingMessages(true)

      // Separate user and system message IDs
      const userIds: string[] = []
      const systemIds: string[] = []

      selectedMessages.forEach(id => {
        const message = mergedMessages.find(m => m.id === id)
        if (!message) return

        if (message.type === 'user') {
          userIds.push((message.originalData as ChatMessage).id)
        } else {
          systemIds.push((message.originalData as CurationMessage).id)
        }
      })

      // OPTIMISTIC UPDATE: Remove from UI immediately
      setMergedMessages(prev => prev.filter(m => !selectedMessages.has(m.id)))
      setSelectedMessages(new Set())

      // Delete user messages
      if (userIds.length > 0) {
        const { error } = await supabase
          .from('chat_messages')
          .delete()
          .in('id', userIds)

        if (error) throw error
      }

      // Delete system messages
      if (systemIds.length > 0) {
        const { error } = await supabase
          .from('curation_chat_messages')
          .delete()
          .in('id', systemIds)

        if (error) throw error
      }

      toast.success(`${count} message${count > 1 ? 's' : ''} deleted`)
    } catch (error) {
      console.error('Error deleting messages:', error)
      toast.error('Failed to delete messages')
      // ROLLBACK: Reload on error
      await loadChatMessages()
    } finally {
      setDeletingMessages(false)
    }
  }

  // Toggle message selection
  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  // Select all filtered messages
  const handleSelectAll = () => {
    if (selectedMessages.size === filteredMessages.length) {
      setSelectedMessages(new Set())
    } else {
      setSelectedMessages(new Set(filteredMessages.map(m => m.id)))
    }
  }

  // Format timestamp with seconds
  const formatTimestampFull = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  // Get tier color
  const getTierColor = (tier: string | null) => {
    if (!tier) return 'default'
    switch (tier.toLowerCase()) {
      case 'mega': return 'error'
      case 'whale': return 'primary'
      case 'holder': return 'success'
      case 'small': return 'default'
      default: return 'default'
    }
  }

  // Social Asset Handlers
  const handleEditSocialAsset = (asset: SocialAsset) => {
    setEditingSocialAsset(asset)
    setSocialFormData({
      handle: asset.handle,
      followerTier: asset.follower_tier || '',
      platform: asset.platform,
      verificationCode: asset.verification_code || ''
    })
  }

  const handleSaveSocialAsset = async () => {
    if (!editingSocialAsset) return

    try {
      setProcessingAsset(true)
      
      // OPTIMISTIC UPDATE: Update UI immediately
      setVerifiedSocialAssets(prev => prev.map(asset => 
        asset.id === editingSocialAsset.id
          ? {
              ...asset,
              handle: socialFormData.handle,
              follower_tier: socialFormData.followerTier || null,
              verification_code: socialFormData.verificationCode || null
            }
          : asset
      ))
      
      const { error } = await supabase
        .from('social_assets')
        .update({
          handle: socialFormData.handle,
          follower_tier: socialFormData.followerTier || null,
          verification_code: socialFormData.verificationCode || null
        })
        .eq('id', editingSocialAsset.id)

      if (error) throw error

      toast.success('Social asset updated')
      setEditingSocialAsset(null)
    } catch (error) {
      console.error('Error updating social asset:', error)
      toast.error('Failed to update social asset')
      // ROLLBACK: Reload on error
      await loadVerifiedAssets()
    } finally {
      setProcessingAsset(false)
    }
  }

  const handleUnverifySocialAsset = async (assetId: string) => {
    if (!confirm('Unverify this social asset? It will move back to pending status.')) return

    try {
      // OPTIMISTIC UPDATE: Remove from UI immediately (unverified assets don't show here)
      setVerifiedSocialAssets(prev => prev.filter(asset => asset.id !== assetId))
      
      const { error } = await supabase
        .from('social_assets')
        .update({ 
          verified: false, 
          verified_at: null
        })
        .eq('id', assetId)

      if (error) throw error

      toast.success('Social asset unverified')
    } catch (error) {
      console.error('Error unverifying social asset:', error)
      toast.error('Failed to unverify social asset')
      // ROLLBACK: Reload on error
      await loadVerifiedAssets()
    }
  }

  const handleDeleteSocialAsset = async (assetId: string) => {
    if (!confirm('Delete this social asset permanently? This cannot be undone.')) return

    try {
      // OPTIMISTIC UPDATE: Remove from UI immediately
      setVerifiedSocialAssets(prev => prev.filter(asset => asset.id !== assetId))
      
      const { error } = await supabase
        .from('social_assets')
        .delete()
        .eq('id', assetId)

      if (error) throw error

      toast.success('Social asset deleted')
    } catch (error) {
      console.error('Error deleting social asset:', error)
      toast.error('Failed to delete social asset')
      // ROLLBACK: Reload on error
      await loadVerifiedAssets()
    }
  }

  // Creative Asset Handlers
  const handleEditCreativeAsset = (asset: CreativeAsset) => {
    setEditingCreativeAsset(asset)
    setCreativeFormData({
      assetType: asset.asset_type,
      name: asset.asset_name || '',
      description: asset.description || '',
      mediaUrl: asset.media_url || ''
    })
  }

  const handleSaveCreativeAsset = async () => {
    if (!editingCreativeAsset) return

    try {
      setProcessingAsset(true)
      
      // OPTIMISTIC UPDATE: Update UI immediately
      setVerifiedCreativeAssets(prev => prev.map(asset => 
        asset.id === editingCreativeAsset.id
          ? {
              ...asset,
              asset_type: creativeFormData.assetType,
              asset_name: creativeFormData.name,
              description: creativeFormData.description,
              media_url: creativeFormData.mediaUrl || null
            }
          : asset
      ))
      
      const { error } = await supabase
        .from('creative_assets')
        .update({
          asset_type: creativeFormData.assetType,
          asset_name: creativeFormData.name,
          description: creativeFormData.description,
          media_url: creativeFormData.mediaUrl || null
        })
        .eq('id', editingCreativeAsset.id)

      if (error) throw error

      toast.success('Creative asset updated')
      setEditingCreativeAsset(null)
    } catch (error) {
      console.error('Error updating creative asset:', error)
      toast.error('Failed to update creative asset')
      // ROLLBACK: Reload on error
      await loadVerifiedAssets()
    } finally {
      setProcessingAsset(false)
    }
  }

  const handleDeleteCreativeAsset = async (assetId: string) => {
    if (!confirm('Delete this creative asset permanently? This cannot be undone.')) return

    // Get asset data before deleting for logging
    const assetToDelete = verifiedCreativeAssets.find(a => a.id === assetId)

    try {
      // OPTIMISTIC UPDATE: Remove from UI immediately
      setVerifiedCreativeAssets(prev => prev.filter(asset => asset.id !== assetId))
      
      const { error } = await supabase
        .from('creative_assets')
        .delete()
        .eq('id', assetId)

      if (error) throw error

      // Log the action
      if (assetToDelete) {
        await logAdminAction(
          'asset_deleted',
          'asset',
          assetId,
          {
            assetType: 'creative',
            assetData: {
              asset_type: assetToDelete.asset_type,
              name: assetToDelete.name,
              description: assetToDelete.description
            }
          }
        )
      }

      toast.success('Creative asset deleted')
    } catch (error) {
      console.error('Error deleting creative asset:', error)
      toast.error('Failed to delete creative asset')
      // ROLLBACK: Reload on error
      await loadVerifiedAssets()
    }
  }

  // Legal Asset Handlers
  const handleEditLegalAsset = (asset: LegalAsset) => {
    setEditingLegalAsset(asset)
    setLegalFormData({
      assetType: asset.asset_type,
      name: asset.asset_name || '',
      status: asset.status || 'active',
      jurisdiction: asset.jurisdiction || '',
      registrationId: asset.registration_id || ''
    })
  }

  const handleSaveLegalAsset = async () => {
    if (!editingLegalAsset) return

    try {
      setProcessingAsset(true)
      
      // OPTIMISTIC UPDATE: Update UI immediately
      setVerifiedLegalAssets(prev => prev.map(asset => 
        asset.id === editingLegalAsset.id
          ? {
              ...asset,
              asset_type: legalFormData.assetType,
              asset_name: legalFormData.name,
              status: legalFormData.status,
              jurisdiction: legalFormData.jurisdiction || null,
              registration_id: legalFormData.registrationId || null
            }
          : asset
      ))
      
      const { error } = await supabase
        .from('legal_assets')
        .update({
          asset_type: legalFormData.assetType,
          asset_name: legalFormData.name,
          status: legalFormData.status,
          jurisdiction: legalFormData.jurisdiction || null,
          registration_id: legalFormData.registrationId || null
        })
        .eq('id', editingLegalAsset.id)

      if (error) throw error

      toast.success('Legal asset updated')
      setEditingLegalAsset(null)
    } catch (error) {
      console.error('Error updating legal asset:', error)
      toast.error('Failed to update legal asset')
      // ROLLBACK: Reload on error
      await loadVerifiedAssets()
    } finally {
      setProcessingAsset(false)
    }
  }

  const handleDeleteLegalAsset = async (assetId: string) => {
    if (!confirm('Delete this legal asset permanently? This cannot be undone.')) return

    try {
      // OPTIMISTIC UPDATE: Remove from UI immediately
      setVerifiedLegalAssets(prev => prev.filter(asset => asset.id !== assetId))
      
      const { error } = await supabase
        .from('legal_assets')
        .delete()
        .eq('id', assetId)

      if (error) throw error

      toast.success('Legal asset deleted')
    } catch (error) {
      console.error('Error deleting legal asset:', error)
      toast.error('Failed to delete legal asset')
      // ROLLBACK: Reload on error
      await loadVerifiedAssets()
    }
  }

  // Bulk delete handlers
  const handleBulkDeleteSocial = async () => {
    if (selectedSocialAssets.size === 0) return
    if (!confirm(`Delete ${selectedSocialAssets.size} social assets?`)) return

    try {
      const idsToDelete = Array.from(selectedSocialAssets)
      
      // OPTIMISTIC UPDATE: Remove from UI immediately
      setVerifiedSocialAssets(prev => prev.filter(asset => !selectedSocialAssets.has(asset.id)))
      setSelectedSocialAssets(new Set())
      
      const { error } = await supabase
        .from('social_assets')
        .delete()
        .in('id', idsToDelete)

      if (error) throw error

      toast.success(`${idsToDelete.length} social assets deleted`)
    } catch (error) {
      console.error('Error deleting social assets:', error)
      toast.error('Failed to delete social assets')
      // ROLLBACK: Reload on error
      await loadVerifiedAssets()
    }
  }

  const handleBulkDeleteCreative = async () => {
    if (selectedCreativeAssets.size === 0) return
    if (!confirm(`Delete ${selectedCreativeAssets.size} creative assets?`)) return

    try {
      const idsToDelete = Array.from(selectedCreativeAssets)
      
      // OPTIMISTIC UPDATE: Remove from UI immediately
      setVerifiedCreativeAssets(prev => prev.filter(asset => !selectedCreativeAssets.has(asset.id)))
      setSelectedCreativeAssets(new Set())
      
      const { error } = await supabase
        .from('creative_assets')
        .delete()
        .in('id', idsToDelete)

      if (error) throw error

      toast.success(`${idsToDelete.length} creative assets deleted`)
    } catch (error) {
      console.error('Error deleting creative assets:', error)
      toast.error('Failed to delete creative assets')
      // ROLLBACK: Reload on error
      await loadVerifiedAssets()
    }
  }

  const handleBulkDeleteLegal = async () => {
    if (selectedLegalAssets.size === 0) return
    if (!confirm(`Delete ${selectedLegalAssets.size} legal assets?`)) return

    try {
      const idsToDelete = Array.from(selectedLegalAssets)
      
      // OPTIMISTIC UPDATE: Remove from UI immediately
      setVerifiedLegalAssets(prev => prev.filter(asset => !selectedLegalAssets.has(asset.id)))
      setSelectedLegalAssets(new Set())
      
      const { error } = await supabase
        .from('legal_assets')
        .delete()
        .in('id', idsToDelete)

      if (error) throw error

      toast.success(`${idsToDelete.length} legal assets deleted`)
    } catch (error) {
      console.error('Error deleting legal assets:', error)
      toast.error('Failed to delete legal assets')
      // ROLLBACK: Reload on error
      await loadVerifiedAssets()
    }
  }

  // Export as JSON
  const handleExportAssets = (type: 'social' | 'creative' | 'legal') => {
    let data: any[] = []
    let filename = ''

    if (type === 'social') {
      data = verifiedSocialAssets
      filename = `social-assets-${project?.token_symbol}.json`
    } else if (type === 'creative') {
      data = verifiedCreativeAssets
      filename = `creative-assets-${project?.token_symbol}.json`
    } else {
      data = verifiedLegalAssets
      filename = `legal-assets-${project?.token_symbol}.json`
    }

    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Assets exported')
  }

  // Get platform icon
  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      twitter: '𝕏',
      instagram: '📷',
      youtube: '📺',
      tiktok: '🎵',
      linkedin: '💼',
      discord: '💬'
    }
    return icons[platform.toLowerCase()] || '🌐'
  }

  // Pending Assets helpers
  const extractAssetSummary = (assetType: string, assetData: any): string => {
    if (assetType === 'social' && assetData.platform && assetData.handle) {
      return `${getPlatformIcon(assetData.platform)} ${assetData.platform} @${assetData.handle}`
    } else if (assetType === 'creative' && assetData.name) {
      return `🎨 ${assetData.asset_type || 'Creative'}: ${assetData.name}`
    } else if (assetType === 'legal' && assetData.name) {
      return `⚖️ ${assetData.asset_type || 'Legal'}: ${assetData.name}`
    }
    return 'Asset'
  }

  const getStatusColor = (status: string): 'default' | 'warning' | 'success' | 'error' => {
    switch (status) {
      case 'pending': return 'default'
      case 'backed': return 'warning'
      case 'verified': return 'success'
      case 'hidden': return 'error'
      default: return 'default'
    }
  }

  const calculateVerificationProgress = (asset: PendingAssetWithVotes): number => {
    const supplyPercent = asset.total_upvote_weight
    const voterCount = asset.unique_upvoters_count
    
    // Either 5% supply OR 10 voters needed for verification
    const supplyProgress = (supplyPercent / 5) * 100
    const voterProgress = (voterCount / 10) * 100
    
    return Math.min(Math.max(supplyProgress, voterProgress), 100)
  }

  // Apply filters to pending assets
  useEffect(() => {
    let filtered = [...pendingAssetsWithVotes]

    // Status filter
    if (pendingStatusFilter !== 'all') {
      filtered = filtered.filter(a => a.verification_status === pendingStatusFilter)
    }

    // Type filter
    if (pendingTypeFilter !== 'all') {
      filtered = filtered.filter(a => a.asset_type === pendingTypeFilter)
    }

    // Wallet search
    if (pendingWalletSearch.trim()) {
      const search = pendingWalletSearch.toLowerCase()
      filtered = filtered.filter(a => a.submitter_wallet.toLowerCase().includes(search))
    }

    // Sort
    filtered.sort((a, b) => {
      switch (pendingSort) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'most-upvotes':
          return b.unique_upvoters_count - a.unique_upvoters_count
        case 'most-reports':
          return b.unique_reporters_count - a.unique_reporters_count
        case 'closest':
          return calculateVerificationProgress(b) - calculateVerificationProgress(a)
        default:
          return 0
      }
    })

    setFilteredPendingAssets(filtered)
  }, [pendingAssetsWithVotes, pendingStatusFilter, pendingTypeFilter, pendingWalletSearch, pendingSort])

  // Quick Approve asset (admin bypass)
  const handleQuickApprove = async (asset: PendingAssetWithVotes) => {
    const assetSummary = extractAssetSummary(asset.asset_type, asset.asset_data)
    
    if (!confirm(`Approve this asset?\n\n${assetSummary}\n\nThis will:\n- Move to verified status\n- Copy to verified ${asset.asset_type} assets table\n- Award karma to submitter & ${asset.unique_upvoters_count} voters\n- Create system announcement\n\nThis cannot be undone.`)) {
      return
    }

    try {
      setProcessingPendingAction(true)

      // 1. Copy to appropriate verified table based on type
      if (asset.asset_type === 'social') {
        const { error } = await supabase.from('social_assets').insert({
          project_id: asset.project_id,
          platform: asset.asset_data.platform,
          handle: asset.asset_data.handle,
          follower_tier: asset.asset_data.follower_tier || null,
          verification_code: asset.asset_data.verification_code || null,
          verified: true,
          verified_at: new Date().toISOString()
        })
        if (error) throw error
      } else if (asset.asset_type === 'creative') {
        const { error } = await supabase.from('creative_assets').insert({
          project_id: asset.project_id,
          asset_type: asset.asset_data.asset_type || 'other',
          asset_name: asset.asset_data.name || null,
          name: asset.asset_data.name || null,
          description: asset.asset_data.description || null,
          media_url: asset.asset_data.media_url || null
        })
        if (error) throw error
      } else if (asset.asset_type === 'legal') {
        const { error } = await supabase.from('legal_assets').insert({
          project_id: asset.project_id,
          asset_type: asset.asset_data.asset_type || 'other',
          asset_name: asset.asset_data.name || null,
          name: asset.asset_data.name || null,
          status: asset.asset_data.status || 'active',
          jurisdiction: asset.asset_data.jurisdiction || null,
          registration_id: asset.asset_data.registration_id || null
        })
        if (error) throw error
      }

      // 2. Update pending asset status
      const { error: updateError } = await supabase
        .from('pending_assets')
        .update({ 
          verification_status: 'verified',
          verified_at: new Date().toISOString()
        })
        .eq('id', asset.id)

      if (updateError) throw updateError

      // 3. Award delayed karma to submitter and upvoters
      // Note: This should ideally call the same karma logic as the cron job
      // For now, we'll manually award karma
      const BASE_KARMA = 10
      const upvoters = asset.votes.filter(v => v.vote_type === 'upvote')
      
      // Award submitter karma
      await supabase.rpc('increment_karma', {
        p_wallet: asset.submitter_wallet,
        p_project_id: asset.project_id,
        p_amount: BASE_KARMA
      })

      // Award voter karma
      for (const vote of upvoters) {
        await supabase.rpc('increment_karma', {
          p_wallet: vote.voter_wallet,
          p_project_id: asset.project_id,
          p_amount: Math.floor(BASE_KARMA * 0.2) // 20% of base for voters
        })
      }

      // 4. Create system message
      await supabase.from('curation_chat_messages').insert({
        project_id: asset.project_id,
        message_type: 'asset_verified',
        asset_type: asset.asset_type,
        asset_summary: assetSummary,
        pending_asset_id: asset.id,
        wallet_address: asset.submitter_wallet,
        token_percentage: asset.submitter_token_percentage,
        vote_count: asset.unique_upvoters_count,
        supply_percentage: asset.total_upvote_weight
      })

      toast.success(`Asset approved! Karma awarded to ${upvoters.length + 1} participants`)
      await loadPendingAssets()
    } catch (error) {
      console.error('Error approving asset:', error)
      toast.error('Failed to approve asset')
    } finally {
      setProcessingPendingAction(false)
    }
  }

  // Edit pending asset
  const handleEditPendingAsset = (asset: PendingAssetWithVotes) => {
    setEditingPendingAsset(asset)
    setPendingAssetFormData({
      assetData: JSON.stringify(asset.asset_data, null, 2),
      status: asset.verification_status,
      adminNote: asset.asset_data.admin_note || ''
    })
  }

  const handleSavePendingAsset = async () => {
    if (!editingPendingAsset) return

    try {
      setProcessingPendingAction(true)

      let parsedAssetData
      try {
        parsedAssetData = JSON.parse(pendingAssetFormData.assetData)
      } catch (e) {
        toast.error('Invalid JSON in asset data')
        return
      }

      // Add admin note to asset data
      if (pendingAssetFormData.adminNote) {
        parsedAssetData.admin_note = pendingAssetFormData.adminNote
      }

      const { error } = await supabase
        .from('pending_assets')
        .update({
          asset_data: parsedAssetData,
          verification_status: pendingAssetFormData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingPendingAsset.id)

      if (error) throw error

      toast.success('Pending asset updated')
      setEditingPendingAsset(null)
      await loadPendingAssets()
    } catch (error) {
      console.error('Error updating pending asset:', error)
      toast.error('Failed to update pending asset')
    } finally {
      setProcessingPendingAction(false)
    }
  }

  // Delete pending asset with full cleanup
  const handleDeletePendingAsset = async () => {
    if (!deletingAsset) return

    const assetName = extractAssetSummary(deletingAsset.asset_type, deletingAsset.asset_data)
    const expectedText = deletingAsset.asset_data.handle || deletingAsset.asset_data.name || 'DELETE'

    if (deleteConfirmText !== expectedText) {
      toast.error(`Please type "${expectedText}" to confirm deletion`)
      return
    }

    try {
      setProcessingPendingAction(true)

      // 1. Calculate karma to reverse
      const totalKarmaToReverse = deletingAsset.votes.reduce((sum, v) => sum + (v.karma_earned || 0), 0)

      // 2. Reverse karma for submitter
      if (deletingAsset.submitter_karma_earned) {
        await supabase.rpc('increment_karma', {
          p_wallet: deletingAsset.submitter_wallet,
          p_project_id: deletingAsset.project_id,
          p_amount: -deletingAsset.submitter_karma_earned
        })
      }

      // 3. Reverse karma for all voters
      for (const vote of deletingAsset.votes) {
        if (vote.karma_earned) {
          await supabase.rpc('increment_karma', {
            p_wallet: vote.voter_wallet,
            p_project_id: deletingAsset.project_id,
            p_amount: -vote.karma_earned
          })
        }
      }

      // 4. Delete system messages about this asset
      await supabase
        .from('curation_chat_messages')
        .delete()
        .eq('pending_asset_id', deletingAsset.id)

      // 5. Delete the asset (CASCADE will delete votes)
      const { error } = await supabase
        .from('pending_assets')
        .delete()
        .eq('id', deletingAsset.id)

      if (error) throw error

      toast.success(`Deleted asset, ${deletingAsset.votes.length} votes, reversed ${totalKarmaToReverse} karma points`)
      setDeletingAsset(null)
      setDeleteConfirmText('')
      await loadPendingAssets()
    } catch (error) {
      console.error('Error deleting pending asset:', error)
      toast.error('Failed to delete pending asset')
    } finally {
      setProcessingPendingAction(false)
    }
  }

  // Bulk operations
  const handleBulkApprovePending = async () => {
    if (selectedPendingAssets.size === 0) return

    const assets = filteredPendingAssets.filter(a => selectedPendingAssets.has(a.id))
    const totalKarma = assets.reduce((sum, a) => sum + (a.unique_upvoters_count + 1) * 10, 0)

    if (!confirm(`Approve ${assets.length} assets?\n\nThis will award ~${totalKarma} karma points to participants.\n\nThis cannot be undone.`)) {
      return
    }

    try {
      setProcessingPendingAction(true)

      for (const asset of assets) {
        await handleQuickApprove(asset)
      }

      setSelectedPendingAssets(new Set())
      toast.success(`${assets.length} assets approved!`)
    } catch (error) {
      console.error('Error bulk approving:', error)
      toast.error('Some assets failed to approve')
    } finally {
      setProcessingPendingAction(false)
    }
  }

  const handleBulkDeletePending = async () => {
    if (selectedPendingAssets.size === 0) return

    if (!confirm(`Delete ${selectedPendingAssets.size} assets? This will reverse all karma and cannot be undone.`)) {
      return
    }

    try {
      setProcessingPendingAction(true)

      const assets = filteredPendingAssets.filter(a => selectedPendingAssets.has(a.id))
      const idsToDelete = Array.from(selectedPendingAssets)
      
      // OPTIMISTIC UPDATE: Remove from UI immediately
      setPendingAssetsWithVotes(prev => prev.filter(a => !selectedPendingAssets.has(a.id)))
      setFilteredPendingAssets(prev => prev.filter(a => !selectedPendingAssets.has(a.id)))
      setSelectedPendingAssets(new Set())

      for (const asset of assets) {
        // Reverse karma
        for (const vote of asset.votes) {
          if (vote.karma_earned) {
            await supabase.rpc('increment_karma', {
              p_wallet: vote.voter_wallet,
              p_project_id: asset.project_id,
              p_amount: -vote.karma_earned
            })
          }
        }

        // Delete system messages
        await supabase
          .from('curation_chat_messages')
          .delete()
          .eq('pending_asset_id', asset.id)
      }

      // Bulk delete assets
      const { error } = await supabase
        .from('pending_assets')
        .delete()
        .in('id', idsToDelete)

      if (error) throw error

      toast.success(`${idsToDelete.length} assets deleted`)
    } catch (error) {
      console.error('Error bulk deleting:', error)
      toast.error('Failed to delete assets')
      // ROLLBACK: Reload on error
      await loadPendingAssets()
    } finally {
      setProcessingPendingAction(false)
    }
  }

  const handleBulkHidePending = async () => {
    if (selectedPendingAssets.size === 0) return

    try {
      setProcessingPendingAction(true)

      const { error } = await supabase
        .from('pending_assets')
        .update({ verification_status: 'hidden' })
        .in('id', Array.from(selectedPendingAssets))

      if (error) throw error

      toast.success(`${selectedPendingAssets.size} assets hidden`)
      setSelectedPendingAssets(new Set())
      await loadPendingAssets()
    } catch (error) {
      console.error('Error hiding assets:', error)
      toast.error('Failed to hide assets')
    } finally {
      setProcessingPendingAction(false)
    }
  }

  // Calculate pending assets stats
  const getPendingStats = () => {
    const total = pendingAssetsWithVotes.length
    const backed = pendingAssetsWithVotes.filter(a => a.verification_status === 'backed').length
    const verified = pendingAssetsWithVotes.filter(a => a.verification_status === 'verified').length
    const hidden = pendingAssetsWithVotes.filter(a => a.verification_status === 'hidden').length
    const totalVotes = pendingAssetsWithVotes.reduce((sum, a) => sum + a.votes.length, 0)

    return { total, backed, verified, hidden, totalVotes }
  }

  // Karma & Votes helpers
  const getTierFromPercentage = (percentage: number): string => {
    if (percentage >= 5) return 'mega'
    if (percentage >= 1) return 'whale'
    if (percentage >= 0.1) return 'holder'
    return 'small'
  }

  const getTierMultiplier = (tier: string): number => {
    switch (tier.toLowerCase()) {
      case 'mega': return 7
      case 'whale': return 5.5
      case 'holder': return 3
      case 'small': return 1
      default: return 1
    }
  }

  const getTierBadgeColor = (tier: string): 'error' | 'primary' | 'success' | 'default' => {
    switch (tier.toLowerCase()) {
      case 'mega': return 'error'
      case 'whale': return 'primary'
      case 'holder': return 'success'
      case 'small': return 'default'
      default: return 'default'
    }
  }

  const calculateBanExpiry = (duration: '7d' | '30d' | 'permanent'): string | null => {
    if (duration === 'permanent') return null
    
    const days = duration === '7d' ? 7 : 30
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + days)
    return expiry.toISOString()
  }

  // Filter karma records
  useEffect(() => {
    let filtered = [...karmaRecords]

    // Tier filter (would need current token percentage to determine tier)
    // For now, filter by existing tier data if available

    // Status filter
    if (karmaStatusFilter === 'banned') {
      filtered = filtered.filter(k => k.is_banned)
    } else if (karmaStatusFilter === 'warned') {
      filtered = filtered.filter(k => k.warning_count > 0 && !k.is_banned)
    } else if (karmaStatusFilter === 'active') {
      filtered = filtered.filter(k => !k.is_banned && k.warning_count === 0)
    }

    // Wallet search
    if (karmaWalletSearch.trim()) {
      const search = karmaWalletSearch.toLowerCase()
      filtered = filtered.filter(k => k.wallet_address.toLowerCase().includes(search))
    }

    // Sort
    filtered.sort((a, b) => {
      switch (karmaSort) {
        case 'karma-desc':
          return b.total_karma_points - a.total_karma_points
        case 'karma-asc':
          return a.total_karma_points - b.total_karma_points
        case 'assets-added':
          return (b.assets_added_count || 0) - (a.assets_added_count || 0)
        default:
          return 0
      }
    })

    setFilteredKarmaRecords(filtered)
  }, [karmaRecords, karmaTierFilter, karmaStatusFilter, karmaWalletSearch, karmaSort])

  // Adjust karma
  const handleAdjustKarma = async () => {
    if (!adjustingKarmaWallet || karmaAdjustAmount === 0 || !karmaAdjustReason.trim()) {
      toast.error('Please provide amount and reason')
      return
    }

    try {
      setProcessingKarmaAction(true)

      const oldKarma = adjustingKarmaWallet.total_karma_points
      const newKarma = oldKarma + karmaAdjustAmount

      // OPTIMISTIC UPDATE: Update UI immediately
      setKarmaRecords(prev => prev.map(k => 
        k.wallet_address === adjustingKarmaWallet.wallet_address
          ? { ...k, total_karma_points: newKarma }
          : k
      ))
      setFilteredKarmaRecords(prev => prev.map(k => 
        k.wallet_address === adjustingKarmaWallet.wallet_address
          ? { ...k, total_karma_points: newKarma }
          : k
      ))
      setAdjustingKarmaWallet(null)
      setKarmaAdjustAmount(0)
      setKarmaAdjustReason('')

      // Adjust karma using RPC function
      await supabase.rpc('increment_karma', {
        p_wallet: adjustingKarmaWallet.wallet_address,
        p_project_id: adjustingKarmaWallet.project_id,
        p_amount: karmaAdjustAmount
      })

      toast.success(`Karma adjusted: ${oldKarma} → ${newKarma}`)
    } catch (error) {
      console.error('Error adjusting karma:', error)
      toast.error('Failed to adjust karma')
      // ROLLBACK: Reload on error
      await loadKarmaData()
    } finally {
      setProcessingKarmaAction(false)
    }
  }

  // Clear warnings
  const handleClearWarnings = async (wallet: WalletKarma) => {
    if (!confirm(`Clear all ${wallet.warning_count} warning(s) for this wallet?`)) return

    try {
      setProcessingKarmaAction(true)

      // OPTIMISTIC UPDATE: Clear warnings immediately
      setKarmaRecords(prev => prev.map(k => 
        k.wallet_address === wallet.wallet_address
          ? { ...k, warning_count: 0, warnings: [] }
          : k
      ))
      setFilteredKarmaRecords(prev => prev.map(k => 
        k.wallet_address === wallet.wallet_address
          ? { ...k, warning_count: 0, warnings: [] }
          : k
      ))

      const { error } = await supabase
        .from('wallet_karma')
        .update({
          warning_count: 0,
          warnings: []
        })
        .eq('wallet_address', wallet.wallet_address)
        .eq('project_id', wallet.project_id)

      if (error) throw error

      toast.success('Warnings cleared')
    } catch (error) {
      console.error('Error clearing warnings:', error)
      toast.error('Failed to clear warnings')
      // ROLLBACK: Reload on error
      await loadKarmaData()
    } finally {
      setProcessingKarmaAction(false)
    }
  }

  // Ban wallet
  const handleBanWallet = async () => {
    if (!banningWallet || !banReason.trim()) {
      toast.error('Please provide ban reason')
      return
    }

    const expiryDate = calculateBanExpiry(banDuration)
    const expiryText = expiryDate 
      ? new Date(expiryDate).toLocaleDateString()
      : 'Never (Permanent)'

    if (!confirm(`Ban this wallet?\n\nDuration: ${banDuration === '7d' ? '7 days' : banDuration === '30d' ? '30 days' : 'Permanent'}\nExpires: ${expiryText}\nReason: ${banReason}\n\nUser won't be able to vote or submit assets.`)) {
      return
    }

    try {
      setProcessingKarmaAction(true)

      const existingWarnings = banningWallet.warnings || []
      const newWarning = {
        timestamp: new Date().toISOString(),
        reason: banReason,
        type: 'ban'
      }
      
      // OPTIMISTIC UPDATE: Ban immediately in UI
      setKarmaRecords(prev => prev.map(k => 
        k.wallet_address === banningWallet.wallet_address
          ? {
              ...k,
              is_banned: true,
              banned_at: new Date().toISOString(),
              ban_expires_at: expiryDate,
              warnings: [...existingWarnings, newWarning],
              warning_count: existingWarnings.length + 1
            }
          : k
      ))
      setFilteredKarmaRecords(prev => prev.map(k => 
        k.wallet_address === banningWallet.wallet_address
          ? {
              ...k,
              is_banned: true,
              banned_at: new Date().toISOString(),
              ban_expires_at: expiryDate,
              warnings: [...existingWarnings, newWarning],
              warning_count: existingWarnings.length + 1
            }
          : k
      ))
      setBanningWallet(null)
      setBanReason('')
      
      const { error } = await supabase
        .from('wallet_karma')
        .update({
          is_banned: true,
          banned_at: new Date().toISOString(),
          ban_expires_at: expiryDate,
          warnings: [...existingWarnings, newWarning],
          warning_count: existingWarnings.length + 1
        })
        .eq('wallet_address', banningWallet.wallet_address)
        .eq('project_id', banningWallet.project_id)

      if (error) throw error

      // Create system message
      await supabase.from('curation_chat_messages').insert({
        project_id: banningWallet.project_id,
        message_type: 'wallet_banned',
        wallet_address: banningWallet.wallet_address,
        asset_summary: banReason
      })

      toast.success('Wallet banned')
    } catch (error) {
      console.error('Error banning wallet:', error)
      toast.error('Failed to ban wallet')
      // ROLLBACK: Reload on error
      await loadKarmaData()
    } finally {
      setProcessingKarmaAction(false)
    }
  }

  // Unban wallet
  const handleUnbanWallet = async (wallet: WalletKarma) => {
    if (!confirm(`Unban this wallet? They will be able to vote and submit assets again.`)) return

    try {
      setProcessingKarmaAction(true)

      // OPTIMISTIC UPDATE: Unban immediately in UI
      setKarmaRecords(prev => prev.map(k => 
        k.wallet_address === wallet.wallet_address
          ? {
              ...k,
              is_banned: false,
              banned_at: null,
              ban_expires_at: null
            }
          : k
      ))
      setFilteredKarmaRecords(prev => prev.map(k => 
        k.wallet_address === wallet.wallet_address
          ? {
              ...k,
              is_banned: false,
              banned_at: null,
              ban_expires_at: null
            }
          : k
      ))

      const { error } = await supabase
        .from('wallet_karma')
        .update({
          is_banned: false,
          banned_at: null,
          ban_expires_at: null
        })
        .eq('wallet_address', wallet.wallet_address)
        .eq('project_id', wallet.project_id)

      if (error) throw error

      toast.success('Wallet unbanned')
    } catch (error) {
      console.error('Error unbanning wallet:', error)
      toast.error('Failed to unban wallet')
      // ROLLBACK: Reload on error
      await loadKarmaData()
    } finally {
      setProcessingKarmaAction(false)
    }
  }

  // Bulk karma adjustment
  const handleBulkAwardKarma = async () => {
    if (selectedKarmaWallets.size === 0) return

    const amount = prompt('Enter karma amount to award to all selected wallets:')
    if (!amount) return

    const karmaAmount = parseInt(amount)
    if (isNaN(karmaAmount)) {
      toast.error('Invalid amount')
      return
    }

    const reason = prompt('Enter reason for karma adjustment:')
    if (!reason) return

    if (!confirm(`Award ${karmaAmount} karma to ${selectedKarmaWallets.size} wallets?`)) return

    try {
      setProcessingKarmaAction(true)

      const wallets = filteredKarmaRecords.filter(k => selectedKarmaWallets.has(k.wallet_address))

      for (const wallet of wallets) {
        await supabase.rpc('increment_karma', {
          p_wallet: wallet.wallet_address,
          p_project_id: wallet.project_id,
          p_amount: karmaAmount
        })
      }

      toast.success(`Awarded ${karmaAmount} karma to ${wallets.length} wallets`)
      setSelectedKarmaWallets(new Set())
      await loadKarmaData()
    } catch (error) {
      console.error('Error awarding bulk karma:', error)
      toast.error('Failed to award karma')
    } finally {
      setProcessingKarmaAction(false)
    }
  }

  // Calculate karma stats
  const getKarmaStats = () => {
    const total = karmaRecords.length
    const totalKarma = karmaRecords.reduce((sum, k) => sum + k.total_karma_points, 0)
    const avgKarma = total > 0 ? totalKarma / total : 0
    const banned = karmaRecords.filter(k => k.is_banned).length
    const warned = karmaRecords.filter(k => k.warning_count > 0 && !k.is_banned).length

    return { total, totalKarma, avgKarma, banned, warned }
  }

  // Vote History functions
  const loadVotesData = async () => {
    if (!project) return

    try {
      setLoadingVotes(true)

      // Fetch all votes with asset details
      const { data: votes, error } = await supabase
        .from('asset_votes')
        .select(`
          *,
          pending_assets!inner (
            id,
            project_id,
            asset_type,
            asset_data,
            verification_status,
            submitter_wallet
          )
        `)
        .eq('pending_assets.project_id', project.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setAllVotes(votes || [])
      setFilteredVotes(votes || [])

      // Calculate analytics
      await calculateVoteAnalytics(votes || [])

      // Detect suspicious activity
      await detectSuspiciousVoting(votes || [])
    } catch (error) {
      console.error('Error loading votes:', error)
      toast.error('Failed to load vote history')
    } finally {
      setLoadingVotes(false)
    }
  }

  const calculateVoteAnalytics = async (votes: VoteWithAsset[]) => {
    if (votes.length === 0) {
      setVoteAnalytics({
        totalVotes: 0,
        upvotes: 0,
        reports: 0,
        upvotePercentage: 0,
        reportPercentage: 0,
        avgVoteWeight: 0,
        topVoter: null,
        topVoterCount: 0,
        mostVotedAsset: null,
        mostVotedAssetCount: 0,
        karmaAccuracy: 0
      })
      return
    }

    const totalVotes = votes.length
    const upvotes = votes.filter(v => v.vote_type === 'upvote').length
    const reports = votes.filter(v => v.vote_type === 'report').length
    const upvotePercentage = (upvotes / totalVotes) * 100
    const reportPercentage = (reports / totalVotes) * 100

    // Average vote weight
    const avgVoteWeight = votes.reduce((sum, v) => sum + (v.token_percentage_snapshot || 0), 0) / totalVotes

    // Most active voter
    const voterCounts: Record<string, number> = {}
    votes.forEach(v => {
      voterCounts[v.voter_wallet] = (voterCounts[v.voter_wallet] || 0) + 1
    })
    const topVoterEntry = Object.entries(voterCounts).sort((a, b) => b[1] - a[1])[0]
    const topVoter = topVoterEntry ? topVoterEntry[0] : null
    const topVoterCount = topVoterEntry ? topVoterEntry[1] : 0

    // Most voted asset
    const assetCounts: Record<string, { count: number; asset: PendingAsset }> = {}
    votes.forEach(v => {
      if (v.pending_asset) {
        const assetId = v.pending_asset_id
        if (!assetCounts[assetId]) {
          assetCounts[assetId] = { count: 0, asset: v.pending_asset }
        }
        assetCounts[assetId].count++
      }
    })
    const topAssetEntry = Object.entries(assetCounts).sort((a, b) => b[1].count - a[1].count)[0]
    const mostVotedAsset = topAssetEntry ? topAssetEntry[1].asset : null
    const mostVotedAssetCount = topAssetEntry ? topAssetEntry[1].count : 0

    // Karma accuracy (votes that earned delayed karma)
    const votesWithDelayedKarma = votes.filter(v => {
      const asset = v.pending_asset
      if (!asset) return false
      
      // Upvotes earn karma when asset is verified
      if (v.vote_type === 'upvote' && asset.verification_status === 'verified') return true
      
      // Reports earn karma when asset is hidden
      if (v.vote_type === 'report' && asset.verification_status === 'hidden') return true
      
      return false
    }).length
    const karmaAccuracy = (votesWithDelayedKarma / totalVotes) * 100

    setVoteAnalytics({
      totalVotes,
      upvotes,
      reports,
      upvotePercentage,
      reportPercentage,
      avgVoteWeight,
      topVoter,
      topVoterCount,
      mostVotedAsset,
      mostVotedAssetCount,
      karmaAccuracy
    })
  }

  const detectSuspiciousVoting = async (votes: VoteWithAsset[]) => {
    const suspicious: any[] = []

    // Get votes from last 24 hours
    const yesterday = new Date()
    yesterday.setHours(yesterday.getHours() - 24)
    const recentVotes = votes.filter(v => new Date(v.created_at) > yesterday)

    // 1. Spam voting (>50 votes in 24h)
    const voterCounts: Record<string, number> = {}
    recentVotes.forEach(v => {
      voterCounts[v.voter_wallet] = (voterCounts[v.voter_wallet] || 0) + 1
    })
    Object.entries(voterCounts).forEach(([wallet, count]) => {
      if (count > 50) {
        suspicious.push({
          wallet,
          pattern: 'spam_voting',
          details: `${count} votes in 24 hours`,
          severity: 'high',
          recommendedAction: 'Consider ban'
        })
      }
    })

    // 2. Report-only voters (>5 reports, 0 upvotes)
    const voterActivity: Record<string, { upvotes: number; reports: number }> = {}
    votes.forEach(v => {
      if (!voterActivity[v.voter_wallet]) {
        voterActivity[v.voter_wallet] = { upvotes: 0, reports: 0 }
      }
      if (v.vote_type === 'upvote') {
        voterActivity[v.voter_wallet].upvotes++
      } else {
        voterActivity[v.voter_wallet].reports++
      }
    })
    Object.entries(voterActivity).forEach(([wallet, activity]) => {
      if (activity.reports > 5 && activity.upvotes === 0) {
        suspicious.push({
          wallet,
          pattern: 'report_only',
          details: `${activity.reports} reports, 0 upvotes`,
          severity: 'medium',
          recommendedAction: 'Review manually'
        })
      }
    })

    // 3. Instant voting (<1 min after asset submission)
    const instantVotes = votes.filter(v => {
      if (!v.pending_asset) return false
      const voteTime = new Date(v.created_at).getTime()
      const assetTime = new Date(v.pending_asset.created_at).getTime()
      const diffMinutes = (voteTime - assetTime) / 1000 / 60
      return diffMinutes < 1
    })
    const instantVoters: Record<string, number> = {}
    instantVotes.forEach(v => {
      instantVoters[v.voter_wallet] = (instantVoters[v.voter_wallet] || 0) + 1
    })
    Object.entries(instantVoters).forEach(([wallet, count]) => {
      if (count > 10) {
        suspicious.push({
          wallet,
          pattern: 'instant_voting',
          details: `${count} votes <1min after submission`,
          severity: 'medium',
          recommendedAction: 'Review manually'
        })
      }
    })

    setSuspiciousActivity(suspicious)
  }

  // Filter votes
  useEffect(() => {
    let filtered = [...allVotes]

    // Vote type filter
    if (voteTypeFilter === 'upvote') {
      filtered = filtered.filter(v => v.vote_type === 'upvote')
    } else if (voteTypeFilter === 'report') {
      filtered = filtered.filter(v => v.vote_type === 'report')
    }

    // Outcome filter
    if (voteOutcomeFilter === 'earned') {
      filtered = filtered.filter(v => {
        const asset = v.pending_asset
        if (!asset) return false
        return (
          (v.vote_type === 'upvote' && asset.verification_status === 'verified') ||
          (v.vote_type === 'report' && asset.verification_status === 'hidden')
        )
      })
    } else if (voteOutcomeFilter === 'lost') {
      filtered = filtered.filter(v => {
        const asset = v.pending_asset
        if (!asset) return false
        return (
          (v.vote_type === 'upvote' && asset.verification_status === 'hidden') ||
          (v.vote_type === 'report' && asset.verification_status === 'verified')
        )
      })
    } else if (voteOutcomeFilter === 'pending') {
      filtered = filtered.filter(v => {
        const asset = v.pending_asset
        if (!asset) return false
        return asset.verification_status === 'pending' || asset.verification_status === 'backed'
      })
    }

    // Voter search
    if (voteVoterSearch.trim()) {
      const search = voteVoterSearch.toLowerCase()
      filtered = filtered.filter(v => v.voter_wallet.toLowerCase().includes(search))
    }

    // Asset search
    if (voteAssetSearch.trim()) {
      const search = voteAssetSearch.toLowerCase()
      filtered = filtered.filter(v => {
        if (!v.pending_asset) return false
        const summary = extractAssetSummary(v.pending_asset.asset_data)
        return summary.toLowerCase().includes(search)
      })
    }

    setFilteredVotes(filtered)
  }, [allVotes, voteTypeFilter, voteOutcomeFilter, voteVoterSearch, voteAssetSearch])

  // Export votes as CSV
  const exportVotesCSV = () => {
    if (filteredVotes.length === 0) {
      toast.error('No votes to export')
      return
    }

    const headers = ['Timestamp', 'Voter Wallet', 'Asset Type', 'Asset Summary', 'Vote Type', 'Token %', 'Karma Earned', 'Asset Status']
    const rows = filteredVotes.map(v => [
      new Date(v.created_at).toLocaleString(),
      v.voter_wallet,
      v.pending_asset?.asset_type || 'N/A',
      v.pending_asset ? extractAssetSummary(v.pending_asset.asset_data) : 'N/A',
      v.vote_type,
      (v.token_percentage_snapshot || 0).toFixed(3),
      v.karma_earned || 0,
      v.pending_asset?.verification_status || 'N/A'
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `votes-${project?.token_symbol}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast.success(`Exported ${filteredVotes.length} votes`)
  }

  // Export karma report
  const exportKarmaReport = () => {
    if (allVotes.length === 0) {
      toast.error('No vote data to export')
      return
    }

    // Group by voter wallet
    const walletKarma: Record<string, {
      totalKarma: number
      upvotes: number
      reports: number
      earned: number
      lost: number
    }> = {}

    allVotes.forEach(v => {
      if (!walletKarma[v.voter_wallet]) {
        walletKarma[v.voter_wallet] = {
          totalKarma: 0,
          upvotes: 0,
          reports: 0,
          earned: 0,
          lost: 0
        }
      }

      const karma = v.karma_earned || 0
      walletKarma[v.voter_wallet].totalKarma += karma

      if (v.vote_type === 'upvote') {
        walletKarma[v.voter_wallet].upvotes++
      } else {
        walletKarma[v.voter_wallet].reports++
      }

      const asset = v.pending_asset
      if (asset) {
        const earnedKarma = 
          (v.vote_type === 'upvote' && asset.verification_status === 'verified') ||
          (v.vote_type === 'report' && asset.verification_status === 'hidden')
        
        if (earnedKarma) {
          walletKarma[v.voter_wallet].earned++
        } else if (
          (v.vote_type === 'upvote' && asset.verification_status === 'hidden') ||
          (v.vote_type === 'report' && asset.verification_status === 'verified')
        ) {
          walletKarma[v.voter_wallet].lost++
        }
      }
    })

    const headers = ['Wallet', 'Total Karma', 'Upvotes', 'Reports', 'Correct Votes', 'Wrong Votes', 'Accuracy %']
    const rows = Object.entries(walletKarma).map(([wallet, data]) => {
      const total = data.upvotes + data.reports
      const accuracy = total > 0 ? (data.earned / total) * 100 : 0
      return [
        wallet,
        data.totalKarma,
        data.upvotes,
        data.reports,
        data.earned,
        data.lost,
        accuracy.toFixed(1)
      ]
    })

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `karma-report-${project?.token_symbol}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast.success('Karma report exported')
  }

  // Get vote outcome
  const getVoteOutcome = (vote: VoteWithAsset): 'earned' | 'lost' | 'pending' => {
    const asset = vote.pending_asset
    if (!asset) return 'pending'

    if (asset.verification_status === 'pending' || asset.verification_status === 'backed') {
      return 'pending'
    }

    const earnedKarma = 
      (vote.vote_type === 'upvote' && asset.verification_status === 'verified') ||
      (vote.vote_type === 'report' && asset.verification_status === 'hidden')

    return earnedKarma ? 'earned' : 'lost'
  }

  // Load votes data when karma tab is opened
  useEffect(() => {
    if (currentTab === 'karma' && project && allVotes.length === 0) {
      loadVotesData()
    }
  }, [currentTab, project])

  // Danger Zone functions
  const loadResetPreviews = async () => {
    if (!project) return

    setLoadingPreviews({
      pending: true,
      unverified: true,
      chat: true,
      karma: true,
      votes: true,
      community: true,
      all: true
    })

    try {
      // Preview: Pending assets only
      const { count: pendingCount } = await supabase
        .from('pending_assets')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('verification_status', 'pending')

      // Preview: All unverified
      const { count: unverifiedCount } = await supabase
        .from('pending_assets')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .neq('verification_status', 'verified')

      // Preview: Chat messages
      const { count: userChatCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)

      const { count: systemChatCount } = await supabase
        .from('curation_chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)

      // Preview: Karma records
      const { count: karmaCount } = await supabase
        .from('wallet_karma')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)

      // Preview: Votes
      const { data: assetIds } = await supabase
        .from('pending_assets')
        .select('id')
        .eq('project_id', project.id)

      const { count: votesCount } = await supabase
        .from('asset_votes')
        .select('*', { count: 'exact', head: true })
        .in('pending_asset_id', assetIds?.map(a => a.id) || [])

      // Preview: Verified assets
      const { count: socialCount } = await supabase
        .from('social_assets')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)

      const { count: creativeCount } = await supabase
        .from('creative_assets')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)

      const { count: legalCount } = await supabase
        .from('legal_assets')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)

      const { count: teamCount } = await supabase
        .from('team_wallets')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)

      setResetPreviews({
        pending: { assets: pendingCount },
        unverified: { assets: unverifiedCount },
        chat: { userMessages: userChatCount, systemMessages: systemChatCount },
        karma: { wallets: karmaCount },
        votes: { votes: votesCount, assets: assetIds?.length || 0 },
        community: {
          pendingAssets: unverifiedCount,
          votes: votesCount,
          curationMessages: systemChatCount,
          karma: karmaCount
        },
        all: {
          social: socialCount,
          creative: creativeCount,
          legal: legalCount,
          pending: unverifiedCount,
          votes: votesCount,
          userChat: userChatCount,
          systemChat: systemChatCount,
          karma: karmaCount,
          team: teamCount
        }
      })
    } catch (error) {
      console.error('Error loading previews:', error)
    } finally {
      setLoadingPreviews({})
    }
  }

  // Cooldown timer
  useEffect(() => {
    if (!resetCooldownUntil) return

    const interval = setInterval(() => {
      const now = new Date()
      const diff = Math.floor((resetCooldownUntil.getTime() - now.getTime()) / 1000)

      if (diff <= 0) {
        setResetCooldownUntil(null)
        setResetCooldownSeconds(0)
      } else {
        setResetCooldownSeconds(diff)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [resetCooldownUntil])

  // Load previews when danger tab opens
  useEffect(() => {
    if (currentTab === 'danger' && project) {
      loadResetPreviews()
    }
  }, [currentTab, project])

  // Start cooldown
  const startResetCooldown = () => {
    const cooldownEnd = new Date()
    cooldownEnd.setMinutes(cooldownEnd.getMinutes() + 5)
    setResetCooldownUntil(cooldownEnd)
    setResetCooldownSeconds(300)
  }

  // Format cooldown time
  const formatCooldown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Reset functions
  const resetPendingAssetsOnly = async () => {
    if (!project) return

    try {
      setProcessingReset(true)

      // Get pending asset IDs
      const { data: assets } = await supabase
        .from('pending_assets')
        .select('id')
        .eq('project_id', project.id)
        .eq('verification_status', 'pending')

      if (!assets || assets.length === 0) {
        toast.success('No pending assets to delete')
        return
      }

      const ids = assets.map(a => a.id)

      // Get votes to reverse karma
      const { data: votes } = await supabase
        .from('asset_votes')
        .select('voter_wallet, karma_earned')
        .in('pending_asset_id', ids)

      // Reverse karma
      for (const vote of votes || []) {
        if (vote.karma_earned) {
          await supabase.rpc('increment_karma', {
            p_wallet: vote.voter_wallet,
            p_project_id: project.id,
            p_amount: -vote.karma_earned
          })
        }
      }

      // Delete system messages
      await supabase
        .from('curation_chat_messages')
        .delete()
        .in('pending_asset_id', ids)

      // Delete assets (CASCADE deletes votes)
      const { error } = await supabase
        .from('pending_assets')
        .delete()
        .eq('project_id', project.id)
        .eq('verification_status', 'pending')

      if (error) throw error

      const result = {
        assetsDeleted: assets.length,
        votesDeleted: votes?.length || 0,
        karmaReversed: votes?.reduce((sum, v) => sum + (v.karma_earned || 0), 0) || 0
      }

      setLastResetResult(result)
      toast.success(`Reset complete! Deleted ${result.assetsDeleted} pending assets`)
      
      startResetCooldown()
      await loadResetPreviews()
    } catch (error) {
      console.error('Error resetting pending assets:', error)
      toast.error('Failed to reset pending assets')
    } finally {
      setProcessingReset(false)
      setResetConfirmDialog(null)
      setResetConfirmText('')
    }
  }

  const resetUnverifiedAssets = async () => {
    if (!project) return

    try {
      setProcessingReset(true)

      const { data: assets } = await supabase
        .from('pending_assets')
        .select('id')
        .eq('project_id', project.id)
        .neq('verification_status', 'verified')

      if (!assets || assets.length === 0) {
        toast.success('No unverified assets to delete')
        return
      }

      const ids = assets.map(a => a.id)

      // Reverse karma
      const { data: votes } = await supabase
        .from('asset_votes')
        .select('voter_wallet, karma_earned')
        .in('pending_asset_id', ids)

      for (const vote of votes || []) {
        if (vote.karma_earned) {
          await supabase.rpc('increment_karma', {
            p_wallet: vote.voter_wallet,
            p_project_id: project.id,
            p_amount: -vote.karma_earned
          })
        }
      }

      // Delete messages
      await supabase
        .from('curation_chat_messages')
        .delete()
        .in('pending_asset_id', ids)

      // Delete assets
      const { error } = await supabase
        .from('pending_assets')
        .delete()
        .eq('project_id', project.id)
        .neq('verification_status', 'verified')

      if (error) throw error

      const result = {
        assetsDeleted: assets.length,
        votesDeleted: votes?.length || 0,
        karmaReversed: votes?.reduce((sum, v) => sum + (v.karma_earned || 0), 0) || 0
      }

      setLastResetResult(result)
      toast.success(`Nuclear reset complete! Deleted ${result.assetsDeleted} unverified assets`)
      
      startResetCooldown()
      await loadResetPreviews()
    } catch (error) {
      console.error('Error resetting unverified assets:', error)
      toast.error('Failed to reset unverified assets')
    } finally {
      setProcessingReset(false)
      setResetConfirmDialog(null)
      setResetConfirmText('')
    }
  }

  const resetChatMessagesFunc = async () => {
    if (!project) return

    try {
      setProcessingReset(true)

      const { data: userMsgs, error: userError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('project_id', project.id)
        .select()

      if (userError) throw userError

      let systemMsgs: any[] = []
      if (includeSystemMessages) {
        const { data, error } = await supabase
          .from('curation_chat_messages')
          .delete()
          .eq('project_id', project.id)
          .select()

        if (error) throw error
        systemMsgs = data || []
      }

      const result = {
        userDeleted: userMsgs?.length || 0,
        systemDeleted: systemMsgs.length
      }

      setLastResetResult(result)
      toast.success(`Deleted ${result.userDeleted} user messages${includeSystemMessages ? ` and ${result.systemDeleted} system messages` : ''}`)
      
      startResetCooldown()
      await loadResetPreviews()
    } catch (error) {
      console.error('Error resetting chat:', error)
      toast.error('Failed to reset chat messages')
    } finally {
      setProcessingReset(false)
      setResetConfirmDialog(null)
      setResetConfirmText('')
      setIncludeSystemMessages(false)
    }
  }

  const resetAllKarmaFunc = async () => {
    if (!project) return

    try {
      setProcessingReset(true)

      const { data, error } = await supabase
        .from('wallet_karma')
        .update({
          total_karma_points: 0,
          assets_added_count: 0,
          upvotes_given_count: 0,
          reports_given_count: 0,
          warning_count: 0,
          is_banned: false,
          banned_at: null,
          ban_expires_at: null,
          warnings: []
        })
        .eq('project_id', project.id)
        .select()

      if (error) throw error

      const result = { walletsReset: data?.length || 0 }
      setLastResetResult(result)
      toast.success(`Reset karma for ${result.walletsReset} wallets`)
      
      startResetCooldown()
      await loadResetPreviews()
      await loadKarmaData()
    } catch (error) {
      console.error('Error resetting karma:', error)
      toast.error('Failed to reset karma')
    } finally {
      setProcessingReset(false)
      setResetConfirmDialog(null)
      setResetConfirmText('')
    }
  }

  const resetAllVotesFunc = async () => {
    if (!project) return

    try {
      setProcessingReset(true)

      const { data: assets } = await supabase
        .from('pending_assets')
        .select('id')
        .eq('project_id', project.id)

      const { data: votes, error: votesError } = await supabase
        .from('asset_votes')
        .delete()
        .in('pending_asset_id', assets?.map(a => a.id) || [])
        .select()

      if (votesError) throw votesError

      // Reset vote weights
      await supabase
        .from('pending_assets')
        .update({
          total_upvote_weight: 0,
          unique_upvoters_count: 0,
          total_report_weight: 0,
          unique_reporters_count: 0
        })
        .eq('project_id', project.id)

      const result = {
        votesDeleted: votes?.length || 0,
        assetsAffected: assets?.length || 0
      }

      setLastResetResult(result)
      toast.success(`Deleted ${result.votesDeleted} votes on ${result.assetsAffected} assets`)
      
      startResetCooldown()
      await loadResetPreviews()
    } catch (error) {
      console.error('Error resetting votes:', error)
      toast.error('Failed to reset votes')
    } finally {
      setProcessingReset(false)
      setResetConfirmDialog(null)
      setResetConfirmText('')
    }
  }

  const nuclearResetCommunity = async () => {
    if (!project) return

    try {
      setProcessingReset(true)

      // Delete pending assets (CASCADE deletes votes)
      const { data: assets } = await supabase
        .from('pending_assets')
        .delete()
        .eq('project_id', project.id)
        .select()

      // Delete curation messages
      const { data: msgs } = await supabase
        .from('curation_chat_messages')
        .delete()
        .eq('project_id', project.id)
        .select()

      // Delete karma records
      const { data: karma } = await supabase
        .from('wallet_karma')
        .delete()
        .eq('project_id', project.id)
        .select()

      const result = {
        pendingAssets: assets?.length || 0,
        curationMessages: msgs?.length || 0,
        karma: karma?.length || 0
      }

      setLastResetResult(result)
      toast.success(`☢️ NUCLEAR RESET COMPLETE! Deleted ${result.pendingAssets} assets, ${result.curationMessages} messages, ${result.karma} karma records`)
      
      startResetCooldown()
      await loadResetPreviews()
    } catch (error) {
      console.error('Error in nuclear reset:', error)
      toast.error('Failed to complete nuclear reset')
    } finally {
      setProcessingReset(false)
      setResetConfirmDialog(null)
      setResetConfirmText('')
    }
  }

  const nuclearResetAll = async () => {
    if (!project) return

    try {
      setProcessingReset(true)

      // Delete verified assets
      const { data: social } = await supabase
        .from('social_assets')
        .delete()
        .eq('project_id', project.id)
        .select()

      const { data: creative } = await supabase
        .from('creative_assets')
        .delete()
        .eq('project_id', project.id)
        .select()

      const { data: legal } = await supabase
        .from('legal_assets')
        .delete()
        .eq('project_id', project.id)
        .select()

      // Delete community data
      const { data: pending } = await supabase
        .from('pending_assets')
        .delete()
        .eq('project_id', project.id)
        .select()

      const { data: curation } = await supabase
        .from('curation_chat_messages')
        .delete()
        .eq('project_id', project.id)
        .select()

      const { data: karma } = await supabase
        .from('wallet_karma')
        .delete()
        .eq('project_id', project.id)
        .select()

      // Delete chat
      const { data: chat } = await supabase
        .from('chat_messages')
        .delete()
        .eq('project_id', project.id)
        .select()

      // Delete team wallets
      const { data: team } = await supabase
        .from('team_wallets')
        .delete()
        .eq('project_id', project.id)
        .select()

      const result = {
        socialAssets: social?.length || 0,
        creativeAssets: creative?.length || 0,
        legalAssets: legal?.length || 0,
        pendingAssets: pending?.length || 0,
        curationMessages: curation?.length || 0,
        karma: karma?.length || 0,
        chatMessages: chat?.length || 0,
        teamWallets: team?.length || 0
      }

      setLastResetResult(result)
      toast.success('💀 EVERYTHING RESET! Only project profile remains')
      
      startResetCooldown()
      await loadResetPreviews()
    } catch (error) {
      console.error('Error in nuclear reset all:', error)
      toast.error('Failed to complete nuclear reset')
    } finally {
      setProcessingReset(false)
      setResetConfirmDialog(null)
      setResetConfirmText('')
    }
  }

  const deleteProjectCompletely = async () => {
    if (!project) return

    try {
      setProcessingReset(true)

      // Delete EVERYTHING (CASCADE should handle related records)
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id)

      if (error) throw error

      toast.success('🗑️ Project deleted completely')
      
      // Redirect to admin dashboard
      window.location.href = '/admin'
    } catch (error) {
      console.error('Error deleting project:', error)
      toast.error('Failed to delete project')
      setProcessingReset(false)
      setResetConfirmDialog(null)
      setResetConfirmText('')
    }
  }

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'success'
      case 'pending': return 'warning'
      case 'rejected': return 'error'
      default: return 'default'
    }
  }

  // Access control
  if (!isAdmin || !isVerified) {
    return (
      <div className="min-h-screen bg-page-bg flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-12">
            <LockIcon sx={{ fontSize: 48, color: '#7C4DFF', mb: 2 }} />
            <h2 className="font-display text-2xl font-bold text-text-primary mb-3">
              Admin Access Required
            </h2>
            <p className="font-body text-text-secondary mb-6">
              Please authenticate as admin to access this page.
            </p>
            <Link href="/admin">
              <Button variant="primary">Go to Admin Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-page-bg">
        <header className="sticky top-0 bg-page-bg/95 backdrop-blur-sm border-b border-border-subtle z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <Link href="/">
                <h1 className="font-display text-2xl font-bold text-text-primary">Align</h1>
              </Link>
              <WalletButton />
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <CircularProgress />
          <p className="font-body text-text-secondary mt-4">Loading project...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Header */}
      <header className="sticky top-0 bg-page-bg/95 backdrop-blur-sm border-b border-border-subtle z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <h1 className="font-display text-2xl font-bold text-text-primary cursor-pointer hover:text-accent-primary transition-colors">
                Align
              </h1>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost">
                  <ArrowBackIcon className="mr-2" />
                  Admin Dashboard
                </Button>
              </Link>
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Section - Project Info Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-6">
              {/* Left: Project Info */}
              <div className="flex items-start gap-4 flex-1">
                {/* Profile Image */}
                <div className="w-20 h-20 rounded-full bg-accent-primary-soft flex items-center justify-center overflow-hidden flex-shrink-0">
                  {project.profile_image_url ? (
                    <img
                      src={project.profile_image_url}
                      alt={project.token_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-display text-2xl font-bold text-accent-primary">
                      {project.token_symbol.charAt(0)}
                    </span>
                  )}
                </div>

                {/* Project Details */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="font-display text-3xl font-bold text-text-primary">
                      {project.token_name}
                    </h1>
                    <Chip 
                      label={project.status.toUpperCase()} 
                      color={getProjectStatusColor(project.status) as any}
                      size="small"
                    />
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <p className="font-body text-text-secondary">
                      <strong>Symbol:</strong> ${project.token_symbol}
                    </p>
                    <p className="font-body text-text-secondary flex items-center gap-2">
                      <strong>Mint:</strong> 
                      <span className="font-mono">{shortenAddress(project.token_mint)}</span>
                      <button onClick={() => copyToClipboard(project.token_mint)}>
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                      </button>
                    </p>
                    <p className="font-body text-text-secondary flex items-center gap-2">
                      <strong>Creator:</strong> 
                      <span className="font-mono">{shortenAddress(project.creator_wallet)}</span>
                      <button onClick={() => copyToClipboard(project.creator_wallet)}>
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                      </button>
                    </p>
                    {project.description && (
                      <p className="font-body text-text-secondary pt-2">
                        {project.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Quick Actions */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditModal(true)}
                >
                  <EditIcon className="mr-2" sx={{ fontSize: 16 }} />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStatusModal(true)}
                >
                  <CheckCircleIcon className="mr-2" sx={{ fontSize: 16 }} />
                  Change Status
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteModal(true)}
                  className="border-red-600 text-red-600 hover:bg-red-50"
                >
                  <DeleteIcon className="mr-2" sx={{ fontSize: 16 }} />
                  Delete
                </Button>
                <Link href={`/project/${project.id}`} target="_blank">
                  <Button variant="ghost" size="sm" className="w-full">
                    View Public Page
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={currentTab} 
              onChange={(_, newValue) => setCurrentTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="Overview" value="overview" />
              <Tab label="Project Profile" value="profile" />
              <Tab label="Chat Messages" value="chat" />
              <Tab label="Pending Assets" value="pending-assets" />
              <Tab label="Verified Assets" value="verified-assets" />
              <Tab label="Karma & Votes" value="karma" />
              <Tab label="Team & Wallets" value="team" />
              <Tab label="Activity Log" value="activity" />
              <Tab label="Danger Zone" value="danger" />
            </Tabs>
          </Box>

          <CardContent className="pt-6">
            {tabLoading ? (
              <div className="text-center py-12">
                <CircularProgress />
                <p className="font-body text-text-secondary mt-4">Loading...</p>
              </div>
            ) : (
              <>
                {/* Overview Tab */}
                {currentTab === 'overview' && overviewStats && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <button
                      onClick={() => setCurrentTab('chat')}
                      className="p-6 bg-white rounded-lg border-2 border-border-subtle hover:border-accent-primary transition-all text-left"
                    >
                      <p className="text-sm text-text-secondary font-medium mb-1">Total Messages</p>
                      <p className="text-3xl font-bold text-text-primary">{overviewStats.totalChatMessages}</p>
                      <p className="text-xs text-text-muted mt-2">Click to view →</p>
                    </button>

                    <button
                      onClick={() => setCurrentTab('pending-assets')}
                      className="p-6 bg-white rounded-lg border-2 border-border-subtle hover:border-accent-primary transition-all text-left"
                    >
                      <p className="text-sm text-text-secondary font-medium mb-1">Pending Assets</p>
                      <p className="text-3xl font-bold text-amber-600">{overviewStats.pendingAssetsCount}</p>
                      <p className="text-xs text-text-muted mt-2">Click to view →</p>
                    </button>

                    <button
                      onClick={() => setCurrentTab('verified-assets')}
                      className="p-6 bg-white rounded-lg border-2 border-border-subtle hover:border-accent-primary transition-all text-left"
                    >
                      <p className="text-sm text-text-secondary font-medium mb-1">Verified Assets</p>
                      <p className="text-3xl font-bold text-green-600">{overviewStats.verifiedAssetsCount}</p>
                      <p className="text-xs text-text-muted mt-2">Click to view →</p>
                    </button>

                    <button
                      onClick={() => setCurrentTab('karma')}
                      className="p-6 bg-white rounded-lg border-2 border-border-subtle hover:border-accent-primary transition-all text-left"
                    >
                      <p className="text-sm text-text-secondary font-medium mb-1">Total Karma</p>
                      <p className="text-3xl font-bold text-purple-600">{overviewStats.totalKarmaDistributed.toFixed(0)}</p>
                      <p className="text-xs text-text-muted mt-2">Click to view →</p>
                    </button>

                    <button
                      onClick={() => setCurrentTab('karma')}
                      className="p-6 bg-white rounded-lg border-2 border-border-subtle hover:border-accent-primary transition-all text-left"
                    >
                      <p className="text-sm text-text-secondary font-medium mb-1">Active Voters</p>
                      <p className="text-3xl font-bold text-blue-600">{overviewStats.activeVotersCount}</p>
                      <p className="text-xs text-text-muted mt-2">Click to view →</p>
                    </button>

                    <div className="p-6 bg-white rounded-lg border-2 border-border-subtle">
                      <p className="text-sm text-text-secondary font-medium mb-1">Banned Wallets</p>
                      <p className="text-3xl font-bold text-red-600">{overviewStats.bannedWalletsCount}</p>
                      <p className="text-xs text-text-muted mt-2">View in Karma tab</p>
                    </div>
                  </div>
                )}

                {/* Project Profile Tab - Master Edit Form */}
                {currentTab === 'profile' && (
                  <div className="space-y-6">
                    {/* Unsaved Changes Warning */}
                    {hasUnsavedChanges && (
                      <Alert severity="warning">
                        <AlertTitle>Unsaved Changes</AlertTitle>
                        You have unsaved changes. Make sure to save before leaving this page.
                        <div className="mt-2 text-xs">
                          <strong>Changed fields:</strong> {getChangesDiff().join(', ')}
                        </div>
                      </Alert>
                    )}

                    <Alert severity="info">
                      <AlertTitle>Master Profile Editor</AlertTitle>
                      Edit all project information in one place. Changes will be saved to the database when you click "Save All Changes".
                    </Alert>

                    {/* 1. BASIC INFO Section */}
                    <Card className="p-6">
                      <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                        📋 Basic Information
                      </h3>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <TextField
                          label="Token Name"
                          fullWidth
                          value={profileFormData.token_name || ''}
                          onChange={(e) => setProfileFormData({ ...profileFormData, token_name: e.target.value })}
                          helperText="The full name of the token"
                        />

                        <TextField
                          label="Token Symbol"
                          fullWidth
                          value={profileFormData.token_symbol || ''}
                          onChange={(e) => setProfileFormData({ ...profileFormData, token_symbol: e.target.value })}
                          helperText="e.g., BTC, ETH, SOL"
                        />

                        <TextField
                          label="Token Mint Address"
                          fullWidth
                          value={profileFormData.token_mint || ''}
                          InputProps={{
                            readOnly: true,
                            endAdornment: (
                              <button onClick={() => copyToClipboard(profileFormData.token_mint)}>
                                <ContentCopyIcon sx={{ fontSize: 18 }} />
                              </button>
                            )
                          }}
                          helperText="Read-only (blockchain address)"
                        />

                        <TextField
                          label="Creator Wallet"
                          fullWidth
                          value={profileFormData.creator_wallet || ''}
                          onChange={(e) => setProfileFormData({ ...profileFormData, creator_wallet: e.target.value })}
                          helperText="Can reassign project ownership"
                          InputProps={{
                            endAdornment: (
                              <button onClick={() => copyToClipboard(profileFormData.creator_wallet)}>
                                <ContentCopyIcon sx={{ fontSize: 18 }} />
                              </button>
                            )
                          }}
                        />

                        <FormControl fullWidth>
                          <InputLabel>Status</InputLabel>
                          <Select
                            value={profileFormData.status || 'draft'}
                            label="Status"
                            onChange={(e) => setProfileFormData({ ...profileFormData, status: e.target.value })}
                          >
                            <MenuItem value="draft">Draft</MenuItem>
                            <MenuItem value="pending">Pending Review</MenuItem>
                            <MenuItem value="live">Live</MenuItem>
                            <MenuItem value="rejected">Rejected</MenuItem>
                          </Select>
                        </FormControl>

                        <TextField
                          label="Created Date"
                          fullWidth
                          value={new Date(project.created_at).toLocaleString()}
                          InputProps={{ readOnly: true }}
                          helperText="Read-only"
                        />

                        <TextField
                          label="Last Updated"
                          fullWidth
                          value={new Date(project.updated_at).toLocaleString()}
                          InputProps={{ readOnly: true }}
                          helperText="Read-only"
                        />
                      </div>
                    </Card>

                    {/* 2. PROFILE & BRANDING Section */}
                    <Card className="p-6">
                      <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                        🎨 Profile & Branding
                      </h3>

                      {/* Profile Image */}
                      <div className="mb-6">
                        <h4 className="font-semibold text-sm mb-3">Profile Image</h4>
                        
                        {/* Current Image Preview */}
                        <div className="flex flex-col lg:flex-row gap-6">
                          <div className="flex-shrink-0">
                            {imagePreviewUrl ? (
                              <div className="relative group">
                                <img 
                                  src={imagePreviewUrl}
                                  alt="Profile preview"
                                  className="w-48 h-48 object-cover rounded-lg border-2 border-border-subtle"
                                  onError={() => {
                                    setImagePreviewUrl(null)
                                    toast.error('Failed to load image')
                                  }}
                                />
                                {imageFile && (
                                  <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">
                                    New file
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="w-48 h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                                <div className="text-center">
                                  <span className="text-4xl">{profileFormData.token_symbol?.charAt(0) || '?'}</span>
                                  <p className="text-xs text-gray-500 mt-2">No image</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Image Controls */}
                          <div className="flex-1 space-y-3">
                            <div className="flex gap-2 flex-wrap">
                              <label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleImageFileSelect}
                                  className="hidden"
                                />
                                <MuiButton variant="outlined" component="span">
                                  📤 Upload New File
                                </MuiButton>
                              </label>

                              <MuiButton 
                                variant="outlined"
                                onClick={() => setShowImageUrlInput(!showImageUrlInput)}
                              >
                                🔗 {showImageUrlInput ? 'Hide' : 'Enter'} URL
                              </MuiButton>

                              {imagePreviewUrl && (
                                <MuiButton 
                                  variant="outlined" 
                                  color="error"
                                  onClick={handleRemoveImage}
                                >
                                  🗑️ Remove Image
                                </MuiButton>
                              )}
                            </div>

                            {showImageUrlInput && (
                              <TextField
                                label="Image URL"
                                fullWidth
                                placeholder="https://example.com/image.png"
                                value={profileFormData.profile_image_url || ''}
                                onChange={(e) => handleImageUrlChange(e.target.value)}
                                helperText="Enter a public image URL (live preview above)"
                              />
                            )}

                            {imageFile && (
                              <Alert severity="info">
                                <strong>File selected:</strong> {imageFile.name} ({(imageFile.size / 1024).toFixed(1)} KB)
                                <br />
                                <small>Click "Save All Changes" to upload this file</small>
                              </Alert>
                            )}

                            {uploadingImage && (
                              <Box sx={{ width: '100%' }}>
                                <div className="flex items-center gap-2">
                                  <CircularProgress size={20} />
                                  <span className="text-sm">Uploading... {uploadProgress}%</span>
                                </div>
                              </Box>
                            )}

                            <div className="text-xs text-gray-500 space-y-1">
                              <p>✓ Accepted: JPG, PNG, GIF, WebP</p>
                              <p>✓ Max size: 5 MB</p>
                              <p>✓ Recommended: 400x400 px or larger, square aspect ratio</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-sm">Description</h4>
                          <div className="flex gap-2">
                            <MuiButton 
                              size="small"
                              onClick={() => setShowDescriptionPreview(!showDescriptionPreview)}
                            >
                              {showDescriptionPreview ? 'Edit' : 'Preview'}
                            </MuiButton>
                            <MuiButton 
                              size="small"
                              color="error"
                              onClick={handleClearDescription}
                            >
                              Clear
                            </MuiButton>
                          </div>
                        </div>

                        {showDescriptionPreview ? (
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 min-h-[200px]">
                            <p className="text-sm whitespace-pre-wrap">
                              {profileFormData.description || <em className="text-gray-400">No description</em>}
                            </p>
                          </div>
                        ) : (
                          <>
                            <TextField
                              fullWidth
                              multiline
                              rows={8}
                              value={profileFormData.description || ''}
                              onChange={(e) => setProfileFormData({ ...profileFormData, description: e.target.value })}
                              placeholder="Describe your project... (supports markdown)"
                              helperText={`${(profileFormData.description || '').length} characters`}
                            />
                          </>
                        )}
                      </div>

                      {/* Additional Fields */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <TextField
                          label="Website URL"
                          fullWidth
                          placeholder="https://yourproject.com"
                          value={profileFormData.website || ''}
                          onChange={(e) => setProfileFormData({ ...profileFormData, website: e.target.value })}
                          helperText="Official website (optional)"
                        />

                        <TextField
                          label="Twitter Handle"
                          fullWidth
                          placeholder="@yourproject"
                          value={profileFormData.twitter || ''}
                          onChange={(e) => setProfileFormData({ ...profileFormData, twitter: e.target.value })}
                          helperText="Twitter/X handle (optional)"
                        />

                        <TextField
                          label="Discord Invite"
                          fullWidth
                          placeholder="https://discord.gg/..."
                          value={profileFormData.discord || ''}
                          onChange={(e) => setProfileFormData({ ...profileFormData, discord: e.target.value })}
                          helperText="Discord server invite (optional)"
                        />

                        <TextField
                          label="Telegram Group"
                          fullWidth
                          placeholder="https://t.me/..."
                          value={profileFormData.telegram || ''}
                          onChange={(e) => setProfileFormData({ ...profileFormData, telegram: e.target.value })}
                          helperText="Telegram group link (optional)"
                        />
                      </div>
                    </Card>

                    {/* 3. METADATA Section */}
                    <Card className="p-6">
                      <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                        🔧 Metadata (Advanced)
                      </h3>
                      
                      <Alert severity="info" sx={{ mb: 3 }}>
                        Store custom key-value data as JSON. Useful for features not yet in the main schema.
                      </Alert>

                      <TextField
                        label="Custom Metadata (JSON)"
                        fullWidth
                        multiline
                        rows={6}
                        value={JSON.stringify(profileFormData.metadata || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value)
                            setProfileFormData({ ...profileFormData, metadata: parsed })
                          } catch (err) {
                            // Invalid JSON, don't update
                          }
                        }}
                        helperText="Must be valid JSON"
                        sx={{ 
                          '& textarea': { 
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          } 
                        }}
                      />
                    </Card>

                    {/* 4. Save Changes Section */}
                    <Card className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200">
                      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-display text-lg font-bold mb-2">
                            {hasUnsavedChanges ? '⚠️ Unsaved Changes' : '✅ All Changes Saved'}
                          </h3>
                          {hasUnsavedChanges ? (
                            <div className="text-sm text-gray-700">
                              <p className="font-medium mb-1">Modified fields:</p>
                              <div className="flex flex-wrap gap-1">
                                {getChangesDiff().map(field => (
                                  <Chip key={field} label={field} size="small" color="warning" />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-600">
                              No pending changes. All data is up to date.
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <MuiButton
                            variant="outlined"
                            onClick={handleDiscardChanges}
                            disabled={!hasUnsavedChanges || savingProfile}
                          >
                            Discard Changes
                          </MuiButton>
                          
                          <MuiButton
                            variant="contained"
                            size="large"
                            onClick={handleSaveProfileChanges}
                            disabled={!hasUnsavedChanges || savingProfile}
                            sx={{ 
                              bgcolor: '#7C4DFF',
                              '&:hover': { bgcolor: '#6C3FEF' },
                              minWidth: '200px'
                            }}
                          >
                            {savingProfile ? (
                              <>
                                <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
                                Saving...
                              </>
                            ) : (
                              <>💾 Save All Changes</>
                            )}
                          </MuiButton>
                        </div>
                      </div>
                    </Card>

                    {/* 5. Danger Zone */}
                    <Card className="p-6 border-2 border-red-200">
                      <h3 className="font-display text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
                        ⚠️ Profile Danger Zone
                      </h3>
                      
                      <div className="space-y-3">
                        <div className="flex items-start justify-between p-3 bg-red-50 rounded">
                          <div className="flex-1">
                            <p className="font-medium text-sm">Reset to Default Image</p>
                            <p className="text-xs text-gray-600">Remove custom image, use token symbol placeholder</p>
                          </div>
                          <MuiButton 
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => {
                              if (confirm('Reset to default image?')) {
                                setProfileFormData({ ...profileFormData, profile_image_url: null })
                                setImagePreviewUrl(null)
                                setImageFile(null)
                                toast.success('Image will be reset when you save')
                              }
                            }}
                          >
                            Reset Image
                          </MuiButton>
                        </div>

                        <div className="flex items-start justify-between p-3 bg-red-50 rounded">
                          <div className="flex-1">
                            <p className="font-medium text-sm">Clear All Profile Data</p>
                            <p className="text-xs text-gray-600">Reset description, image, and social links (keeps name/symbol/mint)</p>
                          </div>
                          <MuiButton 
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => {
                              if (confirm('Clear all profile data? This will keep name, symbol, and mint address only.')) {
                                setProfileFormData({
                                  ...profileFormData,
                                  description: '',
                                  profile_image_url: null,
                                  website: '',
                                  twitter: '',
                                  discord: '',
                                  telegram: '',
                                  metadata: {}
                                })
                                setImagePreviewUrl(null)
                                setImageFile(null)
                                toast.success('Profile data cleared (not saved yet)')
                              }
                            }}
                          >
                            Clear Profile
                          </MuiButton>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Chat Messages Tab - Enhanced */}
                {currentTab === 'chat' && (
                  <div className="space-y-4">
                    <Alert severity="info">
                      <AlertTitle>All Messages ({mergedMessages.length} total)</AlertTitle>
                      Showing all user chat messages and system events. Use filters to narrow down results.
                    </Alert>

                    {/* Filters Section */}
                    <Card className="p-4">
                      <h3 className="font-display text-sm font-semibold mb-3 text-text-muted uppercase">
                        Filters
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                        {/* Message Type Filter */}
                        <FormControl fullWidth size="small">
                          <InputLabel>Message Type</InputLabel>
                          <Select
                            value={messageTypeFilter}
                            label="Message Type"
                            onChange={(e) => setMessageTypeFilter(e.target.value as any)}
                          >
                            <MenuItem value="all">All Messages</MenuItem>
                            <MenuItem value="user">User Chat Only</MenuItem>
                            <MenuItem value="system">System Events Only</MenuItem>
                          </Select>
                        </FormControl>

                        {/* Tier Filter */}
                        <FormControl fullWidth size="small">
                          <InputLabel>Tier</InputLabel>
                          <Select
                            value={tierFilter}
                            label="Tier"
                            onChange={(e) => setTierFilter(e.target.value)}
                          >
                            <MenuItem value="all">All Tiers</MenuItem>
                            <MenuItem value="mega">Mega</MenuItem>
                            <MenuItem value="whale">Whale</MenuItem>
                            <MenuItem value="holder">Holder</MenuItem>
                            <MenuItem value="small">Small</MenuItem>
                          </Select>
                        </FormControl>

                        {/* Wallet Search */}
                        <TextField
                          fullWidth
                          size="small"
                          label="Wallet Address"
                          placeholder="Search..."
                          value={walletSearch}
                          onChange={(e) => setWalletSearch(e.target.value)}
                        />

                        {/* Date From */}
                        <TextField
                          fullWidth
                          size="small"
                          label="From Date"
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />

                        {/* Date To */}
                        <TextField
                          fullWidth
                          size="small"
                          label="To Date"
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </div>

                      {/* Active Filters Display */}
                      {(messageTypeFilter !== 'all' || tierFilter !== 'all' || walletSearch || dateFrom || dateTo) && (
                        <div className="mt-3 pt-3 border-t border-border-subtle">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-text-muted">Active filters:</span>
                            {messageTypeFilter !== 'all' && (
                              <Chip 
                                label={`Type: ${messageTypeFilter}`} 
                                size="small" 
                                onDelete={() => setMessageTypeFilter('all')}
                              />
                            )}
                            {tierFilter !== 'all' && (
                              <Chip 
                                label={`Tier: ${tierFilter}`} 
                                size="small" 
                                onDelete={() => setTierFilter('all')}
                              />
                            )}
                            {walletSearch && (
                              <Chip 
                                label={`Wallet: ${walletSearch}`} 
                                size="small" 
                                onDelete={() => setWalletSearch('')}
                              />
                            )}
                            {dateFrom && (
                              <Chip 
                                label={`From: ${dateFrom}`} 
                                size="small" 
                                onDelete={() => setDateFrom('')}
                              />
                            )}
                            {dateTo && (
                              <Chip 
                                label={`To: ${dateTo}`} 
                                size="small" 
                                onDelete={() => setDateTo('')}
                              />
                            )}
                            <MuiButton 
                              size="small" 
                              onClick={() => {
                                setMessageTypeFilter('all')
                                setTierFilter('all')
                                setWalletSearch('')
                                setDateFrom('')
                                setDateTo('')
                              }}
                            >
                              Clear All
                            </MuiButton>
                          </div>
                        </div>
                      )}
                    </Card>

                    {/* Bulk Actions */}
                    {selectedMessages.size > 0 && (
                      <Card className="p-4 bg-red-50 border-2 border-red-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Chip 
                              label={`${selectedMessages.size} selected`}
                              color="error"
                            />
                            <MuiButton
                              size="small"
                              onClick={() => setSelectedMessages(new Set())}
                            >
                              Clear Selection
                            </MuiButton>
                          </div>
                          <MuiButton
                            variant="contained"
                            color="error"
                            onClick={handleBulkDelete}
                            disabled={deletingMessages}
                          >
                            {deletingMessages ? (
                              <>
                                <CircularProgress size={16} sx={{ mr: 1 }} color="inherit" />
                                Deleting...
                              </>
                            ) : (
                              `Delete Selected (${selectedMessages.size})`
                            )}
                          </MuiButton>
                        </div>
                      </Card>
                    )}

                    {/* Messages Table */}
                    <Card className="overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-3 py-3 text-left">
                                <input
                                  type="checkbox"
                                  checked={selectedMessages.size === filteredMessages.length && filteredMessages.length > 0}
                                  onChange={handleSelectAll}
                                  className="cursor-pointer"
                                />
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                                Timestamp
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                                Type
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                                Wallet
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                                Tier
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                                Token %
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                                Content
                              </th>
                              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {filteredMessages.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="px-3 py-12 text-center text-gray-500">
                                  No messages found. Try adjusting your filters.
                                </td>
                              </tr>
                            ) : (
                              filteredMessages.map((message) => (
                                <tr 
                                  key={message.id}
                                  className={`hover:bg-gray-50 transition-colors ${
                                    selectedMessages.has(message.id) ? 'bg-blue-50' : ''
                                  }`}
                                >
                                  <td className="px-3 py-3">
                                    <input
                                      type="checkbox"
                                      checked={selectedMessages.has(message.id)}
                                      onChange={() => toggleMessageSelection(message.id)}
                                      className="cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <span className="text-xs text-gray-600 whitespace-nowrap">
                                      {formatTimestampFull(message.timestamp)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <Chip
                                      label={message.type === 'user' ? 'User Chat' : 'System Event'}
                                      size="small"
                                      color={message.type === 'user' ? 'primary' : 'default'}
                                      sx={{ fontSize: 10 }}
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    {message.wallet ? (
                                      <div className="flex items-center gap-1">
                                        <span className="font-mono text-xs text-gray-700">
                                          {shortenAddress(message.wallet)}
                                        </span>
                                        <button 
                                          onClick={() => copyToClipboard(message.wallet!)}
                                          className="text-gray-400 hover:text-gray-600"
                                        >
                                          <ContentCopyIcon sx={{ fontSize: 12 }} />
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3">
                                    {message.tier ? (
                                      <Chip
                                        label={message.tier.toUpperCase()}
                                        size="small"
                                        color={getTierColor(message.tier) as any}
                                        sx={{ fontSize: 9, height: 18 }}
                                      />
                                    ) : (
                                      <span className="text-xs text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3">
                                    {message.tokenPercentage !== null ? (
                                      <span className="text-xs text-gray-700">
                                        {message.tokenPercentage.toFixed(3)}%
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="max-w-md">
                                      <p className="text-sm text-gray-800 line-clamp-2">
                                        {message.content}
                                      </p>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <MuiButton
                                      size="small"
                                      color="error"
                                      onClick={() => handleDeleteMessage(message)}
                                      disabled={deletingMessages}
                                      sx={{ minWidth: 'auto', px: 1 }}
                                    >
                                      <DeleteIcon sx={{ fontSize: 16 }} />
                                    </MuiButton>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Results Summary */}
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
                        Showing {filteredMessages.length} of {mergedMessages.length} total messages
                      </div>
                    </Card>
                  </div>
                )}

                {/* Pending Assets Tab */}
                {currentTab === 'pending-assets' && (
                  <div className="space-y-4">
                    <Alert severity="warning">
                      Assets awaiting community verification. These are managed by the community curation system.
                    </Alert>

                    {pendingAssets.length === 0 ? (
                      <p className="text-text-muted text-center py-12">No pending assets</p>
                    ) : (
                      <div className="space-y-3">
                        {pendingAssets.map((asset) => (
                          <div key={asset.id} className="p-4 bg-white rounded-lg border border-border-subtle">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Chip 
                                    label={asset.asset_type.toUpperCase()} 
                                    size="small"
                                    color="primary"
                                  />
                                  <Chip 
                                    label={asset.verification_status.toUpperCase()} 
                                    size="small"
                                    color={
                                      asset.verification_status === 'verified' ? 'success' :
                                      asset.verification_status === 'backed' ? 'info' :
                                      asset.verification_status === 'hidden' ? 'error' :
                                      'default'
                                    }
                                  />
                                </div>
                                <div className="text-sm space-y-1">
                                  <p><strong>Submitter:</strong> <span className="font-mono">{shortenAddress(asset.submitter_wallet)}</span></p>
                                  <p><strong>Supply Weight:</strong> {asset.total_upvote_weight.toFixed(2)}% ({asset.unique_upvoters_count} voters)</p>
                                  <p><strong>Reports:</strong> {asset.total_report_weight.toFixed(2)}% ({asset.unique_reporters_count} reporters)</p>
                                  {asset.asset_type === 'social' && asset.asset_data && (
                                    <p><strong>Data:</strong> {(asset.asset_data as any).platform} - @{(asset.asset_data as any).handle}</p>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs text-text-muted whitespace-nowrap">
                                {formatDistanceToNow(new Date(asset.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Verified Assets Tab - Comprehensive Management */}
                {currentTab === 'verified-assets' && (
                  <div className="space-y-6">
                    <Alert severity="info">
                      <AlertTitle>Verified Assets Management</AlertTitle>
                      Manage all verified assets for this project. Edit, unverify, or delete assets as needed.
                    </Alert>

                    {/* SOCIAL ASSETS SECTION */}
                    <Card>
                      <div 
                        className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200 cursor-pointer hover:bg-blue-100 transition-colors"
                        onClick={() => setSocialExpanded(!socialExpanded)}
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-xl font-bold flex items-center gap-2">
                            🌐 Social Assets ({verifiedSocialAssets.length})
                          </h3>
                          <div className="flex items-center gap-2">
                            <MuiButton
                              size="small"
                              variant="contained"
                              onClick={(e) => { 
                                e.stopPropagation()
                                setAddingSocial(true)
                              }}
                              sx={{ bgcolor: '#7C4DFF' }}
                            >
                              + Add Social
                            </MuiButton>
                            <span className="text-2xl">{socialExpanded ? '▼' : '▶'}</span>
                          </div>
                        </div>
                      </div>

                      {socialExpanded && (
                        <div className="p-4">
                          {/* Bulk Actions */}
                          {selectedSocialAssets.size > 0 && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                              <span className="text-sm font-medium">{selectedSocialAssets.size} selected</span>
                              <div className="flex gap-2">
                                <MuiButton 
                                  size="small"
                                  onClick={() => handleExportAssets('social')}
                                >
                                  Export JSON
                                </MuiButton>
                                <MuiButton 
                                  size="small"
                                  color="error"
                                  onClick={handleBulkDeleteSocial}
                                >
                                  Delete Selected
                                </MuiButton>
                              </div>
                            </div>
                          )}

                          {verifiedSocialAssets.length === 0 ? (
                            <p className="text-text-muted text-center py-8">No verified social assets</p>
                          ) : (
                            <div className="space-y-2">
                              {verifiedSocialAssets.map((asset) => (
                                <div key={asset.id} className="p-4 bg-white rounded-lg border border-border-subtle">
                                  <div className="flex items-start gap-3">
                                    <input
                                      type="checkbox"
                                      checked={selectedSocialAssets.has(asset.id)}
                                      onChange={() => {
                                        const newSet = new Set(selectedSocialAssets)
                                        if (newSet.has(asset.id)) {
                                          newSet.delete(asset.id)
                                        } else {
                                          newSet.add(asset.id)
                                        }
                                        setSelectedSocialAssets(newSet)
                                      }}
                                      className="mt-1"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-2xl">{getPlatformIcon(asset.platform)}</span>
                                        <span className="font-bold text-lg">@{asset.handle}</span>
                                        <Chip label={asset.platform.toUpperCase()} size="small" color="primary" />
                                        {asset.follower_tier && (
                                          <Chip label={asset.follower_tier} size="small" />
                                        )}
                                        <CheckCircleIcon sx={{ fontSize: 20, color: '#10B981' }} />
                                      </div>
                                      <div className="text-sm text-text-secondary space-y-1">
                                        <p>
                                          <a 
                                            href={`https://${asset.platform}.com/${asset.handle}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent-primary hover:underline"
                                          >
                                            View Profile →
                                          </a>
                                        </p>
                                        {asset.verified_at && (
                                          <p className="text-xs">
                                            Verified {formatDistanceToNow(new Date(asset.verified_at), { addSuffix: true })}
                                          </p>
                                        )}
                                        {asset.verification_code && (
                                          <p className="text-xs font-mono bg-yellow-50 inline-block px-2 py-1 rounded">
                                            Code: {asset.verification_code}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      <MuiButton
                                        size="small"
                                        onClick={() => handleEditSocialAsset(asset)}
                                      >
                                        <EditIcon sx={{ fontSize: 16 }} />
                                      </MuiButton>
                                      <MuiButton
                                        size="small"
                                        color="warning"
                                        onClick={() => handleUnverifySocialAsset(asset.id)}
                                      >
                                        Unverify
                                      </MuiButton>
                                      <MuiButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleDeleteSocialAsset(asset.id)}
                                      >
                                        <DeleteIcon sx={{ fontSize: 16 }} />
                                      </MuiButton>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>

                    {/* CREATIVE ASSETS SECTION */}
                    <Card>
                      <div 
                        className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200 cursor-pointer hover:bg-purple-100 transition-colors"
                        onClick={() => setCreativeExpanded(!creativeExpanded)}
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-xl font-bold flex items-center gap-2">
                            🎨 Creative Assets ({verifiedCreativeAssets.length})
                          </h3>
                          <div className="flex items-center gap-2">
                            <MuiButton
                              size="small"
                              variant="contained"
                              onClick={(e) => {
                                e.stopPropagation()
                                setAddingCreative(true)
                              }}
                              sx={{ bgcolor: '#7C4DFF' }}
                            >
                              + Add Creative
                            </MuiButton>
                            <span className="text-2xl">{creativeExpanded ? '▼' : '▶'}</span>
                          </div>
                        </div>
                      </div>

                      {creativeExpanded && (
                        <div className="p-4">
                          {/* Bulk Actions */}
                          {selectedCreativeAssets.size > 0 && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                              <span className="text-sm font-medium">{selectedCreativeAssets.size} selected</span>
                              <div className="flex gap-2">
                                <MuiButton 
                                  size="small"
                                  onClick={() => handleExportAssets('creative')}
                                >
                                  Export JSON
                                </MuiButton>
                                <MuiButton 
                                  size="small"
                                  color="error"
                                  onClick={handleBulkDeleteCreative}
                                >
                                  Delete Selected
                                </MuiButton>
                              </div>
                            </div>
                          )}

                          {verifiedCreativeAssets.length === 0 ? (
                            <p className="text-text-muted text-center py-8">No creative assets</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {verifiedCreativeAssets.map((asset) => (
                                <div key={asset.id} className="p-4 bg-white rounded-lg border border-border-subtle">
                                  <div className="flex gap-3">
                                    <input
                                      type="checkbox"
                                      checked={selectedCreativeAssets.has(asset.id)}
                                      onChange={() => {
                                        const newSet = new Set(selectedCreativeAssets)
                                        if (newSet.has(asset.id)) {
                                          newSet.delete(asset.id)
                                        } else {
                                          newSet.add(asset.id)
                                        }
                                        setSelectedCreativeAssets(newSet)
                                      }}
                                      className="mt-1"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Chip label={asset.asset_type.toUpperCase()} size="small" color="secondary" />
                                        {asset.asset_name && (
                                          <span className="font-semibold">{asset.asset_name}</span>
                                        )}
                                      </div>
                                      {asset.media_url && (
                                        <div className="mb-2">
                                          <img 
                                            src={asset.media_url}
                                            alt={asset.asset_name || 'Creative asset'}
                                            className="w-full h-32 object-cover rounded"
                                            onError={(e) => {
                                              (e.target as HTMLImageElement).style.display = 'none'
                                            }}
                                          />
                                        </div>
                                      )}
                                      {asset.description && (
                                        <p className="text-sm text-text-secondary line-clamp-2 mb-2">
                                          {asset.description}
                                        </p>
                                      )}
                                      <div className="flex gap-1 mt-2">
                                        <MuiButton
                                          size="small"
                                          onClick={() => handleEditCreativeAsset(asset)}
                                        >
                                          Edit
                                        </MuiButton>
                                        {asset.media_url && (
                                          <MuiButton
                                            size="small"
                                            onClick={() => window.open(asset.media_url, '_blank')}
                                          >
                                            View Full
                                          </MuiButton>
                                        )}
                                        <MuiButton
                                          size="small"
                                          color="error"
                                          onClick={() => handleDeleteCreativeAsset(asset.id)}
                                        >
                                          Delete
                                        </MuiButton>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>

                    {/* LEGAL ASSETS SECTION */}
                    <Card>
                      <div 
                        className="p-4 bg-gradient-to-r from-green-50 to-teal-50 border-b border-gray-200 cursor-pointer hover:bg-green-100 transition-colors"
                        onClick={() => setLegalExpanded(!legalExpanded)}
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-xl font-bold flex items-center gap-2">
                            ⚖️ Legal Assets ({verifiedLegalAssets.length})
                          </h3>
                          <div className="flex items-center gap-2">
                            <MuiButton
                              size="small"
                              variant="contained"
                              onClick={(e) => {
                                e.stopPropagation()
                                setAddingLegal(true)
                              }}
                              sx={{ bgcolor: '#7C4DFF' }}
                            >
                              + Add Legal
                            </MuiButton>
                            <span className="text-2xl">{legalExpanded ? '▼' : '▶'}</span>
                          </div>
                        </div>
                      </div>

                      {legalExpanded && (
                        <div className="p-4">
                          {/* Bulk Actions */}
                          {selectedLegalAssets.size > 0 && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                              <span className="text-sm font-medium">{selectedLegalAssets.size} selected</span>
                              <div className="flex gap-2">
                                <MuiButton 
                                  size="small"
                                  onClick={() => handleExportAssets('legal')}
                                >
                                  Export JSON
                                </MuiButton>
                                <MuiButton 
                                  size="small"
                                  color="error"
                                  onClick={handleBulkDeleteLegal}
                                >
                                  Delete Selected
                                </MuiButton>
                              </div>
                            </div>
                          )}

                          {verifiedLegalAssets.length === 0 ? (
                            <p className="text-text-muted text-center py-8">No legal assets</p>
                          ) : (
                            <div className="space-y-2">
                              {verifiedLegalAssets.map((asset) => (
                                <div key={asset.id} className="p-4 bg-white rounded-lg border border-border-subtle">
                                  <div className="flex items-start gap-3">
                                    <input
                                      type="checkbox"
                                      checked={selectedLegalAssets.has(asset.id)}
                                      onChange={() => {
                                        const newSet = new Set(selectedLegalAssets)
                                        if (newSet.has(asset.id)) {
                                          newSet.delete(asset.id)
                                        } else {
                                          newSet.add(asset.id)
                                        }
                                        setSelectedLegalAssets(newSet)
                                      }}
                                      className="mt-1"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Chip label={asset.asset_type.toUpperCase()} size="small" color="success" />
                                        {asset.asset_name && (
                                          <span className="font-semibold">{asset.asset_name}</span>
                                        )}
                                        {asset.status && (
                                          <Chip 
                                            label={asset.status.toUpperCase()} 
                                            size="small"
                                            color={
                                              asset.status === 'active' ? 'success' :
                                              asset.status === 'pending' ? 'warning' :
                                              'default'
                                            }
                                          />
                                        )}
                                      </div>
                                      <div className="text-sm text-text-secondary space-y-1">
                                        {asset.jurisdiction && (
                                          <p><strong>Jurisdiction:</strong> {asset.jurisdiction}</p>
                                        )}
                                        {asset.registration_id && (
                                          <p><strong>Registration ID:</strong> <span className="font-mono">{asset.registration_id}</span></p>
                                        )}
                                        <p className="text-xs">
                                          Added {formatDistanceToNow(new Date(asset.created_at), { addSuffix: true })}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      <MuiButton
                                        size="small"
                                        onClick={() => handleEditLegalAsset(asset)}
                                      >
                                        <EditIcon sx={{ fontSize: 16 }} />
                                      </MuiButton>
                                      <MuiButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleDeleteLegalAsset(asset.id)}
                                      >
                                        <DeleteIcon sx={{ fontSize: 16 }} />
                                      </MuiButton>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>

                    {/* Edit Social Asset Modal */}
                    <Dialog open={!!editingSocialAsset} onClose={() => setEditingSocialAsset(null)} maxWidth="sm" fullWidth>
                      <DialogTitle>Edit Social Asset</DialogTitle>
                      <DialogContent>
                        <div className="space-y-4 mt-2">
                          <TextField
                            label="Handle"
                            fullWidth
                            value={socialFormData.handle || ''}
                            onChange={(e) => setSocialFormData({ ...socialFormData, handle: e.target.value })}
                          />
                          <TextField
                            label="Platform"
                            fullWidth
                            value={socialFormData.platform || ''}
                            disabled
                          />
                          <FormControl fullWidth>
                            <InputLabel>Follower Tier</InputLabel>
                            <Select
                              value={socialFormData.followerTier || ''}
                              label="Follower Tier"
                              onChange={(e) => setSocialFormData({ ...socialFormData, followerTier: e.target.value })}
                            >
                              <MenuItem value="">None</MenuItem>
                              <MenuItem value="Nano">Nano (1K-10K)</MenuItem>
                              <MenuItem value="Micro">Micro (10K-50K)</MenuItem>
                              <MenuItem value="Mid">Mid (50K-500K)</MenuItem>
                              <MenuItem value="Macro">Macro (500K-1M)</MenuItem>
                              <MenuItem value="Mega">Mega (1M+)</MenuItem>
                            </Select>
                          </FormControl>
                          <TextField
                            label="Verification Code"
                            fullWidth
                            value={socialFormData.verificationCode || ''}
                            onChange={(e) => setSocialFormData({ ...socialFormData, verificationCode: e.target.value })}
                          />
                        </div>
                      </DialogContent>
                      <DialogActions>
                        <MuiButton onClick={() => setEditingSocialAsset(null)}>Cancel</MuiButton>
                        <MuiButton variant="contained" onClick={handleSaveSocialAsset} disabled={processingAsset}>
                          {processingAsset ? 'Saving...' : 'Save Changes'}
                        </MuiButton>
                      </DialogActions>
                    </Dialog>

                    {/* Edit Creative Asset Modal */}
                    <Dialog open={!!editingCreativeAsset} onClose={() => setEditingCreativeAsset(null)} maxWidth="md" fullWidth>
                      <DialogTitle>Edit Creative Asset</DialogTitle>
                      <DialogContent>
                        <div className="space-y-4 mt-2">
                          <FormControl fullWidth>
                            <InputLabel>Asset Type</InputLabel>
                            <Select
                              value={creativeFormData.assetType || ''}
                              label="Asset Type"
                              onChange={(e) => setCreativeFormData({ ...creativeFormData, assetType: e.target.value })}
                            >
                              <MenuItem value="logo">Logo</MenuItem>
                              <MenuItem value="character">Character</MenuItem>
                              <MenuItem value="artwork">Artwork</MenuItem>
                              <MenuItem value="other">Other</MenuItem>
                            </Select>
                          </FormControl>
                          <TextField
                            label="Name"
                            fullWidth
                            value={creativeFormData.name || ''}
                            onChange={(e) => setCreativeFormData({ ...creativeFormData, name: e.target.value })}
                          />
                          <TextField
                            label="Description"
                            fullWidth
                            multiline
                            rows={4}
                            value={creativeFormData.description || ''}
                            onChange={(e) => setCreativeFormData({ ...creativeFormData, description: e.target.value })}
                          />
                          <TextField
                            label="Media URL"
                            fullWidth
                            value={creativeFormData.mediaUrl || ''}
                            onChange={(e) => setCreativeFormData({ ...creativeFormData, mediaUrl: e.target.value })}
                          />
                        </div>
                      </DialogContent>
                      <DialogActions>
                        <MuiButton onClick={() => setEditingCreativeAsset(null)}>Cancel</MuiButton>
                        <MuiButton variant="contained" onClick={handleSaveCreativeAsset} disabled={processingAsset}>
                          {processingAsset ? 'Saving...' : 'Save Changes'}
                        </MuiButton>
                      </DialogActions>
                    </Dialog>

                    {/* Edit Legal Asset Modal */}
                    <Dialog open={!!editingLegalAsset} onClose={() => setEditingLegalAsset(null)} maxWidth="sm" fullWidth>
                      <DialogTitle>Edit Legal Asset</DialogTitle>
                      <DialogContent>
                        <div className="space-y-4 mt-2">
                          <FormControl fullWidth>
                            <InputLabel>Asset Type</InputLabel>
                            <Select
                              value={legalFormData.assetType || ''}
                              label="Asset Type"
                              onChange={(e) => setLegalFormData({ ...legalFormData, assetType: e.target.value })}
                            >
                              <MenuItem value="domain">Domain</MenuItem>
                              <MenuItem value="trademark">Trademark</MenuItem>
                              <MenuItem value="copyright">Copyright</MenuItem>
                              <MenuItem value="other">Other</MenuItem>
                            </Select>
                          </FormControl>
                          <TextField
                            label="Name"
                            fullWidth
                            value={legalFormData.name || ''}
                            onChange={(e) => setLegalFormData({ ...legalFormData, name: e.target.value })}
                          />
                          <FormControl fullWidth>
                            <InputLabel>Status</InputLabel>
                            <Select
                              value={legalFormData.status || 'active'}
                              label="Status"
                              onChange={(e) => setLegalFormData({ ...legalFormData, status: e.target.value })}
                            >
                              <MenuItem value="active">Active</MenuItem>
                              <MenuItem value="pending">Pending</MenuItem>
                              <MenuItem value="expired">Expired</MenuItem>
                            </Select>
                          </FormControl>
                          <TextField
                            label="Jurisdiction"
                            fullWidth
                            value={legalFormData.jurisdiction || ''}
                            onChange={(e) => setLegalFormData({ ...legalFormData, jurisdiction: e.target.value })}
                          />
                          <TextField
                            label="Registration ID"
                            fullWidth
                            value={legalFormData.registrationId || ''}
                            onChange={(e) => setLegalFormData({ ...legalFormData, registrationId: e.target.value })}
                          />
                        </div>
                      </DialogContent>
                      <DialogActions>
                        <MuiButton onClick={() => setEditingLegalAsset(null)}>Cancel</MuiButton>
                        <MuiButton variant="contained" onClick={handleSaveLegalAsset} disabled={processingAsset}>
                          {processingAsset ? 'Saving...' : 'Save Changes'}
                        </MuiButton>
                      </DialogActions>
                    </Dialog>
                  </div>
                )}

                {/* Karma & Votes Tab */}
                {currentTab === 'karma' && (
                  <div className="space-y-4">
                    <Alert severity="info">
                      Top 50 contributors sorted by karma points
                    </Alert>

                    {karmaLeaderboard.length === 0 ? (
                      <p className="text-text-muted text-center py-12">No karma data yet</p>
                    ) : (
                      <div className="space-y-2">
                        {karmaLeaderboard.map((karma, index) => (
                          <div 
                            key={karma.id} 
                            className={`p-4 bg-white rounded-lg border border-border-subtle ${
                              karma.is_banned ? 'bg-red-50' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-4 flex-1">
                                <span className="text-lg font-bold text-text-muted w-8">#{index + 1}</span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-sm">{shortenAddress(karma.wallet_address)}</span>
                                    {karma.is_banned && (
                                      <Chip label="BANNED" color="error" size="small" />
                                    )}
                                  </div>
                                  <div className="flex gap-4 text-xs text-text-muted">
                                    <span>Assets: {karma.assets_added_count}</span>
                                    <span>Upvotes: {karma.upvotes_given_count}</span>
                                    <span>Reports: {karma.reports_given_count}</span>
                                    <span>Warnings: {karma.warning_count}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-purple-600">{karma.total_karma_points.toFixed(0)}</p>
                                <p className="text-xs text-text-muted">karma</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Team & Wallets Tab */}
                {currentTab === 'team' && (
                  <div className="space-y-4">
                    <h3 className="font-display text-lg font-semibold">
                      Team Wallets ({project.team_wallets.length})
                    </h3>

                    {project.team_wallets.length === 0 ? (
                      <p className="text-text-muted text-center py-12">No team wallets added</p>
                    ) : (
                      <div className="space-y-2">
                        {project.team_wallets.map((wallet) => (
                          <div key={wallet.id} className="p-4 bg-white rounded-lg border border-border-subtle">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="font-medium">{wallet.label || 'Team Wallet'}</p>
                                <p className="font-mono text-xs text-text-muted flex items-center gap-2">
                                  {wallet.wallet_address}
                                  <button onClick={() => copyToClipboard(wallet.wallet_address)}>
                                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                                  </button>
                                </p>
                              </div>
                              <a
                                href={`https://solscan.io/account/${wallet.wallet_address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent-primary hover:text-accent-primary-hover text-sm font-medium"
                              >
                                View on Solscan →
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Activity Log Tab */}
                {currentTab === 'activity' && (
                  <div className="space-y-6">
                    {/* Quick Stats */}
                    {logStats && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-sm text-text-muted mb-1">Total Actions</p>
                            <p className="text-2xl font-bold">{logStats.totalActions}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-sm text-text-muted mb-1">Actions Today</p>
                            <p className="text-2xl font-bold text-blue-600">{logStats.actionsToday}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-sm text-text-muted mb-1">Most Active Admin</p>
                            <p className="text-sm font-mono truncate">
                              {logStats.mostActiveAdmin ? 
                                `${logStats.mostActiveAdmin.wallet.slice(0, 8)}... (${logStats.mostActiveAdmin.count})` 
                                : 'N/A'}
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-sm text-text-muted mb-1">Most Common Action</p>
                            <p className="text-sm font-medium">
                              {logStats.mostCommonAction ? 
                                `${logStats.mostCommonAction.action} (${logStats.mostCommonAction.count})` 
                                : 'N/A'}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* Filters */}
                    <Card>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Admin Wallet</label>
                            <Select
                              value={logAdminFilter}
                              onChange={(e) => setLogAdminFilter(e.target.value as string)}
                              size="small"
                              fullWidth
                            >
                              <MenuItem value="all">All Admins</MenuItem>
                              {Array.from(new Set(activityLogs.map(log => log.admin_wallet))).map(wallet => (
                                <MenuItem key={wallet} value={wallet}>
                                  {wallet.slice(0, 8)}...{wallet.slice(-4)}
                                </MenuItem>
                              ))}
                            </Select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium mb-2">Date From</label>
                            <TextField
                              type="date"
                              value={logDateFrom}
                              onChange={(e) => setLogDateFrom(e.target.value)}
                              size="small"
                              fullWidth
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium mb-2">Date To</label>
                            <TextField
                              type="date"
                              value={logDateTo}
                              onChange={(e) => setLogDateTo(e.target.value)}
                              size="small"
                              fullWidth
                            />
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <label className="block text-sm font-medium mb-2">Search Entity</label>
                          <TextField
                            placeholder="Search by entity ID..."
                            value={logEntitySearch}
                            onChange={(e) => setLogEntitySearch(e.target.value)}
                            size="small"
                            fullWidth
                          />
                        </div>

                        <div className="mt-4 flex gap-2">
                          <MuiButton
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              setLogAdminFilter('all')
                              setLogDateFrom('')
                              setLogDateTo('')
                              setLogEntitySearch('')
                              setFilteredLogs(activityLogs)
                            }}
                          >
                            Clear Filters
                          </MuiButton>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Activity Log Table */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>Activity History</CardTitle>
                          <MuiButton
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              // Export logs to CSV functionality
                              const csvContent = [
                                ['Timestamp', 'Admin', 'Action', 'Entity Type', 'Entity ID', 'Details'],
                                ...filteredLogs.map(log => [
                                  log.created_at,
                                  log.admin_wallet,
                                  log.action,
                                  log.entity_type || '',
                                  log.entity_id || '',
                                  JSON.stringify(log.details)
                                ])
                              ].map(row => row.join(',')).join('\n')
                              
                              const blob = new Blob([csvContent], { type: 'text/csv' })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `activity-log-${project?.token_symbol}-${new Date().toISOString().split('T')[0]}.csv`
                              a.click()
                              URL.revokeObjectURL(url)
                            }}
                          >
                            Export as CSV
                          </MuiButton>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {loadingLogs ? (
                          <div className="text-center py-12">
                            <CircularProgress />
                          </div>
                        ) : filteredLogs.length === 0 ? (
                          <p className="text-center py-12 text-text-muted">No activity logs found</p>
                        ) : (
                          <div className="space-y-2">
                            {filteredLogs
                              .slice(logsPage * logsPerPage, (logsPage + 1) * logsPerPage)
                              .map((log) => (
                                <div
                                  key={log.id}
                                  className="p-4 border border-border-subtle rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Chip
                                          label={log.action.replace(/_/g, ' ').toUpperCase()}
                                          size="small"
                                          color={
                                            log.action.includes('delete') || log.action.includes('ban') || log.action.includes('reset')
                                              ? 'error'
                                              : log.action.includes('edit') || log.action.includes('adjust')
                                              ? 'primary'
                                              : log.action.includes('approve') || log.action.includes('unban')
                                              ? 'success'
                                              : 'default'
                                          }
                                        />
                                        <span className="text-xs text-text-muted">
                                          {new Date(log.created_at).toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center gap-2 text-sm mb-1">
                                        <span className="font-medium">Admin:</span>
                                        <span className="font-mono text-xs">
                                          {log.admin_wallet.slice(0, 8)}...{log.admin_wallet.slice(-4)}
                                        </span>
                                        <button
                                          onClick={() => copyToClipboard(log.admin_wallet)}
                                          className="text-accent-primary hover:text-accent-primary-hover"
                                        >
                                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                                        </button>
                                      </div>
                                      
                                      {log.entity_type && (
                                        <div className="text-sm text-text-muted">
                                          {log.entity_type}: {log.entity_id}
                                        </div>
                                      )}
                                      
                                      {log.details && (
                                        <div className="mt-2 text-xs text-text-muted font-mono truncate">
                                          {JSON.stringify(log.details).slice(0, 100)}
                                          {JSON.stringify(log.details).length > 100 && '...'}
                                        </div>
                                      )}
                                    </div>
                                    
                                    <MuiButton
                                      variant="outlined"
                                      size="small"
                                      onClick={() => setViewingLogDetails(log)}
                                    >
                                      View Details
                                    </MuiButton>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                        
                        {/* Pagination */}
                        {filteredLogs.length > logsPerPage && (
                          <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <p className="text-sm text-text-muted">
                              Showing {logsPage * logsPerPage + 1} to {Math.min((logsPage + 1) * logsPerPage, filteredLogs.length)} of {filteredLogs.length}
                            </p>
                            <div className="flex gap-2">
                              <MuiButton
                                size="small"
                                disabled={logsPage === 0}
                                onClick={() => setLogsPage(logsPage - 1)}
                              >
                                Previous
                              </MuiButton>
                              <MuiButton
                                size="small"
                                disabled={(logsPage + 1) * logsPerPage >= filteredLogs.length}
                                onClick={() => setLogsPage(logsPage + 1)}
                              >
                                Next
                              </MuiButton>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Log Details Modal */}
                <Dialog
                  open={!!viewingLogDetails}
                  onClose={() => setViewingLogDetails(null)}
                  maxWidth="md"
                  fullWidth
                >
                  <DialogTitle>Activity Log Details</DialogTitle>
                  <DialogContent>
                    {viewingLogDetails && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-text-muted mb-1">Action</p>
                          <Chip label={viewingLogDetails.action.replace(/_/g, ' ').toUpperCase()} />
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-text-muted mb-1">Admin Wallet</p>
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                              {viewingLogDetails.admin_wallet}
                            </code>
                            <button onClick={() => copyToClipboard(viewingLogDetails.admin_wallet)}>
                              <ContentCopyIcon sx={{ fontSize: 16 }} />
                            </button>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-text-muted mb-1">Timestamp</p>
                          <p className="text-sm">
                            {new Date(viewingLogDetails.created_at).toLocaleString()}
                          </p>
                        </div>
                        
                        {viewingLogDetails.entity_type && (
                          <div>
                            <p className="text-sm font-medium text-text-muted mb-1">Entity</p>
                            <p className="text-sm">
                              Type: {viewingLogDetails.entity_type}<br />
                              ID: {viewingLogDetails.entity_id}
                            </p>
                          </div>
                        )}
                        
                        {viewingLogDetails.details && (
                          <div>
                            <p className="text-sm font-medium text-text-muted mb-2">Details</p>
                            <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
                              {JSON.stringify(viewingLogDetails.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </DialogContent>
                  <DialogActions>
                    <MuiButton onClick={() => setViewingLogDetails(null)}>Close</MuiButton>
                  </DialogActions>
                </Dialog>

                {/* Danger Zone Tab */}
                {currentTab === 'danger' && (
                  <div className="space-y-6">
                    <Alert severity="error">
                      <AlertTitle>Danger Zone</AlertTitle>
                      These actions are permanent and cannot be undone. Use with extreme caution.
                    </Alert>

                    <Card className="p-6 border-2 border-red-200">
                      <h3 className="font-display text-lg font-semibold text-red-600 mb-2">
                        Reset Chat Messages
                      </h3>
                      <p className="text-sm text-text-secondary mb-4">
                        Delete all holder chat messages and curation feed messages for this project.
                      </p>
                      <MuiButton 
                        variant="outlined" 
                        color="error"
                        onClick={async () => {
                          if (confirm('Are you sure? This will delete ALL chat messages.')) {
                            try {
                              await supabase.from('chat_messages').delete().eq('project_id', project.id)
                              await supabase.from('curation_chat_messages').delete().eq('project_id', project.id)
                              toast.success('Chat messages cleared')
                              loadChatMessages()
                            } catch (error) {
                              toast.error('Failed to clear messages')
                            }
                          }
                        }}
                      >
                        Reset Chat
                      </MuiButton>
                    </Card>

                    <Card className="p-6 border-2 border-red-200">
                      <h3 className="font-display text-lg font-semibold text-red-600 mb-2">
                        Reset Karma System
                      </h3>
                      <p className="text-sm text-text-secondary mb-4">
                        Reset all karma points, votes, and pending assets. This will clear the entire curation system.
                      </p>
                      <MuiButton 
                        variant="outlined" 
                        color="error"
                        onClick={async () => {
                          if (confirm('Are you sure? This will reset the entire karma and voting system.')) {
                            try {
                              // Delete votes first (foreign key constraint)
                              const { data: assets } = await supabase
                                .from('pending_assets')
                                .select('id')
                                .eq('project_id', project.id)
                              
                              if (assets) {
                                await supabase
                                  .from('asset_votes')
                                  .delete()
                                  .in('pending_asset_id', assets.map(a => a.id))
                              }
                              
                              await supabase.from('pending_assets').delete().eq('project_id', project.id)
                              await supabase.from('wallet_karma').delete().eq('project_id', project.id)
                              
                              toast.success('Karma system reset')
                              loadKarmaData()
                              loadPendingAssets()
                            } catch (error) {
                              console.error(error)
                              toast.error('Failed to reset karma system')
                            }
                          }
                        }}
                      >
                        Reset Karma
                      </MuiButton>
                    </Card>

                    <Card className="p-6 border-2 border-red-300">
                      <h3 className="font-display text-lg font-semibold text-red-700 mb-2">
                        Delete Project
                      </h3>
                      <p className="text-sm text-text-secondary mb-4">
                        Permanently delete this project and ALL associated data. This cannot be undone.
                      </p>
                      <MuiButton 
                        variant="contained" 
                        color="error"
                        onClick={() => setShowDeleteModal(true)}
                      >
                        Delete Project Forever
                      </MuiButton>
                    </Card>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onClose={() => setShowEditModal(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Project</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Token Name"
              fullWidth
              value={editFormData.token_name || ''}
              onChange={(e) => setEditFormData({ ...editFormData, token_name: e.target.value })}
            />
            <TextField
              label="Token Symbol"
              fullWidth
              value={editFormData.token_symbol || ''}
              onChange={(e) => setEditFormData({ ...editFormData, token_symbol: e.target.value })}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={4}
              value={editFormData.description || ''}
              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
            />
            <TextField
              label="Profile Image URL"
              fullWidth
              value={editFormData.profile_image_url || ''}
              onChange={(e) => setEditFormData({ ...editFormData, profile_image_url: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => setShowEditModal(false)}>Cancel</MuiButton>
          <MuiButton onClick={handleUpdateProject} variant="contained">Save Changes</MuiButton>
        </DialogActions>
      </Dialog>

      {/* Change Status Modal */}
      <Dialog open={showStatusModal} onClose={() => setShowStatusModal(false)}>
        <DialogTitle>Change Project Status</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={newStatus}
                label="Status"
                onChange={(e) => setNewStatus(e.target.value as any)}
              >
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="live">Live</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => setShowStatusModal(false)}>Cancel</MuiButton>
          <MuiButton onClick={handleChangeStatus} variant="contained">Change Status</MuiButton>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <DialogTitle>
          <WarningIcon sx={{ color: '#DC2626', mr: 1 }} />
          Delete Project Forever?
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            This action is PERMANENT and cannot be undone!
          </Alert>
          <p className="font-body text-sm text-text-secondary">
            This will permanently delete:
          </p>
          <ul className="list-disc list-inside mt-2 text-sm text-text-secondary space-y-1">
            <li>Project profile and metadata</li>
            <li>All social, creative, and legal assets</li>
            <li>All chat messages</li>
            <li>All pending and verified assets</li>
            <li>All karma points and votes</li>
            <li>All team wallet records</li>
          </ul>
          <p className="font-body text-sm font-semibold text-red-600 mt-4">
            Are you absolutely sure you want to delete "{project?.token_name}"?
          </p>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => setShowDeleteModal(false)}>Cancel</MuiButton>
          <MuiButton onClick={handleDeleteProject} color="error" variant="contained">
            Yes, Delete Forever
          </MuiButton>
        </DialogActions>
      </Dialog>
    </div>
  )
}

