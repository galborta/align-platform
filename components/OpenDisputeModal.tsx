'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import GavelIcon from '@mui/icons-material/Gavel'
import WarningIcon from '@mui/icons-material/Warning'
import HowToVoteIcon from '@mui/icons-material/HowToVote'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

interface OpenDisputeModalProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  openedBy: 'poster' | 'worker'
  jobKpis: string
  submissionSummary: string
  onDisputeOpened?: () => void
}

export function OpenDisputeModal({
  isOpen,
  onClose,
  jobId,
  openedBy,
  jobKpis,
  submissionSummary,
  onDisputeOpened
}: OpenDisputeModalProps) {
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const handleClose = () => {
    if (loading) return
    setReason('')
    setError('')
    onClose()
  }

  const validateForm = () => {
    if (!reason.trim()) {
      setError('Please provide a reason for the dispute')
      return false
    }

    if (reason.length > 1000) {
      setError('Reason must be 1000 characters or less')
      return false
    }

    return true
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    setLoading(true)
    setError('')

    try {
      // Calculate dispute end date (14 days from now)
      const endsAt = new Date()
      endsAt.setDate(endsAt.getDate() + 14)

      // Create dispute entry
      const { error: disputeError } = await supabase
        .from('job_disputes')
        .insert({
          job_id: jobId,
          opened_by: openedBy,
          reason: reason.trim(),
          ends_at: endsAt.toISOString()
        })

      if (disputeError) throw disputeError

      // Update job status to disputed
      const { error: jobError } = await supabase
        .from('jobs')
        .update({
          status: 'disputed',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      if (jobError) throw jobError

      // TODO: Send notification to other party (Sprint 2.3)
      // await notifyOtherParty(jobId, openedBy)

      toast.success('Dispute opened. Community voting begins now. ⚖️', {
        duration: 5000,
        icon: '⚖️'
      })

      handleClose()
      
      if (onDisputeOpened) {
        onDisputeOpened()
      }
    } catch (err) {
      console.error('Error opening dispute:', err)
      setError('Failed to open dispute. Please try again.')
      toast.error('Failed to open dispute')
    } finally {
      setLoading(false)
    }
  }

  const posterPlaceholder = "Explain how the submitted work fails to meet the KPIs you specified. Be specific about which requirements were not met and provide evidence if possible..."
  const workerPlaceholder = "Explain why the poster's rejection is unreasonable. Reference the KPIs and how your work meets them. Provide evidence of your compliance..."

  return (
    <Dialog 
      open={isOpen} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '12px'
        }
      }}
    >
      <DialogTitle sx={{ 
        fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
        fontSize: '24px',
        fontWeight: 700,
        color: '#1A1A1E',
        pb: 2
      }}>
        <div className="flex items-center gap-2">
          <GavelIcon sx={{ fontSize: 28, color: '#EF4444' }} />
          <span>Open Dispute</span>
        </div>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Who's Opening */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold" style={{ color: '#6F7280' }}>
              YOU ARE:
            </span>
            <Chip
              label={openedBy === 'poster' ? 'Poster' : 'Worker'}
              sx={{
                backgroundColor: openedBy === 'poster' ? '#EEE7FF' : '#E8F4FF',
                color: openedBy === 'poster' ? '#7C4DFF' : '#2563EB',
                fontWeight: 600,
                fontSize: '13px'
              }}
            />
          </div>
          <p className="text-sm" style={{ color: '#6F7280' }}>
            {openedBy === 'poster' 
              ? "As the job poster, you're disputing that the submitted work doesn't meet your KPIs"
              : "As the worker, you're disputing that the poster's rejection is unreasonable"
            }
          </p>
        </div>

        {/* Dispute Reason */}
        <TextField
          label="Dispute Reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            setError('')
          }}
          placeholder={openedBy === 'poster' ? posterPlaceholder : workerPlaceholder}
          fullWidth
          required
          multiline
          rows={6}
          error={!!error}
          helperText={error || `${reason.length} / 1000 characters`}
          sx={{ mb: 3 }}
          InputProps={{
            sx: {
              fontFamily: 'var(--font-inter), Inter, sans-serif'
            }
          }}
        />

        {/* Review KPIs */}
        <div className="mb-4">
          <h4 
            className="text-sm font-semibold mb-2"
            style={{ color: '#1A1A1E' }}
          >
            ORIGINAL KPIs (FOR REFERENCE)
          </h4>
          <div 
            className="p-4 rounded-lg border"
            style={{ 
              backgroundColor: '#F9FAFB',
              borderColor: '#E5E7F0'
            }}
          >
            <p 
              className="text-sm whitespace-pre-wrap"
              style={{ color: '#1A1A1E' }}
            >
              {jobKpis}
            </p>
          </div>
          <p className="text-xs mt-2" style={{ color: '#6F7280' }}>
            💡 The community will vote based on these success criteria
          </p>
        </div>

        {/* Review Submission */}
        <div className="mb-4">
          <h4 
            className="text-sm font-semibold mb-2"
            style={{ color: '#1A1A1E' }}
          >
            SUBMITTED WORK
          </h4>
          <div 
            className="p-4 rounded-lg border"
            style={{ 
              backgroundColor: '#F9FAFB',
              borderColor: '#E5E7F0'
            }}
          >
            <p 
              className="text-sm mb-2"
              style={{ color: '#6F7280' }}
            >
              {submissionSummary.substring(0, 150)}
              {submissionSummary.length > 150 ? '...' : ''}
            </p>
            <button
              className="text-sm font-medium flex items-center gap-1 hover:underline"
              style={{ color: '#7C4DFF' }}
              onClick={(e) => {
                e.preventDefault()
                // The modal will show full submission in the job detail page
                handleClose()
              }}
            >
              View submission details
              <OpenInNewIcon sx={{ fontSize: 14 }} />
            </button>
          </div>
        </div>

        {/* Dispute Process */}
        <Alert 
          severity="info"
          icon={<HowToVoteIcon />}
          sx={{ 
            mb: 3,
            backgroundColor: '#EEF2FF',
            color: '#1A1A1E',
            '& .MuiAlert-icon': {
              color: '#4F46E5'
            }
          }}
        >
          <div className="space-y-2">
            <p className="font-semibold text-sm">HOW DISPUTES WORK:</p>
            <ul className="text-sm space-y-1 ml-4">
              <li>✓ Community voting begins immediately</li>
              <li>⏱️ Voting lasts <strong>14 days</strong></li>
              <li>⚖️ Token-weighted votes decide outcome</li>
              <li>📦 If &gt;50% vote to <strong>release</strong>: Worker gets payment</li>
              <li>💰 If &gt;50% vote to <strong>refund</strong>: Poster gets refund</li>
              <li>🏆 All voters earn karma for participating</li>
            </ul>
          </div>
        </Alert>

        {/* Warning */}
        <Alert 
          severity="warning"
          icon={<WarningIcon />}
          sx={{ 
            backgroundColor: '#FFF4E6',
            color: '#1A1A1E',
            '& .MuiAlert-icon': {
              color: '#FB923C'
            }
          }}
        >
          <p className="font-semibold text-sm mb-1">⚠️ IMPORTANT:</p>
          <ul className="text-sm space-y-1">
            <li>• Disputes are <strong>public</strong>. The community will see your reason.</li>
            <li>• False or frivolous disputes may hurt your reputation.</li>
            <li>• Consider communicating with the other party first.</li>
          </ul>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
        <Button 
          onClick={handleClose}
          disabled={loading}
          sx={{ 
            color: '#6F7280',
            textTransform: 'none',
            fontSize: '16px'
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || !reason.trim()}
          variant="contained"
          sx={{
            backgroundColor: '#EF4444',
            color: '#fff',
            textTransform: 'none',
            fontSize: '16px',
            px: 4,
            '&:hover': {
              backgroundColor: '#DC2626'
            },
            '&:disabled': {
              backgroundColor: '#E5E7F0',
              color: '#A3A7B5'
            }
          }}
        >
          {loading ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1, color: '#fff' }} />
              Opening Dispute...
            </>
          ) : (
            <>
              <GavelIcon sx={{ fontSize: 20, mr: 1 }} />
              Open Dispute
            </>
          )}
        </Button>
      </DialogActions>
    </Dialog>
  )
}




