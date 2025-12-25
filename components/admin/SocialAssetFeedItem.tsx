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
  RemoveCircleOutline as UnbanIcon,
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
  isGlobalAdmin?: boolean  // Show project name when viewing as global admin
}

export function SocialAssetFeedItem({ 
  item, 
  projectId: propProjectId, 
  editorWallet,
  onActionComplete,
  isHighlighted = false,
  isGlobalAdmin = false
}: SocialAssetFeedItemProps) {
  // Always use the item's actual projectId for API calls
  // This is important for global admin view where propProjectId might be 'all'
  const projectId = item.projectId || propProjectId
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
  const isHidden = item.status === 'hidden'  // User was banned

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

  // Approve asset (works for pending and rejected assets)
  const handleApprove = async () => {
    if (isApproved) return

    setLoading(true)
    try {
      const response = await fetch('/api/assets/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: item.id,
          projectId,
          editorWallet,
          isReapproval: isRejected // Flag if this is re-approving a rejected asset
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve asset')
      }

      if (isRejected) {
        toast.success('Asset re-approved successfully!')
      } else {
        toast.success(`Asset approved! Submitter earned ${data.karmaAwarded?.toFixed(1) || 0} karma`)
      }
      onActionComplete()
    } catch (error) {
      console.error('Error approving asset:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to approve asset')
    } finally {
      setLoading(false)
    }
  }

  // Reject asset (works for pending assets)
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

  // Revoke approval (for approved assets)
  const handleRevoke = async () => {
    if (!isApproved) return

    setLoading(true)
    try {
      const response = await fetch('/api/assets/revoke', {
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
        throw new Error(data.error || 'Failed to revoke asset')
      }

      toast.success('Asset approval revoked')
      onActionComplete()
    } catch (error) {
      console.error('Error revoking asset:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to revoke asset')
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

  // Unban user and restore asset to pending
  const handleUnban = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/assets/unban-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userWallet: item.submitterWallet,
          projectId,
          editorWallet,
          assetId: item.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to unban user')
      }

      toast.success(`User unbanned. ${data.assetsRestored} assets restored`)
      onActionComplete()
    } catch (error) {
      console.error('Error unbanning user:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to unban user')
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
          bgcolor: isHidden
            ? 'rgba(156, 39, 176, 0.08)'  // Purple for banned/hidden
            : isApproved 
            ? 'rgba(76, 175, 80, 0.08)' 
            : isRejected 
            ? 'rgba(244, 67, 54, 0.08)' 
            : isHighlighted 
            ? 'rgba(255, 184, 0, 0.1)'
            : 'background.paper',
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
              {/* Show project name for global admin */}
              {isGlobalAdmin && item.projectName && (
                <>
                  {' • '}
                  <Box component="span" sx={{ fontWeight: 600, color: '#7C4DFF' }}>
                    {item.projectName}
                  </Box>
                </>
              )}
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
          {isHidden && (
            <Chip
              icon={<BanIcon sx={{ fontSize: 14 }} />}
              label="User Banned"
              size="small"
              sx={{ 
                bgcolor: '#9C27B0', 
                color: 'white',
                '& .MuiChip-icon': { color: 'white' }
              }}
            />
          )}

          {/* More Menu - show for all statuses */}
          <IconButton
            size="small"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            disabled={loading}
          >
            <MoreIcon />
          </IconButton>
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

        {/* Action Buttons */}
        <Box sx={{ 
          display: 'flex', 
          gap: 1,
          flexDirection: { xs: 'column', sm: 'row' }
        }}>
          {/* Pending: Show Approve and Reject */}
          {isPending && (
            <>
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
            </>
          )}
          
          {/* Approved: Show Revoke option */}
          {isApproved && (
            <Button
              variant="outlined"
              color="warning"
              size="small"
              startIcon={<RejectIcon />}
              onClick={handleRevoke}
              disabled={loading}
              fullWidth
              sx={{ flex: 1 }}
            >
              {loading ? 'Revoking...' : 'Revoke'}
            </Button>
          )}
          
          {/* Rejected: Show Re-approve option */}
          {isRejected && (
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
              Re-approve
            </Button>
          )}
          
          {/* Hidden (Banned): No action buttons, use menu for unban */}
        </Box>
      </Box>

      {/* More Menu - Only ban/unban options */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {/* For hidden (banned) assets: option to unban */}
        {isHidden ? (
          <MenuItem onClick={() => {
            setAnchorEl(null)
            handleUnban()
          }}>
            <UnbanIcon sx={{ mr: 1, fontSize: 18, color: '#9C27B0' }} />
            Unban User
          </MenuItem>
        ) : (
          /* Ban user option - available for non-hidden statuses */
          <MenuItem onClick={() => {
            setAnchorEl(null)
            setBanDialogOpen(true)
          }}>
            <BanIcon sx={{ mr: 1, fontSize: 18, color: 'error.main' }} />
            Ban User
          </MenuItem>
        )}
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

