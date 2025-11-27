import { supabase } from './supabase'

/**
 * Notification types for job-related events
 */
export type NotificationType =
  | 'job_auto_released'
  | 'job_payment_released'
  | 'job_completed'
  | 'payment_failed'
  | 'payment_retry'
  | 'job_assigned'
  | 'job_submitted'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'tip_received'
  | 'karma_milestone'

/**
 * Notification priority levels
 */
export type NotificationPriority = 'normal' | 'high' | 'urgent'

/**
 * Notification payload
 */
export interface NotificationPayload {
  type: NotificationType
  title: string
  message: string
  jobId?: string
  priority?: NotificationPriority
}

/**
 * Send a notification to a user
 * 
 * @param walletAddress - Recipient wallet address
 * @param notification - Notification details
 * @returns Success status
 * 
 * @example
 * ```typescript
 * await sendNotification('5yG3...', {
 *   type: 'job_auto_released',
 *   title: '💰 Payment Auto-Released!',
 *   message: 'Your payment of 10 SOL has been automatically released.',
 *   jobId: 'abc-123',
 *   priority: 'normal'
 * })
 * ```
 */
export async function sendNotification(
  walletAddress: string,
  notification: NotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[Notifications] Sending to ${walletAddress.slice(0, 8)}...`)
    console.log(`[Notifications] Type: ${notification.type}`)
    console.log(`[Notifications] Title: ${notification.title}`)

    const { error } = await supabase
      .from('notifications')
      .insert({
        wallet_address: walletAddress,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        job_id: notification.jobId,
        priority: notification.priority || 'normal',
        created_at: new Date().toISOString()
      })

    if (error) {
      // PostgREST error code for missing table is PGRST205, Postgres is 42P01
      if (error.code === 'PGRST205' || error.code === '42P01') {
        console.warn(`[Notifications] ⚠️ Table 'notifications' does not exist. Run migration 034.`)
      } else {
        console.error('[Notifications] Failed to send:', {
          code: error.code,
          message: error.message
        })
      }
      return { success: false, error: error.message }
    }

    console.log('[Notifications] ✅ Sent successfully')
    return { success: true }
  } catch (error) {
    console.error('[Notifications] Exception:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send notifications for an auto-released payment
 * Notifies both worker and poster
 * 
 * @param workerWallet - Worker's wallet address
 * @param posterWallet - Poster's wallet address
 * @param jobId - Job ID
 * @param jobTitle - Job title
 * @param amount - Payment amount
 * @param tokenSymbol - Token symbol (SOL, USDC, etc.)
 * 
 * @example
 * ```typescript
 * await notifyAutoRelease(
 *   '5yG3...',
 *   '8kL2...',
 *   'abc-123',
 *   'Logo Design',
 *   10,
 *   'SOL'
 * )
 * ```
 */
export async function notifyAutoRelease(
  workerWallet: string,
  posterWallet: string,
  jobId: string,
  jobTitle: string,
  amount: number,
  tokenSymbol: string
): Promise<void> {
  console.log(`[Auto-Release Notification] Job: ${jobTitle}`)
  console.log(`[Auto-Release Notification] Worker: ${workerWallet.slice(0, 8)}...`)
  console.log(`[Auto-Release Notification] Poster: ${posterWallet.slice(0, 8)}...`)

  // Notify worker
  await sendNotification(workerWallet, {
    type: 'job_auto_released',
    title: '💰 Payment Auto-Released!',
    message: `Your payment of ${amount.toFixed(2)} ${tokenSymbol} has been automatically released for "${jobTitle}".`,
    jobId,
    priority: 'normal'
  })

  // Notify poster
  await sendNotification(posterWallet, {
    type: 'job_auto_released',
    title: '✅ Payment Auto-Released',
    message: `Payment for "${jobTitle}" was automatically released after 10 days of no action.`,
    jobId,
    priority: 'normal'
  })
}

/**
 * Send notification for manual payment release
 * 
 * @param workerWallet - Worker's wallet address
 * @param posterWallet - Poster's wallet address
 * @param jobId - Job ID
 * @param jobTitle - Job title
 * @param amount - Payment amount
 * @param tokenSymbol - Token symbol
 * @param releasedBy - Who released the payment ('poster' | 'admin')
 */
export async function notifyManualRelease(
  workerWallet: string,
  posterWallet: string,
  jobId: string,
  jobTitle: string,
  amount: number,
  tokenSymbol: string,
  releasedBy: 'poster' | 'admin' = 'poster'
): Promise<void> {
  const releaseSource = releasedBy === 'admin' ? 'by admin' : 'by poster'

  // Notify worker
  await sendNotification(workerWallet, {
    type: 'job_payment_released',
    title: '💸 Payment Released!',
    message: `Your payment of ${amount.toFixed(2)} ${tokenSymbol} has been released ${releaseSource} for "${jobTitle}".`,
    jobId,
    priority: 'high'
  })

  // Notify poster (only if admin released it)
  if (releasedBy === 'admin') {
    await sendNotification(posterWallet, {
      type: 'job_payment_released',
      title: '✅ Payment Released by Admin',
      message: `Admin has released the payment for "${jobTitle}".`,
      jobId,
      priority: 'normal'
    })
  }
}

/**
 * Send notification for payment failure
 * 
 * @param posterWallet - Poster's wallet address (who needs to fix it)
 * @param jobId - Job ID
 * @param jobTitle - Job title
 * @param errorMessage - Error description
 * @param attemptNumber - Retry attempt number
 */
export async function notifyPaymentFailure(
  posterWallet: string,
  jobId: string,
  jobTitle: string,
  errorMessage: string,
  attemptNumber: number
): Promise<void> {
  const priority: NotificationPriority = attemptNumber >= 3 ? 'urgent' : 'high'

  await sendNotification(posterWallet, {
    type: 'payment_failed',
    title: '⚠️ Payment Release Failed',
    message: `Failed to release payment for "${jobTitle}" (Attempt ${attemptNumber}/3): ${errorMessage.slice(0, 100)}`,
    jobId,
    priority
  })
}

/**
 * Send notification for successful payment retry
 * 
 * @param workerWallet - Worker's wallet address
 * @param posterWallet - Poster's wallet address
 * @param jobId - Job ID
 * @param jobTitle - Job title
 * @param amount - Payment amount
 * @param tokenSymbol - Token symbol
 * @param attemptNumber - Which attempt succeeded
 */
export async function notifyPaymentRetrySuccess(
  workerWallet: string,
  posterWallet: string,
  jobId: string,
  jobTitle: string,
  amount: number,
  tokenSymbol: string,
  attemptNumber: number
): Promise<void> {
  // Notify worker
  await sendNotification(workerWallet, {
    type: 'payment_retry',
    title: '✅ Payment Released (Retry Succeeded)',
    message: `Your payment of ${amount.toFixed(2)} ${tokenSymbol} has been released for "${jobTitle}" (succeeded on attempt ${attemptNumber}).`,
    jobId,
    priority: 'normal'
  })

  // Notify poster
  await sendNotification(posterWallet, {
    type: 'payment_retry',
    title: '✅ Payment Released After Retry',
    message: `Payment for "${jobTitle}" was successfully released after ${attemptNumber} attempts.`,
    jobId,
    priority: 'normal'
  })
}

/**
 * Send notification when work is submitted
 * 
 * @param posterWallet - Poster's wallet address
 * @param workerWallet - Worker's wallet address
 * @param jobId - Job ID
 * @param jobTitle - Job title
 */
export async function notifyWorkSubmitted(
  posterWallet: string,
  workerWallet: string,
  jobId: string,
  jobTitle: string
): Promise<void> {
  await sendNotification(posterWallet, {
    type: 'job_submitted',
    title: '📋 Work Submitted',
    message: `${workerWallet.slice(0, 6)}...${workerWallet.slice(-4)} has submitted work for "${jobTitle}". Payment will auto-release in 10 days.`,
    jobId,
    priority: 'normal'
  })
}

/**
 * Send notification when a user is assigned to a job
 * 
 * @param workerWallet - Worker's wallet address
 * @param jobId - Job ID
 * @param jobTitle - Job title
 * @param posterWallet - Poster's wallet address
 */
export async function notifyJobAssigned(
  workerWallet: string,
  jobId: string,
  jobTitle: string,
  posterWallet: string
): Promise<void> {
  await sendNotification(workerWallet, {
    type: 'job_assigned',
    title: '🎯 You Were Assigned a Job!',
    message: `You've been assigned to work on "${jobTitle}" by ${posterWallet.slice(0, 6)}...${posterWallet.slice(-4)}.`,
    jobId,
    priority: 'high'
  })
}

/**
 * Get unread notification count for a user
 * 
 * @param walletAddress - User's wallet address
 * @returns Count of unread notifications
 */
export async function getUnreadCount(
  walletAddress: string
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('wallet_address', walletAddress)
      .eq('is_read', false)

    if (error) {
      // PostgREST error code for missing table is PGRST205, Postgres is 42P01
      if (error.code === 'PGRST205' || error.code === '42P01') {
        console.warn('[Notifications] ⚠️ Table "notifications" does not exist. Run migration 034.')
        return 0
      }
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('[Notifications] Exception getting unread count:', error)
    return 0
  }
}

/**
 * Mark notifications as read
 * 
 * @param walletAddress - User's wallet address
 * @param notificationIds - Array of notification IDs to mark as read
 * @returns Number of notifications marked as read
 */
export async function markAsRead(
  walletAddress: string,
  notificationIds: string[]
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('wallet_address', walletAddress)
      .in('id', notificationIds)
      .eq('is_read', false)
      .select('id')

    if (error) {
      console.error('[Notifications] Failed to mark as read:', error)
      return 0
    }

    return data?.length || 0
  } catch (error) {
    console.error('[Notifications] Exception marking as read:', error)
    return 0
  }
}

/**
 * Mark all notifications as read for a user
 * 
 * @param walletAddress - User's wallet address
 * @returns Number of notifications marked as read
 */
export async function markAllAsRead(
  walletAddress: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('wallet_address', walletAddress)
      .eq('is_read', false)
      .select('id')

    if (error) {
      console.error('[Notifications] Failed to mark all as read:', error)
      return 0
    }

    return data?.length || 0
  } catch (error) {
    console.error('[Notifications] Exception marking all as read:', error)
    return 0
  }
}

