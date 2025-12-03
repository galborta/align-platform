'use client'

import { Box, Button, Typography } from '@mui/material'
import { TipToken } from '@/types/database'

interface QuickTipButtonsProps {
  amounts: number[]
  onSelect: (usdAmount: number) => void
  disabled: boolean
  selectedToken: TipToken | null
}

export default function QuickTipButtons({
  amounts,
  onSelect,
  disabled,
  selectedToken
}: QuickTipButtonsProps) {
  const hasPriceData = selectedToken?.usdPrice !== null && selectedToken?.usdPrice !== undefined

  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mb: 1,
          color: '#6F7280',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontWeight: 600
        }}
      >
        Quick amounts
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {amounts.map((amount) => (
          <Button
            key={amount}
            variant="outlined"
            size="small"
            onClick={() => onSelect(amount)}
            disabled={disabled || !hasPriceData}
            sx={{
              minWidth: '60px',
              borderColor: '#E5E7F0',
              color: '#7C4DFF',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              '&:hover': {
                borderColor: '#7C4DFF',
                bgcolor: 'rgba(124, 77, 255, 0.08)'
              },
              '&:disabled': {
                borderColor: '#E5E7F0',
                color: '#A3A7B5'
              }
            }}
          >
            ${amount}
          </Button>
        ))}
      </Box>

      {!hasPriceData && selectedToken && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 1,
            color: '#FFA726',
            fontSize: '11px'
          }}
        >
          ⚠️ Quick tips unavailable (price data not found for {selectedToken.symbol})
        </Typography>
      )}
    </Box>
  )
}






