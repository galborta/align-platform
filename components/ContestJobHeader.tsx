'use client'

import { Box, Typography, Grid, Paper, LinearProgress } from '@mui/material'
import { Database } from '@/types/database'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PeopleIcon from '@mui/icons-material/People'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'

type Job = Database['public']['Tables']['jobs']['Row']

interface ContestJobHeaderProps {
  job: Job
  submissionCount: number
  tokenSymbol?: string
}

export default function ContestJobHeader({ 
  job, 
  submissionCount,
  tokenSymbol = 'tokens'
}: ContestJobHeaderProps) {
  // Time remaining calculation
  const getTimeRemaining = () => {
    if (!job.contest_submission_deadline) return { text: 'No deadline', expired: false }
    
    const now = new Date()
    const deadline = new Date(job.contest_submission_deadline)
    const diffMs = deadline.getTime() - now.getTime()
    
    if (diffMs < 0) return { text: 'Submissions closed', expired: true }
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 1) return { text: `${days} days ${hours} hours`, expired: false }
    if (days === 1) return { text: `1 day ${hours} hours`, expired: false }
    if (hours > 0) return { text: `${hours} hours ${minutes} minutes`, expired: false }
    return { text: `${minutes} minutes`, expired: false }
  }

  const timeInfo = getTimeRemaining()
  
  // Calculate total prize pool from JSON array
  const prizeBreakdown = Array.isArray(job.contest_winner_prizes)
    ? (job.contest_winner_prizes as Array<{ position: number; amount_tokens: number; amount_usd: number }>)
    : []
  
  const totalPrizePool = prizeBreakdown.reduce((sum, p) => sum + (p.amount_tokens || 0), 0)

  // Contest status
  const getContestStatus = (): { text: string; color: string } => {
    if (job.contest_winners_selected_at) return { text: 'Winners Selected', color: 'var(--text-secondary, #6F7280)' }
    if (timeInfo.expired) return { text: 'Judging', color: 'var(--accent-warning, #FFC857)' }
    return { text: 'Accepting Submissions', color: 'var(--accent-success, #36C170)' }
  }

  const status = getContestStatus()

  return (
    <Box>
      {/* Status Banner */}
      <Box sx={{ 
        bgcolor: status.color,
        color: status.text === 'Judging' ? 'var(--text-primary, #1A1A1E)' : 'white',
        py: 2,
        px: 3,
        borderRadius: 'var(--radius-card, 16px)',
        mb: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <EmojiEventsIcon sx={{ fontSize: 28 }} />
          <Typography 
            variant="h6" 
            sx={{ 
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontWeight: 600 
            }}
          >
            {status.text}
          </Typography>
        </Box>
        {!timeInfo.expired && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccessTimeIcon />
            <Typography 
              sx={{ 
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              {timeInfo.text} remaining
            </Typography>
          </Box>
        )}
      </Box>

      {/* Prize Pool Showcase */}
      <Paper sx={{ 
        p: 4, 
        mb: 3, 
        background: 'linear-gradient(135deg, rgba(124, 77, 255, 0.08) 0%, rgba(227, 240, 111, 0.08) 100%)',
        border: '2px solid var(--accent-primary, #7C4DFF)',
        borderRadius: 'var(--radius-card-lg, 24px)',
        boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
      }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography 
            sx={{ 
              color: 'var(--text-secondary, #6F7280)', 
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 600,
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              mb: 1
            }}
          >
            🏆 Total Prize Pool
          </Typography>
          <Typography 
            sx={{ 
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontWeight: 700, 
              color: 'var(--accent-primary, #7C4DFF)', 
              fontSize: '48px',
              lineHeight: 1.1,
              my: 1 
            }}
          >
            {totalPrizePool.toLocaleString()}
          </Typography>
          <Typography 
            sx={{ 
              color: 'var(--text-secondary, #6F7280)',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '16px'
            }}
          >
            {tokenSymbol} · Split between {job.contest_max_winners || 1} winner{(job.contest_max_winners || 1) !== 1 ? 's' : ''}
          </Typography>
        </Box>

        {/* Prize Breakdown */}
        <Grid container spacing={2} justifyContent="center">
          {prizeBreakdown.map((prize) => (
            <Grid 
              item 
              xs={6} 
              sm={4} 
              md={(job.contest_max_winners || 1) > 3 ? 3 : 4} 
              key={prize.position}
            >
              <Paper sx={{ 
                p: 2.5, 
                textAlign: 'center',
                bgcolor: 'var(--card-background, #FFFFFF)',
                border: '1px solid',
                borderColor: prize.position <= 3 ? 'var(--accent-primary, #7C4DFF)' : 'var(--border-subtle, #E5E7F0)',
                borderRadius: 'var(--radius-card, 16px)',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)'
                }
              }}>
                <Typography sx={{ fontSize: '40px', mb: 1, lineHeight: 1 }}>
                  {prize.position === 1 ? '🥇' : 
                   prize.position === 2 ? '🥈' : 
                   prize.position === 3 ? '🥉' : 
                   `#${prize.position}`}
                </Typography>
                <Typography 
                  sx={{ 
                    color: 'var(--text-secondary, #6F7280)', 
                    mb: 0.5,
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: '12px'
                  }}
                >
                  {prize.position === 1 ? '1st Place' :
                   prize.position === 2 ? '2nd Place' :
                   prize.position === 3 ? '3rd Place' :
                   `${prize.position}th Place`}
                </Typography>
                <Typography 
                  sx={{ 
                    fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                    fontWeight: 700, 
                    color: 'var(--accent-primary, #7C4DFF)',
                    fontSize: '24px',
                    lineHeight: 1.2
                  }}
                >
                  {prize.amount_tokens.toLocaleString()}
                </Typography>
                <Typography 
                  sx={{ 
                    color: 'var(--text-muted, #A3A7B5)',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: '11px'
                  }}
                >
                  {tokenSymbol}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Contest Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ 
            p: 3, 
            textAlign: 'center',
            borderRadius: 'var(--radius-card, 16px)',
            boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
          }}>
            <PeopleIcon sx={{ fontSize: 40, color: 'var(--accent-primary, #7C4DFF)', mb: 1 }} />
            <Typography 
              sx={{ 
                fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                fontWeight: 700,
                fontSize: '32px',
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              {submissionCount}
            </Typography>
            <Typography 
              sx={{ 
                color: 'var(--text-secondary, #6F7280)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '14px'
              }}
            >
              Submission{submissionCount !== 1 ? 's' : ''}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ 
            p: 3, 
            textAlign: 'center',
            borderRadius: 'var(--radius-card, 16px)',
            boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
          }}>
            <EmojiEventsIcon sx={{ fontSize: 40, color: 'var(--accent-primary, #7C4DFF)', mb: 1 }} />
            <Typography 
              sx={{ 
                fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                fontWeight: 700,
                fontSize: '32px',
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              {job.contest_max_winners || 1}
            </Typography>
            <Typography 
              sx={{ 
                color: 'var(--text-secondary, #6F7280)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '14px'
              }}
            >
              Winner{(job.contest_max_winners || 1) !== 1 ? 's' : ''}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ 
            p: 3, 
            textAlign: 'center',
            borderRadius: 'var(--radius-card, 16px)',
            boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
          }}>
            {job.contest_submissions_visible ? 
              <VisibilityIcon sx={{ fontSize: 40, color: 'var(--accent-primary, #7C4DFF)', mb: 1 }} /> :
              <VisibilityOffIcon sx={{ fontSize: 40, color: 'var(--accent-primary, #7C4DFF)', mb: 1 }} />
            }
            <Typography 
              sx={{ 
                fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                fontWeight: 700,
                fontSize: '24px',
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              {job.contest_submissions_visible ? 'Public' : 'Private'}
            </Typography>
            <Typography 
              sx={{ 
                color: 'var(--text-secondary, #6F7280)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '14px'
              }}
            >
              Submissions
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Deadline Progress Bar */}
      {!timeInfo.expired && job.contest_submission_deadline && (
        <Paper sx={{ 
          p: 3,
          borderRadius: 'var(--radius-card, 16px)',
          boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, alignItems: 'center' }}>
            <Typography 
              sx={{ 
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                fontSize: '14px'
              }}
            >
              Submission Deadline
            </Typography>
            <Typography 
              sx={{ 
                color: 'var(--accent-warning, #FFC857)', 
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 600,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5
              }}
            >
              <AccessTimeIcon sx={{ fontSize: 16 }} />
              {timeInfo.text} left
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate"
            value={Math.min(100, Math.max(0,
              ((Date.now() - new Date(job.created_at).getTime()) / 
              (new Date(job.contest_submission_deadline).getTime() - new Date(job.created_at).getTime())) * 100
            ))}
            sx={{
              height: 8,
              borderRadius: 1,
              bgcolor: 'rgba(255, 200, 87, 0.2)',
              '& .MuiLinearProgress-bar': {
                bgcolor: 'var(--accent-warning, #FFC857)',
                borderRadius: 1
              }
            }}
          />
          <Typography 
            sx={{ 
              color: 'var(--text-muted, #A3A7B5)', 
              display: 'block', 
              mt: 1.5,
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '12px'
            }}
          >
            Closes: {new Date(job.contest_submission_deadline).toLocaleString()}
          </Typography>
        </Paper>
      )}
    </Box>
  )
}

