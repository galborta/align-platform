'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Box, Typography, Button } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * FeedErrorBoundary - Error boundary component for Activity Feed
 * 
 * Catches and handles errors that occur within the Activity Feed,
 * preventing them from breaking the entire application.
 * 
 * Features:
 * - Graceful error display
 * - Error logging
 * - Page reload option
 * - Prevents app crashes
 * 
 * @example
 * ```tsx
 * <FeedErrorBoundary>
 *   <ActivityFeed projectId={id} tokenMint={mint} />
 * </FeedErrorBoundary>
 * ```
 */
export class FeedErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console (could be sent to error tracking service)
    console.error('Feed error caught by boundary:', error, errorInfo)
    console.error('Component stack:', errorInfo.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box 
          sx={{ 
            p: 4, 
            textAlign: 'center',
            bgcolor: 'background.paper',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2
          }}
        >
          <ErrorOutlineIcon 
            sx={{ 
              fontSize: 48, 
              color: 'error.main',
              mb: 1
            }} 
          />
          
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Something went wrong with the activity feed
          </Typography>
          
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mb: 2,
              maxWidth: 500,
              mx: 'auto'
            }}
          >
            {this.state.error?.message || 'An unexpected error occurred while loading the feed'}
          </Typography>
          
          <Button 
            variant="contained" 
            onClick={this.handleReset}
            sx={{
              bgcolor: 'primary.main',
              '&:hover': {
                bgcolor: 'primary.dark'
              }
            }}
          >
            Reload Page
          </Button>
        </Box>
      )
    }

    return this.props.children
  }
}






