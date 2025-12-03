'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
  Paper
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteIcon from '@mui/icons-material/Delete'
import LinkIcon from '@mui/icons-material/Link'
import AddIcon from '@mui/icons-material/Add'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import { Database } from '@/types/database'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'

type Job = Database['public']['Tables']['jobs']['Row']

interface ContestSubmissionModalProps {
  open: boolean
  onClose: () => void
  job: Job
  userWallet: string
  onSubmissionSuccess: () => void
}

export default function ContestSubmissionModal({
  open,
  onClose,
  job,
  userWallet,
  onSubmissionSuccess
}: ContestSubmissionModalProps) {
  const [message, setMessage] = useState('')
  const [externalLinks, setExternalLinks] = useState<string[]>([''])
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // Limit to 5 images total
    if (uploadedImages.length + files.length > 5) {
      setError('Maximum 5 images allowed per submission')
      return
    }

    setIsUploading(true)
    setError('')

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file type
        if (!file.type.match(/^image\/(jpeg|jpg|png|gif|webp)$/)) {
          throw new Error(`${file.name} is not a supported image format`)
        }

        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} exceeds 5MB limit`)
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop()
        const fileName = `contest-${job.id}/${userWallet}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

        // Upload to Supabase Storage (contest-submissions bucket)
        const { data, error: uploadError } = await supabase.storage
          .from('contest-submissions')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) throw uploadError

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('contest-submissions')
          .getPublicUrl(data.path)

        return urlData.publicUrl
      })

      const urls = await Promise.all(uploadPromises)
      setUploadedImages([...uploadedImages, ...urls])
      toast.success(`${urls.length} image${urls.length > 1 ? 's' : ''} uploaded`)
    } catch (err: any) {
      setError(err.message || 'Failed to upload images')
      toast.error('Image upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index))
  }

  const handleAddLink = () => {
    if (externalLinks.length < 5) {
      setExternalLinks([...externalLinks, ''])
    }
  }

  const handleLinkChange = (index: number, value: string) => {
    const newLinks = [...externalLinks]
    newLinks[index] = value
    setExternalLinks(newLinks)
  }

  const handleRemoveLink = (index: number) => {
    if (externalLinks.length === 1) {
      setExternalLinks([''])
    } else {
      setExternalLinks(externalLinks.filter((_, i) => i !== index))
    }
  }

  const validateSubmission = (): boolean => {
    // Message required
    if (!message.trim()) {
      setError('Please describe your submission')
      return false
    }

    if (message.length < 20) {
      setError('Description must be at least 20 characters')
      return false
    }

    if (message.length > 2000) {
      setError('Description must be less than 2000 characters')
      return false
    }

    // At least one image or link required
    const validLinks = externalLinks.filter(link => link.trim())
    if (uploadedImages.length === 0 && validLinks.length === 0) {
      setError('Please upload at least one image or provide an external link')
      return false
    }

    // Validate URL format for external links
    const urlPattern = /^https?:\/\/.+/
    for (const link of validLinks) {
      if (!urlPattern.test(link)) {
        setError(`Invalid URL format: ${link}`)
        return false
      }
    }

    return true
  }

  const handleSubmit = async () => {
    if (!validateSubmission()) return

    setIsSubmitting(true)
    setError('')

    try {
      // Check if user already submitted to this contest
      const { data: existingSubmission } = await supabase
        .from('job_submissions')
        .select('id')
        .eq('job_id', job.id)
        .eq('worker_wallet', userWallet)
        .maybeSingle()

      if (existingSubmission) {
        setError('You have already submitted to this contest')
        setIsSubmitting(false)
        return
      }

      // Create submission
      const validLinks = externalLinks.filter(link => link.trim())
      const { data: newSubmission, error: insertError } = await supabase
        .from('job_submissions')
        .insert({
          job_id: job.id,
          worker_wallet: userWallet,
          message: message.trim(),
          image_urls: uploadedImages,
          external_links: validLinks,
          submitted_at: new Date().toISOString(),
          is_selected_winner: false,
          winner_position: null,
          prize_amount_tokens: null,
          prize_amount_usd: null
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Award karma for submission (non-blocking)
      try {
        await supabase.rpc('increment_applications_submitted', {
          wallet: userWallet,
          project: job.project_id
        })
      } catch (karmaError) {
        console.error('Failed to award karma:', karmaError)
        // Non-blocking - continue
      }

      // Create notification for job poster (non-blocking)
      try {
        await supabase
          .from('notifications')
          .insert({
            user_wallet: job.poster_wallet,
            type: 'job_application_received',
            actor_wallet: userWallet,
            reference_id: job.id,
            reference_type: 'job',
            metadata: {
              job_title: job.title,
              is_contest: true,
              submission_id: newSubmission.id
            }
          })
      } catch (notifError) {
        console.error('Failed to create notification:', notifError)
        // Non-blocking - continue
      }

      // Create feed event if submissions are public (non-blocking)
      if (job.contest_submissions_visible) {
        try {
          await supabase
            .from('feed_events')
            .insert({
              type: 'job_application_submitted',
              actor_wallet: userWallet,
              reference_id: job.id,
              reference_type: 'job',
              metadata: {
                job_title: job.title,
                is_contest: true,
                has_images: uploadedImages.length > 0
              }
            })
        } catch (feedError) {
          console.error('Failed to create feed event:', feedError)
          // Non-blocking - continue
        }
      }

      toast.success('Contest entry submitted successfully! 🎉', {
        duration: 4000,
        style: {
          background: '#7C4DFF',
          color: '#fff',
        }
      })
      
      onSubmissionSuccess()
      onClose()

      // Reset form
      setMessage('')
      setExternalLinks([''])
      setUploadedImages([])
    } catch (err: any) {
      console.error('Submission error:', err)
      setError(err.message || 'Failed to submit entry')
      toast.error('Submission failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (isSubmitting || isUploading) return
    onClose()
  }

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return 'the deadline'
    const date = new Date(deadline)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 'var(--radius-card-lg, 24px)',
          boxShadow: 'var(--shadow-floating, 0 24px 60px 0 rgba(15, 23, 42, 0.10))'
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          pb: 1,
          borderBottom: '1px solid var(--border-subtle, #E5E7F0)'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-control, 999px)',
                bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <EmojiEventsIcon sx={{ color: 'var(--accent-primary, #7C4DFF)', fontSize: 24 }} />
            </Box>
            <Typography 
              variant="h6"
              sx={{
                fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                fontWeight: 600,
                fontSize: '22px',
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              Submit Contest Entry
            </Typography>
          </Box>
          <IconButton 
            onClick={handleClose} 
            disabled={isSubmitting || isUploading}
            sx={{ 
              color: 'var(--icon-default, #B6BAC7)',
              '&:hover': { color: 'var(--text-secondary, #6F7280)' }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {/* Contest Info Card */}
        <Paper
          elevation={0}
          sx={{ 
            p: 'var(--space-md, 16px)',
            mb: 3,
            bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
            borderRadius: 'var(--radius-card-lg, 24px)',
            border: 'none'
          }}
        >
          <Typography 
            sx={{ 
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontWeight: 600,
              fontSize: '16px',
              color: 'var(--accent-primary, #7C4DFF)',
              mb: 0.5
            }}
          >
            {job.title}
          </Typography>
          <Typography 
            sx={{ 
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '14px',
              color: 'var(--text-secondary, #6F7280)'
            }}
          >
            Submit your best work by {formatDeadline(job.contest_submission_deadline)}
          </Typography>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              borderRadius: 'var(--radius-card-lg, 24px)',
              '& .MuiAlert-message': {
                fontFamily: 'var(--font-body, Satoshi, sans-serif)'
              }
            }} 
            onClose={() => setError('')}
          >
            {error}
          </Alert>
        )}

        {/* Description Field */}
        <Box sx={{ mb: 3 }}>
          <Typography 
            sx={{ 
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 600,
              fontSize: '14px',
              color: 'var(--text-primary, #1A1A1E)',
              mb: 1
            }}
          >
            Describe your submission *
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={6}
            placeholder="Explain your approach, process, and what makes your entry stand out..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 'var(--radius-card-lg, 24px)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '16px',
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'var(--accent-primary, #7C4DFF)'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'var(--accent-primary, #7C4DFF)'
                }
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'var(--border-subtle, #E5E7F0)'
              }
            }}
          />
          <Typography 
            sx={{ 
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '12px',
              color: message.length > 2000 ? '#EF4444' : 'var(--text-muted, #A3A7B5)',
              mt: 0.5
            }}
          >
            {message.length}/2000 characters (minimum 20)
          </Typography>
        </Box>

        {/* Image Upload Section */}
        <Box sx={{ mb: 3 }}>
          <Typography 
            sx={{ 
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 600,
              fontSize: '14px',
              color: 'var(--text-primary, #1A1A1E)',
              mb: 1
            }}
          >
            Images
          </Typography>
          
          <input
            type="file"
            id="contest-image-upload"
            hidden
            multiple
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleImageUpload}
            disabled={isUploading || uploadedImages.length >= 5}
          />
          
          <label htmlFor="contest-image-upload">
            <Button
              variant="outlined"
              component="span"
              startIcon={isUploading ? <CircularProgress size={18} /> : <CloudUploadIcon />}
              disabled={isUploading || uploadedImages.length >= 5}
              sx={{
                borderRadius: 'var(--radius-control, 999px)',
                borderColor: 'var(--accent-primary, #7C4DFF)',
                color: 'var(--accent-primary, #7C4DFF)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 500,
                textTransform: 'none',
                px: 3,
                '&:hover': {
                  borderColor: 'var(--accent-primary, #7C4DFF)',
                  bgcolor: 'var(--accent-primary-soft, #EEE7FF)'
                },
                '&.Mui-disabled': {
                  borderColor: 'var(--border-subtle, #E5E7F0)',
                  color: 'var(--text-muted, #A3A7B5)'
                }
              }}
            >
              {isUploading ? 'Uploading...' : 'Upload Images'}
            </Button>
          </label>
          
          <Typography 
            sx={{ 
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '12px',
              color: 'var(--text-muted, #A3A7B5)',
              mt: 1,
              mb: 2
            }}
          >
            {uploadedImages.length}/5 images • Max 5MB each • JPG, PNG, GIF, WebP
          </Typography>

          {/* Image Preview Grid */}
          {uploadedImages.length > 0 && (
            <Box 
              sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
                gap: 'var(--space-sm, 12px)'
              }}
            >
              {uploadedImages.map((url, index) => (
                <Paper 
                  key={index} 
                  sx={{ 
                    position: 'relative', 
                    paddingTop: '100%', 
                    overflow: 'hidden',
                    borderRadius: 'var(--radius-card-lg, 24px)',
                    border: '2px solid var(--accent-success, #36C170)',
                    boxShadow: 'var(--shadow-chip, 0 8px 20px 0 rgba(15, 23, 42, 0.08))'
                  }}
                >
                  <Box
                    component="img"
                    src={url}
                    alt={`Upload ${index + 1}`}
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveImage(index)}
                    sx={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      bgcolor: 'rgba(0, 0, 0, 0.6)',
                      color: 'white',
                      width: 28,
                      height: 28,
                      '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.8)' }
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Paper>
              ))}
            </Box>
          )}
        </Box>

        {/* External Links Section */}
        <Box>
          <Typography 
            sx={{ 
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 600,
              fontSize: '14px',
              color: 'var(--text-primary, #1A1A1E)',
              mb: 0.5
            }}
          >
            External Links (optional)
          </Typography>
          <Typography 
            sx={{ 
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '12px',
              color: 'var(--text-muted, #A3A7B5)',
              mb: 2
            }}
          >
            Link to designs, prototypes, live demos, portfolios, Google Drive, Figma, etc.
          </Typography>

          {externalLinks.map((link, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="https://example.com/your-work"
                value={link}
                onChange={(e) => handleLinkChange(index, e.target.value)}
                InputProps={{
                  startAdornment: (
                    <LinkIcon sx={{ color: 'var(--icon-default, #B6BAC7)', mr: 1, fontSize: 20 }} />
                  )
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 'var(--radius-control, 999px)',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: '14px',
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'var(--accent-primary, #7C4DFF)'
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'var(--accent-primary, #7C4DFF)'
                    }
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'var(--border-subtle, #E5E7F0)'
                  }
                }}
              />
              <IconButton 
                onClick={() => handleRemoveLink(index)}
                disabled={externalLinks.length === 1 && !link.trim()}
                sx={{
                  color: '#EF4444',
                  '&:disabled': { color: 'var(--border-subtle, #E5E7F0)' },
                  '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)' }
                }}
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}

          {externalLinks.length < 5 && (
            <Button
              size="small"
              onClick={handleAddLink}
              startIcon={<AddIcon />}
              sx={{
                color: 'var(--accent-primary, #7C4DFF)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 500,
                textTransform: 'none',
                '&:hover': { bgcolor: 'var(--accent-primary-soft, #EEE7FF)' }
              }}
            >
              Add Another Link
            </Button>
          )}
        </Box>
      </DialogContent>

      <DialogActions 
        sx={{ 
          px: 3, 
          pb: 3,
          pt: 2,
          borderTop: '1px solid var(--border-subtle, #E5E7F0)'
        }}
      >
        <Button 
          onClick={handleClose} 
          disabled={isSubmitting || isUploading}
          sx={{
            borderRadius: 'var(--radius-control, 999px)',
            color: 'var(--text-secondary, #6F7280)',
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontWeight: 500,
            textTransform: 'none',
            px: 3,
            '&:hover': { bgcolor: 'var(--subtle-background, #F7F8FB)' }
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting || isUploading}
          sx={{
            borderRadius: 'var(--radius-control, 999px)',
            bgcolor: 'var(--accent-primary, #7C4DFF)',
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontWeight: 600,
            textTransform: 'none',
            px: 4,
            py: 1.2,
            boxShadow: 'var(--shadow-chip, 0 8px 20px 0 rgba(15, 23, 42, 0.08))',
            '&:hover': { 
              bgcolor: '#6B3FEE',
              boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
            },
            '&.Mui-disabled': {
              bgcolor: 'var(--border-subtle, #E5E7F0)',
              color: 'var(--text-muted, #A3A7B5)'
            }
          }}
        >
          {isSubmitting ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} sx={{ color: 'white' }} />
              <span>Submitting...</span>
            </Box>
          ) : (
            '🏆 Submit Entry'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

