'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Alert,
  CircularProgress,
  InputAdornment,
  Checkbox,
  Box,
  Typography,
  Chip,
  Paper,
  Divider,
  IconButton,
  Switch
} from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import LockIcon from '@mui/icons-material/Lock'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import { createJob } from '@/lib/jobs'
import { supabase } from '@/lib/supabase'
import { getTokenPriceUsd, validateMinimumUsdValue } from '@/lib/helius'
import { getFeePercentage } from '@/lib/platform-settings'
import { transferToEscrow, validateEscrowTransfer, calculateEscrowAmount } from '@/lib/solana/escrow-transfer'
import { saveDraft } from '@/lib/job-drafts'
import { toast } from 'react-hot-toast'
import WarningIcon from '@mui/icons-material/Warning'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'

interface CreateJobModalProps {
  isOpen: boolean
  onClose: () => void
  mode?: 'create' | 'edit'
  existingJob?: any // Job type from database
  projectId: string
  tokenMint: string
  tokenSymbol: string
  walletAddress: string
  onJobCreated?: () => void
}

const CATEGORIES = [
  { value: 'design', label: 'Design' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'development', label: 'Development' },
  { value: 'content', label: 'Content' },
  { value: 'community', label: 'Community' },
  { value: 'other', label: 'Other' }
]

const COMPLETION_DAYS_OPTIONS = [
  { value: '1', label: '1 day' },
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '21', label: '21 days' },
  { value: '30', label: '30 days' },
  { value: '45', label: '45 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' }
]

export function CreateJobModal({
  isOpen,
  onClose,
  mode = 'create',
  existingJob,
  projectId,
  tokenMint,
  tokenSymbol,
  walletAddress,
  onJobCreated
}: CreateJobModalProps) {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  
  const [loading, setLoading] = useState(false)
  const [checkingPrice, setCheckingPrice] = useState(false)
  const [applicationCount, setApplicationCount] = useState(0)
  const [understoodInvalidation, setUnderstoodInvalidation] = useState(false)
  const [hasScrolled, setHasScrolled] = useState(false)
  
  // Escrow confirmation states
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isLocking, setIsLocking] = useState(false)
  const [lockError, setLockError] = useState<string | null>(null)
  const [feePercentage, setFeePercentage] = useState<number>(5.0)
  const [solBalance, setSolBalance] = useState<number>(0)
  const [tokenBalance, setTokenBalance] = useState<number>(0)
  
  // Form fields
  const [jobType, setJobType] = useState<'regular' | 'contest'>('regular')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [kpis, setKpis] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [assignmentMode, setAssignmentMode] = useState<'first_come' | 'review'>('review')
  const [desiredCompletionDays, setDesiredCompletionDays] = useState<string>('')
  
  // Contest-specific state
  const [contestMaxWinners, setContestMaxWinners] = useState<number>(1)
  const [contestPrizes, setContestPrizes] = useState<Array<{
    position: number
    amount_tokens: number
    amount_usd: number
  }>>([
    { position: 1, amount_tokens: 0, amount_usd: 0 }
  ])
  const [contestSubmissionDeadline, setContestSubmissionDeadline] = useState<Date | null>(null)
  const [contestSubmissionsVisible, setContestSubmissionsVisible] = useState<boolean>(true)
  
  // Helper state for prize input
  const [prizeInputErrors, setPrizeInputErrors] = useState<Record<number, string>>({})
  
  // Validation states
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [usdValue, setUsdValue] = useState<number | null>(null)
  const [tokenPrice, setTokenPrice] = useState<number | null>(null)
  const [priceError, setPriceError] = useState(false)

  // Reset form when modal closes or populate when editing
  useEffect(() => {
    if (!isOpen) {
      resetForm()
    } else if (mode === 'edit' && existingJob) {
      // Populate fields with existing job data
      setTitle(existingJob.title || '')
      setCategory(existingJob.category || '')
      setDescription(existingJob.description || '')
      setKpis(existingJob.kpis || '')
      setPaymentAmount(existingJob.payment_amount_tokens?.toString() || '')
      setAssignmentMode(existingJob.assignment_mode || 'review')
      setUsdValue(existingJob.payment_amount_usd || 0)
      
      // Fetch application count
      fetchApplicationCount(existingJob.id)
    }
  }, [isOpen, mode, existingJob])

  // Fetch fee percentage on mount
  useEffect(() => {
    const fetchFee = async () => {
      const fee = await getFeePercentage()
      setFeePercentage(fee)
    }
    if (isOpen) {
      fetchFee()
    }
  }, [isOpen])

  // Fetch wallet balances when confirmation screen opens
  useEffect(() => {
    const fetchBalances = async () => {
      if (!showConfirmation || !publicKey) return

      try {
        // Get SOL balance
        const balance = await connection.getBalance(publicKey)
        setSolBalance(balance / LAMPORTS_PER_SOL)

        // Note: Token balance would be fetched here if needed
        // For now we rely on the validation that already happened
      } catch (error) {
        console.error('Error fetching balances:', error)
      }
    }

    fetchBalances()
  }, [showConfirmation, publicKey, connection])

  const fetchApplicationCount = async (jobId: string) => {
    try {
      const { count, error } = await supabase
        .from('job_applications')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('is_invalidated', false)

      if (error) throw error
      setApplicationCount(count || 0)
    } catch (error) {
      console.error('Error fetching application count:', error)
    }
  }

  // Check USD value when payment amount changes
  useEffect(() => {
    const amount = parseFloat(paymentAmount)
    if (paymentAmount && !isNaN(amount) && amount > 0) {
      checkUsdValue(amount)
    } else {
      setUsdValue(null)
      setPriceError(false)
    }
  }, [paymentAmount, tokenMint])

  const resetForm = () => {
    setJobType('regular')
    setTitle('')
    setCategory('')
    setDescription('')
    setKpis('')
    setPaymentAmount('')
    setAssignmentMode('review')
    setDesiredCompletionDays('')
    // Reset contest-specific state
    setContestMaxWinners(1)
    setContestPrizes([{ position: 1, amount_tokens: 0, amount_usd: 0 }])
    setContestSubmissionDeadline(null)
    setContestSubmissionsVisible(true)
    setPrizeInputErrors({})
    // Reset validation and UI state
    setErrors({})
    setUsdValue(null)
    setTokenPrice(null)
    setPriceError(false)
    setApplicationCount(0)
    setUnderstoodInvalidation(false)
    setShowConfirmation(false)
    setIsLocking(false)
    setLockError(null)
    setFeePercentage(5.0)
    setSolBalance(0)
    setTokenBalance(0)
  }

  // Calculate desired completion date from days
  const getDesiredCompletionDate = (): string | null => {
    if (!desiredCompletionDays) return null
    const days = parseInt(desiredCompletionDays)
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date.toISOString()
  }

  // Calculate escrow breakdown for display
  const calculateEscrowBreakdown = (amount: number, fee: number) => {
    const feeAmount = amount * (fee / 100)
    const totalLocked = amount + feeAmount
    const workerReceives = amount
    
    return {
      totalLocked,
      feeAmount,
      workerReceives,
      feePercentage: fee
    }
  }

  // Calculate total prize pool for contests
  const calculateTotalPrizePool = () => {
    return contestPrizes.reduce((sum, prize) => sum + prize.amount_tokens, 0)
  }

  // Calculate total with platform fee for contests
  const calculateTotalWithFee = () => {
    const total = calculateTotalPrizePool()
    return total * (1 + feePercentage / 100)
  }

  const checkUsdValue = async (amount: number) => {
    setCheckingPrice(true)
    setPriceError(false)
    
    try {
      // Get token price
      const price = await getTokenPriceUsd(tokenMint)
      setTokenPrice(price)
      
      if (price === null) {
        setPriceError(true)
        setUsdValue(null)
      } else {
        const usd = amount * price
        setUsdValue(usd)
      }
    } catch (error) {
      console.error('Error checking USD value:', error)
      setPriceError(true)
      setUsdValue(null)
    } finally {
      setCheckingPrice(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Title validation
    if (!title.trim()) {
      newErrors.title = 'Title is required'
    } else if (title.length > 200) {
      newErrors.title = 'Title must be 200 characters or less'
    }

    // Category validation
    if (!category) {
      newErrors.category = 'Category is required'
    }

    // Description validation
    if (!description.trim()) {
      newErrors.description = 'Description is required'
    } else if (description.length > 5000) {
      newErrors.description = 'Description must be 5000 characters or less'
    }

    // KPIs validation
    if (!kpis.trim()) {
      newErrors.kpis = 'Success criteria are required'
    } else if (kpis.length > 2000) {
      newErrors.kpis = 'Success criteria must be 2000 characters or less'
    }

    // Payment validation
    const amount = parseFloat(paymentAmount)
    if (!paymentAmount || isNaN(amount) || amount < 1) {
      newErrors.paymentAmount = 'Payment amount must be at least 1 token'
    } else if (usdValue !== null && usdValue < 5) {
      newErrors.paymentAmount = 'Payment must be at least $5 USD'
    } else if (priceError || usdValue === null) {
      newErrors.paymentAmount = 'Unable to verify USD value. Please try again.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Contest-specific validation
  const validateContestFields = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []

    // Check max winners
    if (contestMaxWinners < 1) {
      errors.push('Contest must have at least 1 winner')
    }
    if (contestMaxWinners > 10) {
      errors.push('Contest cannot have more than 10 winners')
    }

    // Check all prizes are set
    const invalidPrizes = contestPrizes.filter(p => !p.amount_tokens || p.amount_tokens <= 0)
    if (invalidPrizes.length > 0) {
      errors.push(`All prize amounts must be greater than 0 (${invalidPrizes.length} prize${invalidPrizes.length > 1 ? 's' : ''} not set)`)
    }

    // Check total prize pool is reasonable
    const totalPrizes = calculateTotalPrizePool()
    if (totalPrizes <= 0) {
      errors.push('Total prize pool must be greater than 0')
    }

    // Check submission deadline
    if (!contestSubmissionDeadline) {
      errors.push('Submission deadline is required for contests')
    } else {
      const minDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000)
      if (contestSubmissionDeadline < minDeadline) {
        errors.push('Submission deadline must be at least 24 hours from now')
      }
      const maxDeadline = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      if (contestSubmissionDeadline > maxDeadline) {
        errors.push('Submission deadline cannot be more than 90 days from now')
      }
    }

    // Check prizes array length matches max winners
    if (contestPrizes.length !== contestMaxWinners) {
      errors.push(`Prize array mismatch: expected ${contestMaxWinners}, got ${contestPrizes.length}`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  const handleReviewAndLock = async () => {
    // Validate common form fields (skip payment validation for contests)
    if (jobType === 'regular') {
      if (!validateForm()) {
        toast.error('Please fix the errors before continuing')
        return
      }
    } else {
      // For contests, validate common fields without payment amount
      const newErrors: Record<string, string> = {}
      if (!title.trim()) newErrors.title = 'Title is required'
      if (!category) newErrors.category = 'Category is required'
      if (!description.trim()) newErrors.description = 'Description is required'
      if (!kpis.trim()) newErrors.kpis = 'Success criteria are required'
      setErrors(newErrors)
      if (Object.keys(newErrors).length > 0) {
        toast.error('Please fix the errors before continuing')
        return
      }
    }

    // Contest-specific validation
    if (jobType === 'contest') {
      const contestValidation = validateContestFields()
      if (!contestValidation.isValid) {
        toast.error(contestValidation.errors[0]) // Show first error
        // Show all errors in console for debugging
        console.log('Contest validation errors:', contestValidation.errors)
        return
      }
    }

    // Check invalidation checkbox if applications exist
    if (mode === 'edit' && applicationCount > 0 && !understoodInvalidation) {
      toast.error('Please confirm you understand applications will be invalidated')
      return
    }

    // For create mode, validate escrow transfer capability
    if (mode === 'create') {
      if (!publicKey || !connection) {
        toast.error('Please connect your wallet')
        return
      }

      // Calculate total escrow amount (payment + fee)
      // For contests, use the total prize pool; for regular jobs, use payment amount
      const amount = jobType === 'contest' ? calculateTotalPrizePool() : parseFloat(paymentAmount)
      const totalEscrowAmount = jobType === 'contest' ? calculateTotalWithFee() : calculateEscrowAmount(amount, feePercentage)

      // Validate wallet has sufficient balance
      setLoading(true)
      try {
        const validation = await validateEscrowTransfer(
          connection,
          publicKey,
          new PublicKey(tokenMint),
          totalEscrowAmount,
          9 // TODO: Get actual decimals from token metadata
        )

        if (!validation.valid) {
          toast.error(validation.error || 'Insufficient balance for escrow')
          setLoading(false)
          return
        }
      } catch (error) {
        console.error('Validation error:', error)
        toast.error('Failed to validate wallet balance')
        setLoading(false)
        return
      }
      setLoading(false)
    }

    // Show confirmation screen
    setShowConfirmation(true)
  }

  const handleBackToEdit = () => {
    // Don't allow going back while locking tokens
    if (isLocking) return
    
    setShowConfirmation(false)
    setLockError(null)
  }

  const handleConfirmAndLock = async () => {
    setIsLocking(true)
    setLockError(null)
    
    // Track escrow transaction for draft recovery
    let escrowTxSignature: string | undefined

    try {
      if (mode === 'edit' && existingJob) {
        // Update existing job via API (uses service role to bypass RLS)
        const updatePayload: any = {
          poster_wallet: walletAddress,
          title: title.trim(),
          description: description.trim(),
          kpis: kpis.trim(),
          category,
          assignment_mode: assignmentMode,
          poster_desired_completion: getDesiredCompletionDate()
        }

        // Handle payment amount change and escrow adjustment
        const newAmount = parseFloat(paymentAmount)
        const oldAmount = existingJob.payment_amount_tokens
        const paymentChanged = applicationCount === 0 && !isNaN(newAmount) && newAmount !== oldAmount

        if (paymentChanged) {
          // Calculate FULL escrow amounts (payment + platform fee)
          // Note: Fee is only taken on completion, so on cancel/reduction we refund EVERYTHING
          const oldEscrowAmount = existingJob.escrow_amount_tokens || calculateEscrowAmount(oldAmount, feePercentage)
          const newEscrowAmount = calculateEscrowAmount(newAmount, feePercentage)
          const escrowDifference = newEscrowAmount - oldEscrowAmount

          console.log(`💰 Payment change: ${oldAmount} → ${newAmount}`)
          console.log(`💰 Old escrow (with fee): ${oldEscrowAmount}`)
          console.log(`💰 New escrow (with fee): ${newEscrowAmount}`)
          console.log(`💰 Difference: ${escrowDifference}`)

          // If escrow is locked, handle the token difference
          if (existingJob.escrow_locked && Math.abs(escrowDifference) > 0.001) {
            if (!publicKey || !connection || !sendTransaction) {
              setLockError('Wallet not connected')
              setIsLocking(false)
              return
            }

            if (escrowDifference > 0) {
              // Need to lock MORE tokens (includes additional fee)
              toast.loading(`Locking additional ${escrowDifference.toFixed(2)} ${tokenSymbol} (includes platform fee)...`, { id: 'escrow-adjust' })

              // Validate the additional amount
              const validation = await validateEscrowTransfer(
                connection,
                publicKey,
                new PublicKey(tokenMint),
                escrowDifference,
                9 // Assuming 9 decimals
              )

              if (!validation.valid) {
                throw new Error(validation.error || 'Insufficient balance for additional escrow')
              }

              // Transfer additional tokens to escrow (payment increase + fee increase)
              const transferResult = await transferToEscrow(
                {
                  connection,
                  senderWallet: publicKey,
                  tokenMint: new PublicKey(tokenMint),
                  amount: escrowDifference,
                  decimals: 9,
                  tokenSymbol,
                  jobTitle: `${title} (Additional Lock)`,
                  workerPayment: newAmount
                },
                sendTransaction
              )

              if (!transferResult.success) {
                throw new Error(transferResult.error || 'Failed to lock additional tokens')
              }

              toast.success(`Locked additional ${escrowDifference.toFixed(2)} ${tokenSymbol} (including fee)`, { id: 'escrow-adjust' })

              // Update escrow transaction signature
              updatePayload.escrow_tx_signature = transferResult.signature
              updatePayload.escrow_amount_tokens = newEscrowAmount

            } else {
              // Need to refund the FULL difference (payment reduction + fee reduction)
              const refundAmount = Math.abs(escrowDifference)
              toast.loading(`Refunding ${refundAmount.toFixed(2)} ${tokenSymbol} (full amount including fee)...`, { id: 'escrow-adjust' })

              const refundResponse = await fetch(`/api/jobs/${existingJob.id}/adjust-escrow`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  poster_wallet: walletAddress,
                  refund_amount: refundAmount
                })
              })

              const refundData = await refundResponse.json()

              if (!refundResponse.ok || !refundData.success) {
                throw new Error(refundData.error || 'Failed to refund escrow difference')
              }

              toast.success(`Refunded ${refundAmount.toFixed(2)} ${tokenSymbol} (including fee)`, { id: 'escrow-adjust' })

              // Update escrow amount
              updatePayload.escrow_amount_tokens = newEscrowAmount
            }
          }

          // Update payment amounts in the payload
          updatePayload.payment_amount_tokens = newAmount
          if (usdValue !== null) {
            updatePayload.payment_amount_usd = usdValue
          }
        }

        // Call backend API to update the job
        const response = await fetch(`/api/jobs/${existingJob.id}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        })

        const data = await response.json()
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to update job')
        }

        // Show appropriate success message
        if (data.invalidated_applications > 0) {
          toast.success(`Job updated. ${data.invalidated_applications} application${data.invalidated_applications > 1 ? 's' : ''} invalidated.`, {
            duration: 4000
          })
        } else {
          toast.success('Job updated successfully!', {
            duration: 4000,
            style: {
              background: '#7C4DFF',
              color: '#fff',
            }
          })
        }

        setIsLocking(false)
        onClose()
        if (onJobCreated) {
          onJobCreated()
        }
      } else {
        // Create new job with escrow locking
        // For contests, use prize pool; for regular jobs, use payment amount
        const amount = jobType === 'contest' ? calculateTotalPrizePool() : parseFloat(paymentAmount)
        const totalEscrowAmount = jobType === 'contest' ? calculateTotalWithFee() : calculateEscrowAmount(amount, feePercentage)
        
        // Final USD validation (skip for contests as prizes are validated separately)
        if (jobType === 'regular') {
          const validation = await validateMinimumUsdValue(tokenMint, amount, 5)
          
          if (!validation.valid) {
            setLockError('Payment must be at least $5 USD')
            setIsLocking(false)
            return
          }
        }

        if (!publicKey || !connection || !sendTransaction) {
          setLockError('Wallet not connected')
          setIsLocking(false)
          return
        }

        // Step 1: Transfer tokens to escrow
        toast.loading('Locking tokens in escrow...', { id: 'escrow-lock' })
        
        const transferResult = await transferToEscrow(
          {
            connection,
            senderWallet: publicKey,
            tokenMint: new PublicKey(tokenMint),
            amount: totalEscrowAmount,
            decimals: 9, // TODO: Get actual decimals from token metadata
            tokenSymbol: tokenSymbol,
            jobTitle: title.trim(),
            workerPayment: amount
          },
          sendTransaction
        )

        if (!transferResult.success) {
          toast.dismiss('escrow-lock')
          setLockError(transferResult.error || 'Failed to lock tokens in escrow')
          setIsLocking(false)
          return
        }

        // Store signature for draft recovery if needed
        escrowTxSignature = transferResult.signature

        // Step 2: Create the job in database with escrow fields
        toast.loading(jobType === 'contest' ? 'Creating contest...' : 'Creating job...', { id: 'escrow-lock' })
        
        // Prepare base job data
        const baseJobData = {
          project_id: projectId,
          poster_wallet: walletAddress,
          title: title.trim(),
          description: description.trim(),
          kpis: kpis.trim(),
          category,
          fee_percentage_at_creation: feePercentage,
          escrow_locked: true,
          escrow_tx_signature: transferResult.signature,
          escrow_amount_tokens: totalEscrowAmount,
          escrow_token_mint: tokenMint
        }

        let jobData
        if (jobType === 'contest') {
          // Contest-specific job data
          // Calculate USD values for prizes
          const prizesWithUsd = contestPrizes.map(prize => ({
            ...prize,
            amount_usd: prize.amount_tokens * (tokenPrice || 0)
          }))
          
          jobData = await createJob({
            ...baseJobData,
            // Contest fields
            is_contest: true,
            contest_max_winners: contestMaxWinners,
            contest_winner_prizes: prizesWithUsd,
            contest_submission_deadline: contestSubmissionDeadline!.toISOString(),
            contest_winner_selection_deadline: new Date(
              contestSubmissionDeadline!.getTime() + 3 * 24 * 60 * 60 * 1000
            ).toISOString(),
            contest_submissions_visible: contestSubmissionsVisible,
            // Regular job fields - set defaults for contests
            payment_amount_tokens: 0, // Total is in escrow_amount_tokens
            payment_amount_usd: 0,
            assignment_mode: 'review' as const, // Contests always use review mode
            poster_desired_completion: contestSubmissionDeadline!.toISOString(),
          })
        } else {
          // Regular job data (existing logic)
          const validation = await validateMinimumUsdValue(tokenMint, amount, 5)
          
          jobData = await createJob({
            ...baseJobData,
            // Regular job fields
            payment_amount_tokens: amount,
            payment_amount_usd: validation.usdValue || 0,
            assignment_mode: assignmentMode,
            poster_desired_completion: getDesiredCompletionDate(),
            // Contest fields set to defaults
            is_contest: false,
            contest_max_winners: null,
            contest_winner_prizes: null,
            contest_submission_deadline: null,
            contest_winner_selection_deadline: null,
            contest_submissions_visible: true,
          })
        }

        // Step 3: Log transaction to escrow transactions table
        try {
          await supabase.from('job_escrow_transactions').insert({
            job_id: jobData.id,
            transaction_type: 'lock',
            from_wallet: walletAddress,
            to_wallet: transferResult.escrowWallet,
            amount_tokens: totalEscrowAmount,
            token_mint: tokenMint,
            token_symbol: tokenSymbol,
            tx_signature: transferResult.signature,
            status: 'confirmed',
            confirmed_at: new Date().toISOString()
          })
        } catch (logError) {
          // Log error but don't fail the job creation
          console.error('Failed to log escrow transaction:', logError)
        }

        toast.dismiss('escrow-lock')
        toast.success(
          jobType === 'contest'
            ? `🏆 Contest created! ${contestMaxWinners} prize${contestMaxWinners > 1 ? 's' : ''} locked in escrow`
            : 'Job posted! 🎉 Tokens locked in escrow',
          {
            duration: 4000,
            style: {
              background: '#36C170',
              color: '#fff',
            },
            icon: jobType === 'contest' ? '🏆' : '🔒'
          }
        )

        setIsLocking(false)
        onClose()
        if (onJobCreated) {
          onJobCreated()
        }
      }
    } catch (error) {
      console.error(`Error ${mode === 'edit' ? 'updating' : 'creating'} job:`, error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.dismiss('escrow-lock')
      
      // If escrow succeeded but job creation failed, save draft for recovery
      if (mode === 'create' && escrowTxSignature) {
        console.log('Escrow succeeded but job creation failed - saving draft for recovery')
        
        const amount = parseFloat(paymentAmount)
        const totalEscrowAmount = calculateEscrowAmount(amount, feePercentage)
        const validation = await validateMinimumUsdValue(tokenMint, amount, 5)
        
        const draftData = {
          project_id: projectId,
          poster_wallet: walletAddress,
          title: title.trim(),
          description: description.trim(),
          kpis: kpis.trim(),
          category,
          payment_amount_tokens: amount,
          payment_amount_usd: validation.usdValue || 0,
          assignment_mode: assignmentMode,
          escrow_amount_tokens: totalEscrowAmount,
          escrow_token_mint: tokenMint,
          poster_desired_completion: getDesiredCompletionDate(),
          fee_percentage_at_creation: feePercentage,
          token_symbol: tokenSymbol
        }
        
        const draft = await saveDraft(
          walletAddress,
          projectId,
          draftData,
          escrowTxSignature
        )
        
        if (draft) {
          setLockError(
            '⚠️ Tokens were locked successfully, but job creation failed. ' +
            'Your progress has been saved and can be recovered. ' +
            'Please refresh the page to see recovery options, or contact support. ' +
            `Transaction: ${escrowTxSignature.slice(0, 8)}...`
          )
          toast.error('Job saved as draft for recovery', {
            duration: 8000,
            icon: '💾'
          })
        } else {
          setLockError(
            `⚠️ CRITICAL: Tokens locked but job creation failed. ` +
            `Transaction signature: ${escrowTxSignature}. ` +
            `Please save this signature and contact support immediately.`
          )
          toast.error('Please save your transaction signature!', {
            duration: 10000,
            icon: '⚠️'
          })
        }
      } else {
        setLockError(`Failed to ${mode === 'edit' ? 'update' : 'create'} job: ${errorMessage}`)
      }
    } finally {
      setIsLocking(false)
    }
  }

  const belowMinimum = usdValue !== null && usdValue < 5
  
  // Handle scroll to detect if user has scrolled
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    if (target.scrollTop > 20) {
      setHasScrolled(true)
    } else {
      setHasScrolled(false)
    }
  }

  // Get escrow breakdown for display
  const escrowBreakdown = paymentAmount ? calculateEscrowBreakdown(parseFloat(paymentAmount), feePercentage) : null

  // Render confirmation screen
  if (showConfirmation && mode === 'create') {
    return (
      <Dialog 
        open={isOpen} 
        onClose={!isLocking ? onClose : undefined}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ 
          fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
          fontSize: '24px',
          fontWeight: 700,
          color: '#1A1A1E',
          pb: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <LockIcon sx={{ color: '#7C4DFF' }} />
          {jobType === 'contest' ? 'Review & Lock Prize Pool' : 'Review & Lock Tokens'}
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {/* Job Summary */}
          <Paper 
            elevation={0}
            sx={{ 
              p: 3, 
              mb: 3, 
              bgcolor: '#F8F5FF',
              border: '1px solid #E5DEFF',
              borderRadius: '12px'
            }}
          >
            <Typography variant="overline" sx={{ color: '#6F7280', fontSize: '11px', fontWeight: 600 }}>
              JOB SUMMARY
            </Typography>
            <Typography sx={{ fontWeight: 600, fontSize: '18px', color: '#1A1A1E', mt: 1, mb: 2 }}>
              {title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: desiredCompletionDays ? 2 : 0 }}>
              <Chip 
                label={category.charAt(0).toUpperCase() + category.slice(1)}
                size="small"
                sx={{ bgcolor: '#E3F06F', color: '#1A1A1E', fontSize: '12px', fontWeight: 500 }}
              />
              <Chip 
                label={assignmentMode === 'review' ? 'Review Applications' : 'First Come'}
                size="small"
                sx={{ bgcolor: '#E5E7F0', color: '#6F7280', fontSize: '12px' }}
              />
              {desiredCompletionDays && (
                <Chip 
                  label={`Desired: ${COMPLETION_DAYS_OPTIONS.find(opt => opt.value === desiredCompletionDays)?.label || desiredCompletionDays + ' days'}`}
                  size="small"
                  sx={{ bgcolor: '#F8F5FF', color: '#7C4DFF', fontSize: '12px', border: '1px solid #E5DEFF' }}
                />
              )}
            </Box>
          </Paper>

          {/* Escrow Breakdown - Regular Jobs Only */}
          {escrowBreakdown && jobType === 'regular' && (
            <Paper 
              elevation={0}
              sx={{ 
                p: 3, 
                mb: 3, 
                border: '2px solid #7C4DFF',
                borderRadius: '12px'
              }}
            >
              <Typography variant="overline" sx={{ color: '#7C4DFF', fontSize: '11px', fontWeight: 600 }}>
                ESCROW BREAKDOWN
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                {/* Worker Payment */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography sx={{ color: '#6F7280', fontSize: '14px' }}>
                    Worker Receives:
                  </Typography>
                  <Typography sx={{ fontWeight: 600, color: '#1A1A1E', fontSize: '14px' }}>
                    {escrowBreakdown.workerReceives.toFixed(2)} {tokenSymbol}
                  </Typography>
                </Box>

                {/* Platform Fee */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography sx={{ color: '#6F7280', fontSize: '14px' }}>
                    Platform Fee ({escrowBreakdown.feePercentage}%):
                  </Typography>
                  <Typography sx={{ fontWeight: 600, color: '#6F7280', fontSize: '14px' }}>
                    + {escrowBreakdown.feeAmount.toFixed(2)} {tokenSymbol}
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Total Locked */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LockIcon sx={{ fontSize: 18, color: '#7C4DFF' }} />
                    <Typography sx={{ fontWeight: 600, color: '#1A1A1E', fontSize: '16px' }}>
                      Total Locked:
                    </Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 700, color: '#7C4DFF', fontSize: '20px' }}>
                    {escrowBreakdown.totalLocked.toFixed(2)} {tokenSymbol}
                  </Typography>
                </Box>

                {usdValue && (
                  <Typography sx={{ textAlign: 'right', color: '#6F7280', fontSize: '12px', mt: 0.5 }}>
                    ≈ ${(usdValue * (1 + feePercentage / 100)).toFixed(2)} USD
                  </Typography>
                )}
              </Box>
            </Paper>
          )}

          {/* Escrow Breakdown - Contests */}
          {jobType === 'contest' && (
            <Paper 
              elevation={0}
              sx={{ 
                p: 3, 
                mb: 3, 
                border: '2px solid #7C4DFF',
                borderRadius: '12px'
              }}
            >
              <Typography variant="overline" sx={{ color: '#7C4DFF', fontSize: '11px', fontWeight: 600 }}>
                PRIZE POOL BREAKDOWN
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                {/* Prize Pool */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography sx={{ color: '#6F7280', fontSize: '14px' }}>
                    Total Prizes ({contestMaxWinners} winner{contestMaxWinners > 1 ? 's' : ''}):
                  </Typography>
                  <Typography sx={{ fontWeight: 600, color: '#1A1A1E', fontSize: '14px' }}>
                    {calculateTotalPrizePool().toFixed(2)} {tokenSymbol}
                  </Typography>
                </Box>

                {/* Platform Fee */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography sx={{ color: '#6F7280', fontSize: '14px' }}>
                    Platform Fee ({feePercentage}%):
                  </Typography>
                  <Typography sx={{ fontWeight: 600, color: '#6F7280', fontSize: '14px' }}>
                    + {(calculateTotalPrizePool() * (feePercentage / 100)).toFixed(2)} {tokenSymbol}
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Total Locked */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LockIcon sx={{ fontSize: 18, color: '#7C4DFF' }} />
                    <Typography sx={{ fontWeight: 600, color: '#1A1A1E', fontSize: '16px' }}>
                      Total Locked:
                    </Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 700, color: '#7C4DFF', fontSize: '20px' }}>
                    {calculateTotalWithFee().toFixed(2)} {tokenSymbol}
                  </Typography>
                </Box>

                {tokenPrice && (
                  <Typography sx={{ textAlign: 'right', color: '#6F7280', fontSize: '12px', mt: 0.5 }}>
                    ≈ ${(calculateTotalWithFee() * tokenPrice).toFixed(2)} USD
                  </Typography>
                )}
              </Box>
            </Paper>
          )}

          {/* Balance Checks */}
          <Box sx={{ mb: 3 }}>
            {solBalance > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CheckCircleIcon sx={{ fontSize: 18, color: solBalance >= 0.001 ? '#36C170' : '#FB923C' }} />
                <Typography sx={{ fontSize: '14px', color: '#6F7280' }}>
                  SOL Balance: {solBalance.toFixed(4)} SOL {solBalance < 0.001 && '(Low - may need more for fees)'}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Contest Summary */}
          {jobType === 'contest' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                🏆 Contest Summary:
              </Typography>
              <Typography variant="caption" component="div">
                • {contestMaxWinners} winner{contestMaxWinners > 1 ? 's' : ''} will be selected
              </Typography>
              <Typography variant="caption" component="div">
                • Total prize pool: {calculateTotalPrizePool().toFixed(2)} {tokenSymbol}
              </Typography>
              <Typography variant="caption" component="div">
                • Submissions close: {contestSubmissionDeadline?.toLocaleDateString() || 'Not set'}
              </Typography>
              <Typography variant="caption" component="div">
                • Winner selection by: {contestSubmissionDeadline ? 
                  new Date(contestSubmissionDeadline.getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString() 
                  : 'N/A'}
              </Typography>
            </Alert>
          )}

          {/* Warning Box */}
          <Alert 
            severity="warning" 
            icon={<WarningIcon />}
            sx={{ 
              mb: 2,
              backgroundColor: '#FFF4E6',
              color: '#1A1A1E',
              '& .MuiAlert-icon': {
                color: '#FB923C'
              }
            }}
          >
            <strong>{jobType === 'contest' ? 'Prize pool will be locked until contest completion.' : 'Tokens will be locked until job completion.'}</strong>
            <br />
            {jobType === 'contest' 
              ? 'Funds are held in escrow and distributed to winners after you select them, or auto-distributed based on community votes if you don\'t act within 3 days of the deadline.'
              : 'Funds are held in escrow and released automatically to the worker 10 days after work submission, or when you manually approve.'}
          </Alert>

          {/* Error Display */}
          {lockError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {lockError}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
            <Button
              onClick={handleBackToEdit}
              disabled={isLocking}
              startIcon={<ArrowBackIcon />}
              sx={{ 
                flex: 1,
                color: '#6F7280',
                textTransform: 'none',
                fontSize: '16px',
                fontWeight: 500,
                border: '1px solid #E5E7F0',
                '&:hover': {
                  bgcolor: '#F8F9FA'
                }
              }}
            >
              Back to Edit
            </Button>
            <Button
              onClick={handleConfirmAndLock}
              disabled={isLocking}
              variant="contained"
              startIcon={isLocking ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : <LockIcon />}
              sx={{
                flex: 2,
                backgroundColor: '#7C4DFF',
                color: '#fff',
                textTransform: 'none',
                fontSize: '16px',
                fontWeight: 600,
                py: 1.5,
                '&:hover': {
                  backgroundColor: '#6B3FEE'
                },
                '&:disabled': {
                  backgroundColor: '#E5E7F0',
                  color: '#A3A7B5'
                }
              }}
            >
              {isLocking 
                ? (jobType === 'contest' ? 'Locking Prize Pool...' : 'Locking Tokens...') 
                : jobType === 'contest'
                  ? `🏆 Create Contest & Lock ${calculateTotalWithFee().toFixed(2)} ${tokenSymbol}`
                  : 'Confirm & Lock Tokens'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    )
  }

  // Render main form
  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '12px',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
        fontSize: '24px',
        fontWeight: 700,
        color: '#1A1A1E',
        pb: 1
      }}>
        {mode === 'edit' 
          ? 'Edit Job' 
          : jobType === 'contest' 
            ? '🏆 Create Contest Job' 
            : 'Post a Job'}
      </DialogTitle>

      <DialogContent 
        sx={{ pt: 3 }}
        onScroll={handleScroll}
      >
        {/* Job Type Toggle */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant={jobType === 'regular' ? 'contained' : 'outlined'}
            onClick={() => setJobType('regular')}
            sx={{
              bgcolor: jobType === 'regular' ? '#7C4DFF' : 'transparent',
              color: jobType === 'regular' ? 'white' : '#7C4DFF',
              borderColor: '#7C4DFF',
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              '&:hover': {
                bgcolor: jobType === 'regular' ? '#6A3FDB' : 'rgba(124, 77, 255, 0.08)'
              }
            }}
          >
            Regular Job
          </Button>
          <Button
            variant={jobType === 'contest' ? 'contained' : 'outlined'}
            onClick={() => setJobType('contest')}
            sx={{
              bgcolor: jobType === 'contest' ? '#7C4DFF' : 'transparent',
              color: jobType === 'contest' ? 'white' : '#7C4DFF',
              borderColor: '#7C4DFF',
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              '&:hover': {
                bgcolor: jobType === 'contest' ? '#6A3FDB' : 'rgba(124, 77, 255, 0.08)'
              }
            }}
          >
            🏆 Contest Job
          </Button>
        </Box>

        {/* Contest Info Alert */}
        {jobType === 'contest' && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <strong>Contest Mode:</strong> Multiple workers can submit entries. You'll manually select winner(s) after the submission deadline.
          </Alert>
        )}

        {/* Contest Settings */}
        {jobType === 'contest' && (
          <Box sx={{ 
            border: '1px solid #7C4DFF', 
            borderRadius: 2, 
            p: 3, 
            mb: 3,
            bgcolor: 'rgba(124, 77, 255, 0.05)'
          }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#7C4DFF' }}>
              Contest Settings
            </Typography>

            {/* Number of Winners */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                Number of Winners *
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton 
                  onClick={() => {
                    const newCount = Math.max(1, contestMaxWinners - 1)
                    setContestMaxWinners(newCount)
                    // Remove last prize if reducing
                    if (newCount < contestPrizes.length) {
                      setContestPrizes(contestPrizes.slice(0, newCount))
                    }
                  }}
                  disabled={contestMaxWinners <= 1}
                  sx={{ border: '1px solid #E5E7F0' }}
                >
                  <RemoveIcon />
                </IconButton>
                <Typography variant="h6" sx={{ minWidth: 40, textAlign: 'center' }}>
                  {contestMaxWinners}
                </Typography>
                <IconButton 
                  onClick={() => {
                    const newCount = Math.min(10, contestMaxWinners + 1)
                    setContestMaxWinners(newCount)
                    // Add new prize slot
                    if (newCount > contestPrizes.length) {
                      setContestPrizes([
                        ...contestPrizes,
                        { position: newCount, amount_tokens: 0, amount_usd: 0 }
                      ])
                    }
                  }}
                  disabled={contestMaxWinners >= 10}
                  sx={{ border: '1px solid #E5E7F0' }}
                >
                  <AddIcon />
                </IconButton>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Minimum: 1, Maximum: 10
              </Typography>
            </Box>

            {/* Prize Distribution */}
            <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
              Prize Distribution *
            </Typography>
            {contestPrizes.map((prize, index) => (
              <Box key={prize.position} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Typography variant="body2" sx={{ minWidth: 80 }}>
                    {prize.position === 1 ? '🥇 1st Place' :
                     prize.position === 2 ? '🥈 2nd Place' :
                     prize.position === 3 ? '🥉 3rd Place' :
                     `#${prize.position}`}
                  </Typography>
                  <TextField
                    type="number"
                    size="small"
                    placeholder="Prize amount"
                    value={prize.amount_tokens || ''}
                    onChange={(e) => {
                      const amount = parseFloat(e.target.value) || 0
                      
                      // Update prizes
                      const newPrizes = [...contestPrizes]
                      newPrizes[index] = {
                        ...newPrizes[index],
                        amount_tokens: amount,
                        amount_usd: amount * (tokenPrice || 0)
                      }
                      setContestPrizes(newPrizes)
                      
                      // Validate this prize in real-time
                      const newErrors = { ...prizeInputErrors }
                      if (amount <= 0) {
                        newErrors[prize.position] = 'Prize must be greater than 0'
                      } else {
                        delete newErrors[prize.position]
                      }
                      setPrizeInputErrors(newErrors)
                    }}
                    error={!!prizeInputErrors[prize.position]}
                    helperText={prizeInputErrors[prize.position]}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <span style={{ fontWeight: 600, color: '#7C4DFF' }}>
                            {tokenSymbol}
                          </span>
                        </InputAdornment>
                      )
                    }}
                    sx={{ flex: 1 }}
                  />
                  <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 100 }}>
                    ≈ ${prize.amount_usd.toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            ))}

            {/* Submission Deadline */}
            <Box sx={{ mb: 3, mt: 3 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                Submission Deadline *
              </Typography>
              <TextField
                type="datetime-local"
                fullWidth
                value={contestSubmissionDeadline ? 
                  new Date(contestSubmissionDeadline.getTime() - contestSubmissionDeadline.getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16) 
                  : ''
                }
                onChange={(e) => {
                  if (e.target.value) {
                    setContestSubmissionDeadline(new Date(e.target.value))
                  } else {
                    setContestSubmissionDeadline(null)
                  }
                }}
                inputProps={{
                  min: new Date(Date.now() + 24 * 60 * 60 * 1000)
                    .toISOString()
                    .slice(0, 16)
                }}
                helperText="Workers can submit entries until this date/time. Minimum: 24 hours from now."
              />
            </Box>

            {/* Winner Selection Deadline (auto-calculated) */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                Winner Selection Deadline
              </Typography>
              <TextField
                fullWidth
                disabled
                value={contestSubmissionDeadline ? 
                  new Date(contestSubmissionDeadline.getTime() + 3 * 24 * 60 * 60 * 1000)
                    .toLocaleString()
                  : 'Set submission deadline first'
                }
                helperText="Auto-set to 3 days after submission deadline. Winners auto-selected by community vote if you don't act."
              />
            </Box>

            {/* Submission Visibility */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                Submission Visibility
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={contestSubmissionsVisible}
                    onChange={(e) => setContestSubmissionsVisible(e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#7C4DFF',
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: '#7C4DFF',
                      },
                    }}
                  />
                }
                label={contestSubmissionsVisible ? 
                  "Public - Submissions visible during contest" : 
                  "Private - Submissions hidden until judging"
                }
              />
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', ml: 6 }}>
                {contestSubmissionsVisible ? 
                  "Everyone can see submissions as they come in. Enables community voting." :
                  "Submissions stay hidden until you begin judging. Prevents bias."
                }
              </Typography>
            </Box>

            {/* Total Prize Pool Summary */}
            <Box sx={{ 
              mt: 3, 
              p: 2, 
              bgcolor: 'background.paper', 
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider'
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Total Prize Pool:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {calculateTotalPrizePool().toFixed(2)} {tokenSymbol}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Platform Fee ({feePercentage}%):</Typography>
                <Typography variant="body2">
                  {(calculateTotalPrizePool() * (feePercentage / 100)).toFixed(2)} {tokenSymbol}
                </Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Total to Lock:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#7C4DFF' }}>
                  {calculateTotalWithFee().toFixed(2)} {tokenSymbol}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* Field Counter and Scroll Hint */}
        <Box 
          sx={{ 
            mb: 3, 
            p: 2, 
            bgcolor: '#F8F5FF',
            borderRadius: '8px',
            border: '1px solid #E5DEFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoIcon sx={{ fontSize: 20, color: '#7C4DFF' }} />
            <Typography variant="body2" sx={{ fontWeight: 500, color: '#1A1A1E' }}>
              Complete all required fields to post
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip 
              label="Title" 
              size="small" 
              sx={{ 
                bgcolor: title ? '#E3F8ED' : '#E5E7F0',
                color: title ? '#36C170' : '#6F7280',
                fontSize: '11px'
              }}
            />
            <Chip 
              label="Category" 
              size="small" 
              sx={{ 
                bgcolor: category ? '#E3F8ED' : '#E5E7F0',
                color: category ? '#36C170' : '#6F7280',
                fontSize: '11px'
              }}
            />
            <Chip 
              label="Description" 
              size="small" 
              sx={{ 
                bgcolor: description ? '#E3F8ED' : '#E5E7F0',
                color: description ? '#36C170' : '#6F7280',
                fontSize: '11px'
              }}
            />
            <Chip 
              label="KPIs" 
              size="small" 
              sx={{ 
                bgcolor: kpis ? '#E3F8ED' : '#E5E7F0',
                color: kpis ? '#36C170' : '#6F7280',
                fontSize: '11px'
              }}
            />
            <Chip 
              label="Payment" 
              size="small" 
              sx={{ 
                bgcolor: paymentAmount && !belowMinimum ? '#E3F8ED' : '#E5E7F0',
                color: paymentAmount && !belowMinimum ? '#36C170' : '#6F7280',
                fontSize: '11px'
              }}
            />
          </Box>
        </Box>
        
        {/* Scroll Hint - Only show when not scrolled */}
        {!hasScrolled && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 80,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 1,
              animation: 'bounce 2s infinite'
            }}
          >
            <Box
              sx={{
                bgcolor: '#7C4DFF',
                color: '#fff',
                px: 2,
                py: 1,
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                fontSize: '13px',
                fontWeight: 500,
                boxShadow: '0 4px 12px rgba(124, 77, 255, 0.3)'
              }}
            >
              Scroll for payment & mode
              <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
            </Box>
          </Box>
        )}
        
        {/* Warning for editing with applications */}
        {mode === 'edit' && applicationCount > 0 && (
          <Alert 
            severity="warning" 
            icon={<WarningIcon />}
            sx={{ 
              mb: 3,
              backgroundColor: '#FFF4E6',
              color: '#1A1A1E',
              '& .MuiAlert-icon': {
                color: '#FB923C'
              }
            }}
          >
            <strong>⚠️ Warning:</strong> Editing this job will INVALIDATE all existing applications.
            <br />
            <strong>{applicationCount} application{applicationCount > 1 ? 's' : ''} will need to reapply.</strong>
          </Alert>
        )}
        {/* Title */}
        <TextField
          label="Job Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Design new logo for ${tokenSymbol}`}
          fullWidth
          required
          error={!!errors.title}
          helperText={errors.title || `${title.length}/200 characters`}
          inputProps={{ maxLength: 200 }}
          sx={{ mb: 3 }}
        />

        {/* Category */}
        <FormControl fullWidth required error={!!errors.category} sx={{ mb: 3 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={category}
            label="Category"
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((cat) => (
              <MenuItem key={cat.value} value={cat.value}>
                {cat.label}
              </MenuItem>
            ))}
          </Select>
          {errors.category && (
            <Alert severity="error" sx={{ mt: 1 }}>{errors.category}</Alert>
          )}
        </FormControl>

        {/* Description */}
        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what you need in detail..."
          fullWidth
          required
          multiline
          rows={8}
          error={!!errors.description}
          helperText={errors.description || `${description.length}/5000 characters`}
          inputProps={{ maxLength: 5000 }}
          sx={{ mb: 3 }}
        />

        {/* KPIs / Success Criteria */}
        <TextField
          label="Success Criteria / KPIs"
          value={kpis}
          onChange={(e) => setKpis(e.target.value)}
          placeholder={`How will you judge if the work is complete?\nExample:\n- Must include brand colors\n- Delivered in SVG format\n- 3 variations`}
          fullWidth
          required
          multiline
          rows={4}
          error={!!errors.kpis}
          helperText={errors.kpis || `${kpis.length}/2000 characters`}
          inputProps={{ maxLength: 2000 }}
          sx={{ mb: 3 }}
        />

        {/* Payment Amount - Only for regular jobs */}
        {jobType === 'regular' && (
          <>
            <TextField
              label="Payment Amount"
              value={paymentAmount}
              onChange={(e) => {
                const value = e.target.value
                // Only allow numbers and decimal point
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setPaymentAmount(value)
                }
              }}
              placeholder="500"
              fullWidth
              required
              type="text"
              disabled={mode === 'edit' && applicationCount > 0}
              error={!!errors.paymentAmount}
              helperText={
                mode === 'edit' && applicationCount > 0
                  ? 'Payment amount cannot be changed after applications'
                  : mode === 'edit' && applicationCount === 0
                  ? 'Payment can be edited (no applications yet)'
                  : errors.paymentAmount
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <span style={{ fontWeight: 600, color: '#7C4DFF' }}>
                      {tokenSymbol}
                    </span>
                  </InputAdornment>
                )
              }}
              sx={{ mb: 1 }}
            />

            {/* USD Conversion Display */}
            {checkingPrice && (
              <div className="flex items-center gap-2 mb-3" style={{ color: '#6F7280' }}>
                <CircularProgress size={16} sx={{ color: '#7C4DFF' }} />
                <span className="text-sm">Checking USD value...</span>
              </div>
            )}

            {!checkingPrice && usdValue !== null && !belowMinimum && (
              <div className="mb-3" style={{ color: '#36C170' }}>
                <span className="text-sm font-medium">
                  ≈ ${usdValue.toFixed(2)} USD
                </span>
              </div>
            )}

            {!checkingPrice && belowMinimum && (
              <Alert 
                severity="warning" 
                icon={<WarningIcon />}
                sx={{ mb: 3 }}
              >
                <strong>Minimum $5 USD required</strong>
                <br />
                Current value: ${usdValue?.toFixed(2)} USD
              </Alert>
            )}

            {!checkingPrice && priceError && paymentAmount && (
              <Alert severity="error" sx={{ mb: 3 }}>
                Unable to fetch token price. Please try again or contact support.
              </Alert>
            )}
          </>
        )}

        {/* Assignment Mode - Only for regular jobs */}
        {jobType === 'regular' && (
          <FormControl component="fieldset" sx={{ mb: 3 }}>
            <FormLabel 
              component="legend"
              sx={{ 
                color: '#1A1A1E',
                fontWeight: 600,
                mb: 1
              }}
            >
              Assignment Mode
            </FormLabel>
            <RadioGroup
              value={assignmentMode}
              onChange={(e) => setAssignmentMode(e.target.value as 'first_come' | 'review')}
            >
              <FormControlLabel
                value="review"
                control={<Radio sx={{ color: '#7C4DFF', '&.Mui-checked': { color: '#7C4DFF' } }} />}
                label={
                  <div>
                    <div style={{ fontWeight: 500, color: '#1A1A1E' }}>
                      Review Applications (Recommended)
                    </div>
                    <div style={{ fontSize: '14px', color: '#6F7280' }}>
                      Review all applications and choose the best candidate. Token holders can upvote applications.
                    </div>
                  </div>
                }
              />
              <FormControlLabel
                value="first_come"
                control={<Radio sx={{ color: '#7C4DFF', '&.Mui-checked': { color: '#7C4DFF' } }} />}
                label={
                  <div>
                    <div style={{ fontWeight: 500, color: '#1A1A1E' }}>
                      First Come, First Served
                    </div>
                    <div style={{ fontSize: '14px', color: '#6F7280' }}>
                      First person to apply gets the job immediately. Faster but less control.
                    </div>
                  </div>
                }
              />
            </RadioGroup>
          </FormControl>
        )}

        {/* Desired Completion (Optional) - Only for regular jobs */}
        {mode === 'create' && jobType === 'regular' && (
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Desired Completion (Optional)</InputLabel>
            <Select
              value={desiredCompletionDays}
              label="Desired Completion (Optional)"
              onChange={(e) => setDesiredCompletionDays(e.target.value)}
            >
              <MenuItem value="">
                <em>No preference</em>
              </MenuItem>
              {COMPLETION_DAYS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" sx={{ mt: 0.5, color: '#6F7280', px: 1.5 }}>
              When you'd like this job completed (soft deadline)
            </Typography>
          </FormControl>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, flexDirection: 'column', alignItems: 'stretch' }}>
        {/* Invalidation Checkbox (only show in edit mode with applications) */}
        {mode === 'edit' && applicationCount > 0 && (
          <FormControlLabel
            control={
              <Checkbox
                checked={understoodInvalidation}
                onChange={(e) => setUnderstoodInvalidation(e.target.checked)}
                sx={{
                  color: '#FB923C',
                  '&.Mui-checked': {
                    color: '#FB923C'
                  }
                }}
              />
            }
            label={
              <span style={{ fontSize: '14px', color: '#1A1A1E' }}>
                I understand that <strong>{applicationCount} application{applicationCount > 1 ? 's' : ''} will be invalidated</strong> and applicants must reapply
              </span>
            }
            sx={{ mb: 2, alignSelf: 'flex-start' }}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
          <Button 
            onClick={onClose}
            disabled={loading}
            sx={{ 
              color: '#6F7280',
              textTransform: 'none',
              fontSize: '16px'
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={mode === 'edit' ? handleConfirmAndLock : handleReviewAndLock}
            disabled={
              loading || 
              (mode === 'create' && jobType === 'regular' && (checkingPrice || belowMinimum || priceError)) ||
              (mode === 'edit' && applicationCount > 0 && !understoodInvalidation)
            }
            variant="contained"
            startIcon={mode === 'create' ? <LockIcon /> : undefined}
            sx={{
              backgroundColor: '#7C4DFF',
              color: '#fff',
              textTransform: 'none',
              fontSize: '16px',
              px: 4,
              fontWeight: 600,
              '&:hover': {
                backgroundColor: '#6B3FEE'
              },
              '&:disabled': {
                backgroundColor: '#E5E7F0',
                color: '#A3A7B5'
              }
            }}
          >
            {loading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1, color: '#fff' }} />
                {mode === 'edit' ? 'Updating...' : 'Processing...'}
              </>
            ) : mode === 'edit' ? (
              'Update Job'
            ) : jobType === 'contest' ? (
              `🏆 Review & Lock ${calculateTotalWithFee().toFixed(2)} ${tokenSymbol}`
            ) : (
              'Review & Lock Tokens'
            )}
          </Button>
        </div>
      </DialogActions>
    </Dialog>
  )
}
