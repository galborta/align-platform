import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/leaderboard/user-rank
 * 
 * Fetches a specific user's rank and karma stats
 * 
 * Query params:
 * - wallet (required): User's wallet address
 * - projectId (optional): Project ID for project-specific rank (null for global)
 * 
 * Returns:
 * - rank: User's position in leaderboard (1-based)
 * - total_karma: User's total karma points
 * - username: Display name
 * - avatar_url: Profile image
 * - completed_jobs: Number of activities
 * - tips_sent_count: Tips sent
 * - tips_received_count: Tips received
 * - total_users: Total number of users in leaderboard
 * 
 * Response is cached for 30 seconds
 */

interface UserRankResponse {
  rank: number
  total_karma: number
  username: string | null
  avatar_url: string | null
  completed_jobs: number
  tips_sent_count: number
  tips_received_count: number
  last_active_at: string | null
  total_users: number
  percentile: number // 0-100, where 100 is top 1%
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get('wallet')
    const projectId = searchParams.get('projectId')

    // Validate required parameters
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    // Determine which view to query
    const viewName = projectId ? 'karma_leaderboard' : 'global_karma_leaderboard'

    // Fetch user's karma data
    let userQuery = supabase
      .from(viewName)
      .select('*')
      .eq('wallet_address', wallet)

    if (projectId) {
      userQuery = userQuery.eq('project_id', projectId)
    }

    const { data: userData, error: userError } = await userQuery.single()

    if (userError) {
      // User not found in leaderboard
      if (userError.code === 'PGRST116') {
        return NextResponse.json(
          { 
            error: 'User not found in leaderboard',
            rank: null,
            total_karma: 0,
            username: null,
            avatar_url: null,
            completed_jobs: 0,
            tips_sent_count: 0,
            tips_received_count: 0,
            last_active_at: null,
            total_users: 0,
            percentile: 0
          },
          { status: 404 }
        )
      }

      console.error('Error fetching user data:', userError)
      return NextResponse.json(
        { error: 'Failed to fetch user rank' },
        { status: 500 }
      )
    }

    // Calculate user's rank by counting users with higher karma
    let rankQuery = supabase
      .from(viewName)
      .select('*', { count: 'exact', head: true })
      .gt('total_karma', userData.total_karma)

    if (projectId) {
      rankQuery = rankQuery.eq('project_id', projectId)
    }

    const { count: higherRankedCount, error: rankError } = await rankQuery

    if (rankError) {
      console.error('Error calculating rank:', rankError)
      return NextResponse.json(
        { error: 'Failed to calculate rank' },
        { status: 500 }
      )
    }

    const rank = (higherRankedCount || 0) + 1

    // Get total user count
    let totalQuery = supabase
      .from(viewName)
      .select('*', { count: 'exact', head: true })

    if (projectId) {
      totalQuery = totalQuery.eq('project_id', projectId)
    }

    const { count: totalUsers, error: countError } = await totalQuery

    if (countError) {
      console.error('Error counting total users:', countError)
      return NextResponse.json(
        { error: 'Failed to count total users' },
        { status: 500 }
      )
    }

    // Calculate percentile (inverse - higher is better)
    // Top 1% = 100, bottom 1% = 0
    const percentile = totalUsers && totalUsers > 0 
      ? Math.round(((totalUsers - rank + 1) / totalUsers) * 100)
      : 0

    const response: UserRankResponse = {
      rank,
      total_karma: userData.total_karma,
      username: userData.username,
      avatar_url: userData.avatar_url,
      completed_jobs: userData.completed_jobs,
      tips_sent_count: userData.tips_sent_count,
      tips_received_count: userData.tips_received_count,
      last_active_at: userData.last_active_at,
      total_users: totalUsers || 0,
      percentile
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
      },
    })

  } catch (error: any) {
    console.error('Error in user-rank endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


