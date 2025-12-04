'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  FormControlLabel,
  Typography,
  Box,
  Alert,
  IconButton,
  Chip
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CampaignIcon from '@mui/icons-material/Campaign'
import RepeatIcon from '@mui/icons-material/Repeat'
import CreateIcon from '@mui/icons-material/Create'
import InfoIcon from '@mui/icons-material/Info'
import ScheduleIcon from '@mui/icons-material/Schedule'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { toast } from 'react-hot-toast'
import { BudgetTier, SocialJobType } from '@/types/social-media-jobs'
import { calculateSocialJobTimeline, validateBudgetTiers } from '@/lib/social-media-jobs'
import { getTokenPriceUsd, validateMinimumUsdValue } from '@/lib/helius'
import { transferToEscrow, validateEscrowTransfer, calculateEscrowAmount } from '@/lib/solana/escrow-transfer'
import { getFeePercentage } from '@/lib/platform-settings'
import { supabase } from '@/lib/supabase'
import TierBudgetConfig from './TierBudgetConfig'

// ==================== TYPES ====================

interface CreateSocialMediaJobModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  posterWallet: string
  tokenMint?: string
  tokenSymbol?: string
  onJobCreated?: () => void
}

// ==================== COMPONENT ====================

export default function CreateSocialMediaJobModal({
  open,
  onClose,
  projectId,
  posterWallet,
  tokenMint = '',
  tokenSymbol = 'TOKEN',
  onJobCreated
}: CreateSocialMediaJobModalProps) {
  // ==================== WALLET HOOKS ====================
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()

  // ==================== STATE ====================
  
  // Basic job info
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('marketing')
  
  // Social job specific
  const [socialJobType, setSocialJobType] = useState<SocialJobType>('retweet')
  const [tweetUrl, setTweetUrl] = useState('')
  const [tweetTopic, setTweetTopic] = useState('')
  const [guidelines, setGuidelines] = useState('')
  const [minFollowersRequired, setMinFollowersRequired] = useState<number | null>(null)
  
  // Budget configuration
  const [maxBudget, setMaxBudget] = useState<number>(0)
  const [tiers, setTiers] = useState<BudgetTier[]>([
    { min_participants: 1, max_participants: 5, budget_tokens: 0, budget_usd: 0 },
    { min_participants: 6, max_participants: null, budget_tokens: 0, budget_usd: 0 }
  ])
  const [selectedToken, setSelectedToken] = useState<string>(tokenMint)
  const [tokenPrice, setTokenPrice] = useState<number | null>(null)
  const [loadingPrice, setLoadingPrice] = useState(false)
  
  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  
  // Escrow and submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feePercentage, setFeePercentage] = useState<number>(5)

  // ==================== EFFECTS ====================

  // Fetch token price when modal opens or token changes
  useEffect(() => {
    const fetchTokenPrice = async () => {
      if (!open || !tokenMint) return
      
      setLoadingPrice(true)
      try {
        const price = await getTokenPriceUsd(tokenMint)
        if (price !== null) {
          setTokenPrice(price)
          // Update existing tier budgets with new price
          setTiers(prevTiers => prevTiers.map(tier => ({
            ...tier,
            budget_usd: tier.budget_tokens * price
          })))
        } else {
          // Fallback to a default if price fetch fails
          console.warn('Could not fetch token price, using fallback')
          setTokenPrice(0.01) // Fallback to $0.01
        }
      } catch (error) {
        console.error('Error fetching token price:', error)
        setTokenPrice(0.01) // Fallback to $0.01
      } finally {
        setLoadingPrice(false)
      }
    }

    fetchTokenPrice()
  }, [open, tokenMint])

  // Fetch platform fee percentage
  useEffect(() => {
    const fetchFeePercentage = async () => {
      if (!open) return
      try {
        const fee = await getFeePercentage()
        setFeePercentage(fee)
      } catch (error) {
        console.error('Error fetching fee percentage:', error)
        setFeePercentage(5) // Default to 5%
      }
    }
    fetchFeePercentage()
  }, [open])

  // ==================== VALIDATION ====================

  /**
   * Validates a Twitter/X URL
   * Accepts both twitter.com and x.com formats
   */
  const isValidTweetUrl = (url: string): boolean => {
    if (!url) return false
    const twitterPattern = /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/\w+\/status\/\d+/i
    return twitterPattern.test(url)
  }

  /**
   * Validates all form fields and sets error messages
   * @returns true if form is valid, false otherwise
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Title validation: 5-100 characters
    if (!title.trim()) {
      newErrors.title = 'Campaign title is required'
    } else if (title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters'
    } else if (title.trim().length > 100) {
      newErrors.title = 'Title must be 100 characters or less'
    }

    // Description validation: 20-2000 characters
    if (!description.trim()) {
      newErrors.description = 'Campaign description is required'
    } else if (description.trim().length < 20) {
      newErrors.description = 'Description must be at least 20 characters'
    } else if (description.trim().length > 2000) {
      newErrors.description = 'Description must be 2000 characters or less'
    }

    // Type-specific validation
    if (socialJobType === 'retweet') {
      // Tweet URL validation
      if (!tweetUrl.trim()) {
        newErrors.tweetUrl = 'Tweet URL is required for retweet campaigns'
      } else if (!isValidTweetUrl(tweetUrl)) {
        newErrors.tweetUrl = 'Please enter a valid Twitter/X URL (e.g., https://twitter.com/user/status/123)'
      }
    } else if (socialJobType === 'original_tweet') {
      // Tweet topic validation: 50-500 characters
      if (!tweetTopic.trim()) {
        newErrors.tweetTopic = 'Tweet topic is required for original tweet campaigns'
      } else if (tweetTopic.trim().length < 50) {
        newErrors.tweetTopic = 'Topic must be at least 50 characters - be specific about requirements'
      } else if (tweetTopic.trim().length > 500) {
        newErrors.tweetTopic = 'Topic must be 500 characters or less'
      }
    }

    // Guidelines validation (optional, but max 1000 chars if provided)
    if (guidelines.length > 1000) {
      newErrors.guidelines = 'Guidelines must be 1000 characters or less'
    }

    // Budget validation
    if (maxBudget <= 0) {
      newErrors.maxBudget = 'Maximum budget must be greater than 0'
    }

    // Tier validation
    if (tiers.length === 0) {
      newErrors.tiers = 'At least one budget tier is required'
    } else {
      // Check if any tier has a budget
      const hasValidBudget = tiers.some(tier => tier.budget_tokens > 0)
      if (!hasValidBudget) {
        newErrors.tiers = 'At least one tier must have a budget greater than 0'
      } else {
        try {
          validateBudgetTiers(tiers, maxBudget)
        } catch (error: any) {
          newErrors.tiers = error.message
        }
      }
    }

    // Token selection validation
    if (!selectedToken) {
      newErrors.token = 'Please select a payment token'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  /**
   * Real-time validation for individual fields
   */
  const validateField = (field: string, value: string) => {
    const newErrors = { ...errors }

    switch (field) {
      case 'title':
        if (value.trim().length > 0 && value.trim().length < 5) {
          newErrors.title = 'Title must be at least 5 characters'
        } else {
          delete newErrors.title
        }
        break
      case 'description':
        if (value.trim().length > 0 && value.trim().length < 20) {
          newErrors.description = 'Description must be at least 20 characters'
        } else {
          delete newErrors.description
        }
        break
      case 'tweetUrl':
        if (value.trim().length > 0 && !isValidTweetUrl(value)) {
          newErrors.tweetUrl = 'Please enter a valid Twitter/X URL'
        } else {
          delete newErrors.tweetUrl
        }
        break
      case 'tweetTopic':
        if (value.trim().length > 0 && value.trim().length < 50) {
          newErrors.tweetTopic = 'Topic must be at least 50 characters'
        } else {
          delete newErrors.tweetTopic
        }
        break
    }

    setErrors(newErrors)
  }

  // ==================== HANDLERS ====================

  const handleClose = () => {
    if (!loading) {
      resetForm()
      onClose()
    }
  }

  const handleTitleChange = (value: string) => {
    setTitle(value)
    validateField('title', value)
  }

  const handleDescriptionChange = (value: string) => {
    setDescription(value)
    validateField('description', value)
  }

  const handleTweetUrlChange = (value: string) => {
    setTweetUrl(value)
    validateField('tweetUrl', value)
  }

  const handleTweetTopicChange = (value: string) => {
    setTweetTopic(value)
    validateField('tweetTopic', value)
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setCategory('marketing')
    setSocialJobType('retweet')
    setTweetUrl('')
    setTweetTopic('')
    setGuidelines('')
    setMinFollowersRequired(null)
    setMaxBudget(0)
    setTiers([
      { min_participants: 1, max_participants: 5, budget_tokens: 0, budget_usd: 0 },
      { min_participants: 6, max_participants: null, budget_tokens: 0, budget_usd: 0 }
    ])
    setErrors({})
    setLoading(false)
    // Don't reset tokenPrice here - it will be refetched when modal opens again
  }

  // Check if form can be submitted (basic validation for button state)
  const canSubmit = (): boolean => {
    const hasTitle = title.trim().length >= 5
    const hasDescription = description.trim().length >= 20
    const hasTypeSpecificContent = socialJobType === 'retweet' 
      ? isValidTweetUrl(tweetUrl)
      : tweetTopic.trim().length >= 50
    const hasBudget = maxBudget > 0
    const hasValidTiers = tiers.length > 0 && tiers.some(tier => tier.budget_tokens > 0)
    const hasToken = !!selectedToken
    const hasPrice = tokenPrice !== null && tokenPrice > 0
    
    return hasTitle && hasDescription && hasTypeSpecificContent && hasBudget && hasValidTiers && hasToken && hasPrice && Object.keys(errors).length === 0
  }

  // ==================== CAMPAIGN CREATION ====================

  /**
   * Creates the social media campaign with escrow locking
   * 
   * Flow:
   * 1. Validate form data
   * 2. Validate wallet connection and balance
   * 3. Transfer max budget to escrow (with platform fee)
   * 4. Create job in database via API
   * 5. Log escrow transaction
   * 6. Show success and close modal
   */
  const handleCreateCampaign = async () => {
    // Step 0: Final validation
    if (!validateForm()) {
      toast.error('Please fix the form errors before submitting')
      return
    }

    if (!publicKey || !connection || !sendTransaction) {
      toast.error('Please connect your wallet to create a campaign')
      return
    }

    if (!tokenMint) {
      toast.error('Token mint not configured')
      return
    }

    setIsSubmitting(true)
    let escrowTxSignature: string | undefined

    try {
      // Step 1: Calculate escrow amount (max tier budget + platform fee)
      const maxTierBudget = Math.max(...tiers.map(t => t.budget_tokens))
      const totalEscrowAmount = calculateEscrowAmount(maxTierBudget, feePercentage)

      console.log(`[Social Campaign] Max tier budget: ${maxTierBudget}`)
      console.log(`[Social Campaign] Fee percentage: ${feePercentage}%`)
      console.log(`[Social Campaign] Total escrow (with fee): ${totalEscrowAmount}`)

      // Step 2: Validate minimum USD value ($5)
      const usdValidation = await validateMinimumUsdValue(tokenMint, maxTierBudget, 5)
      if (!usdValidation.valid) {
        toast.error('Maximum budget must be at least $5 USD')
        setIsSubmitting(false)
        return
      }

      // Step 3: Validate wallet has sufficient balance
      toast.loading('Validating wallet balance...', { id: 'social-campaign' })

      const balanceValidation = await validateEscrowTransfer(
        connection,
        publicKey,
        new PublicKey(tokenMint),
        totalEscrowAmount,
        9 // Assuming 9 decimals
      )

      if (!balanceValidation.valid) {
        toast.dismiss('social-campaign')
        toast.error(balanceValidation.error || 'Insufficient balance for escrow')
        setIsSubmitting(false)
        return
      }

      // Step 4: Transfer tokens to escrow
      toast.loading('Locking tokens in escrow...', { id: 'social-campaign' })

      const transferResult = await transferToEscrow(
        {
          connection,
          senderWallet: publicKey,
          tokenMint: new PublicKey(tokenMint),
          amount: totalEscrowAmount,
          decimals: 9,
          tokenSymbol: tokenSymbol,
          jobTitle: title.trim(),
          workerPayment: maxTierBudget
        },
        sendTransaction
      )

      if (!transferResult.success) {
        toast.dismiss('social-campaign')
        toast.error(transferResult.error || 'Failed to lock tokens in escrow')
        setIsSubmitting(false)
        return
      }

      escrowTxSignature = transferResult.signature
      console.log(`[Social Campaign] Escrow locked: ${escrowTxSignature}`)

      // Step 5: Calculate timeline
      const timeline = calculateSocialJobTimeline(new Date())

      // Step 6: Create job via API
      toast.loading('Creating campaign...', { id: 'social-campaign' })

      const jobPayload = {
        project_id: projectId,
        poster_wallet: posterWallet,
        title: title.trim(),
        description: description.trim(),
        kpis: guidelines.trim() || 'Follow campaign guidelines',
        category: 'marketing',
        // Escrow fields
        escrow_locked: true,
        escrow_tx_signature: escrowTxSignature,
        escrow_amount_tokens: totalEscrowAmount,
        escrow_token_mint: tokenMint,
        fee_percentage_at_creation: feePercentage,
        // Social media job fields
        is_social_media_job: true,
        social_job_type: socialJobType,
        social_tweet_url: socialJobType === 'retweet' ? tweetUrl.trim() : null,
        social_tweet_topic: socialJobType === 'original_tweet' ? tweetTopic.trim() : null,
        social_submission_deadline: timeline.submission_deadline.toISOString(),
        social_engagement_deadline: timeline.engagement_deadline.toISOString(),
        social_review_deadline: timeline.review_deadline.toISOString(),
        social_total_budget_tokens: maxTierBudget,
        social_total_budget_usd: maxTierBudget * (tokenPrice || 0),
        social_budget_tiers: tiers,
        social_min_followers_required: minFollowersRequired,
        social_payments_distributed: false,
        // Regular job fields (not used for social jobs but required by schema)
        payment_amount_tokens: maxTierBudget,
        payment_amount_usd: maxTierBudget * (tokenPrice || 0),
        assignment_mode: 'review',
        status: 'open',
        token_symbol: tokenSymbol
      }

      const response = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobPayload)
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create campaign')
      }

      const createdJob = result.job
      console.log(`[Social Campaign] Created job: ${createdJob.id}`)

      // Step 7: Log escrow transaction
      try {
        await supabase.from('job_escrow_transactions').insert({
          job_id: createdJob.id,
          transaction_type: 'lock',
          from_wallet: posterWallet,
          to_wallet: transferResult.escrowWallet,
          amount_tokens: totalEscrowAmount,
          token_mint: tokenMint,
          token_symbol: tokenSymbol,
          tx_signature: escrowTxSignature,
          status: 'confirmed',
          confirmed_at: new Date().toISOString()
        })
      } catch (logError) {
        console.error('[Social Campaign] Failed to log escrow transaction:', logError)
        // Non-critical - job is already created
      }

      // Step 8: Success!
      toast.dismiss('social-campaign')
      toast.success(
        `🎉 Campaign created! ${totalEscrowAmount.toFixed(2)} ${tokenSymbol} locked in escrow`,
        { duration: 5000 }
      )

      // Reset form and close modal
      resetForm()
      onClose()
      
      // Notify parent component
      if (onJobCreated) {
        onJobCreated()
      }

    } catch (error: any) {
      console.error('[Social Campaign] Error:', error)
      toast.dismiss('social-campaign')
      
      if (escrowTxSignature) {
        // Escrow was locked but job creation failed
        toast.error(
          `Campaign creation failed after escrow lock. Transaction: ${escrowTxSignature.slice(0, 20)}... Contact support.`,
          { duration: 10000 }
        )
      } else {
        toast.error(error.message || 'Failed to create campaign')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // ==================== RENDER ====================

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { 
          borderRadius: '16px',
          maxHeight: '90vh',
          bgcolor: 'var(--card-background, #FFFFFF)'
        }
      }}
    >
      {/* ==================== HEADER ==================== */}
      <DialogTitle 
        sx={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--text-primary, #1A1A1E)',
          borderBottom: '1px solid var(--border-subtle, #E5E7F0)',
          pb: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CampaignIcon sx={{ color: 'var(--accent-primary, #7C4DFF)', fontSize: 28 }} />
          <span>Create Social Media Campaign</span>
        </Box>
        <IconButton 
          onClick={handleClose}
          disabled={loading}
          sx={{ color: 'var(--text-secondary, #6F7280)' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      {/* ==================== CONTENT ==================== */}
      <DialogContent sx={{ pt: 3 }}>
        
        {/* Info Alert */}
        <Alert 
          severity="info" 
          icon={<InfoIcon />}
          sx={{ 
            mb: 3,
            bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
            color: 'var(--text-primary, #1A1A1E)',
            '& .MuiAlert-icon': {
              color: 'var(--accent-primary, #7C4DFF)'
            },
            borderRadius: '12px'
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Social media campaigns pay participants proportionally based on their post reach and engagement.
            Budget is distributed after the review period ends.
          </Typography>
        </Alert>

        {/* ==================== BASIC INFO SECTION ==================== */}
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)',
              mb: 2
            }}
          >
            Campaign Details
          </Typography>

          <TextField
            fullWidth
            label="Campaign Title"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="e.g., Retweet Our Token Launch Announcement"
            helperText={errors.title || `${title.length}/100 characters (min 5)`}
            error={!!errors.title}
            sx={{ 
              mb: 2.5,
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                '&:hover fieldset': {
                  borderColor: 'var(--accent-primary, #7C4DFF)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'var(--accent-primary, #7C4DFF)',
                }
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: 'var(--accent-primary, #7C4DFF)'
              },
              '& .MuiFormHelperText-root': {
                color: errors.title ? 'error.main' : 'var(--text-secondary, #6F7280)'
              }
            }}
            inputProps={{ maxLength: 100 }}
          />
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Campaign Description"
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Describe what participants should do, any hashtags to include, and what makes a quality submission..."
            helperText={errors.description || `${description.length}/2000 characters (min 20)`}
            error={!!errors.description}
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                '&:hover fieldset': {
                  borderColor: 'var(--accent-primary, #7C4DFF)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'var(--accent-primary, #7C4DFF)',
                }
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: 'var(--accent-primary, #7C4DFF)'
              },
              '& .MuiFormHelperText-root': {
                color: errors.description ? 'error.main' : 'var(--text-secondary, #6F7280)'
              }
            }}
            inputProps={{ maxLength: 2000 }}
          />
        </Box>

        {/* ==================== CAMPAIGN TYPE SECTION ==================== */}
        <Box 
          sx={{ 
            mb: 4,
            p: 3,
            bgcolor: 'var(--subtle-background, #F7F8FB)',
            borderRadius: '16px'
          }}
        >
          <Typography 
            variant="h6" 
            sx={{ 
              fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)',
              mb: 2
            }}
          >
            Campaign Type
          </Typography>

          <FormControl component="fieldset" fullWidth>
            <RadioGroup
              value={socialJobType}
              onChange={(e) => setSocialJobType(e.target.value as SocialJobType)}
            >
              {/* Retweet Option */}
              <Box
                sx={{
                  border: socialJobType === 'retweet' 
                    ? '2px solid var(--accent-primary, #7C4DFF)' 
                    : '1px solid var(--border-subtle, #E5E7F0)',
                  borderRadius: '12px',
                  p: 2,
                  mb: 2,
                  bgcolor: socialJobType === 'retweet' 
                    ? 'var(--accent-primary-soft, #EEE7FF)' 
                    : 'var(--card-background, #FFFFFF)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setSocialJobType('retweet')}
              >
                <FormControlLabel
                  value="retweet"
                  control={
                    <Radio 
                      sx={{
                        color: 'var(--text-secondary, #6F7280)',
                        '&.Mui-checked': {
                          color: 'var(--accent-primary, #7C4DFF)'
                        }
                      }}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <RepeatIcon sx={{ color: 'var(--accent-primary, #7C4DFF)' }} />
                      <Box>
                        <Typography 
                          sx={{ 
                            fontWeight: 600, 
                            color: 'var(--text-primary, #1A1A1E)' 
                          }}
                        >
                          Retweet Campaign
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ color: 'var(--text-secondary, #6F7280)' }}
                        >
                          Participants retweet/share your existing tweet
                        </Typography>
                      </Box>
                    </Box>
                  }
                  sx={{ m: 0, width: '100%' }}
                />
              </Box>

              {/* Original Tweet Option */}
              <Box
                sx={{
                  border: socialJobType === 'original_tweet' 
                    ? '2px solid var(--accent-primary, #7C4DFF)' 
                    : '1px solid var(--border-subtle, #E5E7F0)',
                  borderRadius: '12px',
                  p: 2,
                  bgcolor: socialJobType === 'original_tweet' 
                    ? 'var(--accent-primary-soft, #EEE7FF)' 
                    : 'var(--card-background, #FFFFFF)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setSocialJobType('original_tweet')}
              >
                <FormControlLabel
                  value="original_tweet"
                  control={
                    <Radio 
                      sx={{
                        color: 'var(--text-secondary, #6F7280)',
                        '&.Mui-checked': {
                          color: 'var(--accent-primary, #7C4DFF)'
                        }
                      }}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CreateIcon sx={{ color: 'var(--accent-primary, #7C4DFF)' }} />
                      <Box>
                        <Typography 
                          sx={{ 
                            fontWeight: 600, 
                            color: 'var(--text-primary, #1A1A1E)' 
                          }}
                        >
                          Original Tweet Campaign
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ color: 'var(--text-secondary, #6F7280)' }}
                        >
                          Participants create original content about your topic
                        </Typography>
                      </Box>
                    </Box>
                  }
                  sx={{ m: 0, width: '100%' }}
                />
              </Box>
            </RadioGroup>
          </FormControl>
        </Box>

        {/* ==================== CONDITIONAL FIELDS SECTION ==================== */}
        
        {/* Conditional: Retweet Campaign */}
        {socialJobType === 'retweet' && (
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="h6" 
              sx={{ 
                fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 2
              }}
            >
              Tweet to Retweet
            </Typography>

            <TextField
              fullWidth
              label="Tweet URL to Retweet"
              value={tweetUrl}
              onChange={(e) => handleTweetUrlChange(e.target.value)}
              placeholder="https://twitter.com/yourproject/status/123456789..."
              helperText={errors.tweetUrl || "Paste the full URL of the tweet you want users to retweet (twitter.com or x.com)"}
              error={!!errors.tweetUrl}
              sx={{ 
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  '&:hover fieldset': {
                    borderColor: 'var(--accent-primary, #7C4DFF)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'var(--accent-primary, #7C4DFF)',
                  }
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: 'var(--accent-primary, #7C4DFF)'
                },
                '& .MuiFormHelperText-root': {
                  color: errors.tweetUrl ? 'error.main' : 'var(--text-secondary, #6F7280)'
                }
              }}
            />
            
            {/* Tweet URL validation indicator */}
            {tweetUrl && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                {isValidTweetUrl(tweetUrl) ? (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'var(--accent-success, #36C170)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5
                    }}
                  >
                    ✓ Valid Twitter/X URL
                  </Typography>
                ) : (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'error.main',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5
                    }}
                  >
                    ✗ Invalid URL format
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        )}

        {/* Conditional: Original Tweet Campaign */}
        {socialJobType === 'original_tweet' && (
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="h6" 
              sx={{ 
                fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 2
              }}
            >
              Tweet Topic & Instructions
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Tweet Topic/Instructions"
              value={tweetTopic}
              onChange={(e) => handleTweetTopicChange(e.target.value)}
              placeholder={`e.g., "Tweet about why you're excited for our token launch. Must mention @ourproject and use #TokenLaunch. Share your genuine thoughts on our roadmap and what feature excites you most."`}
              helperText={errors.tweetTopic || "50-500 characters - Be specific about requirements"}
              error={!!errors.tweetTopic}
              inputProps={{ maxLength: 500 }}
              sx={{ 
                mb: 1,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  '&:hover fieldset': {
                    borderColor: 'var(--accent-primary, #7C4DFF)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'var(--accent-primary, #7C4DFF)',
                  }
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: 'var(--accent-primary, #7C4DFF)'
                },
                '& .MuiFormHelperText-root': {
                  color: errors.tweetTopic ? 'error.main' : 'var(--text-secondary, #6F7280)'
                }
              }}
            />
            
            {/* Character counter with color coding */}
            <Typography 
              variant="caption" 
              sx={{ 
                display: 'block', 
                textAlign: 'right',
                color: tweetTopic.length < 50 
                  ? 'var(--accent-warning, #FFC857)' 
                  : tweetTopic.length > 450 
                    ? 'var(--accent-warning, #FFC857)' 
                    : 'var(--text-secondary, #6F7280)',
                fontWeight: tweetTopic.length < 50 ? 500 : 400
              }}
            >
              {tweetTopic.length}/500 characters
              {tweetTopic.length > 0 && tweetTopic.length < 50 && (
                <span style={{ marginLeft: '8px' }}>
                  ({50 - tweetTopic.length} more needed)
                </span>
              )}
            </Typography>
          </Box>
        )}

        {/* ==================== ADDITIONAL GUIDELINES (Both Types) ==================== */}
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)',
              mb: 2
            }}
          >
            Additional Guidelines (Optional)
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Additional Guidelines"
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
            placeholder={`• Must be authentic and engaging\n• No spam or bot-like content\n• Include specific hashtags: #YourHashtag\n• Tag @yourproject in the tweet`}
            helperText={errors.guidelines || `${guidelines.length}/1000 characters - Optional extra requirements or guidelines`}
            error={!!errors.guidelines}
            inputProps={{ maxLength: 1000 }}
            sx={{ 
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                '&:hover fieldset': {
                  borderColor: 'var(--accent-primary, #7C4DFF)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'var(--accent-primary, #7C4DFF)',
                }
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: 'var(--accent-primary, #7C4DFF)'
              },
              '& .MuiFormHelperText-root': {
                color: errors.guidelines ? 'error.main' : 'var(--text-secondary, #6F7280)'
              }
            }}
          />
        </Box>

        {/* ==================== TIER BUDGET CONFIGURATION ==================== */}
        <Box sx={{ mb: 4 }}>
          {loadingPrice ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary, #6F7280)' }}>
                Fetching token price...
              </Typography>
            </Box>
          ) : tokenPrice === null ? (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: '12px' }}>
              Could not fetch token price. Please try again later.
            </Alert>
          ) : (
            <>
              {/* Token Price Display */}
              <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary, #6F7280)' }}>
                  Current {tokenSymbol} price: <strong>${tokenPrice.toFixed(6)}</strong> USD
                </Typography>
              </Box>
              
              <TierBudgetConfig
                tiers={tiers}
                maxBudget={maxBudget}
                maxBudgetUsd={maxBudget * tokenPrice}
                onTiersChange={setTiers}
                onMaxBudgetChange={(tokens, usd) => setMaxBudget(tokens)}
                tokenSymbol={tokenSymbol}
                tokenPrice={tokenPrice}
              />
            </>
          )}
        </Box>

        {/* Tier Validation Error */}
        {errors.tiers && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              borderRadius: '12px'
            }}
          >
            {errors.tiers}
          </Alert>
        )}

        {/* Budget Validation Error */}
        {errors.maxBudget && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              borderRadius: '12px'
            }}
          >
            {errors.maxBudget}
          </Alert>
        )}

        {/* ==================== CAMPAIGN TIMELINE (AUTO-CALCULATED) ==================== */}
        <Box 
          sx={{ 
            p: 3,
            bgcolor: 'rgba(227, 240, 111, 0.15)',
            borderRadius: '16px',
            border: '1px solid rgba(227, 240, 111, 0.4)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <ScheduleIcon sx={{ color: 'var(--accent-secondary, #C5D94E)', fontSize: 24 }} />
            <Typography 
              variant="h6" 
              sx={{ 
                fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
              }}
            >
              Campaign Timeline
            </Typography>
            <Chip 
              label="Auto-calculated" 
              size="small"
              sx={{ 
                bgcolor: 'rgba(227, 240, 111, 0.3)',
                color: 'var(--text-primary, #1A1A1E)',
                fontWeight: 500,
                fontSize: '11px'
              }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box 
                sx={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: '50%', 
                  bgcolor: 'var(--accent-primary, #7C4DFF)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                1
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--text-primary, #1A1A1E)' }}>
                  Submission Period
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary, #6F7280)' }}>
                  Hours 0-48: Users submit their tweets
                </Typography>
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box 
                sx={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: '50%', 
                  bgcolor: 'var(--accent-primary, #7C4DFF)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                2
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--text-primary, #1A1A1E)' }}>
                  Engagement Period
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary, #6F7280)' }}>
                  Hours 48-72: Engagement metrics accumulate
                </Typography>
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box 
                sx={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: '50%', 
                  bgcolor: 'var(--accent-primary, #7C4DFF)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                3
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--text-primary, #1A1A1E)' }}>
                  Review Period
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary, #6F7280)' }}>
                  Hours 72-120: Your time to review submissions
                </Typography>
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box 
                sx={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: '50%', 
                  bgcolor: 'var(--accent-secondary, #E3F06F)',
                  color: 'var(--text-primary, #1A1A1E)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                ✓
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--text-primary, #1A1A1E)' }}>
                  Auto-Approval & Payment
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary, #6F7280)' }}>
                  Hour 120+: Remaining submissions auto-approved, payments distributed
                </Typography>
              </Box>
            </Box>
          </Box>
          
          <Typography 
            variant="caption" 
            sx={{ 
              display: 'block',
              mt: 2,
              pt: 2,
              borderTop: '1px solid rgba(227, 240, 111, 0.4)',
              color: 'var(--text-secondary, #6F7280)',
              fontStyle: 'italic'
            }}
          >
            💡 Timeline starts automatically when you create the campaign. Deadlines are enforced on-chain.
          </Typography>
        </Box>

      </DialogContent>

      {/* ==================== FOOTER ==================== */}
      <DialogActions 
        sx={{ 
          borderTop: '1px solid var(--border-subtle, #E5E7F0)', 
          p: 2.5,
          gap: 1.5
        }}
      >
        <Button 
          onClick={handleClose}
          disabled={loading}
          sx={{ 
            color: 'var(--text-secondary, #6F7280)',
            textTransform: 'none',
            fontWeight: 500,
            px: 3,
            borderRadius: '999px',
            '&:hover': {
              bgcolor: 'var(--subtle-background, #F7F8FB)'
            }
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleCreateCampaign}
          disabled={loading || isSubmitting || !canSubmit() || !publicKey}
          sx={{ 
            bgcolor: 'var(--accent-primary, #7C4DFF)',
            color: '#FFFFFF',
            textTransform: 'none',
            fontWeight: 600,
            px: 4,
            py: 1.25,
            borderRadius: '999px',
            boxShadow: '0 4px 14px rgba(124, 77, 255, 0.3)',
            '&:hover': { 
              bgcolor: '#6A3FE8',
              boxShadow: '0 6px 20px rgba(124, 77, 255, 0.4)'
            },
            '&:disabled': {
              bgcolor: 'var(--border-subtle, #E5E7F0)',
              color: 'var(--text-muted, #A3A7B5)'
            }
          }}
        >
          {isSubmitting ? 'Creating Campaign...' : 'Create Campaign & Lock Budget'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

