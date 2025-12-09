'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  AlertTitle,
  CircularProgress,
  IconButton,
  Box,
  Typography,
  Chip,
  LinearProgress,
  useMediaQuery,
  useTheme
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import LoopIcon from '@mui/icons-material/Loop'
import AllInclusiveIcon from '@mui/icons-material/AllInclusive'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteIcon from '@mui/icons-material/Delete'
import WarningIcon from '@mui/icons-material/Warning'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import InfoIcon from '@mui/icons-material/Info'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import { toast } from 'react-hot-toast'
import { parseRevisionOffering, formatRevisionOffering, canRequestRevision, isVoluntaryRevision } from '@/lib/revisions'
import { supabase } from '@/lib/supabase'
import type { JobApplication } from '@/types/database'

interface ImagePreview {
  file: File
  preview: string
  uploading: boolean
  uploaded: boolean
  url: string | null
}

interface RequestRevisionModalProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  jobTitle: string
  posterWallet: string
  application: Pick<JobApplication, 'revisions_offered' | 'revisions_used' | 'revisions_remaining' | 'applicant_wallet'> | null
  onRevisionRequested?: () => void
}

/**
 * RequestRevisionModal Component
 * 
 * Modal for job posters to request revisions from the assigned worker.
 * Shows revision count, requires notes, and optionally allows reference images.
 * 
 * Follows Orggly design system with purple/lime accents.
 */
export function RequestRevisionModal({
  isOpen,
  onClose,
  jobId,
  jobTitle,
  posterWallet,
  application,
  onRevisionRequested
}: RequestRevisionModalProps) {
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [images, setImages] = useState<ImagePreview[]>([])
  const [error, setError] = useState('')

  // Mobile detection
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // Calculate revision status
  const offered = parseRevisionOffering(application?.revisions_offered ?? null)
  const used = application?.revisions_used ?? 0
  const remaining = parseRevisionOffering(application?.revisions_remaining ?? null)
  const hasRevisionsLeft = application ? canRequestRevision(application) : false
  const isVoluntary = application ? isVoluntaryRevision(application) : true

  // Prevent body scroll when modal is open on mobile
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen, isMobile])

  // Reset form
  const resetForm = useCallback(() => {
    setNotes('')
    setImages([])
    setError('')
  }, [])

  const handleClose = () => {
    if (loading) return
    resetForm()
    onClose()
  }

  // Image upload handling
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const maxImages = 3
    if (images.length + files.length > maxImages) {
      toast.error(`Maximum ${maxImages} reference images allowed`)
      return
    }

    const newImages: ImagePreview[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast.error('Only image files are allowed')
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB')
        continue
      }

      newImages.push({
        file,
        preview: URL.createObjectURL(file),
        uploading: false,
        uploaded: false,
        url: null
      })
    }

    setImages(prev => [...prev, ...newImages])
    e.target.value = '' // Reset input
  }

  const removeImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev]
      URL.revokeObjectURL(newImages[index].preview)
      newImages.splice(index, 1)
      return newImages
    })
  }

  const uploadImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = []

    for (let i = 0; i < images.length; i++) {
      if (images[i].uploaded && images[i].url) {
        uploadedUrls.push(images[i].url!)
        continue
      }

      setImages(prev => {
        const updated = [...prev]
        updated[i] = { ...updated[i], uploading: true }
        return updated
      })

      try {
        const file = images[i].file
        const fileExt = file.name.split('.').pop()
        const fileName = `revision-ref-${jobId}-${Date.now()}-${i}.${fileExt}`
        const filePath = `revision-references/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('job-images')
          .upload(filePath, file, { upsert: true })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('job-images')
          .getPublicUrl(filePath)

        uploadedUrls.push(publicUrl)

        setImages(prev => {
          const updated = [...prev]
          updated[i] = { ...updated[i], uploading: false, uploaded: true, url: publicUrl }
          return updated
        })
      } catch (err) {
        console.error('Error uploading image:', err)
        setImages(prev => {
          const updated = [...prev]
          updated[i] = { ...updated[i], uploading: false }
          return updated
        })
        throw new Error('Failed to upload reference image')
      }
    }

    return uploadedUrls
  }

  const validateForm = (): boolean => {
    setError('')

    if (!notes.trim()) {
      setError('Please provide clear revision notes explaining what changes you need')
      return false
    }

    if (notes.trim().length < 20) {
      setError('Please provide more detailed feedback (at least 20 characters)')
      return false
    }

    if (notes.trim().length > 2000) {
      setError('Revision notes must be 2000 characters or less')
      return false
    }

    return true
  }

  const handleSubmit = async () => {
    if (!validateForm() || !application) return

    setLoading(true)
    setError('')

    try {
      // Upload images first
      let imageUrls: string[] = []
      if (images.length > 0) {
        imageUrls = await uploadImages()
      }

      // Call the revision request API endpoint
      const response = await fetch(`/api/jobs/${jobId}/request-revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poster_wallet: posterWallet,
          notes: notes.trim(),
          images: imageUrls,
          is_voluntary: isVoluntary
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request revision')
      }

      toast.success(
        isVoluntary 
          ? 'Voluntary revision request sent to worker' 
          : `Revision ${used + 1} of ${offered === 'unlimited' ? '∞' : offered} requested`,
        { duration: 4000 }
      )

      onRevisionRequested?.()
      handleClose()
    } catch (err: any) {
      console.error('Error requesting revision:', err)
      setError(err.message || 'Failed to request revision. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Determine header content
  const getHeaderContent = () => {
    if (!application || offered === null) {
      return { title: 'Request Voluntary Revision', subtitle: 'No revisions were committed' }
    }

    if (offered === 'unlimited') {
      return { 
        title: `Request Revision ${used + 1}`, 
        subtitle: 'Unlimited revisions committed' 
      }
    }

    return { 
      title: `Request Revision ${used + 1} of ${offered}`, 
      subtitle: `${remaining} revision${remaining === 1 ? '' : 's'} remaining after this` 
    }
  }

  const { title, subtitle } = getHeaderContent()

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : '16px',
          border: isMobile ? 'none' : '2px solid #E5E7F0',
          // Full height on mobile
          ...(isMobile && {
            m: 0,
            maxHeight: '100%',
            height: '100%'
          })
        }
      }}
      // Better mobile scroll behavior
      scroll="paper"
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          borderBottom: '1px solid #E5E7F0'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {offered === 'unlimited' ? (
            <AllInclusiveIcon sx={{ fontSize: 28, color: '#FB923C' }} />
          ) : (
            <LoopIcon sx={{ fontSize: 28, color: '#7C4DFF' }} />
          )}
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
                fontWeight: 700,
                color: '#1A1A1E'
              }}
            >
              {title}
            </Typography>
            <Typography variant="body2" sx={{ color: '#6F7280' }}>
              {subtitle}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose} disabled={loading} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {/* Revision Counter Visual */}
        {application && offered !== null && offered !== 'unlimited' && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#6F7280' }}>
                Revision Progress
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#7C4DFF' }}>
                {used} / {offered}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={typeof offered === 'number' ? ((used + 1) / offered) * 100 : 0}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: '#E5E7F0',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  backgroundColor: 
                    typeof remaining === 'number' && remaining <= 1 
                      ? '#F59E0B' 
                      : '#7C4DFF'
                }
              }}
            />
          </Box>
        )}

        {/* Warning for voluntary revision */}
        {isVoluntary && (
          <Alert
            severity="warning"
            sx={{
              mb: 3,
              backgroundColor: '#FFF4E6',
              border: '1px solid #FB923C',
              '& .MuiAlert-icon': { color: '#FB923C' }
            }}
          >
            <AlertTitle sx={{ fontWeight: 700, color: '#1A1A1E' }}>
              Voluntary Revision
            </AlertTitle>
            <Typography variant="body2" sx={{ color: '#1A1A1E' }}>
              {offered === null 
                ? 'The worker did not commit to any revisions. They may choose to help, but are not obligated.'
                : 'All committed revisions have been used. The worker may choose to continue helping, but is not obligated.'
              }
            </Typography>
          </Alert>
        )}

        {/* Info about using committed revision */}
        {!isVoluntary && hasRevisionsLeft && (
          <Alert
            severity="info"
            sx={{
              mb: 3,
              backgroundColor: '#EEE7FF',
              border: '1px solid #7C4DFF',
              '& .MuiAlert-icon': { color: '#7C4DFF' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box>
                <Typography variant="body2" sx={{ color: '#1A1A1E' }}>
                  This will use <strong>1 of your {formatRevisionOffering(application?.revisions_offered ?? null)}</strong>. 
                  Please provide clear, constructive feedback to help the worker improve their delivery.
                </Typography>
              </Box>
            </Box>
          </Alert>
        )}

        {/* Error display */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Revision Notes Input */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: '#1A1A1E',
              mb: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: { xs: '15px', sm: '14px' }
            }}
          >
            Revision Notes <span style={{ color: '#EF4444' }}>*</span>
          </Typography>
          <TextField
            multiline
            rows={isMobile ? 6 : 5}
            fullWidth
            placeholder="Describe clearly what changes you need. Be specific and constructive:&#10;&#10;• What aspects need to change?&#10;• What was the expectation vs. what was delivered?&#10;• Any specific examples or references?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
            inputProps={{ maxLength: 2000 }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                // Prevent iOS zoom on focus (font-size >= 16px)
                fontSize: { xs: '16px', sm: '14px' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#7C4DFF'
                }
              },
              '& .MuiInputBase-input': {
                fontSize: { xs: '16px', sm: '14px' }
              }
            }}
          />
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textAlign: 'right',
              mt: 0.5,
              color: notes.length > 1800 ? '#F59E0B' : '#6F7280'
            }}
          >
            {notes.length}/2000
          </Typography>
        </Box>

        {/* Reference Images Upload */}
        <Box>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: '#1A1A1E',
              mb: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: { xs: '15px', sm: '14px' }
            }}
          >
            Reference Images (Optional)
            <Chip
              label="Max 3"
              size="small"
              sx={{
                ml: 1,
                height: 20,
                fontSize: 11,
                backgroundColor: '#F3F4F6',
                color: '#6F7280'
              }}
            />
          </Typography>

          {/* Upload Button - with camera capture on mobile */}
          <Box
            component="label"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: { xs: 3, sm: 2 },
              borderRadius: '12px',
              border: '2px dashed #E5E7F0',
              backgroundColor: '#F9FAFB',
              cursor: images.length >= 3 ? 'not-allowed' : 'pointer',
              opacity: images.length >= 3 ? 0.5 : 1,
              transition: 'all 0.2s',
              // Better touch feedback
              WebkitTapHighlightColor: 'rgba(124, 77, 255, 0.1)',
              minHeight: { xs: 100, sm: 'auto' },
              '&:hover': images.length < 3 ? {
                borderColor: '#7C4DFF',
                backgroundColor: '#F8F5FF'
              } : {},
              '&:active': images.length < 3 ? {
                transform: 'scale(0.98)'
              } : {}
            }}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              // Enable camera capture on mobile
              capture={isMobile ? 'environment' : undefined}
              onChange={handleImageUpload}
              disabled={loading || images.length >= 3}
              style={{ display: 'none' }}
            />
            {isMobile ? (
              <CameraAltIcon sx={{ fontSize: 36, color: '#A3A7B5', mb: 1 }} />
            ) : (
              <CloudUploadIcon sx={{ fontSize: 32, color: '#A3A7B5', mb: 1 }} />
            )}
            <Typography variant="body2" sx={{ color: '#6F7280', textAlign: 'center', fontSize: { xs: '14px', sm: '13px' } }}>
              {images.length >= 3 
                ? 'Maximum images reached' 
                : isMobile 
                  ? 'Tap to take photo or upload'
                  : 'Click to upload reference images'
              }
            </Typography>
          </Box>

          {/* Image Previews */}
          {images.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
              {images.map((img, index) => (
                <Box
                  key={index}
                  sx={{
                    position: 'relative',
                    width: 80,
                    height: 80,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '2px solid #E5E7F0'
                  }}
                >
                  <img
                    src={img.preview}
                    alt={`Reference ${index + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {img.uploading && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.5)'
                      }}
                    >
                      <CircularProgress size={20} sx={{ color: '#fff' }} />
                    </Box>
                  )}
                  {img.uploaded && (
                    <CheckCircleIcon
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        fontSize: 16,
                        color: '#36C170'
                      }}
                    />
                  )}
                  <IconButton
                    size="small"
                    onClick={() => removeImage(index)}
                    disabled={loading || img.uploading}
                    sx={{
                      position: 'absolute',
                      top: 2,
                      left: 2,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      padding: '2px',
                      '&:hover': { backgroundColor: 'rgba(239,68,68,0.8)' }
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>

      {/* Actions - Sticky on mobile */}
      <DialogActions
        sx={{
          px: { xs: 2, sm: 3 },
          py: { xs: 2, sm: 2 },
          borderTop: '1px solid #E5E7F0',
          gap: 1.5,
          // Sticky at bottom on mobile
          ...(isMobile && {
            position: 'sticky',
            bottom: 0,
            backgroundColor: '#fff',
            zIndex: 1,
            boxShadow: '0 -4px 12px rgba(0,0,0,0.08)'
          }),
          // Stack buttons vertically on mobile
          flexDirection: { xs: 'column-reverse', sm: 'row' }
        }}
      >
        <Button
          onClick={handleClose}
          disabled={loading}
          fullWidth={isMobile}
          sx={{
            textTransform: 'none',
            color: '#6F7280',
            fontWeight: 600,
            minHeight: { xs: 48, sm: 'auto' }
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !notes.trim()}
          fullWidth={isMobile}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LoopIcon />}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            minHeight: { xs: 48, sm: 'auto' },
            fontSize: { xs: '16px', sm: '14px' },
            backgroundColor: isVoluntary ? '#FB923C' : '#7C4DFF',
            '&:hover': {
              backgroundColor: isVoluntary ? '#F97316' : '#6B3FEE'
            },
            '&.Mui-disabled': {
              backgroundColor: '#E5E7F0',
              color: '#A3A7B5'
            }
          }}
        >
          {loading ? 'Sending...' : isVoluntary ? 'Request Voluntary Revision' : 'Request Revision'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default RequestRevisionModal

