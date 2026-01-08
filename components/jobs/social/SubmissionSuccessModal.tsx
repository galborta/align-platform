/**
 * Submission Success Modal Component
 * 
 * Displays success confirmation after worker submits to a social media job.
 * Shows payment details, auto-approval date, and next steps.
 * 
 * Features:
 * - Large success checkmark
 * - Payment amount display
 * - Two payment scenarios (manual/auto)
 * - Bonus potential (if enabled)
 * - Warning about keeping tweet live
 * - Action button to view submission
 * - Optional confetti celebration
 * - Auto-close after 5 seconds (if no interaction)
 */

'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  Alert
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'

/**
 * Props for SubmissionSuccessModal
 */
interface SubmissionSuccessModalProps {
  /** Whether modal is open */
  open: boolean
  
  /** Submission details */
  submission: {
    /** Reserved payment amount in USD */
    payment_amount: number
    
    /** Date when submission will be auto-approved */
    auto_approve_date: string
    
    /** Job title */
    job_title: string
    
    /** Whether impression bonuses are enabled */
    enable_impression_bonuses: boolean
  }
  
  /** Close modal callback */
  onClose: () => void
  
  /** View submission callback (navigates to status page) */
  onViewSubmission: () => void
}

/**
 * Format date to human-readable string
 * Example: "Jan 22, 2025"
 */
function formatAutoApproveDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

/**
 * Format date for warning message
 * Example: "January 22, 2025"
 */
function formatDeadlineDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

/**
 * Submission Success Modal
 * 
 * Shows celebratory confirmation with payment details and next steps
 */
export default function SubmissionSuccessModal({
  open,
  submission,
  onClose,
  onViewSubmission
}: SubmissionSuccessModalProps) {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)
  
  // Auto-close after 8 seconds (longer to give user time to read)
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => {
        onClose()
      }, 8000) // 8 seconds
      
      setTimeoutId(id)
      
      return () => {
        if (id) clearTimeout(id)
      }
    }
  }, [open, onClose])
  
  /**
   * Handle button click - cancel auto-close and trigger action
   */
  function handleViewSubmission() {
    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(null)
    }
    onViewSubmission()
  }
  
  /**
   * Handle close - cancel auto-close
   */
  function handleClose() {
    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(null)
    }
    onClose()
  }
  
  const formattedDate = formatAutoApproveDate(submission.auto_approve_date)
  const formattedDeadline = formatDeadlineDate(submission.auto_approve_date)
  
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 'var(--radius-card-lg, 24px)',
          background: 'var(--card-background, #FFFFFF)',
          boxShadow: 'var(--shadow-floating, 0 24px 60px 0 rgba(15, 23, 42, 0.10))',
          overflow: 'visible',
          '@media (max-width: 640px)': {
            borderRadius: 0,
            margin: 0,
            maxHeight: '100%',
            maxWidth: '100%',
          }
        }
      }}
    >
      {/* Success Header */}
      <DialogTitle
        sx={{
          textAlign: 'center',
          pt: 4,
          pb: 2,
          position: 'relative'
        }}
      >
        {/* Large Success Checkmark */}
        <Box
          sx={{
            mb: 2,
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <CheckCircleIcon
            sx={{
              fontSize: 80,
              color: 'var(--accent-success, #10B981)',
              filter: 'drop-shadow(0 4px 12px rgba(16, 185, 129, 0.3))'
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
          ✅ Application Submitted!
        </Typography>
        
        {/* Job Title */}
        <Typography
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: 'var(--text-body-small, 14px)',
            color: 'var(--text-secondary, #6F7280)'
          }}
        >
          {submission.job_title}
        </Typography>
      </DialogTitle>
      
      <Divider />
      
      {/* Content */}
      <DialogContent sx={{ pt: 3, pb: 2 }}>
        {/* Payment Reserved */}
        <Box
          sx={{
            textAlign: 'center',
            mb: 3
          }}
        >
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body, 16px)',
              color: 'var(--text-primary, #1A1A1E)',
              mb: 2
            }}
          >
            Your payment of{' '}
            <Box
              component="span"
              sx={{
                fontWeight: 700,
                color: 'var(--accent-success, #10B981)',
                fontSize: 'var(--text-headline, 18px)'
              }}
            >
              ${submission.payment_amount.toFixed(2)}
            </Box>
            {' '}has been reserved.
          </Typography>
        </Box>
        
        {/* Payment Scenarios */}
        <Box
          sx={{
            bgcolor: 'var(--accent-success-soft, #E3F8ED)',
            borderRadius: 'var(--radius-card-lg, 16px)',
            p: 2.5,
            mb: 3
          }}
        >
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body-small, 14px)',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)',
              mb: 1.5
            }}
          >
            You'll be paid:
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'var(--accent-success, #10B981)',
                  mt: 0.7,
                  flexShrink: 0
                }}
              />
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: 'var(--text-body-small, 14px)',
                  color: 'var(--text-primary, #1A1A1E)',
                  lineHeight: 1.6
                }}
              >
                <strong>Immediately</strong> if poster manually approves
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'var(--accent-success, #10B981)',
                  mt: 0.7,
                  flexShrink: 0
                }}
              />
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: 'var(--text-body-small, 14px)',
                  color: 'var(--text-primary, #1A1A1E)',
                  lineHeight: 1.6
                }}
              >
                <strong>Automatically</strong> when campaign ends ({formattedDate})
              </Typography>
            </Box>
          </Box>
        </Box>
        
        {/* Payment Details */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            mb: 3,
            p: 2,
            bgcolor: 'var(--subtle-background, #F7F8FB)',
            borderRadius: 'var(--radius-card-lg, 12px)'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: 'var(--text-body-small, 14px)',
                color: 'var(--text-secondary, #6F7280)'
              }}
            >
              Base payment:
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: 'var(--text-body, 16px)',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              ${submission.payment_amount.toFixed(2)} (guaranteed)
            </Typography>
          </Box>
          
          {submission.enable_impression_bonuses && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: 'var(--text-body-small, 14px)',
                  color: 'var(--text-secondary, #6F7280)'
                }}
              >
                Potential bonus:
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: 'var(--text-body, 16px)',
                  fontWeight: 600,
                  color: 'var(--accent-primary, #7C4DFF)'
                }}
              >
                Based on impressions
              </Typography>
            </Box>
          )}
        </Box>
        
        {/* Info Alert */}
        <Alert
          icon={<InfoOutlinedIcon sx={{ fontSize: 20 }} />}
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
          💡 The poster can approve and pay you anytime before {formattedDate}!
        </Alert>
        
        {/* Warning Alert */}
        <Alert
          icon={<WarningAmberIcon sx={{ fontSize: 20 }} />}
          severity="warning"
          sx={{
            bgcolor: '#FEF3C7',
            color: 'var(--text-primary, #1A1A1E)',
            border: 'none',
            '& .MuiAlert-icon': {
              color: '#F59E0B'
            },
            '& .MuiAlert-message': {
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-body-small, 14px)',
              fontWeight: 600
            }
          }}
        >
          ⚠️ Keep your tweet live until {formattedDeadline}
        </Alert>
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
        {/* Primary Action */}
        <Button
          fullWidth
          variant="contained"
          onClick={handleViewSubmission}
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
            },
            '&:active': {
              transform: 'translateY(0)'
            }
          }}
        >
          View My Submission
        </Button>
        
        {/* Secondary Action */}
        <Button
          fullWidth
          variant="text"
          onClick={handleClose}
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
          Close (auto-closes in 8s)
        </Button>
      </DialogActions>
    </Dialog>
  )
}

