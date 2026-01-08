import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// Use service role for elevated permissions
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Winner {
  submissionId: string
  position: number
  prizeAmountTokens: number
  prizeAmountUsd: number
}

interface SelectWinnersRequest {
  winners: Winner[]
}

/**
 * POST /api/jobs/[jobId]/select-winners
 * 
 * Selects winners for a contest job. Updates job_submissions with winner info
 * and sets the contest_winners_selected_at timestamp on the job.
 * 
 * Security:
 * - CRITICAL: Requires Supabase JWT authentication
 * - Only the authenticated job poster can select winners
 * 
 * Uses service role to bypass RLS for database operations.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    // Parse winners selection data
    const body = await request.json()
    const { winners } = body

    // ==================== VALIDATION ====================

    if (!winners || !Array.isArray(winners) || winners.length === 0) {
      return NextResponse.json(
        { error: 'At least one winner is required' },
        { status: 400 }
      )
    }

    // ==================== AUTHENTICATION ====================

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Select Winners] Missing authorization header')
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Verify JWT token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('[Select Winners] Invalid auth token:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    console.log(`[Select Winners] Authenticated user: ${user.id}`)

    // Get user's wallet from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.wallet_address) {
      console.error('[Select Winners] No wallet found for user:', profileError)
      return NextResponse.json(
        { error: 'No wallet address linked to account' },
        { status: 403 }
      )
    }

    const authenticatedWallet = profile.wallet_address
    console.log(`[Select Winners] User wallet: ${authenticatedWallet}`)

    // ==================== FETCH AND VALIDATE JOB ====================

    console.log(`[Select Winners] Job: ${jobId}, Winners: ${winners.length}`)

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('[Select Winners] Job not found:', jobError)
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // ==================== AUTHORIZATION ====================

    // Verify user is the job poster
    if (authenticatedWallet !== job.poster_wallet) {
      console.error('[Select Winners] Unauthorized - not job poster')
      return NextResponse.json(
        { error: 'Only job poster can select contest winners' },
        { status: 403 }
      )
    }

    console.log('[Select Winners] ✅ Poster authorization verified')

    // Verify job is a contest
    if (!job.is_contest) {
      return NextResponse.json(
        { error: 'Winner selection only available for contest jobs' },
        { status: 400 }
      )
    }

    if (job.contest_winners_selected_at) {
      return NextResponse.json(
        { error: 'Winners have already been selected for this contest' },
        { status: 400 }
      )
    }

    // ==================== UPDATE WINNER SUBMISSIONS ====================

    console.log('[Select Winners] Updating winner submissions...')

    for (const winner of winners) {
      const { error: updateError } = await supabaseAdmin
        .from('job_submissions')
        .update({
          is_selected_winner: true,
          winner_position: winner.position,
          prize_amount_tokens: winner.prizeAmountTokens,
          prize_amount_usd: winner.prizeAmountUsd
        })
        .eq('id', winner.submissionId)
        .eq('job_id', jobId) // Extra safety check

      if (updateError) {
        console.error(`[Select Winners] Failed to update submission ${winner.submissionId}:`, updateError)
        return NextResponse.json(
          { error: `Failed to update winner submission: ${updateError.message}` },
          { status: 500 }
        )
      }

      console.log(`[Select Winners] ✅ Updated submission ${winner.submissionId} as position ${winner.position}`)
    }

    // ==================== CLEAR NON-WINNERS ====================

    const winnerIds = winners.map(w => w.submissionId)
    
    const { error: clearError } = await supabaseAdmin
      .from('job_submissions')
      .update({
        is_selected_winner: false,
        winner_position: null,
        prize_amount_tokens: null,
        prize_amount_usd: null
      })
      .eq('job_id', jobId)
      .not('id', 'in', `(${winnerIds.join(',')})`)

    if (clearError) {
      console.error('[Select Winners] Failed to clear non-winners:', clearError)
      // Non-critical, continue
    }

    // ==================== UPDATE JOB ====================

    const { error: jobUpdateError } = await supabaseAdmin
      .from('jobs')
      .update({
        contest_winners_selected_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (jobUpdateError) {
      console.error('[Select Winners] Failed to update job:', jobUpdateError)
      return NextResponse.json(
        { error: 'Failed to update job with winners selected timestamp' },
        { status: 500 }
      )
    }

    console.log(`[Select Winners] ✅ Contest winners selected successfully`)

    return NextResponse.json({
      success: true,
      message: `Selected ${winners.length} winner(s) for contest`,
      winnersCount: winners.length
    })

  } catch (error: any) {
    console.error('[Select Winners] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}




