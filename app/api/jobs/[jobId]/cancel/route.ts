import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applyJobCancellationPenalty } from '@/lib/job-karma'
import { Database } from '@/types/database'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/jobs/[jobId]/cancel
 * 
 * Cancel a job (after refund has been processed)
 * 
 * Security:
 * - CRITICAL: Requires Supabase JWT authentication
 * - Only the authenticated job poster can cancel
 * 
 * Returns:
 * - 200: { success: true }
 * - 401: { error: string } - Unauthorized (missing/invalid token)
 * - 403: { error: string } - Forbidden (not the poster)
 * - 500: { error: string } - Internal server error
 * 
 * Process:
 * 1. Authenticates user via Supabase JWT
 * 2. Validates authenticated wallet matches job poster
 * 3. Checks cancellation limit (max 10 per week)
 * 4. Updates job status to 'cancelled'
 * 5. Unlocks escrow
 * 6. Invalidates all applications
 * 7. Applies karma penalty
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID required' },
        { status: 400 }
      )
    }

    // ==================== AUTHENTICATION ====================

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Cancel Job] Missing authorization header')
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('[Cancel Job] Invalid auth token:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    console.log(`[Cancel Job] Authenticated user: ${user.id}`)

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.wallet_address) {
      console.error('[Cancel Job] No wallet found for user:', profileError)
      return NextResponse.json(
        { error: 'No wallet address linked to account' },
        { status: 403 }
      )
    }

    const authenticatedWallet = profile.wallet_address
    console.log(`[Cancel Job] User wallet: ${authenticatedWallet}`)

    // ==================== FETCH AND VALIDATE JOB ====================

    console.log(`[Cancel Job API] Cancelling job ${jobId}`)

    // Fetch job details
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('[Cancel Job API] Job fetch error:', jobError)
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // ==================== AUTHORIZATION ====================

    // Verify user is the job poster
    if (authenticatedWallet !== job.poster_wallet) {
      console.warn(`[Cancel Job API] Unauthorized cancel attempt`)
      return NextResponse.json(
        { error: 'Only the job poster can cancel this job' },
        { status: 403 }
      )
    }

    console.log('[Cancel Job] ✅ Authorization verified')

    // Check cancellation limit (max 10 per week)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { count: cancellationCount, error: countError } = await supabaseAdmin
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('poster_wallet', authenticatedWallet)
      .eq('status', 'cancelled')
      .gte('cancelled_at', sevenDaysAgo.toISOString())

    if (countError) {
      console.error('[Cancel Job API] Count error:', countError)
      throw countError
    }

    if (cancellationCount && cancellationCount >= 10) {
      console.warn(`[Cancel Job API] Cancellation limit reached for ${authenticatedWallet}`)
      return NextResponse.json(
        { error: "You've cancelled 10 jobs this week. Try again next week." },
        { status: 400 }
      )
    }

    console.log(`[Cancel Job API] Cancellation count: ${cancellationCount}/10`)

    // Update job status to cancelled
    console.log('[Cancel Job API] Updating job status to cancelled...')
    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        escrow_locked: false, // Unlock escrow
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (updateError) {
      console.error('[Cancel Job API] Update error:', updateError)
      throw updateError
    }

    console.log('[Cancel Job API] ✅ Job status updated to cancelled')

    // Invalidate all applications
    console.log('[Cancel Job API] Invalidating all job applications...')
    const { error: invalidateError } = await supabaseAdmin
      .from('job_applications')
      .update({
        is_invalidated: true,
        updated_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .eq('is_invalidated', false)

    if (invalidateError) {
      console.error('[Cancel Job API] Invalidate error:', invalidateError)
      throw invalidateError
    }

    console.log('[Cancel Job API] ✅ Applications invalidated')

    // Apply karma penalty
    try {
      console.log('[Cancel Job API] Applying karma penalty...')
      await applyJobCancellationPenalty(
        authenticatedWallet,
        job.project_id
      )
      console.log('[Cancel Job API] ✅ Karma penalty applied (-50 points)')
    } catch (karmaError) {
      console.error('[Cancel Job API] Karma penalty failed:', karmaError)
      // Continue - karma failure shouldn't block cancellation
    }

    // TODO: Send notifications to applicants

    console.log(`[Cancel Job API] ✅ Job ${jobId} cancelled successfully`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[Cancel Job API] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

