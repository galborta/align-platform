/**
 * Budget Exhausted Modal Component
 * 
 * Displays when a worker tries to submit but the campaign budget is exhausted.
 * Shows sympathetic messaging and suggests similar campaigns.
 * 
 * Features:
 * - Clear explanation of what happened
 * - Reassurance (no payment reserved)
 * - Similar campaign suggestions
 * - Browse jobs action
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  Alert,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  CircularProgress
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'

type Job = Database['public']['Tables']['jobs']['Row']

interface BudgetExhaustedModalProps {
  /** Whether modal is open */
  open: boolean
  
  /** Job that exhausted budget */
  job: Job
  
  /** Close modal callback */
  onClose: () => void
}

/**
 * Budget Exhausted Modal
 */
export default function BudgetExhaustedModal({
  open,
  job,
  onClose
}: BudgetExhaustedModalProps) {
  const router = useRouter()
  const [similarJobs, setSimilarJobs] = useState<Job[]>([])
  const [loadingSimilar, setLoadingSimilar] = useState(false)
  
  // Fetch similar jobs when modal opens
  useEffect(() => {
    async function fetchSimilarJobs() {
      if (!open) return
      
      setLoadingSimilar(true)
      
      try {
        // Fetch similar social jobs that are still open
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('is_social_media_job', true)
          .eq('status', 'open')
          .neq('id', job.id) // Exclude current job
          .lt('social_actual_budget_released', 'social_total_budget_usd') // Has budget remaining
          .order('created_at', { ascending: false })
          .limit(3)
        
        if (error) {
          console.error('[BudgetExhaustedModal] Error fetching similar jobs:', error)
          return
        }
        
        setSimilarJobs(data || [])
      } catch (err) {
        console.error('[BudgetExhaustedModal] Unexpected error:', err)
      } finally {
        setLoadingSimilar(false)
      }
    }
    
    fetchSimilarJobs()
  }, [open, job.id])
  
  /**
   * Handle job click - navigate to job detail
   */
  function handleJobClick(jobId: string, projectId: string) {
    onClose()
    router.push(`/project/${projectId}/jobs/${jobId}`)
  }
  
  /**
   * Handle browse jobs - navigate to jobs page
   */
  function handleBrowseJobs() {
    onClose()
    router.push('/jobs')
  }
  
  /**
   * Format currency
   */
  function formatCurrency(amount: number): string {
    return `$${amount.toFixed(2)}`
  }
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 'var(--radius-card-lg, 24px)',
          background: 'var(--card-background, #FFFFFF)',
          boxShadow: 'var(--shadow-floating, 0 24px 60px 0 rgba(15, 23, 42, 0.10))',
          '@media (max-width: 640px)': {
            borderRadius: 0,
            margin: 0,
            maxHeight: '100%',
            maxWidth: '100%',
          }
        }
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          textAlign: 'center',
          pt: 4,
          pb: 2
        }}
      >
        {/* Warning Icon */}
        <Box
          sx={{
            mb: 2,
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <WarningAmberIcon
            sx={{
              fontSize: 80,
              color: '#F59E0B',
              filter: 'drop-shadow(0 4px 12px rgba(245, 158, 11, 0.3))'
            }}
          />
        </Box>
        
        {/* Title */}
        <Typography
          variant="h5"
          sx={{
            fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
            fontSize: 'var(--text-title, 22px)',
            fontWeight: 700,
            color: 'var(--text-primary, #1A1A1E)',
            mb: 1
          }}
        >
          ⚠️ Budget Exhausted
        </Typography>
        
        {/* Job Title */}
        <Typography
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: 'var(--text-body-small, 14px)',
            color: 'var(--text-secondary, #6F7280)'
          }}
        >
          {job.title}
        </Typography>
      </DialogTitle>
      
      <Divider />
      
      {/* Content */}
      <DialogContent sx={{ pt: 3, pb: 2 }}>
        {/* Explanation */}
        <Typography
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: 'var(--text-body, 16px)',
            color: 'var(--text-primary, #1A1A1E)',
            mb: 2.5,
            textAlign: 'center'
          }}
        >
          This campaign has reached its budget limit while you were submitting.
        </Typography>
        
        {/* Reassurance Alert */}
        <Alert
          severity="info"
          sx={{
            mb: 3,
            bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
            color: 'var(--text-primary, #1A1A1E)',
            border: 'none',
            '& .MuiAlert-icon': {
              color: 'var(--accent-primary, #7C4DFF)'
            },
            '& .MuiAlert-message': {
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body-small, 14px)'
            }
          }}
        >
          <strong>Your submission was not saved</strong> and no payment was reserved. You can try other campaigns below.
        </Alert>
        
        {/* Similar Campaigns Section */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <TrendingUpIcon sx={{ color: 'var(--accent-primary, #7C4DFF)', fontSize: 20 }} />
            <Typography
              sx={{
                fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                fontSize: 'var(--text-headline, 18px)',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              Try these similar campaigns:
            </Typography>
          </Box>
          
          {/* Loading State */}
          {loadingSimilar && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={32} sx={{ color: 'var(--accent-primary, #7C4DFF)' }} />
            </Box>
          )}
          
          {/* Similar Jobs List */}
          {!loadingSimilar && similarJobs.length > 0 && (
            <List sx={{ p: 0 }}>
              {similarJobs.map((similarJob) => {
                const remaining = (similarJob.social_total_budget_usd || 0) - (similarJob.social_actual_budget_released || 0)
                
                return (
                  <ListItem
                    key={similarJob.id}
                    disablePadding
                    sx={{ mb: 1 }}
                  >
                    <ListItemButton
                      onClick={() => handleJobClick(similarJob.id, similarJob.project_id)}
                      sx={{
                        border: '1px solid var(--border-subtle, #E5E7F0)',
                        borderRadius: 'var(--radius-card-lg, 12px)',
                        p: 2,
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          bgcolor: 'var(--subtle-background, #F7F8FB)',
                          borderColor: 'var(--accent-primary, #7C4DFF)',
                          transform: 'translateX(4px)'
                        }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Typography
                            sx={{
                              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                              fontSize: 'var(--text-body, 16px)',
                              fontWeight: 600,
                              color: 'var(--text-primary, #1A1A1E)',
                              mb: 0.5
                            }}
                          >
                            {similarJob.title}
                          </Typography>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Chip
                              label={`${formatCurrency(remaining)} remaining`}
                              size="small"
                              sx={{
                                bgcolor: 'var(--accent-success-soft, #E3F8ED)',
                                color: 'var(--accent-success, #10B981)',
                                fontWeight: 600,
                                fontSize: '11px',
                                height: 20
                              }}
                            />
                            <Typography
                              sx={{
                                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                                fontSize: 'var(--text-caption, 12px)',
                                color: 'var(--text-secondary, #6F7280)'
                              }}
                            >
                              {similarJob.social_job_type === 'retweet' ? '🔁 Retweet' : '✍️ Original Tweet'}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                )
              })}
            </List>
          )}
          
          {/* No Similar Jobs */}
          {!loadingSimilar && similarJobs.length === 0 && (
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: 'var(--text-body-small, 14px)',
                color: 'var(--text-secondary, #6F7280)',
                textAlign: 'center',
                py: 2
              }}
            >
              No similar campaigns available right now. Check the jobs page for all opportunities!
            </Typography>
          )}
        </Box>
      </DialogContent>
      
      {/* Actions */}
      <DialogActions
        sx={{
          px: 3,
          pb: 3,
          pt: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5
        }}
      >
        {/* Browse Jobs Button */}
        <Button
          fullWidth
          variant="contained"
          onClick={handleBrowseJobs}
          sx={{
            bgcolor: 'var(--accent-primary, #7C4DFF)',
            color: '#FFFFFF',
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: 'var(--text-label, 14px)',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 'var(--radius-control, 999px)',
            py: 1.25,
            px: 3,
            boxShadow: 'var(--shadow-chip, 0 8px 20px 0 rgba(124, 77, 255, 0.25))',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              bgcolor: '#6B3FEE',
              transform: 'translateY(-2px)',
              boxShadow: '0 12px 24px 0 rgba(124, 77, 255, 0.3)'
            }
          }}
        >
          Browse All Jobs
        </Button>
        
        {/* Close Button */}
        <Button
          fullWidth
          variant="text"
          onClick={onClose}
          sx={{
            color: 'var(--text-secondary, #6F7280)',
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: 'var(--text-body-small, 14px)',
            fontWeight: 500,
            textTransform: 'none',
            py: 0.75,
            '&:hover': {
              bgcolor: 'transparent',
              color: 'var(--text-primary, #1A1A1E)'
            }
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

