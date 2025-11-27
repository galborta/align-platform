import { NextRequest, NextResponse } from 'next/server'
import { cancelJobDueToMissedDeadline } from '@/lib/job-deadline-enforcement'

/**
 * POST /api/jobs/[jobId]/cancel-missed-deadline
 * 
 * Allows job poster to cancel a job when the worker has missed the deadline.
 * 
 * Request body:
 * - poster_wallet: string (required) - Wallet address of the job poster
 * 
 * Returns:
 * - 200: { success: true } - Job cancelled successfully
 * - 400: { error: string } - Invalid request or unauthorized
 * - 500: { error: string } - Internal server error
 * 
 * Process:
 * 1. Validates poster_wallet is provided
 * 2. Calls cancelJobDueToMissedDeadline which:
 *    - Verifies deadline has passed
 *    - Verifies caller is the job poster
 *    - Updates job status to 'cancelled'
 *    - Creates job_failure record
 *    - TODO: Processes refund (Sprint 4)
 *    - TODO: Deducts worker karma (Sprint 4)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { poster_wallet } = await request.json()
    
    // Validate required fields
    if (!poster_wallet) {
      return NextResponse.json(
        { error: 'Poster wallet required' },
        { status: 400 }
      )
    }

    // Validate jobId is provided
    if (!params.jobId) {
      return NextResponse.json(
        { error: 'Job ID required' },
        { status: 400 }
      )
    }

    // Cancel job due to missed deadline
    const result = await cancelJobDueToMissedDeadline(
      params.jobId,
      poster_wallet
    )
    
    // Handle cancellation failure
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to cancel job' },
        { status: 400 }
      )
    }
    
    // Success
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Cancel job API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

