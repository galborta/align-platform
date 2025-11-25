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
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Alert,
  CircularProgress,
  InputAdornment,
  Checkbox
} from '@mui/material'
import { createJob } from '@/lib/jobs'
import { supabase } from '@/lib/supabase'
import { getTokenPriceUsd, validateMinimumUsdValue } from '@/lib/helius'
import { toast } from 'react-hot-toast'
import WarningIcon from '@mui/icons-material/Warning'

interface CreateJobModalProps {
  isOpen: boolean
  onClose: () => void
  mode?: 'create' | 'edit'
  existingJob?: any // Job type from database
  projectId: string
  tokenMint: string
  tokenSymbol: string
  walletAddress: string
  onJobCreated?: () => void
}

const CATEGORIES = [
  { value: 'design', label: 'Design' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'development', label: 'Development' },
  { value: 'content', label: 'Content' },
  { value: 'community', label: 'Community' },
  { value: 'other', label: 'Other' }
]

export function CreateJobModal({
  isOpen,
  onClose,
  mode = 'create',
  existingJob,
  projectId,
  tokenMint,
  tokenSymbol,
  walletAddress,
  onJobCreated
}: CreateJobModalProps) {
  const [loading, setLoading] = useState(false)
  const [checkingPrice, setCheckingPrice] = useState(false)
  const [applicationCount, setApplicationCount] = useState(0)
  const [understoodInvalidation, setUnderstoodInvalidation] = useState(false)
  
  // Form fields
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [kpis, setKpis] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [assignmentMode, setAssignmentMode] = useState<'first_come' | 'review'>('review')
  
  // Validation states
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [usdValue, setUsdValue] = useState<number | null>(null)
  const [tokenPrice, setTokenPrice] = useState<number | null>(null)
  const [priceError, setPriceError] = useState(false)

  // Reset form when modal closes or populate when editing
  useEffect(() => {
    if (!isOpen) {
      resetForm()
    } else if (mode === 'edit' && existingJob) {
      // Populate fields with existing job data
      setTitle(existingJob.title || '')
      setCategory(existingJob.category || '')
      setDescription(existingJob.description || '')
      setKpis(existingJob.kpis || '')
      setPaymentAmount(existingJob.payment_amount_tokens?.toString() || '')
      setAssignmentMode(existingJob.assignment_mode || 'review')
      setUsdValue(existingJob.payment_amount_usd || 0)
      
      // Fetch application count
      fetchApplicationCount(existingJob.id)
    }
  }, [isOpen, mode, existingJob])

  const fetchApplicationCount = async (jobId: string) => {
    try {
      const { count, error } = await supabase
        .from('job_applications')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('is_invalidated', false)

      if (error) throw error
      setApplicationCount(count || 0)
    } catch (error) {
      console.error('Error fetching application count:', error)
    }
  }

  // Check USD value when payment amount changes
  useEffect(() => {
    const amount = parseFloat(paymentAmount)
    if (paymentAmount && !isNaN(amount) && amount > 0) {
      checkUsdValue(amount)
    } else {
      setUsdValue(null)
      setPriceError(false)
    }
  }, [paymentAmount, tokenMint])

  const resetForm = () => {
    setTitle('')
    setCategory('')
    setDescription('')
    setKpis('')
    setPaymentAmount('')
    setAssignmentMode('review')
    setErrors({})
    setUsdValue(null)
    setTokenPrice(null)
    setPriceError(false)
    setApplicationCount(0)
    setUnderstoodInvalidation(false)
  }

  const checkUsdValue = async (amount: number) => {
    setCheckingPrice(true)
    setPriceError(false)
    
    try {
      // Get token price
      const price = await getTokenPriceUsd(tokenMint)
      setTokenPrice(price)
      
      if (price === null) {
        setPriceError(true)
        setUsdValue(null)
      } else {
        const usd = amount * price
        setUsdValue(usd)
      }
    } catch (error) {
      console.error('Error checking USD value:', error)
      setPriceError(true)
      setUsdValue(null)
    } finally {
      setCheckingPrice(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Title validation
    if (!title.trim()) {
      newErrors.title = 'Title is required'
    } else if (title.length > 200) {
      newErrors.title = 'Title must be 200 characters or less'
    }

    // Category validation
    if (!category) {
      newErrors.category = 'Category is required'
    }

    // Description validation
    if (!description.trim()) {
      newErrors.description = 'Description is required'
    } else if (description.length > 5000) {
      newErrors.description = 'Description must be 5000 characters or less'
    }

    // KPIs validation
    if (!kpis.trim()) {
      newErrors.kpis = 'Success criteria are required'
    } else if (kpis.length > 2000) {
      newErrors.kpis = 'Success criteria must be 2000 characters or less'
    }

    // Payment validation
    const amount = parseFloat(paymentAmount)
    if (!paymentAmount || isNaN(amount) || amount < 1) {
      newErrors.paymentAmount = 'Payment amount must be at least 1 token'
    } else if (usdValue !== null && usdValue < 5) {
      newErrors.paymentAmount = 'Payment must be at least $5 USD'
    } else if (priceError || usdValue === null) {
      newErrors.paymentAmount = 'Unable to verify USD value. Please try again.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting')
      return
    }

    // Check invalidation checkbox if applications exist
    if (mode === 'edit' && applicationCount > 0 && !understoodInvalidation) {
      toast.error('Please confirm you understand applications will be invalidated')
      return
    }

    setLoading(true)

    try {
      if (mode === 'edit' && existingJob) {
        // Update existing job
        const { error: updateError } = await supabase
          .from('jobs')
          .update({
            title: title.trim(),
            description: description.trim(),
            kpis: kpis.trim(),
            category,
            assignment_mode: assignmentMode,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingJob.id)

        if (updateError) throw updateError

        // Invalidate all existing applications if any
        if (applicationCount > 0) {
          const { error: invalidateError } = await supabase
            .from('job_applications')
            .update({
              is_invalidated: true,
              updated_at: new Date().toISOString()
            })
            .eq('job_id', existingJob.id)
            .eq('is_invalidated', false)

          if (invalidateError) throw invalidateError

          // TODO: Send notifications to applicants
          // await notifyApplicants(existingJob.id, 'job_edited')

          toast.success(`Job updated. ${applicationCount} application${applicationCount > 1 ? 's' : ''} invalidated.`, {
            duration: 4000
          })
        } else {
          toast.success('Job updated successfully!', {
            duration: 4000,
            style: {
              background: '#7C4DFF',
              color: '#fff',
            }
          })
        }
      } else {
        // Create new job
        const amount = parseFloat(paymentAmount)
        
        // Final USD validation
        const validation = await validateMinimumUsdValue(tokenMint, amount, 5)
        
        if (!validation.valid) {
          toast.error('Payment must be at least $5 USD')
          setLoading(false)
          return
        }

        // Create the job
        await createJob({
          project_id: projectId,
          poster_wallet: walletAddress,
          title: title.trim(),
          description: description.trim(),
          kpis: kpis.trim(),
          category,
          payment_amount_tokens: amount,
          payment_amount_usd: validation.usdValue || 0,
          assignment_mode: assignmentMode
        })

        toast.success('Job posted! 🎉 You earned +50 karma', {
          duration: 4000,
          style: {
            background: '#36C170',
            color: '#fff',
          }
        })
      }

      // Close modal and refresh
      onClose()
      if (onJobCreated) {
        onJobCreated()
      }
    } catch (error) {
      console.error(`Error ${mode === 'edit' ? 'updating' : 'creating'} job:`, error)
      toast.error(`Failed to ${mode === 'edit' ? 'update' : 'create'} job. Please try again.`)
    } finally {
      setLoading(false)
    }
  }

  const belowMinimum = usdValue !== null && usdValue < 5

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
        color: '#1A1A1E'
      }}>
        {mode === 'edit' ? 'Edit Job' : 'Post a Job'}
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Warning for editing with applications */}
        {mode === 'edit' && applicationCount > 0 && (
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
            <strong>⚠️ Warning:</strong> Editing this job will INVALIDATE all existing applications.
            <br />
            <strong>{applicationCount} application{applicationCount > 1 ? 's' : ''} will need to reapply.</strong>
          </Alert>
        )}
        {/* Title */}
        <TextField
          label="Job Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Design new logo for ${tokenSymbol}`}
          fullWidth
          required
          error={!!errors.title}
          helperText={errors.title || `${title.length}/200 characters`}
          inputProps={{ maxLength: 200 }}
          sx={{ mb: 3 }}
        />

        {/* Category */}
        <FormControl fullWidth required error={!!errors.category} sx={{ mb: 3 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={category}
            label="Category"
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((cat) => (
              <MenuItem key={cat.value} value={cat.value}>
                {cat.label}
              </MenuItem>
            ))}
          </Select>
          {errors.category && (
            <Alert severity="error" sx={{ mt: 1 }}>{errors.category}</Alert>
          )}
        </FormControl>

        {/* Description */}
        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what you need in detail..."
          fullWidth
          required
          multiline
          rows={8}
          error={!!errors.description}
          helperText={errors.description || `${description.length}/5000 characters`}
          inputProps={{ maxLength: 5000 }}
          sx={{ mb: 3 }}
        />

        {/* KPIs / Success Criteria */}
        <TextField
          label="Success Criteria / KPIs"
          value={kpis}
          onChange={(e) => setKpis(e.target.value)}
          placeholder={`How will you judge if the work is complete?\nExample:\n- Must include brand colors\n- Delivered in SVG format\n- 3 variations`}
          fullWidth
          required
          multiline
          rows={4}
          error={!!errors.kpis}
          helperText={errors.kpis || `${kpis.length}/2000 characters`}
          inputProps={{ maxLength: 2000 }}
          sx={{ mb: 3 }}
        />

        {/* Payment Amount */}
        <TextField
          label="Payment Amount"
          value={paymentAmount}
          onChange={(e) => {
            const value = e.target.value
            // Only allow numbers and decimal point
            if (value === '' || /^\d*\.?\d*$/.test(value)) {
              setPaymentAmount(value)
            }
          }}
          placeholder="500"
          fullWidth
          required
          type="text"
          disabled={mode === 'edit'}
          error={!!errors.paymentAmount}
          helperText={mode === 'edit' ? 'Payment amount cannot be changed after posting' : errors.paymentAmount}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <span style={{ fontWeight: 600, color: '#7C4DFF' }}>
                  {tokenSymbol}
                </span>
              </InputAdornment>
            )
          }}
          sx={{ mb: 1 }}
        />

        {/* USD Conversion Display */}
        {checkingPrice && (
          <div className="flex items-center gap-2 mb-3" style={{ color: '#6F7280' }}>
            <CircularProgress size={16} sx={{ color: '#7C4DFF' }} />
            <span className="text-sm">Checking USD value...</span>
          </div>
        )}

        {!checkingPrice && usdValue !== null && !belowMinimum && (
          <div className="mb-3" style={{ color: '#36C170' }}>
            <span className="text-sm font-medium">
              ≈ ${usdValue.toFixed(2)} USD
            </span>
          </div>
        )}

        {!checkingPrice && belowMinimum && (
          <Alert 
            severity="warning" 
            icon={<WarningIcon />}
            sx={{ mb: 3 }}
          >
            <strong>Minimum $5 USD required</strong>
            <br />
            Current value: ${usdValue?.toFixed(2)} USD
          </Alert>
        )}

        {!checkingPrice && priceError && paymentAmount && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Unable to fetch token price. Please try again or contact support.
          </Alert>
        )}

        {/* Assignment Mode */}
        <FormControl component="fieldset" sx={{ mb: 2 }}>
          <FormLabel 
            component="legend"
            sx={{ 
              color: '#1A1A1E',
              fontWeight: 600,
              mb: 1
            }}
          >
            Assignment Mode
          </FormLabel>
          <RadioGroup
            value={assignmentMode}
            onChange={(e) => setAssignmentMode(e.target.value as 'first_come' | 'review')}
          >
            <FormControlLabel
              value="review"
              control={<Radio sx={{ color: '#7C4DFF', '&.Mui-checked': { color: '#7C4DFF' } }} />}
              label={
                <div>
                  <div style={{ fontWeight: 500, color: '#1A1A1E' }}>
                    Review Applications (Recommended)
                  </div>
                  <div style={{ fontSize: '14px', color: '#6F7280' }}>
                    Review all applications and choose the best candidate. Token holders can upvote applications.
                  </div>
                </div>
              }
            />
            <FormControlLabel
              value="first_come"
              control={<Radio sx={{ color: '#7C4DFF', '&.Mui-checked': { color: '#7C4DFF' } }} />}
              label={
                <div>
                  <div style={{ fontWeight: 500, color: '#1A1A1E' }}>
                    First Come, First Served
                  </div>
                  <div style={{ fontSize: '14px', color: '#6F7280' }}>
                    First person to apply gets the job immediately. Faster but less control.
                  </div>
                </div>
              }
            />
          </RadioGroup>
        </FormControl>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, flexDirection: 'column', alignItems: 'stretch' }}>
        {/* Invalidation Checkbox (only show in edit mode with applications) */}
        {mode === 'edit' && applicationCount > 0 && (
          <FormControlLabel
            control={
              <Checkbox
                checked={understoodInvalidation}
                onChange={(e) => setUnderstoodInvalidation(e.target.checked)}
                sx={{
                  color: '#FB923C',
                  '&.Mui-checked': {
                    color: '#FB923C'
                  }
                }}
              />
            }
            label={
              <span style={{ fontSize: '14px', color: '#1A1A1E' }}>
                I understand that <strong>{applicationCount} application{applicationCount > 1 ? 's' : ''} will be invalidated</strong> and applicants must reapply
              </span>
            }
            sx={{ mb: 2, alignSelf: 'flex-start' }}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
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
            disabled={
              loading || 
              (mode === 'create' && (checkingPrice || belowMinimum || priceError)) ||
              (mode === 'edit' && applicationCount > 0 && !understoodInvalidation)
            }
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
                {mode === 'edit' ? 'Updating...' : 'Posting...'}
              </>
            ) : (
              mode === 'edit' ? 'Update Job' : 'Post Job'
            )}
          </Button>
        </div>
      </DialogActions>
    </Dialog>
  )
}


