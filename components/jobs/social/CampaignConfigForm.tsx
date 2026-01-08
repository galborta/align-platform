'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Box,
  TextField,
  Button,
  Typography,
  Checkbox,
  FormControlLabel,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { BudgetTier, SocialJobType } from '@/types/social-jobs'
import TierConfigurationList from './TierConfigurationList'
import DurationSelector from './DurationSelector'
import { format, addDays } from 'date-fns'
import { LoadingButton } from '@/components/ui/LoadingStates'
import {
  validateCampaignTitle,
  validateTweetUrl,
  validateBudget,
  validateGuidelines,
  validateCampaignForm
} from '@/lib/social-jobs-validation'

// ==================== TYPES ====================

export interface CampaignFormData {
  title: string
  sourceTweetUrl: string
  totalBudget: number
  durationDays: number
  followerTiers: BudgetTier[]
  enableImpressionBonuses: boolean
  campaignGuidelines: string
}

interface CampaignConfigFormProps {
  campaignType: SocialJobType
  projectId: string
  tokenSymbol?: string
  tokenPrice?: number
  onSubmit: (data: CampaignFormData) => void
  onCancel: () => void
  isSubmitting?: boolean
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Estimates participant range based on total budget and tier prices
 */
const estimateParticipants = (totalBudget: number, tiers: BudgetTier[]): string => {
  if (totalBudget <= 0 || tiers.length === 0) {
    return 'Enter budget to see estimate'
  }

  // Calculate average price across tiers (weighted towards lower tiers as they're more common)
  const avgPrice = tiers.reduce((sum, tier, index) => {
    // Weight: lower tiers get higher weight (80%, 60%, 40%, 30%, 20%, 10%)
    const weight = Math.max(0.1, 0.9 - (index * 0.15))
    return sum + (tier.price_usd * weight)
  }, 0) / tiers.length

  if (avgPrice <= 0) {
    return 'Set tier prices to see estimate'
  }

  // Calculate min/max range (±30% variation)
  const avgParticipants = Math.floor(totalBudget / avgPrice)
  const minParticipants = Math.max(1, Math.floor(avgParticipants * 0.7))
  const maxParticipants = Math.ceil(avgParticipants * 1.3)

  if (minParticipants === maxParticipants) {
    return `~${minParticipants} participant${minParticipants !== 1 ? 's' : ''}`
  }

  return `~${minParticipants}-${maxParticipants} participants`
}

// ==================== COMPONENT ====================

export default function CampaignConfigForm({
  campaignType,
  projectId,
  tokenSymbol = 'TOKEN',
  tokenPrice,
  onSubmit,
  onCancel,
  isSubmitting = false
}: CampaignConfigFormProps) {
  // ==================== MOBILE DETECTION ====================
  
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isTablet = useMediaQuery(theme.breakpoints.down('md'))

  // ==================== STATE ====================
  
  const [title, setTitle] = useState('')
  const [sourceTweetUrl, setSourceTweetUrl] = useState('')
  const [totalBudget, setTotalBudget] = useState<number>(0)
  const [durationDays, setDurationDays] = useState<number>(7)
  const [followerTiers, setFollowerTiers] = useState<BudgetTier[]>([])
  const [enableImpressionBonuses, setEnableImpressionBonuses] = useState(false)
  const [campaignGuidelines, setCampaignGuidelines] = useState('')
  
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ==================== COMPUTED VALUES ====================

  const endDate = useMemo(() => {
    return addDays(new Date(), durationDays)
  }, [durationDays])

  const participantEstimate = useMemo(() => {
    return estimateParticipants(totalBudget, followerTiers)
  }, [totalBudget, followerTiers])

  // ==================== VALIDATION ====================

  const handleTitleBlur = () => {
    const result = validateCampaignTitle(title)
    if (!result.valid && result.error) {
      setErrors(prev => ({ ...prev, title: result.error! }))
    } else {
      const { title: _, ...rest } = errors
      setErrors(rest)
    }
  }

  const handleBudgetBlur = () => {
    const result = validateBudget(totalBudget)
    if (!result.valid && result.error) {
      setErrors(prev => ({ ...prev, totalBudget: result.error! }))
    } else {
      const { totalBudget: _, ...rest } = errors
      setErrors(rest)
    }
  }

  const handleTweetUrlBlur = () => {
    if (campaignType === 'retweet') {
      const result = validateTweetUrl(sourceTweetUrl)
      if (!result.valid && result.error) {
        setErrors(prev => ({ ...prev, sourceTweetUrl: result.error! }))
      } else {
        const { sourceTweetUrl: _, ...rest } = errors
        setErrors(rest)
      }
    }
  }

  const handleGuidelinesBlur = () => {
    const result = validateGuidelines(campaignGuidelines)
    if (!result.valid && result.error) {
      setErrors(prev => ({ ...prev, campaignGuidelines: result.error! }))
    } else {
      const { campaignGuidelines: _, ...rest } = errors
      setErrors(rest)
    }
  }

  const validateForm = (): boolean => {
    const formData: CampaignFormData = {
      title,
      sourceTweetUrl,
      totalBudget,
      durationDays,
      followerTiers,
      enableImpressionBonuses,
      campaignGuidelines
    }

    const validation = validateCampaignForm(formData, campaignType)
    
    if (!validation.valid) {
      if (validation.field && validation.error) {
        setErrors({ [validation.field]: validation.error })
      }
      return false
    }
    
    setErrors({})
    return true
  }

  // ==================== HANDLERS ====================

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit({
        title,
        sourceTweetUrl,
        totalBudget,
        durationDays,
        followerTiers,
        enableImpressionBonuses,
        campaignGuidelines
      })
    }
  }

  // Clear errors when values change (real-time feedback)
  const handleTitleChange = (value: string) => {
    setTitle(value)
    if (errors.title) {
      const { title: _, ...rest } = errors
      setErrors(rest)
    }
  }

  const handleBudgetChange = (value: number) => {
    setTotalBudget(value)
    if (errors.totalBudget) {
      const { totalBudget: _, ...rest } = errors
      setErrors(rest)
    }
  }

  const handleTweetUrlChange = (value: string) => {
    setSourceTweetUrl(value)
    if (errors.sourceTweetUrl) {
      const { sourceTweetUrl: _, ...rest } = errors
      setErrors(rest)
    }
  }

  const handleGuidelinesChange = (value: string) => {
    setCampaignGuidelines(value)
    if (errors.campaignGuidelines) {
      const { campaignGuidelines: _, ...rest } = errors
      setErrors(rest)
    }
  }

  const handleTiersChange = (tiers: BudgetTier[]) => {
    setFollowerTiers(tiers)
    if (errors.followerTiers) {
      const { followerTiers: _, ...rest } = errors
      setErrors(rest)
    }
  }

  // ==================== RENDER ====================

  return (
    <Box sx={{ 
      width: '100%',
      px: { xs: 0, sm: 'var(--space-md, 16px)' }
    }}>
      
      {/* ==================== SECTION 1: BASIC INFO ==================== */}
      <Box sx={{ 
        mb: { xs: 3, sm: 4 },
        px: { xs: 'var(--space-md, 16px)', sm: 0 }
      }}>
        <Typography
          variant="h6"
          sx={{
            fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
            fontSize: { xs: '16px', sm: '18px' },
            fontWeight: 600,
            color: 'var(--text-primary, #1A1A1E)',
            mb: { xs: 1.5, sm: 2 }
          }}
        >
          Basic Information
        </Typography>

        {/* Campaign Title */}
        <TextField
          fullWidth
          label="Campaign Title"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="e.g., Retweet Our Token Launch Announcement"
          helperText={
            errors.title || 
            `${title.length}/100 characters (min 10)`
          }
          error={!!errors.title}
          sx={{
            mb: 2.5,
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              fontFamily: 'var(--font-body, Satoshi), sans-serif',
              '&:hover fieldset': {
                borderColor: 'var(--accent-primary, #7C4DFF)'
              },
              '&.Mui-focused fieldset': {
                borderColor: 'var(--accent-primary, #7C4DFF)'
              }
            },
            '& .MuiInputLabel-root.Mui-focused': {
              color: 'var(--accent-primary, #7C4DFF)'
            },
            '& .MuiOutlinedInput-input': {
              '&:focus': {
                outline: 'none'
              }
            }
          }}
          inputProps={{ maxLength: 100 }}
        />

        {/* Source Tweet URL (conditional for retweet campaigns) */}
        {campaignType === 'retweet' && (
          <Box>
            <TextField
              fullWidth
              label="Source Tweet URL"
              value={sourceTweetUrl}
              onChange={(e) => handleTweetUrlChange(e.target.value)}
              onBlur={handleTweetUrlBlur}
              placeholder="https://twitter.com/yourproject/status/123456789..."
              helperText={
                errors.sourceTweetUrl || 
                'Paste the full URL of the tweet you want users to retweet'
              }
              error={!!errors.sourceTweetUrl}
              sx={{
                mb: 1,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  fontFamily: 'var(--font-body, Satoshi), sans-serif',
                  '&:hover fieldset': {
                    borderColor: 'var(--accent-primary, #7C4DFF)'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'var(--accent-primary, #7C4DFF)'
                  }
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: 'var(--accent-primary, #7C4DFF)'
                },
                '& .MuiOutlinedInput-input': {
                  '&:focus': {
                    outline: 'none'
                  }
                }
              }}
            />

            {/* Preview Tweet Link */}
            {sourceTweetUrl && !errors.sourceTweetUrl && sourceTweetUrl.trim().length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
                <Button
                  size="small"
                  endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                  onClick={() => window.open(sourceTweetUrl, '_blank')}
                  sx={{
                    textTransform: 'none',
                    fontFamily: 'var(--font-body, Satoshi), sans-serif',
                    fontSize: '13px',
                    color: 'var(--accent-primary, #7C4DFF)',
                    '&:hover': {
                      bgcolor: 'var(--accent-primary-soft, #EEE7FF)'
                    }
                  }}
                >
                  Preview Tweet
                </Button>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'var(--accent-success, #36C170)',
                    fontFamily: 'var(--font-body, Satoshi), sans-serif',
                    fontSize: '12px'
                  }}
                >
                  ✓ Valid URL
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* ==================== SECTION 2: BUDGET & DURATION ==================== */}
      <Box sx={{ 
        mb: { xs: 3, sm: 4 },
        px: { xs: 'var(--space-md, 16px)', sm: 0 }
      }}>
        <Typography
          variant="h6"
          sx={{
            fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
            fontSize: { xs: '16px', sm: '18px' },
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text-primary, #1A1A1E)',
            mb: 2
          }}
        >
          Budget & Duration
        </Typography>

        {/* Total Budget */}
        <TextField
          fullWidth
          type="number"
          label="Total Budget"
          value={totalBudget || ''}
          onChange={(e) => handleBudgetChange(parseFloat(e.target.value) || 0)}
          onBlur={handleBudgetBlur}
          placeholder="Enter total budget in USD"
          helperText={
            errors.totalBudget || 
            'Minimum: $50 | Maximum: $50,000'
          }
          error={!!errors.totalBudget}
          InputProps={{
            startAdornment: (
              <Typography
                sx={{
                  mr: 0.5,
                  color: 'var(--text-secondary, #6F7280)',
                  fontFamily: 'var(--font-body, Satoshi), sans-serif'
                }}
              >
                $
              </Typography>
            )
          }}
          sx={{
            mb: 1.5,
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              fontFamily: 'var(--font-body, Satoshi), sans-serif',
              '&:hover fieldset': {
                borderColor: 'var(--accent-primary, #7C4DFF)'
              },
              '&.Mui-focused fieldset': {
                borderColor: 'var(--accent-primary, #7C4DFF)'
              }
            },
            '& .MuiInputLabel-root.Mui-focused': {
              color: 'var(--accent-primary, #7C4DFF)'
            },
            '& .MuiOutlinedInput-input': {
              '&:focus': {
                outline: 'none'
              }
            }
          }}
          inputProps={{ min: 0, max: 50000, step: 1 }}
        />

        {/* USD Conversion Display */}
        {totalBudget > 0 && tokenPrice && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 2,
              p: 1.5,
              bgcolor: 'var(--accent-success-soft, #E3F8ED)',
              borderRadius: '8px'
            }}
          >
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--accent-success, #36C170)'
              }}
            >
              ≈ {(totalBudget / tokenPrice).toFixed(2)} {tokenSymbol}
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '12px',
                color: 'var(--text-secondary, #6F7280)',
                ml: 'auto'
              }}
            >
              Token equivalent
            </Typography>
          </Box>
        )}

        {/* Budget Estimate */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 3,
            p: 1.5,
            bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
            borderRadius: '8px'
          }}
        >
          <Typography sx={{ fontSize: 18 }}>💡</Typography>
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi), sans-serif',
              fontSize: '14px',
              color: 'var(--text-secondary, #6F7280)',
              fontWeight: 500
            }}
          >
            Estimate: {participantEstimate}
          </Typography>
          <Tooltip
            title="Estimated based on your total budget and tier prices. Actual participants may vary."
            arrow
          >
            <IconButton size="small" sx={{ ml: 'auto' }}>
              <InfoIcon sx={{ fontSize: 16, color: 'var(--text-muted, #A3A7B5)' }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Campaign Duration */}
        <DurationSelector
          selectedDays={durationDays}
          onChange={setDurationDays}
        />
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* ==================== SECTION 3: PAYMENT TIERS ==================== */}
      <Box sx={{ 
        mb: { xs: 3, sm: 4 },
        px: { xs: 'var(--space-md, 16px)', sm: 0 }
      }}>
        <TierConfigurationList
          tiers={followerTiers}
          onChange={handleTiersChange}
        />
        {errors.followerTiers && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: '12px' }}>
            {errors.followerTiers}
          </Alert>
        )}
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* ==================== SECTION 4: IMPRESSION BONUSES ==================== */}
      <Box sx={{ 
        mb: { xs: 3, sm: 4 },
        px: { xs: 'var(--space-md, 16px)', sm: 0 }
      }}>
        <Typography
          variant="h6"
          sx={{
            fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
            fontSize: { xs: '16px', sm: '18px' },
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text-primary, #1A1A1E)',
            mb: 2
          }}
        >
          Impression Bonuses
        </Typography>

        <FormControlLabel
          control={
            <Checkbox
              checked={enableImpressionBonuses}
              onChange={(e) => setEnableImpressionBonuses(e.target.checked)}
              sx={{
                color: 'var(--text-secondary, #6F7280)',
                '&.Mui-checked': {
                  color: 'var(--accent-primary, #7C4DFF)'
                }
              }}
            />
          }
          label={
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              Enable impression bonuses
            </Typography>
          }
          sx={{ mb: 1.5 }}
        />

        <Box
          sx={{
            p: 2,
            bgcolor: 'var(--subtle-background, #F7F8FB)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle, #E5E7F0)'
          }}
        >
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi), sans-serif',
              fontSize: '13px',
              color: 'var(--text-secondary, #6F7280)',
              mb: 1
            }}
          >
            <strong>CPM Rate:</strong> $5 per 1,000 impressions (fixed)
          </Typography>

          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi), sans-serif',
              fontSize: '12px',
              color: 'var(--text-muted, #A3A7B5)',
              mb: 0.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 0.5
            }}
          >
            <InfoIcon sx={{ fontSize: 14, mt: 0.2 }} />
            Add impression counts when approving submissions. Bonuses lock at approval.
          </Typography>

          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi), sans-serif',
              fontSize: '12px',
              color: 'var(--accent-warning, #FFC857)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 0.5
            }}
          >
            ⏰ For best results, wait 48+ hours after posting before checking impressions
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* ==================== SECTION 5: CAMPAIGN GUIDELINES ==================== */}
      <Box sx={{ 
        mb: { xs: 3, sm: 4 },
        px: { xs: 'var(--space-md, 16px)', sm: 0 }
      }}>
        <Typography
          variant="h6"
          sx={{
            fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
            fontSize: { xs: '16px', sm: '18px' },
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text-primary, #1A1A1E)',
            mb: 2
          }}
        >
          Campaign Guidelines
        </Typography>

        <TextField
          fullWidth
          multiline
          rows={4}
          label="Guidelines (Optional)"
          value={campaignGuidelines}
          onChange={(e) => handleGuidelinesChange(e.target.value)}
          onBlur={handleGuidelinesBlur}
          placeholder={
            campaignType === 'retweet'
              ? 'Include #MyNFT and tag @MyProject in your retweet. Keep the tweet live until ' +
                format(endDate, 'MMM d') + '.'
              : 'Tweet must include #MyNFT and @MyProject. Be authentic and engaging. No spam.'
          }
          helperText={
            errors.campaignGuidelines || 
            `${campaignGuidelines.length}/500 characters`
          }
          error={!!errors.campaignGuidelines}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              fontFamily: 'var(--font-body, Satoshi), sans-serif',
              '&:hover fieldset': {
                borderColor: 'var(--accent-primary, #7C4DFF)'
              },
              '&.Mui-focused fieldset': {
                borderColor: 'var(--accent-primary, #7C4DFF)'
              }
            },
            '& .MuiInputLabel-root.Mui-focused': {
              color: 'var(--accent-primary, #7C4DFF)'
            },
            '& .MuiOutlinedInput-input': {
              '&:focus': {
                outline: 'none'
              }
            }
          }}
          inputProps={{ maxLength: 500 }}
        />
      </Box>

      {/* ==================== ACTION BUTTONS ==================== */}
      <Box
        sx={{
          display: 'flex',
          gap: { xs: 'var(--space-md, 16px)', sm: 2 },
          pt: { xs: 'var(--space-lg, 24px)', sm: 3 },
          px: { xs: 'var(--space-md, 16px)', sm: 0 },
          borderTop: '1px solid var(--border-subtle, #E5E7F0)',
          flexDirection: { xs: 'column-reverse', sm: 'row' },
          justifyContent: 'flex-end'
        }}
      >
        <Button
          onClick={onCancel}
          fullWidth={isMobile}
          sx={{
            color: 'var(--text-secondary, #6F7280)',
            textTransform: 'none',
            fontFamily: 'var(--font-body, Satoshi), sans-serif',
            fontWeight: 500,
            fontSize: { xs: '16px', sm: '14px' },
            minHeight: { xs: '48px', sm: 'auto' },
            px: { xs: 'var(--space-lg, 24px)', sm: 3 },
            py: { xs: 'var(--space-md, 16px)', sm: 1 },
            borderRadius: 'var(--radius-control, 999px)',
            '&:hover': {
              bgcolor: 'var(--subtle-background, #F7F8FB)'
            }
          }}
        >
          Cancel
        </Button>
        <LoadingButton
          variant="contained"
          onClick={handleSubmit}
          disabled={Object.keys(errors).length > 0 || !title || !totalBudget || followerTiers.length !== 6}
          loading={isSubmitting}
          loadingText="Creating..."
          fullWidth={isMobile}
          sx={{
            bgcolor: 'var(--accent-primary, #7C4DFF)',
            color: '#FFFFFF',
            textTransform: 'none',
            fontFamily: 'var(--font-body, Satoshi), sans-serif',
            fontWeight: 600,
            fontSize: { xs: '16px', sm: '14px' },
            minHeight: { xs: '48px', sm: 'auto' },
            px: { xs: 'var(--space-lg, 24px)', sm: 4 },
            py: { xs: 'var(--space-md, 16px)', sm: 1.25 },
            borderRadius: 'var(--radius-control, 999px)',
            boxShadow: '0 4px 14px rgba(124, 77, 255, 0.3)',
            '&:hover': {
              bgcolor: '#6A3FE8',
              boxShadow: '0 6px 20px rgba(124, 77, 255, 0.4)'
            },
            '&:disabled': {
              bgcolor: 'var(--text-muted, #A3A7B5)',
              color: '#FFFFFF',
              boxShadow: 'none'
            }
          }}
        >
          Create Campaign
        </LoadingButton>
      </Box>
    </Box>
  )
}

