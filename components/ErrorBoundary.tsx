/**
 * Error Boundary Component
 * 
 * Catches React errors and displays a fallback UI.
 * Prevents entire app from crashing due to component errors.
 * Integrates with error tracking services (Sentry).
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <ReviewDashboard jobId={jobId} />
 * </ErrorBoundary>
 * ```
 */

'use client'

import React, { ErrorInfo, ReactNode } from 'react'
import { ErrorPage } from './ui/ErrorDisplay'
import { showErrorToast } from '@/lib/toast'

// ==================== TYPES ====================

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showToast?: boolean
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

// ==================== ERROR BOUNDARY ====================

/**
 * Error Boundary component that catches errors in child components
 * 
 * @example
 * ```tsx
 * <ErrorBoundary 
 *   onError={(error) => console.error(error)}
 *   showToast
 * >
 *   <SocialJobCard job={job} />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  /**
   * Update state when an error is caught
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    }
  }

  /**
   * Log error details and send to tracking service
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Error info:', errorInfo)

    // Store error info in state
    this.setState({ errorInfo })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Show toast notification if enabled
    if (this.props.showToast) {
      showErrorToast('Something went wrong. Please refresh the page.')
    }

    // Send to error tracking service (Sentry)
    if (typeof window !== 'undefined') {
      // Check if Sentry is available
      if ((window as any).Sentry) {
        (window as any).Sentry.captureException(error, {
          extra: {
            errorInfo,
            componentStack: errorInfo.componentStack
          }
        })
      }

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.group('🔴 Error Boundary Caught Error')
        console.error('Error:', error)
        console.error('Error Info:', errorInfo)
        console.error('Component Stack:', errorInfo.componentStack)
        console.groupEnd()
      }
    }
  }

  /**
   * Reset error boundary state
   */
  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  /**
   * Reload the page
   */
  reloadPage = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error page
      return (
        <ErrorPage
          title="Something Went Wrong"
          message={
            this.state.error?.message ||
            "We're sorry, but something unexpected happened. Our team has been notified and is working on a fix."
          }
          onBack={this.resetError}
          onRetry={this.reloadPage}
        />
      )
    }

    return this.props.children
  }
}

// ==================== FUNCTIONAL ERROR BOUNDARY WRAPPER ====================

/**
 * Functional wrapper for ErrorBoundary with common presets
 * 
 * @example
 * ```tsx
 * <ComponentErrorBoundary componentName="ReviewDashboard">
 *   <ReviewDashboard jobId={jobId} />
 * </ComponentErrorBoundary>
 * ```
 */
export function ComponentErrorBoundary({
  children,
  componentName
}: {
  children: ReactNode
  componentName: string
}) {
  return (
    <ErrorBoundary
      onError={(error) => {
        console.error(`[${componentName}] Error:`, error)
      }}
      fallback={
        <ErrorPage
          title={`${componentName} Error`}
          message="This component encountered an error. Please try refreshing the page."
          onRetry={() => window.location.reload()}
        />
      }
    >
      {children}
    </ErrorBoundary>
  )
}

// ==================== PAGE ERROR BOUNDARY ====================

/**
 * Error boundary specifically for page-level errors
 * 
 * @example
 * ```tsx
 * <PageErrorBoundary>
 *   <JobDetailPage />
 * </PageErrorBoundary>
 * ```
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      showToast
      onError={(error, errorInfo) => {
        // Log page-level errors
        console.error('[PageError]:', {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack
        })
      }}
    >
      {children}
    </ErrorBoundary>
  )
}

// ==================== MODAL ERROR BOUNDARY ====================

/**
 * Error boundary for modals with simpler fallback
 * 
 * @example
 * ```tsx
 * <ModalErrorBoundary>
 *   <SubmissionModal />
 * </ModalErrorBoundary>
 * ```
 */
export function ModalErrorBoundary({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-8 text-center">
          <p className="text-body text-text-primary mb-4">
            This modal encountered an error.
          </p>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-accent-primary text-white rounded-full"
            >
              Close
            </button>
          )}
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

// ==================== EXPORTS ====================

export default ErrorBoundary
