'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Typography,
  Box,
  Alert
} from '@mui/material'
import BlockIcon from '@mui/icons-material/Block'

interface BlockUserModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (deleteHistory: boolean, reason?: string) => Promise<void>
  userName: string
  walletAddress: string
}

export function BlockUserModal({
  open,
  onClose,
  onConfirm,
  userName,
  walletAddress
}: BlockUserModalProps) {
  const [deleteHistory, setDeleteHistory] = useState(true)
  const [reason, setReason] = useState('')
  const [blocking, setBlocking] = useState(false)

  const handleConfirm = async () => {
    setBlocking(true)
    try {
      await onConfirm(deleteHistory, reason.trim() || undefined)
      onClose()
    } catch (error) {
      console.error('Error blocking user:', error)
    } finally {
      setBlocking(false)
    }
  }

  const handleClose = () => {
    if (!blocking) {
      setReason('')
      setDeleteHistory(true)
      onClose()
    }
  }

  const truncateWallet = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BlockIcon sx={{ color: '#DC2626' }} />
          Block User
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Warning:</strong> Blocking this user will prevent both of you from sending messages to each other.
          </Typography>
        </Alert>

        {/* User Info */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            You are about to block:
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {userName}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {truncateWallet(walletAddress)}
          </Typography>
        </Box>

        {/* Delete History Checkbox */}
        <FormControlLabel
          control={
            <Checkbox
              checked={deleteHistory}
              onChange={(e) => setDeleteHistory(e.target.checked)}
              disabled={blocking}
              sx={{
                color: '#7C4DFF',
                '&.Mui-checked': {
                  color: '#7C4DFF',
                }
              }}
            />
          }
          label={
            <Box>
              <Typography variant="body2">
                Delete conversation history
              </Typography>
              <Typography variant="caption" color="text.secondary">
                All messages will be permanently removed
              </Typography>
            </Box>
          }
          sx={{ mb: 2, alignItems: 'flex-start' }}
        />

        {/* Reason Input */}
        <TextField
          fullWidth
          label="Reason (optional)"
          placeholder="Spam, harassment, inappropriate content..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={blocking}
          multiline
          rows={3}
          variant="outlined"
          helperText="For moderation and audit purposes"
          sx={{
            '& .MuiOutlinedInput-root': {
              '&.Mui-focused fieldset': {
                borderColor: '#7C4DFF',
              }
            },
            '& .MuiInputLabel-root.Mui-focused': {
              color: '#7C4DFF',
            }
          }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={handleClose}
          disabled={blocking}
          sx={{ textTransform: 'none' }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={blocking}
          variant="contained"
          startIcon={<BlockIcon />}
          sx={{
            bgcolor: '#DC2626',
            '&:hover': {
              bgcolor: '#B91C1C'
            },
            '&:disabled': {
              bgcolor: 'rgba(0, 0, 0, 0.12)'
            },
            textTransform: 'none'
          }}
        >
          {blocking ? 'Blocking...' : 'Block User'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}





