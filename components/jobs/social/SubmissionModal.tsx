'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material'
import { Database } from '@/types/database'
import { BudgetTier } from '@/types/social-jobs'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import LinkIcon from '@mui/icons-material/Link'
import { LoadingButton } from '@/components/ui/LoadingStates'

type Job = Database['public']['Tables']['jobs']['Row']

interface SubmissionModalProps {
  open: boolean
  job: Job
  onClose: () => void
  onSuccess: (submissionId: string) => void
  walletAddress?: string
  signMessage?: (message: string) => Promise<string>
}

/**
 * Format follower range for display in dropdown
 */
function formatFollowerRange(tier: BudgetTier): string {
  const formatNum = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
    return num.toString()
  }
  
  if (tier.max_followers === null) {
    return `${formatNum(tier.min_followers)}+`
  }
  
  return `${formatNum(tier.min_followers)}-${formatNum(tier.max_followers)}`
}

/**
 * Validate Twitter/X tweet URL
 * Accepts formats:
 * - https://twitter.com/username/status/123456
 * - https://x.com/username/status/123456
 */
function validateTweetUrl(url: string): boolean {
  if (!url) return false
  
  const twitterPattern = /^https?:\/\/(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/\d+/
  return twitterPattern.test(url)
}

/**
 * Map API error codes to user-friendly messages
 */
function mapSubmissionError(errorType: string): string {
  const errorMap: Record<string, string> = {
    'budget_exhausted': '💸 Campaign budget exhausted. Try another campaign.',
    'already_submitted': '✋ You have already submitted to this campaign.',
    'duplicate_tweet': '🔗 This tweet link has already been submitted by another worker.',
    'campaign_ended': '⏰ This campaign is no longer accepting submissions.',
    'invalid_tweet_url': '🔗 Please enter a valid Twitter/X post URL.',
    'invalid_signature': '✍️ Wallet signature verification failed. Please try again.',
    'signature_failed': '✍️ Wallet signature failed. Please try again.',
    'job_not_found': '❌ Campaign not found.',
    'campaign_misconfigured': '⚠️ Campaign is misconfigured. Please contact support.',
    'cannot_submit_to_own_campaign': '⛔ You cannot submit to your own campaign.',
    'invalid_follower_range': '📊 Invalid follower range selected.',
    'invalid_tier': '💰 Selected payment tier is not valid for this campaign.',
    'payment_amount_mismatch': '💵 Payment amount mismatch. Please refresh and try again.',
    'database_error': '🔌 Database error. Please try again.',
    'submission_failed': '❌ Submission failed. Please try again.',
    'internal_error': '⚠️ Internal server error. Please try again.',
    'wallet_not_connected': '👛 Please connect your wallet to submit.'
  }
  
  return errorMap[errorType] || `❌ ${errorType.replace(/_/g, ' ')}`
}

export default function SubmissionModal({
  open,
  job,
  onClose,
  onSuccess,
  walletAddress,
  signMessage
}: SubmissionModalProps) {
  // State management
  const [selectedTier, setSelectedTier] = useState<BudgetTier | null>(null)
  const [tweetLink, setTweetLink] = useState('')
  const [confirmLive, setConfirmLive] = useState(false)
  const [confirmGuidelines, setConfirmGuidelines] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Parse budget tiers from JSONB
  const budgetTiers: BudgetTier[] = Array.isArray(job.social_budget_tiers)
    ? (job.social_budget_tiers as BudgetTier[])
    : []
  
  // Validate tweet URL in real-time
  const tweetUrlValid = validateTweetUrl(tweetLink)
  const showTweetError = tweetLink.length > 0 && !tweetUrlValid
  
  // Check if form is valid and ready to submit
  const canSubmit = 
    selectedTier !== null &&
    tweetLink.length > 0 &&
    tweetUrlValid &&
    confirmLive &&
    confirmGuidelines &&
    !isSubmitting
  
  // Format engagement deadline
  const engagementDeadline = job.social_engagement_deadline
    ? new Date(job.social_engagement_deadline).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : 'campaign end'
  
  /**
   * Handle form submission
   */
  async function handleSubmit() {
    if (!canSubmit || !walletAddress || !signMessage) {
      setError('Wallet not connected or form incomplete')
      return
    }
    
    setIsSubmitting(true)
    setError(null)
    
    try {
      console.log('[SubmissionModal] Starting submission process...')
      
      // 1. Sign message with wallet
      const message = `Submit to social job: ${job.id}\nTimestamp: ${Date.now()}`
      console.log('[SubmissionModal] Requesting wallet signature...')
      
      let signature: string
      try {
        signature = await signMessage(message)
        console.log('[SubmissionModal] Signature obtained')
      } catch (sigErr) {
        console.error('[SubmissionModal] Signature failed:', sigErr)
        throw new Error('signature_failed')
      }
      
      // 2. Call API endpoint
      console.log('[SubmissionModal] Calling API endpoint...')
      const response = await fetch(`/api/jobs/social/${job.id}/submit`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          wallet: walletAddress,
          signature,
          message,
          follower_range: {
            min_followers: selectedTier!.min_followers,
            max_followers: selectedTier!.max_followers
          },
          social_tweet_link: tweetLink,
          social_payment_amount_usd: selectedTier!.price_usd
        })
      })
      
      const data = await response.json()
      console.log('[SubmissionModal] API response:', { 
        status: response.status, 
        success: data.success 
      })
      
      if (!response.ok) {
        // Handle error responses from API
        const errorType = data.error || data.message || 'submission_failed'
        console.error('[SubmissionModal] API error:', errorType)
        throw new Error(errorType)
      }
      
      // 3. Success: close modal and trigger success callback
      console.log('[SubmissionModal] Submission successful:', data.submission_id)
      onSuccess(data.submission_id)
      
      // Reset form state
      setSelectedTier(null)
      setTweetLink('')
      setConfirmLive(false)
      setConfirmGuidelines(false)
      
    } catch (err) {
      // Map error to user-friendly message
      const errorMessage = err instanceof Error 
        ? mapSubmissionError(err.message)
        : 'Submission failed. Please try again.'
      
      console.error('[SubmissionModal] Submission error:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  /**
   * Handle modal close
   */
  function handleClose() {
    if (!isSubmitting) {
      // Reset form state on close
      setSelectedTier(null)
      setTweetLink('')
      setConfirmLive(false)
      setConfirmGuidelines(false)
      setError(null)
      onClose()
    }
  }
  
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={false}
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 'var(--radius-card-lg, 24px)',
          background: 'var(--card-background, #FFFFFF)',
          boxShadow: 'var(--shadow-floating, 0 24px 60px 0 rgba(15, 23, 42, 0.10))',
          '@media (max-width: 640px)': {
            borderRadius: 0,
            margin: 0,
            maxHeight: '100%',
            height: '100%',
            maxWidth: '100%',
          }
        }
      }}
    >
      {/* Dialog Title */}
      <DialogTitle
        sx={{
          fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
          fontSize: 'var(--text-title, 22px)',
          fontWeight: 600,
          color: 'var(--text-primary, #1A1A1E)',
          pb: 1
        }}
      >
        Apply to Campaign
      </DialogTitle>
      
      <Divider />
      
      {/* Dialog Content */}
      <DialogContent sx={{ pt: 3 }}>
        {/* Job Title */}
        <Typography
          sx={{
            mb: 3,
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: 'var(--text-body, 16px)',
            color: 'var(--text-secondary, #6F7280)',
          }}
        >
          Campaign: <strong style={{ color: 'var(--text-primary, #1A1A1E)' }}>{job.title}</strong>
        </Typography>
        
        {/* Error Alert */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '14px'
            }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}
        
        {/* Tier Selection */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '16px',
              color: 'var(--text-secondary, #6F7280)',
            }}
          >
            Your Follower Range
          </InputLabel>
          <Select
            value={selectedTier ? JSON.stringify(selectedTier) : ''}
            onChange={(e) => setSelectedTier(JSON.parse(e.target.value))}
            label="Your Follower Range"
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              borderRadius: 'var(--radius-card-lg, 12px)',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'var(--border-subtle, #E5E7F0)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'var(--accent-primary, #7C4DFF)',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: 'var(--accent-primary, #7C4DFF)',
              }
            }}
          >
            {budgetTiers.map((tier, index) => (
              <MenuItem 
                key={index} 
                value={JSON.stringify(tier)}
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                }}
              >
                {formatFollowerRange(tier)} followers (${tier.price_usd.toFixed(0)})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        {/* Payment Preview - Only show when tier is selected */}
        {selectedTier && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              borderRadius: 'var(--radius-card-lg, 12px)',
              background: 'var(--accent-primary-soft, #EEE7FF)',
              border: '1px solid rgba(124, 77, 255, 0.2)'
            }}
          >
            {/* Base Payment */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <MonetizationOnIcon 
                sx={{ 
                  fontSize: 20, 
                  color: 'var(--accent-primary, #7C4DFF)' 
                }} 
              />
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)',
                }}
              >
                💰 Your Payment: ${selectedTier.price_usd.toFixed(0)}
              </Typography>
            </Box>
            
            {/* Impression Bonus */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon 
                sx={{ 
                  fontSize: 20, 
                  color: 'var(--accent-primary, #7C4DFF)' 
                }} 
              />
              <Box>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--accent-primary, #7C4DFF)',
                  }}
                >
                  🎁 Potential Bonus: Based on impressions
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: '12px',
                    color: 'var(--text-secondary, #6F7280)',
                    fontStyle: 'italic',
                    mt: 0.5
                  }}
                >
                  (Poster may add bonus after reviewing engagement metrics)
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
        
        {/* Tweet Link Input */}
        <TextField
          fullWidth
          label="Your Tweet Link"
          placeholder="https://x.com/yourhandle/status/123456"
          value={tweetLink}
          onChange={(e) => setTweetLink(e.target.value)}
          error={showTweetError}
          helperText={
            showTweetError 
              ? 'Please enter a valid Twitter/X post URL' 
              : job.social_job_type === 'retweet'
                ? 'Retweet the source tweet first, then paste your retweet link here'
                : 'Paste the link to your tweet about this campaign'
          }
          sx={{
            mb: 3,
            '& .MuiInputLabel-root': {
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            },
            '& .MuiInputBase-input': {
              fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
              fontSize: '14px',
              '&:focus': {
                outline: 'none'
              }
            },
            '& .MuiFormHelperText-root': {
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '12px',
            },
            '& .MuiOutlinedInput-root': {
              borderRadius: 'var(--radius-card-lg, 12px)',
              '& fieldset': {
                borderColor: 'var(--border-subtle, #E5E7F0)',
              },
              '&:hover fieldset': {
                borderColor: 'var(--accent-primary, #7C4DFF)',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'var(--accent-primary, #7C4DFF)',
              }
            }
          }}
          InputProps={{
            startAdornment: (
              <LinkIcon 
                sx={{ 
                  mr: 1, 
                  color: 'var(--icon-default, #B6BAC7)',
                  fontSize: 20
                }} 
              />
            )
          }}
        />
        
        {/* Confirmation Checkboxes */}
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={confirmLive}
                onChange={(e) => setConfirmLive(e.target.checked)}
                sx={{
                  color: 'var(--accent-primary, #7C4DFF)',
                  '&.Mui-checked': {
                    color: 'var(--accent-primary, #7C4DFF)',
                  },
                  padding: '0 9px',
                  alignSelf: 'flex-start'
                }}
              />
            }
            label={
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '14px',
                  color: 'var(--text-secondary, #6F7280)',
                  lineHeight: '1.5'
                }}
              >
                I confirm I will keep this tweet live until <strong>{engagementDeadline}</strong>
              </Typography>
            }
            sx={{ alignItems: 'flex-start', mb: 1, ml: 0 }}
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={confirmGuidelines}
                onChange={(e) => setConfirmGuidelines(e.target.checked)}
                sx={{
                  color: 'var(--accent-primary, #7C4DFF)',
                  '&.Mui-checked': {
                    color: 'var(--accent-primary, #7C4DFF)',
                  },
                  padding: '0 9px',
                  alignSelf: 'flex-start'
                }}
              />
            }
            label={
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '14px',
                  color: 'var(--text-secondary, #6F7280)',
                  lineHeight: '1.5'
                }}
              >
                I have followed all campaign guidelines
              </Typography>
            }
            sx={{ alignItems: 'flex-start', ml: 0 }}
          />
        </Box>
      </DialogContent>
      
      <Divider />
      
      {/* Dialog Actions */}
      <DialogActions sx={{ p: 3, gap: 2 }}>
        <Button
          onClick={handleClose}
          disabled={isSubmitting}
          variant="outlined"
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: '16px',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 'var(--radius-control, 999px)',
            px: 3,
            py: 1,
            borderColor: 'var(--border-subtle, #E5E7F0)',
            color: 'var(--text-secondary, #6F7280)',
            '&:hover': {
              borderColor: 'var(--text-secondary, #6F7280)',
              background: 'var(--subtle-background, #F7F8FB)',
            }
          }}
        >
          Cancel
        </Button>
        
        <LoadingButton
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={isSubmitting}
          loadingText="Submitting..."
          variant="contained"
          startIcon={<CheckCircleIcon />}
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: '16px',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 'var(--radius-control, 999px)',
            px: 3,
            py: 1,
            background: 'var(--accent-primary, #7C4DFF)',
            color: '#FFFFFF',
            boxShadow: '0 4px 12px rgba(124, 77, 255, 0.3)',
            '&:hover': {
              background: '#6A3FE8',
              boxShadow: '0 6px 16px rgba(124, 77, 255, 0.4)',
            },
            '&:disabled': {
              background: 'var(--border-subtle, #E5E7F0)',
              color: 'var(--text-muted, #A3A7B5)',
              boxShadow: 'none',
            }
          }}
        >
          Submit Application
        </LoadingButton>
      </DialogActions>
    </Dialog>
  )
}

