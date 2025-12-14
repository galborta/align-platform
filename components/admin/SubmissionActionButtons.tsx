'use client'

import { useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

interface SubmissionActionButtonsProps {
  submissionId: string
  conversationId: string
  contractAddress: string
  email: string
  tokenSymbol: string
  tokenName: string
  adminWallet: string
  submissionStatus?: 'pending' | 'approved' | 'rejected'
  onActionComplete?: () => void
}

export default function SubmissionActionButtons({
  submissionId,
  conversationId,
  contractAddress,
  email,
  tokenSymbol,
  tokenName,
  adminWallet,
  submissionStatus = 'pending',
  onActionComplete
}: SubmissionActionButtonsProps) {
  const [showAcceptModal, setShowAcceptModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [actionType, setActionType] = useState<'accept' | 'reject' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [creationLink, setCreationLink] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  // Hide buttons if submission is not pending
  if (submissionStatus !== 'pending') {
    return null
  }

  // Handle accept button click
  const handleAcceptClick = () => {
    setShowAcceptModal(true)
  }

  // Handle reject button click
  const handleRejectClick = () => {
    setShowRejectModal(true)
  }

  // Confirm accept action
  const handleConfirmAccept = async () => {
    setProcessing(true)
    setActionType('accept')
    setActionError(null)
    
    try {
      console.log('✅ Accepting submission:', {
        submissionId,
        conversationId,
        contractAddress,
        email,
        tokenSymbol,
        tokenName,
        adminWallet
      })
      
      // Call approve API
      const response = await fetch('/api/admin/submissions/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          submissionId,
          adminWallet
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to approve submission')
      }
      
      console.log('✅ Submission approved successfully:', data)
      console.log('📧 Creation link:', data.creationLink)
      
      // Store creation link
      setCreationLink(data.creationLink)
      
      // Copy to clipboard if available
      if (navigator.clipboard && data.creationLink) {
        try {
          await navigator.clipboard.writeText(data.creationLink)
          console.log('📋 Creation link copied to clipboard')
        } catch (clipboardError) {
          console.warn('Failed to copy to clipboard:', clipboardError)
        }
      }
      
      // Show success message
      setSuccessMessage('✓ Project approved! Creation link has been sent in the conversation.')
      setShowSuccessMessage(true)
      
      // Close modal
      setShowAcceptModal(false)
      
      // Call completion callback
      if (onActionComplete) {
        onActionComplete()
      }
    } catch (error) {
      console.error('❌ Error accepting submission:', error)
      setActionError(error instanceof Error ? error.message : 'Failed to approve submission')
    } finally {
      setProcessing(false)
      setActionType(null)
    }
  }

  // Confirm reject action
  const handleConfirmReject = async () => {
    setProcessing(true)
    setActionType('reject')
    setActionError(null)
    
    try {
      console.log('❌ Rejecting submission:', {
        submissionId,
        conversationId,
        contractAddress,
        email,
        tokenSymbol,
        tokenName,
        adminWallet
      })
      
      // Call reject API
      const response = await fetch('/api/admin/submissions/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          submissionId,
          adminWallet
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to reject submission')
      }
      
      console.log('✅ Submission rejected successfully:', data)
      
      // Show success message
      setSuccessMessage('Project rejected. Rejection message has been sent.')
      setShowSuccessMessage(true)
      
      // Close modal
      setShowRejectModal(false)
      
      // Call completion callback
      if (onActionComplete) {
        onActionComplete()
      }
    } catch (error) {
      console.error('❌ Error rejecting submission:', error)
      setActionError(error instanceof Error ? error.message : 'Failed to reject submission')
    } finally {
      setProcessing(false)
      setActionType(null)
    }
  }

  // Cancel modals
  const handleCancelAccept = () => {
    if (!processing) {
      setShowAcceptModal(false)
    }
  }

  const handleCancelReject = () => {
    if (!processing) {
      setShowRejectModal(false)
    }
  }

  // Handle copy creation link
  const handleCopyLink = async () => {
    if (creationLink && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(creationLink)
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 3000)
      } catch (error) {
        console.error('Failed to copy link:', error)
      }
    }
  }

  // Handle close success message
  const handleCloseSuccess = () => {
    setShowSuccessMessage(false)
    setCreationLink(null)
  }

  return (
    <>
      {/* Error Alert */}
      {actionError && (
        <Alert 
          severity="error" 
          onClose={() => setActionError(null)}
          sx={{ 
            mb: 'var(--space-md)',
            borderRadius: 'var(--radius-card-lg)'
          }}
        >
          {actionError}
        </Alert>
      )}

      {/* Action Buttons */}
      <Box
        sx={{
          display: 'flex',
          gap: 'var(--space-md)',
          flexDirection: { xs: 'column', sm: 'row' },
          width: { xs: '100%', sm: 'auto' },
          mt: 'var(--space-lg)',
          mb: 'var(--space-md)'
        }}
      >
        {/* Accept Button */}
        <Button
          variant="contained"
          startIcon={<CheckCircleIcon />}
          onClick={handleAcceptClick}
          disabled={processing}
          sx={{
            bgcolor: 'var(--accent-success)',
            color: 'white',
            borderRadius: 'var(--radius-control)',
            padding: 'var(--space-md) var(--space-lg)',
            fontWeight: 'var(--weight-semibold)',
            fontSize: 'var(--text-label)',
            boxShadow: 'var(--shadow-chip)',
            textTransform: 'none',
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: '#2DAB5F',
              transform: 'translateY(-2px)',
              boxShadow: 'var(--shadow-floating)'
            },
            '&:active': {
              transform: 'translateY(0)'
            },
            '&:disabled': {
              bgcolor: 'var(--icon-default)',
              color: 'white',
              opacity: 0.5,
              cursor: 'not-allowed'
            }
          }}
        >
          {processing && actionType === 'accept' ? (
            <CircularProgress size={20} sx={{ color: 'white', mr: 1 }} />
          ) : null}
          ✓ Accept Project
        </Button>

        {/* Reject Button */}
        <Button
          variant="contained"
          startIcon={<CancelIcon />}
          onClick={handleRejectClick}
          disabled={processing}
          sx={{
            bgcolor: '#EF4444',
            color: 'white',
            borderRadius: 'var(--radius-control)',
            padding: 'var(--space-md) var(--space-lg)',
            fontWeight: 'var(--weight-semibold)',
            fontSize: 'var(--text-label)',
            boxShadow: 'var(--shadow-chip)',
            textTransform: 'none',
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: '#DC2626',
              transform: 'translateY(-2px)',
              boxShadow: 'var(--shadow-floating)'
            },
            '&:active': {
              transform: 'translateY(0)'
            },
            '&:disabled': {
              bgcolor: 'var(--icon-default)',
              color: 'white',
              opacity: 0.5,
              cursor: 'not-allowed'
            }
          }}
        >
          {processing && actionType === 'reject' ? (
            <CircularProgress size={20} sx={{ color: 'white', mr: 1 }} />
          ) : null}
          ✕ Reject Project
        </Button>
      </Box>

      {/* Success Snackbar */}
      <Snackbar
        open={showSuccessMessage}
        autoHideDuration={6000}
        onClose={handleCloseSuccess}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSuccess} 
          severity="success"
          sx={{
            width: '100%',
            borderRadius: 'var(--radius-card-lg)',
            boxShadow: 'var(--shadow-floating)'
          }}
          action={
            creationLink && (
              <Button
                size="small"
                startIcon={<ContentCopyIcon />}
                onClick={handleCopyLink}
                sx={{
                  color: 'inherit',
                  textTransform: 'none'
                }}
              >
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </Button>
            )
          }
        >
          {successMessage}
        </Alert>
      </Snackbar>

      {/* Accept Confirmation Modal */}
      <Dialog
        open={showAcceptModal}
        onClose={handleCancelAccept}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 'var(--radius-card-lg)',
            padding: 'var(--space-md)'
          }
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 'var(--weight-bold)',
            fontSize: 'var(--text-headline)',
            color: 'var(--text-primary)',
            pb: 'var(--space-sm)'
          }}
        >
          Accept this project?
        </DialogTitle>
        
        <DialogContent>
          <Typography
            variant="body1"
            sx={{
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-body)',
              lineHeight: 1.6
            }}
          >
            This will send an approval email with a unique creation link to{' '}
            <Typography
              component="span"
              sx={{
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-primary)'
              }}
            >
              {email}
            </Typography>
            .
          </Typography>
          
          <Box
            sx={{
              mt: 'var(--space-md)',
              p: 'var(--space-md)',
              bgcolor: 'var(--accent-success-soft)',
              borderRadius: 'var(--radius-card-lg)',
              border: '1px solid var(--accent-success)'
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontSize: 'var(--text-body-small)',
                color: 'var(--text-secondary)',
                mb: 'var(--space-xs)'
              }}
            >
              <strong>Project:</strong> {tokenSymbol} - {tokenName}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontSize: 'var(--text-body-small)',
                color: 'var(--text-secondary)'
              }}
            >
              <strong>Contract:</strong> {contractAddress.slice(0, 12)}...{contractAddress.slice(-8)}
            </Typography>
          </Box>
        </DialogContent>
        
        <DialogActions
          sx={{
            padding: 'var(--space-md)',
            gap: 'var(--space-sm)'
          }}
        >
          <Button
            onClick={handleCancelAccept}
            disabled={processing}
            sx={{
              color: 'var(--text-secondary)',
              textTransform: 'none',
              fontWeight: 'var(--weight-medium)',
              '&:hover': {
                bgcolor: 'var(--subtle-background)'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmAccept}
            disabled={processing}
            variant="contained"
            sx={{
              bgcolor: 'var(--accent-success)',
              color: 'white',
              textTransform: 'none',
              fontWeight: 'var(--weight-semibold)',
              padding: 'var(--space-sm) var(--space-lg)',
              borderRadius: 'var(--radius-control)',
              '&:hover': {
                bgcolor: '#2DAB5F'
              },
              '&:disabled': {
                bgcolor: 'var(--icon-default)'
              }
            }}
          >
            {processing ? (
              <>
                <CircularProgress size={16} sx={{ color: 'white', mr: 1 }} />
                Processing...
              </>
            ) : (
              'Yes, Accept Project'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Confirmation Modal */}
      <Dialog
        open={showRejectModal}
        onClose={handleCancelReject}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 'var(--radius-card-lg)',
            padding: 'var(--space-md)'
          }
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 'var(--weight-bold)',
            fontSize: 'var(--text-headline)',
            color: 'var(--text-primary)',
            pb: 'var(--space-sm)'
          }}
        >
          Reject this project?
        </DialogTitle>
        
        <DialogContent>
          <Typography
            variant="body1"
            sx={{
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-body)',
              lineHeight: 1.6
            }}
          >
            This will send a rejection email to{' '}
            <Typography
              component="span"
              sx={{
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-primary)'
              }}
            >
              {email}
            </Typography>
            . This action cannot be undone.
          </Typography>
          
          <Box
            sx={{
              mt: 'var(--space-md)',
              p: 'var(--space-md)',
              bgcolor: '#FEF2F2',
              borderRadius: 'var(--radius-card-lg)',
              border: '1px solid #EF4444'
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontSize: 'var(--text-body-small)',
                color: 'var(--text-secondary)',
                mb: 'var(--space-xs)'
              }}
            >
              <strong>Project:</strong> {tokenSymbol} - {tokenName}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontSize: 'var(--text-body-small)',
                color: 'var(--text-secondary)'
              }}
            >
              <strong>Contract:</strong> {contractAddress.slice(0, 12)}...{contractAddress.slice(-8)}
            </Typography>
          </Box>
        </DialogContent>
        
        <DialogActions
          sx={{
            padding: 'var(--space-md)',
            gap: 'var(--space-sm)'
          }}
        >
          <Button
            onClick={handleCancelReject}
            disabled={processing}
            sx={{
              color: 'var(--text-secondary)',
              textTransform: 'none',
              fontWeight: 'var(--weight-medium)',
              '&:hover': {
                bgcolor: 'var(--subtle-background)'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmReject}
            disabled={processing}
            variant="contained"
            sx={{
              bgcolor: '#EF4444',
              color: 'white',
              textTransform: 'none',
              fontWeight: 'var(--weight-semibold)',
              padding: 'var(--space-sm) var(--space-lg)',
              borderRadius: 'var(--radius-control)',
              '&:hover': {
                bgcolor: '#DC2626'
              },
              '&:disabled': {
                bgcolor: 'var(--icon-default)'
              }
            }}
          >
            {processing ? (
              <>
                <CircularProgress size={16} sx={{ color: 'white', mr: 1 }} />
                Processing...
              </>
            ) : (
              'Yes, Reject Project'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
