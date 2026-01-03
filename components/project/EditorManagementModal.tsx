'use client'

import { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import { useWallet } from '@solana/wallet-adapter-react'
import { truncateAddress, validateEditorWallets, isValidSolanaAddress } from '@/lib/wallet-validation'
import { Button } from '@/components/ui/Button'
import CircularProgress from '@mui/material/CircularProgress'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import PersonIcon from '@mui/icons-material/Person'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'

interface Editor {
  wallet_address: string
  added_at: string
  added_by: string
  last_active?: string
  added_via?: 'creation' | 'invite' | 'direct'
}

interface EditorManagementModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  projectName: string
  creatorWallet: string
  currentEditors: Editor[]
  onEditorsUpdated: () => void
}

export default function EditorManagementModal({
  open,
  onClose,
  projectId,
  projectName,
  creatorWallet,
  currentEditors,
  onEditorsUpdated
}: EditorManagementModalProps) {
  const { publicKey, signMessage } = useWallet()
  const [walletInput, setWalletInput] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isAddingEditor, setIsAddingEditor] = useState(false)
  const [removingWallet, setRemovingWallet] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const isCreator = publicKey?.toBase58() === creatorWallet
  const isEditor = currentEditors.some(e => e.wallet_address === publicKey?.toBase58())
  const canAddEditors = isCreator || isEditor

  const handleAddEditor = async () => {
    if (!publicKey || !signMessage) {
      setValidationError('Please connect your wallet')
      return
    }

    const trimmedWallet = walletInput.trim()

    // Validate input
    const currentWallets = currentEditors.map(e => e.wallet_address)
    const validation = validateEditorWallets(
      [trimmedWallet],
      {
        creatorWallet,
        existingEditors: currentWallets,
        maxEditors: 20
      }
    )

    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid wallet')
      return
    }

    setIsAddingEditor(true)
    setValidationError(null)
    setSuccessMessage(null)

    try {
      // Generate signature message
      const message = `Add editor to ${projectName}\nWallet: ${trimmedWallet}\nTimestamp: ${Date.now()}`
      const messageBytes = new TextEncoder().encode(message)
      const signature = await signMessage(messageBytes)
      const signatureBase58 = Buffer.from(signature).toString('base64')

      // Call API to add editor
      const response = await fetch('/api/projects/editors/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          editor_wallet: trimmedWallet,
          wallet: publicKey.toBase58(),
          signature: signatureBase58,
          message
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add editor')
      }

      // Success
      setWalletInput('')
      setSuccessMessage(`Editor ${truncateAddress(trimmedWallet)} added successfully!`)
      onEditorsUpdated()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)

    } catch (error) {
      console.error('Error adding editor:', error)
      setValidationError(error instanceof Error ? error.message : 'Failed to add editor')
    } finally {
      setIsAddingEditor(false)
    }
  }

  const handleRemoveEditor = async (editorWallet: string) => {
    if (!publicKey || !signMessage) {
      alert('Please connect your wallet')
      return
    }

    if (!isCreator) {
      alert('Only the project creator can remove editors')
      return
    }

    // Confirm removal with custom styled confirm (for now using native confirm)
    const confirmMessage = `Remove ${truncateAddress(editorWallet)} as editor?\n\nThey will lose access to edit project information.`
    if (!confirm(confirmMessage)) {
      return
    }

    setRemovingWallet(editorWallet)
    setValidationError(null)
    setSuccessMessage(null)

    try {
      // Generate signature message
      const message = `Remove editor from ${projectName}\nWallet: ${editorWallet}\nTimestamp: ${Date.now()}`
      const messageBytes = new TextEncoder().encode(message)
      const signature = await signMessage(messageBytes)
      const signatureBase58 = Buffer.from(signature).toString('base64')

      // Call API to remove editor
      const response = await fetch('/api/projects/editors/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          editor_wallet: editorWallet,
          wallet: publicKey.toBase58(),
          signature: signatureBase58,
          message
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove editor')
      }

      // Success
      setSuccessMessage(`Editor ${truncateAddress(editorWallet)} removed successfully!`)
      onEditorsUpdated()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)

    } catch (error) {
      console.error('Error removing editor:', error)
      setValidationError(error instanceof Error ? error.message : 'Failed to remove editor')
    } finally {
      setRemovingWallet(null)
    }
  }

  const formatLastActive = (lastActive?: string) => {
    if (!lastActive) return 'Never'
    
    const date = new Date(lastActive)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString()
  }

  const formatAddedDate = (addedAt: string) => {
    return new Date(addedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getAddedViaLabel = (addedVia?: string) => {
    switch (addedVia) {
      case 'creation':
        return 'during creation'
      case 'invite':
        return 'via invite'
      case 'direct':
        return 'directly'
      default:
        return ''
    }
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        style: {
          borderRadius: 'var(--radius-card-lg)',
          backgroundColor: 'var(--card-background)',
        }
      }}
    >
      <DialogTitle
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--text-title)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-primary)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        Manage Project Editors
      </DialogTitle>

      <DialogContent dividers style={{ borderColor: 'var(--border-subtle)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          
          {/* Success Message */}
          {successMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-md)',
                backgroundColor: 'var(--accent-success-soft)',
                border: '1px solid var(--accent-success)',
                borderRadius: 'var(--radius-card-lg)',
              }}
            >
              <CheckCircleIcon style={{ fontSize: 20, color: 'var(--accent-success)' }} />
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-body-small)',
                  color: 'var(--text-primary)',
                }}
              >
                {successMessage}
              </p>
            </div>
          )}

          {/* Add New Editors Section */}
          {canAddEditors && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <h3
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-body-small)',
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                Add New Editor
              </h3>
              
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <input
                  type="text"
                  value={walletInput}
                  onChange={(e) => {
                    setWalletInput(e.target.value)
                    setValidationError(null)
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddEditor()
                    }
                  }}
                  placeholder="Paste Solana wallet address"
                  disabled={isAddingEditor}
                  style={{
                    flex: 1,
                    padding: 'var(--space-sm) var(--space-md)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-body-small)',
                    border: validationError ? '2px solid #EF4444' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-card-lg)',
                    outline: 'none',
                    backgroundColor: isAddingEditor ? 'var(--subtle-background)' : 'var(--card-background)',
                    cursor: isAddingEditor ? 'not-allowed' : 'text',
                  }}
                  onFocus={(e) => {
                    if (!validationError) {
                      e.target.style.borderColor = 'var(--accent-primary)'
                      e.target.style.boxShadow = '0 0 0 3px var(--accent-primary-soft)'
                    }
                  }}
                  onBlur={(e) => {
                    if (!validationError) {
                      e.target.style.borderColor = 'var(--border-subtle)'
                      e.target.style.boxShadow = 'none'
                    }
                  }}
                />
                
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleAddEditor}
                  disabled={isAddingEditor || !walletInput.trim()}
                  style={{ minWidth: '80px' }}
                >
                  {isAddingEditor ? (
                    <>
                      <CircularProgress size={16} style={{ color: 'white', marginRight: '4px' }} />
                      Adding...
                    </>
                  ) : (
                    'Add'
                  )}
                </Button>
              </div>

              {validationError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-xs)',
                    padding: 'var(--space-sm)',
                    backgroundColor: '#FEE2E2',
                    border: '1px solid #EF4444',
                    borderRadius: 'var(--radius-card-lg)',
                  }}
                >
                  <ErrorOutlineIcon style={{ fontSize: 16, color: '#EF4444' }} />
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-caption)',
                      color: '#991B1B',
                    }}
                  >
                    {validationError}
                  </p>
                </div>
              )}

              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-caption)',
                  color: 'var(--text-muted)',
                }}
              >
                {isCreator 
                  ? 'Any editor can add new editors, but only you can remove them.'
                  : 'You can add new editors to this project.'}
              </p>
            </div>
          )}

          {/* Divider */}
          {canAddEditors && (
            <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />
          )}

          {/* Current Editors List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <h3
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-body-small)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Current Editors ({currentEditors.length + 1})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              {/* Creator Card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-md)',
                  backgroundColor: 'var(--accent-primary-soft)',
                  border: '1px solid var(--accent-primary)',
                  borderRadius: 'var(--radius-card-lg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: 'var(--accent-primary)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AdminPanelSettingsIcon style={{ fontSize: 20, color: 'white' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                      <p
                        style={{
                          margin: 0,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-body-small)',
                          fontWeight: 'var(--weight-medium)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {truncateAddress(creatorWallet)}
                      </p>
                      {publicKey?.toBase58() === creatorWallet && (
                        <span
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 'var(--text-caption)',
                            fontWeight: 'var(--weight-medium)',
                            color: 'var(--accent-primary)',
                          }}
                        >
                          (You)
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-caption)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Creator
                    </p>
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-caption)',
                    fontWeight: 'var(--weight-medium)',
                    color: 'var(--text-muted)',
                  }}
                >
                  Cannot Remove
                </span>
              </div>

              {/* Editors */}
              {currentEditors.map((editor) => (
                <div
                  key={editor.wallet_address}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-md)',
                    backgroundColor: 'var(--card-background)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-card-lg)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)'
                    e.currentTarget.style.boxShadow = 'var(--shadow-chip)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: 'var(--accent-success-soft)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <PersonIcon style={{ fontSize: 20, color: 'var(--accent-success)' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                        <p
                          style={{
                            margin: 0,
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-body-small)',
                            fontWeight: 'var(--weight-medium)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {truncateAddress(editor.wallet_address)}
                        </p>
                        {publicKey?.toBase58() === editor.wallet_address && (
                          <span
                            style={{
                              fontFamily: 'var(--font-body)',
                              fontSize: 'var(--text-caption)',
                              fontWeight: 'var(--weight-medium)',
                              color: 'var(--accent-success)',
                            }}
                          >
                            (You)
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-caption)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Added: {formatAddedDate(editor.added_at)}
                        {editor.added_via && ` ${getAddedViaLabel(editor.added_via)}`}
                      </p>
                      {editor.last_active && (
                        <p
                          style={{
                            margin: 0,
                            fontFamily: 'var(--font-body)',
                            fontSize: 'var(--text-caption)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          Last active: {formatLastActive(editor.last_active)}
                        </p>
                      )}
                    </div>
                  </div>

                  {isCreator && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleRemoveEditor(editor.wallet_address)}
                      disabled={removingWallet === editor.wallet_address}
                    >
                      {removingWallet === editor.wallet_address ? (
                        <>
                          <CircularProgress size={12} style={{ color: 'white', marginRight: '4px' }} />
                          Removing...
                        </>
                      ) : (
                        <>
                          <DeleteOutlineIcon style={{ fontSize: 16, marginRight: '4px' }} />
                          Remove
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ))}

              {/* Empty State */}
              {currentEditors.length === 0 && (
                <div
                  style={{
                    padding: 'var(--space-xl)',
                    textAlign: 'center',
                    border: '2px dashed var(--border-subtle)',
                    borderRadius: 'var(--radius-card-lg)',
                    backgroundColor: 'var(--subtle-background)',
                  }}
                >
                  <PersonIcon
                    style={{
                      fontSize: 40,
                      color: 'var(--icon-default)',
                      marginBottom: 'var(--space-sm)',
                    }}
                  />
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-body-small)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    No additional editors yet
                  </p>
                  {canAddEditors && (
                    <p
                      style={{
                        margin: '4px 0 0 0',
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-caption)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Add editors using the form above
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      <DialogActions
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: 'var(--space-md) var(--space-lg)',
        }}
      >
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={onClose}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}


