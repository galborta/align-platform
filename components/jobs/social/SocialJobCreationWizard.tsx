'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { toast } from 'react-hot-toast'
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  CircularProgress,
  Button
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'

import CampaignTypeSelector from './CampaignTypeSelector'
import CampaignConfigForm, { CampaignFormData } from './CampaignConfigForm'
import CampaignConfirmationModal from './CampaignConfirmationModal'
import { SocialJobType } from '@/types/social-jobs'
import { calculateSocialJobTimeline } from '@/lib/social-media-jobs'
import { 
  transferToEscrow, 
  validateEscrowTransfer, 
  calculateEscrowAmount
} from '@/lib/solana/escrow-transfer'
import { validateMinimumUsdValue } from '@/lib/helius'
import { addDays } from 'date-fns'

// ==================== TYPES ====================

interface SocialJobCreationWizardProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
  onSuccess: (jobId: string) => void
  tokenMint: string
  tokenSymbol: string
  tokenPrice: number
  posterWallet: string
}

type WizardStep = 'type_selection' | 'configuration' | 'confirmation' | 'processing' | 'success' | 'error'

interface ErrorState {
  message: string
  details?: string
}

// ==================== CONSTANTS ====================

const PLATFORM_FEE_PERCENTAGE = 5

// ==================== COMPONENT ====================

export default function SocialJobCreationWizard({
  projectId,
  isOpen,
  onClose,
  onSuccess,
  tokenMint,
  tokenSymbol,
  tokenPrice,
  posterWallet
}: SocialJobCreationWizardProps) {
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()

  // ==================== STATE ====================

  const [step, setStep] = useState<WizardStep>('type_selection')
  const [campaignType, setCampaignType] = useState<SocialJobType | null>(null)
  const [formData, setFormData] = useState<CampaignFormData | null>(null)
  const [createdJobId, setCreatedJobId] = useState<string | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)

  // ==================== HANDLERS ====================

  const handleClose = () => {
    if (step !== 'processing') {
      resetWizard()
      onClose()
    }
  }

  const resetWizard = () => {
    setStep('type_selection')
    setCampaignType(null)
    setFormData(null)
    setCreatedJobId(null)
    setError(null)
  }

  const handleTypeSelect = (type: SocialJobType) => {
    setCampaignType(type)
    setStep('configuration')
  }

  const handleConfigSubmit = (data: CampaignFormData) => {
    setFormData(data)
    setStep('confirmation')
  }

  const handleConfigCancel = () => {
    setStep('type_selection')
    setCampaignType(null)
  }

  const handleConfirmationBack = () => {
    setStep('configuration')
  }

  const handleConfirm = async () => {
    if (!formData || !campaignType) return

    setStep('processing')
    setError(null)

    try {
      await createCampaign(formData, campaignType)
    } catch (err) {
      console.error('[Wizard] Campaign creation failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError({
        message: 'Failed to create campaign',
        details: errorMessage
      })
      setStep('error')
    }
  }

  const handleRetry = () => {
    setError(null)
    setStep('confirmation')
  }

  const handleViewCampaign = () => {
    if (createdJobId) {
      onSuccess(createdJobId)
      resetWizard()
      onClose()
    }
  }

  // ==================== API INTEGRATION ====================

  /**
   * Creates the campaign by:
   * 1. Converting form data to budget tiers
   * 2. Locking tokens in escrow
   * 3. Calling the API to create the job
   */
  const createCampaign = async (data: CampaignFormData, type: SocialJobType) => {
    // Validate wallet connection
    if (!publicKey || !connection || !sendTransaction) {
      throw new Error('Please connect your wallet to create a campaign')
    }

    if (!tokenMint) {
      throw new Error('Token mint not configured')
    }

    // Calculate campaign duration end date
    const endDate = addDays(new Date(), data.durationDays)

    // Calculate total budget in tokens (using tokenPrice)
    const totalBudgetTokens = data.totalBudget / tokenPrice

    // Calculate escrow amount (budget + platform fee)
    const escrowAmount = calculateEscrowAmount(totalBudgetTokens, PLATFORM_FEE_PERCENTAGE)

    console.log('[Wizard] Creating campaign:', {
      totalBudgetUSD: data.totalBudget,
      totalBudgetTokens,
      escrowAmount,
      tokenPrice
    })

    // Step 1: Validate minimum USD value ($5)
    toast.loading('Validating budget...', { id: 'wizard' })

    const usdValidation = await validateMinimumUsdValue(tokenMint, totalBudgetTokens, 5)
    if (!usdValidation.valid) {
      throw new Error('Campaign budget must be at least $5 USD')
    }

    // Step 2: Validate wallet balance
    toast.loading('Validating wallet balance...', { id: 'wizard' })

    const balanceValidation = await validateEscrowTransfer(
      connection,
      publicKey,
      new PublicKey(tokenMint),
      escrowAmount,
      9 // Assuming 9 decimals
    )

    if (!balanceValidation.valid) {
      throw new Error(balanceValidation.error || 'Insufficient balance for escrow')
    }

    // Step 3: Transfer tokens to escrow
    toast.loading('Locking budget in escrow...', { id: 'wizard' })

    const transferResult = await transferToEscrow(
      {
        connection,
        senderWallet: publicKey,
        tokenMint: new PublicKey(tokenMint),
        amount: escrowAmount,
        decimals: 9,
        tokenSymbol: tokenSymbol,
        jobTitle: data.title.trim(),
        workerPayment: totalBudgetTokens
      },
      sendTransaction
    )

    if (!transferResult.success) {
      throw new Error(transferResult.error || 'Failed to lock tokens in escrow')
    }

    const escrowTxSignature = transferResult.signature
    console.log('[Wizard] Escrow locked:', escrowTxSignature)

    // Step 4: Calculate timeline (auto-calculated based on current time)
    const timeline = calculateSocialJobTimeline(new Date())

    // Step 5: Create job via API
    toast.loading('Creating campaign...', { id: 'wizard' })

    const jobPayload = {
      project_id: projectId,
      poster_wallet: posterWallet,
      title: data.title.trim(),
      description: data.campaignGuidelines.trim() || 'Follow campaign guidelines',
      kpis: data.campaignGuidelines.trim() || 'Follow campaign guidelines',
      category: 'marketing',
      // Escrow fields
      escrow_locked: true,
      escrow_tx_signature: escrowTxSignature,
      escrow_amount_tokens: escrowAmount,
      escrow_token_mint: tokenMint,
      fee_percentage_at_creation: PLATFORM_FEE_PERCENTAGE,
      // Social media job fields
      is_social_media_job: true,
      social_job_type: type,
      social_tweet_url: type === 'retweet' ? data.sourceTweetUrl.trim() : null,
      social_tweet_topic: type === 'original_tweet' ? data.title.trim() : null,
      social_submission_deadline: timeline.submission_deadline.toISOString(),
      social_engagement_deadline: timeline.engagement_deadline.toISOString(),
      social_review_deadline: timeline.review_deadline.toISOString(),
      social_total_budget_tokens: totalBudgetTokens,
      social_total_budget_usd: data.totalBudget,
      social_budget_tiers: data.followerTiers,
      social_min_followers_required: data.followerTiers[0]?.min_followers || 0,
      social_payments_distributed: false,
      campaign_duration_days: data.durationDays, // Required by API
      // Regular job fields (required by schema but not used for social jobs)
      // Set to total budget to satisfy NOT NULL and > 0 constraints
      payment_amount_tokens: totalBudgetTokens,
      payment_amount_usd: data.totalBudget,
      assignment_mode: 'review',
      status: 'open',
      token_symbol: tokenSymbol
    }

    const response = await fetch('/api/jobs/social/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobPayload)
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to create campaign')
    }

    const createdJob = result.job
    console.log('[Wizard] Created job:', createdJob.id)

    toast.success('Campaign created successfully!', { id: 'wizard' })

    setCreatedJobId(createdJob.id)
    setStep('success')

    // Auto-close and redirect after 2 seconds
    setTimeout(() => {
      handleViewCampaign()
    }, 2000)
  }

  // ==================== RENDER ====================

  return (
    <>
      {/* Step 1: Type Selection */}
      {step === 'type_selection' && (
        <CampaignTypeSelector
          open={isOpen && step === 'type_selection'}
          onClose={handleClose}
          onSelect={handleTypeSelect}
        />
      )}

      {/* Step 2: Configuration Form */}
      {step === 'configuration' && campaignType && (
        <Dialog
          open={isOpen && step === 'configuration'}
          onClose={handleClose}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 'var(--radius-card-lg, 24px)',
              bgcolor: 'var(--card-background, #FFFFFF)',
              maxHeight: '90vh'
            }
          }}
        >
          <DialogContent sx={{ p: 4 }}>
            <Typography
              variant="h5"
              sx={{
                fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 1
              }}
            >
              {campaignType === 'retweet' ? 'Retweet Campaign' : 'Original Tweet Campaign'}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                color: 'var(--text-secondary, #6F7280)',
                mb: 3
              }}
            >
              Configure your campaign details below
            </Typography>

            <CampaignConfigForm
              campaignType={campaignType}
              projectId={projectId}
              tokenSymbol={tokenSymbol}
              tokenPrice={tokenPrice}
              onSubmit={handleConfigSubmit}
              onCancel={handleConfigCancel}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Step 3: Confirmation */}
      {step === 'confirmation' && formData && campaignType && (
        <CampaignConfirmationModal
          open={isOpen && step === 'confirmation'}
          formData={formData}
          campaignType={campaignType}
          onConfirm={handleConfirm}
          onBack={handleConfirmationBack}
        />
      )}

      {/* Step 4: Processing */}
      {step === 'processing' && (
        <Dialog
          open={isOpen && step === 'processing'}
          disableEscapeKeyDown
          PaperProps={{
            sx: {
              borderRadius: 'var(--radius-card-lg, 24px)',
              bgcolor: 'var(--card-background, #FFFFFF)',
              p: 4,
              textAlign: 'center',
              minWidth: '300px'
            }
          }}
        >
          <DialogContent>
            <CircularProgress
              size={60}
              sx={{
                color: 'var(--accent-primary, #7C4DFF)',
                mb: 3
              }}
            />
            <Typography
              sx={{
                fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 1
              }}
            >
              Creating your campaign...
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '14px',
                color: 'var(--text-secondary, #6F7280)'
              }}
            >
              This may take a few moments. Please don't close this window.
            </Typography>
          </DialogContent>
        </Dialog>
      )}

      {/* Step 5: Success */}
      {step === 'success' && (
        <Dialog
          open={isOpen && step === 'success'}
          onClose={handleViewCampaign}
          PaperProps={{
            sx: {
              borderRadius: 'var(--radius-card-lg, 24px)',
              bgcolor: 'var(--card-background, #FFFFFF)',
              p: 4,
              textAlign: 'center',
              minWidth: '300px'
            }
          }}
        >
          <DialogContent>
            <CheckCircleIcon
              sx={{
                fontSize: 60,
                color: 'var(--accent-success, #36C170)',
                mb: 2
              }}
            />
            <Typography
              sx={{
                fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 1
              }}
            >
              Campaign created successfully!
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '14px',
                color: 'var(--text-secondary, #6F7280)',
                mb: 3
              }}
            >
              Redirecting you to the campaign...
            </Typography>
            <Button
              variant="contained"
              onClick={handleViewCampaign}
              sx={{
                bgcolor: 'var(--accent-primary, #7C4DFF)',
                color: '#FFFFFF',
                textTransform: 'none',
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontWeight: 600,
                px: 4,
                py: 1.25,
                borderRadius: 'var(--radius-control, 999px)',
                '&:hover': {
                  bgcolor: '#6A3FE8'
                }
              }}
            >
              View Campaign
            </Button>
          </DialogContent>
        </Dialog>
      )}

      {/* Step 6: Error */}
      {step === 'error' && error && (
        <Dialog
          open={isOpen && step === 'error'}
          onClose={handleClose}
          PaperProps={{
            sx: {
              borderRadius: 'var(--radius-card-lg, 24px)',
              bgcolor: 'var(--card-background, #FFFFFF)',
              p: 4,
              textAlign: 'center',
              minWidth: '300px'
            }
          }}
        >
          <DialogContent>
            <ErrorIcon
              sx={{
                fontSize: 60,
                color: '#EF4444',
                mb: 2
              }}
            />
            <Typography
              sx={{
                fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 1
              }}
            >
              {error.message}
            </Typography>
            {error.details && (
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi), sans-serif',
                  fontSize: '13px',
                  color: 'var(--text-secondary, #6F7280)',
                  mb: 3,
                  p: 2,
                  bgcolor: 'var(--subtle-background, #F7F8FB)',
                  borderRadius: '8px'
                }}
              >
                {error.details}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 3 }}>
              <Button
                onClick={handleClose}
                sx={{
                  color: 'var(--text-secondary, #6F7280)',
                  textTransform: 'none',
                  fontFamily: 'var(--font-body, Satoshi), sans-serif',
                  fontWeight: 600,
                  px: 3,
                  py: 1,
                  borderRadius: 'var(--radius-control, 999px)',
                  '&:hover': {
                    bgcolor: 'var(--subtle-background, #F7F8FB)'
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleRetry}
                sx={{
                  bgcolor: 'var(--accent-primary, #7C4DFF)',
                  color: '#FFFFFF',
                  textTransform: 'none',
                  fontFamily: 'var(--font-body, Satoshi), sans-serif',
                  fontWeight: 600,
                  px: 4,
                  py: 1.25,
                  borderRadius: 'var(--radius-control, 999px)',
                  '&:hover': {
                    bgcolor: '#6A3FE8'
                  }
                }}
              >
                Retry
              </Button>
            </Box>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

