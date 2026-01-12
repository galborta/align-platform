/**
 * Activity Feed Type Definitions
 * 
 * Complete type system for the Activity Feed feature.
 * Supports job activities, asset activities, and community activities.
 */

/**
 * Main feed item interface
 * Represents a single activity in the feed
 */
export interface FeedItem {
  id: string
  type: ActivityType
  timestamp: Date
  data: Record<string, any>
  batchedCount?: number
  batchedItems?: any[]
}

/**
 * All possible activity types in the feed
 */
export type ActivityType = 
  // Job Activities
  | 'job_posted'
  | 'job_applied'
  | 'job_application_upvoted'
  | 'job_assigned'
  | 'job_submitted'
  | 'job_completed'
  | 'job_disputed'
  | 'job_comment'
  // Revision Activities
  | 'job_revision_requested'
  | 'job_revision_submitted'
  // Contest Activities
  | 'submission_comment'
  // Social Job Activities
  | 'social_job_payment'
  // Asset Activities
  | 'asset_submitted'
  | 'asset_upvoted'
  | 'asset_backed'
  | 'asset_verified'
  | 'asset_hidden'
  // Community Activities
  | 'tip_sent'
  | 'karma_milestone'

/**
 * Props for the main ActivityFeed container component
 */
export interface ActivityFeedProps {
  projectId: string
  tokenMint?: string | null
  onAddAsset?: () => void
  onPostWork?: () => void
}

/**
 * Props for individual feed item rendering component
 */
export interface FeedItemProps {
  item: FeedItem
  projectId: string
  onClickBatched?: (item: FeedItem) => void
}

/**
 * Props for feed skeleton loading state
 */
export interface FeedSkeletonProps {
  count?: number
}

/**
 * Props for empty feed state
 */
export interface FeedEmptyStateProps {
  projectId: string
}

/**
 * Feed filter options
 */
export type FeedFilterType = 'all' | 'jobs' | 'assets' | 'community'

/**
 * Feed sorting options
 */
export type FeedSortType = 'recent' | 'popular' | 'trending'

/**
 * Extended props for ActivityFeed with filters (future enhancement)
 */
export interface ActivityFeedPropsExtended extends ActivityFeedProps {
  filter?: FeedFilterType
  sort?: FeedSortType
  limit?: number
}


