'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  AlertTitle,
  CircularProgress,
  Chip,
  Typography,
  Box,
  Divider,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { notificationService } from '@/lib/services/notificationService'
import { toast } from 'react-hot-toast'
import GavelIcon from '@mui/icons-material/Gavel'
import WarningIcon from '@mui/icons-material/Warning'
import LoopIcon from '@mui/icons-material/Loop'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import AllInclusiveIcon from '@mui/icons-material/AllInclusive'
import { formatDistanceToNow, differenceInHours } from 'date-fns'
import { parseRevisionOffering, formatRevisionOffering } from '@/lib/revisions'
import type { JobApplication, RevisionDisputeContext } from '@/types/database'
import type { DisputeType } from '@/types/social-media-jobs'

interface RevisionRequestHistory {
  number: number
  notes: string
  requestedAt: string
  submittedAt?: string
  isVoluntary?: boolean
}

interface OpenRevisionDisputeModalProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  jobTitle: string
  jobKpis: string
  openedBy: 'poster' | 'worker'
  /** Worker's application with revision data */
  workerApplication: Pick<JobApplication, 
    'revisions_offered' | 'revisions_used' | 'revisions_remaining' | 'last_revision_requested_at'
  > | null
  /** Full revision request history from job comments */
  revisionHistory?: RevisionRequestHistory[]
  /** For poster: when was the revision requested and not answered */
  unansweredSince?: string
  onDisputeOpened?: () => void
}

// Abuse threshold for unlimited revisions
const UNLIMITED_ABUSE_THRESHOLD = 10

/**
 * OpenRevisionDisputeModal Component
 * 
 * Modal for opening disputes related to revisions:
 * - Poster: Worker refused committed revision
 * - Worker: Poster is abusing unlimited revisions
 */
export function OpenRevisionDisputeModal({
  isOpen,
  onClose,
  jobId,
  jobTitle,
  jobKpis,
  openedBy,
  workerApplication,
  revisionHistory = [],
  unansweredSince,
  onDisputeOpened
}: OpenRevisionDisputeModalProps) {
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')
  const [disputeType, setDisputeType] = useState<DisputeType | ''>('')
  const [error, setError] = useState('')

  // Calculate revision stats
  const offered = parseRevisionOffering(workerApplication?.revisions_offered ?? null)
  const used = workerApplication?.revisions_used ?? 0
  const remaining = workerApplication?.revisions_remaining
  const isUnlimited = offered === 'unlimited'
  const abuseThresholdExceeded = isUnlimited && used >= UNLIMITED_ABUSE_THRESHOLD

  // Calculate unanswered duration
  const unansweredHours = unansweredSince 
    ? differenceInHours(new Date(), new Date(unansweredSince))
    : 0

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setReason('')
      setDisputeType('')
      setError('')
    } else {
      // Pre-select dispute type based on who's opening
      if (openedBy === 'poster') {
        setDisputeType('revision_refusal')
      } else if (openedBy === 'worker' && abuseThresholdExceeded) {
        setDisputeType('unlimited_revisions_abuse')
      }
    }
  }, [isOpen, openedBy, abuseThresholdExceeded])

  const handleClose = () => {
    if (loading) return
    onClose()
  }

  const validateForm = () => {
    if (!disputeType) {
      setError('Please select a dispute type')
      return false
    }

    if (!reason.trim()) {
      setError('Please provide details for your dispute')
      return false
    }

    if (reason.length > 2000) {
      setError('Reason must be 2000 characters or less')
      return false
    }

    // Validate poster dispute: must have unanswered revision
    if (disputeType === 'revision_refusal' && !unansweredSince) {
      setError('Cannot open this dispute type: no pending revision request found')
      return false
    }

    // Validate worker dispute: must exceed abuse threshold
    if (disputeType === 'unlimited_revisions_abuse' && !abuseThresholdExceeded) {
      setError(`Cannot open this dispute type: revisions used (${used}) has not exceeded the threshold (${UNLIMITED_ABUSE_THRESHOLD})`)
      return false
    }

    return true
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setLoading(true)
    setError('')

    try {
      // Build revision context for the dispute
      const revisionContext: RevisionDisputeContext = {
        revisions_offered: offered ?? 0,
        revisions_used: used,
        revisions_remaining: remaining ?? 0,
        revision_history: revisionHistory.map(r => ({
          number: r.number,
          notes: r.notes,
          requestedAt: r.requestedAt,
          submittedAt: r.submittedAt,
          isVoluntary: r.isVoluntary
        })),
        last_revision_requested_at: workerApplication?.last_revision_requested_at || undefined,
        unanswered_duration_hours: unansweredHours,
        original_scope: jobKpis,
        abuse_threshold_exceeded: abuseThresholdExceeded,
        // Calculate suggested proration based on work done
        suggested_proration: calculateSuggestedProration(used, offered)
      }

      // Calculate dispute end date (14 days from now)
      const endsAt = new Date()
      endsAt.setDate(endsAt.getDate() + 14)

      // Create dispute entry with revision context
      const { data: disputeData, error: disputeError } = await supabase
        .from('job_disputes')
        .insert({
          job_id: jobId,
          opened_by: openedBy,
          reason: reason.trim(),
          dispute_type: disputeType,
          revision_context: revisionContext,
          ends_at: endsAt.toISOString()
        })
        .select('id')
        .single()

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

      // Send notifications
      try {
        const { data: job } = await supabase
          .from('jobs')
          .select('poster_wallet, assigned_to, title, project_id')
          .eq('id', jobId)
          .single()

        if (job) {
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
                dispute_reason: reason.trim().slice(0, 200),
                revisions_offered: offered === 'unlimited' ? 'unlimited' : offered ?? 0,
                revisions_used: used
              }
            })
          }

          // Notify admins
          await notificationService.notifyAdminsOfNewDispute({
            jobId: jobId,
            jobTitle: job.title,
            reason: `[${getDisputeTypeLabel(disputeType as DisputeType)}] ${reason.trim()}`,
            creatorWallet: openedBy === 'poster' ? job.poster_wallet : job.assigned_to!
          })
        }
      } catch (notificationError) {
        console.error('[OpenRevisionDisputeModal] Failed to create notifications:', notificationError)
      }

      toast.success('Revision dispute opened. Community voting begins now. ⚖️', {
        duration: 5000,
        icon: '⚖️'
      })

      handleClose()
      onDisputeOpened?.()
    } catch (err) {
      console.error('Error opening revision dispute:', err)
      setError('Failed to open dispute. Please try again.')
      toast.error('Failed to open dispute')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog 
      open={isOpen} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          border: '2px solid #EF4444'
        }
      }}
    >
      <DialogTitle sx={{ 
        fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
        fontSize: '24px',
        fontWeight: 700,
        color: '#1A1A1E',
        pb: 1,
        borderBottom: '1px solid #E5E7F0'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <GavelIcon sx={{ fontSize: 28, color: '#EF4444' }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1A1A1E' }}>
              Open Revision Dispute
            </Typography>
            <Typography variant="body2" sx={{ color: '#6F7280' }}>
              {jobTitle}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {/* Who's Opening */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#6F7280', textTransform: 'uppercase' }}>
              You are:
            </Typography>
            <Chip
              label={openedBy === 'poster' ? 'Job Poster' : 'Worker'}
              size="small"
              sx={{
                backgroundColor: openedBy === 'poster' ? '#EEE7FF' : '#E8F4FF',
                color: openedBy === 'poster' ? '#7C4DFF' : '#2563EB',
                fontWeight: 600
              }}
            />
          </Box>
        </Box>

        {/* Revision Status Summary */}
        <Box sx={{ 
          p: 2.5, 
          borderRadius: '12px', 
          backgroundColor: '#F8F5FF',
          border: '1px solid #E5DEFF',
          mb: 3
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#7C4DFF', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LoopIcon sx={{ fontSize: 18 }} />
            Revision Status
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#6F7280' }}>Offered</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#1A1A1E', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {isUnlimited ? (
                  <><AllInclusiveIcon sx={{ fontSize: 16 }} /> Unlimited</>
                ) : (
                  formatRevisionOffering(String(offered ?? 0))
                )}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#6F7280' }}>Used</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: used > 0 ? '#FB923C' : '#1A1A1E' }}>
                {used}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#6F7280' }}>Remaining</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: (String(remaining) === '0' || remaining === null) ? '#EF4444' : '#36C170' }}>
                {remaining === 'unlimited' ? '∞' : (remaining ?? 0)}
              </Typography>
            </Box>
          </Box>

          {unansweredSince && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #E5DEFF', display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon sx={{ fontSize: 16, color: '#FB923C' }} />
              <Typography variant="body2" sx={{ color: '#FB923C' }}>
                Revision pending for {formatDistanceToNow(new Date(unansweredSince))}
              </Typography>
            </Box>
          )}

          {abuseThresholdExceeded && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <AlertTitle sx={{ fontWeight: 600 }}>Abuse Threshold Exceeded</AlertTitle>
              {used} revisions requested exceeds the reasonable threshold of {UNLIMITED_ABUSE_THRESHOLD}
            </Alert>
          )}
        </Box>

        {/* Dispute Type Selection */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1A1A1E', mb: 1.5 }}>
            Dispute Type
          </Typography>
          <RadioGroup
            value={disputeType}
            onChange={(e) => {
              setDisputeType(e.target.value as DisputeType)
              setError('')
            }}
          >
            {openedBy === 'poster' && (
              <FormControlLabel
                value="revision_refusal"
                control={<Radio sx={{ color: '#7C4DFF', '&.Mui-checked': { color: '#7C4DFF' } }} />}
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1A1A1E' }}>
                      Worker Refused Committed Revision
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6F7280' }}>
                      The worker has not responded to a revision request within their commitment
                    </Typography>
                  </Box>
                }
                sx={{ mb: 1, alignItems: 'flex-start' }}
              />
            )}

            {openedBy === 'worker' && isUnlimited && (
              <FormControlLabel
                value="unlimited_revisions_abuse"
                control={<Radio sx={{ color: '#7C4DFF', '&.Mui-checked': { color: '#7C4DFF' } }} />}
                disabled={!abuseThresholdExceeded}
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: abuseThresholdExceeded ? '#1A1A1E' : '#A3A7B5' }}>
                      Unlimited Revisions Abuse
                    </Typography>
                    <Typography variant="caption" sx={{ color: abuseThresholdExceeded ? '#6F7280' : '#A3A7B5' }}>
                      Poster is requesting excessive revisions beyond reasonable scope
                      {!abuseThresholdExceeded && ` (threshold: ${UNLIMITED_ABUSE_THRESHOLD} revisions)`}
                    </Typography>
                  </Box>
                }
                sx={{ mb: 1, alignItems: 'flex-start' }}
              />
            )}

            <FormControlLabel
              value="scope_creep"
              control={<Radio sx={{ color: '#7C4DFF', '&.Mui-checked': { color: '#7C4DFF' } }} />}
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#1A1A1E' }}>
                    Scope Creep
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6F7280' }}>
                    Revision requests go beyond the original job requirements
                  </Typography>
                </Box>
              }
              sx={{ mb: 1, alignItems: 'flex-start' }}
            />

            <FormControlLabel
              value="other"
              control={<Radio sx={{ color: '#7C4DFF', '&.Mui-checked': { color: '#7C4DFF' } }} />}
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#1A1A1E' }}>
                    Other
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6F7280' }}>
                    Another revision-related issue not covered above
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start' }}
            />
          </RadioGroup>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Dispute Reason */}
        <TextField
          label="Dispute Details"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            setError('')
          }}
          placeholder={getPlaceholderText(disputeType as DisputeType, openedBy)}
          fullWidth
          required
          multiline
          rows={5}
          error={!!error}
          helperText={error || `${reason.length} / 2,000 characters`}
          sx={{ mb: 3 }}
        />

        {/* Revision History Preview */}
        {revisionHistory.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1A1A1E', mb: 1.5 }}>
              Revision Request History ({revisionHistory.length})
            </Typography>
            <Box sx={{ maxHeight: 200, overflowY: 'auto', p: 2, backgroundColor: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7F0' }}>
              {revisionHistory.slice(-5).map((rev, idx) => (
                <Box key={idx} sx={{ mb: idx < revisionHistory.length - 1 ? 2 : 0, pb: idx < revisionHistory.length - 1 ? 2 : 0, borderBottom: idx < revisionHistory.length - 1 ? '1px solid #E5E7F0' : 'none' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#7C4DFF' }}>
                      Revision #{rev.number}
                    </Typography>
                    {rev.isVoluntary && (
                      <Chip label="Voluntary" size="small" sx={{ fontSize: 10, height: 18, bgcolor: '#FFF7ED', color: '#FB923C' }} />
                    )}
                    <Typography variant="caption" sx={{ color: '#6F7280', ml: 'auto' }}>
                      {formatDistanceToNow(new Date(rev.requestedAt), { addSuffix: true })}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#6F7280', fontSize: 12 }}>
                    {rev.notes.slice(0, 100)}{rev.notes.length > 100 ? '...' : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Warning */}
        <Alert 
          severity="warning"
          icon={<WarningIcon />}
          sx={{ backgroundColor: '#FFF4E6' }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>Important</AlertTitle>
          <ul className="text-sm space-y-1 mt-1">
            <li>• Disputes are <strong>public</strong> - the community will see all details</li>
            <li>• The revision history will be included as evidence</li>
            <li>• False disputes may damage your reputation</li>
          </ul>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2.5, borderTop: '1px solid #E5E7F0' }}>
        <Button 
          onClick={handleClose}
          disabled={loading}
          sx={{ color: '#6F7280', textTransform: 'none', fontSize: '16px' }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || !reason.trim() || !disputeType}
          variant="contained"
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <GavelIcon />}
          sx={{
            backgroundColor: '#EF4444',
            color: '#fff',
            textTransform: 'none',
            fontSize: '16px',
            fontWeight: 600,
            px: 4,
            '&:hover': { backgroundColor: '#DC2626' },
            '&:disabled': { backgroundColor: '#E5E7F0', color: '#A3A7B5' }
          }}
        >
          {loading ? 'Opening Dispute...' : 'Open Dispute'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// Helper functions
function getDisputeTypeLabel(type: DisputeType): string {
  const labels: Record<DisputeType, string> = {
    revision_refusal: 'Revision Refusal',
    unlimited_revisions_abuse: 'Unlimited Revisions Abuse',
    quality_issues: 'Quality Issues',
    deadline_missed: 'Deadline Missed',
    requirements_not_met: 'Requirements Not Met',
    payment_issue: 'Payment Issue',
    communication_failure: 'Communication Failure',
    scope_creep: 'Scope Creep',
    social_wrongful_denial: 'Wrongful Denial',
    social_fake_followers: 'Fake Followers',
    social_link_invalid: 'Invalid Link',
    other: 'Other'
  }
  return labels[type] || 'Unknown'
}

function getPlaceholderText(type: DisputeType, openedBy: 'poster' | 'worker'): string {
  if (type === 'revision_refusal') {
    return "Explain how the worker has failed to respond to the revision request within a reasonable time. Include:\n• When the revision was requested\n• What was requested\n• How long it has been unanswered"
  }
  if (type === 'unlimited_revisions_abuse') {
    return "Explain how the poster is abusing the unlimited revisions. Include:\n• Pattern of excessive or contradictory requests\n• How requests go beyond original scope\n• Any evidence of unreasonable demands"
  }
  if (type === 'scope_creep') {
    return "Explain how the revision requests go beyond the original job requirements. Reference the original KPIs and how the requests differ."
  }
  return openedBy === 'poster'
    ? "Explain the issue with the revision process and how it affects the job completion..."
    : "Explain why the revision requests are unreasonable and provide supporting details..."
}

function calculateSuggestedProration(used: number, offered: string | number | null): number {
  if (offered === 'unlimited' || offered === null) {
    // For unlimited, base on reasonable threshold
    const threshold = UNLIMITED_ABUSE_THRESHOLD
    if (used >= threshold) {
      return 100 // Full payment if threshold exceeded
    }
    return Math.round((used / threshold) * 100)
  }
  
  const offeredNum = typeof offered === 'number' ? offered : parseInt(offered, 10) || 0
  if (offeredNum === 0) return 100
  
  // Proration based on revisions completed vs offered
  const completedRatio = Math.min(used / offeredNum, 1)
  return Math.round(completedRatio * 100)
}

export default OpenRevisionDisputeModal

