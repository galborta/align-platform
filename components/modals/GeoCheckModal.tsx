'use client'

import { useState, useEffect, useCallback } from 'react'
import WarningIcon from '@mui/icons-material/Warning'
import CloseIcon from '@mui/icons-material/Close'
import CheckIcon from '@mui/icons-material/Check'
import FocusTrap from 'focus-trap-react'

interface GeoCheckModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export function GeoCheckModal({ isOpen, onClose, onConfirm }: GeoCheckModalProps) {
  const [notUSCitizen, setNotUSCitizen] = useState(false)
  const [notUSEntity, setNotUSEntity] = useState(false)
  const [is18Plus, setIs18Plus] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  
  const allChecked = notUSCitizen && notUSEntity && is18Plus

  // Reset checkboxes when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNotUSCitizen(false)
      setNotUSEntity(false)
      setIs18Plus(false)
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

  const handleConfirm = () => {
    if (allChecked) {
      onConfirm()
    }
  }

  // Checkbox item component for cleaner code
  const CheckboxItem = ({ 
    checked, 
    onChange, 
    id, 
    children 
  }: { 
    checked: boolean
    onChange: (checked: boolean) => void
    id: string
    children: React.ReactNode 
  }) => (
    <label 
      htmlFor={id}
      className="flex items-center gap-4 cursor-pointer rounded-xl p-4 transition-all duration-150"
      style={{
        background: checked ? 'var(--accent-primary-soft)' : 'var(--subtle-background)',
        border: checked ? '2px solid var(--accent-primary)' : '2px solid transparent',
      }}
    >
      <div className="relative flex-shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div 
          className="w-6 h-6 rounded-md flex items-center justify-center transition-all duration-150"
          style={{
            background: checked ? 'var(--accent-primary)' : 'var(--card-background)',
            border: checked ? 'none' : '2px solid var(--border-subtle)',
          }}
        >
          {checked && <CheckIcon sx={{ fontSize: 16, color: 'white' }} />}
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
        {children}
      </span>
    </label>
  )

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
            className={`relative w-full transition-all duration-200 my-auto ${
              isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
            }`}
            style={{
              maxWidth: '440px',
              background: 'var(--card-background)',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="geo-check-title"
            aria-describedby="geo-check-description"
            aria-modal="true"
          >
          {/* Header with close button */}
          <div className="relative px-6 pt-6 pb-4 sm:px-8 sm:pt-8 sm:pb-6">
            {/* Close Button */}
            <button
              onClick={handleClose}
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
              type="button"
            >
              <CloseIcon sx={{ fontSize: 22 }} />
            </button>

            {/* Warning Icon */}
            <div className="flex justify-center mb-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ 
                  background: 'linear-gradient(135deg, #FFC857 0%, #FFB020 100%)',
                }}
              >
                <WarningIcon sx={{ fontSize: 32, color: '#1A1A1E' }} />
              </div>
            </div>

            {/* Title */}
            <h2
              id="geo-check-title"
              className="text-center text-xl sm:text-2xl mb-2"
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Geographic Restrictions
            </h2>

            {/* Description */}
            <p
              id="geo-check-description"
              className="text-center text-sm sm:text-base"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              Due to regulatory requirements, please confirm the following:
            </p>
          </div>

          {/* Checkboxes */}
          <div className="px-6 sm:px-8 space-y-3">
            <CheckboxItem
              id="checkbox-us-citizen"
              checked={notUSCitizen}
              onChange={setNotUSCitizen}
            >
              I am <strong>not</strong> a US citizen or resident
            </CheckboxItem>

            <CheckboxItem
              id="checkbox-us-entity"
              checked={notUSEntity}
              onChange={setNotUSEntity}
            >
              I am <strong>not</strong> a US entity or corporation
            </CheckboxItem>

            <CheckboxItem
              id="checkbox-age"
              checked={is18Plus}
              onChange={setIs18Plus}
            >
              I am <strong>18 years of age or older</strong>
            </CheckboxItem>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-6 sm:px-8 sm:pb-8">
            {/* Confirm Button */}
            <button
              onClick={handleConfirm}
              disabled={!allChecked}
              type="button"
              className="w-full py-4 rounded-full text-base font-medium transition-all duration-150"
              style={{
                background: allChecked 
                  ? 'linear-gradient(135deg, #36C170 0%, #2BA85E 100%)' 
                  : 'var(--subtle-background)',
                color: allChecked ? 'white' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                border: 'none',
                cursor: allChecked ? 'pointer' : 'not-allowed',
                boxShadow: allChecked ? '0 4px 14px rgba(54, 193, 112, 0.4)' : 'none',
              }}
            >
              {allChecked ? 'Confirm & Continue' : 'Please check all boxes'}
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
              By confirming, you acknowledge that providing false information 
              may result in account termination.
            </p>
          </div>
        </div>
        </div>
      </div>
    </FocusTrap>
  )
}

export default GeoCheckModal
