'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress
} from '@mui/material'
import { useWallet } from '@solana/wallet-adapter-react'
import { useActionSignature } from '@/hooks/useActionSignature'

interface ExtendDeadlineDialogProps {
  open: boolean
  onClose: () => void
  jobId: string
  jobTitle: string
  currentDeadline: string | null
  isContest?: boolean
  isSocialJob?: boolean
  deadlineType?: 'poster_desired' | 'hard_deadline' | 'contest_submission' | 'social_submission'
  onSuccess?: () => void
}

/**
 * ExtendDeadlineDialog
 * 
 * A dialog for extending job deadlines with cryptographic signature verification.
 * 
 * Features:
 * - Date picker for new deadline with validation
 * - Automatic cascading deadline calculation for contest/social jobs
 * - Wallet signature flow for authentication
 * - Error handling and user feedback
 * 
 * Design System:
 * - Follows Align design system (Satoshi font, purple accents, rounded corners)
 * - Uses Material UI components styled with CSS variables
 * - Soft shadows and generous spacing
 */
export default function ExtendDeadlineDialog({
  open,
  onClose,
  jobId,
  jobTitle,
  currentDeadline,
  isContest = false,
  isSocialJob = false,
  deadlineType = 'poster_desired',
  onSuccess
}: ExtendDeadlineDialogProps) {
  const { publicKey } = useWallet()
  const { signAction } = useActionSignature()
  
  const [daysToAdd, setDaysToAdd] = useState<number>(7) // Default to 7 days
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  // Format current deadline for display
  const currentDeadlineDisplay = currentDeadline
    ? new Date(currentDeadline).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Not set'
  
  // Calculate and display what will change
  const calculateNewDeadlines = () => {
    if (!currentDeadline || !daysToAdd || daysToAdd < 1) return null
    
    // Start from current deadline and add days
    const baseDate = new Date(currentDeadline)
    baseDate.setDate(baseDate.getDate() + daysToAdd)
    
    if (isSocialJob) {
      const engagement = new Date(baseDate)
      engagement.setDate(engagement.getDate() + 7)
      const review = new Date(baseDate)
      review.setDate(review.getDate() + 1)
      
      return {
        submission: baseDate,
        engagement,
        review
      }
    }
    
    if (isContest) {
      const selection = new Date(baseDate)
      selection.setDate(selection.getDate() + 3)
      
      return {
        submission: baseDate,
        selection
      }
    }
    
    return { deadline: baseDate }
  }
  
  const handleExtend = async () => {
    if (!publicKey) {
      setError('Please connect your wallet')
      return
    }
    
    if (!daysToAdd || daysToAdd < 1) {
      setError('Please enter a valid number of days (minimum 1)')
      return
    }
    
    if (!currentDeadline) {
      setError('Current deadline not found')
      return
    }
    
    // Calculate new deadline
    const newDeadlineDate = new Date(currentDeadline)
    newDeadlineDate.setDate(newDeadlineDate.getDate() + daysToAdd)
    
    setLoading(true)
    setError(null)
    
    try {
      // Sign the action
      const { signature, message } = await signAction({
        action: 'Extend deadline',
        resourceId: jobId,
        additionalInfo: {
          daysToAdd: daysToAdd.toString()
        }
      })
      
      // Call API
      const response = await fetch(`/api/jobs/${jobId}/extend-deadline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          signature,
          message,
          new_deadline: newDeadlineDate.toISOString(),
          deadline_type: deadlineType
        })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to extend deadline')
      }
      
      setSuccess(true)
      
      // Wait a moment for user to see success message
      setTimeout(() => {
        onSuccess?.()
        handleClose()
      }, 1500)
      
    } catch (err) {
      console.error('Error extending deadline:', err)
      setError(err instanceof Error ? err.message : 'Failed to extend deadline')
    } finally {
      setLoading(false)
    }
  }
  
  const handleClose = () => {
    if (!loading) {
      setDaysToAdd(7)
      setError(null)
      setSuccess(false)
      onClose()
    }
  }
  
  const calculatedDeadlines = calculateNewDeadlines()
  
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 'var(--radius-card-lg, 24px)',
          boxShadow: 'var(--shadow-floating, 0 24px 60px 0 rgba(15, 23, 42, 0.10))',
          background: 'var(--card-background, #FFFFFF)'
        }
      }}
    >
      <DialogTitle
        sx={{
          fontFamily: 'var(--font-heading, "Space Grotesk")',
          fontSize: 'var(--text-title, 22px)',
          fontWeight: 'var(--weight-semibold, 600)',
          color: 'var(--text-primary, #1A1A1E)',
          paddingTop: 'var(--space-lg, 24px)',
          paddingX: 'var(--space-lg, 24px)',
          paddingBottom: 'var(--space-md, 16px)'
        }}
      >
        Extend Deadline
      </DialogTitle>
      
      <DialogContent
        sx={{
          paddingX: 'var(--space-lg, 24px)',
          paddingTop: 'var(--space-md, 16px)',
          paddingBottom: 'var(--space-lg, 24px)'
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md, 16px)' }}>
          {/* Job Info */}
          <Box>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'var(--font-body, "Satoshi")',
                fontSize: 'var(--text-body-small, 14px)',
                color: 'var(--text-secondary, #6F7280)',
                marginBottom: 'var(--space-xs, 8px)'
              }}
            >
              Job
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontFamily: 'var(--font-body, "Satoshi")',
                fontSize: 'var(--text-body, 16px)',
                fontWeight: 'var(--weight-medium, 500)',
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              {jobTitle}
            </Typography>
          </Box>
          
          {/* Current Deadline */}
          <Box>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'var(--font-body, "Satoshi")',
                fontSize: 'var(--text-body-small, 14px)',
                color: 'var(--text-secondary, #6F7280)',
                marginBottom: 'var(--space-xs, 8px)'
              }}
            >
              Current {isSocialJob ? 'Submission ' : isContest ? 'Submission ' : ''}Deadline
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontFamily: 'var(--font-body, "Satoshi")',
                fontSize: 'var(--text-body, 16px)',
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              {currentDeadlineDisplay}
            </Typography>
          </Box>
          
          {/* Days to Add Input */}
          <Box>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'var(--font-body, "Satoshi")',
                fontSize: 'var(--text-body-small, 14px)',
                color: 'var(--text-secondary, #6F7280)',
                marginBottom: 'var(--space-xs, 8px)'
              }}
            >
              Days to Add
            </Typography>
            <TextField
              type="number"
              value={daysToAdd}
              onChange={(e) => setDaysToAdd(parseInt(e.target.value) || 0)}
              inputProps={{
                min: 1,
                max: 365,
                step: 1
              }}
              fullWidth
              required
              placeholder="7"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 'var(--radius-card-lg, 24px)',
                  fontFamily: 'var(--font-body, "Satoshi")',
                  fontSize: 'var(--text-body, 16px)',
                  '&:hover fieldset': {
                    borderColor: 'var(--accent-primary, #7C4DFF)'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'var(--accent-primary, #7C4DFF)'
                  }
                },
                '& input': {
                  fontFamily: 'var(--font-body, "Satoshi")',
                  fontSize: 'var(--text-body, 16px)',
                  fontWeight: 'var(--weight-medium, 500)'
                }
              }}
            />
            
            {/* Quick Select Buttons */}
            <Box sx={{ display: 'flex', gap: 'var(--space-xs, 8px)', mt: 'var(--space-sm, 12px)' }}>
              {[3, 7, 14, 30].map((days) => (
                <Button
                  key={days}
                  onClick={() => setDaysToAdd(days)}
                  variant={daysToAdd === days ? 'contained' : 'outlined'}
                  size="small"
                  sx={{
                    flex: 1,
                    borderRadius: 'var(--radius-control, 999px)',
                    fontFamily: 'var(--font-body, "Satoshi")',
                    fontSize: 'var(--text-caption, 12px)',
                    fontWeight: 'var(--weight-medium, 500)',
                    textTransform: 'none',
                    py: 0.5,
                    ...(daysToAdd === days ? {
                      backgroundColor: 'var(--accent-primary, #7C4DFF)',
                      color: '#FFFFFF',
                      '&:hover': {
                        backgroundColor: '#6A3EE8'
                      }
                    } : {
                      color: 'var(--text-secondary, #6F7280)',
                      borderColor: 'var(--border-subtle, #E5E7F0)',
                      '&:hover': {
                        borderColor: 'var(--accent-primary, #7C4DFF)',
                        backgroundColor: 'var(--accent-primary-soft, #EEE7FF)'
                      }
                    })
                  }}
                >
                  {days}d
                </Button>
              ))}
            </Box>
          </Box>
          
          {/* Calculated Deadlines Info */}
          {calculatedDeadlines && daysToAdd > 0 && (
            <Alert
              severity="info"
              sx={{
                borderRadius: 'var(--radius-card-lg, 24px)',
                fontFamily: 'var(--font-body, "Satoshi")',
                '& .MuiAlert-message': {
                  width: '100%'
                }
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'var(--font-body, "Satoshi")',
                  fontSize: 'var(--text-body-small, 14px)',
                  fontWeight: 'var(--weight-medium, 500)',
                  marginBottom: 'var(--space-xs, 8px)'
                }}
              >
                Adding {daysToAdd} {daysToAdd === 1 ? 'day' : 'days'} will result in:
              </Typography>
              
              {isSocialJob && 'submission' in calculatedDeadlines && (
                <>
                  <Typography variant="body2" sx={{ fontSize: 'var(--text-body-small, 14px)' }}>
                    • Submission: {calculatedDeadlines.submission.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Typography>
                  {'engagement' in calculatedDeadlines && (
                    <Typography variant="body2" sx={{ fontSize: 'var(--text-body-small, 14px)' }}>
                      • Engagement: {calculatedDeadlines.engagement.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })} (+7 days)
                    </Typography>
                  )}
                  {'review' in calculatedDeadlines && (
                    <Typography variant="body2" sx={{ fontSize: 'var(--text-body-small, 14px)' }}>
                      • Review: {calculatedDeadlines.review.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })} (+1 day)
                    </Typography>
                  )}
                </>
              )}
              
              {isContest && 'submission' in calculatedDeadlines && (
                <>
                  <Typography variant="body2" sx={{ fontSize: 'var(--text-body-small, 14px)' }}>
                    • Submission: {calculatedDeadlines.submission.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Typography>
                  {'selection' in calculatedDeadlines && (
                    <Typography variant="body2" sx={{ fontSize: 'var(--text-body-small, 14px)' }}>
                      • Winner Selection: {calculatedDeadlines.selection.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })} (+3 days)
                    </Typography>
                  )}
                </>
              )}
              
              {!isSocialJob && !isContest && 'deadline' in calculatedDeadlines && (
                <Typography variant="body2" sx={{ fontSize: 'var(--text-body-small, 14px)' }}>
                  • {deadlineType === 'hard_deadline' ? 'Hard Deadline' : 'Completion Date'}: {calculatedDeadlines.deadline.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Typography>
              )}
            </Alert>
          )}
          
          {/* Error */}
          {error && (
            <Alert
              severity="error"
              sx={{
                borderRadius: 'var(--radius-card-lg, 24px)',
                fontFamily: 'var(--font-body, "Satoshi")'
              }}
            >
              {error}
            </Alert>
          )}
          
          {/* Success */}
          {success && (
            <Alert
              severity="success"
              sx={{
                borderRadius: 'var(--radius-card-lg, 24px)',
                fontFamily: 'var(--font-body, "Satoshi")'
              }}
            >
              Deadline extended successfully! Participants will be notified.
            </Alert>
          )}
        </Box>
      </DialogContent>
      
      <DialogActions
        sx={{
          paddingX: 'var(--space-lg, 24px)',
          paddingBottom: 'var(--space-lg, 24px)',
          paddingTop: 0,
          gap: 'var(--space-sm, 12px)'
        }}
      >
        <Button
          onClick={handleClose}
          disabled={loading}
          sx={{
            borderRadius: 'var(--radius-control, 999px)',
            paddingX: 'var(--space-lg, 24px)',
            paddingY: 'var(--space-sm, 12px)',
            fontFamily: 'var(--font-body, "Satoshi")',
            fontSize: 'var(--text-label, 14px)',
            fontWeight: 'var(--weight-medium, 500)',
            textTransform: 'none',
            color: 'var(--text-secondary, #6F7280)',
            '&:hover': {
              backgroundColor: 'var(--subtle-background, #F7F8FB)'
            }
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleExtend}
          disabled={loading || !daysToAdd || daysToAdd < 1 || success}
          variant="contained"
          sx={{
            borderRadius: 'var(--radius-control, 999px)',
            paddingX: 'var(--space-lg, 24px)',
            paddingY: 'var(--space-sm, 12px)',
            fontFamily: 'var(--font-body, "Satoshi")',
            fontSize: 'var(--text-label, 14px)',
            fontWeight: 'var(--weight-medium, 500)',
            textTransform: 'none',
            backgroundColor: 'var(--accent-primary, #7C4DFF)',
            color: '#FFFFFF',
            boxShadow: 'var(--shadow-chip, 0 8px 20px 0 rgba(15, 23, 42, 0.08))',
            '&:hover': {
              backgroundColor: '#6A3EE8',
              boxShadow: 'var(--shadow-floating, 0 24px 60px 0 rgba(15, 23, 42, 0.10))'
            },
            '&:disabled': {
              backgroundColor: 'var(--text-muted, #A3A7B5)',
              color: '#FFFFFF'
            }
          }}
        >
          {loading ? (
            <>
              <CircularProgress
                size={16}
                sx={{
                  color: '#FFFFFF',
                  marginRight: 'var(--space-xs, 8px)'
                }}
              />
              Extending...
            </>
          ) : success ? (
            'Extended ✓'
          ) : (
            'Extend Deadline'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

