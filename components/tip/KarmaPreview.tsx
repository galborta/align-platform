'use client'

import { Box, Typography, LinearProgress } from '@mui/material'

interface KarmaPreviewProps {
  karmaAmount: number
  dailyCap: number
  currentDailyTotal: number
  usdValue: number
}

export default function KarmaPreview({
  karmaAmount,
  dailyCap,
  currentDailyTotal,
  usdValue
}: KarmaPreviewProps) {
  const projectedTotal = currentDailyTotal + karmaAmount
  const progressPercent = (currentDailyTotal / dailyCap) * 100
  const willHitCap = projectedTotal >= dailyCap
  const actualKarmaEarned = willHitCap 
    ? Math.max(0, dailyCap - currentDailyTotal)
    : karmaAmount

  // Color based on progress
  let progressColor: 'success' | 'warning' | 'error' = 'success'
  if (progressPercent >= 100) progressColor = 'error'
  else if (progressPercent >= 80) progressColor = 'warning'

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        bgcolor: '#F0F9FF',
        borderRadius: '8px',
        border: '1px solid #BAE6FD'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            fontFamily: 'Space Grotesk, sans-serif',
            color: '#0369A1'
          }}
        >
          💎 Karma Reward Preview
        </Typography>
      </Box>

      <Typography
        variant="h6"
        sx={{
          fontWeight: 700,
          color: '#7C4DFF',
          fontSize: '1.25rem',
          mb: 1.5
        }}
      >
        +{actualKarmaEarned.toFixed(1)} karma
      </Typography>

      {usdValue > 0 && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            color: '#6F7280',
            fontSize: '11px',
            mb: 1.5
          }}
        >
          For ${usdValue.toFixed(2)} tip with your holder tier
        </Typography>
      )}

      <Box sx={{ mb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontSize: '11px', color: '#6F7280' }}>
            Today's Progress
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '11px', fontWeight: 600 }}>
            {currentDailyTotal.toFixed(0)} / {dailyCap.toFixed(0)}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min(progressPercent, 100)}
          color={progressColor}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: '#E5E7F0'
          }}
        />
      </Box>

      {/* Warnings */}
      {progressPercent >= 100 && (
        <Typography
          variant="caption"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: '#DC2626',
            fontSize: '11px',
            fontWeight: 600
          }}
        >
          🔴 Daily karma cap reached (resets at midnight UTC)
        </Typography>
      )}

      {progressPercent >= 80 && progressPercent < 100 && (
        <Typography
          variant="caption"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: '#F59E0B',
            fontSize: '11px',
            fontWeight: 600
          }}
        >
          ⚠️ Approaching daily karma cap
        </Typography>
      )}

      {willHitCap && progressPercent < 100 && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            color: '#F59E0B',
            fontSize: '10px'
          }}
        >
          This tip will reach your daily cap
        </Typography>
      )}
    </Box>
  )
}

