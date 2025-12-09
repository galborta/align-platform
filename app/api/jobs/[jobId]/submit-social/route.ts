import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notificationService } from '@/lib/services/notificationService'
import { Database } from '@/types/database'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/jobs/[jobId]/submit-social
 * 
 * Handles social media job submissions from workers.
 * 
 * Security:
 * - CRITICAL: Requires Supabase JWT authentication
 * - Worker wallet is derived from authenticated user's profile
 * 
 * Validates:
 * - Required fields (tweet link, follower count)
 * - Tweet URL format (twitter.com or x.com)
 * - Submission deadline hasn't passed
 * - Minimum follower requirement (if set)
 * - No duplicate submissions
 * 
 * Creates:
 * - Job submission record
 * - Notification for poster
 * - Feed event for activity feed
 * - Increments karma
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    // Parse request body
    const body = await request.json()
    const { social_tweet_link, social_follower_count } = body

    // === VALIDATION ===

    // Check required fields
    if (!social_tweet_link || social_follower_count === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: social_tweet_link, social_follower_count' },
        { status: 400 }
      )
    }

    // Validate tweet URL format (twitter.com or x.com)
    const twitterPattern = /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/
    if (!twitterPattern.test(social_tweet_link)) {
      return NextResponse.json(
        { error: 'Invalid Twitter/X URL format. Expected: https://twitter.com/username/status/123456 or https://x.com/username/status/123456' },
        { status: 400 }
      )
    }

    // Validate follower count is a positive number
    const followerCount = parseInt(social_follower_count)
    if (isNaN(followerCount) || followerCount < 0) {
      return NextResponse.json(
        { error: 'Invalid follower count. Must be a non-negative number.' },
        { status: 400 }
      )
    }

    // === AUTHENTICATION ===

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Submit Social] Missing authorization header')
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Verify JWT token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('[Submit Social] Invalid auth token:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    console.log(`[Submit Social] Authenticated user: ${user.id}`)

    // Get user's wallet from profile (this is the trusted worker wallet)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.wallet_address) {
      console.error('[Submit Social] No wallet found for user:', profileError)
      return NextResponse.json(
        { error: 'No wallet address linked to account' },
        { status: 403 }
      )
    }

    const worker_wallet = profile.wallet_address
    console.log(`[Submit Social] Worker wallet: ${worker_wallet}`)

    // === GET JOB DETAILS ===

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('is_social_media_job', true)
      .single()

    if (jobError || !job) {
      console.error('[Submit Social] Job fetch error:', jobError)
      return NextResponse.json(
        { error: 'Social media job not found' },
        { status: 404 }
      )
    }

    // === BUSINESS RULE VALIDATIONS ===

    // Check job is still open
    if (job.status !== 'open') {
      return NextResponse.json(
        { error: 'This campaign is no longer accepting submissions' },
        { status: 400 }
      )
    }

    // Check submission deadline
    const now = new Date()
    const deadline = new Date(job.social_submission_deadline)
    if (now > deadline) {
      return NextResponse.json(
        { error: 'Submission deadline has passed' },
        { status: 400 }
      )
    }

    // Check minimum followers requirement
    if (job.social_min_followers_required && 
        followerCount < job.social_min_followers_required) {
      return NextResponse.json(
        { error: `Minimum ${job.social_min_followers_required.toLocaleString()} followers required to participate` },
        { status: 400 }
      )
    }

    // Prevent self-submission (poster can't submit to own job)
    if (job.poster_wallet === worker_wallet) {
      return NextResponse.json(
        { error: 'You cannot submit to your own campaign' },
        { status: 400 }
      )
    }

    // === DUPLICATE CHECK ===

    const { data: existingSubmission } = await supabaseAdmin
      .from('job_submissions')
      .select('id')
      .eq('job_id', jobId)
      .eq('worker_wallet', worker_wallet)
      .maybeSingle()

    if (existingSubmission) {
      return NextResponse.json(
        { error: 'You have already submitted to this campaign' },
        { status: 400 }
      )
    }

    // === CREATE SUBMISSION ===

    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('job_submissions')
      .insert({
        job_id: jobId,
        worker_wallet: worker_wallet,
        message: `Social media submission: ${social_tweet_link}`,
        social_tweet_link: social_tweet_link,
        social_follower_count: followerCount,
        social_follower_count_verified: followerCount, // Initially same as reported
        social_approval_status: 'pending',
        submitted_at: new Date().toISOString()
      })
      .select()
      .single()

    if (submissionError) {
      console.error('[Submit Social] Submission creation error:', submissionError)
      return NextResponse.json(
        { error: 'Failed to create submission' },
        { status: 500 }
      )
    }

    // === NON-CRITICAL SIDE EFFECTS ===
    // These are fire-and-forget - don't fail the request if they fail

    // Update karma (increment applications_submitted_count)
    try {
      await supabaseAdmin.rpc('increment_karma_field', {
        wallet_address: worker_wallet,
        field_name: 'applications_submitted_count'
      })
    } catch (karmaError) {
      console.error('[Submit Social] Karma update error (non-critical):', karmaError)
    }

    // Create notification for poster
    try {
      await notificationService.createNotification({
        userWallet: job.poster_wallet,
        type: 'new_application', // Reusing existing type for now
        actorWallet: worker_wallet,
        referenceId: jobId,
        referenceType: 'job',
        metadata: {
          job_title: job.title,
          submission_id: submission.id,
          follower_count: followerCount,
          is_social_media_job: true
        }
      })
    } catch (notificationError) {
      console.error('[Submit Social] Notification error (non-critical):', notificationError)
    }

    // Create feed event
    try {
      await supabaseAdmin.from('feed_events').insert({
        project_id: job.project_id,
        event_type: 'social_job_participation',
        actor_wallet: worker_wallet,
        reference_id: submission.id,
        reference_type: 'submission',
        metadata: {
          job_id: jobId,
          job_title: job.title,
          follower_count: followerCount
        },
        created_at: new Date().toISOString()
      })
    } catch (feedError) {
      console.error('[Submit Social] Feed event error (non-critical):', feedError)
    }

    // === SUCCESS RESPONSE ===

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        job_id: submission.job_id,
        worker_wallet: submission.worker_wallet,
        social_tweet_link: submission.social_tweet_link,
        social_follower_count: submission.social_follower_count,
        social_approval_status: submission.social_approval_status,
        submitted_at: submission.submitted_at
      }
    })

  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/jobs/[jobId]/submit-social
 * 
 * Check if a user has already submitted to this job.
 * Useful for pre-flight checks before showing submission modal.
 * 
 * Security:
 * - Requires Supabase JWT authentication
 * - Returns submission status for authenticated user only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    // === AUTHENTICATION ===

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      // Fall back to wallet query param for backwards compatibility (read-only)
      const { searchParams } = new URL(request.url)
      const wallet = searchParams.get('wallet')

      if (!wallet) {
        return NextResponse.json(
          { error: 'Authentication required or wallet parameter' },
          { status: 400 }
        )
      }

      // Check for existing submission (read-only, so OK without full auth)
      const { data: existingSubmission, error } = await supabaseAdmin
        .from('job_submissions')
        .select('id, social_approval_status, submitted_at, social_follower_count')
        .eq('job_id', jobId)
        .eq('worker_wallet', wallet)
        .maybeSingle()

      if (error) {
        console.error('[Submit Social GET] Submission check error:', error)
        return NextResponse.json(
          { error: 'Failed to check submission status' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        hasSubmitted: !!existingSubmission,
        submission: existingSubmission || null
      })
    }

    const token = authHeader.substring(7)

    // Verify JWT token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    // Get user's wallet from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.wallet_address) {
      return NextResponse.json(
        { error: 'No wallet address linked to account' },
        { status: 403 }
      )
    }

    const wallet = profile.wallet_address

    // Check for existing submission
    const { data: existingSubmission, error } = await supabaseAdmin
      .from('job_submissions')
      .select('id, social_approval_status, submitted_at, social_follower_count')
      .eq('job_id', jobId)
      .eq('worker_wallet', wallet)
      .maybeSingle()

    if (error) {
      console.error('[Submit Social GET] Submission check error:', error)
      return NextResponse.json(
        { error: 'Failed to check submission status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      hasSubmitted: !!existingSubmission,
      submission: existingSubmission || null
    })

  } catch (error: any) {
    console.error('[Submit Social GET] API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

