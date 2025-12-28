'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow, differenceInDays } from 'date-fns'
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
  Avatar
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import GavelIcon from '@mui/icons-material/Gavel'
import PersonIcon from '@mui/icons-material/Person'
import WorkIcon from '@mui/icons-material/Work'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
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
  revision_context?: any
  jobs: {
    id: string
    title: string
    poster_wallet: string
    assigned_to: string
    budget_amount: number
    budget_token: string
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
  const [disputes, setDisputes] = useState<DisputeWithJob[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDispute, setExpandedDispute] = useState<string | null>(highlightDisputeId || null)
  const [resolutionState, setResolutionState] = useState<Record<string, {
    workerPercentage: number
    posterPercentage: number
    notes: string
    resolving: boolean
  }>>({})

  // Load pending disputes
  const loadDisputes = useCallback(async () => {
    if (!isGlobalAdmin) {
      setDisputes([])
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
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
          revision_context,
          jobs (
            id,
            title,
            poster_wallet,
            assigned_to,
            budget_amount,
            budget_token
          )
        `)
        .is('admin_wallet', null)
        .in('status', ['open', 'pending'])
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading disputes:', error)
        toast.error('Failed to load disputes')
        return
      }

      setDisputes((data as any[]) || [])
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

      toast.success('Dispute resolved successfully!', {
        icon: '⚖️',
        duration: 4000,
        style: { background: '#FF6B35', color: '#fff' }
      })

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

  // Format wallet address
  const formatAddress = (address: string) => {
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

  if (disputes.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
        <WarningAmberIcon sx={{ fontSize: 48, color: '#9CA3AF', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Pending Disputes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          All disputes have been resolved. Check back later.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {disputes.map((dispute) => {
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
                      Budget: {dispute.jobs?.budget_amount} {dispute.jobs?.budget_token}
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
      })}
    </Box>
  )
}

export default DisputeFeed

