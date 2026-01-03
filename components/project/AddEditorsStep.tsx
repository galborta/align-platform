'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Button } from '@/components/ui/Button'
import { isValidSolanaAddress, truncateAddress } from '@/lib/wallet-validation'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import PersonIcon from '@mui/icons-material/Person'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'

interface AddEditorsStepProps {
  editorWallets: string[]
  projectWallets?: Array<{ id: string; address: string; label: string; type: string }>
  onEditorsChange: (wallets: string[]) => void
  onNext: () => void
  onBack: () => void
}

export default function AddEditorsStep({
  editorWallets,
  projectWallets = [],
  onEditorsChange,
  onNext,
  onBack
}: AddEditorsStepProps) {
  const { publicKey } = useWallet()
  const [walletInput, setWalletInput] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const validateWallet = (address: string): { valid: boolean; error?: string } => {
    // Trim whitespace
    const trimmed = address.trim()
    
    if (!trimmed) {
      return { valid: false, error: 'Wallet address cannot be empty' }
    }

    // Check if it's the creator's own wallet
    if (publicKey && trimmed === publicKey.toBase58()) {
      return { valid: false, error: 'Cannot add yourself as editor (you are the creator)' }
    }

    // Check for duplicates
    if (editorWallets.includes(trimmed)) {
      return { valid: false, error: 'This wallet is already added' }
    }

    // Validate Solana address format using utility
    if (!isValidSolanaAddress(trimmed)) {
      return { valid: false, error: 'Invalid Solana wallet address format' }
    }

    return { valid: true }
  }

  const handleQuickAddWallet = (address: string) => {
    const validation = validateWallet(address)
    
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid wallet address')
      return
    }

    onEditorsChange([...editorWallets, address])
    setValidationError(null)
  }

  const handleAddEditor = () => {
    const validation = validateWallet(walletInput)
    
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid wallet address')
      return
    }

    // Add wallet to list
    onEditorsChange([...editorWallets, walletInput.trim()])
    
    // Clear input and error
    setWalletInput('')
    setValidationError(null)
  }

  const handleRemoveEditor = (wallet: string) => {
    onEditorsChange(editorWallets.filter(w => w !== wallet))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddEditor()
    }
  }

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--text-title)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-xs)',
          }}
        >
          Add Project Editors
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-body-small)',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
          }}
        >
          Project editors can modify your project information and manage community social asset submissions.
          You can add more editors later.
        </p>
      </div>

      {/* Add Editor Input */}
      <div className="space-y-3">
        <label
          htmlFor="editor-wallet"
          style={{
            display: 'block',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-body-small)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--text-primary)',
          }}
        >
          Add Editor Wallets
        </label>
        
        <div className="flex gap-3">
          <input
            id="editor-wallet"
            type="text"
            value={walletInput}
            onChange={(e) => {
              setWalletInput(e.target.value)
              setValidationError(null) // Clear error on type
            }}
            onKeyPress={handleKeyPress}
            placeholder="Paste Solana wallet address"
            style={{
              flex: 1,
              padding: 'var(--space-sm) var(--space-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-body-small)',
              border: validationError ? '2px solid #EF4444' : '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-card-lg)',
              outline: 'none',
              transition: 'all 0.2s ease',
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
            style={{ minWidth: '80px' }}
          >
            Add
          </Button>
        </div>

        {/* Validation Error */}
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

        {/* Hint Text */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-caption)',
            color: 'var(--text-muted)',
            margin: 0,
          }}
        >
          Enter one wallet address at a time and click "Add" or press Enter
        </p>
      </div>

      {/* Quick Pick from Project Wallets */}
      {projectWallets.length > 0 && (
        <div className="space-y-3">
          <h3
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-body-small)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--text-primary)',
            }}
          >
            Quick Add from Project Wallets
          </h3>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-caption)',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            Select wallets you added in the previous step to quickly add them as editors
          </p>
          
          <div className="grid grid-cols-1 gap-2">
            {projectWallets
              .filter(wallet => !editorWallets.includes(wallet.address) && wallet.address !== publicKey?.toBase58())
              .map((wallet) => (
                <div
                  key={wallet.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-sm) var(--space-md)',
                    backgroundColor: 'var(--subtle-background)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-card-lg)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--card-background)'
                    e.currentTarget.style.borderColor = 'var(--accent-primary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--subtle-background)'
                    e.currentTarget.style.borderColor = 'var(--border-subtle)'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                      <p
                        style={{
                          margin: 0,
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-body-small)',
                          fontWeight: 'var(--weight-medium)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {wallet.label}
                      </p>
                      <span
                        style={{
                          fontSize: 'var(--text-caption)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: 
                            wallet.type === 'team' ? 'rgba(59, 130, 246, 0.1)' : 
                            wallet.type === 'treasury' ? 'rgba(34, 197, 94, 0.1)' : 
                            wallet.type === 'liquidity' ? 'rgba(168, 85, 247, 0.1)' : 
                            'rgba(107, 114, 128, 0.1)',
                          color: 
                            wallet.type === 'team' ? '#2563EB' : 
                            wallet.type === 'treasury' ? '#16A34A' : 
                            wallet.type === 'liquidity' ? '#9333EA' : 
                            '#4B5563',
                        }}
                      >
                                        {wallet.type === 'team' ? '👤 Team' : 
                                         wallet.type === 'treasury' ? '💰 Treasury' : 
                                         wallet.type === 'liquidity' ? '💧 Liquidity' : 
                                         wallet.type === 'deployer' ? '🚀 Deployer' : '📌 Other'}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: '2px 0 0 0',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-caption)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {truncateAddress(wallet.address)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleQuickAddWallet(wallet.address)}
                  >
                    Add as Editor
                  </Button>
                </div>
              ))}
            
            {projectWallets.filter(w => !editorWallets.includes(w.address) && w.address !== publicKey?.toBase58()).length === 0 && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-caption)',
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                  padding: 'var(--space-sm)',
                }}
              >
                All project wallets have been added as editors
              </p>
            )}
          </div>
        </div>
      )}

      {/* Divider */}
      {projectWallets.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', margin: 'var(--space-md) 0' }} />
      )}

      {/* Current Editors List */}
      <div className="space-y-3">
        <h3
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-body-small)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--text-primary)',
          }}
        >
          Current Editors ({editorWallets.length + 1})
        </h3>

        <div className="space-y-2">
          {/* Creator (cannot remove) */}
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
                  width: '32px',
                  height: '32px',
                  backgroundColor: 'var(--accent-primary)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AdminPanelSettingsIcon style={{ fontSize: 18, color: 'white' }} />
              </div>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-body-small)',
                    fontWeight: 'var(--weight-medium)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {publicKey && truncateAddress(publicKey.toBase58())}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-caption)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  You - Creator
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

          {/* Added Editors */}
          {editorWallets.map((wallet) => (
            <div
              key={wallet}
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
                    width: '32px',
                    height: '32px',
                    backgroundColor: 'var(--accent-success-soft)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PersonIcon style={{ fontSize: 18, color: 'var(--accent-success)' }} />
                </div>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-body-small)',
                      fontWeight: 'var(--weight-medium)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {truncateAddress(wallet)}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-caption)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Editor
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => handleRemoveEditor(wallet)}
              >
                Remove
              </Button>
            </div>
          ))}

          {/* Empty State */}
          {editorWallets.length === 0 && (
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
                No additional editors added yet
              </p>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-caption)',
                  color: 'var(--text-muted)',
                }}
              >
                You can add editors now or skip and add them later
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: 'var(--space-lg)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={onBack}
        >
          ← Back
        </Button>

        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onNext}
          >
            Skip for Now
          </Button>
          
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={onNext}
          >
            Create Project →
          </Button>
        </div>
      </div>
    </div>
  )
}

