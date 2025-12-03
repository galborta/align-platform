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
  Tooltip
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import GroupsIcon from '@mui/icons-material/Groups'
import { BudgetTier } from '@/types/social-media-jobs'
import { validateBudgetTiers, calculateEstimatedPerPerson, formatTierRange } from '@/lib/social-media-jobs'

// ==================== TYPES ====================

interface TierBudgetConfigProps {
  tiers: BudgetTier[]
  maxBudget: number
  maxBudgetUsd: number
  onTiersChange: (tiers: BudgetTier[]) => void
  onMaxBudgetChange: (amount: number, usd: number) => void
  tokenSymbol: string
  tokenPrice: number // USD price per token
  feePercentage?: number // Platform fee percentage (default 5%)
}

// ==================== COMPONENT ====================

export default function TierBudgetConfig({
  tiers,
  maxBudget,
  maxBudgetUsd,
  onTiersChange,
  onMaxBudgetChange,
  tokenSymbol,
  tokenPrice,
  feePercentage = 5
}: TierBudgetConfigProps) {
  const [validationError, setValidationError] = useState<string>('')

  // ==================== CALCULATIONS ====================

  // Calculate platform fee based on max budget
  const platformFee = maxBudget * (feePercentage / 100)
  const platformFeeUsd = platformFee * tokenPrice
  const totalToLock = maxBudget + platformFee
  const totalToLockUsd = totalToLock * tokenPrice

  // Find the highest tier budget (this is what would be locked)
  const highestTierBudget = tiers.length > 0 
    ? Math.max(...tiers.map(t => t.budget_tokens))
    : 0

  // ==================== HANDLERS ====================

  /**
   * Add a new tier with smart defaults
   * - First tier starts at 1
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
    let newMinParticipants = 1
    if (tiers.length > 0) {
      const lastTier = newTiers[newTiers.length - 1]
      // If last tier was open-ended, close it
      if (lastTier.max_participants === null) {
        // Set a reasonable max for the previous tier
        newMinParticipants = lastTier.min_participants + 5
        lastTier.max_participants = newMinParticipants - 1
      } else {
        newMinParticipants = lastTier.max_participants + 1
      }
    }

    const newTier: BudgetTier = {
      min_participants: newMinParticipants,
      max_participants: null, // New tier is always open-ended
      budget_tokens: 0,
      budget_usd: 0
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
      updated[updated.length - 1].max_participants = null
    }
    
    // Re-adjust min values to ensure continuity
    for (let i = 1; i < updated.length; i++) {
      const prevMax = updated[i - 1].max_participants
      if (prevMax !== null) {
        updated[i].min_participants = prevMax + 1
      }
    }
    
    onTiersChange(updated)
    validateTiers(updated)
  }

  /**
   * Update a specific tier field
   */
  const handleUpdateTier = (index: number, field: keyof BudgetTier, value: number | null) => {
    const updated = [...tiers]
    updated[index] = { ...updated[index], [field]: value }
    
    // Auto-calculate USD when tokens change
    if (field === 'budget_tokens' && typeof value === 'number') {
      updated[index].budget_usd = value * tokenPrice
    }

    // Auto-adjust next tier's min when max changes
    if (field === 'max_participants' && value !== null && index < updated.length - 1) {
      updated[index + 1].min_participants = value + 1
    }
    
    onTiersChange(updated)
    validateTiers(updated)
  }

  /**
   * Validate tiers and update error state
   */
  const validateTiers = (tiersToValidate: BudgetTier[]) => {
    try {
      if (maxBudget > 0) {
        validateBudgetTiers(tiersToValidate, maxBudget)
      }
      setValidationError('')
    } catch (error: any) {
      setValidationError(error.message)
    }
  }

  // Validate when max budget changes
  useEffect(() => {
    if (tiers.length > 0 && maxBudget > 0) {
      validateTiers(tiers)
    }
  }, [maxBudget])

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
        <TrendingUpIcon sx={{ color: 'var(--accent-primary, #7C4DFF)' }} />
        Budget & Tiers
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
          <strong>Tiered budgets</strong> let you scale rewards based on participation. 
          Only the tier matching the final participant count is released.
        </Typography>
      </Alert>

      {/* Maximum Budget Input */}
      <Box 
        sx={{ 
          mb: 4,
          p: 3,
          bgcolor: 'var(--subtle-background, #F7F8FB)',
          borderRadius: '16px'
        }}
      >
        <Typography 
          variant="subtitle1" 
          sx={{ 
            fontWeight: 600,
            color: 'var(--text-primary, #1A1A1E)',
            mb: 1.5
          }}
        >
          Maximum Campaign Budget
        </Typography>
        
        <TextField
          fullWidth
          type="number"
          value={maxBudget || ''}
          onChange={(e) => {
            const tokens = parseFloat(e.target.value) || 0
            const usd = tokens * tokenPrice
            onMaxBudgetChange(tokens, usd)
          }}
          placeholder="e.g., 5000"
          helperText={
            maxBudget > 0 
              ? `≈ $${maxBudgetUsd.toFixed(2)} USD` 
              : "Enter the maximum budget for this campaign"
          }
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Typography 
                  sx={{ 
                    fontWeight: 600, 
                    color: 'var(--accent-primary, #7C4DFF)' 
                  }}
                >
                  {tokenSymbol}
                </Typography>
              </InputAdornment>
            )
          }}
          sx={inputStyles}
        />
        
        <Typography 
          variant="caption" 
          sx={{ 
            display: 'block', 
            mt: 1.5,
            color: 'var(--text-secondary, #6F7280)'
          }}
        >
          This is the maximum you'll pay if the highest tier is reached. 
          Actual amount depends on participation level.
        </Typography>
      </Box>

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
            <GroupsIcon sx={{ color: 'var(--accent-primary, #7C4DFF)', fontSize: 20 }} />
            Participation Tiers ({tiers.length})
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
          const estimate = tier.budget_tokens > 0 
            ? calculateEstimatedPerPerson(tier) 
            : null

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
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    fontWeight: 600,
                    color: 'var(--accent-primary, #7C4DFF)'
                  }}
                >
                  Tier {index + 1}
                  {isLastTier && (
                    <Typography 
                      component="span" 
                      variant="caption" 
                      sx={{ 
                        ml: 1, 
                        color: 'var(--text-secondary, #6F7280)' 
                      }}
                    >
                      (Maximum tier)
                    </Typography>
                  )}
                </Typography>
                
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

              {/* Participant Range */}
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  label="Min Participants"
                  type="number"
                  value={tier.min_participants}
                  onChange={(e) => handleUpdateTier(index, 'min_participants', parseInt(e.target.value) || 1)}
                  disabled={index > 0} // Auto-calculated except for first tier
                  size="small"
                  sx={{ flex: 1, ...inputStyles }}
                  inputProps={{ min: 1 }}
                />
                
                {isLastTier ? (
                  <TextField
                    label="Max Participants"
                    value="Unlimited"
                    disabled
                    size="small"
                    sx={{ flex: 1, ...inputStyles }}
                  />
                ) : (
                  <TextField
                    label="Max Participants"
                    type="number"
                    value={tier.max_participants || ''}
                    onChange={(e) => handleUpdateTier(index, 'max_participants', parseInt(e.target.value) || null)}
                    size="small"
                    sx={{ flex: 1, ...inputStyles }}
                    inputProps={{ min: tier.min_participants }}
                  />
                )}
              </Box>

              {/* Budget for this tier */}
              <TextField
                fullWidth
                label={`Budget for ${formatTierRange(tier)}`}
                type="number"
                value={tier.budget_tokens || ''}
                onChange={(e) => handleUpdateTier(index, 'budget_tokens', parseFloat(e.target.value) || 0)}
                helperText={
                  tier.budget_tokens > 0 
                    ? `≈ $${tier.budget_usd.toFixed(2)} USD` 
                    : "Budget to release if this tier is reached"
                }
                size="small"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography 
                        sx={{ 
                          fontWeight: 500, 
                          color: 'var(--accent-primary, #7C4DFF)',
                          fontSize: '14px'
                        }}
                      >
                        {tokenSymbol}
                      </Typography>
                    </InputAdornment>
                  )
                }}
                sx={inputStyles}
              />

              {/* Estimated per person */}
              {estimate && (
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
                  💰 Est. ~{estimate.tokensPerPerson.toFixed(2)} {tokenSymbol} 
                  (~${estimate.usdPerPerson.toFixed(2)}) per participant
                </Typography>
              )}
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

      {/* Total to Lock Display */}
      <Box 
        sx={{ 
          p: 3, 
          bgcolor: 'var(--accent-primary-soft, #EEE7FF)', 
          borderRadius: '16px',
          border: '1px solid var(--accent-primary, #7C4DFF)'
        }}
      >
        <Typography 
          variant="subtitle2" 
          sx={{ 
            color: 'var(--text-secondary, #6F7280)',
            mb: 1
          }}
        >
          Summary
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary, #6F7280)' }}>
            Maximum Budget:
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {maxBudget.toLocaleString()} {tokenSymbol}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary, #6F7280)' }}>
            Platform Fee ({feePercentage}%):
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {platformFee.toLocaleString()} {tokenSymbol}
          </Typography>
        </Box>
        
        <Divider sx={{ my: 1.5, borderColor: 'var(--accent-primary, #7C4DFF)', opacity: 0.3 }} />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)'
            }}
          >
            Maximum to Lock:
          </Typography>
          <Box sx={{ textAlign: 'right' }}>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 700,
                color: 'var(--accent-primary, #7C4DFF)'
              }}
            >
              {totalToLock.toLocaleString()} {tokenSymbol}
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ color: 'var(--text-secondary, #6F7280)' }}
            >
              ≈ ${totalToLockUsd.toFixed(2)} USD
            </Typography>
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
          * Only the actual tier amount + proportional fee will be spent. Unused budget is refunded.
        </Typography>
      </Box>
    </Box>
  )
}

