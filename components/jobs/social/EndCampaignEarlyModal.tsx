/**
 * End Campaign Early Modal
 * 
 * Allows campaign posters to manually end their social media campaigns before
 * the scheduled end date. Auto-approves all pending submissions and processes
 * payments and refunds.
 * 
 * Following Align Design System:
 * - Satoshi font for body text
 * - Space Grotesk for headings
 * - Warning theme (amber #FFC857)
 * - Card radius: 24px
 * - Generous spacing
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
  Chip
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { Database } from '@/types/database'

type Job = Database['public']['Tables']['jobs']['Row']
type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

interface EndCampaignEarlyModalProps {
  open: boolean
  job: Job
  pendingSubmissions: JobSubmission[]
  onClose: () => void
  onConfirm: () => Promise<void>
}

export default function EndCampaignEarlyModal({
  open,
  job,
  pendingSubmissions,
  onClose,
  onConfirm
}: EndCampaignEarlyModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  // ==================== CALCULATIONS ====================

  // Calculate total payout for pending submissions
  const totalPayout = pendingSubmissions.reduce(
    (sum, sub) => sum + (sub.social_payment_amount_usd || 0),
    0
  )

  // Calculate time remaining until scheduled end
  const now = new Date()
  const reviewDeadline = job.social_review_deadline ? new Date(job.social_review_deadline) : null
  const daysRemaining = reviewDeadline 
    ? Math.ceil((reviewDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0

  // Calculate remaining budget after payments
  const originalBudget = job.social_total_budget_usd || 0
  const feePercentage = (job.fee_percentage_at_creation || 5) / 100
  const budgetAfterPayments = originalBudget - totalPayout
  const feeRefund = budgetAfterPayments * feePercentage
  const totalRefund = budgetAfterPayments + feeRefund

  // ==================== HANDLERS ====================

  const handleConfirm = async () => {
    setIsProcessing(true)
    try {
      await onConfirm()
    } finally {
      setIsProcessing(false)
    }
  }

  // ==================== RENDER ====================

  return (
    <Dialog
      open={open}
      onClose={isProcessing ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '24px',
          padding: '8px'
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
          color: 'var(--text-primary)'
        }}
      >
        <WarningAmberIcon sx={{ color: '#FFC857', fontSize: 28 }} />
        End Campaign Early
      </DialogTitle>

      {/* Content */}
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Warning Message */}
          <Alert 
            severity="warning"
            sx={{
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 200, 87, 0.1)',
              border: '1px solid #FFC857',
              '& .MuiAlert-message': {
                fontFamily: 'Satoshi, sans-serif',
                fontSize: '14px',
                lineHeight: 1.6
              }
            }}
          >
            You're about to end this campaign{' '}
            {daysRemaining > 0 ? (
              <strong>{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</strong>
            ) : (
              <strong>before</strong>
            )}{' '}
            the scheduled end date.
          </Alert>

          {/* What Will Happen */}
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
                  primary={`• Auto-approve all pending submissions (${pendingSubmissions.length})`}
                  primaryTypographyProps={{
                    fontFamily: 'Satoshi, sans-serif',
                    fontSize: '14px',
                    color: 'var(--text-secondary)'
                  }}
                />
              </ListItem>
              <ListItem sx={{ px: 0, py: 0.5 }}>
                <ListItemText
                  primary="• Pay base amounts only (no impression bonuses)"
                  primaryTypographyProps={{
                    fontFamily: 'Satoshi, sans-serif',
                    fontSize: '14px',
                    color: 'var(--text-secondary)'
                  }}
                />
              </ListItem>
              <ListItem sx={{ px: 0, py: 0.5 }}>
                <ListItemText
                  primary={`• Refund remaining budget: $${totalRefund.toFixed(2)}`}
                  primaryTypographyProps={{
                    fontFamily: 'Satoshi, sans-serif',
                    fontSize: '14px',
                    color: 'var(--text-secondary)'
                  }}
                />
              </ListItem>
              <ListItem sx={{ px: 0, py: 0.5 }}>
                <ListItemText
                  primary="• Close campaign to new submissions"
                  primaryTypographyProps={{
                    fontFamily: 'Satoshi, sans-serif',
                    fontSize: '14px',
                    color: 'var(--text-secondary)'
                  }}
                />
              </ListItem>
            </List>
          </Box>

          <Divider sx={{ borderColor: 'var(--border-subtle)' }} />

          {/* Submissions List */}
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
                Submissions that will be paid:
              </Typography>
              <Box
                sx={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  backgroundColor: 'var(--subtle-background)',
                  borderRadius: '12px',
                  padding: 2
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
                    <Chip
                      label={`$${(submission.social_payment_amount_usd || 0).toFixed(2)}`}
                      size="small"
                      sx={{
                        backgroundColor: 'var(--accent-success-soft)',
                        color: 'var(--accent-success)',
                        fontFamily: 'Satoshi, sans-serif',
                        fontSize: '13px',
                        fontWeight: 500
                      }}
                    />
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
              No pending submissions to approve
            </Alert>
          )}

          {/* Total Summary */}
          <Box
            sx={{
              backgroundColor: 'var(--accent-primary-soft)',
              borderRadius: '16px',
              padding: 2.5,
              border: '2px solid var(--accent-primary)'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography
                sx={{
                  fontFamily: 'Satoshi, sans-serif',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)'
                }}
              >
                Total to be paid:
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--text-primary)'
                }}
              >
                ${totalPayout.toFixed(2)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography
                sx={{
                  fontFamily: 'Satoshi, sans-serif',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)'
                }}
              >
                Refund to you:
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--accent-success)'
                }}
              >
                ${totalRefund.toFixed(2)}
              </Typography>
            </Box>
          </Box>

          {/* Final Warning */}
          <Alert 
            severity="error"
            icon={<WarningAmberIcon />}
            sx={{
              borderRadius: '12px',
              '& .MuiAlert-message': {
                fontFamily: 'Satoshi, sans-serif',
                fontSize: '14px',
                fontWeight: 500
              }
            }}
          >
            ⚠️ This action cannot be undone
          </Alert>
        </Box>
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ padding: 3, paddingTop: 0 }}>
        <Button
          onClick={onClose}
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
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isProcessing || pendingSubmissions.length === 0}
          variant="contained"
          sx={{
            borderRadius: '999px',
            textTransform: 'none',
            fontFamily: 'Satoshi, sans-serif',
            fontSize: '14px',
            fontWeight: 500,
            paddingX: 3,
            paddingY: 1.5,
            backgroundColor: '#FFC857',
            color: '#000000',
            '&:hover': {
              backgroundColor: '#FFB624'
            },
            '&:disabled': {
              backgroundColor: 'var(--subtle-background)',
              color: 'var(--text-muted)'
            }
          }}
        >
          {isProcessing ? 'Processing...' : 'End Campaign & Pay Workers'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

