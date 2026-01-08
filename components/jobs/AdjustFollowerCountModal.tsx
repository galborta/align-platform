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
  Alert
} from '@mui/material'
import { supabase } from '@/lib/supabase'

// ==================== TYPES ====================

interface AdjustFollowerCountModalProps {
  open: boolean
  onClose: () => void
  submission: {
    id: string
    worker_wallet: string
    social_follower_count: number
    social_follower_count_verified: number
  }
  jobId: string
  posterWallet: string
}

// ==================== COMPONENT ====================

export default function AdjustFollowerCountModal({
  open,
  onClose,
  submission,
  jobId,
  posterWallet
}: AdjustFollowerCountModalProps) {
  const [verifiedCount, setVerifiedCount] = useState(submission.social_follower_count_verified)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (verifiedCount < 0) {
      setError('Follower count cannot be negative')
      return
    }

    if (verifiedCount === submission.social_follower_count_verified) {
      setError('Please enter a different count to adjust')
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
      
      const response = await fetch(`/api/jobs/${jobId}/adjust-followers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          submission_id: submission.id,
          verified_follower_count: verifiedCount,
          adjustment_reason: reason || undefined,
          poster_wallet: posterWallet
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to adjust follower count')
      }

      // Close and refresh
      onClose()
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
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
        Adjust Follower Count
      </DialogTitle>

      <DialogContent sx={{ mt: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography 
            variant="body2" 
            sx={{ 
              mb: 1,
              color: 'var(--text-secondary, #6F7280)',
              fontSize: '14px'
            }}
          >
            Worker:{' '}
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
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'var(--text-secondary, #6F7280)',
              fontSize: '14px'
            }}
          >
            Reported: <Box component="span" sx={{ fontWeight: 600 }}>{submission.social_follower_count.toLocaleString()}</Box> followers
          </Typography>
        </Box>

        <Alert 
          severity="info" 
          sx={{ 
            mb: 3,
            borderRadius: '12px',
            bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
            border: '1px solid var(--accent-primary, #7C4DFF)',
            '& .MuiAlert-icon': {
              color: 'var(--accent-primary, #7C4DFF)'
            }
          }}
        >
          If you've verified their actual follower count differs from what was reported, 
          you can adjust it here. This will affect payment calculations.
        </Alert>

        <TextField
          fullWidth
          type="number"
          label="Verified Follower Count"
          value={verifiedCount}
          onChange={(e) => setVerifiedCount(parseInt(e.target.value) || 0)}
          inputProps={{ min: 0 }}
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
              fontSize: '14px',
              '&.Mui-focused': {
                color: 'var(--accent-primary, #7C4DFF)'
              }
            }
          }}
        />

        <TextField
          fullWidth
          label="Reason for Adjustment (Optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Checked profile - actual count is..."
          multiline
          rows={2}
          helperText="Optional explanation for the adjustment"
          sx={{
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
              fontSize: '14px',
              '&.Mui-focused': {
                color: 'var(--accent-primary, #7C4DFF)'
              }
            },
            '& .MuiFormHelperText-root': {
              color: 'var(--text-muted, #A3A7B5)',
              fontSize: '12px'
            }
          }}
        />

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
            bgcolor: 'var(--accent-primary, #7C4DFF)',
            color: '#FFFFFF',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '14px',
            borderRadius: 'var(--radius-control, 999px)',
            px: 3,
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            boxShadow: '0 4px 12px 0 rgba(124, 77, 255, 0.25)',
            '&:hover': { 
              bgcolor: '#6A3FE8',
              boxShadow: '0 6px 16px 0 rgba(124, 77, 255, 0.35)'
            },
            '&:disabled': {
              bgcolor: 'var(--text-muted, #A3A7B5)',
              color: '#FFFFFF'
            }
          }}
        >
          {loading ? 'Updating...' : 'Update Count'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

