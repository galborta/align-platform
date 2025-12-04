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
}

// ==================== COMPONENT ====================

export default function AdjustFollowerCountModal({
  open,
  onClose,
  submission,
  jobId
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
      const response = await fetch(`/api/jobs/${jobId}/adjust-followers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submission.id,
          verified_follower_count: verifiedCount,
          adjustment_reason: reason || undefined
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
        sx: { bgcolor: '#1a1a1a', color: '#fff' }
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid #333' }}>
        Adjust Follower Count
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Worker: {submission.worker_wallet.slice(0, 8)}...{submission.worker_wallet.slice(-6)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Reported: {submission.social_follower_count.toLocaleString()} followers
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
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
          sx={{ mb: 2 }}
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
        />

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
            bgcolor: '#7C4DFF',
            '&:hover': { bgcolor: '#6A3FE8' }
          }}
        >
          {loading ? 'Updating...' : 'Update Count'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

