'use client'

import { Card, CardContent, Box, Typography, Chip, LinearProgress } from '@mui/material'
import { Database } from '@/types/database'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import CampaignIcon from '@mui/icons-material/Campaign'
import RepeatIcon from '@mui/icons-material/Repeat'
import CreateIcon from '@mui/icons-material/Create'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PeopleIcon from '@mui/icons-material/People'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { BudgetTier } from '@/types/social-media-jobs'
import { calculateActiveTier, formatTierRange, getNextTier } from '@/lib/social-media-jobs'
import { usePosterDisplayName } from '@/lib/usePosterDisplayName'

type Job = Database['public']['Tables']['jobs']['Row']

interface SocialMediaJobCardProps {
  job: Job
  submissionCount?: number
  projectName?: string
  tokenSymbol?: string
}

export default function SocialMediaJobCard({
  job,
  submissionCount = 0,
  projectName,
  tokenSymbol = 'tokens'
}: SocialMediaJobCardProps) {
  const router = useRouter()
  const { displayNameOrWallet, hasDisplayName } = usePosterDisplayName(job.poster_wallet)

  // Guard: Only render social media jobs
  if (!job.is_social_media_job) {
    console.warn('SocialMediaJobCard: Attempted to render a non-social-media job.')
    return null
  }

  // Parse budget tiers from JSON
  const budgetTiers: BudgetTier[] = Array.isArray(job.social_budget_tiers)
    ? (job.social_budget_tiers as BudgetTier[])
    : []

  // Calculate active tier based on current submissions
  const activeTier = calculateActiveTier(budgetTiers, submissionCount)
  const nextTierInfo = getNextTier(budgetTiers, submissionCount)

  // Calculate time remaining until submission deadline
  const getTimeRemaining = () => {
    if (!job.social_submission_deadline) return { text: 'No deadline', isExpired: false, isUrgent: false }

    const now = new Date()
    const deadline = new Date(job.social_submission_deadline)
    const diffMs = deadline.getTime() - now.getTime()

    if (diffMs < 0) return { text: 'Submissions closed', isExpired: true, isUrgent: false }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    const isUrgent = days === 0 && hours <= 12

    if (days > 0) return { text: `${days}d ${hours}h remaining`, isExpired: false, isUrgent }
    if (hours > 0) return { text: `${hours}h remaining`, isExpired: false, isUrgent }
    return { text: 'Ending soon!', isExpired: false, isUrgent: true }
  }

  const { text: timeRemaining, isExpired, isUrgent } = getTimeRemaining()

  // Calculate progress percentage toward next tier
  const getProgressToNextTier = () => {
    if (!nextTierInfo || !activeTier) return 100
    const currentTierSize = (activeTier.max_participants || submissionCount) - activeTier.min_participants + 1
    const progressInTier = submissionCount - activeTier.min_participants + 1
    return Math.min(100, (progressInTier / currentTierSize) * 100)
  }

  // Get campaign phase
  const getCampaignPhase = (): 'open' | 'engagement' | 'review' | 'completed' | 'cancelled' => {
    if (job.status === 'cancelled') return 'cancelled'
    if (job.social_payments_distributed) return 'completed'

    const now = new Date()

    if (job.social_submission_deadline && now > new Date(job.social_submission_deadline)) {
      if (job.social_engagement_deadline && now <= new Date(job.social_engagement_deadline)) {
        return 'engagement'
      }
      if (job.social_review_deadline && now <= new Date(job.social_review_deadline)) {
        return 'review'
      }
      return 'completed'
    }

    return 'open'
  }

  const campaignPhase = getCampaignPhase()

  // Status colors following design system
  const phaseColors: Record<string, { bg: string; text: string; label: string }> = {
    open: { bg: '#4CAF50', text: '#FFFFFF', label: 'OPEN FOR SUBMISSIONS' },
    engagement: { bg: '#FF9800', text: '#FFFFFF', label: 'ENGAGEMENT PERIOD' },
    review: { bg: '#2196F3', text: '#FFFFFF', label: 'UNDER REVIEW' },
    completed: { bg: '#9E9E9E', text: '#FFFFFF', label: 'COMPLETED' },
    cancelled: { bg: '#EF4444', text: '#FFFFFF', label: 'CANCELLED' }
  }

  // Budget display
  const minBudget = budgetTiers[0]?.budget_tokens || 0
  const maxBudget = job.social_total_budget_tokens || 0
  const minBudgetUsd = budgetTiers[0]?.budget_usd || 0
  const maxBudgetUsd = job.social_total_budget_usd || 0

  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        borderRadius: 'var(--radius-card-lg, 24px)',
        border: '2px solid var(--accent-primary, #7C4DFF)',
        boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))',
        bgcolor: 'var(--card-background, #FFFFFF)',
        position: 'relative',
        overflow: 'hidden',
        opacity: campaignPhase === 'cancelled' ? 0.7 : 1,
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 24px 48px rgba(124, 77, 255, 0.2)',
        }
      }}
      onClick={() => router.push(`/project/${job.project_id}/jobs/${job.id}`)}
    >
      {/* Hot Campaign Badge */}
      {submissionCount >= 10 && campaignPhase === 'open' && (
        <Chip
          label="🔥 Trending"
          size="small"
          sx={{
            bgcolor: '#FF5722',
            color: 'white',
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontWeight: 600,
            fontSize: '11px',
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 1,
            borderRadius: 'var(--radius-control, 999px)',
          }}
        />
      )}

      <CardContent sx={{ p: 'var(--space-lg, 24px)' }}>
        {/* Campaign Type Badge & Status */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {/* Social Media Badge */}
            <Chip
              icon={<CampaignIcon sx={{ fontSize: 16 }} />}
              label="SOCIAL CAMPAIGN"
              sx={{
                bgcolor: 'var(--accent-primary, #7C4DFF)',
                color: '#FFFFFF',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 600,
                fontSize: '11px',
                borderRadius: 'var(--radius-control, 999px)',
                '& .MuiChip-icon': { color: '#E3F06F' }
              }}
            />
            
            {/* Campaign Type Badge */}
            <Chip
              icon={job.social_job_type === 'retweet' ? <RepeatIcon sx={{ fontSize: 14 }} /> : <CreateIcon sx={{ fontSize: 14 }} />}
              label={job.social_job_type === 'retweet' ? 'RETWEET' : 'ORIGINAL'}
              size="small"
              sx={{
                bgcolor: 'rgba(227, 240, 111, 0.3)',
                color: 'var(--text-primary, #1A1A1E)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 500,
                fontSize: '11px',
                borderRadius: 'var(--radius-control, 999px)',
                '& .MuiChip-icon': { color: 'var(--text-primary, #1A1A1E)' }
              }}
            />
          </Box>
          
          {/* Phase Status */}
          <Chip
            label={phaseColors[campaignPhase]?.label || 'UNKNOWN'}
            size="small"
            sx={{
              bgcolor: phaseColors[campaignPhase]?.bg || '#9E9E9E',
              color: phaseColors[campaignPhase]?.text || '#FFFFFF',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 600,
              fontSize: '10px',
              borderRadius: 'var(--radius-control, 999px)',
            }}
          />
        </Box>

        {/* Title */}
        <Typography
          variant="h6"
          sx={{
            mb: 1,
            fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
            fontWeight: 600,
            fontSize: 'var(--text-headline, 18px)',
            color: 'var(--text-primary, #1A1A1E)',
            lineHeight: 1.4
          }}
        >
          {job.title}
        </Typography>

        {/* Posted By */}
        <Typography
          variant="caption"
          sx={{
            color: 'var(--text-secondary, #6F7280)',
            mb: 2,
            display: 'block',
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: 'var(--text-caption, 12px)',
          }}
        >
          by{' '}
          <span style={{ fontFamily: hasDisplayName ? 'inherit' : 'var(--font-mono, JetBrains Mono, monospace)' }}>
            {displayNameOrWallet}
          </span>
          {projectName && (
            <span style={{ color: 'var(--text-muted, #A3A7B5)' }}> • {projectName}</span>
          )}
        </Typography>

        {/* Budget Section */}
        <Box
          sx={{
            bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
            borderRadius: 2,
            p: 2,
            mb: 2
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'var(--text-secondary, #6F7280)',
              display: 'block',
              mb: 0.5,
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '12px',
            }}
          >
            💰 Budget Remaining
          </Typography>
          <Typography
            sx={{
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontWeight: 700,
              color: 'var(--accent-primary, #7C4DFF)',
              fontSize: '22px',
              lineHeight: 1.2
            }}
          >
            {(job.social_remaining_budget_tokens || 0).toLocaleString()} {tokenSymbol}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'var(--text-secondary, #6F7280)',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            }}
          >
            of {maxBudget.toLocaleString()} {tokenSymbol} total
          </Typography>

          {/* Budget Progress Bar */}
          <Box sx={{ mt: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'var(--text-secondary, #6F7280)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '11px',
                }}
              >
                Budget Used
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'var(--accent-primary, #7C4DFF)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontWeight: 600,
                  fontSize: '11px',
                }}
              >
                {maxBudget > 0 
                  ? Math.round(((maxBudget - (job.social_remaining_budget_tokens || 0)) / maxBudget) * 100)
                  : 0
                }%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={maxBudget > 0 
                ? ((maxBudget - (job.social_remaining_budget_tokens || 0)) / maxBudget) * 100
                : 0
              }
              sx={{
                height: 6,
                borderRadius: 1,
                bgcolor: 'rgba(124, 77, 255, 0.15)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: 'var(--accent-primary, #7C4DFF)',
                  borderRadius: 1,
                }
              }}
            />
          </Box>

          {/* Current Active Tier */}
          {activeTier && submissionCount > 0 && (
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(124, 77, 255, 0.2)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TrendingUpIcon sx={{ fontSize: 14, color: 'var(--accent-primary, #7C4DFF)' }} />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'var(--accent-primary, #7C4DFF)',
                    fontWeight: 600,
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  }}
                >
                  Active: {formatTierRange(activeTier)} → {activeTier.budget_tokens.toLocaleString()} {tokenSymbol}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* Stats Row */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Participant Count */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: submissionCount > 0 ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              border: submissionCount > 0 ? '1px solid #4CAF50' : 'none'
            }}
          >
            <PeopleIcon
              sx={{
                fontSize: 20,
                color: submissionCount > 0 ? '#4CAF50' : 'var(--text-secondary, #6F7280)'
              }}
            />
            <Typography
              variant="body2"
              sx={{
                fontWeight: submissionCount > 0 ? 600 : 400,
                color: submissionCount > 0 ? '#4CAF50' : 'var(--text-secondary, #6F7280)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '14px',
              }}
            >
              {submissionCount === 0
                ? 'Be the first!'
                : `${submissionCount} participant${submissionCount !== 1 ? 's' : ''}`
              }
            </Typography>
          </Box>

          {/* Min Followers Requirement */}
          {job.social_min_followers_required && job.social_min_followers_required > 0 && (
            <Typography
              variant="body2"
              sx={{
                color: 'var(--text-secondary, #6F7280)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '13px',
              }}
            >
              👥 {job.social_min_followers_required.toLocaleString()}+ followers required
            </Typography>
          )}
        </Box>

        {/* Next Tier Progress - Only show for open campaigns */}
        {campaignPhase === 'open' && nextTierInfo && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'var(--text-secondary, #6F7280)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                }}
              >
                {nextTierInfo.participantsNeeded} more to unlock next tier
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'var(--accent-primary, #7C4DFF)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontWeight: 500,
                }}
              >
                +{(nextTierInfo.tier.budget_tokens - (activeTier?.budget_tokens || 0)).toLocaleString()} {tokenSymbol}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={getProgressToNextTier()}
              sx={{
                height: 6,
                borderRadius: 1,
                bgcolor: 'rgba(124, 77, 255, 0.15)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: 'var(--accent-primary, #7C4DFF)',
                  borderRadius: 1,
                }
              }}
            />
          </Box>
        )}

        {/* Time Remaining - Only for open campaigns */}
        {campaignPhase === 'open' && job.social_submission_deadline && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <AccessTimeIcon
                sx={{
                  fontSize: 18,
                  color: isUrgent ? '#EF4444' : 'var(--accent-warning, #FFC857)'
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontWeight: 600,
                  color: isUrgent ? '#EF4444' : 'var(--accent-warning, #FFC857)',
                  fontSize: '14px',
                }}
              >
                {timeRemaining}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.max(0, Math.min(100,
                (1 - (new Date(job.social_submission_deadline).getTime() - Date.now()) /
                  (48 * 60 * 60 * 1000)) * 100
              ))}
              sx={{
                height: 6,
                borderRadius: 1,
                bgcolor: isUrgent ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 200, 87, 0.2)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: isUrgent ? '#EF4444' : 'var(--accent-warning, #FFC857)',
                  borderRadius: 1,
                }
              }}
            />
          </Box>
        )}

        {/* Phase-specific Messages */}
        {campaignPhase === 'engagement' && (
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'rgba(255, 152, 0, 0.15)',
              border: '1px solid rgba(255, 152, 0, 0.3)'
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 500,
                color: '#E65100',
                fontSize: '13px',
                textAlign: 'center'
              }}
            >
              ⏳ Engagement metrics being collected
            </Typography>
          </Box>
        )}

        {campaignPhase === 'review' && (
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'rgba(33, 150, 243, 0.15)',
              border: '1px solid rgba(33, 150, 243, 0.3)'
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 500,
                color: '#1565C0',
                fontSize: '13px',
                textAlign: 'center'
              }}
            >
              👀 Submissions under review
            </Typography>
          </Box>
        )}

        {campaignPhase === 'completed' && (
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'rgba(158, 158, 158, 0.15)',
              border: '1px solid rgba(158, 158, 158, 0.3)'
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 500,
                color: '#616161',
                fontSize: '13px',
                textAlign: 'center'
              }}
            >
              ✅ Campaign complete - Payments distributed
            </Typography>
          </Box>
        )}

        {campaignPhase === 'cancelled' && (
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 500,
                color: '#DC2626',
                fontSize: '13px',
                textAlign: 'center'
              }}
            >
              ❌ Campaign cancelled
            </Typography>
          </Box>
        )}

        {/* Footer: Payment Info */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pt: 2,
            borderTop: '1px solid var(--border-subtle, #E5E7F0)'
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'var(--text-muted, #A3A7B5)',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '12px',
            }}
          >
            💡 Payment based on post reach
          </Typography>

          {/* Call to action indicator */}
          {campaignPhase === 'open' && (
            <Chip
              label="Participate →"
              size="small"
              sx={{
                bgcolor: 'var(--accent-primary, #7C4DFF)',
                color: '#FFFFFF',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 600,
                fontSize: '11px',
                borderRadius: 'var(--radius-control, 999px)',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: '#6A3FE8'
                }
              }}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

