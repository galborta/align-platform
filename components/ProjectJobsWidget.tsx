'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Box, Typography, Chip, CircularProgress, Dialog, DialogTitle, DialogContent, LinearProgress } from '@mui/material'
import WorkOutlineIcon from '@mui/icons-material/WorkOutline'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AddIcon from '@mui/icons-material/Add'
import WorkIcon from '@mui/icons-material/Work'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import CampaignIcon from '@mui/icons-material/Campaign'
import { useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { getProjectJobs } from '@/lib/jobs'
import { Database } from '@/types/database'
import { formatDistanceToNow } from 'date-fns'
import { CreateJobModal } from '@/components/CreateJobModal'
import { SocialJobCreationWizard } from '@/components/jobs/social'

type Job = Database['public']['Tables']['jobs']['Row']

interface ProjectJobsWidgetProps {
  projectId: string
  tokenSymbol: string
  tokenMint: string
}

// Helper function to get payment amount (handles regular jobs, contests, and social jobs)
const getPaymentAmount = (job: Job): number => {
  if (job.is_social_media_job) {
    // For social jobs, return remaining budget
    return job.social_remaining_budget_tokens || 0
  }
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

// Status colors and labels
const statusStyles: Record<string, { bg: string; text: string; label: string; pulse?: boolean }> = {
  open: { bg: 'var(--accent-success-soft)', text: 'var(--accent-success)', label: 'Open', pulse: true },
  assigned: { bg: '#FFF4E6', text: '#FB923C', label: 'In Progress' },
  submitted: { bg: 'var(--accent-primary-soft)', text: 'var(--accent-primary)', label: 'Submitted' },
  completed: { bg: '#E3F8ED', text: '#36C170', label: 'Completed' },
  disputed: { bg: '#FEE2E2', text: '#EF4444', label: 'Disputed' },
  dispute_resolved: { bg: '#F0FDF4', text: '#059669', label: 'Resolved' },
  cancelled: { bg: '#F3F4F6', text: '#9CA3AF', label: 'Cancelled' }
}

export function ProjectJobsWidget({ projectId, tokenSymbol, tokenMint }: ProjectJobsWidgetProps) {
  const router = useRouter()
  const { publicKey } = useWallet()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [showJobTypeSelector, setShowJobTypeSelector] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSocialMediaModal, setShowSocialMediaModal] = useState(false)
  const [selectedJobType, setSelectedJobType] = useState<'regular' | 'contest'>('regular')
  const [tokenPrice, setTokenPrice] = useState<number>(0.01)

  // Sort jobs by status priority: open > assigned/submitted > completed > cancelled
  const sortJobsByStatus = (jobs: Job[]): Job[] => {
    const statusOrder: Record<string, number> = {
      'open': 1,
      'assigned': 2,
      'submitted': 3,
      'completed': 4,
      'disputed': 5,
      'dispute_resolved': 6,
      'cancelled': 7
    }
    
    return [...jobs].sort((a, b) => {
      const orderA = statusOrder[a.status] || 99
      const orderB = statusOrder[b.status] || 99
      if (orderA !== orderB) return orderA - orderB
      // Within same status, sort by newest first
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }

  const refreshJobs = async () => {
    try {
      const allJobs = await getProjectJobs(projectId)
      const sortedJobs = sortJobsByStatus(allJobs)
      setJobs(sortedJobs)
    } catch (err) {
      console.error('Error refreshing jobs:', err)
    }
  }

  // Fetch token price for social media campaigns
  useEffect(() => {
    async function fetchTokenPrice() {
      try {
        const { getTokenPriceUsd } = await import('@/lib/helius')
        const price = await getTokenPriceUsd(tokenMint)
        if (price !== null) {
          setTokenPrice(price)
        }
      } catch (err) {
        console.error('Error fetching token price:', err)
        setTokenPrice(0.01) // Fallback
      }
    }
    
    if (tokenMint) {
      fetchTokenPrice()
    }
  }, [tokenMint])

  useEffect(() => {
    async function loadJobs() {
      try {
        // Fetch ALL jobs for this project
        const allJobs = await getProjectJobs(projectId)
        // Sort by status priority: open first, then in-progress, then completed, then cancelled
        const sortedJobs = sortJobsByStatus(allJobs)
        setJobs(sortedJobs)
        console.log(`[ProjectJobsWidget] Loaded ${allJobs.length} jobs (sorted by status priority)`)
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
              <>
                {/* Show open jobs count with green badge */}
                {jobs.filter(j => j.status === 'open').length > 0 && (
                  <Chip
                    label={`${jobs.filter(j => j.status === 'open').length} open`}
                    size="small"
                    sx={{
                      bgcolor: 'var(--accent-success-soft)',
                      color: 'var(--accent-success)',
                      fontWeight: 600,
                      fontSize: '11px',
                      height: 22,
                    }}
                  />
                )}
                {/* Show total if there are non-open jobs */}
                {jobs.filter(j => j.status !== 'open').length > 0 && (
                  <Chip
                    label={jobs.length}
                    size="small"
                    sx={{
                      bgcolor: 'var(--subtle-background)',
                      color: 'var(--text-secondary)',
                      fontWeight: 500,
                      fontSize: '11px',
                      height: 22,
                    }}
                  />
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {publicKey && (
              <Button
                variant="contained"
                onClick={() => setShowJobTypeSelector(true)}
                className="bg-accent-primary hover:bg-purple-700 text-white text-sm"
              >
                <AddIcon sx={{ fontSize: 16, mr: 0.5 }} />
                Post Work
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => router.push(`/project/${projectId}/jobs`)}
              className="text-accent-primary hover:bg-accent-primary-soft"
            >
              View All
              <ArrowForwardIcon sx={{ fontSize: 16, ml: 0.5 }} />
            </Button>
          </div>
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
              No jobs yet
            </Typography>
            {publicKey ? (
              <Button
                variant="contained"
                onClick={() => setShowJobTypeSelector(true)}
                className="mt-3 bg-accent-primary hover:bg-purple-700"
              >
                <AddIcon sx={{ fontSize: 16, mr: 0.5 }} />
                Post Work
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={() => router.push(`/project/${projectId}/jobs`)}
                className="mt-3 bg-accent-primary hover:bg-purple-700"
              >
                View Jobs
              </Button>
            )}
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
                  {/* Dynamic Status Badge */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1,
                      py: 0.25,
                      bgcolor: statusStyles[job.status]?.bg || '#F3F4F6',
                      borderRadius: 'var(--radius-control)',
                      height: 20,
                    }}
                  >
                    {statusStyles[job.status]?.pulse && (
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          bgcolor: statusStyles[job.status]?.text,
                          animation: 'pulse-green 2s ease-in-out infinite',
                        }}
                      />
                    )}
                    <Typography
                      sx={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: statusStyles[job.status]?.text || '#6B7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {statusStyles[job.status]?.label || job.status}
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

                  {/* Social Campaign Badge */}
                  {job.is_social_media_job && (
                    <Chip
                      label="📱 Social"
                      size="small"
                      sx={{
                        bgcolor: 'var(--accent-primary-soft)',
                        color: 'var(--accent-primary)',
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

                {/* Social Job Progress & Stats */}
                {job.is_social_media_job && (
                  <Box sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography
                        sx={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Budget: {(job.social_remaining_budget_tokens || 0).toLocaleString()} {tokenSymbol} remaining
                      </Typography>
                      <Typography
                        sx={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--accent-primary)',
                        }}
                      >
                        {job.social_total_budget_tokens > 0 
                          ? Math.round(((job.social_total_budget_tokens - (job.social_remaining_budget_tokens || 0)) / job.social_total_budget_tokens) * 100)
                          : 0
                        }%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={job.social_total_budget_tokens > 0 
                        ? ((job.social_total_budget_tokens - (job.social_remaining_budget_tokens || 0)) / job.social_total_budget_tokens) * 100
                        : 0
                      }
                      sx={{
                        height: 4,
                        borderRadius: 1,
                        bgcolor: 'rgba(124, 77, 255, 0.15)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: 'var(--accent-primary)',
                          borderRadius: 1,
                        }
                      }}
                    />
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                      <Typography
                        sx={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '10px',
                          color: 'var(--accent-success)',
                          fontWeight: 500,
                        }}
                      >
                        ✓ {job.social_approved_paid_count || 0} participants paid
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Payment & Meta */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {!job.is_social_media_job && (
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
                  )}
                  <Typography
                    sx={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-caption)',
                      color: 'var(--text-muted)',
                      ml: job.is_social_media_job ? 'auto' : 0,
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

      {/* Job Type Selector Dialog */}
      <Dialog
        open={showJobTypeSelector}
        onClose={() => setShowJobTypeSelector(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            bgcolor: '#FFFFFF'
          }
        }}
      >
        <DialogTitle 
          sx={{ 
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: 700,
            fontSize: '20px',
            color: '#1A1A1E',
            textAlign: 'center',
            pb: 1
          }}
        >
          What type of work do you want to post?
        </DialogTitle>
        <DialogContent sx={{ pt: 2, pb: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Regular Job Option */}
            <Box
              onClick={() => {
                setSelectedJobType('regular')
                setShowJobTypeSelector(false)
                setShowCreateModal(true)
              }}
              sx={{
                p: 3,
                border: '1px solid #E5E7F0',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: '#7C4DFF',
                  bgcolor: '#F8F5FF'
                }
              }}
            >
              <Box 
                sx={{ 
                  p: 1.5, 
                  borderRadius: '12px', 
                  bgcolor: '#EEE7FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <WorkIcon sx={{ color: '#7C4DFF', fontSize: 28 }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 600, color: '#1A1A1E', fontSize: '16px' }}>
                  💼 Regular Job
                </Typography>
                <Typography variant="body2" sx={{ color: '#6F7280' }}>
                  Assign to one worker, fixed payment upon completion
                </Typography>
              </Box>
            </Box>

            {/* Contest Job Option */}
            <Box
              onClick={() => {
                setSelectedJobType('contest')
                setShowJobTypeSelector(false)
                setShowCreateModal(true)
              }}
              sx={{
                p: 3,
                border: '1px solid #E5E7F0',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: '#7C4DFF',
                  bgcolor: '#F8F5FF'
                }
              }}
            >
              <Box 
                sx={{ 
                  p: 1.5, 
                  borderRadius: '12px', 
                  bgcolor: '#FFF4E6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <EmojiEventsIcon sx={{ color: '#FB923C', fontSize: 28 }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 600, color: '#1A1A1E', fontSize: '16px' }}>
                  🏆 Contest
                </Typography>
                <Typography variant="body2" sx={{ color: '#6F7280' }}>
                  Multiple submissions, select winners with prizes
                </Typography>
              </Box>
            </Box>

            {/* Social Media Campaign Option */}
            <Box
              onClick={() => {
                setShowJobTypeSelector(false)
                setShowSocialMediaModal(true)
              }}
              sx={{
                p: 3,
                border: '2px solid #7C4DFF',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                bgcolor: '#F8F5FF',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(124, 77, 255, 0.25)'
                }
              }}
            >
              {/* New badge */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  bgcolor: '#E3F06F',
                  color: '#1A1A1E',
                  fontSize: '10px',
                  fontWeight: 700,
                  px: 1,
                  py: 0.5,
                  borderRadius: '6px',
                  textTransform: 'uppercase'
                }}
              >
                New
              </Box>
              <Box 
                sx={{ 
                  p: 1.5, 
                  borderRadius: '12px', 
                  bgcolor: '#7C4DFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <CampaignIcon sx={{ color: '#FFFFFF', fontSize: 28 }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 600, color: '#1A1A1E', fontSize: '16px' }}>
                  📣 Social Media Campaign
                </Typography>
                <Typography variant="body2" sx={{ color: '#6F7280' }}>
                  Pay users to retweet or create original content
                </Typography>
                <Typography variant="caption" sx={{ color: '#7C4DFF', fontWeight: 500 }}>
                  Proportional payments based on post reach
                </Typography>
              </Box>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Create Job Modal (Regular & Contest) */}
      {publicKey && (
        <CreateJobModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          projectId={projectId}
          tokenMint={tokenMint}
          tokenSymbol={tokenSymbol}
          walletAddress={publicKey.toBase58()}
          onJobCreated={() => {
            setShowCreateModal(false)
            refreshJobs()
          }}
          initialJobType={selectedJobType}
          onSwitchToSocialMedia={() => {
            setShowSocialMediaModal(true)
          }}
        />
      )}

      {/* Create Social Media Job Wizard */}
      {publicKey && (
        <SocialJobCreationWizard
          projectId={projectId}
          isOpen={showSocialMediaModal}
          onClose={() => setShowSocialMediaModal(false)}
          onSuccess={(jobId) => {
            setShowSocialMediaModal(false)
            refreshJobs()
            router.push(`/project/${projectId}/jobs/${jobId}`)
          }}
          tokenMint={tokenMint}
          tokenSymbol={tokenSymbol}
          tokenPrice={tokenPrice}
          posterWallet={publicKey.toBase58()}
        />
      )}
    </Card>
  )
}

