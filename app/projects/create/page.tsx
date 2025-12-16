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
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

type SocialPlatform = 'Instagram' | 'Twitter' | 'TikTok' | 'YouTube'
type FollowerTier = '<10k' | '10k-50k' | '50k-100k' | '100k-500k' | '500k-1m' | '1m-5m' | '5m+'
type LegalAssetType = 'Domain' | 'Trademark' | 'Copyright'
type LegalAssetStatus = 'Registered' | 'Pending' | 'None'

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 
  'France', 'Spain', 'Italy', 'Netherlands', 'Switzerland', 'Japan', 
  'China', 'India', 'Brazil', 'Mexico', 'Argentina', 'South Korea',
  'Singapore', 'Hong Kong', 'United Arab Emirates', 'Other'
].sort()

interface SocialAsset {
  id: string
  platform: SocialPlatform
  handle: string
  followerTier: FollowerTier
  profileUrl: string
  verificationCode: string
  status: 'pending'
}

interface CreativeAsset {
  id: string
  fileName: string
  fileUrl: string
  previewUrl: string
}

interface LegalAsset {
  id: string
  assetType: LegalAssetType
  name: string
  status: LegalAssetStatus
  jurisdiction?: string
}

interface TeamWallet {
  id: string
  address: string
  label: string
}

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
  
  // Multi-step form state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)
  const [stepValidationErrors, setStepValidationErrors] = useState<Record<string, string>>({})
  
  // Image upload state
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  
  // Social Assets
  const [socialAssets, setSocialAssets] = useState<SocialAsset[]>([])
  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>('Instagram')
  const [socialHandle, setSocialHandle] = useState('')
  const [socialFollowerTier, setSocialFollowerTier] = useState<FollowerTier>('<10k')
  
  // Creative Assets
  const [creativeAssets, setCreativeAssets] = useState<CreativeAsset[]>([])
  const [uploadingCreative, setUploadingCreative] = useState(false)
  
  // Legal Assets
  const [legalAssets, setLegalAssets] = useState<LegalAsset[]>([])
  const [legalAssetType, setLegalAssetType] = useState<LegalAssetType>('Domain')
  const [legalAssetName, setLegalAssetName] = useState('')
  const [legalAssetStatus, setLegalAssetStatus] = useState<LegalAssetStatus>('None')
  const [legalJurisdiction, setLegalJurisdiction] = useState('')
  
  // Team Wallets
  const [teamWallets, setTeamWallets] = useState<TeamWallet[]>([])
  const [walletAddress, setWalletAddress] = useState('')
  const [walletLabel, setWalletLabel] = useState('')

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

  // Image upload handler
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    setError(null)

    try {
      // 1. Validate: image only
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file')
      }

      // 2. Validate: max 5MB
      const maxSize = 5 * 1024 * 1024 // 5MB in bytes
      if (file.size > maxSize) {
        throw new Error('Image must be less than 5MB')
      }

      // 3. Validate: min 400x400px
      const img = new window.Image()
      const imageObjectUrl = URL.createObjectURL(file)
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          if (img.width < 400 || img.height < 400) {
            reject(new Error('Image must be at least 400x400 pixels'))
          } else {
            resolve(true)
          }
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = imageObjectUrl
      })

      // 4. Generate unique filename using contract address
      const projectId = token?.contract_address || 'unknown'
      const fileExt = file.name.split('.').pop()
      const fileName = `${projectId}-profile.${fileExt}`

      // 5. Upload to Supabase Storage bucket "project-assets"
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project-assets')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      // 6. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('project-assets')
        .getPublicUrl(fileName)

      // 7. Set the image URL and preview
      setImageUrl(publicUrl)
      setImagePreview(imageObjectUrl)
      setFormData({ ...formData, profileImageUrl: publicUrl })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image')
      // Clear the file input
      event.target.value = ''
    } finally {
      setUploadingImage(false)
    }
  }

  // Step validation function
  const validateCurrentStep = (): boolean => {
    const errors: Record<string, string> = {}
    
    if (currentStep === 1) {
      if (!formData.tokenSymbol?.trim()) {
        errors.tokenSymbol = 'Token symbol is required'
      }
      if (!formData.tokenName?.trim()) {
        errors.tokenName = 'Token name is required'
      }
      if (!formData.description?.trim()) {
        errors.description = 'Description is required'
      } else if (formData.description.trim().length < 50) {
        errors.description = 'Description must be at least 50 characters'
      }
    }
    // Steps 2, 3, 4 have no required fields (all optional)
    
    setStepValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Helper function to generate verification code
  const generateVerificationCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  // Add social asset
  const handleAddSocialAsset = () => {
    if (!socialHandle.trim()) {
      setError('Please enter a social media handle')
      return
    }

    const newAsset: SocialAsset = {
      id: Date.now().toString(),
      platform: socialPlatform,
      handle: socialHandle.trim(),
      followerTier: socialFollowerTier,
      profileUrl: `https://${socialPlatform.toLowerCase()}.com/${socialHandle.trim()}`,
      verificationCode: generateVerificationCode(),
      status: 'pending'
    }

    setSocialAssets([...socialAssets, newAsset])
    setSocialHandle('')
    setError(null)
  }

  // Remove social asset
  const handleRemoveSocialAsset = (id: string) => {
    setSocialAssets(socialAssets.filter(asset => asset.id !== id))
  }

  // Creative asset upload
  const handleCreativeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingCreative(true)
    setError(null)

    try {
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        throw new Error('File must be less than 10MB')
      }

      const projectId = token?.contract_address || 'unknown'
      const timestamp = Date.now()
      const fileExt = file.name.split('.').pop()
      const fileName = `${projectId}-creative-${timestamp}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('project-assets')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

      const { data: { publicUrl } } = supabase.storage
        .from('project-assets')
        .getPublicUrl(fileName)

      const newAsset: CreativeAsset = {
        id: Date.now().toString(),
        fileName: file.name,
        fileUrl: publicUrl,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
      }

      setCreativeAssets([...creativeAssets, newAsset])
      event.target.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file')
    } finally {
      setUploadingCreative(false)
    }
  }

  // Remove creative asset
  const handleRemoveCreative = (id: string) => {
    setCreativeAssets(creativeAssets.filter(asset => asset.id !== id))
  }

  // Add legal asset
  const handleAddLegalAsset = () => {
    if (!legalAssetName.trim()) {
      setError('Please enter an asset name')
      return
    }

    const newAsset: LegalAsset = {
      id: Date.now().toString(),
      assetType: legalAssetType,
      name: legalAssetName.trim(),
      status: legalAssetStatus,
      jurisdiction: legalJurisdiction.trim() || undefined
    }

    setLegalAssets([...legalAssets, newAsset])
    setLegalAssetName('')
    setLegalJurisdiction('')
    setError(null)
  }

  // Remove legal asset
  const handleRemoveLegalAsset = (id: string) => {
    setLegalAssets(legalAssets.filter(asset => asset.id !== id))
  }

  // Add team wallet
  const handleAddTeamWallet = () => {
    if (!walletAddress.trim()) {
      setError('Please enter a wallet address')
      return
    }

    const newWallet: TeamWallet = {
      id: Date.now().toString(),
      address: walletAddress.trim(),
      label: walletLabel.trim() || 'Team Member'
    }

    setTeamWallets([...teamWallets, newWallet])
    setWalletAddress('')
    setWalletLabel('')
    setError(null)
  }

  // Remove team wallet
  const handleRemoveTeamWallet = (id: string) => {
    setTeamWallets(teamWallets.filter(wallet => wallet.id !== id))
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
        profileImageUrl: imageUrl || formData.profileImageUrl || null,
        website: formData.website || null,
        telegram: formData.telegram || null,
        creatorWallet: token.created_by,
        // Include all assets from steps 2-4
        socialAssets: socialAssets,
        creativeAssets: creativeAssets,
        legalAssets: legalAssets,
        teamWallets: teamWallets,
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
        <div className="text-center mb-6 sm:mb-8">
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-sm)',
            }}
            className="text-3xl sm:text-4xl lg:text-5xl"
          >
            Create Your Project
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--text-secondary)',
            }}
            className="text-sm sm:text-base"
          >
            Complete your project setup with your approved token
          </p>
        </div>

        {/* Step Progress Indicator - Mobile Responsive */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            {[
              { num: 1, label: 'Token Info' },
              { num: 2, label: 'Social Assets' },
              { num: 3, label: 'Creative Assets' },
              { num: 4, label: 'IP Assets' }
            ].map((step, index) => (
              <div key={step.num} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: currentStep >= step.num ? 'var(--accent-primary)' : 'var(--subtle-background)',
                      border: currentStep === step.num ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 'var(--weight-bold)',
                      color: currentStep >= step.num ? 'white' : 'var(--text-secondary)',
                      fontSize: '14px',
                    }}
                    className="sm:w-[40px] sm:h-[40px] sm:text-base"
                  >
                    {step.num}
                  </div>
                  <span
                    style={{
                      marginTop: '6px',
                      fontSize: '10px',
                      fontFamily: 'var(--font-body)',
                      color: currentStep === step.num ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      fontWeight: currentStep === step.num ? 600 : 400,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                    className="hidden sm:block sm:text-xs"
                  >
                    {step.label}
                  </span>
                </div>
                {index < 3 && (
                  <div
                    style={{
                      width: '20px',
                      height: '2px',
                      backgroundColor: currentStep > step.num ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      marginBottom: '0px',
                    }}
                    className="sm:w-[60px] sm:mb-[24px]"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Project Creation Form */}
        <Card className="p-4 sm:p-6">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-2xl">
              Step {currentStep}: {
                currentStep === 1 ? 'Token Information' :
                currentStep === 2 ? 'Social Assets' :
                currentStep === 3 ? 'Creative Assets' :
                'IP Assets'
              }
            </CardTitle>
            <p className="font-body text-text-secondary mt-2">
              {currentStep === 1 && 'Your contract address has been verified and locked'}
              {currentStep === 2 && 'Connect your social media accounts to verify ownership'}
              {currentStep === 3 && 'Upload branding materials and creative assets'}
              {currentStep === 4 && 'Declare your intellectual property assets'}
            </p>
          </CardHeader>

          <CardContent className="p-0">
            <form onSubmit={currentStep === 4 ? handleSubmit : (e) => e.preventDefault()} className="space-y-6">
            
            {/* STEP 1: TOKEN INFORMATION */}
            {currentStep === 1 && (
              <>
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
                  onChange={(e) => {
                    setFormData({ ...formData, tokenSymbol: e.target.value })
                    // Clear validation error on change
                    if (stepValidationErrors.tokenSymbol) {
                      setStepValidationErrors({ ...stepValidationErrors, tokenSymbol: '' })
                    }
                  }}
                  fullWidth
                  required
                  error={!!submitErrors.tokenSymbol || !!stepValidationErrors.tokenSymbol}
                  helperText={submitErrors.tokenSymbol || stepValidationErrors.tokenSymbol || "The ticker symbol for your token (e.g., GOAT, FWOG)"}
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
              onChange={(e) => {
                setFormData({ ...formData, tokenName: e.target.value })
                // Clear validation error on change
                if (stepValidationErrors.tokenName) {
                  setStepValidationErrors({ ...stepValidationErrors, tokenName: '' })
                }
              }}
              fullWidth
              required
              error={!!submitErrors.tokenName || !!stepValidationErrors.tokenName}
              helperText={submitErrors.tokenName || stepValidationErrors.tokenName || "The full name of your token project"}
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
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value })
                // Clear validation error on change
                if (stepValidationErrors.description) {
                  setStepValidationErrors({ ...stepValidationErrors, description: '' })
                }
              }}
              fullWidth
              multiline
              rows={4}
              required
              error={!!submitErrors.description || !!stepValidationErrors.description}
              helperText={submitErrors.description || stepValidationErrors.description || `Tell the community about your project (min 50 characters, 200-500 recommended) - ${formData.description?.length || 0} characters`}
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

                {/* Profile Image Upload */}
                <div>
                  <label
              style={{
                      display: 'block',
                      fontFamily: 'var(--font-body)',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '8px',
              }}
            >
                    Profile Image
                  </label>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      marginBottom: '12px',
                      marginTop: 0,
                }}
              >
                    Upload your project logo (min 400x400px, max 5MB)
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-hover file:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {uploadingImage && (
                    <div className="flex items-center mt-2">
                      <CircularProgress size={16} className="mr-2" />
                      <span className="font-body text-sm text-text-secondary">Uploading...</span>
                    </div>
                  )}
            </div>

                {/* Image Preview */}
                {imagePreview && imageUrl && (
                  <div className="flex items-center gap-4 p-4 bg-subtle-bg rounded-lg">
                    <div className="relative w-[200px] h-[200px] rounded-lg overflow-hidden border-2 border-border-subtle">
                      <Image
                        src={imagePreview}
                        alt="Profile preview"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-body text-sm text-success font-medium mb-1">
                        ✓ Image uploaded successfully
                      </p>
                      <p className="font-body text-xs text-text-muted break-all">
                        {imageUrl}
                      </p>
                    </div>
                  </div>
                )}

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

            {/* Telegram */}
            <TextField
              label="Telegram Group"
              name="telegram"
              value={formData.telegram || ''}
              onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
              fullWidth
              helperText="Your Telegram community link or username (optional)"
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

                {/* Step 1 Navigation */}
                <div className="flex justify-end pt-4">
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={() => {
                      if (validateCurrentStep()) {
                        setCurrentStep(2)
                      }
                    }}
                    className="w-full sm:w-auto sm:min-w-[200px]"
                  >
                    Continue to Social Assets →
                  </Button>
                </div>
              </>
            )}

            {/* STEP 2: SOCIAL ASSETS */}
            {currentStep === 2 && (
              <>
                <div className="space-y-4">
                  <p className="font-body text-sm text-text-secondary">
                    Connect your social media accounts to build trust with the community. We'll help verify ownership.
                  </p>

                  {/* Add Social Asset Form */}
                  <div className="space-y-4 p-4 bg-subtle-bg rounded-lg">
                    <FormControl fullWidth>
                      <InputLabel>Platform</InputLabel>
                      <Select
                        value={socialPlatform}
                        onChange={(e) => setSocialPlatform(e.target.value as SocialPlatform)}
                        label="Platform"
                      >
                        <MenuItem value="Instagram">Instagram</MenuItem>
                        <MenuItem value="Twitter">Twitter / X</MenuItem>
                        <MenuItem value="TikTok">TikTok</MenuItem>
                        <MenuItem value="YouTube">YouTube</MenuItem>
                      </Select>
                    </FormControl>

                    <TextField
                      label="Handle / Username"
                      value={socialHandle}
                      onChange={(e) => setSocialHandle(e.target.value)}
                      fullWidth
                      placeholder="@yourhandle"
                      helperText="Your social media username or handle"
                    />

                    <FormControl fullWidth>
                      <InputLabel>Follower Count</InputLabel>
                      <Select
                        value={socialFollowerTier}
                        onChange={(e) => setSocialFollowerTier(e.target.value as FollowerTier)}
                        label="Follower Count"
                      >
                        <MenuItem value="<10k">Less than 10k</MenuItem>
                        <MenuItem value="10k-50k">10k - 50k</MenuItem>
                        <MenuItem value="50k-100k">50k - 100k</MenuItem>
                        <MenuItem value="100k-500k">100k - 500k</MenuItem>
                        <MenuItem value="500k-1m">500k - 1M</MenuItem>
                        <MenuItem value="1m-5m">1M - 5M</MenuItem>
                        <MenuItem value="5m+">5M+</MenuItem>
                      </Select>
                    </FormControl>

                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={handleAddSocialAsset}
                      style={{ width: '100%' }}
                    >
                      Add Social Account
                    </Button>
                  </div>

                  {/* Social Assets List */}
                  {socialAssets.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-heading text-md font-semibold">Added Accounts ({socialAssets.length})</h4>
                      {socialAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center justify-between p-3 bg-white rounded-lg border border-border-subtle"
                        >
                          <div className="flex-1">
                            <p className="font-body text-sm font-medium">
                              {asset.platform}: @{asset.handle}
                            </p>
                            <p className="font-body text-xs text-text-muted">
                              {asset.followerTier} followers • Code: {asset.verificationCode}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => handleRemoveSocialAsset(asset.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Step 2 Navigation */}
                <div className="flex flex-col sm:flex-row gap-3 sm:justify-between pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    onClick={() => setCurrentStep(1)}
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    ← Back
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={() => setCurrentStep(3)}
                    className="w-full sm:w-auto order-1 sm:order-2"
                  >
                    Continue to Creative Assets →
                  </Button>
                </div>
              </>
            )}

            {/* STEP 3: CREATIVE ASSETS */}
            {currentStep === 3 && (
              <>
                <div className="space-y-4">
                  <p className="font-body text-sm text-text-secondary">
                    Upload branding materials, logos, artwork, or any creative assets for your project.
                  </p>

                  {/* Upload Creative Assets */}
                  <div className="p-4 bg-subtle-bg rounded-lg">
                    <label className="block mb-2 font-body text-sm font-medium">
                      Upload Files (Images, PDFs, etc.)
                    </label>
                    <input
                      type="file"
                      accept="image/*,application/pdf,.doc,.docx"
                      onChange={handleCreativeUpload}
                      disabled={uploadingCreative}
                      className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-hover file:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {uploadingCreative && (
                      <div className="flex items-center mt-2">
                        <CircularProgress size={16} className="mr-2" />
                        <span className="font-body text-sm text-text-secondary">Uploading...</span>
                      </div>
                    )}
                  </div>

                  {/* Creative Assets List */}
                  {creativeAssets.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-heading text-md font-semibold">Uploaded Files ({creativeAssets.length})</h4>
                      {creativeAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center justify-between p-3 bg-white rounded-lg border border-border-subtle"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            {asset.previewUrl && (
                              <div className="relative w-12 h-12 rounded overflow-hidden">
                                <Image src={asset.previewUrl} alt={asset.fileName} fill className="object-cover" />
                              </div>
                            )}
                            <div>
                              <p className="font-body text-sm font-medium">{asset.fileName}</p>
                              <p className="font-body text-xs text-text-muted break-all">{asset.fileUrl}</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => handleRemoveCreative(asset.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Step 3 Navigation */}
                <div className="flex flex-col sm:flex-row gap-3 sm:justify-between pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    onClick={() => setCurrentStep(2)}
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    ← Back
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={() => setCurrentStep(4)}
                    className="w-full sm:w-auto order-1 sm:order-2"
                  >
                    Continue to IP Assets →
                  </Button>
                </div>
              </>
            )}

            {/* STEP 4: IP ASSETS & TEAM */}
            {currentStep === 4 && (
              <>
                <div className="space-y-6">
                  {/* Legal Assets Section */}
                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-semibold">Legal / IP Assets</h3>
                    <p className="font-body text-sm text-text-secondary">
                      Declare any intellectual property assets like domains, trademarks, or copyrights.
                    </p>

                    <div className="space-y-4 p-4 bg-subtle-bg rounded-lg">
                      <FormControl fullWidth>
                        <InputLabel>Asset Type</InputLabel>
                        <Select
                          value={legalAssetType}
                          onChange={(e) => setLegalAssetType(e.target.value as LegalAssetType)}
                          label="Asset Type"
                        >
                          <MenuItem value="Domain">Domain</MenuItem>
                          <MenuItem value="Trademark">Trademark</MenuItem>
                          <MenuItem value="Copyright">Copyright</MenuItem>
                        </Select>
                      </FormControl>

                      <TextField
                        label="Asset Name"
                        value={legalAssetName}
                        onChange={(e) => setLegalAssetName(e.target.value)}
                        fullWidth
                        placeholder="e.g., example.com or Brand Name™"
                      />

                      <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                          value={legalAssetStatus}
                          onChange={(e) => setLegalAssetStatus(e.target.value as LegalAssetStatus)}
                          label="Status"
                        >
                          <MenuItem value="Registered">Registered</MenuItem>
                          <MenuItem value="Pending">Pending</MenuItem>
                          <MenuItem value="None">None</MenuItem>
                        </Select>
                      </FormControl>

                      <FormControl fullWidth>
                        <InputLabel>Jurisdiction</InputLabel>
                        <Select
                          value={legalJurisdiction}
                          onChange={(e) => setLegalJurisdiction(e.target.value)}
                          label="Jurisdiction"
                        >
                          <MenuItem value="">Select Country</MenuItem>
                          {COUNTRIES.map((country) => (
                            <MenuItem key={country} value={country}>
                              {country}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={handleAddLegalAsset}
                        style={{ width: '100%' }}
                      >
                        Add Legal Asset
                      </Button>
                    </div>

                    {legalAssets.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-heading text-md font-semibold">Declared Assets ({legalAssets.length})</h4>
                        {legalAssets.map((asset) => (
                          <div
                            key={asset.id}
                            className="flex items-center justify-between p-3 bg-white rounded-lg border border-border-subtle"
                          >
                            <div className="flex-1">
                              <p className="font-body text-sm font-medium">
                                {asset.assetType}: {asset.name}
                              </p>
                              <p className="font-body text-xs text-text-muted">
                                Status: {asset.status}
                                {asset.jurisdiction && ` • ${asset.jurisdiction}`}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => handleRemoveLegalAsset(asset.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Team Wallets Section */}
                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-semibold">Team Wallets (Optional)</h3>
                    <p className="font-body text-sm text-text-secondary">
                      Add wallet addresses of team members for transparency.
                    </p>

                    <div className="space-y-4 p-4 bg-subtle-bg rounded-lg">
                      <TextField
                        label="Wallet Address"
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        fullWidth
                        placeholder="Solana wallet address"
                      />

                      <TextField
                        label="Label / Role"
                        value={walletLabel}
                        onChange={(e) => setWalletLabel(e.target.value)}
                        fullWidth
                        placeholder="e.g., Founder, Developer, Marketing"
                      />

                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={handleAddTeamWallet}
                        style={{ width: '100%' }}
                      >
                        Add Team Member
                      </Button>
                    </div>

                    {teamWallets.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-heading text-md font-semibold">Team Members ({teamWallets.length})</h4>
                        {teamWallets.map((wallet) => (
                          <div
                            key={wallet.id}
                            className="flex items-center justify-between p-3 bg-white rounded-lg border border-border-subtle"
                          >
                            <div className="flex-1">
                              <p className="font-body text-sm font-medium">{wallet.label}</p>
                              <p className="font-body text-xs text-text-muted break-all">{wallet.address}</p>
                            </div>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => handleRemoveTeamWallet(wallet.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 4 Navigation */}
                <div className="flex justify-start pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    onClick={() => setCurrentStep(3)}
                    className="w-full sm:w-auto"
                  >
                    ← Back
                  </Button>
                  {/* Final Submit Button is below */}
                </div>
              </>
            )}

            {/* Error Display (shown for all steps) */}
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

            {/* Submit Button (only on Step 4) */}
            {currentStep === 4 && (
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isSubmitting}
                className="w-full sm:w-auto sm:min-w-[200px]"
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
            )}
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
