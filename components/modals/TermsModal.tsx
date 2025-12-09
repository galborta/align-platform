'use client'

import { useState, useEffect, useCallback } from 'react'
import DescriptionIcon from '@mui/icons-material/Description'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import CloseIcon from '@mui/icons-material/Close'
import InfoIcon from '@mui/icons-material/Info'
import CheckIcon from '@mui/icons-material/Check'
import Link from 'next/link'
import FocusTrap from 'focus-trap-react'

interface TermsModalProps {
  isOpen: boolean
  onClose: () => void
  onAccept: () => void
}

export function TermsModal({ isOpen, onClose, onAccept }: TermsModalProps) {
  const [hasAccepted, setHasAccepted] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Legal document links
  const legalDocs = [
    {
      id: 'terms',
      title: 'Terms of Service',
      href: '/legal/terms-of-service',
      description: 'Your obligations when using Orggly'
    },
    {
      id: 'privacy',
      title: 'Privacy Policy',
      href: '/legal/privacy-policy',
      description: 'How we collect and protect your data'
    },
    {
      id: 'risk',
      title: 'Risk Disclaimer',
      href: '/legal/risk-disclaimer',
      description: 'Important risks and limitations'
    }
  ]

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasAccepted(false)
      setIsClosing(false)
    }
  }, [isOpen])

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
    }, 150)
  }, [onClose])

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, handleClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.body.style.overflow = 'hidden'
    } else {
      const scrollY = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      document.body.style.overflow = ''
      window.scrollTo(0, parseInt(scrollY || '0') * -1)
    }
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleAccept = () => {
    if (hasAccepted) {
      onAccept()
    }
  }

  return (
    <FocusTrap
      active={isOpen && !isClosing}
      focusTrapOptions={{
        initialFocus: false,
        fallbackFocus: '[role="dialog"]',
        allowOutsideClick: true,
        escapeDeactivates: false,
        returnFocusOnDeactivate: true,
      }}
    >
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[100] overflow-y-auto transition-opacity duration-200 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={handleClose}
        role="presentation"
      >
        {/* Centering container */}
        <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
          {/* Modal Card */}
          <div
            className={`relative w-full max-h-[85vh] overflow-y-auto transition-all duration-200 my-auto ${
              isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
            }`}
            style={{
              maxWidth: '480px',
              background: 'var(--card-background)',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="terms-modal-title"
            aria-describedby="terms-modal-description"
            aria-modal="true"
          >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 sm:px-8 sm:pt-8 sm:pb-6">
            {/* Close Button */}
            <button
              onClick={handleClose}
              type="button"
              className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150"
              style={{
                color: 'var(--text-secondary)',
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--subtle-background)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
              aria-label="Close modal"
            >
              <CloseIcon sx={{ fontSize: 22 }} />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ 
                  background: 'linear-gradient(135deg, var(--accent-primary) 0%, #6B3FE8 100%)',
                }}
              >
                <DescriptionIcon sx={{ fontSize: 32, color: 'white' }} />
              </div>
            </div>

            {/* Title */}
            <h2
              id="terms-modal-title"
              className="text-center text-xl sm:text-2xl mb-2"
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Terms & Conditions
            </h2>

            {/* Description */}
            <p
              id="terms-modal-description"
              className="text-center text-sm sm:text-base"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              Please review our legal documents before continuing
            </p>
          </div>

          {/* Info Box */}
          <div className="px-6 sm:px-8 mb-4">
            <div
              className="flex gap-3 p-4 rounded-xl"
              style={{
                background: 'var(--accent-primary-soft)',
              }}
            >
              <InfoIcon 
                sx={{ 
                  fontSize: 20,
                  color: 'var(--accent-primary)', 
                  flexShrink: 0, 
                  marginTop: '2px' 
                }} 
              />
              <p
                className="text-sm"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--text-primary)',
                  lineHeight: 1.5,
                }}
              >
                These documents explain how Orggly works, your rights, and important
                legal disclaimers.
              </p>
            </div>
          </div>

          {/* Legal Documents */}
          <div className="px-6 sm:px-8 space-y-3">
            {legalDocs.map((doc) => (
              <Link
                key={doc.href}
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 rounded-xl transition-all duration-150 group"
                style={{
                  background: 'var(--subtle-background)',
                  textDecoration: 'none',
                  border: '2px solid transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)'
                  e.currentTarget.style.background = 'var(--accent-primary-soft)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.background = 'var(--subtle-background)'
                }}
              >
                <div className="flex-1 min-w-0 pr-3">
                  <h3
                    className="text-sm sm:text-base font-medium mb-0.5"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      color: 'var(--accent-primary)',
                    }}
                  >
                    {doc.title}
                  </h3>
                  <p
                    className="text-xs sm:text-sm truncate"
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {doc.description}
                  </p>
                </div>
                <OpenInNewIcon 
                  sx={{ 
                    fontSize: 20,
                    color: 'var(--accent-primary)', 
                    flexShrink: 0,
                    opacity: 0.7,
                    transition: 'opacity 0.15s',
                  }} 
                  className="group-hover:opacity-100"
                />
              </Link>
            ))}
          </div>

          {/* Acceptance Checkbox */}
          <div className="px-6 sm:px-8 mt-6">
            <label 
              htmlFor="checkbox-acceptance"
              className="flex items-center gap-4 cursor-pointer rounded-xl p-4 transition-all duration-150"
              style={{
                background: hasAccepted ? 'var(--accent-primary-soft)' : 'var(--subtle-background)',
                border: hasAccepted ? '2px solid var(--accent-primary)' : '2px solid transparent',
              }}
            >
              <div className="relative flex-shrink-0">
                <input
                  id="checkbox-acceptance"
                  type="checkbox"
                  checked={hasAccepted}
                  onChange={(e) => setHasAccepted(e.target.checked)}
                  className="sr-only peer"
                />
                <div 
                  className="w-6 h-6 rounded-md flex items-center justify-center transition-all duration-150"
                  style={{
                    background: hasAccepted ? 'var(--accent-primary)' : 'var(--card-background)',
                    border: hasAccepted ? 'none' : '2px solid var(--border-subtle)',
                  }}
                >
                  {hasAccepted && <CheckIcon sx={{ fontSize: 16, color: 'white' }} />}
                </div>
              </div>
              <span
                className="text-sm sm:text-base flex-1"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--text-primary)',
                  lineHeight: 1.5,
                }}
              >
                I have read and agree to the <strong>Terms of Service</strong>,{' '}
                <strong>Privacy Policy</strong>, and <strong>Risk Disclaimer</strong>
              </span>
            </label>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-6 sm:px-8 sm:pb-8">
            {/* Accept Button */}
            <button
              onClick={handleAccept}
              disabled={!hasAccepted}
              type="button"
              className="w-full py-4 rounded-full text-base font-medium transition-all duration-150"
              style={{
                background: hasAccepted 
                  ? 'linear-gradient(135deg, #36C170 0%, #2BA85E 100%)' 
                  : 'var(--subtle-background)',
                color: hasAccepted ? 'white' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                border: 'none',
                cursor: hasAccepted ? 'pointer' : 'not-allowed',
                boxShadow: hasAccepted ? '0 4px 14px rgba(54, 193, 112, 0.4)' : 'none',
              }}
            >
              {hasAccepted ? 'Accept & Continue' : 'Please read and accept'}
            </button>

            {/* Legal Note */}
            <p
              className="text-center mt-4 text-xs"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}
            >
              By accepting, you create a legally binding agreement with Orggly.
            </p>
          </div>
        </div>
        </div>
      </div>
    </FocusTrap>
  )
}

export default TermsModal
