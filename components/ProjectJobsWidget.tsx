'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Box, Typography, Chip, CircularProgress } from '@mui/material'
import WorkOutlineIcon from '@mui/icons-material/WorkOutline'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { useRouter } from 'next/navigation'
import { getProjectJobs } from '@/lib/jobs'
import { Database } from '@/types/database'
import { formatDistanceToNow } from 'date-fns'

type Job = Database['public']['Tables']['jobs']['Row']

interface ProjectJobsWidgetProps {
  projectId: string
  tokenSymbol: string
}

// Helper function to get payment amount (handles both regular jobs and contests)
const getPaymentAmount = (job: Job): number => {
  if (job.is_contest && Array.isArray(job.contest_winner_prizes)) {
    // For contests, calculate total prize pool from contest_winner_prizes
    return (job.contest_winner_prizes as Array<{ position: number; amount_tokens: number; amount_usd: number }>)
      .reduce((sum, prize) => sum + (prize.amount_tokens || 0), 0)
  }
  // For regular jobs, use payment_amount_tokens
  return job.payment_amount_tokens
}

// Category colors following design system
const categoryColors: Record<string, { bg: string; text: string }> = {
  design: { bg: 'var(--accent-primary-soft)', text: 'var(--accent-primary)' },
  marketing: { bg: 'var(--accent-success-soft)', text: 'var(--accent-success)' },
  development: { bg: '#E8F4FF', text: '#2563EB' },
  content: { bg: '#FFF4E6', text: '#FB923C' },
  community: { bg: '#FCE7F3', text: '#EC4899' },
  other: { bg: 'var(--subtle-background)', text: 'var(--text-secondary)' }
}

export function ProjectJobsWidget({ projectId, tokenSymbol }: ProjectJobsWidgetProps) {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadJobs() {
      try {
        // Fetch ALL jobs for this project (already ordered by newest first)
        const allJobs = await getProjectJobs(projectId)
        // Filter for open status only
        const openJobs = allJobs.filter(job => job.status === 'open')
        // Recent jobs on top (newest first - already sorted from query)
        setJobs(openJobs)
        console.log(`[ProjectJobsWidget] Found ${openJobs.length} open jobs out of ${allJobs.length} total`)
      } catch (err) {
        console.error('Error loading jobs:', err)
      } finally {
        setLoading(false)
      }
    }

    loadJobs()
  }, [projectId])

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <WorkOutlineIcon sx={{ color: 'var(--accent-primary)', fontSize: 24 }} />
            <CardTitle className="text-xl">Jobs</CardTitle>
            {jobs.length > 0 && (
              <Chip
                label={jobs.length}
                size="small"
                sx={{
                  bgcolor: 'var(--accent-primary-soft)',
                  color: 'var(--accent-primary)',
                  fontWeight: 600,
                  fontSize: '12px',
                  height: 22,
                }}
              />
            )}
          </div>
          <Button
            variant="ghost"
            onClick={() => router.push(`/project/${projectId}/jobs`)}
            className="text-accent-primary hover:bg-accent-primary-soft"
          >
            View All
            <ArrowForwardIcon sx={{ fontSize: 16, ml: 0.5 }} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} sx={{ color: 'var(--accent-primary)' }} />
          </Box>
        ) : jobs.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <WorkOutlineIcon sx={{ fontSize: 48, color: 'var(--text-muted)', mb: 1 }} />
            <Typography 
              sx={{ 
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-body-small)',
              }}
            >
              No open jobs yet
            </Typography>
            <Button
              variant="contained"
              onClick={() => router.push(`/project/${projectId}/jobs`)}
              className="mt-3 bg-accent-primary hover:bg-purple-700"
            >
              Post a Job
            </Button>
          </Box>
        ) : (
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 2,
              maxHeight: jobs.length > 4 ? '400px' : 'auto',
              overflowY: jobs.length > 4 ? 'auto' : 'visible',
              pr: jobs.length > 4 ? 1 : 0,
              '&::-webkit-scrollbar': {
                width: '6px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'rgba(0,0,0,0.05)',
                borderRadius: '3px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'var(--accent-primary)',
                borderRadius: '3px',
                '&:hover': {
                  backgroundColor: 'var(--accent-primary)',
                  opacity: 0.8,
                },
              },
            }}
          >
            {/* Pulsing animation styles */}
            <style>{`
              @keyframes pulse-green {
                0%, 100% { 
                  opacity: 1;
                  box-shadow: 0 0 0 0 rgba(54, 193, 112, 0.4);
                }
                50% { 
                  opacity: 0.8;
                  box-shadow: 0 0 0 4px rgba(54, 193, 112, 0);
                }
              }
            `}</style>

            {jobs.map((job) => (
              <Box
                key={job.id}
                onClick={() => router.push(`/project/${projectId}/jobs/${job.id}`)}
                sx={{
                  p: 'var(--space-md)',
                  bgcolor: 'var(--card-background)',
                  borderRadius: 'var(--radius-card-lg)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'var(--accent-primary)',
                    boxShadow: 'var(--shadow-chip)',
                  }
                }}
              >
                {/* Status & Category Row */}
                <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Pulsing Open Status */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1,
                      py: 0.25,
                      bgcolor: 'var(--accent-success-soft)',
                      borderRadius: 'var(--radius-control)',
                      height: 20,
                    }}
                  >
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: 'var(--accent-success)',
                        animation: 'pulse-green 2s ease-in-out infinite',
                      }}
                    />
                    <Typography
                      sx={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--accent-success)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Open
                    </Typography>
                  </Box>

                  {/* Category Badge */}
                  <Chip
                    label={job.category}
                    size="small"
                    sx={{
                      bgcolor: categoryColors[job.category]?.bg || categoryColors.other.bg,
                      color: categoryColors[job.category]?.text || categoryColors.other.text,
                      fontFamily: 'var(--font-body)',
                      fontSize: '11px',
                      fontWeight: 500,
                      textTransform: 'capitalize',
                      height: 20,
                    }}
                  />

                  {/* Contest Badge */}
                  {job.is_contest && (
                    <Chip
                      label="🏆 Contest"
                      size="small"
                      sx={{
                        bgcolor: '#FFF4E6',
                        color: '#FB923C',
                        fontSize: '11px',
                        fontWeight: 500,
                        height: 20,
                      }}
                    />
                  )}
                </Box>

                {/* Title */}
                <Typography
                  sx={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 600,
                    fontSize: 'var(--text-body)',
                    color: 'var(--text-primary)',
                    mb: 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {job.title}
                </Typography>

                {/* Payment & Meta */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography
                    sx={{
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 700,
                      fontSize: 'var(--text-body-small)',
                      color: 'var(--accent-primary)',
                    }}
                  >
                    {job.is_contest ? '🏆 ' : ''}{getPaymentAmount(job).toLocaleString()} {tokenSymbol}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-caption)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                  </Typography>
                </Box>
              </Box>
            ))}

            {/* Scroll hint for more jobs */}
            {jobs.length > 4 && (
              <Typography
                sx={{
                  textAlign: 'center',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-caption)',
                  color: 'var(--text-muted)',
                  py: 1,
                }}
              >
                Scroll to see more jobs
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

