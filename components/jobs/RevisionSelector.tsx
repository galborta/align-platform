'use client'

import { useState } from 'react'
import {
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Box,
  Typography,
  Tooltip,
  Alert,
  ClickAwayListener,
  useMediaQuery,
  useTheme
} from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import AllInclusiveIcon from '@mui/icons-material/AllInclusive'

interface RevisionSelectorProps {
  value: string | null
  onChange: (value: string | null) => void
  error?: string
  disabled?: boolean
}

// Common revision options
const REVISION_OPTIONS = [
  { value: '1', label: '1 revision', description: 'One round of changes' },
  { value: '2', label: '2 revisions', description: 'Two rounds of changes' },
  { value: '3', label: '3 revisions', description: 'Three rounds of changes' },
  { value: '5', label: '5 revisions', description: 'Five rounds of changes' },
  { value: 'unlimited', label: 'Unlimited', description: 'No limit on revisions' },
  { value: 'custom', label: 'Custom', description: 'Specify your own number' }
]

/**
 * RevisionSelector Component
 * 
 * Radio button group for selecting revision offerings when applying to a job.
 * Supports common presets (1, 2, 3, 5, unlimited) and custom input.
 * 
 * @example
 * <RevisionSelector
 *   value={revisionsOffered}
 *   onChange={setRevisionsOffered}
 *   error={errors.revisions}
 * />
 */
export function RevisionSelector({
  value,
  onChange,
  error,
  disabled = false
}: RevisionSelectorProps) {
  const [customValue, setCustomValue] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  
  // Mobile detection for tap-friendly tooltip
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // Determine if current value is custom
  const isCustomValue = value !== null && 
    !['1', '2', '3', '5', 'unlimited'].includes(value)

  // Get the radio value (either preset or 'custom')
  const radioValue = isCustomValue ? 'custom' : value || ''

  const handleRadioChange = (newValue: string) => {
    if (newValue === 'custom') {
      setIsCustom(true)
      // Keep custom value if it exists, otherwise clear
      if (customValue && parseInt(customValue) > 0) {
        onChange(customValue)
      } else {
        onChange(null) // Will trigger validation error until custom is entered
      }
    } else {
      setIsCustom(false)
      setCustomValue('')
      onChange(newValue)
    }
  }

  const handleCustomChange = (inputValue: string) => {
    // Only allow positive integers
    const cleaned = inputValue.replace(/[^0-9]/g, '')
    setCustomValue(cleaned)
    
    if (cleaned && parseInt(cleaned) >= 0) {
      onChange(cleaned)
    } else {
      onChange(null)
    }
  }

  // Tooltip handlers for mobile tap
  const handleTooltipClose = () => {
    setTooltipOpen(false)
  }

  const handleTooltipOpen = () => {
    setTooltipOpen(true)
  }

  const tooltipContent = (
    <Box sx={{ p: 1, maxWidth: { xs: 260, sm: 280 } }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
        What are revisions?
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        Revisions are changes you commit to making after initial delivery. 
        The poster can request revisions within your limit.
      </Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: '#7C4DFF' }}>
        Commitment vs Voluntary
      </Typography>
      <Typography variant="body2">
        <strong>Committed:</strong> These are guaranteed revisions you're obligated to provide.
        <br /><br />
        <strong>Voluntary:</strong> If you go beyond your commitment, it shows exceptional service!
      </Typography>
    </Box>
  )

  return (
    <FormControl 
      component="fieldset" 
      fullWidth 
      error={!!error}
      disabled={disabled}
      sx={{ mb: 3 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }}>
        <FormLabel 
          component="legend"
          sx={{ 
            fontWeight: 600,
            color: '#1A1A1E',
            fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
            fontSize: { xs: '15px', sm: '14px' },
            '&.Mui-focused': { color: '#1A1A1E' }
          }}
        >
          Revisions Offered *
        </FormLabel>
        {/* Mobile: Tap to open tooltip; Desktop: Hover */}
        {isMobile ? (
          <ClickAwayListener onClickAway={handleTooltipClose}>
            <div>
              <Tooltip
                PopperProps={{
                  disablePortal: true,
                }}
                onClose={handleTooltipClose}
                open={tooltipOpen}
                disableFocusListener
                disableHoverListener
                disableTouchListener
                title={tooltipContent}
                arrow
                placement="bottom"
              >
                <InfoIcon 
                  onClick={handleTooltipOpen}
                  sx={{ 
                    ml: 0.5, 
                    fontSize: '1.25rem', 
                    color: '#7C4DFF', 
                    cursor: 'pointer',
                    // Larger tap target
                    padding: '8px',
                    margin: '-8px',
                    marginLeft: '4px'
                  }} 
                />
              </Tooltip>
            </div>
          </ClickAwayListener>
        ) : (
          <Tooltip 
            title={tooltipContent}
            arrow
            placement="right"
          >
            <InfoIcon 
              sx={{ 
                ml: 0.5, 
                fontSize: '1rem', 
                color: '#7C4DFF', 
                cursor: 'help' 
              }} 
            />
          </Tooltip>
        )}
      </Box>

      <RadioGroup
        value={radioValue}
        onChange={(e) => handleRadioChange(e.target.value)}
        sx={{ 
          display: 'grid',
          // Stack vertically on mobile for easier tap targets
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: { xs: 1, sm: 1.5 }
        }}
      >
        {REVISION_OPTIONS.map((option) => (
          <FormControlLabel
            key={option.value}
            value={option.value}
            control={
              <Radio 
                sx={{
                  color: '#B6BAC7',
                  '&.Mui-checked': {
                    color: '#7C4DFF'
                  },
                  // Larger radio button on mobile for easier tapping
                  '& .MuiSvgIcon-root': {
                    fontSize: { xs: 24, sm: 20 }
                  }
                }}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {option.value === 'unlimited' && (
                  <AllInclusiveIcon sx={{ fontSize: { xs: 18, sm: 16 }, color: '#7C4DFF' }} />
                )}
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: radioValue === option.value ? 600 : 400,
                    color: radioValue === option.value ? '#7C4DFF' : '#1A1A1E',
                    fontSize: { xs: '15px', sm: '14px' }
                  }}
                >
                  {option.label}
                </Typography>
              </Box>
            }
            sx={{
              m: 0,
              // Min 44x44px tap target on mobile (iOS/Android guideline)
              minHeight: { xs: 48, sm: 'auto' },
              p: { xs: 1.5, sm: 1.5 },
              borderRadius: '12px',
              border: '2px solid',
              borderColor: radioValue === option.value ? '#7C4DFF' : '#E5E7F0',
              backgroundColor: radioValue === option.value ? '#EEE7FF' : '#FFFFFF',
              transition: 'all 0.2s ease',
              // Better touch feedback on mobile
              WebkitTapHighlightColor: 'rgba(124, 77, 255, 0.1)',
              '&:hover': {
                borderColor: '#7C4DFF',
                backgroundColor: radioValue === option.value ? '#EEE7FF' : '#F8F5FF'
              },
              '&:active': {
                transform: { xs: 'scale(0.98)', sm: 'none' }
              }
            }}
          />
        ))}
      </RadioGroup>

      {/* Custom Number Input */}
      {(isCustom || isCustomValue) && (
        <Box sx={{ mt: 2 }}>
          <TextField
            type="number"
            value={customValue || (isCustomValue ? value : '')}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="Enter number of revisions"
            size={isMobile ? 'medium' : 'small'}
            fullWidth
            inputProps={{ 
              min: 0,
              // Numeric keyboard on mobile
              inputMode: 'numeric',
              pattern: '[0-9]*'
            }}
            error={!!error}
            sx={{
              '& .MuiOutlinedInput-root': {
                // Larger input on mobile
                fontSize: { xs: '16px', sm: '14px' },
                minHeight: { xs: 48, sm: 'auto' },
                '&:hover fieldset': {
                  borderColor: '#7C4DFF'
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#7C4DFF'
                }
              },
              '& .MuiInputBase-input': {
                // Prevent iOS zoom on focus
                fontSize: { xs: '16px', sm: '14px' }
              }
            }}
          />
        </Box>
      )}

      {/* Error Message */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mt: 1.5,
            fontSize: '13px',
            py: 0.5
          }}
        >
          {error}
        </Alert>
      )}

      {/* Helper Text */}
      <Typography 
        variant="caption" 
        sx={{ 
          mt: 1.5, 
          display: 'block',
          color: '#6F7280'
        }}
      >
        {value === 'unlimited' 
          ? '♾️ You\'re committing to unlimited revisions until the poster is satisfied'
          : value 
            ? `You're committing to ${value} revision${parseInt(value) !== 1 ? 's' : ''} for this job`
            : 'Select how many revisions you\'re willing to provide'
        }
      </Typography>

      {/* Unlimited Warning */}
      {value === 'unlimited' && (
        <Alert 
          severity="info" 
          sx={{ 
            mt: 1.5,
            backgroundColor: '#EEE7FF',
            color: '#1A1A1E',
            '& .MuiAlert-icon': {
              color: '#7C4DFF'
            }
          }}
        >
          <Typography variant="body2">
            <strong>💡 Pro tip:</strong> Unlimited revisions shows great commitment, 
            but make sure you can deliver! Most posters don't abuse this.
          </Typography>
        </Alert>
      )}
    </FormControl>
  )
}

export default RevisionSelector

