import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notificationService } from '@/lib/services/notificationService'
import { Database } from '@/types/database'

// Use service role key for cron job (has elevated permissions)
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/cron/auto-approve-social-jobs
 * 
 * Cron job that automatically approves pending submissions for social media jobs
 * after the review deadline has passed.
 * 
 * This prevents posters from indefinitely delaying payments by not reviewing.
 * After the review deadline (48 hours after engagement window), all pending
 * submissions are automatically approved with status 'auto_approved'.
 * 
 * **Schedule:** Recommended to run hourly via Vercel Cron or external service
 * 
 * **Flow:**
 * 1. Find all social media jobs where review deadline has passed
 * 2. For each job, find pending submissions
 * 3. Update all pending submissions to 'auto_approved'
 * 4. Notify workers of auto-approval
 * 5. Notify poster that submissions were auto-approved
 * 
 * **Security:**
 * - Requires CRON_SECRET in Authorization header
 * - Uses service role for elevated database access
 * 
 * **Setup (Vercel Cron):**
 * 1. Add to vercel.json:
 *    ```json
 *    {
 *      "crons": [{
 *        "path": "/api/cron/auto-approve-social-jobs",
 *        "schedule": "0 * * * *"
 *      }]
 *    }
 *    ```
 * 2. Add CRON_SECRET to environment variables
 * 
 * @param request - Incoming request with Authorization header
 * @returns Summary of processed jobs and auto-approved submissions
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('[Auto-Approve Cron] Starting job...')

    // ==================== AUTHENTICATION ====================
    
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Allow bypass in development or if no secret configured
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Auto-Approve Cron] Unauthorized request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const now = new Date()
    console.log(`[Auto-Approve Cron] Current time: ${now.toISOString()}`)

    // ==================== FIND EXPIRED JOBS ====================

    // Find all social media jobs where:
    // 1. Is a social media job
    // 2. Review deadline has passed
    // 3. Payments not yet distributed
    const { data: expiredJobs, error: jobsError } = await supabaseAdmin
      .from('jobs')
      .select('id, title, poster_wallet, project_id, social_review_deadline')
      .eq('is_social_media_job', true)
      .eq('social_payments_distributed', false)
      .lt('social_review_deadline', now.toISOString())

    if (jobsError) {
      console.error('[Auto-Approve Cron] Error fetching jobs:', jobsError)
      throw new Error('Failed to fetch expired jobs')
    }

    if (!expiredJobs || expiredJobs.length === 0) {
      console.log('[Auto-Approve Cron] No jobs requiring auto-approval')
      return NextResponse.json({
        success: true,
        message: 'No jobs requiring auto-approval',
        processed: 0,
        auto_approved: 0
      })
    }

    console.log(`[Auto-Approve Cron] Found ${expiredJobs.length} jobs past review deadline`)

    // ==================== PROCESS EACH JOB ====================

    let totalAutoApproved = 0
    let jobsProcessed = 0
    const results: Array<{
      job_id: string
      job_title: string
      submissions_approved: number
    }> = []

    for (const job of expiredJobs) {
      console.log(`[Auto-Approve Cron] Processing job ${job.id}: ${job.title}`)

      // Get all pending submissions for this job
      const { data: pendingSubmissions, error: subsError } = await supabaseAdmin
        .from('job_submissions')
        .select('id, worker_wallet')
        .eq('job_id', job.id)
        .eq('social_approval_status', 'pending')

      if (subsError) {
        console.error(`[Auto-Approve Cron] Error fetching submissions for job ${job.id}:`, subsError)
        continue
      }

      if (!pendingSubmissions || pendingSubmissions.length === 0) {
        console.log(`[Auto-Approve Cron] No pending submissions for job ${job.id}`)
        continue
      }

      console.log(`[Auto-Approve Cron] Found ${pendingSubmissions.length} pending submissions`)

      // ==================== AUTO-APPROVE SUBMISSIONS ====================

      const { error: updateError } = await supabaseAdmin
        .from('job_submissions')
        .update({
          social_approval_status: 'auto_approved'
        })
        .eq('job_id', job.id)
        .eq('social_approval_status', 'pending')

      if (updateError) {
        console.error(`[Auto-Approve Cron] Failed to auto-approve job ${job.id}:`, updateError)
        continue
      }

      totalAutoApproved += pendingSubmissions.length
      jobsProcessed++

      results.push({
        job_id: job.id,
        job_title: job.title,
        submissions_approved: pendingSubmissions.length
      })

      console.log(`[Auto-Approve Cron] ✅ Auto-approved ${pendingSubmissions.length} submissions for job ${job.id}`)

      // ==================== NOTIFY WORKERS ====================

      for (const submission of pendingSubmissions) {
        try {
          await notificationService.createNotification({
            userWallet: submission.worker_wallet,
            type: 'job_completed', // Reuse existing type
            actorWallet: job.poster_wallet,
            referenceId: job.id,
            referenceType: 'job',
            metadata: {
              job_id: job.id,
              job_title: job.title,
              auto_approved: true,
              is_social_media_job: true,
              message: 'Your submission was automatically approved after the review period'
            }
          })
        } catch (notifError) {
          console.error(`[Auto-Approve Cron] Failed to notify worker ${submission.worker_wallet}:`, notifError)
          // Non-critical, continue
        }
      }

      // ==================== NOTIFY POSTER ====================

      try {
        await notificationService.createNotification({
          userWallet: job.poster_wallet,
          type: 'job_submitted', // Reuse existing type
          referenceId: job.id,
          referenceType: 'job',
          metadata: {
            job_id: job.id,
            job_title: job.title,
            auto_approved_count: pendingSubmissions.length,
            is_social_media_job: true,
            message: `${pendingSubmissions.length} pending submission(s) were automatically approved after the review deadline`
          }
        })
      } catch (notifError) {
        console.error(`[Auto-Approve Cron] Failed to notify poster ${job.poster_wallet}:`, notifError)
        // Non-critical, continue
      }
    }

    // ==================== SUCCESS RESPONSE ====================

    const duration = Date.now() - startTime
    console.log(`[Auto-Approve Cron] ✅ Complete in ${duration}ms`)
    console.log(`[Auto-Approve Cron] Processed ${jobsProcessed} jobs, auto-approved ${totalAutoApproved} submissions`)

    return NextResponse.json({
      success: true,
      message: `Auto-approved ${totalAutoApproved} submissions across ${jobsProcessed} jobs`,
      processed: jobsProcessed,
      auto_approved: totalAutoApproved,
      duration_ms: duration,
      details: results
    })

  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[Auto-Approve Cron] ❌ Error after ${duration}ms:`, error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST handler - Alternative method for triggering the cron
 * Useful for manual triggers from admin dashboard
 */
export async function POST(request: NextRequest) {
  // Delegate to GET handler
  return GET(request)
}

