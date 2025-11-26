'use client'

import { useState, useEffect } from 'react'
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  IconButton, 
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  Button,
  CircularProgress,
  Box
} from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { FeedItem } from '@/types/feed'
import { useRouter } from 'next/navigation'
import { getDeepLink } from '@/lib/feed-navigation'

interface BatchedActivityModalProps {
  item: FeedItem
  open: boolean
  onClose: () => void
  projectId: string
}

/**
 * BatchedActivityModal - Modal for viewing batched activity details
 * 
 * Shows expanded view of batched activities with full participant list.
 * Displays all voters, commenters, or milestone achievers with details.
 * 
 * Features:
 * - Full participant list with avatars
 * - Vote weights for voting activities
 * - Comments for comment activities
 * - Timestamps for all participants
 * - "View Source" button to navigate to source content
 * - Loading and empty states
 * 
 * @param item - Feed item with batched activities
 * @param open - Modal open state
 * @param onClose - Close handler
 * @param projectId - Project UUID for navigation
 * 
 * @example
 * ```tsx
 * <BatchedActivityModal 
 *   item={batchedItem}
 *   open={modalOpen}
 *   onClose={() => setModalOpen(false)}
 *   projectId="project-uuid-123"
 * />
 * ```
 */
export function BatchedActivityModal({ item, open, onClose, projectId }: BatchedActivityModalProps) {
  const router = useRouter()
  const [participants, setParticipants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (!open || !item.batchedItems) {
      setLoading(false)
      return
    }
    
    // Extract participants from batched items
    const participantData = item.batchedItems.map(batchedItem => ({
      wallet: batchedItem.wallet,
      weight: batchedItem.weight,
      message: batchedItem.message,
      timestamp: batchedItem.timestamp
    }))
    
    // Sort by weight descending (for votes) or timestamp descending (for comments)
    const sorted = participantData.sort((a, b) => {
      if (a.weight !== undefined && b.weight !== undefined) {
        return b.weight - a.weight
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
    
    setParticipants(sorted)
    setLoading(false)
  }, [open, item])
  
  const getModalTitle = (): string => {
    switch (item.type) {
      case 'job_application_upvoted':
        return `Application Voters (${item.batchedCount || 0})`
      case 'job_comment':
        return `Comments (${item.batchedCount || 0})`
      case 'karma_milestone':
        return `Karma Milestone - ${formatNumber(item.data.milestone)}`
      case 'asset_upvoted':
        return `Asset Voters (${item.batchedCount || 0})`
      default:
        return 'Activity Details'
    }
  }
  
  const handleViewSource = () => {
    const deepLink = getDeepLink(item, projectId)
    if (deepLink) {
      router.push(deepLink.url)
      onClose()
    }
  }
  
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
    return num.toString()
  }
  
  const truncateAddress = (address: string): string => {
    if (!address) return '...'
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid',
        borderColor: 'divider',
        pb: 2
      }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {getModalTitle()}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 2 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        
        {!loading && participants.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
            No participants found
          </Typography>
        )}
        
        {!loading && participants.length > 0 && (
          <List sx={{ py: 0 }}>
            {participants.map((participant, index) => (
              <ListItem 
                key={`${participant.wallet}-${index}`}
                sx={{
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: 'background.default',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar 
                    sx={{ 
                      bgcolor: 'primary.main',
                      width: 36,
                      height: 36,
                      fontSize: 14
                    }}
                  >
                    {truncateAddress(participant.wallet).slice(0, 2).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {truncateAddress(participant.wallet)}
                      </Typography>
                      {/* Placeholder for future WalletAddressWithButtons integration */}
                    </Box>
                  }
                  secondary={
                    <>
                      {participant.message && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                          {participant.message}
                        </Typography>
                      )}
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {new Date(participant.timestamp).toLocaleString()}
                      </Typography>
                    </>
                  }
                />
                
                {participant.weight !== undefined && (
                  <Chip 
                    label={`${participant.weight.toFixed(2)}%`}
                    size="small"
                    sx={{
                      bgcolor: 'primary.light',
                      color: 'primary.contrastText',
                      fontWeight: 600,
                      fontSize: 11
                    }}
                  />
                )}
              </ListItem>
            ))}
          </List>
        )}
        
        {/* View Source Button */}
        {(item.type.includes('job_') || item.type.includes('asset_')) && (
          <Button 
            fullWidth 
            variant="outlined"
            onClick={handleViewSource}
            sx={{ mt: 2 }}
          >
            {item.type.includes('job_') ? 'View Job Details' : 'View Asset Details'}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

