'use client'

import { Box, Typography, Paper, Chip, LinearProgress, Button, Alert, CircularProgress } from '@mui/material'
import { Database } from '@/types/database'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import PeopleIcon from '@mui/icons-material/People'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'

type Job = Database['public']['Tables']['jobs']['Row']

interface ContestJobSidebarProps {
  job: Job
  submissionCount: number
  tokenSymbol?: string
  // Submit entry props
  userWallet?: string
  hasSubmitted?: boolean
  checkingEligibility?: boolean
  onSubmitClick?: () => void
}

export default function ContestJobSidebar({ 
  job, 
  submissionCount,
  tokenSymbol = 'tokens',
  userWallet,
  hasSubmitted = false,
  checkingEligibility = false,
  onSubmitClick
}: ContestJobSidebarProps) {
  
  // Time remaining calculation
  const getTimeRemaining = () => {
    if (!job.contest_submission_deadline) return { text: 'No deadline', expired: false, progress: 0 }
    
    const now = new Date()
    const deadline = new Date(job.contest_submission_deadline)
    const diffMs = deadline.getTime() - now.getTime()
    
    if (diffMs < 0) return { text: 'Closed', expired: true, progress: 100 }
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    // Calculate progress
    const totalDuration = deadline.getTime() - new Date(job.created_at).getTime()
    const elapsed = now.getTime() - new Date(job.created_at).getTime()
    const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100))
    
    if (days > 1) return { text: `${days}d ${hours}h remaining`, expired: false, progress }
    if (days === 1) return { text: `1d ${hours}h remaining`, expired: false, progress }
    if (hours > 0) return { text: `${hours}h remaining`, expired: false, progress }
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return { text: `${minutes}m remaining`, expired: false, progress }
  }

  const timeInfo = getTimeRemaining()
  
  // Calculate total prize pool
  const prizeBreakdown = Array.isArray(job.contest_winner_prizes)
    ? (job.contest_winner_prizes as Array<{ position: number; amount_tokens: number; amount_usd: number }>)
    : []
  
  const totalPrizePool = prizeBreakdown.reduce((sum, p) => sum + (p.amount_tokens || 0), 0)

  // Contest status
  const getContestStatus = (): { status: string; color: string } => {
    if (job.contest_winners_selected_at && job.status === 'completed') {
      return { status: 'Completed', color: '#9E9E9E' }
    }
    if (job.contest_winners_selected_at) {
      return { status: 'Winners Selected', color: '#2196F3' }
    }
    if (timeInfo.expired) {
      return { status: 'Judging', color: '#FF9800' }
    }
    return { status: 'Accepting Submissions', color: '#4CAF50' }
  }

  const { status, color } = getContestStatus()

  return (
    <Box className="space-y-4">
      {/* Status Badge */}
      <Paper sx={{ p: 2.5, borderRadius: 'var(--radius-card, 16px)' }}>
        <Chip
          label={status}
          sx={{
            backgroundColor: color,
            color: 'white',
            fontWeight: 600,
            fontSize: '13px',
            width: '100%',
            height: '32px',
            '& .MuiChip-label': {
              px: 0
            }
          }}
        />
        
        {!timeInfo.expired && !job.contest_winners_selected_at && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon sx={{ fontSize: 14, color: '#FFC857' }} />
                <Typography 
                  sx={{ 
                    fontSize: '12px',
                    color: '#6F7280',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                  }}
                >
                  Deadline
                </Typography>
              </Box>
              <Typography 
                sx={{ 
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#1A1A1E',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                }}
              >
                {timeInfo.text}
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate"
              value={timeInfo.progress}
              sx={{
                height: 6,
                borderRadius: 1,
                bgcolor: 'rgba(255, 200, 87, 0.2)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: 'var(--accent-warning, #FFC857)',
                  borderRadius: 1
                }
              }}
            />
          </Box>
        )}
      </Paper>

      {/* Prize Pool */}
      <Paper sx={{ 
        p: 2.5, 
        borderRadius: 'var(--radius-card, 16px)',
        border: '2px solid var(--accent-primary, #7C4DFF)',
        background: 'linear-gradient(135deg, rgba(124, 77, 255, 0.05) 0%, rgba(227, 240, 111, 0.05) 100%)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Typography 
            sx={{ 
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#7C4DFF',
              fontWeight: 600,
              fontFamily: 'var(--font-body, Satoshi, sans-serif)'
            }}
          >
            🏆 Total Prize Pool
          </Typography>
        </Box>
        <Typography 
          sx={{ 
            fontSize: '32px',
            fontWeight: 700,
            color: '#7C4DFF',
            lineHeight: 1,
            mb: 0.5,
            fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)'
          }}
        >
          {totalPrizePool.toLocaleString()}
        </Typography>
        <Typography 
          sx={{ 
            fontSize: '12px',
            color: '#6F7280',
            fontFamily: 'var(--font-body, Satoshi, sans-serif)'
          }}
        >
          {tokenSymbol} · Split between {job.contest_max_winners || 1} winner{(job.contest_max_winners || 1) !== 1 ? 's' : ''}
        </Typography>

        {/* Prize Breakdown - Compact */}
        {prizeBreakdown.length > 0 && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(124, 77, 255, 0.2)' }}>
            {prizeBreakdown.slice(0, 3).map((prize) => (
              <Box 
                key={prize.position}
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1,
                  '&:last-child': { mb: 0 }
                }}
              >
                <Typography 
                  sx={{ 
                    fontSize: '13px',
                    color: '#6F7280',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5
                  }}
                >
                  {prize.position === 1 ? '🥇' : 
                   prize.position === 2 ? '🥈' : 
                   prize.position === 3 ? '🥉' : 
                   `#${prize.position}`}
                  <span>
                    {prize.position === 1 ? '1st' :
                     prize.position === 2 ? '2nd' :
                     prize.position === 3 ? '3rd' :
                     `${prize.position}th`}
                  </span>
                </Typography>
                <Typography 
                  sx={{ 
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#7C4DFF',
                    fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)'
                  }}
                >
                  {prize.amount_tokens.toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      {/* Stats */}
      <Paper sx={{ p: 2.5, borderRadius: 'var(--radius-card, 16px)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ textAlign: 'center', flex: 1 }}>
            <PeopleIcon sx={{ fontSize: 20, color: '#7C4DFF', mb: 0.5 }} />
            <Typography 
              sx={{ 
                fontSize: '20px',
                fontWeight: 700,
                color: '#1A1A1E',
                fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)'
              }}
            >
              {submissionCount}
            </Typography>
            <Typography 
              sx={{ 
                fontSize: '11px',
                color: '#6F7280',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)'
              }}
            >
              Submissions
            </Typography>
          </Box>
          
          <Box sx={{ width: '1px', bgcolor: '#E5E7F0', mx: 1 }} />
          
          <Box sx={{ textAlign: 'center', flex: 1 }}>
            <EmojiEventsIcon sx={{ fontSize: 20, color: '#7C4DFF', mb: 0.5 }} />
            <Typography 
              sx={{ 
                fontSize: '20px',
                fontWeight: 700,
                color: '#1A1A1E',
                fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)'
              }}
            >
              {job.contest_max_winners || 1}
            </Typography>
            <Typography 
              sx={{ 
                fontSize: '11px',
                color: '#6F7280',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)'
              }}
            >
              Winners
            </Typography>
          </Box>
        </Box>

        <Box 
          sx={{ 
            pt: 2, 
            borderTop: '1px solid #E5E7F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1
          }}
        >
          {job.contest_submissions_visible ? 
            <VisibilityIcon sx={{ fontSize: 16, color: '#7C4DFF' }} /> :
            <VisibilityOffIcon sx={{ fontSize: 16, color: '#7C4DFF' }} />
          }
          <Typography 
            sx={{ 
              fontSize: '12px',
              fontWeight: 600,
              color: '#1A1A1E',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)'
            }}
          >
            {job.contest_submissions_visible ? 'Public' : 'Private'} Submissions
          </Typography>
        </Box>
      </Paper>

      {/* Winners Announcement (if applicable) */}
      {job.contest_winners_selected_at && (
        <Paper sx={{ 
          p: 2.5, 
          borderRadius: 'var(--radius-card, 16px)',
          bgcolor: 'rgba(54, 193, 112, 0.08)',
          border: '1px solid var(--accent-success, #36C170)'
        }}>
          <Typography 
            sx={{ 
              fontSize: '13px',
              fontWeight: 600,
              color: '#1A1A1E',
              mb: 0.5,
              fontFamily: 'var(--font-body, Satoshi, sans-serif)'
            }}
          >
            🎉 Winners Announced!
          </Typography>
          <Typography 
            sx={{ 
              fontSize: '11px',
              color: '#6F7280',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)'
            }}
          >
            {new Date(job.contest_winners_selected_at).toLocaleDateString()}
          </Typography>
          {job.status === 'completed' && (
            <Typography 
              sx={{ 
                fontSize: '11px',
                color: '#36C170',
                mt: 0.5,
                fontFamily: 'var(--font-body, Satoshi, sans-serif)'
              }}
            >
              ✓ Prizes distributed
            </Typography>
          )}
        </Paper>
      )}

      {/* Submit Entry Action */}
      {checkingEligibility ? (
        <Button
          fullWidth
          variant="contained"
          disabled
          sx={{ 
            bgcolor: 'var(--accent-primary, #7C4DFF)', 
            py: 1.5,
            borderRadius: 'var(--radius-card, 16px)',
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: '15px',
            fontWeight: 600,
            textTransform: 'none'
          }}
        >
          <CircularProgress size={20} sx={{ color: 'white' }} />
        </Button>
      ) : (() => {
        // Check eligibility
        const isPoster = userWallet === job.poster_wallet
        const deadlinePassed = !job.contest_submission_deadline || new Date() > new Date(job.contest_submission_deadline)
        const canSubmitToContest = userWallet && 
          !hasSubmitted && 
          !isPoster &&
          !deadlinePassed &&
          job.status === 'open'
        
        if (canSubmitToContest && onSubmitClick) {
          return (
            <Button
              fullWidth
              variant="contained"
              onClick={onSubmitClick}
              sx={{
                bgcolor: 'var(--accent-primary, #7C4DFF)',
                color: 'white',
                py: 1.5,
                borderRadius: 'var(--radius-card, 16px)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '15px',
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: 'var(--shadow-chip, 0 8px 20px 0 rgba(15, 23, 42, 0.08))',
                '&:hover': {
                  bgcolor: '#6B3FE6',
                  boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
                }
              }}
            >
              🏆 Submit Your Entry
            </Button>
          )
        } else if (userWallet || hasSubmitted) {
          // Show reason why can't submit
          let reason = ''
          let severity: 'success' | 'warning' | 'info' = 'warning'
          
          if (!userWallet) {
            reason = 'Connect wallet to submit'
          } else if (hasSubmitted) {
            reason = 'You have already submitted to this contest'
            severity = 'success'
          } else if (isPoster) {
            reason = 'You cannot submit to your own contest'
          } else if (deadlinePassed) {
            reason = 'Submission deadline has passed'
          } else if (job.status !== 'open') {
            reason = 'This contest is no longer accepting submissions'
          }

          if (reason) {
            return (
              <Alert 
                severity={severity}
                sx={{
                  borderRadius: 'var(--radius-card, 16px)',
                  fontSize: '13px',
                  '& .MuiAlert-message': {
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: '13px'
                  }
                }}
              >
                {reason}
                {hasSubmitted && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      display: 'block', 
                      mt: 0.5,
                      fontSize: '11px',
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                    }}
                  >
                    View your submission in the gallery below
                  </Typography>
                )}
              </Alert>
            )
          }
        }
        
        return null
      })()}
    </Box>
  )
}

