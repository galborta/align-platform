'use client'

import { useState, useEffect } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  TextField, 
  Button, 
  Box, 
  Typography,
  CircularProgress,
  Alert,
  Skeleton,
  IconButton,
  useTheme,
  useMediaQuery,
  Backdrop
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { createTransferInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { useTipTokens } from '@/lib/hooks/useTipTokens'
import { useDailyTipKarma } from '@/lib/hooks/useDailyTipKarma'
import TokenDropdown from './tip/TokenDropdown'
import PublicPrivateToggle from './tip/PublicPrivateToggle'
import KarmaPreview from './tip/KarmaPreview'
import AmountInput from './tip/AmountInput'
import QuickTipButtons from './tip/QuickTipButtons'
import { TipToken } from '@/types/database'
import { checkAtaExists, createAtaInstruction } from '@/lib/solana/ata-utils'
import { validateTipTransaction } from '@/lib/solana/transaction-validation'
import { getTier } from '@/lib/karma'
import { getCachedTokenData } from '@/lib/token-balance'
import { 
  TIP_ERROR_MESSAGES, 
  TIP_WARNING_MESSAGES, 
  TIP_LOADING_MESSAGES,
  TIP_RETRY_CONFIG 
} from '@/lib/tip-errors'

interface TipModalProps {
  open: boolean
  onClose: () => void
  recipientWallet: string
  projectId: string
  tokenMint: string  // Kept for backwards compatibility but not used
}

export default function TipModal({ 
  open, 
  onClose, 
  recipientWallet, 
  projectId
}: TipModalProps) {
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState<string>('Sending...')
  const [error, setError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [selectedToken, setSelectedToken] = useState<TipToken | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [confirmationTimeout, setConfirmationTimeout] = useState(false)
  const [estimatedKarma, setEstimatedKarma] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false) // Prevent concurrent tips
  const [showZeroBalanceWarning, setShowZeroBalanceWarning] = useState(false)
  const [priceUnavailableWarning, setPriceUnavailableWarning] = useState(false)

  const CONFIRMATION_TIMEOUT = TIP_RETRY_CONFIG.CONFIRMATION_TIMEOUT

  // Fetch available tokens
  const { data: tokenData, isLoading: loadingTokens, error: tokenError, refetch: refetchTokens } = useTipTokens(
    publicKey?.toBase58(),
    projectId
  )

  // Fetch daily karma status
  const { data: karmaData, isLoading: karmaLoading } = useDailyTipKarma(
    publicKey?.toBase58(),
    projectId
  )

  // Watch for wallet disconnection
  useEffect(() => {
    if (!publicKey && open) {
      // Wallet disconnected while modal was open
      setLoading(false)
      setIsProcessing(false)
      setAmount('')
      setMessage('')
      setError(TIP_ERROR_MESSAGES.WALLET_DISCONNECTED)
      toast.error(TIP_ERROR_MESSAGES.WALLET_DISCONNECTED)
    }
  }, [publicKey, open])

  // Auto-select first token when loaded (project token prioritized)
  useEffect(() => {
    if (tokenData?.tokens && tokenData.tokens.length > 0 && !selectedToken) {
      setSelectedToken(tokenData.tokens[0])
    }
  }, [tokenData, selectedToken])

  // Check for price unavailability
  useEffect(() => {
    if (selectedToken && !selectedToken.usdPrice) {
      setPriceUnavailableWarning(true)
    } else {
      setPriceUnavailableWarning(false)
    }
  }, [selectedToken])

  // Check for zero balance warning
  useEffect(() => {
    if (!amount || !selectedToken) {
      setShowZeroBalanceWarning(false)
      return
    }

    const amountNum = parseFloat(amount)
    const balance = selectedToken.balance

    // Show warning if sending entire balance or very close to it (within 0.1%)
    if (balance > 0 && amountNum >= balance * 0.999) {
      setShowZeroBalanceWarning(true)
    } else {
      setShowZeroBalanceWarning(false)
    }
  }, [amount, selectedToken])

  // Calculate karma preview
  useEffect(() => {
    const calculateKarmaPreview = async () => {
      if (!amount || !selectedToken?.usdPrice || !publicKey) {
        setEstimatedKarma(0)
        return
      }

      try {
        // Get sender's tier multiplier
        const senderTokenData = await getCachedTokenData(
          publicKey.toString(),
          selectedToken.mint
        )
        const senderPercentage = senderTokenData?.percentage || 0
        const tier = getTier(senderPercentage)

        // Calculate karma: USD value × tier multiplier
        const usdValue = parseFloat(amount) * selectedToken.usdPrice
        const calculatedKarma = usdValue * tier.multiplier

        setEstimatedKarma(calculatedKarma)
      } catch (error) {
        console.error('Error calculating karma preview:', error)
        setEstimatedKarma(0)
      }
    }

    calculateKarmaPreview()
  }, [amount, selectedToken, publicKey])

  // Validation function
  function validateAmount(): string | null {
    if (!amount || amount === '0' || parseFloat(amount) <= 0) {
      return 'Please enter an amount greater than 0'
    }

    if (!selectedToken) {
      return 'Please select a token'
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum)) {
      return 'Invalid amount'
    }

    if (amountNum > selectedToken.balance) {
      return `Insufficient balance. You have ${selectedToken.balance.toFixed(4)} ${selectedToken.symbol}`
    }

    return null
  }

  // Validate amount on change
  useEffect(() => {
    if (amount) {
      const error = validateAmount()
      setAmountError(error)
    } else {
      setAmountError(null)
    }
  }, [amount, selectedToken])

  // Calculate USD value
  const calculateUsdValue = () => {
    if (!selectedToken?.usdPrice || !amount) return 0
    return parseFloat(amount) * selectedToken.usdPrice
  }

  // Handle quick tip (preset USD amounts)
  const handleQuickTip = (usdAmount: number) => {
    if (!selectedToken?.usdPrice) return

    const tokenAmount = usdAmount / selectedToken.usdPrice
    // Round to token decimals
    const rounded = Math.floor(tokenAmount * Math.pow(10, selectedToken.decimals)) / Math.pow(10, selectedToken.decimals)
    setAmount(rounded.toString())
  }

  // Handle max amount
  const handleMaxAmount = () => {
    if (selectedToken) {
      setAmount(selectedToken.balance.toString())
    }
  }

  const handleClose = () => {
    if (!loading && !isProcessing) {
      setAmount('')
      setMessage('')
      setIsPublic(true)
      setError(null)
      setAmountError(null)
      setSelectedToken(null)
      setRetryCount(0)
      setTxSignature(null)
      setLoadingMessage(TIP_LOADING_MESSAGES.VALIDATING)
      setConfirmationTimeout(false)
      setEstimatedKarma(0)
      setShowZeroBalanceWarning(false)
      setPriceUnavailableWarning(false)
      onClose()
    }
  }

  // Wait for transaction confirmation with timeout and progress
  async function waitForConfirmation(
    signature: string, 
    blockhash: string, 
    lastValidBlockHeight: number
  ) {
    const startTime = Date.now()
    let toastId: string | undefined
    
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      toastId = toast.loading(`Confirming transaction... (${elapsed}s)`, { id: 'confirm-toast' })
    }, 1000)

    try {
      const confirmation = await Promise.race([
        connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed'),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Confirmation timeout')), CONFIRMATION_TIMEOUT)
        )
      ])

      clearInterval(interval)
      toast.dismiss('confirm-toast')
      return confirmation
    } catch (error) {
      clearInterval(interval)
      toast.dismiss('confirm-toast')
      throw error
    }
  }

  // Check transaction status manually
  async function checkTransactionStatus() {
    if (!txSignature) return

    setLoading(true)
    setIsProcessing(true)
    setLoadingMessage(TIP_LOADING_MESSAGES.CHECKING_STATUS)

    try {
      const status = await connection.getSignatureStatus(txSignature)
      
      if (status.value?.confirmationStatus === 'confirmed' || 
          status.value?.confirmationStatus === 'finalized') {
        toast.success('Transaction confirmed!', { icon: '✅' })
        setConfirmationTimeout(false)
        handleClose()
      } else if (status.value?.err) {
        toast.error('Transaction failed')
        setError('Transaction failed on-chain')
      } else {
        toast('Transaction is still pending...', { icon: '⏳' })
      }
    } catch (error) {
      toast.error('Could not check transaction status')
    } finally {
      setLoading(false)
      setIsProcessing(false)
    }
  }

  // Record tip in database with karma calculation
  async function recordTipInDatabase(signature: string) {
    try {
      if (!publicKey || !selectedToken) return null

      setLoadingMessage(TIP_LOADING_MESSAGES.RECORDING_TIP)

      // Get tier multipliers
      let senderTierMultiplier = 1 // Default to 1x if calculation fails
      let recipientTierMultiplier = 1

      try {
        const senderData = await getCachedTokenData(
          publicKey.toString(),
          selectedToken.mint
        )
        const recipientData = await getCachedTokenData(
          recipientWallet,
          selectedToken.mint
        )

        const senderTier = getTier(senderData?.percentage || 0)
        const recipientTier = getTier(recipientData?.percentage || 0)

        senderTierMultiplier = senderTier.multiplier
        recipientTierMultiplier = recipientTier.multiplier
      } catch (tierError) {
        console.error('Error calculating tier multipliers:', tierError)
        // Continue with default 1x multipliers
      }

      // Calculate USD value
      const usdValue = selectedToken.usdPrice 
        ? parseFloat(amount) * selectedToken.usdPrice 
        : null

      // Record tip via API with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

      try {
        const response = await fetch('/api/tips/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            fromWallet: publicKey.toString(),
            toWallet: recipientWallet,
            tokenMint: selectedToken.mint,
            tokenSymbol: selectedToken.symbol,
            amountTokens: parseFloat(amount),
            amountUsd: usdValue,
            message: message.trim() || null,
            isPublic,
            txSignature: signature,
            senderTierMultiplier,
            recipientTierMultiplier
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error('Failed to record tip')
        }

        const data = await response.json()
        return data // Returns { success, tipId, karmaSender, karmaRecipient }

      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          console.error('Tip recording timed out')
          toast.error(TIP_ERROR_MESSAGES.RECORDING_TIMEOUT, { duration: 6000 })
        }
        throw fetchError
      }

    } catch (error) {
      console.error('Error recording tip:', error)
      // Don't fail - transaction already succeeded on-chain
      toast.error(TIP_ERROR_MESSAGES.RECORDING_FAILED, { duration: 6000 })
      return null
    }
  }

  async function handleSendTip() {
    // Prevent concurrent tip attempts
    if (isProcessing) {
      toast.error(TIP_ERROR_MESSAGES.CONCURRENT_TIP_WARNING)
      return
    }

    if (!publicKey) {
      toast.error(TIP_ERROR_MESSAGES.WALLET_NOT_CONNECTED)
      return
    }

    // Check for self-tipping
    if (recipientWallet === publicKey.toString()) {
      toast.error(TIP_ERROR_MESSAGES.RECIPIENT_SAME_AS_SENDER)
      return
    }

    // Run comprehensive validation
    const validationError = validateAmount()
    if (validationError) {
      setAmountError(validationError)
      return
    }

    if (!selectedToken) {
      setError('Please select a token')
      return
    }

    // Check retry limit
    if (retryCount >= TIP_RETRY_CONFIG.MAX_RETRIES) {
      toast.error(TIP_ERROR_MESSAGES.MAX_RETRIES_REACHED)
      return
    }

    setLoading(true)
    setIsProcessing(true) // Prevent concurrent tips
    setError(null)
    setAmountError(null)
    setLoadingMessage(TIP_LOADING_MESSAGES.VALIDATING)

    try {
      // Pre-flight validation
      const validation = await validateTipTransaction(
        connection,
        publicKey,
        recipientWallet,
        selectedToken.mint,
        parseFloat(amount),
        selectedToken.decimals
      )

      if (!validation.valid) {
        setError(validation.error || 'Validation failed')
        toast.error(validation.error || 'Validation failed')
        setLoading(false)
        setIsProcessing(false)
        setRetryCount(prev => prev + 1)
        return
      }

      setLoadingMessage(TIP_LOADING_MESSAGES.CREATING_TRANSACTION)
      
      const recipientPubkey = new PublicKey(recipientWallet)
      const transaction = new Transaction()
      let ataCreated = false

      // Check if this is native SOL or SPL token
      const isNativeSOL = selectedToken.mint === 'So11111111111111111111111111111111111111112'

      if (isNativeSOL) {
        // Native SOL transfer (simple)
        const lamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL)

        if (lamports <= 0) {
          throw new Error('Amount too small')
        }

        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPubkey,
            lamports
          })
        )
      } else {
        // SPL Token transfer (requires ATA)
        const tokenMintPubkey = new PublicKey(selectedToken.mint)

        // Check if recipient has an Associated Token Account for this token
        const recipientAtaExists = await checkAtaExists(
          connection,
          recipientPubkey,
          tokenMintPubkey
        )

        // If recipient doesn't have ATA, create it (sender pays rent)
        if (!recipientAtaExists) {
          toast('Creating token account for recipient (~$0.50 one-time cost)...', { 
            icon: '⚙️',
            duration: 3000 
          })
          
          const ataInstruction = createAtaInstruction(
            publicKey,      // Sender pays the rent
            recipientPubkey,
            tokenMintPubkey
          )
          transaction.add(ataInstruction)
          ataCreated = true
        }

        // Get associated token accounts
        const fromTokenAccount = await getAssociatedTokenAddress(
          tokenMintPubkey,
          publicKey
        )

        const toTokenAccount = await getAssociatedTokenAddress(
          tokenMintPubkey,
          recipientPubkey
        )

        // Use token's actual decimals
        const decimals = selectedToken.decimals
        const transferAmount = Math.floor(parseFloat(amount) * Math.pow(10, decimals))

        if (transferAmount <= 0) {
          throw new Error('Amount too small')
        }

        // Add transfer instruction
        transaction.add(
          createTransferInstruction(
            fromTokenAccount,
            toTokenAccount,
            publicKey,
            transferAmount,
            [],
            TOKEN_PROGRAM_ID
          )
        )
      }

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      setLoadingMessage(TIP_LOADING_MESSAGES.AWAITING_SIGNATURE)

      // Send transaction
      const signature = await sendTransaction(transaction, connection)
      setTxSignature(signature)

      setLoadingMessage(TIP_LOADING_MESSAGES.CONFIRMING)
      
      // Wait for confirmation with timeout
      try {
        const confirmation = await waitForConfirmation(signature, blockhash, lastValidBlockHeight)
        
        if (confirmation.value.err) {
          throw new Error('Transaction failed')
        }
      } catch (confirmError: any) {
        // If confirmation times out, store signature but warn user
        if (confirmError.message?.includes('timeout')) {
          setConfirmationTimeout(true)
          toast.error(
            'Transaction confirmation timed out. Transaction may still succeed. Check status below.',
            { duration: 8000 }
          )
          setLoading(false)
          return // Exit early, keep modal open
        }
        throw confirmError // Re-throw other errors
      }

      // Record tip in database with karma calculation
      const tipData = await recordTipInDatabase(signature)

      // Calculate USD value for display
      const usdValue = selectedToken.usdPrice 
        ? parseFloat(amount) * selectedToken.usdPrice 
        : null

      // Check if daily cap was reached
      const capReached = karmaData && tipData?.karmaSender 
        ? (karmaData.tipKarmaEarnedToday + tipData.karmaSender) >= karmaData.dailyKarmaCap
        : false

      // Show enhanced success toast with karma
      const usdText = usdValue ? ` ($${usdValue.toFixed(2)})` : ''
      const ataText = ataCreated ? ' + token account created' : ''
      
      if (tipData?.success && tipData.karmaSender > 0) {
        // Custom styled toast with prominent karma display
        toast.custom(
          (t) => (
            <Box
              onClick={() => window.open(`https://solscan.io/tx/${signature}`, '_blank')}
              sx={{
                bgcolor: '#FFFFFF',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(124, 77, 255, 0.2)',
                p: 2.5,
                minWidth: '320px',
                border: '2px solid #7C4DFF',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 12px 32px rgba(124, 77, 255, 0.3)',
                  transform: 'translateY(-2px)'
                }
              }}
            >
              {/* Header with emoji and title */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Typography sx={{ fontSize: '32px', lineHeight: 1 }}>🎁</Typography>
                <Box>
                  <Typography
                    sx={{
                      fontFamily: 'Space Grotesk, sans-serif',
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#1A1A1E'
                    }}
                  >
                    Tip Sent!
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#6F7280',
                      fontSize: '12px'
                    }}
                  >
                    {amount} {selectedToken.symbol}{usdText}
                  </Typography>
                </Box>
              </Box>

              {/* Karma earned - PROMINENT */}
              <Box
                sx={{
                  bgcolor: '#F8F5FF',
                  borderRadius: '8px',
                  p: 1.5,
                  mb: 1.5,
                  border: '1px solid #E5DEFF'
                }}
              >
                <Typography
                  sx={{
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: '24px',
                    fontWeight: 700,
                    color: '#7C4DFF',
                    textAlign: 'center'
                  }}
                >
                  +{tipData.karmaSender.toFixed(1)} karma
                </Typography>
              </Box>

              {/* Daily cap warning */}
              {capReached && (
                <Box
                  sx={{
                    bgcolor: '#FFF4ED',
                    borderRadius: '6px',
                    p: 1,
                    mb: 1.5,
                    border: '1px solid #FDBA74'
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#EA580C',
                      fontSize: '11px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5
                    }}
                  >
                    ⚠️ Daily cap reached! Resets at midnight UTC
                  </Typography>
                </Box>
              )}

              {/* Transaction link */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: '#7C4DFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'underline'
                  }}
                >
                  View on Solscan
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#7C4DFF' }}>→</Typography>
              </Box>

              {/* ATA creation note */}
              {ataCreated && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    textAlign: 'center',
                    color: '#6F7280',
                    fontSize: '10px',
                    mt: 1
                  }}
                >
                  + Token account created
                </Typography>
              )}
            </Box>
          ),
          { duration: 8000 }
        )
      } else {
        // Fallback without karma (still enhanced)
        toast.custom(
          (t) => (
            <Box
              onClick={() => window.open(`https://solscan.io/tx/${signature}`, '_blank')}
              sx={{
                bgcolor: '#FFFFFF',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(124, 77, 255, 0.2)',
                p: 2.5,
                minWidth: '320px',
                border: '2px solid #7C4DFF',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 12px 32px rgba(124, 77, 255, 0.3)',
                  transform: 'translateY(-2px)'
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Typography sx={{ fontSize: '32px', lineHeight: 1 }}>🎁</Typography>
                <Box>
                  <Typography
                    sx={{
                      fontFamily: 'Space Grotesk, sans-serif',
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#1A1A1E'
                    }}
                  >
                    Tip Sent!
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#6F7280',
                      fontSize: '12px'
                    }}
                  >
                    {amount} {selectedToken.symbol}{usdText}{ataText}
                  </Typography>
                </Box>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: '#7C4DFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'underline'
                  }}
                >
                  View on Solscan
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#7C4DFF' }}>→</Typography>
              </Box>
            </Box>
          ),
          { duration: 8000 }
        )
      }

      // Reset retry count on success
      setRetryCount(0)
      handleClose()
    } catch (error: any) {
      console.error('Tip error:', error)
      
      // Provide user-friendly error messages using constants
      let errorMessage = TIP_ERROR_MESSAGES.PLEASE_TRY_AGAIN
      
      if (error.message?.includes('User rejected') || error.message?.includes('User denied')) {
        errorMessage = TIP_ERROR_MESSAGES.WALLET_SIGNATURE_REJECTED
        toast.error(errorMessage)
      } else if (error.message?.includes('insufficient funds') || error.message?.includes('0x1')) {
        errorMessage = TIP_ERROR_MESSAGES.INSUFFICIENT_SOL
        toast.error(errorMessage)
      } else if (error.message?.includes('0x0')) {
        errorMessage = TIP_ERROR_MESSAGES.INSUFFICIENT_BALANCE
        toast.error(errorMessage)
      } else if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
        errorMessage = TIP_ERROR_MESSAGES.TRANSACTION_TIMEOUT
        toast.error(errorMessage, { duration: 6000 })
      } else if (error.message?.includes('blockhash not found')) {
        errorMessage = TIP_ERROR_MESSAGES.BLOCKHASH_NOT_FOUND
        toast.error(errorMessage)
      } else if (error.message?.includes('network') || error.message?.includes('fetch failed')) {
        errorMessage = TIP_ERROR_MESSAGES.NETWORK_ERROR
        toast.error(errorMessage)
      } else {
        errorMessage = TIP_ERROR_MESSAGES.UNKNOWN_ERROR
        toast.error(errorMessage)
      }
      
      setError(errorMessage)
      
      // Exponential backoff retry
      const newRetryCount = retryCount + 1
      setRetryCount(newRetryCount)
      
      if (newRetryCount < TIP_RETRY_CONFIG.MAX_RETRIES) {
        const delay = TIP_RETRY_CONFIG.INITIAL_DELAY * Math.pow(TIP_RETRY_CONFIG.BACKOFF_MULTIPLIER, newRetryCount - 1)
        toast(`${TIP_ERROR_MESSAGES.RETRYING} (${newRetryCount}/${TIP_RETRY_CONFIG.MAX_RETRIES}) in ${delay / 1000}s...`, {
          icon: '🔄',
          duration: delay
        })
      }
    } finally {
      setLoading(false)
      setIsProcessing(false)
      setLoadingMessage(TIP_LOADING_MESSAGES.VALIDATING)
    }
  }

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '24px',
          fontWeight: 700,
          color: '#1A1A1E',
          pb: 1,
          pr: isMobile ? 7 : 3,
          position: 'relative'
        }}
      >
        💰 Send Tip
        
        {/* Mobile close button */}
        {isMobile && (
          <IconButton
            onClick={handleClose}
            disabled={loading}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              width: 48,
              height: 48,
              color: '#6F7280',
              '&:hover': {
                bgcolor: '#F3F4F6'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent 
        sx={{ 
          pt: 2,
          px: isMobile ? 2 : 3,
          py: isMobile ? 3 : 2,
          pb: isMobile ? 4 : 2
        }}
      >
        {/* Recipient Info */}
        <Box 
          sx={{ 
            mb: 3, 
            p: 2, 
            bgcolor: '#F8F5FF', 
            borderRadius: '8px',
            border: '1px solid #E5DEFF'
          }}
        >
          <Typography 
            variant="caption" 
            sx={{ 
              color: '#6F7280',
              display: 'block',
              mb: 0.5,
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Recipient
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '14px',
              fontWeight: 600,
              color: '#7C4DFF'
            }}
          >
            {formatWalletAddress(recipientWallet)}
          </Typography>
        </Box>

        {/* Token Selection Error */}
        {tokenError && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => refetchTokens()}
              >
                Retry
              </Button>
            }
          >
            Failed to load tokens. Please try again.
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Confirmation Timeout Alert */}
        {confirmationTimeout && txSignature && (
          <Alert 
            severity="warning" 
            sx={{ mb: 2 }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={checkTransactionStatus}
                disabled={loading}
              >
                Check Status
              </Button>
            }
          >
            Transaction sent but confirmation timed out. <br />
            <a 
              href={`https://solscan.io/tx/${txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'underline', color: 'inherit' }}
            >
              View on Solscan
            </a>
          </Alert>
        )}

        {/* Price Unavailable Warning */}
        {priceUnavailableWarning && !loading && (
          <Alert 
            severity="info" 
            sx={{ mb: 2 }}
          >
            {TIP_WARNING_MESSAGES.PRICE_UNAVAILABLE}
          </Alert>
        )}

        {/* Zero Balance Warning */}
        {showZeroBalanceWarning && !loading && (
          <Alert 
            severity="warning" 
            sx={{ mb: 2 }}
          >
            {TIP_WARNING_MESSAGES.ENTIRE_BALANCE.replace('{symbol}', selectedToken?.symbol || '')}
          </Alert>
        )}

        {/* Token Dropdown */}
        {loadingTokens ? (
          <Box sx={{ mb: 2 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton 
                key={i} 
                variant="rectangular" 
                height={56} 
                sx={{ 
                  borderRadius: '4px',
                  mb: i < 3 ? 1 : 0
                }} 
              />
            ))}
          </Box>
        ) : tokenData?.tokens && tokenData.tokens.length === 0 ? (
          <Alert 
            severity="warning" 
            sx={{ mb: 2 }}
          >
            No tokens available to send (minimum $0.10 value required). Please add tokens to your wallet.
          </Alert>
        ) : (
          <TokenDropdown
            tokens={tokenData?.tokens || []}
            selectedToken={selectedToken}
            onSelect={setSelectedToken}
            loading={loadingTokens}
          />
        )}

        {/* Quick Tip Buttons */}
        <QuickTipButtons
          amounts={[1, 5, 10, 25, 50]}
          onSelect={handleQuickTip}
          disabled={loading || priceUnavailableWarning}
          selectedToken={selectedToken}
        />

        {/* Amount Input */}
        <AmountInput
          value={amount}
          onChange={setAmount}
          error={amountError}
          usdValue={calculateUsdValue()}
          selectedToken={selectedToken}
          onMax={handleMaxAmount}
          disabled={loading}
        />

        {/* Karma Preview */}
        {karmaLoading ? (
          <Box 
            sx={{ 
              mb: 2,
              p: 2,
              bgcolor: '#F0F9FF',
              borderRadius: '8px',
              border: '1px solid #BAE6FD'
            }}
          >
            {/* Title skeleton */}
            <Skeleton 
              variant="text" 
              width="60%" 
              height={24}
              sx={{ mb: 1 }}
            />
            {/* Karma number skeleton */}
            <Skeleton 
              variant="rectangular" 
              height={40} 
              sx={{ 
                borderRadius: '8px',
                mb: 2
              }} 
            />
            {/* Progress label skeleton */}
            <Skeleton 
              variant="text" 
              width="50%" 
              height={16}
              sx={{ mb: 0.5 }}
            />
            {/* Progress bar skeleton */}
            <Skeleton 
              variant="rectangular" 
              height={6} 
              sx={{ 
                borderRadius: 3
              }} 
            />
          </Box>
        ) : karmaData && selectedToken && parseFloat(amount || '0') > 0 && selectedToken.usdPrice ? (
          <KarmaPreview
            karmaAmount={estimatedKarma}
            dailyCap={karmaData.dailyKarmaCap}
            currentDailyTotal={karmaData.tipKarmaEarnedToday}
            usdValue={parseFloat(amount) * selectedToken.usdPrice}
          />
        ) : null}

        {/* Public/Private Toggle */}
        <PublicPrivateToggle
          isPublic={isPublic}
          onChange={setIsPublic}
          disabled={loading}
        />

        {/* Message Input */}
        <TextField
          fullWidth
          label="Message (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 200))}
          multiline
          rows={isMobile ? 2 : 3}
          sx={{ mb: 1 }}
          placeholder="Great contribution! 🎉"
          disabled={loading}
          helperText={`${message.length}/200 characters`}
          inputProps={{
            inputMode: 'text'
          }}
        />

        {/* Info Text */}
        <Typography 
          variant="caption" 
          sx={{ 
            display: 'block', 
            color: '#6F7280', 
            mb: 3,
            fontSize: '12px',
            lineHeight: 1.5
          }}
        >
          💡 Tips are sent directly on-chain via SPL token transfer. You'll need SOL for transaction fees (~0.000005 SOL).
        </Typography>

        {/* Action Buttons */}
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column-reverse' : 'row',
            gap: 2 
          }}
        >
          <Button 
            variant="outlined" 
            onClick={handleClose} 
            fullWidth
            disabled={loading}
            sx={{
              minHeight: 48,
              borderColor: '#E5E7F0',
              color: '#6F7280',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': {
                borderColor: '#7C4DFF',
                bgcolor: 'transparent'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSendTip}
            fullWidth
            disabled={
              loading || 
              loadingTokens || 
              isProcessing ||
              !selectedToken || 
              !amount || 
              !!amountError ||
              retryCount >= TIP_RETRY_CONFIG.MAX_RETRIES
            }
            sx={{ 
              minHeight: 48,
              bgcolor: '#7C4DFF',
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: 'none',
              '&:hover': {
                bgcolor: '#6B3FEE',
                boxShadow: '0 4px 12px rgba(124, 77, 255, 0.3)'
              },
              '&:disabled': {
                bgcolor: '#E5E7F0',
                color: '#A3A7B5'
              }
            }}
          >
            {loading ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1, color: '#fff' }} />
                {loadingMessage}
              </>
            ) : retryCount > 0 && retryCount < TIP_RETRY_CONFIG.MAX_RETRIES ? (
              `Retry (${retryCount}/${TIP_RETRY_CONFIG.MAX_RETRIES})`
            ) : retryCount >= TIP_RETRY_CONFIG.MAX_RETRIES ? (
              'Max Retries Reached'
            ) : (
              'Send Tip'
            )}
          </Button>
        </Box>
      </DialogContent>

      {/* Transaction Processing Backdrop */}
      <Backdrop 
        open={loading} 
        sx={{ 
          zIndex: (theme) => theme.zIndex.modal + 1,
          position: 'absolute',
          color: '#fff',
          backdropFilter: 'blur(4px)',
          bgcolor: 'rgba(0, 0, 0, 0.7)'
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress 
            size={60} 
            sx={{ 
              mb: 2,
              color: '#7C4DFF'
            }} 
          />
          <Typography 
            variant="h6"
            sx={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 600,
              color: '#fff',
              fontSize: '18px'
            }}
          >
            {loadingMessage}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 1,
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '12px'
            }}
          >
            Please don't close this window
          </Typography>
        </Box>
      </Backdrop>
    </Dialog>
  )
}


