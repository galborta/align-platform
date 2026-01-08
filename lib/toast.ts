/**
 * Toast Notification Helpers
 * 
 * Centralized toast notification functions using react-hot-toast.
 * Provides consistent styling and behavior across the application.
 * 
 * Usage:
 * ```typescript
 * import { showSuccessToast, showErrorToast } from '@/lib/toast'
 * 
 * showSuccessToast('Campaign created successfully!')
 * showErrorToast('Failed to load submissions')
 * ```
 */

import toast from 'react-hot-toast'

// ==================== SUCCESS TOASTS ====================

/**
 * Show success toast notification
 * 
 * @example
 * ```typescript
 * showSuccessToast('Payment sent successfully!')
 * ```
 */
export const showSuccessToast = (message: string, duration: number = 4000) => {
  return toast.success(message, {
    duration,
    position: 'top-right',
    style: {
      background: 'var(--accent-success, #36C170)',
      color: '#FFFFFF',
      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
      fontSize: '14px',
      fontWeight: 500,
      borderRadius: '12px',
      padding: '16px 20px',
      boxShadow: '0 8px 24px rgba(54, 193, 112, 0.2)',
    },
    iconTheme: {
      primary: '#FFFFFF',
      secondary: 'var(--accent-success, #36C170)',
    },
  })
}

// ==================== ERROR TOASTS ====================

/**
 * Show error toast notification
 * 
 * @example
 * ```typescript
 * showErrorToast('Failed to approve submission')
 * ```
 */
export const showErrorToast = (message: string, duration: number = 5000) => {
  return toast.error(message, {
    duration,
    position: 'top-right',
    style: {
      background: '#EF4444',
      color: '#FFFFFF',
      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
      fontSize: '14px',
      fontWeight: 500,
      borderRadius: '12px',
      padding: '16px 20px',
      boxShadow: '0 8px 24px rgba(239, 68, 68, 0.2)',
    },
    iconTheme: {
      primary: '#FFFFFF',
      secondary: '#EF4444',
    },
  })
}

// ==================== WARNING TOASTS ====================

/**
 * Show warning toast notification
 * 
 * @example
 * ```typescript
 * showWarningToast('Campaign ends in 2 hours!')
 * ```
 */
export const showWarningToast = (message: string, duration: number = 4000) => {
  return toast(message, {
    duration,
    position: 'top-right',
    icon: '⚠️',
    style: {
      background: 'var(--accent-warning, #FFC857)',
      color: '#1A1A1E',
      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
      fontSize: '14px',
      fontWeight: 600,
      borderRadius: '12px',
      padding: '16px 20px',
      boxShadow: '0 8px 24px rgba(255, 200, 87, 0.2)',
    },
  })
}

// ==================== INFO TOASTS ====================

/**
 * Show info toast notification
 * 
 * @example
 * ```typescript
 * showInfoToast('New submission received')
 * ```
 */
export const showInfoToast = (message: string, duration: number = 3000) => {
  return toast(message, {
    duration,
    position: 'top-right',
    icon: 'ℹ️',
    style: {
      background: 'var(--accent-primary, #7C4DFF)',
      color: '#FFFFFF',
      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
      fontSize: '14px',
      fontWeight: 500,
      borderRadius: '12px',
      padding: '16px 20px',
      boxShadow: '0 8px 24px rgba(124, 77, 255, 0.2)',
    },
  })
}

// ==================== LOADING TOASTS ====================

/**
 * Show loading toast notification
 * Returns toast ID for later dismissal
 * 
 * @example
 * ```typescript
 * const toastId = showLoadingToast('Processing payment...')
 * // ... do work ...
 * dismissToast(toastId)
 * showSuccessToast('Payment complete!')
 * ```
 */
export const showLoadingToast = (message: string) => {
  return toast.loading(message, {
    position: 'top-right',
    style: {
      background: '#FFFFFF',
      color: 'var(--text-primary, #1A1A1E)',
      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
      fontSize: '14px',
      fontWeight: 500,
      borderRadius: '12px',
      padding: '16px 20px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
    },
  })
}

// ==================== CUSTOM TOASTS ====================

/**
 * Show custom toast with icon
 * 
 * @example
 * ```typescript
 * showCustomToast('🎉', 'Campaign created!', { duration: 4000 })
 * ```
 */
export const showCustomToast = (
  icon: string,
  message: string,
  options?: {
    duration?: number
    backgroundColor?: string
    textColor?: string
  }
) => {
  return toast(message, {
    duration: options?.duration || 4000,
    position: 'top-right',
    icon,
    style: {
      background: options?.backgroundColor || '#FFFFFF',
      color: options?.textColor || 'var(--text-primary, #1A1A1E)',
      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
      fontSize: '14px',
      fontWeight: 500,
      borderRadius: '12px',
      padding: '16px 20px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
    },
  })
}

// ==================== PROMISE TOASTS ====================

/**
 * Show toast that tracks a promise
 * Automatically shows loading, success, or error based on promise resolution
 * 
 * @example
 * ```typescript
 * await showPromiseToast(
 *   createCampaign(data),
 *   {
 *     loading: 'Creating campaign...',
 *     success: 'Campaign created!',
 *     error: 'Failed to create campaign'
 *   }
 * )
 * ```
 */
export const showPromiseToast = <T,>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((error: any) => string)
  }
) => {
  return toast.promise(
    promise,
    messages,
    {
      style: {
        fontFamily: 'var(--font-body, Satoshi, sans-serif)',
        fontSize: '14px',
        fontWeight: 500,
        borderRadius: '12px',
        padding: '16px 20px',
      },
      success: {
        style: {
          background: 'var(--accent-success, #36C170)',
          color: '#FFFFFF',
        },
        iconTheme: {
          primary: '#FFFFFF',
          secondary: 'var(--accent-success, #36C170)',
        },
      },
      error: {
        style: {
          background: '#EF4444',
          color: '#FFFFFF',
        },
        iconTheme: {
          primary: '#FFFFFF',
          secondary: '#EF4444',
        },
      },
    }
  )
}

// ==================== TOAST MANAGEMENT ====================

/**
 * Dismiss a specific toast by ID
 * 
 * @example
 * ```typescript
 * const toastId = showLoadingToast('Loading...')
 * dismissToast(toastId)
 * ```
 */
export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId)
}

/**
 * Dismiss all active toasts
 * 
 * @example
 * ```typescript
 * dismissAllToasts()
 * ```
 */
export const dismissAllToasts = () => {
  toast.dismiss()
}

/**
 * Remove a toast (with animation)
 * 
 * @example
 * ```typescript
 * removeToast(toastId)
 * ```
 */
export const removeToast = (toastId: string) => {
  toast.remove(toastId)
}

// ==================== SPECIALIZED TOASTS ====================

/**
 * Show campaign-specific success toast
 */
export const showCampaignSuccessToast = (message: string) => {
  return showCustomToast('🚀', message, {
    backgroundColor: 'var(--accent-success, #36C170)',
    textColor: '#FFFFFF',
    duration: 5000
  })
}

/**
 * Show payment success toast
 */
export const showPaymentSuccessToast = (amount: string) => {
  return showCustomToast('💰', `Payment sent: ${amount}`, {
    backgroundColor: 'var(--accent-success, #36C170)',
    textColor: '#FFFFFF',
    duration: 5000
  })
}

/**
 * Show submission received toast
 */
export const showSubmissionReceivedToast = () => {
  return showCustomToast('📱', 'New submission received!', {
    backgroundColor: 'var(--accent-primary, #7C4DFF)',
    textColor: '#FFFFFF',
    duration: 3000
  })
}

// ==================== EXPORTS ====================

export default {
  showSuccessToast,
  showErrorToast,
  showWarningToast,
  showInfoToast,
  showLoadingToast,
  showCustomToast,
  showPromiseToast,
  dismissToast,
  dismissAllToasts,
  removeToast,
  showCampaignSuccessToast,
  showPaymentSuccessToast,
  showSubmissionReceivedToast
}

