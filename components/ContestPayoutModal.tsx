import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Alert,
  LinearProgress,
  Paper,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Link as MuiLink
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Database } from '@/types/database'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { executeContestPayout, verifyEscrowBalance } from '@/lib/escrow-payout'
import { getEscrowWallet } from '@/lib/platform-settings'
import { toast } from 'react-hot-toast'
import { WalletAddressWithButtons } from './WalletAddressWithButtons'

type Job = Database['public']['Tables']['jobs']['Row']
type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

interface Winner {
  wallet: string
  amount_tokens: number
  position: number
  submission_id: string
}

interface ContestPayoutModalProps {
  open: boolean
  onClose: () => void
  job: Job
  winners: JobSubmission[]
  onPayoutComplete: () => void
}

export default function ContestPayoutModal({
  open,
  onClose,
  job,
  winners,
  onPayoutComplete
}: ContestPayoutModalProps) {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [activeStep, setActiveStep] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [txSignature, setTxSignature] = useState('')
  const [balanceVerified, setBalanceVerified] = useState(false)
  const [escrowWalletAddress, setEscrowWalletAddress] = useState<string | null>(null)

  const steps = ['Verify Escrow', 'Execute Payout', 'Confirm Transaction']

  const totalPayout = winners.reduce((sum, w) => sum + (w.prize_amount_tokens || 0), 0)

  // Fetch escrow wallet address on mount
  useEffect(() => {
    if (open) {
      getEscrowWallet().then(address => {
        setEscrowWalletAddress(address)
      })
    }
  }, [open])

  const handleVerifyBalance = async () => {
    setIsProcessing(true)
    setError('')

    try {
      if (!escrowWalletAddress) {
        throw new Error('No escrow wallet found')
      }

      const escrowPubkey = new PublicKey(escrowWalletAddress)
      const { sufficient, actualBalance } = await verifyEscrowBalance(
        connection,
        escrowPubkey,
        totalPayout
      )

      if (!sufficient) {
        throw new Error(
          `Insufficient escrow balance. Required: ${totalPayout}, Available: ${actualBalance}`
        )
      }

      setBalanceVerified(true)
      setActiveStep(1)
      toast.success('Escrow balance verified')
    } catch (err: any) {
      setError(err.message || 'Failed to verify escrow balance')
      toast.error('Balance verification failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExecutePayout = async () => {
    setIsProcessing(true)
    setError('')

    try {
      if (!escrowWalletAddress) {
        throw new Error('No escrow wallet found')
      }

      const escrowPubkey = new PublicKey(escrowWalletAddress)
      
      const winnersData: Winner[] = winners.map(w => ({
        wallet: w.worker_wallet,
        amount_tokens: w.prize_amount_tokens!,
        position: w.winner_position!,
        submission_id: w.id
      }))

      const result = await executeContestPayout(
        connection,
        wallet,
        job.id,
        winnersData,
        escrowPubkey
      )

      if (!result.success) {
        throw new Error(result.error || 'Payout failed')
      }

      setTxSignature(result.signature!)
      setActiveStep(2)
      toast.success('🎉 Prizes distributed successfully!')
      
      // Wait a moment for user to see success, then close and refresh
      setTimeout(() => {
        onPayoutComplete()
        onClose()
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to execute payout')
      toast.error('Payout failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    if (!isProcessing) {
      onClose()
    }
  }

  const getExplorerUrl = (signature: string) => {
    return `https://explorer.solana.com/tx/${signature}?cluster=devnet`
  }

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'var(--card-background)',
          borderRadius: 'var(--radius-card-lg)',
          border: '1px solid var(--border-subtle)'
        }
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}
          >
            💰 Distribute Contest Prizes
          </Typography>
          <IconButton onClick={handleClose} disabled={isProcessing}>
            <CloseIcon sx={{ color: 'var(--text-muted)' }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {/* Progress Stepper */}
        <Stepper 
          activeStep={activeStep} 
          sx={{ 
            mb: 4,
            '& .MuiStepLabel-label': {
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)'
            },
            '& .MuiStepLabel-label.Mui-active': {
              color: 'var(--accent-primary)',
              fontWeight: 600
            },
            '& .MuiStepLabel-label.Mui-completed': {
              color: 'var(--accent-success)'
            },
            '& .MuiStepIcon-root': {
              color: 'var(--border-subtle)'
            },
            '& .MuiStepIcon-root.Mui-active': {
              color: 'var(--accent-primary)'
            },
            '& .MuiStepIcon-root.Mui-completed': {
              color: 'var(--accent-success)'
            }
          }}
        >
          {steps.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert 
            severity="error" 
            icon={<ErrorIcon />} 
            sx={{ 
              mb: 3,
              bgcolor: 'var(--accent-danger-soft)',
              color: 'var(--accent-danger)',
              '& .MuiAlert-icon': {
                color: 'var(--accent-danger)'
              }
            }}
          >
            {error}
          </Alert>
        )}

        {/* Step 0: Verify Escrow */}
        {activeStep === 0 && (
          <>
            <Alert 
              severity="info" 
              sx={{ 
                mb: 3,
                bgcolor: 'var(--accent-primary-soft)',
                color: 'var(--accent-primary)',
                '& .MuiAlert-icon': {
                  color: 'var(--accent-primary)'
                }
              }}
            >
              Before distributing prizes, we'll verify the escrow account has sufficient balance.
            </Alert>

            <Paper 
              sx={{ 
                p: 3, 
                mb: 3, 
                bgcolor: 'var(--accent-primary-soft)',
                border: '1px solid var(--accent-primary)',
                borderRadius: 'var(--radius-control)'
              }}
            >
              <Typography 
                variant="body2" 
                sx={{ color: 'var(--text-secondary)', mb: 1 }}
              >
                Total Prize Pool
              </Typography>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 700, 
                  color: 'var(--accent-primary)', 
                  mb: 2,
                  fontFamily: 'var(--font-heading)'
                }}
              >
                {totalPayout.toLocaleString()} tokens
              </Typography>

              <Typography 
                variant="body2" 
                sx={{ color: 'var(--text-secondary)', mb: 1 }}
              >
                Escrow Wallet
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: 'monospace', 
                  wordBreak: 'break-all',
                  color: 'var(--text-primary)'
                }}
              >
                {escrowWalletAddress || 'Loading...'}
              </Typography>
            </Paper>

            <Typography 
              variant="subtitle2" 
              sx={{ 
                mb: 2, 
                fontWeight: 600,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-heading)'
              }}
            >
              Prize Distribution ({winners.length} winners)
            </Typography>
            {winners
              .sort((a, b) => (a.winner_position || 0) - (b.winner_position || 0))
              .map(winner => (
                <Box
                  key={winner.id}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 2,
                    mb: 1,
                    bgcolor: 'var(--subtle-background)',
                    borderRadius: 'var(--radius-control)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6">
                      {winner.winner_position === 1 ? '🥇' :
                       winner.winner_position === 2 ? '🥈' :
                       winner.winner_position === 3 ? '🥉' :
                       `#${winner.winner_position}`}
                    </Typography>
                    <WalletAddressWithButtons
                      address={winner.worker_wallet}
                      variant="short"
                      showCopy
                    />
                  </Box>
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      fontWeight: 600,
                      color: 'var(--accent-primary)'
                    }}
                  >
                    {winner.prize_amount_tokens?.toLocaleString()} tokens
                  </Typography>
                </Box>
              ))}
          </>
        )}

        {/* Step 1: Execute Payout */}
        {activeStep === 1 && (
          <>
            <Alert 
              severity="warning" 
              sx={{ 
                mb: 3,
                bgcolor: 'var(--accent-warning-soft)',
                color: 'var(--accent-warning)',
                '& .MuiAlert-icon': {
                  color: 'var(--accent-warning)'
                }
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                ⚠️ Ready to distribute prizes
              </Typography>
              <Typography variant="caption">
                This will transfer {totalPayout.toLocaleString()} tokens from escrow to {winners.length} winner{winners.length > 1 ? 's' : ''}. 
                This action cannot be undone.
              </Typography>
            </Alert>

            {isProcessing && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress 
                  size={60} 
                  sx={{ color: 'var(--accent-primary)', mb: 2 }} 
                />
                <Typography 
                  variant="body1" 
                  sx={{ 
                    fontWeight: 600, 
                    mb: 1,
                    color: 'var(--text-primary)'
                  }}
                >
                  Processing transaction...
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ color: 'var(--text-secondary)' }}
                >
                  Please confirm the transaction in your wallet and wait for blockchain confirmation
                </Typography>
                <LinearProgress 
                  sx={{ 
                    mt: 3,
                    bgcolor: 'var(--accent-primary-soft)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: 'var(--accent-primary)'
                    }
                  }} 
                />
              </Box>
            )}
          </>
        )}

        {/* Step 2: Transaction Complete */}
        {activeStep === 2 && txSignature && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircleIcon 
              sx={{ fontSize: 80, color: 'var(--accent-success)', mb: 2 }} 
            />
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 700, 
                mb: 1,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-heading)'
              }}
            >
              Prizes Distributed! 🎉
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ color: 'var(--text-secondary)', mb: 3 }}
            >
              All winners have been paid their prizes
            </Typography>

            <Paper 
              sx={{ 
                p: 2, 
                bgcolor: 'var(--accent-success-soft)', 
                mb: 3,
                borderRadius: 'var(--radius-control)',
                border: '1px solid var(--accent-success)'
              }}
            >
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'var(--text-secondary)', 
                  display: 'block', 
                  mb: 1 
                }}
              >
                Transaction Signature
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: 'monospace', 
                  wordBreak: 'break-all',
                  mb: 2,
                  color: 'var(--text-primary)'
                }}
              >
                {txSignature}
              </Typography>
              <MuiLink
                href={getExplorerUrl(txSignature)}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 0.5,
                  color: 'var(--accent-primary)',
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline'
                  }
                }}
              >
                View on Solana Explorer
                <OpenInNewIcon sx={{ fontSize: 16 }} />
              </MuiLink>
            </Paper>

            <Alert 
              severity="success"
              sx={{
                bgcolor: 'var(--accent-success-soft)',
                color: 'var(--accent-success)',
                '& .MuiAlert-icon': {
                  color: 'var(--accent-success)'
                }
              }}
            >
              Winners have been notified and the contest is now complete!
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, borderTop: '1px solid var(--border-subtle)' }}>
        {activeStep === 0 && (
          <>
            <Button 
              onClick={handleClose} 
              disabled={isProcessing}
              sx={{
                color: 'var(--text-secondary)',
                '&:hover': {
                  bgcolor: 'var(--subtle-background)'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleVerifyBalance}
              disabled={isProcessing || !escrowWalletAddress}
              sx={{
                bgcolor: 'var(--accent-primary)',
                borderRadius: 'var(--radius-control)',
                fontWeight: 600,
                '&:hover': { bgcolor: 'var(--accent-primary-hover)' },
                '&:disabled': { 
                  bgcolor: 'var(--border-subtle)',
                  color: 'var(--text-muted)'
                }
              }}
            >
              {isProcessing ? (
                <CircularProgress size={24} sx={{ color: 'white' }} />
              ) : (
                'Verify & Continue'
              )}
            </Button>
          </>
        )}

        {activeStep === 1 && (
          <>
            <Button 
              onClick={() => setActiveStep(0)} 
              disabled={isProcessing}
              sx={{
                color: 'var(--text-secondary)',
                '&:hover': {
                  bgcolor: 'var(--subtle-background)'
                }
              }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleExecutePayout}
              disabled={isProcessing}
              sx={{
                bgcolor: 'var(--accent-success)',
                borderRadius: 'var(--radius-control)',
                fontWeight: 600,
                '&:hover': { bgcolor: 'var(--accent-success-hover)' },
                '&:disabled': { 
                  bgcolor: 'var(--border-subtle)',
                  color: 'var(--text-muted)'
                }
              }}
            >
              {isProcessing ? (
                <CircularProgress size={24} sx={{ color: 'white' }} />
              ) : (
                'Execute Payout'
              )}
            </Button>
          </>
        )}

        {activeStep === 2 && (
          <Button
            variant="contained"
            onClick={() => {
              onPayoutComplete()
              onClose()
            }}
            sx={{
              bgcolor: 'var(--accent-primary)',
              borderRadius: 'var(--radius-control)',
              fontWeight: 600,
              '&:hover': { bgcolor: 'var(--accent-primary-hover)' }
            }}
          >
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

