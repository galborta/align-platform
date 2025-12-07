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
  Chip,
  Box,
  Typography,
  Tooltip
} from '@mui/material'
// Date picker no longer needed - using simple days input
import { applyToJob } from '@/lib/jobs'
import { supabase } from '@/lib/supabase'
import { calculateJobKarma, calculateJobCompletionKarma } from '@/lib/karma'
import { getWalletTokenData } from '@/lib/token-balance'
import { toast } from 'react-hot-toast'
import { addDays, format } from 'date-fns'
import CloseIcon from '@mui/icons-material/Close'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteIcon from '@mui/icons-material/Delete'
import WorkIcon from '@mui/icons-material/Work'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import InfoIcon from '@mui/icons-material/Info'
import { Database } from '@/types/database'
import { RevisionSelector } from '@/components/jobs/RevisionSelector'

type Job = Database['public']['Tables']['jobs']['Row']

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
  job?: Job | null
  onApplicationSubmitted?: () => void
}

// Quick select options for days needed
const DAYS_OPTIONS = [3, 5, 7, 14, 21, 30]

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
  job,
  onApplicationSubmitted
}: JobApplicationModalProps) {
  const [loading, setLoading] = useState(false)
  const [pitch, setPitch] = useState('')
  const [daysNeeded, setDaysNeeded] = useState<number | null>(null)
  const [customDays, setCustomDays] = useState('')
  const [images, setImages] = useState<ImagePreview[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tokenPercentage, setTokenPercentage] = useState<number>(0)
  const [immediateKarma, setImmediateKarma] = useState<number>(0)
  const [delayedKarma, setDelayedKarma] = useState<number>(0)
  
  // Revision offering state
  const [revisionsOffered, setRevisionsOffered] = useState<string | null>(null)

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
    setDaysNeeded(null)
    setCustomDays('')
    setImages([])
    setErrors({})
    setRevisionsOffered(null)
  }

  // Calculate committed deadline from days needed
  const effectiveDays = daysNeeded || (customDays ? parseInt(customDays, 10) : null)
  const committedDeadline = effectiveDays && !isNaN(effectiveDays) ? addDays(new Date(), effectiveDays) : null

  // Validate days needed
  const validateDaysNeeded = (): string | null => {
    if (!daysNeeded && !customDays) {
      return 'Please select or enter how many days you need'
    }
    
    const days = daysNeeded || parseInt(customDays, 10)
    
    if (isNaN(days) || days < 1) {
      return 'Days must be at least 1'
    }
    
    if (days > 90) {
      return 'Days cannot exceed 90'
    }
    
    return null
  }

  // Calculate deadline bonus karma
  const getDeadlineBonus = (days: number): number => {
    // Faster delivery = bonus karma
    if (days <= 3) return 20 // +20% for 3-day delivery
    if (days <= 7) return 10 // +10% for 1-week delivery
    return 0
  }

  // Update karma calculation when days needed changes
  useEffect(() => {
    const days = daysNeeded || (customDays ? parseInt(customDays, 10) : null)
    if (days && tokenPercentage) {
      const bonusPercent = getDeadlineBonus(days)
      
      // Recalculate with bonus
      const baseImmediate = calculateJobKarma('APPLY_TO_JOB', tokenPercentage, true)
      const baseDelayed = calculateJobKarma('APPLY_TO_JOB', tokenPercentage, false)
      const completionBonus = calculateJobCompletionKarma(jobUsdValue)
      
      setImmediateKarma(Math.round(baseImmediate * (1 + bonusPercent / 100)))
      setDelayedKarma(Math.round((baseDelayed + completionBonus) * (1 + bonusPercent / 100)))
    }
  }, [daysNeeded, customDays, tokenPercentage, jobUsdValue])

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

    // Days needed validation
    const daysError = validateDaysNeeded()
    if (daysError) {
      newErrors.daysNeeded = daysError
    }

    // Revisions validation
    if (!revisionsOffered) {
      newErrors.revisions = 'Please select how many revisions you\'re offering'
    } else if (revisionsOffered !== 'unlimited') {
      const parsed = parseInt(revisionsOffered, 10)
      if (isNaN(parsed) || parsed < 0) {
        newErrors.revisions = 'Revisions must be a valid positive number or "unlimited"'
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

      // Calculate days and deadline
      const days = daysNeeded || parseInt(customDays, 10)
      const deadline = addDays(new Date(), days)
      const completionText = `${days} day${days !== 1 ? 's' : ''}`

      // Submit application with deadline commitment and revision offering
      const applicationData = await applyToJob({
        job_id: jobId,
        applicant_wallet: walletAddress,
        pitch: pitch.trim(),
        image_urls: imageUrls,
        estimated_completion: completionText,
        committed_completion_date: deadline.toISOString(),
        revisions_offered: revisionsOffered
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

        {/* Days Needed */}
        <Box sx={{ mb: 3 }}>
          <Typography 
            variant="subtitle2" 
            sx={{ 
              mb: 1.5, 
              fontWeight: 600,
              color: '#1A1A1E',
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'var(--font-display), Space Grotesk, sans-serif'
            }}
          >
            How many days do you need? *
            <Tooltip 
              title="This becomes your HARD deadline. You MUST deliver by this date."
              arrow
              placement="top"
            >
              <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color: '#7C4DFF', cursor: 'help' }} />
            </Tooltip>
          </Typography>

          {/* Quick Select Buttons */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {DAYS_OPTIONS.map((days) => (
              <Button
                key={days}
                variant={daysNeeded === days ? 'contained' : 'outlined'}
                onClick={() => {
                  setDaysNeeded(days)
                  setCustomDays('')
                }}
                sx={{
                  minWidth: '70px',
                  backgroundColor: daysNeeded === days ? '#7C4DFF' : 'transparent',
                  color: daysNeeded === days ? '#fff' : '#7C4DFF',
                  borderColor: '#7C4DFF',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: daysNeeded === days ? '#6B3FEE' : '#F8F5FF',
                    borderColor: '#7C4DFF'
                  }
                }}
              >
                {days} {days === 1 ? 'day' : 'days'}
              </Button>
            ))}
          </Box>

          {/* Custom Days Input */}
          <TextField
            label="Or enter custom days"
            type="number"
            value={customDays}
            onChange={(e) => {
              setCustomDays(e.target.value)
              setDaysNeeded(null)
            }}
            placeholder="e.g., 45"
            fullWidth
            inputProps={{ min: 1, max: 90 }}
            error={!!errors.daysNeeded}
            helperText={errors.daysNeeded || 'Enter 1-90 days'}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': {
                  borderColor: '#7C4DFF',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#7C4DFF',
                }
              }
            }}
          />

          {/* Show calculated deadline */}
          {committedDeadline && (
            <Box 
              sx={{ 
                mt: 2, 
                p: 2, 
                borderRadius: '8px',
                backgroundColor: '#F8F5FF',
                border: '1px solid #E8E0FF'
              }}
            >
              <Typography variant="body2" sx={{ color: '#6F7280', mb: 0.5 }}>
                Your deadline will be:
              </Typography>
              <Typography 
                variant="h6" 
                sx={{ 
                  color: '#7C4DFF', 
                  fontWeight: 700,
                  fontFamily: 'var(--font-display), Space Grotesk, sans-serif'
                }}
              >
                {format(committedDeadline, 'EEEE, MMMM dd, yyyy')}
              </Typography>
            </Box>
          )}
          
          {/* Show poster's desired deadline if available */}
          {job?.poster_desired_completion && (
            <Alert 
              severity="info" 
              sx={{ 
                mt: 1.5,
                backgroundColor: '#E8F4FF',
                color: '#1A1A1E',
                '& .MuiAlert-icon': {
                  color: '#2563EB'
                }
              }}
            >
              <strong>Poster's desired completion:</strong>{' '}
              {format(new Date(job.poster_desired_completion), 'MMM dd, yyyy')}
            </Alert>
          )}

          {/* Show deadline bonus if applicable */}
          {committedDeadline && (() => {
            const days = daysNeeded || parseInt(customDays, 10)
            const bonusPercent = getDeadlineBonus(days)
            return bonusPercent > 0 ? (
              <Alert 
                severity="success" 
                sx={{ 
                  mt: 1.5,
                  backgroundColor: '#E8F9F1',
                  color: '#1A1A1E',
                  '& .MuiAlert-icon': {
                    color: '#36C170'
                  }
                }}
              >
                <strong>🎉 Fast delivery bonus:</strong> +{bonusPercent}% karma for {days}-day completion!
              </Alert>
            ) : null
          })()}
        </Box>

        {/* Deadline Warning */}
        {committedDeadline && (
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
            <AlertTitle sx={{ fontWeight: 700, color: '#1A1A1E' }}>
              ⚠️ Deadline Commitment
            </AlertTitle>
            By submitting, you commit to delivering work by{' '}
            <strong style={{ color: '#FB923C' }}>
              {format(committedDeadline, 'MMM dd, yyyy')}
            </strong>
            . Missing this deadline without submission will result in:
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>Job cancellation with full refund to poster</li>
              <li>Karma penalty for ghosting (-100 karma)</li>
              <li>Failure record on your profile</li>
            </ul>
          </Alert>
        )}

        {/* Revision Selector */}
        <RevisionSelector
          value={revisionsOffered}
          onChange={setRevisionsOffered}
          error={errors.revisions}
          disabled={loading}
        />

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
            
            {/* Show deadline bonus indicator */}
            {(daysNeeded || customDays) && (() => {
              const days = daysNeeded || parseInt(customDays, 10)
              if (isNaN(days)) return null
              const bonusPercent = getDeadlineBonus(days)
              return bonusPercent > 0 ? (
                <div 
                  className="mt-2 pt-2 border-t"
                  style={{ borderColor: 'rgba(124, 77, 255, 0.2)' }}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium" style={{ color: '#7C4DFF' }}>
                      🚀 Fast delivery bonus applied: +{bonusPercent}%
                    </span>
                  </div>
                </div>
              ) : null
            })()}
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


