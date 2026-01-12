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
import { toast } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

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
  social_payment_amount_tokens: number | null
  social_payment_amount_usd: number | null
  social_payment_tx_signature: string | null
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
  tokenSymbol?: string
}

// ==================== COMPONENT ====================

export default function PosterReviewDashboard({
  job,
  submissions,
  currentUserWallet,
  tokenSymbol = 'NUB'
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

  const handleApproveSubmission = async (submissionId: string, impressionCount: number = 0) => {
    try {
      // Get Supabase session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        toast.error('Authentication required. Please sign in again.')
        return
      }
      
      const response = await fetch(`/api/jobs/${job.id}/review-submission`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          submission_id: submissionId,
          action: 'approve',
          poster_wallet: currentUserWallet,
          impression_count: impressionCount
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
    // Count approved submissions (including auto_approved)
    const totalApproved = submissions.filter(
      s => s.social_approval_status === 'approved' || s.social_approval_status === 'auto_approved'
    ).length

    if (!window.confirm(
      `Are you sure you want to finalize this campaign?\n\n` +
      `• Participants: ${totalApproved}\n` +
      `• Budget to distribute: ${tierBudget.toFixed(0)} tokens (~$${tierBudgetUsd.toFixed(0)})\n` +
      `• Platform fee: ${platformFee.toFixed(0)} tokens\n` +
      `• Refund to you: ${refundAmount.toFixed(0)} tokens\n\n` +
      `This action cannot be undone.`
    )) {
      return
    }

    setFinalizingLoading(true)

    try {
      // Get Supabase session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        toast.error('Authentication required. Please sign in again.')
        setProcessingPayouts(false)
        return
      }
      
      // Call finalize-payments API (server-side signing)
      const response = await fetch(`/api/jobs/${job.id}/finalize-payments`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          poster_wallet: currentUserWallet
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to finalize campaign')
      }

      // Extract response data
      const { data } = result
      const txSignature = data?.transaction_signature || 'N/A'
      const participantCount = data?.participant_count || totalApproved
      const totalDistributed = data?.active_tier?.budget_tokens || tierBudget
      const refund = data?.refund_to_poster || refundAmount

      // Show success message with details
      alert(
        `✅ Campaign Finalized Successfully!\n\n` +
        `• Workers paid: ${participantCount}\n` +
        `• Tokens distributed: ${totalDistributed.toFixed(0)}\n` +
        `• Platform fee: ${(data?.platform_fee || platformFee).toFixed(0)}\n` +
        `• Refunded to you: ${refund.toFixed(0)}\n\n` +
        `Transaction: ${txSignature.slice(0, 20)}...${txSignature.slice(-8)}\n\n` +
        `View on Solana Explorer:\nhttps://explorer.solana.com/tx/${txSignature}`
      )

      // Refresh to show completed status
      window.location.reload()
      
    } catch (error: any) {
      console.error('Finalize error:', error)
      
      // Show detailed error message
      alert(
        `❌ Error Finalizing Campaign\n\n` +
        `${error.message}\n\n` +
        `If you believe the payment was sent, check the Solana Explorer and contact support.`
      )
    } finally {
      setFinalizingLoading(false)
    }
  }

  return (
    <Box>
      {/* Compact Header with deadline and stats */}
      <Paper 
        sx={{ 
          p: 'var(--space-lg, 24px)', 
          mb: 3, 
          bgcolor: 'var(--card-background, #FFFFFF)',
          borderRadius: 'var(--radius-card-lg, 24px)',
          boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))',
          border: 'none'
        }}
      >
        <Typography 
          variant="h5" 
          sx={{ 
            mb: 2,
            fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
            fontWeight: 600,
            color: 'var(--text-primary, #1A1A1E)'
          }}
        >
          📱 Review Campaign Submissions
        </Typography>

        {/* Stats Bar */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Chip 
            label={`⏰ ${timeRemaining} remaining`} 
            sx={{ 
              bgcolor: isExpired ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 200, 87, 0.1)',
              color: isExpired ? 'var(--accent-error, #EF4444)' : 'var(--accent-warning, #FFC857)',
              fontWeight: 600,
              border: isExpired ? '1px solid var(--accent-error, #EF4444)' : '1px solid var(--accent-warning, #FFC857)'
            }} 
          />
          <Chip 
            label={`${pendingCount} pending`} 
            size="small"
            sx={{
              bgcolor: 'rgba(255, 200, 87, 0.15)',
              color: 'var(--accent-warning, #FFC857)',
              fontWeight: 600,
              border: '1px solid var(--accent-warning, #FFC857)'
            }}
          />
          <Chip 
            label={`${approvedCount} approved`} 
            size="small"
            sx={{
              bgcolor: 'rgba(54, 193, 112, 0.15)',
              color: 'var(--accent-success, #36C170)',
              fontWeight: 600,
              border: '1px solid var(--accent-success, #36C170)'
            }}
          />
          {deniedCount > 0 && (
            <Chip 
              label={`${deniedCount} denied`} 
              size="small"
              sx={{
                bgcolor: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--accent-error, #EF4444)',
                fontWeight: 600,
                border: '1px solid var(--accent-error, #EF4444)'
              }}
            />
          )}
          {activeTier && (
            <Chip 
              label={`Tier ${job.social_budget_tiers.indexOf(activeTier) + 1} Active`}
              sx={{ 
                bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
                color: 'var(--accent-primary, #7C4DFF)',
                fontWeight: 600
              }}
            />
          )}
        </Box>

        {!isExpired ? (
          <Alert 
            severity="info" 
            sx={{ 
              mb: 0,
              borderRadius: '12px',
              bgcolor: 'rgba(124, 77, 255, 0.08)',
              border: '1px solid var(--accent-primary, #7C4DFF)',
              '& .MuiAlert-icon': {
                color: 'var(--accent-primary, #7C4DFF)'
              }
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              If no action is taken, pending submissions will be auto-approved when the deadline passes.
            </Typography>
          </Alert>
        ) : (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 0,
              borderRadius: '12px',
              bgcolor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--accent-error, #EF4444)'
            }}
          >
            Review deadline has passed. Auto-approval in progress.
          </Alert>
        )}
      </Paper>

      {/* Filter and sort controls */}
      <Paper 
        sx={{ 
          p: 'var(--space-md, 16px)', 
          mb: 3, 
          bgcolor: 'var(--card-background, #FFFFFF)',
          borderRadius: 'var(--radius-card-lg, 24px)',
          boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))',
          border: 'none'
        }}
      >
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
            <Chip 
              label={`${pendingCount} pending`} 
              size="small"
              sx={{
                bgcolor: 'rgba(255, 200, 87, 0.15)',
                color: 'var(--accent-warning, #FFC857)',
                fontWeight: 600,
                border: '1px solid var(--accent-warning, #FFC857)'
              }}
            />
            <Chip 
              label={`${approvedCount} approved`} 
              size="small"
              sx={{
                bgcolor: 'rgba(54, 193, 112, 0.15)',
                color: 'var(--accent-success, #36C170)',
                fontWeight: 600,
                border: '1px solid var(--accent-success, #36C170)'
              }}
            />
            <Chip 
              label={`${deniedCount} denied`} 
              size="small"
              sx={{
                bgcolor: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--accent-error, #EF4444)',
                fontWeight: 600,
                border: '1px solid var(--accent-error, #EF4444)'
              }}
            />
          </Box>
        </Box>
      </Paper>

      {/* Submissions List */}
      <Box sx={{ mb: 3 }}>
        {sortedSubmissions.length === 0 ? (
          <Paper 
            sx={{ 
              p: 4, 
              textAlign: 'center', 
              bgcolor: 'var(--card-background, #FFFFFF)',
              borderRadius: 'var(--radius-card-lg, 24px)',
              boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))',
              border: 'none'
            }}
          >
            <Typography 
              variant="body1" 
              sx={{ color: 'var(--text-secondary, #6F7280)' }}
            >
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
                posterWallet={currentUserWallet}
                tokenSymbol={tokenSymbol}
                onApprove={async (impressionCount: number) => {
                  // Will implement API call
                  await handleApproveSubmission(submission.id, impressionCount)
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
        <Paper 
          sx={{ 
            p: 'var(--space-lg, 24px)', 
            bgcolor: 'var(--card-background, #FFFFFF)',
            borderRadius: 'var(--radius-card-lg, 24px)',
            boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))',
            border: 'none'
          }}
        >
          <Typography 
            variant="h6" 
            sx={{ 
              mb: 2,
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)'
            }}
          >
            Ready to Finalize?
          </Typography>

          <Alert 
            severity="info" 
            sx={{ 
              mb: 2,
              borderRadius: '12px',
              bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
              border: '1px solid var(--accent-primary, #7C4DFF)',
              '& .MuiAlert-icon': {
                color: 'var(--accent-primary, #7C4DFF)'
              }
            }}
          >
            Once you finalize, payments will be distributed to all approved participants 
            based on their follower counts. This action cannot be undone.
          </Alert>

          {pendingCount > 0 && (
            <Alert 
              severity="warning" 
              sx={{ 
                mb: 2,
                borderRadius: '12px',
                bgcolor: 'rgba(255, 200, 87, 0.1)',
                border: '1px solid var(--accent-warning, #FFC857)'
              }}
            >
              ⚠️ You still have {pendingCount} pending submission{pendingCount !== 1 ? 's' : ''}. 
              These will NOT receive payment unless you approve them first.
            </Alert>
          )}

          <Box 
            sx={{ 
              p: 'var(--space-md, 16px)', 
              bgcolor: 'var(--accent-primary-soft, #EEE7FF)', 
              borderRadius: '12px', 
              mb: 2 
            }}
          >
            <Typography 
              variant="subtitle2" 
              sx={{ 
                mb: 1,
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                fontSize: '14px'
              }}
            >
              Payment Breakdown:
            </Typography>
            {paymentPreview.slice(0, 5).map((payment, index) => (
              <Typography 
                key={index} 
                variant="body2" 
                sx={{ 
                  mb: 0.5,
                  color: 'var(--text-secondary, #6F7280)',
                  fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                  fontSize: '13px'
                }}
              >
                • {payment.worker_wallet.slice(0, 8)}...{payment.worker_wallet.slice(-6)}: {' '}
                {payment.payment_amount_tokens.toFixed(2)} tokens ({payment.percentage_of_total.toFixed(1)}%)
              </Typography>
            ))}
            {paymentPreview.length > 5 && (
              <Typography 
                variant="body2" 
                sx={{ color: 'var(--text-secondary, #6F7280)' }}
              >
                ... and {paymentPreview.length - 5} more
              </Typography>
            )}

            <Divider sx={{ my: 1, bgcolor: 'var(--accent-primary, #7C4DFF)', opacity: 0.2 }} />

            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              Total to distribute: {tierBudget.toFixed(0)} tokens (~${tierBudgetUsd.toFixed(0)})
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ color: 'var(--text-secondary, #6F7280)' }}
            >
              Platform fee: {platformFee.toFixed(0)} tokens
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ color: 'var(--text-secondary, #6F7280)' }}
            >
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
              bgcolor: 'var(--accent-success, #36C170)',
              color: '#FFFFFF',
              py: 2,
              fontSize: '1.1rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-control, 999px)',
              textTransform: 'none',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              boxShadow: '0 8px 20px 0 rgba(54, 193, 112, 0.25)',
              '&:hover': { 
                bgcolor: 'var(--accent-success-hover, #2DA85E)',
                boxShadow: '0 12px 28px 0 rgba(54, 193, 112, 0.35)'
              },
              '&:disabled': {
                bgcolor: 'var(--text-muted, #A3A7B5)',
                color: '#FFFFFF'
              }
            }}
          >
            {finalizingLoading ? 'Processing...' : 'Finalize Campaign & Distribute Payments'}
          </Button>
        </Paper>
      )}
    </Box>
  )
}

