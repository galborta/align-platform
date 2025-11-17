'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletButton } from '@/components/WalletButton'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { getTokenMetadata, TokenMetadata } from '@/lib/solana'
import { supabase } from '@/lib/supabase'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Image from 'next/image'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'

type SocialPlatform = 'Instagram' | 'Twitter' | 'TikTok' | 'YouTube'
type FollowerTier = '<10k' | '10k-50k' | '50k-100k' | '100k-500k' | '500k-1m' | '1m-5m' | '5m+'

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

type LegalAssetType = 'Domain' | 'Trademark' | 'Copyright'
type LegalAssetStatus = 'Registered' | 'Pending' | 'None'

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

export default function CreatePage() {
  const router = useRouter()
  const { connected, publicKey } = useWallet()
  const { connection } = useConnection()
  const [mounted, setMounted] = useState(false)
  const [mintAddress, setMintAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenData, setTokenData] = useState<TokenMetadata | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)
  const [checkingExisting, setCheckingExisting] = useState(false)

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-detect existing projects when wallet connects
  useEffect(() => {
    if (mounted && connected && publicKey && !checkingExisting) {
      checkForExistingProjects()
    }
  }, [mounted, connected, publicKey])

  const checkForExistingProjects = async () => {
    if (!publicKey) return
    
    setCheckingExisting(true)
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, status')
        .eq('creator_wallet', publicKey.toString())
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error

      if (data && data.length > 0) {
        const project = data[0]
        
        // Redirect based on status
        if (project.status === 'pending') {
          router.push(`/review/${project.id}`)
          return
        } else if (project.status === 'live') {
          router.push(`/project/${project.id}`)
          return
        }
        // If draft or rejected, let them continue creating
      }

      // No existing projects or draft/rejected - advance to step 2
      if (currentStep === 1) {
        setCurrentStep(2)
      }
    } catch (err) {
      console.error('Error checking for existing projects:', err)
      // On error, just advance to step 2
      if (currentStep === 1) {
        setCurrentStep(2)
      }
    } finally {
      setCheckingExisting(false)
    }
  }

  // Step 4: IP Assets State
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

  const [submitting, setSubmitting] = useState(false)

  const handleFetchMetadata = async () => {
    if (!mintAddress.trim()) {
      setError('Please enter a token mint address')
      return
    }

    setLoading(true)
    setError(null)
    setTokenData(null)

    try {
      // Use the wallet's connection (devnet as configured in wallet-config.tsx)
      const metadata = await getTokenMetadata(mintAddress.trim(), connection)
      setTokenData(metadata)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch token metadata. Please check the mint address.')
    } finally {
      setLoading(false)
    }
  }

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
      const imageUrl = URL.createObjectURL(file)
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          if (img.width < 400 || img.height < 400) {
            reject(new Error('Image must be at least 400x400 pixels'))
          } else {
            resolve(true)
          }
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = imageUrl
      })

      // 4. Generate unique filename using mint address as projectId
      const projectId = mintAddress.trim()
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
      setImagePreview(imageUrl)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image')
      // Clear the file input
      event.target.value = ''
    } finally {
      setUploadingImage(false)
    }
  }

  const handleContinueToImage = () => {
    setCurrentStep(3)
  }

  const handleContinueToAssets = () => {
    setCurrentStep(4)
  }

  // Helper function to generate verification code
  const generateVerificationCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let code = 'align-'
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }

  // Helper to generate profile URL from platform and handle
  const generateProfileUrl = (platform: SocialPlatform, handle: string): string => {
    // Remove @ if user included it
    const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle
    
    const urlMap = {
      Instagram: `https://www.instagram.com/${cleanHandle}/`,
      Twitter: `https://twitter.com/${cleanHandle}`,
      TikTok: `https://www.tiktok.com/@${cleanHandle}`,
      YouTube: `https://www.youtube.com/@${cleanHandle}`
    }
    
    return urlMap[platform]
  }

  // Social Asset Handlers
  const handleAddSocialAsset = () => {
    if (!socialHandle.trim()) {
      setError('Please enter a handle')
      return
    }

    const profileUrl = generateProfileUrl(socialPlatform, socialHandle)
    const cleanHandle = socialHandle.startsWith('@') ? socialHandle.slice(1) : socialHandle

    const newAsset: SocialAsset = {
      id: Date.now().toString(),
      platform: socialPlatform,
      handle: cleanHandle,
      followerTier: socialFollowerTier,
      profileUrl: profileUrl,
      verificationCode: generateVerificationCode(),
      status: 'pending'
    }

    setSocialAssets([...socialAssets, newAsset])
    setSocialHandle('')
    setError(null)
  }

  const handleRemoveSocialAsset = (id: string) => {
    setSocialAssets(socialAssets.filter(asset => asset.id !== id))
  }

  // Creative Asset Handlers
  const handleCreativeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingCreative(true)
    setError(null)

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file')
      }

      const maxSize = 5 * 1024 * 1024
      if (file.size > maxSize) {
        throw new Error('Image must be less than 5MB')
      }

      const projectId = mintAddress.trim()
      const fileExt = file.name.split('.').pop()
      const fileName = `${projectId}-creative-${Date.now()}.${fileExt}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project-assets')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      const { data: { publicUrl } } = supabase.storage
        .from('project-assets')
        .getPublicUrl(fileName)

      const previewUrl = URL.createObjectURL(file)

      const newAsset: CreativeAsset = {
        id: Date.now().toString(),
        fileName: file.name,
        fileUrl: publicUrl,
        previewUrl: previewUrl
      }

      setCreativeAssets([...creativeAssets, newAsset])
      event.target.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload creative asset')
      event.target.value = ''
    } finally {
      setUploadingCreative(false)
    }
  }

  const handleRemoveCreativeAsset = (id: string) => {
    setCreativeAssets(creativeAssets.filter(asset => asset.id !== id))
  }

  // Legal Asset Handlers
  const handleAddLegalAsset = () => {
    if (!legalAssetName.trim()) {
      setError('Please enter a legal asset name')
      return
    }

    const newAsset: LegalAsset = {
      id: Date.now().toString(),
      assetType: legalAssetType,
      name: legalAssetName,
      status: legalAssetStatus,
      jurisdiction: legalAssetType === 'Trademark' ? legalJurisdiction : undefined
    }

    setLegalAssets([...legalAssets, newAsset])
    setLegalAssetName('')
    setLegalJurisdiction('')
    setError(null)
  }

  const handleRemoveLegalAsset = (id: string) => {
    setLegalAssets(legalAssets.filter(asset => asset.id !== id))
  }

  // Team Wallet Handlers
  const handleAddTeamWallet = () => {
    if (!walletAddress.trim() || !walletLabel.trim()) {
      setError('Please fill in both wallet address and label')
      return
    }

    const newWallet: TeamWallet = {
      id: Date.now().toString(),
      address: walletAddress,
      label: walletLabel
    }

    setTeamWallets([...teamWallets, newWallet])
    setWalletAddress('')
    setWalletLabel('')
    setError(null)
  }

  const handleRemoveTeamWallet = (id: string) => {
    setTeamWallets(teamWallets.filter(wallet => wallet.id !== id))
  }

  // Submit for Review
  const handleSubmitForReview = async () => {
    if (socialAssets.length === 0) {
      setError('Please add at least one social asset')
      return
    }

    if (!publicKey) {
      setError('Wallet not connected')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // 1. Insert project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert([{
          creator_wallet: publicKey.toString(),
          token_mint: mintAddress,
          token_name: tokenData?.name || '',
          token_symbol: tokenData?.symbol || '',
          profile_image_url: imageUrl,
          status: 'pending'
        }])
        .select()
        .single()

      if (projectError) throw projectError
      if (!projectData) throw new Error('Failed to create project')

      const projectId = projectData.id

      // 2. Insert social assets
      if (socialAssets.length > 0) {
        const { error: socialError } = await supabase
          .from('social_assets')
          .insert(
            socialAssets.map(asset => ({
              project_id: projectId,
              platform: asset.platform.toLowerCase() as 'instagram' | 'twitter' | 'tiktok' | 'youtube',
              handle: asset.handle,
              follower_tier: asset.followerTier,
              profile_url: asset.profileUrl,
              verification_code: asset.verificationCode,
              verified: false
            }))
          )
        if (socialError) throw socialError
      }

      // 3. Insert creative assets
      if (creativeAssets.length > 0) {
        const { error: creativeError } = await supabase
          .from('creative_assets')
          .insert(
            creativeAssets.map(asset => ({
              project_id: projectId,
              asset_type: 'artwork' as const,
              name: asset.fileName,
              media_url: asset.fileUrl
            }))
          )
        if (creativeError) throw creativeError
      }

      // 4. Insert legal assets
      if (legalAssets.length > 0) {
        const { error: legalError } = await supabase
          .from('legal_assets')
          .insert(
            legalAssets.map(asset => ({
              project_id: projectId,
              asset_type: asset.assetType.toLowerCase() as 'domain' | 'trademark' | 'copyright',
              name: asset.name,
              status: asset.status,
              jurisdiction: asset.jurisdiction || null
            }))
          )
        if (legalError) throw legalError
      }

      // 5. Insert team wallets
      if (teamWallets.length > 0) {
        const { error: walletsError } = await supabase
          .from('team_wallets')
          .insert(
            teamWallets.map(wallet => ({
              project_id: projectId,
              wallet_address: wallet.address,
              label: wallet.label
            }))
          )
        if (walletsError) throw walletsError
      }

      // Redirect to review page
      router.push(`/review/${projectId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit project')
    } finally {
      setSubmitting(false)
    }
  }

  const getPlatformIcon = (platform: SocialPlatform) => {
    const icons = {
      Instagram: '📷',
      Twitter: '🐦',
      TikTok: '🎵',
      YouTube: '▶️'
    }
    return icons[platform]
  }

  const shortenAddress = (address: string) => {
    if (address.length <= 16) return address
    return `${address.slice(0, 8)}...${address.slice(-8)}`
  }

  // Show loading state during hydration to prevent mismatch
  if (!mounted || checkingExisting) {
    return (
      <div className="min-h-screen bg-page-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="font-body text-text-secondary">
            {checkingExisting ? 'Checking your projects...' : 'Loading...'}
          </p>
        </div>
      </div>
    )
  }

  // Main render
  return (
    <div className="min-h-screen bg-page-bg">
      {/* Header */}
      <header className="border-b border-border-subtle bg-card-bg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold text-text-primary">
              Add Your Project
            </h1>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="border-b border-border-subtle bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Connect Wallet' },
              { num: 2, label: 'Token Info' },
              { num: 3, label: 'Profile Image' },
              { num: 4, label: 'IP Assets' }
            ].map((step, idx) => (
              <div key={step.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-sm ${
                    currentStep === step.num
                      ? 'bg-primary text-white ring-2 ring-primary ring-offset-2' 
                      : currentStep > step.num
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-400 border-2 border-gray-300'
                  }`}>
                    {currentStep > step.num ? '✓' : step.num}
                  </div>
                  <span className={`text-xs mt-2 text-center font-body ${
                    currentStep === step.num 
                      ? 'text-primary font-bold' 
                      : currentStep > step.num
                      ? 'text-purple-600 font-semibold'
                      : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {idx < 3 && (
                  <div className={`h-1 flex-1 mx-2 transition-all rounded ${
                    currentStep > step.num ? 'bg-purple-500' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step 1: Connect Wallet */}
        {currentStep === 1 && (
          <Card className="max-w-md mx-auto p-8">
            <CardContent className="p-0 text-center">
              <h2 className="font-display text-2xl font-bold text-text-primary mb-4">
                Connect Your Wallet
              </h2>
              <p className="font-body text-text-secondary mb-6">
                Connect your wallet to get started adding your project
              </p>
              <WalletButton />
            </CardContent>
          </Card>
        )}

        {/* Step 2: Token Info */}
        {currentStep === 2 && (
        <Card className="p-6">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-2xl">Token Information</CardTitle>
            <p className="font-body text-text-secondary mt-2">
              Enter your token's mint address to get started
            </p>
          </CardHeader>

          <CardContent className="p-0 space-y-6">
            {/* Token Input */}
            <div className="space-y-4">
              <TextField
                label="Token Contract Address (Solana mint)"
                placeholder="GtDZKAqvMZMnti46ZewMiXCa4oXF4bZxwQPoKzXPFxZn"
                fullWidth
                value={mintAddress}
                onChange={(e) => setMintAddress(e.target.value)}
                disabled={loading}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'var(--font-body)',
                    '& fieldset': {
                      borderColor: '#E5E7F0',
                    },
                    '&:hover fieldset': {
                      borderColor: '#7C4DFF',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#7C4DFF',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    fontFamily: 'var(--font-body)',
                  },
                }}
              />

              <Button
                onClick={handleFetchMetadata}
                disabled={loading || !mintAddress.trim()}
                variant="primary"
                className="w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <CircularProgress size={20} className="mr-2" color="inherit" />
                    Fetching...
                  </>
                ) : (
                  'Fetch Token Info'
                )}
              </Button>
            </div>

            {/* Error Display */}
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Token Data Preview */}
            {tokenData && (
              <div className="space-y-6">
                <div className="border-t border-border-subtle pt-6">
                  <h3 className="font-display text-lg font-semibold text-text-primary mb-4">
                    Token Preview
                  </h3>
                  
                  <div className="bg-subtle-bg rounded-lg p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="font-body text-sm text-text-muted">Token Name</label>
                        <p className="font-body text-text-primary font-medium">{tokenData.name}</p>
                      </div>
                      
                      <div>
                        <label className="font-body text-sm text-text-muted">Symbol</label>
                        <p className="font-body text-text-primary font-medium">{tokenData.symbol}</p>
                      </div>
                      
                      <div>
                        <label className="font-body text-sm text-text-muted">Total Supply</label>
                        <p className="font-body text-text-primary font-medium">{tokenData.supply}</p>
                      </div>
                      
                      <div>
                        <label className="font-body text-sm text-text-muted">Decimals</label>
                        <p className="font-body text-text-primary font-medium">{tokenData.decimals}</p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="font-body text-sm text-text-muted">Mint Address</label>
                      <p className="font-body text-xs text-text-secondary break-all">{tokenData.mintAddress}</p>
                    </div>
                  </div>
                </div>

                {/* Continue Button */}
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleContinueToImage}
                    variant="success"
                    size="lg"
                  >
                    Continue to Profile Image
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Step 3: Profile Image */}
        {currentStep === 3 && (
          <Card className="p-6">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-2xl">Profile Image</CardTitle>
              <p className="font-body text-text-secondary mt-2">
                    Upload a profile image for your project (min 400x400px, max 5MB)
                  </p>
            </CardHeader>

            <CardContent className="p-0 space-y-6">
              {/* Error Display */}
              {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

                    {/* File Input */}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="block w-full text-sm text-text-secondary
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-lg file:border-0
                          file:text-sm file:font-semibold
                          file:bg-primary file:text-white
                          hover:file:bg-primary-hover
                          file:cursor-pointer
                          disabled:opacity-50 disabled:cursor-not-allowed"
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

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-4">
                <Button
                  onClick={() => setCurrentStep(2)}
                  variant="secondary"
                  size="lg"
                >
                  Back
                </Button>
                <Button
                  onClick={handleContinueToAssets}
                  variant="success"
                  size="lg"
                  disabled={!imageUrl}
                >
                  Continue to IP Assets
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: IP Assets */}
        {currentStep === 4 && (
          <div className="space-y-8">
            <Card className="p-6">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-2xl">Step 4: Declare IP Assets</CardTitle>
                <p className="font-body text-text-secondary mt-2">
                  Declare all intellectual property assets associated with your project
                </p>
              </CardHeader>

              <CardContent className="p-0 space-y-8">
                {/* Error Display */}
                {error && (
                  <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}

                {/* Section 1: Social Assets (Required) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-text-primary">
                      Social Assets
                    </h3>
                    <span className="text-xs font-semibold bg-primary text-white px-2 py-1 rounded">
                      Required - at least 1
                    </span>
                  </div>

                  {/* Social Asset Form */}
                  <div className="bg-subtle-bg rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormControl fullWidth>
                        <InputLabel>Platform</InputLabel>
                        <Select
                          value={socialPlatform}
                          label="Platform"
                          onChange={(e) => setSocialPlatform(e.target.value as SocialPlatform)}
                        >
                          <MenuItem value="Instagram">Instagram</MenuItem>
                          <MenuItem value="Twitter">Twitter</MenuItem>
                          <MenuItem value="TikTok">TikTok</MenuItem>
                          <MenuItem value="YouTube">YouTube</MenuItem>
                        </Select>
                      </FormControl>

                      <TextField
                        label="Handle"
                        placeholder="username or @username"
                        fullWidth
                        value={socialHandle}
                        onChange={(e) => setSocialHandle(e.target.value)}
                      />

                      <FormControl fullWidth>
                        <InputLabel>Follower Tier</InputLabel>
                        <Select
                          value={socialFollowerTier}
                          label="Follower Tier"
                          onChange={(e) => setSocialFollowerTier(e.target.value as FollowerTier)}
                        >
                          <MenuItem value="<10k">&lt;10k</MenuItem>
                          <MenuItem value="10k-50k">10k-50k</MenuItem>
                          <MenuItem value="50k-100k">50k-100k</MenuItem>
                          <MenuItem value="100k-500k">100k-500k</MenuItem>
                          <MenuItem value="500k-1m">500k-1m</MenuItem>
                          <MenuItem value="1m-5m">1m-5m</MenuItem>
                          <MenuItem value="5m+">5m+</MenuItem>
                        </Select>
                      </FormControl>
                    </div>

                    <Button
                      onClick={handleAddSocialAsset}
                      variant="primary"
                      className="w-full sm:w-auto"
                    >
                      Add Social Account
                    </Button>
                  </div>

                  {/* Social Assets List */}
                  {socialAssets.length > 0 && (
                    <div className="space-y-2">
                      {socialAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="bg-white border border-border-subtle rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{getPlatformIcon(asset.platform)}</span>
                              <div>
                                <p className="font-body font-semibold text-text-primary">
                                  {asset.platform} - @{asset.handle}
                                </p>
                                <p className="font-body text-sm text-text-secondary">
                                  {asset.followerTier} followers
                                </p>
                                <a 
                                  href={asset.profileUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="font-body text-xs text-primary hover:underline"
                                >
                                  {asset.profileUrl}
                                </a>
                              </div>
                            </div>
                            <Button
                              onClick={() => handleRemoveSocialAsset(asset.id)}
                              variant="danger"
                              size="sm"
                            >
                              Remove
                            </Button>
                          </div>
                          
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="font-body text-sm font-semibold text-amber-900 mb-1">
                              Add this code to your {asset.platform} bio:
                            </p>
                            <code className="font-mono text-sm bg-white px-2 py-1 rounded border border-amber-300 text-amber-900">
                              {asset.verificationCode}
                            </code>
                            <p className="font-body text-xs text-amber-700 mt-2">
                              Status: <span className="font-semibold">Pending Verification</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 2: Creative Assets (Optional) */}
                <div className="border-t border-border-subtle pt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-text-primary">
                      Creative Assets
                    </h3>
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                      Optional
                    </span>
                  </div>
                  <p className="font-body text-text-secondary text-sm">
                    Upload logos, characters, or other creative assets (max 5MB each)
                  </p>

                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCreativeUpload}
                      disabled={uploadingCreative}
                      className="block w-full text-sm text-text-secondary
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-primary file:text-white
                        hover:file:bg-primary-hover
                        file:cursor-pointer
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {uploadingCreative && (
                      <div className="flex items-center mt-2">
                        <CircularProgress size={16} className="mr-2" />
                        <span className="font-body text-sm text-text-secondary">Uploading...</span>
                      </div>
                    )}
                  </div>

                  {/* Creative Assets Grid */}
                  {creativeAssets.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {creativeAssets.map((asset) => (
                        <div key={asset.id} className="relative group">
                          <div className="relative w-full aspect-square rounded-lg overflow-hidden border-2 border-border-subtle">
                            <Image
                              src={asset.previewUrl}
                              alt={asset.fileName}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <p className="font-body text-xs text-text-secondary mt-1 truncate">
                            {asset.fileName}
                          </p>
                          <Button
                            onClick={() => handleRemoveCreativeAsset(asset.id)}
                            variant="danger"
                            size="sm"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 3: Legal Assets (Optional) */}
                <div className="border-t border-border-subtle pt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-text-primary">
                      Legal Assets
                    </h3>
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                      Optional
                    </span>
                  </div>

                  {/* Legal Asset Form */}
                  <div className="bg-subtle-bg rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormControl fullWidth>
                        <InputLabel>Asset Type</InputLabel>
                        <Select
                          value={legalAssetType}
                          label="Asset Type"
                          onChange={(e) => setLegalAssetType(e.target.value as LegalAssetType)}
                        >
                          <MenuItem value="Domain">Domain</MenuItem>
                          <MenuItem value="Trademark">Trademark</MenuItem>
                          <MenuItem value="Copyright">Copyright</MenuItem>
                        </Select>
                      </FormControl>

                      <TextField
                        label="Name"
                        placeholder="e.g., example.com"
                        fullWidth
                        value={legalAssetName}
                        onChange={(e) => setLegalAssetName(e.target.value)}
                      />

                      <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                          value={legalAssetStatus}
                          label="Status"
                          onChange={(e) => setLegalAssetStatus(e.target.value as LegalAssetStatus)}
                        >
                          <MenuItem value="Registered">Registered</MenuItem>
                          <MenuItem value="Pending">Pending</MenuItem>
                          <MenuItem value="None">None</MenuItem>
                        </Select>
                      </FormControl>

                      {legalAssetType === 'Trademark' && (
                        <FormControl fullWidth>
                          <InputLabel>Jurisdiction</InputLabel>
                          <Select
                            value={legalJurisdiction}
                            label="Jurisdiction"
                            onChange={(e) => setLegalJurisdiction(e.target.value)}
                          >
                            {COUNTRIES.map(country => (
                              <MenuItem key={country} value={country}>{country}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    </div>

                    <Button
                      onClick={handleAddLegalAsset}
                      variant="primary"
                      className="w-full sm:w-auto"
                    >
                      Add Legal Asset
                    </Button>
                  </div>

                  {/* Legal Assets List */}
                  {legalAssets.length > 0 && (
                    <div className="space-y-2">
                      {legalAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="bg-white border border-border-subtle rounded-lg p-4 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-body font-semibold text-text-primary">
                              {asset.name}
                            </p>
                            <p className="font-body text-sm text-text-secondary">
                              {asset.assetType} - {asset.status}
                              {asset.jurisdiction && ` (${asset.jurisdiction})`}
                            </p>
                          </div>
                          <Button
                            onClick={() => handleRemoveLegalAsset(asset.id)}
                            variant="danger"
                            size="sm"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 4: Team Wallets (Optional) */}
                <div className="border-t border-border-subtle pt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-text-primary">
                      Team Wallets
                    </h3>
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                      Optional
                    </span>
                  </div>

                  {/* Team Wallet Form */}
                  <div className="bg-subtle-bg rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TextField
                        label="Wallet Address"
                        placeholder="Enter Solana wallet address"
                        fullWidth
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                      />

                      <TextField
                        label="Label"
                        placeholder="e.g., Development, Marketing"
                        fullWidth
                        value={walletLabel}
                        onChange={(e) => setWalletLabel(e.target.value)}
                      />
                    </div>

                    <Button
                      onClick={handleAddTeamWallet}
                      variant="primary"
                      className="w-full sm:w-auto"
                    >
                      Add Wallet
                    </Button>
                  </div>

                  {/* Team Wallets List */}
                  {teamWallets.length > 0 && (
                    <div className="space-y-2">
                      {teamWallets.map((wallet) => (
                        <div
                          key={wallet.id}
                          className="bg-white border border-border-subtle rounded-lg p-4 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-body font-semibold text-text-primary">
                              {wallet.label}
                            </p>
                            <p className="font-mono text-sm text-text-secondary">
                              {shortenAddress(wallet.address)}
                            </p>
                          </div>
                          <Button
                            onClick={() => handleRemoveTeamWallet(wallet.id)}
                            variant="danger"
                            size="sm"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit for Review Button */}
                <div className="border-t border-border-subtle pt-6 flex justify-end gap-4">
                  <Button
                    onClick={() => setCurrentStep(3)}
                    variant="secondary"
                    size="lg"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmitForReview}
                    variant="success"
                    size="lg"
                    disabled={socialAssets.length === 0 || submitting}
                  >
                    {submitting ? (
                      <>
                        <CircularProgress size={20} className="mr-2" color="inherit" />
                        Submitting...
                      </>
                    ) : (
                      'Submit for Review'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
              </div>
            )}
      </main>
    </div>
  )
}

