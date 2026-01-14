'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { formatTierDisplay, type FollowerTier } from '@/lib/social-media-jobs-follower-tiers'

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
  const [selectedTierMinFollowers, setSelectedTierMinFollowers] = useState<number>(submission.social_follower_count_verified)
  const [followerTiers, setFollowerTiers] = useState<FollowerTier[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTiers, setLoadingTiers] = useState(true)
  const [error, setError] = useState('')

  // Fetch job's follower tiers
  useEffect(() => {
    const fetchFollowerTiers = async () => {
      try {
        setLoadingTiers(true)
        const { data: job, error: jobError } = await supabase
          .from('jobs')
          .select('social_follower_tiers')
          .eq('id', jobId)
          .single()

        if (jobError) throw jobError
        if (!job?.social_follower_tiers) {
          throw new Error('Job does not have follower tiers configured')
        }

        setFollowerTiers(job.social_follower_tiers as FollowerTier[])
      } catch (err: any) {
        setError(err.message || 'Failed to load follower tiers')
      } finally {
        setLoadingTiers(false)
      }
    }

    if (open) {
      fetchFollowerTiers()
    }
  }, [open, jobId])

  const handleSubmit = async () => {
    if (selectedTierMinFollowers === submission.social_follower_count_verified) {
      setError('Please select a different tier to adjust')
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
          verified_follower_count: selectedTierMinFollowers,
          poster_wallet: posterWallet
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to adjust follower tier')
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
        Adjust Follower Tier
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
          Select the verified follower tier for this worker. This will affect their payment amount.
        </Alert>

        {loadingTiers ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={32} sx={{ color: 'var(--accent-primary, #7C4DFF)' }} />
          </Box>
        ) : (
          <FormControl 
          fullWidth
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
            }
          }}
          >
            <InputLabel>Verified Follower Tier</InputLabel>
            <Select
              value={selectedTierMinFollowers}
              onChange={(e) => setSelectedTierMinFollowers(e.target.value as number)}
              label="Verified Follower Tier"
            >
              {followerTiers.map((tier) => (
                <MenuItem key={tier.min_followers} value={tier.min_followers}>
                  {formatTierDisplay(tier)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

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
          {loading ? 'Updating...' : 'Update Tier'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

