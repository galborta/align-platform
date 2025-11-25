'use client'

import { useState } from 'react'
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
  Alert
} from '@mui/material'
import { PublicKey, Transaction } from '@solana/web3.js'
import { createTransferInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface TipModalProps {
  open: boolean
  onClose: () => void
  recipientWallet: string
  projectId: string
  tokenMint: string
}

export default function TipModal({ 
  open, 
  onClose, 
  recipientWallet, 
  projectId,
  tokenMint 
}: TipModalProps) {
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    if (!loading) {
      setAmount('')
      setMessage('')
      setError(null)
      onClose()
    }
  }

  async function handleSendTip() {
    if (!publicKey) {
      toast.error('Please connect your wallet')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount greater than 0')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Create SPL token transfer transaction
      const tokenMintPubkey = new PublicKey(tokenMint)
      const recipientPubkey = new PublicKey(recipientWallet)

      // Get associated token accounts
      const fromTokenAccount = await getAssociatedTokenAddress(
        tokenMintPubkey,
        publicKey
      )

      const toTokenAccount = await getAssociatedTokenAddress(
        tokenMintPubkey,
        recipientPubkey
      )

      // Get token decimals (assume 9 for most SPL tokens, including NUB)
      const decimals = 9
      const transferAmount = Math.floor(parseFloat(amount) * Math.pow(10, decimals))

      if (transferAmount <= 0) {
        throw new Error('Amount too small')
      }

      // Create transfer instruction
      const transaction = new Transaction().add(
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
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      // Send transaction
      const signature = await sendTransaction(transaction, connection)
      
      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed')
      
      if (confirmation.value.err) {
        throw new Error('Transaction failed')
      }

      // Record tip in database
      const { error: dbError } = await supabase.from('chat_tips').insert({
        project_id: projectId,
        from_wallet: publicKey.toString(),
        to_wallet: recipientWallet,
        amount_nub: parseFloat(amount),
        token_mint: tokenMint,
        message: message.trim() || null,
        tx_signature: signature
      })

      if (dbError) {
        console.error('Database error:', dbError)
        // Don't fail if DB insert fails - transaction already succeeded
        toast.success(`🎁 Sent ${amount} tokens! (${signature.slice(0, 8)}...)`, {
          duration: 5000
        })
      } else {
        toast.success(`🎁 Sent ${amount} tokens to ${recipientWallet.slice(0, 4)}...${recipientWallet.slice(-4)}!`, {
          duration: 5000,
          icon: '💰'
        })
      }

      handleClose()
    } catch (error: any) {
      console.error('Tip error:', error)
      
      // Provide user-friendly error messages
      if (error.message?.includes('insufficient funds') || error.message?.includes('0x1')) {
        setError('Insufficient token balance')
      } else if (error.message?.includes('User rejected')) {
        setError('Transaction cancelled')
      } else if (error.message?.includes('Account does not exist')) {
        setError('Recipient does not have a token account for this token')
      } else {
        setError(error.message || 'Failed to send tip. Please try again.')
      }
    } finally {
      setLoading(false)
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

        {/* Amount Input */}
        <TextField
          fullWidth
          type="number"
          label="Amount (NUB)"
          value={amount}
          onChange={(e) => {
            const value = e.target.value
            // Only allow positive numbers with up to 9 decimals
            if (value === '' || /^\d*\.?\d{0,9}$/.test(value)) {
              setAmount(value)
            }
          }}
          sx={{ mb: 2 }}
          placeholder="10"
          disabled={loading}
          inputProps={{
            min: 0,
            step: 0.1
          }}
          helperText="Tip amount in project tokens"
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
            disabled={loading || !amount || parseFloat(amount) <= 0}
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
                Sending...
              </>
            ) : (
              'Send Tip'
            )}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  )
}

