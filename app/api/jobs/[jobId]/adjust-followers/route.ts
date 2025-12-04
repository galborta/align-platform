import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * POST /api/jobs/[jobId]/adjust-followers
 * 
 * Allows posters to adjust the verified follower count for a submission.
 * This affects payment calculations as payments are proportional to follower counts.
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
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId

    const body = await request.json()
    const { submission_id, verified_follower_count, adjustment_reason } = body

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
        { error: 'Cannot adjust followers after payments have been distributed' },
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

    // === UPDATE VERIFIED FOLLOWER COUNT ===

    const { error: updateError } = await supabase
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

