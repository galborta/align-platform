'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
  Alert,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Chip
} from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import { BudgetTier } from '@/types/social-media-jobs'
import { 
  calculateActiveTier, 
  calculateProportionalPayments,
  calculateRefundAmount 
} from '@/lib/social-media-jobs'
import SubmissionReviewCard from './SubmissionReviewCard'

// ==================== TYPES ====================

interface Submission {
  id: string
  worker_wallet: string
  social_tweet_link: string
  social_follower_count: number
  social_follower_count_verified: number
  social_approval_status: 'pending' | 'approved' | 'denied' | 'auto_approved'
  social_denial_reason: string | null
  submitted_at: string
}

interface PosterReviewDashboardProps {
  job: {
    id: string
    title: string
    poster_wallet: string
    social_review_deadline: string
    social_total_budget_tokens: number
    social_total_budget_usd: number
    social_budget_tiers: BudgetTier[]
    fee_percentage_at_creation: number
    escrow_token_mint: string
  }
  submissions: Submission[]
  currentUserWallet: string
}

// ==================== COMPONENT ====================

export default function PosterReviewDashboard({
  job,
  submissions,
  currentUserWallet
}: PosterReviewDashboardProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all')
  const [sortBy, setSortBy] = useState<'most_followers' | 'least_followers' | 'newest' | 'oldest'>('most_followers')
  const [finalizingLoading, setFinalizingLoading] = useState(false)
  
  // Check if user is poster
  const isPoster = currentUserWallet === job.poster_wallet
  
  if (!isPoster) {
    return (
      <Alert severity="error">
        Only the campaign poster can access this review dashboard.
      </Alert>
    )
  }

  // Calculate review deadline status
  const reviewDeadline = new Date(job.social_review_deadline)
  const now = new Date()
  const timeRemaining = reviewDeadline > now 
    ? formatDistanceToNow(reviewDeadline, { addSuffix: true }).replace('in ', '')
    : 'Expired'
  const isExpired = reviewDeadline <= now

  // Filter submissions
  const filteredSubmissions = submissions.filter(sub => {
    if (filter === 'all') return true
    return sub.social_approval_status === filter
  })

  // Sort submissions
  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    switch (sortBy) {
      case 'most_followers':
        return b.social_follower_count_verified - a.social_follower_count_verified
      case 'least_followers':
        return a.social_follower_count_verified - b.social_follower_count_verified
      case 'newest':
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      case 'oldest':
        return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
      default:
        return 0
    }
  })

  // Calculate stats
  const pendingCount = submissions.filter(s => s.social_approval_status === 'pending').length
  const approvedCount = submissions.filter(s => s.social_approval_status === 'approved').length
  const deniedCount = submissions.filter(s => s.social_approval_status === 'denied').length

  // Get approved submissions (including auto_approved)
  const approvedSubmissions = submissions.filter(
    s => s.social_approval_status === 'approved' || s.social_approval_status === 'auto_approved'
  )

  // Calculate active tier based on approved count
  const activeTier = calculateActiveTier(job.social_budget_tiers, approvedSubmissions.length)

  // Calculate total reported and verified followers
  const totalReportedFollowers = submissions.reduce(
    (sum, s) => sum + s.social_follower_count, 
    0
  )
  const totalVerifiedFollowers = approvedSubmissions.reduce(
    (sum, s) => sum + s.social_follower_count_verified, 
    0
  )

  // Calculate proportional payments if we have approved submissions
  let paymentPreview: any[] = []
  let tierBudget = 0
  let tierBudgetUsd = 0
  let platformFee = 0
  let refundAmount = 0

  if (activeTier && approvedSubmissions.length > 0) {
    tierBudget = activeTier.budget_tokens
    tierBudgetUsd = activeTier.budget_usd
    platformFee = tierBudget * (job.fee_percentage_at_creation || 0.05)
    
    // Calculate refund
    const refundCalc = calculateRefundAmount(
      job.social_total_budget_tokens,
      tierBudget,
      job.fee_percentage_at_creation || 0.05
    )
    refundAmount = refundCalc.totalRefund
    
    // Calculate payments
    try {
      paymentPreview = calculateProportionalPayments(
        approvedSubmissions.map(s => ({
          id: s.id,
          worker_wallet: s.worker_wallet,
          social_follower_count_verified: s.social_follower_count_verified
        })),
        tierBudget,
        tierBudgetUsd
      )
    } catch (error) {
      console.error('Payment calculation error:', error)
    }
  }

  // ==================== HANDLERS ====================

  const handleApproveSubmission = async (submissionId: string) => {
    try {
      const response = await fetch(`/api/jobs/${job.id}/review-submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          action: 'approve'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to approve submission')
      }

      // Refresh page to show updated status
      window.location.reload()
    } catch (error) {
      console.error('Error approving submission:', error)
      alert('Failed to approve submission. Please try again.')
    }
  }

  const handleDenySubmission = async (submissionId: string) => {
    // Denial is handled by the DenySubmissionModal
    // This just triggers a refresh
    window.location.reload()
  }

  const handleFinalize = async () => {
    if (!window.confirm(
      `Are you sure you want to finalize this campaign and distribute ${tierBudget.toFixed(0)} tokens to ${approvedCount} participant${approvedCount !== 1 ? 's' : ''}? This cannot be undone.`
    )) {
      return
    }

    setFinalizingLoading(true)

    try {
      const response = await fetch(`/api/jobs/${job.id}/finalize-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poster_wallet: currentUserWallet
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to finalize campaign')
      }

      alert('Campaign finalized! Payments are being distributed.')
      window.location.reload()
      
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setFinalizingLoading(false)
    }
  }

  return (
    <Box>
      {/* Header with deadline warning */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: '#1a1a1a', border: '1px solid #333' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          📱 Review Campaign Submissions
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          {job.title}
        </Typography>

        {!isExpired ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            ⏰ Review Deadline: {timeRemaining} remaining
            <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
              If no action taken, all pending submissions will be auto-approved and payments distributed automatically.
            </Typography>
          </Alert>
        ) : (
          <Alert severity="error" sx={{ mb: 2 }}>
            Review deadline has passed. Auto-approval in progress.
          </Alert>
        )}
      </Paper>

      {/* Campaign Summary */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: '#1a1a1a', border: '1px solid #333' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Campaign Summary
        </Typography>
        
        <Divider sx={{ mb: 2, bgcolor: '#333' }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          {/* Left column */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Maximum Budget
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {job.social_total_budget_tokens.toFixed(0)} tokens (~${job.social_total_budget_usd.toFixed(0)})
            </Typography>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Budget Tiers
            </Typography>
            {job.social_budget_tiers.map((tier, index) => (
              <Typography 
                key={index}
                variant="body2" 
                color="text.secondary"
                sx={{ 
                  ml: 1, 
                  mb: 0.5,
                  fontWeight: activeTier === tier ? 600 : 400,
                  color: activeTier === tier ? '#E3F06F' : 'text.secondary'
                }}
              >
                • {tier.min_participants}-{tier.max_participants || '∞'}: {tier.budget_tokens} tokens
                {activeTier === tier && ' ← Active'}
              </Typography>
            ))}
          </Box>

          {/* Right column */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Current Participants
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {submissions.length} total ({pendingCount} pending, {approvedCount} approved, {deniedCount} denied)
            </Typography>

            {activeTier && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Active Tier
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {activeTier.min_participants}-{activeTier.max_participants || '∞'} participants
                </Typography>

                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Budget to Release
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {tierBudget.toFixed(0)} tokens (~${tierBudgetUsd.toFixed(0)})
                </Typography>

                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Platform Fee (5%)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {platformFee.toFixed(0)} tokens
                </Typography>

                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Expected Refund
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {refundAmount.toFixed(0)} tokens (~${(refundAmount * (tierBudgetUsd / tierBudget)).toFixed(0)})
                </Typography>
              </>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2, bgcolor: '#333' }} />

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Total Reported Followers: {totalReportedFollowers.toLocaleString()}
          </Typography>
          <Typography variant="subtitle2">
            Adjusted Followers: {totalVerifiedFollowers.toLocaleString()}
          </Typography>
        </Box>
      </Paper>

      {/* Filter and sort controls */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#1a1a1a', border: '1px solid #333' }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Filter</InputLabel>
            <Select
              value={filter}
              label="Filter"
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <MenuItem value="all">All ({submissions.length})</MenuItem>
              <MenuItem value="pending">Pending ({pendingCount})</MenuItem>
              <MenuItem value="approved">Approved ({approvedCount})</MenuItem>
              <MenuItem value="denied">Denied ({deniedCount})</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortBy}
              label="Sort By"
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <MenuItem value="most_followers">Most Followers</MenuItem>
              <MenuItem value="least_followers">Least Followers</MenuItem>
              <MenuItem value="newest">Newest First</MenuItem>
              <MenuItem value="oldest">Oldest First</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
            <Chip label={`${pendingCount} pending`} color="warning" size="small" />
            <Chip label={`${approvedCount} approved`} color="success" size="small" />
            <Chip label={`${deniedCount} denied`} color="error" size="small" />
          </Box>
        </Box>
      </Paper>

      {/* Submissions List */}
      <Box sx={{ mb: 3 }}>
        {sortedSubmissions.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#1a1a1a', border: '1px solid #333' }}>
            <Typography variant="body1" color="text.secondary">
              {filter === 'all' 
                ? 'No submissions yet'
                : `No ${filter} submissions`}
            </Typography>
          </Paper>
        ) : (
          sortedSubmissions.map((submission) => {
            // Find payment estimate for this submission
            const payment = paymentPreview.find(p => p.submission_id === submission.id)
            
            return (
              <SubmissionReviewCard
                key={submission.id}
                submission={submission}
                estimatedPayment={payment || null}
                jobId={job.id}
                onApprove={async () => {
                  // Will implement API call
                  await handleApproveSubmission(submission.id)
                }}
                onDeny={async () => {
                  // Will implement API call
                  await handleDenySubmission(submission.id)
                }}
                onAdjustFollowers={() => {
                  // Refresh data after follower adjustment
                  window.location.reload()
                }}
              />
            )
          })
        )}
      </Box>

      {/* Finalize Campaign Button */}
      {approvedCount > 0 && !isExpired && (
        <Paper sx={{ p: 3, bgcolor: '#1a1a1a', border: '1px solid #333' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Ready to Finalize?
          </Typography>

          <Alert severity="info" sx={{ mb: 2 }}>
            Once you finalize, payments will be distributed to all approved participants 
            based on their follower counts. This action cannot be undone.
          </Alert>

          {pendingCount > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              ⚠️ You still have {pendingCount} pending submission{pendingCount !== 1 ? 's' : ''}. 
              These will NOT receive payment unless you approve them first.
            </Alert>
          )}

          <Box sx={{ p: 2, bgcolor: 'rgba(124, 77, 255, 0.1)', borderRadius: 1, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Payment Breakdown:
            </Typography>
            {paymentPreview.slice(0, 5).map((payment, index) => (
              <Typography key={index} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                • {payment.worker_wallet.slice(0, 8)}...{payment.worker_wallet.slice(-6)}: {' '}
                {payment.payment_amount_tokens.toFixed(2)} tokens ({payment.percentage_of_total.toFixed(1)}%)
              </Typography>
            ))}
            {paymentPreview.length > 5 && (
              <Typography variant="body2" color="text.secondary">
                ... and {paymentPreview.length - 5} more
              </Typography>
            )}

            <Divider sx={{ my: 1, bgcolor: '#333' }} />

            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Total to distribute: {tierBudget.toFixed(0)} tokens (~${tierBudgetUsd.toFixed(0)})
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Platform fee: {platformFee.toFixed(0)} tokens
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Refund to you: {refundAmount.toFixed(0)} tokens
            </Typography>
          </Box>

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleFinalize}
            disabled={finalizingLoading}
            sx={{
              bgcolor: '#4CAF50',
              py: 2,
              fontSize: '1.1rem',
              '&:hover': { bgcolor: '#45a049' }
            }}
          >
            {finalizingLoading ? 'Processing...' : 'Finalize Campaign & Distribute Payments'}
          </Button>
        </Paper>
      )}
    </Box>
  )
}

