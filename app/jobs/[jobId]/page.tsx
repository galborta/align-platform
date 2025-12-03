'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Box, 
  Container, 
  Typography, 
  Paper, 
  Chip, 
  Button, 
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import LockIcon from '@mui/icons-material/Lock'
import { useWallet } from '@solana/wallet-adapter-react'
import { fetchJobById, JobWithDetails } from '@/lib/jobs'
import { supabase } from '@/lib/supabase'
import ContestJobHeader from '@/components/ContestJobHeader'
import ContestSubmissionModal from '@/components/ContestSubmissionModal'

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { publicKey } = useWallet()
  const jobId = params.jobId as string

  const [job, setJob] = useState<JobWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Contest submission state
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [checkingEligibility, setCheckingEligibility] = useState(true)

  useEffect(() => {
    if (jobId) {
      loadJob()
    }
  }, [jobId])

  // Check if user already submitted to this contest
  useEffect(() => {
    if (job) {
      checkSubmissionEligibility()
    }
  }, [job?.id, publicKey])

  const loadJob = async () => {
    try {
      setLoading(true)
      const data = await fetchJobById(jobId)
      if (!data) {
        setError('Job not found')
        return
      }
      setJob(data)
    } catch (err) {
      console.error('Error loading job:', err)
      setError('Failed to load job')
    } finally {
      setLoading(false)
    }
  }

  const checkSubmissionEligibility = async () => {
    if (!publicKey || !job?.is_contest) {
      setCheckingEligibility(false)
      return
    }

    try {
      const { data } = await supabase
        .from('job_submissions')
        .select('id')
        .eq('job_id', job.id)
        .eq('worker_wallet', publicKey.toString())
        .maybeSingle()

      setHasSubmitted(!!data)
    } catch (err) {
      console.error('Error checking submission:', err)
    } finally {
      setCheckingEligibility(false)
    }
  }

  // Determine if user can submit to contest
  const canSubmit = (): { allowed: boolean; reason: string } => {
    if (!publicKey) return { allowed: false, reason: 'Connect wallet to submit' }
    if (!job?.is_contest) return { allowed: false, reason: 'Not a contest' }
    if (hasSubmitted) return { allowed: false, reason: 'You have already submitted to this contest' }
    
    if (job.poster_wallet === publicKey.toString()) {
      return { allowed: false, reason: 'You cannot submit to your own contest' }
    }

    if (!job.contest_submission_deadline) {
      return { allowed: false, reason: 'No deadline set' }
    }

    const deadline = new Date(job.contest_submission_deadline)
    if (new Date() > deadline) {
      return { allowed: false, reason: 'Submission deadline has passed' }
    }

    if (job.status !== 'open') {
      return { allowed: false, reason: 'This contest is no longer accepting submissions' }
    }

    return { allowed: true, reason: '' }
  }

  const eligibility = canSubmit()

  // Status colors following design system
  const statusColors: Record<string, { bg: string; text: string }> = {
    open: { bg: '#E3F8ED', text: '#36C170' },
    assigned: { bg: '#FFF4E6', text: '#FFC857' },
    submitted: { bg: '#EEE7FF', text: '#7C4DFF' },
    completed: { bg: '#F3F4F6', text: '#6B7280' },
    disputed: { bg: '#FEE2E2', text: '#EF4444' },
    cancelled: { bg: '#F3F4F6', text: '#9CA3AF' }
  }

  // Category colors
  const categoryColors: Record<string, { bg: string; text: string }> = {
    design: { bg: '#EEE7FF', text: '#7C4DFF' },
    marketing: { bg: '#E3F8ED', text: '#36C170' },
    development: { bg: '#E8F4FF', text: '#2563EB' },
    content: { bg: '#FFF4E6', text: '#FB923C' },
    community: { bg: '#FCE7F3', text: '#EC4899' },
    other: { bg: '#F3F4F6', text: '#6B7280' }
  }

  const handleCopyJobId = () => {
    navigator.clipboard.writeText(jobId)
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress sx={{ color: 'var(--accent-primary, #7C4DFF)' }} />
        <Typography sx={{ mt: 2, color: 'var(--text-secondary, #6F7280)' }}>
          Loading job details...
        </Typography>
      </Container>
    )
  }

  if (error || !job) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <Typography 
          variant="h5" 
          sx={{ 
            color: 'var(--text-secondary, #6F7280)',
            fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
            mb: 2
          }}
        >
          {error || 'Job not found'}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/jobs')}
          sx={{
            borderColor: 'var(--accent-primary, #7C4DFF)',
            color: 'var(--accent-primary, #7C4DFF)',
            '&:hover': {
              borderColor: 'var(--accent-primary, #7C4DFF)',
              bgcolor: 'rgba(124, 77, 255, 0.04)'
            }
          }}
        >
          Back to Jobs
        </Button>
      </Container>
    )
  }

  const tokenSymbol = job.projects?.token_symbol || 'tokens'

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Back Button */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => router.back()}
        sx={{
          mb: 3,
          color: 'var(--text-secondary, #6F7280)',
          fontFamily: 'var(--font-body, Satoshi, sans-serif)',
          '&:hover': {
            bgcolor: 'rgba(124, 77, 255, 0.04)'
          }
        }}
      >
        Back
      </Button>

      {/* Contest Header (if contest job) */}
      {job.is_contest && (
        <ContestJobHeader 
          job={job} 
          submissionCount={job.submissionCount || 0}
          tokenSymbol={tokenSymbol}
        />
      )}

      {/* Contest Submit Button */}
      {job.is_contest && (
        <Box sx={{ mb: 3 }}>
          {checkingEligibility ? (
            <Button
              fullWidth
              variant="contained"
              disabled
              sx={{ 
                bgcolor: 'var(--accent-primary, #7C4DFF)', 
                py: 1.5,
                borderRadius: 'var(--radius-control, 999px)'
              }}
            >
              <CircularProgress size={24} sx={{ color: 'white' }} />
            </Button>
          ) : eligibility.allowed ? (
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={() => setSubmissionModalOpen(true)}
              sx={{
                bgcolor: 'var(--accent-primary, #7C4DFF)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                borderRadius: 'var(--radius-control, 999px)',
                boxShadow: 'var(--shadow-chip, 0 8px 20px 0 rgba(15, 23, 42, 0.08))',
                '&:hover': { 
                  bgcolor: '#6B3FEE',
                  boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
                },
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
                textTransform: 'none'
              }}
            >
              🏆 Submit Your Entry
            </Button>
          ) : (
            <Alert 
              severity={hasSubmitted ? 'success' : 'warning'}
              sx={{
                borderRadius: 'var(--radius-card-lg, 24px)',
                '& .MuiAlert-message': {
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                }
              }}
            >
              {eligibility.reason}
              {hasSubmitted && (
                <Typography 
                  variant="caption" 
                  sx={{ 
                    display: 'block', 
                    mt: 1,
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                  }}
                >
                  You can view your submission in the gallery below
                </Typography>
              )}
            </Alert>
          )}
        </Box>
      )}

      {/* Main Content */}
      <Paper sx={{ 
        p: 4, 
        mb: 3,
        borderRadius: 'var(--radius-card-lg, 24px)',
        boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
      }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ flex: 1 }}>
            {/* Status & Category */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
              {!job.is_contest && (
                <Chip
                  label={job.status.toUpperCase()}
                  size="small"
                  sx={{
                    bgcolor: statusColors[job.status]?.bg || statusColors.open.bg,
                    color: statusColors[job.status]?.text || statusColors.open.text,
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontWeight: 600,
                    fontSize: '11px',
                    borderRadius: 'var(--radius-control, 999px)',
                  }}
                />
              )}
              <Chip
                label={job.category}
                size="small"
                sx={{
                  bgcolor: categoryColors[job.category]?.bg || categoryColors.other.bg,
                  color: categoryColors[job.category]?.text || categoryColors.other.text,
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontWeight: 500,
                  fontSize: '11px',
                  textTransform: 'capitalize',
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

            {/* Project Name */}
            {job.projects?.token_name && (
              <Typography 
                sx={{ 
                  color: 'var(--text-secondary, #6F7280)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '14px',
                  mb: 2
                }}
              >
                Posted by <strong>{job.projects.token_name}</strong>
              </Typography>
            )}

            {/* Job ID */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography 
                sx={{ 
                  color: 'var(--text-muted, #A3A7B5)',
                  fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                  fontSize: '12px',
                }}
              >
                ID: {jobId.slice(0, 8)}...{jobId.slice(-4)}
              </Typography>
              <Tooltip title="Copy Job ID">
                <IconButton 
                  size="small" 
                  onClick={handleCopyJobId}
                  sx={{ 
                    color: 'var(--text-muted, #A3A7B5)',
                    '&:hover': { color: 'var(--accent-primary, #7C4DFF)' }
                  }}
                >
                  <ContentCopyIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Payment (for regular jobs) */}
          {!job.is_contest && (
            <Box sx={{ textAlign: 'right' }}>
              <Typography 
                sx={{ 
                  fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                  fontWeight: 700, 
                  color: 'var(--accent-primary, #7C4DFF)',
                  fontSize: '32px',
                  lineHeight: 1.2
                }}
              >
                {job.payment_amount_tokens.toLocaleString()}
              </Typography>
              <Typography 
                sx={{ 
                  color: 'var(--text-secondary, #6F7280)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '14px'
                }}
              >
                {tokenSymbol}
              </Typography>
              <Typography 
                sx={{ 
                  color: 'var(--text-muted, #A3A7B5)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '13px'
                }}
              >
                ≈ ${job.payment_amount_usd.toLocaleString()} USD
              </Typography>
              
              {/* Escrow indicator */}
              {job.escrow_locked && (
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.5, 
                    mt: 1,
                    justifyContent: 'flex-end'
                  }}
                >
                  <LockIcon sx={{ fontSize: 14, color: 'var(--accent-warning, #FFC857)' }} />
                  <Typography 
                    sx={{ 
                      color: 'var(--accent-warning, #FFC857)',
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                      fontSize: '12px',
                      fontWeight: 500
                    }}
                  >
                    Escrow Locked
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Description */}
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)',
              mb: 2
            }}
          >
            Description
          </Typography>
          <Typography 
            sx={{ 
              color: 'var(--text-secondary, #6F7280)',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '15px',
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap'
            }}
          >
            {job.description}
          </Typography>
        </Box>

        {/* KPIs */}
        {job.kpis && (
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="h6" 
              sx={{ 
                fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 2
              }}
            >
              Success Criteria / KPIs
            </Typography>
            <Paper sx={{ 
              p: 3, 
              bgcolor: 'var(--surface-secondary, #F8F9FC)',
              borderRadius: 'var(--radius-card, 16px)'
            }}>
              <Typography 
                sx={{ 
                  color: 'var(--text-primary, #1A1A1E)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '14px',
                  lineHeight: 1.8,
                  whiteSpace: 'pre-wrap'
                }}
              >
                {job.kpis}
              </Typography>
            </Paper>
          </Box>
        )}

        {/* View on Project Page Button */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            onClick={() => router.push(`/project/${job.project_id}/jobs/${job.id}`)}
            sx={{
              borderColor: 'var(--accent-primary, #7C4DFF)',
              color: 'var(--accent-primary, #7C4DFF)',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 500,
              borderRadius: 'var(--radius-control, 999px)',
              px: 3,
              '&:hover': {
                borderColor: 'var(--accent-primary, #7C4DFF)',
                bgcolor: 'rgba(124, 77, 255, 0.04)'
              }
            }}
          >
            View Full Details on Project Page
          </Button>
          
          {job.project_id && (
            <Button
              variant="text"
              onClick={() => router.push(`/project/${job.project_id}`)}
              sx={{
                color: 'var(--text-secondary, #6F7280)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 500,
                '&:hover': {
                  bgcolor: 'rgba(124, 77, 255, 0.04)'
                }
              }}
            >
              View Project
            </Button>
          )}
        </Box>
      </Paper>

      {/* Contest Submissions Preview (if visible) */}
      {job.is_contest && job.contest_submissions_visible && job.job_submissions && job.job_submissions.length > 0 && (
        <Paper sx={{ 
          p: 4,
          borderRadius: 'var(--radius-card-lg, 24px)',
          boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
        }}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)',
              mb: 3
            }}
          >
            Submissions ({job.job_submissions.length})
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {job.job_submissions.slice(0, 5).map((submission) => (
              <Paper 
                key={submission.id}
                sx={{ 
                  p: 3,
                  bgcolor: submission.is_selected_winner 
                    ? 'rgba(54, 193, 112, 0.08)' 
                    : 'var(--surface-secondary, #F8F9FC)',
                  border: submission.is_selected_winner 
                    ? '2px solid var(--accent-success, #36C170)' 
                    : '1px solid var(--border-subtle, #E5E7F0)',
                  borderRadius: 'var(--radius-card, 16px)'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography 
                      sx={{ 
                        fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                        fontSize: '13px',
                        color: 'var(--text-primary, #1A1A1E)',
                        mb: 1
                      }}
                    >
                      {submission.worker_wallet.slice(0, 6)}...{submission.worker_wallet.slice(-4)}
                    </Typography>
                    {submission.message && (
                      <Typography 
                        sx={{ 
                          color: 'var(--text-secondary, #6F7280)',
                          fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                          fontSize: '14px',
                          lineHeight: 1.6
                        }}
                      >
                        {submission.message.slice(0, 200)}{submission.message.length > 200 ? '...' : ''}
                      </Typography>
                    )}
                  </Box>
                  {submission.is_selected_winner && (
                    <Chip
                      label={`🏆 ${submission.winner_position === 1 ? '1st' : submission.winner_position === 2 ? '2nd' : submission.winner_position === 3 ? '3rd' : `${submission.winner_position}th`} Place`}
                      size="small"
                      sx={{
                        bgcolor: 'var(--accent-success, #36C170)',
                        color: 'white',
                        fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                        fontWeight: 600
                      }}
                    />
                  )}
                </Box>
              </Paper>
            ))}
            
            {job.job_submissions.length > 5 && (
              <Typography 
                sx={{ 
                  color: 'var(--text-muted, #A3A7B5)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '13px',
                  textAlign: 'center'
                }}
              >
                +{job.job_submissions.length - 5} more submissions
              </Typography>
            )}
          </Box>
        </Paper>
      )}

      {/* Contest Submission Modal */}
      {job.is_contest && publicKey && (
        <ContestSubmissionModal
          open={submissionModalOpen}
          onClose={() => setSubmissionModalOpen(false)}
          job={job}
          userWallet={publicKey.toString()}
          onSubmissionSuccess={() => {
            setHasSubmitted(true)
            // Refresh job data to update submissions gallery
            loadJob()
          }}
        />
      )}
    </Container>
  )
}

