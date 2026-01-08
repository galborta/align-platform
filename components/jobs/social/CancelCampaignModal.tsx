/**
 * Cancel Campaign Modal
 * 
 * Allows campaign posters to cancel their campaigns with severe warnings about
 * the consequences: no worker payments, disputes opened, karma penalty.
 * 
 * Following Align Design System:
 * - Destructive/warning theme (red #EF4444)
 * - Satoshi font for body text
 * - Space Grotesk for headings
 * - Requires checkbox confirmation
 * - Clear consequences display
 */

'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Alert,
  Divider,
  Chip,
  Checkbox,
  FormControlLabel
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CancelIcon from '@mui/icons-material/Cancel'
import { Database } from '@/types/database'

type Job = Database['public']['Tables']['jobs']['Row']
type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

interface CancelCampaignModalProps {
  open: boolean
  job: Job
  pendingSubmissions: JobSubmission[]
  onClose: () => void
  onConfirm: () => Promise<void>
}

export default function CancelCampaignModal({
  open,
  job,
  pendingSubmissions,
  onClose,
  onConfirm
}: CancelCampaignModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  // ==================== CALCULATIONS ====================

  // Calculate full refund (budget + fees)
  const originalBudget = job.social_total_budget_usd || 0
  const feePercentage = (job.fee_percentage_at_creation || 5) / 100
  const platformFee = originalBudget * feePercentage
  const fullRefund = originalBudget + platformFee

  // Karma penalty
  const karmaPenalty = -50

  // ==================== HANDLERS ====================

  const handleConfirm = async () => {
    setIsProcessing(true)
    try {
      await onConfirm()
      // Reset confirmation state
      setConfirmCancel(false)
    } catch (error) {
      // Error handling done in parent
      console.error('Cancel confirmation error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    if (!isProcessing) {
      setConfirmCancel(false)
      onClose()
    }
  }

  // ==================== RENDER ====================

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '24px',
          padding: '8px',
          border: '3px solid #EF4444'
        }
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          fontFamily: 'var(--font-heading)',
          fontSize: '22px',
          fontWeight: 600,
          color: '#EF4444'
        }}
      >
        <CancelIcon sx={{ color: '#EF4444', fontSize: 32 }} />
        Cancel Campaign
      </DialogTitle>

      {/* Content */}
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Main Warning */}
          <Alert 
            severity="error"
            icon={<WarningAmberIcon />}
            sx={{
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '2px solid #EF4444',
              '& .MuiAlert-message': {
                fontFamily: 'Satoshi, sans-serif',
                fontSize: '16px',
                fontWeight: 600,
                lineHeight: 1.6
              }
            }}
          >
            Are you sure you want to cancel this campaign?
          </Alert>

          {/* Consequences */}
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                mb: 1.5
              }}
            >
              This will:
            </Typography>
            <List sx={{ py: 0 }}>
              <ListItem sx={{ px: 0, py: 0.5 }}>
                <ListItemText
                  primary="• NOT pay any workers"
                  primaryTypographyProps={{
                    fontFamily: 'Satoshi, sans-serif',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#EF4444'
                  }}
                />
              </ListItem>
              <ListItem sx={{ px: 0, py: 0.5 }}>
                <ListItemText
                  primary={`• Open disputes for ${pendingSubmissions.length} rejected worker${pendingSubmissions.length !== 1 ? 's' : ''}`}
                  primaryTypographyProps={{
                    fontFamily: 'Satoshi, sans-serif',
                    fontSize: '14px',
                    color: 'var(--text-secondary)'
                  }}
                />
              </ListItem>
              <ListItem sx={{ px: 0, py: 0.5 }}>
                <ListItemText
                  primary={`• Refund full budget: $${fullRefund.toFixed(2)}`}
                  primaryTypographyProps={{
                    fontFamily: 'Satoshi, sans-serif',
                    fontSize: '14px',
                    color: 'var(--text-secondary)'
                  }}
                />
              </ListItem>
              <ListItem sx={{ px: 0, py: 0.5 }}>
                <ListItemText
                  primary={`• Negatively impact your karma (${karmaPenalty} points)`}
                  primaryTypographyProps={{
                    fontFamily: 'Satoshi, sans-serif',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#EF4444'
                  }}
                />
              </ListItem>
            </List>
          </Box>

          <Divider sx={{ borderColor: 'var(--border-subtle)' }} />

          {/* Affected Workers */}
          {pendingSubmissions.length > 0 ? (
            <Box>
              <Typography
                variant="subtitle2"
                sx={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  mb: 1.5
                }}
              >
                Workers who will NOT be paid:
              </Typography>
              <Box
                sx={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  backgroundColor: 'var(--subtle-background)',
                  borderRadius: '12px',
                  padding: 2,
                  border: '2px solid #EF4444'
                }}
              >
                {pendingSubmissions.map((submission) => (
                  <Box
                    key={submission.id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 1
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '13px',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {submission.worker_wallet.slice(0, 4)}...
                      {submission.worker_wallet.slice(-4)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={`$${(submission.social_payment_amount_usd || 0).toFixed(2)}`}
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          color: '#EF4444',
                          fontFamily: 'Satoshi, sans-serif',
                          fontSize: '13px',
                          fontWeight: 500
                        }}
                      />
                      <Chip
                        label="pending"
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(255, 200, 87, 0.2)',
                          color: '#FF8C00',
                          fontFamily: 'Satoshi, sans-serif',
                          fontSize: '11px',
                          fontWeight: 500
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : (
            <Alert 
              severity="info"
              sx={{
                borderRadius: '12px',
                '& .MuiAlert-message': {
                  fontFamily: 'Satoshi, sans-serif',
                  fontSize: '14px'
                }
              }}
            >
              No pending submissions to cancel
            </Alert>
          )}

          {/* Reputation Warning */}
          <Alert 
            severity="error"
            icon={<WarningAmberIcon />}
            sx={{
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '2px solid #EF4444',
              '& .MuiAlert-message': {
                fontFamily: 'Satoshi, sans-serif',
                fontSize: '14px',
                fontWeight: 600
              }
            }}
          >
            ⚠️ Cancelling campaigns hurts your reputation and makes it harder to find workers in the future.
          </Alert>

          {/* Confirmation Checkbox */}
          <Box
            sx={{
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              borderRadius: '12px',
              padding: 2,
              border: '1px solid #EF4444'
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={confirmCancel}
                  onChange={(e) => setConfirmCancel(e.target.checked)}
                  disabled={isProcessing}
                  sx={{
                    color: '#EF4444',
                    '&.Mui-checked': {
                      color: '#EF4444'
                    }
                  }}
                />
              }
              label={
                <Typography
                  sx={{
                    fontFamily: 'Satoshi, sans-serif',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--text-primary)'
                  }}
                >
                  I understand this will harm my reputation and affect{' '}
                  <strong>{pendingSubmissions.length}</strong> worker
                  {pendingSubmissions.length !== 1 ? 's' : ''}
                </Typography>
              }
            />
          </Box>
        </Box>
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ padding: 3, paddingTop: 0 }}>
        <Button
          onClick={handleClose}
          disabled={isProcessing}
          variant="outlined"
          sx={{
            borderRadius: '999px',
            textTransform: 'none',
            fontFamily: 'Satoshi, sans-serif',
            fontSize: '14px',
            fontWeight: 500,
            paddingX: 3,
            paddingY: 1.5,
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
            '&:hover': {
              borderColor: 'var(--text-secondary)',
              backgroundColor: 'var(--subtle-background)'
            }
          }}
        >
          Go Back
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isProcessing || !confirmCancel}
          variant="contained"
          sx={{
            borderRadius: '999px',
            textTransform: 'none',
            fontFamily: 'Satoshi, sans-serif',
            fontSize: '14px',
            fontWeight: 500,
            paddingX: 3,
            paddingY: 1.5,
            backgroundColor: '#EF4444',
            color: '#FFFFFF',
            '&:hover': {
              backgroundColor: '#DC2626'
            },
            '&:disabled': {
              backgroundColor: 'var(--subtle-background)',
              color: 'var(--text-muted)'
            }
          }}
        >
          {isProcessing ? 'Processing...' : 'Yes, Cancel Campaign'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

