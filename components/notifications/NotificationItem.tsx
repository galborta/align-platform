'use client'

import { Avatar, Button } from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import {
  Briefcase, CheckCircle, Upload, DollarSign, AlertTriangle,
  MessageSquare, ThumbsUp, BadgeCheck, EyeOff, Mail, Award,
  AlertCircle, ShieldX, ArrowDown, ArrowUp, Shield, LucideIcon
} from 'lucide-react'
import { notificationService } from '@/lib/services/notificationService'
import { handleNotificationNavigation } from '@/lib/notifications/navigationHandler'
import type { EnrichedNotification } from '@/lib/services/notificationService'
import type { NotificationType } from '@/types/database'

interface NotificationItemProps {
  notification: EnrichedNotification
  onClick: (notification: EnrichedNotification) => void
  showActions?: boolean
}

// Icon mapping
const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  job_application_received: Briefcase,
  job_assigned: CheckCircle,
  job_submitted: Upload,
  job_completed: DollarSign,
  job_dispute_created: AlertTriangle,
  job_dispute_vote: ThumbsUp,
  job_comment: MessageSquare,
  asset_upvote: ThumbsUp,
  asset_verified: BadgeCheck,
  asset_hidden: EyeOff,
  tip_received: DollarSign,
  message_received: Mail,
  karma_milestone: Award,
  karma_warning: AlertCircle,
  karma_ban: ShieldX,
  payment_released: ArrowDown,
  payment_refunded: ArrowUp,
  admin_dispute_new: Shield,
  admin_job_new: Shield,
  admin_asset_new: Shield,
  admin_revenue_earned: Shield,
}

// Icon color mapping
const NOTIFICATION_COLORS: Record<string, string> = {
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  admin: '#7C4DFF',
  default: '#6B7280',
}

function getNotificationIconColor(type: NotificationType): string {
  if (type.startsWith('admin_')) return NOTIFICATION_COLORS.admin
  
  const successTypes: NotificationType[] = [
    'job_completed', 'asset_verified', 'payment_released', 'karma_milestone'
  ]
  const warningTypes: NotificationType[] = ['karma_warning']
  const errorTypes: NotificationType[] = [
    'karma_ban', 'asset_hidden', 'job_dispute_created'
  ]
  const infoTypes: NotificationType[] = [
    'job_assigned', 'tip_received', 'message_received'
  ]

  if (successTypes.includes(type)) return NOTIFICATION_COLORS.success
  if (warningTypes.includes(type)) return NOTIFICATION_COLORS.warning
  if (errorTypes.includes(type)) return NOTIFICATION_COLORS.error
  if (infoTypes.includes(type)) return NOTIFICATION_COLORS.info
  
  return NOTIFICATION_COLORS.default
}

/**
 * NotificationItem Component
 * 
 * Displays a single notification in a horizontal layout with all details.
 * 
 * Features:
 * - Icon based on notification type with color coding
 * - Actor avatar
 * - Notification text and metadata
 * - Time ago and unread indicator
 * - Optional quick action buttons
 * 
 * @param notification - Enriched notification object with actor data
 * @param onClick - Handler for clicking the notification
 * @param showActions - Whether to show quick action buttons (default: false)
 */
export function NotificationItem({ 
  notification, 
  onClick, 
  showActions = false 
}: NotificationItemProps) {
  const router = useRouter()
  const text = notificationService.generateNotificationText(notification)
  const IconComponent = NOTIFICATION_ICONS[notification.type]
  const iconColor = getNotificationIconColor(notification.type)
  
  // Check if this is an admin notification
  const isAdminNotification = notification.type.startsWith('admin_')

  const handleClick = () => {
    // Navigate to the appropriate page
    handleNotificationNavigation(notification, router)
    
    // Call parent onClick (for marking as read, closing panel, etc.)
    onClick(notification)
  }

  const handleActionClick = (e: React.MouseEvent, action: string) => {
    e.stopPropagation()
    // Action handlers will be implemented in Task 5.3
    console.log(`Action: ${action}`, notification)
  }

  return (
    <div
      onClick={handleClick}
      className={`
        relative flex flex-col sm:flex-row items-start gap-3 
        p-3 sm:p-4 
        rounded-lg cursor-pointer
        transition-all duration-200
        ${!notification.is_read 
          ? 'bg-purple-50 hover:bg-purple-100' 
          : 'bg-white hover:bg-gray-50'
        }
        border border-transparent hover:border-gray-200
        ${isAdminNotification ? 'border-l-4 border-l-purple-500' : ''}
        min-h-[60px] sm:min-h-0
      `}
    >
      {/* Admin Badge (top-right corner) */}
      {isAdminNotification && (
        <div className="absolute top-2 right-2">
          <Shield size={16} className="text-purple-500" />
        </div>
      )}

      {/* Icon + Avatar Row (always horizontal on mobile and desktop) */}
      <div className="flex gap-3 items-center w-full sm:w-auto">
        {/* Notification Icon */}
        <div 
          className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${iconColor}20` }}
        >
          <IconComponent size={16} className="sm:w-5 sm:h-5" color={iconColor} />
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

        {/* Time + Unread (mobile only - top right) */}
        <div className="flex sm:hidden ml-auto gap-2 items-center">
          <span className="text-xs text-gray-500">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
              .replace(' ago', '')
              .replace('about ', '')}
          </span>
          {!notification.is_read && (
            <div className="w-2 h-2 bg-purple-500 rounded-full" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 w-full sm:w-auto min-w-0">
        <p className="text-sm font-medium text-gray-900 line-clamp-2">
          {text.title}
        </p>
        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
          {text.body}
        </p>

        {/* Quick Actions - hidden on mobile in panel view */}
        {showActions && (
          <div className="hidden sm:flex gap-2 mt-3">
            <Button
              size="small"
              variant="outlined"
              onClick={(e) => handleActionClick(e, 'view')}
              sx={{
                textTransform: 'none',
                borderColor: '#7C4DFF',
                color: '#7C4DFF',
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                padding: { xs: '4px 12px', sm: '6px 16px' },
                '&:hover': {
                  borderColor: '#6A3FDD',
                  backgroundColor: 'rgba(124, 77, 255, 0.05)'
                }
              }}
            >
              View
            </Button>

            {/* Type-specific actions */}
            {notification.type === 'message_received' && (
              <Button
                size="small"
                variant="text"
                onClick={(e) => handleActionClick(e, 'reply')}
                sx={{ 
                  textTransform: 'none', 
                  color: '#7C4DFF',
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                }}
              >
                Reply
              </Button>
            )}
            {notification.type === 'tip_received' && (
              <Button
                size="small"
                variant="text"
                onClick={(e) => handleActionClick(e, 'thank')}
                sx={{ 
                  textTransform: 'none', 
                  color: '#7C4DFF',
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                }}
              >
                Thank
              </Button>
            )}
            {notification.type === 'job_application_received' && (
              <Button
                size="small"
                variant="text"
                onClick={(e) => handleActionClick(e, 'review')}
                sx={{ 
                  textTransform: 'none', 
                  color: '#7C4DFF',
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                }}
              >
                Review
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Time + Unread Indicator (desktop only) */}
      <div className="hidden sm:flex flex-col items-end gap-2 flex-shrink-0">
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </span>
        {!notification.is_read && (
          <div className="w-2.5 h-2.5 bg-purple-500 rounded-full" />
        )}
      </div>
    </div>
  )
}

