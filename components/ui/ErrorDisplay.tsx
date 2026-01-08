/**
 * Error Display Component Library
 * 
 * Comprehensive error handling UI components following Align Design System.
 * Provides consistent error feedback with clear messaging and recovery options.
 * 
 * Usage:
 * - ErrorAlert: Inline error messages with retry
 * - WarningBanner: Warning messages
 * - ErrorPage: Full-page error state
 * - ErrorCard: Card-based error display
 * - ValidationError: Form validation errors
 * - NetworkError: Network-specific errors
 */

'use client'

import React from 'react'
import { Button, Alert, AlertTitle, Box, Typography, Paper } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import RefreshIcon from '@mui/icons-material/Refresh'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

// ==================== INLINE ERROR ALERT ====================

interface ErrorAlertProps {
  error: string | Error
  onRetry?: () => void
  onDismiss?: () => void
  severity?: 'error' | 'warning' | 'info'
}

/**
 * Inline error alert with optional retry button
 * 
 * @example
 * ```tsx
 * <ErrorAlert 
 *   error="Failed to load submissions"
 *   onRetry={() => fetchSubmissions()}
 * />
 * ```
 */
export function ErrorAlert({ 
  error, 
  onRetry,
  onDismiss,
  severity = 'error'
}: ErrorAlertProps) {
  const errorMessage = typeof error === 'string' ? error : error.message

  return (
    <Alert 
      severity={severity}
      onClose={onDismiss}
      sx={{
        fontFamily: 'var(--font-body, Satoshi, sans-serif)',
        fontSize: '14px',
        borderRadius: 'var(--radius-card-lg, 16px)',
        mb: 2,
        animation: 'fadeIn 0.3s ease-out',
        '& .MuiAlert-icon': {
          fontSize: 24
        }
      }}
      action={
        onRetry && (
          <Button 
            color="inherit" 
            size="small" 
            onClick={onRetry}
            startIcon={<RefreshIcon />}
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 500
            }}
          >
            Try Again
          </Button>
        )
      }
    >
      {errorMessage}
    </Alert>
  )
}

// ==================== WARNING BANNER ====================

interface WarningBannerProps {
  message: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

/**
 * Warning banner for important notices
 * 
 * @example
 * ```tsx
 * <WarningBanner 
 *   message="Campaign ends in 2 hours. Review submissions soon!"
 * />
 * ```
 */
export function WarningBanner({ message, icon, action }: WarningBannerProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2,
        mb: 2,
        background: 'rgba(255, 200, 87, 0.1)',
        border: '2px solid var(--accent-warning, #FFC857)',
        borderRadius: 'var(--radius-card-lg, 16px)',
        animation: 'slideInFromTop 0.4s ease-out'
      }}
    >
      {icon || <WarningAmberIcon sx={{ color: 'var(--accent-warning, #FFC857)', fontSize: 28 }} />}
      <Typography
        sx={{
          flex: 1,
          fontFamily: 'var(--font-body, Satoshi, sans-serif)',
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--text-primary, #1A1A1E)'
        }}
      >
        {message}
      </Typography>
      {action}
    </Box>
  )
}

// ==================== INFO BANNER ====================

/**
 * Info banner for helpful notices
 * 
 * @example
 * ```tsx
 * <InfoBanner message="Wait 48+ hours after posting for best impression results" />
 * ```
 */
export function InfoBanner({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2,
        mb: 2,
        background: 'var(--accent-primary-soft, #EEE7FF)',
        border: '2px solid var(--accent-primary, #7C4DFF)',
        borderRadius: 'var(--radius-card-lg, 16px)',
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      <InfoOutlinedIcon sx={{ color: 'var(--accent-primary, #7C4DFF)', fontSize: 28 }} />
      <Typography
        sx={{
          flex: 1,
          fontFamily: 'var(--font-body, Satoshi, sans-serif)',
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--text-primary, #1A1A1E)'
        }}
      >
        {message}
      </Typography>
      {action}
    </Box>
  )
}

// ==================== FULL ERROR PAGE ====================

interface ErrorPageProps {
  title: string
  message: string
  onBack?: () => void
  onRetry?: () => void
  showIcon?: boolean
}

/**
 * Full-page error state
 * 
 * @example
 * ```tsx
 * <ErrorPage
 *   title="Campaign Not Found"
 *   message="This campaign may have been deleted or doesn't exist."
 *   onBack={() => router.push('/jobs')}
 * />
 * ```
 */
export function ErrorPage({ 
  title, 
  message, 
  onBack,
  onRetry,
  showIcon = true
}: ErrorPageProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        p: 4,
        textAlign: 'center'
      }}
    >
      {showIcon && (
        <ErrorOutlineIcon 
          sx={{ 
            fontSize: 100, 
            color: '#EF4444',
            mb: 3,
            animation: 'fadeInScale 0.5s ease-out',
            filter: 'drop-shadow(0 4px 12px rgba(239, 68, 68, 0.2))'
          }} 
        />
      )}
      
      <Typography
        variant="h4"
        sx={{
          fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
          fontWeight: 700,
          color: 'var(--text-primary, #1A1A1E)',
          mb: 2,
          animation: 'fadeIn 0.5s ease-out 0.1s both'
        }}
      >
        {title}
      </Typography>
      
      <Typography
        sx={{
          fontFamily: 'var(--font-body, Satoshi, sans-serif)',
          fontSize: '16px',
          color: 'var(--text-secondary, #6F7280)',
          mb: 4,
          maxWidth: '500px',
          animation: 'fadeIn 0.5s ease-out 0.2s both'
        }}
      >
        {message}
      </Typography>
      
      <Box 
        sx={{ 
          display: 'flex', 
          gap: 2,
          animation: 'fadeIn 0.5s ease-out 0.3s both'
        }}
      >
        {onBack && (
          <Button
            variant="outlined"
            onClick={onBack}
            startIcon={<ArrowBackIcon />}
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 'var(--radius-control, 999px)',
              px: 3,
              py: 1,
              borderColor: 'var(--border-subtle, #E5E7F0)',
              color: 'var(--text-secondary, #6F7280)',
              '&:hover': {
                borderColor: 'var(--text-secondary, #6F7280)',
                background: 'var(--subtle-background, #F7F8FB)'
              }
            }}
          >
            Go Back
          </Button>
        )}
        
        {onRetry && (
          <Button
            variant="contained"
            onClick={onRetry}
            startIcon={<RefreshIcon />}
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 'var(--radius-control, 999px)',
              px: 3,
              py: 1,
              background: 'var(--accent-primary, #7C4DFF)',
              '&:hover': {
                background: '#6A3FE8'
              }
            }}
          >
            Try Again
          </Button>
        )}
      </Box>
    </Box>
  )
}

// ==================== ERROR CARD ====================

interface ErrorCardProps {
  title: string
  error: string | Error
  onRetry?: () => void
}

/**
 * Card-based error display
 * 
 * @example
 * ```tsx
 * <ErrorCard
 *   title="Failed to Load Submissions"
 *   error={error}
 *   onRetry={() => refetch()}
 * />
 * ```
 */
export function ErrorCard({ title, error, onRetry }: ErrorCardProps) {
  const errorMessage = typeof error === 'string' ? error : error.message

  return (
    <Paper
      sx={{
        p: 4,
        background: 'var(--card-background, #FFFFFF)',
        borderRadius: 'var(--radius-card-lg, 24px)',
        border: '2px solid #EF4444',
        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)',
        animation: 'fadeInScale 0.4s ease-out'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
        <ErrorOutlineIcon sx={{ color: '#EF4444', fontSize: 32, flexShrink: 0 }} />
        <Box sx={{ flex: 1 }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)',
              mb: 1
            }}
          >
            {title}
          </Typography>
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '14px',
              color: 'var(--text-secondary, #6F7280)'
            }}
          >
            {errorMessage}
          </Typography>
        </Box>
      </Box>
      
      {onRetry && (
        <Button
          variant="outlined"
          onClick={onRetry}
          startIcon={<RefreshIcon />}
          fullWidth
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontWeight: 500,
            textTransform: 'none',
            borderRadius: 'var(--radius-control, 999px)',
            borderColor: '#EF4444',
            color: '#EF4444',
            '&:hover': {
              borderColor: '#DC2626',
              background: 'rgba(239, 68, 68, 0.05)'
            }
          }}
        >
          Try Again
        </Button>
      )}
    </Paper>
  )
}

// ==================== NETWORK ERROR ====================

/**
 * Network-specific error display
 * 
 * @example
 * ```tsx
 * <NetworkError onRetry={() => refetch()} />
 * ```
 */
export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorCard
      title="Connection Error"
      error="Unable to connect to the server. Please check your internet connection."
      onRetry={onRetry}
    />
  )
}

// ==================== VALIDATION ERROR ====================

interface ValidationErrorProps {
  field: string
  error: string
}

/**
 * Form field validation error
 * 
 * @example
 * ```tsx
 * {errors.email && (
 *   <ValidationError field="Email" error={errors.email} />
 * )}
 * ```
 */
export function ValidationError({ field, error }: ValidationErrorProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        mt: 0.5,
        animation: 'shake 0.5s ease-in-out'
      }}
    >
      <ErrorOutlineIcon sx={{ color: '#EF4444', fontSize: 16 }} />
      <Typography
        sx={{
          fontFamily: 'var(--font-body, Satoshi, sans-serif)',
          fontSize: '12px',
          color: '#EF4444',
          fontWeight: 500
        }}
      >
        {error}
      </Typography>
    </Box>
  )
}

// ==================== EMPTY STATE (Edge Case of "Error") ====================

interface EmptyStateProps {
  title: string
  message: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

/**
 * Empty state display (no data found)
 * 
 * @example
 * ```tsx
 * <EmptyState
 *   title="No Submissions Yet"
 *   message="Submissions will appear here once workers start participating."
 * />
 * ```
 */
export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
        p: 4,
        textAlign: 'center'
      }}
    >
      {icon && (
        <Box sx={{ mb: 3, opacity: 0.5 }}>
          {icon}
        </Box>
      )}
      
      <Typography
        variant="h5"
        sx={{
          fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
          fontWeight: 600,
          color: 'var(--text-primary, #1A1A1E)',
          mb: 1
        }}
      >
        {title}
      </Typography>
      
      <Typography
        sx={{
          fontFamily: 'var(--font-body, Satoshi, sans-serif)',
          fontSize: '14px',
          color: 'var(--text-muted, #A3A7B5)',
          mb: 3,
          maxWidth: '400px'
        }}
      >
        {message}
      </Typography>
      
      {action}
    </Box>
  )
}

// ==================== INLINE ERROR MESSAGE ====================

/**
 * Small inline error message
 * 
 * @example
 * ```tsx
 * {error && <InlineError error={error} />}
 * ```
 */
export function InlineError({ error }: { error: string }) {
  return (
    <Typography
      sx={{
        fontFamily: 'var(--font-body, Satoshi, sans-serif)',
        fontSize: '13px',
        color: '#EF4444',
        fontWeight: 500,
        mt: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      <ErrorOutlineIcon sx={{ fontSize: 16 }} />
      {error}
    </Typography>
  )
}

// ==================== EXPORTS ====================

export default {
  ErrorAlert,
  WarningBanner,
  InfoBanner,
  ErrorPage,
  ErrorCard,
  NetworkError,
  ValidationError,
  EmptyState,
  InlineError
}

