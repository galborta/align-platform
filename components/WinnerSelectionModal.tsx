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
  Card,
  CardContent,
  CardMedia,
  Chip,
  Radio,
  FormControlLabel,
  Divider,
  Paper,
  CircularProgress
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { Database } from '@/types/database'
import { supabase } from '@/lib/supabase'
import { WalletAddressWithButtons } from './WalletAddressWithButtons'
import { toast } from 'react-hot-toast'

type Job = Database['public']['Tables']['jobs']['Row']
type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

interface WinnerSelectionModalProps {
  open: boolean
  onClose: () => void
  job: Job
  submissions: JobSubmission[]
  onWinnersSelected: () => void
}

export default function WinnerSelectionModal({
  open,
  onClose,
  job,
  submissions,
  onWinnersSelected
}: WinnerSelectionModalProps) {
  const [selectedWinners, setSelectedWinners] = useState<Record<number, string>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'select' | 'confirm'>('select')

  // Initialize with any existing winners
  useEffect(() => {
    const existingWinners: Record<number, string> = {}
    submissions
      .filter(s => s.is_selected_winner && s.winner_position)
      .forEach(s => {
        existingWinners[s.winner_position!] = s.id
      })
    setSelectedWinners(existingWinners)
  }, [submissions])

  const handleSelectWinner = (position: number, submissionId: string) => {
    setSelectedWinners(prev => {
      const newSelections = { ...prev }
      
      // If clicking the same submission, deselect it
      if (newSelections[position] === submissionId) {
        delete newSelections[position]
      } else {
        // Check if this submission is already selected for another position
        const alreadySelectedPosition = Object.entries(newSelections)
          .find(([_, id]) => id === submissionId)?.[0]
        
        if (alreadySelectedPosition) {
          // Remove from previous position
          delete newSelections[Number(alreadySelectedPosition)]
        }
        
        newSelections[position] = submissionId
      }
      
      return newSelections
    })
  }

  const getSubmissionById = (submissionId: string) => {
    return submissions.find(s => s.id === submissionId)
  }

  const getPrizeForPosition = (position: number) => {
    return job.contest_winner_prizes?.find(p => p.position === position)
  }

  const validateSelection = (): boolean => {
    const numWinners = job.contest_max_winners || 1
    const selectedCount = Object.keys(selectedWinners).length

    if (selectedCount !== numWinners) {
      setError(`You must select exactly ${numWinners} winner${numWinners > 1 ? 's' : ''}`)
      return false
    }

    // Verify all positions from 1 to numWinners are filled
    for (let i = 1; i <= numWinners; i++) {
      if (!selectedWinners[i]) {
        setError(`Position #${i} must be filled`)
        return false
      }
    }

    return true
  }

  const handleProceedToConfirm = () => {
    if (validateSelection()) {
      setError('')
      setStep('confirm')
    }
  }

  const handleConfirmWinners = async () => {
    setIsProcessing(true)
    setError('')

    try {
      // Update job_submissions with winner info
      const updatePromises = Object.entries(selectedWinners).map(([position, submissionId]) => {
        const prize = getPrizeForPosition(Number(position))
        
        return supabase
          .from('job_submissions')
          .update({
            is_selected_winner: true,
            winner_position: Number(position),
            prize_amount_tokens: prize?.amount_tokens,
            prize_amount_usd: prize?.amount_usd
          })
          .eq('id', submissionId)
      })

      await Promise.all(updatePromises)

      // Update unselected submissions to ensure they're not marked as winners
      const selectedIds = Object.values(selectedWinners)
      const unselectedSubmissions = submissions
        .filter(s => !selectedIds.includes(s.id))
        .map(s => s.id)

      if (unselectedSubmissions.length > 0) {
        await supabase
          .from('job_submissions')
          .update({
            is_selected_winner: false,
            winner_position: null,
            prize_amount_tokens: null,
            prize_amount_usd: null
          })
          .in('id', unselectedSubmissions)
      }

      // Update job with winners_selected_at timestamp
      await supabase
        .from('jobs')
        .update({
          contest_winners_selected_at: new Date().toISOString()
        })
        .eq('id', job.id)

      toast.success('Winners selected! Proceeding to payment...')
      onWinnersSelected()
      onClose()

    } catch (err: any) {
      console.error('Error selecting winners:', err)
      setError(err.message || 'Failed to select winners')
      toast.error('Failed to select winners')
    } finally {
      setIsProcessing(false)
    }
  }

  const renderSelectionStep = () => (
    <>
      <Alert 
        severity="info" 
        sx={{ 
          mb: 3,
          bgcolor: 'var(--accent-primary-soft)',
          color: 'var(--text-primary)',
          '& .MuiAlert-icon': {
            color: 'var(--accent-primary)'
          }
        }}
      >
        Select {job.contest_max_winners} winner{job.contest_max_winners! > 1 ? 's' : ''} from {submissions.length} submission{submissions.length > 1 ? 's' : ''}. 
        Click on a submission to assign it to a prize position.
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Prize Positions */}
      <Box sx={{ mb: 3 }}>
        <Typography 
          variant="subtitle1" 
          sx={{ 
            fontWeight: 600, 
            mb: 2,
            fontFamily: 'var(--font-heading)',
            color: 'var(--text-primary)'
          }}
        >
          Prize Positions
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {Array.from({ length: job.contest_max_winners! }, (_, i) => i + 1).map(position => {
            const prize = getPrizeForPosition(position)
            const selectedSubmission = selectedWinners[position] 
              ? getSubmissionById(selectedWinners[position])
              : null

            return (
              <Paper
                key={position}
                elevation={0}
                sx={{
                  p: 2,
                  minWidth: 120,
                  border: selectedSubmission 
                    ? '2px solid var(--accent-primary)' 
                    : '1px solid var(--border-subtle)',
                  bgcolor: selectedSubmission 
                    ? 'var(--accent-primary-soft)' 
                    : 'var(--card-background)',
                  borderRadius: 'var(--radius-card-lg)',
                  transition: 'all 0.2s ease'
                }}
              >
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `#${position}`}
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    display: 'block', 
                    color: 'var(--text-secondary)', 
                    mb: 1 
                  }}
                >
                  {prize?.amount_tokens.toLocaleString()} tokens
                </Typography>
                {selectedSubmission ? (
                  <Chip
                    label={selectedSubmission.worker_wallet.slice(0, 8) + '...'}
                    size="small"
                    icon={<CheckCircleIcon />}
                    sx={{ 
                      bgcolor: 'var(--accent-primary)', 
                      color: 'white',
                      '& .MuiChip-icon': { color: 'white' }
                    }}
                  />
                ) : (
                  <Chip
                    label="Not selected"
                    size="small"
                    sx={{ 
                      bgcolor: 'var(--subtle-background)',
                      color: 'var(--text-muted)'
                    }}
                  />
                )}
              </Paper>
            )
          })}
        </Box>
      </Box>

      <Divider sx={{ my: 3, borderColor: 'var(--border-subtle)' }} />

      {/* Submission Grid */}
      <Typography 
        variant="subtitle1" 
        sx={{ 
          fontWeight: 600, 
          mb: 2,
          fontFamily: 'var(--font-heading)',
          color: 'var(--text-primary)'
        }}
      >
        Select from Submissions
      </Typography>
      <Box sx={{ 
        maxHeight: '400px', 
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 2,
        pr: 1
      }}>
        {submissions.map(submission => {
          const assignedPosition = Object.entries(selectedWinners)
            .find(([_, id]) => id === submission.id)?.[0]

          return (
            <Card 
              key={submission.id}
              elevation={0}
              sx={{
                cursor: 'pointer',
                border: assignedPosition 
                  ? '3px solid var(--accent-primary)' 
                  : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-card-lg)',
                position: 'relative',
                bgcolor: 'var(--card-background)',
                '&:hover': {
                  boxShadow: 'var(--shadow-card)',
                  transform: 'translateY(-2px)'
                },
                transition: 'all 0.2s ease'
              }}
            >
              {assignedPosition && (
                <Chip
                  icon={<EmojiEventsIcon />}
                  label={`Position #${assignedPosition}`}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 1,
                    bgcolor: 'var(--accent-primary)',
                    color: 'white',
                    fontWeight: 600,
                    '& .MuiChip-icon': { color: 'white' }
                  }}
                />
              )}

              {submission.image_urls && submission.image_urls.length > 0 && (
                <CardMedia
                  component="img"
                  height="160"
                  image={submission.image_urls[0]}
                  alt="Submission"
                  sx={{ 
                    objectFit: 'cover',
                    borderTopLeftRadius: 'var(--radius-card-lg)',
                    borderTopRightRadius: 'var(--radius-card-lg)'
                  }}
                />
              )}

              <CardContent>
                <WalletAddressWithButtons
                  address={submission.worker_wallet}
                  variant="short"
                  showCopy
                />
                <Typography 
                  variant="body2" 
                  sx={{ 
                    mt: 1,
                    color: 'var(--text-secondary)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {submission.message}
                </Typography>

                {/* Position Selection Radios */}
                <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {Array.from({ length: job.contest_max_winners! }, (_, i) => i + 1).map(position => (
                    <FormControlLabel
                      key={position}
                      control={
                        <Radio
                          checked={selectedWinners[position] === submission.id}
                          onChange={() => handleSelectWinner(position, submission.id)}
                          size="small"
                          sx={{
                            color: 'var(--text-muted)',
                            '&.Mui-checked': {
                              color: 'var(--accent-primary)'
                            }
                          }}
                        />
                      }
                      label={`#${position}`}
                      sx={{ 
                        m: 0,
                        '& .MuiFormControlLabel-label': { 
                          fontSize: '0.875rem',
                          color: 'var(--text-secondary)'
                        }
                      }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          )
        })}
      </Box>
    </>
  )

  const renderConfirmStep = () => {
    const totalPrize = Object.keys(selectedWinners)
      .reduce((sum, position) => {
        const prize = getPrizeForPosition(Number(position))
        return sum + (prize?.amount_tokens || 0)
      }, 0)

    return (
      <>
        <Alert 
          severity="warning" 
          sx={{ 
            mb: 3,
            bgcolor: 'rgba(255, 200, 87, 0.15)',
            '& .MuiAlert-icon': {
              color: 'var(--accent-warning)'
            }
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: 'var(--text-primary)' }}>
            ⚠️ Review your winner selection carefully
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
            Once confirmed, you&apos;ll proceed to distribute prizes. This action cannot be undone.
          </Typography>
        </Alert>

        <Typography 
          variant="h6" 
          sx={{ 
            mb: 2, 
            fontWeight: 600,
            fontFamily: 'var(--font-heading)',
            color: 'var(--text-primary)'
          }}
        >
          Selected Winners
        </Typography>

        {Object.entries(selectedWinners)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([position, submissionId]) => {
            const submission = getSubmissionById(submissionId)
            const prize = getPrizeForPosition(Number(position))

            if (!submission || !prize) return null

            return (
              <Paper 
                key={position} 
                elevation={0}
                sx={{ 
                  p: 2, 
                  mb: 2, 
                  bgcolor: 'var(--accent-primary-soft)',
                  borderRadius: 'var(--radius-card-lg)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h5">
                      {Number(position) === 1 ? '🥇' : 
                       Number(position) === 2 ? '🥈' : 
                       Number(position) === 3 ? '🥉' : 
                       `#${position}`}
                    </Typography>
                    <Box>
                      <WalletAddressWithButtons
                        address={submission.worker_wallet}
                        variant="short"
                        showCopy
                      />
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          display: 'block', 
                          color: 'var(--text-secondary)',
                          mt: 0.5
                        }}
                      >
                        {submission.message.slice(0, 60)}...
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 700, 
                        color: 'var(--accent-primary)',
                        fontFamily: 'var(--font-heading)'
                      }}
                    >
                      {prize.amount_tokens.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                      tokens
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            )
          })}

        <Divider sx={{ my: 3, borderColor: 'var(--border-subtle)' }} />

        <Box sx={{ 
          bgcolor: 'var(--accent-primary-soft)', 
          p: 2.5, 
          borderRadius: 'var(--radius-card-lg)',
          border: '2px solid var(--accent-primary)'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography 
              variant="body1" 
              sx={{ 
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}
            >
              Total Prize Distribution
            </Typography>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 700, 
                color: 'var(--accent-primary)',
                fontFamily: 'var(--font-heading)'
              }}
            >
              {totalPrize.toLocaleString()} tokens
            </Typography>
          </Box>
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'var(--text-secondary)', 
              display: 'block', 
              mt: 1 
            }}
          >
            Winners will be notified and prizes will be distributed from escrow
          </Typography>
        </Box>
      </>
    )
  }

  return (
    <Dialog 
      open={open} 
      onClose={isProcessing ? undefined : onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 'var(--radius-card-lg)',
          bgcolor: 'var(--card-background)'
        }
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEventsIcon sx={{ color: 'var(--accent-primary)' }} />
            <Typography 
              variant="h6"
              sx={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}
            >
              {step === 'select' ? 'Select Contest Winners' : 'Confirm Winners'}
            </Typography>
          </Box>
          <IconButton 
            onClick={onClose} 
            disabled={isProcessing}
            sx={{
              color: 'var(--text-muted)',
              '&:hover': {
                color: 'var(--text-primary)',
                bgcolor: 'var(--subtle-background)'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ py: 3 }}>
        {step === 'select' ? renderSelectionStep() : renderConfirmStep()}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, borderTop: '1px solid var(--border-subtle)', pt: 2 }}>
        {step === 'confirm' && (
          <Button 
            onClick={() => setStep('select')}
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
        )}
        <Button 
          onClick={onClose} 
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
        {step === 'select' ? (
          <Button
            variant="contained"
            onClick={handleProceedToConfirm}
            sx={{
              bgcolor: 'var(--accent-primary)',
              color: 'white',
              borderRadius: 'var(--radius-control)',
              px: 3,
              fontWeight: 500,
              textTransform: 'none',
              '&:hover': { 
                bgcolor: '#6A3FDB' 
              }
            }}
          >
            Review Selection
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleConfirmWinners}
            disabled={isProcessing}
            sx={{
              bgcolor: 'var(--accent-primary)',
              color: 'white',
              borderRadius: 'var(--radius-control)',
              px: 3,
              fontWeight: 500,
              textTransform: 'none',
              '&:hover': { 
                bgcolor: '#6A3FDB' 
              },
              '&.Mui-disabled': {
                bgcolor: 'var(--subtle-background)',
                color: 'var(--text-muted)'
              }
            }}
          >
            {isProcessing ? (
              <CircularProgress size={24} sx={{ color: 'white' }} />
            ) : (
              'Confirm & Proceed to Payment'
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

