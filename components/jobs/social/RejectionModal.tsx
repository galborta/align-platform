'use client'

/**
 * Sprint 4: Rejection Modal
 * 
 * Modal for rejecting social media job submissions with:
 * - Predefined rejection reasons
 * - Optional detailed explanation
 * - Warning about consequences
 * - Dispute creation
 */

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Alert,
  Divider
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { truncateWalletAddress } from '@/lib/wallet-utils'
import type { Database } from '@/types/database'

// ==================== TYPES ====================

type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

export type RejectionReason = 
  | 'tweet_deleted'
  | 'fake_followers'
  | 'guidelines_not_followed'
  | 'low_quality'
  | 'other'

interface RejectionModalProps {
  open: boolean
  submission: JobSubmission | null
  onClose: () => void
  onConfirm: (reason: RejectionReason, details: string) => void
}

// ==================== CONSTANTS ====================

const REJECTION_REASONS: { value: RejectionReason; label: string }[] = [
  { value: 'tweet_deleted', label: 'Tweet deleted before campaign ended' },
  { value: 'fake_followers', label: 'Fake follower count' },
  { value: 'guidelines_not_followed', label: "Didn't follow campaign guidelines" },
  { value: 'low_quality', label: 'Low quality content' },
  { value: 'other', label: 'Other (specify below)' }
]

// ==================== COMPONENT ====================

export default function RejectionModal({
  open,
  submission,
  onClose,
  onConfirm
}: RejectionModalProps) {
  
  // ==================== STATE ====================
  
  const [selectedReason, setSelectedReason] = useState<RejectionReason | null>(null)
  const [details, setDetails] = useState<string>('')
  const [validationError, setValidationError] = useState<string>('')

  // ==================== HANDLERS ====================

  const handleReasonChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const reason = event.target.value as RejectionReason
    setSelectedReason(reason)
    setValidationError('')
  }

  const handleDetailsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDetails(event.target.value)
    setValidationError('')
  }

  const handleConfirm = () => {
    // Validation
    if (!selectedReason) {
      setValidationError('Please select a reason for rejection')
      return
    }

    if (selectedReason === 'other' && details.trim().length === 0) {
      setValidationError('Please provide details when selecting "Other"')
      return
    }

    if (details.trim().length > 0 && details.trim().length < 10) {
      setValidationError('Details must be at least 10 characters')
      return
    }

    if (details.length > 500) {
      setValidationError('Details must not exceed 500 characters')
      return
    }

    // Call confirm handler
    onConfirm(selectedReason, details.trim())

    // Reset state
    setSelectedReason(null)
    setDetails('')
    setValidationError('')
  }

  const handleClose = () => {
    setSelectedReason(null)
    setDetails('')
    setValidationError('')
    onClose()
  }

  // ==================== COMPUTED VALUES ====================

  const paymentAmount = submission?.social_payment_amount_usd || 0
  const workerWallet = submission?.worker_wallet || ''
  const isConfirmDisabled = 
    !selectedReason || 
    (selectedReason === 'other' && details.trim().length === 0)

  // ==================== RENDER ====================

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 'var(--radius-card-lg)',
          boxShadow: 'var(--shadow-elevated)'
        }
      }}
    >
      {/* ===== HEADER ===== */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderBottom: '1px solid var(--border-subtle)',
          pb: 2
        }}
      >
        <Typography
          sx={{
            fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--text-primary, #1A1A1E)'
          }}
        >
          Reject Submission
        </Typography>
      </DialogTitle>

      {/* ===== CONTENT ===== */}
      <DialogContent sx={{ pt: 3, pb: 2 }}>
        {/* Submission Info */}
        <Box
          sx={{
            p: 2,
            background: 'var(--bg-secondary, #F7F8FB)',
            borderRadius: 'var(--radius-card-md)',
            mb: 3
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-secondary, #6F7280)'
              }}
            >
              Wallet:
            </Typography>
            <Typography
              sx={{
                fontFamily: 'monospace',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              {truncateWalletAddress(workerWallet)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-secondary, #6F7280)'
              }}
            >
              Payment to return:
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--accent-success, #36C170)'
              }}
            >
              ${paymentAmount.toFixed(2)}
            </Typography>
          </Box>
        </Box>

        {/* Reason Selection */}
        <Typography
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary, #1A1A1E)',
            mb: 1.5
          }}
        >
          Reason for rejection: *
        </Typography>

        <RadioGroup value={selectedReason || ''} onChange={handleReasonChange}>
          {REJECTION_REASONS.map((reason) => (
            <FormControlLabel
              key={reason.value}
              value={reason.value}
              control={
                <Radio 
                  sx={{ 
                    color: 'var(--accent-primary)', 
                    '&.Mui-checked': { color: 'var(--accent-primary)' } 
                  }} 
                />
              }
              label={
                <Typography
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: '14px',
                    color: 'var(--text-primary, #1A1A1E)'
                  }}
                >
                  {reason.label}
                </Typography>
              }
              sx={{ mb: 0.5 }}
            />
          ))}
        </RadioGroup>

        {/* Details Textarea */}
        <Box sx={{ mt: 3, mb: 3 }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)',
              mb: 1
            }}
          >
            Additional details: {selectedReason === 'other' ? '*' : '(optional)'}
          </Typography>
          <TextField
            multiline
            rows={3}
            fullWidth
            value={details}
            onChange={handleDetailsChange}
            placeholder={
              selectedReason === 'other'
                ? 'Please provide details about the rejection reason'
                : 'Any additional context (optional)'
            }
            helperText={`${details.length}/500 characters${details.length > 0 && details.length < 10 ? ' (min 10)' : ''}`}
            error={!!validationError}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '14px'
              }
            }}
          />
        </Box>

        {/* Validation Error */}
        {validationError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {validationError}
          </Alert>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Warning Section */}
        <Alert 
          severity="warning" 
          icon={<WarningAmberIcon />}
          sx={{ 
            background: 'rgba(255, 200, 87, 0.1)',
            border: '1px solid var(--accent-warning, #FFC857)',
            '.MuiAlert-icon': {
              color: 'var(--accent-warning, #FFC857)'
            }
          }}
        >
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)',
              mb: 1
            }}
          >
            This action will:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            <li>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '13px',
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                Return ${paymentAmount.toFixed(2)} to your budget pool
              </Typography>
            </li>
            <li>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '13px',
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                Open a dispute for admin review
              </Typography>
            </li>
            <li>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '13px',
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                Worker can contest this decision
              </Typography>
            </li>
          </Box>
        </Alert>
      </DialogContent>

      {/* ===== ACTIONS ===== */}
      <DialogActions
        sx={{
          p: 3,
          pt: 2,
          gap: 2,
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary, #F7F8FB)'
        }}
      >
        <Button
          variant="outlined"
          onClick={handleClose}
          sx={{
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontWeight: 600,
            textTransform: 'none',
            px: 3,
            '&:hover': {
              borderColor: 'var(--accent-primary)',
              background: 'var(--accent-primary-soft)'
            }
          }}
        >
          Cancel
        </Button>

        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={isConfirmDisabled}
          sx={{
            background: '#DC2626',
            color: '#FFFFFF',
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontWeight: 600,
            textTransform: 'none',
            px: 3,
            '&:hover': {
              background: '#B91C1C'
            },
            '&:disabled': {
              background: 'var(--text-muted, #A3A7B5)',
              color: '#FFFFFF'
            }
          }}
        >
          Confirm Rejection
        </Button>
      </DialogActions>
    </Dialog>
  )
}

