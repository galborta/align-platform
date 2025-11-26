import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/karma/daily-tip-status
 * 
 * Fetches a user's daily tip karma status
 * 
 * Query params:
 * - wallet (required): User's wallet address
 * - projectId (required): Project ID
 * 
 * Returns:
 * - success: boolean
 * - dailyKarma: number (karma earned today from tipping, 0-5000)
 * - dailyCap: number (always 5000)
 * - remaining: number (cap - dailyKarma)
 * - resetDate: string (YYYY-MM-DD format)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get('wallet')
    const projectId = searchParams.get('projectId')

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      )
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID required' },
        { status: 400 }
      )
    }

    // Daily karma cap
    const DAILY_CAP = 5000

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0]

    // Fetch wallet karma record
    const { data: walletKarma, error: fetchError } = await supabase
      .from('wallet_karma')
      .select('tip_karma_earned_today, tip_karma_last_reset_date')
      .eq('wallet_address', wallet)
      .eq('project_id', projectId)
      .single()

    if (fetchError) {
      // If no record exists yet, return default values
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          dailyKarma: 0,
          dailyCap: DAILY_CAP,
          remaining: DAILY_CAP,
          resetDate: today
        })
      }

      console.error('Error fetching wallet karma:', fetchError)
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to fetch karma status',
          dailyKarma: 0,
          dailyCap: DAILY_CAP,
          remaining: DAILY_CAP,
          resetDate: today
        },
        { status: 500 }
      )
    }

    // Check if karma needs to be reset (new day)
    let dailyKarma = walletKarma.tip_karma_earned_today
    const lastResetDate = walletKarma.tip_karma_last_reset_date

    if (lastResetDate < today) {
      // It's a new day, karma should be reset
      // Note: The actual reset happens in the database function when awarding karma
      // For display purposes, we show 0 if it's a new day
      dailyKarma = 0
    }

    // Calculate remaining karma
    const remaining = Math.max(0, DAILY_CAP - dailyKarma)

    return NextResponse.json({
      success: true,
      dailyKarma,
      dailyCap: DAILY_CAP,
      remaining,
      resetDate: today
    })

  } catch (error: any) {
    console.error('Error in daily-tip-status endpoint:', error)
    
    const today = new Date().toISOString().split('T')[0]
    
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Internal server error',
        dailyKarma: 0,
        dailyCap: 5000,
        remaining: 5000,
        resetDate: today
      },
      { status: 500 }
    )
  }
}


