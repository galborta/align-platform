'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Paper,
  Divider,
  Alert,
  InputAdornment,
  Tooltip,
  Chip
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import PeopleIcon from '@mui/icons-material/People'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import { FollowerTier } from '@/types/social-media-jobs'
import { validateFollowerTiers, formatFollowerTierRange } from '@/lib/social-media-jobs-follower-tiers'

// ==================== TYPES ====================

interface FollowerTierConfigProps {
  tiers: FollowerTier[]
  onTiersChange: (tiers: FollowerTier[]) => void
  tokenPrice?: number // Optional: for displaying token equivalents
  tokenSymbol?: string // Optional: for displaying token equivalents
  estimatedParticipantsPerTier?: Record<string, number> // Optional: for budget preview
}

// ==================== COMPONENT ====================

export default function FollowerTierConfig({
  tiers,
  onTiersChange,
  tokenPrice,
  tokenSymbol,
  estimatedParticipantsPerTier = {}
}: FollowerTierConfigProps) {
  const [validationError, setValidationError] = useState<string>('')

  // ==================== CALCULATIONS ====================

  // Calculate estimated total budget based on expected participation
  const calculateEstimatedBudget = () => {
    if (Object.keys(estimatedParticipantsPerTier).length === 0) {
      return null
    }

    let total = 0
    tiers.forEach((tier, index) => {
      const participants = estimatedParticipantsPerTier[`tier_${index}`] || 0
      total += tier.base_payment_usd * participants
    })
    return total
  }

  const estimatedBudget = calculateEstimatedBudget()

  // ==================== HANDLERS ====================

  /**
   * Add a new tier with smart defaults
   * - First tier starts at 500 followers (prevents new account exploitation)
   * - Each new tier starts where the previous one ended + 1
   * - New tier becomes open-ended (max = null), previous becomes bounded
   */
  const handleAddTier = () => {
    if (tiers.length >= 5) {
      setValidationError('Maximum 5 tiers allowed')
      return
    }

    const newTiers = [...tiers]
    
    // Calculate the starting point for the new tier
    let newMinFollowers = 500
    let tierName = 'Tier'
    
    if (tiers.length > 0) {
      const lastTier = newTiers[newTiers.length - 1]
      // If last tier was open-ended, close it
      if (lastTier.max_followers === null) {
        // Set a reasonable max for the previous tier
        newMinFollowers = lastTier.min_followers + 5000
        lastTier.max_followers = newMinFollowers - 1
      } else {
        newMinFollowers = lastTier.max_followers + 1
      }
      
      // Suggest tier names based on follower count
      if (newMinFollowers < 1000) tierName = 'Micro'
      else if (newMinFollowers < 5000) tierName = 'Small'
      else if (newMinFollowers < 10000) tierName = 'Mid-tier'
      else if (newMinFollowers < 50000) tierName = 'Macro'
      else tierName = 'Mega'
    } else {
      tierName = 'Micro' // First tier
    }

    const newTier: FollowerTier = {
      min_followers: newMinFollowers,
      max_followers: null, // New tier is always open-ended
      base_payment_usd: 0,
      tier_name: tierName
    }

    onTiersChange([...newTiers, newTier])
    setValidationError('')
  }

  /**
   * Remove a tier and adjust the remaining tiers
   */
  const handleRemoveTier = (index: number) => {
    if (tiers.length <= 1) {
      setValidationError('At least one tier is required')
      return
    }

    const updated = tiers.filter((_, i) => i !== index)
    
    // Make the last remaining tier open-ended
    if (updated.length > 0) {
      updated[updated.length - 1].max_followers = null
    }
    
    // Re-adjust min values to ensure continuity
    for (let i = 1; i < updated.length; i++) {
      const prevMax = updated[i - 1].max_followers
      if (prevMax !== null) {
        updated[i].min_followers = prevMax + 1
      }
    }
    
    onTiersChange(updated)
    validateTiers(updated)
  }

  /**
   * Update a specific tier field
   */
  const handleUpdateTier = (index: number, field: keyof FollowerTier, value: number | string | null) => {
    const updated = [...tiers]
    updated[index] = { ...updated[index], [field]: value }

    // Auto-adjust next tier's min when max changes
    if (field === 'max_followers' && typeof value === 'number' && index < updated.length - 1) {
      updated[index + 1].min_followers = value + 1
    }
    
    onTiersChange(updated)
    validateTiers(updated)
  }

  /**
   * Validate tiers and update error state
   */
  const validateTiers = (tiersToValidate: FollowerTier[]) => {
    try {
      validateFollowerTiers(tiersToValidate)
      setValidationError('')
    } catch (error: any) {
      setValidationError(error.message)
    }
  }

  // Validate on mount and when tiers change
  useEffect(() => {
    if (tiers.length > 0) {
      validateTiers(tiers)
    }
  }, [tiers.length])

  // ==================== STYLES ====================

  const inputStyles = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '12px',
      '&:hover fieldset': {
        borderColor: 'var(--accent-primary, #7C4DFF)',
      },
      '&.Mui-focused fieldset': {
        borderColor: 'var(--accent-primary, #7C4DFF)',
      }
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: 'var(--accent-primary, #7C4DFF)'
    }
  }

  // ==================== RENDER ====================

  return (
    <Box>
      {/* Section Header */}
      <Typography 
        variant="h6" 
        sx={{ 
          fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
          fontWeight: 600,
          color: 'var(--text-primary, #1A1A1E)',
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <AttachMoneyIcon sx={{ color: 'var(--accent-primary, #7C4DFF)' }} />
        Payment Tiers (by Follower Count)
      </Typography>

      {/* Info Alert */}
      <Alert 
        severity="info"
        icon={<InfoOutlinedIcon />}
        sx={{ 
          mb: 3,
          bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
          color: 'var(--text-primary, #1A1A1E)',
          '& .MuiAlert-icon': {
            color: 'var(--accent-primary, #7C4DFF)'
          },
          borderRadius: '12px'
        }}
      >
        <Typography variant="body2">
          <strong>Instant payments:</strong> Define how much each worker gets paid based on their follower count. 
          Workers with bigger audiences get paid more for their greater reach. Payment happens instantly when you approve their submission.
        </Typography>
      </Alert>

      {/* Tier List Section */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <PeopleIcon sx={{ color: 'var(--accent-primary, #7C4DFF)', fontSize: 20 }} />
            Follower Tiers ({tiers.length})
          </Typography>
          
          <Button
            startIcon={<AddIcon />}
            onClick={handleAddTier}
            disabled={tiers.length >= 5}
            sx={{
              color: 'var(--accent-primary, #7C4DFF)',
              textTransform: 'none',
              fontWeight: 500,
              '&:hover': {
                bgcolor: 'var(--accent-primary-soft, #EEE7FF)'
              }
            }}
          >
            Add Tier
          </Button>
        </Box>

        {/* Tier Cards */}
        {tiers.map((tier, index) => {
          const isLastTier = index === tiers.length - 1
          const isFirstTier = index === 0
          const estimatedParticipants = estimatedParticipantsPerTier[`tier_${index}`] || 0
          const tierBudget = tier.base_payment_usd * estimatedParticipants

          return (
            <Paper
              key={index}
              elevation={0}
              sx={{
                p: 2.5,
                mb: 2,
                border: '1px solid var(--border-subtle, #E5E7F0)',
                borderRadius: '12px',
                bgcolor: 'var(--card-background, #FFFFFF)',
                '&:hover': {
                  borderColor: 'var(--accent-primary, #7C4DFF)',
                  boxShadow: '0 4px 12px rgba(124, 77, 255, 0.1)'
                },
                transition: 'all 0.2s ease'
              }}
            >
              {/* Tier Header */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography 
                    variant="subtitle2" 
                    sx={{ 
                      fontWeight: 600,
                      color: 'var(--accent-primary, #7C4DFF)'
                    }}
                  >
                    Tier {index + 1}
                  </Typography>
                  {isLastTier && (
                    <Chip 
                      label="Unlimited" 
                      size="small"
                      sx={{ 
                        bgcolor: 'var(--accent-warning, #FFC857)',
                        color: '#000',
                        fontWeight: 500,
                        height: 20
                      }}
                    />
                  )}
                  {isFirstTier && (
                    <Chip 
                      label="Entry Level" 
                      size="small"
                      sx={{ 
                        bgcolor: 'var(--accent-success-soft, #E3F8ED)',
                        color: 'var(--accent-success, #36C170)',
                        fontWeight: 500,
                        height: 20
                      }}
                    />
                  )}
                </Box>
                
                {tiers.length > 1 && (
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveTier(index)}
                    sx={{ 
                      color: 'var(--text-secondary, #6F7280)',
                      '&:hover': {
                        color: 'error.main',
                        bgcolor: 'rgba(239, 68, 68, 0.1)'
                      }
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>

              {/* Tier Name */}
              <TextField
                fullWidth
                label="Tier Name"
                value={tier.tier_name}
                onChange={(e) => handleUpdateTier(index, 'tier_name', e.target.value)}
                placeholder="e.g., Micro, Small, Mid-tier, Macro"
                size="small"
                sx={{ mb: 2, ...inputStyles }}
                helperText="Descriptive name for this tier (shown to workers)"
              />

              {/* Follower Range */}
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  label="Min Followers"
                  type="number"
                  value={tier.min_followers}
                  onChange={(e) => handleUpdateTier(index, 'min_followers', parseInt(e.target.value) || 0)}
                  disabled={index > 0} // Auto-calculated except for first tier
                  size="small"
                  sx={{ flex: 1, ...inputStyles }}
                  inputProps={{ min: 0 }}
                  helperText={index === 0 ? "Always 0" : "Auto-calculated"}
                />
                
                {isLastTier ? (
                  <TextField
                    label="Max Followers"
                    value="Unlimited"
                    disabled
                    size="small"
                    sx={{ flex: 1, ...inputStyles }}
                    helperText="Open-ended"
                  />
                ) : (
                  <TextField
                    label="Max Followers"
                    type="number"
                    value={tier.max_followers || ''}
                    onChange={(e) => handleUpdateTier(index, 'max_followers', parseInt(e.target.value) || null)}
                    size="small"
                    sx={{ flex: 1, ...inputStyles }}
                    inputProps={{ min: tier.min_followers }}
                    helperText="Upper boundary"
                  />
                )}
              </Box>

              {/* Payment Amount */}
              <TextField
                fullWidth
                label="Payment Per Person"
                type="number"
                value={tier.base_payment_usd || ''}
                onChange={(e) => handleUpdateTier(index, 'base_payment_usd', parseFloat(e.target.value) || 0)}
                helperText={`Each worker in ${formatFollowerTierRange(tier)} gets this amount`}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography 
                        sx={{ 
                          fontWeight: 500, 
                          color: 'var(--accent-success, #36C170)',
                          fontSize: '16px'
                        }}
                      >
                        $
                      </Typography>
                    </InputAdornment>
                  ),
                  endAdornment: tokenPrice && tokenSymbol && tier.base_payment_usd > 0 && (
                    <InputAdornment position="end">
                      <Tooltip title={`≈ ${(tier.base_payment_usd / tokenPrice).toFixed(2)} ${tokenSymbol}`}>
                        <Typography 
                          sx={{ 
                            fontSize: '12px',
                            color: 'var(--text-muted, #A3A7B5)',
                            cursor: 'help'
                          }}
                        >
                          USD
                        </Typography>
                      </Tooltip>
                    </InputAdornment>
                  )
                }}
                sx={inputStyles}
              />

              {/* Budget preview for this tier */}
              {estimatedParticipants > 0 && tier.base_payment_usd > 0 && (
                <Typography 
                  variant="caption" 
                  sx={{ 
                    display: 'block',
                    mt: 1.5,
                    color: 'var(--text-secondary, #6F7280)',
                    bgcolor: 'var(--subtle-background, #F7F8FB)',
                    p: 1,
                    borderRadius: '8px'
                  }}
                >
                  📊 Est. ${tierBudget.toFixed(2)} for {estimatedParticipants} worker{estimatedParticipants !== 1 ? 's' : ''} 
                  {tokenPrice && tokenSymbol && (
                    <> (≈ {(tierBudget / tokenPrice).toFixed(2)} {tokenSymbol})</>
                  )}
                </Typography>
              )}

              {/* Range Display */}
              <Box 
                sx={{ 
                  mt: 1.5,
                  p: 1.5,
                  bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
                  borderRadius: '8px',
                  border: '1px dashed var(--accent-primary, #7C4DFF)'
                }}
              >
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontWeight: 500,
                    color: 'var(--accent-primary, #7C4DFF)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5
                  }}
                >
                  <TrendingUpIcon sx={{ fontSize: 14 }} />
                  {tier.tier_name} ({formatFollowerTierRange(tier)}): ${tier.base_payment_usd}/person
                </Typography>
              </Box>
            </Paper>
          )
        })}

        {/* Empty state */}
        {tiers.length === 0 && (
          <Box 
            sx={{ 
              p: 4, 
              textAlign: 'center',
              border: '2px dashed var(--border-subtle, #E5E7F0)',
              borderRadius: '12px'
            }}
          >
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              No tiers configured yet
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddTier}
              sx={{
                borderColor: 'var(--accent-primary, #7C4DFF)',
                color: 'var(--accent-primary, #7C4DFF)',
                textTransform: 'none',
                '&:hover': {
                  borderColor: 'var(--accent-primary, #7C4DFF)',
                  bgcolor: 'var(--accent-primary-soft, #EEE7FF)'
                }
              }}
            >
              Add First Tier
            </Button>
          </Box>
        )}
      </Box>

      {/* Validation Error Display */}
      {validationError && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3,
            borderRadius: '12px'
          }}
        >
          {validationError}
        </Alert>
      )}

      {/* Budget Preview */}
      {estimatedBudget && estimatedBudget > 0 && (
        <Box 
          sx={{ 
            p: 3, 
            bgcolor: 'var(--accent-success-soft, #E3F8ED)', 
            borderRadius: '16px',
            border: '1px solid var(--accent-success, #36C170)'
          }}
        >
          <Typography 
            variant="subtitle2" 
            sx={{ 
              color: 'var(--text-secondary, #6F7280)',
              mb: 1
            }}
          >
            Estimated Total Budget
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography 
              variant="body2" 
              sx={{ color: 'var(--text-secondary, #6F7280)' }}
            >
              Based on your estimated participation:
            </Typography>
            <Box sx={{ textAlign: 'right' }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700,
                  color: 'var(--accent-success, #36C170)'
                }}
              >
                ≈ ${estimatedBudget.toFixed(2)} USD
              </Typography>
              {tokenPrice && tokenSymbol && (
                <Typography 
                  variant="caption" 
                  sx={{ color: 'var(--text-secondary, #6F7280)' }}
                >
                  ≈ {(estimatedBudget / tokenPrice).toFixed(2)} {tokenSymbol}
                </Typography>
              )}
            </Box>
          </Box>
          
          <Typography 
            variant="caption" 
            sx={{ 
              display: 'block',
              mt: 2,
              color: 'var(--text-secondary, #6F7280)',
              fontStyle: 'italic'
            }}
          >
            * Actual budget depends on who participates and their follower counts. Workers paid instantly upon approval.
          </Typography>
        </Box>
      )}

      {/* Help Text */}
      <Box 
        sx={{ 
          mt: 3,
          p: 2,
          bgcolor: 'var(--subtle-background, #F7F8FB)',
          borderRadius: '12px'
        }}
      >
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'var(--text-secondary, #6F7280)',
            display: 'block',
            lineHeight: 1.6
          }}
        >
          💡 <strong>How it works:</strong> When a worker submits, their follower count determines their tier. 
          You approve → they get paid instantly. Budget decrements in real-time. You can end the campaign anytime.
        </Typography>
      </Box>
    </Box>
  )
}

