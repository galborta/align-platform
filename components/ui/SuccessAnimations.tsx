/**
 * Success Animations Component Library
 * 
 * Celebratory animations and feedback for successful actions.
 * Follows Align Design System with green success colors and smooth animations.
 * 
 * Usage:
 * - SuccessCheckmark: Animated checkmark icon
 * - SuccessModal: Full success feedback modal
 * - SuccessToast: Inline success notification
 * - ConfettiSuccess: Celebration with confetti (optional)
 */

'use client'

import React, { useEffect, useState } from 'react'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CheckIcon from '@mui/icons-material/Check'
import CelebrationIcon from '@mui/icons-material/Celebration'

// ==================== CHECKMARK ANIMATIONS ====================

interface SuccessCheckmarkProps {
  size?: number
  delay?: number
}

/**
 * Animated success checkmark with pop effect
 * 
 * @example
 * ```tsx
 * <SuccessCheckmark size={80} />
 * ```
 */
export function SuccessCheckmark({ size = 80, delay = 0 }: SuccessCheckmarkProps) {
  const [show, setShow] = useState(delay > 0 ? false : true)

  useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => setShow(true), delay)
      return () => clearTimeout(timer)
    }
  }, [delay])

  if (!show) return null

  return (
    <div className="flex items-center justify-center">
      <CheckCircleIcon 
        sx={{ 
          fontSize: size, 
          color: 'var(--accent-success)',
          animation: 'checkmarkPop 0.5s ease-out',
          filter: 'drop-shadow(0 4px 12px rgba(54, 193, 112, 0.3))'
        }} 
      />
    </div>
  )
}

/**
 * Small inline success checkmark
 * 
 * @example
 * ```tsx
 * <SmallCheckmark />
 * ```
 */
export function SmallCheckmark({ size = 24 }: { size?: number }) {
  return (
    <div className="inline-flex items-center justify-center">
      <div 
        className="rounded-full bg-accent-success flex items-center justify-center"
        style={{
          width: size,
          height: size,
          animation: 'checkmarkPop 0.4s ease-out'
        }}
      >
        <CheckIcon 
          sx={{ 
            fontSize: size * 0.6, 
            color: 'white'
          }} 
        />
      </div>
    </div>
  )
}

// ==================== SUCCESS MODAL ====================

interface SuccessModalProps {
  title: string
  message: string
  onClose?: () => void
  actions?: React.ReactNode
  autoClose?: number // milliseconds
}

/**
 * Full-screen success modal with checkmark and message
 * 
 * @example
 * ```tsx
 * <SuccessModal 
 *   title="Campaign Created!"
 *   message="Your social media campaign is now live."
 *   onClose={() => router.push('/jobs')}
 *   autoClose={3000}
 * />
 * ```
 */
export function SuccessModal({ 
  title, 
  message, 
  onClose,
  actions,
  autoClose 
}: SuccessModalProps) {
  useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, autoClose)
      return () => clearTimeout(timer)
    }
  }, [autoClose, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div 
        className="bg-white rounded-3xl p-12 shadow-2xl max-w-md text-center"
        style={{ animation: 'fadeInScale 0.4s ease-out' }}
      >
        <SuccessCheckmark size={80} />
        
        <h2 
          className="text-title font-semibold text-text-primary mt-6 mb-3"
          style={{ animation: 'fadeIn 0.5s ease-out 0.2s both' }}
        >
          {title}
        </h2>
        
        <p 
          className="text-body text-text-secondary mb-6"
          style={{ animation: 'fadeIn 0.5s ease-out 0.3s both' }}
        >
          {message}
        </p>
        
        {actions && (
          <div 
            className="flex gap-3 justify-center"
            style={{ animation: 'fadeIn 0.5s ease-out 0.4s both' }}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== SUCCESS BANNER ====================

interface SuccessBannerProps {
  message: string
  onClose?: () => void
  autoClose?: number
}

/**
 * Success banner that slides in from top
 * 
 * @example
 * ```tsx
 * {showSuccess && (
 *   <SuccessBanner 
 *     message="Submission approved successfully!"
 *     onClose={() => setShowSuccess(false)}
 *     autoClose={5000}
 *   />
 * )}
 * ```
 */
export function SuccessBanner({ message, onClose, autoClose = 5000 }: SuccessBannerProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(() => {
          onClose?.()
        }, 300)
      }, autoClose)
      return () => clearTimeout(timer)
    }
  }, [autoClose, onClose])

  return (
    <div 
      className={`fixed top-4 right-4 z-50 bg-accent-success-soft border-2 border-accent-success rounded-xl p-4 shadow-lg flex items-center gap-3 max-w-md transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
      }`}
      style={{
        animation: isVisible ? 'slideInFromTop 0.4s ease-out' : 'none'
      }}
    >
      <SmallCheckmark size={28} />
      <p className="text-body font-medium text-text-primary flex-1">
        {message}
      </p>
      {onClose && (
        <button
          onClick={() => {
            setIsVisible(false)
            setTimeout(onClose, 300)
          }}
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ==================== INLINE SUCCESS ====================

interface InlineSuccessProps {
  message: string
  icon?: boolean
}

/**
 * Inline success message with checkmark
 * 
 * @example
 * ```tsx
 * {isSuccess && <InlineSuccess message="Saved successfully!" />}
 * ```
 */
export function InlineSuccess({ message, icon = true }: InlineSuccessProps) {
  return (
    <div 
      className="flex items-center gap-2 text-accent-success text-body font-medium"
      style={{ animation: 'fadeIn 0.3s ease-out' }}
    >
      {icon && <SmallCheckmark size={20} />}
      <span>{message}</span>
    </div>
  )
}

// ==================== CONFETTI SUCCESS ====================

/**
 * Success message with celebration icon (lightweight confetti alternative)
 * 
 * @example
 * ```tsx
 * <ConfettiSuccess 
 *   title="Payment Sent!"
 *   message="All workers have been paid."
 * />
 * ```
 */
export function ConfettiSuccess({ 
  title, 
  message 
}: { 
  title: string
  message: string 
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div 
        className="bg-white rounded-3xl p-12 shadow-2xl max-w-md text-center"
        style={{ animation: 'fadeInScale 0.4s ease-out' }}
      >
        {/* Celebration icon with pulse */}
        <div className="mb-4" style={{ animation: 'pulse 1s ease-in-out infinite' }}>
          <CelebrationIcon 
            sx={{ 
              fontSize: 80, 
              color: '#F59E0B',
              filter: 'drop-shadow(0 4px 12px rgba(245, 158, 11, 0.3))'
            }} 
          />
        </div>
        
        <SuccessCheckmark size={60} delay={200} />
        
        <h2 
          className="text-title font-semibold text-text-primary mt-6 mb-3"
          style={{ animation: 'fadeIn 0.5s ease-out 0.3s both' }}
        >
          {title}
        </h2>
        
        <p 
          className="text-body text-text-secondary"
          style={{ animation: 'fadeIn 0.5s ease-out 0.4s both' }}
        >
          {message}
        </p>
      </div>
    </div>
  )
}

// ==================== PROGRESS SUCCESS ====================

/**
 * Success state with progress indicator
 * Shows completion percentage before final success
 * 
 * @example
 * ```tsx
 * <ProgressSuccess 
 *   completed={8}
 *   total={10}
 *   message="Processing payments"
 * />
 * ```
 */
export function ProgressSuccess({ 
  completed, 
  total, 
  message 
}: { 
  completed: number
  total: number
  message: string 
}) {
  const percentage = Math.round((completed / total) * 100)
  const isComplete = completed >= total

  return (
    <div className="flex items-center gap-4 bg-accent-success-soft border border-accent-success rounded-xl p-4">
      {isComplete ? (
        <SmallCheckmark size={32} />
      ) : (
        <div className="text-accent-success font-bold text-xl min-w-[3rem] text-center">
          {percentage}%
        </div>
      )}
      <div className="flex-1">
        <p className="text-body font-medium text-text-primary">
          {isComplete ? 'Completed!' : message}
        </p>
        <p className="text-body-small text-text-secondary">
          {completed} of {total} {isComplete ? 'completed' : 'in progress'}
        </p>
      </div>
    </div>
  )
}

// ==================== COUNTDOWN SUCCESS ====================

/**
 * Success message with countdown timer
 * Useful for auto-redirects after success
 * 
 * @example
 * ```tsx
 * <CountdownSuccess 
 *   message="Campaign created!"
 *   seconds={3}
 *   onComplete={() => router.push('/jobs')}
 * />
 * ```
 */
export function CountdownSuccess({ 
  message, 
  seconds, 
  onComplete 
}: { 
  message: string
  seconds: number
  onComplete: () => void 
}) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    if (remaining <= 0) {
      onComplete()
      return
    }

    const timer = setTimeout(() => {
      setRemaining(remaining - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [remaining, onComplete])

  return (
    <div className="flex items-center gap-3 bg-accent-success-soft border border-accent-success rounded-xl p-4">
      <SmallCheckmark size={28} />
      <p className="text-body font-medium text-text-primary flex-1">
        {message}
      </p>
      <div className="text-body-small text-text-secondary">
        Redirecting in {remaining}s
      </div>
    </div>
  )
}

// ==================== EXPORTS ====================

export default {
  SuccessCheckmark,
  SmallCheckmark,
  SuccessModal,
  SuccessBanner,
  InlineSuccess,
  ConfettiSuccess,
  ProgressSuccess,
  CountdownSuccess
}

