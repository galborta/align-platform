'use client'

import { useCallback, useState, useRef, memo } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Typography, Chip, Menu, MenuItem } from '@mui/material'
import {
  Work as WorkIcon,
  PersonAdd as PersonAddIcon,
  ThumbUp as ThumbUpIcon,
  AssignmentInd as AssignmentIndIcon,
  CheckCircle as CheckCircleIcon,
  Celebration as CelebrationIcon,
  Gavel as GavelIcon,
  Comment as CommentIcon,
  AddBox as AddBoxIcon,
  Star as StarIcon,
  Verified as VerifiedIcon,
  VisibilityOff as VisibilityOffIcon,
  AttachMoney as AttachMoneyIcon,
  EmojiEvents as EmojiEventsIcon
} from '@mui/icons-material'
import { FeedItem as FeedItemType, ActivityType } from '@/types/feed'
import { isFreshItem } from '@/lib/feed-utils'
import { getDeepLink, buildUrlWithHash, scrollToElement } from '@/lib/feed-navigation'
import { WalletAddressWithButtons } from '@/components/WalletAddressWithButtons'

interface FeedItemProps {
  item: FeedItemType
  projectId: string
  tokenMint?: string | null
  onClickBatched?: (item: FeedItemType) => void
  isMobile?: boolean  // Add mobile flag
}

/**
 * Get the appropriate icon for each activity type
 */
function getIcon(type: ActivityType): React.ReactNode {
  const iconMap: Record<ActivityType, React.ReactNode> = {
    job_posted: <WorkIcon fontSize="small" />,
    job_applied: <PersonAddIcon fontSize="small" />,
    job_application_upvoted: <ThumbUpIcon fontSize="small" />,
    job_assigned: <AssignmentIndIcon fontSize="small" />,
    job_submitted: <CheckCircleIcon fontSize="small" />,
    job_completed: <CelebrationIcon fontSize="small" />,
    job_disputed: <GavelIcon fontSize="small" />,
    job_comment: <CommentIcon fontSize="small" />,
    asset_submitted: <AddBoxIcon fontSize="small" />,
    asset_upvoted: <ThumbUpIcon fontSize="small" />,
    asset_backed: <StarIcon fontSize="small" />,
    asset_verified: <VerifiedIcon fontSize="small" />,
    asset_hidden: <VisibilityOffIcon fontSize="small" />,
    tip_sent: <AttachMoneyIcon fontSize="small" />,
    karma_milestone: <EmojiEventsIcon fontSize="small" />
  }
  return iconMap[type]
}

/**
 * Get background color for icon based on activity category
 */
function getIconBgColor(type: ActivityType): string {
  if (type.startsWith('job_')) return '#F3E5F5' // purple tint
  if (type.startsWith('asset_')) return '#E3F2FD' // blue tint
  if (type === 'tip_sent') return '#F9FBE7' // lime tint
  if (type === 'karma_milestone') return '#FFF3E0' // orange tint
  return '#F5F5F5' // default gray
}

/**
 * Get icon color based on activity category
 */
function getIconColor(type: ActivityType): string {
  if (type.startsWith('job_')) return '#7C4DFF'
  if (type.startsWith('asset_')) return '#2196F3'
  if (type === 'tip_sent') return '#CDDC39'
  if (type === 'karma_milestone') return '#FF9800'
  return '#757575'
}

/**
 * Generate formatted activity content text
 */
function getActivityContent(item: FeedItemType, projectId: string, tokenMint?: string | null): React.ReactNode {
  const { type, data, batchedCount } = item
  
  switch (type) {
    case 'job_posted':
      return (
        <>
          <WalletAddressWithButtons 
            address={data.actorWallet}
            showMessage
            showTip
            compact
            projectId={projectId}
            tokenMint={tokenMint}
          />
          {' posted job: '}
          <span className="feed-item-link">{data.jobTitle}</span>
        </>
      )
    case 'job_applied':
      return (
        <>
          <WalletAddressWithButtons 
            address={data.actorWallet}
            showMessage
            showTip
            compact
            projectId={projectId}
            tokenMint={tokenMint}
          />
          {' applied to '}
          <span className="feed-item-link">{data.jobTitle}</span>
        </>
      )
    case 'job_application_upvoted':
      if (batchedCount && batchedCount > 1) {
        return (
          <>
            <span 
              className="batched-count" 
              style={{ 
                textDecoration: 'underline',
                cursor: 'pointer',
                fontWeight: 600,
                color: '#7C4DFF'
              }}
            >
              {batchedCount} holders
            </span>
            {' upvoted '}
            <WalletAddressWithButtons 
              address={data.applicantWallet}
              showMessage
              showTip
              compact
              projectId={projectId}
              tokenMint={tokenMint}
            />
            {"'s application for "}
            <span className="feed-item-link">{data.jobTitle}</span>
          </>
        )
      }
      return (
        <>
          <WalletAddressWithButtons 
            address={data.actorWallet}
            showMessage
            showTip
            compact
            projectId={projectId}
            tokenMint={tokenMint}
          />
          {' upvoted '}
          <WalletAddressWithButtons 
            address={data.applicantWallet}
            showMessage
            showTip
            compact
            projectId={projectId}
            tokenMint={tokenMint}
          />
          {"'s application for "}
          <span className="feed-item-link">{data.jobTitle}</span>
        </>
      )
    case 'job_assigned':
      return (
        <>
          <span className="feed-item-link">{data.jobTitle}</span>
          {' assigned to '}
          <WalletAddressWithButtons 
            address={data.assignedTo}
            showMessage
            showTip
            compact
            projectId={projectId}
            tokenMint={tokenMint}
          />
        </>
      )
    case 'job_submitted':
      return (
        <>
          <WalletAddressWithButtons 
            address={data.actorWallet}
            showMessage
            showTip
            compact
            projectId={projectId}
            tokenMint={tokenMint}
          />
          {' submitted work for '}
          <span className="feed-item-link">{data.jobTitle}</span>
        </>
      )
    case 'job_completed':
      return (
        <>
          <span className="feed-item-link">{data.jobTitle}</span>
          {' completed by '}
          <WalletAddressWithButtons 
            address={data.actorWallet}
            showMessage
            showTip
            compact
            projectId={projectId}
            tokenMint={tokenMint}
          />
          {' 🎉'}
        </>
      )
    case 'job_disputed':
      return (
        <>
          Dispute opened for <span className="feed-item-link">{data.jobTitle}</span>
        </>
      )
    case 'job_comment':
      if (batchedCount && batchedCount > 1) {
        return (
          <>
            <span 
              className="batched-count" 
              style={{ 
                textDecoration: 'underline',
                cursor: 'pointer',
                fontWeight: 600,
                color: '#7C4DFF'
              }}
            >
              {batchedCount} comments
            </span>
            {' on '}
            <span className="feed-item-link">{data.jobTitle}</span>
          </>
        )
      }
      return (
        <>
          <WalletAddressWithButtons 
            address={data.actorWallet}
            showMessage
            showTip
            compact
            projectId={projectId}
            tokenMint={tokenMint}
          />
          {' commented on '}
          <span className="feed-item-link">{data.jobTitle}</span>
        </>
      )
    case 'asset_submitted':
      return (
        <>
          <WalletAddressWithButtons 
            address={data.submitterWallet}
            showMessage
            showTip
            compact
            projectId={projectId}
            tokenMint={tokenMint}
          />
          {' submitted '}
          <span className="feed-item-link">{data.assetType} asset</span>
        </>
      )
    case 'asset_upvoted':
      if (batchedCount && batchedCount > 1) {
        return (
          <>
            <span 
              className="batched-count" 
              style={{ 
                textDecoration: 'underline',
                cursor: 'pointer',
                fontWeight: 600,
                color: '#2196F3'
              }}
            >
              {batchedCount} holders
            </span>
            {' upvoted '}
            <span className="feed-item-link">{data.assetType} asset</span>
          </>
        )
      }
      return (
        <>
          <WalletAddressWithButtons 
            address={data.voterWallet}
            showMessage
            showTip
            compact
            projectId={projectId}
            tokenMint={tokenMint}
          />
          {' upvoted '}
          <span className="feed-item-link">{data.assetType} asset</span>
        </>
      )
    case 'asset_backed':
      return (
        <>
          <span className="feed-item-link">{data.assetType} asset</span> reached <strong>backing threshold</strong>
        </>
      )
    case 'asset_verified':
      return (
        <>
          <span className="feed-item-link">{data.assetType} asset</span> <strong>verified</strong> ✓
        </>
      )
    case 'asset_hidden':
      return (
        <>
          <span className="feed-item-link">{data.assetType} asset</span> hidden
        </>
      )
    case 'tip_sent':
      return (
        <>
          <WalletAddressWithButtons 
            address={data.fromWallet}
            showMessage
            showTip
            compact
            projectId={projectId}
            tokenMint={tokenMint}
          />
          {' tipped '}
          <WalletAddressWithButtons 
            address={data.toWallet}
            showMessage
            showTip
            compact
            projectId={projectId}
            tokenMint={tokenMint}
          />
          {` ${data.amountTokens} ${data.tokenSymbol}`}
        </>
      )
    case 'karma_milestone':
      if (batchedCount && batchedCount > 1) {
        return (
          <>
            <span 
              className="batched-count" 
              style={{ 
                textDecoration: 'underline',
                cursor: 'pointer',
                fontWeight: 600,
                color: '#FF9800'
              }}
            >
              {batchedCount} holders
            </span>
            {' reached '}
            {formatNumber(data.milestone)}
            {' karma 🏆'}
          </>
        )
      }
      return (
        <>
          <WalletAddressWithButtons 
            address={data.wallet}
            showMessage
            showTip
            compact
            projectId={projectId}
            tokenMint={tokenMint}
          />
          {' reached '}
          {formatNumber(data.milestone)}
          {' karma 🏆'}
        </>
      )
    default:
      return 'Activity occurred'
  }
}

/**
 * Format timestamp as relative time (5m ago, 2h ago, etc.)
 */
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`
  return date.toLocaleDateString()
}

/**
 * Truncate wallet address for display
 * @deprecated Use WalletAddressWithButtons component instead
 */
function truncateAddress(address: string): string {
  if (!address) return '...'
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

/**
 * Format large numbers with K/M suffixes
 */
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
  return num.toString()
}

/**
 * FeedItem - Displays a single activity feed item
 * 
 * Features:
 * - Color-coded icons based on activity category
 * - Formatted activity text with wallet addresses
 * - Relative timestamps (5m ago, 2h ago, etc.)
 * - Batched activity support (show count)
 * - Fade-in animation on mount
 * - Hover effects for interactivity
 * - Deep linking navigation to source content
 * 
 * @example
 * ```tsx
 * <FeedItem 
 *   item={{
 *     id: '123',
 *     type: 'job_posted',
 *     timestamp: new Date(),
 *     data: { actorWallet: '...', jobTitle: 'Designer Needed' }
 *   }}
 *   projectId="project-uuid-456"
 * />
 * ```
 */
export const FeedItem = memo(function FeedItem({ 
  item, 
  projectId, 
  tokenMint, 
  onClickBatched,
  isMobile = false 
}: FeedItemProps) {
  const router = useRouter()
  const iconColor = getIconColor(item.type)
  const iconBgColor = getIconBgColor(item.type)
  
  // Context menu state for long-press
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const touchMoved = useRef(false)

  // Click handler with deep linking navigation
  const handleItemClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    
    // Check if clicking on batched count indicator
    if (target.closest('.batched-count') && item.batchedCount && item.batchedCount > 1) {
      e.stopPropagation()
      if (onClickBatched) {
        console.log('Opening batched modal for:', item)
        onClickBatched(item)
      }
      return
    }
    
    // Don't navigate if clicking on a button, link, or wallet address inside the item
    if (
      target.tagName === 'BUTTON' || 
      target.tagName === 'A' || 
      target.closest('button') || 
      target.closest('a') ||
      target.closest('.wallet-address-buttons')
    ) {
      return
    }

    // Get deep link for this activity type
    const deepLink = getDeepLink(item, projectId)

    if (!deepLink) {
      // No navigation configured for this type
      console.log('No deep link for item:', item.type)
      return
    }

    const fullUrl = buildUrlWithHash(deepLink.url, deepLink.scrollTo)

    if (deepLink.openInNewTab) {
      window.open(fullUrl, '_blank', 'noopener,noreferrer')
    } else {
      router.push(fullUrl)

      // Scroll to element after navigation (if hash present)
      if (deepLink.scrollTo) {
        scrollToElement(deepLink.scrollTo, 500)
      }
    }
  }, [item, projectId, router, onClickBatched])

  // Long-press handlers for context menu (mobile only)
  const handleTouchStartItem = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return
    
    const touch = e.touches[0]
    touchMoved.current = false
    
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) {
        // Long press detected (500ms)
        setContextMenuPos({ x: touch.clientX, y: touch.clientY })
        setShowContextMenu(true)
        
        // Haptic feedback if available
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
      }
    }, 500)
  }, [isMobile])

  const handleTouchEndItem = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleTouchMoveItem = useCallback(() => {
    touchMoved.current = true
    // Cancel long press if finger moves
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  // Check if item is navigable (for cursor and hover styles)
  const deepLink = getDeepLink(item, projectId)
  const isNavigable = deepLink !== null || (item.batchedCount && item.batchedCount > 1)

  return (
    <>
      <Box
        className="feed-item"
        onClick={handleItemClick}
        onTouchStart={handleTouchStartItem}
        onTouchMove={handleTouchMoveItem}
        onTouchEnd={handleTouchEndItem}
        sx={{
        display: 'flex',
        gap: { xs: 1, md: 2 },  // Smaller gap on mobile
        p: { xs: 1.5, md: 2 },  // Less padding on mobile
        borderRadius: { xs: 1, md: 2 },
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        transition: 'all 0.2s ease',
        minHeight: { xs: 56, md: 64 },  // Ensure touch target size
        cursor: isNavigable ? 'pointer' : 'default',
        // Disable animation on mobile for performance
        animation: isMobile ? 'none' : 'fadeInSlide 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          borderColor: isNavigable ? iconColor : 'divider',
          bgcolor: isNavigable ? 'action.hover' : 'background.paper',
          // No lift on mobile
          transform: isNavigable && !isMobile ? 'translateY(-2px)' : 'none',
          boxShadow: isNavigable && !isMobile ? 1 : 0,
          '& .feed-item-link': {
            textDecoration: isNavigable ? 'underline' : 'none'
          }
        },
        '@keyframes fadeInSlide': {
          '0%': { 
            opacity: 0, 
            transform: 'translateY(-20px)',
            filter: 'blur(4px)'
          },
          '100%': { 
            opacity: 1, 
            transform: 'translateY(0)',
            filter: 'blur(0px)'
          }
        }
      }}
    >
      {/* Icon with color-coded background */}
      <Box 
        sx={{ 
          width: { xs: 32, md: 40 },  // Smaller icon on mobile
          height: { xs: 32, md: 40 },
          minWidth: { xs: 32, md: 40 },
          borderRadius: '50%',
          bgcolor: iconBgColor,
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'transform 0.2s',
          '&:hover': {
            transform: isMobile ? 'none' : 'scale(1.1)'
          }
        }}
      >
        {getIcon(item.type)}
      </Box>
      
      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography 
            variant="body2"
            component="div"
            sx={{ 
              color: 'text.primary', 
              lineHeight: 1.5,
              fontFamily: 'var(--font-body)',
              flex: 1,
              fontSize: { xs: '0.875rem', md: '0.9375rem' },  // Adjust size
              minWidth: 0,  // Allow text truncation
              wordBreak: 'break-word',  // Prevent overflow on long addresses
              '& strong': {
                fontWeight: 600,
                color: 'text.primary'
              }
            }}
          >
            {getActivityContent(item, projectId, tokenMint)}
          </Typography>
          
          {/* New badge for fresh items */}
          {isFreshItem(item) && (
            <Chip 
              label="New" 
              size="small"
              sx={{ 
                height: { xs: 16, md: 18 },
                fontSize: { xs: 9, md: 10 },
                fontWeight: 600,
                bgcolor: '#E3F06F',
                color: '#000',
                '& .MuiChip-label': { px: { xs: 0.5, md: 1 } }
              }}
            />
          )}
        </Box>
        
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'text.secondary', 
            mt: { xs: 0.25, md: 0.5 }, 
            display: 'block',
            fontSize: { xs: 10, md: 11 },  // Smaller timestamp on mobile
            fontFamily: 'var(--font-body)'
          }}
        >
          {formatRelativeTime(item.timestamp)}
        </Typography>
      </Box>

      {/* Batched count badge */}
      {item.batchedCount && item.batchedCount > 1 && (
        <Box
          sx={{
            bgcolor: iconBgColor,
            color: iconColor,
            px: { xs: 1, md: 1.5 },
            py: { xs: 0.25, md: 0.5 },
            borderRadius: 2,
            fontSize: { xs: '0.625rem', md: '0.75rem' },
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            height: 'fit-content',
            flexShrink: 0
          }}
        >
          +{item.batchedCount - 1}
        </Box>
      )}
    </Box>

    {/* Context menu for long-press (mobile only) */}
    <Menu
      open={showContextMenu}
      onClose={() => setShowContextMenu(false)}
      anchorReference="anchorPosition"
      anchorPosition={{ top: contextMenuPos.y, left: contextMenuPos.x }}
    >
      <MenuItem 
        onClick={() => {
          // Copy link
          const deepLinkObj = getDeepLink(item, projectId)
          if (deepLinkObj) {
            navigator.clipboard.writeText(window.location.origin + deepLinkObj.url)
          }
          setShowContextMenu(false)
        }}
        disabled={!deepLink}
      >
        Copy Link
      </MenuItem>
      <MenuItem 
        onClick={() => {
          // Share
          if (navigator.share) {
            const deepLinkObj = getDeepLink(item, projectId)
            if (deepLinkObj) {
              navigator.share({
                title: 'Activity',
                url: window.location.origin + deepLinkObj.url
              })
            }
          }
          setShowContextMenu(false)
        }}
        disabled={!deepLink || !navigator.share}
      >
        Share
      </MenuItem>
    </Menu>
  </>
  )
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  // Only re-render if key props change
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.timestamp.getTime() === nextProps.item.timestamp.getTime() &&
    prevProps.item.batchedCount === nextProps.item.batchedCount &&
    prevProps.projectId === nextProps.projectId &&
    prevProps.isMobile === nextProps.isMobile
  )
})


