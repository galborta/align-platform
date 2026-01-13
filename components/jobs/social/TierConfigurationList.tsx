'use client'

import { Box, TextField, Typography, useTheme, useMediaQuery } from '@mui/material'
import { BudgetTier } from '@/types/social-jobs'

// ==================== TYPES ====================

interface TierConfigurationListProps {
  tiers: BudgetTier[]
  onChange: (tiers: BudgetTier[]) => void
}

interface FixedFollowerTier {
  label: string
  min_followers: number
  max_followers: number | null
  defaultPrice: number
}

// ==================== CONSTANTS ====================

/**
 * Fixed follower tier ranges (spec lines 192-197)
 * These ranges are not editable - only prices can be changed
 */
const FIXED_FOLLOWER_TIERS: FixedFollowerTier[] = [
  { label: '500-1K followers', min_followers: 500, max_followers: 1000, defaultPrice: 8 },
  { label: '1K-5K followers', min_followers: 1001, max_followers: 5000, defaultPrice: 15 },
  { label: '5K-20K followers', min_followers: 5001, max_followers: 20000, defaultPrice: 25 },
  { label: '20K-50K followers', min_followers: 20001, max_followers: 50000, defaultPrice: 40 },
  { label: '50K-100K followers', min_followers: 50001, max_followers: 100000, defaultPrice: 65 },
  { label: '100K+ followers', min_followers: 100001, max_followers: null, defaultPrice: 90 }
]

// ==================== COMPONENT ====================

export default function TierConfigurationList({
  tiers,
  onChange
}: TierConfigurationListProps) {
  // ==================== MOBILE DETECTION ====================
  
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  
  /**
   * Initialize tiers with default values if empty
   */
  const ensureTiersInitialized = () => {
    if (tiers.length === 0) {
      const initialTiers: BudgetTier[] = FIXED_FOLLOWER_TIERS.map(tier => ({
        min_followers: tier.min_followers,
        max_followers: tier.max_followers,
        price_usd: tier.defaultPrice
      }))
      onChange(initialTiers)
      return initialTiers
    }
    return tiers
  }

  const currentTiers = ensureTiersInitialized()

  /**
   * Handle price change for a specific tier
   */
  const handlePriceChange = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0
    const updatedTiers = [...currentTiers]
    updatedTiers[index] = {
      ...updatedTiers[index],
      price_usd: numValue
    }
    onChange(updatedTiers)
  }

  return (
    <Box>
      {/* Section Title */}
      <Typography
        variant="h6"
        sx={{
          fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
          fontSize: { xs: '16px', sm: '18px' },
          fontWeight: 600,
          color: 'var(--text-primary, #1A1A1E)',
          mb: 1
        }}
      >
        Payment Tiers
      </Typography>

      <Typography
        variant="body2"
        sx={{
          fontFamily: 'var(--font-body, Satoshi), sans-serif',
          fontSize: { xs: '13px', sm: '14px' },
          color: 'var(--text-secondary, #6F7280)',
          mb: { xs: 2, sm: 3 }
        }}
      >
        Set payment for each follower range:
      </Typography>

      {/* Tier List */}
      <Box
        sx={{
          bgcolor: 'var(--subtle-background, #F7F8FB)',
          borderRadius: { xs: '12px', sm: '12px' },
          p: { xs: 'var(--space-md, 16px)', sm: 2.5 }
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, sm: 2 } }}>
          {FIXED_FOLLOWER_TIERS.map((tierConfig, index) => {
            const currentTier = currentTiers[index]
            const price = currentTier?.price_usd ?? tierConfig.defaultPrice

            return (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  justifyContent: 'space-between',
                  gap: isMobile ? 'var(--space-xs, 8px)' : 2
                }}
              >
                {/* Follower Range Label (Fixed) */}
                <Typography
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi), sans-serif',
                    fontSize: { xs: '13px', sm: '14px' },
                    fontWeight: 500,
                    color: 'var(--text-primary, #1A1A1E)',
                    minWidth: isMobile ? 'auto' : { xs: '120px', sm: '140px' },
                    flexShrink: 0
                  }}
                >
                  {tierConfig.label}:
                </Typography>

                {/* Price Input */}
                <TextField
                  type="number"
                  value={price}
                  onChange={(e) => handlePriceChange(index, e.target.value)}
                  placeholder={tierConfig.defaultPrice.toString()}
                  fullWidth={isMobile}
                  InputProps={{
                    startAdornment: (
                      <Typography
                        sx={{
                          mr: 0.5,
                          color: 'var(--text-secondary, #6F7280)',
                          fontFamily: 'var(--font-body, Satoshi), sans-serif',
                          fontSize: { xs: '14px', sm: '14px' }
                        }}
                      >
                        $
                      </Typography>
                    )
                  }}
                  inputProps={{
                    min: 0,
                    step: 1,
                    style: {
                      fontFamily: 'var(--font-body, Satoshi), sans-serif',
                      fontSize: isMobile ? '16px' : '14px' // Larger on mobile for better UX
                    }
                  }}
                  sx={{
                    width: isMobile ? '100%' : { xs: '120px', sm: '140px' },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      bgcolor: 'var(--card-background, #FFFFFF)',
                      minHeight: isMobile ? '48px' : 'auto', // Larger touch target on mobile
                      '& fieldset': {
                        borderColor: 'var(--border-subtle, #E5E7F0)'
                      },
                      '&:hover fieldset': {
                        borderColor: 'var(--accent-primary, #7C4DFF)'
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'var(--accent-primary, #7C4DFF)'
                      }
                    },
                    '& input': {
                      py: isMobile ? 'var(--space-sm, 12px)' : 1,
                      px: 1.5
                    },
                    '& .MuiOutlinedInput-input': {
                      '&:focus': {
                        outline: 'none'
                      }
                    }
                  }}
                />
              </Box>
            )
          })}
        </Box>

        {/* Help Text */}
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: { xs: 1.5, sm: 2 },
            pt: { xs: 1.5, sm: 2 },
            borderTop: '1px solid var(--border-subtle, #E5E7F0)',
            fontFamily: 'var(--font-body, Satoshi), sans-serif',
            fontSize: { xs: '11px', sm: '12px' },
            color: 'var(--text-muted, #A3A7B5)',
            fontStyle: 'italic',
            lineHeight: 1.5
          }}
        >
          💡 Workers will be paid based on their follower count tier. You can adjust these amounts to fit your budget.
        </Typography>
      </Box>
    </Box>
  )
}

