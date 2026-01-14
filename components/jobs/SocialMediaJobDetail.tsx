'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  Button,
  Alert,
  Link as MuiLink,
  LinearProgress,
  CircularProgress,
  Tooltip,
  IconButton,
  Checkbox
} from '@mui/material'
import { Database } from '@/types/database'
import { useWallet } from '@solana/wallet-adapter-react'
import { format, formatDistanceToNow } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import bs58 from 'bs58'

// Icons
import CampaignIcon from '@mui/icons-material/Campaign'
import RepeatIcon from '@mui/icons-material/Repeat'
import CreateIcon from '@mui/icons-material/Create'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PeopleIcon from '@mui/icons-material/People'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import LockIcon from '@mui/icons-material/Lock'
import MoneyIcon from '@mui/icons-material/AttachMoney'
import WarningIcon from '@mui/icons-material/Warning'
import RefreshIcon from '@mui/icons-material/Refresh'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import EditIcon from '@mui/icons-material/Edit'
import CancelIcon from '@mui/icons-material/Cancel'

// Follower tier utilities
import { 
  FollowerTier,
  calculateFollowerTier,
  formatFollowerTierRange,
  formatTierDisplay 
} from '@/lib/social-media-jobs-follower-tiers'

// Submission modal
import SubmissionModal from './social/SubmissionModal'

// Poster review dashboard
import PosterReviewDashboard from './PosterReviewDashboard'

// Campaign management modal
import CampaignManagementModal from './CampaignManagementModal'

// Display name hook
import { usePosterDisplayName } from '@/lib/usePosterDisplayName'

type Job = Database['public']['Tables']['jobs']['Row']
type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

interface SocialMediaJobDetailProps {
  job: Job
  projectName?: string
  tokenSymbol?: string
  onSubmissionSuccess?: () => void
  onEditClick?: () => void
  onExtendDeadlineClick?: () => void
  onCancelClick?: () => void
}

export default function SocialMediaJobDetail({
  job: initialJob,
  projectName,
  tokenSymbol = 'tokens',
  onSubmissionSuccess,
  onEditClick,
  onExtendDeadlineClick,
  onCancelClick
}: SocialMediaJobDetailProps) {
  const { publicKey, signMessage: walletSignMessage } = useWallet()
  const { displayNameOrWallet, hasDisplayName } = usePosterDisplayName(initialJob.poster_wallet)
  
  // Job state (can be updated via real-time)
  const [job, setJob] = useState<Job>(initialJob)
  
  // Campaign management modal state
  const [showManagementModal, setShowManagementModal] = useState(false)
  
  // Wrapper for signing messages
  const signMessage = async (message: string): Promise<string> => {
    if (!walletSignMessage) {
      throw new Error('Wallet does not support message signing')
    }
    const encodedMessage = new TextEncoder().encode(message)
    const signatureUint8 = await walletSignMessage(encodedMessage)
    // Return base58-encoded signature (expected by backend)
    return bs58.encode(signatureUint8)
  }
  
  const [submissionCount, setSubmissionCount] = useState(0)
  const [userSubmission, setUserSubmission] = useState<JobSubmission | null>(null)
  const [allSubmissions, setAllSubmissions] = useState<JobSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  
  // Pagination state for submissions list
  const [currentOffset, setCurrentOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreSubmissions, setHasMoreSubmissions] = useState(true)
  const SUBMISSIONS_PER_PAGE = 50
  
  // User's follower tier (calculated if wallet connected)
  const [userFollowerTier, setUserFollowerTier] = useState<FollowerTier | null>(null)
  
  // Parse follower tiers from JSON (NEW SYSTEM)
  // Memoized to prevent infinite re-renders when used in useEffect dependency array
  const followerTiers: FollowerTier[] = useMemo(() => {
    return Array.isArray(job.social_follower_tiers)
      ? (job.social_follower_tiers as FollowerTier[])
      : []
  }, [job.social_follower_tiers])
  
  const usesInstantPayment = job.uses_instant_payment === true

  // Parse deadlines
  const now = new Date()
  const submissionDeadline = job.social_submission_deadline ? new Date(job.social_submission_deadline) : new Date()
  const engagementDeadline = job.social_engagement_deadline ? new Date(job.social_engagement_deadline) : new Date()
  const reviewDeadline = job.social_review_deadline ? new Date(job.social_review_deadline) : new Date()

  // Campaign phase
  const getCampaignPhase = (): 'open' | 'engagement' | 'review' | 'completed' | 'cancelled' => {
    if (job.status === 'cancelled') return 'cancelled'
    if (job.social_payments_distributed) return 'completed'

    if (now < submissionDeadline) return 'open'
    if (now < engagementDeadline) return 'engagement'
    if (now < reviewDeadline) return 'review'
    return 'completed'
  }

  const campaignPhase = getCampaignPhase()
  const isPoster = publicKey && job.poster_wallet === publicKey.toString()
  const canSubmit = campaignPhase === 'open' && !userSubmission && publicKey && !isPoster

  // ==================== REAL-TIME SUBSCRIPTION ====================
  
  useEffect(() => {
    if (!usesInstantPayment) return

    console.log(`[JobDetail] Setting up real-time subscription for job ${job.id}`)

    const jobChannel = supabase
      .channel(`job-${job.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: `id=eq.${job.id}`
      }, (payload) => {
        console.log('[JobDetail] Received real-time job update:', payload.new)
        setJob(payload.new as Job)
      })
      .subscribe()

    // Subscribe to submission updates if user has a wallet
    let submissionChannel: ReturnType<typeof supabase.channel> | null = null
    if (publicKey) {
      submissionChannel = supabase
        .channel(`job-submissions-${job.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'job_submissions',
          filter: `job_id=eq.${job.id}`
        }, (payload) => {
          console.log('[JobDetail] Received real-time submission update:', payload)
          
          // Update user's submission if it's their wallet
          if (payload.new && 'worker_wallet' in payload.new && payload.new.worker_wallet === publicKey.toString()) {
            console.log('[JobDetail] Updating user submission:', payload.new)
            setUserSubmission(payload.new as any)
          }
          
          // Refresh all submissions list (reset to first page for real-time updates)
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setCurrentOffset(0)
            fetchSubmissions(0, false)
          }
        })
        .subscribe()
    }
    
    return () => {
      console.log(`[JobDetail] Cleaning up real-time subscriptions for job ${job.id}`)
      supabase.removeChannel(jobChannel)
      if (submissionChannel) {
        supabase.removeChannel(submissionChannel)
      }
    }
  }, [job.id, usesInstantPayment, publicKey])

  // Fetch submission data function with pagination support
  const fetchSubmissions = useCallback(async (offset = 0, append = false) => {
      // Set loading state based on whether it's initial load or pagination
      if (offset === 0) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }
      
      try {
        // Get total submission count (only on initial load)
        if (offset === 0) {
          const { count } = await supabase
            .from('job_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('job_id', job.id)

          setSubmissionCount(count || 0)
        }

        // Check if user has submitted (only on initial load)
        if (offset === 0 && publicKey) {
          const { data: existingSubmission } = await supabase
            .from('job_submissions')
            .select('*')
            .eq('job_id', job.id)
            .eq('worker_wallet', publicKey.toString())
            .maybeSingle()

          setUserSubmission(existingSubmission)
          
          // If user has submission, calculate their tier
          if (existingSubmission && existingSubmission.social_follower_count && followerTiers.length > 0) {
            const tier = calculateFollowerTier(existingSubmission.social_follower_count, followerTiers)
            setUserFollowerTier(tier)
          }
        }

        // Fetch submissions with pagination - optimized to select only needed fields
        const { data: submissions } = await supabase
          .from('job_submissions')
          .select('id, worker_wallet, social_approval_status, social_payment_amount_tokens, submitted_at, social_follower_count, social_tweet_link, social_payment_tx_signature, social_denial_reason')
          .eq('job_id', job.id)
          .order('submitted_at', { ascending: true })
          .range(offset, offset + SUBMISSIONS_PER_PAGE - 1)

        // Update submissions list (append or replace)
        if (append) {
          setAllSubmissions(prev => [...prev, ...(submissions || [])])
        } else {
          setAllSubmissions(submissions || [])
        }
        
        // Update pagination state
        setHasMoreSubmissions((submissions?.length || 0) === SUBMISSIONS_PER_PAGE)
        
      } catch (error) {
        console.error('Error fetching submission data:', error)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
  }, [job.id, publicKey, followerTiers, SUBMISSIONS_PER_PAGE])

  // Fetch submission data on mount and when dependencies change
  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(true)
    toast.success('Link copied!')
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const handleSubmissionSuccess = () => {
    // Refetch submissions (reset to first page)
    setCurrentOffset(0)
    fetchSubmissions(0, false)
    setShowSubmitModal(false)
    onSubmissionSuccess?.()
  }

  // Handle loading more submissions
  const handleLoadMore = () => {
    if (loadingMore || !hasMoreSubmissions) return
    const nextOffset = currentOffset + SUBMISSIONS_PER_PAGE
    setCurrentOffset(nextOffset)
    fetchSubmissions(nextOffset, true)
  }

  // ==================== BUDGET CALCULATIONS ====================
  
  const remainingBudget = job.social_remaining_budget_tokens || 0
  const totalBudget = job.social_total_budget_tokens || 0
  const paidCount = job.social_approved_paid_count || 0
  const budgetPercentage = totalBudget > 0 ? (remainingBudget / totalBudget) * 100 : 0
  
  // Calculate pending and approved submissions
  const pendingSubmissions = allSubmissions.filter(s => s.social_approval_status === 'pending')
  const approvedSubmissions = allSubmissions.filter(
    s => s.social_approval_status === 'approved' || s.social_approval_status === 'auto_approved'
  ).sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
  
  const pendingSubmissionsValue = pendingSubmissions.reduce((sum, submission) => {
    if (submission.social_follower_count && followerTiers.length > 0) {
      const tier = calculateFollowerTier(submission.social_follower_count, followerTiers)
      if (tier) {
        const feePercentage = job.fee_percentage_at_creation || 0.05
        const totalCost = tier.base_payment_usd * (1 + feePercentage)
        return sum + totalCost
      }
    }
    return sum
  }, 0)
  
  const budgetAtRisk = pendingSubmissionsValue > remainingBudget
  const wouldDepleteBudget = userFollowerTier && (userFollowerTier.base_payment_usd * 1.05) > remainingBudget

  // Phase status colors
  const phaseColors: Record<string, { bg: string; text: string; label: string }> = {
    open: { bg: 'var(--accent-success, #36C170)', text: '#FFFFFF', label: 'OPEN FOR SUBMISSIONS' },
    engagement: { bg: 'var(--accent-warning, #FFC857)', text: '#1A1A1E', label: 'ENGAGEMENT PERIOD' },
    review: { bg: 'var(--accent-primary, #7C4DFF)', text: '#FFFFFF', label: 'UNDER REVIEW' },
    completed: { bg: 'var(--text-muted, #A3A7B5)', text: '#FFFFFF', label: 'COMPLETED' },
    cancelled: { bg: '#EF4444', text: '#FFFFFF', label: 'CANCELLED' }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: 'var(--accent-primary, #7C4DFF)' }} />
      </Box>
    )
  }

  return (
    <Box>
      {/* Campaign Header - Full Width */}
      <Paper
        sx={{
          p: 'var(--space-lg, 24px)',
          mb: 3,
          bgcolor: 'var(--card-background, #FFFFFF)',
          borderRadius: 'var(--radius-card-lg, 24px)',
          boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))',
          border: '2px solid var(--accent-primary, #7C4DFF)'
        }}
      >
        {/* Badges Row */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip
            icon={<CampaignIcon sx={{ fontSize: 16 }} />}
            label="SOCIAL CAMPAIGN"
            sx={{
              bgcolor: 'var(--accent-primary, #7C4DFF)',
              color: '#FFFFFF',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 600,
              fontSize: '12px',
              borderRadius: 'var(--radius-control, 999px)',
              '& .MuiChip-icon': { color: '#E3F06F' }
            }}
          />
          <Chip
            icon={job.social_job_type === 'retweet' ? <RepeatIcon sx={{ fontSize: 14 }} /> : <CreateIcon sx={{ fontSize: 14 }} />}
            label={job.social_job_type === 'retweet' ? 'RETWEET CAMPAIGN' : 'ORIGINAL TWEET'}
            sx={{
              bgcolor: 'rgba(227, 240, 111, 0.3)',
              color: 'var(--text-primary, #1A1A1E)',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 500,
              fontSize: '12px',
              borderRadius: 'var(--radius-control, 999px)',
            }}
          />
          <Chip
            label={phaseColors[campaignPhase]?.label || 'UNKNOWN'}
            sx={{
              bgcolor: phaseColors[campaignPhase]?.bg || '#9E9E9E',
              color: phaseColors[campaignPhase]?.text || '#FFFFFF',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 600,
              fontSize: '12px',
              borderRadius: 'var(--radius-control, 999px)',
            }}
          />
        </Box>

        {/* Title */}
        <Typography
          variant="h4"
          sx={{
            fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
            fontWeight: 700,
            color: 'var(--text-primary, #1A1A1E)',
            mb: 1
          }}
        >
          {job.title}
        </Typography>

        {/* Poster Info */}
        <Typography
          variant="body2"
          sx={{
            color: 'var(--text-secondary, #6F7280)',
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            mb: 2
          }}
        >
          Posted by{' '}
          <span style={{ fontFamily: hasDisplayName ? 'inherit' : 'var(--font-mono, JetBrains Mono, monospace)' }}>
            {displayNameOrWallet}
          </span>
          {projectName && ` • ${projectName}`}
        </Typography>

        {/* Quick Stats Row */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleIcon sx={{ color: 'var(--accent-primary, #7C4DFF)', fontSize: 20 }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--text-primary, #1A1A1E)' }}>
              {submissionCount} participant{submissionCount !== 1 ? 's' : ''}
            </Typography>
          </Box>
          
          {usesInstantPayment && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MoneyIcon sx={{ color: 'var(--accent-success, #36C170)', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--text-primary, #1A1A1E)' }}>
                ${remainingBudget.toFixed(0)} / ${totalBudget.toFixed(0)} budget left
              </Typography>
            </Box>
          )}
          
          {!usesInstantPayment && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon sx={{ color: 'var(--accent-success, #36C170)', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--text-primary, #1A1A1E)' }}>
                {totalBudget.toLocaleString()} {tokenSymbol} max budget
              </Typography>
            </Box>
          )}
          
          {campaignPhase === 'open' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon sx={{ color: 'var(--accent-warning, #FFC857)', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--accent-warning, #FFC857)' }}>
                {formatDistanceToNow(submissionDeadline, { addSuffix: true }).replace('in ', '')} left
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Budget Warning (if running low) */}
      {usesInstantPayment && budgetPercentage < 20 && budgetPercentage > 0 && campaignPhase === 'open' && (
        <Alert
          severity="warning"
          icon={<WarningIcon />}
          sx={{ mb: 3, borderRadius: 'var(--radius-card-lg, 24px)' }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            ⚡ Budget running low! Only ${remainingBudget.toFixed(0)} remaining ({budgetPercentage.toFixed(0)}%)
          </Typography>
        </Alert>
      )}

      {/* User Submission Status - Full Width */}
      {userSubmission && (
        <Alert
          severity={
            userSubmission.social_approval_status === 'approved' || userSubmission.social_approval_status === 'auto_approved'
              ? 'success'
              : userSubmission.social_approval_status === 'denied'
                ? 'error'
                : userSubmission.social_approval_status === 'approved_pending_payment'
                  ? 'info'
                  : userSubmission.social_approval_status === 'approved_failed'
                    ? 'warning'
                    : 'info'
          }
          sx={{ mb: 3, borderRadius: 'var(--radius-card-lg, 24px)' }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {userSubmission.social_approval_status === 'approved' || userSubmission.social_approval_status === 'auto_approved'
              ? '✅ Your submission has been approved and paid!'
              : userSubmission.social_approval_status === 'approved_pending_payment'
                ? '⏳ Payment is being processed...'
                : userSubmission.social_approval_status === 'approved_failed'
                  ? '⚠️ Payment failed - poster will retry'
                  : userSubmission.social_approval_status === 'denied'
                    ? '❌ Your submission was denied'
                    : '⏳ Your submission is pending review'}
          </Typography>
          <Typography variant="caption">
            Submitted: {format(new Date(userSubmission.submitted_at!), 'MMM dd, yyyy h:mm a')}
            {userSubmission.social_follower_count && ` • ${userSubmission.social_follower_count.toLocaleString()} followers`}
            {userSubmission.social_payment_amount_usd && ` • Earned: $${userSubmission.social_payment_amount_usd.toFixed(2)}`}
          </Typography>
          {userSubmission.social_denial_reason && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Reason: {userSubmission.social_denial_reason}
            </Typography>
          )}
        </Alert>
      )}

      {/* Budget Warnings for Workers */}
      {usesInstantPayment && !isPoster && (
        <>
          {wouldDepleteBudget && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 'var(--radius-card-lg, 24px)' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                ⚠️ Warning: Budget may be depleted before your submission is approved
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                Only ${remainingBudget.toFixed(0)} left, but your tier payment is ${userFollowerTier?.base_payment_usd}
              </Typography>
            </Alert>
          )}
          
          {budgetAtRisk && !wouldDepleteBudget && pendingSubmissions.length > 0 && (
            <Alert severity="warning" sx={{ mb: 3, borderRadius: 'var(--radius-card-lg, 24px)' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                ⚡ High demand! {pendingSubmissions.length} submission{pendingSubmissions.length !== 1 ? 's' : ''} pending approval
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                Budget remaining: ${remainingBudget.toFixed(0)} • Submit soon to secure your spot!
              </Typography>
            </Alert>
          )}
        </>
      )}

      {/* 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Campaign Details Section */}
          <Paper
            sx={{
              p: 'var(--space-lg, 24px)',
              mb: 3,
              bgcolor: 'var(--card-background, #FFFFFF)',
              borderRadius: 'var(--radius-card-lg, 24px)',
              boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 2
              }}
            >
              Campaign Details
            </Typography>

            <Divider sx={{ mb: 3, bgcolor: 'var(--border-subtle, #E5E7F0)' }} />

            {/* For retweet campaigns */}
            {job.social_job_type === 'retweet' && job.social_tweet_url && (
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontWeight: 600,
                    color: 'var(--text-primary, #1A1A1E)',
                    mb: 1.5
                  }}
                >
                  📢 Task: Retweet the following tweet
                </Typography>
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
                    border: '2px solid var(--accent-primary, #7C4DFF)',
                    borderRadius: 'var(--radius-card-lg, 24px)',
                    mb: 2
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <MuiLink
                      href={job.social_tweet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        color: 'var(--accent-primary, #7C4DFF)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' }
                      }}
                    >
                      <OpenInNewIcon sx={{ fontSize: 18 }} />
                      View Tweet on Twitter/X
                    </MuiLink>
                    <Tooltip title={copiedUrl ? 'Copied!' : 'Copy link'}>
                      <IconButton
                        size="small"
                        onClick={() => handleCopyUrl(job.social_tweet_url!)}
                        sx={{ color: 'var(--accent-primary, #7C4DFF)' }}
                      >
                        <ContentCopyIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'var(--text-secondary, #6F7280)',
                      display: 'block',
                      mt: 1,
                      fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                      fontSize: '11px',
                      wordBreak: 'break-all'
                    }}
                  >
                    {job.social_tweet_url}
                  </Typography>
                </Paper>
              </Box>
            )}

            {/* For original tweet campaigns */}
            {job.social_job_type === 'original_tweet' && job.social_tweet_topic && (
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontWeight: 600,
                    color: 'var(--text-primary, #1A1A1E)',
                    mb: 1.5
                  }}
                >
                  ✍️ Task: Create an original tweet about this topic
                </Typography>
                <Paper
                  sx={{
                    p: 2.5,
                    bgcolor: 'rgba(227, 240, 111, 0.15)',
                    border: '2px solid rgba(227, 240, 111, 0.5)',
                    borderRadius: 'var(--radius-card-lg, 24px)',
                    mb: 2
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      color: 'var(--text-primary, #1A1A1E)',
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                      lineHeight: 1.6
                    }}
                  >
                    {job.social_tweet_topic}
                  </Typography>
                </Paper>
              </Box>
            )}

            {/* Description */}
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)',
                  mb: 1
                }}
              >
                📝 Description
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'var(--text-secondary, #6F7280)',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  lineHeight: 1.7
                }}
              >
                {job.description}
              </Typography>
            </Box>
          </Paper>

          {/* Submissions Section - Show wallets who submitted (NOT for poster - they see full dashboard below) */}
          {allSubmissions.length > 0 && !isPoster && (
            <Paper
              sx={{
                p: 'var(--space-lg, 24px)',
                mb: 3,
                bgcolor: 'var(--card-background, #FFFFFF)',
                borderRadius: 'var(--radius-card-lg, 24px)',
                boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)',
                  mb: 2
                }}
              >
                📋 Submissions ({allSubmissions.length})
              </Typography>

              <Divider sx={{ mb: 3, bgcolor: 'var(--border-subtle, #E5E7F0)' }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {allSubmissions.map((submission) => (
                  <Box
                    key={submission.id}
                    sx={{
                      p: 2,
                      borderRadius: '12px',
                      border: '1px solid var(--border-subtle, #E5E7F0)',
                      bgcolor: submission.social_approval_status === 'approved' || submission.social_approval_status === 'auto_approved'
                        ? 'var(--accent-success-soft, #E3F8ED)'
                        : submission.social_approval_status === 'denied'
                          ? 'rgba(244, 67, 54, 0.05)'
                          : submission.social_approval_status === 'approved_pending_payment'
                            ? 'rgba(124, 77, 255, 0.05)'
                            : 'var(--card-background, #FFFFFF)'
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                          fontSize: '13px',
                          color: 'var(--text-primary, #1A1A1E)',
                          fontWeight: 600
                        }}
                      >
                        {submission.worker_wallet.slice(0, 4)}...{submission.worker_wallet.slice(-4)}
                      </Typography>
                      
                      {/* Status and payment display */}
                      {submission.social_payment_amount_tokens ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                          <Chip
                            label="✓ Paid"
                            size="small"
                            sx={{
                              bgcolor: 'var(--accent-success, #36C170)',
                              color: '#FFFFFF',
                              fontWeight: 600,
                              fontSize: '11px'
                            }}
                          />
                          <Typography variant="caption" sx={{ color: 'var(--accent-success, #36C170)', fontWeight: 700 }}>
                            {submission.social_payment_amount_tokens.toFixed(2)} {tokenSymbol}
                          </Typography>
                        </Box>
                      ) : submission.social_approval_status === 'approved_pending_payment' ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CircularProgress size={16} sx={{ color: 'var(--accent-primary, #7C4DFF)' }} />
                          <Typography variant="caption" sx={{ color: 'var(--accent-primary, #7C4DFF)', fontWeight: 600 }}>
                            Processing...
                          </Typography>
                        </Box>
                      ) : (
                        <Chip
                          label={
                            submission.social_approval_status === 'approved' || submission.social_approval_status === 'auto_approved'
                              ? '✓ Approved'
                              : submission.social_approval_status === 'approved_failed'
                                ? 'Payment Failed'
                                : submission.social_approval_status === 'denied'
                                  ? 'Denied'
                                  : 'Pending'
                          }
                          size="small"
                          sx={{
                            bgcolor: submission.social_approval_status === 'approved' || submission.social_approval_status === 'auto_approved'
                              ? 'var(--accent-success, #36C170)'
                              : submission.social_approval_status === 'approved_failed'
                                ? 'var(--accent-warning, #FFC857)'
                                : submission.social_approval_status === 'denied'
                                  ? '#EF4444'
                                  : '#FFA726',
                            color: '#FFFFFF',
                            fontWeight: 600,
                            fontSize: '11px'
                          }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary, #6F7280)' }}>
                      Submitted {formatDistanceToNow(new Date(submission.submitted_at!), { addSuffix: true })}
                      {submission.social_follower_count && ` • ${submission.social_follower_count.toLocaleString()} followers`}
                    </Typography>
                    {submission.social_tweet_link && (
                      <Box sx={{ mt: 1 }}>
                        <MuiLink
                          href={submission.social_tweet_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ fontSize: '12px', color: 'var(--accent-primary, #7C4DFF)' }}
                        >
                          View Tweet →
                        </MuiLink>
                      </Box>
                    )}
                    
                    {/* Transaction Link - Show for paid submissions */}
                    {submission.social_payment_tx_signature && (
                      <Box sx={{ mt: 1 }}>
                        <MuiLink
                          href={`https://solscan.io/tx/${submission.social_payment_tx_signature}?cluster=mainnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ 
                            fontSize: '12px', 
                            color: 'var(--accent-success, #36C170)',
                            fontFamily: 'var(--font-mono, monospace)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5
                          }}
                        >
                          🔗 View Transaction: {submission.social_payment_tx_signature.slice(0, 8)}...{submission.social_payment_tx_signature.slice(-6)}
                        </MuiLink>
                      </Box>
                    )}
                    
                    {/* Denial Reason - Show for denied submissions */}
                    {submission.social_approval_status === 'denied' && submission.social_denial_reason && (
                      <Box 
                        sx={{ 
                          mt: 1.5,
                          p: 1.5,
                          bgcolor: 'rgba(244, 67, 54, 0.1)',
                          border: '1px solid rgba(244, 67, 54, 0.3)',
                          borderRadius: '8px'
                        }}
                      >
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: '#D32F2F',
                            fontWeight: 600,
                            display: 'block',
                            mb: 0.5,
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}
                        >
                          ❌ Denial Reason
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: '#D32F2F',
                            fontSize: '13px',
                            lineHeight: 1.5
                          }}
                        >
                          {submission.social_denial_reason}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ))}
                
                {/* Load More Button */}
                {hasMoreSubmissions && allSubmissions.length < submissionCount && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <Button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      variant="outlined"
                      sx={{
                        minWidth: 200,
                        borderColor: 'var(--accent-primary, #7C4DFF)',
                        color: 'var(--accent-primary, #7C4DFF)',
                        '&:hover': {
                          borderColor: 'var(--accent-primary, #7C4DFF)',
                          bgcolor: 'rgba(124, 77, 255, 0.08)'
                        }
                      }}
                    >
                      {loadingMore ? (
                        <>
                          <CircularProgress size={16} sx={{ mr: 1, color: 'var(--accent-primary, #7C4DFF)' }} />
                          Loading...
                        </>
                      ) : (
                        `Load More (${submissionCount - allSubmissions.length} remaining)`
                      )}
                    </Button>
                  </Box>
                )}
                
                {/* All submissions loaded message */}
                {allSubmissions.length > 0 && allSubmissions.length === submissionCount && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: 'var(--text-secondary, #6F7280)',
                        fontStyle: 'italic'
                      }}
                    >
                      All {submissionCount} submissions loaded
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          )}

          {/* Poster Review Dashboard - Only visible to job poster */}
          {isPoster && allSubmissions.length > 0 && publicKey && (
            <PosterReviewDashboard
              job={job}
              submissions={allSubmissions}
              currentUserWallet={publicKey.toString()}
              tokenSymbol={tokenSymbol}
            />
          )}

          {/* How it works section */}
          <Paper
            sx={{
              p: 'var(--space-lg, 24px)',
              mb: 3,
              bgcolor: 'rgba(227, 240, 111, 0.1)',
              border: '2px solid rgba(227, 240, 111, 0.4)',
              borderRadius: 'var(--radius-card-lg, 24px)'
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 2
              }}
            >
              ℹ️ How It Works
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {[
                { step: 1, text: job.social_job_type === 'retweet' ? 'Retweet the tweet linked above' : 'Create and post your original tweet' },
                { step: 2, text: `Submit your ${job.social_job_type === 'retweet' ? 'retweet' : 'tweet'} link + current follower count` },
                { step: 3, text: usesInstantPayment ? 'Poster reviews and approves your submission' : 'Wait 24 hours for engagement to accumulate' },
                { step: 4, text: usesInstantPayment ? 'Payment sent instantly to your wallet!' : 'Poster reviews submissions (48 hour window)' },
                ...(usesInstantPayment ? [] : [{ step: 5, text: 'Payment distributed proportionally by post reach & engagement' }])
              ].map(({ step, text }) => (
                <Box key={step} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: 'var(--accent-primary, #7C4DFF)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 700,
                      flexShrink: 0
                    }}
                  >
                    {step}
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'var(--text-primary, #1A1A1E)',
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                      pt: 0.5
                    }}
                  >
                    {text}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Alert
              severity="info"
              sx={{
                mt: 3,
                borderRadius: 'var(--radius-card-lg, 24px)',
                '& .MuiAlert-message': { fontFamily: 'var(--font-body, Satoshi, sans-serif)' }
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {usesInstantPayment ? (
                  <>💰 <strong>Instant Payment:</strong> You'll be paid immediately when approved based on your follower tier!</>
                ) : (
                  <>⚠️ <strong>Important:</strong> Report accurate follower count (used for eligibility verification).
                  Final payment is based on your post's reach and engagement metrics.</>
                )}
              </Typography>
            </Alert>
          </Paper>

          {/* Submit Button - Also at bottom of main content */}
          {canSubmit && (
            <Paper
              sx={{
                p: 'var(--space-lg, 24px)',
                bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
                border: '2px solid var(--accent-primary, #7C4DFF)',
                borderRadius: 'var(--radius-card-lg, 24px)',
                textAlign: 'center'
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)',
                  mb: 1
                }}
              >
                Ready to Participate?
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'var(--text-secondary, #6F7280)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  mb: 3
                }}
              >
                {job.social_job_type === 'retweet'
                  ? 'Retweet the campaign tweet, then submit your retweet link below.'
                  : 'Post your original tweet, then submit your tweet link below.'}
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => setShowSubmitModal(true)}
                sx={{
                  bgcolor: 'var(--accent-primary, #7C4DFF)',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontWeight: 600,
                  fontSize: '16px',
                  px: 6,
                  py: 1.5,
                  borderRadius: 'var(--radius-control, 999px)',
                  boxShadow: '0 4px 14px rgba(124, 77, 255, 0.3)',
                  '&:hover': {
                    bgcolor: '#6A3FE8',
                    boxShadow: '0 6px 20px rgba(124, 77, 255, 0.4)'
                  }
                }}
              >
                🚀 Submit My Participation
              </Button>
            </Paper>
          )}

          {/* Not connected wallet message */}
          {!publicKey && campaignPhase === 'open' && (
            <Alert
              severity="info"
              sx={{
                borderRadius: 'var(--radius-card-lg, 24px)',
                '& .MuiAlert-message': { fontFamily: 'var(--font-body, Satoshi, sans-serif)' }
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                🔗 Connect your wallet to participate in this campaign.
              </Typography>
            </Alert>
          )}
        </div>

        {/* Right Column - Sidebar (1/3 width) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Submit Participation Action - Top Priority */}
          {canSubmit && (
            <Paper
              sx={{
                p: 'var(--space-lg, 24px)',
                bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
                border: '2px solid var(--accent-primary, #7C4DFF)',
                borderRadius: 'var(--radius-card-lg, 24px)',
                boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))',
                textAlign: 'center'
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)',
                  mb: 1
                }}
              >
                Ready to Participate?
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'var(--text-secondary, #6F7280)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  mb: 3
                }}
              >
                {job.social_job_type === 'retweet'
                  ? 'Retweet the campaign tweet, then submit your retweet link below.'
                  : 'Post your original tweet, then submit your tweet link below.'}
              </Typography>
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={() => setShowSubmitModal(true)}
                sx={{
                  bgcolor: 'var(--accent-primary, #7C4DFF)',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontWeight: 600,
                  fontSize: '16px',
                  py: 1.5,
                  borderRadius: 'var(--radius-control, 999px)',
                  boxShadow: '0 4px 14px rgba(124, 77, 255, 0.3)',
                  '&:hover': {
                    bgcolor: '#6A3FE8',
                    boxShadow: '0 6px 20px rgba(124, 77, 255, 0.4)'
                  }
                }}
              >
                🚀 Submit My Participation
              </Button>
            </Paper>
          )}

          {/* Not Connected Message */}
          {!publicKey && campaignPhase === 'open' && (
            <Alert
              severity="info"
              sx={{
                borderRadius: 'var(--radius-card-lg, 24px)',
                '& .MuiAlert-message': { fontFamily: 'var(--font-body, Satoshi, sans-serif)' }
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                🔗 Connect your wallet to participate in this campaign.
              </Typography>
            </Alert>
          )}

          {/* Budget Status - NEW INSTANT PAYMENT SYSTEM */}
          {usesInstantPayment && (
            <Paper
              sx={{
                p: 'var(--space-lg, 24px)',
                bgcolor: 'var(--card-background, #FFFFFF)',
                borderRadius: 'var(--radius-card-lg, 24px)',
                boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)',
                  mb: 2
                }}
              >
                💰 Campaign Budget
              </Typography>

              <Divider sx={{ mb: 2, bgcolor: 'var(--border-subtle, #E5E7F0)' }} />

              {/* Budget Progress */}
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      color: budgetPercentage < 20 ? 'var(--accent-warning, #FFC857)' : 'var(--accent-primary, #7C4DFF)',
                      fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                      fontWeight: 700
                    }}
                  >
                    {remainingBudget.toFixed(0)} {tokenSymbol}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--text-secondary, #6F7280)' }}>
                    of {totalBudget.toFixed(0)} {tokenSymbol}
                  </Typography>
                </Box>
                
                <LinearProgress 
                  variant="determinate" 
                  value={budgetPercentage}
                  sx={{ 
                    height: 10, 
                    borderRadius: 'var(--radius-control, 999px)', 
                    mt: 1,
                    bgcolor: 'var(--border-subtle, #E5E7F0)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: budgetPercentage < 20 
                        ? 'var(--accent-warning, #FFC857)' 
                        : 'var(--accent-success, #36C170)',
                      borderRadius: 'var(--radius-control, 999px)'
                    }
                  }}
                />
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                  <Typography variant="body2" sx={{ color: 'var(--text-secondary, #6F7280)' }}>
                    {budgetPercentage.toFixed(0)}% remaining
                  </Typography>
                  {paidCount > 0 && (
                    <Typography variant="body2" sx={{ color: 'var(--accent-success, #36C170)', fontWeight: 600 }}>
                      ✅ {paidCount} paid
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* User's Tier Info */}
              {userFollowerTier && !isPoster && (
                <Paper
                  sx={{
                    p: 2,
                    mt: 3,
                    bgcolor: 'var(--accent-success-soft, #E3F8ED)',
                    border: '2px solid var(--accent-success, #36C170)',
                    borderRadius: 'var(--radius-card-lg, 24px)'
                  }}
                >
                  <Typography 
                    variant="subtitle2" 
                    sx={{ 
                      color: 'var(--accent-success, #36C170)', 
                      fontWeight: 700,
                      mb: 0.5,
                      textTransform: 'uppercase',
                      fontSize: '11px',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Your Tier
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--text-primary, #1A1A1E)', mb: 0.5 }}>
                    {userFollowerTier.tier_name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--text-secondary, #6F7280)', fontSize: '13px', mb: 1 }}>
                    {formatFollowerTierRange(userFollowerTier)}
                  </Typography>
                  <Divider sx={{ my: 1.5, bgcolor: 'rgba(54, 193, 112, 0.2)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'var(--text-secondary, #6F7280)' }}>
                      Your Payment:
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--accent-success, #36C170)' }}>
                      ${userFollowerTier.base_payment_usd}
                    </Typography>
                  </Box>
                </Paper>
              )}

            </Paper>
          )}

          {/* Poster Actions */}
          {isPoster && job.status === 'open' && (onEditClick || onExtendDeadlineClick || onCancelClick) && (
            <Paper
              sx={{
                p: 'var(--space-lg, 24px)',
                bgcolor: 'var(--card-background, #FFFFFF)',
                borderRadius: 'var(--radius-card-lg, 24px)',
                boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)',
                  mb: 2
                }}
              >
                ⚙️ Campaign Actions
              </Typography>

              <Divider sx={{ mb: 2, bgcolor: 'var(--border-subtle, #E5E7F0)' }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {onEditClick && (
                  <>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={onEditClick}
                      sx={{
                        color: '#7C4DFF',
                        borderColor: '#E5DEFF',
                        bgcolor: 'rgba(124, 77, 255, 0.04)',
                        py: 1.2,
                        borderRadius: 'var(--radius-card, 16px)',
                        fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                        fontSize: '14px',
                        fontWeight: 600,
                        textTransform: 'none',
                        '&:hover': {
                          bgcolor: 'rgba(124, 77, 255, 0.08)',
                          borderColor: '#7C4DFF'
                        }
                      }}
                    >
                      Edit Campaign
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<MoneyIcon />}
                      onClick={() => setShowManagementModal(true)}
                      sx={{
                        color: '#FB923C',
                        borderColor: '#FFE4CC',
                        bgcolor: 'rgba(251, 146, 60, 0.04)',
                        py: 1.2,
                        borderRadius: 'var(--radius-card, 16px)',
                        fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                        fontSize: '14px',
                        fontWeight: 600,
                        textTransform: 'none',
                        '&:hover': {
                          bgcolor: 'rgba(251, 146, 60, 0.08)',
                          borderColor: '#FB923C'
                        }
                      }}
                    >
                      Manage Payments
                    </Button>
                  </>
                )}

                {onExtendDeadlineClick && (
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<CalendarTodayIcon />}
                    onClick={onExtendDeadlineClick}
                    sx={{
                      color: '#7C4DFF',
                      borderColor: '#E5DEFF',
                      bgcolor: 'rgba(124, 77, 255, 0.04)',
                      py: 1.2,
                      borderRadius: 'var(--radius-card, 16px)',
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                      fontSize: '14px',
                      fontWeight: 600,
                      textTransform: 'none',
                      '&:hover': {
                        bgcolor: 'rgba(124, 77, 255, 0.08)',
                        borderColor: '#7C4DFF'
                      }
                    }}
                  >
                    Extend Deadline
                  </Button>
                )}

                {onCancelClick && (
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<CancelIcon />}
                    onClick={onCancelClick}
                    sx={{
                      color: '#EF4444',
                      borderColor: '#FEE2E2',
                      bgcolor: 'rgba(239, 68, 68, 0.04)',
                      py: 1.2,
                      borderRadius: 'var(--radius-card, 16px)',
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                      fontSize: '14px',
                      fontWeight: 600,
                      textTransform: 'none',
                      '&:hover': {
                        bgcolor: 'rgba(239, 68, 68, 0.08)',
                        borderColor: '#EF4444'
                      }
                    }}
                  >
                    Cancel Campaign
                  </Button>
                )}
              </Box>
            </Paper>
          )}

          {/* Campaign Stats */}
          <Paper
            sx={{
              p: 'var(--space-lg, 24px)',
              bgcolor: 'var(--card-background, #FFFFFF)',
              borderRadius: 'var(--radius-card-lg, 24px)',
              boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 2
              }}
            >
              Campaign Stats
            </Typography>

            <Divider sx={{ mb: 2, bgcolor: 'var(--border-subtle, #E5E7F0)' }} />

            {/* Current status */}
            <Box sx={{ mb: 2.5 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontWeight: 600,
                  color: 'var(--accent-primary, #7C4DFF)',
                  mb: 1.5,
                  fontSize: '12px'
                }}
              >
                📊 CURRENT STATUS
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2" sx={{ color: 'var(--text-primary, #1A1A1E)', fontSize: '14px' }}>
                  <strong>Participants:</strong> {submissionCount}
                </Typography>
                {usesInstantPayment && paidCount > 0 && (
                  <Typography variant="body2" sx={{ color: 'var(--text-primary, #1A1A1E)', fontSize: '14px' }}>
                    <strong>Paid:</strong> {paidCount} worker{paidCount !== 1 ? 's' : ''}
                  </Typography>
                )}
                {pendingSubmissions.length > 0 && (
                  <Typography variant="body2" sx={{ color: 'var(--accent-warning, #FFC857)', fontSize: '14px', fontWeight: 600 }}>
                    <strong>Pending:</strong> {pendingSubmissions.length} awaiting review
                  </Typography>
                )}
              </Box>
            </Box>

            <Divider sx={{ my: 2, bgcolor: 'var(--border-subtle, #E5E7F0)' }} />

            {/* Timeline */}
            <Box>
              <Typography
                variant="subtitle2"
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)',
                  mb: 1.5,
                  fontSize: '12px'
                }}
              >
                ⏰ TIMELINE
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  {now < submissionDeadline ? (
                    <AccessTimeIcon sx={{ fontSize: 16, color: 'var(--accent-warning, #FFC857)', mt: 0.3 }} />
                  ) : (
                    <CheckCircleIcon sx={{ fontSize: 16, color: 'var(--accent-success, #36C170)', mt: 0.3 }} />
                  )}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary, #6F7280)', display: 'block', fontSize: '11px' }}>
                      Submit by
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'var(--text-primary, #1A1A1E)', fontWeight: 500, fontSize: '13px' }}>
                      {format(submissionDeadline, 'MMM dd, h:mm a')}
                    </Typography>
                    {now < submissionDeadline && (
                      <Typography variant="caption" sx={{ color: 'var(--accent-warning, #FFC857)', fontSize: '11px' }}>
                        {formatDistanceToNow(submissionDeadline, { addSuffix: true }).replace('in ', '')} left
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <LockIcon sx={{ fontSize: 16, color: 'var(--accent-primary, #7C4DFF)', mt: 0.3 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary, #6F7280)', display: 'block', fontSize: '11px' }}>
                      {usesInstantPayment ? 'Payments until' : 'Expected payment'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'var(--accent-primary, #7C4DFF)', fontWeight: 600, fontSize: '13px' }}>
                      {format(reviewDeadline, 'MMM dd, yyyy')}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Minimum followers if required */}
            {job.social_min_followers_required && job.social_min_followers_required > 0 && (
              <>
                <Divider sx={{ my: 2, bgcolor: 'var(--border-subtle, #E5E7F0)' }} />
                <Box>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'var(--text-primary, #1A1A1E)',
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                      fontSize: '13px'
                    }}
                  >
                    👥 <strong>Min. Followers:</strong> {job.social_min_followers_required.toLocaleString()}+
                  </Typography>
                </Box>
              </>
            )}
          </Paper>

          {/* Follower Tiers - NEW INSTANT PAYMENT SYSTEM */}
          {usesInstantPayment && followerTiers.length > 0 && (
            <Paper
              sx={{
                p: 'var(--space-lg, 24px)',
                bgcolor: 'var(--card-background, #FFFFFF)',
                borderRadius: 'var(--radius-card-lg, 24px)',
                boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)',
                  mb: 2
                }}
              >
                💎 Payment Tiers
              </Typography>

              <Divider sx={{ mb: 2, bgcolor: 'var(--border-subtle, #E5E7F0)' }} />

              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: 'var(--text-secondary, #6F7280)',
                  mb: 2,
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                }}
              >
                Fixed payment per person based on follower count
              </Typography>

              {/* Follower tiers display */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {followerTiers.map((tier, index) => {
                  const isUserTier = userFollowerTier?.tier_name === tier.tier_name
                  
                  return (
                    <Box
                      key={index}
                      sx={{
                        p: 1.5,
                        borderRadius: '12px',
                        border: isUserTier ? '2px solid var(--accent-success, #36C170)' : '1px solid var(--border-subtle, #E5E7F0)',
                        bgcolor: isUserTier ? 'var(--accent-success-soft, #E3F8ED)' : 'var(--card-background, #FFFFFF)',
                        transition: 'all 0.2s',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: isUserTier ? 'var(--accent-success, #36C170)' : 'var(--text-primary, #1A1A1E)',
                            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                            fontSize: '13px',
                            mb: 0.5
                          }}
                        >
                          {tier.tier_name}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'var(--text-secondary, #6F7280)',
                            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                            fontSize: '11px'
                          }}
                        >
                          {formatFollowerTierRange(tier)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body1"
                          sx={{
                            fontWeight: 700,
                            color: isUserTier ? 'var(--accent-success, #36C170)' : 'var(--text-primary, #1A1A1E)',
                            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                            fontSize: '15px'
                          }}
                        >
                          ${tier.base_payment_usd}
                        </Typography>
                        {isUserTier && (
                          <Chip
                            label="YOU"
                            size="small"
                            sx={{
                              bgcolor: 'var(--accent-success, #36C170)',
                              color: '#FFFFFF',
                              fontSize: '9px',
                              fontWeight: 700,
                              height: 18
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  )
                })}
              </Box>

              {usesInstantPayment && (
                <Alert
                  severity="info"
                  sx={{
                    mt: 2,
                    borderRadius: 'var(--radius-card-lg, 24px)',
                    '& .MuiAlert-message': { fontFamily: 'var(--font-body, Satoshi, sans-serif)' }
                  }}
                >
                  <Typography variant="body2" sx={{ fontSize: '12px' }}>
                    💡 <strong>Instant Payment:</strong> Get paid immediately when approved!
                  </Typography>
                </Alert>
              )}
            </Paper>
          )}
        </div>
      </div>

      {/* Submit Social Participation Modal */}
      {publicKey && (
        <SubmissionModal
          open={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          job={job}
          walletAddress={publicKey.toString()}
          signMessage={signMessage}
          onSuccess={(submissionId) => {
            console.log('Submission successful:', submissionId)
            handleSubmissionSuccess()
          }}
        />
      )}

      {/* Campaign Management Modal */}
      <CampaignManagementModal
        open={showManagementModal}
        onClose={() => setShowManagementModal(false)}
        jobId={job.id}
        jobTitle={job.title || 'Social Campaign'}
        onSubmissionUpdated={() => {
          // Refetch job data to update budget display
          window.location.reload()
        }}
      />
    </Box>
  )
}
