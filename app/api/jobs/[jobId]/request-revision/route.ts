import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notificationService } from '@/lib/services/notificationService'
import { Database } from '@/types/database'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface RevisionRequestBody {
  notes: string
  images?: string[]
  is_voluntary?: boolean
}

/**
 * POST /api/jobs/[jobId]/request-revision
 * 
 * Request a revision from the assigned worker.
 * Only the job poster can request revisions.
 * 
 * Actions:
 * 1. Verify caller is the job poster
 * 2. Check if revisions are available (or voluntary)
 * 3. Update revision count on application
 * 4. Create revision request comment
 * 5. Update job status to 'assigned'
 * 6. Notify the worker
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    // Parse revision request details
    const body: RevisionRequestBody = await request.json()
    const { notes, images = [], is_voluntary = false } = body

    // Validate required fields
    if (!notes || notes.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please provide detailed revision notes (at least 10 characters)' },
        { status: 400 }
      )
    }

    // ==================== AUTHENTICATION ====================

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Request Revision] Missing authorization header')
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Verify JWT token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('[Request Revision] Invalid auth token:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    console.log(`[Request Revision] Authenticated user: ${user.id}`)

    // Get user's wallet from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.wallet_address) {
      console.error('[Request Revision] No wallet found for user:', profileError)
      return NextResponse.json(
        { error: 'No wallet address linked to account' },
        { status: 403 }
      )
    }

    const authenticatedWallet = profile.wallet_address
    console.log(`[Request Revision] User wallet: ${authenticatedWallet}`)

    // ==================== FETCH AND VALIDATE JOB ====================

    console.log(`[Request Revision API] Processing for job ${jobId}`)
    console.log(`[Request Revision API] Voluntary: ${is_voluntary}`)

    // Fetch job details
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('[Request Revision API] Job fetch error:', jobError)
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // ==================== AUTHORIZATION ====================

    // Verify user is the job poster
    if (authenticatedWallet !== job.poster_wallet) {
      console.error('[Request Revision] Unauthorized - not job poster')
      return NextResponse.json(
        { error: 'Only job poster can request revisions' },
        { status: 403 }
      )
    }

    console.log('[Request Revision] ✅ Poster authorization verified')

    // Check job status
    if (job.status !== 'submitted') {
      return NextResponse.json(
        { error: `Cannot request revision for job with status "${job.status}". Job must be in "submitted" status.` },
        { status: 400 }
      )
    }

    // Check assignment
    if (!job.assigned_to) {
      return NextResponse.json(
        { error: 'No worker assigned to this job' },
        { status: 400 }
      )
    }

    const workerWallet = job.assigned_to

    // Get worker's application for revision tracking
    const { data: application, error: appError } = await supabaseAdmin
      .from('job_applications')
      .select('id, revisions_offered, revisions_used, revisions_remaining')
      .eq('job_id', jobId)
      .eq('applicant_wallet', workerWallet)
      .single()

    if (appError || !application) {
      console.error('[Request Revision API] Application fetch error:', appError)
      return NextResponse.json(
        { error: 'Worker application not found' },
        { status: 404 }
      )
    }

    // Check revision availability (unless voluntary)
    const currentUsed = application.revisions_used ?? 0
    const newRevisionNumber = currentUsed + 1

    if (!is_voluntary) {
      const offered = application.revisions_offered
      const isUnlimited = offered === 'unlimited'
      const remaining = application.revisions_remaining ?? 0

      if (!isUnlimited && remaining <= 0) {
        return NextResponse.json(
          { error: 'No committed revisions remaining. You can still request a voluntary revision.' },
          { status: 400 }
        )
      }
    }

    // 1. Update application revision count
    console.log(`[Request Revision API] Updating revision count to ${newRevisionNumber}`)
    const { error: updateAppError } = await supabaseAdmin
      .from('job_applications')
      .update({
        revisions_used: newRevisionNumber,
        last_revision_requested_at: new Date().toISOString()
      })
      .eq('id', application.id)

    if (updateAppError) {
      console.error('[Request Revision API] Failed to update application:', updateAppError)
      return NextResponse.json(
        { error: 'Failed to update revision count' },
        { status: 500 }
      )
    }

    // 2. Create revision request comment
    const header = is_voluntary 
      ? `🔄 **Voluntary Revision Request**`
      : `🔄 **Revision Request #${newRevisionNumber}**`
    
    let commentMessage = `${header}\n\n${notes}`
    if (images.length > 0) {
      commentMessage += `\n\n📎 Reference Images:\n`
      images.forEach((url, i) => {
        commentMessage += `- Image ${i + 1}: ${url}\n`
      })
    }

    console.log(`[Request Revision API] Creating comment`)
    const { error: commentError } = await supabaseAdmin
      .from('job_comments')
      .insert({
        job_id: jobId,
        wallet_address: authenticatedWallet,
        message: commentMessage
      })

    if (commentError) {
      console.error('[Request Revision API] Failed to create comment:', commentError)
      // Non-critical - continue
    }

    // 3. Update job status to 'assigned'
    console.log(`[Request Revision API] Updating job status to 'assigned'`)
    const { error: jobUpdateError } = await supabaseAdmin
      .from('jobs')
      .update({
        status: 'assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (jobUpdateError) {
      console.error('[Request Revision API] Failed to update job status:', jobUpdateError)
      return NextResponse.json(
        { error: 'Failed to update job status' },
        { status: 500 }
      )
    }

    // 4. Notify the worker
    console.log(`[Request Revision API] Sending notification to worker`)
    const notificationType = is_voluntary 
      ? 'voluntary_revision_requested' 
      : 'revision_requested'

    try {
      await notificationService.createNotification({
        userWallet: workerWallet,
        type: notificationType,
        actorWallet: authenticatedWallet,
        referenceId: jobId,
        referenceType: 'job',
        metadata: {
          job_title: job.title,
          revision_number: newRevisionNumber,
          project_id: job.project_id,
          is_voluntary: is_voluntary
        }
      })
    } catch (notificationError) {
      console.warn('[Request Revision API] Failed to send notification:', notificationError)
      // Non-critical - continue
    }

    console.log(`[Request Revision API] ✅ Revision request completed`)

    return NextResponse.json({
      success: true,
      message: 'Revision requested successfully',
      revision_number: newRevisionNumber,
      is_voluntary: is_voluntary
    })

  } catch (error: any) {
    console.error('[Request Revision API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to request revision' },
      { status: 500 }
    )
  }
}

