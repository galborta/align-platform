import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { EnrichedNotification } from '@/lib/services/notificationService'

/**
 * Optional callbacks for custom navigation behaviors
 */
interface NavigationCallbacks {
  openMessagesPanel?: (conversationId: string) => void
  openAssetModal?: (assetId: string) => void
}

/**
 * Handles navigation when a notification is clicked
 * Routes user to the appropriate page/section based on notification type
 * 
 * @param notification - The enriched notification object
 * @param router - Next.js router instance
 * @param callbacks - Optional callbacks for custom behaviors (messages, assets)
 * 
 * @example
 * ```typescript
 * import { useRouter } from 'next/navigation'
 * import { handleNotificationNavigation } from '@/lib/notifications/navigationHandler'
 * 
 * const router = useRouter()
 * const { openMessages } = useMessaging()
 * 
 * handleNotificationNavigation(notification, router, {
 *   openMessagesPanel: (id) => openMessages(id)
 * })
 * ```
 */
export function handleNotificationNavigation(
  notification: EnrichedNotification,
  router: AppRouterInstance,
  callbacks?: NavigationCallbacks
) {
  const { type, reference_id, metadata } = notification

  // Helper to navigate with error handling
  const navigate = (path: string) => {
    try {
      console.log(`[Navigation] Navigating to: ${path}`)
      router.push(path)
    } catch (error) {
      console.error('[Navigation] Error:', error)
    }
  }

  // Validate reference_id for types that require it
  const requiresReferenceId = !['karma_milestone', 'karma_warning', 'karma_ban', 'admin_revenue_earned'].includes(type)
  
  if (requiresReferenceId && !reference_id && type !== 'message_received' && type !== 'tip_received') {
    console.warn(`[Navigation] Missing reference_id for notification type: ${type}`)
    return
  }

  switch (type) {
    // ==================== JOB NOTIFICATIONS ====================
    
    case 'job_application_received':
      if (reference_id && metadata?.project_id) {
        navigate(`/project/${metadata.project_id}/jobs/${reference_id}?tab=applications`)
      } else if (reference_id) {
        navigate(`/jobs/${reference_id}?tab=applications`)
      }
      break

    case 'job_assigned':
    case 'job_completed':
    case 'payment_released':
    case 'payment_refunded':
      if (reference_id && metadata?.project_id) {
        navigate(`/project/${metadata.project_id}/jobs/${reference_id}`)
      } else if (reference_id) {
        navigate(`/jobs/${reference_id}`)
      }
      break

    case 'job_submitted':
      if (reference_id && metadata?.project_id) {
        navigate(`/project/${metadata.project_id}/jobs/${reference_id}`)
      } else if (reference_id) {
        navigate(`/jobs/${reference_id}?tab=submissions`)
      }
      break

    case 'job_dispute_created':
    case 'job_dispute_vote':
      if (reference_id && metadata?.project_id) {
        navigate(`/project/${metadata.project_id}/jobs/${reference_id}?tab=disputes`)
      } else if (reference_id) {
        navigate(`/jobs/${reference_id}?tab=disputes`)
      }
      break

    case 'revision_requested':
    case 'voluntary_revision_requested':
      // Navigate to job detail page - scroll to comments/work section
      if (reference_id && metadata?.project_id) {
        navigate(`/project/${metadata.project_id}/jobs/${reference_id}#submitted-work`)
      } else if (reference_id) {
        navigate(`/jobs/${reference_id}#submitted-work`)
      }
      break

    case 'voluntary_revision_accepted':
    case 'voluntary_revision_declined':
      // Navigate to job detail page (for poster to see the response)
      if (reference_id && metadata?.project_id) {
        navigate(`/project/${metadata.project_id}/jobs/${reference_id}`)
      } else if (reference_id) {
        navigate(`/jobs/${reference_id}`)
      }
      break

    case 'high_revision_count_warning_poster':
    case 'high_revision_count_warning_worker':
      // Navigate to job detail page - both parties can review the situation
      if (reference_id && metadata?.project_id) {
        navigate(`/project/${metadata.project_id}/jobs/${reference_id}`)
      } else if (reference_id) {
        navigate(`/jobs/${reference_id}`)
      }
      break

    case 'job_comment':
      if (reference_id) {
        const baseUrl = metadata?.project_id 
          ? `/project/${metadata.project_id}/jobs/${reference_id}`
          : `/jobs/${reference_id}`
        const url = `${baseUrl}?tab=comments`
        // TODO: Scroll to specific comment if comment_id is available in metadata
        if (metadata?.comment_id) {
          navigate(`${url}#comment-${metadata.comment_id}`)
        } else {
          navigate(url)
        }
      }
      break

    // ==================== ASSET NOTIFICATIONS ====================
    
    case 'asset_upvote':
    case 'asset_verified':
    case 'asset_hidden':
      if (reference_id) {
        // Try to use modal callback if available, otherwise navigate to assets page
        if (callbacks?.openAssetModal) {
          console.log(`[Navigation] Opening asset modal: ${reference_id}`)
          callbacks.openAssetModal(reference_id)
        } else {
          navigate(`/assets?asset=${reference_id}`)
        }
      }
      break

    // ==================== MESSAGE & TIP NOTIFICATIONS ====================
    
    case 'message_received':
    case 'tip_received':
      // These use conversation_id from metadata or actor_wallet
      if (callbacks?.openMessagesPanel && metadata?.conversation_id) {
        console.log(`[Navigation] Opening messages panel: ${metadata.conversation_id}`)
        callbacks.openMessagesPanel(metadata.conversation_id)
      } else {
        // No route for messages - handled by NotificationItem using messaging context
        console.log('[Navigation] Message notification handled by NotificationItem')
      }
      break

    // ==================== KARMA NOTIFICATIONS ====================
    
    case 'karma_milestone':
    case 'karma_warning':
    case 'karma_ban':
      // Navigate to user's own profile
      navigate('/profile')
      break

    // ==================== ADMIN NOTIFICATIONS ====================
    
    case 'admin_dispute_new':
      // Navigate to job page - job_id is in metadata
      if (metadata?.job_id) {
        // reference_id is the dispute_id, job_id is in metadata
        navigate(`/jobs/${metadata.job_id}`)
      } else if (reference_id) {
        // Fallback: try reference_id as job_id
        navigate(`/jobs/${reference_id}`)
      }
      break

    case 'admin_job_new':
      // Navigate directly to the job
      if (reference_id) navigate(`/jobs/${reference_id}`)
      break

    case 'admin_asset_new':
      // Navigate to admin assets page with pending filter
      if (reference_id) {
        navigate(`/admin/assets?pending=${reference_id}`)
      } else {
        navigate('/admin/assets')
      }
      break

    case 'admin_revenue_earned':
      // Navigate to admin revenue dashboard
      navigate('/admin/revenue')
      break

    // ==================== DEFAULT ====================
    
    default:
      console.warn(`[Navigation] Unknown notification type: ${type}`)
      // Don't navigate for unknown types
  }
}

/**
 * Get the navigation path for a notification without actually navigating
 * Useful for previewing where a notification will take you
 * 
 * @param notification - The enriched notification object
 * @returns The path that would be navigated to, or null if no navigation
 */
export function getNotificationPath(notification: EnrichedNotification): string | null {
  const { type, reference_id, metadata } = notification

  switch (type) {
    case 'job_application_received':
      if (!reference_id) return null
      return metadata?.project_id 
        ? `/project/${metadata.project_id}/jobs/${reference_id}?tab=applications`
        : `/jobs/${reference_id}?tab=applications`

    case 'job_assigned':
    case 'job_completed':
    case 'payment_released':
    case 'payment_refunded':
      if (!reference_id) return null
      return metadata?.project_id 
        ? `/project/${metadata.project_id}/jobs/${reference_id}`
        : `/jobs/${reference_id}`

    case 'job_submitted':
      if (!reference_id) return null
      return metadata?.project_id 
        ? `/project/${metadata.project_id}/jobs/${reference_id}`
        : `/jobs/${reference_id}?tab=submissions`

    case 'job_dispute_created':
    case 'job_dispute_vote':
      if (!reference_id) return null
      return metadata?.project_id 
        ? `/project/${metadata.project_id}/jobs/${reference_id}?tab=disputes`
        : `/jobs/${reference_id}?tab=disputes`

    case 'job_comment':
      if (!reference_id) return null
      const baseUrl = metadata?.project_id 
        ? `/project/${metadata.project_id}/jobs/${reference_id}`
        : `/jobs/${reference_id}`
      const url = `${baseUrl}?tab=comments`
      return metadata?.comment_id ? `${url}#comment-${metadata.comment_id}` : url

    case 'asset_upvote':
    case 'asset_verified':
    case 'asset_hidden':
      return reference_id ? `/assets?asset=${reference_id}` : null

    case 'message_received':
    case 'tip_received':
      // These open the messaging sidebar via NotificationItem, no URL navigation
      return null

    case 'karma_milestone':
    case 'karma_warning':
    case 'karma_ban':
      return '/profile'

    case 'admin_dispute_new':
      // job_id is in metadata, reference_id is dispute_id
      return metadata?.job_id ? `/jobs/${metadata.job_id}` : (reference_id ? `/jobs/${reference_id}` : null)

    case 'admin_job_new':
      return reference_id ? `/jobs/${reference_id}` : null

    case 'admin_asset_new':
      return reference_id ? `/admin/assets?pending=${reference_id}` : '/admin/assets'

    case 'admin_revenue_earned':
      return '/admin/revenue'

    default:
      return null
  }
}

/**
 * Check if a notification has a valid navigation destination
 * 
 * @param notification - The enriched notification object
 * @returns True if the notification can be navigated to
 */
export function canNavigate(notification: EnrichedNotification): boolean {
  return getNotificationPath(notification) !== null
}


