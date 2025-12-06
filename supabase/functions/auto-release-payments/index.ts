// Supabase Edge Function: Auto-Release Payments
// Runs periodically to automatically release payments for jobs that have passed their 10-day review period

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface EligibleJob {
  id: string
  project_id: string
  poster_wallet: string
  assigned_to: string
  title: string
  escrow_amount_tokens: number
  escrow_token_mint: string
  token_symbol: string
  decimals: number
  fee_percentage_at_creation: number
  release_scheduled_at: string
}

interface ProcessResult {
  success: boolean
  jobId: string
  error?: string
}

serve(async (req) => {
  const startTime = Date.now()
  
  try {
    console.log('[Auto-Release] Starting cron job execution')
    
    // ==================== SECURITY: VERIFY CRON REQUEST ====================
    
    const authHeader = req.headers.get('authorization')
    const expectedAuth = `Bearer ${Deno.env.get('CRON_SECRET')}`
    
    if (authHeader !== expectedAuth) {
      console.error('[Auto-Release] Unauthorized request attempt')
      return new Response('Unauthorized', { status: 401 })
    }
    
    console.log('[Auto-Release] ✅ Authorization verified')
    
    // ==================== INITIALIZE SUPABASE CLIENT ====================
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[Auto-Release] Missing Supabase configuration')
      return new Response(JSON.stringify({ 
        error: 'Server configuration error' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    console.log('[Auto-Release] ✅ Supabase client initialized')
    
    // ==================== FIND JOBS ELIGIBLE FOR AUTO-RELEASE ====================
    
    const now = new Date().toISOString()
    console.log(`[Auto-Release] Searching for jobs ready as of ${now}`)
    
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'submitted')
      .eq('release_paused', false)
      .eq('escrow_locked', true)
      .not('release_scheduled_at', 'is', null)
      .lte('release_scheduled_at', now)
      .limit(50) // Process in batches to avoid timeout
    
    if (jobsError) {
      console.error('[Auto-Release] Error fetching jobs:', jobsError)
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch eligible jobs',
        details: jobsError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (!jobs || jobs.length === 0) {
      console.log('[Auto-Release] No jobs ready for auto-release')
      return new Response(JSON.stringify({ 
        message: 'No jobs ready for auto-release',
        count: 0,
        timestamp: now
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    console.log(`[Auto-Release] Found ${jobs.length} job(s) ready for auto-release:`)
    jobs.forEach(job => {
      const overdue = new Date(now).getTime() - new Date(job.release_scheduled_at).getTime()
      const overdueHours = Math.floor(overdue / (1000 * 60 * 60))
      console.log(`  - Job ${job.id} (${job.title}): ${overdueHours}h overdue`)
    })
    
    // ==================== PROCESS EACH JOB ====================
    
    console.log('[Auto-Release] Starting batch processing...')
    const results = await Promise.allSettled(
      jobs.map((job: EligibleJob) => processJobRelease(job, supabase))
    )
    
    // ==================== CALCULATE RESULTS ====================
    
    const successes = results.filter(r => r.status === 'fulfilled').length
    const failures = results.filter(r => r.status === 'rejected').length
    
    const duration = Date.now() - startTime
    console.log(`[Auto-Release] ✅ Batch complete in ${duration}ms`)
    console.log(`[Auto-Release] Results: ${successes} success, ${failures} failed`)
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Auto-release batch processed',
      total: jobs.length,
      successes,
      failures,
      timestamp: now,
      durationMs: duration
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Auto-Release] ❌ Critical error after ${duration}ms:`, error)
    
    return new Response(JSON.stringify({ 
      error: 'Auto-release failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

/**
 * Process payment release for a single job
 * 
 * This function:
 * 1. Calls the existing release-payment API endpoint
 * 2. Sends success notification to worker
 * 3. Handles failures with retry logic
 * 4. Notifies admin if max retries exceeded
 */
async function processJobRelease(
  job: EligibleJob, 
  supabase: any
): Promise<ProcessResult> {
  try {
    console.log(`[Auto-Release] Processing job ${job.id}`)
    
    // ==================== CALL RELEASE PAYMENT API ====================
    
    const appUrl = Deno.env.get('APP_URL')
    if (!appUrl) {
      throw new Error('APP_URL not configured')
    }
    
    const releaseUrl = `${appUrl}/api/jobs/${job.id}/release-payment`
    console.log(`[Auto-Release] Calling: ${releaseUrl}`)
    
    const response = await fetch(releaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SERVICE_AUTH_TOKEN') || 'auto-release-internal'}`
      },
      body: JSON.stringify({
        poster_wallet: job.poster_wallet,
        auto_release: true
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Auto-Release] API returned ${response.status}:`, errorText)
      throw new Error(`Release API failed (${response.status}): ${errorText}`)
    }
    
    const result = await response.json()
    console.log(`[Auto-Release] ✅ Payment released for job ${job.id}`)
    console.log(`[Auto-Release]    Worker received: ${result.workerReceived} ${job.token_symbol || 'tokens'}`)
    console.log(`[Auto-Release]    Fee collected: ${result.feeCollected}`)
    
    // ==================== SEND SUCCESS NOTIFICATION ====================
    
    try {
      await supabase.from('notifications').insert({
        wallet_address: job.assigned_to,
        type: 'job_auto_released',
        title: 'Payment Auto-Released',
        message: `Your payment of ${result.workerReceived} ${job.token_symbol || 'tokens'} for "${job.title}" has been automatically released!`,
        job_id: job.id,
        project_id: job.project_id,
        created_at: new Date().toISOString()
      })
      console.log(`[Auto-Release] ✅ Notification sent to worker ${job.assigned_to}`)
    } catch (notifError) {
      console.error('[Auto-Release] ⚠️ Failed to send notification:', notifError)
      // Non-critical - payment already released
    }
    
    return { success: true, jobId: job.id }
    
  } catch (error) {
    console.error(`[Auto-Release] ❌ Failed to process job ${job.id}:`, error)
    
    // ==================== RETRY LOGIC ====================
    
    try {
      // Get existing transaction record to check retry count
      const { data: existingTx } = await supabase
        .from('job_escrow_transactions')
        .select('retry_count')
        .eq('job_id', job.id)
        .eq('transaction_type', 'release_to_worker')
        .eq('status', 'pending')
        .maybeSingle()
      
      const retryCount = (existingTx?.retry_count || 0) + 1
      const maxRetries = 3
      
      if (retryCount < maxRetries) {
        // Will retry on next cron execution
        console.log(`[Auto-Release] Job ${job.id} will retry (attempt ${retryCount}/${maxRetries})`)
        
        // Update retry count if transaction record exists
        if (existingTx) {
          await supabase
            .from('job_escrow_transactions')
            .update({ retry_count: retryCount })
            .eq('job_id', job.id)
            .eq('transaction_type', 'release_to_worker')
            .eq('status', 'pending')
        }
      } else {
        // Max retries exceeded - pause and notify admin
        console.log(`[Auto-Release] Max retries exceeded for job ${job.id}, pausing for admin review`)
        
        await supabase
          .from('jobs')
          .update({ 
            release_paused: true,
            release_paused_by: 'system',
            release_paused_at: new Date().toISOString()
          })
          .eq('id', job.id)
        
        // Notify admin
        const adminWallet = Deno.env.get('ADMIN_WALLET')
        if (adminWallet) {
          await supabase.from('notifications').insert({
            wallet_address: adminWallet,
            type: 'job_auto_release_failed',
            title: 'Auto-Release Failed - Admin Action Required',
            message: `Job "${job.title}" (ID: ${job.id}) failed auto-release after ${maxRetries} attempts. Manual intervention required.`,
            job_id: job.id,
            project_id: job.project_id,
            priority: 'high',
            created_at: new Date().toISOString()
          })
          console.log(`[Auto-Release] ✅ Admin notification sent to ${adminWallet}`)
        } else {
          console.warn('[Auto-Release] ⚠️ ADMIN_WALLET not configured - cannot send failure notification')
        }
      }
    } catch (retryError) {
      console.error('[Auto-Release] ⚠️ Failed to handle retry logic:', retryError)
    }
    
    throw error // Re-throw to mark as failed in Promise.allSettled
  }
}






