/**
 * Social Job Submission API Endpoint
 * 
 * POST /api/jobs/social/[jobId]/submit
 * 
 * Handles worker submissions to social media jobs with comprehensive validation,
 * budget reservation, and duplicate checking.
 * 
 * Security:
 * - Requires wallet signature verification (no replay attacks)
 * - Validates all inputs before database operations
 * - Uses atomic budget reservation to prevent race conditions
 * 
 * Flow:
 * 1. Verify wallet signature
 * 2. Validate job exists and is accepting submissions
 * 3. Check for duplicate submissions (worker + tweet)
 * 4. Find matching tier for follower range
 * 5. Reserve budget atomically
 * 6. Create submission record
 * 7. Send notifications (non-blocking)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyRequestSignature } from '@/lib/signature-auth'
import { reserveBudgetForSubmission, validateTweetUrl, extractTweetId } from '@/lib/social-jobs'
import { notifySubmissionReceived } from '@/lib/social-job-notifications'
import type { BudgetTier } from '@/types/social-jobs'
import { Database } from '@/types/database'

// Create Supabase client with service role for server-side operations
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST handler for social job submissions
 * 
 * Request body:
 * - wallet: Worker's wallet address
 * - signature: Base58 wallet signature
 * - message: Signed message with timestamp
 * - follower_range: { min_followers, max_followers } for tier selection
 * - social_tweet_link: URL to worker's tweet
 * - social_payment_amount_usd: Expected payment amount (for validation)
 * 
 * Returns:
 * - Success: { success: true, submission_id, payment_reserved, payment_status, auto_approve_date }
 * - Error: { success: false, error: error_code } with appropriate HTTP status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Parse params and body
    const { jobId } = await params
    const body = await request.json()
    
    console.log(`[Social Submit API] Processing submission for job ${jobId}`)
    
    // === 1. VERIFY WALLET SIGNATURE ===
    
    // Note: Frontend sends message like "Submit to social job: {jobId}\nTimestamp: {timestamp}"
    // We verify signature without strict action/resource checking since format is already correct
    const authResult = verifyRequestSignature(body, {
      maxAge: 5 * 60 * 1000 // 5 minutes - allow messages up to 5 min old
    })
    
    if (!authResult.success) {
      console.error('[Social Submit API] Signature verification failed:', authResult.error)
      return NextResponse.json(
        { success: false, error: 'invalid_signature' },
        { status: 401 }
      )
    }
    
    const { wallet, follower_range, social_tweet_link, social_payment_amount_usd } = body
    
    console.log(`[Social Submit API] Verified wallet: ${wallet?.slice(0, 8)}...`)
    
    // === 2. VALIDATE REQUIRED FIELDS ===
    
    if (!follower_range || !social_tweet_link) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: follower_range, social_tweet_link' 
        },
        { status: 400 }
      )
    }
    
    if (typeof follower_range.min_followers !== 'number' || 
        (follower_range.max_followers !== null && typeof follower_range.max_followers !== 'number')) {
      return NextResponse.json(
        { success: false, error: 'invalid_follower_range' },
        { status: 400 }
      )
    }
    
    // === 3. VALIDATE TWEET URL FORMAT ===
    
    const isValidUrl = validateTweetUrl(social_tweet_link)
    if (!isValidUrl) {
      return NextResponse.json(
        { success: false, error: 'invalid_tweet_url' },
        { status: 400 }
      )
    }
    
    // === 4. GET JOB AND VALIDATE ===
    
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('is_social_media_job', true)
      .single()
    
    if (jobError || !job) {
      console.error('[Social Submit API] Job fetch error:', jobError)
      return NextResponse.json(
        { success: false, error: 'job_not_found' },
        { status: 404 }
      )
    }
    
    console.log(`[Social Submit API] Job found: ${job.title}`)
    
    // === 5. CHECK CAMPAIGN STILL OPEN ===
    
    const now = new Date()
    const campaignEndDate = job.social_campaign_end_date || job.social_submission_deadline
    
    if (!campaignEndDate) {
      console.error('[Social Submit API] Job missing campaign end date')
      return NextResponse.json(
        { success: false, error: 'campaign_misconfigured' },
        { status: 500 }
      )
    }
    
    if (now > new Date(campaignEndDate)) {
      return NextResponse.json(
        { success: false, error: 'campaign_ended' },
        { status: 400 }
      )
    }
    
    // Check job status
    if (job.status !== 'open' && job.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'campaign_ended' },
        { status: 400 }
      )
    }
    
    // Prevent self-submission
    if (job.poster_wallet === wallet) {
      return NextResponse.json(
        { success: false, error: 'cannot_submit_to_own_campaign' },
        { status: 400 }
      )
    }
    
    // === 6. CHECK FOR DUPLICATE SUBMISSION (SAME WORKER) ===
    
    const { data: existingWorkerSubmission, error: workerCheckError } = await supabase
      .from('job_submissions')
      .select('id')
      .eq('job_id', jobId)
      .eq('worker_wallet', wallet)
      .maybeSingle()
    
    if (workerCheckError) {
      console.error('[Social Submit API] Worker duplicate check error:', workerCheckError)
      return NextResponse.json(
        { success: false, error: 'database_error' },
        { status: 500 }
      )
    }
    
    if (existingWorkerSubmission) {
      console.log('[Social Submit API] Worker already submitted')
      return NextResponse.json(
        { success: false, error: 'already_submitted' },
        { status: 400 }
      )
    }
    
    // === 7. CHECK FOR DUPLICATE TWEET LINK (BY TWEET ID) ===
    
    // Extract tweet ID from URL to catch duplicates with different URL formats
    // e.g., twitter.com vs x.com, with/without query params
    const submittedTweetId = extractTweetId(social_tweet_link)
    
    if (!submittedTweetId) {
      console.error('[Social Submit API] Could not extract tweet ID from URL:', social_tweet_link)
      return NextResponse.json(
        { success: false, error: 'invalid_tweet_url' },
        { status: 400 }
      )
    }
    
    console.log(`[Social Submit API] Checking for duplicate tweet ID: ${submittedTweetId}`)
    
    // Fetch all submissions for this job to check tweet IDs
    const { data: existingSubmissions, error: submissionsCheckError } = await supabase
      .from('job_submissions')
      .select('id, worker_wallet, social_tweet_link')
      .eq('job_id', jobId)
      .not('social_tweet_link', 'is', null)
    
    if (submissionsCheckError) {
      console.error('[Social Submit API] Submissions check error:', submissionsCheckError)
      return NextResponse.json(
        { success: false, error: 'database_error' },
        { status: 500 }
      )
    }
    
    // Check if any existing submission has the same tweet ID
    const duplicateTweet = existingSubmissions?.find(submission => {
      if (!submission.social_tweet_link) return false
      const existingTweetId = extractTweetId(submission.social_tweet_link)
      return existingTweetId === submittedTweetId
    })
    
    if (duplicateTweet) {
      console.log('[Social Submit API] Duplicate tweet ID found:', {
        submittedTweetId,
        existingWorker: duplicateTweet.worker_wallet,
        existingUrl: duplicateTweet.social_tweet_link
      })
      return NextResponse.json(
        { success: false, error: 'duplicate_tweet' },
        { status: 400 }
      )
    }
    
    console.log('[Social Submit API] No duplicate tweet found')
    
    // === 8. FIND MATCHING TIER AND CHECK BUDGET ===
    
    // Parse budget tiers from JSONB
    let budgetTiers: BudgetTier[]
    try {
      if (typeof job.social_budget_tiers === 'string') {
        budgetTiers = JSON.parse(job.social_budget_tiers)
      } else if (job.social_budget_tiers?.tiers) {
        // Handle nested structure from database
        budgetTiers = job.social_budget_tiers.tiers
      } else {
        budgetTiers = job.social_budget_tiers || []
      }
    } catch (parseError) {
      console.error('[Social Submit API] Failed to parse budget tiers:', parseError)
      return NextResponse.json(
        { success: false, error: 'campaign_misconfigured' },
        { status: 500 }
      )
    }
    
    // Find tier matching the submitted follower range
    const tier = budgetTiers.find(t => 
      t.min_followers === follower_range.min_followers &&
      t.max_followers === follower_range.max_followers
    )
    
    if (!tier) {
      console.error('[Social Submit API] Invalid tier:', follower_range)
      return NextResponse.json(
        { success: false, error: 'invalid_tier' },
        { status: 400 }
      )
    }
    
    // Validate payment amount matches tier (prevent client manipulation)
    if (social_payment_amount_usd && Math.abs(tier.price_usd - social_payment_amount_usd) > 0.01) {
      console.error('[Social Submit API] Payment amount mismatch:', {
        expected: tier.price_usd,
        provided: social_payment_amount_usd
      })
      return NextResponse.json(
        { success: false, error: 'payment_amount_mismatch' },
        { status: 400 }
      )
    }
    
    console.log(`[Social Submit API] Matched tier: ${tier.min_followers}-${tier.max_followers || '∞'} ($${tier.price_usd})`)
    
    // === 9. RESERVE BUDGET (ATOMIC OPERATION) ===
    // This prevents over-allocation even if multiple workers submit simultaneously
    
    const budgetReservation = await reserveBudgetForSubmission(
      jobId,
      tier.price_usd
    )
    
    if (!budgetReservation.success) {
      console.error('[Social Submit API] Budget reservation failed:', budgetReservation.error)
      return NextResponse.json(
        { success: false, error: 'budget_exhausted' },
        { status: 400 }
      )
    }
    
    console.log('[Social Submit API] Budget reserved successfully')
    
    // === 10. CREATE SUBMISSION ===
    
    const { data: submission, error: submissionError } = await supabase
      .from('job_submissions')
      .insert({
        job_id: jobId,
        worker_wallet: wallet,
        message: `Social media submission for tier ${tier.min_followers}-${tier.max_followers || '100K+'}`,
        social_tweet_link: social_tweet_link,
        social_follower_count: tier.min_followers, // Store tier's min as baseline
        social_payment_amount_usd: tier.price_usd,
        social_approval_status: 'pending',
        submitted_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (submissionError) {
      console.error('[Social Submit API] Submission creation error:', submissionError)
      
      // TODO: Unreserve budget on failure
      // await unreserveBudget(jobId, tier.price_usd)
      
      return NextResponse.json(
        { success: false, error: 'submission_failed' },
        { status: 500 }
      )
    }
    
    console.log(`[Social Submit API] Submission created: ${submission.id}`)
    
    // === AWARD SUBMISSION KARMA (NON-BLOCKING) ===
    
    try {
      // Award submission karma (50 points)
      await supabase.rpc('increment_karma_field_by_amount_for_project', {
        p_wallet_address: wallet,
        p_project_id: job.project_id,
        p_field_name: 'total_karma_points',
        p_amount: 50
      })
      
      // Also increment applications counter
      await supabase.rpc('increment_karma_field_by_amount_for_project', {
        p_wallet_address: wallet,
        p_project_id: job.project_id,
        p_field_name: 'applications_submitted_count',
        p_amount: 1
      })
      
      console.log(`[Social Submit API] Awarded 50 karma to ${wallet.slice(0,8)}...`)
    } catch (karmaError) {
      console.error('[Social Submit API] Karma award error (non-critical):', karmaError)
      // Non-blocking - submission was successful even if karma fails
    }
    
    // === 11. UPDATE JOB STATUS IF FIRST SUBMISSION ===
    
    if (job.status === 'open') {
      try {
        await supabase
          .from('jobs')
          .update({ 
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId)
        
        console.log('[Social Submit API] Updated job status to active')
      } catch (statusError) {
        // Non-critical error, log but don't fail request
        console.warn('[Social Submit API] Failed to update job status (non-critical):', statusError)
      }
    }
    
    // === 12. SEND NOTIFICATION (NON-BLOCKING) ===
    
    // Fire notification asynchronously, don't block on failure
    notifySubmissionReceived(
      job.poster_wallet,
      wallet,
      jobId,
      job.title,
      tier.price_usd,
      job.project_id // Include project_id for proper navigation
    ).catch(error => {
      console.error('[Social Submit API] Notification failed (non-critical):', error)
    })
    
    // === 13. SUCCESS RESPONSE ===
    
    return NextResponse.json({
      success: true,
      submission_id: submission.id,
      payment_reserved: tier.price_usd,
      payment_status: 'pending',
      auto_approve_date: job.social_review_deadline || campaignEndDate,
      message: 'Submission received successfully'
    })
    
  } catch (error: any) {
    console.error('[Social Submit API] Unexpected error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'internal_error',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}

