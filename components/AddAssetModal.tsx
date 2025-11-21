'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
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
  Alert
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { getWalletTokenData } from '@/lib/token-balance'
import { calculateKarma } from '@/lib/karma'
import { toast } from 'react-hot-toast'

interface AddAssetModalProps {
  projectId: string
  tokenMint: string
  onClose: () => void
}

export function AddAssetModal({ projectId, tokenMint, onClose }: AddAssetModalProps) {
  const wallet = useWallet()
  const [assetType, setAssetType] = useState<'social' | 'creative' | 'legal'>('social')
  const [loading, setLoading] = useState(false)
  
  // Social asset fields
  const [platform, setPlatform] = useState('')
  const [handle, setHandle] = useState('')
  const [followerTier, setFollowerTier] = useState('')
  
  // Creative asset fields
  const [creativeName, setCreativeName] = useState('')
  const [creativeDescription, setCreativeDescription] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  
  // Legal asset fields
  const [legalType, setLegalType] = useState('')
  const [legalName, setLegalName] = useState('')
  const [status, setStatus] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  
  // Error states
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  
  const handleSubmit = async () => {
    if (!wallet.publicKey) {
      toast.error('Please connect your wallet')
      return
    }
    
    setLoading(true)
    
    try {
      // 1. Check wallet has tokens
      const tokenData = await getWalletTokenData(
        wallet.publicKey.toString(),
        tokenMint
      )
      
      if (!tokenData || tokenData.balance === 0) {
        toast.error('You must hold tokens to submit assets')
        setLoading(false)
        return
      }
      
      // 2. Check not banned
      const { data: karma } = await supabase
        .from('wallet_karma')
        .select('is_banned')
        .eq('wallet_address', wallet.publicKey.toString())
        .eq('project_id', projectId)
        .single()
      
      if (karma?.is_banned) {
        toast.error('Your wallet is banned from submitting')
        setLoading(false)
        return
      }
      
      // 3. Prepare asset data based on type
      let assetData: any = {}
      
      if (assetType === 'social') {
        const newErrors: Record<string, boolean> = {}
        if (!platform) newErrors.platform = true
        if (!handle) newErrors.handle = true
        
        if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors)
          toast.error('Please fill in all required fields')
          setLoading(false)
          return
        }
        
        // Strip @ from handle if user included it
        const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle
        
        // Check if this social account already exists in verified assets
        const { data: existingVerified } = await supabase
          .from('social_assets')
          .select('id')
          .eq('project_id', projectId)
          .eq('platform', platform.toLowerCase())
          .ilike('handle', cleanHandle)
          .maybeSingle()
        
        if (existingVerified) {
          toast.error(`This ${platform} account is already verified for this project`)
          setLoading(false)
          return
        }
        
        // Check if this social account already exists in pending assets
        const { data: existingPending } = await supabase
          .from('pending_assets')
          .select('asset_data')
          .eq('project_id', projectId)
          .eq('asset_type', 'social')
          .neq('verification_status', 'hidden')
        
        if (existingPending && existingPending.length > 0) {
          // Check if any pending asset has the same platform and handle
          for (const pending of existingPending) {
            const data = pending.asset_data as any
            if (data?.platform?.toLowerCase() === platform.toLowerCase() && 
                data?.handle?.toLowerCase() === cleanHandle.toLowerCase()) {
              toast.error(`This ${platform} account has already been submitted and is pending verification`)
              setLoading(false)
              return
            }
          }
        }
        
        assetData = { platform, handle: cleanHandle, followerTier }
      } else if (assetType === 'creative') {
        const newErrors: Record<string, boolean> = {}
        if (!creativeName) newErrors.creativeName = true
        
        if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors)
          toast.error('Please provide an asset name')
          setLoading(false)
          return
        }
        assetData = { name: creativeName, description: creativeDescription, mediaUrl }
      } else if (assetType === 'legal') {
        const newErrors: Record<string, boolean> = {}
        if (!legalType) newErrors.legalType = true
        if (!legalName) newErrors.legalName = true
        
        if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors)
          toast.error('Please fill in all required fields')
          setLoading(false)
          return
        }
        assetData = { assetType: legalType, name: legalName, status, jurisdiction }
      }
      
      // 4. Insert pending asset
      const { data: asset, error } = await supabase
        .from('pending_assets')
        .insert({
          project_id: projectId,
          asset_type: assetType,
          asset_data: assetData,
          submitter_wallet: wallet.publicKey.toString(),
          submission_token_balance: tokenData.balance,
          submission_token_percentage: tokenData.percentage,
          verification_status: 'pending'
        })
        .select()
        .single()
      
      if (error) {
        console.error('Failed to submit asset:', error)
        toast.error('Failed to submit asset')
        setLoading(false)
        return
      }
      
      // 5. Increment assets added count
      await supabase.rpc('increment_assets_added', {
        p_wallet: wallet.publicKey.toString(),
        p_project_id: projectId
      })
      
      // 6. Award immediate karma (25%)
      const immediateKarma = calculateKarma('add', tokenData.percentage, true)
      
      await supabase.rpc('add_karma', {
        p_wallet: wallet.publicKey.toString(),
        p_project_id: projectId,
        p_karma_delta: immediateKarma
      })
      
      // 7. Post to curation chat
      const assetSummary = 
        assetType === 'social' 
          ? `${platform}:${assetData.handle}`
          : assetType === 'creative'
          ? creativeName
          : legalName
      
      await supabase
        .from('curation_chat_messages')
        .insert({
          project_id: projectId,
          message_type: 'asset_added',
          wallet_address: wallet.publicKey.toString(),
          token_percentage: tokenData.percentage,
          pending_asset_id: asset.id,
          asset_type: assetType,
          asset_summary: assetSummary
        })
      
      toast.success(`Asset submitted! Earned ${immediateKarma.toFixed(1)} karma. Earn more when verified.`)
      onClose()
      
    } catch (error) {
      console.error('Error submitting asset:', error)
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Add Asset for Community Verification</DialogTitle>
      
      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          Submit assets for community review. Earn karma when verified!
        </Alert>
        
        <FormControl fullWidth sx={{ mt: 3, mb: 3 }}>
          <InputLabel>Asset Type</InputLabel>
          <Select
            value={assetType}
            onChange={(e) => {
              setAssetType(e.target.value as any)
              setErrors({}) // Clear errors when changing asset type
            }}
            label="Asset Type"
          >
            <MenuItem value="social">Social Account</MenuItem>
            <MenuItem value="creative">Creative Asset</MenuItem>
            <MenuItem value="legal">Legal Asset</MenuItem>
          </Select>
        </FormControl>
        
        {assetType === 'social' && (
          <>
            <FormControl fullWidth sx={{ mb: 3 }} error={errors.platform}>
              <InputLabel>Platform</InputLabel>
              <Select
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value)
                  setErrors(prev => ({ ...prev, platform: false }))
                }}
                label="Platform"
              >
                <MenuItem value="instagram">Instagram</MenuItem>
                <MenuItem value="twitter">Twitter</MenuItem>
                <MenuItem value="tiktok">TikTok</MenuItem>
                <MenuItem value="youtube">YouTube</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              label="Handle"
              placeholder="@username"
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value)
                setErrors(prev => ({ ...prev, handle: false }))
              }}
              error={errors.handle}
              helperText={errors.handle ? 'Handle is required' : ''}
              sx={{ mb: 3 }}
            />
            
            <FormControl fullWidth>
              <InputLabel>Follower Tier</InputLabel>
              <Select
                value={followerTier}
                onChange={(e) => setFollowerTier(e.target.value)}
                label="Follower Tier"
              >
                <MenuItem value="<10k">{'< 10k'}</MenuItem>
                <MenuItem value="10k-50k">10k - 50k</MenuItem>
                <MenuItem value="50k-100k">50k - 100k</MenuItem>
                <MenuItem value="100k-500k">100k - 500k</MenuItem>
                <MenuItem value="500k-1m">500k - 1M</MenuItem>
                <MenuItem value="1m-5m">1M - 5M</MenuItem>
                <MenuItem value="5m+">5M+</MenuItem>
              </Select>
            </FormControl>
          </>
        )}
        
        {assetType === 'creative' && (
          <>
            <TextField
              fullWidth
              label="Asset Name"
              value={creativeName}
              onChange={(e) => {
                setCreativeName(e.target.value)
                setErrors(prev => ({ ...prev, creativeName: false }))
              }}
              error={errors.creativeName}
              helperText={errors.creativeName ? 'Asset name is required' : ''}
              sx={{ mb: 3 }}
            />
            
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={creativeDescription}
              onChange={(e) => setCreativeDescription(e.target.value)}
              sx={{ mb: 3 }}
            />
            
            <TextField
              fullWidth
              label="Media URL (optional)"
              placeholder="https://..."
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
            />
          </>
        )}
        
        {assetType === 'legal' && (
          <>
            <FormControl fullWidth sx={{ mb: 3 }} error={errors.legalType}>
              <InputLabel>Legal Asset Type</InputLabel>
              <Select
                value={legalType}
                onChange={(e) => {
                  setLegalType(e.target.value)
                  setErrors(prev => ({ ...prev, legalType: false }))
                }}
                label="Legal Asset Type"
              >
                <MenuItem value="domain">Domain</MenuItem>
                <MenuItem value="trademark">Trademark</MenuItem>
                <MenuItem value="copyright">Copyright</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              label="Name"
              value={legalName}
              onChange={(e) => {
                setLegalName(e.target.value)
                setErrors(prev => ({ ...prev, legalName: false }))
              }}
              error={errors.legalName}
              helperText={errors.legalName ? 'Name is required' : ''}
              sx={{ mb: 3 }}
            />
            
            <TextField
              fullWidth
              label="Status"
              placeholder="e.g., Registered, Pending"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              sx={{ mb: 3 }}
            />
            
            <TextField
              fullWidth
              label="Jurisdiction (optional)"
              placeholder="e.g., USPTO, EU"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
            />
          </>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          sx={{ bgcolor: 'rgb(124, 77, 255)', '&:hover': { bgcolor: 'rgb(109, 67, 224)' } }}
        >
          {loading ? 'Submitting...' : 'Submit for Verification'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

