import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/jobs/[jobId]/reassign
 * 
 * Reassigns a job from the current worker to a new worker.
 * Only the job poster can reassign a job.
 * 
 * Security:
 * - CRITICAL: Requires Supabase JWT authentication
 * - Only the authenticated job poster can reassign
 * 
 * Request body:
 * - new_worker_wallet: string (required) - Wallet of the new worker to assign
 * - committed_completion_date?: string - Optional new completion date
 * 
 * Actions:
 * 1. Authenticate user via Supabase JWT
 * 2. Verify caller is the job poster
 * 3. Record job failure for current worker
 * 4. Apply -50 karma penalty to current worker
 * 5. Update job assignment to new worker
 * 6. Send notifications to both workers
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    // Parse request body
    const body = await request.json()
    const { new_worker_wallet, committed_completion_date } = body

    if (!new_worker_wallet) {
      return NextResponse.json(
        { error: 'New worker wallet is required' },
        { status: 400 }
      )
    }

    // ==================== AUTHENTICATION ====================

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Reassign API] Missing authorization header')
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('[Reassign API] Invalid auth token:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    console.log(`[Reassign API] Authenticated user: ${user.id}`)

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.wallet_address) {
      console.error('[Reassign API] No wallet found for user:', profileError)
      return NextResponse.json(
        { error: 'No wallet address linked to account' },
        { status: 403 }
      )
    }

    const authenticatedWallet = profile.wallet_address
    console.log(`[Reassign API] User wallet: ${authenticatedWallet}`)
    console.log(`[Reassign API] Processing reassignment for job ${jobId}`)
    console.log(`[Reassign API] New worker: ${new_worker_wallet.slice(0, 8)}...`)

    // ==================== FETCH AND VALIDATE JOB ====================

    // Fetch job details
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('[Reassign API] Job fetch error:', jobError)
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // ==================== AUTHORIZATION ====================

    // Verify user is the job poster
    if (authenticatedWallet !== job.poster_wallet) {
      console.warn(`[Reassign API] Unauthorized: not the poster`)
      return NextResponse.json(
        { error: 'Only the job poster can reassign the job' },
        { status: 403 }
      )
    }

    console.log('[Reassign API] ✅ Authorization verified')

    // Check job status
    if (job.status !== 'assigned') {
      return NextResponse.json(
        { error: `Cannot reassign a job with status "${job.status}". Job must be in "assigned" status.` },
        { status: 400 }
      )
    }

    // Check current assignment
    if (!job.assigned_to) {
      return NextResponse.json(
        { error: 'No worker currently assigned to this job' },
        { status: 400 }
      )
    }

    // Check not reassigning to same worker
    if (job.assigned_to === new_worker_wallet) {
      return NextResponse.json(
        { error: 'Cannot reassign to the same worker' },
        { status: 400 }
      )
    }

    const previousWorker = job.assigned_to

    // 1. Record job failure for current worker
    console.log(`[Reassign API] Recording failure for ${previousWorker.slice(0, 8)}...`)
    const { error: failureError } = await supabaseAdmin
      .from('job_failures')
      .insert({
        job_id: job.id,
        worker_wallet: previousWorker,
        failure_type: 'reassigned'
      })

    if (failureError) {
      console.error('[Reassign API] Failed to record job failure:', failureError)
      // Continue anyway - this is not critical
    }

    // 2. Apply -50 karma penalty to current worker
    console.log(`[Reassign API] Applying karma penalty to ${previousWorker.slice(0, 8)}...`)
    const { error: karmaError } = await supabaseAdmin
      .rpc('add_karma', {
        p_wallet: previousWorker,
        p_project_id: job.project_id,
        p_karma_delta: -50
      })

    if (karmaError) {
      console.warn('[Reassign API] Failed to apply karma penalty:', karmaError)
      // Continue anyway - karma penalty is not critical
    }

    // 3. Update job assignment
    console.log(`[Reassign API] Updating job assignment to ${new_worker_wallet.slice(0, 8)}...`)
    const updateData: any = {
      assigned_to: new_worker_wallet,
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (committed_completion_date) {
      updateData.worker_committed_completion = committed_completion_date
    }

    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update(updateData)
      .eq('id', job.id)

    if (updateError) {
      console.error('[Reassign API] Failed to update job:', updateError)
      return NextResponse.json(
        { error: 'Failed to update job assignment' },
        { status: 500 }
      )
    }

    // 4. Send notification to new worker
    console.log(`[Reassign API] Sending notification to new worker`)
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_wallet: new_worker_wallet,
        type: 'job_assigned',
        job_id: job.id,
        actor_wallet: authenticatedWallet,
        reference_id: job.id,
        reference_type: 'job',
        metadata: {
          job_title: job.title,
          payment_amount: job.payment_amount_tokens,
          reassignment: true
        }
      })

    // 5. Send notification to previous worker
    console.log(`[Reassign API] Sending notification to previous worker`)
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_wallet: previousWorker,
        type: 'job_assigned',
        job_id: job.id,
        actor_wallet: authenticatedWallet,
        reference_id: job.id,
        reference_type: 'job',
        metadata: {
          job_title: job.title,
          reassigned_away: true,
          karma_penalty: -50
        }
      })

    console.log(`[Reassign API] ✅ Job successfully reassigned`)

    return NextResponse.json({
      success: true,
      message: 'Job reassigned successfully',
      previous_worker: previousWorker,
      new_worker: new_worker_wallet,
      karma_penalty_applied: !karmaError
    })

  } catch (error: any) {
    console.error('[Reassign API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to reassign job' },
      { status: 500 }
    )
  }
}

