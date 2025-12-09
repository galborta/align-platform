import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notificationService } from '@/lib/services/notificationService'
import { Database } from '@/types/database'
import { rateLimit } from '@/lib/rate-limit'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/jobs/[jobId]/review-submission
 * 
 * Handles approving or denying individual submissions for social media jobs.
 * 
 * Security:
 * - CRITICAL: Requires Supabase JWT authentication for manual reviews
 * - Supports SERVICE_AUTH_TOKEN for auto-approval cron jobs
 * - Only the authenticated job poster can review submissions
 * 
 * Request body:
 * - submission_id: string (required)
 * - action: 'approve' | 'deny' (required)
 * - denial_reason: string (required if action is 'deny')
 * - auto_approve: boolean (optional - for cron job auto-approval)
 * 
 * Validations:
 * - Job must be a social media job
 * - Payments must not already be distributed
 * - Submission must exist and belong to the job
 * 
 * Side effects:
 * - Updates submission approval status
 * - Creates notification for worker
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    const body = await request.json()
    const { submission_id, action, denial_reason, auto_approve } = body

    // === VALIDATION ===

    if (!submission_id || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: submission_id and action' },
        { status: 400 }
      )
    }

    if (!['approve', 'deny'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "deny"' },
        { status: 400 }
      )
    }

    if (action === 'deny' && !denial_reason) {
      return NextResponse.json(
        { error: 'Denial reason is required when denying submissions' },
        { status: 400 }
      )
    }

    // === AUTHENTICATION ===

    let authenticatedWallet: string

    if (auto_approve) {
      // Service token auth for automated approvals (cron jobs)
      const authHeader = request.headers.get('authorization')
      const serviceToken = process.env.SERVICE_AUTH_TOKEN || 'auto-approve-internal'
      
      if (authHeader !== `Bearer ${serviceToken}`) {
        console.error('[Review Submission] Invalid service token for auto-approve')
        return NextResponse.json(
          { error: 'Unauthorized auto-approve request' },
          { status: 403 }
        )
      }
      
      console.log('[Review Submission] ✅ Service token validated for auto-approve')
      // For auto-approve, we'll verify against job poster after fetching job
      authenticatedWallet = 'SERVICE_AUTO_APPROVE'
    } else {
      // Manual review: Require Supabase JWT authentication
      const authHeader = request.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        console.error('[Review Submission] Missing authorization header')
        return NextResponse.json(
          { error: 'Unauthorized - Authentication required' },
          { status: 401 }
        )
      }

      const token = authHeader.substring(7)
      
      // Verify JWT token
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

      if (authError || !user) {
        console.error('[Review Submission] Invalid auth token:', authError)
        return NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        )
      }

      console.log(`[Review Submission] Authenticated user: ${user.id}`)

      // Get user's wallet from profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('wallet_address')
        .eq('id', user.id)
        .single()

      if (profileError || !profile?.wallet_address) {
        console.error('[Review Submission] No wallet found for user:', profileError)
        return NextResponse.json(
          { error: 'No wallet address linked to account' },
          { status: 403 }
        )
      }

      authenticatedWallet = profile.wallet_address
      console.log(`[Review Submission] User wallet: ${authenticatedWallet}`)

      // Rate limiting for manual reviews
      const rateLimitResult = rateLimit(user.id, 'mutation')
      if (!rateLimitResult.success) {
        return NextResponse.json(
          { error: rateLimitResult.error },
          { status: rateLimitResult.status }
        )
      }
    }

    // === GET JOB DETAILS ===

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('is_social_media_job', true)
      .single()

    if (jobError || !job) {
      console.error('[Review Submission] Job fetch error:', jobError)
      return NextResponse.json(
        { error: 'Social media job not found' },
        { status: 404 }
      )
    }

    // === AUTHORIZATION ===

    // For manual reviews, verify user is the job poster
    if (!auto_approve && authenticatedWallet !== job.poster_wallet) {
      console.error('[Review Submission] Unauthorized - not job poster')
      return NextResponse.json(
        { error: 'Only the job poster can review submissions' },
        { status: 403 }
      )
    }

    console.log('[Review Submission] ✅ Authorization verified')

    // Check if payments already distributed
    if (job.social_payments_distributed) {
      return NextResponse.json(
        { error: 'Payments have already been distributed for this campaign' },
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
      console.error('[Review Submission] Submission fetch error:', submissionError)
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      )
    }

    // Check if submission is still pending
    if (submission.social_approval_status !== 'pending') {
      return NextResponse.json(
        { error: `Submission has already been ${submission.social_approval_status}` },
        { status: 400 }
      )
    }

    // === UPDATE SUBMISSION ===

    const approvalStatus = auto_approve ? 'auto_approved' : 'approved'

    if (action === 'approve') {
      const { error: updateError } = await supabaseAdmin
        .from('job_submissions')
        .update({
          social_approval_status: approvalStatus
        })
        .eq('id', submission_id)

      if (updateError) {
        console.error('[Review Submission] Update error:', updateError)
        throw new Error('Failed to approve submission')
      }

      // Notify worker (non-blocking)
      try {
        await notificationService.createNotification({
          userWallet: submission.worker_wallet,
          type: 'job_completed', // Reusing existing type
          actorWallet: job.poster_wallet,
          referenceId: jobId,
          referenceType: 'job',
          metadata: {
            job_title: job.title,
            submission_id: submission_id,
            action: 'approved',
            is_social_media_job: true,
            auto_approved: auto_approve || false
          }
        })
      } catch (notificationError) {
        console.error('[Review Submission] Notification error (non-critical):', notificationError)
      }

    } else if (action === 'deny') {
      const { error: updateError } = await supabaseAdmin
        .from('job_submissions')
        .update({
          social_approval_status: 'denied',
          social_denial_reason: denial_reason
        })
        .eq('id', submission_id)

      if (updateError) {
        console.error('[Review Submission] Update error:', updateError)
        throw new Error('Failed to deny submission')
      }

      // Notify worker (non-blocking)
      try {
        await notificationService.createNotification({
          userWallet: submission.worker_wallet,
          type: 'dispute_opened', // Reusing existing type for denial
          actorWallet: job.poster_wallet,
          referenceId: jobId,
          referenceType: 'job',
          metadata: {
            job_title: job.title,
            submission_id: submission_id,
            action: 'denied',
            denial_reason: denial_reason,
            is_social_media_job: true,
            can_dispute: true
          }
        })
      } catch (notificationError) {
        console.error('[Review Submission] Notification error (non-critical):', notificationError)
      }
    }

    // === SUCCESS RESPONSE ===

    console.log(`[Review Submission] ✅ Submission ${submission_id} ${action}d successfully`)

    return NextResponse.json({
      success: true,
      action,
      submission_id,
      auto_approved: auto_approve || false
    })

  } catch (error: any) {
    console.error('[Review Submission] API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

