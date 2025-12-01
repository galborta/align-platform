import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/leaderboard
 * 
 * Fetches karma leaderboard rankings
 * 
 * Query params:
 * - limit (optional): Number of users to return (default: 10, max: 100)
 * - period (optional): Time period filter ('day', 'week', 'month', 'all' - default: 'all')
 * - projectId (optional): Filter by specific project (null for global leaderboard)
 * 
 * Returns:
 * - Array of LeaderboardEntry objects sorted by karma (highest first)
 * 
 * Response is cached for 60 seconds with 5-minute stale-while-revalidate
 */

interface LeaderboardEntry {
  id: string
  wallet_address: string
  username: string | null
  avatar_url: string | null
  total_karma: number
  completed_jobs: number
  tips_sent_count: number
  tips_received_count: number
  last_active_at: string | null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const limitParam = searchParams.get('limit')
    const period = searchParams.get('period') || 'all'
    const projectId = searchParams.get('projectId')
    
    // Validate and constrain limit
    let limit = 10 // default
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10)
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return NextResponse.json(
          { error: 'Invalid limit parameter. Must be a positive integer.' },
          { status: 400 }
        )
      }
      // Cap at 100 to prevent abuse
      limit = Math.min(parsedLimit, 100)
    }

    // Validate period parameter
    const validPeriods = ['day', 'week', 'month', 'all']
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { error: `Invalid period parameter. Must be one of: ${validPeriods.join(', ')}` },
        { status: 400 }
      )
    }

    // Build query based on whether we want global or project-specific leaderboard
    let query = supabase
      .from(projectId ? 'karma_leaderboard' : 'global_karma_leaderboard')
      .select('*')

    // Apply project filter if specified
    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    // Apply time period filter based on last_active_at
    if (period !== 'all') {
      const now = new Date()
      let cutoffDate: Date

      switch (period) {
        case 'day':
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case 'week':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          cutoffDate = new Date(0) // Beginning of time
      }

      const cutoffISO = cutoffDate.toISOString()
      query = query.gte('last_active_at', cutoffISO)
    }

    // Execute query with limit and ordering
    const { data: leaderboard, error } = await query
      .order('total_karma', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Leaderboard fetch error:', error)
      
      // Return empty array instead of error for better UX
      // Log the error but don't expose internal details
      return NextResponse.json([], {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      })
    }

    // Return successful response with cache headers
    return NextResponse.json(leaderboard || [], {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })

  } catch (error: any) {
    console.error('Error in leaderboard endpoint:', error)
    
    // Return empty array on unexpected errors
    // This prevents breaking the UI if something goes wrong
    return NextResponse.json([], {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
  }
}


