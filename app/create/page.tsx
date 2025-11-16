'use client'

import { useState } from 'react'
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

export default function CreatePage() {
  const { connected } = useWallet()
  const { connection } = useConnection()
  const [mintAddress, setMintAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenData, setTokenData] = useState<TokenMetadata | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

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

  const handleContinue = () => {
    // TODO: Navigate to next step
    console.log('Continue with token data:', tokenData)
    console.log('Image URL:', imageUrl)
  }

  // Step 1: Require wallet connection
  if (!connected) {
    return (
      <div className="min-h-screen bg-page-bg flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full p-8">
          <CardContent className="p-0 text-center">
            <h1 className="font-display text-2xl font-bold text-text-primary mb-4">
              Add Your Project
            </h1>
            <p className="font-body text-text-secondary mb-6">
              Connect your wallet to add your project
            </p>
            <WalletButton />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Step 2: Token Input Form
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

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

                {/* Step 3: Profile Image Upload */}
                <div className="border-t border-border-subtle pt-6">
                  <h3 className="font-display text-lg font-semibold text-text-primary mb-2">
                    Profile Image
                  </h3>
                  <p className="font-body text-text-secondary text-sm mb-4">
                    Upload a profile image for your project (min 400x400px, max 5MB)
                  </p>

                  <div className="space-y-4">
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
                  </div>
                </div>

                {/* Continue Button */}
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleContinue}
                    variant="success"
                    size="lg"
                    disabled={!imageUrl}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

