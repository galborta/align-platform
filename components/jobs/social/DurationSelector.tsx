'use client'

import { useMemo } from 'react'
import { Box, RadioGroup, Typography, useTheme, useMediaQuery } from '@mui/material'
import { addDays, format } from 'date-fns'

// ==================== TYPES ====================

interface DurationSelectorProps {
  selectedDays: number
  onChange: (days: number) => void
}

// ==================== CONSTANTS ====================

const DURATION_OPTIONS = [3, 7, 14, 30] as const

// ==================== COMPONENT ====================

export default function DurationSelector({
  selectedDays,
  onChange
}: DurationSelectorProps) {
  // ==================== MOBILE DETECTION ====================
  
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  
  /**
   * Calculate end date based on selected duration
   */
  const endDate = useMemo(() => {
    return addDays(new Date(), selectedDays)
  }, [selectedDays])

  /**
   * Format end date as "January 22, 2025 at 3:47 PM"
   */
  const formattedEndDate = useMemo(() => {
    return format(endDate, 'MMMM d, yyyy \'at\' h:mm a')
  }, [endDate])

  return (
    <Box>
      {/* Section Label */}
      <Typography
        sx={{
          fontFamily: 'var(--font-body, Satoshi), sans-serif',
          fontSize: { xs: '13px', sm: '14px' },
          fontWeight: 500,
          color: 'var(--text-primary, #1A1A1E)',
          mb: 1.5
        }}
      >
        Campaign Duration
      </Typography>

      {/* Radio Group */}
      <RadioGroup
        value={selectedDays}
        onChange={(e) => onChange(parseInt(e.target.value))}
        sx={{ mb: 1 }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            flexWrap: 'wrap',
            gap: { xs: 'var(--space-sm, 12px)', sm: 1.5 }
          }}
        >
          {DURATION_OPTIONS.map((days) => (
            <Box
              key={days}
              onClick={() => onChange(days)}
              sx={{
                border: selectedDays === days
                  ? '2px solid var(--accent-primary, #7C4DFF)'
                  : '1px solid var(--border-subtle, #E5E7F0)',
                borderRadius: '12px',
                p: isMobile ? 'var(--space-md, 16px)' : 1.5,
                minHeight: isMobile ? '48px' : 'auto', // Larger touch target on mobile
                bgcolor: selectedDays === days
                  ? 'var(--accent-primary-soft, #EEE7FF)'
                  : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: { xs: '100%', sm: '80px' },
                flex: { xs: '1 1 100%', sm: '0 1 auto' },
                display: 'flex',
                alignItems: 'center',
                justifyContent: isMobile ? 'flex-start' : 'center',
                outline: 'none', // Remove focus outline
                '&:hover': {
                  borderColor: 'var(--accent-primary, #7C4DFF)',
                  bgcolor: selectedDays === days
                    ? 'var(--accent-primary-soft, #EEE7FF)'
                    : 'rgba(124, 77, 255, 0.04)'
                },
                '&:focus': {
                  outline: 'none' // Remove focus outline on click
                }
              }}
            >
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi), sans-serif',
                  fontSize: { xs: '15px', sm: '14px' },
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)',
                  pointerEvents: 'none' // Prevent text from intercepting clicks
                }}
              >
                {days} days
              </Typography>
            </Box>
          ))}
        </Box>
      </RadioGroup>

      {/* End Date Display */}
      <Typography
        sx={{
          fontFamily: 'var(--font-body, Satoshi), sans-serif',
          fontSize: { xs: '11px', sm: '12px' },
          color: 'var(--text-muted, #A3A7B5)',
          fontStyle: 'italic'
        }}
      >
        Ends: {formattedEndDate}
      </Typography>
    </Box>
  )
}

