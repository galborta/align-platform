'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { BackgroundShapes } from '@/components/BackgroundShapes'
import SubmissionSuccessModal from '@/components/SubmissionSuccessModal'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import InputAdornment from '@mui/material/InputAdornment'
import CircularProgress from '@mui/material/CircularProgress'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { 
  validateSolanaAddress, 
  fetchTokenMetadata, 
  type TokenMetadata 
} from '@/lib/token-validation'

const ROLE_OPTIONS = [
  'Founder',
  'Team Member',
  'Community Member',
  'Investor',
  'Other'
] as const

type Role = typeof ROLE_OPTIONS[number]

export default function SubmitProjectPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    contractAddress: '',
    role: '' as Role | '',
    message: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  
  // Token validation state
  const [tokenData, setTokenData] = useState<TokenMetadata | null>(null)
  const [isValidatingToken, setIsValidatingToken] = useState(false)
  const [tokenValidationError, setTokenValidationError] = useState<string | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Duplicate checking state
  const [isDuplicateChecking, setIsDuplicateChecking] = useState(false)
  const [duplicateCheckResult, setDuplicateCheckResult] = useState<{
    isDuplicate: boolean
    reason?: 'existing_project' | 'pending_submission' | 'approved_submission'
    projectId?: string
    submissionId?: string
    message?: string
  } | null>(null)

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Helper functions for visual feedback
  const isFieldValid = (field: keyof typeof formData) => {
    if (field === 'name') {
      return formData.name.trim().length > 0 && formData.name.length <= 100
    }
    if (field === 'email') {
      return formData.email.trim().length > 0 && validateEmail(formData.email)
    }
    if (field === 'contractAddress') {
      return formData.contractAddress.trim().length > 0
    }
    if (field === 'role') {
      return formData.role !== ''
    }
    return false
  }

  const isFieldTouched = (field: keyof typeof formData) => {
    return formData[field].length > 0
  }

  const getFieldIcon = (field: keyof typeof formData, isRequired: boolean = true) => {
    if (!isRequired && formData[field].length === 0) {
      return null
    }
    
    if (errors[field] && isFieldTouched(field)) {
      return (
        <InputAdornment position="end">
          <ErrorOutlineIcon sx={{ color: '#EF4444' }} />
        </InputAdornment>
      )
    }
    
    if (isRequired && isFieldValid(field) && isFieldTouched(field)) {
      return (
        <InputAdornment position="end">
          <CheckCircleIcon sx={{ color: 'var(--accent-success)' }} />
        </InputAdornment>
      )
    }
    
    return null
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
    
    // Clear token validation state when contract address changes
    if (field === 'contractAddress') {
      setTokenData(null)
      setTokenValidationError(null)
      setDuplicateCheckResult(null)
      
      // Debounced validation (wait 500ms after last keystroke)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      
      if (value.trim().length > 0) {
        debounceTimerRef.current = setTimeout(() => {
          validateContractAddress(value.trim())
        }, 500)
      }
    }
  }
  
  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])
  
  // Token validation function with duplicate checking
  const validateContractAddress = async (address: string) => {
    // Set loading state
    setIsValidatingToken(true)
    setTokenValidationError(null)
    setTokenData(null)
    setDuplicateCheckResult(null)
    
    // Validate format first
    if (!validateSolanaAddress(address)) {
      setTokenValidationError('Invalid Solana address format')
      setIsValidatingToken(false)
      return
    }
    
    // Fetch token metadata
    const metadata = await fetchTokenMetadata(address)
    
    if (!metadata) {
      setTokenValidationError('Token not found. Please verify the contract address.')
      setIsValidatingToken(false)
      return
    }
    
    // Token validation succeeded, now check for duplicates
    setIsValidatingToken(false)
    setIsDuplicateChecking(true)
    
    try {
      const duplicateResponse = await fetch('/api/submissions/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress: address })
      })
      
      if (!duplicateResponse.ok) {
        console.error('Duplicate check failed:', duplicateResponse.statusText)
        setTokenValidationError('Failed to check for duplicates. Please try again.')
        setIsDuplicateChecking(false)
        return
      }
      
      const duplicateData = await duplicateResponse.json()
      setDuplicateCheckResult(duplicateData)
      setIsDuplicateChecking(false)
      
      if (duplicateData.isDuplicate) {
        // Show appropriate error message based on reason
        if (duplicateData.reason === 'existing_project') {
          setTokenValidationError('This project already exists on Orggly. Visit the project page to see it.')
        } else if (duplicateData.reason === 'pending_submission') {
          setTokenValidationError('A submission for this project is already pending review.')
        } else if (duplicateData.reason === 'approved_submission') {
          setTokenValidationError('This project has been approved and is being set up.')
        }
        
        // Clear token data to prevent submission
        setTokenData(null)
      } else {
        // Success - no duplicates found, store token data
        setTokenData(metadata)
      }
    } catch (error) {
      console.error('Duplicate check error:', error)
      setTokenValidationError('Failed to check for duplicates. Please try again.')
      setIsDuplicateChecking(false)
    }
  }
  
  // Handle blur event for immediate validation
  const handleContractAddressBlur = () => {
    const address = formData.contractAddress.trim()
    if (address.length > 0 && !tokenData && !isValidatingToken && !isDuplicateChecking) {
      // Clear debounce timer and validate immediately
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      validateContractAddress(address)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    } else if (formData.name.length > 100) {
      newErrors.name = 'Name must be less than 100 characters'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.contractAddress.trim()) {
      newErrors.contractAddress = 'Contract address is required'
    } else if (tokenValidationError) {
      newErrors.contractAddress = tokenValidationError
    } else if (!tokenData) {
      newErrors.contractAddress = 'Please wait for token validation to complete'
    }

    if (!formData.role) {
      newErrors.role = 'Please select your role'
    }

    if (formData.message.length > 500) {
      newErrors.message = 'Message must be less than 500 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Clear previous errors
    setErrors({})

    // Run validation
    if (!validateForm()) {
      return
    }

    // Check we have valid token data
    if (!tokenData) {
      setErrors({ contractAddress: 'Please enter a valid token contract address' })
      return
    }

    // Check not a duplicate
    if (duplicateCheckResult?.isDuplicate) {
      setErrors({ contractAddress: 'This project cannot be submitted' })
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/submissions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          contractAddress: formData.contractAddress.trim(),
          tokenSymbol: tokenData.symbol,
          tokenName: tokenData.name,
          role: formData.role,
          message: formData.message.trim() || undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 409) {
          setErrors({ contractAddress: data.details || 'This project has already been submitted' })
        } else if (response.status === 429) {
          setErrors({ general: data.details || 'Too many submission attempts. Please try again later.' })
        } else {
          setErrors({ general: data.details || data.error || 'Failed to submit application. Please try again.' })
        }
        setSubmitting(false)
        return
      }

      console.log('Submission successful:', data)
      
      // Stop submitting state BEFORE showing modal
      setSubmitting(false)
      
      // Show success modal
      setShowSuccessModal(true)

    } catch (error) {
      console.error('Submission error:', error)
      setErrors({ 
        general: error instanceof Error ? error.message : 'Failed to submit application. Please try again.' 
      })
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Success Modal */}
      <SubmissionSuccessModal 
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
      />

      {/* Main Form */}
    <div className="page-wrapper">
      <BackgroundShapes />
      
      <main className="relative z-10">
        <div className="submit-container">
          {/* Logo */}
          <div className="logo-container">
            <Link href="/" className="logo-link">
              <h1 className="logo-text">ORggly</h1>
            </Link>
          </div>

          {/* Header */}
          <div className="header-section">
            <h1 className="text-title">Submit Your Project</h1>
            <p className="text-body">
              Join the ORggly community. We'll review your application and get back to you within 48 hours.
            </p>
          </div>

          {/* Form Card */}
          <div className="form-card">
            <form onSubmit={handleSubmit}>
              {/* General Error Display */}
              {errors.general && (
                <div className="general-error">
                  <ErrorOutlineIcon className="error-icon" />
                  <div className="error-content">
                    <p className="error-message">{errors.general}</p>
                    <button 
                      type="button"
                      onClick={() => setErrors(prev => ({ ...prev, general: undefined }))}
                      className="error-dismiss"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {/* Name Field */}
              <TextField
                label="Your Name"
                placeholder="Enter your name"
                fullWidth
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                error={!!errors.name}
                helperText={errors.name}
                inputProps={{ maxLength: 100 }}
                InputProps={{
                  endAdornment: getFieldIcon('name', true)
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'var(--font-body)',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    '& fieldset': {
                      borderColor: 'var(--border-subtle)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'var(--accent-primary)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'var(--accent-primary)',
                      borderWidth: '2px',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    fontFamily: 'var(--font-body)',
                    color: 'var(--text-secondary)',
                    '&.Mui-focused': {
                      color: 'var(--accent-primary)',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: 'var(--text-primary)',
                  },
                }}
              />

              {/* Email Field */}
              <TextField
                label="Your Email"
                type="email"
                placeholder="your@email.com"
                fullWidth
                required
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                error={!!errors.email}
                helperText={errors.email}
                InputProps={{
                  endAdornment: getFieldIcon('email', true)
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'var(--font-body)',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    '& fieldset': {
                      borderColor: 'var(--border-subtle)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'var(--accent-primary)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'var(--accent-primary)',
                      borderWidth: '2px',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    fontFamily: 'var(--font-body)',
                    color: 'var(--text-secondary)',
                    '&.Mui-focused': {
                      color: 'var(--accent-primary)',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: 'var(--text-primary)',
                  },
                }}
              />

              {/* Contract Address Field */}
              <div className="contract-field-wrapper">
                <TextField
                  label="Token Contract Address"
                  placeholder="Solana address (e.g., EPjFWdd5...)"
                  fullWidth
                  required
                  value={formData.contractAddress}
                  onChange={(e) => handleChange('contractAddress', e.target.value)}
                  onBlur={handleContractAddressBlur}
                  error={!!errors.contractAddress || !!tokenValidationError}
                  helperText={errors.contractAddress || tokenValidationError}
                  InputProps={{
                    endAdornment: (isValidatingToken || isDuplicateChecking) ? (
                      <InputAdornment position="end">
                        <CircularProgress size={20} sx={{ color: 'var(--accent-primary)' }} />
                      </InputAdornment>
                    ) : tokenData && !duplicateCheckResult?.isDuplicate ? (
                      <InputAdornment position="end">
                        <CheckCircleIcon sx={{ color: 'var(--accent-success)' }} />
                      </InputAdornment>
                    ) : tokenValidationError && formData.contractAddress.trim().length > 0 ? (
                      <InputAdornment position="end">
                        <ErrorOutlineIcon sx={{ color: '#EF4444' }} />
                      </InputAdornment>
                    ) : null
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontFamily: 'var(--font-body)',
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      '& fieldset': {
                        borderColor: 'var(--border-subtle)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'var(--accent-primary)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'var(--accent-primary)',
                        borderWidth: '2px',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      fontFamily: 'var(--font-body)',
                      color: 'var(--text-secondary)',
                      '&.Mui-focused': {
                        color: 'var(--accent-primary)',
                      },
                    },
                    '& .MuiInputBase-input': {
                      color: 'var(--text-primary)',
                    },
                  }}
                />
                
                {/* Loading State Messages */}
                {(isValidatingToken || isDuplicateChecking) && (
                  <div className="validation-status">
                    {isValidatingToken && 'Validating token...'}
                    {isDuplicateChecking && 'Checking for duplicates...'}
                  </div>
                )}
                
                {/* Token Info Card - Show when validation succeeds AND no duplicates */}
                {tokenData && !tokenValidationError && !duplicateCheckResult?.isDuplicate && (
                  <div className="token-info-card">
                    <div className="token-info-content">
                      {tokenData.logo && (
                        <div className="token-logo">
                          <Image 
                            src={tokenData.logo} 
                            alt={tokenData.symbol}
                            width={40}
                            height={40}
                            className="token-logo-image"
                          />
                        </div>
                      )}
                      {!tokenData.logo && (
                        <div className="token-logo-placeholder">
                          {tokenData.symbol.charAt(0)}
                        </div>
                      )}
                      <div className="token-details">
                        <div className="token-symbol">{tokenData.symbol}</div>
                        <div className="token-name">{tokenData.name}</div>
                        <div className="token-decimals">Decimals: {tokenData.decimals}</div>
                      </div>
                      <CheckCircleIcon 
                        sx={{ 
                          color: 'var(--accent-success)', 
                          fontSize: '24px',
                          marginLeft: 'auto'
                        }} 
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Role Select */}
              <FormControl 
                fullWidth 
                required
                error={!!errors.role}
              >
                <InputLabel
                  sx={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--text-secondary)',
                    '&.Mui-focused': {
                      color: 'var(--accent-primary)',
                    },
                  }}
                >
                  Your Role in Project
                </InputLabel>
                <Select
                  value={formData.role}
                  label="Your Role in Project"
                  onChange={(e) => handleChange('role', e.target.value)}
                  endAdornment={getFieldIcon('role', true)}
                  sx={{
                    fontFamily: 'var(--font-body)',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'var(--border-subtle)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'var(--accent-primary)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'var(--accent-primary)',
                      borderWidth: '2px',
                    },
                    '& .MuiSelect-select': {
                      color: 'var(--text-primary)',
                    },
                  }}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <MenuItem 
                      key={role} 
                      value={role}
                      sx={{
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {role}
                    </MenuItem>
                  ))}
                </Select>
                {errors.role && (
                  <p className="error-text">{errors.role}</p>
                )}
              </FormControl>

              {/* Message Field */}
              <div className="message-field">
                <TextField
                  label="Additional Message (Optional)"
                  placeholder="Tell us about your project..."
                  fullWidth
                  multiline
                  rows={4}
                  value={formData.message}
                  onChange={(e) => handleChange('message', e.target.value)}
                  error={!!errors.message}
                  helperText={errors.message}
                  inputProps={{ maxLength: 500 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontFamily: 'var(--font-body)',
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      '& fieldset': {
                        borderColor: 'var(--border-subtle)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'var(--accent-primary)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'var(--accent-primary)',
                        borderWidth: '2px',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      fontFamily: 'var(--font-body)',
                      color: 'var(--text-secondary)',
                      '&.Mui-focused': {
                        color: 'var(--accent-primary)',
                      },
                    },
                    '& .MuiInputBase-input': {
                      color: 'var(--text-primary)',
                    },
                  }}
                />
                <div className="character-counter">
                  {formData.message.length} / 500
                </div>
              </div>

              {/* Submit Error */}
              {errors.submit && (
                <div className="submit-error">
                  {errors.submit}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={
                  submitting || 
                  isValidatingToken || 
                  isDuplicateChecking ||
                  duplicateCheckResult?.isDuplicate ||
                  (!tokenData && formData.contractAddress.trim().length > 0)
                }
                className="submit-button"
              >
                {submitting ? (
                  <>
                    <CircularProgress 
                      size={20} 
                      sx={{ 
                        color: 'white',
                        marginRight: '8px'
                      }} 
                    />
                    Submitting...
                  </>
                ) : isValidatingToken ? (
                  <>
                    <CircularProgress 
                      size={20} 
                      sx={{ 
                        color: 'white',
                        marginRight: '8px'
                      }} 
                    />
                    Validating Token...
                  </>
                ) : isDuplicateChecking ? (
                  <>
                    <CircularProgress 
                      size={20} 
                      sx={{ 
                        color: 'white',
                        marginRight: '8px'
                      }} 
                    />
                    Checking for Duplicates...
                  </>
                ) : (
                  'Submit Application'
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      <style jsx>{`
        .page-wrapper {
          min-height: 100vh;
          background: var(--page-background);
          position: relative;
          overflow-x: hidden;
        }

        main {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-xl) var(--space-md);
        }

        .submit-container {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
        }

        .logo-container {
          display: flex;
          justify-content: center;
          margin-bottom: var(--space-xl);
        }

        .logo-link {
          text-decoration: none;
          transition: opacity 0.2s ease;
        }

        .logo-link:hover {
          opacity: 0.8;
        }

        .logo-text {
          font-family: 'Gluten', cursive;
          font-size: 28px;
          font-weight: 500;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          margin: 0;
          cursor: pointer;
        }

        .header-section {
          text-align: center;
          margin-bottom: var(--space-xl);
        }

        .text-title {
          font-family: var(--font-heading);
          font-size: var(--text-display);
          font-weight: var(--weight-bold);
          color: var(--text-primary);
          margin-bottom: var(--space-sm);
          line-height: var(--line-height-tight);
        }

        .text-body {
          font-family: var(--font-body);
          font-size: var(--text-body);
          color: var(--text-secondary);
          line-height: var(--line-height-normal);
          max-width: 500px;
          margin: 0 auto;
        }

        .form-card {
          background: var(--card-background);
          border-radius: var(--radius-card-lg);
          padding: var(--space-xl);
          box-shadow: var(--shadow-card);
        }

        form {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        .message-field {
          position: relative;
        }

        .character-counter {
          font-family: var(--font-body);
          font-size: var(--text-caption);
          color: var(--text-muted);
          text-align: right;
          margin-top: var(--space-xs);
        }

        .error-text {
          font-family: var(--font-body);
          font-size: var(--text-caption);
          color: #EF4444;
          margin-top: var(--space-xxs);
          margin-left: var(--space-sm);
        }

        .submit-error {
          padding: var(--space-sm);
          background: #FEE2E2;
          border: 1px solid #EF4444;
          border-radius: 12px;
          color: #991B1B;
          font-family: var(--font-body);
          font-size: var(--text-body-small);
          text-align: center;
        }

        .submit-button {
          width: 100%;
          background: var(--accent-primary);
          color: white;
          padding: var(--space-sm) var(--space-lg);
          border: none;
          border-radius: var(--radius-control);
          font-family: var(--font-body);
          font-size: var(--text-label);
          font-weight: var(--weight-semibold);
          cursor: pointer;
          box-shadow: var(--shadow-chip);
          transition: all 0.2s ease;
          margin-top: var(--space-md);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-xs);
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: var(--shadow-floating);
        }

        .submit-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .contract-field-wrapper {
          position: relative;
        }

        .token-info-card {
          margin-top: var(--space-sm);
          background: var(--accent-success-soft);
          border: 1px solid var(--accent-success);
          border-radius: 12px;
          padding: var(--space-md);
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .token-info-content {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .token-logo {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .token-logo-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .token-logo-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--accent-primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-heading);
          font-size: var(--text-headline);
          font-weight: var(--weight-bold);
          flex-shrink: 0;
        }

        .token-details {
          flex: 1;
          min-width: 0;
        }

        .token-symbol {
          font-family: var(--font-heading);
          font-size: var(--text-headline);
          font-weight: var(--weight-bold);
          color: var(--text-primary);
          margin-bottom: 2px;
        }

        .token-name {
          font-family: var(--font-body);
          font-size: var(--text-body-small);
          color: var(--text-secondary);
          margin-bottom: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .token-decimals {
          font-family: var(--font-body);
          font-size: var(--text-caption);
          color: var(--text-muted);
        }

        .validation-status {
          margin-top: var(--space-sm);
          font-family: var(--font-body);
          font-size: var(--text-body-small);
          color: var(--accent-primary);
          font-weight: var(--weight-medium);
          display: flex;
          align-items: center;
          gap: var(--space-xs);
        }

        .validation-status::before {
          content: '';
          width: 4px;
          height: 4px;
          background: var(--accent-primary);
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        .general-error {
          background: #FEE2E2;
          border: 1px solid #EF4444;
          border-radius: 12px;
          padding: var(--space-md);
          margin-bottom: var(--space-md);
          display: flex;
          align-items: flex-start;
          gap: var(--space-sm);
          animation: slideIn 0.3s ease-out;
        }

        .general-error :global(.error-icon) {
          color: #EF4444;
          font-size: 24px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .error-content {
          flex: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--space-sm);
        }

        .error-message {
          font-family: var(--font-body);
          font-size: var(--text-body-small);
          color: #991B1B;
          margin: 0;
          line-height: 1.5;
        }

        .error-dismiss {
          background: none;
          border: none;
          color: #991B1B;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s ease;
          flex-shrink: 0;
        }

        .error-dismiss:hover {
          background: rgba(153, 27, 27, 0.1);
        }

        /* Responsive Design */
        @media (min-width: 768px) {
          .submit-button {
            width: auto;
            min-width: 200px;
            align-self: flex-end;
          }
        }

        @media (max-width: 768px) {
          main {
            padding: var(--space-lg) var(--space-md);
          }

          .text-title {
            font-size: 32px;
          }

          .form-card {
            padding: var(--space-lg);
          }
        }
      `}</style>
    </div>
    </>
  )
}
