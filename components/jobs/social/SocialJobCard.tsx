'use client'

import { useState, useEffect } from 'react'
import { 
  Card, 
  CardContent, 
  Box, 
  Typography, 
  Button,
  Divider,
  Chip
} from '@mui/material'
import { Database } from '@/types/database'
import { BudgetTier } from '@/types/social-jobs'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

type Job = Database['public']['Tables']['jobs']['Row']

interface SocialJobCardProps {
  job: Job
  onApply: () => void
  hasApplied?: boolean
}

/**
 * Calculate time remaining until campaign deadline
 * Returns formatted object with days, hours, minutes
 */
function calculateTimeRemaining(endDate: Date): {
  days: number
  hours: number
  minutes: number
  total_hours: number
  hasEnded: boolean
} {
  const now = new Date()
  const diff = endDate.getTime() - now.getTime()
  
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, total_hours: 0, hasEnded: true }
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const total_hours = Math.floor(diff / (1000 * 60 * 60))
  
  return { days, hours, minutes, total_hours, hasEnded: false }
}

/**
 * Format time remaining for display
 */
function formatTimeRemaining(time: ReturnType<typeof calculateTimeRemaining>): string {
  if (time.hasEnded) return 'Campaign ended'
  
  if (time.days > 1) {
    return `${time.days} days ${time.hours} hours remaining`
  }
  
  if (time.days === 1) {
    return `1 day ${time.hours} hours remaining`
  }
  
  if (time.hours > 1) {
    return `${time.hours} hours remaining`
  }
  
  if (time.hours === 1) {
    return `1 hour ${time.minutes} minutes remaining`
  }
  
  return `${time.minutes} minutes remaining`
}

/**
 * Format follower range for tier display
 */
function formatFollowerRange(tier: BudgetTier): string {
  const formatNum = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
    return num.toString()
  }
  
  if (tier.max_followers === null) {
    return `${formatNum(tier.min_followers)}+`
  }
  
  return `${formatNum(tier.min_followers)}-${formatNum(tier.max_followers)}`
}

export default function SocialJobCard({ job, onApply, hasApplied = false }: SocialJobCardProps) {
  // Parse budget tiers from JSONB
  const budgetTiers: BudgetTier[] = Array.isArray(job.social_budget_tiers)
    ? (job.social_budget_tiers as BudgetTier[])
    : []
  
  // Calculate budget remaining
  const totalBudget = job.social_total_budget_usd || 0
  const budgetReleased = job.social_actual_budget_released || 0
  const budgetRemaining = totalBudget - budgetReleased
  const budgetLow = budgetRemaining < 50
  
  // Parse campaign end date
  const endDate = job.social_submission_deadline 
    ? new Date(job.social_submission_deadline)
    : null
  
  // Countdown timer state
  const [timeRemaining, setTimeRemaining] = useState(
    endDate ? calculateTimeRemaining(endDate) : null
  )
  
  // Update countdown every minute
  useEffect(() => {
    if (!endDate) return
    
    const timer = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(endDate))
    }, 60000) // Update every minute
    
    return () => clearInterval(timer)
  }, [endDate])
  
  // Determine if campaign is urgent (< 24 hours)
  const isUrgent = timeRemaining ? timeRemaining.total_hours < 24 : false
  const hasEnded = timeRemaining?.hasEnded || false
  
  // Check if high budget (show fire emoji)
  const isHighBudget = budgetRemaining >= 200
  
  return (
    <Card
      sx={{
        background: 'var(--card-background, #FFFFFF)',
        borderRadius: 'var(--radius-card-lg, 24px)',
        boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))',
        padding: 'var(--space-lg, 24px)',
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
        },
        '@media (max-width: 640px)': {
          padding: 'var(--space-md, 16px)',
        }
      }}
    >
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        {/* Header - Title */}
        <Typography
          className="text-title"
          sx={{
            mb: 3,
            fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
            fontSize: 'var(--text-title, 22px)',
            fontWeight: 600,
            color: 'var(--text-primary, #1A1A1E)',
            lineHeight: 1.4,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap'
          }}
        >
          {isHighBudget && '🔥'}
          {job.title}
        </Typography>
        
        {/* Budget & Time Row */}
        <Box 
          sx={{ 
            display: 'flex', 
            gap: 3, 
            mb: 3,
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'flex-start' }
          }}
        >
          {/* Budget Display */}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <MonetizationOnIcon 
                sx={{ 
                  fontSize: 18, 
                  color: 'var(--accent-success, #36C170)' 
                }} 
              />
              <Typography
                variant="caption"
                sx={{
                  color: 'var(--text-secondary, #6F7280)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                Budget
              </Typography>
            </Box>
            <Typography
              className="text-body"
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: 'var(--text-body, 16px)',
                fontWeight: 600,
                color: budgetLow ? '#EF4444' : 'var(--text-primary, #1A1A1E)',
              }}
            >
              ${budgetRemaining.toFixed(0)} remaining
              <Typography
                component="span"
                sx={{
                  color: 'var(--text-muted, #A3A7B5)',
                  fontWeight: 400,
                  ml: 0.5
                }}
              >
                (of ${totalBudget.toFixed(0)})
              </Typography>
            </Typography>
          </Box>
          
          {/* Time Remaining */}
          {timeRemaining && (
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <AccessTimeIcon 
                  sx={{ 
                    fontSize: 18, 
                    color: hasEnded 
                      ? 'var(--text-muted, #A3A7B5)'
                      : isUrgent 
                        ? '#EF4444' 
                        : 'var(--accent-warning, #FFC857)' 
                  }} 
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'var(--text-secondary, #6F7280)',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: '12px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {hasEnded ? 'Status' : 'Ends In'}
                </Typography>
              </Box>
              <Typography
                className="text-body"
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: 'var(--text-body, 16px)',
                  fontWeight: 600,
                  color: hasEnded 
                    ? 'var(--text-muted, #A3A7B5)'
                    : isUrgent 
                      ? '#EF4444' 
                      : 'var(--text-primary, #1A1A1E)',
                }}
              >
                {formatTimeRemaining(timeRemaining)}
              </Typography>
            </Box>
          )}
        </Box>
        
        <Divider sx={{ my: 3 }} />
        
        {/* Payment Tiers */}
        <Box sx={{ mb: 3 }}>
          <Typography
            sx={{
              mb: 2,
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body, 16px)',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            💰 Payment Based on Followers:
          </Typography>
          
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 1,
              pl: 2
            }}
          >
            {budgetTiers.map((tier, index) => (
              <Typography
                key={index}
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '14px',
                  color: 'var(--text-secondary, #6F7280)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <span style={{ color: 'var(--accent-primary, #7C4DFF)' }}>•</span>
                <span style={{ minWidth: '80px', display: 'inline-block' }}>
                  {formatFollowerRange(tier)}:
                </span>
                <span style={{ 
                  fontWeight: 600, 
                  color: 'var(--text-primary, #1A1A1E)' 
                }}>
                  ${tier.price_usd.toFixed(0)}
                </span>
              </Typography>
            ))}
          </Box>
        </Box>
        
        {/* Impression Bonus - Always show for social jobs */}
        <Box
          sx={{
            mb: 3,
            p: 2,
            borderRadius: 'var(--radius-card-lg, 12px)',
            background: 'var(--accent-primary-soft, #EEE7FF)',
            border: '1px solid rgba(124, 77, 255, 0.2)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <TrendingUpIcon 
              sx={{ 
                fontSize: 18, 
                color: 'var(--accent-primary, #7C4DFF)' 
              }} 
            />
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--accent-primary, #7C4DFF)',
              }}
            >
              🎁 Bonus: +$5 per 1,000 impressions
            </Typography>
          </Box>
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '12px',
              color: 'var(--text-secondary, #6F7280)',
              fontStyle: 'italic'
            }}
          >
            (if poster adds impression counts during review)
          </Typography>
        </Box>
        
        <Divider sx={{ my: 3 }} />
        
        {/* Requirements Section */}
        <Box sx={{ mb: 3 }}>
          <Typography
            sx={{
              mb: 2,
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body, 16px)',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)',
            }}
          >
            Requirements:
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 0 }}>
            {/* Retweet requirement */}
            {job.social_job_type === 'retweet' && job.social_tweet_url && (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <span style={{ color: 'var(--accent-primary, #7C4DFF)', marginTop: '2px' }}>•</span>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: '14px',
                    color: 'var(--text-secondary, #6F7280)',
                    flex: 1
                  }}
                >
                  Retweet this tweet:{' '}
                  <a 
                    href={job.social_tweet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--accent-primary, #7C4DFF)',
                      textDecoration: 'underline',
                      fontWeight: 500
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    View Tweet
                  </a>
                </Typography>
              </Box>
            )}
            
            {/* Original tweet requirement */}
            {job.social_job_type === 'original_tweet' && job.social_tweet_topic && (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <span style={{ color: 'var(--accent-primary, #7C4DFF)', marginTop: '2px' }}>•</span>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: '14px',
                    color: 'var(--text-secondary, #6F7280)',
                    flex: 1
                  }}
                >
                  Create original tweet about:{' '}
                  <span style={{ fontWeight: 600, color: 'var(--text-primary, #1A1A1E)' }}>
                    {job.social_tweet_topic}
                  </span>
                </Typography>
              </Box>
            )}
            
            {/* Campaign guidelines */}
            {job.description && (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <span style={{ color: 'var(--accent-primary, #7C4DFF)', marginTop: '2px' }}>•</span>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: '14px',
                    color: 'var(--text-secondary, #6F7280)',
                    flex: 1
                  }}
                >
                  {job.description.length > 100 
                    ? `${job.description.substring(0, 100)}...` 
                    : job.description
                  }
                </Typography>
              </Box>
            )}
            
            {/* Engagement deadline */}
            {job.social_engagement_deadline && (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <span style={{ color: 'var(--accent-primary, #7C4DFF)', marginTop: '2px' }}>•</span>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: '14px',
                    color: 'var(--text-secondary, #6F7280)',
                    flex: 1
                  }}
                >
                  Keep tweet live until{' '}
                  <span style={{ fontWeight: 600 }}>
                    {new Date(job.social_engagement_deadline).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
        
        {/* Apply Button */}
        <Button
          variant="contained"
          fullWidth
          disabled={hasApplied || hasEnded || budgetRemaining <= 0}
          onClick={onApply}
          startIcon={hasApplied ? <CheckCircleIcon /> : undefined}
          sx={{
            mt: 2,
            py: 1.5,
            borderRadius: 'var(--radius-control, 999px)',
            textTransform: 'none',
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: '16px',
            fontWeight: 600,
            background: hasApplied 
              ? 'var(--text-muted, #A3A7B5)'
              : 'var(--accent-primary, #7C4DFF)',
            color: '#FFFFFF',
            boxShadow: hasApplied 
              ? 'none'
              : '0 4px 12px rgba(124, 77, 255, 0.3)',
            '&:hover': {
              background: hasApplied 
                ? 'var(--text-muted, #A3A7B5)'
                : '#6A3FE8',
              boxShadow: hasApplied 
                ? 'none'
                : '0 6px 16px rgba(124, 77, 255, 0.4)',
            },
            '&:disabled': {
              background: 'var(--border-subtle, #E5E7F0)',
              color: 'var(--text-muted, #A3A7B5)',
            }
          }}
        >
          {hasEnded 
            ? 'Campaign Ended'
            : budgetRemaining <= 0
              ? 'Budget Exhausted'
              : hasApplied 
                ? 'Already Applied'
                : 'Apply to Campaign'
          }
        </Button>
        
        {/* Helper text for applied state */}
        {hasApplied && !hasEnded && (
          <Typography
            sx={{
              mt: 1,
              textAlign: 'center',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '12px',
              color: 'var(--text-muted, #A3A7B5)',
            }}
          >
            You've already submitted to this campaign
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

