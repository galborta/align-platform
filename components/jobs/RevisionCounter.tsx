'use client'

import { useState } from 'react'
import { Box, Chip, Skeleton, Tooltip, Typography, ClickAwayListener, useMediaQuery, useTheme } from '@mui/material'
import LoopIcon from '@mui/icons-material/Loop'
import AllInclusiveIcon from '@mui/icons-material/AllInclusive'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import ErrorIcon from '@mui/icons-material/Error'
import InfoIcon from '@mui/icons-material/Info'
import { parseRevisionOffering, formatRemainingShort } from '@/lib/revisions'
import type { JobApplication } from '@/types/database'

interface RevisionCounterProps {
  /** The application object with revision fields */
  application: Pick<JobApplication, 'revisions_offered' | 'revisions_used' | 'revisions_remaining'> | null
  /** Whether data is currently loading */
  loading?: boolean
  /** Display size variant */
  size?: 'small' | 'medium' | 'large'
  /** Whether to show the info tooltip */
  showTooltip?: boolean
  /** Whether this is being viewed by the worker (affects messaging) */
  isWorkerView?: boolean
  /** Custom className for container */
  className?: string
}

/**
 * RevisionCounter Component
 * 
 * Displays revision tracking status with color-coded indicators.
 * Shows: "🔄 Revisions: X of Y used (Z remaining)"
 * For unlimited: "X used (unlimited remaining)"
 * 
 * Color coding:
 * - Green: Revisions available
 * - Yellow: Low revisions (1 remaining)
 * - Red: No revisions remaining
 * - Orange: Unlimited revisions
 * 
 * @example
 * <RevisionCounter application={assignedWorkerApplication} />
 */
export function RevisionCounter({
  application,
  loading = false,
  size = 'medium',
  showTooltip = true,
  isWorkerView = false,
  className = ''
}: RevisionCounterProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false)
  
  // Mobile detection
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // Loading state
  if (loading) {
    return (
      <Box 
        className={className}
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          p: size === 'large' ? 2 : size === 'medium' ? 1.5 : 1,
          borderRadius: '12px',
          backgroundColor: '#F7F8FB'
        }}
      >
        <Skeleton variant="circular" width={isMobile ? 18 : 20} height={isMobile ? 18 : 20} />
        <Skeleton variant="text" width={isMobile ? 140 : 180} height={isMobile ? 20 : 24} />
      </Box>
    )
  }

  // No application data
  if (!application) {
    return null
  }

  const offered = parseRevisionOffering(application.revisions_offered)
  const used = application.revisions_used ?? 0
  const remaining = parseRevisionOffering(application.revisions_remaining)

  // No revisions were offered
  if (offered === null) {
    return (
      <Box 
        className={className}
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          p: size === 'large' ? 2 : size === 'medium' ? 1.5 : 1,
          borderRadius: '12px',
          backgroundColor: '#F7F8FB',
          border: '1px solid #E5E7F0'
        }}
      >
        <LoopIcon sx={{ fontSize: getSizePx(size, 'icon'), color: '#A3A7B5' }} />
        <Typography
          sx={{
            fontSize: getSizePx(size, 'text'),
            color: '#6F7280',
            fontWeight: 500
          }}
        >
          No revisions committed
        </Typography>
        {showTooltip && (
          <Tooltip 
            title="The worker did not specify a revision commitment. Any revisions would be voluntary."
            arrow
          >
            <InfoIcon sx={{ fontSize: 14, color: '#A3A7B5', cursor: 'help' }} />
          </Tooltip>
        )}
      </Box>
    )
  }

  // Determine status and colors
  const { statusColor, bgColor, borderColor, StatusIcon, statusText } = getRevisionStatus(
    offered,
    remaining,
    used
  )

  // Build display text
  const displayText = buildDisplayText(offered, used, remaining, isWorkerView)

  // Get responsive sizes
  const iconSize = isMobile ? getSizePx(size, 'icon') - 2 : getSizePx(size, 'icon')
  const textSize = isMobile ? getSizePx(size, 'text') - 1 : getSizePx(size, 'text')

  const tooltipText = getTooltipText(offered, remaining, isWorkerView)

  return (
    <Box 
      className={className}
      sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: { xs: 0.75, sm: 1.5 },
        p: size === 'large' ? 2 : size === 'medium' ? (isMobile ? 1.25 : 1.5) : 1,
        borderRadius: { xs: '10px', sm: '12px' },
        backgroundColor: bgColor,
        border: `2px solid ${borderColor}`,
        transition: 'all 0.2s ease',
        // Prevent horizontal overflow on mobile
        maxWidth: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Icon + Main Text */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: { xs: 0.5, sm: 1 }, 
        flexWrap: 'wrap',
        minWidth: 0, // Allow text truncation
        flex: 1
      }}>
        <StatusIcon sx={{ fontSize: iconSize, color: statusColor, flexShrink: 0 }} />
        <Typography
          sx={{
            fontSize: textSize,
            color: '#1A1A1E',
            fontWeight: 600,
            fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
            // Compact label on mobile
            display: { xs: 'none', sm: 'inline' }
          }}
        >
          Revisions:
        </Typography>
        <Typography
          sx={{
            fontSize: textSize,
            color: statusColor,
            fontWeight: 600,
            // Allow text to truncate on very small screens
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: { xs: 'nowrap', sm: 'normal' }
          }}
        >
          {displayText}
        </Typography>
      </Box>

      {/* Status Chip */}
      <Chip
        icon={
          offered === 'unlimited' 
            ? <AllInclusiveIcon sx={{ fontSize: { xs: 12, sm: 14 } }} /> 
            : remaining === 0 
              ? <ErrorIcon sx={{ fontSize: { xs: 12, sm: 14 } }} />
              : <CheckCircleIcon sx={{ fontSize: { xs: 12, sm: 14 } }} />
        }
        label={statusText}
        size="small"
        sx={{
          backgroundColor: statusColor,
          color: '#fff',
          fontWeight: 600,
          fontSize: { xs: '10px', sm: '11px' },
          height: size === 'small' ? (isMobile ? 20 : 22) : (isMobile ? 24 : 26),
          flexShrink: 0,
          '& .MuiChip-icon': {
            color: '#fff'
          },
          '& .MuiChip-label': {
            px: { xs: 0.75, sm: 1 }
          }
        }}
      />

      {/* Info Tooltip - tap-friendly on mobile */}
      {showTooltip && (
        isMobile ? (
          <ClickAwayListener onClickAway={() => setTooltipOpen(false)}>
            <div>
              <Tooltip
                PopperProps={{ disablePortal: true }}
                onClose={() => setTooltipOpen(false)}
                open={tooltipOpen}
                disableFocusListener
                disableHoverListener
                disableTouchListener
                title={tooltipText}
                arrow
                placement="top"
              >
                <InfoIcon 
                  onClick={() => setTooltipOpen(!tooltipOpen)}
                  sx={{ 
                    fontSize: { xs: 18, sm: 16 }, 
                    color: '#6F7280', 
                    cursor: 'pointer',
                    ml: { xs: 0, sm: 'auto' },
                    // Larger tap target
                    padding: '4px',
                    margin: '-4px',
                    flexShrink: 0
                  }} 
                />
              </Tooltip>
            </div>
          </ClickAwayListener>
        ) : (
          <Tooltip 
            title={tooltipText}
            arrow
            placement="top"
          >
            <InfoIcon 
              sx={{ 
                fontSize: 16, 
                color: '#6F7280', 
                cursor: 'help',
                ml: 'auto',
                flexShrink: 0
              }} 
            />
          </Tooltip>
        )
      )}
    </Box>
  )
}

// ==================== HELPER FUNCTIONS ====================

function getSizePx(size: 'small' | 'medium' | 'large', type: 'icon' | 'text'): number {
  const sizes = {
    small: { icon: 16, text: 13 },
    medium: { icon: 20, text: 14 },
    large: { icon: 24, text: 16 }
  }
  return sizes[size][type]
}

function getRevisionStatus(
  offered: 'unlimited' | number,
  remaining: 'unlimited' | number | null,
  used: number
) {
  // Unlimited revisions
  if (offered === 'unlimited') {
    return {
      statusColor: '#FB923C', // Orange
      bgColor: '#FFF7ED',
      borderColor: '#FB923C',
      StatusIcon: AllInclusiveIcon,
      statusText: 'Unlimited'
    }
  }

  // No revisions remaining
  if (remaining === 0 || remaining === null) {
    return {
      statusColor: '#DC2626', // Red
      bgColor: '#FEF2F2',
      borderColor: '#DC2626',
      StatusIcon: ErrorIcon,
      statusText: 'Exhausted'
    }
  }

  // Low revisions (1 remaining)
  if (typeof remaining === 'number' && remaining === 1) {
    return {
      statusColor: '#F59E0B', // Yellow/Amber
      bgColor: '#FFFBEB',
      borderColor: '#F59E0B',
      StatusIcon: WarningIcon,
      statusText: '1 Left'
    }
  }

  // Revisions available (green)
  return {
    statusColor: '#36C170', // Green
    bgColor: '#E3F8ED',
    borderColor: '#36C170',
    StatusIcon: CheckCircleIcon,
    statusText: `${remaining} Left`
  }
}

function buildDisplayText(
  offered: 'unlimited' | number,
  used: number,
  remaining: 'unlimited' | number | null,
  isWorkerView: boolean
): string {
  if (offered === 'unlimited') {
    if (used === 0) {
      return 'None used yet'
    }
    return `${used} used (unlimited remaining)`
  }

  if (used === 0) {
    return `0 of ${offered} used`
  }

  const remainingText = remaining === null ? 0 : remaining
  return `${used} of ${offered} used (${remainingText} remaining)`
}

function getTooltipText(
  offered: 'unlimited' | number,
  remaining: 'unlimited' | number | null,
  isWorkerView: boolean
): string {
  if (offered === 'unlimited') {
    return isWorkerView
      ? 'You committed to unlimited revisions. The poster can request changes until satisfied.'
      : 'This worker committed to unlimited revisions. You can request changes until satisfied.'
  }

  if (remaining === 0 || remaining === null) {
    return isWorkerView
      ? 'All committed revisions have been used. Any additional revisions would be voluntary.'
      : 'All committed revisions have been used. You may request more, but the worker is not obligated to provide them.'
  }

  return isWorkerView
    ? `You have ${remaining} revision${remaining === 1 ? '' : 's'} remaining in your commitment.`
    : `The worker has ${remaining} revision${remaining === 1 ? '' : 's'} remaining in their commitment.`
}

export default RevisionCounter

