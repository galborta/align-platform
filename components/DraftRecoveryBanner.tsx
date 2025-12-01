'use client'

import { useState, useEffect } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  CircularProgress,
  Chip,
  Divider,
  Paper
} from '@mui/material'
import WarningIcon from '@mui/icons-material/Warning'
import RestoreIcon from '@mui/icons-material/Restore'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import { getDraftsForRecovery, retryJobCreationFromDraft, deleteDraft, JobDraft } from '@/lib/job-drafts'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface DraftRecoveryBannerProps {
  walletAddress: string
  projectId?: string
}

export function DraftRecoveryBanner({ walletAddress, projectId }: DraftRecoveryBannerProps) {
  const router = useRouter()
  const [drafts, setDrafts] = useState<JobDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [recovering, setRecovering] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    loadDrafts()
  }, [walletAddress])

  const loadDrafts = async () => {
    setLoading(true)
    try {
      const allDrafts = await getDraftsForRecovery(walletAddress)
      
      // Filter by project if projectId is provided
      const filteredDrafts = projectId
        ? allDrafts.filter(d => d.project_id === projectId)
        : allDrafts
      
      setDrafts(filteredDrafts)
    } catch (error) {
      console.error('Error loading drafts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRecoverDraft = async (draft: JobDraft) => {
    setRecovering(draft.id)
    
    try {
      console.log('Recovering draft:', draft.id)
      
      const job = await retryJobCreationFromDraft(draft)
      
      if (job) {
        toast.success('Job recovered successfully! 🎉', {
          duration: 4000,
          icon: '✅'
        })
        
        // Remove from list
        setDrafts(drafts.filter(d => d.id !== draft.id))
        
        // Redirect to job page
        router.push(`/project/${draft.project_id}/jobs/${job.id}`)
      } else {
        toast.error('Failed to recover job. Please try again or contact support.', {
          duration: 6000
        })
      }
    } catch (error) {
      console.error('Error recovering draft:', error)
      toast.error('Failed to recover job. Please try again or contact support.', {
        duration: 6000
      })
    } finally {
      setRecovering(null)
    }
  }

  const handleDeleteDraft = async (draftId: string) => {
    if (!confirm('Are you sure you want to delete this draft? This action cannot be undone.')) {
      return
    }
    
    try {
      const success = await deleteDraft(draftId)
      
      if (success) {
        toast.success('Draft deleted')
        setDrafts(drafts.filter(d => d.id !== draftId))
      } else {
        toast.error('Failed to delete draft')
      }
    } catch (error) {
      console.error('Error deleting draft:', error)
      toast.error('Failed to delete draft')
    }
  }

  if (loading) {
    return null
  }

  if (drafts.length === 0 || dismissed) {
    return null
  }

  return (
    <>
      <Alert 
        severity="warning" 
        icon={<WarningIcon />}
        sx={{ 
          mb: 3,
          backgroundColor: '#FFF4E5',
          border: '1px solid #FFB74D',
          '& .MuiAlert-icon': {
            color: '#F57C00'
          }
        }}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              size="small" 
              variant="contained"
              startIcon={<RestoreIcon />}
              onClick={() => setShowModal(true)}
              sx={{
                backgroundColor: '#F57C00',
                '&:hover': {
                  backgroundColor: '#E65100'
                }
              }}
            >
              Recover {drafts.length} Job{drafts.length > 1 ? 's' : ''}
            </Button>
            <Button 
              size="small"
              onClick={() => setDismissed(true)}
              sx={{ color: '#666' }}
            >
              Dismiss
            </Button>
          </Box>
        }
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          {drafts.length} Job{drafts.length > 1 ? 's' : ''} Need{drafts.length === 1 ? 's' : ''} Recovery
        </Typography>
        <Typography variant="body2">
          {drafts.length === 1
            ? 'A job was interrupted after tokens were locked. Click "Recover" to complete the job posting.'
            : `${drafts.length} jobs were interrupted after tokens were locked. Click "Recover" to complete the job postings.`
          }
        </Typography>
      </Alert>

      <Dialog 
        open={showModal} 
        onClose={() => !recovering && setShowModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RestoreIcon sx={{ color: '#F57C00' }} />
            <Typography variant="h6" component="span">
              Recover Jobs
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              These jobs had their tokens successfully locked in escrow, but the job creation failed.
              You can safely recover them without paying again - the tokens are already locked.
            </Typography>
          </Alert>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {drafts.map((draft) => (
              <Paper
                key={draft.id}
                sx={{
                  p: 2,
                  border: '1px solid #E0E0E0',
                  borderRadius: 2,
                  '&:hover': {
                    borderColor: '#7C4DFF',
                    boxShadow: '0 2px 8px rgba(124, 77, 255, 0.1)'
                  }
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600, mb: 1 }}>
                      {draft.draft_data.title}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                      <Chip 
                        label={draft.draft_data.category} 
                        size="small" 
                        sx={{ backgroundColor: '#E3F06F', color: '#000' }}
                      />
                      <Chip 
                        label={`${draft.draft_data.payment_amount_tokens} ${draft.draft_data.token_symbol || 'tokens'}`}
                        size="small"
                        sx={{ backgroundColor: '#7C4DFF', color: '#fff' }}
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {draft.draft_data.description.slice(0, 150)}
                      {draft.draft_data.description.length > 150 ? '...' : ''}
                    </Typography>
                    
                    {draft.escrow_tx_signature && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        TX: {draft.escrow_tx_signature.slice(0, 8)}...{draft.escrow_tx_signature.slice(-8)}
                      </Typography>
                    )}
                  </Box>
                  
                  <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={recovering === draft.id ? <CircularProgress size={16} /> : <RestoreIcon />}
                      onClick={() => handleRecoverDraft(draft)}
                      disabled={!!recovering}
                      sx={{
                        backgroundColor: '#36C170',
                        '&:hover': {
                          backgroundColor: '#2EA760'
                        }
                      }}
                    >
                      {recovering === draft.id ? 'Recovering...' : 'Recover'}
                    </Button>
                    
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDeleteDraft(draft.id)}
                      disabled={!!recovering}
                      sx={{
                        borderColor: '#FF5252',
                        color: '#FF5252',
                        '&:hover': {
                          borderColor: '#D32F2F',
                          backgroundColor: 'rgba(255, 82, 82, 0.04)'
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </Box>
                </Box>
                
                <Divider sx={{ my: 1 }} />
                
                <Typography variant="caption" color="text.secondary">
                  Saved {new Date(draft.created_at).toLocaleString()}
                </Typography>
              </Paper>
            ))}
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setShowModal(false)}
            disabled={!!recovering}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}


