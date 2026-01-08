'use client'

import RejectionModal, { RejectionReason } from '@/components/jobs/social/RejectionModal'
import { useState } from 'react'
import { Container, Typography, Box, Button, Alert, Chip } from '@mui/material'
import type { Database } from '@/types/database'

type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

/**
 * Test page for RejectionModal
 * 
 * Navigate to /test-rejection-modal to view
 */
export default function TestRejectionModalPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [lastRejection, setLastRejection] = useState<{ reason: string; details: string } | null>(null)

  // Mock submission data
  const mockSubmission: JobSubmission = {
    id: 'test-submission-123',
    job_id: 'test-job-123',
    worker_wallet: '5xK3abc123def456ghi789jklm9P2',
    social_payment_amount_usd: 75,
    social_payment_amount_tokens: 75,
    social_approval_status: 'pending',
    social_follower_count: 15000,
    social_tweet_url: 'https://twitter.com/user/status/123456',
    submitted_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    poster_wallet: '',
    worker_id: '',
    status: 'pending',
    submission_data: null,
    approved_by: null,
    approved_at: null,
    rejected_at: null,
    rejected_by: null,
    rejection_reason: null,
    submission_url: null,
    reviewed_at: null,
    social_follower_count_verified: null,
    social_denial_reason: null,
    social_payment_released: null,
    social_payment_tx_signature: null
  } as JobSubmission

  const handleConfirm = (reason: RejectionReason, details: string) => {
    console.log('Rejection confirmed:', { reason, details })
    setLastRejection({ reason, details })
    setModalOpen(false)
    alert(`Rejection confirmed!\n\nReason: ${reason}\nDetails: ${details || '(none)'}`)
  }

  const handleClose = () => {
    console.log('Modal closed without rejection')
    setModalOpen(false)
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h1" sx={{ mb: 2, fontFamily: 'var(--font-heading)', fontSize: '32px' }}>
        Rejection Modal - Test Page
      </Typography>

      <Alert severity="info" sx={{ mb: 4 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          Test Features:
        </Typography>
        <Box component="ul" sx={{ pl: 2, m: 0 }}>
          <li>5 predefined rejection reasons</li>
          <li>"Other" reason requires details (min 10 chars)</li>
          <li>Optional details for other reasons (max 500 chars)</li>
          <li>Warning section shows consequences</li>
          <li>Budget amount displayed prominently</li>
          <li>Red "Confirm Rejection" button (danger action)</li>
        </Box>
      </Alert>

      <Box sx={{ background: 'var(--bg-secondary)', p: 3, borderRadius: 'var(--radius-card-md)', mb: 4 }}>
        <Typography variant="h2" sx={{ fontFamily: 'var(--font-heading)', fontSize: '20px', mb: 2 }}>
          Mock Submission Details
        </Typography>
        
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2">
            <strong>Worker Wallet:</strong> {mockSubmission.worker_wallet.slice(0, 8)}...{mockSubmission.worker_wallet.slice(-6)}
          </Typography>
        </Box>
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2">
            <strong>Payment Amount:</strong> ${mockSubmission.social_payment_amount_usd?.toFixed(2)}
          </Typography>
        </Box>
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2">
            <strong>Status:</strong> <Chip label="Pending" size="small" color="default" />
          </Typography>
        </Box>
      </Box>

      <Button
        variant="contained"
        size="large"
        onClick={() => setModalOpen(true)}
        fullWidth
        sx={{
          py: 2,
          fontSize: '16px',
          fontWeight: 600,
          textTransform: 'none',
          background: '#DC2626',
          '&:hover': {
            background: '#B91C1C'
          }
        }}
      >
        🚫 Open Rejection Modal
      </Button>

      {lastRejection && (
        <Box sx={{ mt: 4, p: 3, background: 'rgba(220, 38, 38, 0.1)', borderRadius: 'var(--radius-card-md)', border: '1px solid #DC2626' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#DC2626' }}>
            Last Rejection:
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>Reason:</strong> {lastRejection.reason}
          </Typography>
          {lastRejection.details && (
            <Typography variant="body2">
              <strong>Details:</strong> {lastRejection.details}
            </Typography>
          )}
        </Box>
      )}

      <Box sx={{ mt: 4, p: 3, background: 'rgba(255, 200, 87, 0.1)', borderRadius: 'var(--radius-card-md)', border: '1px solid var(--accent-warning)' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          Expected Behavior:
        </Typography>
        <Box component="ol" sx={{ pl: 3, m: 0 }}>
          <li>Select a reason to enable "Confirm Rejection" button</li>
          <li>If "Other" is selected, details field becomes required</li>
          <li>Details must be 10-500 characters if provided</li>
          <li>Warning section shows 3 consequences clearly</li>
          <li>Cancel button closes modal without action</li>
          <li>Confirm button shows alert with reason and details</li>
          <li>Validation errors appear above warning section</li>
        </Box>
      </Box>

      <Box sx={{ mt: 3, p: 2, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-card-md)' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          Available Rejection Reasons:
        </Typography>
        <Box component="ul" sx={{ pl: 3, m: 0 }}>
          <li>Tweet deleted before campaign ended</li>
          <li>Fake follower count</li>
          <li>Didn't follow campaign guidelines</li>
          <li>Low quality content</li>
          <li>Other (specify below) - requires details</li>
        </Box>
      </Box>

      {/* Modal */}
      <RejectionModal
        open={modalOpen}
        submission={mockSubmission}
        onClose={handleClose}
        onConfirm={handleConfirm}
      />
    </Container>
  )
}

