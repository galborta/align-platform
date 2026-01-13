'use client'

/**
 * Sprint 4: Submission Review Card
 * 
 * Individual submission card with:
 * - Batch selection checkbox
 * - Submission details (wallet, followers, payment, tweet link)
 * - Impression input with real-time bonus calculation
 * - Approve/Reject action buttons
 */

import { useState, ChangeEvent } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Checkbox,
  Link,
  Chip
} from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import type { Database } from '@/types/database'
import { truncateWalletAddress } from '@/lib/wallet-utils'
import { calculateImpressionBonus } from '@/lib/social-jobs'

// ==================== TYPES ====================

type Job = Database['public']['Tables']['jobs']['Row']
type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

interface SubmissionReviewCardProps {
  submission: JobSubmission
  job: Job
  isSelected: boolean
  onSelect: (id: string, selected: boolean) => void
  onApprove: (submissionId: string, impressions: number) => void
  onReject: (submissionId: string) => void
  onImpressionChange?: (submissionId: string, impressions: number) => void
  index?: number // Optional for display numbering
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Format follower count to readable string
 */
function formatFollowerRange(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(0)}K`
  }
  return count.toString()
}

/**
 * Get follower range display based on count
 */
function getFollowerRangeDisplay(followerCount: number): string {
  if (followerCount >= 100000) return '100K+'
  if (followerCount >= 20000) return '20K-100K'
  if (followerCount >= 5000) return '5K-20K'
  if (followerCount >= 1000) return '1K-5K'
  if (followerCount >= 500) return '500-1K'
  return '<500' // Below minimum
}

// ==================== COMPONENT ====================

export default function SubmissionReviewCard({
  submission,
  job,
  isSelected,
  onSelect,
  onApprove,
  onReject,
  onImpressionChange,
  index
}: SubmissionReviewCardProps) {
  // ==================== STATE ====================
  
  const [impressions, setImpressions] = useState<string>('')
  const [bonusAmount, setBonusAmount] = useState<number>(0)
  const [totalPayment, setTotalPayment] = useState<number>(
    submission.social_payment_amount_usd || 0
  )
  const [loading, setLoading] = useState(false)

  // ==================== COMPUTED VALUES ====================

  const basePayment = submission.social_payment_amount_usd || 0
  const followerCount = submission.social_follower_count_verified || submission.social_follower_count || 0
  const followerRange = getFollowerRangeDisplay(followerCount)
  const tweetUrl = submission.social_tweet_url || ''
  const submittedAt = submission.submitted_at ? new Date(submission.submitted_at) : new Date()
  const timeAgo = formatDistanceToNow(submittedAt, { addSuffix: true })
  const enableBonuses = job.social_enable_impression_bonuses || false

  // ==================== HANDLERS ====================

  /**
   * Handle impression input change and calculate bonus in real-time
   */
  const handleImpressionChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setImpressions(value)
    
    const count = parseInt(value) || 0
    const bonus = count > 0 ? calculateImpressionBonus(count) : 0
    setBonusAmount(bonus)
    setTotalPayment(basePayment + bonus)
    
    // Notify parent of impression change
    if (onImpressionChange) {
      onImpressionChange(submission.id, count)
    }
  }

  /**
   * Handle checkbox selection toggle
   */
  const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    onSelect(submission.id, e.target.checked)
  }

  /**
   * Handle approve button click
   */
  const handleApprove = async () => {
    setLoading(true)
    try {
      const impressionCount = parseInt(impressions) || 0
      await onApprove(submission.id, impressionCount)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle reject button click
   */
  const handleReject = async () => {
    setLoading(true)
    try {
      await onReject(submission.id)
    } finally {
      setLoading(false)
    }
  }

  // ==================== RENDER ====================

  const statusColor = 
    submission.social_approval_status === 'approved' || submission.social_approval_status === 'auto_approved' 
      ? 'success' 
      : submission.social_approval_status === 'denied'
      ? 'error'
      : 'default'

  const statusLabel = 
    submission.social_approval_status === 'approved' 
      ? 'Approved' 
      : submission.social_approval_status === 'auto_approved'
      ? 'Auto-Approved'
      : submission.social_approval_status === 'denied'
      ? 'Rejected'
      : 'Pending'

  return (
    <Paper
      sx={{
        border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-card-md)',
        p: 'var(--space-md)',
        mb: 'var(--space-md)',
        background: isSelected ? 'rgba(139, 92, 246, 0.05)' : 'var(--card-background)',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-default)',
          boxShadow: 'var(--shadow-card)'
        }
      }}
    >
      {/* ==================== HEADER WITH CHECKBOX ==================== */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', mb: 'var(--space-sm)' }}>
        <Checkbox
          checked={isSelected}
          onChange={handleCheckboxChange}
          disabled={submission.social_approval_status !== 'pending'}
          sx={{
            color: 'var(--accent-primary)',
            '&.Mui-checked': {
              color: 'var(--accent-primary)'
            }
          }}
        />
        <Typography variant="h3" className="text-subheading" sx={{ fontWeight: 'var(--weight-semibold)' }}>
          Submission {index !== undefined ? `#${index + 1}` : ''}
        </Typography>
        <Chip 
          label={statusLabel} 
          color={statusColor} 
          size="small"
          sx={{ ml: 'auto', fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)' }}
        />
      </Box>

      {/* ==================== SUBMISSION DETAILS ==================== */}
      <Box sx={{ ml: 'var(--space-xl)', mb: 'var(--space-md)' }}>
        {/* Wallet Address */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', mb: 'var(--space-xs)' }}>
          <Typography variant="body2" className="text-body-small" sx={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-secondary)' }}>
            Wallet:
          </Typography>
          <Typography variant="body2" className="text-body-small" sx={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
            {truncateWalletAddress(submission.worker_wallet)}
          </Typography>
        </Box>

        {/* Follower Range */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', mb: 'var(--space-xs)' }}>
          <Typography variant="body2" className="text-body-small" sx={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-secondary)' }}>
            Follower range:
          </Typography>
          <Typography variant="body2" className="text-body-small" sx={{ color: 'var(--text-primary)' }}>
            {followerRange} ({formatFollowerRange(followerCount)} followers)
          </Typography>
        </Box>

        {/* Base Payment */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', mb: 'var(--space-xs)' }}>
          <Typography variant="body2" className="text-body-small" sx={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-secondary)' }}>
            Base Payment:
          </Typography>
          <Typography variant="body2" className="text-body-small" sx={{ color: 'var(--accent-success)', fontWeight: 'var(--weight-bold)' }}>
            ${basePayment.toFixed(2)}
          </Typography>
        </Box>

        {/* Tweet Link */}
        {tweetUrl && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', mb: 'var(--space-xs)' }}>
            <Typography variant="body2" className="text-body-small" sx={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-secondary)' }}>
              Tweet:
            </Typography>
            <Link
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-xs)',
                color: 'var(--accent-primary)',
                fontSize: 'var(--text-sm)',
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline'
                }
              }}
            >
              {tweetUrl.substring(0, 40)}...
              <OpenInNewIcon sx={{ fontSize: 'var(--icon-xs)' }} />
            </Link>
          </Box>
        )}

        {/* Submitted Time */}
        <Typography variant="body2" className="text-body-small" sx={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          Submitted {timeAgo}
        </Typography>
      </Box>

      {/* ==================== IMPRESSION INPUT (if enabled) ==================== */}
      {enableBonuses && submission.social_approval_status === 'pending' && (
        <Box 
          sx={{ 
            ml: 'var(--space-xl)', 
            mb: 'var(--space-md)',
            p: 'var(--space-sm)',
            background: 'rgba(139, 92, 246, 0.05)',
            borderRadius: 'var(--radius-sm)',
            border: '1px dashed var(--accent-primary-soft)'
          }}
        >
          <Typography 
            variant="body2" 
            className="text-body-small" 
            sx={{ 
              fontWeight: 'var(--weight-medium)', 
              mb: 'var(--space-xs)',
              color: 'var(--accent-primary)'
            }}
          >
            Add impressions (optional):
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <TextField
              type="number"
              value={impressions}
              onChange={handleImpressionChange}
              placeholder="0"
              size="small"
              sx={{
                width: '200px',
                '& .MuiOutlinedInput-root': {
                  background: 'var(--card-background)',
                  fontFamily: 'var(--font-body)'
                }
              }}
              inputProps={{
                min: 0,
                step: 1000
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <Typography variant="body2" className="text-body-small" sx={{ color: 'var(--text-secondary)' }}>
                → Bonus:
              </Typography>
              <Typography 
                variant="body2" 
                className="text-body-small" 
                sx={{ 
                  color: bonusAmount > 0 ? 'var(--accent-success)' : 'var(--text-tertiary)',
                  fontWeight: bonusAmount > 0 ? 'var(--weight-bold)' : 'var(--weight-regular)'
                }}
              >
                ${bonusAmount.toFixed(2)}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* ==================== ACTION BUTTONS ==================== */}
      {submission.social_approval_status === 'pending' && (
        <Box 
          sx={{ 
            ml: 'var(--space-xl)',
            display: 'flex', 
            gap: 'var(--space-md)',
            flexWrap: 'wrap',
            '@media (max-width: 600px)': {
              flexDirection: 'column'
            }
          }}
        >
          <Button
            variant="contained"
            onClick={handleApprove}
            disabled={loading}
            sx={{
              bgcolor: 'var(--accent-success)',
              color: 'white',
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--weight-semibold)',
              textTransform: 'none',
              borderRadius: 'var(--radius-button)',
              px: 'var(--space-lg)',
              '&:hover': {
                bgcolor: 'darkgreen'
              },
              '&:disabled': {
                bgcolor: 'var(--border-subtle)',
                color: 'var(--text-tertiary)'
              }
            }}
          >
            {bonusAmount > 0 
              ? `Approve & Pay $${totalPayment.toFixed(2)} (+ $${bonusAmount.toFixed(2)} bonus)`
              : `Approve & Pay $${totalPayment.toFixed(2)}`
            }
          </Button>

          <Button
            variant="outlined"
            onClick={handleReject}
            disabled={loading}
            sx={{
              borderColor: 'var(--accent-error, #EF4444)',
              color: 'var(--accent-error, #EF4444)',
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--weight-semibold)',
              textTransform: 'none',
              borderRadius: 'var(--radius-button)',
              px: 'var(--space-lg)',
              '&:hover': {
                borderColor: 'darkred',
                bgcolor: 'rgba(220, 38, 38, 0.1)'
              },
              '&:disabled': {
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-tertiary)'
              }
            }}
          >
            Reject
          </Button>
        </Box>
      )}

      {/* ==================== APPROVED/REJECTED STATE ==================== */}
      {submission.social_approval_status !== 'pending' && (
        <Box sx={{ ml: 'var(--space-xl)', p: 'var(--space-sm)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
          <Typography variant="body2" className="text-body-small" sx={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            {submission.social_approval_status === 'denied' 
              ? 'This submission has been rejected'
              : `This submission has been ${statusLabel.toLowerCase()} and paid`
            }
          </Typography>
        </Box>
      )}
    </Paper>
  )
}

