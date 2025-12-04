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
  Alert
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
    social_follower_count_verified: number
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
  onApprove: () => void
  onDeny: () => void
  onAdjustFollowers: () => void
}

// ==================== COMPONENT ====================

export default function SubmissionReviewCard({
  submission,
  estimatedPayment,
  jobId,
  onApprove,
  onDeny,
  onAdjustFollowers
}: SubmissionReviewCardProps) {
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showDenyModal, setShowDenyModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleApprove = async () => {
    setLoading(true)
    await onApprove()
    setLoading(false)
  }

  // Get status color and label
  const getStatusChip = () => {
    switch (submission.social_approval_status) {
      case 'approved':
        return <Chip label="APPROVED" color="success" size="small" />
      case 'auto_approved':
        return <Chip label="AUTO-APPROVED" color="success" size="small" />
      case 'denied':
        return <Chip label="DENIED" color="error" size="small" />
      case 'pending':
        return <Chip label="PENDING" color="warning" size="small" />
    }
  }

  const isPending = submission.social_approval_status === 'pending'
  const isApproved = submission.social_approval_status === 'approved' || submission.social_approval_status === 'auto_approved'
  const isDenied = submission.social_approval_status === 'denied'

  return (
    <>
      <Card
        sx={{
          bgcolor: '#1a1a1a',
          border: '1px solid #333',
          borderLeft: isApproved ? '4px solid #4CAF50' : isDenied ? '4px solid #f44336' : '4px solid #FFA726',
          mb: 2
        }}
      >
        <CardContent>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {submission.worker_wallet.slice(0, 8)}...{submission.worker_wallet.slice(-6)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Submitted {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
              </Typography>
            </Box>
            {getStatusChip()}
          </Box>

          {/* Follower count info */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2">
                Reported Followers: {submission.social_follower_count.toLocaleString()}
              </Typography>
              {submission.social_follower_count !== submission.social_follower_count_verified && (
                <Tooltip title="Follower count was adjusted">
                  <EditIcon fontSize="small" sx={{ color: '#FFA726' }} />
                </Tooltip>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">
                Verified Followers: {submission.social_follower_count_verified.toLocaleString()}
              </Typography>
              {isPending && (
                <Tooltip title="Adjust follower count">
                  <IconButton 
                    size="small" 
                    onClick={() => setShowAdjustModal(true)}
                    sx={{ color: '#7C4DFF' }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          {/* Tweet link */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              Tweet Link:
            </Typography>
            <MuiLink
              href={submission.social_tweet_link}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ 
                color: '#E3F06F',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                wordBreak: 'break-all'
              }}
            >
              {submission.social_tweet_link}
              <OpenInNewIcon fontSize="small" />
            </MuiLink>
          </Box>

          {/* Estimated payment */}
          {estimatedPayment && isApproved && (
            <Box 
              sx={{ 
                p: 2, 
                bgcolor: 'rgba(76, 175, 80, 0.1)', 
                borderRadius: 1,
                mb: 2 
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Est. Payment: {estimatedPayment.payment_amount_tokens.toFixed(2)} tokens (~${estimatedPayment.payment_amount_usd.toFixed(2)})
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {estimatedPayment.percentage_of_total.toFixed(1)}% of total pool
              </Typography>
            </Box>
          )}

          {/* Denial reason */}
          {isDenied && submission.social_denial_reason && (
            <Alert severity="error" sx={{ mb: 2 }}>
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
                  bgcolor: '#4CAF50',
                  '&:hover': { bgcolor: '#45a049' }
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
                  borderColor: '#f44336',
                  color: '#f44336',
                  '&:hover': { borderColor: '#d32f2f', bgcolor: 'rgba(244, 67, 54, 0.1)' }
                }}
              >
                Deny
              </Button>
            </Box>
          )}

          {isApproved && (
            <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>
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
      />
    </>
  )
}

