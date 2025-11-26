/**
 * Feed Transform Library
 * 
 * Transforms raw Supabase data into unified FeedItem[] format.
 * Handles 17 activity types with proper data extraction from nested joins.
 * 
 * @see /lib/feed-queries.ts for data fetching
 * @see /types/feed.ts for FeedItem type definitions
 */

import { FeedItem, ActivityType } from '@/types/feed'
import { RawActivityData } from './feed-queries'

/**
 * Transform raw database data into FeedItem format
 * 
 * Takes RawActivityData from Supabase queries and converts each activity
 * type into the unified FeedItem format that the UI components expect.
 * 
 * Features:
 * - Extracts data from nested joins (e.g., vote.application.job.title)
 * - Creates multiple activities from single records (completed jobs, verified assets)
 * - Handles missing/malformed data gracefully
 * - Sorts by timestamp descending (newest first)
 * 
 * @param data - Raw activity data from feed queries
 * @returns Sorted array of FeedItems ready for display
 * 
 * @example
 * ```typescript
 * const rawData = await fetchInitialFeed('project-uuid')
 * const feedItems = transformToFeedItems(rawData)
 * console.log(`Transformed ${feedItems.length} activities`)
 * ```
 */
export function transformToFeedItems(data: RawActivityData): FeedItem[] {
  const items: FeedItem[] = []

  // ==================== JOB ACTIVITIES ====================

  // Jobs posted
  data.jobs.forEach(job => {
    try {
      items.push({
        id: `job_posted_${job.id}`,
        type: 'job_posted',
        timestamp: new Date(job.created_at),
        data: {
          actorWallet: job.poster_wallet,
          jobId: job.id,
          jobTitle: job.title,
          category: job.category
        }
      })

      // Also create job_assigned activity if job has been assigned
      if (job.status === 'assigned' && job.assigned_to && job.assigned_at) {
        items.push({
          id: `job_assigned_${job.id}`,
          type: 'job_assigned',
          timestamp: new Date(job.assigned_at),
          data: {
            jobId: job.id,
            jobTitle: job.title,
            assignedTo: job.assigned_to
          }
        })
      }

      // Also create job_completed activity for finished jobs
      if (job.status === 'completed' && job.completed_at) {
        items.push({
          id: `job_completed_${job.id}`,
          type: 'job_completed',
          timestamp: new Date(job.completed_at),
          data: {
            actorWallet: job.assigned_to || job.poster_wallet,
            jobId: job.id,
            jobTitle: job.title
          }
        })
      }
    } catch (error) {
      console.error('Error transforming job:', job.id, error)
    }
  })

  // Job applications
  data.applications.forEach(app => {
    try {
      // Skip if join failed - no job data available
      if (!app.job) return

      items.push({
        id: `job_applied_${app.id}`,
        type: 'job_applied',
        timestamp: new Date(app.created_at),
        data: {
          actorWallet: app.applicant_wallet,
          jobId: app.job.id,
          jobTitle: app.job.title,
          applicationId: app.id
        }
      })
    } catch (error) {
      console.error('Error transforming application:', app.id, error)
    }
  })

  // Application votes (will be batched later in feed-batching.ts)
  data.applicationVotes.forEach(vote => {
    try {
      // Skip if nested join failed
      if (!vote.application?.job) return

      items.push({
        id: `app_vote_${vote.id}`,
        type: 'job_application_upvoted',
        timestamp: new Date(vote.created_at),
        data: {
          actorWallet: vote.voter_wallet,
          voteWeight: vote.vote_weight,
          applicationId: vote.application.id,
          applicantWallet: vote.application.applicant_wallet,
          jobId: vote.application.job.id,
          jobTitle: vote.application.job.title
        }
      })
    } catch (error) {
      console.error('Error transforming application vote:', vote.id, error)
    }
  })

  // Job comments (will be batched later in feed-batching.ts)
  data.comments.forEach(comment => {
    try {
      if (!comment.job) return

      items.push({
        id: `comment_${comment.id}`,
        type: 'job_comment',
        timestamp: new Date(comment.created_at),
        data: {
          actorWallet: comment.wallet_address,
          message: comment.message,
          jobId: comment.job.id,
          jobTitle: comment.job.title
        }
      })
    } catch (error) {
      console.error('Error transforming comment:', comment.id, error)
    }
  })

  // Job submissions
  data.submissions.forEach(sub => {
    try {
      if (!sub.job) return

      items.push({
        id: `job_submitted_${sub.id}`,
        type: 'job_submitted',
        timestamp: new Date(sub.submitted_at),
        data: {
          actorWallet: sub.worker_wallet,
          jobId: sub.job.id,
          jobTitle: sub.job.title
        }
      })
    } catch (error) {
      console.error('Error transforming submission:', sub.id, error)
    }
  })

  // Job disputes
  data.disputes.forEach(dispute => {
    try {
      if (!dispute.job) return

      items.push({
        id: `job_disputed_${dispute.id}`,
        type: 'job_disputed',
        timestamp: new Date(dispute.created_at),
        data: {
          openedBy: dispute.opened_by,
          jobId: dispute.job.id,
          jobTitle: dispute.job.title,
          posterWallet: dispute.job.poster_wallet,
          workerWallet: dispute.job.assigned_to
        }
      })
    } catch (error) {
      console.error('Error transforming dispute:', dispute.id, error)
    }
  })

  // ==================== ASSET ACTIVITIES ====================

  // Pending assets - create multiple activities per asset
  data.assets.forEach(asset => {
    try {
      // Asset submitted
      items.push({
        id: `asset_submitted_${asset.id}`,
        type: 'asset_submitted',
        timestamp: new Date(asset.created_at),
        data: {
          submitterWallet: asset.submitter_wallet,
          assetType: asset.asset_type,
          assetId: asset.id,
          assetName: extractAssetName(asset)
        }
      })

      // Asset backed (reached 0.5% threshold)
      if (asset.verification_status === 'backed') {
        items.push({
          id: `asset_backed_${asset.id}`,
          type: 'asset_backed',
          timestamp: new Date(asset.updated_at || asset.created_at),
          data: {
            assetType: asset.asset_type,
            assetId: asset.id,
            assetName: extractAssetName(asset)
          }
        })
      }

      // Asset verified (reached 2.5% threshold)
      if (asset.verification_status === 'verified' && asset.verified_at) {
        items.push({
          id: `asset_verified_${asset.id}`,
          type: 'asset_verified',
          timestamp: new Date(asset.verified_at),
          data: {
            assetType: asset.asset_type,
            assetId: asset.id,
            assetName: extractAssetName(asset)
          }
        })
      }

      // Asset hidden (reached report threshold)
      if (asset.verification_status === 'hidden' && asset.hidden_at) {
        items.push({
          id: `asset_hidden_${asset.id}`,
          type: 'asset_hidden',
          timestamp: new Date(asset.hidden_at),
          data: {
            assetType: asset.asset_type,
            assetId: asset.id,
            assetName: extractAssetName(asset)
          }
        })
      }
    } catch (error) {
      console.error('Error transforming asset:', asset.id, error)
    }
  })

  // Asset votes (will be batched later in feed-batching.ts)
  data.assetVotes.forEach(vote => {
    try {
      if (!vote.asset) return

      items.push({
        id: `asset_vote_${vote.id}`,
        type: 'asset_upvoted',
        timestamp: new Date(vote.created_at),
        data: {
          voterWallet: vote.voter_wallet,
          voteWeight: vote.token_percentage_snapshot,
          assetId: vote.asset.id,
          assetType: vote.asset.asset_type,
          assetName: extractAssetName(vote.asset)
        }
      })
    } catch (error) {
      console.error('Error transforming asset vote:', vote.id, error)
    }
  })

  // ==================== COMMUNITY ACTIVITIES ====================

  // Public tips
  data.tips.forEach(tip => {
    try {
      items.push({
        id: `tip_sent_${tip.id}`,
        type: 'tip_sent',
        timestamp: new Date(tip.created_at),
        data: {
          fromWallet: tip.from_wallet,
          toWallet: tip.to_wallet,
          amountTokens: tip.amount_tokens,
          tokenSymbol: tip.token_symbol,
          message: tip.message
        }
      })
    } catch (error) {
      console.error('Error transforming tip:', tip.id, error)
    }
  })

  // Karma milestones (detect which milestone was crossed)
  data.karmaMilestones.forEach(karma => {
    try {
      const milestone = detectKarmaMilestone(karma.total_karma_points)
      if (milestone) {
        items.push({
          id: `karma_milestone_${karma.wallet_address}_${milestone}`,
          type: 'karma_milestone',
          timestamp: new Date(karma.updated_at),
          data: {
            wallet: karma.wallet_address,
            milestone: milestone,
            totalKarma: karma.total_karma_points
          }
        })
      }
    } catch (error) {
      console.error('Error transforming karma milestone:', karma.wallet_address, error)
    }
  })

  // Sort by timestamp descending (newest first)
  return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

/**
 * Extract human-readable asset name from asset_data JSON
 * 
 * Handles different asset types:
 * - Social: "@username" from handle field
 * - Creative: Name of artwork/logo
 * - Legal: Domain/trademark name
 * 
 * @param asset - Asset record with asset_data JSONB field
 * @returns Human-readable asset name or generic fallback
 */
function extractAssetName(asset: any): string {
  try {
    // Social assets (Instagram, Twitter, TikTok, YouTube)
    if (asset.asset_type === 'social') {
      const handle = asset.asset_data?.handle
      const platform = asset.asset_data?.platform
      
      if (handle) {
        return `@${handle}`
      }
      if (platform) {
        return `${platform} account`
      }
      return 'Social asset'
    }

    // Creative assets (logos, characters, artwork)
    if (asset.asset_type === 'creative') {
      const name = asset.asset_data?.name
      const assetType = asset.asset_data?.asset_type
      
      if (name) {
        return name
      }
      if (assetType) {
        return `${assetType.charAt(0).toUpperCase() + assetType.slice(1)}`
      }
      return 'Creative asset'
    }

    // Legal assets (domains, trademarks, copyrights)
    if (asset.asset_type === 'legal') {
      const name = asset.asset_data?.name
      const assetType = asset.asset_data?.asset_type
      
      if (name) {
        return name
      }
      if (assetType) {
        return `${assetType.charAt(0).toUpperCase() + assetType.slice(1)}`
      }
      return 'Legal asset'
    }

    return 'Asset'
  } catch (error) {
    console.error('Error extracting asset name:', error)
    return 'Asset'
  }
}

/**
 * Detect which karma milestone was just crossed
 * 
 * Checks if the total karma is within 10% above a major milestone,
 * indicating the user recently crossed that threshold.
 * 
 * Milestones (highest to lowest):
 * - 100,000 karma
 * - 50,000 karma
 * - 10,000 karma
 * - 5,000 karma
 * - 1,000 karma
 * 
 * @param totalKarma - Current total karma points
 * @returns Milestone number if recently crossed, null otherwise
 * 
 * @example
 * detectKarmaMilestone(1050) // Returns 1000
 * detectKarmaMilestone(5200) // Returns 5000
 * detectKarmaMilestone(7500) // Returns null (between milestones)
 */
function detectKarmaMilestone(totalKarma: number): number | null {
  // Check from highest to lowest
  const milestones = [100000, 50000, 10000, 5000, 1000]

  for (const milestone of milestones) {
    // If karma is within 10% above milestone, consider it just crossed
    // This allows some buffer for continued activity after crossing
    if (totalKarma >= milestone && totalKarma < milestone * 1.1) {
      return milestone
    }
  }

  return null
}

/**
 * Count total number of activities in raw data
 * 
 * Utility function for debugging and monitoring.
 * Returns count of raw records before transformation.
 * 
 * @param data - Raw activity data
 * @returns Total count of all raw records
 */
export function countRawActivities(data: RawActivityData): number {
  return (
    data.jobs.length +
    data.applications.length +
    data.applicationVotes.length +
    data.comments.length +
    data.submissions.length +
    data.disputes.length +
    data.assets.length +
    data.assetVotes.length +
    data.tips.length +
    data.karmaMilestones.length
  )
}

/**
 * Get activity counts by type
 * 
 * Utility function for debugging and analytics.
 * Returns breakdown of how many activities of each type were created.
 * 
 * @param items - Transformed FeedItems
 * @returns Object mapping activity types to counts
 */
export function getActivityCounts(items: FeedItem[]): Record<ActivityType, number> {
  const counts: Record<string, number> = {}

  items.forEach(item => {
    counts[item.type] = (counts[item.type] || 0) + 1
  })

  return counts as Record<ActivityType, number>
}

/**
 * Transform single subscription event into FeedItem(s)
 * 
 * Used by real-time subscription manager to convert individual
 * database events into feed items.
 * 
 * @param event - Event from subscription manager
 * @returns Array of FeedItems (some events create multiple items)
 * 
 * @example
 * ```typescript
 * const items = transformSubscriptionEvent({
 *   type: 'job_posted',
 *   table: 'jobs',
 *   data: jobRecord
 * })
 * ```
 */
export function transformSubscriptionEvent(event: {
  type: string
  table: string
  data: any
}): FeedItem[] {
  const items: FeedItem[] = []

  try {
    switch (event.type) {
      case 'job_posted': {
        const job = event.data
        items.push({
          id: `job_posted_${job.id}`,
          type: 'job_posted',
          timestamp: new Date(job.created_at),
          data: {
            actorWallet: job.poster_wallet,
            jobId: job.id,
            jobTitle: job.title,
            category: job.category
          }
        })
        break
      }

      case 'job_assigned': {
        const job = event.data
        items.push({
          id: `job_assigned_${job.id}`,
          type: 'job_assigned',
          timestamp: new Date(job.assigned_at || job.updated_at),
          data: {
            jobId: job.id,
            jobTitle: job.title,
            assignedTo: job.assigned_to
          }
        })
        break
      }

      case 'job_completed': {
        const job = event.data
        items.push({
          id: `job_completed_${job.id}`,
          type: 'job_completed',
          timestamp: new Date(job.completed_at || job.updated_at),
          data: {
            actorWallet: job.assigned_to || job.poster_wallet,
            jobId: job.id,
            jobTitle: job.title
          }
        })
        break
      }

      case 'job_applied': {
        const app = event.data
        if (!app.job) break
        items.push({
          id: `job_applied_${app.id}`,
          type: 'job_applied',
          timestamp: new Date(app.created_at),
          data: {
            actorWallet: app.applicant_wallet,
            jobId: app.job.id,
            jobTitle: app.job.title,
            applicationId: app.id
          }
        })
        break
      }

      case 'job_application_upvoted': {
        const vote = event.data
        if (!vote.application?.job) break
        items.push({
          id: `app_vote_${vote.id}`,
          type: 'job_application_upvoted',
          timestamp: new Date(vote.created_at),
          data: {
            actorWallet: vote.voter_wallet,
            voteWeight: vote.vote_weight,
            applicationId: vote.application.id,
            applicantWallet: vote.application.applicant_wallet,
            jobId: vote.application.job.id,
            jobTitle: vote.application.job.title
          }
        })
        break
      }

      case 'job_comment': {
        const comment = event.data
        if (!comment.job) break
        items.push({
          id: `comment_${comment.id}`,
          type: 'job_comment',
          timestamp: new Date(comment.created_at),
          data: {
            actorWallet: comment.wallet_address,
            message: comment.message,
            jobId: comment.job.id,
            jobTitle: comment.job.title
          }
        })
        break
      }

      case 'job_submitted': {
        const sub = event.data
        if (!sub.job) break
        items.push({
          id: `job_submitted_${sub.id}`,
          type: 'job_submitted',
          timestamp: new Date(sub.submitted_at),
          data: {
            actorWallet: sub.worker_wallet,
            jobId: sub.job.id,
            jobTitle: sub.job.title
          }
        })
        break
      }

      case 'job_disputed': {
        const dispute = event.data
        if (!dispute.job) break
        items.push({
          id: `job_disputed_${dispute.id}`,
          type: 'job_disputed',
          timestamp: new Date(dispute.created_at),
          data: {
            openedBy: dispute.opened_by,
            jobId: dispute.job.id,
            jobTitle: dispute.job.title,
            posterWallet: dispute.job.poster_wallet,
            workerWallet: dispute.job.assigned_to
          }
        })
        break
      }

      case 'asset_submitted': {
        const asset = event.data
        items.push({
          id: `asset_submitted_${asset.id}`,
          type: 'asset_submitted',
          timestamp: new Date(asset.created_at),
          data: {
            submitterWallet: asset.submitter_wallet,
            assetType: asset.asset_type,
            assetId: asset.id,
            assetName: extractAssetName(asset)
          }
        })
        break
      }

      case 'asset_backed': {
        const asset = event.data
        items.push({
          id: `asset_backed_${asset.id}`,
          type: 'asset_backed',
          timestamp: new Date(asset.updated_at || asset.created_at),
          data: {
            assetType: asset.asset_type,
            assetId: asset.id,
            assetName: extractAssetName(asset)
          }
        })
        break
      }

      case 'asset_verified': {
        const asset = event.data
        items.push({
          id: `asset_verified_${asset.id}`,
          type: 'asset_verified',
          timestamp: new Date(asset.verified_at || asset.updated_at),
          data: {
            assetType: asset.asset_type,
            assetId: asset.id,
            assetName: extractAssetName(asset)
          }
        })
        break
      }

      case 'asset_hidden': {
        const asset = event.data
        items.push({
          id: `asset_hidden_${asset.id}`,
          type: 'asset_hidden',
          timestamp: new Date(asset.hidden_at || asset.updated_at),
          data: {
            assetType: asset.asset_type,
            assetId: asset.id,
            assetName: extractAssetName(asset)
          }
        })
        break
      }

      case 'asset_upvoted': {
        const vote = event.data
        if (!vote.asset) break
        items.push({
          id: `asset_vote_${vote.id}`,
          type: 'asset_upvoted',
          timestamp: new Date(vote.created_at),
          data: {
            voterWallet: vote.voter_wallet,
            voteWeight: vote.token_percentage_snapshot,
            assetId: vote.asset.id,
            assetType: vote.asset.asset_type,
            assetName: extractAssetName(vote.asset)
          }
        })
        break
      }

      case 'tip_sent': {
        const tip = event.data
        items.push({
          id: `tip_sent_${tip.id}`,
          type: 'tip_sent',
          timestamp: new Date(tip.created_at),
          data: {
            fromWallet: tip.from_wallet,
            toWallet: tip.to_wallet,
            amountTokens: tip.amount_tokens,
            tokenSymbol: tip.token_symbol,
            message: tip.message
          }
        })
        break
      }

      case 'karma_milestone': {
        const karma = event.data
        items.push({
          id: `karma_milestone_${karma.wallet_address}_${karma.milestone}`,
          type: 'karma_milestone',
          timestamp: new Date(karma.updated_at),
          data: {
            wallet: karma.wallet_address,
            milestone: karma.milestone,
            totalKarma: karma.total_karma_points
          }
        })
        break
      }

      default:
        console.warn('Unknown subscription event type:', event.type)
    }
  } catch (error) {
    console.error('Error transforming subscription event:', error, event)
  }

  return items
}

