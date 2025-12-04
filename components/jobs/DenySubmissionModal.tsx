'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel
} from '@mui/material'

// ==================== TYPES ====================

interface DenySubmissionModalProps {
  open: boolean
  onClose: () => void
  onDeny: (reason: string) => void
  submission: {
    id: string
    worker_wallet: string
  }
  jobId: string
}

// ==================== COMPONENT ====================

export default function DenySubmissionModal({
  open,
  onClose,
  onDeny,
  submission,
  jobId
}: DenySubmissionModalProps) {
  const [denialReason, setDenialReason] = useState<string>('tweet_link_invalid')
  const [customReason, setCustomReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    const finalReason = denialReason === 'other' 
      ? customReason 
      : getDenialReasonText(denialReason)

    if (!finalReason.trim()) {
      setError('Please provide a reason for denial')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/jobs/${jobId}/review-submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submission.id,
          action: 'deny',
          denial_reason: finalReason
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to deny submission')
      }

      onDeny(finalReason)
      onClose()
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getDenialReasonText = (reason: string): string => {
    switch (reason) {
      case 'tweet_link_invalid':
        return 'Tweet link is broken or invalid'
      case 'guidelines_not_followed':
        return 'Did not follow campaign guidelines'
      case 'fake_followers':
        return 'Suspected fake or inflated follower count'
      case 'low_quality':
        return 'Low quality or spammy tweet'
      default:
        return ''
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { bgcolor: '#1a1a1a', color: '#fff' }
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid #333' }}>
        Deny Submission
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Are you sure you want to deny this submission from{' '}
          {submission.worker_wallet.slice(0, 8)}...{submission.worker_wallet.slice(-6)}?
        </Typography>

        <FormControl component="fieldset" sx={{ mb: 2 }}>
          <FormLabel sx={{ color: '#fff', mb: 1 }}>
            Reason for Denial (Required)
          </FormLabel>
          <RadioGroup
            value={denialReason}
            onChange={(e) => setDenialReason(e.target.value)}
          >
            <FormControlLabel
              value="tweet_link_invalid"
              control={<Radio sx={{ color: '#7C4DFF' }} />}
              label="Tweet link is broken/invalid"
            />
            <FormControlLabel
              value="guidelines_not_followed"
              control={<Radio sx={{ color: '#7C4DFF' }} />}
              label="Did not follow guidelines"
            />
            <FormControlLabel
              value="fake_followers"
              control={<Radio sx={{ color: '#7C4DFF' }} />}
              label="Suspected fake followers"
            />
            <FormControlLabel
              value="low_quality"
              control={<Radio sx={{ color: '#7C4DFF' }} />}
              label="Low quality/spammy tweet"
            />
            <FormControlLabel
              value="other"
              control={<Radio sx={{ color: '#7C4DFF' }} />}
              label="Other (explain below)"
            />
          </RadioGroup>
        </FormControl>

        {denialReason === 'other' && (
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Additional Details"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Explain why you're denying this submission..."
            sx={{ mb: 2 }}
          />
        )}

        <Alert severity="warning">
          ⚠️ Worker can dispute this denial if they believe it's unjust.
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid #333', p: 2 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: '#fff' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          sx={{
            bgcolor: '#f44336',
            '&:hover': { bgcolor: '#d32f2f' }
          }}
        >
          {loading ? 'Denying...' : 'Confirm Denial'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

