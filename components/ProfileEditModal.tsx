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
  FormHelperText,
  Alert,
  Box
} from '@mui/material'
import { Database } from '@/types/database'
import { toast } from 'react-hot-toast'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']

interface ProfileEditModalProps {
  open: boolean
  onClose: () => void
  currentProfile: UserProfile | null
  onSave: (updatedProfile: Partial<UserProfile>) => Promise<void>
}

export function ProfileEditModal({
  open,
  onClose,
  currentProfile,
  onSave
}: ProfileEditModalProps) {
  // Form state
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [privacyLevel, setPrivacyLevel] = useState<'public' | 'holders_only' | 'private'>('public')
  const [allowMessagesFrom, setAllowMessagesFrom] = useState<'everyone' | 'holders_only' | 'nobody'>('everyone')
  
  // UI state
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  // Initialize form with current profile data
  useEffect(() => {
    if (currentProfile && open) {
      setDisplayName(currentProfile.display_name || '')
      setBio(currentProfile.bio || '')
      setAvatarUrl(currentProfile.avatar_url || '')
      setPrivacyLevel(currentProfile.privacy_level)
      setAllowMessagesFrom(currentProfile.allow_messages_from)
      setErrors({})
    }
  }, [currentProfile, open])
  
  // Character counts
  const displayNameCount = displayName.length
  const bioCount = bio.length
  
  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    // Display name validation (if provided)
    if (displayName && displayName.trim().length === 0) {
      newErrors.displayName = 'Display name cannot be only spaces'
    }
    
    if (displayName.length > 50) {
      newErrors.displayName = 'Display name must be 50 characters or less'
    }
    
    // Bio validation
    if (bio.length > 500) {
      newErrors.bio = 'Bio must be 500 characters or less'
    }
    
    // Avatar URL validation (if provided)
    if (avatarUrl && avatarUrl.trim()) {
      try {
        new URL(avatarUrl)
      } catch {
        newErrors.avatarUrl = 'Please enter a valid URL'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('Please fix the errors before saving')
      return
    }
    
    setLoading(true)
    
    try {
      const updatedProfile: Partial<UserProfile> = {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        privacy_level: privacyLevel,
        allow_messages_from: allowMessagesFrom,
        updated_at: new Date().toISOString()
      }
      
      await onSave(updatedProfile)
      toast.success('Profile updated successfully!')
      onClose()
      
    } catch (error) {
      console.error('Error saving profile:', error)
      toast.error('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }
  
  const handleCancel = () => {
    // Reset form to current profile state
    if (currentProfile) {
      setDisplayName(currentProfile.display_name || '')
      setBio(currentProfile.bio || '')
      setAvatarUrl(currentProfile.avatar_url || '')
      setPrivacyLevel(currentProfile.privacy_level)
      setAllowMessagesFrom(currentProfile.allow_messages_from)
    }
    setErrors({})
    onClose()
  }
  
  return (
    <Dialog 
      open={open} 
      onClose={handleCancel} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { maxWidth: '600px' }
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        Edit Profile
      </DialogTitle>
      
      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          Customize your messaging profile. Your wallet address cannot be changed.
        </Alert>
        
        {/* Wallet Address (read-only) */}
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth>
            <TextField
              label="Wallet Address"
              value={currentProfile?.wallet_address || ''}
              disabled
              InputProps={{
                sx: { 
                  fontFamily: 'monospace',
                  fontSize: '0.9rem'
                }
              }}
            />
            <FormHelperText>Your wallet address (cannot be changed)</FormHelperText>
          </FormControl>
        </Box>
        
        {/* Display Name */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Display Name"
            placeholder="Enter a display name (optional)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={!!errors.displayName}
            helperText={errors.displayName || `${displayNameCount}/50 characters`}
            inputProps={{ maxLength: 50 }}
          />
        </Box>
        
        {/* Bio */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Bio"
            placeholder="Tell others about yourself (optional)"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            multiline
            rows={4}
            error={!!errors.bio}
            helperText={errors.bio || `${bioCount}/500 characters`}
            inputProps={{ maxLength: 500 }}
          />
        </Box>
        
        {/* Avatar URL */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Avatar URL"
            placeholder="https://example.com/avatar.png"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            error={!!errors.avatarUrl}
            helperText={errors.avatarUrl || 'URL to your profile picture (optional)'}
          />
        </Box>
        
        {/* Privacy Level */}
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel>Privacy Level</InputLabel>
            <Select
              value={privacyLevel}
              onChange={(e) => setPrivacyLevel(e.target.value as any)}
              label="Privacy Level"
            >
              <MenuItem value="public">Public</MenuItem>
              <MenuItem value="holders_only">Holders Only</MenuItem>
              <MenuItem value="private">Private</MenuItem>
            </Select>
            <FormHelperText>
              {privacyLevel === 'public' && '👥 Anyone can view your profile'}
              {privacyLevel === 'holders_only' && '💎 Only token holders can view details'}
              {privacyLevel === 'private' && '🔒 Only you can view your full profile'}
            </FormHelperText>
          </FormControl>
        </Box>
        
        {/* Message Permissions */}
        <Box sx={{ mb: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Allow Messages From</InputLabel>
            <Select
              value={allowMessagesFrom}
              onChange={(e) => setAllowMessagesFrom(e.target.value as any)}
              label="Allow Messages From"
            >
              <MenuItem value="everyone">Everyone</MenuItem>
              <MenuItem value="holders_only">Token Holders Only</MenuItem>
              <MenuItem value="nobody">Nobody</MenuItem>
            </Select>
            <FormHelperText>
              {allowMessagesFrom === 'everyone' && '✉️ Anyone can send you messages'}
              {allowMessagesFrom === 'holders_only' && '💎 Only token holders can message you'}
              {allowMessagesFrom === 'nobody' && '🚫 No one can send you messages'}
            </FormHelperText>
          </FormControl>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
        <Button 
          onClick={handleCancel} 
          disabled={loading}
          sx={{ 
            color: 'text.secondary',
            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' }
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading}
          sx={{ 
            bgcolor: '#7C4DFF',
            color: 'white',
            minWidth: '100px',
            '&:hover': { 
              bgcolor: '#6C3FEF'
            },
            '&:disabled': {
              bgcolor: 'rgba(0, 0, 0, 0.12)',
              color: 'rgba(0, 0, 0, 0.26)'
            }
          }}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}







