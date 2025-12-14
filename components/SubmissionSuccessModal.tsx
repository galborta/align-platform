'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

interface SubmissionSuccessModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SubmissionSuccessModal({ isOpen, onClose }: SubmissionSuccessModalProps) {
  const router = useRouter()
  const [countdown, setCountdown] = useState(3)

  const handleClose = useCallback(() => {
    onClose()
    router.push('/')
  }, [onClose, router])

  useEffect(() => {
    if (!isOpen) {
      setCountdown(3)
      return
    }

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Cleanup
    return () => clearInterval(timer)
  }, [isOpen])

  // Separate effect to handle close when countdown reaches 0
  useEffect(() => {
    if (isOpen && countdown === 0) {
      // Use setTimeout to defer until after render completes
      const timeout = setTimeout(() => {
        handleClose()
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [isOpen, countdown, handleClose])

  useEffect(() => {
    if (!isOpen) return

    // ESC key handler
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, handleClose])

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Close only if clicking directly on overlay (not on modal content)
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <CheckCircleIcon className="success-icon" />
        
        <h2 className="modal-title">Application Submitted!</h2>
        
        <p className="modal-message">
          We'll review your application and get back to you via email within 48 hours.
        </p>
        
        <p className="countdown-text">
          Redirecting to homepage in {countdown}...
        </p>
        
        <button 
          onClick={handleClose}
          className="close-button"
        >
          Go to Homepage Now
        </button>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: var(--space-lg);
          animation: fadeIn 300ms ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .modal-content {
          background: var(--card-background);
          border-radius: var(--radius-card-lg);
          padding: var(--space-xxl);
          box-shadow: var(--shadow-floating);
          max-width: 480px;
          width: 100%;
          text-align: center;
          animation: scaleIn 300ms ease;
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .modal-content :global(.success-icon) {
          font-size: 64px;
          color: var(--accent-success);
          margin-bottom: var(--space-lg);
        }

        .modal-title {
          font-family: var(--font-heading);
          font-size: var(--text-title);
          font-weight: var(--weight-bold);
          color: var(--text-primary);
          margin: 0 0 var(--space-sm) 0;
        }

        .modal-message {
          font-family: var(--font-body);
          font-size: var(--text-body);
          color: var(--text-secondary);
          line-height: var(--line-height-normal);
          margin: 0 0 var(--space-lg) 0;
        }

        .countdown-text {
          font-family: var(--font-body);
          font-size: var(--text-body-small);
          color: var(--text-muted);
          margin: 0 0 var(--space-xl) 0;
        }

        .close-button {
          background: var(--accent-primary);
          color: white;
          border: none;
          border-radius: var(--radius-control);
          padding: var(--space-sm) var(--space-lg);
          font-family: var(--font-body);
          font-size: var(--text-label);
          font-weight: var(--weight-semibold);
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: var(--shadow-chip);
        }

        .close-button:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-floating);
        }

        .close-button:active {
          transform: translateY(0);
        }

        /* Responsive design */
        @media (max-width: 768px) {
          .modal-content {
            padding: var(--space-xl);
          }

          .modal-content :global(.success-icon) {
            font-size: 48px;
          }

          .modal-title {
            font-size: 22px;
          }
        }
      `}</style>
    </div>
  )
}
