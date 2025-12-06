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
 * GET /api/cron/contest-judging-notifications
 * 
 * Cron job that notifies contest posters when their contest enters the judging phase.
 * A contest enters judging phase when its submission deadline has passed.
 * 
 * **Schedule:** Recommended to run every 15 minutes via Vercel Cron
 * 
 * **Flow:**
 * 1. Find all contest jobs where:
 *    - Submission deadline has passed
 *    - Winners have NOT been selected yet
 *    - Has at least one submission
 *    - Poster hasn't been notified yet (tracked by judging_notification_sent_at)
 * 2. For each contest, notify the poster that judging can begin
 * 3. Mark the contest as notified to prevent duplicate notifications
 * 
 * **Security:**
 * - Requires CRON_SECRET in Authorization header (optional for dev)
 * - Uses service role for elevated database access
 * 
 * **Setup (Vercel Cron):**
 * 1. Add to vercel.json with path and schedule (every 15 minutes)
 * 2. Add CRON_SECRET to environment variables
 * 
 * @param request - Incoming request with Authorization header
 * @returns Summary of processed contests and notifications sent
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('[Contest Judging Cron] Starting job...')

    // ==================== AUTHENTICATION ====================
    
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Allow bypass in development or if no secret configured
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Contest Judging Cron] Unauthorized request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const now = new Date()
    console.log(`[Contest Judging Cron] Current time: ${now.toISOString()}`)

    // ==================== FIND CONTESTS READY FOR JUDGING ====================

    // Find all contest jobs where:
    // 1. Is a contest job
    // 2. Submission deadline has passed
    // 3. Winners have NOT been selected yet
    // 4. Has not been notified yet (judging_notification_sent_at is null)
    const { data: contestsReadyForJudging, error: jobsError } = await supabaseAdmin
      .from('jobs')
      .select(`
        id, 
        title, 
        poster_wallet, 
        project_id, 
        contest_submission_deadline,
        contest_max_winners
      `)
      .eq('is_contest', true)
      .is('contest_winners_selected_at', null)
      .is('judging_notification_sent_at', null)
      .lt('contest_submission_deadline', now.toISOString())
      .not('contest_submission_deadline', 'is', null)

    if (jobsError) {
      console.error('[Contest Judging Cron] Error fetching contests:', jobsError)
      throw new Error('Failed to fetch contests ready for judging')
    }

    if (!contestsReadyForJudging || contestsReadyForJudging.length === 0) {
      console.log('[Contest Judging Cron] No contests ready for judging notifications')
      return NextResponse.json({
        success: true,
        message: 'No contests ready for judging notifications',
        processed: 0,
        notifications_sent: 0
      })
    }

    console.log(`[Contest Judging Cron] Found ${contestsReadyForJudging.length} contests past deadline`)

    // ==================== PROCESS EACH CONTEST ====================

    let notificationsSent = 0
    let contestsProcessed = 0
    const results: Array<{
      job_id: string
      job_title: string
      submission_count: number
      notified: boolean
    }> = []

    for (const contest of contestsReadyForJudging) {
      console.log(`[Contest Judging Cron] Processing contest ${contest.id}: ${contest.title}`)

      // Count submissions for this contest
      const { count: submissionCount, error: countError } = await supabaseAdmin
        .from('job_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', contest.id)

      if (countError) {
        console.error(`[Contest Judging Cron] Error counting submissions for ${contest.id}:`, countError)
        continue
      }

      // Skip if no submissions
      if (!submissionCount || submissionCount === 0) {
        console.log(`[Contest Judging Cron] Skipping contest ${contest.id} - no submissions`)
        results.push({
          job_id: contest.id,
          job_title: contest.title,
          submission_count: 0,
          notified: false
        })
        continue
      }

      // ==================== SEND NOTIFICATION ====================

      try {
        await notificationService.notifyContestJudgingStarted({
          posterWallet: contest.poster_wallet,
          jobId: contest.id,
          jobTitle: contest.title,
          submissionCount
        })

        notificationsSent++
        console.log(`[Contest Judging Cron] ✅ Notified poster for contest ${contest.id}`)
      } catch (notifError) {
        console.error(`[Contest Judging Cron] Failed to notify poster for ${contest.id}:`, notifError)
        // Continue but don't mark as notified
        results.push({
          job_id: contest.id,
          job_title: contest.title,
          submission_count: submissionCount,
          notified: false
        })
        continue
      }

      // ==================== MARK AS NOTIFIED ====================

      // Update the job to mark that judging notification was sent
      const { error: updateError } = await supabaseAdmin
        .from('jobs')
        .update({
          judging_notification_sent_at: now.toISOString()
        })
        .eq('id', contest.id)

      if (updateError) {
        console.error(`[Contest Judging Cron] Failed to mark contest ${contest.id} as notified:`, updateError)
        // Non-critical - notification was still sent
      }

      contestsProcessed++
      results.push({
        job_id: contest.id,
        job_title: contest.title,
        submission_count: submissionCount,
        notified: true
      })
    }

    // ==================== SUCCESS RESPONSE ====================

    const duration = Date.now() - startTime
    console.log(`[Contest Judging Cron] ✅ Complete in ${duration}ms`)
    console.log(`[Contest Judging Cron] Processed ${contestsProcessed} contests, sent ${notificationsSent} notifications`)

    return NextResponse.json({
      success: true,
      message: `Sent ${notificationsSent} judging notifications for ${contestsProcessed} contests`,
      processed: contestsProcessed,
      notifications_sent: notificationsSent,
      duration_ms: duration,
      details: results
    })

  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[Contest Judging Cron] ❌ Error after ${duration}ms:`, error)
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


