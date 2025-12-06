'use client'

import { useState, useEffect } from 'react'
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
  Typography,
  Box,
  Chip,
  Divider,
  useMediaQuery,
  useTheme
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { submitRevision } from '@/lib/revisions'
import { toast } from 'react-hot-toast'
import CloseIcon from '@mui/icons-material/Close'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import LoopIcon from '@mui/icons-material/Loop'
import LinkIcon from '@mui/icons-material/Link'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { parseRevisionOffering } from '@/lib/revisions'
import type { JobApplication } from '@/types/database'

interface RevisionRequest {
  revisionNumber: number
  isVoluntary: boolean
  notes: string
  requestedAt: string
  images?: string[]
}

interface SubmitRevisionModalProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  jobTitle: string
  workerWallet: string
  /** The revision request being responded to */
  revisionRequest: RevisionRequest | null
  /** Application with revision tracking data */
  application: Pick<JobApplication, 'revisions_offered' | 'revisions_used' | 'revisions_remaining'> | null
  onRevisionSubmitted?: () => void
}

interface ImagePreview {
  file: File
  preview: string
  uploading: boolean
  uploaded: boolean
  url: string | null
}

/**
 * SubmitRevisionModal Component
 * 
 * Modal for workers to submit revised work in response to a revision request.
 * Shows the original revision request and allows new file/message submission.
 */
export function SubmitRevisionModal({
  isOpen,
  onClose,
  jobId,
  jobTitle,
  workerWallet,
  revisionRequest,
  application,
  onRevisionSubmitted
}: SubmitRevisionModalProps) {
  const [loading, setLoading] = useState(false)
  const [revisionNotes, setRevisionNotes] = useState('')
  const [images, setImages] = useState<ImagePreview[]>([])
  const [externalLinks, setExternalLinks] = useState<string[]>([''])
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Mobile detection
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // Calculate revision info
  const offered = parseRevisionOffering(application?.revisions_offered ?? null)
  const used = application?.revisions_used ?? 0
  const revisionNumber = revisionRequest?.revisionNumber ?? used

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetForm()
    }
  }, [isOpen])

  // Prevent body scroll when modal is open on mobile
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen, isMobile])

  const resetForm = () => {
    setRevisionNotes('')
    setImages([])
    setExternalLinks([''])
    setErrors({})
  }

  // ==================== IMAGE HANDLING ====================
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    if (images.length + files.length > 5) {
      toast.error('Maximum 5 images allowed')
      return
    }

    const newImages: ImagePreview[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/)) {
        toast.error(`${file.name} is not a supported image format`)
        continue
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`)
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
  }

  const handleRemoveImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev]
      URL.revokeObjectURL(newImages[index].preview)
      newImages.splice(index, 1)
      return newImages
    })
  }

  const uploadImages = async (): Promise<string[]> => {
    if (images.length === 0) return []

    const uploadedUrls: string[] = []

    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      
      setImages(prev => {
        const newImages = [...prev]
        newImages[i].uploading = true
        return newImages
      })

      try {
        const fileExt = image.file.name.split('.').pop()
        const fileName = `revision-${workerWallet}/${jobId}/${Date.now()}-${i}.${fileExt}`

        const { data, error } = await supabase.storage
          .from('job-attachments')
          .upload(fileName, image.file, {
            cacheControl: '3600',
            upsert: false
          })

        if (error) throw error

        const { data: urlData } = supabase.storage
          .from('job-attachments')
          .getPublicUrl(data.path)

        uploadedUrls.push(urlData.publicUrl)

        setImages(prev => {
          const newImages = [...prev]
          newImages[i].uploading = false
          newImages[i].uploaded = true
          newImages[i].url = urlData.publicUrl
          return newImages
        })
      } catch (error) {
        console.error('Error uploading image:', error)
        toast.error(`Failed to upload ${image.file.name}`)
        throw error
      }
    }

    return uploadedUrls
  }

  // ==================== LINK HANDLING ====================
  const handleAddLink = () => {
    if (externalLinks.length >= 5) {
      toast.error('Maximum 5 links allowed')
      return
    }
    setExternalLinks(prev => [...prev, ''])
  }

  const handleRemoveLink = (index: number) => {
    if (externalLinks.length === 1) {
      setExternalLinks([''])
    } else {
      setExternalLinks(prev => prev.filter((_, i) => i !== index))
    }
  }

  const handleLinkChange = (index: number, value: string) => {
    setExternalLinks(prev => {
      const newLinks = [...prev]
      newLinks[index] = value
      return newLinks
    })
  }

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) return true
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  // ==================== FORM VALIDATION ====================
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!revisionNotes.trim()) {
      newErrors.revisionNotes = 'Please explain what changes you made'
    } else if (revisionNotes.length < 20) {
      newErrors.revisionNotes = 'Please provide more details (at least 20 characters)'
    } else if (revisionNotes.length > 2000) {
      newErrors.revisionNotes = 'Notes must be 2000 characters or less'
    }

    const nonEmptyLinks = externalLinks.filter(link => link.trim())
    for (let i = 0; i < nonEmptyLinks.length; i++) {
      if (!validateUrl(nonEmptyLinks[i])) {
        newErrors[`link_${i}`] = 'Invalid URL format'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ==================== SUBMIT HANDLER ====================
  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting')
      return
    }

    setLoading(true)

    try {
      // Upload images first
      let imageUrls: string[] = []
      if (images.length > 0) {
        imageUrls = await uploadImages()
      }

      // Filter out empty links
      const validLinks = externalLinks.filter(link => link.trim())

      // Submit the revision
      const result = await submitRevision(
        jobId,
        {
          notes: revisionNotes.trim(),
          images: imageUrls,
          links: validLinks,
          revisionNumber: revisionNumber
        },
        workerWallet
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit revision')
      }

      toast.success(
        `Revision #${revisionNumber} submitted! Waiting for poster review 📬`,
        {
          duration: 4000,
          style: {
            background: '#7C4DFF',
            color: '#fff',
          }
        }
      )

      // Wait for database to update
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      if (onRevisionSubmitted) {
        onRevisionSubmitted()
      }
      
      onClose()
    } catch (error: any) {
      console.error('Error submitting revision:', error)
      toast.error(error.message || 'Failed to submit revision. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isUploading = images.some(img => img.uploading)

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      scroll="paper"
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : '16px',
          border: isMobile ? 'none' : '2px solid #7C4DFF',
          // Full height on mobile
          ...(isMobile && {
            m: 0,
            maxHeight: '100%',
            height: '100%'
          })
        }
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ 
        fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
        fontSize: '24px',
        fontWeight: 700,
        color: '#1A1A1E',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pb: 1,
        borderBottom: '1px solid #E5E7F0'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <LoopIcon sx={{ fontSize: 28, color: '#7C4DFF' }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1A1A1E' }}>
              Submit Revision {offered === 'unlimited' ? '' : `#${revisionNumber}`}
              {revisionRequest?.isVoluntary && (
                <Chip
                  label="Voluntary"
                  size="small"
                  sx={{
                    ml: 1,
                    backgroundColor: '#FFF7ED',
                    color: '#FB923C',
                    fontWeight: 600,
                    fontSize: 11
                  }}
                />
              )}
            </Typography>
            <Typography variant="body2" sx={{ color: '#6F7280' }}>
              {jobTitle}
            </Typography>
          </Box>
        </Box>
        <IconButton 
          onClick={onClose}
          disabled={loading}
          sx={{ color: '#6F7280' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {/* Original Revision Request Reference */}
        {revisionRequest && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: '#6F7280',
                textTransform: 'uppercase',
                fontSize: 11,
                letterSpacing: '0.5px',
                mb: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5
              }}
            >
              <FormatQuoteIcon sx={{ fontSize: 16 }} />
              Original Revision Request
            </Typography>
            <Box
              sx={{
                p: 2.5,
                borderRadius: '12px',
                backgroundColor: '#F8F5FF',
                border: '1px solid #E5DEFF'
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: '#1A1A1E',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap'
                }}
              >
                {revisionRequest.notes}
              </Typography>
              {revisionRequest.images && revisionRequest.images.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" sx={{ color: '#6F7280', mb: 1, display: 'block' }}>
                    Reference Images:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {revisionRequest.images.map((url, idx) => (
                      <Box
                        key={idx}
                        component="a"
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          width: 50,
                          height: 50,
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '2px solid #E5E7F0'
                        }}
                      >
                        <img
                          src={url}
                          alt={`Reference ${idx + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Success Alert */}
        <Alert 
          severity="info" 
          icon={<CheckCircleIcon />}
          sx={{ 
            mb: 3,
            backgroundColor: '#E3F8ED',
            border: '1px solid #36C170',
            '& .MuiAlert-icon': { color: '#36C170' }
          }}
        >
          <AlertTitle sx={{ fontWeight: 700, color: '#1A1A1E' }}>
            Submit Your Revised Work
          </AlertTitle>
          <Typography variant="body2" sx={{ color: '#1A1A1E' }}>
            Upload your updated deliverables and explain the changes you made based on the feedback.
          </Typography>
        </Alert>

        {/* Revision Notes - What Changed */}
        <TextField
          label="What Changed? (Required)"
          value={revisionNotes}
          onChange={(e) => setRevisionNotes(e.target.value)}
          placeholder="Explain the changes you made in this revision:&#10;&#10;• What specific changes did you make?&#10;• How does this address the feedback?&#10;• Any notes for the reviewer?"
          fullWidth
          required
          multiline
          rows={isMobile ? 6 : 5}
          error={!!errors.revisionNotes}
          helperText={errors.revisionNotes || `${revisionNotes.length} / 2,000 characters`}
          inputProps={{ maxLength: 2000 }}
          sx={{ 
            mb: 3,
            '& .MuiOutlinedInput-root': {
              // Prevent iOS zoom on focus
              fontSize: { xs: '16px', sm: '14px' },
              '&.Mui-focused fieldset': {
                borderColor: '#7C4DFF'
              }
            },
            '& .MuiInputBase-input': {
              fontSize: { xs: '16px', sm: '14px' }
            },
            '& .MuiInputLabel-root': {
              fontSize: { xs: '16px', sm: '14px' }
            }
          }}
        />

        {/* Updated Deliverable Images */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1A1A1E' }}>
              Updated Deliverables (Optional)
            </Typography>
            <Typography variant="caption" sx={{ color: '#6F7280' }}>
              {images.length} / 5 images
            </Typography>
          </Box>

          <input
            type="file"
            id="revision-upload"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            // Enable camera capture on mobile
            capture={isMobile ? 'environment' : undefined}
            onChange={handleImageSelect}
            style={{ display: 'none' }}
            disabled={images.length >= 5 || loading}
          />

          <label htmlFor="revision-upload">
            <Button
              component="span"
              variant="outlined"
              startIcon={isMobile ? <CameraAltIcon /> : <CloudUploadIcon />}
              disabled={images.length >= 5 || loading}
              fullWidth={isMobile}
              sx={{
                color: '#7C4DFF',
                borderColor: '#7C4DFF',
                textTransform: 'none',
                minHeight: { xs: 48, sm: 'auto' },
                fontSize: { xs: '16px', sm: '14px' },
                '&:hover': {
                  borderColor: '#6B3FEE',
                  backgroundColor: '#F8F5FF'
                },
                mb: 1
              }}
            >
              {isMobile ? 'Take Photo or Upload' : 'Upload Revised Images'}
            </Button>
          </label>

          <Typography variant="caption" sx={{ display: 'block', color: '#6F7280', mb: 2, fontSize: { xs: '13px', sm: '12px' } }}>
            Upload images showing the revised work (max 5 images, 10MB each)
          </Typography>

          {/* Image Previews */}
          {images.length > 0 && (
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(5, 1fr)' }, 
              gap: { xs: 1, sm: 1.5 } 
            }}>
              {images.map((image, index) => (
                <Box 
                  key={index}
                  sx={{
                    position: 'relative',
                    aspectRatio: '1/1',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: `2px solid ${image.uploaded ? '#36C170' : '#E5E7F0'}`
                  }}
                >
                  <img
                    src={image.preview}
                    alt={`Revision ${index + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {image.uploading && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <CircularProgress size={24} sx={{ color: '#fff' }} />
                    </Box>
                  )}
                  {!loading && !image.uploading && (
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveImage(index)}
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        color: '#fff',
                        padding: '4px',
                        '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.8)' }
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* External Links */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1A1A1E' }}>
              External Links (Optional)
            </Typography>
            <Typography variant="caption" sx={{ color: '#6F7280' }}>
              {externalLinks.filter(l => l.trim()).length} / 5 links
            </Typography>
          </Box>

          <Typography variant="caption" sx={{ display: 'block', color: '#6F7280', mb: 2 }}>
            Google Drive, Figma, GitHub links, etc.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {externalLinks.map((link, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <TextField
                  value={link}
                  onChange={(e) => handleLinkChange(index, e.target.value)}
                  placeholder="https://drive.google.com/..."
                  fullWidth
                  error={!!errors[`link_${index}`]}
                  helperText={errors[`link_${index}`]}
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <LinkIcon sx={{ color: '#6F7280', mr: 1, fontSize: 18 }} />
                    )
                  }}
                />
                <IconButton
                  onClick={() => handleRemoveLink(index)}
                  disabled={loading || externalLinks.length === 1}
                  size="small"
                  sx={{ 
                    color: '#EF4444',
                    '&:disabled': { color: '#E5E7F0' }
                  }}
                >
                  <RemoveIcon />
                </IconButton>
              </Box>
            ))}
          </Box>

          {externalLinks.length < 5 && (
            <Button
              onClick={handleAddLink}
              startIcon={<AddIcon />}
              disabled={loading}
              size="small"
              sx={{
                color: '#7C4DFF',
                textTransform: 'none',
                mt: 1.5,
                '&:hover': { backgroundColor: '#F8F5FF' }
              }}
            >
              Add Another Link
            </Button>
          )}
        </Box>

        {/* Info about what happens next */}
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            After submitting, the poster will review your revision. The auto-release timer will restart.
          </Typography>
        </Alert>
      </DialogContent>

      {/* Actions - Sticky on mobile */}
      <DialogActions sx={{ 
        px: { xs: 2, sm: 3 }, 
        py: { xs: 2, sm: 2.5 }, 
        borderTop: '1px solid #E5E7F0',
        // Sticky at bottom on mobile
        ...(isMobile && {
          position: 'sticky',
          bottom: 0,
          backgroundColor: '#fff',
          zIndex: 1,
          boxShadow: '0 -4px 12px rgba(0,0,0,0.08)'
        }),
        // Stack buttons vertically on mobile
        flexDirection: { xs: 'column-reverse', sm: 'row' },
        gap: { xs: 1, sm: 0 }
      }}>
        <Button 
          onClick={onClose}
          disabled={loading}
          fullWidth={isMobile}
          sx={{ 
            color: '#6F7280',
            textTransform: 'none',
            fontSize: '16px',
            minHeight: { xs: 48, sm: 'auto' }
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || isUploading || !revisionNotes.trim()}
          variant="contained"
          fullWidth={isMobile}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LoopIcon />}
          sx={{
            backgroundColor: '#7C4DFF',
            color: '#fff',
            textTransform: 'none',
            fontSize: '16px',
            fontWeight: 600,
            px: { xs: 2, sm: 4 },
            minHeight: { xs: 48, sm: 'auto' },
            '&:hover': { backgroundColor: '#6B3FEE' },
            '&:disabled': { backgroundColor: '#E5E7F0', color: '#A3A7B5' }
          }}
        >
          {loading 
            ? (isUploading ? 'Uploading...' : 'Submitting...') 
            : `Submit Revision`
          }
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SubmitRevisionModal

