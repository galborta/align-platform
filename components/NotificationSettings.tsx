'use client'

import { useState, useEffect } from 'react'
import { 
  Switch, 
  FormControl, 
  FormControlLabel, 
  Select, 
  MenuItem,
  Alert,
  AlertTitle,
  Chip,
  Typography,
  Divider,
  Button,
  Box,
  List,
  ListItem,
  ListItemText,
  IconButton,
  TextField
} from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import { toast } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import {
  requestNotificationPermission,
  canShowNotifications,
  getMutedConversations,
  unmuteConversation,
  showTestNotification,
} from '@/lib/notifications'
import { Database } from '@/types/database'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']
type Conversation = Database['public']['Tables']['conversations']['Row']

interface NotificationSettingsProps {
  walletAddress: string
  currentProfile: UserProfile | null
  onSave: (updates: Partial<UserProfile>) => Promise<void>
}

export function NotificationSettings({ walletAddress, currentProfile, onSave }: NotificationSettingsProps) {
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [previewLevel, setPreviewLevel] = useState<'full' | 'sender' | 'none'>('full')
  const [notifyWhileOpen, setNotifyWhileOpen] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Quiet hours
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false)
  const [quietHoursStart, setQuietHoursStart] = useState('22:00')
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00')
  
  // Muted conversations
  const [mutedConversations, setMutedConversations] = useState<Array<{
    id: string
    participant: string
    displayName?: string
  }>>([])
  const [loadingMuted, setLoadingMuted] = useState(false)

  // Load settings on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check browser permission
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission)
    }

    // Load user preferences from profile
    if (currentProfile) {
      setNotificationsEnabled(currentProfile.notification_enabled)
      setSoundEnabled(currentProfile.notification_sound)
      setPreviewLevel(currentProfile.notification_preview)
    }
    
    // Load muted conversations
    loadMutedConversations()
  }, [currentProfile])

  // Load muted conversations
  const loadMutedConversations = async () => {
    setLoadingMuted(true)
    try {
      const mutedIds = getMutedConversations()
      
      if (mutedIds.length === 0) {
        setMutedConversations([])
        return
      }

      // Get conversation details
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .in('id', mutedIds)

      if (error) throw error

      // Get the other participant for each conversation
      const conversationsWithParticipant = conversations?.map(conv => {
        const otherParticipant = conv.participant_1 === walletAddress 
          ? conv.participant_2 
          : conv.participant_1
        
        return {
          id: conv.id,
          participant: otherParticipant,
          displayName: undefined // Will fetch separately if needed
        }
      }) || []

      setMutedConversations(conversationsWithParticipant)

      // Fetch display names for participants
      if (conversationsWithParticipant.length > 0) {
        const participantAddresses = conversationsWithParticipant.map(c => c.participant)
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('wallet_address, display_name')
          .in('wallet_address', participantAddresses)

        if (profiles) {
          setMutedConversations(prev => prev.map(conv => {
            const profile = profiles.find(p => p.wallet_address === conv.participant)
            return {
              ...conv,
              displayName: profile?.display_name || undefined
            }
          }))
        }
      }
    } catch (error) {
      console.error('Error loading muted conversations:', error)
    } finally {
      setLoadingMuted(false)
    }
  }

  // Request browser permission
  const handleRequestPermission = async () => {
    setIsRequesting(true)
    try {
      const permission = await requestNotificationPermission()
      setBrowserPermission(permission)
      
      if (permission === 'granted') {
        toast.success('Browser permission granted! 🎉')
        await handleSaveSettings({ notification_enabled: true })
      } else if (permission === 'denied') {
        toast.error('Permission denied. Enable in browser settings.')
      }
    } catch (error) {
      console.error('Error requesting permission:', error)
      toast.error('Failed to request permission')
    } finally {
      setIsRequesting(false)
    }
  }

  // Save settings to database
  const handleSaveSettings = async (updates: Partial<UserProfile>) => {
    setIsSaving(true)
    try {
      await onSave(updates)
      toast.success('Settings saved!')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  // Toggle notifications
  const handleToggleNotifications = async (enabled: boolean) => {
    if (enabled && browserPermission !== 'granted') {
      toast.error('Please request browser permission first')
      return
    }
    
    setNotificationsEnabled(enabled)
    await handleSaveSettings({ notification_enabled: enabled })
  }

  // Toggle sound
  const handleToggleSound = async (enabled: boolean) => {
    setSoundEnabled(enabled)
    await handleSaveSettings({ notification_sound: enabled })
  }

  // Change preview level
  const handleChangePreview = async (level: 'full' | 'sender' | 'none') => {
    setPreviewLevel(level)
    await handleSaveSettings({ notification_preview: level })
  }

  // Unmute conversation
  const handleUnmute = async (conversationId: string) => {
    try {
      unmuteConversation(conversationId)
      setMutedConversations(prev => prev.filter(c => c.id !== conversationId))
      toast.success('Conversation unmuted')
    } catch (error) {
      console.error('Error unmuting conversation:', error)
      toast.error('Failed to unmute conversation')
    }
  }

  // Test notification
  const handleTestNotification = () => {
    if (!canShowNotifications()) {
      toast.error('Please enable notifications first')
      return
    }

    try {
      showTestNotification()
      toast.success('Test notification sent!')
    } catch (error) {
      console.error('Error showing test notification:', error)
      toast.error('Failed to show test notification')
    }
  }

  // Format wallet address
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // Get permission status info
  const getPermissionStatus = () => {
    switch (browserPermission) {
      case 'granted':
        return { color: 'success' as const, text: 'Granted', icon: <NotificationsActiveIcon /> }
      case 'denied':
        return { color: 'error' as const, text: 'Blocked', icon: <NotificationsOffIcon /> }
      default:
        return { color: 'warning' as const, text: 'Not Requested', icon: <NotificationsNoneIcon /> }
    }
  }

  const permissionStatus = getPermissionStatus()

  return (
    <Box>
      {/* Section 1: Browser Notifications */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>
            Browser Notifications
          </Typography>
          <Chip
            label={permissionStatus.text}
            color={permissionStatus.color}
            size="small"
            icon={permissionStatus.icon}
          />
        </Box>

        {/* Browser not supported */}
        {!('Notification' in window) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>Browser Not Supported</AlertTitle>
            Your browser doesn't support notifications. Try Chrome, Firefox, or Safari.
          </Alert>
        )}

        {/* Permission not granted */}
        {browserPermission === 'default' && 'Notification' in window && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>Enable Browser Notifications</AlertTitle>
            Allow Orggly to send you notifications when you receive new messages.
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                onClick={handleRequestPermission}
                disabled={isRequesting}
                sx={{
                  bgcolor: '#7C4DFF',
                  '&:hover': { bgcolor: '#6C3FEF' },
                  textTransform: 'none'
                }}
              >
                {isRequesting ? 'Requesting...' : 'Request Permission'}
              </Button>
            </Box>
          </Alert>
        )}

        {/* Permission denied */}
        {browserPermission === 'denied' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Notifications Blocked</AlertTitle>
            You've blocked notifications. To enable them:
            <ol style={{ marginTop: 8, marginLeft: 16, fontSize: '14px' }}>
              <li>Click the lock icon in your browser's address bar</li>
              <li>Find "Notifications" and change to "Allow"</li>
              <li>Refresh this page</li>
            </ol>
          </Alert>
        )}

        {/* Enable/Disable Toggle */}
        {browserPermission === 'granted' && (
          <FormControlLabel
            control={
              <Switch
                checked={notificationsEnabled}
                onChange={(e) => handleToggleNotifications(e.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#7C4DFF',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#7C4DFF',
                  },
                }}
              />
            }
            label={
              <Box>
                <Typography variant="body1" fontWeight={500}>
                  Enable browser notifications
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Get notified when you receive new messages (only when app is in background)
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', mb: 2 }}
          />
        )}
      </Box>

      {/* Section 2: Notification Preferences */}
      {browserPermission === 'granted' && notificationsEnabled && (
        <>
          <Divider sx={{ my: 4 }} />
          
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Notification Preferences
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Customize how you receive notifications
            </Typography>

            {/* Sound Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={soundEnabled}
                  onChange={(e) => handleToggleSound(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#7C4DFF',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#7C4DFF',
                    },
                  }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {soundEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      Play sound for new messages
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Hear a subtle beep when notifications appear
                    </Typography>
                  </Box>
                </Box>
              }
              sx={{ alignItems: 'flex-start', mb: 3 }}
            />

            {/* Preview Level */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <VisibilityIcon fontSize="small" sx={{ color: '#7C4DFF' }} />
                <Typography variant="body1" fontWeight={500}>
                  Show message preview
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Choose how much content to show in notification popups
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={previewLevel}
                  onChange={(e) => handleChangePreview(e.target.value as 'full' | 'sender' | 'none')}
                  disabled={isSaving}
                  sx={{
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#D1D5DB',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#7C4DFF',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#7C4DFF',
                    },
                  }}
                >
                  <MenuItem value="full">
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        Full message
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Show sender name and message content (up to 100 characters)
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="sender">
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        Sender name only
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Only show who sent the message, hide content
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="none">
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        Generic alert
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Just show "New message" without any details
                      </Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Test Notification Button */}
            <Button
              variant="outlined"
              onClick={handleTestNotification}
              fullWidth
              sx={{
                color: '#7C4DFF',
                borderColor: '#7C4DFF',
                '&:hover': {
                  borderColor: '#6C3FEF',
                  bgcolor: 'rgba(124, 77, 255, 0.04)'
                },
                textTransform: 'none',
                py: 1.5
              }}
            >
              🔔 Send Test Notification
            </Button>
          </Box>
        </>
      )}

      {/* Section 3: Per-Conversation Settings */}
      {browserPermission === 'granted' && notificationsEnabled && (
        <>
          <Divider sx={{ my: 4 }} />
          
          <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Muted Conversations
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              You won't receive notifications from these conversations
            </Typography>

            {loadingMuted ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                Loading...
              </Typography>
            ) : mutedConversations.length === 0 ? (
              <Alert severity="info">
                <Typography variant="body2">
                  No muted conversations. You can mute conversations from the messages sidebar.
                </Typography>
              </Alert>
            ) : (
              <List sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #E5E7EB' }}>
                {mutedConversations.map((conv, index) => (
                  <ListItem
                    key={conv.id}
                    divider={index < mutedConversations.length - 1}
                    secondaryAction={
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleUnmute(conv.id)}
                        sx={{
                          color: '#7C4DFF',
                          borderColor: '#7C4DFF',
                          '&:hover': {
                            borderColor: '#6C3FEF',
                            bgcolor: 'rgba(124, 77, 255, 0.04)'
                          },
                          textTransform: 'none'
                        }}
                      >
                        Unmute
                      </Button>
                    }
                  >
                    <ListItemText
                      primary={conv.displayName || formatAddress(conv.participant)}
                      secondary={`Wallet: ${formatAddress(conv.participant)}`}
                      primaryTypographyProps={{ fontWeight: 500 }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </>
      )}
    </Box>
  )
}

