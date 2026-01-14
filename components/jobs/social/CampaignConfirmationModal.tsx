'use client'

import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  Box,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery,
  Divider,
  Checkbox,
  FormControlLabel
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { format, addDays } from 'date-fns'
import { CampaignFormData } from './CampaignConfigForm'
import { isLocalhost } from '@/lib/environment'

// ==================== TYPES ====================

interface CampaignConfirmationModalProps {
  open: boolean
  formData: CampaignFormData
  campaignType: 'retweet' | 'original_tweet'
  onConfirm: () => void
  onBack: () => void
  publishToProduction?: boolean
  onPublishToProductionChange?: (value: boolean) => void
}

// ==================== CONSTANTS ====================

const PLATFORM_FEE_PERCENTAGE = 0.05 // 5%

// ==================== COMPONENT ====================

export default function CampaignConfirmationModal({
  open,
  formData,
  campaignType,
  onConfirm,
  onBack,
  publishToProduction = false,
  onPublishToProductionChange
}: CampaignConfirmationModalProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // ==================== COMPUTED VALUES ====================

  const platformFee = useMemo(() => {
    return formData.totalBudget * PLATFORM_FEE_PERCENTAGE
  }, [formData.totalBudget])

  const totalCharge = useMemo(() => {
    return formData.totalBudget + platformFee
  }, [formData.totalBudget, platformFee])

  const endDate = useMemo(() => {
    return addDays(new Date(), formData.durationDays)
  }, [formData.durationDays])

  const formattedEndDate = useMemo(() => {
    return format(endDate, 'MMM d, h:mm a')
  }, [endDate])

  const campaignTypeLabel = campaignType === 'retweet' 
    ? 'Retweet Campaign' 
    : 'Original Tweet Campaign'

  // ==================== FORMATTING ====================

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // ==================== RENDER ====================

  return (
    <Dialog
      open={open}
      onClose={onBack}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 'var(--radius-card-lg, 24px)',
          bgcolor: 'var(--card-background, #FFFFFF)',
          boxShadow: 'var(--shadow-floating, 0 24px 60px 0 rgba(15, 23, 42, 0.10))',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
          fontSize: 'var(--text-title, 22px)',
          fontWeight: 'var(--weight-bold, 700)',
          color: 'var(--text-primary, #1A1A1E)',
          borderBottom: '1px solid var(--border-subtle, #E5E7F0)',
          pb: 'var(--space-md, 16px)',
          pt: 'var(--space-lg, 24px)',
          px: 'var(--space-lg, 24px)',
          flexShrink: 0
        }}
      >
        Confirm Campaign Creation
        <IconButton
          onClick={onBack}
          sx={{
            color: 'var(--text-secondary, #6F7280)',
            '&:hover': {
              bgcolor: 'var(--subtle-background, #F7F8FB)'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent
        sx={{
          p: 'var(--space-lg, 24px)',
          flexGrow: 1,
          overflowY: 'auto'
        }}
      >
        <Typography
          sx={{
            fontFamily: 'var(--font-body, Satoshi), sans-serif',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--text-secondary, #6F7280)',
            mb: 3
          }}
        >
          Review your campaign:
        </Typography>

        {/* Campaign Details */}
        <Box sx={{ mb: 3 }}>
          {/* Title */}
          <Box sx={{ mb: 2 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-muted, #A3A7B5)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                mb: 0.5
              }}
            >
              Title
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              {formData.title}
            </Typography>
          </Box>

          {/* Type */}
          <Box sx={{ mb: 2 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-muted, #A3A7B5)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                mb: 0.5
              }}
            >
              Type
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '14px',
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              {campaignTypeLabel}
            </Typography>
          </Box>

          {/* Source Tweet URL (if retweet) */}
          {campaignType === 'retweet' && formData.sourceTweetUrl && (
            <Box sx={{ mb: 2 }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi), sans-serif',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-muted, #A3A7B5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  mb: 0.5
                }}
              >
                Source Tweet
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi), sans-serif',
                  fontSize: '13px',
                  color: 'var(--accent-primary, #7C4DFF)',
                  wordBreak: 'break-all'
                }}
              >
                {formData.sourceTweetUrl}
              </Typography>
            </Box>
          )}

          {/* Budget */}
          <Box sx={{ mb: 2 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-muted, #A3A7B5)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                mb: 0.5
              }}
            >
              Budget
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '14px',
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              {formatCurrency(formData.totalBudget)} USD
            </Typography>
          </Box>

          {/* Duration */}
          <Box sx={{ mb: 2 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-muted, #A3A7B5)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                mb: 0.5
              }}
            >
              Duration
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '14px',
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              {formData.durationDays} days (ends {formattedEndDate})
            </Typography>
          </Box>

          {/* Impression Bonuses */}
          <Box sx={{ mb: 2 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-muted, #A3A7B5)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                mb: 0.5
              }}
            >
              Impression Bonuses
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '14px',
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              {formData.enableImpressionBonuses ? 'Enabled ($5 CPM)' : 'Disabled'}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Payment Tiers */}
        <Box sx={{ mb: 3 }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi), sans-serif',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-muted, #A3A7B5)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              mb: 1.5
            }}
          >
            Payment Tiers
          </Typography>
          <Box
            component="ul"
            sx={{
              m: 0,
              p: 0,
              pl: 2.5,
              listStyle: 'disc'
            }}
          >
            {formData.followerTiers.map((tier, index) => {
              const label = tier.max_followers === null
                ? `${(tier.min_followers / 1000).toFixed(0)}K+`
                : `${(tier.min_followers / 1000).toFixed(0)}K-${(tier.max_followers / 1000).toFixed(0)}K`
              
              return (
                <Box
                  component="li"
                  key={index}
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi), sans-serif',
                    fontSize: '14px',
                    color: 'var(--text-primary, #1A1A1E)',
                    mb: 0.5
                  }}
                >
                  {label}: {formatCurrency(tier.price_usd)}
                </Box>
              )
            })}
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Budget Lock Warning */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            p: 2,
            bgcolor: 'var(--accent-warning, #FFC857)',
            bgcolor: 'rgba(255, 200, 87, 0.15)',
            border: '1px solid var(--accent-warning, #FFC857)',
            borderRadius: '12px',
            mb: 3
          }}
        >
          <WarningAmberIcon
            sx={{
              color: 'var(--accent-warning, #FFC857)',
              fontSize: 20,
              mt: 0.2
            }}
          />
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi), sans-serif',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-primary, #1A1A1E)',
              lineHeight: 1.5
            }}
          >
            Budget will be locked upon creation. You cannot change the budget or payment tiers after the campaign starts.
          </Typography>
        </Box>

        {/* Fee Breakdown */}
        <Box
          sx={{
            p: 2.5,
            bgcolor: 'var(--subtle-background, #F7F8FB)',
            borderRadius: '12px'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1
            }}
          >
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '14px',
                color: 'var(--text-secondary, #6F7280)'
              }}
            >
              Campaign Budget
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              {formatCurrency(formData.totalBudget)}
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1.5
            }}
          >
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '14px',
                color: 'var(--text-secondary, #6F7280)'
              }}
            >
              Platform Fee (5%)
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              {formatCurrency(platformFee)}
            </Typography>
          </Box>

          <Divider sx={{ mb: 1.5 }} />

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Typography
              sx={{
                fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              Total Charge
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--accent-primary, #7C4DFF)'
              }}
            >
              {formatCurrency(totalCharge)}
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      {/* Environment Filtering Checkbox (Localhost Only) */}
      {isLocalhost() && onPublishToProductionChange && (
        <Box sx={{ px: 3, pb: 2 }}>
          <Box sx={{ p: 2, backgroundColor: '#FFF9E6', borderRadius: 1, border: '1px solid #FFE699' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={publishToProduction}
                  onChange={(e) => onPublishToProductionChange(e.target.checked)}
                  sx={{
                    color: '#FF9800',
                    '&.Mui-checked': {
                      color: '#FF9800',
                    },
                  }}
                />
              }
              label={
                <Box>
                  <Typography sx={{ fontWeight: 600, color: '#111827', fontSize: '14px' }}>
                    Publish to Production
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: '#6B7280' }}>
                    Check this to make this campaign visible on the live site. Leave unchecked for localhost testing only.
                  </Typography>
                </Box>
              }
            />
          </Box>
        </Box>
      )}

      {/* Actions */}
      <Box
        sx={{
          borderTop: '1px solid var(--border-subtle, #E5E7F0)',
          p: 'var(--space-lg, 24px)',
          display: 'flex',
          gap: 2,
          flexDirection: { xs: 'column-reverse', sm: 'row' },
          justifyContent: 'flex-end',
          flexShrink: 0
        }}
      >
        <Button
          onClick={onBack}
          sx={{
            color: 'var(--text-secondary, #6F7280)',
            textTransform: 'none',
            fontFamily: 'var(--font-body, Satoshi), sans-serif',
            fontWeight: 600,
            fontSize: '14px',
            px: 3,
            py: 1.25,
            borderRadius: 'var(--radius-control, 999px)',
            '&:hover': {
              bgcolor: 'var(--subtle-background, #F7F8FB)'
            }
          }}
        >
          Back
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          sx={{
            bgcolor: 'var(--accent-primary, #7C4DFF)',
            color: '#FFFFFF',
            textTransform: 'none',
            fontFamily: 'var(--font-body, Satoshi), sans-serif',
            fontWeight: 600,
            fontSize: '14px',
            px: 4,
            py: 1.25,
            borderRadius: 'var(--radius-control, 999px)',
            boxShadow: '0 4px 14px rgba(124, 77, 255, 0.3)',
            '&:hover': {
              bgcolor: '#6A3FE8',
              boxShadow: '0 6px 20px rgba(124, 77, 255, 0.4)'
            }
          }}
        >
          Create & Pay {formatCurrency(totalCharge)}
        </Button>
      </Box>
    </Dialog>
  )
}

