import { Box, Skeleton } from '@mui/material'

interface FeedSkeletonProps {
  count?: number
}

/**
 * FeedSkeleton - Loading state for activity feed
 * 
 * Displays skeleton placeholders that match the FeedItem layout.
 * Used while feed data is being fetched.
 * 
 * @param count - Number of skeleton items to render (default: 5)
 * 
 * @example
 * ```tsx
 * {loading && <FeedSkeleton count={5} />}
 * ```
 */
export function FeedSkeleton({ count = 5 }: FeedSkeletonProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {Array.from({ length: count }).map((_, index) => (
        <Box 
          key={index}
          sx={{ 
            display: 'flex', 
            gap: 2, 
            p: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            position: 'relative',
            overflow: 'hidden',
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              transform: 'translateX(-100%)',
              background: 'linear-gradient(90deg, rgba(255, 255, 255, 0) 0, rgba(255, 255, 255, 0.2) 20%, rgba(255, 255, 255, 0.5) 60%, rgba(255, 255, 255, 0))',
              animation: 'shimmer 2s infinite'
            }
          }}
        >
          {/* Icon skeleton */}
          <Skeleton variant="circular" width={40} height={40} />
          
          {/* Content skeleton */}
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="80%" height={20} />
            <Skeleton variant="text" width="40%" height={16} sx={{ mt: 0.5 }} />
          </Box>
        </Box>
      ))}
    </Box>
  )
}


