/**
 * Loading States Component Library
 * 
 * Reusable loading components following Align Design System.
 * Provides consistent loading feedback across all social jobs features.
 * 
 * Usage:
 * - LoadingOverlay: Full-page loading with message
 * - LoadingButton: Button with loading state
 * - JobCardSkeleton: Skeleton for job cards
 * - SubmissionListSkeleton: Skeleton for submission lists
 * - PaymentProcessing: Blockchain transaction processing UI
 * - InlineSpinner: Small inline loading indicator
 */

'use client'

import React from 'react'
import { CircularProgress, Skeleton, Button, ButtonProps } from '@mui/material'

// ==================== FULL PAGE LOADING ====================

/**
 * Full-page loading overlay with backdrop
 * 
 * @example
 * ```tsx
 * {isProcessing && <LoadingOverlay message="Creating campaign..." />}
 * ```
 */
export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-2xl animate-fadeIn">
        <CircularProgress 
          size={60} 
          sx={{ color: 'var(--accent-primary)' }}
          thickness={4}
        />
        {message && (
          <p className="text-body text-text-primary font-medium animate-pulse">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

// ==================== BUTTON LOADING ====================

interface LoadingButtonProps extends ButtonProps {
  loading: boolean
  loadingText?: string
  children: React.ReactNode
}

/**
 * Button with built-in loading state
 * 
 * @example
 * ```tsx
 * <LoadingButton 
 *   loading={isSubmitting} 
 *   loadingText="Submitting..."
 *   onClick={handleSubmit}
 * >
 *   Submit
 * </LoadingButton>
 * ```
 */
export function LoadingButton({ 
  loading, 
  loadingText = 'Processing...',
  children, 
  disabled,
  ...props 
}: LoadingButtonProps) {
  return (
    <Button 
      disabled={loading || disabled} 
      {...props}
      sx={{
        position: 'relative',
        ...props.sx
      }}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <CircularProgress 
            size={20} 
            sx={{ color: 'inherit' }}
            thickness={4}
          />
          <span>{loadingText}</span>
        </span>
      ) : (
        children
      )}
    </Button>
  )
}

// ==================== CARD SKELETONS ====================

/**
 * Skeleton loader for social job cards
 * 
 * @example
 * ```tsx
 * {isLoading ? <JobCardSkeleton /> : <SocialJobCard job={job} />}
 * ```
 */
export function JobCardSkeleton() {
  return (
    <div 
      className="bg-card-bg rounded-xl p-6 shadow-sm border border-border-subtle animate-pulse"
      style={{
        borderRadius: 'var(--radius-card-lg)',
        padding: 'var(--space-lg)'
      }}
    >
      {/* Title */}
      <Skeleton 
        variant="text" 
        width="60%" 
        height={32}
        sx={{ marginBottom: 2, borderRadius: 1 }}
      />
      
      {/* Subtitle */}
      <Skeleton 
        variant="text" 
        width="40%" 
        height={24}
        sx={{ marginBottom: 3, borderRadius: 1 }}
      />
      
      {/* Content area */}
      <Skeleton 
        variant="rectangular" 
        width="100%" 
        height={160}
        sx={{ marginBottom: 2, borderRadius: 2 }}
      />
      
      {/* Footer text */}
      <div className="flex gap-4">
        <Skeleton variant="text" width="30%" height={20} sx={{ borderRadius: 1 }} />
        <Skeleton variant="text" width="25%" height={20} sx={{ borderRadius: 1 }} />
        <Skeleton variant="text" width="25%" height={20} sx={{ borderRadius: 1 }} />
      </div>
    </div>
  )
}

/**
 * Grid of job card skeletons
 * 
 * @example
 * ```tsx
 * {isLoading && <JobCardSkeletonGrid count={6} />}
 * ```
 */
export function JobCardSkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ==================== SUBMISSION SKELETONS ====================

/**
 * Skeleton loader for a single submission card
 */
export function SubmissionCardSkeleton() {
  return (
    <div 
      className="bg-card-bg rounded-xl p-6 shadow-sm border border-border-subtle animate-pulse"
      style={{
        borderRadius: 'var(--radius-card-lg)',
        padding: 'var(--space-lg)'
      }}
    >
      {/* Header with avatar and name */}
      <div className="flex items-center gap-3 mb-4">
        <Skeleton 
          variant="circular" 
          width={48} 
          height={48}
        />
        <div className="flex-1">
          <Skeleton variant="text" width="40%" height={24} sx={{ borderRadius: 1 }} />
          <Skeleton variant="text" width="30%" height={20} sx={{ borderRadius: 1 }} />
        </div>
      </div>
      
      {/* Content */}
      <Skeleton 
        variant="rectangular" 
        width="100%" 
        height={100}
        sx={{ marginBottom: 2, borderRadius: 2 }}
      />
      
      {/* Action buttons */}
      <div className="flex gap-3">
        <Skeleton variant="rectangular" width={100} height={40} sx={{ borderRadius: 999 }} />
        <Skeleton variant="rectangular" width={100} height={40} sx={{ borderRadius: 999 }} />
      </div>
    </div>
  )
}

/**
 * List of submission skeletons
 * 
 * @example
 * ```tsx
 * {isLoading ? (
 *   <SubmissionListSkeleton count={5} />
 * ) : (
 *   submissions.map(sub => <SubmissionCard key={sub.id} submission={sub} />)
 * )}
 * ```
 */
export function SubmissionListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SubmissionCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ==================== PAYMENT PROCESSING ====================

/**
 * Payment processing animation for blockchain transactions
 * Shows critical warning to not close window
 * 
 * @example
 * ```tsx
 * {isProcessingPayment && <PaymentProcessing />}
 * ```
 */
export function PaymentProcessing() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-12 shadow-2xl max-w-md text-center animate-fadeIn">
        <div className="mb-6">
          <CircularProgress 
            size={80} 
            sx={{ color: 'var(--accent-primary)' }}
            thickness={3}
          />
        </div>
        
        <h3 className="text-title font-semibold text-text-primary mb-3">
          Processing Payment...
        </h3>
        
        <p className="text-body text-text-secondary mb-4">
          Please wait while we process your transaction on the Solana blockchain.
        </p>
        
        <div className="bg-accent-warning bg-opacity-10 border border-accent-warning rounded-lg p-4">
          <p className="text-body-small font-medium text-text-primary animate-pulse">
            ⚠️ Do not close this window
          </p>
        </div>
      </div>
    </div>
  )
}

// ==================== INLINE SPINNERS ====================

/**
 * Small inline spinner for loading states
 * 
 * @example
 * ```tsx
 * <div>
 *   Loading data <InlineSpinner />
 * </div>
 * ```
 */
export function InlineSpinner({ size = 16 }: { size?: number }) {
  return (
    <CircularProgress 
      size={size} 
      sx={{ color: 'var(--accent-primary)' }}
      thickness={4}
    />
  )
}

/**
 * Text with inline spinner
 * 
 * @example
 * ```tsx
 * <LoadingText>Fetching submissions...</LoadingText>
 * ```
 */
export function LoadingText({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-text-secondary text-body">
      <InlineSpinner size={16} />
      <span>{children}</span>
    </div>
  )
}

// ==================== TABLE LOADING ====================

/**
 * Skeleton for table rows
 * 
 * @example
 * ```tsx
 * {isLoading ? (
 *   <TableRowSkeleton columns={5} rows={10} />
 * ) : (
 *   // actual table rows
 * )}
 * ```
 */
export function TableRowSkeleton({ columns = 4, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-border-subtle">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="p-4">
              <Skeleton 
                variant="text" 
                width={colIndex === 0 ? '80%' : '60%'} 
                height={20}
                sx={{ borderRadius: 1 }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ==================== DASHBOARD LOADING ====================

/**
 * Full dashboard skeleton for admin/review pages
 * 
 * @example
 * ```tsx
 * {isLoading ? <DashboardSkeleton /> : <ReviewDashboard data={data} />}
 * ```
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="bg-card-bg rounded-xl p-6 shadow-sm">
        <Skeleton variant="text" width="40%" height={40} sx={{ marginBottom: 2 }} />
        <Skeleton variant="text" width="60%" height={24} />
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card-bg rounded-xl p-6 shadow-sm">
            <Skeleton variant="text" width="50%" height={24} sx={{ marginBottom: 2 }} />
            <Skeleton variant="text" width="70%" height={48} />
          </div>
        ))}
      </div>
      
      {/* Main content */}
      <SubmissionListSkeleton count={4} />
    </div>
  )
}

// ==================== MODAL LOADING ====================

/**
 * Loading state for modal content
 * 
 * @example
 * ```tsx
 * <Modal open={open}>
 *   {isLoading ? <ModalLoadingSkeleton /> : <ModalContent />}
 * </Modal>
 * ```
 */
export function ModalLoadingSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <Skeleton variant="text" width="60%" height={32} sx={{ marginBottom: 3 }} />
      <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 2, marginBottom: 2 }} />
      <Skeleton variant="text" width="100%" height={24} />
      <Skeleton variant="text" width="80%" height={24} />
      <div className="flex gap-3 pt-4">
        <Skeleton variant="rectangular" width={120} height={44} sx={{ borderRadius: 999 }} />
        <Skeleton variant="rectangular" width={120} height={44} sx={{ borderRadius: 999 }} />
      </div>
    </div>
  )
}

// ==================== EXPORTS ====================

export default {
  LoadingOverlay,
  LoadingButton,
  JobCardSkeleton,
  JobCardSkeletonGrid,
  SubmissionCardSkeleton,
  SubmissionListSkeleton,
  PaymentProcessing,
  InlineSpinner,
  LoadingText,
  TableRowSkeleton,
  DashboardSkeleton,
  ModalLoadingSkeleton
}

