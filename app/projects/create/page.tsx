'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { validateProjectToken, ProjectToken, saveDraft, getTokenDraft, markTokenAsCompleted } from '@/lib/project-tokens'
import { AppHeader } from '@/components/AppHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import CircularProgress from '@mui/material/CircularProgress'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import LockIcon from '@mui/icons-material/Lock'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import InfoIcon from '@mui/icons-material/Info'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import { supabase } from '@/lib/supabase'

function CreateProjectPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [token, setToken] = useState<ProjectToken | null>(null)
  const [isValidating, setIsValidating] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<any>({})
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showDraftNotification, setShowDraftNotification] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({})
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Token validation and draft loading
  useEffect(() => {
    async function checkToken() {
      const tokenParam = searchParams.get('token')

      if (!tokenParam) {
        // No token provided - redirect to submit page
        setError('Access denied. Please submit your project first.')
        setTimeout(() => {
          router.push('/submit-project')
        }, 3000)
        return
      }

      // Validate token
      const validatedToken = await validateProjectToken(tokenParam)

      if (!validatedToken) {
        // Invalid or expired token
        setError('Invalid or expired creation link. Please contact support or resubmit your project.')
        setIsValidating(false)
        return
      }

      // Token is valid
      setToken(validatedToken)

      // Fetch submission data to pre-fill form
      const { data: submissionData } = await supabase
        .from('project_submissions')
        .select('token_symbol, token_name, name, role, message')
        .eq('id', validatedToken.submission_id)
        .single()

      // Load saved draft if exists
      const savedDraft = await getTokenDraft(validatedToken.id)

      if (savedDraft) {
        // Pre-fill form with saved draft data
        setFormData(savedDraft)
        console.log('Loaded saved draft:', savedDraft)

        // Show notification to user
        setShowDraftNotification(true)
        setTimeout(() => setShowDraftNotification(false), 5000)
      } else if (submissionData) {
        // Pre-fill with submission data if no draft exists
        setFormData({
          tokenSymbol: submissionData.token_symbol,
          tokenName: submissionData.token_name,
          submitterName: submissionData.name,
          submitterRole: submissionData.role,
          description: submissionData.message || '',
        })
        console.log('Pre-filled with submission data:', submissionData)
      }

      setIsValidating(false)
    }

    checkToken()
  }, [searchParams, router])

  // Auto-save effect
  useEffect(() => {
    // Don't auto-save if no token or form is empty
    if (!token || Object.keys(formData).length === 0) return

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // Set new timer for 30 seconds
    autoSaveTimerRef.current = setTimeout(async () => {
      await saveFormDraft()
    }, 30000) // 30 seconds

    // Cleanup on unmount
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [formData, token])

  // Save draft function
  async function saveFormDraft() {
    if (!token || isSaving) return

    setIsSaving(true)

    const success = await saveDraft(token.id, token.contract_address, formData)

    if (success) {
      setLastSaved(new Date())
      console.log('Draft saved at:', new Date().toLocaleTimeString())
    } else {
      console.error('Failed to save draft')
    }

    setIsSaving(false)
  }

  // Manual save handler (for future use)
  async function handleManualSave() {
    await saveFormDraft()
  }

  // Form validation
  function validateForm() {
    const errors: Record<string, string> = {}

    if (!formData.tokenSymbol || formData.tokenSymbol.trim() === '') {
      errors.tokenSymbol = 'Token symbol is required'
    }

    if (!formData.tokenName || formData.tokenName.trim() === '') {
      errors.tokenName = 'Token name is required'
    }

    if (!formData.description || formData.description.trim() === '') {
      errors.description = 'Project description is required'
    } else if (formData.description.length < 50) {
      errors.description = 'Description must be at least 50 characters'
    }

    return errors
  }

  // Form submission handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Clear previous errors
    setSubmitErrors({})

    // Validate form
    const errors = validateForm()
    if (Object.keys(errors).length > 0) {
      setSubmitErrors(errors)
      return
    }

    if (!token) {
      setSubmitErrors({ general: 'Invalid token' })
      return
    }

    setIsSubmitting(true)

    try {
      // Create the project via API
      const projectData = {
        contractAddress: token.contract_address,
        email: token.email,
        tokenId: token.id,
        tokenName: formData.tokenName,
        tokenSymbol: formData.tokenSymbol,
        description: formData.description,
        profileImageUrl: formData.profileImageUrl || null,
        website: formData.website || null,
        twitter: formData.twitter || null,
        telegram: formData.telegram || null,
        creatorWallet: token.created_by,
      }

      console.log('Project data to submit:', projectData)

      const response = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create project')
      }

      const data = await response.json()

      // The API already handles token completion, draft completion, and admin notifications
      console.log('Project created successfully:', data.projectId)

      // Show success message
      setShowSuccessModal(true)

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push(`/project/${data.projectId}`)
      }, 2000)
    } catch (error) {
      console.error('Project creation error:', error)
      setSubmitErrors({
        general:
          error instanceof Error
            ? error.message
            : 'Failed to create project. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show loading state while validating
  if (isValidating) {
    return (
      <div className="min-h-screen bg-page-bg">
        <AppHeader />
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 'calc(100vh - 80px)',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <CircularProgress size={60} sx={{ color: 'var(--accent-primary)' }} />
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-body)',
              color: 'var(--text-secondary)',
            }}
          >
            Validating your creation link...
          </p>
        </div>
      </div>
    )
  }

  // Show error if token invalid
  if (error) {
    return (
      <div className="min-h-screen bg-page-bg">
        <AppHeader />
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 'calc(100vh - 80px)',
            flexDirection: 'column',
            gap: '20px',
            textAlign: 'center',
            padding: '20px',
          }}
        >
          <ErrorOutlineIcon style={{ fontSize: 64, color: '#EF4444' }} />
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--text-headline)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            {error}
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-body)',
              color: 'var(--text-secondary)',
            }}
          >
            Redirecting to submission page...
          </p>
        </div>
      </div>
    )
  }

  // Token is valid - render the form
  return (
    <div className="min-h-screen bg-page-bg">
      <AppHeader />

      {/* Auto-Save Indicator */}
      <div
        style={{
          position: 'fixed',
          top: '100px',
          right: '20px',
          backgroundColor: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 1000,
        }}
      >
        {isSaving ? (
          <>
            <CircularProgress size={16} sx={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
              Saving...
            </span>
          </>
        ) : lastSaved ? (
          <>
            <CheckCircleIcon style={{ fontSize: 16, color: 'var(--accent-success)' }} />
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          </>
        ) : (
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
            Auto-save enabled
          </span>
        )}
      </div>

      {/* Draft Loaded Notification */}
      {showDraftNotification && (
        <div
          style={{
            position: 'fixed',
            top: '160px',
            right: '20px',
            backgroundColor: 'var(--accent-primary-soft)',
            border: '1px solid var(--accent-primary)',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            maxWidth: '300px',
            zIndex: 1000,
            animation: 'slideIn 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'start' }}>
            <InfoIcon style={{ color: 'var(--accent-primary)', fontSize: 20 }} />
            <div>
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Draft Loaded
              </p>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                We've restored your previous work. Continue where you left off!
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--text-display)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-sm)',
            }}
          >
            Create Your Project
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-body)',
              color: 'var(--text-secondary)',
            }}
          >
            Complete your project setup with your approved token
          </p>
        </div>

        {/* Project Creation Form */}
        <Card className="p-6">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-2xl">Project Information</CardTitle>
            <p className="font-body text-text-secondary mt-2">
              Your contract address has been verified and locked
            </p>
          </CardHeader>

          <CardContent className="p-0">
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contract Address Locked Info Box */}
            <div
              style={{
                backgroundColor: 'var(--accent-primary-soft)',
                borderRadius: '12px',
                padding: 'var(--space-md)',
                border: '1px solid var(--accent-primary)',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-body-small)',
                  color: 'var(--text-primary)',
                  lineHeight: '1.5',
                }}
              >
                <strong>Contract Address Locked:</strong> This address was
                verified during your submission and cannot be changed. If you
                need to use a different address, please submit a new project.
              </p>
            </div>

            {/* Locked Contract Address Field */}
            <TextField
              label="Token Contract Address"
              name="contractAddress"
              value={token?.contract_address || ''}
              disabled={true}
              fullWidth
              required
              helperText="This contract address is locked and cannot be changed."
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon style={{ color: 'var(--accent-primary)' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: 'var(--text-primary)',
                  cursor: 'not-allowed',
                },
                '& .MuiOutlinedInput-root.Mui-disabled': {
                  backgroundColor: 'var(--subtle-background)',
                },
                '& .MuiOutlinedInput-root': {
                  fontFamily: 'var(--font-body)',
                  '& fieldset': {
                    borderColor: 'var(--border-subtle)',
                  },
                },
                '& .MuiInputLabel-root': {
                  fontFamily: 'var(--font-body)',
                  color: 'var(--text-secondary)',
                  '&.Mui-focused': {
                    color: 'var(--accent-primary)',
                  },
                },
                '& .MuiFormHelperText-root': {
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-caption)',
                },
              }}
            />

            {/* Email Field (Display Only) */}
            <TextField
              label="Contact Email"
              name="email"
              value={token?.email || ''}
              disabled={true}
              fullWidth
              helperText="Email address from your submission"
              sx={{
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: 'var(--text-primary)',
                },
                '& .MuiOutlinedInput-root.Mui-disabled': {
                  backgroundColor: 'var(--subtle-background)',
                },
                '& .MuiOutlinedInput-root': {
                  fontFamily: 'var(--font-body)',
                  '& fieldset': {
                    borderColor: 'var(--border-subtle)',
                  },
                },
                '& .MuiInputLabel-root': {
                  fontFamily: 'var(--font-body)',
                  color: 'var(--text-secondary)',
                },
                '& .MuiFormHelperText-root': {
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-caption)',
                },
              }}
            />

            {/* Token Symbol */}
            <TextField
              label="Token Symbol"
              name="tokenSymbol"
              value={formData.tokenSymbol || ''}
              onChange={(e) => setFormData({ ...formData, tokenSymbol: e.target.value })}
              fullWidth
              required
              error={!!submitErrors.tokenSymbol}
              helperText={submitErrors.tokenSymbol || "The ticker symbol for your token (e.g., GOAT, FWOG)"}
              inputProps={{ maxLength: 10 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: 'var(--font-body)',
                  '& fieldset': { borderColor: 'var(--border-subtle)' },
                  '&:hover fieldset': { borderColor: 'var(--accent-primary)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--accent-primary)' },
                },
                '& .MuiInputLabel-root': {
                  fontFamily: 'var(--font-body)',
                  '&.Mui-focused': { color: 'var(--accent-primary)' },
                },
                '& .MuiFormHelperText-root': {
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-caption)',
                },
              }}
            />

            {/* Token Name */}
            <TextField
              label="Token Name"
              name="tokenName"
              value={formData.tokenName || ''}
              onChange={(e) => setFormData({ ...formData, tokenName: e.target.value })}
              fullWidth
              required
              error={!!submitErrors.tokenName}
              helperText={submitErrors.tokenName || "The full name of your token project"}
              inputProps={{ maxLength: 50 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: 'var(--font-body)',
                  '& fieldset': { borderColor: 'var(--border-subtle)' },
                  '&:hover fieldset': { borderColor: 'var(--accent-primary)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--accent-primary)' },
                },
                '& .MuiInputLabel-root': {
                  fontFamily: 'var(--font-body)',
                  '&.Mui-focused': { color: 'var(--accent-primary)' },
                },
                '& .MuiFormHelperText-root': {
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-caption)',
                },
              }}
            />

            {/* Description */}
            <TextField
              label="Project Description"
              name="description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={4}
              required
              error={!!submitErrors.description}
              helperText={submitErrors.description || "Tell the community about your project (min 50 characters, 200-500 recommended)"}
              inputProps={{ maxLength: 1000 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: 'var(--font-body)',
                  '& fieldset': { borderColor: 'var(--border-subtle)' },
                  '&:hover fieldset': { borderColor: 'var(--accent-primary)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--accent-primary)' },
                },
                '& .MuiInputLabel-root': {
                  fontFamily: 'var(--font-body)',
                  '&.Mui-focused': { color: 'var(--accent-primary)' },
                },
                '& .MuiFormHelperText-root': {
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-caption)',
                },
              }}
            />

            {/* Profile Image URL */}
            <TextField
              label="Profile Image URL"
              name="profileImageUrl"
              value={formData.profileImageUrl || ''}
              onChange={(e) => setFormData({ ...formData, profileImageUrl: e.target.value })}
              fullWidth
              helperText="Direct link to your project's logo/avatar (optional)"
              type="url"
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: 'var(--font-body)',
                  '& fieldset': { borderColor: 'var(--border-subtle)' },
                  '&:hover fieldset': { borderColor: 'var(--accent-primary)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--accent-primary)' },
                },
                '& .MuiInputLabel-root': {
                  fontFamily: 'var(--font-body)',
                  '&.Mui-focused': { color: 'var(--accent-primary)' },
                },
                '& .MuiFormHelperText-root': {
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-caption)',
                },
              }}
            />

            {/* Website URL */}
            <TextField
              label="Website"
              name="website"
              value={formData.website || ''}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              fullWidth
              helperText="Your project's official website (optional)"
              type="url"
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: 'var(--font-body)',
                  '& fieldset': { borderColor: 'var(--border-subtle)' },
                  '&:hover fieldset': { borderColor: 'var(--accent-primary)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--accent-primary)' },
                },
                '& .MuiInputLabel-root': {
                  fontFamily: 'var(--font-body)',
                  '&.Mui-focused': { color: 'var(--accent-primary)' },
                },
                '& .MuiFormHelperText-root': {
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-caption)',
                },
              }}
            />

            {/* Twitter */}
            <TextField
              label="Twitter/X Handle"
              name="twitter"
              value={formData.twitter || ''}
              onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
              fullWidth
              helperText="Your Twitter/X username (without @, optional)"
              placeholder="example: goatmaximus"
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: 'var(--font-body)',
                  '& fieldset': { borderColor: 'var(--border-subtle)' },
                  '&:hover fieldset': { borderColor: 'var(--accent-primary)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--accent-primary)' },
                },
                '& .MuiInputLabel-root': {
                  fontFamily: 'var(--font-body)',
                  '&.Mui-focused': { color: 'var(--accent-primary)' },
                },
                '& .MuiFormHelperText-root': {
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-caption)',
                },
              }}
            />

            {/* Telegram */}
            <TextField
              label="Telegram Group"
              name="telegram"
              value={formData.telegram || ''}
              onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
              fullWidth
              helperText="Your Telegram group link or username (optional)"
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: 'var(--font-body)',
                  '& fieldset': { borderColor: 'var(--border-subtle)' },
                  '&:hover fieldset': { borderColor: 'var(--accent-primary)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--accent-primary)' },
                },
                '& .MuiInputLabel-root': {
                  fontFamily: 'var(--font-body)',
                  '&.Mui-focused': { color: 'var(--accent-primary)' },
                },
                '& .MuiFormHelperText-root': {
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-caption)',
                },
              }}
            />

            {/* Error Display */}
            {submitErrors.general && (
              <div
                style={{
                  padding: 'var(--space-md)',
                  background: '#FEE2E2',
                  border: '1px solid #EF4444',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                }}
              >
                <ErrorOutlineIcon style={{ color: '#EF4444', fontSize: 20 }} />
                <p
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-body-small)',
                    color: '#991B1B',
                  }}
                >
                  {submitErrors.general}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--space-md)' }}>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isSubmitting}
                style={{ minWidth: '200px' }}
              >
                {isSubmitting ? (
                  <>
                    <CircularProgress size={20} sx={{ color: 'white', marginRight: '8px' }} />
                    Creating Project...
                  </>
                ) : (
                  'Create Project'
                )}
              </Button>
            </div>
          </form>
          </CardContent>
        </Card>

        {/* Success Modal */}
        {showSuccessModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: 'var(--radius-card-lg)',
                padding: 'var(--space-xl)',
                maxWidth: '400px',
                textAlign: 'center',
                boxShadow: 'var(--shadow-floating)',
              }}
            >
              <CheckCircleIcon
                style={{
                  fontSize: 64,
                  color: 'var(--accent-success)',
                  marginBottom: 'var(--space-md)',
                }}
              />
              <h2
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'var(--text-headline)',
                  fontWeight: 'var(--weight-bold)',
                  color: 'var(--text-primary)',
                  margin: 0,
                  marginBottom: 'var(--space-sm)',
                }}
              >
                Project Created Successfully!
              </h2>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-body)',
                  color: 'var(--text-secondary)',
                  margin: 0,
                }}
              >
                Your token has been marked as completed. Redirecting to projects page...
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  )
}

export default function CreateProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-page-bg">
          <AppHeader />
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 'calc(100vh - 80px)',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <CircularProgress size={60} sx={{ color: 'var(--accent-primary)' }} />
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-body)',
                color: 'var(--text-secondary)',
              }}
            >
              Loading...
            </p>
          </div>
        </div>
      }
    >
      <CreateProjectPageContent />
    </Suspense>
  )
}
