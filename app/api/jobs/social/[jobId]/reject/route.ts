import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifySubmissionDenied } from '@/lib/social-job-notifications'
import { Database } from '@/types/database'
import { rateLimit } from '@/lib/rate-limit'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/jobs/social/[jobId]/reject
 * 
 * Handles rejection of social media job submissions with dispute creation.
 * 
 * Security:
 * - Requires Supabase JWT authentication
 * - Only the job poster can reject submissions
 * - Creates automatic dispute for admin review
 * 
 * This endpoint:
 * 1. Authenticates the poster
 * 2. Validates submission is pending
 * 3. Updates submission status to 'rejected'
 * 4. Returns budget to available pool
 * 5. Creates dispute for admin review
 * 6. Sends notification to worker
 * 
 * Request body:
 * - submission_id: string (ID of submission to reject)
 * - reason: string (rejection reason)
 * - details: string (additional details)
 * 
 * @param request - Request with Authorization header
 * @param params - URL params containing jobId
 * @returns Success response with dispute details or error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const startTime = Date.now()

  try {
    // Await params in Next.js 15+
    const { jobId } = await params
    console.log(`[Rejection] Starting for job ${jobId}`)

    // ==================== AUTHENTICATION ====================

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Rejection] Missing authorization header')
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Verify JWT token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('[Rejection] Invalid auth token:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    console.log(`[Rejection] Authenticated user: ${user.id}`)

    // Get user's wallet from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.wallet_address) {
      console.error('[Rejection] No wallet found for user:', profileError)
      return NextResponse.json(
        { error: 'No wallet address linked to account' },
        { status: 403 }
      )
    }

    const posterWallet = profile.wallet_address
    console.log(`[Rejection] Poster wallet: ${posterWallet}`)

    // ==================== RATE LIMITING ====================

    const rateLimitResult = rateLimit(user.id, 'rejection')
    if (!rateLimitResult.success) {
      console.error('[Rejection] Rate limit exceeded for user:', user.id)
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: rateLimitResult.status }
      )
    }

    // ==================== REQUEST VALIDATION ====================

    const body = await request.json()
    const { submission_id, reason, details } = body

    if (!submission_id || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: submission_id and reason' },
        { status: 400 }
      )
    }

    console.log(`[Rejection] Rejecting submission ${submission_id} with reason: ${reason}`)

    // ==================== GET JOB DETAILS ====================

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('is_social_media_job', true)
      .single()

    if (jobError || !job) {
      console.error('[Rejection] Job not found:', jobError)
      return NextResponse.json(
        { error: 'Social media job not found' },
        { status: 404 }
      )
    }

    console.log(`[Rejection] Job found: ${job.title}`)

    // ==================== AUTHORIZATION ====================

    // Verify user is the job poster
    if (posterWallet !== job.poster_wallet) {
      console.error('[Rejection] Unauthorized - not job poster')
      return NextResponse.json(
        { error: 'Only the job poster can reject submissions' },
        { status: 403 }
      )
    }

    // ==================== GET SUBMISSION ====================

    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('job_submissions')
      .select('*')
      .eq('id', submission_id)
      .eq('job_id', jobId)
      .single()

    if (submissionError || !submission) {
      console.error('[Rejection] Submission not found:', submissionError)
      return NextResponse.json(
        { error: 'Submission not found or does not belong to this job' },
        { status: 404 }
      )
    }

    console.log(`[Rejection] Submission found for worker: ${submission.worker_wallet}`)

    // ==================== VALIDATE SUBMISSION STATUS ====================

    if (submission.social_approval_status !== 'pending') {
      return NextResponse.json(
        {
          error: 'Submission is not in pending status',
          current_status: submission.social_approval_status
        },
        { status: 400 }
      )
    }

    // ==================== UPDATE SUBMISSION STATUS ====================

    const denialReason = details ? `${reason}: ${details}` : reason
    
    const { error: updateError } = await supabaseAdmin
      .from('job_submissions')
      .update({
        social_approval_status: 'denied',
        social_denial_reason: denialReason,
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', submission_id)

    if (updateError) {
      console.error('[Rejection] Error updating submission:', updateError)
      return NextResponse.json(
        { error: 'Failed to update submission status' },
        { status: 500 }
      )
    }

    console.log('[Rejection] Submission status updated to denied')

    // ==================== UNRESERVE BUDGET ====================

    const paymentAmount = submission.social_payment_amount_usd || 0
    const newReservedBudget = (job.social_reserved_budget || 0) - paymentAmount
    const newRemainingBudget = (job.social_budget_remaining || 0) + paymentAmount

    const { error: budgetError } = await supabaseAdmin
      .from('jobs')
      .update({
        social_reserved_budget: Math.max(0, newReservedBudget),
        social_budget_remaining: newRemainingBudget,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (budgetError) {
      console.error('[Rejection] Error updating job budget:', budgetError)
      // Don't fail the request, but log the error
    } else {
      console.log(`[Rejection] Budget returned: $${paymentAmount} (new remaining: $${newRemainingBudget})`)
    }

    // ==================== CREATE DISPUTE ====================

    const { data: dispute, error: disputeError } = await supabaseAdmin
      .from('job_disputes')
      .insert({
        job_id: jobId,
        submission_id: submission_id,
        opened_by: posterWallet,
        dispute_type: 'social_rejection',
        reason: denialReason,
        status: 'pending_admin_review',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (disputeError) {
      console.error('[Rejection] Error creating dispute:', disputeError)
      // Continue anyway - rejection was successful, dispute is secondary
    } else {
      console.log(`[Rejection] Dispute created: ${dispute?.id}`)
    }

    // ==================== SEND NOTIFICATION ====================

    console.log('[Rejection] Sending notification to worker...')

    try {
      await notifySubmissionDenied(
        submission.worker_wallet,
        jobId,
        job.title || 'Social Media Campaign',
        denialReason
      )
      console.log('[Rejection] Notification sent successfully')
    } catch (notifError) {
      console.error('[Rejection] Notification error:', notifError)
      // Don't fail the request
    }

    // ==================== SUCCESS RESPONSE ====================

    const duration = Date.now() - startTime
    console.log(`[Rejection] Completed successfully in ${duration}ms`)

    return NextResponse.json({
      success: true,
      submission_id: submission_id,
      budget_returned: paymentAmount,
      dispute_id: dispute?.id || null,
      dispute_status: 'pending_admin_review',
      duration_ms: duration
    })

  } catch (error: any) {
    console.error('[Rejection] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'internal_error',
        message: error.message || 'An unexpected error occurred',
        details: error.toString()
      },
      { status: 500 }
    )
  }
}

