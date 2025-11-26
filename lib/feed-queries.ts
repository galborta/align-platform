/**
 * Feed Queries Library
 * 
 * Handles all data fetching for the Activity Feed system.
 * Queries 10+ tables in parallel using Promise.all() for optimal performance.
 * 
 * @see /types/feed.ts for FeedItem type definitions
 * @see /components/ActivityFeed.tsx for usage
 */

import { supabase } from './supabase'
import { Database } from '@/types/database'

// Type aliases for cleaner code
type Job = Database['public']['Tables']['jobs']['Row']
type JobApplication = Database['public']['Tables']['job_applications']['Row']
type JobApplicationVote = Database['public']['Tables']['job_application_votes']['Row']
type JobComment = Database['public']['Tables']['job_comments']['Row']
type JobSubmission = Database['public']['Tables']['job_submissions']['Row']
type JobDispute = Database['public']['Tables']['job_disputes']['Row']
type PendingAsset = Database['public']['Tables']['pending_assets']['Row']
type AssetVote = Database['public']['Tables']['asset_votes']['Row']
type ChatTip = Database['public']['Tables']['chat_tips']['Row']
type WalletKarma = Database['public']['Tables']['wallet_karma']['Row']

/**
 * Extended types for joined data
 */
export interface JobApplicationWithJob extends JobApplication {
  job: {
    id: string
    title: string
    project_id: string
  }
}

export interface JobApplicationVoteWithData extends JobApplicationVote {
  application: {
    id: string
    applicant_wallet: string
    job: {
      id: string
      title: string
      project_id: string
    }
  }
}

export interface JobCommentWithJob extends JobComment {
  job: {
    id: string
    title: string
    project_id: string
  }
}

export interface JobSubmissionWithJob extends JobSubmission {
  job: {
    id: string
    title: string
    status: string
    project_id: string
  }
}

export interface JobDisputeWithJob extends JobDispute {
  job: {
    id: string
    title: string
    poster_wallet: string
    assigned_to: string | null
    project_id: string
  }
}

export interface AssetVoteWithAsset extends AssetVote {
  asset: {
    id: string
    asset_type: string
    asset_data: Record<string, any>
    project_id: string
  }
}

/**
 * Container for all raw activity data fetched from database
 */
export interface RawActivityData {
  jobs: Job[]
  applications: JobApplicationWithJob[]
  applicationVotes: JobApplicationVoteWithData[]
  comments: JobCommentWithJob[]
  submissions: JobSubmissionWithJob[]
  disputes: JobDisputeWithJob[]
  assets: PendingAsset[]
  assetVotes: AssetVoteWithAsset[]
  tips: ChatTip[]
  karmaMilestones: WalletKarma[]
}

/**
 * Fetch initial feed data for a project
 * 
 * Queries 10 different tables in parallel for optimal performance.
 * Each query includes relevant joins to fetch related data.
 * Handles errors gracefully - if one query fails, others still succeed.
 * 
 * @param projectId - UUID of the project to fetch activities for
 * @param limit - Number of items to fetch per table (default: 50)
 * @returns Promise resolving to RawActivityData with all fetched data
 * 
 * @example
 * ```typescript
 * const data = await fetchInitialFeed('project-uuid-123', 50)
 * console.log(`Fetched ${data.jobs.length} jobs`)
 * ```
 */
export async function fetchInitialFeed(
  projectId: string,
  limit: number = 50
): Promise<RawActivityData> {
  // Execute all queries in parallel for maximum performance
  const [
    jobsRes,
    applicationsRes,
    applicationVotesRes,
    commentsRes,
    submissionsRes,
    disputesRes,
    assetsRes,
    assetVotesRes,
    tipsRes,
    karmaRes
  ] = await Promise.all([
    // 1. Jobs posted
    supabase
      .from('jobs')
      .select('id, poster_wallet, title, category, status, created_at, completed_at, assigned_to')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching jobs:', res.error)
        return res
      }),

    // 2. Job applications (with job title via join)
    supabase
      .from('job_applications')
      .select(`
        id,
        applicant_wallet,
        created_at,
        job:jobs!inner(id, title, project_id)
      `)
      .eq('jobs.project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching applications:', res.error)
        return res
      }),

    // 3. Application votes (with application + job data)
    supabase
      .from('job_application_votes')
      .select(`
        id,
        voter_wallet,
        vote_weight,
        created_at,
        application:job_applications!inner(
          id,
          applicant_wallet,
          job:jobs!inner(id, title, project_id)
        )
      `)
      .eq('application.jobs.project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(100) // More votes for batching logic
      .then(res => {
        if (res.error) console.error('Error fetching application votes:', res.error)
        return res
      }),

    // 4. Job comments (with job data)
    supabase
      .from('job_comments')
      .select(`
        id,
        wallet_address,
        message,
        created_at,
        job:jobs!inner(id, title, project_id)
      `)
      .eq('jobs.project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching job comments:', res.error)
        return res
      }),

    // 5. Job submissions (with job data)
    supabase
      .from('job_submissions')
      .select(`
        id,
        worker_wallet,
        submitted_at,
        job:jobs!inner(id, title, status, project_id)
      `)
      .eq('jobs.project_id', projectId)
      .order('submitted_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching job submissions:', res.error)
        return res
      }),

    // 6. Job disputes (active only, with job data)
    supabase
      .from('job_disputes')
      .select(`
        id,
        opened_by,
        created_at,
        job:jobs!inner(id, title, poster_wallet, assigned_to, project_id)
      `)
      .eq('jobs.project_id', projectId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching job disputes:', res.error)
        return res
      }),

    // 7. Pending assets (all statuses for status change events)
    supabase
      .from('pending_assets')
      .select('id, submitter_wallet, asset_type, asset_data, verification_status, created_at, verified_at, hidden_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching pending assets:', res.error)
        return res
      }),

    // 8. Asset votes (upvotes only, with asset data)
    supabase
      .from('asset_votes')
      .select(`
        id,
        voter_wallet,
        vote_type,
        token_percentage_snapshot,
        created_at,
        asset:pending_assets!inner(id, asset_type, asset_data, project_id)
      `)
      .eq('pending_assets.project_id', projectId)
      .eq('vote_type', 'upvote')
      .order('created_at', { ascending: false })
      .limit(100) // More for batching logic
      .then(res => {
        if (res.error) console.error('Error fetching asset votes:', res.error)
        return res
      }),

    // 9. Public tips (only show public tips in feed)
    supabase
      .from('chat_tips')
      .select('id, from_wallet, to_wallet, amount_tokens, token_symbol, message, created_at')
      .eq('project_id', projectId)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching chat tips:', res.error)
        return res
      }),

    // 10. Karma milestones (wallets that recently crossed major thresholds)
    // Note: This query gets high-karma wallets; batching logic will detect actual milestones
    supabase
      .from('wallet_karma')
      .select('wallet_address, total_karma_points, updated_at')
      .eq('project_id', projectId)
      .gte('total_karma_points', 1000) // At least 1k karma
      .order('updated_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching karma milestones:', res.error)
        return res
      })
  ])

  // Return data, using empty arrays if queries failed
  // This ensures graceful degradation - if one query fails, others still work
  return {
    jobs: (jobsRes.data as Job[]) || [],
    applications: (applicationsRes.data as any[]) || [],
    applicationVotes: (applicationVotesRes.data as any[]) || [],
    comments: (commentsRes.data as any[]) || [],
    submissions: (submissionsRes.data as any[]) || [],
    disputes: (disputesRes.data as any[]) || [],
    assets: (assetsRes.data as PendingAsset[]) || [],
    assetVotes: (assetVotesRes.data as any[]) || [],
    tips: (tipsRes.data as ChatTip[]) || [],
    karmaMilestones: (karmaRes.data as WalletKarma[]) || []
  }
}

/**
 * Fetch paginated feed data (for "Load more" functionality)
 * 
 * Similar to fetchInitialFeed but uses a timestamp cursor for pagination.
 * Fetches activities older than the provided timestamp.
 * 
 * @param projectId - UUID of the project
 * @param beforeTimestamp - ISO timestamp to fetch activities before
 * @param limit - Number of items to fetch per table
 * @returns Promise resolving to RawActivityData
 * 
 * @example
 * ```typescript
 * const olderData = await fetchPaginatedFeed(
 *   'project-uuid-123',
 *   '2024-11-26T10:00:00Z',
 *   20
 * )
 * ```
 */
export async function fetchPaginatedFeed(
  projectId: string,
  beforeTimestamp: string,
  limit: number = 20
): Promise<RawActivityData> {
  // Execute all queries in parallel with timestamp filter
  const [
    jobsRes,
    applicationsRes,
    applicationVotesRes,
    commentsRes,
    submissionsRes,
    disputesRes,
    assetsRes,
    assetVotesRes,
    tipsRes,
    karmaRes
  ] = await Promise.all([
    // Jobs posted before timestamp
    supabase
      .from('jobs')
      .select('id, poster_wallet, title, category, status, created_at, completed_at, assigned_to')
      .eq('project_id', projectId)
      .lt('created_at', beforeTimestamp)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching paginated jobs:', res.error)
        return res
      }),

    // Applications before timestamp
    supabase
      .from('job_applications')
      .select(`
        id,
        applicant_wallet,
        created_at,
        job:jobs!inner(id, title, project_id)
      `)
      .eq('jobs.project_id', projectId)
      .lt('created_at', beforeTimestamp)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching paginated applications:', res.error)
        return res
      }),

    // Application votes before timestamp
    supabase
      .from('job_application_votes')
      .select(`
        id,
        voter_wallet,
        vote_weight,
        created_at,
        application:job_applications!inner(
          id,
          applicant_wallet,
          job:jobs!inner(id, title, project_id)
        )
      `)
      .eq('application.jobs.project_id', projectId)
      .lt('created_at', beforeTimestamp)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching paginated application votes:', res.error)
        return res
      }),

    // Comments before timestamp
    supabase
      .from('job_comments')
      .select(`
        id,
        wallet_address,
        message,
        created_at,
        job:jobs!inner(id, title, project_id)
      `)
      .eq('jobs.project_id', projectId)
      .lt('created_at', beforeTimestamp)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching paginated comments:', res.error)
        return res
      }),

    // Submissions before timestamp
    supabase
      .from('job_submissions')
      .select(`
        id,
        worker_wallet,
        submitted_at,
        job:jobs!inner(id, title, status, project_id)
      `)
      .eq('jobs.project_id', projectId)
      .lt('submitted_at', beforeTimestamp)
      .order('submitted_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching paginated submissions:', res.error)
        return res
      }),

    // Disputes before timestamp
    supabase
      .from('job_disputes')
      .select(`
        id,
        opened_by,
        created_at,
        job:jobs!inner(id, title, poster_wallet, assigned_to, project_id)
      `)
      .eq('jobs.project_id', projectId)
      .eq('status', 'active')
      .lt('created_at', beforeTimestamp)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching paginated disputes:', res.error)
        return res
      }),

    // Assets before timestamp
    supabase
      .from('pending_assets')
      .select('id, submitter_wallet, asset_type, asset_data, verification_status, created_at, verified_at, hidden_at')
      .eq('project_id', projectId)
      .lt('created_at', beforeTimestamp)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching paginated assets:', res.error)
        return res
      }),

    // Asset votes before timestamp
    supabase
      .from('asset_votes')
      .select(`
        id,
        voter_wallet,
        vote_type,
        token_percentage_snapshot,
        created_at,
        asset:pending_assets!inner(id, asset_type, asset_data, project_id)
      `)
      .eq('pending_assets.project_id', projectId)
      .eq('vote_type', 'upvote')
      .lt('created_at', beforeTimestamp)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching paginated asset votes:', res.error)
        return res
      }),

    // Tips before timestamp
    supabase
      .from('chat_tips')
      .select('id, from_wallet, to_wallet, amount_tokens, token_symbol, message, created_at')
      .eq('project_id', projectId)
      .eq('is_public', true)
      .lt('created_at', beforeTimestamp)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching paginated tips:', res.error)
        return res
      }),

    // Karma updates before timestamp
    supabase
      .from('wallet_karma')
      .select('wallet_address, total_karma_points, updated_at')
      .eq('project_id', projectId)
      .gte('total_karma_points', 1000)
      .lt('updated_at', beforeTimestamp)
      .order('updated_at', { ascending: false })
      .limit(limit)
      .then(res => {
        if (res.error) console.error('Error fetching paginated karma:', res.error)
        return res
      })
  ])

  return {
    jobs: (jobsRes.data as Job[]) || [],
    applications: (applicationsRes.data as any[]) || [],
    applicationVotes: (applicationVotesRes.data as any[]) || [],
    comments: (commentsRes.data as any[]) || [],
    submissions: (submissionsRes.data as any[]) || [],
    disputes: (disputesRes.data as any[]) || [],
    assets: (assetsRes.data as PendingAsset[]) || [],
    assetVotes: (assetVotesRes.data as any[]) || [],
    tips: (tipsRes.data as ChatTip[]) || [],
    karmaMilestones: (karmaRes.data as WalletKarma[]) || []
  }
}

