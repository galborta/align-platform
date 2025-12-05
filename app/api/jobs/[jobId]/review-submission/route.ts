import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { notificationService } from '@/lib/services/notificationService'

/**
 * POST /api/jobs/[jobId]/review-submission
 * 
 * Handles approving or denying individual submissions for social media jobs.
 * 
 * Request body:
 * - submission_id: string (required)
 * - action: 'approve' | 'deny' (required)
 * - denial_reason: string (required if action is 'deny')
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
    const { submission_id, action, denial_reason } = body

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

    // Check if payments already distributed
    if (job.social_payments_distributed) {
      return NextResponse.json(
        { error: 'Payments have already been distributed for this campaign' },
        { status: 400 }
      )
    }

    // === GET SUBMISSION ===

    const { data: submission, error: submissionError } = await supabase
      .from('job_submissions')
      .select('*')
      .eq('id', submission_id)
      .eq('job_id', jobId)
      .single()

    if (submissionError || !submission) {
      console.error('Submission fetch error:', submissionError)
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

    if (action === 'approve') {
      const { error: updateError } = await supabase
        .from('job_submissions')
        .update({
          social_approval_status: 'approved'
        })
        .eq('id', submission_id)

      if (updateError) {
        console.error('Update error:', updateError)
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
            is_social_media_job: true
          }
        })
      } catch (notificationError) {
        console.error('Notification error (non-critical):', notificationError)
      }

    } else if (action === 'deny') {
      const { error: updateError } = await supabase
        .from('job_submissions')
        .update({
          social_approval_status: 'denied',
          social_denial_reason: denial_reason
        })
        .eq('id', submission_id)

      if (updateError) {
        console.error('Update error:', updateError)
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
        console.error('Notification error (non-critical):', notificationError)
      }
    }

    // === SUCCESS RESPONSE ===

    return NextResponse.json({
      success: true,
      action,
      submission_id
    })

  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

