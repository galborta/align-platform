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
import { supabase } from '@/lib/supabase'

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
  posterWallet: string
}

// ==================== COMPONENT ====================

export default function DenySubmissionModal({
  open,
  onClose,
  onDeny,
  submission,
  jobId,
  posterWallet
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
      // Get Supabase session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        setError('Authentication required. Please sign in again.')
        setLoading(false)
        return
      }
      
      const response = await fetch(`/api/jobs/${jobId}/review-submission`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          submission_id: submission.id,
          action: 'deny',
          denial_reason: finalReason,
          poster_wallet: posterWallet
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
        sx: { 
          bgcolor: 'var(--card-background, #FFFFFF)',
          borderRadius: 'var(--radius-card-lg, 24px)',
          boxShadow: 'var(--shadow-floating, 0 24px 60px 0 rgba(15, 23, 42, 0.10))'
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          borderBottom: '1px solid var(--border-subtle, #E5E7F0)',
          fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
          fontWeight: 600,
          color: 'var(--text-primary, #1A1A1E)',
          fontSize: '22px',
          pb: 2
        }}
      >
        Deny Submission
      </DialogTitle>

      <DialogContent sx={{ mt: 3 }}>
        <Typography 
          variant="body2" 
          sx={{ 
            mb: 3,
            color: 'var(--text-secondary, #6F7280)',
            fontSize: '14px'
          }}
        >
          Are you sure you want to deny this submission from{' '}
          <Box
            component="span"
            sx={{
              fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)'
            }}
          >
            {submission.worker_wallet.slice(0, 8)}...{submission.worker_wallet.slice(-6)}
          </Box>
          ?
        </Typography>

        <FormControl component="fieldset" sx={{ mb: 2, width: '100%' }}>
          <FormLabel 
            sx={{ 
              color: 'var(--text-primary, #1A1A1E)',
              fontWeight: 600,
              fontSize: '14px',
              mb: 1.5
            }}
          >
            Reason for Denial (Required)
          </FormLabel>
          <RadioGroup
            value={denialReason}
            onChange={(e) => setDenialReason(e.target.value)}
          >
            <FormControlLabel
              value="tweet_link_invalid"
              control={
                <Radio 
                  sx={{ 
                    color: 'var(--accent-primary, #7C4DFF)',
                    '&.Mui-checked': {
                      color: 'var(--accent-primary, #7C4DFF)'
                    }
                  }} 
                />
              }
              label={
                <Typography sx={{ fontSize: '14px', color: 'var(--text-secondary, #6F7280)' }}>
                  Tweet link is broken/invalid
                </Typography>
              }
            />
            <FormControlLabel
              value="guidelines_not_followed"
              control={
                <Radio 
                  sx={{ 
                    color: 'var(--accent-primary, #7C4DFF)',
                    '&.Mui-checked': {
                      color: 'var(--accent-primary, #7C4DFF)'
                    }
                  }} 
                />
              }
              label={
                <Typography sx={{ fontSize: '14px', color: 'var(--text-secondary, #6F7280)' }}>
                  Did not follow guidelines
                </Typography>
              }
            />
            <FormControlLabel
              value="fake_followers"
              control={
                <Radio 
                  sx={{ 
                    color: 'var(--accent-primary, #7C4DFF)',
                    '&.Mui-checked': {
                      color: 'var(--accent-primary, #7C4DFF)'
                    }
                  }} 
                />
              }
              label={
                <Typography sx={{ fontSize: '14px', color: 'var(--text-secondary, #6F7280)' }}>
                  Suspected fake followers
                </Typography>
              }
            />
            <FormControlLabel
              value="low_quality"
              control={
                <Radio 
                  sx={{ 
                    color: 'var(--accent-primary, #7C4DFF)',
                    '&.Mui-checked': {
                      color: 'var(--accent-primary, #7C4DFF)'
                    }
                  }} 
                />
              }
              label={
                <Typography sx={{ fontSize: '14px', color: 'var(--text-secondary, #6F7280)' }}>
                  Low quality/spammy tweet
                </Typography>
              }
            />
            <FormControlLabel
              value="other"
              control={
                <Radio 
                  sx={{ 
                    color: 'var(--accent-primary, #7C4DFF)',
                    '&.Mui-checked': {
                      color: 'var(--accent-primary, #7C4DFF)'
                    }
                  }} 
                />
              }
              label={
                <Typography sx={{ fontSize: '14px', color: 'var(--text-secondary, #6F7280)' }}>
                  Other (explain below)
                </Typography>
              }
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
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: 'var(--subtle-background, #F7F8FB)',
                '& fieldset': {
                  borderColor: 'var(--border-subtle, #E5E7F0)'
                },
                '&:hover fieldset': {
                  borderColor: 'var(--accent-primary, #7C4DFF)'
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'var(--accent-primary, #7C4DFF)'
                }
              },
              '& .MuiInputLabel-root': {
                color: 'var(--text-secondary, #6F7280)',
                fontSize: '14px'
              }
            }}
          />
        )}

        <Alert 
          severity="warning"
          sx={{
            borderRadius: '12px',
            bgcolor: 'rgba(255, 200, 87, 0.1)',
            border: '1px solid var(--accent-warning, #FFC857)',
            '& .MuiAlert-icon': {
              color: 'var(--accent-warning, #FFC857)'
            }
          }}
        >
          ⚠️ Worker can dispute this denial if they believe it's unjust.
        </Alert>

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mt: 2,
              borderRadius: '12px',
              bgcolor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #EF4444'
            }}
          >
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions 
        sx={{ 
          borderTop: '1px solid var(--border-subtle, #E5E7F0)',
          p: 'var(--space-lg, 24px)',
          gap: 1
        }}
      >
        <Button 
          onClick={onClose} 
          disabled={loading}
          sx={{ 
            color: 'var(--text-secondary, #6F7280)',
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '14px',
            borderRadius: 'var(--radius-control, 999px)',
            px: 3,
            '&:hover': {
              bgcolor: 'var(--subtle-background, #F7F8FB)'
            }
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          sx={{
            bgcolor: '#EF4444',
            color: '#FFFFFF',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '14px',
            borderRadius: 'var(--radius-control, 999px)',
            px: 3,
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            boxShadow: '0 4px 12px 0 rgba(239, 68, 68, 0.25)',
            '&:hover': { 
              bgcolor: '#DC2626',
              boxShadow: '0 6px 16px 0 rgba(239, 68, 68, 0.35)'
            },
            '&:disabled': {
              bgcolor: 'var(--text-muted, #A3A7B5)',
              color: '#FFFFFF'
            }
          }}
        >
          {loading ? 'Denying...' : 'Confirm Denial'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

