// /lib/services/notificationService.ts

import { supabase } from '@/lib/supabase';
import type {
  Notification,
  NotificationType,
  NotificationReferenceType,
  NotificationMetadata,
  NotificationInsert
} from '@/types/database';

/**
 * Parameters for creating a notification
 */
interface CreateNotificationParams {
  userWallet: string;
  type: NotificationType;
  actorWallet?: string;
  referenceId?: string;
  referenceType?: NotificationReferenceType;
  metadata?: NotificationMetadata;
}

/**
 * Notification enriched with actor profile data
 */
interface EnrichedNotification extends Notification {
  actor_username?: string;
  actor_avatar_url?: string;
}

/**
 * Human-readable notification text
 */
interface NotificationText {
  title: string;
  body: string;
}

/**
 * Parameters for creating admin notifications
 */
interface AdminNotificationParams {
  type: NotificationType;
  actorWallet?: string;
  referenceId?: string;
  referenceType?: NotificationReferenceType;
  metadata?: NotificationMetadata;
}

/**
 * NotificationService
 * 
 * Handles all notification creation, batching, and management logic.
 * Uses intelligent batching to group similar notifications within a 5-minute window
 * to reduce notification spam while maintaining important alerts.
 * 
 * @example
 * ```typescript
 * import { notificationService } from '@/lib/services/notificationService'
 * 
 * await notificationService.createNotification({
 *   userWallet: '5yG3...',
 *   type: 'job_assigned',
 *   actorWallet: '8kL2...',
 *   referenceId: jobId,
 *   referenceType: 'job',
 *   metadata: { job_title: 'Logo Design' }
 * })
 * ```
 */
class NotificationService {
  // Types that should NOT be batched (each gets its own notification)
  private readonly NON_BATCHABLE_TYPES: NotificationType[] = [
    'message_received',
    'job_assigned',
    'payment_released',
    'payment_refunded',
    'karma_warning',
    'karma_ban',
    'admin_dispute_new',
    'admin_job_new',
    'admin_asset_new',
    'admin_revenue_earned'
  ];

  // Types that trigger browser notifications (high priority)
  private readonly BROWSER_NOTIFICATION_TYPES: NotificationType[] = [
    'job_assigned',
    'job_completed',
    'tip_received',
    'message_received',
    'payment_released',
    'karma_warning',
    'karma_ban',
    'admin_dispute_new',
    'admin_job_new',
    'admin_asset_new',
    'admin_revenue_earned'
  ];

  // Batching window in milliseconds (5 minutes)
  private readonly BATCH_WINDOW_MS = 5 * 60 * 1000;

  /**
   * Generates a unique key for batching similar notifications
   * Format: type:userWallet:actorWallet:referenceType
   * 
   * @private
   */
  private generateBatchGroupKey(params: CreateNotificationParams): string {
    const { type, userWallet, actorWallet, referenceType } = params;
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `${type}:${userWallet}:${actorWallet || 'system'}:${referenceType || 'none'}:${date}`;
  }

  /**
   * Finds an existing batch within the 5-minute window
   * Returns the most recent matching notification that can be batched
   * 
   * @private
   */
  private async findExistingBatch(
    batchGroupKey: string,
    userWallet: string
  ): Promise<Notification | null> {
    const batchWindowStart = new Date(Date.now() - this.BATCH_WINDOW_MS).toISOString();

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('batch_group_key', batchGroupKey)
        .eq('user_wallet', userWallet)
        .eq('is_read', false) // Only batch unread notifications
        .gte('created_at', batchWindowStart)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[NotificationService] Error finding batch (not critical):', error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[NotificationService] Exception finding batch:', error);
      return null;
    }
  }

  /**
   * Updates an existing batch by incrementing count
   * Uses the increment_batch_count database function
   * 
   * @private
   */
  private async updateBatch(notificationId: string): Promise<Notification | null> {
    try {
      const { data, error } = await supabase.rpc('increment_batch_count', {
        notification_id: notificationId
      });

      if (error) {
        console.error('[NotificationService] Error updating batch:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[NotificationService] Exception updating batch:', error);
      return null;
    }
  }

  /**
   * Determines if a browser notification should be triggered
   * Browser notifications are shown for high-priority events
   * 
   * @private
   */
  private shouldTriggerBrowserNotification(type: NotificationType): boolean {
    return this.BROWSER_NOTIFICATION_TYPES.includes(type);
  }

  /**
   * Main method to create a notification
   * Handles batching logic and browser notification triggering
   * 
   * Flow:
   * 1. Check if notification type should be batched
   * 2. If batchable, look for existing batch within 5-minute window
   * 3. If batch exists, increment count; otherwise create new notification
   * 4. If non-batchable, create notification immediately
   * 5. Mark high-priority notifications for browser alerts
   * 
   * @param params - Notification creation parameters
   * @returns Created or updated notification, or null if failed
   * 
   * @example
   * ```typescript
   * // Create job assignment notification (non-batchable, high priority)
   * await notificationService.createNotification({
   *   userWallet: workerWallet,
   *   type: 'job_assigned',
   *   actorWallet: posterWallet,
   *   referenceId: jobId,
   *   referenceType: 'job',
   *   metadata: {
   *     job_title: 'Logo Design',
   *     job_type: 'design'
   *   }
   * })
   * 
   * // Create upvote notification (batchable)
   * await notificationService.createNotification({
   *   userWallet: creatorWallet,
   *   type: 'asset_upvote',
   *   actorWallet: voterWallet,
   *   referenceId: assetId,
   *   referenceType: 'asset',
   *   metadata: {
   *     asset_name: 'Cool Logo',
   *     upvote_count: 1
   *   }
   * })
   * ```
   */
  async createNotification(params: CreateNotificationParams): Promise<Notification | null> {
    const { userWallet, type, actorWallet, referenceId, referenceType, metadata } = params;

    try {
      // Check if this notification type should be batched
      const shouldBatch = !this.NON_BATCHABLE_TYPES.includes(type);

      if (shouldBatch) {
        // Generate batch group key
        const batchGroupKey = this.generateBatchGroupKey(params);

        // Look for existing batch within 5-minute window
        const existingBatch = await this.findExistingBatch(batchGroupKey, userWallet);

        if (existingBatch) {
          // Update existing batch
          const updatedBatch = await this.updateBatch(existingBatch.id);
          
          if (updatedBatch) {
            console.log(
              `[NotificationService] ✅ Batched notification: ${type} ` +
              `(count: ${updatedBatch.batch_count}) for ${userWallet.slice(0, 8)}...`
            );
            return updatedBatch;
          }
        }

        // Create new batched notification
        const notificationData: NotificationInsert = {
          user_wallet: userWallet,
          type,
          actor_wallet: actorWallet,
          reference_id: referenceId,
          reference_type: referenceType,
          batch_group_key: batchGroupKey,
          metadata
        };

        const { data, error } = await supabase
          .from('notifications')
          .insert(notificationData)
          .select()
          .single();

        if (error) throw error;

        console.log(
          `[NotificationService] 🆕 Created batched notification: ${type} ` +
          `for ${userWallet.slice(0, 8)}...`
        );
        return data;
      } else {
        // Create non-batched notification
        const notificationData: NotificationInsert = {
          user_wallet: userWallet,
          type,
          actor_wallet: actorWallet,
          reference_id: referenceId,
          reference_type: referenceType,
          metadata
        };

        const { data, error } = await supabase
          .from('notifications')
          .insert(notificationData)
          .select()
          .single();

        if (error) throw error;

        console.log(
          `[NotificationService] 📬 Created notification: ${type} ` +
          `for ${userWallet.slice(0, 8)}...`
        );

        // Log if browser notification should be triggered
        if (this.shouldTriggerBrowserNotification(type)) {
          console.log(
            `[NotificationService] 🔔 Browser notification eligible: ${type}`
          );
          // Browser notification will be handled by real-time subscription
          // in the UI layer (useNotifications hook)
        }

        return data;
      }
    } catch (error) {
      console.error('[NotificationService] ❌ Error creating notification:', error);
      return null;
    }
  }

  /**
   * Get unread notification count for a user
   * 
   * @param userWallet - User's wallet address
   * @returns Count of unread notifications
   * 
   * @example
   * ```typescript
   * const count = await notificationService.getUnreadCount(userWallet)
   * console.log(`${count} unread notifications`)
   * ```
   */
  async getUnreadCount(userWallet: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_wallet', userWallet)
        .eq('is_read', false);

      if (error) {
        console.error('[NotificationService] Error getting unread count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('[NotificationService] Exception getting unread count:', error);
      return 0;
    }
  }

  /**
   * Mark a single notification as read
   * 
   * @param notificationId - Notification ID to mark as read
   * @returns Updated notification or null if error
   * 
   * @example
   * ```typescript
   * const updated = await notificationService.markAsRead(notificationId)
   * if (updated) {
   *   console.log('Marked as read:', updated.id)
   * }
   * ```
   */
  async markAsRead(notificationId: string): Promise<Notification | null> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('[NotificationService] Error marking notification as read:', error);
        return null;
      }

      if (!data) {
        console.log(`[NotificationService] ℹ️ Notification ${notificationId} was already read or not found`);
        return null;
      }

      console.log(`[NotificationService] ✓ Marked notification ${notificationId} as read`);
      return data;
    } catch (error) {
      console.error('[NotificationService] Exception marking as read:', error);
      return null;
    }
  }

  /**
   * Mark all notifications as read for a user
   * 
   * @param userWallet - User's wallet address
   * @returns Number of notifications marked as read
   * 
   * @example
   * ```typescript
   * const count = await notificationService.markAllAsRead(userWallet)
   * console.log(`Marked ${count} notifications as read`)
   * ```
   */
  async markAllAsRead(userWallet: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_wallet', userWallet)
        .eq('is_read', false)
        .select();

      if (error) {
        console.error('[NotificationService] Error marking all as read:', error);
        return 0;
      }

      const count = data?.length || 0;
      console.log(
        `[NotificationService] ✓ Marked all ${count} notifications as read for ${userWallet.slice(0, 8)}...`
      );

      return count;
    } catch (error) {
      console.error('[NotificationService] Exception marking all as read:', error);
      return 0;
    }
  }

  /**
   * Fetch notifications for a user with pagination
   * Returns enriched notifications with actor profile data
   * 
   * @param userWallet - User's wallet address
   * @param limit - Number of notifications to fetch (default: 50)
   * @param offset - Pagination offset (default: 0)
   * @returns Array of enriched notifications
   * 
   * @example
   * ```typescript
   * // Get first 20 notifications
   * const notifications = await notificationService.getNotifications(userWallet, 20, 0)
   * 
   * // Get next 20 notifications
   * const moreNotifications = await notificationService.getNotifications(userWallet, 20, 20)
   * ```
   */
  async getNotifications(
    userWallet: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<EnrichedNotification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_wallet', userWallet)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('[NotificationService] Error fetching notifications:', error);
        return [];
      }

      // Enrich with actor profile data
      const enriched = await this.enrichNotifications(data || []);
      
      console.log(
        `[NotificationService] ✓ Fetched ${enriched.length} notifications for ${userWallet.slice(0, 8)}...`
      );

      return enriched;
    } catch (error) {
      console.error('[NotificationService] Exception fetching notifications:', error);
      return [];
    }
  }

  /**
   * Delete a notification (admin/testing only)
   * 
   * @param notificationId - Notification ID to delete
   * @returns True if deleted successfully, false otherwise
   * 
   * @example
   * ```typescript
   * const success = await notificationService.deleteNotification(notificationId)
   * if (success) {
   *   console.log('Notification deleted')
   * }
   * ```
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        console.error('[NotificationService] Error deleting notification:', error);
        return false;
      }

      console.log(`[NotificationService] ✓ Deleted notification ${notificationId}`);
      return true;
    } catch (error) {
      console.error('[NotificationService] Exception deleting notification:', error);
      return false;
    }
  }

  /**
   * Send notification to all admin users
   * Queries user_profiles for all admins and creates a notification for each
   * 
   * @param params - Notification parameters (without userWallet)
   * @returns Array of created notifications
   * 
   * @example
   * ```typescript
   * const notifications = await notificationService.notifyAllAdmins({
   *   type: 'admin_dispute_new',
   *   actorWallet: userWallet,
   *   referenceId: disputeId,
   *   referenceType: 'dispute',
   *   metadata: { dispute_reason: 'Payment issue' }
   * })
   * console.log(`Notified ${notifications.length} admins`)
   * ```
   */
  async notifyAllAdmins(params: AdminNotificationParams): Promise<Notification[]> {
    try {
      // Fetch all admin users
      const { data: admins, error } = await supabase
        .from('user_profiles')
        .select('wallet_address')
        .eq('is_admin', true);

      if (error) {
        console.error('[NotificationService] Error fetching admins:', error);
        return [];
      }

      if (!admins || admins.length === 0) {
        console.warn('[NotificationService] ⚠️ No admin users found to notify');
        return [];
      }

      console.log(`[NotificationService] 🛡️ Notifying ${admins.length} admin(s) of ${params.type}`);

      // Create notification for each admin
      const notifications = await Promise.all(
        admins.map(admin =>
          this.createNotification({
            userWallet: admin.wallet_address,
            ...params
          })
        )
      );

      // Filter out any null results (failed notifications)
      const successfulNotifications = notifications.filter(
        (n): n is Notification => n !== null
      );

      console.log(
        `[NotificationService] ✓ Successfully notified ${successfulNotifications.length}/${admins.length} admin(s)`
      );

      return successfulNotifications;
    } catch (error) {
      console.error('[NotificationService] Exception notifying admins:', error);
      return [];
    }
  }

  /**
   * Notify admins of a new dispute
   * Convenience method for dispute-related admin notifications
   * 
   * @param params - Dispute details
   * @returns Array of created notifications
   * 
   * @example
   * ```typescript
   * await notificationService.notifyAdminsOfNewDispute({
   *   jobId: dispute.job_id,
   *   jobTitle: 'Logo Design',
   *   reason: 'Work not delivered',
   *   creatorWallet: userWallet
   * })
   * ```
   */
  async notifyAdminsOfNewDispute(params: {
    jobId: string;
    jobTitle: string;
    reason: string;
    creatorWallet: string;
  }): Promise<Notification[]> {
    console.log(`[NotificationService] 🛡️ Notifying admins of new dispute on job: ${params.jobTitle}`);

    return this.notifyAllAdmins({
      type: 'admin_dispute_new',
      actorWallet: params.creatorWallet,
      referenceId: params.jobId,
      referenceType: 'dispute',
      metadata: {
        job_title: params.jobTitle,
        dispute_reason: params.reason
      }
    });
  }

  /**
   * Notify admins of a new job posting
   * Convenience method for new job admin notifications
   * 
   * @param params - Job details
   * @returns Array of created notifications
   * 
   * @example
   * ```typescript
   * await notificationService.notifyAdminsOfNewJob({
   *   jobId: job.id,
   *   jobTitle: 'Logo Design',
   *   jobType: 'design',
   *   creatorWallet: posterWallet
   * })
   * ```
   */
  async notifyAdminsOfNewJob(params: {
    jobId: string;
    jobTitle: string;
    jobType: string;
    creatorWallet: string;
  }): Promise<Notification[]> {
    console.log(`[NotificationService] 🛡️ Notifying admins of new job: ${params.jobTitle}`);

    return this.notifyAllAdmins({
      type: 'admin_job_new',
      actorWallet: params.creatorWallet,
      referenceId: params.jobId,
      referenceType: 'job',
      metadata: {
        job_title: params.jobTitle,
        job_type: params.jobType
      }
    });
  }

  /**
   * Notify admins of a new asset submission
   * Convenience method for new asset admin notifications
   * 
   * @param params - Asset details
   * @returns Array of created notifications
   * 
   * @example
   * ```typescript
   * await notificationService.notifyAdminsOfNewAsset({
   *   assetId: asset.id,
   *   assetName: 'Cool Logo',
   *   creatorWallet: creatorWallet
   * })
   * ```
   */
  async notifyAdminsOfNewAsset(params: {
    assetId: string;
    assetName: string;
    creatorWallet: string;
  }): Promise<Notification[]> {
    console.log(`[NotificationService] 🛡️ Notifying admins of new asset: ${params.assetName}`);

    return this.notifyAllAdmins({
      type: 'admin_asset_new',
      actorWallet: params.creatorWallet,
      referenceId: params.assetId,
      referenceType: 'asset',
      metadata: {
        asset_name: params.assetName
      }
    });
  }

  /**
   * Notify admins of platform revenue earned
   * Convenience method for platform revenue notifications
   * 
   * @param params - Revenue details
   * @returns Array of created notifications
   * 
   * @example
   * ```typescript
   * await notificationService.notifyAdminsOfRevenue({
   *   amount: 10,
   *   token: 'USDC',
   *   source: 'job_fee'
   * })
   * ```
   */
  async notifyAdminsOfRevenue(params: {
    amount: number;
    token: string;
    source: string; // 'job_fee', 'tip_fee', etc.
  }): Promise<Notification[]> {
    console.log(
      `[NotificationService] 🛡️ Notifying admins of revenue: ${params.amount} ${params.token} from ${params.source}`
    );

    return this.notifyAllAdmins({
      type: 'admin_revenue_earned',
      referenceType: 'payment',
      metadata: {
        revenue_amount: params.amount,
        token: params.token,
        admin_action: params.source // Store source info
      }
    });
  }

  /**
   * Enriches a single notification with actor profile data
   * Fetches the actor's username and avatar from user_profiles
   * 
   * @param notification - Notification to enrich
   * @returns Enriched notification with actor_username and actor_avatar_url
   * 
   * @example
   * ```typescript
   * const notification = await notificationService.createNotification(...)
   * const enriched = await notificationService.enrichNotification(notification)
   * console.log(enriched.actor_username) // "JohnDoe"
   * ```
   */
  async enrichNotification(notification: Notification): Promise<EnrichedNotification> {
    // If no actor, return as-is
    if (!notification.actor_wallet) {
      return notification as EnrichedNotification;
    }

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name, avatar_url')
        .eq('wallet_address', notification.actor_wallet)
        .maybeSingle();

      return {
        ...notification,
        actor_username: profile?.display_name || undefined,
        actor_avatar_url: profile?.avatar_url || undefined
      };
    } catch (error) {
      console.error('[NotificationService] Error enriching notification:', error);
      return notification as EnrichedNotification;
    }
  }

  /**
   * Enriches multiple notifications with actor profile data (batch)
   * Fetches all unique actor profiles in a single query for efficiency
   * 
   * @param notifications - Array of notifications to enrich
   * @returns Array of enriched notifications
   * 
   * @example
   * ```typescript
   * const notifications = await notificationService.getUserNotifications(wallet)
   * const enriched = await notificationService.enrichNotifications(notifications)
   * ```
   */
  async enrichNotifications(notifications: Notification[]): Promise<EnrichedNotification[]> {
    // Get unique actor wallets (excluding null)
    const actorWallets = [...new Set(
      notifications
        .map(n => n.actor_wallet)
        .filter((wallet): wallet is string => wallet !== null)
    )];

    // If no actors, return as-is
    if (actorWallets.length === 0) {
      return notifications as EnrichedNotification[];
    }

    try {
      // Fetch all profiles in one query
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('wallet_address, display_name, avatar_url')
        .in('wallet_address', actorWallets);

      // Create a map for O(1) lookup
      const profileMap = new Map(
        profiles?.map(p => [p.wallet_address, p]) || []
      );

      // Enrich all notifications
      return notifications.map(notification => {
        const profile = notification.actor_wallet 
          ? profileMap.get(notification.actor_wallet)
          : null;

        return {
          ...notification,
          actor_username: profile?.display_name || undefined,
          actor_avatar_url: profile?.avatar_url || undefined
        };
      });
    } catch (error) {
      console.error('[NotificationService] Error enriching notifications:', error);
      return notifications as EnrichedNotification[];
    }
  }

  /**
   * Generates human-readable text for a notification
   * Creates concise title and body text for all 21 notification types
   * 
   * @param notification - Enriched notification (with actor data)
   * @returns Object with title and body strings
   * 
   * @example
   * ```typescript
   * const enriched = await notificationService.enrichNotification(notification)
   * const text = notificationService.generateNotificationText(enriched)
   * console.log(text.title) // "Job Assigned"
   * console.log(text.body)  // "You've been assigned to Logo Design"
   * ```
   */
  generateNotificationText(notification: EnrichedNotification): NotificationText {
    const actorName = notification.actor_username || 
      (notification.actor_wallet 
        ? `${notification.actor_wallet.slice(0, 4)}...${notification.actor_wallet.slice(-4)}` 
        : 'Someone');
    
    const metadata = notification.metadata || {};
    const count = notification.batch_count;

    switch (notification.type) {
      case 'job_application_received':
        if (count > 1) {
          return {
            title: `${count} New Applications`,
            body: `${actorName} and ${count - 1} others applied to ${metadata.job_title || 'your job'}`
          };
        }
        return {
          title: 'New Job Application',
          body: `${actorName} applied to ${metadata.job_title || 'your job'}`
        };

      case 'job_assigned':
        return {
          title: '🎯 Job Assigned',
          body: `You've been assigned to ${metadata.job_title || 'a job'} by ${actorName}`
        };

      case 'job_submitted':
        return {
          title: '📋 Work Submitted',
          body: `${actorName} submitted work for ${metadata.job_title || 'a job'}`
        };

      case 'job_completed':
        return {
          title: '✅ Job Completed',
          body: metadata.amount 
            ? `${metadata.amount} ${metadata.token || 'tokens'} released for ${metadata.job_title || 'job'}`
            : `${metadata.job_title || 'Job'} marked as complete`
        };

      case 'job_dispute_created':
        return {
          title: '⚠️ Dispute Created',
          body: `${actorName} opened a dispute on ${metadata.job_title || 'a job'}`
        };

      case 'job_dispute_vote':
        if (count > 1) {
          return {
            title: `${count} Dispute Votes`,
            body: `${actorName} and ${count - 1} others voted on your dispute`
          };
        }
        return {
          title: 'Dispute Vote',
          body: `${actorName} voted on your dispute`
        };

      case 'job_comment':
        if (count > 1) {
          return {
            title: `${count} New Comments`,
            body: `${actorName} and others commented on ${metadata.job_title || 'a job'}`
          };
        }
        return {
          title: '💬 New Comment',
          body: metadata.comment_preview
            ? `${actorName}: ${metadata.comment_preview.slice(0, 60)}...`
            : `${actorName} commented on ${metadata.job_title || 'a job'}`
        };

      case 'asset_upvote':
        if (count > 1) {
          return {
            title: `⬆️ ${count} New Upvotes`,
            body: `${actorName} and ${count - 1} others upvoted ${metadata.asset_name || 'your asset'}`
          };
        }
        return {
          title: '⬆️ New Upvote',
          body: `${actorName} upvoted ${metadata.asset_name || 'your asset'}`
        };

      case 'asset_verified':
        return {
          title: '✅ Asset Verified',
          body: `${metadata.asset_name || 'Your asset'} has been verified!`
        };

      case 'asset_hidden':
        return {
          title: '⚠️ Asset Hidden',
          body: `${metadata.asset_name || 'Your asset'} was hidden by moderators`
        };

      case 'tip_received':
        if (count > 1) {
          return {
            title: `💰 ${count} Tips Received`,
            body: `You received ${metadata.amount || '...'} ${metadata.token || 'tokens'} in tips`
          };
        }
        return {
          title: '💰 Tip Received',
          body: `${actorName} tipped you ${metadata.amount || '...'} ${metadata.token || 'tokens'}`
        };

      case 'message_received':
        return {
          title: `💬 ${actorName}`,
          body: metadata.message_preview?.slice(0, 100) || 'New message'
        };

      case 'karma_milestone':
        return {
          title: '⭐ Karma Milestone!',
          body: `You've reached ${metadata.new_karma_score || metadata.karma_points} karma! (${metadata.karma_level || 'Level up'})`
        };

      case 'karma_warning':
        return {
          title: '⚠️ Karma Warning',
          body: `Your karma is low (${metadata.karma_points || '...'}). Be careful!`
        };

      case 'karma_ban':
        return {
          title: '🚫 Karma Ban',
          body: 'Your karma dropped too low. Some features are restricted.'
        };

      case 'payment_released':
        return {
          title: '💸 Payment Released',
          body: `${metadata.amount || '...'} ${metadata.token || 'tokens'} released${metadata.job_title ? ` for ${metadata.job_title}` : ''}`
        };

      case 'payment_refunded':
        return {
          title: '↩️ Payment Refunded',
          body: `${metadata.amount || '...'} ${metadata.token || 'tokens'} refunded${metadata.job_title ? ` for ${metadata.job_title}` : ''}`
        };

      case 'admin_dispute_new':
        return {
          title: '🛡️ New Dispute',
          body: `Dispute on ${metadata.job_title || 'a job'} needs admin review`
        };

      case 'admin_job_new':
        return {
          title: '🛡️ New Job Posted',
          body: `${actorName} posted "${metadata.job_title || 'a job'}"`
        };

      case 'admin_asset_new':
        return {
          title: '🛡️ New Asset Submitted',
          body: `${actorName} submitted "${metadata.asset_name || 'an asset'}"`
        };

      case 'admin_revenue_earned':
        return {
          title: '🛡️ Platform Revenue',
          body: `Earned ${metadata.revenue_amount || '...'} ${metadata.token || 'tokens'} in platform fees`
        };

      default:
        return {
          title: '🔔 Notification',
          body: 'You have a new notification'
        };
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Export class for testing purposes
export { NotificationService };

// Export types
export type { 
  CreateNotificationParams,
  EnrichedNotification,
  NotificationText,
  AdminNotificationParams
};

