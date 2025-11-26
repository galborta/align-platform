'use client'

import {
  TextField,
  Button,
  InputAdornment,
  Box,
  Typography
} from '@mui/material'
import { TipToken } from '@/types/database'

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  error: string | null
  usdValue: number
  selectedToken: TipToken | null
  onMax: () => void
  disabled?: boolean
}

export default function AmountInput({
  value,
  onChange,
  error,
  usdValue,
  selectedToken,
  onMax,
  disabled = false
}: AmountInputProps) {
  const formatBalance = (balance: number, decimals: number) => {
    return balance.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.min(4, decimals)
    })
  }

  const formatUsd = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  return (
    <Box sx={{ mb: 2 }}>
      <TextField
        fullWidth
        type="text"
        label="Amount"
        value={value}
        onChange={(e) => {
          const val = e.target.value
          // Allow empty, positive numbers with up to selected token's decimals
          if (val === '' || /^\d*\.?\d*$/.test(val)) {
            onChange(val)
          }
        }}
        error={!!error}
        disabled={disabled || !selectedToken}
        placeholder="0.00"
        inputProps={{
          inputMode: 'decimal',
          style: { 
            fontSize: '1.25rem',
            fontWeight: 500
          }
        }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Button
                size="small"
                onClick={onMax}
                disabled={disabled || !selectedToken}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: '#7C4DFF',
                  '&:hover': {
                    bgcolor: 'rgba(124, 77, 255, 0.08)'
                  }
                }}
              >
                Max
              </Button>
            </InputAdornment>
          )
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            '&.Mui-focused fieldset': {
              borderColor: '#7C4DFF'
            }
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: '#7C4DFF'
          }
        }}
      />

      {/* Error Message */}
      {error && (
        <Typography
          variant="caption"
          color="error"
          sx={{ 
            display: 'block', 
            mt: 0.5,
            fontSize: '12px'
          }}
        >
          {error}
        </Typography>
      )}

      {/* USD Conversion */}
      {!error && selectedToken?.usdPrice && value && parseFloat(value) > 0 && (
        <Typography
          variant="h6"
          sx={{
            mt: 1,
            color: '#6F7280',
            fontSize: '1.125rem',
            fontWeight: 500
          }}
        >
          ≈ {formatUsd(usdValue)}
        </Typography>
      )}

      {/* Balance Display */}
      {selectedToken && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            color: '#6F7280',
            fontSize: '12px'
          }}
        >
          Balance: {formatBalance(selectedToken.balance, selectedToken.decimals)} {selectedToken.symbol}
        </Typography>
      )}
    </Box>
  )
}

