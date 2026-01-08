import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { verifyRequestSignature } from '@/lib/signature-auth'
import { notificationService } from '@/lib/services/notificationService'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/jobs/[jobId]/extend-deadline
 * 
 * Extends the deadline for a job (Regular, Contest, or Social Media job)
 * 
 * Authentication:
 * - Requires wallet signature verification
 * - User's wallet must match the job poster's wallet OR be an active admin
 * 
 * Returns:
 * - 200: { success: true }
 * - 400: { error: string } - Invalid request or business rule violation
 * - 401: { error: string } - Unauthorized (missing/invalid signature)
 * - 403: { error: string } - Forbidden (not the poster or admin)
 * - 404: { error: string } - Job not found
 * - 500: { error: string } - Internal server error
 * 
 * Request Body:
 * - wallet: string - Wallet address
 * - signature: string - Cryptographic signature
 * - message: string - Signed message
 * - new_deadline: string - ISO timestamp for new deadline
 * - deadline_type: 'poster_desired' | 'hard_deadline' | 'contest_submission' | 'social_submission'
 * 
 * Security:
 * - Signature verification prevents unauthorized modifications
 * - Only poster or admin can extend deadlines
 * - Validates new deadline > current deadline
 * - Validates job status allows extension
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const startTime = Date.now()
  
  try {
    // ==================== PARSE PARAMETERS ====================
    
    const { jobId } = await params
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID required' },
        { status: 400 }
      )
    }
    
    console.log(`[Extend Deadline API] Processing request for job ${jobId}`)
    
    // ==================== PARSE REQUEST BODY ====================
    
    const body = await request.json()
    const { wallet, signature, message, new_deadline, deadline_type } = body
    
    if (!new_deadline) {
      return NextResponse.json(
        { error: 'New deadline required' },
        { status: 400 }
      )
    }
    
    // ==================== VERIFY SIGNATURE ====================
    
    const authResult = verifyRequestSignature(
      { wallet, signature, message },
      {
        action: 'Extend deadline',
        resourceId: jobId,
        maxAge: 2 * 60 * 1000 // 2 minutes
      }
    )
    
    if (!authResult.success) {
      console.error('[Extend Deadline API] Signature verification failed:', authResult.error)
      return NextResponse.json(
        { error: authResult.error || 'Invalid signature' },
        { status: 401 }
      )
    }
    
    const authenticatedWallet = authResult.wallet!
    console.log(`[Extend Deadline API] ✅ Authenticated: ${authenticatedWallet.slice(0, 8)}...`)
    
    // ==================== FETCH JOB ====================
    
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    
    if (jobError || !job) {
      console.error('[Extend Deadline API] Job fetch error:', jobError)
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }
    
    console.log('[Extend Deadline API] Job found:', {
      id: job.id,
      status: job.status,
      is_contest: job.is_contest,
      is_social_media_job: job.is_social_media_job
    })
    
    // ==================== AUTHORIZATION ====================
    
    // Check if user is an admin (admin override)
    const { data: adminCheck } = await supabaseAdmin
      .from('admin_wallets')
      .select('wallet_address, role, is_active')
      .eq('wallet_address', authenticatedWallet)
      .eq('is_active', true)
      .maybeSingle()
    
    const isAdmin = !!adminCheck
    
    console.log('[Extend Deadline API] Authorization check:', {
      poster: job.poster_wallet,
      authenticated: authenticatedWallet,
      isAdmin,
      adminRole: adminCheck?.role
    })
    
    // Verify user is either the job poster OR an admin
    if (job.poster_wallet !== authenticatedWallet && !isAdmin) {
      console.warn(`[Extend Deadline API] Unauthorized attempt by ${authenticatedWallet}`)
      return NextResponse.json(
        { error: 'Only the job poster or an admin can extend deadlines' },
        { status: 403 }
      )
    }
    
    if (isAdmin && job.poster_wallet !== authenticatedWallet) {
      console.log(`[Extend Deadline API] ⚠️  Admin override: ${authenticatedWallet} (${adminCheck?.role})`)
    }
    
    // ==================== VALIDATE BUSINESS RULES ====================
    
    // Check job status allows extension
    const allowedStatuses = ['open', 'assigned', 'submitted']
    if (!allowedStatuses.includes(job.status)) {
      return NextResponse.json(
        { error: `Cannot extend deadline for job with status: ${job.status}. Job must be open, assigned, or submitted.` },
        { status: 400 }
      )
    }
    
    // Parse new deadline
    const newDeadlineDate = new Date(new_deadline)
    if (isNaN(newDeadlineDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid deadline format' },
        { status: 400 }
      )
    }
    
    // Validate new deadline is in the future
    const now = new Date()
    if (newDeadlineDate <= now) {
      return NextResponse.json(
        { error: 'New deadline must be in the future' },
        { status: 400 }
      )
    }
    
    // ==================== BUILD UPDATE PAYLOAD ====================
    
    const updates: any = {
      updated_at: new Date().toISOString()
    }
    
    let oldDeadline: string | null = null
    let notificationDeadlineType: string = ''
    
    // Determine which fields to update based on job type
    if (job.is_social_media_job) {
      // Social Media Job: Update all three cascading deadlines
      oldDeadline = job.social_submission_deadline
      
      // Validate new deadline > current deadline
      if (oldDeadline && newDeadlineDate <= new Date(oldDeadline)) {
        return NextResponse.json(
          { error: 'New deadline must be after current submission deadline' },
          { status: 400 }
        )
      }
      
      // Calculate cascading deadlines
      const submissionDeadline = newDeadlineDate
      const engagementDeadline = new Date(submissionDeadline)
      engagementDeadline.setDate(engagementDeadline.getDate() + 7) // +7 days
      const reviewDeadline = new Date(submissionDeadline)
      reviewDeadline.setDate(reviewDeadline.getDate() + 1) // +1 day
      
      updates.social_submission_deadline = submissionDeadline.toISOString()
      updates.social_engagement_deadline = engagementDeadline.toISOString()
      updates.social_review_deadline = reviewDeadline.toISOString()
      
      notificationDeadlineType = 'campaign'
      
      console.log('[Extend Deadline API] Social job deadlines updated:', {
        submission: submissionDeadline.toISOString(),
        engagement: engagementDeadline.toISOString(),
        review: reviewDeadline.toISOString()
      })
      
    } else if (job.is_contest) {
      // Contest Job: Update submission and auto-calculate winner selection deadline
      oldDeadline = job.contest_submission_deadline
      
      // Validate new deadline > current deadline
      if (oldDeadline && newDeadlineDate <= new Date(oldDeadline)) {
        return NextResponse.json(
          { error: 'New deadline must be after current submission deadline' },
          { status: 400 }
        )
      }
      
      // Check winners haven't been selected yet
      if (job.contest_winners_selected_at) {
        return NextResponse.json(
          { error: 'Cannot extend deadline after winners have been selected' },
          { status: 400 }
        )
      }
      
      // Calculate winner selection deadline (+3 days)
      const submissionDeadline = newDeadlineDate
      const selectionDeadline = new Date(submissionDeadline)
      selectionDeadline.setDate(selectionDeadline.getDate() + 3)
      
      updates.contest_submission_deadline = submissionDeadline.toISOString()
      updates.contest_winner_selection_deadline = selectionDeadline.toISOString()
      
      notificationDeadlineType = 'contest'
      
      console.log('[Extend Deadline API] Contest deadlines updated:', {
        submission: submissionDeadline.toISOString(),
        selection: selectionDeadline.toISOString()
      })
      
    } else {
      // Regular Job: Update specified deadline type
      if (deadline_type === 'hard_deadline') {
        oldDeadline = job.hard_deadline
        
        if (oldDeadline && newDeadlineDate <= new Date(oldDeadline)) {
          return NextResponse.json(
            { error: 'New hard deadline must be after current hard deadline' },
            { status: 400 }
          )
        }
        
        updates.hard_deadline = newDeadlineDate.toISOString()
        notificationDeadlineType = 'hard deadline'
        
      } else {
        // Default to poster_desired_completion
        oldDeadline = job.poster_desired_completion
        
        if (oldDeadline && newDeadlineDate <= new Date(oldDeadline)) {
          return NextResponse.json(
            { error: 'New deadline must be after current desired completion date' },
            { status: 400 }
          )
        }
        
        updates.poster_desired_completion = newDeadlineDate.toISOString()
        notificationDeadlineType = 'completion deadline'
      }
      
      console.log('[Extend Deadline API] Regular job deadline updated:', {
        type: deadline_type || 'poster_desired_completion',
        new: newDeadlineDate.toISOString()
      })
    }
    
    // ==================== UPDATE DATABASE ====================
    
    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update(updates)
      .eq('id', jobId)
    
    if (updateError) {
      console.error('[Extend Deadline API] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update job deadline' },
        { status: 500 }
      )
    }
    
    console.log('[Extend Deadline API] ✅ Job updated successfully')
    
    // ==================== SEND NOTIFICATIONS ====================
    
    try {
      // Notify assigned worker (regular jobs)
      if (job.assigned_to && !job.is_contest && !job.is_social_media_job) {
        await notificationService.createNotification({
          userWallet: job.assigned_to,
          type: 'job_deadline_extended',
          actorWallet: job.poster_wallet,
          referenceId: jobId,
          referenceType: 'job',
          metadata: {
            job_title: job.title,
            old_deadline: oldDeadline,
            new_deadline: newDeadlineDate.toISOString(),
            deadline_type: notificationDeadlineType
          }
        })
        console.log('[Extend Deadline API] Notification sent to assigned worker')
      }
      
      // Notify contest participants (if contest)
      if (job.is_contest) {
        // Get all unique participants who have submitted
        const { data: submissions } = await supabaseAdmin
          .from('job_submissions')
          .select('worker_wallet')
          .eq('job_id', jobId)
        
        if (submissions && submissions.length > 0) {
          const uniqueWorkers = [...new Set(submissions.map(s => s.worker_wallet))]
          
          // Send notification to each participant
          for (const workerWallet of uniqueWorkers) {
            await notificationService.createNotification({
              userWallet: workerWallet,
              type: 'job_deadline_extended',
              actorWallet: job.poster_wallet,
              referenceId: jobId,
              referenceType: 'job',
              metadata: {
                job_title: job.title,
                old_deadline: oldDeadline,
                new_deadline: newDeadlineDate.toISOString(),
                deadline_type: notificationDeadlineType
              }
            })
          }
          console.log(`[Extend Deadline API] Notifications sent to ${uniqueWorkers.length} contest participants`)
        }
      }
      
      // Notify social job participants
      if (job.is_social_media_job) {
        // Get all unique participants who have submitted
        const { data: submissions } = await supabaseAdmin
          .from('job_submissions')
          .select('worker_wallet')
          .eq('job_id', jobId)
        
        if (submissions && submissions.length > 0) {
          const uniqueWorkers = [...new Set(submissions.map(s => s.worker_wallet))]
          
          // Send notification to each participant
          for (const workerWallet of uniqueWorkers) {
            await notificationService.createNotification({
              userWallet: workerWallet,
              type: 'job_deadline_extended',
              actorWallet: job.poster_wallet,
              referenceId: jobId,
              referenceType: 'job',
              metadata: {
                job_title: job.title,
                old_deadline: oldDeadline,
                new_deadline: newDeadlineDate.toISOString(),
                deadline_type: notificationDeadlineType
              }
            })
          }
          console.log(`[Extend Deadline API] Notifications sent to ${uniqueWorkers.length} social job participants`)
        }
      }
      
    } catch (notificationError) {
      console.error('[Extend Deadline API] Notification error:', notificationError)
      // Don't fail the request - deadline was extended successfully
    }
    
    // ==================== RETURN SUCCESS ====================
    
    const duration = Date.now() - startTime
    console.log(`[Extend Deadline API] ✅ Success in ${duration}ms`)
    
    return NextResponse.json({
      success: true,
      old_deadline: oldDeadline,
      new_deadline: newDeadlineDate.toISOString()
    })
    
  } catch (error) {
    console.error('[Extend Deadline API] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: 'Please contact support if this persists'
      },
      { status: 500 }
    )
  }
}

