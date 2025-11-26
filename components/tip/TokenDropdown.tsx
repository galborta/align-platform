'use client'

import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Avatar,
  CircularProgress,
  useMediaQuery,
  useTheme
} from '@mui/material'
import { TipToken } from '@/types/database'

interface TokenDropdownProps {
  tokens: TipToken[]
  selectedToken: TipToken | null
  onSelect: (token: TipToken) => void
  loading: boolean
}

export default function TokenDropdown({
  tokens,
  selectedToken,
  onSelect,
  loading
}: TokenDropdownProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const formatBalance = (balance: number, decimals: number) => {
    return balance.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.min(4, decimals)
    })
  }

  const formatUsd = (value: number) => {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <CircularProgress size={20} sx={{ color: '#7C4DFF' }} />
        <Typography variant="body2" color="text.secondary">
          Loading tokens...
        </Typography>
      </Box>
    )
  }

  if (tokens.length === 0) {
    return (
      <Box 
        sx={{ 
          p: 2, 
          mb: 2, 
          bgcolor: '#FFF9E6', 
          borderRadius: '8px',
          border: '1px solid #FFE999'
        }}
      >
        <Typography variant="body2" color="#8B7100">
          ⚠️ No tokens available to send (minimum $0.10 value required)
        </Typography>
      </Box>
    )
  }

  return (
    <FormControl fullWidth sx={{ mb: 2 }}>
      <InputLabel sx={{ fontFamily: 'Space Grotesk, sans-serif' }}>
        Token
      </InputLabel>
      <Select
        value={selectedToken?.mint || ''}
        onChange={(e) => {
          const token = tokens.find(t => t.mint === e.target.value)
          if (token) onSelect(token)
        }}
        label="Token"
        renderValue={(value) => {
          if (!selectedToken) return 'Select token'
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {selectedToken.logoUrl && (
                <Avatar 
                  src={selectedToken.logoUrl} 
                  sx={{ width: 24, height: 24 }}
                />
              )}
              <Typography 
                sx={{ 
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600
                }}
              >
                {selectedToken.symbol}
              </Typography>
            </Box>
          )
        }}
      >
        {tokens.map((token) => (
          <MenuItem key={token.mint} value={token.mint}>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                py: 1
              }}
            >
              {/* Left: Logo + Symbol */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {token.logoUrl && (
                  <Avatar 
                    src={token.logoUrl} 
                    sx={{ width: 32, height: 32 }}
                  />
                )}
                <Typography 
                  variant="body1" 
                  sx={{ 
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontWeight: 600
                  }}
                >
                  {token.symbol}
                </Typography>
              </Box>

              {/* Right: Balance + USD */}
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {formatBalance(token.balance, token.decimals)}
                </Typography>
                {token.usdPrice && (
                  <Typography 
                    variant="caption" 
                    color="text.secondary"
                    sx={{ fontSize: '11px' }}
                  >
                    ${formatUsd(token.usdValue)}
                  </Typography>
                )}
              </Box>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

