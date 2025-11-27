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
  Divider
} from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import LockIcon from '@mui/icons-material/Lock'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
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
  const { publicKey, signTransaction } = useWallet()
  
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
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [kpis, setKpis] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [assignmentMode, setAssignmentMode] = useState<'first_come' | 'review'>('review')
  const [desiredCompletionDays, setDesiredCompletionDays] = useState<string>('')
  
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
    setTitle('')
    setCategory('')
    setDescription('')
    setKpis('')
    setPaymentAmount('')
    setAssignmentMode('review')
    setDesiredCompletionDays('')
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

  const handleReviewAndLock = async () => {
    if (!validateForm()) {
      toast.error('Please fix the errors before continuing')
      return
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
      const amount = parseFloat(paymentAmount)
      const totalEscrowAmount = calculateEscrowAmount(amount, feePercentage)

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
        // Update existing job
        const { error: updateError } = await supabase
          .from('jobs')
          .update({
            title: title.trim(),
            description: description.trim(),
            kpis: kpis.trim(),
            category,
            assignment_mode: assignmentMode,
            poster_desired_completion: getDesiredCompletionDate(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingJob.id)

        if (updateError) throw updateError

        // Invalidate all existing applications if any
        if (applicationCount > 0) {
          const { error: invalidateError } = await supabase
            .from('job_applications')
            .update({
              is_invalidated: true,
              updated_at: new Date().toISOString()
            })
            .eq('job_id', existingJob.id)
            .eq('is_invalidated', false)

          if (invalidateError) throw invalidateError

          toast.success(`Job updated. ${applicationCount} application${applicationCount > 1 ? 's' : ''} invalidated.`, {
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
        const amount = parseFloat(paymentAmount)
        
        // Final USD validation
        const validation = await validateMinimumUsdValue(tokenMint, amount, 5)
        
        if (!validation.valid) {
          setLockError('Payment must be at least $5 USD')
          setIsLocking(false)
          return
        }

        if (!publicKey || !connection || !signTransaction) {
          setLockError('Wallet not connected')
          setIsLocking(false)
          return
        }

        // Calculate total escrow amount (payment + fee)
        const totalEscrowAmount = calculateEscrowAmount(amount, feePercentage)

        // Step 1: Transfer tokens to escrow
        toast.loading('Locking tokens in escrow...', { id: 'escrow-lock' })
        
        const transferResult = await transferToEscrow(
          {
            connection,
            senderWallet: publicKey,
            tokenMint: new PublicKey(tokenMint),
            amount: totalEscrowAmount,
            decimals: 9 // TODO: Get actual decimals from token metadata
          },
          signTransaction
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
        toast.loading('Creating job...', { id: 'escrow-lock' })
        
        const jobData = await createJob({
          project_id: projectId,
          poster_wallet: walletAddress,
          title: title.trim(),
          description: description.trim(),
          kpis: kpis.trim(),
          category,
          payment_amount_tokens: amount,
          payment_amount_usd: validation.usdValue || 0,
          assignment_mode: assignmentMode,
          poster_desired_completion: getDesiredCompletionDate(),
          fee_percentage_at_creation: feePercentage,
          escrow_locked: true,
          escrow_tx_signature: transferResult.signature,
          escrow_amount_tokens: totalEscrowAmount,
          escrow_token_mint: tokenMint
        })

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
        toast.success('Job posted! 🎉 Tokens locked in escrow', {
          duration: 4000,
          style: {
            background: '#36C170',
            color: '#fff',
          },
          icon: '🔒'
        })

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
          Review & Lock Tokens
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

          {/* Escrow Breakdown */}
          {escrowBreakdown && (
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
            <strong>Tokens will be locked until job completion.</strong>
            <br />
            Funds are held in escrow and released automatically to the worker 10 days after work submission, or when you manually approve.
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
              {isLocking ? 'Locking Tokens...' : 'Confirm & Lock Tokens'}
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
        {mode === 'edit' ? 'Edit Job' : 'Post a Job'}
      </DialogTitle>

      <DialogContent 
        sx={{ pt: 3 }}
        onScroll={handleScroll}
      >
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

        {/* Payment Amount */}
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
          disabled={mode === 'edit'}
          error={!!errors.paymentAmount}
          helperText={mode === 'edit' ? 'Payment amount cannot be changed after posting' : errors.paymentAmount}
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

        {/* Assignment Mode */}
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

        {/* Desired Completion (Optional) */}
        {mode === 'create' && (
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
              (mode === 'create' && (checkingPrice || belowMinimum || priceError)) ||
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
            ) : (
              mode === 'edit' ? 'Update Job' : 'Review & Lock Tokens'
            )}
          </Button>
        </div>
      </DialogActions>
    </Dialog>
  )
}


