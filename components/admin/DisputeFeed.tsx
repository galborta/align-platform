'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow, differenceInDays, format } from 'date-fns'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  Slider,
  TextField,
  CircularProgress,
  Alert,
  Collapse,
  IconButton,
  Tooltip,
  Avatar,
  Tabs,
  Tab,
  Divider
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import GavelIcon from '@mui/icons-material/Gavel'
import PersonIcon from '@mui/icons-material/Person'
import WorkIcon from '@mui/icons-material/Work'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SyncIcon from '@mui/icons-material/Sync'
import HistoryIcon from '@mui/icons-material/History'
import { toast } from 'react-hot-toast'

interface DisputeWithJob {
  id: string
  job_id: string
  status: string
  opened_by: 'poster' | 'worker'
  reason: string
  created_at: string
  ends_at: string | null
  dispute_type?: string
  admin_wallet?: string
  worker_percentage?: number
  poster_percentage?: number
  admin_resolution_notes?: string
  admin_decided_at?: string
  escrow_distributed?: boolean
  jobs: {
    id: string
    title: string
    poster_wallet: string
    assigned_to: string
    payment_amount_tokens: number
    payment_amount_usd: number
    escrow_token_mint: string
    escrow_amount_tokens?: number
    status?: string
  }
}

interface DisputeFeedProps {
  editorWallet: string
  highlightDisputeId?: string | null
  isGlobalAdmin: boolean
}

const PRESET_SPLITS = [
  { label: '100% Worker', worker: 100, poster: 0, color: '#36C170' },
  { label: '75/25', worker: 75, poster: 25, color: '#10B981' },
  { label: '50/50', worker: 50, poster: 50, color: '#F59E0B' },
  { label: '25/75', worker: 25, poster: 75, color: '#FB923C' },
  { label: '100% Poster', worker: 0, poster: 100, color: '#EF4444' },
]

export function DisputeFeed({ editorWallet, highlightDisputeId, isGlobalAdmin }: DisputeFeedProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending')
  const [disputes, setDisputes] = useState<DisputeWithJob[]>([])
  const [resolvedDisputes, setResolvedDisputes] = useState<DisputeWithJob[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDispute, setExpandedDispute] = useState<string | null>(highlightDisputeId || null)
  const [distributingId, setDistributingId] = useState<string | null>(null)
  const [resolutionState, setResolutionState] = useState<Record<string, {
    workerPercentage: number
    posterPercentage: number
    notes: string
    resolving: boolean
  }>>({})

  // Load pending and resolved disputes
  const loadDisputes = useCallback(async () => {
    if (!isGlobalAdmin) {
      setDisputes([])
      setResolvedDisputes([])
      setLoading(false)
      return
    }

    try {
      // Load pending disputes (not resolved by admin yet)
      const { data: pendingData, error: pendingError } = await supabase
        .from('job_disputes')
        .select(`
          id,
          job_id,
          status,
          opened_by,
          reason,
          created_at,
          ends_at,
          dispute_type,
          jobs (
            id,
            title,
            poster_wallet,
            assigned_to,
            payment_amount_tokens,
            payment_amount_usd,
            escrow_token_mint,
            escrow_amount_tokens,
            status
          )
        `)
        .is('admin_wallet', null)
        .neq('status', 'resolved')
        .order('created_at', { ascending: false })

      if (pendingError) {
        console.error('Error loading pending disputes:', pendingError)
        toast.error('Failed to load disputes')
        return
      }

      setDisputes((pendingData as any[]) || [])

      // Load resolved disputes (with admin resolution)
      const { data: resolvedData, error: resolvedError } = await supabase
        .from('job_disputes')
        .select(`
          id,
          job_id,
          status,
          opened_by,
          reason,
          created_at,
          ends_at,
          dispute_type,
          admin_wallet,
          worker_percentage,
          poster_percentage,
          admin_resolution_notes,
          admin_decided_at,
          escrow_distributed,
          jobs (
            id,
            title,
            poster_wallet,
            assigned_to,
            payment_amount_tokens,
            payment_amount_usd,
            escrow_token_mint,
            escrow_amount_tokens,
            status
          )
        `)
        .eq('status', 'resolved')
        .order('admin_decided_at', { ascending: false })
        .limit(50)

      if (resolvedError) {
        console.error('Error loading resolved disputes:', resolvedError)
      } else {
        setResolvedDisputes((resolvedData as any[]) || [])
      }
    } catch (err) {
      console.error('Error in loadDisputes:', err)
    } finally {
      setLoading(false)
    }
  }, [isGlobalAdmin])

  useEffect(() => {
    loadDisputes()

    // Subscribe to dispute changes
    const channel = supabase
      .channel('admin-disputes-feed')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_disputes'
        },
        () => {
          loadDisputes()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [loadDisputes])

  // Auto-expand highlighted dispute
  useEffect(() => {
    if (highlightDisputeId) {
      setExpandedDispute(highlightDisputeId)
    }
  }, [highlightDisputeId])

  // Initialize resolution state for a dispute
  const initResolutionState = (disputeId: string) => {
    if (!resolutionState[disputeId]) {
      setResolutionState(prev => ({
        ...prev,
        [disputeId]: {
          workerPercentage: 50,
          posterPercentage: 50,
          notes: '',
          resolving: false
        }
      }))
    }
  }

  // Handle dispute expansion
  const handleToggleDispute = (disputeId: string) => {
    if (expandedDispute === disputeId) {
      setExpandedDispute(null)
    } else {
      setExpandedDispute(disputeId)
      initResolutionState(disputeId)
    }
  }

  // Handle preset click
  const handlePresetClick = (disputeId: string, workerPct: number) => {
    setResolutionState(prev => ({
      ...prev,
      [disputeId]: {
        ...prev[disputeId],
        workerPercentage: workerPct,
        posterPercentage: 100 - workerPct
      }
    }))
  }

  // Handle slider change
  const handleSliderChange = (disputeId: string, value: number) => {
    setResolutionState(prev => ({
      ...prev,
      [disputeId]: {
        ...prev[disputeId],
        workerPercentage: value,
        posterPercentage: 100 - value
      }
    }))
  }

  // Handle notes change
  const handleNotesChange = (disputeId: string, notes: string) => {
    setResolutionState(prev => ({
      ...prev,
      [disputeId]: {
        ...prev[disputeId],
        notes
      }
    }))
  }

  // Handle resolve - calls API route which handles DB update, notifications, and emails
  const handleResolve = async (dispute: DisputeWithJob) => {
    const state = resolutionState[dispute.id]
    if (!state) return

    if (!state.notes.trim()) {
      toast.error('Please provide resolution notes')
      return
    }

    setResolutionState(prev => ({
      ...prev,
      [dispute.id]: { ...prev[dispute.id], resolving: true }
    }))

    try {
      // Call API route to handle resolution (DB + notifications + emails)
      const response = await fetch('/api/disputes/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId: dispute.id,
          adminWallet: editorWallet,
          workerPercentage: state.workerPercentage,
          posterPercentage: state.posterPercentage,
          resolutionNotes: state.notes.trim()
        })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Resolution error:', result)
        toast.error(result.error || 'Failed to resolve dispute')
        return
      }

      // Check if escrow was distributed
      const escrowInfo = result.escrowDistribution
      if (escrowInfo?.success) {
        toast.success(`Dispute resolved! Worker received ${escrowInfo.workerReceived?.toFixed(2) || 0} tokens, Poster refunded ${escrowInfo.posterRefunded?.toFixed(2) || 0} tokens.`, {
          icon: '⚖️',
          duration: 5000,
          style: { background: '#059669', color: '#fff' }
        })
      } else {
        toast.success('Dispute resolved successfully!', {
          icon: '⚖️',
          duration: 4000,
          style: { background: '#FF6B35', color: '#fff' }
        })
        
        if (escrowInfo?.error) {
          console.warn('Escrow distribution had an issue:', escrowInfo.error)
          toast.error(`Note: Token distribution issue - ${escrowInfo.error}`, { duration: 6000 })
        }
      }

      // Refresh the list
      loadDisputes()
      setExpandedDispute(null)
    } catch (err) {
      console.error('Error resolving dispute:', err)
      toast.error('Failed to resolve dispute')
    } finally {
      setResolutionState(prev => ({
        ...prev,
        [dispute.id]: { ...prev[dispute.id], resolving: false }
      }))
    }
  }

  // Handle manual escrow distribution for old disputes
  const handleDistributeEscrow = async (dispute: DisputeWithJob) => {
    if (!dispute.worker_percentage && dispute.worker_percentage !== 0) {
      toast.error('Missing worker percentage for this dispute')
      return
    }

    setDistributingId(dispute.id)
    
    try {
      const response = await fetch('/api/disputes/distribute-escrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId: dispute.id,
          adminWallet: editorWallet
        })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Distribution error:', result)
        toast.error(result.error || 'Failed to distribute escrow')
        return
      }

      if (result.escrowDistribution?.success) {
        toast.success(`Tokens distributed! Worker: ${result.escrowDistribution.workerReceived?.toFixed(2) || 0}, Poster: ${result.escrowDistribution.posterRefunded?.toFixed(2) || 0}`, {
          icon: '💰',
          duration: 5000,
          style: { background: '#059669', color: '#fff' }
        })
      } else {
        toast.success('Distribution processed', { icon: '✅' })
      }

      // Refresh the list
      loadDisputes()
    } catch (err) {
      console.error('Error distributing escrow:', err)
      toast.error('Failed to distribute escrow')
    } finally {
      setDistributingId(null)
    }
  }

  // Format wallet address
  const formatAddress = (address: string) => {
    if (!address) return 'N/A'
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={32} sx={{ color: '#FF6B35' }} />
      </Box>
    )
  }

  if (!isGlobalAdmin) {
    return (
      <Alert severity="warning" sx={{ m: 2 }}>
        Only global admins can view and resolve disputes.
      </Alert>
    )
  }

  // Render pending disputes list
  const renderPendingDisputes = () => {
    if (disputes.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
          <CheckCircleIcon sx={{ fontSize: 48, color: '#36C170', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Pending Disputes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All disputes have been resolved. Check back later.
          </Typography>
        </Box>
      )
    }

    return disputes.map((dispute) => {
        const daysOpen = differenceInDays(new Date(), new Date(dispute.created_at))
        const state = resolutionState[dispute.id]
        const isExpanded = expandedDispute === dispute.id
        const isHighlighted = highlightDisputeId === dispute.id

        return (
          <Paper
            key={dispute.id}
            elevation={isHighlighted ? 4 : 1}
            sx={{
              overflow: 'hidden',
              border: isHighlighted ? '2px solid #FF6B35' : '1px solid',
              borderColor: isHighlighted ? '#FF6B35' : 'divider',
              borderRadius: '12px',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: '#FF6B35',
                boxShadow: 2
              }
            }}
          >
            {/* Dispute Header */}
            <Box
              onClick={() => handleToggleDispute(dispute.id)}
              sx={{
                p: 2,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 2,
                bgcolor: isExpanded ? 'rgba(255, 107, 53, 0.04)' : 'transparent'
              }}
            >
              {/* Icon */}
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: 'rgba(255, 107, 53, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <WarningAmberIcon sx={{ fontSize: 20, color: '#FF6B35' }} />
              </Box>

              {/* Content */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1A1A1E' }}>
                    {dispute.jobs?.title || 'Unknown Job'}
                  </Typography>
                  <Chip
                    label={`${daysOpen}d open`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '10px',
                      fontWeight: 600,
                      bgcolor: daysOpen > 7 ? '#FEE2E2' : daysOpen > 3 ? '#FEF3C7' : '#ECFDF5',
                      color: daysOpen > 7 ? '#991B1B' : daysOpen > 3 ? '#92400E' : '#065F46'
                    }}
                  />
                </Box>
                
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Opened by {dispute.opened_by === 'poster' ? 'Job Poster' : 'Worker'} • {formatDistanceToNow(new Date(dispute.created_at), { addSuffix: true })}
                </Typography>
                
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mt: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: isExpanded ? 'unset' : 2,
                    WebkitBoxOrient: 'vertical'
                  }}
                >
                  {dispute.reason}
                </Typography>
              </Box>

              {/* Expand/Collapse Icon */}
              <IconButton size="small" sx={{ flexShrink: 0 }}>
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            {/* Expanded Resolution UI */}
            <Collapse in={isExpanded}>
              <Box sx={{ px: 2, pb: 2, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                {/* Job Details */}
                <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AttachMoneyIcon sx={{ fontSize: 16, color: '#6B7280' }} />
                    <Typography variant="caption" color="text.secondary">
                      Budget: {dispute.jobs?.payment_amount_tokens?.toLocaleString()} tokens (${dispute.jobs?.payment_amount_usd?.toLocaleString()})
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon sx={{ fontSize: 16, color: '#6B7280' }} />
                    <Typography variant="caption" color="text.secondary">
                      Poster: {formatAddress(dispute.jobs?.poster_wallet || '')}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WorkIcon sx={{ fontSize: 16, color: '#6B7280' }} />
                    <Typography variant="caption" color="text.secondary">
                      Worker: {formatAddress(dispute.jobs?.assigned_to || '')}
                    </Typography>
                  </Box>
                </Box>

                {/* Preset Buttons */}
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#1A1A1E', display: 'block', mb: 1 }}>
                  Quick Split Options
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  {PRESET_SPLITS.map((preset) => (
                    <Button
                      key={preset.label}
                      size="small"
                      variant={state?.workerPercentage === preset.worker ? 'contained' : 'outlined'}
                      onClick={() => handlePresetClick(dispute.id, preset.worker)}
                      sx={{
                        fontSize: '11px',
                        py: 0.5,
                        px: 1.5,
                        borderColor: preset.color,
                        color: state?.workerPercentage === preset.worker ? '#fff' : preset.color,
                        bgcolor: state?.workerPercentage === preset.worker ? preset.color : 'transparent',
                        '&:hover': {
                          bgcolor: state?.workerPercentage === preset.worker ? preset.color : `${preset.color}10`,
                          borderColor: preset.color
                        }
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </Box>

                {/* Custom Slider */}
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#1A1A1E', display: 'block', mb: 1 }}>
                  Custom Split: Worker {state?.workerPercentage || 50}% / Poster {state?.posterPercentage || 50}%
                </Typography>
                <Box sx={{ px: 1, mb: 2 }}>
                  <Slider
                    value={state?.workerPercentage || 50}
                    onChange={(_, value) => handleSliderChange(dispute.id, value as number)}
                    min={0}
                    max={100}
                    step={5}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 50, label: '50%' },
                      { value: 100, label: '100%' }
                    ]}
                    sx={{
                      color: '#FF6B35',
                      '& .MuiSlider-mark': { backgroundColor: '#E5E7F0' },
                      '& .MuiSlider-markLabel': { fontSize: 10 }
                    }}
                  />
                </Box>

                {/* Resolution Notes */}
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#1A1A1E', display: 'block', mb: 1 }}>
                  Resolution Notes (Required)
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Explain your resolution decision..."
                  value={state?.notes || ''}
                  onChange={(e) => handleNotesChange(dispute.id, e.target.value)}
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': { borderColor: '#FF6B35' },
                      '&.Mui-focused fieldset': { borderColor: '#FF6B35' }
                    }
                  }}
                />

                {/* Resolve Button */}
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => handleResolve(dispute)}
                  disabled={state?.resolving || !state?.notes?.trim()}
                  startIcon={state?.resolving ? <CircularProgress size={18} color="inherit" /> : <GavelIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    bgcolor: '#FF6B35',
                    color: '#fff',
                    textTransform: 'none',
                    fontWeight: 600,
                    py: 1.5,
                    '&:hover': { bgcolor: '#E55A2B' },
                    '&:disabled': { bgcolor: '#E5E7F0', color: '#9CA3AF' }
                  }}
                >
                  {state?.resolving ? 'Resolving...' : `Resolve: ${state?.workerPercentage || 50}% Worker / ${state?.posterPercentage || 50}% Poster`}
                </Button>
              </Box>
            </Collapse>
          </Paper>
        )
      })
  }

  // Render resolved disputes list
  const renderResolvedDisputes = () => {
    if (resolvedDisputes.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
          <HistoryIcon sx={{ fontSize: 48, color: '#9CA3AF', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Resolution History
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Resolved disputes will appear here.
          </Typography>
        </Box>
      )
    }

    return resolvedDisputes.map((dispute) => {
      const needsDistribution = !dispute.escrow_distributed && dispute.jobs?.escrow_amount_tokens
      const isDistributing = distributingId === dispute.id

      return (
        <Paper
          key={dispute.id}
          elevation={1}
          sx={{
            overflow: 'hidden',
            border: needsDistribution ? '2px solid #F59E0B' : '1px solid',
            borderColor: needsDistribution ? '#F59E0B' : 'divider',
            borderRadius: '12px',
            mb: 2
          }}
        >
          {/* Resolved Dispute Header */}
          <Box sx={{ p: 2, bgcolor: 'rgba(54, 193, 112, 0.05)' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              {/* Icon */}
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: 'rgba(54, 193, 112, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 20, color: '#36C170' }} />
              </Box>

              {/* Content */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1A1A1E' }}>
                    {dispute.jobs?.title || 'Unknown Job'}
                  </Typography>
                  <Chip
                    label="Resolved"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '10px',
                      fontWeight: 600,
                      bgcolor: '#ECFDF5',
                      color: '#065F46'
                    }}
                  />
                  {needsDistribution && (
                    <Chip
                      label="⚠️ Tokens Not Distributed"
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '10px',
                        fontWeight: 600,
                        bgcolor: '#FEF3C7',
                        color: '#92400E'
                      }}
                    />
                  )}
                </Box>
                
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Resolved {dispute.admin_decided_at ? format(new Date(dispute.admin_decided_at), 'MMM d, yyyy \'at\' h:mm a') : 'Unknown date'}
                </Typography>

                {/* Resolution Details */}
                <Box sx={{ 
                  mt: 2, 
                  p: 2, 
                  bgcolor: '#F9FAFB', 
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB'
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#6B7280' }}>
                      Resolution Split
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6B7280' }}>
                      By: {formatAddress(dispute.admin_wallet || '')}
                    </Typography>
                  </Box>
                  
                  {/* Split Bar */}
                  <Box sx={{ display: 'flex', height: 24, borderRadius: '6px', overflow: 'hidden', mb: 1 }}>
                    <Box 
                      sx={{ 
                        width: `${dispute.worker_percentage || 0}%`, 
                        bgcolor: '#36C170',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'width 0.3s'
                      }}
                    >
                      {(dispute.worker_percentage || 0) >= 20 && (
                        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '10px' }}>
                          Worker {dispute.worker_percentage}%
                        </Typography>
                      )}
                    </Box>
                    <Box 
                      sx={{ 
                        width: `${dispute.poster_percentage || 0}%`, 
                        bgcolor: '#3B82F6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'width 0.3s'
                      }}
                    >
                      {(dispute.poster_percentage || 0) >= 20 && (
                        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '10px' }}>
                          Poster {dispute.poster_percentage}%
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Amount Info */}
                  <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      💰 Escrow: {dispute.jobs?.escrow_amount_tokens?.toLocaleString() || dispute.jobs?.payment_amount_tokens?.toLocaleString() || 'N/A'} tokens
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Job Status: {dispute.jobs?.status || 'Unknown'}
                    </Typography>
                  </Box>

                  {/* Resolution Notes */}
                  {dispute.admin_resolution_notes && (
                    <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #E5E7EB' }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: '#6B7280', display: 'block', mb: 0.5 }}>
                        Admin Notes:
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                        {dispute.admin_resolution_notes}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Manual Distribution Button */}
                {needsDistribution && (
                  <Box sx={{ mt: 2 }}>
                    <Alert severity="warning" sx={{ mb: 2, py: 0.5 }}>
                      <Typography variant="caption">
                        This dispute was resolved before token distribution was implemented. Click below to distribute tokens now.
                      </Typography>
                    </Alert>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => handleDistributeEscrow(dispute)}
                      disabled={isDistributing}
                      startIcon={isDistributing ? <CircularProgress size={18} color="inherit" /> : <SyncIcon />}
                      sx={{
                        bgcolor: '#F59E0B',
                        color: '#fff',
                        textTransform: 'none',
                        fontWeight: 600,
                        py: 1,
                        '&:hover': { bgcolor: '#D97706' },
                        '&:disabled': { bgcolor: '#E5E7F0', color: '#9CA3AF' }
                      }}
                    >
                      {isDistributing ? 'Distributing...' : `Distribute Tokens (${dispute.worker_percentage}% / ${dispute.poster_percentage}%)`}
                    </Button>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </Paper>
      )
    })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          mb: 2,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
            minHeight: 48,
            '&.Mui-selected': { color: '#FF6B35' }
          },
          '& .MuiTabs-indicator': { backgroundColor: '#FF6B35' }
        }}
      >
        <Tab 
          value="pending" 
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningAmberIcon sx={{ fontSize: 18 }} />
              Pending
              {disputes.length > 0 && (
                <Chip 
                  label={disputes.length} 
                  size="small" 
                  sx={{ 
                    height: 20, 
                    fontSize: '10px', 
                    bgcolor: '#FEE2E2', 
                    color: '#991B1B' 
                  }} 
                />
              )}
            </Box>
          } 
        />
        <Tab 
          value="resolved" 
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon sx={{ fontSize: 18 }} />
              History
              {resolvedDisputes.filter(d => !d.escrow_distributed && d.jobs?.escrow_amount_tokens).length > 0 && (
                <Chip 
                  label={`${resolvedDisputes.filter(d => !d.escrow_distributed && d.jobs?.escrow_amount_tokens).length} need distribution`} 
                  size="small" 
                  sx={{ 
                    height: 20, 
                    fontSize: '10px', 
                    bgcolor: '#FEF3C7', 
                    color: '#92400E' 
                  }} 
                />
              )}
            </Box>
          } 
        />
      </Tabs>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 0.5 }}>
        {activeTab === 'pending' ? renderPendingDisputes() : renderResolvedDisputes()}
      </Box>
    </Box>
  )
}

export default DisputeFeed

