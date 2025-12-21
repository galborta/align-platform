'use client'

import { useEffect, useState } from 'react'
import { getEditorSession, formatTimeRemaining, isSessionExpiringSoon } from '@/lib/editors'
import type { EditorSession } from '@/lib/editors'

interface SessionStatusBadgeProps {
  /** UUID of the project */
  projectId: string
  /** Wallet address of the editor */
  walletAddress: string
  /** Callback when session expires (for triggering re-verification) */
  onSessionExpired?: () => void
}

/**
 * Session Status Badge
 * 
 * Displays the editor's session status and time remaining until expiry.
 * Updates every minute and shows visual warnings when session is expiring soon.
 * 
 * Color coding:
 * - Green: More than 1 hour remaining (normal state)
 * - Yellow: Less than 1 hour remaining (expiring soon)
 * - Hidden: No session or already expired
 * 
 * @example
 * <SessionStatusBadge
 *   projectId="project-uuid"
 *   walletAddress="7xK9..."
 *   onSessionExpired={() => {
 *     // Prompt user to verify again
 *     setShowVerificationModal(true)
 *   }}
 * />
 */
export default function SessionStatusBadge({
  projectId,
  walletAddress,
  onSessionExpired
}: SessionStatusBadgeProps) {
  const [session, setSession] = useState<EditorSession | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [isExpiring, setIsExpiring] = useState(false)

  useEffect(() => {
    /**
     * Fetch and update session status
     * Calculates time remaining and expiring-soon status
     */
    const fetchSession = async () => {
      const sessionData = await getEditorSession(projectId, walletAddress)
      setSession(sessionData)
      
      if (sessionData) {
        const remaining = formatTimeRemaining(sessionData.expires_at)
        setTimeRemaining(remaining)
        setIsExpiring(isSessionExpiringSoon(sessionData.expires_at))
        
        // Check if session just expired
        if (remaining === 'Expired' && onSessionExpired) {
          onSessionExpired()
        }
      } else {
        // No session found
        setTimeRemaining('Expired')
      }
    }

    // Initial fetch
    fetchSession()

    // Update every minute
    const interval = setInterval(fetchSession, 60000) // 60 seconds
    
    // Cleanup interval on unmount
    return () => clearInterval(interval)
  }, [projectId, walletAddress, onSessionExpired])

  // Hide badge if no session or expired
  if (!session || timeRemaining === 'Expired') {
    return null
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-xs)',
        padding: '6px 12px',
        borderRadius: 'var(--radius-control)',
        fontSize: 'var(--text-caption)',
        fontFamily: 'var(--font-body)',
        fontWeight: 'var(--weight-medium)',
        backgroundColor: isExpiring 
          ? 'rgba(255, 200, 87, 0.15)' // Yellow warning background
          : 'var(--accent-success-soft)', // Green success background
        color: isExpiring 
          ? '#B45309' // Dark yellow text
          : '#047857', // Dark green text
        border: `1px solid ${isExpiring ? 'var(--accent-warning)' : 'var(--accent-success)'}`,
        transition: 'all 0.3s ease',
      }}
    >
      {/* Status indicator dot */}
      <div 
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: isExpiring 
            ? 'var(--accent-warning)' 
            : 'var(--accent-success)',
          flexShrink: 0,
          animation: isExpiring ? 'pulse 2s ease-in-out infinite' : 'none',
        }}
      />
      
      {/* Status text */}
      <span>
        {isExpiring ? 'Expiring soon: ' : 'Edit access: '}
        <strong style={{ fontWeight: 'var(--weight-semibold)' }}>
          {timeRemaining}
        </strong>
      </span>

      {/* Add pulse animation for expiring state */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  )
}

