/**
 * Social Media Job Notification Helpers
 * 
 * Functions for creating notifications related to social media jobs
 * (retweet campaigns and original tweet campaigns).
 * 
 * Follows the pattern from lib/job-notifications.ts and uses the
 * notificationService from lib/services/notificationService.ts
 */

import { notificationService } from '@/lib/services/notificationService'
import type { Notification } from '@/types/database'

// ==================== SUBMISSION NOTIFICATIONS ====================

/**
 * Notify job poster that a worker submitted social media proof
 * 
 * Called when a worker submits their tweet link and follower count
 * 
 * @param posterWallet - Job poster's wallet address
 * @param workerWallet - Worker who submitted
 * @param jobId - UUID of the social media job
 * @param jobTitle - Title of the job
 * @param paymentAmount - Base payment amount (before bonus) in USD
 * @param projectId - Optional project ID for navigation
 * @returns Created notification or null
 * 
 * @example
 * ```typescript
 * await notifySubmissionReceived(
 *   posterWallet,
 *   workerWallet,
 *   jobId,
 *   'Retweet our product launch',
 *   50,
 *   projectId
 * )
 * ```
 */
export async function notifySubmissionReceived(
  posterWallet: string,
  workerWallet: string,
  jobId: string,
  jobTitle: string,
  paymentAmount: number,
  projectId?: string
): Promise<Notification | null> {
  console.log(
    `[Social Notifications] 📱 Notifying poster of submission: ${jobTitle} ($${paymentAmount})`
  )

  return notificationService.createNotification({
    userWallet: posterWallet,
    type: 'social_submission_received',
    actorWallet: workerWallet,
    referenceId: jobId,
    referenceType: 'job',
    metadata: {
      job_title: jobTitle,
      social_payment_amount: paymentAmount,
      ...(projectId && { project_id: projectId })
    }
  })
}

/**
 * Notify worker that their submission was approved and paid
 * 
 * Called when poster approves submission after verifying impressions
 * 
 * @param workerWallet - Worker who submitted
 * @param jobId - UUID of the social media job
 * @param jobTitle - Title of the job
 * @param baseAmount - Base payment from tier (in USD)
 * @param bonusAmount - Impression bonus at $5 CPM (in USD)
 * @param totalAmount - Total payment = base + bonus (in USD)
 * @param impressions - Verified impression count
 * @returns Created notification or null
 * 
 * @example
 * ```typescript
 * await notifySubmissionApproved(
 *   workerWallet,
 *   jobId,
 *   'Retweet our product launch',
 *   50,    // Base $50 from tier
 *   250,   // $250 bonus from 50K impressions
 *   300,   // $300 total
 *   50000  // 50K impressions
 * )
 * ```
 */
export async function notifySubmissionApproved(
  workerWallet: string,
  jobId: string,
  jobTitle: string,
  baseAmount: number,
  bonusAmount: number,
  totalAmount: number,
  impressions: number
): Promise<Notification | null> {
  console.log(
    `[Social Notifications] ✅ Notifying worker of approval: ${jobTitle} ($${totalAmount})`
  )

  return notificationService.createNotification({
    userWallet: workerWallet,
    type: 'social_submission_approved',
    referenceId: jobId,
    referenceType: 'job',
    metadata: {
      job_title: jobTitle,
      social_base_amount: baseAmount,
      social_bonus_amount: bonusAmount,
      social_total_amount: totalAmount,
      social_impressions: impressions,
      amount: totalAmount, // For generic notification rendering
      token: 'USD' // Payment amounts are in USD
    }
  })
}

/**
 * Notify worker that their submission was denied
 * 
 * Called when poster rejects submission (e.g., invalid tweet, fake followers)
 * 
 * @param workerWallet - Worker who submitted
 * @param jobId - UUID of the social media job
 * @param jobTitle - Title of the job
 * @param reason - Rejection reason provided by poster
 * @returns Created notification or null
 * 
 * @example
 * ```typescript
 * await notifySubmissionDenied(
 *   workerWallet,
 *   jobId,
 *   'Retweet our product launch',
 *   'Tweet was deleted before verification'
 * )
 * ```
 */
export async function notifySubmissionDenied(
  workerWallet: string,
  jobId: string,
  jobTitle: string,
  reason: string
): Promise<Notification | null> {
  console.log(
    `[Social Notifications] ❌ Notifying worker of denial: ${jobTitle}`
  )

  return notificationService.createNotification({
    userWallet: workerWallet,
    type: 'social_submission_denied',
    referenceId: jobId,
    referenceType: 'job',
    metadata: {
      job_title: jobTitle,
      social_denial_reason: reason,
      rejection_reason: reason // For generic notification rendering
    }
  })
}

// ==================== CAMPAIGN NOTIFICATIONS ====================

/**
 * Notify job poster that their campaign completed successfully
 * 
 * Called when review deadline passes and all payments are distributed
 * 
 * @param posterWallet - Job poster's wallet address
 * @param jobId - UUID of the social media job
 * @param jobTitle - Title of the job
 * @param participants - Number of workers who participated
 * @param totalSpent - Total amount spent on payments (in USD)
 * @param refunded - Amount refunded to poster (in USD)
 * @returns Created notification or null
 * 
 * @example
 * ```typescript
 * await notifyCampaignCompleted(
 *   posterWallet,
 *   jobId,
 *   'Retweet our product launch',
 *   15,    // 15 participants
 *   4500,  // Spent $4,500
 *   500    // Refunded $500
 * )
 * ```
 */
export async function notifyCampaignCompleted(
  posterWallet: string,
  jobId: string,
  jobTitle: string,
  participants: number,
  totalSpent: number,
  refunded: number
): Promise<Notification | null> {
  console.log(
    `[Social Notifications] 🎉 Notifying poster of campaign completion: ${jobTitle} (${participants} participants, $${totalSpent} spent)`
  )

  return notificationService.createNotification({
    userWallet: posterWallet,
    type: 'social_campaign_completed',
    referenceId: jobId,
    referenceType: 'job',
    metadata: {
      job_title: jobTitle,
      social_participants: participants,
      social_total_spent: totalSpent,
      social_refunded: refunded,
      amount: totalSpent, // For generic notification rendering
      token: 'USD'
    }
  })
}

/**
 * Notify job poster that their campaign ended with no participants
 * 
 * Called when campaign ends without any valid submissions
 * Poster can cancel for full refund with no karma penalty
 * 
 * @param posterWallet - Job poster's wallet address
 * @param jobId - UUID of the social media job
 * @param jobTitle - Title of the job
 * @param budgetAmount - Original budget amount (in USD)
 * @returns Created notification or null
 * 
 * @example
 * ```typescript
 * await notifyCampaignEndedNoParticipants(
 *   posterWallet,
 *   jobId,
 *   'Retweet our product launch',
 *   5000
 * )
 * ```
 */
export async function notifyCampaignEndedNoParticipants(
  posterWallet: string,
  jobId: string,
  jobTitle: string,
  budgetAmount: number
): Promise<Notification | null> {
  console.log(
    `[Social Notifications] 📭 Notifying poster of campaign with no participants: ${jobTitle}`
  )

  return notificationService.createNotification({
    userWallet: posterWallet,
    type: 'social_campaign_ended_no_participants',
    referenceId: jobId,
    referenceType: 'job',
    metadata: {
      job_title: jobTitle,
      social_budget_amount: budgetAmount,
      amount: budgetAmount, // For generic notification rendering
      token: 'USD'
    }
  })
}

/**
 * Notify worker that payment was auto-distributed
 * 
 * Called when review deadline passes and pending submissions are auto-approved
 * 
 * @param workerWallet - Worker who submitted
 * @param jobId - UUID of the social media job
 * @param jobTitle - Title of the job
 * @param paymentAmount - Base payment amount (in USD)
 * @returns Created notification or null
 * 
 * @example
 * ```typescript
 * await notifyPaymentDistributed(
 *   workerWallet,
 *   jobId,
 *   'Retweet our product launch',
 *   50
 * )
 * ```
 */
export async function notifyPaymentDistributed(
  workerWallet: string,
  jobId: string,
  jobTitle: string,
  paymentAmount: number
): Promise<Notification | null> {
  console.log(
    `[Social Notifications] 💸 Notifying worker of auto-distributed payment: ${jobTitle} ($${paymentAmount})`
  )

  return notificationService.createNotification({
    userWallet: workerWallet,
    type: 'social_payment_distributed',
    referenceId: jobId,
    referenceType: 'job',
    metadata: {
      job_title: jobTitle,
      social_payment_amount: paymentAmount,
      amount: paymentAmount, // For generic notification rendering
      token: 'USD'
    }
  })
}

// ==================== BATCH NOTIFICATIONS ====================

/**
 * Notify multiple workers that their payments were distributed
 * 
 * Convenience function for batch auto-approval notifications
 * 
 * @param workerPayments - Array of worker wallet addresses and payment amounts
 * @param jobId - UUID of the social media job
 * @param jobTitle - Title of the job
 * @returns Array of created notifications (excluding nulls)
 * 
 * @example
 * ```typescript
 * await notifyBatchPaymentsDistributed(
 *   [
 *     { wallet: 'worker1...', amount: 50 },
 *     { wallet: 'worker2...', amount: 200 },
 *     { wallet: 'worker3...', amount: 50 }
 *   ],
 *   jobId,
 *   'Retweet our product launch'
 * )
 * ```
 */
export async function notifyBatchPaymentsDistributed(
  workerPayments: Array<{ wallet: string; amount: number }>,
  jobId: string,
  jobTitle: string
): Promise<Notification[]> {
  console.log(
    `[Social Notifications] 💸 Batch notifying ${workerPayments.length} workers of distributed payments`
  )

  const notifications = await Promise.all(
    workerPayments.map(({ wallet, amount }) =>
      notifyPaymentDistributed(wallet, jobId, jobTitle, amount)
    )
  )

  // Filter out null results (failed notifications)
  const successfulNotifications = notifications.filter(
    (n): n is Notification => n !== null
  )

  console.log(
    `[Social Notifications] ✓ Successfully notified ${successfulNotifications.length}/${workerPayments.length} workers`
  )

  return successfulNotifications
}

/**
 * Notify multiple workers that their submissions were approved
 * 
 * Convenience function for batch approval notifications
 * 
 * @param workerApprovals - Array of worker details with payment breakdown
 * @param jobId - UUID of the social media job
 * @param jobTitle - Title of the job
 * @returns Array of created notifications (excluding nulls)
 * 
 * @example
 * ```typescript
 * await notifyBatchSubmissionsApproved(
 *   [
 *     { 
 *       wallet: 'worker1...', 
 *       baseAmount: 50, 
 *       bonusAmount: 250, 
 *       totalAmount: 300,
 *       impressions: 50000
 *     }
 *   ],
 *   jobId,
 *   'Retweet our product launch'
 * )
 * ```
 */
export async function notifyBatchSubmissionsApproved(
  workerApprovals: Array<{
    wallet: string
    baseAmount: number
    bonusAmount: number
    totalAmount: number
    impressions: number
  }>,
  jobId: string,
  jobTitle: string
): Promise<Notification[]> {
  console.log(
    `[Social Notifications] ✅ Batch notifying ${workerApprovals.length} workers of approvals`
  )

  const notifications = await Promise.all(
    workerApprovals.map(({ wallet, baseAmount, bonusAmount, totalAmount, impressions }) =>
      notifySubmissionApproved(
        wallet,
        jobId,
        jobTitle,
        baseAmount,
        bonusAmount,
        totalAmount,
        impressions
      )
    )
  )

  // Filter out null results (failed notifications)
  const successfulNotifications = notifications.filter(
    (n): n is Notification => n !== null
  )

  console.log(
    `[Social Notifications] ✓ Successfully notified ${successfulNotifications.length}/${workerApprovals.length} workers`
  )

  return successfulNotifications
}

// ==================== EXPORTS ====================

export default {
  notifySubmissionReceived,
  notifySubmissionApproved,
  notifySubmissionDenied,
  notifyCampaignCompleted,
  notifyCampaignEndedNoParticipants,
  notifyPaymentDistributed,
  notifyBatchPaymentsDistributed,
  notifyBatchSubmissionsApproved
}

