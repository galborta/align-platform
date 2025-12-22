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
  Alert,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Tooltip,
  Box,
  Typography
} from '@mui/material'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import { supabase } from '@/lib/supabase'
import { getWalletTokenData } from '@/lib/token-balance'
import { calculateKarma } from '@/lib/karma'
import { notifyAssetPending } from '@/lib/notifications/social-asset-notifications'
import { toast } from 'react-hot-toast'

interface AddAssetModalProps {
  projectId: string
  tokenMint: string
  onClose: () => void
}

export function AddAssetModal({ projectId, tokenMint, onClose }: AddAssetModalProps) {
  const wallet = useWallet()
  const [assetType, setAssetType] = useState<'social' | 'domain'>('social')
  const [loading, setLoading] = useState(false)
  const [assetClassification, setAssetClassification] = useState<'official' | 'affiliated'>('official')
  
  // Social asset fields
  const [platform, setPlatform] = useState('')
  const [handle, setHandle] = useState('')
  const [followerTier, setFollowerTier] = useState('')
  
  // Domain asset fields
  const [domainUrl, setDomainUrl] = useState('')
  
  // Error states
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  
  const cleanDomainUrl = (url: string): { domain: string; url: string } | null => {
    try {
      let cleanUrl = url.trim().toLowerCase()
      
      // Add https:// if no protocol
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl
      }
      
      const urlObj = new URL(cleanUrl)
      
      // Extract domain without www
      let domain = urlObj.hostname
      if (domain.startsWith('www.')) {
        domain = domain.substring(4)
      }
      
      return {
        domain,
        url: urlObj.toString()
      }
    } catch (err) {
      return null
    }
  }
  
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
      } else if (assetType === 'domain') {
        const newErrors: Record<string, boolean> = {}
        if (!domainUrl) newErrors.domain = true
        
        if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors)
          toast.error('Please fill in all required fields')
          setLoading(false)
          return
        }
        
        const cleaned = cleanDomainUrl(domainUrl)
        if (!cleaned) {
          toast.error('Please enter a valid domain or URL')
          setLoading(false)
          return
        }
        
        // Check for duplicate domain in verified assets
        const { data: existingVerified } = await supabase
          .from('social_assets')
          .select('id')
          .eq('project_id', projectId)
          .eq('platform', 'domain')
          .ilike('handle', cleaned.domain)
          .maybeSingle()
        
        if (existingVerified) {
          toast.error('This domain is already verified for this project')
          setLoading(false)
          return
        }
        
        // Check for duplicate domain in pending assets
        const { data: existingPending } = await supabase
          .from('pending_assets')
          .select('asset_data')
          .eq('project_id', projectId)
          .eq('asset_type', 'domain')
          .neq('verification_status', 'hidden')
        
        if (existingPending && existingPending.length > 0) {
          for (const pending of existingPending) {
            const data = pending.asset_data as any
            if (data?.domain?.toLowerCase() === cleaned.domain.toLowerCase()) {
              toast.error('This domain has already been submitted and is pending verification')
              setLoading(false)
              return
            }
          }
        }
        
        assetData = { 
          domain: cleaned.domain, 
          url: cleaned.url 
        }
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
          verification_status: 'pending',
          asset_classification: assetClassification
        })
        .select()
        .single()
      
      if (error) {
        console.error('Failed to submit asset:', error)
        toast.error('Failed to submit asset')
        setLoading(false)
        return
      }
      
      // 5. Send notification to project editors
      await notifyAssetPending(
        projectId,
        asset.id,
        wallet.publicKey.toString(),
        assetType,
        assetData,
        assetClassification
      )
      
      // 6. Increment assets added count
      await supabase.rpc('increment_assets_added', {
        p_wallet: wallet.publicKey.toString(),
        p_project_id: projectId
      })
      
      // 7. Award immediate karma (25%)
      const immediateKarma = calculateKarma('add', tokenData.percentage, true)
      
      await supabase.rpc('add_karma', {
        p_wallet: wallet.publicKey.toString(),
        p_project_id: projectId,
        p_karma_delta: immediateKarma
      })
      
      // 7. Post to curation chat
      const assetSummary = assetType === 'social' 
        ? `${platform}:${assetData.handle}`
        : `domain:${assetData.domain}`
      
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
      
      toast.success(
        `${assetClassification === 'official' ? 'Official' : 'Affiliated'} ${assetType} asset submitted! ` +
        `Earned ${immediateKarma.toFixed(1)} karma. Earn more when approved by editors.`
      )
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
        
        <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
          <FormLabel component="legend" sx={{ mb: 1, color: 'var(--text-primary)' }}>
            Asset Classification
          </FormLabel>
          <RadioGroup
            value={assetClassification}
            onChange={(e) => setAssetClassification(e.target.value as 'official' | 'affiliated')}
            row
          >
            <FormControlLabel 
              value="official" 
              control={<Radio sx={{ color: 'var(--accent-primary)', '&.Mui-checked': { color: 'var(--accent-primary)' } }} />} 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '14px', fontFamily: 'var(--font-body)' }}>
                    Official
                  </Typography>
                  <Tooltip 
                    title="Project-owned accounts. These are official social media accounts or domains directly controlled by the project team."
                    arrow
                  >
                    <InfoOutlined sx={{ fontSize: 16, color: 'var(--text-secondary)', cursor: 'help' }} />
                  </Tooltip>
                </Box>
              }
            />
            <FormControlLabel 
              value="affiliated" 
              control={<Radio sx={{ color: 'var(--accent-primary)', '&.Mui-checked': { color: 'var(--accent-primary)' } }} />} 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '14px', fontFamily: 'var(--font-body)' }}>
                    Affiliated
                  </Typography>
                  <Tooltip 
                    title="Community or partner accounts. These are related accounts not directly controlled by the project (influencers, community groups, partner organizations)."
                    arrow
                  >
                    <InfoOutlined sx={{ fontSize: 16, color: 'var(--text-secondary)', cursor: 'help' }} />
                  </Tooltip>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>
        
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Asset Type</InputLabel>
          <Select
            value={assetType}
            onChange={(e) => {
              setAssetType(e.target.value as 'social' | 'domain')
              setErrors({}) // Clear errors when changing asset type
            }}
            label="Asset Type"
          >
            <MenuItem value="social">Social Account</MenuItem>
            <MenuItem value="domain">Domain/Website</MenuItem>
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
        
        {assetType === 'domain' && (
          <>
            <TextField
              fullWidth
              label="Domain or Website URL"
              placeholder="example.com or https://example.com"
              value={domainUrl}
              onChange={(e) => {
                setDomainUrl(e.target.value)
                setErrors(prev => ({ ...prev, domain: false }))
              }}
              error={errors.domain}
              helperText={
                errors.domain 
                  ? 'Please enter a valid domain or URL' 
                  : 'Enter the project\'s official website or domain'
              }
              sx={{ mb: 3 }}
            />
            
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontFamily: 'var(--font-body)', fontSize: '14px' }}>
                This will be cleaned automatically:<br/>
                • &quot;https://www.example.com/path&quot; → &quot;example.com&quot;<br/>
                • &quot;example.com&quot; → &quot;example.com&quot;
              </Typography>
            </Alert>
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

