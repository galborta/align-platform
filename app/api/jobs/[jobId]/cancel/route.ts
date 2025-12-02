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
 * Request body:
 * - poster_wallet: string (required) - Wallet address of the job poster
 * 
 * Returns:
 * - 200: { success: true }
 * - 400: { error: string } - Invalid request
 * - 403: { error: string } - Unauthorized
 * - 500: { error: string } - Internal server error
 * 
 * Process:
 * 1. Validates poster_wallet matches job poster
 * 2. Checks cancellation limit (max 10 per week)
 * 3. Updates job status to 'cancelled'
 * 4. Unlocks escrow
 * 5. Invalidates all applications
 * 6. Applies karma penalty
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { jobId } = await params
    const { poster_wallet } = await request.json()

    // Validate required fields
    if (!poster_wallet) {
      return NextResponse.json(
        { error: 'Poster wallet required' },
        { status: 400 }
      )
    }

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID required' },
        { status: 400 }
      )
    }

    console.log(`[Cancel Job API] Cancelling job ${jobId}`)
    console.log(`[Cancel Job API] Requested by: ${poster_wallet}`)

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

    // Verify poster
    if (job.poster_wallet !== poster_wallet) {
      console.warn(`[Cancel Job API] Unauthorized cancel attempt by ${poster_wallet}`)
      return NextResponse.json(
        { error: 'Only the job poster can cancel this job' },
        { status: 403 }
      )
    }

    // Check cancellation limit (max 10 per week)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { count: cancellationCount, error: countError } = await supabaseAdmin
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('poster_wallet', poster_wallet)
      .eq('status', 'cancelled')
      .gte('cancelled_at', sevenDaysAgo.toISOString())

    if (countError) {
      console.error('[Cancel Job API] Count error:', countError)
      throw countError
    }

    if (cancellationCount && cancellationCount >= 10) {
      console.warn(`[Cancel Job API] Cancellation limit reached for ${poster_wallet}`)
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
        poster_wallet,
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

