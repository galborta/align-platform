'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Chip,
  IconButton
} from '@mui/material'
import { Database } from '@/types/database'
import { 
  FollowerTier,
  calculateFollowerTier,
  formatFollowerTierRange 
} from '@/lib/social-media-jobs-follower-tiers'
import { toast } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

// Icons
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MoneyIcon from '@mui/icons-material/AttachMoney'
import WarningIcon from '@mui/icons-material/Warning'
import RefreshIcon from '@mui/icons-material/Refresh'

type Job = Database['public']['Tables']['jobs']['Row']
type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

interface BatchApprovalModalProps {
  open: boolean
  onClose: () => void
  job: Job
  submissions: JobSubmission[]  // Selected submissions to approve
  onSuccess: () => void          // Callback after approval completes
}

interface PaymentResult {
  submission_id: string
  worker_wallet: string
  status: 'paid' | 'failed'
  amount?: number
  bonus?: number
  error?: string
  tx_signature?: string
}

export default function BatchApprovalModal({
  open,
  onClose,
  job,
  submissions,
  onSuccess
}: BatchApprovalModalProps) {
  const [processing, setProcessing] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [results, setResults] = useState<PaymentResult[]>([])
  const [bonuses, setBonuses] = useState<Record<string, number>>({})
  const [expandBonuses, setExpandBonuses] = useState(false)

  // Parse follower tiers
  const followerTiers: FollowerTier[] = Array.isArray(job.social_follower_tiers)
    ? (job.social_follower_tiers as FollowerTier[])
    : []

  const feePercentage = (job.fee_percentage_at_creation || 0.05) * 100

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setProcessing(false)
      setShowResults(false)
      setResults([])
      setBonuses({})
      setExpandBonuses(false)
    }
  }, [open])

  // ==================== COST CALCULATION ====================

  const calculateTotal = () => {
    let subtotal = 0
    const breakdown: Array<{ 
      submission_id: string
      worker_wallet: string
      tier: FollowerTier | null
      base: number
      bonus: number
    }> = []

    submissions.forEach(sub => {
      const tier = calculateFollowerTier(
        sub.social_follower_count_claimed || 0,
        followerTiers
      )
      const base = tier?.base_payment_usd || 0
      const bonus = bonuses[sub.id] || 0
      
      subtotal += base + bonus
      breakdown.push({
        submission_id: sub.id,
        worker_wallet: sub.worker_wallet,
        tier,
        base,
        bonus
      })
    })

    const fee = subtotal * (feePercentage / 100)
    const total = subtotal + fee
    const budgetAfter = (job.social_remaining_budget_tokens || 0) - total

    return { subtotal, fee, total, budgetAfter, breakdown }
  }

  const { subtotal, fee, total, budgetAfter, breakdown } = calculateTotal()
  const insufficientBudget = total > (job.social_remaining_budget_tokens || 0)
  const budgetTight = budgetAfter < (total * 0.2) && budgetAfter > 0

  // ==================== APPROVAL HANDLER ====================

  const handleApprove = async () => {
    setProcessing(true)
    setShowResults(false)
    
    try {
      // Get session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        toast.error('Please sign in to continue')
        setProcessing(false)
        return
      }

      // Prepare request body
      const requestBody: {
        submission_ids: string[]
        impression_bonuses?: Record<string, number>
      } = {
        submission_ids: submissions.map(s => s.id)
      }

      // Add bonuses if any were entered
      const hasBonuses = Object.values(bonuses).some(b => b > 0)
      if (hasBonuses) {
        requestBody.impression_bonuses = bonuses
      }

      // Call batch approve API
      const response = await fetch(`/api/jobs/${job.id}/batch-approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process approvals')
      }

      // Process results
      const paymentResults: PaymentResult[] = []
      
      if (data.results) {
        data.results.forEach((result: any) => {
          const submission = submissions.find(s => s.id === result.submission_id)
          paymentResults.push({
            submission_id: result.submission_id,
            worker_wallet: submission?.worker_wallet || 'unknown',
            status: result.status === 'paid' ? 'paid' : 'failed',
            amount: result.amount,
            bonus: result.bonus,
            error: result.error,
            tx_signature: result.tx_signature
          })
        })
      }

      setResults(paymentResults)
      setShowResults(true)

      // Show summary toast
      const successCount = paymentResults.filter(r => r.status === 'paid').length
      const failCount = paymentResults.filter(r => r.status === 'failed').length

      if (successCount > 0) {
        toast.success(`✅ ${successCount} payment${successCount !== 1 ? 's' : ''} sent successfully!`)
      }
      if (failCount > 0) {
        toast.error(`⚠️ ${failCount} payment${failCount !== 1 ? 's' : ''} failed - can be retried`)
      }

      // Callback to refresh parent
      onSuccess()

    } catch (error: any) {
      console.error('[BatchApproval] Error:', error)
      toast.error(error.message || 'Failed to process approvals')
      setShowResults(false)
    } finally {
      setProcessing(false)
    }
  }

  // ==================== RENDER ====================

  const handleClose = () => {
    if (processing) return // Prevent closing during processing
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 'var(--radius-card-lg, 24px)',
          bgcolor: 'var(--card-background, #FFFFFF)',
          boxShadow: 'var(--shadow-floating, 0 24px 60px 0 rgba(15, 23, 42, 0.10))'
        }
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
          fontSize: 'var(--text-title, 22px)',
          fontWeight: 600,
          color: 'var(--text-primary, #1A1A1E)',
          pb: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span>
          Approve {submissions.length} Submission{submissions.length !== 1 ? 's' : ''}
        </span>
        <IconButton
          onClick={handleClose}
          disabled={processing}
          size="small"
          sx={{ color: 'var(--text-secondary, #6F7280)' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      {/* Content */}
      <DialogContent sx={{ pt: 3 }}>
        {!showResults ? (
          <>
            {/* Processing Indicator */}
            {processing && (
              <Box sx={{ mb: 3 }}>
                <LinearProgress 
                  sx={{
                    height: 6,
                    borderRadius: 'var(--radius-control, 999px)',
                    bgcolor: 'var(--border-subtle, #E5E7F0)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: 'var(--accent-primary, #7C4DFF)',
                      borderRadius: 'var(--radius-control, 999px)'
                    }
                  }}
                />
                <Typography 
                  variant="body2" 
                  sx={{ 
                    mt: 1, 
                    textAlign: 'center',
                    color: 'var(--text-secondary, #6F7280)',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                  }}
                >
                  Processing payments... This may take a moment.
                </Typography>
              </Box>
            )}

            {/* Submission List with Payment Breakdown */}
            <Typography
              variant="subtitle2"
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 2
              }}
            >
              Payment Breakdown
            </Typography>

            <List sx={{ mb: 2 }}>
              {breakdown.map((item, index) => (
                <ListItem
                  key={item.submission_id}
                  sx={{
                    px: 2,
                    py: 1.5,
                    mb: 1,
                    bgcolor: 'var(--subtle-background, #F7F8FB)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle, #E5E7F0)'
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--text-primary, #1A1A1E)',
                        mb: 0.5
                      }}
                    >
                      {item.worker_wallet.slice(0, 6)}...{item.worker_wallet.slice(-4)}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'var(--text-secondary, #6F7280)',
                        fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                        fontSize: '12px'
                      }}
                    >
                      {item.tier ? `${item.tier.tier_name} • ${formatFollowerTierRange(item.tier)}` : 'No tier found'}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                        fontWeight: 700,
                        color: 'var(--accent-primary, #7C4DFF)',
                        fontSize: '18px'
                      }}
                    >
                      ${(item.base + item.bonus).toFixed(2)}
                    </Typography>
                    {item.bonus > 0 && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'var(--accent-success, #36C170)',
                          fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                          fontSize: '11px'
                        }}
                      >
                        +${item.bonus} bonus
                      </Typography>
                    )}
                  </Box>
                </ListItem>
              ))}
            </List>

            {/* Optional Impression Bonuses */}
            <Accordion
              expanded={expandBonuses}
              onChange={() => setExpandBonuses(!expandBonuses)}
              sx={{
                mb: 3,
                borderRadius: 'var(--radius-card-lg, 24px) !important',
                border: '1px solid var(--border-subtle, #E5E7F0)',
                boxShadow: 'none',
                '&:before': { display: 'none' }
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  '& .MuiAccordionSummary-content': {
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontWeight: 600,
                    color: 'var(--text-primary, #1A1A1E)'
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MoneyIcon sx={{ fontSize: 18, color: 'var(--accent-success, #36C170)' }} />
                  <span>Add Impression Bonuses (Optional)</span>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mb: 2,
                    color: 'var(--text-secondary, #6F7280)',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                  }}
                >
                  Reward workers with extra bonuses for exceptional engagement
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {submissions.map(sub => (
                    <TextField
                      key={sub.id}
                      label={`Bonus for ${sub.worker_wallet.slice(0, 8)}...`}
                      type="number"
                      size="small"
                      value={bonuses[sub.id] || ''}
                      onChange={(e) => {
                        const value = Number(e.target.value)
                        if (value >= 0) {
                          setBonuses({ ...bonuses, [sub.id]: value })
                        }
                      }}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>
                      }}
                      inputProps={{
                        min: 0,
                        max: 100,
                        step: 0.5
                      }}
                      helperText="Optional: $0-$100"
                      disabled={processing}
                    />
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Cost Summary */}
            <Box
              sx={{
                p: 3,
                bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
                border: '2px solid var(--accent-primary, #7C4DFF)',
                borderRadius: 'var(--radius-card-lg, 24px)',
                mb: 2
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    color: 'var(--text-secondary, #6F7280)'
                  }}
                >
                  Subtotal:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontWeight: 600,
                    color: 'var(--text-primary, #1A1A1E)'
                  }}
                >
                  ${subtotal.toFixed(2)}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    color: 'var(--text-secondary, #6F7280)'
                  }}
                >
                  Platform fee ({feePercentage.toFixed(1)}%):
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontWeight: 600,
                    color: 'var(--text-primary, #1A1A1E)'
                  }}
                >
                  ${fee.toFixed(2)}
                </Typography>
              </Box>
              
              <Divider sx={{ mb: 2, bgcolor: 'rgba(124, 77, 255, 0.3)' }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                    fontWeight: 700,
                    color: 'var(--text-primary, #1A1A1E)'
                  }}
                >
                  Total Cost:
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                    fontWeight: 700,
                    color: 'var(--accent-primary, #7C4DFF)'
                  }}
                >
                  ${total.toFixed(2)}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    color: 'var(--text-secondary, #6F7280)'
                  }}
                >
                  Budget after:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontWeight: 600,
                    color: insufficientBudget 
                      ? '#EF4444' 
                      : budgetTight 
                        ? 'var(--accent-warning, #FFC857)'
                        : 'var(--accent-success, #36C170)'
                  }}
                >
                  ${budgetAfter.toFixed(2)}
                </Typography>
              </Box>
            </Box>

            {/* Warnings */}
            {insufficientBudget && (
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 2, 
                  borderRadius: 'var(--radius-card-lg, 24px)',
                  '& .MuiAlert-message': { fontFamily: 'var(--font-body, Satoshi, sans-serif)' }
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  ⚠️ Insufficient Budget
                </Typography>
                <Typography variant="caption">
                  Need ${total.toFixed(2)}, but only ${(job.social_remaining_budget_tokens || 0).toFixed(2)} available.
                  {bonuses && Object.values(bonuses).some(b => b > 0) && (
                    <> Try reducing or removing bonuses.</>
                  )}
                </Typography>
              </Alert>
            )}

            {budgetTight && !insufficientBudget && (
              <Alert 
                severity="warning" 
                sx={{ 
                  mb: 2,
                  borderRadius: 'var(--radius-card-lg, 24px)',
                  '& .MuiAlert-message': { fontFamily: 'var(--font-body, Satoshi, sans-serif)' }
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  ⚠️ Budget Running Low
                </Typography>
                <Typography variant="caption">
                  Only ${budgetAfter.toFixed(2)} will remain after these payments.
                </Typography>
              </Alert>
            )}
          </>
        ) : (
          <>
            {/* Results Display */}
            <Typography
              variant="h6"
              sx={{
                fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 2
              }}
            >
              Payment Results
            </Typography>

            <List sx={{ mb: 3 }}>
              {results.map(result => (
                <ListItem
                  key={result.submission_id}
                  sx={{
                    px: 2,
                    py: 1.5,
                    mb: 1,
                    bgcolor: result.status === 'paid' 
                      ? 'var(--accent-success-soft, #E3F8ED)' 
                      : 'rgba(244, 67, 54, 0.08)',
                    borderRadius: '12px',
                    border: `1px solid ${result.status === 'paid' 
                      ? 'var(--accent-success, #36C170)' 
                      : '#EF4444'}`
                  }}
                >
                  {result.status === 'paid' ? (
                    <CheckCircleIcon sx={{ color: 'var(--accent-success, #36C170)', mr: 2 }} />
                  ) : (
                    <ErrorIcon sx={{ color: '#EF4444', mr: 2 }} />
                  )}
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--text-primary, #1A1A1E)',
                        mb: 0.5
                      }}
                    >
                      {result.worker_wallet.slice(0, 6)}...{result.worker_wallet.slice(-4)}
                    </Typography>
                    {result.status === 'paid' ? (
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'var(--accent-success, #36C170)',
                          fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                          fontSize: '12px'
                        }}
                      >
                        ✓ Payment sent: ${result.amount?.toFixed(2)}
                        {result.bonus && result.bonus > 0 && ` (+$${result.bonus} bonus)`}
                      </Typography>
                    ) : (
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#EF4444',
                          fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                          fontSize: '12px'
                        }}
                      >
                        Payment failed: {result.error || 'Unknown error'}
                      </Typography>
                    )}
                  </Box>
                  {result.status === 'failed' && (
                    <Chip
                      label="Can Retry"
                      size="small"
                      icon={<RefreshIcon sx={{ fontSize: 14 }} />}
                      sx={{
                        bgcolor: 'var(--accent-warning, #FFC857)',
                        color: 'var(--text-primary, #1A1A1E)',
                        fontSize: '11px',
                        fontWeight: 600
                      }}
                    />
                  )}
                </ListItem>
              ))}
            </List>

            {/* Summary */}
            <Box
              sx={{
                p: 3,
                bgcolor: 'var(--subtle-background, #F7F8FB)',
                borderRadius: 'var(--radius-card-lg, 24px)',
                border: '1px solid var(--border-subtle, #E5E7F0)'
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)',
                  mb: 2
                }}
              >
                Summary
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 4 }}>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: 'var(--text-secondary, #6F7280)',
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                      mb: 0.5
                    }}
                  >
                    Succeeded
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                      fontWeight: 700,
                      color: 'var(--accent-success, #36C170)'
                    }}
                  >
                    ✅ {results.filter(r => r.status === 'paid').length}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: 'var(--text-secondary, #6F7280)',
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                      mb: 0.5
                    }}
                  >
                    Failed
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                      fontWeight: 700,
                      color: '#EF4444'
                    }}
                  >
                    ❌ {results.filter(r => r.status === 'failed').length}
                  </Typography>
                </Box>
              </Box>
              
              {results.filter(r => r.status === 'failed').length > 0 && (
                <Alert 
                  severity="info" 
                  sx={{ 
                    mt: 2,
                    borderRadius: 'var(--radius-card-lg, 24px)',
                    '& .MuiAlert-message': { fontFamily: 'var(--font-body, Satoshi, sans-serif)' }
                  }}
                >
                  <Typography variant="caption">
                    Failed payments can be retried from the submission list using the "Retry Payment" button.
                  </Typography>
                </Alert>
              )}
            </Box>
          </>
        )}
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ px: 3, pb: 3 }}>
        {!showResults ? (
          <>
            <Button
              onClick={handleClose}
              disabled={processing}
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 600,
                color: 'var(--text-secondary, #6F7280)',
                borderRadius: 'var(--radius-control, 999px)',
                px: 3
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleApprove}
              disabled={processing || insufficientBudget}
              sx={{
                bgcolor: 'var(--accent-primary, #7C4DFF)',
                color: '#FFFFFF',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 600,
                borderRadius: 'var(--radius-control, 999px)',
                px: 4,
                '&:hover': {
                  bgcolor: '#6A3FE8'
                },
                '&:disabled': {
                  bgcolor: 'var(--text-muted, #A3A7B5)',
                  color: '#FFFFFF'
                }
              }}
            >
              {processing ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} sx={{ color: '#FFFFFF' }} />
                  <span>Processing...</span>
                </Box>
              ) : (
                `Approve & Pay ${submissions.length}`
              )}
            </Button>
          </>
        ) : (
          <Button
            variant="contained"
            onClick={handleClose}
            fullWidth
            sx={{
              bgcolor: 'var(--accent-primary, #7C4DFF)',
              color: '#FFFFFF',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 600,
              borderRadius: 'var(--radius-control, 999px)',
              py: 1.5,
              '&:hover': {
                bgcolor: '#6A3FE8'
              }
            }}
          >
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

