/**
 * Worker Submission Status Component
 * 
 * Displays the current status of a worker's submission to a social media job.
 * Shows different content based on approval status: pending, approved, or rejected.
 * 
 * Features:
 * - Status-based rendering (pending/approved/rejected)
 * - Payment breakdown for approved submissions
 * - Countdown timer for auto-approval
 * - Transaction links to Solana explorer
 * - Rejection reason display
 * - Time ago formatting
 * - Responsive design
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  Button,
  Link as MuiLink,
  Alert
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PendingIcon from '@mui/icons-material/Pending'
import CancelIcon from '@mui/icons-material/Cancel'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { formatDistanceToNow } from 'date-fns'
import { Database } from '@/types/database'
import { calculateTimeRemaining, formatTimeRemaining } from '@/lib/time-utils'

type Job = Database['public']['Tables']['jobs']['Row']
type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

interface WorkerSubmissionStatusProps {
  submission: JobSubmission
  job: Job
}

/**
 * Format currency amount
 */
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

/**
 * Format time ago
 * Example: "2 days ago", "3 hours ago"
 */
function formatTimeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

/**
 * Get Solana explorer link for transaction
 */
function getSolanaExplorerLink(signature: string, network: 'mainnet' | 'devnet' = 'mainnet'): string {
  const cluster = network === 'devnet' ? '?cluster=devnet' : ''
  return `https://explorer.solana.com/tx/${signature}${cluster}`
}

/**
 * Worker Submission Status Component
 */
export default function WorkerSubmissionStatus({
  submission,
  job
}: WorkerSubmissionStatusProps) {
  const [timeRemaining, setTimeRemaining] = useState(() => {
    if (job.social_review_deadline) {
      return calculateTimeRemaining(new Date(job.social_review_deadline))
    }
    return null
  })
  
  // Update countdown every minute
  useEffect(() => {
    if (!job.social_review_deadline || submission.social_approval_status !== 'pending') {
      return
    }
    
    const timer = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(new Date(job.social_review_deadline!)))
    }, 60000) // Update every minute
    
    return () => clearInterval(timer)
  }, [job.social_review_deadline, submission.social_approval_status])
  
  const status = submission.social_approval_status as 'pending' | 'approved' | 'rejected' | null
  
  // === PENDING STATUS ===
  if (status === 'pending') {
    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: 'var(--radius-card-lg, 24px)',
          border: '2px solid var(--accent-primary, #7C4DFF)',
          p: 3,
          bgcolor: 'var(--card-background, #FFFFFF)'
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <PendingIcon sx={{ color: 'var(--accent-primary, #7C4DFF)', fontSize: 28 }} />
          <Typography
            sx={{
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontSize: 'var(--text-headline, 18px)',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)'
            }}
          >
            Submission Status: Pending Review
          </Typography>
        </Box>
        
        <Divider sx={{ mb: 2.5 }} />
        
        {/* Status Message */}
        <Typography
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: 'var(--text-body, 16px)',
            color: 'var(--text-secondary, #6F7280)',
            mb: 3
          }}
        >
          Your submission is awaiting poster review.
        </Typography>
        
        {/* Submission Details */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
          {/* Payment */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: 'var(--text-body-small, 14px)',
                color: 'var(--text-secondary, #6F7280)'
              }}
            >
              Payment:
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: 'var(--text-body, 16px)',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              {formatCurrency(submission.social_payment_amount_usd || 0)}{' '}
              <Chip
                label="reserved"
                size="small"
                sx={{
                  bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
                  color: 'var(--accent-primary, #7C4DFF)',
                  fontWeight: 600,
                  fontSize: '11px',
                  height: 20
                }}
              />
            </Typography>
          </Box>
          
          {/* Tweet Link */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: 'var(--text-body-small, 14px)',
                color: 'var(--text-secondary, #6F7280)'
              }}
            >
              Tweet:
            </Typography>
            <MuiLink
              href={submission.social_tweet_link || '#'}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: 'var(--text-body-small, 14px)',
                color: 'var(--accent-primary, #7C4DFF)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                '&:hover': {
                  textDecoration: 'underline'
                }
              }}
            >
              View Tweet <OpenInNewIcon sx={{ fontSize: 14 }} />
            </MuiLink>
          </Box>
          
          {/* Submitted Time */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: 'var(--text-body-small, 14px)',
                color: 'var(--text-secondary, #6F7280)'
              }}
            >
              Submitted:
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: 'var(--text-body-small, 14px)',
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              {formatTimeAgo(submission.submitted_at || new Date())}
            </Typography>
          </Box>
        </Box>
        
        {/* Payment Timeline */}
        <Alert
          icon={<MonetizationOnIcon sx={{ fontSize: 20 }} />}
          severity="info"
          sx={{
            mb: 2.5,
            bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
            color: 'var(--text-primary, #1A1A1E)',
            border: 'none',
            '& .MuiAlert-icon': {
              color: 'var(--accent-primary, #7C4DFF)'
            },
            '& .MuiAlert-message': {
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body-small, 14px)',
              width: '100%'
            }
          }}
        >
          <Typography
            sx={{
              fontWeight: 600,
              mb: 1,
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body-small, 14px)'
            }}
          >
            💡 Payment will happen:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pl: 2 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: 'var(--text-body-small, 14px)'
              }}
            >
              • Immediately if manually approved
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: 'var(--text-body-small, 14px)'
              }}
            >
              • Automatically on{' '}
              {job.social_review_deadline
                ? new Date(job.social_review_deadline).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })
                : 'campaign end'}
            </Typography>
          </Box>
        </Alert>
        
        {/* Countdown to Auto-Approval */}
        {timeRemaining && !timeRemaining.hasEnded && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 2,
              bgcolor: 'var(--subtle-background, #F7F8FB)',
              borderRadius: 'var(--radius-card-lg, 12px)',
              mb: 2.5
            }}
          >
            <AccessTimeIcon sx={{ color: 'var(--accent-primary, #7C4DFF)', fontSize: 20 }} />
            <Box>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: 'var(--text-body-small, 14px)',
                  color: 'var(--text-secondary, #6F7280)',
                  mb: 0.25
                }}
              >
                Days until auto-approval:
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                  fontSize: 'var(--text-body, 16px)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                {formatTimeRemaining(timeRemaining)}
              </Typography>
            </Box>
          </Box>
        )}
        
        {/* Warning */}
        <Alert
          icon={<WarningAmberIcon sx={{ fontSize: 20 }} />}
          severity="warning"
          sx={{
            bgcolor: '#FEF3C7',
            color: 'var(--text-primary, #1A1A1E)',
            border: 'none',
            '& .MuiAlert-icon': {
              color: '#F59E0B'
            },
            '& .MuiAlert-message': {
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body-small, 14px)',
              fontWeight: 600
            }
          }}
        >
          ⚠️ Keep your tweet live!
        </Alert>
      </Paper>
    )
  }
  
  // === APPROVED STATUS ===
  if (status === 'approved') {
    const basePayment = submission.social_payment_amount_usd || 0
    const bonusPayment = submission.social_bonus_payment_usd || 0
    const totalPayment = basePayment + bonusPayment
    const impressions = submission.social_impression_count || 0
    
    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: 'var(--radius-card-lg, 24px)',
          border: '2px solid var(--accent-success, #10B981)',
          p: 3,
          bgcolor: 'var(--card-background, #FFFFFF)'
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <CheckCircleIcon sx={{ color: 'var(--accent-success, #10B981)', fontSize: 28 }} />
          <Typography
            sx={{
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontSize: 'var(--text-headline, 18px)',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)'
            }}
          >
            ✅ Submission Approved & Paid!
          </Typography>
        </Box>
        
        <Divider sx={{ mb: 2.5 }} />
        
        {/* Success Message */}
        <Typography
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: 'var(--text-body, 16px)',
            color: 'var(--text-secondary, #6F7280)',
            mb: 3
          }}
        >
          Congratulations! You've been paid.
        </Typography>
        
        {/* Payment Breakdown */}
        <Box
          sx={{
            bgcolor: 'var(--accent-success-soft, #E3F8ED)',
            borderRadius: 'var(--radius-card-lg, 16px)',
            p: 2.5,
            mb: 3
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Base Payment */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: 'var(--text-body-small, 14px)',
                  color: 'var(--text-secondary, #6F7280)'
                }}
              >
                Base payment:
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: 'var(--text-body, 16px)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                {formatCurrency(basePayment)}
              </Typography>
            </Box>
            
            {/* Bonus Payment */}
            {bonusPayment > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: 'var(--text-body-small, 14px)',
                    color: 'var(--text-secondary, #6F7280)'
                  }}
                >
                  Impression bonus:
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: 'var(--text-body, 16px)',
                    fontWeight: 600,
                    color: 'var(--accent-success, #10B981)'
                  }}
                >
                  {formatCurrency(bonusPayment)}
                </Typography>
              </Box>
            )}
            
            <Divider />
            
            {/* Total */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: 'var(--text-body, 16px)',
                  fontWeight: 700,
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                Total received:
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                  fontSize: 'var(--text-headline, 18px)',
                  fontWeight: 700,
                  color: 'var(--accent-success, #10B981)'
                }}
              >
                {formatCurrency(totalPayment)}
              </Typography>
            </Box>
          </Box>
        </Box>
        
        {/* Additional Details */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
          {/* Impressions */}
          {impressions > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: 'var(--text-body-small, 14px)',
                  color: 'var(--text-secondary, #6F7280)'
                }}
              >
                Impressions:
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: 'var(--text-body, 16px)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                {impressions.toLocaleString()}
              </Typography>
            </Box>
          )}
          
          {/* Transaction Link */}
          {submission.social_payment_tx_signature && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: 'var(--text-body-small, 14px)',
                  color: 'var(--text-secondary, #6F7280)'
                }}
              >
                Transaction:
              </Typography>
              <MuiLink
                href={getSolanaExplorerLink(submission.social_payment_tx_signature)}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: 'var(--text-body-small, 14px)',
                  color: 'var(--accent-primary, #7C4DFF)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  '&:hover': {
                    textDecoration: 'underline'
                  }
                }}
              >
                {submission.social_payment_tx_signature.slice(0, 8)}...{submission.social_payment_tx_signature.slice(-8)}{' '}
                <OpenInNewIcon sx={{ fontSize: 14 }} />
              </MuiLink>
            </Box>
          )}
          
          {/* Paid Time */}
          {submission.social_paid_at && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: 'var(--text-body-small, 14px)',
                  color: 'var(--text-secondary, #6F7280)'
                }}
              >
                Paid:
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: 'var(--text-body-small, 14px)',
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                {formatTimeAgo(submission.social_paid_at)}
              </Typography>
            </Box>
          )}
        </Box>
        
        {/* Success Info */}
        <Alert
          severity="success"
          sx={{
            bgcolor: 'var(--accent-success-soft, #E3F8ED)',
            color: 'var(--text-primary, #1A1A1E)',
            border: 'none',
            '& .MuiAlert-icon': {
              color: 'var(--accent-success, #10B981)'
            },
            '& .MuiAlert-message': {
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body-small, 14px)',
              fontWeight: 600
            }
          }}
        >
          💰 Check your wallet for payment
        </Alert>
      </Paper>
    )
  }
  
  // === REJECTED STATUS ===
  if (status === 'rejected') {
    const rejectionReason = submission.social_rejection_reason || 'No reason provided'
    
    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: 'var(--radius-card-lg, 24px)',
          border: '2px solid #EF4444',
          p: 3,
          bgcolor: 'var(--card-background, #FFFFFF)'
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <CancelIcon sx={{ color: '#EF4444', fontSize: 28 }} />
          <Typography
            sx={{
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontSize: 'var(--text-headline, 18px)',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)'
            }}
          >
            ❌ Submission Rejected
          </Typography>
        </Box>
        
        <Divider sx={{ mb: 2.5 }} />
        
        {/* Rejection Message */}
        <Typography
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: 'var(--text-body, 16px)',
            color: 'var(--text-secondary, #6F7280)',
            mb: 3
          }}
        >
          Your submission was not approved.
        </Typography>
        
        {/* Rejection Reason */}
        <Box
          sx={{
            bgcolor: '#FEE2E2',
            borderRadius: 'var(--radius-card-lg, 12px)',
            p: 2.5,
            mb: 3
          }}
        >
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body-small, 14px)',
              color: 'var(--text-secondary, #6F7280)',
              mb: 0.5,
              fontWeight: 600
            }}
          >
            Reason:
          </Typography>
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body, 16px)',
              color: 'var(--text-primary, #1A1A1E)',
              fontWeight: 500
            }}
          >
            {rejectionReason}
          </Typography>
        </Box>
        
        {/* Budget Return Info */}
        <Typography
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: 'var(--text-body-small, 14px)',
            color: 'var(--text-secondary, #6F7280)',
            mb: 3,
            textAlign: 'center'
          }}
        >
          Your payment reservation ({formatCurrency(submission.social_payment_amount_usd || 0)}) has been
          returned to the campaign budget.
        </Typography>
        
        {/* Dispute Info */}
        <Alert
          severity="warning"
          sx={{
            bgcolor: '#FEF3C7',
            color: 'var(--text-primary, #1A1A1E)',
            border: 'none',
            mb: 2.5,
            '& .MuiAlert-icon': {
              color: '#F59E0B'
            },
            '& .MuiAlert-message': {
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body-small, 14px)',
              fontWeight: 600
            }
          }}
        >
          🛡️ If you believe this rejection is unfair, you can open a dispute
        </Alert>
        
        {/* View Dispute Button */}
        <Button
          fullWidth
          variant="outlined"
          sx={{
            borderColor: '#EF4444',
            color: '#EF4444',
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: 'var(--text-label, 14px)',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 'var(--radius-control, 999px)',
            py: 1.25,
            '&:hover': {
              borderColor: '#DC2626',
              bgcolor: '#FEE2E2'
            }
          }}
        >
          Open Dispute
        </Button>
      </Paper>
    )
  }
  
  // === UNKNOWN STATUS ===
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 'var(--radius-card-lg, 24px)',
        border: '1px solid var(--border-subtle, #E5E7F0)',
        p: 3,
        bgcolor: 'var(--card-background, #FFFFFF)'
      }}
    >
      <Typography
        sx={{
          fontFamily: 'var(--font-body, Satoshi, sans-serif)',
          fontSize: 'var(--text-body, 16px)',
          color: 'var(--text-secondary, #6F7280)',
          textAlign: 'center'
        }}
      >
        Status unknown. Please refresh the page.
      </Typography>
    </Paper>
  )
}

