'use client'

import { Card, CardContent, Box, Typography, Chip, LinearProgress } from '@mui/material'
import { Database } from '@/types/database'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PeopleIcon from '@mui/icons-material/People'
import { useRouter } from 'next/navigation'
import { usePosterDisplayName } from '@/lib/usePosterDisplayName'

type Job = Database['public']['Tables']['jobs']['Row']

interface ContestJobCardProps {
  job: Job
  submissionCount?: number
  projectName?: string
  tokenSymbol?: string
}

export default function ContestJobCard({ 
  job, 
  submissionCount = 0, 
  projectName,
  tokenSymbol = 'tokens'
}: ContestJobCardProps) {
  const router = useRouter()
  const { displayNameOrWallet, hasDisplayName } = usePosterDisplayName(job.poster_wallet)

  // Don't render regular jobs - use RegularJobCard instead
  if (!job.is_contest) {
    console.warn('ContestJobCard: Attempted to render a non-contest job. Use RegularJobCard instead.')
    return null
  }

  // Calculate time remaining until submission deadline
  const getTimeRemaining = () => {
    if (!job.contest_submission_deadline) return 'No deadline'
    
    const now = new Date()
    const deadline = new Date(job.contest_submission_deadline)
    const diffMs = deadline.getTime() - now.getTime()
    
    if (diffMs < 0) return 'Submissions closed'
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (days > 0) return `${days}d ${hours}h remaining`
    return `${hours}h remaining`
  }

  // Calculate total prize pool from contest_winner_prizes JSON array
  const totalPrizePool = Array.isArray(job.contest_winner_prizes)
    ? (job.contest_winner_prizes as Array<{ position: number; amount_tokens: number; amount_usd: number }>)
        .reduce((sum, prize) => sum + (prize.amount_tokens || 0), 0)
    : 0

  // Get prize breakdown array
  const prizeBreakdown = Array.isArray(job.contest_winner_prizes)
    ? (job.contest_winner_prizes as Array<{ position: number; amount_tokens: number; amount_usd: number }>)
    : []

  // Get contest status
  const getContestStatus = (): 'open' | 'judging' | 'judging_complete' | 'completed' | 'cancelled' => {
    // Check if job is cancelled
    if (job.status === 'cancelled') return 'cancelled'
    
    // Check if contest is fully completed (winners selected + prizes distributed)
    if (job.contest_winners_selected_at && job.status === 'completed') return 'completed'
    
    // Check if winners have been selected but prizes not yet distributed
    if (job.contest_winners_selected_at) return 'judging_complete'
    
    if (!job.contest_submission_deadline) return 'open'
    
    const now = new Date()
    const submissionDeadline = new Date(job.contest_submission_deadline)
    
    // If past submission deadline, in judging phase
    if (now > submissionDeadline) return 'judging'
    
    return 'open'
  }

  const contestStatus = getContestStatus()
  const timeRemaining = getTimeRemaining()

  // Status colors following design system
  const statusColors: Record<string, { bg: string; text: string }> = {
    open: { bg: '#4CAF50', text: '#FFFFFF' },           // Green - accepting submissions
    judging: { bg: '#FF9800', text: '#FFFFFF' },        // Orange - submissions closed, judging
    judging_complete: { bg: '#2196F3', text: '#FFFFFF' }, // Blue - winners selected, pending payout
    completed: { bg: '#9E9E9E', text: '#FFFFFF' },      // Gray - fully completed
    cancelled: { bg: '#EF4444', text: '#FFFFFF' }       // Red - cancelled
  }

  // Category colors (matching existing job system)
  const categoryColors: Record<string, { bg: string; text: string }> = {
    design: { bg: '#EEE7FF', text: '#7C4DFF' },
    marketing: { bg: '#E3F8ED', text: '#36C170' },
    development: { bg: '#E8F4FF', text: '#2563EB' },
    content: { bg: '#FFF4E6', text: '#FB923C' },
    community: { bg: '#FCE7F3', text: '#EC4899' },
    other: { bg: '#F3F4F6', text: '#6B7280' }
  }

  // Check if cancelled for styling
  const isCancelled = contestStatus === 'cancelled'

  return (
    <Card 
      sx={{
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        borderRadius: 'var(--radius-card-lg, 24px)',
        border: isCancelled 
          ? '2px solid var(--border-subtle, #E5E7F0)' 
          : '2px solid var(--accent-primary, #7C4DFF)',
        boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))',
        bgcolor: 'var(--card-background, #FFFFFF)',
        position: 'relative',
        overflow: 'hidden',
        opacity: isCancelled ? 0.7 : 1,
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: isCancelled 
            ? '0 24px 48px rgba(0, 0, 0, 0.1)'
            : '0 24px 48px rgba(124, 77, 255, 0.2)',
        }
      }}
      onClick={() => router.push(`/project/${job.project_id}/jobs/${job.id}`)}
    >
      {/* Hot Contest Badge */}
      {submissionCount >= 10 && (
        <Chip
          label="🔥 Hot Contest"
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
        {/* Contest Badge & Status */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Chip 
            icon={<EmojiEventsIcon />}
            label="CONTEST"
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
            label={contestStatus.toUpperCase().replace('_', ' ')}
            size="small"
            sx={{
              bgcolor: statusColors[contestStatus]?.bg || '#9E9E9E',
              color: statusColors[contestStatus]?.text || '#FFFFFF',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 600,
              fontSize: '11px',
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

        {/* Description Preview */}
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'var(--text-secondary, #6F7280)',
            mb: 2,
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: 'var(--text-body-small, 14px)',
            lineHeight: 1.6,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '2.8em'
          }}
        >
          {job.description}
        </Typography>

        {/* Prize Pool Section */}
        <Box sx={{ 
          bgcolor: 'var(--accent-primary-soft, #EEE7FF)', 
          borderRadius: 2, 
          p: 2, 
          mb: 2 
        }}>
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
            🏆 Total Prize Pool
          </Typography>
          <Typography 
            sx={{ 
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontWeight: 700, 
              color: 'var(--accent-primary, #7C4DFF)', 
              fontSize: '24px',
              mb: 1,
              lineHeight: 1.2
            }}
          >
            {totalPrizePool.toLocaleString()} {tokenSymbol}
          </Typography>
          
          {/* Prize Breakdown */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {prizeBreakdown.slice(0, 3).map((prize) => (
              <Chip
                key={prize.position}
                label={`${prize.position === 1 ? '🥇' : prize.position === 2 ? '🥈' : '🥉'} ${prize.amount_tokens.toLocaleString()}`}
                size="small"
                sx={{ 
                  bgcolor: 'var(--card-background, #FFFFFF)',
                  border: '1px solid var(--accent-primary, #7C4DFF)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontWeight: 500,
                  fontSize: '12px',
                  borderRadius: 'var(--radius-control, 999px)',
                }}
              />
            ))}
            {job.contest_max_winners && job.contest_max_winners > 3 && (
              <Chip
                label={`+${job.contest_max_winners - 3} more`}
                size="small"
                sx={{ 
                  bgcolor: 'var(--card-background, #FFFFFF)', 
                  border: '1px solid var(--border-subtle, #E5E7F0)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '12px',
                  borderRadius: 'var(--radius-control, 999px)',
                }}
              />
            )}
          </Box>
        </Box>

        {/* Stats Row */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Submission Count - Enhanced */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            bgcolor: submissionCount > 0 ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            border: submissionCount > 0 ? '1px solid #4CAF50' : 'none'
          }}>
            <PeopleIcon sx={{ 
              fontSize: 20, 
              color: submissionCount > 0 ? '#4CAF50' : 'var(--text-secondary, #6F7280)' 
            }} />
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
                ? 'No submissions yet' 
                : `${submissionCount} submission${submissionCount !== 1 ? 's' : ''}`
              }
            </Typography>
          </Box>

          {/* Winners Count */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <EmojiEventsIcon sx={{ fontSize: 18, color: 'var(--text-secondary, #6F7280)' }} />
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'var(--text-secondary, #6F7280)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '14px',
              }}
            >
              {job.contest_max_winners || 1} winner{(job.contest_max_winners || 1) !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>

        {/* Time Remaining - Only show for open contests */}
        {contestStatus === 'open' && job.contest_submission_deadline && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <AccessTimeIcon sx={{ fontSize: 18, color: 'var(--accent-warning, #FFC857)' }} />
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontWeight: 600, 
                  color: 'var(--accent-warning, #FFC857)',
                  fontSize: '14px',
                }}
              >
                {timeRemaining}
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={Math.max(0, Math.min(100, 
                (1 - (new Date(job.contest_submission_deadline).getTime() - Date.now()) / 
                (7 * 24 * 60 * 60 * 1000)) * 100
              ))}
              sx={{
                height: 6,
                borderRadius: 1,
                bgcolor: 'rgba(255, 200, 87, 0.2)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: 'var(--accent-warning, #FFC857)',
                  borderRadius: 1,
                }
              }}
            />
          </Box>
        )}

        {/* Judging Status Message */}
        {contestStatus === 'judging' && (
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
              ⏳ Winner selection in progress
            </Typography>
          </Box>
        )}

        {/* Judging Complete Status Message */}
        {contestStatus === 'judging_complete' && (
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
              🏆 Winners selected - Awaiting payout
            </Typography>
          </Box>
        )}

        {/* Completed Status Message */}
        {contestStatus === 'completed' && (
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
              ✅ Contest complete - Prizes distributed
            </Typography>
          </Box>
        )}

        {/* Cancelled Status Message */}
        {contestStatus === 'cancelled' && (
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
              ❌ Contest cancelled
            </Typography>
          </Box>
        )}

        {/* Category Badge */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Chip
            label={job.category}
            size="small"
            sx={{ 
              bgcolor: categoryColors[job.category]?.bg || categoryColors.other.bg,
              color: categoryColors[job.category]?.text || categoryColors.other.text,
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 500,
              fontSize: '12px',
              textTransform: 'capitalize',
              borderRadius: 'var(--radius-control, 999px)',
            }}
          />
        </Box>
      </CardContent>
    </Card>
  )
}

