'use client'

import { useState, useEffect } from 'react'
import { Box, Container, Grid, Typography, Tabs, Tab, CircularProgress } from '@mui/material'
import JobCard from '@/components/JobCard'
import { fetchJobs, JobWithDetails } from '@/lib/jobs'

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'contests' | 'regular'>('all')

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    try {
      const data = await fetchJobs()
      setJobs(data)
    } catch (error) {
      console.error('Error loading jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter jobs based on selected tab
  const filteredJobs = jobs.filter(job => {
    if (filter === 'contests') return job.is_contest
    if (filter === 'regular') return !job.is_contest
    return true
  })

  // Separate open vs closed jobs
  const openJobs = filteredJobs.filter(job => 
    job.status === 'open' || 
    (job.is_contest && !job.contest_winners_selected_at)
  )
  const closedJobs = filteredJobs.filter(job => 
    job.status !== 'open' && 
    !(job.is_contest && !job.contest_winners_selected_at)
  )

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress sx={{ color: 'var(--accent-primary, #7C4DFF)' }} />
        <Typography sx={{ mt: 2, color: 'var(--text-secondary, #6F7280)' }}>
          Loading jobs...
        </Typography>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography 
        variant="h4" 
        sx={{ 
          mb: 3, 
          fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
          fontWeight: 700,
          color: 'var(--text-primary, #1A1A1E)'
        }}
      >
        Available Jobs & Contests
      </Typography>

      {/* Filter Tabs */}
      <Tabs 
        value={filter} 
        onChange={(_, newValue) => setFilter(newValue)}
        sx={{ 
          mb: 3,
          '& .MuiTab-root': {
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontWeight: 500,
            textTransform: 'none',
            fontSize: '14px',
          },
          '& .Mui-selected': {
            color: 'var(--accent-primary, #7C4DFF) !important',
          },
          '& .MuiTabs-indicator': {
            backgroundColor: 'var(--accent-primary, #7C4DFF)',
          }
        }}
      >
        <Tab label="All Jobs" value="all" />
        <Tab label="🏆 Contests Only" value="contests" />
        <Tab label="Regular Jobs" value="regular" />
      </Tabs>

      {/* Open Jobs Section */}
      {openJobs.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              mb: 2, 
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)'
            }}
          >
            Open Opportunities ({openJobs.length})
          </Typography>
          <Grid container spacing={3}>
            {openJobs.map(job => (
              <Grid item xs={12} md={6} lg={4} key={job.id}>
                <JobCard 
                  job={job}
                  submissionCount={job.submissionCount}
                  applicationCount={job.applicationCount}
                  projectName={job.projects?.token_name}
                  tokenSymbol={job.projects?.token_symbol}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Closed Jobs Section */}
      {closedJobs.length > 0 && (
        <Box>
          <Typography 
            variant="h6" 
            sx={{ 
              mb: 2, 
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontWeight: 600, 
              color: 'var(--text-secondary, #6F7280)' 
            }}
          >
            Closed ({closedJobs.length})
          </Typography>
          <Grid container spacing={3}>
            {closedJobs.map(job => (
              <Grid item xs={12} md={6} lg={4} key={job.id}>
                <JobCard 
                  job={job}
                  submissionCount={job.submissionCount}
                  applicationCount={job.applicationCount}
                  projectName={job.projects?.token_name}
                  tokenSymbol={job.projects?.token_symbol}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Empty State */}
      {filteredJobs.length === 0 && (
        <Box 
          sx={{ 
            textAlign: 'center', 
            py: 8,
            bgcolor: 'var(--surface-secondary, #F8F9FC)',
            borderRadius: 'var(--radius-card-lg, 24px)',
          }}
        >
          <Typography 
            variant="h6" 
            sx={{ 
              color: 'var(--text-secondary, #6F7280)',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            }}
          >
            No {filter === 'contests' ? 'contests' : filter === 'regular' ? 'regular jobs' : 'jobs'} available
          </Typography>
          <Typography 
            sx={{ 
              mt: 1,
              color: 'var(--text-muted, #A3A7B5)',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '14px'
            }}
          >
            Check back later for new opportunities
          </Typography>
        </Box>
      )}
    </Container>
  )
}

