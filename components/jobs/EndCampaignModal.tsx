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
  Paper,
  Divider,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  IconButton
} from '@mui/material'
import { Database } from '@/types/database'
import { toast } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

// Icons
import CloseIcon from '@mui/icons-material/Close'
import WarningIcon from '@mui/icons-material/Warning'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import MoneyIcon from '@mui/icons-material/AttachMoney'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import PeopleIcon from '@mui/icons-material/People'

type Job = Database['public']['Tables']['jobs']['Row']
type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

interface EndCampaignModalProps {
  open: boolean
  onClose: () => void
  job: Job
  approvedSubmissions: JobSubmission[]  // All approved (paid) submissions
  onSuccess: () => void
}

export default function EndCampaignModal({
  open,
  onClose,
  job,
  approvedSubmissions,
  onSuccess
}: EndCampaignModalProps) {
  const [processing, setProcessing] = useState(false)
  const [bonuses, setBonuses] = useState<Record<string, number>>({})
  const [expandBonuses, setExpandBonuses] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const feePercentage = (job.fee_percentage_at_creation || 0.05) * 100

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setProcessing(false)
      setBonuses({})
      setExpandBonuses(false)
      setShowConfirmation(false)
    }
  }, [open])

  // ==================== CALCULATIONS ====================

  const calculateTotalSpent = () => {
    return approvedSubmissions.reduce((sum, sub) => {
      return sum + (sub.social_payment_amount_usd || 0)
    }, 0)
  }

  const calculateAvgImpressions = () => {
    const withMetrics = approvedSubmissions.filter(
      sub => sub.social_engagement_metrics && 
      (sub.social_engagement_metrics as any).impressions
    )
    
    if (withMetrics.length === 0) return 'N/A'
    
    const totalImpressions = withMetrics.reduce((sum, sub) => {
      const metrics = sub.social_engagement_metrics as any
      return sum + (metrics.impressions || 0)
    }, 0)
    
    return Math.round(totalImpressions / withMetrics.length).toLocaleString()
  }

  const calculateRefund = () => {
    const totalBonuses = Object.values(bonuses).reduce((sum, b) => sum + (b || 0), 0)
    const bonusFees = totalBonuses * (feePercentage / 100)
    const bonusTotal = totalBonuses + bonusFees
    const remaining = job.social_remaining_budget_tokens || 0
    const locked = job.social_locked_budget_tokens || 0
    const available = remaining - locked
    const refund = available - bonusTotal
    
    return {
      remaining: available,
      bonuses: bonusTotal,
      refund,
      hasPendingPayments: locked > 0
    }
  }

  const { remaining, bonuses: bonusTotal, refund, hasPendingPayments } = calculateRefund()

  const handleBonusChange = (submissionId: string, value: number) => {
    if (value < 0) return
    if (value > 100) {
      toast.error('Bonus cannot exceed $100')
      return
    }
    setBonuses({ ...bonuses, [submissionId]: value })
  }

  // ==================== END CAMPAIGN HANDLER ====================

  const handleEndCampaign = async () => {
    if (!showConfirmation) {
      setShowConfirmation(true)
      return
    }

    setProcessing(true)
    
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
        poster_wallet: string
        impression_bonuses?: Record<string, number>
      } = {
        poster_wallet: job.poster_wallet
      }

      // Add bonuses if any were entered
      const hasBonuses = Object.values(bonuses).some(b => b > 0)
      if (hasBonuses) {
        // Filter out zero bonuses
        const filteredBonuses: Record<string, number> = {}
        Object.entries(bonuses).forEach(([id, amount]) => {
          if (amount > 0) {
            filteredBonuses[id] = amount
          }
        })
        requestBody.impression_bonuses = filteredBonuses
      }

      // Call end campaign API
      const response = await fetch(`/api/jobs/${job.id}/end-campaign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to end campaign')
      }

      // Success!
      const refundAmount = data.summary?.refund_amount || 0
      const bonusesAdded = data.summary?.bonuses_added || 0
      
      let successMessage = `Campaign ended!`
      if (refundAmount > 0) {
        successMessage += ` Refunded $${refundAmount.toFixed(2)}.`
      }
      if (bonusesAdded > 0) {
        successMessage += ` Added ${bonusesAdded} bonus${bonusesAdded !== 1 ? 'es' : ''}.`
      }
      
      toast.success(successMessage)
      
      onSuccess()
      onClose()

    } catch (error: any) {
      console.error('[EndCampaign] Error:', error)
      toast.error(error.message || 'Failed to end campaign')
      setShowConfirmation(false)
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
          pb: 1
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon sx={{ color: 'var(--accent-warning, #FFC857)', fontSize: 28 }} />
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                End Campaign
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'var(--text-secondary, #6F7280)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                }}
              >
                {job.title}
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleClose}
            disabled={processing}
            size="small"
            sx={{ color: 'var(--text-secondary, #6F7280)' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <Divider />

      {/* Content */}
      <DialogContent sx={{ pt: 3 }}>
        {/* Blocking: Payments still processing */}
        {hasPendingPayments && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              borderRadius: 'var(--radius-card-lg, 24px)',
              '& .MuiAlert-message': { fontFamily: 'var(--font-body, Satoshi, sans-serif)' }
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              ⚠️ Cannot End Campaign
            </Typography>
            <Typography variant="caption">
              ${(job.social_locked_budget_tokens || 0).toFixed(2)} is locked for payments still processing. 
              Wait a moment and try again.
            </Typography>
          </Alert>
        )}

        {/* Campaign Summary */}
        <Paper
          sx={{
            p: 3,
            mb: 3,
            bgcolor: 'var(--accent-success-soft, #E3F8ED)',
            border: '2px solid var(--accent-success, #36C170)',
            borderRadius: 'var(--radius-card-lg, 24px)'
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
            Campaign Summary
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CheckCircleIcon sx={{ color: 'var(--accent-success, #36C170)', fontSize: 20 }} />
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                <strong>{approvedSubmissions.length}</strong> worker{approvedSubmissions.length !== 1 ? 's' : ''} paid
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <MoneyIcon sx={{ color: 'var(--accent-success, #36C170)', fontSize: 20 }} />
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                <strong>${calculateTotalSpent().toFixed(2)}</strong> total spent
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <TrendingUpIcon sx={{ color: 'var(--accent-success, #36C170)', fontSize: 20 }} />
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                <strong>{calculateAvgImpressions()}</strong> avg impressions
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Optional Bulk Impression Bonuses */}
        {approvedSubmissions.length > 0 && (
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
                <span>Add Final Impression Bonuses</span>
                <Chip
                  label="Optional"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '11px',
                    bgcolor: 'var(--subtle-background, #F7F8FB)',
                    color: 'var(--text-secondary, #6F7280)'
                  }}
                />
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
                Reward top performers with final bonuses based on their engagement metrics
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 400, overflowY: 'auto' }}>
                {approvedSubmissions
                  .sort((a, b) => {
                    // Sort by impressions if available
                    const aImpressions = (a.social_engagement_metrics as any)?.impressions || 0
                    const bImpressions = (b.social_engagement_metrics as any)?.impressions || 0
                    return bImpressions - aImpressions
                  })
                  .map(sub => {
                    const metrics = sub.social_engagement_metrics as any
                    const impressions = metrics?.impressions || 0
                    const likes = metrics?.likes || 0
                    const retweets = metrics?.retweets || 0

                    return (
                      <Box
                        key={sub.id}
                        sx={{
                          p: 2,
                          border: '1px solid var(--border-subtle, #E5E7F0)',
                          borderRadius: '12px',
                          bgcolor: 'var(--card-background, #FFFFFF)'
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
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
                              {sub.worker_wallet.slice(0, 6)}...{sub.worker_wallet.slice(-4)}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'var(--text-secondary, #6F7280)',
                                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                                fontSize: '12px'
                              }}
                            >
                              {sub.social_follower_count_claimed?.toLocaleString()} followers • 
                              Paid: ${sub.social_base_payment_amount_usd || 0}
                              {sub.social_impression_bonus_usd && sub.social_impression_bonus_usd > 0 && (
                                <> + ${sub.social_impression_bonus_usd} bonus</>
                              )}
                            </Typography>
                          </Box>

                          {impressions > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              <Chip
                                label={`${impressions.toLocaleString()} 👁️`}
                                size="small"
                                sx={{
                                  height: 22,
                                  fontSize: '11px',
                                  bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
                                  color: 'var(--accent-primary, #7C4DFF)',
                                  fontWeight: 600
                                }}
                              />
                              {likes > 0 && (
                                <Chip
                                  label={`${likes} ❤️`}
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: '11px',
                                    bgcolor: 'var(--subtle-background, #F7F8FB)',
                                    color: 'var(--text-secondary, #6F7280)'
                                  }}
                                />
                              )}
                              {retweets > 0 && (
                                <Chip
                                  label={`${retweets} 🔄`}
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: '11px',
                                    bgcolor: 'var(--subtle-background, #F7F8FB)',
                                    color: 'var(--text-secondary, #6F7280)'
                                  }}
                                />
                              )}
                            </Box>
                          )}
                        </Box>

                        <TextField
                          label="Additional bonus"
                          type="number"
                          size="small"
                          fullWidth
                          value={bonuses[sub.id] || ''}
                          onChange={(e) => handleBonusChange(sub.id, Number(e.target.value))}
                          InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>
                          }}
                          inputProps={{
                            min: 0,
                            max: 100,
                            step: 0.5
                          }}
                          helperText="$0-$100 per worker"
                          disabled={processing}
                        />
                      </Box>
                    )
                  })}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Budget Breakdown */}
        <Paper
          sx={{
            p: 3,
            mb: 3,
            bgcolor: refund < 0 
              ? 'rgba(244, 67, 54, 0.08)' 
              : 'var(--accent-primary-soft, #EEE7FF)',
            border: `2px solid ${refund < 0 
              ? '#EF4444' 
              : 'var(--accent-primary, #7C4DFF)'}`,
            borderRadius: 'var(--radius-card-lg, 24px)'
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
            Budget Status
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  color: 'var(--text-secondary, #6F7280)'
                }}
              >
                Budget remaining:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                ${remaining.toFixed(2)}
              </Typography>
            </Box>

            {bonusTotal > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    color: 'var(--text-secondary, #6F7280)'
                  }}
                >
                  Final bonuses + fees:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontWeight: 600,
                    color: '#EF4444'
                  }}
                >
                  -${bonusTotal.toFixed(2)}
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 1, bgcolor: 'rgba(124, 77, 255, 0.3)' }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                  fontWeight: 700,
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                Refund to you:
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                  fontWeight: 700,
                  color: refund < 0 
                    ? '#EF4444' 
                    : 'var(--accent-success, #36C170)'
                }}
              >
                ${Math.max(0, refund).toFixed(2)}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Error: Bonuses exceed budget */}
        {refund < 0 && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              borderRadius: 'var(--radius-card-lg, 24px)',
              '& .MuiAlert-message': { fontFamily: 'var(--font-body, Satoshi, sans-serif)' }
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              ⚠️ Bonuses Exceed Budget
            </Typography>
            <Typography variant="caption">
              Total bonuses (${bonusTotal.toFixed(2)}) exceed remaining budget (${remaining.toFixed(2)}). 
              Reduce bonuses to continue.
            </Typography>
          </Alert>
        )}

        {/* Warnings */}
        {!showConfirmation ? (
          <Alert 
            severity="warning" 
            sx={{ 
              borderRadius: 'var(--radius-card-lg, 24px)',
              '& .MuiAlert-message': { fontFamily: 'var(--font-body, Satoshi, sans-serif)' }
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              ⚠️ After ending this campaign:
            </Typography>
            <Box component="ul" sx={{ margin: 0, paddingLeft: 2.5 }}>
              <li>
                <Typography variant="caption">No new submissions will be accepted</Typography>
              </li>
              <li>
                <Typography variant="caption">Pending submissions will NOT be paid</Typography>
              </li>
              <li>
                <Typography variant="caption">You cannot undo this action</Typography>
              </li>
            </Box>
          </Alert>
        ) : (
          <Alert 
            severity="error" 
            sx={{ 
              borderRadius: 'var(--radius-card-lg, 24px)',
              '& .MuiAlert-message': { fontFamily: 'var(--font-body, Satoshi, sans-serif)' }
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              🚨 Final Confirmation Required
            </Typography>
            <Typography variant="caption">
              Are you absolutely sure you want to end this campaign? This action cannot be undone.
              {refund > 0 && <> ${refund.toFixed(2)} will be refunded to your wallet.</>}
            </Typography>
          </Alert>
        )}
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ px: 3, pb: 3 }}>
        {!showConfirmation ? (
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
              onClick={handleEndCampaign}
              disabled={processing || hasPendingPayments || refund < 0}
              sx={{
                bgcolor: 'var(--accent-warning, #FFC857)',
                color: 'var(--text-primary, #1A1A1E)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 600,
                borderRadius: 'var(--radius-control, 999px)',
                px: 4,
                '&:hover': {
                  bgcolor: '#FFB830'
                },
                '&:disabled': {
                  bgcolor: 'var(--text-muted, #A3A7B5)',
                  color: '#FFFFFF'
                }
              }}
            >
              End Campaign
              {refund > 0 && ` & Refund $${refund.toFixed(0)}`}
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={() => setShowConfirmation(false)}
              disabled={processing}
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 600,
                color: 'var(--text-secondary, #6F7280)',
                borderRadius: 'var(--radius-control, 999px)',
                px: 3
              }}
            >
              Go Back
            </Button>
            <Button
              variant="contained"
              onClick={handleEndCampaign}
              disabled={processing}
              sx={{
                bgcolor: '#EF4444',
                color: '#FFFFFF',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 600,
                borderRadius: 'var(--radius-control, 999px)',
                px: 4,
                '&:hover': {
                  bgcolor: '#DC2626'
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
                  <span>Ending...</span>
                </Box>
              ) : (
                'Yes, End Campaign Now'
              )}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

