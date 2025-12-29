'use client'

import { useState } from 'react'
import { Avatar, Button, CircularProgress } from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import {
  Briefcase, CheckCircle, Upload, DollarSign, AlertTriangle,
  MessageSquare, ThumbsUp, BadgeCheck, EyeOff, Mail, Award,
  AlertCircle, ShieldX, ArrowDown, ArrowUp, Shield, LucideIcon,
  RefreshCw, Share2, XCircle, Inbox
} from 'lucide-react'
import { notificationService } from '@/lib/services/notificationService'
import { handleNotificationNavigation } from '@/lib/notifications/navigationHandler'
import { acceptVoluntaryRevision, declineVoluntaryRevision } from '@/lib/revisions'
import { toast } from 'react-hot-toast'
import { useMessaging } from '@/lib/MessagingContext'
import type { EnrichedNotification } from '@/lib/services/notificationService'
import type { NotificationType } from '@/types/database'

interface NotificationItemProps {
  notification: EnrichedNotification
  onClick: (notification: EnrichedNotification) => void
  showActions?: boolean
  onActionComplete?: () => void
}

// Icon mapping
const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  job_application_received: Briefcase,
  contest_no_submissions: Inbox,
  contest_deadline_reminder: AlertCircle,
  job_status_changed: RefreshCw,
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
  // Social media job notifications
  social_submission_received: Share2,
  social_submission_approved: CheckCircle,
  social_submission_denied: XCircle,
  social_payment_distributed: DollarSign,
  // Revision notifications
  revision_requested: RefreshCw,
  voluntary_revision_requested: Inbox, // Different icon for voluntary
  voluntary_revision_accepted: CheckCircle,
  voluntary_revision_declined: XCircle,
  // Revision warning notifications
  high_revision_count_warning_poster: AlertTriangle,
  high_revision_count_warning_worker: AlertTriangle,
  // Contest notifications
  contest_judging_started: Award,
  contest_winners_selected: Award,
  contest_prize_won: Award,
  // Social asset review notifications
  social_asset_pending: BadgeCheck,
  social_asset_approved: CheckCircle,
  social_asset_rejected: XCircle,
  // Dispute notifications
  admin_dispute_new: AlertTriangle,
  job_dispute_resolved: CheckCircle,
}

// Icon color mapping
const NOTIFICATION_COLORS: Record<string, string> = {
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  admin: '#7C4DFF',
  dispute: '#FF6B35', // Red/orange for disputes
  default: '#6B7280',
}

function getNotificationIconColor(type: NotificationType | string): string {
  if (type.startsWith('admin_')) return NOTIFICATION_COLORS.admin
  
  // Dispute notifications get distinct red/orange color
  if (type === 'admin_dispute_new') return NOTIFICATION_COLORS.dispute
  
  const successTypes: NotificationType[] = [
    'job_completed', 'asset_verified', 'payment_released', 'karma_milestone', 'social_asset_approved'
  ]
  const warningTypes: NotificationType[] = ['karma_warning', 'social_asset_pending']
  const errorTypes: NotificationType[] = [
    'karma_ban', 'asset_hidden', 'job_dispute_created', 'social_asset_rejected'
  ]
  const infoTypes: NotificationType[] = [
    'job_assigned', 'tip_received', 'message_received'
  ]

  if (successTypes.includes(type as NotificationType)) return NOTIFICATION_COLORS.success
  if (warningTypes.includes(type as NotificationType)) return NOTIFICATION_COLORS.warning
  if (errorTypes.includes(type as NotificationType)) return NOTIFICATION_COLORS.error
  if (infoTypes.includes(type as NotificationType)) return NOTIFICATION_COLORS.info
  
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
  showActions = false,
  onActionComplete 
}: NotificationItemProps) {
  const router = useRouter()
  const [actionLoading, setActionLoading] = useState<'accept' | 'decline' | null>(null)
  
  // Get messaging context for opening message sidebar
  let messaging: ReturnType<typeof useMessaging> | null = null
  try {
    messaging = useMessaging()
    console.log('[NotificationItem] useMessaging hook succeeded')
  } catch (err) {
    console.log('[NotificationItem] useMessaging hook failed:', err)
    // MessagingContext not available (e.g., in a component outside the provider)
  }
  
  const text = notificationService.generateNotificationText(notification)
  const IconComponent = NOTIFICATION_ICONS[notification.type]
  const iconColor = getNotificationIconColor(notification.type)
  
  // Check if this is an admin notification
  const isAdminNotification = notification.type.startsWith('admin_')
  
  // Check if this is a dispute admin notification (distinct styling)
  const isDisputeAdminNotification = notification.type === 'admin_dispute_new'
  
  // Check if this is a voluntary revision that needs action
  const isVoluntaryRevisionRequest = notification.type === 'voluntary_revision_requested'

  // Helper function to extract asset ID from notification
  const getAssetIdFromNotification = (notification: EnrichedNotification): string | null => {
    if (notification.reference_type === 'asset' && notification.reference_id) {
      return notification.reference_id
    }
    if (notification.metadata?.asset_id) {
      return notification.metadata.asset_id as string
    }
    return null
  }

  const handleClick = () => {
    console.log('[NotificationItem] Click handler called for type:', notification.type)
    console.log('[NotificationItem] messaging context available:', !!messaging)
    console.log('[NotificationItem] actor_wallet:', notification.actor_wallet)
    console.log('[NotificationItem] metadata:', notification.metadata)
    
    // Special handling for message/tip notifications - open sidebar instead of navigating
    if ((notification.type === 'message_received' || notification.type === 'tip_received')) {
      const senderWallet = notification.actor_wallet || (notification.metadata as any)?.sender_wallet
      console.log('[NotificationItem] senderWallet resolved:', senderWallet)
      
      if (senderWallet && messaging) {
        console.log('[NotificationItem] Opening messages for wallet:', senderWallet)
        messaging.openMessages(senderWallet)
        onClick(notification)
        return
      } else {
        console.log('[NotificationItem] Cannot open messages - senderWallet:', senderWallet, 'messaging:', !!messaging)
      }
    }
    
    // Special handling for social asset notifications - open sidebar with asset reviews section
    if (notification.type === 'social_asset_pending' || 
        notification.type === 'social_asset_approved' || 
        notification.type === 'social_asset_rejected') {
      
      const projectId = (notification.metadata as any)?.project_id
      const assetId = getAssetIdFromNotification(notification)
      
      if (messaging) {
        console.log('[NotificationItem] Opening sidebar for social asset review:', {
          projectId,
          assetId,
          type: notification.type
        })
        
        // Open the messaging sidebar with the social-assets section
        messaging.openMessages({
          section: 'social-assets',
          projectId: projectId || undefined,
          highlightAssetId: assetId || undefined
        })
        onClick(notification)
        return
      } else if (projectId) {
        // Fallback: Navigate via URL if messaging context not available
        let url = `/messages?project=${projectId}&section=social-assets`
        if (assetId && (notification.type === 'social_asset_approved' || notification.type === 'social_asset_rejected')) {
          url += `&highlight=${assetId}`
        }
        console.log('[NotificationItem] Fallback: Navigating to yellow feed:', url)
        router.push(url)
        onClick(notification)
        return
      }
    }
    
    // Special handling for dispute admin notifications - open sidebar with disputes section
    if (notification.type === 'admin_dispute_new') {
      const disputeId = notification.reference_id
      const jobId = (notification.metadata as any)?.job_id
      
      console.log('[NotificationItem] Opening sidebar for dispute review:', {
        disputeId,
        jobId,
        type: notification.type
      })
      
      if (messaging) {
        // Open the messaging sidebar with the disputes section
        messaging.openMessages({
          section: 'disputes',
          disputeId: disputeId || undefined
        })
        onClick(notification)
        return
      } else {
        // Fallback: Navigate to job disputes page if messaging context not available
        const fallbackUrl = jobId 
          ? `/jobs/${jobId}?tab=disputes`
          : `/messages?section=disputes&dispute=${disputeId}`
        console.log('[NotificationItem] Fallback: Navigating to disputes:', fallbackUrl)
        router.push(fallbackUrl)
        onClick(notification)
        return
      }
    }
    
    // Navigate to the appropriate page for other notification types
    handleNotificationNavigation(notification, router)
    
    // Call parent onClick (for marking as read, closing panel, etc.)
    onClick(notification)
  }

  const handleActionClick = (e: React.MouseEvent, action: string) => {
    e.stopPropagation()
    // Action handlers will be implemented in Task 5.3
    console.log(`Action: ${action}`, notification)
  }

  // Handle voluntary revision accept
  const handleAcceptVoluntary = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!notification.reference_id) return
    
    setActionLoading('accept')
    try {
      const result = await acceptVoluntaryRevision(
        notification.reference_id,
        notification.user_wallet
      )
      
      if (result.success) {
        toast.success('Voluntary revision accepted! You can now submit your revised work.', {
          duration: 4000,
          style: { background: '#7C4DFF', color: '#fff' }
        })
        onActionComplete?.()
      } else {
        toast.error(result.error || 'Failed to accept revision')
      }
    } catch (error) {
      console.error('Error accepting voluntary revision:', error)
      toast.error('Failed to accept voluntary revision')
    } finally {
      setActionLoading(null)
    }
  }

  // Handle voluntary revision decline
  const handleDeclineVoluntary = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!notification.reference_id) return
    
    setActionLoading('decline')
    try {
      const result = await declineVoluntaryRevision(
        notification.reference_id,
        notification.user_wallet
      )
      
      if (result.success) {
        toast.success('Voluntary revision declined. No penalty applied.', {
          duration: 4000,
        })
        onActionComplete?.()
      } else {
        toast.error(result.error || 'Failed to decline revision')
      }
    } catch (error) {
      console.error('Error declining voluntary revision:', error)
      toast.error('Failed to decline voluntary revision')
    } finally {
      setActionLoading(null)
    }
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
        ${isDisputeAdminNotification ? 'border-l-4 border-l-orange-500' : isAdminNotification ? 'border-l-4 border-l-purple-500' : ''}
        min-h-[60px] sm:min-h-0
      `}
    >
      {/* Admin Badge (top-right corner) */}
      {isAdminNotification && (
        <div className="absolute top-2 right-2">
          <Shield size={16} className="text-purple-500" />
        </div>
      )}
      
      {/* Dispute Badge (top-right corner) - orange for disputes */}
      {isDisputeAdminNotification && (
        <div className="absolute top-2 right-2">
          <AlertTriangle size={16} className="text-orange-500" />
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

        {/* Voluntary Revision Action Buttons - Always show for this type */}
        {isVoluntaryRevisionRequest && (
          <div className="flex gap-2 mt-3">
            <Button
              size="small"
              variant="contained"
              onClick={handleAcceptVoluntary}
              disabled={actionLoading !== null}
              startIcon={actionLoading === 'accept' ? <CircularProgress size={14} color="inherit" /> : undefined}
              sx={{
                textTransform: 'none',
                backgroundColor: '#36C170',
                color: '#fff',
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                padding: { xs: '4px 12px', sm: '6px 16px' },
                '&:hover': {
                  backgroundColor: '#2AA55B',
                },
                '&:disabled': {
                  backgroundColor: '#A3A7B5',
                  color: '#fff'
                }
              }}
            >
              Accept
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={handleDeclineVoluntary}
              disabled={actionLoading !== null}
              startIcon={actionLoading === 'decline' ? <CircularProgress size={14} /> : undefined}
              sx={{ 
                textTransform: 'none',
                borderColor: '#EF4444',
                color: '#EF4444',
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                padding: { xs: '4px 12px', sm: '6px 16px' },
                '&:hover': {
                  borderColor: '#DC2626',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)'
                },
                '&:disabled': {
                  borderColor: '#A3A7B5',
                  color: '#A3A7B5'
                }
              }}
            >
              Decline
            </Button>
            <span className="text-xs text-gray-500 self-center ml-1">
              (No penalty for declining)
            </span>
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

