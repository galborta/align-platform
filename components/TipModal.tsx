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
  Skeleton
} from '@mui/material'
import { PublicKey, Transaction } from '@solana/web3.js'
import { createTransferInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { useTipTokens } from '@/lib/hooks/useTipTokens'
import TokenDropdown from './tip/TokenDropdown'
import AmountInput from './tip/AmountInput'
import QuickTipButtons from './tip/QuickTipButtons'
import { TipToken } from '@/types/database'
import { checkAtaExists, createAtaInstruction } from '@/lib/solana/ata-utils'
import { validateTipTransaction } from '@/lib/solana/transaction-validation'

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
  
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState<string>('Sending...')
  const [error, setError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [selectedToken, setSelectedToken] = useState<TipToken | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [confirmationTimeout, setConfirmationTimeout] = useState(false)

  const CONFIRMATION_TIMEOUT = 60000 // 60 seconds

  // Fetch available tokens
  const { data: tokenData, isLoading: loadingTokens, error: tokenError, refetch: refetchTokens } = useTipTokens(
    publicKey?.toBase58(),
    projectId
  )

  // Auto-select first token when loaded (project token prioritized)
  useEffect(() => {
    if (tokenData?.tokens && tokenData.tokens.length > 0 && !selectedToken) {
      setSelectedToken(tokenData.tokens[0])
    }
  }, [tokenData, selectedToken])

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
    if (!loading) {
      setAmount('')
      setMessage('')
      setError(null)
      setAmountError(null)
      setSelectedToken(null)
      setRetryCount(0)
      setTxSignature(null)
      setLoadingMessage('Sending...')
      setConfirmationTimeout(false)
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
    setLoadingMessage('Checking status...')

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
    }
  }

  async function handleSendTip() {
    if (!publicKey) {
      toast.error('Please connect your wallet')
      return
    }

    // Check for self-tipping
    if (recipientWallet === publicKey.toString()) {
      toast.error('You cannot tip yourself')
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
    if (retryCount >= 3) {
      toast.error('Maximum retry attempts reached. Please try again later.')
      return
    }

    setLoading(true)
    setError(null)
    setAmountError(null)
    setLoadingMessage('Validating...')

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
        setRetryCount(prev => prev + 1)
        return
      }

      setLoadingMessage('Creating transaction...')
      // Create SPL token transfer transaction
      const tokenMintPubkey = new PublicKey(selectedToken.mint)
      const recipientPubkey = new PublicKey(recipientWallet)

      // Check if recipient has an Associated Token Account for this token
      const recipientAtaExists = await checkAtaExists(
        connection,
        recipientPubkey,
        tokenMintPubkey
      )

      // Initialize transaction
      const transaction = new Transaction()

      // If recipient doesn't have ATA, create it (sender pays rent)
      let ataCreated = false
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

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      setLoadingMessage('Awaiting signature...')

      // Send transaction
      const signature = await sendTransaction(transaction, connection)
      setTxSignature(signature)

      setLoadingMessage('Confirming...')
      
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

      // Calculate USD value
      const usdValue = selectedToken.usdPrice 
        ? parseFloat(amount) * selectedToken.usdPrice 
        : null

      // Record tip in database
      const { error: dbError } = await supabase.from('chat_tips').insert({
        project_id: projectId,
        from_wallet: publicKey.toString(),
        to_wallet: recipientWallet,
        amount_tokens: parseFloat(amount),
        token_mint: selectedToken.mint,
        token_symbol: selectedToken.symbol,
        amount_usd: usdValue,
        message: message.trim() || null,
        tx_signature: signature,
        is_public: true, // Default to public
        karma_awarded_sender: 0, // TODO: Implement karma calculation
        karma_awarded_recipient: 0 // TODO: Implement karma calculation
      })

      if (dbError) {
        console.error('Database error:', dbError)
        // Don't fail if DB insert fails - transaction already succeeded
        const ataText = ataCreated ? ' (+ token account created)' : ''
        toast.success(
          `🎁 Sent ${amount} ${selectedToken.symbol}${ataText}! View on Solscan`,
          {
            duration: 8000,
            onClick: () => window.open(`https://solscan.io/tx/${signature}?cluster=devnet`, '_blank')
          }
        )
      } else {
        const usdText = usdValue ? ` ($${usdValue.toFixed(2)})` : ''
        const ataText = ataCreated ? ' + token account created' : ''
        toast.success(
          `🎁 Sent ${amount} ${selectedToken.symbol}${usdText} to ${recipientWallet.slice(0, 4)}...${recipientWallet.slice(-4)}!${ataText}`,
          {
            duration: 8000,
            icon: '💰',
            onClick: () => window.open(`https://solscan.io/tx/${signature}?cluster=devnet`, '_blank')
          }
        )
      }

      // Reset retry count on success
      setRetryCount(0)
      handleClose()
    } catch (error: any) {
      console.error('Tip error:', error)
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to send tip. Please try again.'
      
      if (error.message?.includes('User rejected') || error.message?.includes('User denied')) {
        errorMessage = 'Transaction cancelled'
        toast.error(errorMessage)
      } else if (error.message?.includes('insufficient funds') || error.message?.includes('0x1')) {
        errorMessage = 'Insufficient SOL for transaction fee (~0.001 SOL needed)'
        toast.error(errorMessage)
      } else if (error.message?.includes('0x0')) {
        errorMessage = 'Insufficient token balance'
        toast.error(errorMessage)
      } else if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
        errorMessage = 'Transaction timed out. It may still succeed - check your wallet.'
        toast.error(errorMessage, { duration: 6000 })
      } else if (error.message?.includes('blockhash not found')) {
        errorMessage = 'Network error. Please try again.'
        toast.error(errorMessage)
      } else {
        toast.error(errorMessage)
      }
      
      setError(errorMessage)
      setRetryCount(prev => prev + 1)
    } finally {
      setLoading(false)
      setLoadingMessage('Sending...')
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
      PaperProps={{
        sx: {
          borderRadius: '12px',
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
          pb: 1
        }}
      >
        💰 Send Tip
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
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
              href={`https://solscan.io/tx/${txSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'underline', color: 'inherit' }}
            >
              View on Solscan
            </a>
          </Alert>
        )}

        {/* Token Dropdown */}
        {loadingTokens ? (
          <Box sx={{ mb: 2 }}>
            <Skeleton variant="rectangular" height={56} sx={{ borderRadius: '4px' }} />
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
          disabled={loading}
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

        {/* Message Input */}
        <TextField
          fullWidth
          label="Message (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 200))}
          multiline
          rows={3}
          sx={{ mb: 1 }}
          placeholder="Great contribution! 🎉"
          disabled={loading}
          helperText={`${message.length}/200 characters`}
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
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined" 
            onClick={handleClose} 
            fullWidth
            disabled={loading}
            sx={{
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
              !selectedToken || 
              !amount || 
              !!amountError ||
              retryCount >= 3
            }
            sx={{ 
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
            ) : retryCount > 0 && retryCount < 3 ? (
              `Retry (${retryCount}/3)`
            ) : retryCount >= 3 ? (
              'Max Retries Reached'
            ) : (
              'Send Tip'
            )}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  )
}


