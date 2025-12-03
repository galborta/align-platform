import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { notificationService } from '@/lib/services/notificationService'

/**
 * POST /api/jobs/[id]/submit-social
 * 
 * Handles social media job submissions from workers.
 * 
 * Validates:
 * - Required fields (wallet, tweet link, follower count)
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
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id

    // Parse request body
    const body = await request.json()
    const { worker_wallet, social_tweet_link, social_follower_count } = body

    // === VALIDATION ===

    // Check required fields
    if (!worker_wallet || !social_tweet_link || social_follower_count === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: worker_wallet, social_tweet_link, social_follower_count' },
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

    // === GET JOB DETAILS ===

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('is_social_media_job', true)
      .single()

    if (jobError || !job) {
      console.error('Job fetch error:', jobError)
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

    const { data: existingSubmission } = await supabase
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

    const { data: submission, error: submissionError } = await supabase
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
      console.error('Submission creation error:', submissionError)
      return NextResponse.json(
        { error: 'Failed to create submission' },
        { status: 500 }
      )
    }

    // === NON-CRITICAL SIDE EFFECTS ===
    // These are fire-and-forget - don't fail the request if they fail

    // Update karma (increment applications_submitted_count)
    try {
      await supabase.rpc('increment_karma_field', {
        wallet_address: worker_wallet,
        field_name: 'applications_submitted_count'
      })
    } catch (karmaError) {
      console.error('Karma update error (non-critical):', karmaError)
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
      console.error('Notification error (non-critical):', notificationError)
    }

    // Create feed event
    try {
      await supabase.from('feed_events').insert({
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
      console.error('Feed event error (non-critical):', feedError)
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
 * GET /api/jobs/[id]/submit-social
 * 
 * Check if a user has already submitted to this job.
 * Useful for pre-flight checks before showing submission modal.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get('wallet')

    if (!wallet) {
      return NextResponse.json(
        { error: 'Missing wallet parameter' },
        { status: 400 }
      )
    }

    // Check for existing submission
    const { data: existingSubmission, error } = await supabase
      .from('job_submissions')
      .select('id, social_approval_status, submitted_at, social_follower_count')
      .eq('job_id', jobId)
      .eq('worker_wallet', wallet)
      .maybeSingle()

    if (error) {
      console.error('Submission check error:', error)
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
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

