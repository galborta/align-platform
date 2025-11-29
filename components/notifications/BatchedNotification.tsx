'use client'

import { useState } from 'react'
import { Avatar, IconButton, Collapse, Chip } from '@mui/material'
import { ChevronDown, ChevronUp, Shield } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import { notificationService } from '@/lib/services/notificationService'
import { handleNotificationNavigation } from '@/lib/notifications/navigationHandler'
import type { EnrichedNotification } from '@/lib/services/notificationService'
import { 
  ThumbsUp, MessageSquare, AlertTriangle, LucideIcon 
} from 'lucide-react'

interface BatchedNotificationProps {
  notification: EnrichedNotification
  onClick: (notification: EnrichedNotification) => void
}

// Icons for batchable types
const BATCH_ICONS: Record<string, LucideIcon> = {
  asset_upvote: ThumbsUp,
  job_comment: MessageSquare,
  job_dispute_vote: AlertTriangle,
  job_application_received: MessageSquare,
  tip_received: ThumbsUp,
}

/**
 * BatchedNotification Component
 * 
 * Displays batched notifications (e.g., "5 people upvoted your asset") 
 * with an expandable dropdown to show batch details.
 * 
 * Features:
 * - Shows summary text with batch count
 * - Expandable to show batch metadata
 * - Visual distinction with purple border and lime badge
 * - Smooth collapse animation
 * - Click to navigate to referenced entity
 * 
 * @param notification - Enriched notification with batch_count > 1
 * @param onClick - Handler for clicking the notification
 */
export function BatchedNotification({ 
  notification, 
  onClick 
}: BatchedNotificationProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const text = notificationService.generateNotificationText(notification)
  const IconComponent = BATCH_ICONS[notification.type] || ThumbsUp
  
  // Check if this is an admin notification
  const isAdminNotification = notification.type.startsWith('admin_')

  const handleClick = () => {
    // Navigate to the appropriate page
    handleNotificationNavigation(notification, router)
    
    // Call parent onClick (for marking as read, closing panel, etc.)
    onClick(notification)
  }

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(!expanded)
  }

  return (
    <div
      className={`
        relative rounded-lg cursor-pointer transition-all duration-200
        ${!notification.is_read 
          ? 'bg-purple-50 hover:bg-purple-100' 
          : 'bg-white hover:bg-gray-50'
        }
        border-2 border-purple-200
        ${isAdminNotification ? 'border-l-4 border-l-purple-500' : ''}
      `}
    >
      {/* Admin Badge (top-right corner) */}
      {isAdminNotification && (
        <div className="absolute top-2 right-2 z-10">
          <Shield size={16} className="text-purple-500" />
        </div>
      )}

      {/* Main Content */}
      <div
        onClick={handleClick}
        className="flex flex-col sm:flex-row items-start gap-3 p-3 sm:p-4"
      >
        {/* Icon + Avatar Row (always horizontal) */}
        <div className="flex gap-3 items-center w-full sm:w-auto">
          {/* Batch Icon with Count Badge */}
          <div className="relative flex-shrink-0">
            <div
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-purple-100"
            >
              <IconComponent size={16} className="sm:w-5 sm:h-5" color="#7C4DFF" />
            </div>
            <Chip
              label={notification.batch_count}
              size="small"
              sx={{
                position: 'absolute',
                top: -8,
                right: -8,
                height: { xs: 18, sm: 20 },
                minWidth: { xs: 18, sm: 20 },
                backgroundColor: '#E3F06F',
                color: '#000',
                fontWeight: 600,
                fontSize: { xs: '0.65rem', sm: '0.75rem' },
                '& .MuiChip-label': {
                  padding: { xs: '0 4px', sm: '0 6px' }
                }
              }}
            />
          </div>

          {/* Actor Avatar */}
          <Avatar 
            src={notification.actor_avatar_url || undefined} 
            sx={{ 
              width: { xs: 36, sm: 40 }, 
              height: { xs: 36, sm: 40 }, 
              bgcolor: '#7C4DFF' 
            }}
          >
            {notification.actor_username?.[0]?.toUpperCase() || 
             notification.user_wallet?.slice(0, 2).toUpperCase() || '?'}
          </Avatar>

          {/* Time + Expand Button (mobile only - top right) */}
          <div className="flex sm:hidden ml-auto gap-2 items-center">
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
                .replace(' ago', '')
                .replace('about ', '')}
            </span>
            <IconButton
              size="small"
              onClick={toggleExpand}
              sx={{ 
                color: '#7C4DFF',
                minWidth: 36,
                minHeight: 36 
              }}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </IconButton>
            {!notification.is_read && (
              <div className="w-2 h-2 bg-purple-500 rounded-full" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 w-full sm:w-auto min-w-0">
          <p className="text-sm font-semibold text-gray-900 line-clamp-2">
            {text.title}
          </p>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {text.body}
          </p>
        </div>

        {/* Time + Expand Button (desktop only) */}
        <div className="hidden sm:flex flex-col items-end gap-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </span>
          <IconButton
            size="small"
            onClick={toggleExpand}
            sx={{ 
              color: '#7C4DFF',
              minWidth: 44,
              minHeight: 44
            }}
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </IconButton>
          {!notification.is_read && (
            <div className="w-2.5 h-2.5 bg-purple-500 rounded-full" />
          )}
        </div>
      </div>

      {/* Expanded Details */}
      <Collapse in={expanded}>
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-purple-200 pt-3">
          <div className="bg-white rounded-lg p-2 sm:p-3 space-y-2">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-gray-600">Type:</span>
              <span className="font-medium">
                {notification.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-gray-600">Count:</span>
              <span className="font-medium">{notification.batch_count} items</span>
            </div>
            {notification.metadata?.asset_name && (
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-gray-600">Asset:</span>
                <span className="font-medium truncate ml-2">{notification.metadata.asset_name}</span>
              </div>
            )}
            {notification.metadata?.job_title && (
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-gray-600">Job:</span>
                <span className="font-medium truncate ml-2">{notification.metadata.job_title}</span>
              </div>
            )}
            {notification.reference_id && (
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-gray-600">Reference:</span>
                <span className="font-mono text-xs truncate ml-2">{notification.reference_id.slice(0, 8)}...</span>
              </div>
            )}
            <div className="text-xs text-gray-500 mt-3">
              Last activity: {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>
      </Collapse>
    </div>
  )
}

