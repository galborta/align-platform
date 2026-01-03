'use client'

import { Box, Typography, Button } from '@mui/material'
import { Timeline as TimelineIcon } from '@mui/icons-material'
import { useRouter } from 'next/navigation'

interface FeedEmptyStateProps {
  projectId: string
  onAddAsset?: () => void
  onPostWork?: () => void
}

/**
 * FeedEmptyState - Empty state for activity feed
 * 
 * Displays when no activities exist for a project.
 * Encourages users to contribute with action buttons.
 * 
 * @param projectId - Project ID for navigation links
 * @param onAddAsset - Optional callback to open add asset modal
 * 
 * @example
 * ```tsx
 * {!loading && feedItems.length === 0 && (
 *   <FeedEmptyState projectId={projectId} onAddAsset={() => setShowModal(true)} />
 * )}
 * ```
 */
export function FeedEmptyState({ projectId, onAddAsset, onPostWork }: FeedEmptyStateProps) {
  const router = useRouter()
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        textAlign: 'center'
      }}
    >
      <TimelineIcon 
        sx={{ 
          fontSize: 64, 
          color: 'text.disabled',
          mb: 2 
        }} 
      />
      
      <Typography 
        variant="h6" 
        sx={{ 
          fontWeight: 600, 
          mb: 1,
          fontFamily: 'var(--font-display)'
        }}
      >
        No activity yet
      </Typography>
      
      <Typography 
        variant="body2" 
        sx={{ 
          color: 'text.secondary', 
          mb: 3,
          fontFamily: 'var(--font-body)',
          maxWidth: 400
        }}
      >
        Be the first to contribute to this project!
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button 
          variant="contained"
          onClick={() => onPostWork ? onPostWork() : router.push(`/project/${projectId}/jobs`)}
          sx={{ 
            bgcolor: '#7C4DFF', 
            '&:hover': { bgcolor: '#6A3FE0' },
            fontFamily: 'var(--font-body)'
          }}
        >
          Post Work
        </Button>
        
        <Button 
          variant="outlined"
          onClick={() => onAddAsset ? onAddAsset() : router.push(`/project/${projectId}`)}
          sx={{
            borderColor: '#7C4DFF',
            color: '#7C4DFF',
            '&:hover': {
              borderColor: '#6A3FE0',
              bgcolor: 'rgba(124, 77, 255, 0.08)'
            },
            fontFamily: 'var(--font-body)'
          }}
        >
          Submit Asset
        </Button>
      </Box>
    </Box>
  )
}













