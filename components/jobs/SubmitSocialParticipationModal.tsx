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
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Chip
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import LinkIcon from '@mui/icons-material/Link'
import PeopleIcon from '@mui/icons-material/People'
import { toast } from 'react-hot-toast'

interface SubmitSocialParticipationModalProps {
  open: boolean
  onClose: () => void
  job: {
    id: string
    title: string
    social_job_type: 'retweet' | 'original_tweet'
    social_tweet_url: string | null
    social_min_followers_required: number | null
  }
  userWallet: string
  onSubmissionSuccess?: () => void
}

export default function SubmitSocialParticipationModal({
  open,
  onClose,
  job,
  userWallet,
  onSubmissionSuccess
}: SubmitSocialParticipationModalProps) {
  const [tweetLink, setTweetLink] = useState('')
  const [followerCount, setFollowerCount] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState(false)
  const [activeStep, setActiveStep] = useState(0)

  const isRetweet = job.social_job_type === 'retweet'

  // Validation helpers
  const validateTweetUrl = (url: string): boolean => {
    // Match twitter.com or x.com URLs with status
    const twitterPattern = /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/
    return twitterPattern.test(url)
  }

  const extractTweetId = (url: string): string | null => {
    const match = url.match(/status\/(\d+)/)
    return match ? match[1] : null
  }

  const validateForm = (): boolean => {
    setError('')

    // Tweet link validation
    if (!tweetLink.trim()) {
      setError('Please enter your tweet link')
      return false
    }

    if (!validateTweetUrl(tweetLink)) {
      setError('Please enter a valid Twitter/X URL (e.g., https://twitter.com/username/status/123456)')
      return false
    }

    // For retweets, verify they're not submitting the original tweet URL
    if (isRetweet && job.social_tweet_url) {
      const originalTweetId = extractTweetId(job.social_tweet_url)
      const submittedTweetId = extractTweetId(tweetLink)
      
      if (originalTweetId && submittedTweetId && originalTweetId === submittedTweetId) {
        setError('Please submit your retweet link, not the original tweet link')
        return false
      }
    }

    // Follower count validation
    if (followerCount === '' || followerCount < 0) {
      setError('Please enter your current follower count')
      return false
    }

    if (job.social_min_followers_required && followerCount < job.social_min_followers_required) {
      setError(`Minimum ${job.social_min_followers_required.toLocaleString()} followers required to participate`)
      return false
    }

    return true
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/jobs/${job.id}/submit-social`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worker_wallet: userWallet,
          social_tweet_link: tweetLink.trim(),
          social_follower_count: followerCount
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit')
      }

      setSuccess(true)
      toast.success('Submission successful!')
      
      // Call success callback after a short delay
      setTimeout(() => {
        onSubmissionSuccess?.()
        handleClose()
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to submit. Please try again.')
      toast.error(err.message || 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setTweetLink('')
      setFollowerCount('')
      setError('')
      setSuccess(false)
      setActiveStep(0)
      onClose()
    }
  }

  // Update active step based on form completion
  const getActiveStep = () => {
    if (tweetLink && validateTweetUrl(tweetLink) && followerCount !== '' && followerCount >= 0) {
      return 3 // All done
    }
    if (tweetLink && validateTweetUrl(tweetLink)) {
      return 2 // Tweet link entered
    }
    return 0 // Just starting
  }

  const steps = [
    isRetweet ? 'Retweet the Tweet' : 'Post Your Tweet',
    'Enter Tweet Link',
    'Report Followers'
  ]

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'var(--card-background, #FFFFFF)',
          borderRadius: 'var(--radius-card-lg, 24px)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.15)',
          border: '2px solid var(--accent-primary, #7C4DFF)'
        }
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-subtle, #E5E7F0)',
          pb: 2
        }}
      >
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontWeight: 700,
              color: 'var(--text-primary, #1A1A1E)'
            }}
          >
            🚀 Submit Your {isRetweet ? 'Retweet' : 'Tweet'}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              color: 'var(--text-secondary, #6F7280)'
            }}
          >
            {job.title}
          </Typography>
        </Box>
        <IconButton
          onClick={handleClose}
          disabled={loading}
          sx={{
            color: 'var(--text-secondary, #6F7280)',
            '&:hover': { bgcolor: 'var(--subtle-background, #F7F8FB)' }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {success ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 4
            }}
          >
            <CheckCircleIcon
              sx={{
                fontSize: 64,
                color: 'var(--accent-success, #36C170)',
                mb: 2
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 1
              }}
            >
              Submission Successful!
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                color: 'var(--text-secondary, #6F7280)'
              }}
            >
              Your participation has been recorded. Check back for approval status.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Progress Stepper */}
            <Stepper
              activeStep={getActiveStep()}
              alternativeLabel
              sx={{
                mb: 4,
                '& .MuiStepLabel-label': {
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '12px'
                },
                '& .MuiStepIcon-root': {
                  color: 'var(--border-subtle, #E5E7F0)',
                  '&.Mui-active': {
                    color: 'var(--accent-primary, #7C4DFF)'
                  },
                  '&.Mui-completed': {
                    color: 'var(--accent-success, #36C170)'
                  }
                }
              }}
            >
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {/* Step 1: Action Instruction */}
            <Box
              sx={{
                mb: 3,
                p: 2.5,
                bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
                borderRadius: 'var(--radius-card-lg, 24px)',
                border: '1px solid var(--accent-primary, #7C4DFF)'
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontWeight: 600,
                  color: 'var(--accent-primary, #7C4DFF)',
                  mb: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <Chip
                  label="1"
                  size="small"
                  sx={{
                    bgcolor: 'var(--accent-primary, #7C4DFF)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    minWidth: 24,
                    height: 24
                  }}
                />
                {isRetweet ? 'First, Retweet the Campaign Tweet' : 'First, Create and Post Your Tweet'}
              </Typography>

              {isRetweet && job.social_tweet_url ? (
                <Button
                  variant="outlined"
                  href={job.social_tweet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<OpenInNewIcon />}
                  sx={{
                    borderColor: 'var(--accent-primary, #7C4DFF)',
                    color: 'var(--accent-primary, #7C4DFF)',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-control, 999px)',
                    textTransform: 'none',
                    '&:hover': {
                      borderColor: '#6A3FE8',
                      bgcolor: 'rgba(124, 77, 255, 0.1)'
                    }
                  }}
                >
                  Open Tweet on Twitter/X
                </Button>
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    color: 'var(--text-primary, #1A1A1E)',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                  }}
                >
                  Create your tweet following the campaign instructions, then post it to Twitter/X
                </Typography>
              )}
            </Box>

            {/* Step 2: Tweet Link Input */}
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)',
                  mb: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <Chip
                  label="2"
                  size="small"
                  sx={{
                    bgcolor: tweetLink && validateTweetUrl(tweetLink) ? 'var(--accent-success, #36C170)' : 'var(--text-muted, #A3A7B5)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    minWidth: 24,
                    height: 24
                  }}
                />
                Paste Your {isRetweet ? 'Retweet' : 'Tweet'} Link
              </Typography>

              <TextField
                fullWidth
                label={`Your ${isRetweet ? 'Retweet' : 'Tweet'} Link`}
                value={tweetLink}
                onChange={(e) => setTweetLink(e.target.value)}
                placeholder="https://twitter.com/yourname/status/123456..."
                helperText={
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    💡 Click your {isRetweet ? 'retweet' : 'tweet'}&apos;s timestamp → copy URL from browser
                  </span>
                }
                error={!!error && (error.includes('URL') || error.includes('link') || error.includes('retweet link'))}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkIcon sx={{ color: 'var(--text-muted, #A3A7B5)' }} />
                    </InputAdornment>
                  ),
                  endAdornment: tweetLink && validateTweetUrl(tweetLink) && (
                    <InputAdornment position="end">
                      <CheckCircleIcon sx={{ color: 'var(--accent-success, #36C170)' }} />
                    </InputAdornment>
                  )
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 'var(--radius-control, 999px)',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    '&.Mui-focused fieldset': {
                      borderColor: 'var(--accent-primary, #7C4DFF)'
                    }
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: 'var(--accent-primary, #7C4DFF)'
                  },
                  '& .MuiFormHelperText-root': {
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                  }
                }}
              />
            </Box>

            {/* Step 3: Follower Count Input */}
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)',
                  mb: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <Chip
                  label="3"
                  size="small"
                  sx={{
                    bgcolor: followerCount !== '' && followerCount >= 0 ? 'var(--accent-success, #36C170)' : 'var(--text-muted, #A3A7B5)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    minWidth: 24,
                    height: 24
                  }}
                />
                Enter Your Current Follower Count
              </Typography>

              <TextField
                fullWidth
                type="number"
                label="Follower Count"
                value={followerCount}
                onChange={(e) => setFollowerCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                placeholder="1250"
                inputProps={{ min: 0 }}
                error={!!error && error.includes('follower')}
                helperText={
                  job.social_min_followers_required
                    ? `Minimum ${job.social_min_followers_required.toLocaleString()} followers required`
                    : 'Check your Twitter/X profile for your current follower count'
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PeopleIcon sx={{ color: 'var(--text-muted, #A3A7B5)' }} />
                    </InputAdornment>
                  ),
                  endAdornment: followerCount !== '' && followerCount >= 0 && (
                    <InputAdornment position="end">
                      <CheckCircleIcon sx={{ color: 'var(--accent-success, #36C170)' }} />
                    </InputAdornment>
                  )
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 'var(--radius-control, 999px)',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    '&.Mui-focused fieldset': {
                      borderColor: 'var(--accent-primary, #7C4DFF)'
                    }
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: 'var(--accent-primary, #7C4DFF)'
                  },
                  '& .MuiFormHelperText-root': {
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                  }
                }}
              />
            </Box>

            {/* Warnings */}
            <Alert
              severity="warning"
              sx={{
                mb: 2,
                borderRadius: 'var(--radius-card-lg, 24px)',
                '& .MuiAlert-message': {
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                }
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                ⚠️ <strong>Important:</strong> Follower count is used for eligibility verification.
                Your final payment will be based on your post's actual reach and engagement.
              </Typography>
            </Alert>

            <Alert
              severity="info"
              sx={{
                borderRadius: 'var(--radius-card-lg, 24px)',
                '& .MuiAlert-message': {
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                }
              }}
            >
              <Typography variant="body2">
                💡 <strong>Tip:</strong>{' '}
                {isRetweet
                  ? 'Add your own comment when retweeting (Quote Tweet) to increase engagement and visibility.'
                  : 'Make your tweet authentic and engaging! Better engagement = better reach for the campaign.'}
              </Typography>
            </Alert>

            {/* Error Display */}
            {error && (
              <Alert
                severity="error"
                sx={{
                  mt: 2,
                  borderRadius: 'var(--radius-card-lg, 24px)',
                  '& .MuiAlert-message': {
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                  }
                }}
              >
                {error}
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      {/* Actions */}
      {!success && (
        <DialogActions
          sx={{
            borderTop: '1px solid var(--border-subtle, #E5E7F0)',
            p: 2.5,
            gap: 1.5
          }}
        >
          <Button
            onClick={handleClose}
            disabled={loading}
            sx={{
              color: 'var(--text-secondary, #6F7280)',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 500,
              textTransform: 'none',
              borderRadius: 'var(--radius-control, 999px)',
              px: 3,
              '&:hover': {
                bgcolor: 'var(--subtle-background, #F7F8FB)'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !tweetLink || followerCount === ''}
            sx={{
              bgcolor: 'var(--accent-primary, #7C4DFF)',
              color: '#FFFFFF',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 'var(--radius-control, 999px)',
              px: 4,
              py: 1.25,
              boxShadow: '0 4px 14px rgba(124, 77, 255, 0.3)',
              '&:hover': {
                bgcolor: '#6A3FE8',
                boxShadow: '0 6px 20px rgba(124, 77, 255, 0.4)'
              },
              '&:disabled': {
                bgcolor: 'var(--border-subtle, #E5E7F0)',
                color: 'var(--text-muted, #A3A7B5)'
              }
            }}
          >
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={18} sx={{ color: 'inherit' }} />
                Submitting...
              </Box>
            ) : (
              '🚀 Submit Participation'
            )}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  )
}

