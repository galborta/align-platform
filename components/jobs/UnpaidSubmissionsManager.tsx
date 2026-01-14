'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import { toast } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

interface UnpaidSubmission {
  id: string
  worker_wallet: string
  social_follower_count: number
  social_base_payment_amount_usd: number
  social_base_payment_amount_tokens: number
  social_approval_status: string
  social_payment_tx_signature: string | null
  submitted_at: string
}

interface UnpaidSubmissionsManagerProps {
  jobId: string
  onSubmissionUpdated?: () => void
}

export default function UnpaidSubmissionsManager({
  jobId,
  onSubmissionUpdated
}: UnpaidSubmissionsManagerProps) {
  const [submissions, setSubmissions] = useState<UnpaidSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [submissionToDelete, setSubmissionToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [posterWallet, setPosterWallet] = useState<string | null>(null)

  const fetchUnpaidSubmissions = async () => {
    setLoading(true)
    try {
      // Fetch job data to get poster wallet
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('poster_wallet')
        .eq('id', jobId)
        .single()

      if (jobError) {
        console.error('Error fetching job:', jobError)
      } else if (jobData?.poster_wallet) {
        setPosterWallet(jobData.poster_wallet)
      }

      // First, let's see ALL submissions to understand what's there
      const { data: allSubmissions, error: allError } = await supabase
        .from('job_submissions')
        .select('*')
        .eq('job_id', jobId)
        .order('submitted_at', { ascending: false })

      if (allError) throw allError
      
      console.log('=== ALL SUBMISSIONS FOR THIS JOB ===')
      console.log('Total submissions:', allSubmissions?.length || 0)
      allSubmissions?.forEach(sub => {
        console.log(`- ${sub.id.slice(0, 8)}: status=${sub.social_approval_status}, signature=${sub.social_payment_tx_signature ? 'HAS' : 'NO'}, submitted=${sub.submitted_at}`)
      })

      // Find approved submissions including those stuck in pending payment
      const { data, error } = await supabase
        .from('job_submissions')
        .select('*')
        .eq('job_id', jobId)
        .in('social_approval_status', ['approved', 'auto_approved', 'approved_failed', 'approved_pending_payment'])
        .order('submitted_at', { ascending: false })

      if (error) throw error

      console.log('All approved submissions:', data)

      // Filter to only show unpaid or failed submissions
      // A submission is considered unpaid if:
      // 1. It has no payment signature (null or empty string)
      // 2. OR it's in 'approved_failed' status
      // 3. OR it's stuck in 'approved_pending_payment' (payment was attempted but DB update failed)
      const unpaidSubmissions = (data || []).filter(sub => {
        const hasNoSignature = !sub.social_payment_tx_signature || 
                               sub.social_payment_tx_signature.trim() === ''
        const isFailed = sub.social_approval_status === 'approved_failed'
        const isStuckPending = sub.social_approval_status === 'approved_pending_payment'
        
        console.log(`Submission ${sub.id}:`, {
          status: sub.social_approval_status,
          signature: sub.social_payment_tx_signature,
          hasNoSignature,
          isFailed,
          isStuckPending,
          willShow: hasNoSignature || isFailed || isStuckPending
        })
        
        return hasNoSignature || isFailed || isStuckPending
      })

      console.log('Unpaid submissions found:', unpaidSubmissions.length)
      setSubmissions(unpaidSubmissions)
    } catch (error: any) {
      console.error('Error fetching unpaid submissions:', error)
      toast.error('Failed to load unpaid submissions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUnpaidSubmissions()
  }, [jobId])

  const handleRetryPayment = async (submissionId: string) => {
    setRetrying(submissionId)
    
    try {
      // Get session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        toast.error('Please sign in to retry payment')
        return
      }

      const response = await fetch(`/api/jobs/${jobId}/retry-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          submission_id: submissionId,
          poster_wallet: posterWallet 
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Payment successful!')
        fetchUnpaidSubmissions()
        onSubmissionUpdated?.()
      } else {
        toast.error(data.error || 'Payment failed. Please try again.')
      }
    } catch (error: any) {
      console.error('Error retrying payment:', error)
      toast.error('Failed to retry payment')
    } finally {
      setRetrying(null)
    }
  }

  const handleDeleteSubmission = async () => {
    if (!submissionToDelete) return

    setDeleting(true)
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        toast.error('Please sign in to delete submission')
        return
      }

      const { error } = await supabase
        .from('job_submissions')
        .delete()
        .eq('id', submissionToDelete)

      if (error) throw error

      toast.success('Submission deleted successfully')
      fetchUnpaidSubmissions()
      onSubmissionUpdated?.()
      setDeleteConfirmOpen(false)
      setSubmissionToDelete(null)
    } catch (error: any) {
      console.error('Error deleting submission:', error)
      toast.error('Failed to delete submission')
    } finally {
      setDeleting(false)
    }
  }

  const openDeleteConfirm = (submissionId: string) => {
    setSubmissionToDelete(submissionId)
    setDeleteConfirmOpen(true)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (submissions.length === 0) {
    return (
      <Alert severity="success" icon={<CheckCircleIcon />}>
        All submissions have been paid successfully!
      </Alert>
    )
  }

  return (
    <Box>
      <Alert severity="warning" icon={<ErrorIcon />} sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {submissions.length} submission{submissions.length > 1 ? 's' : ''} need{submissions.length === 1 ? 's' : ''} attention
        </Typography>
        <Typography variant="caption">
          These submissions were approved but payment failed or wasn't completed.
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {submissions.map((submission) => (
          <Card key={submission.id} sx={{ bgcolor: '#FAFAFA' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 0.5 }}>
                    {submission.worker_wallet.slice(0, 8)}...{submission.worker_wallet.slice(-6)}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={submission.social_approval_status}
                      size="small"
                      color={submission.social_approval_status === 'approved_failed' ? 'error' : 'warning'}
                    />
                    <Chip
                      label={`${submission.social_follower_count} followers`}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Payment: ${submission.social_base_payment_amount_usd?.toFixed(2) || '0.00'} 
                    ({submission.social_base_payment_amount_tokens?.toFixed(2) || '0'} tokens)
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    startIcon={retrying === submission.id ? <CircularProgress size={16} /> : <RefreshIcon />}
                    onClick={() => handleRetryPayment(submission.id)}
                    disabled={retrying === submission.id}
                    sx={{ minWidth: 140 }}
                  >
                    Retry Payment
                  </Button>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => openDeleteConfirm(submission.id)}
                    sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => !deleting && setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Submission?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this submission? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteSubmission} 
            color="error" 
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : null}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
