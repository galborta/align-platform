'use client'

import { useState } from 'react'
import { 
  Box, 
  Typography, 
  Button, 
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material'
import { 
  Twitter as TwitterIcon,
  Instagram as InstagramIcon,
  VideoLibrary as TikTokIcon,
  YouTube as YouTubeIcon,
  Language as DomainIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Block as BanIcon,
  MoreVert as MoreIcon
} from '@mui/icons-material'
import { WalletAddressWithButtons } from '@/components/WalletAddressWithButtons'
import type { SocialAssetFeedItem } from '@/lib/feed-queries-social-assets'
import { toast } from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

interface SocialAssetFeedItemProps {
  item: SocialAssetFeedItem
  projectId: string
  editorWallet: string
  onActionComplete: () => void
  isHighlighted?: boolean
}

export function SocialAssetFeedItem({ 
  item, 
  projectId, 
  editorWallet,
  onActionComplete,
  isHighlighted = false
}: SocialAssetFeedItemProps) {
  const [loading, setLoading] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [banReason, setBanReason] = useState('')
  const [banDuration, setBanDuration] = useState<'7d' | '30d' | '90d' | 'permanent'>('30d')

  const isPending = item.status === 'pending'
  const isApproved = item.status === 'verified'
  const isRejected = item.status === 'rejected'

  // Get platform icon
  const getPlatformIcon = () => {
    if (item.assetType === 'domain') {
      return <DomainIcon sx={{ fontSize: 20, color: '#4A5568' }} />
    }

    switch (item.platform?.toLowerCase()) {
      case 'twitter':
        return <TwitterIcon sx={{ fontSize: 20, color: '#1DA1F2' }} />
      case 'instagram':
        return <InstagramIcon sx={{ fontSize: 20, color: '#E1306C' }} />
      case 'tiktok':
        return <TikTokIcon sx={{ fontSize: 20, color: '#000000' }} />
      case 'youtube':
        return <YouTubeIcon sx={{ fontSize: 20, color: '#FF0000' }} />
      default:
        return <DomainIcon sx={{ fontSize: 20, color: '#4A5568' }} />
    }
  }

  // Get classification badge color
  const getClassificationColor = () => {
    return item.classification === 'official' ? '#7C4DFF' : '#FFB800'
  }

  const handleApprove = async () => {
    if (!isPending) return

    setLoading(true)
    try {
      const response = await fetch('/api/assets/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: item.id,
          projectId,
          editorWallet
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve asset')
      }

      toast.success(`Asset approved! Submitter earned ${data.karmaAwarded.toFixed(1)} karma`)
      onActionComplete()
    } catch (error) {
      console.error('Error approving asset:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to approve asset')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!isPending) return

    setLoading(true)
    try {
      const response = await fetch('/api/assets/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: item.id,
          projectId,
          editorWallet,
          reason: rejectionReason
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject asset')
      }

      toast.success('Asset rejected')
      setRejectDialogOpen(false)
      setRejectionReason('')
      onActionComplete()
    } catch (error) {
      console.error('Error rejecting asset:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to reject asset')
    } finally {
      setLoading(false)
    }
  }

  const handleBanUser = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/assets/ban-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userWallet: item.submitterWallet,
          projectId,
          editorWallet,
          reason: banReason,
          duration: banDuration
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to ban user')
      }

      toast.success(`User banned. ${data.assetsHidden} pending assets hidden`)
      setBanDialogOpen(false)
      setBanReason('')
      onActionComplete()
    } catch (error) {
      console.error('Error banning user:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to ban user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Box
        sx={{
          p: { xs: 1.5, sm: 2 },
          border: '1px solid',
          borderColor: isHighlighted ? '#FFB800' : 'divider',
          borderRadius: 2,
          bgcolor: isApproved 
            ? 'success.light' 
            : isRejected 
            ? 'error.light' 
            : isHighlighted 
            ? 'rgba(255, 184, 0, 0.1)'
            : 'background.paper',
          opacity: isApproved || isRejected ? 0.7 : 1,
          transition: 'all 0.2s',
          boxShadow: isHighlighted ? '0 0 0 2px rgba(255, 184, 0, 0.3)' : 'none',
          animation: isHighlighted ? 'pulse-yellow 2s ease-in-out 2' : 'none',
          '@keyframes pulse-yellow': {
            '0%, 100%': {
              boxShadow: '0 0 0 2px rgba(255, 184, 0, 0.3)'
            },
            '50%': {
              boxShadow: '0 0 0 4px rgba(255, 184, 0, 0.5)'
            }
          },
          '&:hover': {
            borderColor: isPending ? '#FFB800' : 'divider',
            boxShadow: isPending ? 1 : 0
          }
        }}
      >
        {/* Header Row */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: { xs: 1, sm: 2 }, 
          mb: 1.5,
          flexWrap: { xs: 'wrap', sm: 'nowrap' }
        }}>
          {/* Platform Icon */}
          <Box sx={{
            width: { xs: 32, sm: 40 },
            height: { xs: 32, sm: 40 },
            borderRadius: 1,
            bgcolor: 'background.default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {getPlatformIcon()}
          </Box>

          {/* Asset Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {item.assetType === 'social' 
                  ? `@${item.handle}`
                  : item.domain
                }
              </Typography>
              <Chip
                label={item.classification}
                size="small"
                sx={{
                  bgcolor: getClassificationColor(),
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: 20
                }}
              />
            </Box>
            
            <Typography variant="caption" color="text.secondary">
              {item.assetType === 'social' 
                ? `${item.platform} ${item.followerTier ? `• ${item.followerTier}` : ''}`
                : 'Domain'
              }
              {' • '}
              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
            </Typography>
          </Box>

          {/* Status Chip */}
          {isApproved && (
            <Chip
              icon={<ApproveIcon sx={{ fontSize: 14 }} />}
              label="Approved"
              size="small"
              color="success"
            />
          )}
          {isRejected && (
            <Chip
              icon={<RejectIcon sx={{ fontSize: 14 }} />}
              label="Rejected"
              size="small"
              color="error"
            />
          )}

          {/* More Menu */}
          {isPending && (
            <IconButton
              size="small"
              onClick={(e) => setAnchorEl(e.currentTarget)}
              disabled={loading}
            >
              <MoreIcon />
            </IconButton>
          )}
        </Box>

        {/* Submitter Row */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1, 
          mb: 1.5,
          flexWrap: 'wrap'
        }}>
          <Typography variant="caption" color="text.secondary">
            Submitted by:
          </Typography>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <WalletAddressWithButtons
              address={item.submitterWallet}
              showCopy
              showMessage
              showTip
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            ({item.submissionTokenPercentage.toFixed(2)}% holder)
          </Typography>
        </Box>

        {/* Rejection Reason (if rejected) */}
        {isRejected && item.rejectionReason && (
          <Box sx={{ 
            p: 1.5, 
            bgcolor: 'error.light', 
            borderRadius: 1, 
            mb: 1.5 
          }}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Rejection reason:
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {item.rejectionReason}
            </Typography>
          </Box>
        )}

        {/* Action Buttons (only for pending) */}
        {isPending && (
          <Box sx={{ 
            display: 'flex', 
            gap: 1,
            flexDirection: { xs: 'column', sm: 'row' }
          }}>
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<ApproveIcon />}
              onClick={handleApprove}
              disabled={loading}
              fullWidth
              sx={{ flex: 1 }}
            >
              Approve
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<RejectIcon />}
              onClick={() => setRejectDialogOpen(true)}
              disabled={loading}
              fullWidth
              sx={{ flex: 1 }}
            >
              Reject
            </Button>
          </Box>
        )}
      </Box>

      {/* More Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          setAnchorEl(null)
          setBanDialogOpen(true)
        }}>
          <BanIcon sx={{ mr: 1, fontSize: 18 }} />
          Ban User
        </MenuItem>
      </Menu>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{
          fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
          fontSize: '24px',
          fontWeight: 700
        }}>
          Reject Asset Submission
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Reason (optional)"
            placeholder="Explain why this asset is being rejected..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button onClick={() => setRejectDialogOpen(false)} disabled={loading} variant="outlined">
            Cancel
          </Button>
          <Button 
            onClick={handleReject} 
            color="error" 
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Rejecting...' : 'Reject Asset'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ban User Dialog */}
      <Dialog open={banDialogOpen} onClose={() => setBanDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{
          fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
          fontSize: '24px',
          fontWeight: 700
        }}>
          Ban User from Asset Submissions
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This will ban <strong>{item.submitterWallet.slice(0, 8)}...</strong> from submitting assets
            and hide all their pending submissions.
          </Typography>
          
          <TextField
            fullWidth
            select
            label="Ban Duration"
            value={banDuration}
            onChange={(e) => setBanDuration(e.target.value as any)}
            sx={{ mb: 2 }}
            SelectProps={{
              native: true
            }}
          >
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
            <option value="permanent">Permanent</option>
          </TextField>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Ban Reason"
            placeholder="Explain why this user is being banned..."
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button onClick={() => setBanDialogOpen(false)} disabled={loading} variant="outlined">
            Cancel
          </Button>
          <Button 
            onClick={handleBanUser} 
            color="error" 
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Banning...' : 'Ban User'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

