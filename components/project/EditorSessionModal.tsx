'use client'

import { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress } from '@mui/material'
import { useWallet } from '@solana/wallet-adapter-react'
import { createEditorSession } from '@/lib/editors'
import InfoIcon from '@mui/icons-material/InfoOutlined'
import ErrorIcon from '@mui/icons-material/ErrorOutline'
import VerifiedIcon from '@mui/icons-material/VerifiedUserOutlined'

interface EditorSessionModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** UUID of the project */
  projectId: string
  /** Display name of the project */
  projectName: string
  /** Callback after successful session creation */
  onSessionCreated: () => void
}

/**
 * Editor Session Verification Modal
 * 
 * Prompts editors to sign a message to verify their access and create a 24-hour session.
 * This reduces signature friction by only requiring verification once per day.
 * 
 * @example
 * <EditorSessionModal
 *   open={showModal}
 *   onClose={() => setShowModal(false)}
 *   projectId="project-uuid"
 *   projectName="My Project"
 *   onSessionCreated={() => {
 *     toast.success('Access verified!')
 *     // Proceed with edit action
 *   }}
 * />
 */
export default function EditorSessionModal({
  open,
  onClose,
  projectId,
  projectName,
  onSessionCreated
}: EditorSessionModalProps) {
  const { publicKey, signMessage } = useWallet()
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Handle verification flow:
   * 1. Generate verification message
   * 2. Sign message with wallet
   * 3. Create session in database
   * 4. Call success callback
   */
  const handleVerify = async () => {
    if (!publicKey || !signMessage) {
      setError('Please connect your wallet')
      return
    }

    setIsVerifying(true)
    setError(null)

    try {
      // Generate verification message
      const message = [
        'Verify Editor Access',
        '',
        `Project: ${projectName}`,
        `Wallet: ${publicKey.toBase58()}`,
        `Timestamp: ${Date.now()}`,
        '',
        'This verification will grant you edit access for 24 hours.'
      ].join('\n')

      // Sign message with wallet
      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = await signMessage(messageBytes)
      
      // Convert signature to base58 for storage
      const signatureBase58 = Buffer.from(signatureBytes).toString('base64')

      // Create session in database
      const result = await createEditorSession(
        projectId,
        publicKey.toBase58(),
        signatureBase58,
        message
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to verify access')
      }

      // Success - call callback and close modal
      onSessionCreated()
      onClose()

    } catch (error) {
      console.error('[Editor Session Modal] Error verifying session:', error)
      
      // Handle user rejection
      if (error instanceof Error && error.message.includes('User rejected')) {
        setError('Signature was rejected. Please try again.')
      } else {
        setError(
          error instanceof Error 
            ? error.message 
            : 'Failed to verify access. Please try again.'
        )
      }
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <Dialog 
      open={open} 
      onClose={isVerifying ? undefined : onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        style: {
          borderRadius: 'var(--radius-card-lg)',
          padding: 'var(--space-md)',
        }
      }}
    >
      <DialogTitle
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--text-title)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-primary)',
          padding: 'var(--space-lg)',
          paddingBottom: 'var(--space-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
        }}
      >
        <VerifiedIcon 
          style={{ 
            fontSize: 28, 
            color: 'var(--accent-primary)' 
          }} 
        />
        Verify Editor Access
      </DialogTitle>

      <DialogContent 
        dividers
        style={{
          borderColor: 'var(--border-subtle)',
          padding: 'var(--space-lg)',
        }}
      >
        <div 
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-lg)',
          }}
        >
          {/* Main explanation */}
          <p 
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-body-small)',
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            To edit <span 
              style={{ 
                fontWeight: 'var(--weight-semibold)', 
                color: 'var(--text-primary)' 
              }}
            >
              {projectName}
            </span>, please verify your access by signing a message with your wallet.
          </p>

          {/* Info box - Why verification is needed */}
          <div 
            style={{
              padding: 'var(--space-md)',
              backgroundColor: 'var(--accent-primary-soft)',
              border: `1px solid var(--accent-primary)`,
              borderRadius: 'var(--radius-card-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
              <div 
                style={{
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  backgroundColor: 'var(--accent-primary)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <InfoIcon style={{ fontSize: 16, color: '#FFFFFF' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p 
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-body-small)',
                    fontWeight: 'var(--weight-medium)',
                    color: 'var(--text-primary)',
                    margin: 0,
                    marginBottom: 'var(--space-xxs)',
                  }}
                >
                  Why do I need to verify?
                </p>
                <p 
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-caption)',
                    lineHeight: 1.5,
                    color: 'var(--text-secondary)',
                    margin: 0,
                  }}
                >
                  This signature proves you control the editor wallet. Once verified, 
                  you'll have edit access for <strong>24 hours</strong> without needing 
                  to sign again. This reduces interruptions while keeping the project secure.
                </p>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div 
              style={{
                padding: 'var(--space-md)',
                backgroundColor: '#FEE2E2',
                border: '1px solid #EF4444',
                borderRadius: 'var(--radius-card-lg)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
                <ErrorIcon style={{ fontSize: 20, color: '#EF4444', flexShrink: 0 }} />
                <p 
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-body-small)',
                    color: '#991B1B',
                    margin: 0,
                    flex: 1,
                  }}
                >
                  {error}
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      <DialogActions
        style={{
          padding: 'var(--space-lg)',
          gap: 'var(--space-sm)',
        }}
      >
        <button
          onClick={onClose}
          disabled={isVerifying}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-label)',
            fontWeight: 'var(--weight-medium)',
            padding: '10px 20px',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--card-background)',
            borderRadius: 'var(--radius-control)',
            cursor: isVerifying ? 'not-allowed' : 'pointer',
            opacity: isVerifying ? 0.5 : 1,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isVerifying) {
              e.currentTarget.style.backgroundColor = 'var(--subtle-background)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--card-background)'
          }}
        >
          Cancel
        </button>
        
        <button
          onClick={handleVerify}
          disabled={isVerifying || !publicKey}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-label)',
            fontWeight: 'var(--weight-medium)',
            padding: '10px 24px',
            border: 'none',
            color: '#FFFFFF',
            backgroundColor: isVerifying ? 'var(--text-muted)' : 'var(--accent-primary)',
            borderRadius: 'var(--radius-control)',
            cursor: isVerifying || !publicKey ? 'not-allowed' : 'pointer',
            opacity: !publicKey ? 0.5 : 1,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-xs)',
          }}
          onMouseEnter={(e) => {
            if (!isVerifying && publicKey) {
              e.currentTarget.style.backgroundColor = '#6B3FE6'
            }
          }}
          onMouseLeave={(e) => {
            if (!isVerifying) {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)'
            }
          }}
        >
          {isVerifying && (
            <CircularProgress size={16} style={{ color: '#FFFFFF' }} />
          )}
          {isVerifying ? 'Verifying...' : 'Sign to Verify'}
        </button>
      </DialogActions>
    </Dialog>
  )
}

