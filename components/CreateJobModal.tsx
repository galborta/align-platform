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
import { supabase } from '@/lib/supabase'
import { getTokenPriceUsd, validateMinimumUsdValue } from '@/lib/helius'
import { getFeePercentage } from '@/lib/platform-settings'
import { transferToEscrow, validateEscrowTransfer, calculateEscrowAmount } from '@/lib/solana/escrow-transfer'
import { saveDraft } from '@/lib/job-drafts'
import { toast } from 'react-hot-toast'
import WarningIcon from '@mui/icons-material/Warning'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { ProtectedAction } from '@/components/ProtectedAction'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import DeleteIcon from '@mui/icons-material/Delete'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { uploadJobAttachment, getFilenameFromUrl, getFileIcon } from '@/lib/job-attachments'

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
  initialJobType?: 'regular' | 'contest'
  onSwitchToSocialMedia?: () => void
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
  onJobCreated,
  initialJobType = 'regular',
  onSwitchToSocialMedia
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
  const [recoveryInfo, setRecoveryInfo] = useState<{ 
    isRecoverable: boolean
    txSignature?: string 
  } | null>(null)
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
  const [attachments, setAttachments] = useState<Array<{ file: File; displayName: string }>>([])
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([])
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null)
  const [editingFileName, setEditingFileName] = useState<string>('') // For edit mode
  const [desiredCompletionDays, setDesiredCompletionDays] = useState<string>('')
  
  // Contest-specific state
  const [contestStep, setContestStep] = useState<1 | 2>(1) // Step 1: Info, Step 2: Settings
  const [contestTotalPrizePool, setContestTotalPrizePool] = useState<string>('') // Total prize pool input
  const [contestMaxWinners, setContestMaxWinners] = useState<number>(1)
  const [contestPrizes, setContestPrizes] = useState<Array<{
    position: number
    amount_tokens: number
    amount_usd: number
    isManuallyEdited?: boolean // Track if user manually edited this prize
  }>>([
    { position: 1, amount_tokens: 0, amount_usd: 0, isManuallyEdited: false }
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
      // Detect job type from existing job
      if (existingJob.is_contest) {
        setJobType('contest')
        // Pre-fill contest fields
        if (existingJob.contest_max_winners) {
          setContestMaxWinners(existingJob.contest_max_winners)
        }
        if (existingJob.contest_winner_prizes) {
          setContestPrizes(existingJob.contest_winner_prizes as Array<{
            position: number
            amount_tokens: number
            amount_usd: number
          }>)
        }
        if (existingJob.contest_submission_deadline) {
          setContestSubmissionDeadline(new Date(existingJob.contest_submission_deadline))
        }
        if (existingJob.contest_submissions_visible !== undefined) {
          setContestSubmissionsVisible(existingJob.contest_submissions_visible)
        }
      } else {
        setJobType('regular')
        setPaymentAmount(existingJob.payment_amount_tokens?.toString() || '')
      }
      
      // Populate fields with existing job data
      setTitle(existingJob.title || '')
      setCategory(existingJob.category || '')
      setDescription(existingJob.description || '')
      setKpis(existingJob.kpis || '')
      setAssignmentMode(existingJob.assignment_mode || 'review')
      setUsdValue(existingJob.payment_amount_usd || 0)
      
      // Load existing attachments
      if (existingJob.attachment_urls && Array.isArray(existingJob.attachment_urls)) {
        setAttachmentUrls(existingJob.attachment_urls)
      }
      
      // Fetch application count
      fetchApplicationCount(existingJob.id)
    } else if (isOpen && mode === 'create') {
      // Set initial job type when opening in create mode
      setJobType(initialJobType)
    }
  }, [isOpen, mode, existingJob, initialJobType])

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

  // Check USD value when payment amount changes (for regular jobs)
  useEffect(() => {
    const amount = parseFloat(paymentAmount)
    if (paymentAmount && !isNaN(amount) && amount > 0) {
      checkUsdValue(amount)
    } else {
      setUsdValue(null)
      setPriceError(false)
    }
  }, [paymentAmount, tokenMint])

  // Fetch token price when modal opens (needed for contest prize USD calculations)
  useEffect(() => {
    const fetchTokenPrice = async () => {
      if (!isOpen || !tokenMint) return
      
      try {
        const price = await getTokenPriceUsd(tokenMint)
        setTokenPrice(price)
      } catch (error) {
        console.error('Error fetching token price:', error)
      }
    }
    
    fetchTokenPrice()
  }, [isOpen, tokenMint])

  // Recalculate contest prize USD values when token price is fetched
  useEffect(() => {
    if (tokenPrice !== null && jobType === 'contest' && contestPrizes.length > 0) {
      const updatedPrizes = contestPrizes.map(prize => ({
        ...prize,
        amount_usd: prize.amount_tokens * tokenPrice
      }))
      setContestPrizes(updatedPrizes)
    }
  }, [tokenPrice, jobType])

  const resetForm = () => {
    setJobType('regular')
    setTitle('')
    setCategory('')
    setDescription('')
    setKpis('')
    setPaymentAmount('')
    setAssignmentMode('review')
    setDesiredCompletionDays('')
    setAttachments([])
    setAttachmentUrls([])
    // Reset contest-specific state
    setContestStep(1)
    setContestTotalPrizePool('')
    setContestMaxWinners(1)
    setContestPrizes([{ position: 1, amount_tokens: 0, amount_usd: 0, isManuallyEdited: false }])
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
    setRecoveryInfo(null)
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

  // Calculate total prize pool for contests (from actual prizes array)
  const calculateTotalPrizePool = () => {
    return contestPrizes.reduce((sum, prize) => sum + prize.amount_tokens, 0)
  }

  // Calculate total with platform fee for contests
  const calculateTotalWithFee = () => {
    const total = calculateTotalPrizePool()
    return total * (1 + feePercentage / 100)
  }

  // Get decreasing tier percentages based on number of winners
  const getDecreasingTierPercentages = (numWinners: number): number[] => {
    switch (numWinners) {
      case 1:
        return [100]
      case 2:
        return [60, 40]
      case 3:
        return [50, 30, 20]
      case 4:
        return [40, 30, 20, 10]
      case 5:
        return [35, 25, 20, 12, 8]
      case 6:
        return [30, 22, 18, 14, 10, 6]
      case 7:
        return [28, 20, 16, 13, 10, 8, 5]
      case 8:
        return [26, 18, 15, 12, 10, 8, 6, 5]
      case 9:
        return [24, 17, 14, 12, 10, 8, 7, 5, 3]
      case 10:
        return [22, 16, 13, 11, 10, 8, 7, 6, 4, 3]
      default:
        // Fallback for any edge case
        const equalShare = 100 / numWinners
        return Array(numWinners).fill(equalShare)
    }
  }

  // Auto-distribute prizes based on total and number of winners
  const distributeContestPrizes = (total: number, numWinners: number) => {
    const percentages = getDecreasingTierPercentages(numWinners)
    const newPrizes = percentages.map((percentage, index) => ({
      position: index + 1,
      amount_tokens: (total * percentage) / 100,
      amount_usd: ((total * percentage) / 100) * (tokenPrice || 0),
      isManuallyEdited: false
    }))
    setContestPrizes(newPrizes)
  }

  // Handle total prize pool input change
  const handleTotalPrizePoolChange = (value: string) => {
    // Only allow numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setContestTotalPrizePool(value)
      const numValue = parseFloat(value)
      if (!isNaN(numValue) && numValue > 0) {
        distributeContestPrizes(numValue, contestMaxWinners)
      }
    }
  }

  // Handle number of winners change (recalculate distribution)
  const handleWinnersChange = (newCount: number) => {
    setContestMaxWinners(newCount)
    const totalValue = parseFloat(contestTotalPrizePool)
    if (!isNaN(totalValue) && totalValue > 0) {
      distributeContestPrizes(totalValue, newCount)
    } else {
      // Just update the prizes array structure with 0 values
      const percentages = getDecreasingTierPercentages(newCount)
      const newPrizes = percentages.map((_, index) => ({
        position: index + 1,
        amount_tokens: 0,
        amount_usd: 0,
        isManuallyEdited: false
      }))
      setContestPrizes(newPrizes)
    }
  }

  // File attachment handlers
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const newFiles = Array.from(files)
    const validFiles: Array<{ file: File; displayName: string }> = []
    
    for (const file of newFiles) {
      // Check file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`)
        continue
      }
      
      validFiles.push({ file, displayName: file.name })
    }

    setAttachments(prev => [...prev, ...validFiles])
    
    // Reset input so same file can be selected again if removed and re-added
    event.target.value = ''
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
    // Cancel editing if this file was being edited
    if (editingFileIndex === index) {
      setEditingFileIndex(null)
      setEditingFileName('')
    }
  }

  const handleStartEditFileName = (index: number, currentName: string) => {
    setEditingFileIndex(index)
    setEditingFileName(currentName)
  }

  const handleSaveFileName = (index: number) => {
    if (!editingFileName.trim()) {
      toast.error('Filename cannot be empty')
      return
    }

    setAttachments(prev => prev.map((item, i) => 
      i === index ? { ...item, displayName: editingFileName.trim() } : item
    ))
    setEditingFileIndex(null)
    setEditingFileName('')
  }

  const handleCancelEditFileName = () => {
    setEditingFileIndex(null)
    setEditingFileName('')
  }

  const handleRemoveExistingAttachment = (url: string) => {
    setAttachmentUrls(prev => prev.filter(u => u !== url))
  }

  // Handle individual prize edit (manual override)
  const handlePrizeManualEdit = (position: number, amount: number) => {
    setContestPrizes(prev => prev.map(prize => 
      prize.position === position 
        ? { 
            ...prize, 
            amount_tokens: amount, 
            amount_usd: amount * (tokenPrice || 0),
            isManuallyEdited: true 
          }
        : prize
    ))
  }

  // Check if manual edits have caused prizes to differ from entered total
  const getActualVsEnteredTotal = () => {
    const enteredTotal = parseFloat(contestTotalPrizePool) || 0
    const actualTotal = calculateTotalPrizePool()
    const difference = actualTotal - enteredTotal
    return { enteredTotal, actualTotal, difference, hasDifference: Math.abs(difference) > 0.01 }
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

  // Contest Step 1 validation (info fields only)
  const validateContestStep1 = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!title.trim()) {
      newErrors.title = 'Title is required'
    } else if (title.length > 200) {
      newErrors.title = 'Title must be 200 characters or less'
    }
    
    if (!category) {
      newErrors.category = 'Category is required'
    }
    
    if (!description.trim()) {
      newErrors.description = 'Description is required'
    } else if (description.length > 5000) {
      newErrors.description = 'Description must be 5000 characters or less'
    }
    
    if (!kpis.trim()) {
      newErrors.kpis = 'Deliverables are required'
    } else if (kpis.length > 3000) {
      newErrors.kpis = 'Deliverables must be 3000 characters or less'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Contest-specific validation (Step 2 - settings)
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

  // Handle going to next step in contest flow
  const handleContestNextStep = () => {
    if (contestStep === 1) {
      if (validateContestStep1()) {
        setContestStep(2)
      } else {
        toast.error('Please fill in all required fields')
      }
    }
  }

  // Handle going back in contest flow
  const handleContestPrevStep = () => {
    if (contestStep === 2) {
      setContestStep(1)
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
      // For contests, validate both Step 1 (info) and Step 2 (settings)
      if (!validateContestStep1()) {
        toast.error('Please fix the contest information errors')
        setContestStep(1) // Go back to step 1 if info is invalid
        return
      }
      
      const contestValidation = validateContestFields()
      if (!contestValidation.isValid) {
        toast.error(contestValidation.errors[0]) // Show first error
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
    setRecoveryInfo(null)
    
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

        // Add contest-specific fields if this is a contest job
        if (existingJob.is_contest) {
          updatePayload.contest_prizes = contestPrizes
          updatePayload.contest_submission_deadline = contestSubmissionDeadline?.toISOString()
          updatePayload.contest_submissions_visible = contestSubmissionsVisible
        }

        // Handle payment amount change and escrow adjustment
        const newAmount = parseFloat(paymentAmount)
        const oldAmount = existingJob.payment_amount_tokens
        
        console.log('[Edit Job] Payment change check:', {
          newAmount,
          oldAmount,
          applicationCount,
          paymentAmountString: paymentAmount,
          isDifferent: newAmount !== oldAmount
        })
        
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

              // Get Supabase session for authentication (try to refresh if expired)
              let session = (await supabase.auth.getSession()).data.session
              
              // If no session or expired, try to refresh
              if (!session) {
                const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
                if (refreshError || !refreshedSession) {
                  toast.error('Authentication session expired. Please refresh the page and try again.', { id: 'escrow-adjust' })
                  setLoading(false)
                  return
                }
                session = refreshedSession
              }

              const refundResponse = await fetch(`/api/jobs/${existingJob.id}/adjust-escrow`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
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

        // Get Supabase session for authentication (try to refresh if expired)
        let session = (await supabase.auth.getSession()).data.session
        
        // If no session or expired, try to refresh
        if (!session) {
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError || !refreshedSession) {
            toast.error('Authentication session expired. Please refresh the page and try again.')
            setLoading(false)
            return
          }
          session = refreshedSession
        }

        // Call backend API to update the job
        const response = await fetch(`/api/jobs/${existingJob.id}/update`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(updatePayload)
        })

        const data = await response.json()
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to update job')
        }

        // Upload new attachments if any
        if (attachments.length > 0) {
          toast.loading(`Uploading ${attachments.length} file${attachments.length > 1 ? 's' : ''}...`, { id: 'upload-files' })
          
          const uploadedUrls: string[] = []
          for (const item of attachments) {
            const result = await uploadJobAttachment(item.file, existingJob.id, item.displayName)
            if (result.success && result.url) {
              uploadedUrls.push(result.url)
            } else {
              console.error(`Failed to upload ${item.displayName}:`, result.error)
              toast.error(`Failed to upload ${item.displayName}: ${result.error}`)
            }
          }
          
          if (uploadedUrls.length > 0) {
            // Combine with existing attachment URLs that weren't removed
            const allAttachmentUrls = [...attachmentUrls, ...uploadedUrls]
            
            // Update job with all attachment URLs
            const attachmentResponse = await fetch(`/api/jobs/${existingJob.id}/update`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                poster_wallet: walletAddress,
                attachment_urls: allAttachmentUrls
              })
            })
            
            const attachmentData = await attachmentResponse.json()
            if (!attachmentResponse.ok || !attachmentData.success) {
              console.error('Failed to update attachment URLs:', attachmentData.error)
              toast.error('Files uploaded but failed to link to job. Please try editing again.')
            } else {
              toast.success(`${uploadedUrls.length} file${uploadedUrls.length > 1 ? 's' : ''} attached!`, { id: 'upload-files' })
            }
          } else {
            toast.dismiss('upload-files')
          }
        } else if (attachmentUrls.length !== (existingJob.attachment_urls?.length || 0)) {
          // Only attachment URLs changed (removals), update them
          const attachmentResponse = await fetch(`/api/jobs/${existingJob.id}/update`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              poster_wallet: walletAddress,
              attachment_urls: attachmentUrls
            })
          })
          
          const attachmentData = await attachmentResponse.json()
          if (!attachmentResponse.ok || !attachmentData.success) {
            console.error('Failed to update attachment URLs:', attachmentData.error)
            toast.error('Failed to update attachments. Please try again.')
          }
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

        // Validate token balance BEFORE attempting transfer
        const balanceValidation = await validateEscrowTransfer(
          connection,
          publicKey,
          new PublicKey(tokenMint),
          totalEscrowAmount,
          9 // Assuming 9 decimals - TODO: Get actual decimals from token metadata
        )

        if (!balanceValidation.valid) {
          setLockError(balanceValidation.error || `Insufficient token balance. You need ${totalEscrowAmount.toFixed(2)} ${tokenSymbol} (payment + ${feePercentage}% platform fee)`)
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
          
          // Check if transaction may have been sent despite the error
          if (transferResult.mayHaveBeenSent) {
            setLockError(
              '⚠️ Transaction status uncertain! Your tokens may have been sent. ' +
              'Please check your wallet history. If tokens were transferred, use the Recovery page to create your job.'
            )
            setRecoveryInfo({
              isRecoverable: true,
              txSignature: undefined // User needs to find it in their wallet
            })
            toast.error('Please check your wallet - transaction may have been sent!', {
              duration: 10000,
              icon: '⚠️'
            })
          } else {
            setLockError(transferResult.error || 'Failed to lock tokens in escrow')
          }
          
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
          
          // Use API route for contest creation (bypasses RLS with service role)
          const contestResponse = await fetch('/api/jobs/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
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
              assignment_mode: 'review',
              poster_desired_completion: contestSubmissionDeadline!.toISOString(),
              token_symbol: tokenSymbol,
            })
          })
          
          if (!contestResponse.ok) {
            const errorData = await contestResponse.json()
            console.error('[CreateJobModal] Contest API error:', errorData)
            throw new Error(errorData.error || 'Failed to create contest')
          }
          
          const contestResult = await contestResponse.json()
          jobData = contestResult.job
        } else {
          // Regular job data (existing logic)
          const validation = await validateMinimumUsdValue(tokenMint, amount, 5)
          
          // Use API route for job creation (bypasses RLS with service role)
          const jobResponse = await fetch('/api/jobs/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
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
              token_symbol: tokenSymbol,
            })
          })
          
          if (!jobResponse.ok) {
            const errorData = await jobResponse.json()
            console.error('[CreateJobModal] Job API error:', errorData)
            throw new Error(errorData.error || 'Failed to create job')
          }
          
          const jobResult = await jobResponse.json()
          jobData = jobResult.job
        }

        // Upload attachments if any
        if (attachments.length > 0 && jobData?.id) {
          toast.loading(`Uploading ${attachments.length} file${attachments.length > 1 ? 's' : ''}...`, { id: 'upload-files' })
          
          const uploadedUrls: string[] = []
          for (const item of attachments) {
            const result = await uploadJobAttachment(item.file, jobData.id, item.displayName)
            if (result.success && result.url) {
              uploadedUrls.push(result.url)
            } else {
              console.error(`Failed to upload ${item.displayName}:`, result.error)
              toast.error(`Failed to upload ${item.displayName}`)
            }
          }
          
          if (uploadedUrls.length > 0) {
            // Update job with attachment URLs
            const session = (await supabase.auth.getSession()).data.session
            if (session) {
              await fetch(`/api/jobs/${jobData.id}/update`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                  poster_wallet: walletAddress,
                  attachment_urls: uploadedUrls
                })
              })
            }
            toast.success(`${uploadedUrls.length} file${uploadedUrls.length > 1 ? 's' : ''} attached!`, { id: 'upload-files' })
          } else {
            toast.dismiss('upload-files')
          }
        }

        // Note: Escrow transaction logging is handled by the API route

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
      // Detailed error logging for debugging
      console.error(`[CreateJobModal] Error ${mode === 'edit' ? 'updating' : 'creating'} job:`, {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorStack: error instanceof Error ? error.stack : undefined,
        escrowTxSignature,
        projectId,
        title: title.trim(),
        timestamp: new Date().toISOString()
      })
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.dismiss('escrow-lock')
      toast.dismiss('upload-files')
      
      // If escrow succeeded but job creation failed, save draft for recovery
      if (mode === 'create' && escrowTxSignature) {
        console.log('[CreateJobModal] Escrow succeeded but job creation failed - saving draft for recovery')
        
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
            '⚠️ Your tokens were locked successfully, but job creation failed due to a network issue. ' +
            `Your funds are safe! Click "Recover Job" below to complete the job creation.`
          )
          setRecoveryInfo({
            isRecoverable: true,
            txSignature: escrowTxSignature
          })
          toast.error('Job needs recovery - click the button below', {
            duration: 8000,
            icon: '💾'
          })
        } else {
          setLockError(
            `⚠️ CRITICAL: Tokens locked but job creation failed. ` +
            `Your funds are safe in escrow. Transaction: ${escrowTxSignature}. ` +
            `Please go to the Jobs tab and click "Recover" to complete job creation, or contact support.`
          )
          setRecoveryInfo({
            isRecoverable: true,
            txSignature: escrowTxSignature
          })
          toast.error('Please recover your job from the Jobs tab!', {
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
            <Alert 
              severity={recoveryInfo?.isRecoverable ? "warning" : "error"} 
              sx={{ mb: 2 }}
              action={
                recoveryInfo?.isRecoverable && (
                  <Button 
                    color="inherit" 
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      // Navigate to recovery page
                      // If we have a tx signature, pass it as query param
                      const recoveryUrl = recoveryInfo?.txSignature
                        ? `/project/${projectId}/jobs?recover=true&tx=${recoveryInfo.txSignature}`
                        : `/project/${projectId}/recover-escrow`
                      window.location.href = recoveryUrl
                    }}
                    sx={{ 
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                      borderColor: 'currentColor',
                      '&:hover': {
                        borderColor: 'currentColor',
                        bgcolor: 'rgba(255,255,255,0.1)'
                      }
                    }}
                  >
                    🔧 {recoveryInfo?.txSignature ? 'Recover Job' : 'Go to Recovery'}
                  </Button>
                )
              }
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {recoveryInfo?.isRecoverable ? 'Recovery Required' : 'Error'}
                </Typography>
                <Typography variant="body2">
                  {lockError}
                </Typography>
                {recoveryInfo?.txSignature && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, fontFamily: 'monospace' }}>
                    Transaction: {recoveryInfo.txSignature.slice(0, 12)}...{recoveryInfo.txSignature.slice(-8)}
                  </Typography>
                )}
              </Box>
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
            ? `🏆 Create Contest Job${contestStep === 1 ? ' - Contest Info' : ' - Settings'}`
            : 'Post a Job'}
      </DialogTitle>

      {/* Contest Step Indicator */}
      {jobType === 'contest' && mode === 'create' && (
        <Box sx={{ px: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Step 1 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              <Box sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: contestStep >= 1 ? '#7C4DFF' : '#E5E7F0',
                color: contestStep >= 1 ? 'white' : '#6F7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 600
              }}>
                1
              </Box>
              <Typography sx={{ 
                fontSize: '14px', 
                fontWeight: contestStep === 1 ? 600 : 400,
                color: contestStep === 1 ? '#1A1A1E' : '#6F7280'
              }}>
                Contest Info
              </Typography>
            </Box>

            {/* Connector */}
            <Box sx={{ 
              flex: 0.5, 
              height: 2, 
              bgcolor: contestStep >= 2 ? '#7C4DFF' : '#E5E7F0',
              borderRadius: 1
            }} />

            {/* Step 2 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              <Box sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: contestStep >= 2 ? '#7C4DFF' : '#E5E7F0',
                color: contestStep >= 2 ? 'white' : '#6F7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 600
              }}>
                2
              </Box>
              <Typography sx={{ 
                fontSize: '14px', 
                fontWeight: contestStep === 2 ? 600 : 400,
                color: contestStep === 2 ? '#1A1A1E' : '#6F7280'
              }}>
                Prize Settings
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      <DialogContent 
        sx={{ pt: 3 }}
        onScroll={handleScroll}
      >
        {/* Job Type Toggle - Hide in edit mode and on contest Step 2 */}
        {mode === 'create' && !(jobType === 'contest' && contestStep === 2) && (
          <Box sx={{ mb: 3, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant={jobType === 'regular' ? 'contained' : 'outlined'}
              onClick={() => {
                setJobType('regular')
                setContestStep(1) // Reset contest step when switching
              }}
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
              💼 Regular Job
            </Button>
            <Button
              variant={jobType === 'contest' ? 'contained' : 'outlined'}
              onClick={() => {
                setJobType('contest')
                setContestStep(1) // Always start at step 1 for contests
              }}
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
            {onSwitchToSocialMedia && (
              <Button
                variant="outlined"
                onClick={() => {
                  onClose()
                  onSwitchToSocialMedia()
                }}
                sx={{
                  bgcolor: 'transparent',
                  color: '#7C4DFF',
                  borderColor: '#7C4DFF',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  position: 'relative',
                  '&:hover': {
                    bgcolor: 'rgba(124, 77, 255, 0.08)'
                  }
                }}
              >
                📣 Social Campaign
                <Box
                  component="span"
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    bgcolor: '#E3F06F',
                    color: '#1A1A1E',
                    fontSize: '9px',
                    fontWeight: 700,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}
                >
                  New
                </Box>
              </Button>
            )}
          </Box>
        )}

        {/* Contest Step 1: Contest Info */}
        {jobType === 'contest' && contestStep === 1 && (
          <>
            <Alert severity="info" sx={{ mb: 3 }}>
              <strong>Contest Mode:</strong> Multiple workers can submit entries. You'll manually select winner(s) after the submission deadline.
            </Alert>

            {/* Title */}
            <TextField
              label="Contest Title"
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
              label="Contest Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you're looking for in detail. What's the context? What style or approach do you prefer? Any specific requirements?"
              fullWidth
              required
              multiline
              rows={6}
              error={!!errors.description}
              helperText={errors.description || `${description.length}/5000 characters`}
              inputProps={{ maxLength: 5000 }}
              sx={{ mb: 3 }}
            />

            {/* Deliverables / Success Criteria - Larger text box for contests */}
            <TextField
              label="Deliverables & Success Criteria"
              value={kpis}
              onChange={(e) => setKpis(e.target.value)}
              placeholder={`What do participants need to deliver? How will you judge the entries?\n\nExample:\n• Final design in PNG, SVG, and AI formats\n• 3 color variations\n• Include brand colors (#7C4DFF, #E3F06F)\n• Must work at both small and large sizes\n• Original work only (no AI-generated content)\n• Include mockup of design in use`}
              fullWidth
              required
              multiline
              minRows={8}
              maxRows={16}
              error={!!errors.kpis}
              helperText={errors.kpis || `${kpis.length}/3000 characters - Be detailed so participants know exactly what to submit`}
              inputProps={{ maxLength: 3000 }}
              sx={{ 
                mb: 3,
                '& .MuiInputBase-root': {
                  alignItems: 'flex-start'
                },
                '& .MuiInputBase-input': {
                  lineHeight: 1.6
                }
              }}
            />

            {/* File Attachments */}
            <Box sx={{ mb: 3 }}>
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  mb: 1.5, 
                  color: '#1A1A1E',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <AttachFileIcon sx={{ fontSize: 18 }} />
                Attachments (Optional)
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ color: '#6F7280', display: 'block', mb: 2 }}
              >
                Upload briefs, references, specifications, fonts, or other resources (Max 10MB per file)
              </Typography>

              {/* Existing attachments (edit mode) */}
              {attachmentUrls.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  {attachmentUrls.map((url, index) => (
                    <Box
                      key={url}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        mb: 1,
                        borderRadius: '8px',
                        bgcolor: '#F9FAFB',
                        border: '1px solid #E5E7EB'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 20 }}>
                          {getFileIcon(url)}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '14px',
                            color: '#1A1A1E',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {getFilenameFromUrl(url)}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveExistingAttachment(url)}
                        sx={{ color: '#EF4444' }}
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}

              {/* New attachments */}
              {attachments.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  {attachments.map((item, index) => (
                    <Box
                      key={`${item.file.name}-${index}`}
                      sx={{
                        display: 'flex',
                        alignments: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        mb: 1,
                        borderRadius: '8px',
                        bgcolor: '#EEF2FF',
                        border: '1px solid #C7D2FE'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 20 }}>
                          {getFileIcon(item.displayName)}
                        </Typography>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          {editingFileIndex === index ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <input
                                type="text"
                                value={editingFileName}
                                onChange={(e) => setEditingFileName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveFileName(index)
                                  if (e.key === 'Escape') handleCancelEditFileName()
                                }}
                                autoFocus
                                style={{
                                  flex: 1,
                                  padding: '4px 8px',
                                  fontSize: '14px',
                                  border: '1px solid #7C4DFF',
                                  borderRadius: '4px',
                                  outline: 'none'
                                }}
                              />
                              <IconButton
                                size="small"
                                onClick={() => handleSaveFileName(index)}
                                sx={{ color: '#10B981', padding: '4px' }}
                              >
                                <CheckIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={handleCancelEditFileName}
                                sx={{ color: '#6F7280', padding: '4px' }}
                              >
                                <CloseIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Box>
                          ) : (
                            <>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography
                                  sx={{
                                    fontSize: '14px',
                                    color: '#1A1A1E',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {item.displayName}
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={() => handleStartEditFileName(index, item.displayName)}
                                  sx={{ padding: '2px', color: '#7C4DFF' }}
                                >
                                  <EditIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Box>
                              <Typography sx={{ fontSize: '12px', color: '#6F7280' }}>
                                {(item.file.size / 1024).toFixed(1)} KB
                              </Typography>
                            </>
                          )}
                        </Box>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveAttachment(index)}
                        sx={{ color: '#EF4444' }}
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Upload button */}
              <Button
                component="label"
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                sx={{
                  color: '#7C4DFF',
                  borderColor: '#E5DEFF',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': {
                    bgcolor: 'rgba(124, 77, 255, 0.04)',
                    borderColor: '#7C4DFF'
                  }
                }}
              >
                Add Files
                <input
                  type="file"
                  hidden
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.zip,.txt,.doc,.docx,.xls,.xlsx,.ttf,.otf,.woff,.woff2"
                  onChange={handleFileSelect}
                />
              </Button>
            </Box>
          </>
        )}

        {/* Contest Step 2: Settings */}
        {jobType === 'contest' && contestStep === 2 && (
          <Box sx={{ 
            border: '1px solid #7C4DFF', 
            borderRadius: 2, 
            p: 3, 
            mb: 3,
            bgcolor: 'rgba(124, 77, 255, 0.05)'
          }}>
            <Typography variant="h6" sx={{ mb: 3, color: '#7C4DFF' }}>
              Prize Settings
            </Typography>

            {/* Total Prize Pool Input */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                Total Prize Pool *
              </Typography>
              <TextField
                fullWidth
                placeholder="Enter total amount to distribute"
                value={contestTotalPrizePool}
                onChange={(e) => handleTotalPrizePoolChange(e.target.value)}
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
              {contestTotalPrizePool && parseFloat(contestTotalPrizePool) > 0 && tokenPrice && (
                <Typography variant="body2" sx={{ color: '#36C170', fontWeight: 500 }}>
                  ≈ ${(parseFloat(contestTotalPrizePool) * tokenPrice).toFixed(2)} USD
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                This is the total amount that will be distributed among all winners
              </Typography>
            </Box>

            {/* Number of Winners */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                Number of Winners *
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton 
                  onClick={() => handleWinnersChange(Math.max(1, contestMaxWinners - 1))}
                  disabled={contestMaxWinners <= 1}
                  sx={{ border: '1px solid #E5E7F0' }}
                >
                  <RemoveIcon />
                </IconButton>
                <Typography variant="h6" sx={{ minWidth: 40, textAlign: 'center' }}>
                  {contestMaxWinners}
                </Typography>
                <IconButton 
                  onClick={() => handleWinnersChange(Math.min(10, contestMaxWinners + 1))}
                  disabled={contestMaxWinners >= 10}
                  sx={{ border: '1px solid #E5E7F0' }}
                >
                  <AddIcon />
                </IconButton>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Prizes are automatically distributed in decreasing tiers
              </Typography>
            </Box>

            {/* Prize Distribution - Auto-calculated, Editable */}
            {contestPrizes.length > 0 && parseFloat(contestTotalPrizePool) > 0 && (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Prize Distribution
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Click any amount to customize
                  </Typography>
                </Box>
                
                {contestPrizes.map((prize) => {
                  const percentage = parseFloat(contestTotalPrizePool) > 0 
                    ? ((prize.amount_tokens / parseFloat(contestTotalPrizePool)) * 100).toFixed(0)
                    : '0'
                  
                  return (
                    <Box key={prize.position} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ minWidth: 90, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {prize.position === 1 ? '🥇' :
                             prize.position === 2 ? '🥈' :
                             prize.position === 3 ? '🥉' :
                             `#${prize.position}`}
                          </Typography>
                          <Chip 
                            label={`${percentage}%`} 
                            size="small" 
                            sx={{ 
                              fontSize: '11px',
                              height: 20,
                              bgcolor: prize.isManuallyEdited ? '#FFF4E6' : '#E5E7F0',
                              color: prize.isManuallyEdited ? '#FB923C' : '#6F7280'
                            }}
                          />
                        </Box>
                        <TextField
                          type="number"
                          size="small"
                          value={prize.amount_tokens || ''}
                          onChange={(e) => {
                            const amount = parseFloat(e.target.value) || 0
                            handlePrizeManualEdit(prize.position, amount)
                          }}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <span style={{ fontWeight: 600, color: '#7C4DFF', fontSize: '13px' }}>
                                  {tokenSymbol}
                                </span>
                              </InputAdornment>
                            )
                          }}
                          sx={{ 
                            flex: 1,
                            '& .MuiInputBase-input': { 
                              py: 1,
                              fontSize: '14px'
                            }
                          }}
                        />
                        <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 80, textAlign: 'right' }}>
                          ≈ ${prize.amount_usd.toFixed(2)}
                        </Typography>
                      </Box>
                    </Box>
                  )
                })}

                {/* Warning if manual edits caused difference */}
                {getActualVsEnteredTotal().hasDifference && (
                  <Alert 
                    severity="warning" 
                    sx={{ mt: 2 }}
                    icon={<WarningIcon fontSize="small" />}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Prize total ({calculateTotalPrizePool().toFixed(2)} {tokenSymbol}) differs from entered amount ({parseFloat(contestTotalPrizePool).toFixed(2)} {tokenSymbol})
                    </Typography>
                    <Typography variant="caption">
                      The actual total from individual prizes will be used for escrow.
                    </Typography>
                  </Alert>
                )}
              </Box>
            )}

            <Divider sx={{ my: 3 }} />

            {/* Submission Deadline */}
            <Box sx={{ mb: 3 }}>
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
            <Box sx={{ mb: 3 }}>
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

            {/* Total Summary */}
            <Box sx={{ 
              mt: 3, 
              p: 2, 
              bgcolor: 'background.paper', 
              borderRadius: 1,
              border: '2px solid #7C4DFF'
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Total Prize Pool:</Typography>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {calculateTotalPrizePool().toFixed(2)} {tokenSymbol}
                  </Typography>
                  {tokenPrice && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      ≈ ${(calculateTotalPrizePool() * tokenPrice).toFixed(2)} USD
                    </Typography>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Platform Fee ({feePercentage}%):</Typography>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2">
                    {(calculateTotalPrizePool() * (feePercentage / 100)).toFixed(2)} {tokenSymbol}
                  </Typography>
                  {tokenPrice && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      ≈ ${(calculateTotalPrizePool() * (feePercentage / 100) * tokenPrice).toFixed(2)} USD
                    </Typography>
                  )}
                </Box>
              </Box>
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Total to Lock:
                </Typography>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body1" sx={{ fontWeight: 700, color: '#7C4DFF' }}>
                    {calculateTotalWithFee().toFixed(2)} {tokenSymbol}
                  </Typography>
                  {tokenPrice && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      ≈ ${(calculateTotalWithFee() * tokenPrice).toFixed(2)} USD
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* Field Counter and Scroll Hint - Only for regular jobs */}
        {jobType === 'regular' && (
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
        )}
        
        {/* Scroll Hint - Only show for regular jobs when not scrolled */}
        {jobType === 'regular' && !hasScrolled && (
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

        {/* Regular Job Form Fields */}
        {jobType === 'regular' && (
          <>
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

            {/* File Attachments */}
            <Box sx={{ mb: 3 }}>
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  mb: 1.5, 
                  color: '#1A1A1E',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <AttachFileIcon sx={{ fontSize: 18 }} />
                Attachments (Optional)
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ color: '#6F7280', display: 'block', mb: 2 }}
              >
                Upload briefs, references, specifications, fonts, or other resources (Max 10MB per file)
              </Typography>

              {/* Existing attachments (edit mode) */}
              {attachmentUrls.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  {attachmentUrls.map((url, index) => (
                    <Box
                      key={url}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        mb: 1,
                        borderRadius: '8px',
                        bgcolor: '#F9FAFB',
                        border: '1px solid #E5E7EB'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 20 }}>
                          {getFileIcon(url)}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '14px',
                            color: '#1A1A1E',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {getFilenameFromUrl(url)}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveExistingAttachment(url)}
                        sx={{ color: '#EF4444' }}
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}

              {/* New attachments */}
              {attachments.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  {attachments.map((item, index) => (
                    <Box
                      key={`${item.file.name}-${index}`}
                      sx={{
                        display: 'flex',
                        alignments: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        mb: 1,
                        borderRadius: '8px',
                        bgcolor: '#EEF2FF',
                        border: '1px solid #C7D2FE'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 20 }}>
                          {getFileIcon(item.displayName)}
                        </Typography>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          {editingFileIndex === index ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <input
                                type="text"
                                value={editingFileName}
                                onChange={(e) => setEditingFileName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveFileName(index)
                                  if (e.key === 'Escape') handleCancelEditFileName()
                                }}
                                autoFocus
                                style={{
                                  flex: 1,
                                  padding: '4px 8px',
                                  fontSize: '14px',
                                  border: '1px solid #7C4DFF',
                                  borderRadius: '4px',
                                  outline: 'none'
                                }}
                              />
                              <IconButton
                                size="small"
                                onClick={() => handleSaveFileName(index)}
                                sx={{ color: '#10B981', padding: '4px' }}
                              >
                                <CheckIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={handleCancelEditFileName}
                                sx={{ color: '#6F7280', padding: '4px' }}
                              >
                                <CloseIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Box>
                          ) : (
                            <>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography
                                  sx={{
                                    fontSize: '14px',
                                    color: '#1A1A1E',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {item.displayName}
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={() => handleStartEditFileName(index, item.displayName)}
                                  sx={{ padding: '2px', color: '#7C4DFF' }}
                                >
                                  <EditIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Box>
                              <Typography sx={{ fontSize: '12px', color: '#6F7280' }}>
                                {(item.file.size / 1024).toFixed(1)} KB
                              </Typography>
                            </>
                          )}
                        </Box>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveAttachment(index)}
                        sx={{ color: '#EF4444' }}
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Upload button */}
              <Button
                component="label"
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                sx={{
                  color: '#7C4DFF',
                  borderColor: '#E5DEFF',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': {
                    bgcolor: 'rgba(124, 77, 255, 0.04)',
                    borderColor: '#7C4DFF'
                  }
                }}
              >
                Add Files
                <input
                  type="file"
                  hidden
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.zip,.txt,.doc,.docx,.xls,.xlsx,.ttf,.otf,.woff,.woff2"
                  onChange={handleFileSelect}
                />
              </Button>
            </Box>
          </>
        )}

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

        {/* Contest Step 1 Actions */}
        {jobType === 'contest' && contestStep === 1 && mode === 'create' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', width: '100%' }}>
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
              onClick={handleContestNextStep}
              variant="contained"
              sx={{
                backgroundColor: '#7C4DFF',
                color: '#fff',
                textTransform: 'none',
                fontSize: '16px',
                px: 4,
                fontWeight: 600,
                '&:hover': {
                  backgroundColor: '#6B3FEE'
                }
              }}
            >
              Next: Prize Settings →
            </Button>
          </div>
        )}

        {/* Contest Step 2 Actions */}
        {jobType === 'contest' && contestStep === 2 && mode === 'create' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', width: '100%' }}>
            <Button 
              onClick={handleContestPrevStep}
              disabled={loading}
              startIcon={<ArrowBackIcon />}
              sx={{ 
                color: '#6F7280',
                textTransform: 'none',
                fontSize: '16px'
              }}
            >
              Back
            </Button>
            <ProtectedAction
              onAuthorized={handleReviewAndLock}
              actionName="create a contest"
            >
              <Button
                disabled={loading}
                variant="contained"
                startIcon={<LockIcon />}
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
                    Processing...
                  </>
                ) : (
                  `🏆 Review & Lock ${calculateTotalWithFee().toFixed(2)} ${tokenSymbol}`
                )}
              </Button>
            </ProtectedAction>
          </div>
        )}

        {/* Regular Job Actions */}
        {(jobType === 'regular' || mode === 'edit') && (
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
            <ProtectedAction
              onAuthorized={mode === 'edit' ? handleConfirmAndLock : handleReviewAndLock}
              actionName="create a job"
            >
              <Button
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
                ) : (
                  'Review & Lock Tokens'
                )}
              </Button>
            </ProtectedAction>
          </div>
        )}
      </DialogActions>
    </Dialog>
  )
}
