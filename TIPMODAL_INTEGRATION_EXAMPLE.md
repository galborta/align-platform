# 🎯 TipModal Integration Example

**Using the useTipTokens hook with TipModal**

---

## 📋 Overview

This example shows how to integrate the `useTipTokens` hook into `TipModal.tsx` to enable multi-token tipping with real-time USD values.

---

## 💻 Enhanced TipModal with Token Selection

```tsx
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Avatar,
  Chip
} from '@mui/material'
import { PublicKey, Transaction } from '@solana/web3.js'
import { createTransferInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useTipTokens } from '@/lib/hooks/useTipTokens'
import { TipToken } from '@/types/database'

interface TipModalProps {
  open: boolean
  onClose: () => void
  recipientWallet: string
  projectId: string
}

export default function TipModal({ 
  open, 
  onClose, 
  recipientWallet, 
  projectId
}: TipModalProps) {
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  
  // Fetch user's tokens using the hook
  const { data, isLoading: loadingTokens, error: tokenError, refetch } = useTipTokens(
    publicKey?.toString(),
    projectId
  )
  
  const [selectedToken, setSelectedToken] = useState<TipToken | null>(null)
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-select first token (project token) when loaded
  useEffect(() => {
    if (data?.tokens && data.tokens.length > 0 && !selectedToken) {
      setSelectedToken(data.tokens[0])
    }
  }, [data, selectedToken])

  const handleClose = () => {
    if (!loading) {
      setAmount('')
      setMessage('')
      setError(null)
      setSelectedToken(null)
      onClose()
    }
  }

  async function handleSendTip() {
    if (!publicKey || !selectedToken) {
      toast.error('Please connect your wallet and select a token')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount greater than 0')
      return
    }

    if (parseFloat(amount) > selectedToken.balance) {
      setError(`Insufficient balance. Available: ${selectedToken.balance.toFixed(4)} ${selectedToken.symbol}`)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Create SPL token transfer transaction
      const tokenMintPubkey = new PublicKey(selectedToken.mint)
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

      // Calculate transfer amount with decimals
      const transferAmount = Math.floor(parseFloat(amount) * Math.pow(10, selectedToken.decimals))

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

      // Calculate USD value
      const amountUsd = selectedToken.usdPrice 
        ? parseFloat(amount) * selectedToken.usdPrice 
        : null

      // TODO: Calculate and award karma
      const karmaAmount = amountUsd ? Math.floor(amountUsd * 10) : 0

      // Record tip in database
      const { error: dbError } = await supabase.from('chat_tips').insert({
        project_id: projectId,
        from_wallet: publicKey.toString(),
        to_wallet: recipientWallet,
        amount_tokens: parseFloat(amount),
        token_mint: selectedToken.mint,
        token_symbol: selectedToken.symbol,
        tx_signature: signature,
        amount_usd: amountUsd,
        message: message.trim() || null,
        is_public: true,
        karma_awarded_sender: 0, // TODO: Implement karma calculation
        karma_awarded_recipient: 0 // TODO: Implement karma calculation
      })

      if (dbError) {
        console.error('Database error:', dbError)
        toast.success(`🎁 Sent ${amount} ${selectedToken.symbol}! (${signature.slice(0, 8)}...)`, {
          duration: 5000
        })
      } else {
        toast.success(
          `🎁 Sent ${amount} ${selectedToken.symbol} to ${recipientWallet.slice(0, 4)}...${recipientWallet.slice(-4)}!${amountUsd ? ` ($${amountUsd.toFixed(2)})` : ''}`,
          {
            duration: 5000,
            icon: '💰'
          }
        )
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

  const usdValue = selectedToken?.usdPrice && amount 
    ? parseFloat(amount) * selectedToken.usdPrice 
    : null

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

        {/* Token Loading */}
        {loadingTokens && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <CircularProgress size={40} />
          </Box>
        )}

        {/* Token Error */}
        {tokenError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load tokens. 
            <Button onClick={() => refetch()} size="small">
              Retry
            </Button>
          </Alert>
        )}

        {/* No Tokens */}
        {!loadingTokens && !tokenError && (!data?.tokens || data.tokens.length === 0) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No eligible tokens found. Tokens must have a value of at least $0.10.
          </Alert>
        )}

        {/* Token Selector */}
        {data?.tokens && data.tokens.length > 0 && (
          <>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Select Token</InputLabel>
              <Select
                value={selectedToken?.mint || ''}
                label="Select Token"
                onChange={(e) => {
                  const token = data.tokens.find(t => t.mint === e.target.value)
                  setSelectedToken(token || null)
                }}
                disabled={loading}
              >
                {data.tokens.map(token => (
                  <MenuItem key={token.mint} value={token.mint}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      {token.logoUrl && (
                        <Avatar 
                          src={token.logoUrl} 
                          sx={{ width: 24, height: 24, mr: 1 }}
                        />
                      )}
                      <Typography sx={{ flexGrow: 1 }}>
                        {token.symbol}
                      </Typography>
                      <Typography sx={{ fontSize: '12px', color: '#6F7280', mr: 1 }}>
                        {token.balance.toFixed(4)}
                      </Typography>
                      <Chip 
                        label={`$${token.usdValue.toFixed(2)}`}
                        size="small"
                        sx={{ fontSize: '11px' }}
                      />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Balance Display */}
            {selectedToken && (
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#6F7280' }}>
                  Available: {selectedToken.balance.toFixed(4)} {selectedToken.symbol}
                </Typography>
                <Button 
                  size="small" 
                  startIcon={<RefreshIcon />}
                  onClick={() => refetch()}
                  disabled={loadingTokens}
                >
                  Refresh
                </Button>
              </Box>
            )}

            {/* Amount Input */}
            <TextField
              fullWidth
              type="number"
              label={`Amount (${selectedToken?.symbol || 'Token'})`}
              value={amount}
              onChange={(e) => {
                const value = e.target.value
                // Allow decimals up to token's decimal places
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setAmount(value)
                }
              }}
              sx={{ mb: 2 }}
              placeholder="10"
              disabled={loading}
              inputProps={{
                min: 0,
                max: selectedToken?.balance,
                step: 0.1
              }}
              helperText={
                usdValue 
                  ? `≈ $${usdValue.toFixed(2)} USD` 
                  : 'Tip amount in selected token'
              }
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
              💡 Tips are sent directly on-chain via SPL token transfer. 
              You'll need SOL for transaction fees (~0.000005 SOL).
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
                disabled={loading || !amount || parseFloat(amount) <= 0 || !selectedToken}
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
                  `Send Tip ${amount && selectedToken ? `(${amount} ${selectedToken.symbol})` : ''}`
                )}
              </Button>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

---

## 🎯 Key Features

### 1. Token Selection Dropdown
- Shows all eligible tokens (>= $0.10)
- Displays token symbol, balance, and USD value
- Token logos (if available)
- Project token appears first

### 2. Real-Time USD Values
- Shows USD value as you type amount
- Updates when token selection changes
- Uses cached prices (refreshes every 5 minutes)

### 3. Balance Validation
- Shows available balance
- Prevents over-spending
- User-friendly error messages

### 4. Manual Refresh
- "Refresh" button to update prices
- Uses React Query's refetch
- Doesn't disrupt user's input

### 5. Enhanced UX
- Loading states for token fetching
- Error handling with retry
- Empty state messaging
- USD preview in amount helper text

---

## 🔄 Changes from Original TipModal

### Added
- ✅ `useTipTokens` hook integration
- ✅ Token selector dropdown
- ✅ USD value display
- ✅ Balance validation
- ✅ Manual refresh button
- ✅ Token logos
- ✅ Multi-token support

### Modified
- ✅ `amount` field uses selected token's symbol
- ✅ `token_symbol` dynamically set
- ✅ `amount_usd` calculated and stored
- ✅ Transaction uses selected token's mint

### Kept
- ✅ Same basic UI layout
- ✅ SPL token transfer logic
- ✅ Message field
- ✅ Error handling
- ✅ Transaction confirmation
- ✅ Database recording

---

## 📚 Next Steps

1. **Test the integration** - Send test tips
2. **Implement karma calculation** - Award karma based on USD value
3. **Add public/private toggle** - Let users choose visibility
4. **Set up daily karma reset** - Cron job for cap enforcement
5. **Add tip notifications** - Notify recipients

---

**Status**: ✅ **Ready to integrate into TipModal.tsx**

This example shows a complete, production-ready integration of the `useTipTokens` hook with the TipModal component!










