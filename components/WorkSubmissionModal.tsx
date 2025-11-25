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
  CircularProgress,
  IconButton,
  Chip
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { calculateJobCompletionKarma } from '@/lib/karma'
import { toast } from 'react-hot-toast'
import CloseIcon from '@mui/icons-material/Close'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import WarningIcon from '@mui/icons-material/Warning'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import LinkIcon from '@mui/icons-material/Link'

interface WorkSubmissionModalProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  jobUsdValue: number
  workerWallet: string
  onWorkSubmitted?: () => void
}

interface ImagePreview {
  file: File
  preview: string
  uploading: boolean
  uploaded: boolean
  url: string | null
}

export function WorkSubmissionModal({
  isOpen,
  onClose,
  jobId,
  jobUsdValue,
  workerWallet,
  onWorkSubmitted
}: WorkSubmissionModalProps) {
  const [loading, setLoading] = useState(false)
  const [deliveryMessage, setDeliveryMessage] = useState('')
  const [images, setImages] = useState<ImagePreview[]>([])
  const [externalLinks, setExternalLinks] = useState<string[]>([''])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [completionKarma, setCompletionKarma] = useState<number>(0)

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetForm()
    }
  }, [isOpen])

  // Calculate completion karma
  useEffect(() => {
    if (isOpen && jobUsdValue) {
      const karma = calculateJobCompletionKarma(jobUsdValue)
      setCompletionKarma(karma)
    }
  }, [isOpen, jobUsdValue])

  const resetForm = () => {
    setDeliveryMessage('')
    setImages([])
    setExternalLinks([''])
    setErrors({})
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // Check total image count
    if (images.length + files.length > 5) {
      toast.error('Maximum 5 images allowed')
      return
    }

    const newImages: ImagePreview[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validate file type
      if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/)) {
        toast.error(`${file.name} is not a supported image format`)
        continue
      }

      // Validate file size (max 10MB for deliverables)
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
      
      // Update uploading state
      setImages(prev => {
        const newImages = [...prev]
        newImages[i].uploading = true
        return newImages
      })

      try {
        // Generate unique filename with submission- prefix
        const fileExt = image.file.name.split('.').pop()
        const fileName = `submission-${workerWallet}/${Date.now()}-${i}.${fileExt}`

        // Upload to Supabase storage
        const { data, error } = await supabase.storage
          .from('job-attachments')
          .upload(fileName, image.file, {
            cacheControl: '3600',
            upsert: false
          })

        if (error) throw error

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('job-attachments')
          .getPublicUrl(data.path)

        uploadedUrls.push(urlData.publicUrl)

        // Update uploaded state
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

  const handleAddLink = () => {
    if (externalLinks.length >= 5) {
      toast.error('Maximum 5 links allowed')
      return
    }
    setExternalLinks(prev => [...prev, ''])
  }

  const handleRemoveLink = (index: number) => {
    if (externalLinks.length === 1) {
      // Keep at least one field
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
    if (!url.trim()) return true // Empty is okay (optional)
    
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Delivery message validation
    if (!deliveryMessage.trim()) {
      newErrors.deliveryMessage = 'Delivery message is required'
    } else if (deliveryMessage.length > 2000) {
      newErrors.deliveryMessage = 'Message must be 2000 characters or less'
    }

    // Validate URLs
    const nonEmptyLinks = externalLinks.filter(link => link.trim())
    for (let i = 0; i < nonEmptyLinks.length; i++) {
      if (!validateUrl(nonEmptyLinks[i])) {
        newErrors[`link_${i}`] = 'Invalid URL format'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

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

      // Create submission entry in database
      const { error: submissionError } = await supabase
        .from('job_submissions')
        .insert({
          job_id: jobId,
          worker_wallet: workerWallet,
          message: deliveryMessage.trim(),
          image_urls: imageUrls,
          external_links: validLinks,
          submitted_at: new Date().toISOString()
        })

      if (submissionError) throw submissionError

      // Update job status to 'submitted'
      const { error: jobUpdateError } = await supabase
        .from('jobs')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      if (jobUpdateError) throw jobUpdateError

      // TODO: Send notification to poster
      // await notifyPoster(jobId, workerWallet)

      toast.success('Work submitted! Waiting for poster review 📬', {
        duration: 4000,
        style: {
          background: '#7C4DFF',
          color: '#fff',
        }
      })

      // Close modal and refresh
      onClose()
      if (onWorkSubmitted) {
        onWorkSubmitted()
      }
    } catch (error) {
      console.error('Error submitting work:', error)
      toast.error('Failed to submit work. Please try again.')
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
      PaperProps={{
        sx: {
          borderRadius: '12px'
        }
      }}
    >
      <DialogTitle sx={{ 
        fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
        fontSize: '24px',
        fontWeight: 700,
        color: '#1A1A1E',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        Submit Completed Work
        <IconButton 
          onClick={onClose}
          disabled={loading}
          sx={{ color: '#6F7280' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Security Warning */}
        <Alert 
          severity="warning" 
          icon={<WarningIcon />}
          sx={{ 
            mb: 3,
            backgroundColor: '#FFF4E6',
            color: '#1A1A1E',
            '& .MuiAlert-icon': {
              color: '#FB923C'
            }
          }}
        >
          <strong>Poster:</strong> Review all files carefully before downloading. Never run executable files from unknown sources.
        </Alert>

        {/* Delivery Message */}
        <TextField
          label="Delivery Message"
          value={deliveryMessage}
          onChange={(e) => setDeliveryMessage(e.target.value)}
          placeholder="Describe what you've delivered and how it meets the KPIs..."
          fullWidth
          required
          multiline
          rows={6}
          error={!!errors.deliveryMessage}
          helperText={errors.deliveryMessage || `${deliveryMessage.length} / 2,000 characters`}
          inputProps={{ maxLength: 2000 }}
          sx={{ mb: 3 }}
        />

        {/* Deliverable Images */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label 
              className="text-sm font-medium"
              style={{ color: '#1A1A1E' }}
            >
              Deliverable Images (Optional)
            </label>
            <span className="text-sm" style={{ color: '#6F7280' }}>
              {images.length} / 5 images
            </span>
          </div>

          <input
            type="file"
            id="deliverable-upload"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            onChange={handleImageSelect}
            style={{ display: 'none' }}
            disabled={images.length >= 5 || loading}
          />

          <label htmlFor="deliverable-upload">
            <Button
              component="span"
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              disabled={images.length >= 5 || loading}
              sx={{
                color: '#7C4DFF',
                borderColor: '#7C4DFF',
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#6B3FEE',
                  backgroundColor: '#F8F5FF'
                },
                mb: 1
              }}
            >
              Upload Images
            </Button>
          </label>

          <p className="text-sm mb-3" style={{ color: '#6F7280' }}>
            Upload images of your completed work (optional, max 5 images)
          </p>

          {/* Image Previews */}
          {images.length > 0 && (
            <div className="grid grid-cols-5 gap-3">
              {images.map((image, index) => (
                <div 
                  key={index}
                  className="relative aspect-square rounded-lg overflow-hidden border-2"
                  style={{ borderColor: image.uploaded ? '#36C170' : '#E5E7F0' }}
                >
                  <img
                    src={image.preview}
                    alt={`Deliverable ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {image.uploading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <CircularProgress size={24} sx={{ color: '#fff' }} />
                    </div>
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
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.8)'
                        }
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* External Links */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label 
              className="text-sm font-medium"
              style={{ color: '#1A1A1E' }}
            >
              External Links (Optional)
            </label>
            <span className="text-sm" style={{ color: '#6F7280' }}>
              {externalLinks.filter(l => l.trim()).length} / 5 links
            </span>
          </div>

          <p className="text-sm mb-3" style={{ color: '#6F7280' }}>
            Google Drive, Figma, GitHub links, etc.
          </p>

          <div className="space-y-2">
            {externalLinks.map((link, index) => (
              <div key={index} className="flex items-start gap-2">
                <TextField
                  value={link}
                  onChange={(e) => handleLinkChange(index, e.target.value)}
                  placeholder="https://drive.google.com/..."
                  fullWidth
                  error={!!errors[`link_${index}`]}
                  helperText={errors[`link_${index}`]}
                  InputProps={{
                    startAdornment: (
                      <LinkIcon sx={{ color: '#6F7280', mr: 1, fontSize: 20 }} />
                    )
                  }}
                  sx={{ flex: 1 }}
                />
                <IconButton
                  onClick={() => handleRemoveLink(index)}
                  disabled={loading || externalLinks.length === 1}
                  sx={{ 
                    mt: 0.5,
                    color: '#EF4444',
                    '&:disabled': { color: '#E5E7F0' }
                  }}
                >
                  <RemoveIcon />
                </IconButton>
              </div>
            ))}
          </div>

          {externalLinks.length < 5 && (
            <Button
              onClick={handleAddLink}
              startIcon={<AddIcon />}
              disabled={loading}
              sx={{
                color: '#7C4DFF',
                textTransform: 'none',
                mt: 2,
                '&:hover': {
                  backgroundColor: '#F8F5FF'
                }
              }}
            >
              Add Another Link
            </Button>
          )}
        </div>

        {/* Karma Preview */}
        <div 
          className="p-4 rounded-lg"
          style={{ backgroundColor: '#EEE7FF' }}
        >
          <h4 className="text-sm font-semibold mb-2" style={{ color: '#7C4DFF' }}>
            WHEN POSTER RELEASES PAYMENT, YOU'LL EARN:
          </h4>

          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <EmojiEventsIcon sx={{ color: '#7C4DFF', fontSize: 20 }} />
              <span className="text-lg font-bold" style={{ color: '#7C4DFF' }}>
                +{completionKarma.toLocaleString()} karma
              </span>
            </div>
          </div>

          <p className="text-xs" style={{ color: '#6F7280' }}>
            Note: You already earned karma for applying
          </p>
        </div>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button 
          onClick={onClose}
          disabled={loading}
          sx={{ 
            color: '#6F7280',
            textTransform: 'none',
            fontSize: '16px'
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || isUploading}
          variant="contained"
          sx={{
            backgroundColor: '#7C4DFF',
            color: '#fff',
            textTransform: 'none',
            fontSize: '16px',
            px: 4,
            '&:hover': {
              backgroundColor: '#6B3FEE'
            },
            '&:disabled': {
              backgroundColor: '#E5E7F0',
              color: '#A3A7B5'
            }
          }}
        >
          {loading ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1, color: '#fff' }} />
              {isUploading ? 'Uploading...' : 'Submitting...'}
            </>
          ) : (
            'Submit Work'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

