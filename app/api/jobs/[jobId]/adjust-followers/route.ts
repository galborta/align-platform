import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/jobs/[jobId]/adjust-followers
 * 
 * Allows posters to adjust the verified follower count for a submission.
 * This affects payment calculations as payments are proportional to follower counts.
 * 
 * Security:
 * - CRITICAL: Requires Supabase JWT authentication
 * - Only the authenticated job poster can adjust follower counts
 * 
 * Request body:
 * - submission_id: string (required)
 * - verified_follower_count: number (required)
 * - adjustment_reason: string (optional)
 * 
 * Validations:
 * - Job must be a social media job
 * - Payments must not already be distributed
 * - Submission must exist and belong to the job
 * - Follower count must be non-negative
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    const body = await request.json()
    const { submission_id, verified_follower_count, adjustment_reason, poster_wallet } = body

    // === VALIDATION ===

    if (!submission_id || verified_follower_count === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: submission_id and verified_follower_count' },
        { status: 400 }
      )
    }

    if (verified_follower_count < 0) {
      return NextResponse.json(
        { error: 'Follower count cannot be negative' },
        { status: 400 }
      )
    }

    // === AUTHENTICATION ===

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Adjust Followers] Missing authorization header')
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Verify JWT token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('[Adjust Followers] Invalid auth token:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    console.log(`[Adjust Followers] Authenticated user: ${user.id}`)

    // Use wallet address from request body (provided by frontend)
    if (!poster_wallet) {
      console.error('[Adjust Followers] Missing poster_wallet in request')
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      )
    }

    console.log(`[Adjust Followers] User wallet: ${poster_wallet}`)

    // === GET JOB DETAILS ===

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('is_social_media_job', true)
      .single()

    if (jobError || !job) {
      console.error('[Adjust Followers] Job fetch error:', jobError)
      return NextResponse.json(
        { error: 'Social media job not found' },
        { status: 404 }
      )
    }

    // === AUTHORIZATION ===

    // Verify user is the job poster
    if (poster_wallet !== job.poster_wallet) {
      console.error('[Adjust Followers] Unauthorized - not job poster')
      return NextResponse.json(
        { error: 'Only job poster can adjust follower counts' },
        { status: 403 }
      )
    }

    console.log('[Adjust Followers] ✅ Poster authorization verified')

    // Check if payments already distributed
    if (job.social_payments_distributed) {
      return NextResponse.json(
        { error: 'Cannot adjust followers after payments have been distributed' },
        { status: 400 }
      )
    }

    // === GET SUBMISSION ===

    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('job_submissions')
      .select('*')
      .eq('id', submission_id)
      .eq('job_id', jobId)
      .single()

    if (submissionError || !submission) {
      console.error('[Adjust Followers] Submission fetch error:', submissionError)
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      )
    }

    // === UPDATE VERIFIED FOLLOWER COUNT ===

    const { error: updateError } = await supabaseAdmin
      .from('job_submissions')
      .update({
        social_follower_count_verified: verified_follower_count
      })
      .eq('id', submission_id)

    if (updateError) {
      console.error('Update error:', updateError)
      throw new Error('Failed to update follower count')
    }

    // Log the adjustment for audit purposes
    console.log(`[Adjust Followers] Submission ${submission_id}:`, {
      job_id: jobId,
      worker_wallet: submission.worker_wallet,
      original_reported: submission.social_follower_count,
      previous_verified: submission.social_follower_count_verified,
      new_verified: verified_follower_count,
      reason: adjustment_reason || 'No reason provided',
      timestamp: new Date().toISOString()
    })

    // === SUCCESS RESPONSE ===

    return NextResponse.json({
      success: true,
      submission_id,
      previous_count: submission.social_follower_count_verified,
      verified_follower_count
    })

  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

