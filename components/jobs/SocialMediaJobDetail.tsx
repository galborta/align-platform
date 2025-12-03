'use client'

import { useState, useEffect } from 'react'
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
  IconButton
} from '@mui/material'
import { Database } from '@/types/database'
import { useWallet } from '@solana/wallet-adapter-react'
import { format, formatDistanceToNow } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'

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

// Social media job utilities
import { BudgetTier } from '@/types/social-media-jobs'
import {
  calculateActiveTier,
  formatTierRange,
  getNextTier,
  calculateEstimatedPerPerson
} from '@/lib/social-media-jobs'

// Submission modal
import SubmitSocialParticipationModal from './SubmitSocialParticipationModal'

type Job = Database['public']['Tables']['jobs']['Row']
type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

interface SocialMediaJobDetailProps {
  job: Job
  projectName?: string
  tokenSymbol?: string
  onSubmissionSuccess?: () => void
}

export default function SocialMediaJobDetail({
  job,
  projectName,
  tokenSymbol = 'tokens',
  onSubmissionSuccess
}: SocialMediaJobDetailProps) {
  const { publicKey } = useWallet()
  const [submissionCount, setSubmissionCount] = useState(0)
  const [userSubmission, setUserSubmission] = useState<JobSubmission | null>(null)
  const [allSubmissions, setAllSubmissions] = useState<JobSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  // Parse budget tiers from JSON
  const budgetTiers: BudgetTier[] = Array.isArray(job.social_budget_tiers)
    ? (job.social_budget_tiers as BudgetTier[])
    : []

  // Calculate tier information
  const activeTier = calculateActiveTier(budgetTiers, submissionCount)
  const nextTier = getNextTier(budgetTiers, submissionCount)
  const tierEstimate = activeTier ? calculateEstimatedPerPerson(activeTier, submissionCount) : null

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
  const canSubmit = campaignPhase === 'open' && !userSubmission && publicKey

  // Fetch submission data
  useEffect(() => {
    const fetchSubmissions = async () => {
      setLoading(true)
      try {
        // Get total submission count
        const { count } = await supabase
          .from('job_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', job.id)

        setSubmissionCount(count || 0)

        // Check if user has submitted
        if (publicKey) {
          const { data: existingSubmission } = await supabase
            .from('job_submissions')
            .select('*')
            .eq('job_id', job.id)
            .eq('worker_wallet', publicKey.toString())
            .maybeSingle()

          setUserSubmission(existingSubmission)
        }

        // Fetch all submissions (for display)
        const { data: submissions } = await supabase
          .from('job_submissions')
          .select('*')
          .eq('job_id', job.id)
          .order('submitted_at', { ascending: false })

        setAllSubmissions(submissions || [])
      } catch (error) {
        console.error('Error fetching submission data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSubmissions()
  }, [job.id, publicKey])

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(true)
    toast.success('Link copied!')
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const handleSubmissionSuccess = () => {
    // Refetch submissions
    const refetch = async () => {
      const { count } = await supabase
        .from('job_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', job.id)

      setSubmissionCount(count || 0)

      if (publicKey) {
        const { data: existingSubmission } = await supabase
          .from('job_submissions')
          .select('*')
          .eq('job_id', job.id)
          .eq('worker_wallet', publicKey.toString())
          .maybeSingle()

        setUserSubmission(existingSubmission)
      }
    }
    refetch()
    setShowSubmitModal(false)
    onSubmissionSuccess?.()
  }

  // Phase status colors
  const phaseColors: Record<string, { bg: string; text: string; label: string }> = {
    open: { bg: '#4CAF50', text: '#FFFFFF', label: 'OPEN FOR SUBMISSIONS' },
    engagement: { bg: '#FF9800', text: '#FFFFFF', label: 'ENGAGEMENT PERIOD' },
    review: { bg: '#2196F3', text: '#FFFFFF', label: 'UNDER REVIEW' },
    completed: { bg: '#9E9E9E', text: '#FFFFFF', label: 'COMPLETED' },
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
      {/* Campaign Header */}
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
          <span style={{ fontFamily: 'var(--font-mono, JetBrains Mono, monospace)' }}>
            {job.poster_wallet.slice(0, 6)}...{job.poster_wallet.slice(-4)}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUpIcon sx={{ color: 'var(--accent-success, #36C170)', fontSize: 20 }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--text-primary, #1A1A1E)' }}>
              {job.social_total_budget_tokens?.toLocaleString() || 0} {tokenSymbol} max budget
            </Typography>
          </Box>
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

      {/* User Submission Status */}
      {userSubmission && (
        <Alert
          severity={
            userSubmission.social_approval_status === 'approved' || userSubmission.social_approval_status === 'auto_approved'
              ? 'success'
              : userSubmission.social_approval_status === 'denied'
                ? 'error'
                : 'info'
          }
          sx={{ mb: 3, borderRadius: 'var(--radius-card-lg, 24px)' }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {userSubmission.social_approval_status === 'approved' || userSubmission.social_approval_status === 'auto_approved'
              ? '✅ Your submission has been approved!'
              : userSubmission.social_approval_status === 'denied'
                ? '❌ Your submission was denied'
                : '⏳ Your submission is pending review'}
          </Typography>
          <Typography variant="caption">
            Submitted: {format(new Date(userSubmission.submitted_at!), 'MMM dd, yyyy h:mm a')}
            {userSubmission.social_follower_count && ` • ${userSubmission.social_follower_count.toLocaleString()} followers`}
          </Typography>
          {userSubmission.social_denial_reason && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Reason: {userSubmission.social_denial_reason}
            </Typography>
          )}
        </Alert>
      )}

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

      {/* Campaign Stats Section */}
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
          Campaign Stats
        </Typography>

        <Divider sx={{ mb: 3, bgcolor: 'var(--border-subtle, #E5E7F0)' }} />

        {/* Budget tiers display */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)',
              mb: 2
            }}
          >
            💰 Tiered Budget Structure
          </Typography>
          <Box sx={{ bgcolor: 'var(--subtle-background, #F7F8FB)', borderRadius: 2, p: 2 }}>
            {budgetTiers.map((tier, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 0.75,
                  px: 1.5,
                  borderRadius: 1,
                  bgcolor: activeTier === tier ? 'var(--accent-primary-soft, #EEE7FF)' : 'transparent',
                  border: activeTier === tier ? '1px solid var(--accent-primary, #7C4DFF)' : '1px solid transparent',
                  mb: 0.5
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: activeTier === tier ? 700 : 400,
                    color: activeTier === tier ? 'var(--accent-primary, #7C4DFF)' : 'var(--text-secondary, #6F7280)',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    flex: 1
                  }}
                >
                  {formatTierRange(tier)}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: activeTier === tier ? 700 : 500,
                    color: activeTier === tier ? 'var(--accent-primary, #7C4DFF)' : 'var(--text-primary, #1A1A1E)',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                  }}
                >
                  {tier.budget_tokens.toLocaleString()} {tokenSymbol}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'var(--text-muted, #A3A7B5)',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                  }}
                >
                  (~${tier.budget_usd.toFixed(0)})
                </Typography>
                {activeTier === tier && (
                  <Chip
                    label="CURRENT"
                    size="small"
                    sx={{
                      bgcolor: 'var(--accent-primary, #7C4DFF)',
                      color: '#FFFFFF',
                      fontSize: '10px',
                      fontWeight: 700,
                      height: 20
                    }}
                  />
                )}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Current status */}
        <Box
          sx={{
            p: 2.5,
            bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
            borderRadius: 'var(--radius-card-lg, 24px)',
            mb: 3
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 600,
              color: 'var(--accent-primary, #7C4DFF)',
              mb: 1.5
            }}
          >
            📊 Current Status
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography variant="body2" sx={{ color: 'var(--text-primary, #1A1A1E)' }}>
              <strong>Current Participants:</strong> {submissionCount}
            </Typography>
            {activeTier && (
              <>
                <Typography variant="body2" sx={{ color: 'var(--text-primary, #1A1A1E)' }}>
                  <strong>Active Tier:</strong> {formatTierRange(activeTier)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-primary, #1A1A1E)' }}>
                  <strong>Current Budget Pool:</strong> {activeTier.budget_tokens.toLocaleString()} {tokenSymbol} (~${activeTier.budget_usd.toFixed(0)})
                </Typography>
                {tierEstimate && (
                  <Typography variant="body2" sx={{ color: 'var(--accent-primary, #7C4DFF)', fontWeight: 600 }}>
                    <strong>Est. Payment Per Person:</strong> ~{tierEstimate.tokensPerPerson.toFixed(0)} {tokenSymbol} (~${tierEstimate.usdPerPerson.toFixed(2)})
                  </Typography>
                )}
              </>
            )}
          </Box>
        </Box>

        {/* Next tier incentive */}
        {nextTier && campaignPhase === 'open' && (
          <Alert
            severity="info"
            sx={{
              mb: 3,
              borderRadius: 'var(--radius-card-lg, 24px)',
              '& .MuiAlert-message': { fontFamily: 'var(--font-body, Satoshi, sans-serif)' }
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              🚀 {nextTier.participantsNeeded} more participant{nextTier.participantsNeeded !== 1 ? 's' : ''} needed to unlock{' '}
              <strong>{nextTier.tier.budget_tokens.toLocaleString()} {tokenSymbol}</strong> budget tier!
            </Typography>
            <LinearProgress
              variant="determinate"
              value={((activeTier?.max_participants || submissionCount) - (activeTier?.min_participants || 0)) / 
                     ((nextTier.tier.min_participants || 1) - (activeTier?.min_participants || 0)) * 100}
              sx={{
                mt: 1,
                height: 6,
                borderRadius: 1,
                bgcolor: 'rgba(33, 150, 243, 0.2)',
                '& .MuiLinearProgress-bar': { bgcolor: '#2196F3', borderRadius: 1 }
              }}
            />
          </Alert>
        )}

        {/* Requirements */}
        {job.social_min_followers_required && job.social_min_followers_required > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="body2"
              sx={{
                color: 'var(--text-primary, #1A1A1E)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              👥 <strong>Minimum Followers Required:</strong> {job.social_min_followers_required.toLocaleString()}+
            </Typography>
          </Box>
        )}

        {/* Timeline */}
        <Box>
          <Typography
            variant="subtitle2"
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)',
              mb: 2
            }}
          >
            ⏰ Timeline
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {now < submissionDeadline ? (
                <AccessTimeIcon sx={{ fontSize: 16, color: 'var(--accent-warning, #FFC857)' }} />
              ) : (
                <CheckCircleIcon sx={{ fontSize: 16, color: 'var(--accent-success, #36C170)' }} />
              )}
              <Typography variant="body2" sx={{ color: 'var(--text-secondary, #6F7280)' }}>
                <strong>Submit by:</strong> {format(submissionDeadline, 'MMM dd, yyyy h:mm a')}
                {now < submissionDeadline && (
                  <span style={{ color: 'var(--accent-warning, #FFC857)', marginLeft: 8 }}>
                    ({formatDistanceToNow(submissionDeadline, { addSuffix: true }).replace('in ', '')} left)
                  </span>
                )}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {now < engagementDeadline ? (
                <AccessTimeIcon sx={{ fontSize: 16, color: 'var(--text-muted, #A3A7B5)' }} />
              ) : (
                <CheckCircleIcon sx={{ fontSize: 16, color: 'var(--accent-success, #36C170)' }} />
              )}
              <Typography variant="body2" sx={{ color: 'var(--text-secondary, #6F7280)' }}>
                <strong>Engagement period ends:</strong> {format(engagementDeadline, 'MMM dd, yyyy h:mm a')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {now < reviewDeadline ? (
                <AccessTimeIcon sx={{ fontSize: 16, color: 'var(--text-muted, #A3A7B5)' }} />
              ) : (
                <CheckCircleIcon sx={{ fontSize: 16, color: 'var(--accent-success, #36C170)' }} />
              )}
              <Typography variant="body2" sx={{ color: 'var(--text-secondary, #6F7280)' }}>
                <strong>Review deadline:</strong> {format(reviewDeadline, 'MMM dd, yyyy h:mm a')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LockIcon sx={{ fontSize: 16, color: 'var(--accent-primary, #7C4DFF)' }} />
              <Typography variant="body2" sx={{ color: 'var(--accent-primary, #7C4DFF)', fontWeight: 600 }}>
                <strong>Expected payment:</strong> {format(reviewDeadline, 'MMM dd, yyyy')}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

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
            { step: 3, text: 'Wait 24 hours for engagement to accumulate' },
            { step: 4, text: 'Poster reviews submissions (48 hour window)' },
            { step: 5, text: 'Payment distributed proportionally by post reach & engagement' }
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
          severity="warning"
          sx={{
            mt: 3,
            borderRadius: 'var(--radius-card-lg, 24px)',
            '& .MuiAlert-message': { fontFamily: 'var(--font-body, Satoshi, sans-serif)' }
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            ⚠️ <strong>Important:</strong> Report accurate follower count (used for eligibility verification).
            Final payment is based on your post's reach and engagement metrics.
          </Typography>
        </Alert>
      </Paper>

      {/* Submit Button */}
      {canSubmit && (
        <Paper
          sx={{
            p: 'var(--space-lg, 24px)',
            mb: 3,
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
            mb: 3,
            borderRadius: 'var(--radius-card-lg, 24px)',
            '& .MuiAlert-message': { fontFamily: 'var(--font-body, Satoshi, sans-serif)' }
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            🔗 Connect your wallet to participate in this campaign.
          </Typography>
        </Alert>
      )}

      {/* Submit Social Participation Modal */}
      {publicKey && (
        <SubmitSocialParticipationModal
          open={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          job={{
            id: job.id,
            title: job.title,
            social_job_type: job.social_job_type as 'retweet' | 'original_tweet',
            social_tweet_url: job.social_tweet_url,
            social_min_followers_required: job.social_min_followers_required
          }}
          userWallet={publicKey.toString()}
          onSubmissionSuccess={handleSubmissionSuccess}
        />
      )}
    </Box>
  )
}

