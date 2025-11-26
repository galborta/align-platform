'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  IconButton,
  Chip
} from '@mui/material'
import { applyToJob } from '@/lib/jobs'
import { supabase } from '@/lib/supabase'
import { calculateJobKarma, calculateJobCompletionKarma } from '@/lib/karma'
import { getWalletTokenData } from '@/lib/token-balance'
import { toast } from 'react-hot-toast'
import CloseIcon from '@mui/icons-material/Close'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteIcon from '@mui/icons-material/Delete'
import WorkIcon from '@mui/icons-material/Work'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'

interface JobApplicationModalProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  jobUsdValue: number
  tokenMint: string
  projectId: string
  walletAddress: string
  userKarma: number
  completedJobsCount: number
  assignmentMode: 'first_come' | 'review'
  jobStatus: string
  onApplicationSubmitted?: () => void
}

const TIME_OPTIONS = [
  { value: 'within_24_hours', label: 'Within 24 hours' },
  { value: '1_3_days', label: '1-3 days' },
  { value: '3_7_days', label: '3-7 days' },
  { value: '1_2_weeks', label: '1-2 weeks' },
  { value: '2_4_weeks', label: '2-4 weeks' },
  { value: 'custom', label: 'Custom' }
]

interface ImagePreview {
  file: File
  preview: string
  uploading: boolean
  uploaded: boolean
  url: string | null
}

export function JobApplicationModal({
  isOpen,
  onClose,
  jobId,
  jobUsdValue,
  tokenMint,
  projectId,
  walletAddress,
  userKarma,
  completedJobsCount,
  assignmentMode,
  jobStatus,
  onApplicationSubmitted
}: JobApplicationModalProps) {
  const [loading, setLoading] = useState(false)
  const [pitch, setPitch] = useState('')
  const [estimatedCompletion, setEstimatedCompletion] = useState('')
  const [customTime, setCustomTime] = useState('')
  const [images, setImages] = useState<ImagePreview[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tokenPercentage, setTokenPercentage] = useState<number>(0)
  const [immediateKarma, setImmediateKarma] = useState<number>(0)
  const [delayedKarma, setDelayedKarma] = useState<number>(0)

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetForm()
    }
  }, [isOpen])

  // Fetch token percentage and calculate karma
  useEffect(() => {
    if (isOpen && walletAddress && tokenMint) {
      fetchTokenPercentageAndCalculateKarma()
    }
  }, [isOpen, walletAddress, tokenMint])

  const resetForm = () => {
    setPitch('')
    setEstimatedCompletion('')
    setCustomTime('')
    setImages([])
    setErrors({})
  }

  const fetchTokenPercentageAndCalculateKarma = async () => {
    try {
      const tokenData = await getWalletTokenData(walletAddress, tokenMint)
      const percentage = tokenData?.percentage || 0
      setTokenPercentage(percentage)

      // Calculate immediate karma (25%)
      const immediate = calculateJobKarma('APPLY_TO_JOB', percentage, true)
      setImmediateKarma(immediate)

      // Calculate delayed karma (75% + completion bonus)
      const delayed = calculateJobKarma('APPLY_TO_JOB', percentage, false)
      const completionBonus = calculateJobCompletionKarma(jobUsdValue)
      setDelayedKarma(delayed + completionBonus)
    } catch (error) {
      console.error('Error calculating karma:', error)
      // Use default values if calculation fails
      setImmediateKarma(12) // ~50 * 1 * 0.25 for small holder
      setDelayedKarma(calculateJobCompletionKarma(jobUsdValue) + 37)
    }
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

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`)
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
        // Generate unique filename
        const fileExt = image.file.name.split('.').pop()
        const fileName = `${walletAddress}/${Date.now()}-${i}.${fileExt}`

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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Pitch validation
    if (!pitch.trim()) {
      newErrors.pitch = 'Pitch is required'
    } else if (pitch.length > 2000) {
      newErrors.pitch = 'Pitch must be 2000 characters or less'
    }

    // Estimated completion validation
    if (!estimatedCompletion) {
      newErrors.estimatedCompletion = 'Estimated completion time is required'
    } else if (estimatedCompletion === 'custom' && !customTime.trim()) {
      newErrors.customTime = 'Please specify your custom timeline'
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

      // Prepare estimated completion text
      const completionText = estimatedCompletion === 'custom'
        ? customTime
        : TIME_OPTIONS.find(opt => opt.value === estimatedCompletion)?.label || estimatedCompletion

      // Submit application
      const applicationData = await applyToJob({
        job_id: jobId,
        applicant_wallet: walletAddress,
        pitch: pitch.trim(),
        image_urls: imageUrls,
        estimated_completion: completionText
      })

      // TODO: Award karma via job-karma helper
      // await awardApplyToJobKarma(walletAddress, projectId, tokenMint)

      // AUTO-ASSIGNMENT FOR FIRST_COME MODE
      if (assignmentMode === 'first_come' && jobStatus === 'open') {
        try {
          const autoAssignResponse = await fetch(`/api/jobs/${jobId}/auto-assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              applicationId: applicationData.id,
              applicantWallet: walletAddress
            })
          })

          const autoAssignResult = await autoAssignResponse.json()

          if (autoAssignResult.success) {
            toast.success('🎉 Job automatically assigned to you! Start working 💪', {
              duration: 5000,
              style: {
                background: '#7C4DFF',
                color: '#fff',
              }
            })
            
            onClose()
            if (onApplicationSubmitted) {
              onApplicationSubmitted()
            }
            return
          }
        } catch (autoAssignError) {
          console.error('Auto-assign failed:', autoAssignError)
          // Continue with normal flow if auto-assign fails
        }
      }

      // Normal success flow for review mode
      toast.success(`Application submitted! +${immediateKarma} karma earned 🎉`, {
        duration: 4000,
        style: {
          background: '#36C170',
          color: '#fff',
        }
      })

      // Close modal and refresh
      onClose()
      if (onApplicationSubmitted) {
        onApplicationSubmitted()
      }
    } catch (error) {
      console.error('Error submitting application:', error)
      toast.error('Failed to submit application. Please try again.')
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
        Apply for This Job
        <IconButton 
          onClick={onClose}
          disabled={loading}
          sx={{ color: '#6F7280' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Warning for Assigned Jobs */}
        {jobStatus === 'assigned' && (
          <Alert 
            severity="warning" 
            sx={{ 
              mb: 3,
              backgroundColor: '#FFF4E6',
              color: '#1A1A1E',
              '& .MuiAlert-icon': {
                color: '#FB923C'
              }
            }}
          >
            <strong>⚠️ Job Already Assigned:</strong> This job currently has a worker. You're applying as a backup. If the current worker doesn't deliver, the poster can reassign the job to you.
          </Alert>
        )}

        {/* Pitch */}
        <TextField
          label="Your Pitch"
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          placeholder="Explain why you're the right person for this job. Show relevant experience."
          fullWidth
          required
          multiline
          rows={6}
          error={!!errors.pitch}
          helperText={errors.pitch || `${pitch.length} / 2,000 characters`}
          inputProps={{ maxLength: 2000 }}
          sx={{ mb: 3 }}
        />

        {/* Portfolio Images */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label 
              className="text-sm font-medium"
              style={{ color: '#1A1A1E' }}
            >
              Portfolio Images (Optional)
            </label>
            <span className="text-sm" style={{ color: '#6F7280' }}>
              {images.length} / 5 images
            </span>
          </div>

          <input
            type="file"
            id="image-upload"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            onChange={handleImageSelect}
            style={{ display: 'none' }}
            disabled={images.length >= 5 || loading}
          />

          <label htmlFor="image-upload">
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
            Upload examples of your past work (optional, max 5 images)
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
                    alt={`Preview ${index + 1}`}
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

        {/* Estimated Completion */}
        <FormControl fullWidth required error={!!errors.estimatedCompletion} sx={{ mb: 3 }}>
          <InputLabel>Estimated Completion Time</InputLabel>
          <Select
            value={estimatedCompletion}
            label="Estimated Completion Time"
            onChange={(e) => setEstimatedCompletion(e.target.value)}
          >
            {TIME_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          {errors.estimatedCompletion && (
            <Alert severity="error" sx={{ mt: 1 }}>{errors.estimatedCompletion}</Alert>
          )}
        </FormControl>

        {/* Custom Time Input */}
        {estimatedCompletion === 'custom' && (
          <TextField
            label="Custom Timeline"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            placeholder="e.g., 6 weeks, 3 months"
            fullWidth
            required
            error={!!errors.customTime}
            helperText={errors.customTime}
            sx={{ mb: 3 }}
          />
        )}

        {/* Your Profile Section */}
        <div 
          className="p-4 rounded-lg mb-4"
          style={{ backgroundColor: '#F8F9FC' }}
        >
          <h4 className="text-sm font-semibold mb-3" style={{ color: '#6F7280' }}>
            YOUR PROFILE
          </h4>

          <div className="flex flex-wrap gap-2 mb-3">
            {completedJobsCount > 0 && (
              <Chip
                icon={<WorkIcon sx={{ fontSize: 16 }} />}
                label={`Builder (${completedJobsCount} jobs completed)`}
                sx={{
                  backgroundColor: '#E8F4FF',
                  color: '#2563EB',
                  fontWeight: 600,
                  fontSize: '13px'
                }}
              />
            )}
            <Chip
              icon={<EmojiEventsIcon sx={{ fontSize: 16 }} />}
              label={`${userKarma.toLocaleString()} karma points`}
              sx={{
                backgroundColor: '#FFF4E6',
                color: '#FB923C',
                fontWeight: 600,
                fontSize: '13px'
              }}
            />
          </div>

          <p className="text-xs" style={{ color: '#A3A7B5' }}>
            Visible to the job poster
          </p>
        </div>

        {/* Karma Rewards */}
        <div 
          className="p-4 rounded-lg"
          style={{ backgroundColor: '#EEE7FF' }}
        >
          <h4 className="text-sm font-semibold mb-2" style={{ color: '#7C4DFF' }}>
            YOU'LL EARN:
          </h4>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: '#36C170' }}>
                Immediate (now)
              </span>
              <span className="text-sm font-bold" style={{ color: '#36C170' }}>
                +{immediateKarma} karma
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: '#7C4DFF' }}>
                On completion
              </span>
              <span className="text-sm font-bold" style={{ color: '#7C4DFF' }}>
                +{delayedKarma.toLocaleString()} karma
              </span>
            </div>
          </div>
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
            'Submit Application'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  )
}


