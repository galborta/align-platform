/**
 * My Submissions List Component
 * 
 * Displays all social media job submissions for the current worker.
 * Shows submission status, job details, and payment information.
 * 
 * Features:
 * - Fetches submissions from database
 * - Real-time updates (optional with Supabase subscriptions)
 * - Loading and empty states
 * - Sorted by submission date (newest first)
 * - Integrates with WorkerSubmissionStatus component
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  CircularProgress,
  Container,
  Grid,
  Alert
} from '@mui/material'
import InboxIcon from '@mui/icons-material/Inbox'
import { supabase } from '@/lib/supabase'
import WorkerSubmissionStatus from './WorkerSubmissionStatus'
import { Database } from '@/types/database'

type Job = Database['public']['Tables']['jobs']['Row']
type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

interface SubmissionWithJob extends JobSubmission {
  jobs: Job
}

interface MySubmissionsListProps {
  /** Worker's wallet address */
  walletAddress?: string
}

/**
 * Empty State Component
 */
function EmptyState() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 3,
        textAlign: 'center'
      }}
    >
      <InboxIcon
        sx={{
          fontSize: 80,
          color: 'var(--icon-default, #B6BAC7)',
          mb: 2
        }}
      />
      <Typography
        sx={{
          fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
          fontSize: 'var(--text-headline, 18px)',
          fontWeight: 600,
          color: 'var(--text-primary, #1A1A1E)',
          mb: 1
        }}
      >
        No submissions yet
      </Typography>
      <Typography
        sx={{
          fontFamily: 'var(--font-body, Satoshi, sans-serif)',
          fontSize: 'var(--text-body, 16px)',
          color: 'var(--text-secondary, #6F7280)',
          maxWidth: 400
        }}
      >
        When you apply to social media campaigns, your submissions will appear here.
      </Typography>
    </Box>
  )
}

/**
 * Loading State Component
 */
function LoadingState() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8
      }}
    >
      <CircularProgress
        size={48}
        sx={{
          color: 'var(--accent-primary, #7C4DFF)',
          mb: 2
        }}
      />
      <Typography
        sx={{
          fontFamily: 'var(--font-body, Satoshi, sans-serif)',
          fontSize: 'var(--text-body, 16px)',
          color: 'var(--text-secondary, #6F7280)'
        }}
      >
        Loading submissions...
      </Typography>
    </Box>
  )
}

/**
 * My Submissions List Component
 */
export default function MySubmissionsList({ walletAddress }: MySubmissionsListProps) {
  const [submissions, setSubmissions] = useState<SubmissionWithJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    async function fetchSubmissions() {
      if (!walletAddress) {
        setLoading(false)
        return
      }
      
      try {
        setLoading(true)
        setError(null)
        
        // Fetch all submissions for this worker with job details
        const { data, error: fetchError } = await supabase
          .from('job_submissions')
          .select(`
            *,
            jobs (*)
          `)
          .eq('worker_wallet', walletAddress)
          .not('social_approval_status', 'is', null) // Only social submissions
          .order('submitted_at', { ascending: false })
        
        if (fetchError) {
          console.error('[MySubmissionsList] Fetch error:', fetchError)
          setError('Failed to load submissions. Please try again.')
          return
        }
        
        // Type assertion to handle join
        setSubmissions(data as unknown as SubmissionWithJob[])
        
      } catch (err) {
        console.error('[MySubmissionsList] Unexpected error:', err)
        setError('An unexpected error occurred.')
      } finally {
        setLoading(false)
      }
    }
    
    fetchSubmissions()
    
    // Optional: Set up real-time subscription
    if (walletAddress) {
      const channel = supabase
        .channel('submissions-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'job_submissions',
            filter: `worker_wallet=eq.${walletAddress}`
          },
          (payload) => {
            console.log('[MySubmissionsList] Real-time update:', payload)
            // Refetch on any change
            fetchSubmissions()
          }
        )
        .subscribe()
      
      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [walletAddress])
  
  // Loading state
  if (loading) {
    return <LoadingState />
  }
  
  // Error state
  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert
          severity="error"
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: 'var(--text-body, 16px)'
          }}
        >
          {error}
        </Alert>
      </Container>
    )
  }
  
  // No wallet connected
  if (!walletAddress) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert
          severity="info"
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: 'var(--text-body, 16px)'
          }}
        >
          Please connect your wallet to view your submissions.
        </Alert>
      </Container>
    )
  }
  
  // Empty state
  if (submissions.length === 0) {
    return <EmptyState />
  }
  
  // Submissions list
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          sx={{
            fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
            fontSize: 'var(--text-title, 22px)',
            fontWeight: 600,
            color: 'var(--text-primary, #1A1A1E)',
            mb: 1
          }}
        >
          My Submissions
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: 'var(--text-body, 16px)',
            color: 'var(--text-secondary, #6F7280)'
          }}
        >
          Track the status of your social media campaign submissions
        </Typography>
      </Box>
      
      {/* Submissions Grid */}
      <Grid container spacing={3}>
        {submissions.map((submission) => (
          <Grid item xs={12} key={submission.id}>
            <Box
              sx={{
                bgcolor: 'var(--card-background, #FFFFFF)',
                borderRadius: 'var(--radius-card-lg, 24px)',
                p: 3,
                boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)'
                }
              }}
            >
              {/* Job Title Header */}
              <Box sx={{ mb: 3 }}>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                    fontSize: 'var(--text-headline, 18px)',
                    fontWeight: 600,
                    color: 'var(--text-primary, #1A1A1E)',
                    mb: 0.5
                  }}
                >
                  {submission.jobs.title}
                </Typography>
                
                {/* Job Meta */}
                {submission.jobs.project_id && (
                  <Typography
                    sx={{
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                      fontSize: 'var(--text-body-small, 14px)',
                      color: 'var(--text-secondary, #6F7280)'
                    }}
                  >
                    Project ID: {submission.jobs.project_id.slice(0, 8)}...
                  </Typography>
                )}
              </Box>
              
              {/* Status Component */}
              <WorkerSubmissionStatus
                submission={submission}
                job={submission.jobs}
              />
            </Box>
          </Grid>
        ))}
      </Grid>
      
      {/* Footer Stats */}
      <Box
        sx={{
          mt: 4,
          p: 3,
          bgcolor: 'var(--subtle-background, #F7F8FB)',
          borderRadius: 'var(--radius-card-lg, 16px)',
          display: 'flex',
          justifyContent: 'space-around',
          flexWrap: 'wrap',
          gap: 2
        }}
      >
        {/* Total Submissions */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontSize: 'var(--text-title, 22px)',
              fontWeight: 700,
              color: 'var(--accent-primary, #7C4DFF)',
              mb: 0.5
            }}
          >
            {submissions.length}
          </Typography>
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body-small, 14px)',
              color: 'var(--text-secondary, #6F7280)'
            }}
          >
            Total Submissions
          </Typography>
        </Box>
        
        {/* Pending */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontSize: 'var(--text-title, 22px)',
              fontWeight: 700,
              color: 'var(--accent-primary, #7C4DFF)',
              mb: 0.5
            }}
          >
            {submissions.filter(s => s.social_approval_status === 'pending').length}
          </Typography>
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body-small, 14px)',
              color: 'var(--text-secondary, #6F7280)'
            }}
          >
            Pending
          </Typography>
        </Box>
        
        {/* Approved */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontSize: 'var(--text-title, 22px)',
              fontWeight: 700,
              color: 'var(--accent-success, #10B981)',
              mb: 0.5
            }}
          >
            {submissions.filter(s => s.social_approval_status === 'approved').length}
          </Typography>
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body-small, 14px)',
              color: 'var(--text-secondary, #6F7280)'
            }}
          >
            Approved
          </Typography>
        </Box>
        
        {/* Rejected */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontSize: 'var(--text-title, 22px)',
              fontWeight: 700,
              color: '#EF4444',
              mb: 0.5
            }}
          >
            {submissions.filter(s => s.social_approval_status === 'rejected').length}
          </Typography>
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body-small, 14px)',
              color: 'var(--text-secondary, #6F7280)'
            }}
          >
            Rejected
          </Typography>
        </Box>
      </Box>
    </Container>
  )
}

