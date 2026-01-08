/**
 * Campaign Completion Card
 * 
 * Displays campaign completion status to both posters and workers with
 * different views based on role and campaign outcome.
 * 
 * Following Align Design System:
 * - Satoshi font for body text
 * - Space Grotesk for headings
 * - Success green (#36C170) for completed
 * - Error red (#EF4444) for cancelled
 * - 24px border radius for cards
 * - Transaction links to Solana explorer
 */

'use client'

import {
  Paper,
  Box,
  Typography,
  Chip,
  Button,
  Link,
  Divider,
  Alert
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import InfoIcon from '@mui/icons-material/Info'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import GavelIcon from '@mui/icons-material/Gavel'
import { format } from 'date-fns'
import { Database } from '@/types/database'

type Job = Database['public']['Tables']['jobs']['Row']
type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

interface CampaignCompletionCardProps {
  job: Job
  userRole: 'poster' | 'worker'
  submission?: JobSubmission // Required if userRole is 'worker'
}

/**
 * Format Solana transaction signature for display
 */
function formatTxSignature(signature: string | null | undefined): string {
  if (!signature) return 'N/A'
  if (signature.startsWith('ERROR:')) return 'Failed'
  return `${signature.slice(0, 8)}...${signature.slice(-8)}`
}

/**
 * Get Solana explorer URL for transaction
 */
function getSolanaExplorerUrl(signature: string | null | undefined, network: 'mainnet' | 'devnet' = 'devnet'): string | null {
  if (!signature || signature.startsWith('ERROR:')) return null
  const baseUrl = network === 'mainnet' 
    ? 'https://solscan.io/tx/' 
    : 'https://solscan.io/tx/'
  return `${baseUrl}${signature}?cluster=${network}`
}

export default function CampaignCompletionCard({
  job,
  userRole,
  submission
}: CampaignCompletionCardProps) {
  
  // ==================== DETERMINE CAMPAIGN STATUS ====================
  
  const isCancelled = job.status === 'cancelled'
  const isCompletedNoParticipants = job.status === 'completed_no_participants'
  const isCompleted = job.status === 'completed' && !isCompletedNoParticipants
  
  const completedDate = job.completed_at 
    ? format(new Date(job.completed_at), 'MMMM d, yyyy')
    : 'Unknown date'

  // ==================== POSTER VIEW ====================
  
  if (userRole === 'poster') {
    if (isCancelled) {
      return (
        <Paper
          sx={{
            p: 3,
            borderRadius: 'var(--radius-card-lg, 24px)',
            border: '2px solid #EF4444',
            backgroundColor: 'rgba(239, 68, 68, 0.05)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <CancelIcon sx={{ color: '#EF4444', fontSize: 32 }} />
            <Typography
              sx={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '22px',
                fontWeight: 700,
                color: '#EF4444'
              }}
            >
              Campaign Cancelled
            </Typography>
          </Box>

          <Divider sx={{ mb: 2, borderColor: '#EF4444' }} />

          <Typography
            sx={{
              fontFamily: 'Satoshi, sans-serif',
              fontSize: '14px',
              color: 'var(--text-secondary)',
              mb: 2
            }}
          >
            You cancelled this campaign on {completedDate}.
          </Typography>

          <Alert 
            severity="error"
            icon={<InfoIcon />}
            sx={{
              borderRadius: '12px',
              mb: 2,
              '& .MuiAlert-message': {
                fontFamily: 'Satoshi, sans-serif',
                fontSize: '14px'
              }
            }}
          >
            All pending submissions were rejected. Disputes have been opened for affected workers.
          </Alert>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
            <Typography
              sx={{
                fontFamily: 'Satoshi, sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary)'
              }}
            >
              Full refund processed: ${((job.social_total_budget_usd || 0) * 1.05).toFixed(2)}
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Satoshi, sans-serif',
                fontSize: '12px',
                color: 'var(--text-muted)'
              }}
            >
              (Includes returned platform fee)
            </Typography>
          </Box>
        </Paper>
      )
    }

    if (isCompletedNoParticipants) {
      return (
        <Paper
          sx={{
            p: 3,
            borderRadius: 'var(--radius-card-lg, 24px)',
            border: '2px solid var(--accent-warning, #FFC857)',
            backgroundColor: 'rgba(255, 200, 87, 0.05)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <InfoIcon sx={{ color: '#FFC857', fontSize: 32 }} />
            <Typography
              sx={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary)'
              }}
            >
              Campaign Ended - No Participants
            </Typography>
          </Box>

          <Divider sx={{ mb: 2, borderColor: '#FFC857' }} />

          <Typography
            sx={{
              fontFamily: 'Satoshi, sans-serif',
              fontSize: '14px',
              color: 'var(--text-secondary)',
              mb: 2
            }}
          >
            Your campaign ended on {completedDate} with no submissions.
          </Typography>

          <Alert 
            severity="info"
            sx={{
              borderRadius: '12px',
              mb: 2,
              '& .MuiAlert-message': {
                fontFamily: 'Satoshi, sans-serif',
                fontSize: '14px'
              }
            }}
          >
            No payments were processed. Full refund has been issued.
          </Alert>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography
              sx={{
                fontFamily: 'Satoshi, sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary)'
              }}
            >
              Full refund: ${((job.social_total_budget_usd || 0) * 1.05).toFixed(2)}
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Satoshi, sans-serif',
                fontSize: '12px',
                color: 'var(--text-muted)'
              }}
            >
              (Budget + platform fee returned)
            </Typography>
          </Box>
        </Paper>
      )
    }

    if (isCompleted) {
      // Get completion details from job
      // Note: These would ideally come from a separate completion record
      const totalBudget = job.social_total_budget_usd || 0
      const totalPaid = job.social_actual_budget_released || 0
      const budgetRefunded = totalBudget - totalPaid
      
      return (
        <Paper
          sx={{
            p: 3,
            borderRadius: 'var(--radius-card-lg, 24px)',
            border: '2px solid var(--accent-success, #36C170)',
            backgroundColor: 'rgba(54, 193, 112, 0.05)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <CheckCircleIcon sx={{ color: 'var(--accent-success, #36C170)', fontSize: 32 }} />
            <Typography
              sx={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary)'
              }}
            >
              Campaign Completed
            </Typography>
          </Box>

          <Divider sx={{ mb: 2, borderColor: 'var(--accent-success)' }} />

          <Typography
            sx={{
              fontFamily: 'Satoshi, sans-serif',
              fontSize: '14px',
              color: 'var(--text-secondary)',
              mb: 3
            }}
          >
            Your campaign ended on {completedDate}
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Typography
              sx={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                mb: 1.5
              }}
            >
              Final Results:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography
                  sx={{
                    fontFamily: 'Satoshi, sans-serif',
                    fontSize: '14px',
                    color: 'var(--text-secondary)'
                  }}
                >
                  Total paid to workers:
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'Satoshi, sans-serif',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-primary)'
                  }}
                >
                  ${totalPaid.toFixed(2)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography
                  sx={{
                    fontFamily: 'Satoshi, sans-serif',
                    fontSize: '14px',
                    color: 'var(--text-secondary)'
                  }}
                >
                  Budget refunded:
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'Satoshi, sans-serif',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--accent-success)'
                  }}
                >
                  ${budgetRefunded.toFixed(2)}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Alert 
            severity="info"
            sx={{
              borderRadius: '12px',
              '& .MuiAlert-message': {
                fontFamily: 'Satoshi, sans-serif',
                fontSize: '13px'
              }
            }}
          >
            All pending submissions were auto-approved at campaign end. Base payments only.
          </Alert>
        </Paper>
      )
    }
  }

  // ==================== WORKER VIEW ====================
  
  if (userRole === 'worker' && submission) {
    const isRejected = submission.social_approval_status === 'rejected'
    const isAutoApproved = submission.social_approval_status === 'auto_approved'
    const paymentAmount = submission.social_payment_amount_usd || 0
    const txSignature = submission.social_payment_tx_signature
    const explorerUrl = getSolanaExplorerUrl(txSignature)

    if (isCancelled || isRejected) {
      return (
        <Paper
          sx={{
            p: 3,
            borderRadius: 'var(--radius-card-lg, 24px)',
            border: '2px solid #EF4444',
            backgroundColor: 'rgba(239, 68, 68, 0.05)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <CancelIcon sx={{ color: '#EF4444', fontSize: 32 }} />
            <Typography
              sx={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '22px',
                fontWeight: 700,
                color: '#EF4444'
              }}
            >
              Campaign Cancelled
            </Typography>
          </Box>

          <Divider sx={{ mb: 2, borderColor: '#EF4444' }} />

          <Typography
            sx={{
              fontFamily: 'Satoshi, sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              mb: 1
            }}
          >
            Campaign: {job.title}
          </Typography>

          <Typography
            sx={{
              fontFamily: 'Satoshi, sans-serif',
              fontSize: '14px',
              color: 'var(--text-secondary)',
              mb: 2
            }}
          >
            This campaign was cancelled by the poster.
          </Typography>

          <Alert 
            severity="error"
            sx={{
              borderRadius: '12px',
              mb: 2,
              '& .MuiAlert-message': {
                fontFamily: 'Satoshi, sans-serif',
                fontSize: '14px'
              }
            }}
          >
            <strong>Status:</strong> Dispute opened for admin review
          </Alert>

          <Typography
            sx={{
              fontFamily: 'Satoshi, sans-serif',
              fontSize: '14px',
              color: 'var(--text-secondary)',
              mb: 3
            }}
          >
            Your reserved payment (${paymentAmount.toFixed(2)}) was not released.
          </Typography>

          <Button
            variant="outlined"
            startIcon={<GavelIcon />}
            fullWidth
            sx={{
              borderRadius: '999px',
              textTransform: 'none',
              fontFamily: 'Satoshi, sans-serif',
              fontSize: '14px',
              fontWeight: 500,
              paddingY: 1.5,
              borderColor: '#EF4444',
              color: '#EF4444',
              '&:hover': {
                borderColor: '#DC2626',
                backgroundColor: 'rgba(239, 68, 68, 0.1)'
              }
            }}
          >
            View Dispute Details
          </Button>
        </Paper>
      )
    }

    if (isAutoApproved) {
      return (
        <Paper
          sx={{
            p: 3,
            borderRadius: 'var(--radius-card-lg, 24px)',
            border: '2px solid var(--accent-success, #36C170)',
            backgroundColor: 'rgba(54, 193, 112, 0.05)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <CheckCircleIcon sx={{ color: 'var(--accent-success, #36C170)', fontSize: 32 }} />
            <Typography
              sx={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary)'
              }}
            >
              Payment Received
            </Typography>
          </Box>

          <Divider sx={{ mb: 2, borderColor: 'var(--accent-success)' }} />

          <Typography
            sx={{
              fontFamily: 'Satoshi, sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              mb: 1
            }}
          >
            Campaign: {job.title}
          </Typography>

          <Typography
            sx={{
              fontFamily: 'Satoshi, sans-serif',
              fontSize: '14px',
              color: 'var(--text-secondary)',
              mb: 3
            }}
          >
            Your submission was auto-approved when the campaign ended on {completedDate}.
          </Typography>

          <Box
            sx={{
              backgroundColor: 'var(--accent-success-soft, #E3F8ED)',
              borderRadius: '12px',
              padding: 2,
              mb: 2
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography
                sx={{
                  fontFamily: 'Satoshi, sans-serif',
                  fontSize: '14px',
                  color: 'var(--text-secondary)'
                }}
              >
                Payment:
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--accent-success)'
                }}
              >
                ${paymentAmount.toFixed(2)}
              </Typography>
            </Box>
            <Typography
              sx={{
                fontFamily: 'Satoshi, sans-serif',
                fontSize: '12px',
                color: 'var(--text-muted)',
                fontStyle: 'italic'
              }}
            >
              Base payment only (auto-approval)
            </Typography>
          </Box>

          {explorerUrl && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                sx={{
                  fontFamily: 'Satoshi, sans-serif',
                  fontSize: '13px',
                  color: 'var(--text-secondary)'
                }}
              >
                Transaction:
              </Typography>
              <Link
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '13px',
                  color: 'var(--accent-primary)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  '&:hover': {
                    textDecoration: 'underline'
                  }
                }}
              >
                {formatTxSignature(txSignature)}
                <OpenInNewIcon sx={{ fontSize: 14 }} />
              </Link>
            </Box>
          )}
        </Paper>
      )
    }
  }

  // ==================== FALLBACK ====================
  
  return (
    <Paper
      sx={{
        p: 3,
        borderRadius: 'var(--radius-card-lg, 24px)',
        border: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--card-background)'
      }}
    >
      <Typography
        sx={{
          fontFamily: 'Satoshi, sans-serif',
          fontSize: '14px',
          color: 'var(--text-secondary)'
        }}
      >
        Campaign status information not available.
      </Typography>
    </Paper>
  )
}

