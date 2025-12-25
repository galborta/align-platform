'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Tabs, Tab, Box } from '@mui/material'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import LockIcon from '@mui/icons-material/LockOutlined'
import ErrorIcon from '@mui/icons-material/ErrorOutline'
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined'
import PersonIcon from '@mui/icons-material/Person'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import GroupIcon from '@mui/icons-material/Group'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import ImageIcon from '@mui/icons-material/Image'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import AddIcon from '@mui/icons-material/Add'
import Image from 'next/image'
import { truncateAddress, validateEditorWallets } from '@/lib/wallet-validation'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

interface Editor {
  wallet_address: string
  added_at: string
  added_by: string
  last_active?: string
  added_via?: 'creation' | 'invite' | 'direct'
}

interface CreativeAsset {
  id: string
  name: string | null
  media_url: string | null
  created_at: string
}

interface ProjectWallet {
  id: string
  wallet_address: string
  label: string | null
  wallet_type?: string
  created_at: string
}

interface SocialAsset {
  id: string
  platform: string
  handle: string
  follower_tier: string | null
  profile_url: string | null
  verified: boolean | null
  created_at: string
}

interface EditProjectModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** Project data to edit */
  project: {
    id: string
    token_name: string
    token_symbol: string
    token_mint: string
    description: string | null
    profile_image_url: string | null
    creator_wallet: string
    editor_wallets: string[]
  }
  /** Callback after successful update */
  onProjectUpdated: () => void
}

export default function EditProjectModal({
  open,
  onClose,
  project,
  onProjectUpdated
}: EditProjectModalProps) {
  const { publicKey, signMessage } = useWallet()
  
  // Tab state
  const [currentTab, setCurrentTab] = useState(0)
  
  // Project Info Form state
  const [description, setDescription] = useState('')
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  
  // Editor Management state
  const [currentEditors, setCurrentEditors] = useState<Editor[]>([])
  const [walletInput, setWalletInput] = useState('')
  const [isAddingEditor, setIsAddingEditor] = useState(false)
  const [removingWallet, setRemovingWallet] = useState<string | null>(null)
  
  // Social Assets state (telegram, domains, social accounts)
  const [socialAssets, setSocialAssets] = useState<SocialAsset[]>([])
  const [loadingSocial, setLoadingSocial] = useState(false)
  const [telegram, setTelegram] = useState('')
  const [domains, setDomains] = useState<string[]>([])
  const [newDomain, setNewDomain] = useState('')
  const [newSocialPlatform, setNewSocialPlatform] = useState('Instagram')
  const [newSocialHandle, setNewSocialHandle] = useState('')
  const [newSocialFollowerTier, setNewSocialFollowerTier] = useState('<10k')
  const [addingSocial, setAddingSocial] = useState(false)
  const [deletingSocialId, setDeletingSocialId] = useState<string | null>(null)
  const [hasChangedSocial, setHasChangedSocial] = useState(false)
  
  // Creative Assets state
  const [creativeAssets, setCreativeAssets] = useState<CreativeAsset[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [uploadingAsset, setUploadingAsset] = useState(false)
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null)
  
  // Project Wallets state
  const [projectWallets, setProjectWallets] = useState<ProjectWallet[]>([])
  const [loadingWallets, setLoadingWallets] = useState(false)
  const [newWalletAddress, setNewWalletAddress] = useState('')
  const [newWalletType, setNewWalletType] = useState<'team' | 'treasury' | 'liquidity' | 'other'>('team')
  const [newWalletRole, setNewWalletRole] = useState('Founder')
  const [newWalletLabel, setNewWalletLabel] = useState('')
  const [addingWallet, setAddingWallet] = useState(false)
  const [deletingWalletId, setDeletingWalletId] = useState<string | null>(null)
  
  // Validation errors
  const [errors, setErrors] = useState<{
    description?: string
    profileImageUrl?: string
    editor?: string
    asset?: string
    wallet?: string
  }>({})
  
  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // Track original social values for change detection
  const [originalTelegram, setOriginalTelegram] = useState('')
  const [originalDomains, setOriginalDomains] = useState<string[]>([])

  const isCreator = publicKey?.toBase58() === project.creator_wallet
  const isEditor = project.editor_wallets?.includes(publicKey?.toBase58() || '')
  const canEditProject = isCreator || isEditor
  
  // Combined change detection for both Project Info and Social tabs
  const hasProjectInfoChanges = description !== (project.description || '') || 
    profileImageUrl !== (project.profile_image_url || '')
  const hasSocialChanges = telegram !== originalTelegram || 
    JSON.stringify(domains) !== JSON.stringify(originalDomains)
  const hasAnyChanges = hasProjectInfoChanges || hasSocialChanges

  /**
   * Normalize domain input by removing protocols and www
   * @param input - Raw domain input (e.g., "https://www.example.com", "example.com")
   * @returns Normalized domain (e.g., "example.com")
   */
  const normalizeDomain = (input: string): string => {
    let domain = input.trim()
    
    // Remove protocol (http://, https://)
    domain = domain.replace(/^https?:\/\//, '')
    
    // Remove www. prefix
    domain = domain.replace(/^www\./, '')
    
    // Remove trailing slash
    domain = domain.replace(/\/$/, '')
    
    // Remove path (everything after first /)
    domain = domain.split('/')[0]
    
    return domain
  }

  /**
   * Create a clickable URL from a normalized domain
   * @param domain - Normalized domain (e.g., "example.com")
   * @returns Full URL with https:// (e.g., "https://example.com")
   */
  const getDomainUrl = (domain: string): string => {
    return `https://${domain}`
  }

  // Pre-populate form when modal opens
  useEffect(() => {
    if (project && open) {
      setDescription(project.description || '')
      setProfileImageUrl(project.profile_image_url || '')
      setImagePreview(project.profile_image_url || null)
      setHasChanges(false)
      setErrors({})
      setSuccessMessage(null)
      setCurrentTab(0)
      
      // Load editors with metadata
      const editors: Editor[] = (project.editor_wallets || []).map(wallet => ({
        wallet_address: wallet,
        added_at: new Date().toISOString(),
        added_by: project.creator_wallet
      }))
      setCurrentEditors(editors)
      
      // Load creative assets, social assets, and project wallets
      loadSocialAssets()
      loadCreativeAssets()
      loadProjectWallets()
    }
  }, [project, open])

  // Track if anything changed
  useEffect(() => {
    if (!project) return
    
    const changed = 
      description !== (project.description || '') ||
      profileImageUrl !== (project.profile_image_url || '')
    
    setHasChanges(changed)
  }, [description, profileImageUrl, project])

  /**
   * Load creative assets from database
   */
  const loadCreativeAssets = async () => {
    setLoadingAssets(true)
    try {
      const { data, error } = await supabase
        .from('creative_assets')
        .select('id, name, media_url, created_at')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setCreativeAssets(data || [])
    } catch (err) {
      console.error('Error loading creative assets:', err)
    } finally {
      setLoadingAssets(false)
    }
  }

  /**
   * Load social assets (telegram, domains, social accounts)
   * Includes both manually added and community-approved assets
   */
  const loadSocialAssets = async () => {
    setLoadingSocial(true)
    try {
      // Load website, telegram, and domains from project record
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('website, telegram, domains')
        .eq('id', project.id)
        .single()
      
      if (!projectError && projectData) {
        const telegramValue = (projectData as any).telegram || ''
        setTelegram(telegramValue)
        setOriginalTelegram(telegramValue)
        
        // Merge website into domains array (website becomes first domain)
        const websiteValue = (projectData as any).website
        const domainsValue = (projectData as any).domains || []
        
        const allDomains: string[] = []
        if (websiteValue && websiteValue.trim()) {
          const normalizedWebsite = normalizeDomain(websiteValue)
          if (normalizedWebsite) allDomains.push(normalizedWebsite)
        }
        // Add other domains that aren't duplicates
        domainsValue.forEach((d: string) => {
          if (!allDomains.includes(d)) {
            allDomains.push(d)
          }
        })
        
        setDomains(allDomains)
        setOriginalDomains([...allDomains])
      }
      
      // Load social assets (includes both manual and community-approved)
      const { data: socialData, error: socialError } = await supabase
        .from('social_assets')
        .select('*')
        .eq('project_id', project.id)
        .neq('platform', 'Website') // Exclude the legacy Website record
        .order('verified', { ascending: false }) // Show verified (community-approved) first
        .order('created_at', { ascending: false })
      
      if (socialError) throw socialError
      
      setSocialAssets(socialData || [])
      
    } catch (err) {
      console.error('Error loading social assets:', err)
    } finally {
      setLoadingSocial(false)
    }
  }

  /**
   * Load project wallets from database
   */
  const loadProjectWallets = async () => {
    setLoadingWallets(true)
    try {
      const { data, error } = await supabase
        .from('team_wallets')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setProjectWallets(data || [])
    } catch (err) {
      console.error('Error loading project wallets:', err)
    } finally {
      setLoadingWallets(false)
    }
  }

  /**
   * Handle image upload
   */
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    setErrors({ ...errors, profileImageUrl: undefined })

    try {
      // Validate: image only
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file')
      }

      // Validate: max 5MB
      const maxSize = 5 * 1024 * 1024
      if (file.size > maxSize) {
        throw new Error('Image must be less than 5MB')
      }

      // Validate: min 400x400px
      const img = new window.Image()
      const imageObjectUrl = URL.createObjectURL(file)
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          if (img.width < 400 || img.height < 400) {
            reject(new Error(`Image is too small (${img.width}x${img.height}). Please upload an image that is at least 400x400 pixels.`))
          } else {
            resolve(true)
          }
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = imageObjectUrl
      })

      // Generate unique filename using project ID
      const fileExt = file.name.split('.').pop()
      const fileName = `${project.token_mint}-profile.${fileExt}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project-assets')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('project-assets')
        .getPublicUrl(fileName)

      // Set the image URL and preview
      setProfileImageUrl(publicUrl)
      setImagePreview(imageObjectUrl)
      setHasChanges(true)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload image'
      setErrors({ ...errors, profileImageUrl: errorMessage })
      event.target.value = ''
    } finally {
      setUploadingImage(false)
    }
  }

  /**
   * Handle asset image upload (simplified - just image, auto-generated name)
   */
  const handleAssetUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingAsset(true)
    setErrors({ ...errors, asset: undefined })

    try {
      // Validate: image only
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file')
      }

      // Validate: max 5MB
      const maxSize = 5 * 1024 * 1024
      if (file.size > maxSize) {
        throw new Error('Image must be less than 5MB')
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${project.id}-${Date.now()}.${fileExt}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('project-assets')
        .upload(fileName, file, {
          contentType: file.type,
        })

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('project-assets')
        .getPublicUrl(fileName)

      // Save to database with auto-generated name
      const { error: dbError } = await supabase
        .from('creative_assets')
        .insert({
          project_id: project.id,
          name: file.name, // Use original filename
          media_url: publicUrl
        })

      if (dbError) throw dbError

      // Reload assets
      await loadCreativeAssets()
      event.target.value = ''
      
      setSuccessMessage('Asset uploaded successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload asset'
      setErrors({ ...errors, asset: errorMessage })
      event.target.value = ''
    } finally {
      setUploadingAsset(false)
    }
  }

  /**
   * Delete a creative asset
   */
  const handleDeleteAsset = async (assetId: string, mediaUrl: string | null) => {
    if (!confirm('Delete this asset? This action cannot be undone.')) {
      return
    }

    setDeletingAssetId(assetId)
    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from('creative_assets')
        .delete()
        .eq('id', assetId)

      if (dbError) throw dbError

      // Try to delete from storage if there's a media URL
      if (mediaUrl) {
        const fileName = mediaUrl.split('/').pop()
        if (fileName) {
          await supabase.storage
            .from('project-assets')
            .remove([fileName])
        }
      }

      await loadCreativeAssets()
      setSuccessMessage('Asset deleted successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)

    } catch (err) {
      console.error('Error deleting asset:', err)
      alert('Failed to delete asset')
    } finally {
      setDeletingAssetId(null)
    }
  }

  /**
   * Add a project wallet
   */
  const handleAddProjectWallet = async () => {
    if (!newWalletAddress.trim()) {
      setErrors({ ...errors, wallet: 'Please enter a wallet address' })
      return
    }

    // Validate Solana wallet address
    try {
      new PublicKey(newWalletAddress.trim())
    } catch (err) {
      setErrors({ ...errors, wallet: 'Invalid Solana wallet address' })
      return
    }

    let finalLabel = ''
    
    if (newWalletType === 'team') {
      finalLabel = newWalletRole === 'Other' ? newWalletLabel.trim() : newWalletRole
      if (newWalletRole === 'Other' && !newWalletLabel.trim()) {
        setErrors({ ...errors, wallet: 'Please specify a custom role' })
        return
      }
    } else if (newWalletType === 'treasury') {
      finalLabel = 'Treasury'
    } else if (newWalletType === 'liquidity') {
      finalLabel = 'Liquidity Provision'
    } else if (newWalletType === 'other') {
      if (!newWalletLabel.trim()) {
        setErrors({ ...errors, wallet: 'Please describe this wallet' })
        return
      }
      finalLabel = newWalletLabel.trim()
    }

    setAddingWallet(true)
    setErrors({ ...errors, wallet: undefined })

    try {
      const { error } = await supabase
        .from('team_wallets')
        .insert({
          project_id: project.id,
          wallet_address: newWalletAddress.trim(),
          label: finalLabel,
          wallet_type: newWalletType
        })

      if (error) throw error

      await loadProjectWallets()
      
      // Clear form
      setNewWalletAddress('')
      setNewWalletRole('Founder')
      setNewWalletLabel('')
      setNewWalletType('team')
      
      setSuccessMessage('Wallet added successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add wallet'
      setErrors({ ...errors, wallet: errorMessage })
    } finally {
      setAddingWallet(false)
    }
  }

  /**
   * Delete a project wallet
   */
  const handleDeleteProjectWallet = async (walletId: string) => {
    if (!confirm('Remove this wallet? This action cannot be undone.')) {
      return
    }

    setDeletingWalletId(walletId)
    try {
      const { error } = await supabase
        .from('team_wallets')
        .delete()
        .eq('id', walletId)

      if (error) throw error

      await loadProjectWallets()
      setSuccessMessage('Wallet removed successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)

    } catch (err) {
      console.error('Error deleting wallet:', err)
      alert('Failed to remove wallet')
    } finally {
      setDeletingWalletId(null)
    }
  }

  /**
   * Validate form fields
   */
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {}

    // Description validation
    if (description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters'
    }
    if (description.length > 500) {
      newErrors.description = 'Description must be under 500 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  /**
   * Handle unified save for all editable tabs (Project Info + Social)
   * Uses session-based auth instead of per-action signatures
   */
  const handleSaveAll = async () => {
    if (!publicKey) {
      alert('Please connect your wallet')
      return
    }

    // Validate project info form if it has changes
    if (hasProjectInfoChanges && !validateForm()) {
      return
    }

    setIsSaving(true)

    try {
      const walletAddress = publicKey.toBase58()
      
      // Save project info changes if any
      if (hasProjectInfoChanges) {
        const response = await fetch('/api/projects/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: project.id,
            description: description.trim(),
            profile_image_url: profileImageUrl.trim() || null,
            wallet: walletAddress
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to save project info')
        }
      }

      // Save social changes if any
      if (hasSocialChanges) {
        const { error: updateError } = await supabase
          .from('projects')
          .update({
            website: domains.length > 0 ? domains[0] : null,
            telegram: telegram || null,
            domains: domains.length > 0 ? domains : null,
          })
          .eq('id', project.id)

        if (updateError) throw updateError
        
        // Update original values to reflect saved state
        setOriginalTelegram(telegram)
        setOriginalDomains([...domains])
        setHasChangedSocial(false)
      }

      // Success
      setSuccessMessage('All changes saved successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
      onProjectUpdated()
      setHasChanges(false)
      onClose()

    } catch (error) {
      console.error('[Edit Project Modal] Error saving:', error)
      alert(error instanceof Error ? error.message : 'Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Handle close with unsaved changes warning
   */
  const handleClose = () => {
    if (hasAnyChanges && !isSaving) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose()
      }
    } else if (!isSaving) {
      onClose()
    }
  }

  /**
   * Handle adding a new editor
   */
  const handleAddEditor = async () => {
    if (!publicKey || !signMessage) {
      setErrors({ ...errors, editor: 'Please connect your wallet' })
      return
    }

    const trimmedWallet = walletInput.trim()

    // Validate input
    const currentWallets = currentEditors.map(e => e.wallet_address)
    const validation = validateEditorWallets(
      [trimmedWallet],
      {
        creatorWallet: project.creator_wallet,
        existingEditors: currentWallets,
        maxEditors: 20
      }
    )

    if (!validation.valid) {
      setErrors({ ...errors, editor: validation.error || 'Invalid wallet' })
      return
    }

    setIsAddingEditor(true)
    setErrors({ ...errors, editor: undefined })
    setSuccessMessage(null)

    try {
      // Generate signature message
      const message = `Add editor to ${project.token_name}\nWallet: ${trimmedWallet}\nTimestamp: ${Date.now()}`
      const messageBytes = new TextEncoder().encode(message)
      const signature = await signMessage(messageBytes)
      const signatureBase58 = bs58.encode(signature)

      // Call API to add editor
      const response = await fetch('/api/projects/editors/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          editor_wallet: trimmedWallet,
          wallet: publicKey.toBase58(),
          signature: signatureBase58,
          message
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add editor')
      }

      // Success
      setWalletInput('')
      setSuccessMessage(`Editor ${truncateAddress(trimmedWallet)} added successfully!`)
      onProjectUpdated()
      
      // Add to local list
      setCurrentEditors([...currentEditors, {
        wallet_address: trimmedWallet,
        added_at: new Date().toISOString(),
        added_by: publicKey.toBase58()
      }])
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)

    } catch (error) {
      console.error('Error adding editor:', error)
      setErrors({ ...errors, editor: error instanceof Error ? error.message : 'Failed to add editor' })
    } finally {
      setIsAddingEditor(false)
    }
  }

  /**
   * Handle removing an editor
   */
  const handleRemoveEditor = async (editorWallet: string) => {
    if (!publicKey || !signMessage) {
      alert('Please connect your wallet')
      return
    }

    if (!isCreator) {
      alert('Only the project creator can remove editors')
      return
    }

    const confirmMessage = `Remove ${truncateAddress(editorWallet)} as editor?\n\nThey will lose access to edit project information.`
    if (!confirm(confirmMessage)) {
      return
    }

    setRemovingWallet(editorWallet)
    setErrors({})
    setSuccessMessage(null)

    try {
      // Generate signature message
      const message = `Remove editor from ${project.token_name}\nWallet: ${editorWallet}\nTimestamp: ${Date.now()}`
      const messageBytes = new TextEncoder().encode(message)
      const signature = await signMessage(messageBytes)
      const signatureBase58 = bs58.encode(signature)

      // Call API to remove editor
      const response = await fetch('/api/projects/editors/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          editor_wallet: editorWallet,
          wallet: publicKey.toBase58(),
          signature: signatureBase58,
          message
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove editor')
      }

      // Success
      setSuccessMessage(`Editor ${truncateAddress(editorWallet)} removed successfully!`)
      onProjectUpdated()
      
      // Remove from local list
      setCurrentEditors(currentEditors.filter(e => e.wallet_address !== editorWallet))
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)

    } catch (error) {
      console.error('Error removing editor:', error)
      setErrors({ ...errors, editor: error instanceof Error ? error.message : 'Failed to remove editor' })
    } finally {
      setRemovingWallet(null)
    }
  }

  const formatAddedDate = (addedAt: string) => {
    return new Date(addedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getWalletTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      team: 'Team Member',
      treasury: 'Treasury',
      liquidity: 'Liquidity',
      other: 'Other'
    }
    return labels[type] || 'Unknown'
  }

  const getWalletTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      team: 'var(--accent-primary)',
      treasury: 'var(--accent-success)',
      liquidity: '#3B82F6',
      other: 'var(--text-muted)'
    }
    return colors[type] || 'var(--text-muted)'
  }

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        style: {
          borderRadius: '12px',
          backgroundColor: 'var(--card-background)',
        }
      }}
    >
      <DialogTitle
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--text-title)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-primary)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: 'var(--space-lg)',
        }}
      >
        Edit Project
      </DialogTitle>

      {/* Tabs */}
      <Tabs 
        value={currentTab} 
        onChange={(_, newValue) => setCurrentTab(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          paddingLeft: 'var(--space-lg)',
          paddingRight: 'var(--space-lg)',
        }}
        TabIndicatorProps={{
          style: {
            backgroundColor: 'var(--accent-primary)',
          }
        }}
      >
        <Tab 
          label="Project Info" 
          icon={<EditIcon style={{ fontSize: 18 }} />}
          iconPosition="start"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-body-small)',
            textTransform: 'none',
            color: currentTab === 0 ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: currentTab === 0 ? 600 : 400,
          }}
        />
        <Tab 
          label="Manage Team" 
          icon={<GroupIcon style={{ fontSize: 18 }} />}
          iconPosition="start"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-body-small)',
            textTransform: 'none',
            color: currentTab === 1 ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: currentTab === 1 ? 600 : 400,
          }}
        />
        <Tab 
          label="Social & Links" 
          icon={<PersonIcon style={{ fontSize: 18 }} />}
          iconPosition="start"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-body-small)',
            textTransform: 'none',
            color: currentTab === 2 ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: currentTab === 2 ? 600 : 400,
          }}
        />
        <Tab 
          label="Creative Assets" 
          icon={<ImageIcon style={{ fontSize: 18 }} />}
          iconPosition="start"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-body-small)',
            textTransform: 'none',
            color: currentTab === 3 ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: currentTab === 3 ? 600 : 400,
          }}
        />
        <Tab 
          label="Project Wallets" 
          icon={<AccountBalanceWalletIcon style={{ fontSize: 18 }} />}
          iconPosition="start"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-body-small)',
            textTransform: 'none',
            color: currentTab === 4 ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: currentTab === 4 ? 600 : 400,
          }}
        />
      </Tabs>

      <DialogContent 
        dividers={false}
        style={{
          padding: 'var(--space-lg)',
          minHeight: '400px',
        }}
      >
        {/* Success Message */}
        {successMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-lg)',
              backgroundColor: 'var(--accent-success-soft)',
              border: '1px solid var(--accent-success)',
              borderRadius: '8px',
            }}
          >
            <CheckCircleIcon style={{ fontSize: 20, color: 'var(--accent-success)' }} />
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-body-small)',
                color: 'var(--text-primary)',
              }}
            >
              {successMessage}
            </p>
          </div>
        )}

        {/* TAB 0: PROJECT INFO */}
        {currentTab === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          
          {/* Immutable Fields Notice */}
          <div 
            style={{
              padding: 'var(--space-md)',
              backgroundColor: 'var(--subtle-background)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
              <LockIcon style={{ fontSize: 24, color: 'var(--text-muted)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p 
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-body-small)',
                    fontWeight: 'var(--weight-medium)',
                    color: 'var(--text-primary)',
                    margin: 0,
                    marginBottom: 'var(--space-xs)',
                  }}
                >
                  Locked Fields
                </p>
                <p 
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-caption)',
                    color: 'var(--text-secondary)',
                    margin: 0,
                    marginBottom: 'var(--space-sm)',
                    lineHeight: 1.5,
                  }}
                >
                  Token name, symbol, and mint address cannot be changed. 
                  Contact an admin if these need updating.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                  <span 
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'var(--card-background)',
                      color: 'var(--text-secondary)',
                      borderRadius: '6px',
                      fontSize: 'var(--text-caption)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 'var(--weight-medium)',
                    }}
                  >
                    {project.token_name}
                  </span>
                  <span 
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'var(--card-background)',
                      color: 'var(--text-secondary)',
                      borderRadius: '6px',
                      fontSize: 'var(--text-caption)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 'var(--weight-medium)',
                    }}
                  >
                    ${project.token_symbol}
                  </span>
                  <span 
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'var(--card-background)',
                      color: 'var(--text-secondary)',
                      borderRadius: '6px',
                      fontSize: 'var(--text-caption)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 'var(--weight-medium)',
                    }}
                  >
                    {project.token_mint.slice(0, 8)}...
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Description Field */}
          <div>
            <label 
              style={{
                display: 'block',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-body-small)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-xs)',
              }}
            >
              Description <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                if (errors.description) {
                  setErrors({ ...errors, description: undefined })
                }
              }}
              rows={5}
              maxLength={500}
              placeholder="Describe your project..."
              style={{
                width: '100%',
                padding: 'var(--space-sm)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-body-small)',
                color: 'var(--text-primary)',
                border: `1px solid ${errors.description ? '#EF4444' : 'var(--border-subtle)'}`,
                borderRadius: '8px',
                resize: 'vertical',
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={(e) => {
                if (!errors.description) {
                  e.target.style.borderColor = 'var(--accent-primary)'
                }
              }}
              onBlur={(e) => {
                if (!errors.description) {
                  e.target.style.borderColor = 'var(--border-subtle)'
                }
              }}
            />
            <div 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 'var(--space-xxs)',
              }}
            >
              <span 
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-caption)',
                  color: description.length > 500 ? '#EF4444' : 'var(--text-muted)',
                }}
              >
                {description.length}/500 characters
              </span>
              {errors.description && (
                <span 
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-caption)',
                    color: '#EF4444',
                  }}
                >
                  {errors.description}
                </span>
              )}
            </div>
          </div>

          {/* Profile Image Upload */}
          <div>
            <label 
              style={{
                display: 'block',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-body-small)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-xs)',
              }}
            >
              Profile Image
            </label>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-caption)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-sm)',
                marginTop: 0,
              }}
            >
              Upload your project logo (min 400x400px, max 5MB)
            </p>

            {/* Current/Preview Image */}
            {imagePreview && (
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: 'var(--space-sm)' }}>
                  <Image
                    src={imagePreview}
                    alt="Profile preview"
                    fill
                    style={{ objectFit: 'cover', borderRadius: '8px', border: '2px solid var(--border-subtle)' }}
                  />
                </div>
              </div>
            )}

            {/* Upload Button */}
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-xs)',
                padding: 'var(--space-sm) var(--space-md)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-body-small)',
                fontWeight: 'var(--weight-medium)',
                color: uploadingImage ? 'var(--text-muted)' : 'var(--accent-primary)',
                backgroundColor: uploadingImage ? 'var(--subtle-background)' : 'var(--accent-primary-soft)',
                border: `2px solid ${uploadingImage ? 'var(--border-subtle)' : 'var(--accent-primary)'}`,
                borderRadius: '8px',
                cursor: uploadingImage ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!uploadingImage) {
                  e.currentTarget.style.backgroundColor = 'var(--accent-primary)'
                  e.currentTarget.style.color = 'white'
                }
              }}
              onMouseLeave={(e) => {
                if (!uploadingImage) {
                  e.currentTarget.style.backgroundColor = 'var(--accent-primary-soft)'
                  e.currentTarget.style.color = 'var(--accent-primary)'
                }
              }}
            >
              {uploadingImage ? (
                <>
                  <CircularProgress size={16} />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <CloudUploadIcon style={{ fontSize: 18 }} />
                  <span>{imagePreview ? 'Change Image' : 'Upload Image'}</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                style={{ display: 'none' }}
              />
            </label>

            {errors.profileImageUrl && (
              <p 
              style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-caption)',
                  color: '#EF4444',
                  margin: 0,
                  marginTop: 'var(--space-xs)',
                }}
              >
                {errors.profileImageUrl}
              </p>
            )}
          </div>
        </div>
        )}

        {/* TAB 1: MANAGE TEAM */}
        {currentTab === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            
            {/* Add New Editor Section */}
            {(isCreator || isEditor) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                <h3
                  style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-body-small)',
                    fontWeight: 'var(--weight-medium)',
                color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  Add New Editor
                </h3>
                
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <input
                    type="text"
                    value={walletInput}
                    onChange={(e) => {
                      setWalletInput(e.target.value)
                      setErrors({ ...errors, editor: undefined })
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddEditor()
                      }
                    }}
                    placeholder="Paste Solana wallet address"
                    disabled={isAddingEditor}
                    style={{
                      flex: 1,
                      padding: 'var(--space-sm) var(--space-md)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-body-small)',
                      border: errors.editor ? '2px solid #EF4444' : '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                outline: 'none',
                      backgroundColor: isAddingEditor ? 'var(--subtle-background)' : 'var(--card-background)',
                      cursor: isAddingEditor ? 'not-allowed' : 'text',
              }}
              onFocus={(e) => {
                      if (!errors.editor) {
                  e.target.style.borderColor = 'var(--accent-primary)'
                        e.target.style.boxShadow = '0 0 0 3px var(--accent-primary-soft)'
                }
              }}
              onBlur={(e) => {
                      if (!errors.editor) {
                  e.target.style.borderColor = 'var(--border-subtle)'
                        e.target.style.boxShadow = 'none'
                }
              }}
            />
                  
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleAddEditor}
                    disabled={isAddingEditor || !walletInput.trim()}
                    style={{ minWidth: '80px' }}
                  >
                    {isAddingEditor ? 'Adding...' : 'Add'}
                  </Button>
                </div>

                {errors.editor && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-xs)',
                      padding: 'var(--space-sm)',
                      backgroundColor: '#FEE2E2',
                      border: '1px solid #EF4444',
                      borderRadius: '8px',
                    }}
                  >
                    <ErrorIcon style={{ fontSize: 16, color: '#EF4444' }} />
              <p 
                style={{
                        margin: 0,
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-caption)',
                        color: '#991B1B',
                }}
              >
                      {errors.editor}
              </p>
                  </div>
            )}

                <p 
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-caption)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {isCreator 
                    ? 'Any editor can add new editors, but only you can remove them.'
                    : 'You can add new editors to this project.'}
                </p>
              </div>
            )}

            {/* Divider */}
            {(isCreator || isEditor) && (
              <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />
            )}

            {/* Current Editors List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <h3
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-body-small)',
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-primary)',
                    margin: 0,
                }}
              >
                Current Team ({currentEditors.length + 1})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                {/* Creator Card */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-md)',
                    backgroundColor: 'var(--accent-primary-soft)',
                    border: '1px solid var(--accent-primary)',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: 'var(--accent-primary)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AdminPanelSettingsIcon style={{ fontSize: 20, color: 'white' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                        <p
                          style={{
                            margin: 0,
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-body-small)',
                            fontWeight: 'var(--weight-medium)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {truncateAddress(project.creator_wallet)}
                        </p>
                        {publicKey?.toBase58() === project.creator_wallet && (
                          <span
                  style={{
                              fontFamily: 'var(--font-body)',
                              fontSize: 'var(--text-caption)',
                              fontWeight: 'var(--weight-medium)',
                              color: 'var(--accent-primary)',
                            }}
                          >
                            (You)
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-caption)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Creator
                      </p>
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-caption)',
                      fontWeight: 'var(--weight-medium)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Cannot Remove
                  </span>
                </div>

                {/* Editors */}
                {currentEditors.map((editor) => (
                  <div
                    key={editor.wallet_address}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-md)',
                      backgroundColor: 'var(--card-background)',
                    border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-chip)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          backgroundColor: 'var(--accent-success-soft)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <PersonIcon style={{ fontSize: 20, color: 'var(--accent-success)' }} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                          <p
                            style={{
                              margin: 0,
                              fontFamily: 'var(--font-mono)',
                              fontSize: 'var(--text-body-small)',
                              fontWeight: 'var(--weight-medium)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {truncateAddress(editor.wallet_address)}
                          </p>
                          {publicKey?.toBase58() === editor.wallet_address && (
                            <span
                              style={{
                                fontFamily: 'var(--font-body)',
                                fontSize: 'var(--text-caption)',
                                fontWeight: 'var(--weight-medium)',
                                color: 'var(--accent-success)',
                              }}
                            >
                              (You)
                            </span>
                          )}
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontFamily: 'var(--font-body)',
                            fontSize: 'var(--text-caption)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          Added: {formatAddedDate(editor.added_at)}
                        </p>
                      </div>
                    </div>

                    {isCreator && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => handleRemoveEditor(editor.wallet_address)}
                        disabled={removingWallet === editor.wallet_address}
                      >
                        {removingWallet === editor.wallet_address ? (
                          <>
                            <CircularProgress size={12} style={{ color: 'white', marginRight: '4px' }} />
                            Removing...
                          </>
                        ) : (
                          <>
                            <DeleteOutlineIcon style={{ fontSize: 16, marginRight: '4px' }} />
                            Remove
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ))}

                {/* Empty State */}
                {currentEditors.length === 0 && (
                  <div
                    style={{
                      padding: 'var(--space-xl)',
                      textAlign: 'center',
                      border: '2px dashed var(--border-subtle)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--subtle-background)',
                    }}
                  >
                    <PersonIcon
                      style={{
                        fontSize: 40,
                        color: 'var(--icon-default)',
                        marginBottom: 'var(--space-sm)',
                      }}
                    />
                    <p
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-body-small)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      No additional team members yet
                    </p>
                    {(isCreator || isEditor) && (
                      <p
                        style={{
                          margin: '4px 0 0 0',
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-caption)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Add team members using the form above
                      </p>
                    )}
              </div>
            )}
          </div>
            </div>
          </div>
        )}

        {/* TAB 2: SOCIAL & LINKS (Website, Telegram, Domains, Social Accounts) */}
        {currentTab === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            
            {/* Telegram */}
          <div>
              <h3 style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-headline)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-primary)',
                margin: '0 0 var(--space-sm) 0',
              }}>
                Telegram
              </h3>
              <input
                type="text"
                value={telegram}
                onChange={(e) => {
                  setTelegram(e.target.value)
                  setHasChangedSocial(true)
                }}
                placeholder="@username or t.me/username"
                disabled={!canEditProject}
              style={{
                  width: '100%',
                  padding: 'var(--space-sm)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-body-small)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  backgroundColor: canEditProject ? 'var(--card-background)' : 'var(--subtle-background)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Divider */}
            <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />

            {/* Domains */}
            <div>
              <h3 style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-headline)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-primary)',
                margin: '0 0 var(--space-sm) 0',
              }}>
                Domains ({domains.length})
              </h3>

              {canEditProject && (
                <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="example.com"
                    style={{
                      flex: 1,
                      padding: 'var(--space-sm)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-body-small)',
                border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                outline: 'none',
                    }}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => {
                      if (newDomain.trim()) {
                        const normalized = normalizeDomain(newDomain)
                        if (normalized && !domains.includes(normalized)) {
                          setDomains([...domains, normalized])
                          setNewDomain('')
                          setHasChangedSocial(true)
                        } else if (domains.includes(normalized)) {
                          alert('This domain is already added')
                        }
                      }
                    }}
                    disabled={!newDomain.trim()}
                  >
                    <AddIcon style={{ fontSize: 16, marginRight: '4px' }} />
                    Add
                  </Button>
                </div>
              )}

              {domains.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                  {domains.map((domain, idx) => (
                    <div
                      key={idx}
              style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                padding: 'var(--space-sm)',
                        backgroundColor: 'var(--subtle-background)',
                        borderRadius: '8px',
                      }}
                    >
                      <a
                        href={getDomainUrl(domain)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-body-small)',
                          color: 'var(--accent-primary)',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = 'underline'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = 'none'
                        }}
                      >
                        🌐 {domain}
                      </a>
                      {canEditProject && (
                        <button
                          onClick={() => {
                            setDomains(domains.filter((_, i) => i !== idx))
                            setHasChangedSocial(true)
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                cursor: 'pointer',
                            color: '#EF4444',
                            padding: '4px',
                          }}
                        >
                          <DeleteOutlineIcon style={{ fontSize: 16 }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-body-small)',
                  color: 'var(--text-muted)',
                  margin: 0,
                  padding: 'var(--space-md)',
                  textAlign: 'center',
                  backgroundColor: 'var(--subtle-background)',
                  borderRadius: '8px',
                }}>
                  No domains added yet
                </p>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />

            {/* Social Accounts */}
            <div>
              <h3 style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-headline)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-primary)',
                margin: '0 0 var(--space-sm) 0',
              }}>
                Social Accounts ({socialAssets.length})
              </h3>

              {canEditProject && (
                <div style={{
                  padding: 'var(--space-md)',
                  backgroundColor: 'var(--subtle-background)',
                  borderRadius: '8px',
                  marginBottom: 'var(--space-md)',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    <select
                      value={newSocialPlatform}
                      onChange={(e) => setNewSocialPlatform(e.target.value)}
                      disabled={addingSocial}
                      style={{
                        padding: 'var(--space-sm)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-body-small)',
                border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        backgroundColor: 'var(--card-background)',
                outline: 'none',
                      }}
                    >
                      <option value="Instagram">Instagram</option>
                      <option value="Twitter">Twitter / X</option>
                      <option value="TikTok">TikTok</option>
                      <option value="YouTube">YouTube</option>
                      <option value="Facebook">Facebook</option>
            </select>

                    <input
                      type="text"
                      value={newSocialHandle}
                      onChange={(e) => setNewSocialHandle(e.target.value)}
                      placeholder="@username or profile URL"
                      disabled={addingSocial}
              style={{
                        padding: 'var(--space-sm)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-body-small)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                backgroundColor: 'var(--card-background)',
                        outline: 'none',
                      }}
                    />

                    <select
                      value={newSocialFollowerTier}
                      onChange={(e) => setNewSocialFollowerTier(e.target.value)}
                      disabled={addingSocial}
                      style={{
                        padding: 'var(--space-sm)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-body-small)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        backgroundColor: 'var(--card-background)',
                        outline: 'none',
                      }}
                    >
                      <option value="<10k">&lt;10k followers</option>
                      <option value="10k-50k">10k-50k followers</option>
                      <option value="50k-100k">50k-100k followers</option>
                      <option value="100k-500k">100k-500k followers</option>
                      <option value="500k-1m">500k-1m followers</option>
                      <option value="1m-5m">1m-5m followers</option>
                      <option value="5m+">5m+ followers</option>
            </select>

                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={async () => {
                        if (!newSocialHandle.trim()) return
                        
                        setAddingSocial(true)
                        try {
                          const { error } = await supabase
                            .from('social_assets')
                            .insert({
                              project_id: project.id,
                              platform: newSocialPlatform,
                              handle: newSocialHandle.trim(),
                              follower_tier: newSocialFollowerTier,
                              verified: false
                            })
                          
                          if (error) throw error
                          
                          await loadSocialAssets()
                          setNewSocialHandle('')
                          setSuccessMessage('Social account added!')
                          setTimeout(() => setSuccessMessage(null), 3000)
                        } catch (err) {
                          console.error('Error adding social:', err)
                          alert('Failed to add social account')
                        } finally {
                          setAddingSocial(false)
                        }
                      }}
                      disabled={addingSocial || !newSocialHandle.trim()}
                    >
                      {addingSocial ? 'Adding...' : 'Add Social Account'}
                    </Button>
                  </div>
                </div>
              )}

              {socialAssets.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                  {socialAssets.map((social) => (
                    <div
                      key={social.id}
              style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--space-md)',
                        backgroundColor: 'var(--card-background)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)'
                        e.currentTarget.style.boxShadow = 'var(--shadow-chip)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xxs)' }}>
                          <span style={{
                            padding: '2px 8px',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-caption)',
                            fontWeight: 'var(--weight-medium)',
                            color: 'var(--accent-primary)',
                            backgroundColor: 'var(--accent-primary-soft)',
                            borderRadius: '6px',
                          }}>
                            {social.platform}
                          </span>
                          {social.verified && (
                            <span style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 6px',
                              fontFamily: 'var(--font-body)',
                              fontSize: 'var(--text-caption)',
                              fontWeight: 'var(--weight-medium)',
                              color: 'var(--accent-success)',
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              borderRadius: '4px',
                            }}>
                              <CheckCircleIcon style={{ fontSize: 14 }} />
                              Community Approved
                            </span>
                          )}
                        </div>
                        <p style={{
                margin: 0,
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-body-small)',
                          fontWeight: 'var(--weight-medium)',
                          color: 'var(--text-primary)',
                        }}>
                          @{social.handle}
                        </p>
                        {social.follower_tier && (
                          <p style={{
                            margin: '2px 0 0 0',
                            fontFamily: 'var(--font-body)',
                            fontSize: 'var(--text-caption)',
                            color: 'var(--text-muted)',
                          }}>
                            {social.follower_tier} followers
                          </p>
                        )}
                      </div>

                      {canEditProject && (
                        <button
                          onClick={async () => {
                            if (!confirm('Remove this social account?')) return
                            
                            setDeletingSocialId(social.id)
                            try {
                              const { error } = await supabase
                                .from('social_assets')
                                .delete()
                                .eq('id', social.id)
                              
                              if (error) throw error
                              
                              await loadSocialAssets()
                              setSuccessMessage('Social account removed!')
                              setTimeout(() => setSuccessMessage(null), 3000)
                            } catch (err) {
                              console.error('Error deleting social:', err)
                              alert('Failed to remove social account')
                            } finally {
                              setDeletingSocialId(null)
                            }
                          }}
                          disabled={deletingSocialId === social.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            fontFamily: 'var(--font-body)',
                            fontSize: 'var(--text-caption)',
                            fontWeight: 'var(--weight-medium)',
                            color: deletingSocialId === social.id ? 'var(--text-muted)' : '#EF4444',
                            backgroundColor: deletingSocialId === social.id ? 'var(--subtle-background)' : 'transparent',
                            border: `1px solid ${deletingSocialId === social.id ? 'var(--border-subtle)' : '#EF4444'}`,
                            borderRadius: '6px',
                            cursor: deletingSocialId === social.id ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (deletingSocialId !== social.id) {
                              e.currentTarget.style.backgroundColor = '#FEE2E2'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (deletingSocialId !== social.id) {
                              e.currentTarget.style.backgroundColor = 'transparent'
                            }
                          }}
                        >
                          {deletingSocialId === social.id ? (
                            <>
                              <CircularProgress size={12} />
                              <span>Removing...</span>
                            </>
                          ) : (
                            <>
                              <DeleteOutlineIcon style={{ fontSize: 14 }} />
                              <span>Remove</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-body-small)',
                  color: 'var(--text-muted)',
                  margin: 0,
                  padding: 'var(--space-md)',
                  textAlign: 'center',
                  backgroundColor: 'var(--subtle-background)',
                  borderRadius: '8px',
                }}>
                  No social accounts added yet
                </p>
              )}
          </div>
        </div>
        )}

        {/* TAB 3: CREATIVE ASSETS - SIMPLIFIED */}
        {currentTab === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            
            {/* Upload Button */}
            {canEditProject && (
          <div>
            <label 
        style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-xs)',
                    padding: 'var(--space-sm) var(--space-md)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-body-small)',
                    fontWeight: 'var(--weight-medium)',
                    color: uploadingAsset ? 'var(--text-muted)' : 'var(--accent-primary)',
                    backgroundColor: uploadingAsset ? 'var(--subtle-background)' : 'var(--accent-primary-soft)',
                    border: `2px solid ${uploadingAsset ? 'var(--border-subtle)' : 'var(--accent-primary)'}`,
                    borderRadius: '8px',
                    cursor: uploadingAsset ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!uploadingAsset) {
                      e.currentTarget.style.backgroundColor = 'var(--accent-primary)'
                      e.currentTarget.style.color = 'white'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!uploadingAsset) {
                      e.currentTarget.style.backgroundColor = 'var(--accent-primary-soft)'
                      e.currentTarget.style.color = 'var(--accent-primary)'
                    }
                  }}
                >
                  {uploadingAsset ? (
                    <>
                      <CircularProgress size={16} />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <AddIcon style={{ fontSize: 18 }} />
                      <span>Upload New Asset</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAssetUpload}
                    disabled={uploadingAsset}
                    style={{ display: 'none' }}
                  />
                </label>

                {errors.asset && (
                  <p style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-caption)',
                    color: '#EF4444',
                    margin: 'var(--space-xs) 0 0 0',
                  }}>
                    {errors.asset}
                  </p>
                )}
              </div>
            )}

            {/* Assets Grid */}
            <div>
              <h3
          style={{
            fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-body-small)',
            fontWeight: 'var(--weight-medium)',
                color: 'var(--text-primary)',
                  margin: '0 0 var(--space-sm) 0',
                }}
              >
                Assets ({creativeAssets.length})
              </h3>

              {loadingAssets ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-xl)' }}>
                  <CircularProgress size={32} />
                </div>
              ) : creativeAssets.length === 0 ? (
                <div
                  style={{
                    padding: 'var(--space-xl)',
                    textAlign: 'center',
                    border: '2px dashed var(--border-subtle)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--subtle-background)',
                  }}
                >
                  <ImageIcon style={{ fontSize: 40, color: 'var(--icon-default)', marginBottom: 'var(--space-sm)' }} />
                  <p style={{
                    margin: 0,
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-body-small)',
                    color: 'var(--text-muted)',
                  }}>
                    No creative assets yet
                  </p>
                  <p style={{
                    margin: '4px 0 0 0',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-caption)',
                    color: 'var(--text-muted)',
                  }}>
                    Upload images or GIFs to showcase your project
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-md)' }}>
                  {creativeAssets.map((asset) => (
                    <div
                      key={asset.id}
                      style={{
                        position: 'relative',
            border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        overflow: 'hidden',
            backgroundColor: 'var(--card-background)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)'
                        e.currentTarget.style.boxShadow = 'var(--shadow-chip)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      {/* Image */}
                      {asset.media_url && (
                        <div style={{ position: 'relative', width: '100%', paddingBottom: '100%', backgroundColor: 'var(--subtle-background)' }}>
                          <Image
                            src={asset.media_url}
                            alt={asset.name || 'Asset'}
                            fill
                            style={{ objectFit: 'cover' }}
                          />
                          
                          {/* Delete Button Overlay */}
                          {canEditProject && (
                            <button
                              onClick={() => handleDeleteAsset(asset.id, asset.media_url)}
                              disabled={deletingAssetId === asset.id}
                              style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                background: 'rgba(239, 68, 68, 0.9)',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: deletingAssetId === asset.id ? 'not-allowed' : 'pointer',
                                color: 'white',
                                transition: 'all 0.2s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (deletingAssetId !== asset.id) {
                                  e.currentTarget.style.background = 'rgba(220, 38, 38, 1)'
            }
          }}
          onMouseLeave={(e) => {
                                if (deletingAssetId !== asset.id) {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)'
                                }
                              }}
                            >
                              {deletingAssetId === asset.id ? (
                                <CircularProgress size={16} style={{ color: 'white' }} />
                              ) : (
                                <DeleteOutlineIcon style={{ fontSize: 18 }} />
                              )}
        </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PROJECT WALLETS - WITH ROLE DROPDOWN */}
        {currentTab === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            
            {/* Add New Wallet Section */}
            {canEditProject && (
              <div style={{ 
                padding: 'var(--space-md)', 
                backgroundColor: 'var(--subtle-background)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)'
              }}>
                <h3
          style={{
            fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-body-small)',
            fontWeight: 'var(--weight-medium)',
                    color: 'var(--text-primary)',
                    margin: '0 0 var(--space-md) 0',
                  }}
                >
                  Add New Wallet
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {/* Wallet Type */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-body-small)',
                      fontWeight: 'var(--weight-medium)',
                      color: 'var(--text-primary)',
                      marginBottom: 'var(--space-xxs)',
                    }}>
                      Wallet Type <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
                      value={newWalletType}
                      onChange={(e) => {
                        setNewWalletType(e.target.value as 'team' | 'treasury' | 'liquidity' | 'other')
                        setNewWalletRole('Founder')
                        setNewWalletLabel('')
                      }}
                      disabled={addingWallet}
              style={{
                width: '100%',
                padding: 'var(--space-sm)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-body-small)',
                border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        backgroundColor: 'var(--card-background)',
                outline: 'none',
                      }}
                    >
                      <option value="team">Team Member</option>
                      <option value="treasury">Treasury</option>
                      <option value="liquidity">Liquidity Provision</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Team Role Dropdown (only for team members) */}
                  {newWalletType === 'team' && (
                    <div>
                      <label style={{
                        display: 'block',
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-body-small)',
                        fontWeight: 'var(--weight-medium)',
                        color: 'var(--text-primary)',
                        marginBottom: 'var(--space-xxs)',
                      }}>
                        Team Role <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <select
                        value={newWalletRole}
                        onChange={(e) => setNewWalletRole(e.target.value)}
                        disabled={addingWallet}
                        style={{
                          width: '100%',
                          padding: 'var(--space-sm)',
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-body-small)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                backgroundColor: 'var(--card-background)',
                          outline: 'none',
                        }}
                      >
                        <option value="Founder">Founder</option>
                        <option value="Co-Founder">Co-Founder</option>
                        <option value="Developer">Developer</option>
                        <option value="Designer">Designer</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Community Manager">Community Manager</option>
                        <option value="Advisor">Advisor</option>
                        <option value="Operations">Operations</option>
                        <option value="Other">Other</option>
            </select>
                    </div>
                  )}

                  {/* Custom Role/Label for Team "Other" or "other" wallet type */}
                  {((newWalletType === 'team' && newWalletRole === 'Other') || newWalletType === 'other') && (
                    <div>
                      <label style={{
                        display: 'block',
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-body-small)',
                        fontWeight: 'var(--weight-medium)',
                        color: 'var(--text-primary)',
                        marginBottom: 'var(--space-xxs)',
                      }}>
                        {newWalletType === 'team' ? 'Custom Role' : 'Wallet Description'} <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={newWalletLabel}
                        onChange={(e) => setNewWalletLabel(e.target.value)}
                        placeholder={newWalletType === 'team' ? 'Enter custom role' : 'Describe this wallet'}
                        disabled={addingWallet}
                        maxLength={100}
              style={{
                          width: '100%',
                          padding: 'var(--space-sm)',
                fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-body-small)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          backgroundColor: 'var(--card-background)',
                          outline: 'none',
                        }}
                      />
                    </div>
                  )}

                  {/* Wallet Address */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-body-small)',
                      fontWeight: 'var(--weight-medium)',
                      color: 'var(--text-primary)',
                      marginBottom: 'var(--space-xxs)',
                    }}>
                      Wallet Address <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={newWalletAddress}
                      onChange={(e) => setNewWalletAddress(e.target.value)}
                      placeholder="Paste Solana wallet address"
                      disabled={addingWallet}
                      style={{
                        width: '100%',
                        padding: 'var(--space-sm)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-body-small)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        backgroundColor: 'var(--card-background)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleAddProjectWallet}
                    disabled={addingWallet || !newWalletAddress.trim()}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {addingWallet ? (
                      <>
                        <CircularProgress size={14} style={{ color: 'white', marginRight: '4px' }} />
                        Adding...
                      </>
                    ) : (
                      <>
                        <AddIcon style={{ fontSize: 18, marginRight: '4px' }} />
                        Add Wallet
                      </>
                    )}
                  </Button>

                  {errors.wallet && (
                    <p style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-caption)',
                      color: '#EF4444',
                      margin: 0,
                    }}>
                      {errors.wallet}
                    </p>
                  )}
          </div>
        </div>
            )}

            {/* Wallets List */}
            <div>
              <h3
        style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-body-small)',
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-primary)',
                  margin: '0 0 var(--space-sm) 0',
                }}
              >
                Current Wallets ({projectWallets.length})
              </h3>

              {loadingWallets ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-xl)' }}>
                  <CircularProgress size={32} />
                </div>
              ) : projectWallets.length === 0 ? (
                <div
          style={{
                    padding: 'var(--space-xl)',
                    textAlign: 'center',
                    border: '2px dashed var(--border-subtle)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--subtle-background)',
                  }}
                >
                  <AccountBalanceWalletIcon style={{ fontSize: 40, color: 'var(--icon-default)', marginBottom: 'var(--space-sm)' }} />
                  <p style={{
                    margin: 0,
            fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-body-small)',
                    color: 'var(--text-muted)',
                  }}>
                    No project wallets added yet
                  </p>
                  <p style={{
                    margin: '4px 0 0 0',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-caption)',
                    color: 'var(--text-muted)',
                  }}>
                    Add wallets that are associated with your project
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                  {projectWallets.map((wallet) => (
                    <div
                      key={wallet.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--space-md)',
            backgroundColor: 'var(--card-background)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = getWalletTypeColor(wallet.wallet_type || 'other')
                        e.currentTarget.style.boxShadow = 'var(--shadow-chip)'
          }}
          onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xxs)' }}>
                          <p
                            style={{
                              margin: 0,
                              fontFamily: 'var(--font-body)',
                              fontSize: 'var(--text-body-small)',
                              fontWeight: 'var(--weight-medium)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {wallet.label || 'Unlabeled'}
                          </p>
                          <span
                            style={{
                              padding: '2px 8px',
                              fontFamily: 'var(--font-body)',
                              fontSize: 'var(--text-caption)',
                              fontWeight: 'var(--weight-medium)',
                              color: getWalletTypeColor(wallet.wallet_type || 'other'),
                              backgroundColor: `${getWalletTypeColor(wallet.wallet_type || 'other')}20`,
                              borderRadius: '6px',
                            }}
                          >
                            {getWalletTypeLabel(wallet.wallet_type || 'other')}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-caption)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {truncateAddress(wallet.wallet_address)}
                        </p>
                      </div>

                      {canEditProject && (
        <button
                          onClick={() => handleDeleteProjectWallet(wallet.id)}
                          disabled={deletingWalletId === wallet.id}
          style={{
            display: 'flex',
            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
            fontFamily: 'var(--font-body)',
                            fontSize: 'var(--text-caption)',
            fontWeight: 'var(--weight-medium)',
                            color: deletingWalletId === wallet.id ? 'var(--text-muted)' : '#EF4444',
                            backgroundColor: deletingWalletId === wallet.id ? 'var(--subtle-background)' : 'transparent',
                            border: `1px solid ${deletingWalletId === wallet.id ? 'var(--border-subtle)' : '#EF4444'}`,
                            borderRadius: '6px',
                            cursor: deletingWalletId === wallet.id ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
                            if (deletingWalletId !== wallet.id) {
                              e.currentTarget.style.backgroundColor = '#FEE2E2'
            }
          }}
          onMouseLeave={(e) => {
                            if (deletingWalletId !== wallet.id) {
                              e.currentTarget.style.backgroundColor = 'transparent'
                            }
                          }}
                        >
                          {deletingWalletId === wallet.id ? (
                            <>
                              <CircularProgress size={12} />
                              <span>Removing...</span>
                            </>
                          ) : (
                            <>
                              <DeleteOutlineIcon style={{ fontSize: 14 }} />
                              <span>Remove</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>

      <DialogActions
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: 'var(--space-md) var(--space-lg)',
          gap: 'var(--space-sm)',
        }}
      >
        {(currentTab === 0 || currentTab === 2) ? (
          // Project Info & Social Tabs - Unified Save
          <>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={handleClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handleSaveAll}
              disabled={isSaving || !hasAnyChanges}
            >
              {isSaving && (
                <CircularProgress size={16} style={{ color: '#FFFFFF', marginRight: '4px' }} />
              )}
              {isSaving ? 'Saving...' : 'Save All Changes'}
            </Button>
          </>
        ) : (
          // Other Tabs - Just Close
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onClose}
          >
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
