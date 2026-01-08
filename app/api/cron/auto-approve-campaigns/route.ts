import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notificationService } from '@/lib/services/notificationService'
import { autoApprovePendingSubmissions } from '@/lib/auto-approve-campaigns'
import { Database } from '@/types/database'

// Use service role key for cron job (has elevated permissions)
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/cron/auto-approve-campaigns
 * 
 * Cron job that automatically processes social media campaigns that have reached
 * their review deadline. This is the main orchestrator for Sprint 5.
 * 
 * This job handles:
 * - Auto-approving pending submissions after review deadline
 * - Detecting zero-submission campaigns (eligible for no-penalty refund)
 * - Triggering payment distribution for completed campaigns
 * - Calculating and processing budget refunds
 * 
 * **Schedule:** Every 5 minutes via Vercel Cron
 * 
 * **Flow:**
 * 1. Find all social media jobs where review deadline has passed
 * 2. For each campaign:
 *    a. Check submission count
 *    b. If zero submissions: notify poster (can cancel for full refund, no penalty)
 *    c. If has submissions: auto-approve pending, prepare for payment distribution
 * 3. Mark campaigns as processed (social_payments_distributed flag)
 * 4. Send appropriate notifications
 * 
 * **Security:**
 * - Requires CRON_SECRET in Authorization header
 * - Uses service role for elevated database access
 * - Only processes jobs once (via social_payments_distributed flag)
 * 
 * **Setup (Vercel Cron):**
 * 1. Add to vercel.json:
 *    ```json
 *    {
 *      "crons": [{
 *        "path": "/api/cron/auto-approve-campaigns",
 *        "schedule": "every 5 minutes"
 *      }]
 *    }
 *    ```
 *    (Or use cron syntax: "star-slash-5 star star star star" - replace with actual symbols)
 * 2. Add CRON_SECRET to environment variables
 * 
 * @param request - Incoming request with Authorization header
 * @returns Summary of processed campaigns and actions taken
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('[Campaign Cron] Starting job...')

    // ==================== AUTHENTICATION ====================
    
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Allow bypass in development or if no secret configured
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Campaign Cron] Unauthorized request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const now = new Date()
    console.log(`[Campaign Cron] Current time: ${now.toISOString()}`)

    // ==================== FIND CAMPAIGNS PAST REVIEW DEADLINE ====================

    // Find all social media jobs where:
    // 1. Is a social media job
    // 2. Review deadline has passed
    // 3. Payments not yet distributed (still needs processing)
    // 4. Not already cancelled or completed
    const { data: expiredCampaigns, error: jobsError } = await supabaseAdmin
      .from('jobs')
      .select('id, title, poster_wallet, project_id, social_review_deadline, social_budget_max_usd, escrow_amount_tokens, escrow_token_mint')
      .eq('is_social_media_job', true)
      .eq('social_payments_distributed', false)
      .in('status', ['open', 'active'])
      .lt('social_review_deadline', now.toISOString())

    if (jobsError) {
      console.error('[Campaign Cron] Error fetching campaigns:', jobsError)
      throw new Error('Failed to fetch expired campaigns')
    }

    if (!expiredCampaigns || expiredCampaigns.length === 0) {
      console.log('[Campaign Cron] No campaigns requiring processing')
      return NextResponse.json({
        success: true,
        message: 'No campaigns requiring processing',
        processed: 0,
        campaigns_with_submissions: 0,
        campaigns_without_submissions: 0
      })
    }

    console.log(`[Campaign Cron] Found ${expiredCampaigns.length} campaigns past review deadline`)

    // ==================== PROCESS EACH CAMPAIGN ====================

    let campaignsProcessed = 0
    let campaignsWithSubmissions = 0
    let campaignsWithoutSubmissions = 0
    const results: Array<{
      job_id: string
      job_title: string
      submission_count: number
      action_taken: string
      auto_approved_count?: number
    }> = []

    for (const campaign of expiredCampaigns) {
      console.log(`[Campaign Cron] Processing campaign ${campaign.id}: ${campaign.title}`)

      // ==================== COUNT SUBMISSIONS ====================

      // Get all submissions (approved, auto_approved, or pending)
      const { data: allSubmissions, error: subsError } = await supabaseAdmin
        .from('job_submissions')
        .select('id, worker_wallet, social_approval_status')
        .eq('job_id', campaign.id)

      if (subsError) {
        console.error(`[Campaign Cron] Error fetching submissions for campaign ${campaign.id}:`, subsError)
        continue
      }

      const submissionCount = allSubmissions?.length || 0
      const pendingSubmissions = allSubmissions?.filter(s => s.social_approval_status === 'pending') || []

      console.log(`[Campaign Cron] Campaign has ${submissionCount} total submissions, ${pendingSubmissions.length} pending`)

      // ==================== ROUTE 1: ZERO SUBMISSIONS ====================

      if (submissionCount === 0) {
        console.log(`[Campaign Cron] Campaign ${campaign.id} has no submissions`)
        
        // Notify poster: campaign ended with no participants
        // They can cancel for full refund with NO karma penalty
        try {
          await notificationService.createNotification({
            userWallet: campaign.poster_wallet,
            type: 'social_campaign_ended_no_participants',
            referenceId: campaign.id,
            referenceType: 'job',
            metadata: {
              job_title: campaign.title,
              social_budget_amount: campaign.social_budget_max_usd || campaign.escrow_amount_tokens,
              amount: campaign.social_budget_max_usd || campaign.escrow_amount_tokens,
              token: 'USD',
              message: 'Your campaign received no submissions. You can cancel for a full refund with no karma penalty.'
            }
          })
          console.log(`[Campaign Cron] ✅ Notified poster of zero-submission campaign`)
        } catch (notifError) {
          console.error(`[Campaign Cron] Failed to notify poster:`, notifError)
        }

        // Mark as processed but don't mark as completed yet
        // Poster needs to explicitly cancel to trigger refund
        // We just set a flag so we don't keep processing this campaign
        const { error: updateError } = await supabaseAdmin
          .from('jobs')
          .update({
            social_payments_distributed: true, // Prevents re-processing
            updated_at: now.toISOString()
          })
          .eq('id', campaign.id)

        if (updateError) {
          console.error(`[Campaign Cron] Failed to update campaign ${campaign.id}:`, updateError)
        }

        campaignsWithoutSubmissions++
        results.push({
          job_id: campaign.id,
          job_title: campaign.title,
          submission_count: 0,
          action_taken: 'notified_zero_submissions'
        })

        continue
      }

      // ==================== ROUTE 2: HAS SUBMISSIONS ====================

      console.log(`[Campaign Cron] Campaign ${campaign.id} has ${submissionCount} submissions`)

      // Process auto-approval with payment distribution
      try {
        const approvalResult = await autoApprovePendingSubmissions(campaign.id)
        
        console.log(`[Campaign Cron] ✅ Auto-approval complete:`)
        console.log(`  - Participants: ${approvalResult.participants}`)
        console.log(`  - Total paid: $${approvalResult.totalPaid}`)
        console.log(`  - Refunded: $${approvalResult.budgetRefunded}`)
        console.log(`  - Tx signature: ${approvalResult.txSignature || 'N/A'}`)

        campaignsWithSubmissions++
        campaignsProcessed++
        results.push({
          job_id: campaign.id,
          job_title: campaign.title,
          submission_count: approvalResult.participants,
          action_taken: 'auto_approved_and_paid',
          auto_approved_count: approvalResult.participants
        })
      } catch (approvalError) {
        console.error(`[Campaign Cron] Failed to process campaign ${campaign.id}:`, approvalError)
        results.push({
          job_id: campaign.id,
          job_title: campaign.title,
          submission_count: submissionCount,
          action_taken: 'error',
          auto_approved_count: 0
        })
        continue
      }

      console.log(`[Campaign Cron] ✅ Processed campaign ${campaign.id}`)
    }

    // ==================== SUCCESS RESPONSE ====================

    const duration = Date.now() - startTime
    console.log(`[Campaign Cron] ✅ Complete in ${duration}ms`)
    console.log(`[Campaign Cron] Processed ${campaignsProcessed} campaigns`)
    console.log(`[Campaign Cron] - With submissions: ${campaignsWithSubmissions}`)
    console.log(`[Campaign Cron] - Without submissions: ${campaignsWithoutSubmissions}`)

    return NextResponse.json({
      success: true,
      message: `Processed ${expiredCampaigns.length} campaigns`,
      processed: expiredCampaigns.length,
      campaigns_with_submissions: campaignsWithSubmissions,
      campaigns_without_submissions: campaignsWithoutSubmissions,
      duration_ms: duration,
      details: results,
      timestamp: now.toISOString()
    })

  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[Campaign Cron] ❌ Error after ${duration}ms:`, error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * POST handler - Alternative method for triggering the cron
 * Useful for manual triggers from admin dashboard or local testing
 */
export async function POST(request: NextRequest) {
  // Allow manual trigger in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Campaign Cron] Manual trigger in development mode')
    return GET(request)
  }
  
  // In production, still delegate to GET handler
  return GET(request)
}

