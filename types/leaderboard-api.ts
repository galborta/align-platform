/**
 * Type definitions for Karma Leaderboard API
 */

/**
 * Single entry in the leaderboard
 */
export interface LeaderboardEntry {
  /** Unique identifier for the karma record */
  id: string
  
  /** User's Solana wallet address */
  wallet_address: string
  
  /** Display name (e.g., 'alice.sol') - null if not set */
  username: string | null
  
  /** Profile image URL - null if not set */
  avatar_url: string | null
  
  /** Total karma points earned (integer) */
  total_karma: number
  
  /** Number of completed activities */
  completed_jobs: number
  
  /** Number of tips sent by this user */
  tips_sent_count: number
  
  /** Number of tips received by this user */
  tips_received_count: number
  
  /** Last activity timestamp (ISO string) */
  last_active_at: string | null
}

/**
 * Response from /api/leaderboard endpoint
 */
export type LeaderboardResponse = LeaderboardEntry[]

/**
 * Query parameters for /api/leaderboard endpoint
 */
export interface LeaderboardQueryParams {
  /** Number of users to return (default: 10, max: 100) */
  limit?: number
  
  /** Time period filter */
  period?: 'day' | 'week' | 'month' | 'all'
  
  /** Project ID for project-specific leaderboard (null = global) */
  projectId?: string | null
}

/**
 * User's rank and stats
 */
export interface UserRankResponse {
  /** User's position in leaderboard (1 = top) */
  rank: number
  
  /** Total karma points */
  total_karma: number
  
  /** Display name - null if not set */
  username: string | null
  
  /** Profile image URL - null if not set */
  avatar_url: string | null
  
  /** Number of completed activities */
  completed_jobs: number
  
  /** Number of tips sent */
  tips_sent_count: number
  
  /** Number of tips received */
  tips_received_count: number
  
  /** Last activity timestamp (ISO string) */
  last_active_at: string | null
  
  /** Total number of users in leaderboard */
  total_users: number
  
  /** Percentile ranking (0-100, where 100 = top 1%) */
  percentile: number
}

/**
 * Query parameters for /api/leaderboard/user-rank endpoint
 */
export interface UserRankQueryParams {
  /** User's wallet address (required) */
  wallet: string
  
  /** Project ID for project-specific rank (null = global) */
  projectId?: string | null
}

/**
 * Error response from leaderboard endpoints
 */
export interface LeaderboardErrorResponse {
  error: string
}

/**
 * Helper function to build leaderboard API URL
 */
export function buildLeaderboardUrl(params: LeaderboardQueryParams = {}): string {
  const searchParams = new URLSearchParams()
  
  if (params.limit !== undefined) {
    searchParams.set('limit', params.limit.toString())
  }
  
  if (params.period) {
    searchParams.set('period', params.period)
  }
  
  if (params.projectId) {
    searchParams.set('projectId', params.projectId)
  }
  
  const queryString = searchParams.toString()
  return `/api/leaderboard${queryString ? `?${queryString}` : ''}`
}

/**
 * Helper function to build user rank API URL
 */
export function buildUserRankUrl(params: UserRankQueryParams): string {
  const searchParams = new URLSearchParams()
  searchParams.set('wallet', params.wallet)
  
  if (params.projectId) {
    searchParams.set('projectId', params.projectId)
  }
  
  return `/api/leaderboard/user-rank?${searchParams.toString()}`
}

/**
 * Fetch leaderboard data
 */
export async function fetchLeaderboard(
  params: LeaderboardQueryParams = {}
): Promise<LeaderboardResponse> {
  const url = buildLeaderboardUrl(params)
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Fetch user rank data
 */
export async function fetchUserRank(
  params: UserRankQueryParams
): Promise<UserRankResponse> {
  const url = buildUserRankUrl(params)
  const response = await fetch(url)
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('User not found in leaderboard')
    }
    throw new Error(`Failed to fetch user rank: ${response.statusText}`)
  }
  
  return response.json()
}


