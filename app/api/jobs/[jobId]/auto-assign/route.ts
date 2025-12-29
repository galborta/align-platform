import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notificationService } from '@/lib/services/notificationService'
import { Database } from '@/types/database'

// Use service role for reliable auto-assignment (bypasses RLS)
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const startTime = Date.now()
  
  try {
    // Await params in Next.js 15+
    const { jobId } = await params
    const { applicationId, applicantWallet } = await request.json()

    console.log(`[Auto-assign] Starting for job ${jobId}, applicant ${applicantWallet.slice(0, 8)}...`)

    // 1. Check if job is still open and in first_come mode
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('[Auto-assign] Job not found:', jobError)
      return NextResponse.json({ error: 'Job not found', success: false }, { status: 404 })
    }

    if (job.status !== 'open') {
      console.warn(`[Auto-assign] Job ${jobId} is no longer open (status: ${job.status})`)
      return NextResponse.json({ 
        error: 'Job is no longer open - it may have been assigned to someone else', 
        success: false 
      }, { status: 400 })
    }

    if (job.assignment_mode !== 'first_come') {
      console.warn(`[Auto-assign] Job ${jobId} is not in first-come mode`)
      return NextResponse.json({ error: 'Job is not in first-come mode', success: false }, { status: 400 })
    }

    // 2. Get worker's committed deadline from their application
    const { data: application, error: appError } = await supabaseAdmin
      .from('job_applications')
      .select('committed_completion_date')
      .eq('id', applicationId)
      .single()

    if (appError || !application) {
      console.error('[Auto-assign] Application not found:', appError)
      return NextResponse.json({ error: 'Application not found', success: false }, { status: 404 })
    }

    // 3. Assign the job to this applicant with hard deadline
    // Use .select() to verify the update actually happened
    const { data: updatedJob, error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({
        status: 'assigned',
        assigned_to: applicantWallet,
        assigned_at: new Date().toISOString(),
        hard_deadline: application.committed_completion_date,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('status', 'open') // Race condition protection - only update if still open
      .select('id, status, assigned_to')
      .single()

    if (updateError) {
      console.error('[Auto-assign] Database update error:', {
        error: updateError,
        code: updateError.code,
        message: updateError.message,
        details: updateError.details
      })
      return NextResponse.json({ 
        error: 'Failed to assign job - database error', 
        success: false,
        details: updateError.message 
      }, { status: 500 })
    }

    // Verify the job was actually updated (no rows affected = someone else got it first)
    if (!updatedJob) {
      console.warn(`[Auto-assign] Job ${jobId} was not updated - likely assigned to someone else`)
      return NextResponse.json({ 
        error: 'Job was already assigned to another applicant', 
        success: false 
      }, { status: 409 }) // 409 Conflict
    }

    // Double-check assignment
    if (updatedJob.assigned_to !== applicantWallet) {
      console.error(`[Auto-assign] Assignment mismatch! Expected ${applicantWallet}, got ${updatedJob.assigned_to}`)
      return NextResponse.json({ 
        error: 'Assignment verification failed', 
        success: false 
      }, { status: 500 })
    }

    // 4. Notify the assigned worker (non-blocking)
    try {
      await notificationService.createNotification({
        userWallet: applicantWallet,
        type: 'job_assigned',
        actorWallet: job.poster_wallet,
        referenceId: jobId,
        referenceType: 'job',
        metadata: {
          job_title: job.title,
          job_type: job.category,
          project_id: job.project_id
        }
      })
    } catch (notificationError) {
      console.error('[Auto-assign] Failed to create notification:', notificationError)
      // Continue - notification failure is non-critical
    }

    const duration = Date.now() - startTime
    console.log(`✅ [Auto-assign] Success! Job ${jobId} assigned to ${applicantWallet.slice(0, 8)}... (${duration}ms)`)

    return NextResponse.json({
      success: true,
      message: 'Job auto-assigned successfully',
      job: {
        id: updatedJob.id,
        status: updatedJob.status,
        assigned_to: updatedJob.assigned_to
      }
    })
  } catch (error: any) {
    console.error('[Auto-assign] Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      success: false,
      details: error.message 
    }, { status: 500 })
  }
}




