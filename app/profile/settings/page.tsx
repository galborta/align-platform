'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import {
  Tabs,
  Tab,
  Box,
  Card as MuiCard,
  CardContent as MuiCardContent,
  Button,
  CircularProgress,
  Alert,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Typography,
  Divider,
  IconButton,
  Chip
} from '@mui/material'
import { Card, CardContent } from '@/components/ui/Card'
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Block as BlockIcon,
  Visibility as VisibilityIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { WalletButton } from '@/components/WalletButton'
import { ProfileEditModal } from '@/components/ProfileEditModal'
import { NotificationSettings } from '@/components/NotificationSettings'
import { supabase } from '@/lib/supabase'
import { getOrCreateProfile } from '@/lib/messaging'
import { Database } from '@/types/database'
import { toast } from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']
type BlockedUser = Database['public']['Tables']['blocked_users']['Row']

type TabValue = 'profile' | 'privacy' | 'notifications' | 'blocked'

export default function ProfileSettingsPage() {
  const router = useRouter()
  const wallet = useWallet()
  const [currentTab, setCurrentTab] = useState<TabValue>('profile')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [loadingBlocked, setLoadingBlocked] = useState(false)
  
  // Privacy settings state
  const [privacyLevel, setPrivacyLevel] = useState<'public' | 'holders_only' | 'private'>('public')
  const [allowMessagesFrom, setAllowMessagesFrom] = useState<'everyone' | 'holders_only' | 'nobody'>('everyone')
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  
  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (!wallet?.publicKey) {
        setLoading(false)
        return
      }
      
      setLoading(true)
      
      try {
        const prof = await getOrCreateProfile(wallet.publicKey.toString())
        
        if (prof) {
          setProfile(prof)
          setPrivacyLevel(prof.privacy_level)
          setAllowMessagesFrom(prof.allow_messages_from)
        }
      } catch (error) {
        console.error('Error loading profile:', error)
        toast.error('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    
    loadProfile()
  }, [wallet?.publicKey])
  
  // Load blocked users
  useEffect(() => {
    const loadBlockedUsers = async () => {
      if (!wallet?.publicKey || currentTab !== 'blocked') return
      
      setLoadingBlocked(true)
      
      try {
        const { data, error } = await supabase
          .from('blocked_users')
          .select('*')
          .eq('blocker_wallet', wallet.publicKey.toString())
          .order('created_at', { ascending: false })
        
        if (error) throw error
        
        setBlockedUsers(data || [])
      } catch (error) {
        console.error('Error loading blocked users:', error)
        toast.error('Failed to load blocked users')
      } finally {
        setLoadingBlocked(false)
      }
    }
    
    loadBlockedUsers()
  }, [wallet?.publicKey, currentTab])
  
  // Handle profile save
  const handleSaveProfile = async (updatedProfile: Partial<UserProfile>) => {
    if (!wallet?.publicKey) return
    
    const { error } = await supabase
      .from('user_profiles')
      .update(updatedProfile)
      .eq('wallet_address', wallet.publicKey.toString())
    
    if (error) {
      console.error('Update error:', error)
      throw error
    }
    
    // Reload profile
    const newProfile = await getOrCreateProfile(wallet.publicKey.toString())
    setProfile(newProfile)
  }
  
  // Handle privacy settings save
  const handleSavePrivacy = async () => {
    if (!wallet?.publicKey) return
    
    setSavingPrivacy(true)
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          privacy_level: privacyLevel,
          allow_messages_from: allowMessagesFrom,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', wallet.publicKey.toString())
      
      if (error) throw error
      
      // Reload profile
      const newProfile = await getOrCreateProfile(wallet.publicKey.toString())
      setProfile(newProfile)
      
      toast.success('Privacy settings updated!')
    } catch (error) {
      console.error('Error updating privacy:', error)
      toast.error('Failed to update privacy settings')
    } finally {
      setSavingPrivacy(false)
    }
  }
  
  // Handle unblock user
  const handleUnblock = async (blockedWallet: string) => {
    if (!wallet?.publicKey) return
    
    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_wallet', wallet.publicKey.toString())
        .eq('blocked_wallet', blockedWallet)
      
      if (error) throw error
      
      // Remove from local state
      setBlockedUsers(prev => 
        prev.filter(b => b.blocked_wallet !== blockedWallet)
      )
      
      toast.success('User unblocked')
    } catch (error) {
      console.error('Error unblocking user:', error)
      toast.error('Failed to unblock user')
    }
  }
  
  // Truncate wallet address
  const truncateWallet = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`
  }
  
  // If wallet not connected
  if (!wallet?.publicKey) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <IconButton onClick={() => router.push('/')} size="small">
            <ArrowBackIcon />
          </IconButton>
          <h1 className="text-3xl font-bold">Profile Settings</h1>
        </div>
        
        <MuiCard>
          <MuiCardContent className="text-center py-12">
            <SecurityIcon sx={{ fontSize: 64, color: '#7C4DFF', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Wallet Connection Required
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Please connect your wallet to manage your profile settings
            </Typography>
            <WalletButton />
          </MuiCardContent>
        </MuiCard>
      </div>
    )
  }
  
  // Loading state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <IconButton onClick={() => router.push('/')} size="small">
            <ArrowBackIcon />
          </IconButton>
          <h1 className="text-3xl font-bold">Profile Settings</h1>
        </div>
        
        <MuiCard>
          <MuiCardContent className="text-center py-12">
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Loading profile...</Typography>
          </MuiCardContent>
        </MuiCard>
      </div>
    )
  }
  
  // DataGrid columns for blocked users
  const blockedUsersColumns: GridColDef[] = [
    {
      field: 'blocked_wallet',
      headerName: 'Wallet Address',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <span className="font-mono text-sm">
          {truncateWallet(params.value)}
        </span>
      )
    },
    {
      field: 'created_at',
      headerName: 'Blocked',
      width: 150,
      renderCell: (params) => (
        <span className="text-sm text-gray-600">
          {formatDistanceToNow(new Date(params.value), { addSuffix: true })}
        </span>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Button
          variant="outlined"
          size="small"
          onClick={() => handleUnblock(params.row.blocked_wallet)}
          sx={{
            color: '#7C4DFF',
            borderColor: '#7C4DFF',
            '&:hover': {
              borderColor: '#6C3FEF',
              bgcolor: 'rgba(124, 77, 255, 0.04)'
            }
          }}
        >
          Unblock
        </Button>
      )
    }
  ]
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <IconButton onClick={() => router.push('/')} size="small">
            <ArrowBackIcon />
          </IconButton>
          <h1 className="text-3xl font-bold">Profile Settings</h1>
        </div>
        
        <Chip
          label={truncateWallet(wallet.publicKey.toString())}
          sx={{ fontFamily: 'monospace' }}
        />
      </div>
      
      {/* Tabs */}
      <MuiCard sx={{ mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(_, newValue) => setCurrentTab(newValue)}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '16px',
              fontWeight: 500
            },
            '& .Mui-selected': {
              color: '#7C4DFF !important'
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#7C4DFF'
            }
          }}
        >
          <Tab
            value="profile"
            label="Profile"
            icon={<PersonIcon />}
            iconPosition="start"
          />
          <Tab
            value="privacy"
            label="Privacy"
            icon={<VisibilityIcon />}
            iconPosition="start"
          />
          <Tab
            value="notifications"
            label="Notifications"
            icon={<NotificationsIcon />}
            iconPosition="start"
          />
          <Tab
            value="blocked"
            label="Blocked Users"
            icon={<BlockIcon />}
            iconPosition="start"
          />
        </Tabs>
      </MuiCard>
      
      {/* Profile Tab */}
      {currentTab === 'profile' && (
        <MuiCard>
          <MuiCardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Typography variant="h6" gutterBottom>
                  Profile Information
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage your display name, bio, and avatar
                </Typography>
              </div>
              
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => setShowEditModal(true)}
                sx={{
                  bgcolor: '#7C4DFF',
                  '&:hover': { bgcolor: '#6C3FEF' },
                  textTransform: 'none'
                }}
              >
                Edit Profile
              </Button>
            </div>
            
            <Divider sx={{ my: 3 }} />
            
            <div className="space-y-4">
              {/* Wallet Address */}
              <div>
                <Typography variant="caption" color="text.secondary">
                  Wallet Address
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                  {wallet.publicKey.toString()}
                </Typography>
              </div>
              
              {/* Display Name */}
              <div>
                <Typography variant="caption" color="text.secondary">
                  Display Name
                </Typography>
                <Typography variant="body1" sx={{ mt: 0.5 }}>
                  {profile?.display_name || (
                    <span className="italic text-gray-400">Not set</span>
                  )}
                </Typography>
              </div>
              
              {/* Bio */}
              <div>
                <Typography variant="caption" color="text.secondary">
                  Bio
                </Typography>
                <Typography variant="body1" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                  {profile?.bio || (
                    <span className="italic text-gray-400">Not set</span>
                  )}
                </Typography>
              </div>
              
              {/* Avatar URL */}
              <div>
                <Typography variant="caption" color="text.secondary">
                  Avatar URL
                </Typography>
                <Typography variant="body1" sx={{ mt: 0.5 }}>
                  {profile?.avatar_url || (
                    <span className="italic text-gray-400">Not set</span>
                  )}
                </Typography>
                {profile?.avatar_url && (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="mt-2 w-24 h-24 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
              </div>
            </div>
          </MuiCardContent>
        </MuiCard>
      )}
      
      {/* Privacy Tab */}
      {currentTab === 'privacy' && (
        <MuiCard>
          <MuiCardContent className="p-6">
            <Typography variant="h6" gutterBottom>
              Privacy Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Control who can view your profile and send you messages
            </Typography>
            
            {/* Privacy Level */}
            <FormControl component="fieldset" sx={{ mb: 4, width: '100%' }}>
              <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
                Profile Visibility
              </FormLabel>
              <RadioGroup
                value={privacyLevel}
                onChange={(e) => setPrivacyLevel(e.target.value as any)}
              >
                <FormControlLabel
                  value="public"
                  control={<Radio sx={{ color: '#7C4DFF', '&.Mui-checked': { color: '#7C4DFF' } }} />}
                  label={
                    <div>
                      <Typography variant="body1" fontWeight={500}>
                        👥 Public
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Anyone can view your full profile including display name, bio, and avatar
                      </Typography>
                    </div>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />
                
                <FormControlLabel
                  value="holders_only"
                  control={<Radio sx={{ color: '#7C4DFF', '&.Mui-checked': { color: '#7C4DFF' } }} />}
                  label={
                    <div>
                      <Typography variant="body1" fontWeight={500}>
                        💎 Holders Only
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Only token holders can view your profile details. Others see minimal info
                      </Typography>
                    </div>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />
                
                <FormControlLabel
                  value="private"
                  control={<Radio sx={{ color: '#7C4DFF', '&.Mui-checked': { color: '#7C4DFF' } }} />}
                  label={
                    <div>
                      <Typography variant="body1" fontWeight={500}>
                        🔒 Private
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Only you can view your full profile. Others only see your wallet address
                      </Typography>
                    </div>
                  }
                  sx={{ alignItems: 'flex-start' }}
                />
              </RadioGroup>
            </FormControl>
            
            <Divider sx={{ my: 4 }} />
            
            {/* Message Permissions */}
            <FormControl component="fieldset" sx={{ mb: 4, width: '100%' }}>
              <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
                Message Permissions
              </FormLabel>
              <RadioGroup
                value={allowMessagesFrom}
                onChange={(e) => setAllowMessagesFrom(e.target.value as any)}
              >
                <FormControlLabel
                  value="everyone"
                  control={<Radio sx={{ color: '#7C4DFF', '&.Mui-checked': { color: '#7C4DFF' } }} />}
                  label={
                    <div>
                      <Typography variant="body1" fontWeight={500}>
                        ✉️ Everyone
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Anyone can send you messages. Best for networking and open communication
                      </Typography>
                    </div>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />
                
                <FormControlLabel
                  value="holders_only"
                  control={<Radio sx={{ color: '#7C4DFF', '&.Mui-checked': { color: '#7C4DFF' } }} />}
                  label={
                    <div>
                      <Typography variant="body1" fontWeight={500}>
                        💎 Token Holders Only
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Only users who hold tokens can message you. Requires token verification
                      </Typography>
                    </div>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />
                
                <FormControlLabel
                  value="nobody"
                  control={<Radio sx={{ color: '#7C4DFF', '&.Mui-checked': { color: '#7C4DFF' } }} />}
                  label={
                    <div>
                      <Typography variant="body1" fontWeight={500}>
                        🚫 Nobody
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        No one can send you new messages. Good for taking a break
                      </Typography>
                    </div>
                  }
                  sx={{ alignItems: 'flex-start' }}
                />
              </RadioGroup>
            </FormControl>
            
            {/* Live Preview */}
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Current Settings Preview
              </Typography>
              <Typography variant="body2">
                Profile visibility: <strong>{privacyLevel.replace('_', ' ')}</strong>
                <br />
                Can receive messages from: <strong>{allowMessagesFrom.replace('_', ' ')}</strong>
              </Typography>
            </Alert>
            
            {/* Save Button */}
            <Button
              variant="contained"
              onClick={handleSavePrivacy}
              disabled={savingPrivacy}
              fullWidth
              sx={{
                bgcolor: '#7C4DFF',
                '&:hover': { bgcolor: '#6C3FEF' },
                textTransform: 'none',
                py: 1.5,
                fontSize: '16px'
              }}
            >
              {savingPrivacy ? 'Saving...' : 'Save Privacy Settings'}
            </Button>
          </MuiCardContent>
        </MuiCard>
      )}
      
      {/* Notifications Tab */}
      {currentTab === 'notifications' && wallet?.publicKey && (
        <Card>
          <CardContent className="p-6">
            <NotificationSettings 
              walletAddress={wallet.publicKey.toString()}
              currentProfile={profile}
              onSave={handleSaveProfile}
            />
          </CardContent>
        </Card>
      )}
      
      {/* Blocked Users Tab */}
      {currentTab === 'blocked' && (
        <MuiCard>
          <MuiCardContent className="p-6">
            <Typography variant="h6" gutterBottom>
              Blocked Users
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Manage users you have blocked. Blocked users cannot message you or view your activity
            </Typography>
            
            {loadingBlocked ? (
              <div className="text-center py-12">
                <CircularProgress />
                <Typography sx={{ mt: 2 }}>Loading blocked users...</Typography>
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="text-center py-12">
                <BlockIcon sx={{ fontSize: 64, color: '#E0E0E0', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No blocked users
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  You haven't blocked anyone yet
                </Typography>
              </div>
            ) : (
              <div style={{ height: 400, width: '100%' }}>
                <DataGrid
                  rows={blockedUsers}
                  columns={blockedUsersColumns}
                  pageSize={10}
                  rowsPerPageOptions={[10, 25, 50]}
                  disableSelectionOnClick
                  sx={{
                    '& .MuiDataGrid-cell:focus': {
                      outline: 'none'
                    },
                    '& .MuiDataGrid-columnHeader:focus': {
                      outline: 'none'
                    }
                  }}
                />
              </div>
            )}
          </MuiCardContent>
        </MuiCard>
      )}
      
      {/* Profile Edit Modal */}
      <ProfileEditModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        currentProfile={profile}
        onSave={handleSaveProfile}
      />
    </div>
  )
}

