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
import { notificationService } from '@/lib/services/notificationService'
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
      // Check if there's already an active dispute for this job
      const { data: existingDispute, error: checkError } = await supabase
        .from('job_disputes')
        .select('id')
        .eq('job_id', jobId)
        .neq('status', 'resolved')
        .limit(1)
        .maybeSingle()

      if (checkError) {
        console.error('Error checking existing dispute:', checkError)
      }

      if (existingDispute) {
        setError('There is already an active dispute for this job.')
        toast.error('A dispute is already open for this job')
        setLoading(false)
        return
      }

      // Calculate dispute end date (14 days from now)
      const endsAt = new Date()
      endsAt.setDate(endsAt.getDate() + 14)

      // Create dispute entry
      const { data: disputeData, error: disputeError } = await supabase
        .from('job_disputes')
        .insert({
          job_id: jobId,
          opened_by: openedBy,
          reason: reason.trim(),
          ends_at: endsAt.toISOString()
        })
        .select('id')
        .single()

      if (disputeError) {
        // Handle unique constraint violation
        if (disputeError.code === '23505') {
          setError('There is already an active dispute for this job.')
          toast.error('A dispute is already open for this job')
          setLoading(false)
          return
        }
        throw disputeError
      }

      // Update job status to disputed
      const { error: jobError } = await supabase
        .from('jobs')
        .update({
          status: 'disputed',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      if (jobError) throw jobError

      // ==================== NOTIFY OTHER PARTY & ADMINS ====================
      
      // Send notifications (non-blocking)
      try {
        const { data: job } = await supabase
          .from('jobs')
          .select('poster_wallet, assigned_to, title')
          .eq('id', jobId)
          .single()

        if (job) {
          // Determine the other party
          const otherPartyWallet = openedBy === 'poster' 
            ? job.assigned_to 
            : job.poster_wallet

          // Notify the other party
          if (otherPartyWallet) {
            await notificationService.createNotification({
              userWallet: otherPartyWallet,
              type: 'job_dispute_created',
              actorWallet: openedBy === 'poster' ? job.poster_wallet : job.assigned_to!,
              referenceId: disputeData.id,
              referenceType: 'dispute',
              metadata: {
                job_title: job.title,
                dispute_reason: reason.trim().slice(0, 200) // First 200 chars
              }
            })
          }

          // Notify all admins via API route (sends in-app + email notifications)
          await fetch('/api/disputes/notify-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              disputeId: disputeData.id,
              jobId: jobId,
              disputingParty: openedBy,
              disputingWallet: openedBy === 'poster' ? job.poster_wallet : job.assigned_to!,
              reason: reason.trim()
            })
          })
        }
      } catch (notificationError) {
        console.error('[OpenDisputeModal] Failed to create dispute notifications:', notificationError)
        // Don't throw - notification failure is non-critical
      }

      toast.success('Dispute opened. The Orggly team will review and resolve this fairly. ⚖️', {
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
            💡 The Orggly team will review based on these success criteria
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
          icon={<GavelIcon />}
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
              <li>✓ The Orggly team will review your dispute</li>
              <li>⏱️ Resolution typically within <strong>24-72 hours</strong></li>
              <li>⚖️ Our team reviews the KPIs, submission, and both sides fairly</li>
              <li>📦 If work meets KPIs: Worker gets payment</li>
              <li>💰 If work doesn&apos;t meet KPIs: Poster gets refund</li>
              <li>🤝 Partial splits may be awarded when appropriate</li>
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




