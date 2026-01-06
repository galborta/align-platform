'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Chip,
  Link as MuiLink,
  IconButton,
  Tooltip,
  Alert,
  TextField
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import EditIcon from '@mui/icons-material/Edit'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { formatDistanceToNow } from 'date-fns'
import AdjustFollowerCountModal from './AdjustFollowerCountModal'
import DenySubmissionModal from './DenySubmissionModal'

// ==================== TYPES ====================

interface SubmissionReviewCardProps {
  submission: {
    id: string
    worker_wallet: string
    social_tweet_link: string
    social_follower_count: number
    social_follower_count_verified: number | null
    social_approval_status: 'pending' | 'approved' | 'denied' | 'auto_approved'
    social_denial_reason: string | null
    submitted_at: string
  }
  estimatedPayment: {
    payment_amount_tokens: number
    payment_amount_usd: number
    percentage_of_total: number
  } | null
  jobId: string
  posterWallet: string
  onApprove: (impressionCount: number) => void
  onDeny: () => void
  onAdjustFollowers: () => void
}

// ==================== COMPONENT ====================

export default function SubmissionReviewCard({
  submission,
  estimatedPayment,
  jobId,
  posterWallet,
  onApprove,
  onDeny,
  onAdjustFollowers
}: SubmissionReviewCardProps) {
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showDenyModal, setShowDenyModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [impressionCount, setImpressionCount] = useState(0)

  const handleApprove = async () => {
    setLoading(true)
    await onApprove(impressionCount)
    setLoading(false)
  }

  // Get status color and label
  const getStatusChip = () => {
    switch (submission.social_approval_status) {
      case 'approved':
        return <Chip label="APPROVED" size="small" sx={{ 
          bgcolor: 'rgba(54, 193, 112, 0.15)', 
          color: 'var(--accent-success, #36C170)', 
          fontWeight: 600,
          border: '1px solid var(--accent-success, #36C170)'
        }} />
      case 'auto_approved':
        return <Chip label="AUTO-APPROVED" size="small" sx={{ 
          bgcolor: 'rgba(54, 193, 112, 0.15)', 
          color: 'var(--accent-success, #36C170)', 
          fontWeight: 600,
          border: '1px solid var(--accent-success, #36C170)'
        }} />
      case 'denied':
        return <Chip label="DENIED" size="small" sx={{ 
          bgcolor: 'rgba(239, 68, 68, 0.15)', 
          color: 'var(--accent-error, #EF4444)', 
          fontWeight: 600,
          border: '1px solid var(--accent-error, #EF4444)'
        }} />
      case 'pending':
        return <Chip label="PENDING" size="small" sx={{ 
          bgcolor: 'rgba(255, 200, 87, 0.15)', 
          color: 'var(--accent-warning, #FFC857)', 
          fontWeight: 600,
          border: '1px solid var(--accent-warning, #FFC857)'
        }} />
    }
  }

  const isPending = submission.social_approval_status === 'pending'
  const isApproved = submission.social_approval_status === 'approved' || submission.social_approval_status === 'auto_approved'
  const isDenied = submission.social_approval_status === 'denied'

  return (
    <>
      <Card
        sx={{
          bgcolor: 'var(--card-background, #FFFFFF)',
          borderRadius: 'var(--radius-card-lg, 24px)',
          boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))',
          border: 'none',
          borderLeft: isApproved 
            ? '4px solid var(--accent-success, #36C170)' 
            : isDenied 
              ? '4px solid #EF4444' 
              : '4px solid var(--accent-primary, #7C4DFF)',
          mb: 2
        }}
      >
        <CardContent sx={{ p: 'var(--space-lg, 24px) !important' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                  color: 'var(--text-primary, #1A1A1E)',
                  fontSize: '16px'
                }}
              >
                {submission.worker_wallet.slice(0, 8)}...{submission.worker_wallet.slice(-6)}
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'var(--text-muted, #A3A7B5)',
                  fontSize: '12px'
                }}
              >
                Submitted {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
              </Typography>
            </Box>
            {getStatusChip()}
          </Box>

          {/* Follower count info */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography 
                variant="body2"
                sx={{ 
                  color: 'var(--text-secondary, #6F7280)',
                  fontSize: '14px'
                }}
              >
                Reported Followers: {submission.social_follower_count.toLocaleString()}
              </Typography>
              {submission.social_follower_count_verified && submission.social_follower_count !== submission.social_follower_count_verified && (
                <Tooltip title="Follower count was adjusted">
                  <EditIcon fontSize="small" sx={{ color: 'var(--accent-warning, #FFC857)' }} />
                </Tooltip>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography 
                variant="body2"
                sx={{ 
                  color: 'var(--text-primary, #1A1A1E)',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                Verified Followers: {(submission.social_follower_count_verified ?? submission.social_follower_count).toLocaleString()}
              </Typography>
              {isPending && (
                <Tooltip title="Adjust follower count">
                  <IconButton 
                    size="small" 
                    onClick={() => setShowAdjustModal(true)}
                    sx={{ 
                      color: 'var(--accent-primary, #7C4DFF)',
                      '&:hover': {
                        bgcolor: 'var(--accent-primary-soft, #EEE7FF)'
                      }
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          {/* Tweet link */}
          <Box sx={{ mb: 2 }}>
            <Typography 
              variant="body2" 
              sx={{ 
                mb: 0.5,
                color: 'var(--text-secondary, #6F7280)',
                fontSize: '14px'
              }}
            >
              Tweet Link:
            </Typography>
            <MuiLink
              href={submission.social_tweet_link}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ 
                color: 'var(--accent-primary, #7C4DFF)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                wordBreak: 'break-all',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline'
                }
              }}
            >
              {submission.social_tweet_link}
              <OpenInNewIcon fontSize="small" />
            </MuiLink>
          </Box>

          {/* Impression Count Input - Only for pending submissions */}
          {isPending && (
            <Box sx={{ mb: 2 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  mb: 1,
                  color: 'var(--text-primary, #1A1A1E)',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                💎 Impression Bonus (Optional)
              </Typography>
              <TextField
                fullWidth
                type="number"
                label="Verified Impressions"
                placeholder="e.g., 50000"
                value={impressionCount || ''}
                onChange={(e) => setImpressionCount(parseInt(e.target.value) || 0)}
                inputProps={{ min: 0, step: 1000 }}
                helperText={`Bonus: $${((impressionCount / 1000) * 5).toFixed(2)} at $5 CPM (per 1000 impressions)`}
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
                    color: impressionCount > 0 ? 'var(--accent-success, #36C170)' : 'var(--text-muted, #A3A7B5)',
                    fontSize: '12px',
                    fontWeight: impressionCount > 0 ? 600 : 400
                  }
                }}
              />
            </Box>
          )}

          {/* Estimated payment */}
          {estimatedPayment && isApproved && (
            <Box 
              sx={{ 
                p: 'var(--space-md, 16px)', 
                bgcolor: 'var(--accent-success-soft, #E3F8ED)', 
                borderRadius: '12px',
                border: '1px solid var(--accent-success, #36C170)',
                mb: 2 
              }}
            >
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)',
                  fontSize: '14px'
                }}
              >
                Est. Payment: {estimatedPayment.payment_amount_tokens.toFixed(2)} tokens (~${estimatedPayment.payment_amount_usd.toFixed(2)})
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'var(--text-secondary, #6F7280)',
                  fontSize: '12px'
                }}
              >
                {estimatedPayment.percentage_of_total.toFixed(1)}% of total pool
              </Typography>
            </Box>
          )}

          {/* Denial reason */}
          {isDenied && submission.social_denial_reason && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 2,
                borderRadius: '12px',
                bgcolor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #EF4444'
              }}
            >
              <Typography variant="caption">
                <strong>Denial Reason:</strong> {submission.social_denial_reason}
              </Typography>
            </Alert>
          )}

          {/* Action buttons */}
          {isPending && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<CheckCircleIcon />}
                onClick={handleApprove}
                disabled={loading}
                sx={{
                  bgcolor: 'var(--accent-success, #36C170)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: 'var(--radius-control, 999px)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  boxShadow: '0 4px 12px 0 rgba(54, 193, 112, 0.25)',
                  '&:hover': { 
                    bgcolor: '#2DA85E',
                    boxShadow: '0 6px 16px 0 rgba(54, 193, 112, 0.35)'
                  },
                  '&:disabled': {
                    bgcolor: 'var(--text-muted, #A3A7B5)',
                    color: '#FFFFFF'
                  }
                }}
              >
                Approve
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={() => setShowDenyModal(true)}
                disabled={loading}
                sx={{
                  borderColor: '#EF4444',
                  color: '#EF4444',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: 'var(--radius-control, 999px)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  '&:hover': { 
                    borderColor: '#DC2626', 
                    bgcolor: 'rgba(239, 68, 68, 0.1)' 
                  },
                  '&:disabled': {
                    borderColor: 'var(--text-muted, #A3A7B5)',
                    color: 'var(--text-muted, #A3A7B5)'
                  }
                }}
              >
                Deny
              </Button>
            </Box>
          )}

          {isApproved && (
            <Typography 
              variant="caption" 
              sx={{ 
                display: 'block',
                color: 'var(--accent-success, #36C170)',
                fontSize: '12px',
                fontWeight: 500
              }}
            >
              ✓ Approved {submission.social_approval_status === 'auto_approved' && 'automatically '}
              {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <AdjustFollowerCountModal
        open={showAdjustModal}
        onClose={() => {
          setShowAdjustModal(false)
          onAdjustFollowers()
        }}
        submission={submission}
        jobId={jobId}
        posterWallet={posterWallet}
      />

      <DenySubmissionModal
        open={showDenyModal}
        onClose={() => setShowDenyModal(false)}
        onDeny={(reason) => {
          setShowDenyModal(false)
          onDeny()
        }}
        submission={submission}
        jobId={jobId}
        posterWallet={posterWallet}
      />
    </>
  )
}

