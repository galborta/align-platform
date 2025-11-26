import { Dialog, DialogTitle, DialogContent, IconButton, Typography } from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { FeedItem } from '@/types/feed'

interface BatchedActivityModalProps {
  item: FeedItem
  open: boolean
  onClose: () => void
}

/**
 * BatchedActivityModal - Modal for viewing batched activity details
 * 
 * Shows expanded view of batched activities (e.g., multiple upvotes, comments).
 * Currently a placeholder shell - full implementation coming in Sprint 5.
 * 
 * @param item - Feed item with batched activities
 * @param open - Modal open state
 * @param onClose - Close handler
 * 
 * @example
 * ```tsx
 * <BatchedActivityModal 
 *   item={batchedItem}
 *   open={modalOpen}
 *   onClose={() => setModalOpen(false)}
 * />
 * ```
 */
export function BatchedActivityModal({ item, open, onClose }: BatchedActivityModalProps) {
  const getModalTitle = (): string => {
    if (item.type === 'job_application_upvoted') return 'Application Voters'
    if (item.type === 'job_comment') return 'Comments'
    if (item.type === 'karma_milestone') return `Karma Milestone - ${item.data.milestone}`
    if (item.type === 'asset_upvoted') return 'Asset Voters'
    return 'Details'
  }
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 600
        }}
      >
        {getModalTitle()}
        <IconButton 
          onClick={onClose} 
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.04)'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'text.secondary', 
            textAlign: 'center', 
            py: 4,
            fontFamily: 'var(--font-body)'
          }}
        >
          Detailed view coming in Sprint 5
        </Typography>
        
        {/* Future implementation:
         * - List all batched items
         * - Show user avatars and display names
         * - Include timestamps for each item
         * - Add "View profile" links
         * - Show karma earned per action
         */}
      </DialogContent>
    </Dialog>
  )
}


