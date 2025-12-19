import { supabase } from './supabase'

/**
 * Check if a job's deadline has passed without submission
 * 
 * This function verifies:
 * 1. Job exists and is in 'assigned' status
 * 2. Work has not been submitted
 * 3. Hard deadline exists
 * 4. Current time is past the deadline
 * 
 * @param jobId - The UUID of the job to check
 * @returns Boolean indicating if deadline has passed
 * 
 * @example
 * const isPastDeadline = await checkDeadlinePassed(jobId)
 * if (isPastDeadline) {
 *   // Allow poster to cancel
 * }
 */
export async function checkDeadlinePassed(jobId: string): Promise<boolean> {
  try {
    const { data: job, error } = await supabase
      .from('jobs')
      .select('hard_deadline, submitted_at, status')
      .eq('id', jobId)
      .single()
    
    if (error) {
      console.error('Error fetching job for deadline check:', error)
      return false
    }
    
    if (!job) {
      console.warn(`Job ${jobId} not found for deadline check`)
      return false
    }
    
    // Only check if job is assigned and not submitted
    if (job.status !== 'assigned' || job.submitted_at) {
      return false
    }
    
    // Check if deadline has passed
    if (!job.hard_deadline) {
      return false
    }
    
    const deadline = new Date(job.hard_deadline)
    const now = new Date()
    
    return now > deadline
  } catch (error) {
    console.error('Exception in checkDeadlinePassed:', error)
    return false
  }
}

/**
 * Allow poster to cancel job due to missed deadline
 * 
 * This function:
 * 1. Verifies the deadline has passed
 * 2. Verifies the caller is the job poster
 * 3. Updates job status to 'cancelled'
 * 4. Creates a job_failure record for the worker
 * 5. TODO: Triggers refund transaction to poster (Sprint 4)
 * 6. TODO: Deducts karma from worker (Sprint 4)
 * 
 * @param jobId - The UUID of the job to cancel
 * @param posterWallet - The wallet address of the poster (for verification)
 * @returns Object with success status and optional error message
 * 
 * @example
 * const result = await cancelJobDueToMissedDeadline(jobId, posterWallet)
 * if (result.success) {
 *   console.log('Job cancelled, refund processed')
 * } else {
 *   console.error('Cancellation failed:', result.error)
 * }
 */
export async function cancelJobDueToMissedDeadline(
  jobId: string,
  posterWallet: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Step 1: Verify deadline has passed
    const deadlinePassed = await checkDeadlinePassed(jobId)
    if (!deadlinePassed) {
      console.warn(`Attempted to cancel job ${jobId} but deadline has not passed`)
      return {
        success: false,
        error: 'Deadline has not passed yet'
      }
    }
    
    // Step 2: Fetch job and verify poster
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    
    if (jobError) {
      console.error('Error fetching job for cancellation:', jobError)
      return { 
        success: false, 
        error: 'Job not found' 
      }
    }
    
    if (!job) {
      console.warn(`Job ${jobId} not found for cancellation`)
      return { 
        success: false, 
        error: 'Job not found' 
      }
    }
    
    // Step 3: Verify caller is the poster
    if (job.poster_wallet !== posterWallet) {
      console.warn(`Unauthorized cancellation attempt on job ${jobId} by ${posterWallet}`)
      return { 
        success: false, 
        error: 'Only poster can cancel this job' 
      }
    }
    
    // Step 4: Update job status to cancelled
    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
    
    if (updateError) {
      console.error('Error updating job status to cancelled:', updateError)
      throw updateError
    }
    
    console.log(`✅ Job ${jobId} cancelled due to missed deadline`)
    
    // Step 5: Create job_failure record for worker
    if (job.assigned_to) {
      const { error: failureError } = await supabase
        .from('job_failures')
        .insert({
          job_id: jobId,
          worker_wallet: job.assigned_to,
          failure_type: 'ghosted'
        })
      
      if (failureError) {
        console.error('Failed to create job_failure record:', failureError)
        // Don't fail the entire operation if failure record creation fails
      } else {
        console.log(`✅ Created failure record for worker ${job.assigned_to}`)
      }
    }
    
    // TODO: Sprint 4 - Trigger escrow refund transaction to poster
    // const refundResult = await refundEscrowToPoster(jobId, posterWallet)
    
    // TODO: Sprint 4 - Deduct karma from worker (-100 points for ghosting)
    // await deductWorkerKarma(job.assigned_to, job.project_id, 100, 'missed_deadline')
    
    return { success: true }
    
  } catch (error) {
    console.error('Exception in cancelJobDueToMissedDeadline:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel job'
    }
  }
}

/**
 * Calculate days until deadline
 * 
 * Returns:
 * - Positive number: Days remaining until deadline
 * - Zero: Deadline is today
 * - Negative number: Days past deadline (overdue)
 * 
 * @param deadline - ISO timestamp string of the deadline
 * @returns Number of days until (positive) or past (negative) deadline
 * 
 * @example
 * const days = getDaysUntilDeadline('2024-12-31T00:00:00Z')
 * if (days < 0) {
 *   console.log(`Overdue by ${Math.abs(days)} days`)
 * } else if (days === 0) {
 *   console.log('Deadline is today!')
 * } else {
 *   console.log(`${days} days remaining`)
 * }
 */
export function getDaysUntilDeadline(deadline: string): number {
  try {
    const deadlineDate = new Date(deadline)
    const now = new Date()
    const diffTime = deadlineDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  } catch (error) {
    console.error('Error calculating days until deadline:', error)
    return 0
  }
}

/**
 * Get all jobs with overdue deadlines
 * 
 * This function finds jobs that:
 * - Are in 'assigned' status
 * - Have a hard_deadline set
 * - Deadline has passed
 * - Work has not been submitted
 * 
 * Useful for admin dashboards and automated enforcement.
 * 
 * @returns Array of jobs with overdue deadlines
 * 
 * @example
 * const overdueJobs = await getOverdueJobs()
 * console.log(`Found ${overdueJobs.length} overdue jobs`)
 */
export async function getOverdueJobs() {
  try {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'assigned')
      .not('hard_deadline', 'is', null)
      .is('submitted_at', null)
      .lt('hard_deadline', new Date().toISOString())
      .order('hard_deadline', { ascending: true })
    
    if (error) {
      console.error('Error fetching overdue jobs:', error)
      return []
    }
    
    return jobs || []
  } catch (error) {
    console.error('Exception in getOverdueJobs:', error)
    return []
  }
}

/**
 * Get jobs with approaching deadlines
 * 
 * Finds jobs where the deadline is within the specified number of days.
 * Useful for sending reminder notifications.
 * 
 * @param daysThreshold - Number of days before deadline to consider "approaching"
 * @returns Array of jobs with approaching deadlines
 * 
 * @example
 * // Get jobs due in next 3 days
 * const urgentJobs = await getJobsWithApproachingDeadlines(3)
 * 
 * // Send reminder notifications
 * for (const job of urgentJobs) {
 *   await sendDeadlineReminder(job.assigned_to, job.id)
 * }
 */
export async function getJobsWithApproachingDeadlines(daysThreshold: number = 3) {
  try {
    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + daysThreshold)
    
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'assigned')
      .not('hard_deadline', 'is', null)
      .is('submitted_at', null)
      .gt('hard_deadline', now.toISOString())
      .lt('hard_deadline', futureDate.toISOString())
      .order('hard_deadline', { ascending: true })
    
    if (error) {
      console.error('Error fetching jobs with approaching deadlines:', error)
      return []
    }
    
    return jobs || []
  } catch (error) {
    console.error('Exception in getJobsWithApproachingDeadlines:', error)
    return []
  }
}











