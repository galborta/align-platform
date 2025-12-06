import { supabase } from './supabase'
import { Database } from '@/types/database'
import { notificationService } from '@/lib/services/notificationService'

type Job = Database['public']['Tables']['jobs']['Row']
type JobInsert = Database['public']['Tables']['jobs']['Insert']
type JobApplication = Database['public']['Tables']['job_applications']['Row']
type JobApplicationInsert = Database['public']['Tables']['job_applications']['Insert']

// Filter types for job queries
export interface JobFilters {
  status?: 'open' | 'assigned' | 'submitted' | 'completed' | 'disputed' | 'cancelled'
  category?: string
  is_contest?: boolean
}

// Extended job type with project info and counts
export interface JobWithDetails extends Job {
  submissionCount?: number
  applicationCount?: number
  projects?: {
    token_name: string
    token_symbol: string
    profile_image_url?: string
  } | null
  job_submissions?: Array<{
    id: string
    worker_wallet: string
    message: string | null
    image_urls: string[] | null
    submitted_at: string
    is_selected_winner: boolean | null
    winner_position: number | null
    prize_amount_tokens: number | null
  }>
}

/**
 * Create a new job posting
 */
export async function createJob(jobData: {
  project_id: string
  poster_wallet: string
  title: string
  description: string
  kpis: string
  category: string
  payment_amount_tokens: number
  payment_amount_usd: number
  assignment_mode: 'first_come' | 'review'
  poster_desired_completion?: string | null
  fee_percentage_at_creation?: number
  escrow_locked?: boolean
  escrow_tx_signature?: string | null
  escrow_amount_tokens?: number | null
  escrow_token_mint?: string | null
  // Contest fields
  is_contest?: boolean
  contest_max_winners?: number | null
  contest_winner_prizes?: Array<{
    position: number
    amount_tokens: number
    amount_usd: number
  }> | null
  contest_submission_deadline?: string | null
  contest_winner_selection_deadline?: string | null
  contest_submissions_visible?: boolean
}): Promise<Job> {
  const { data, error } = await supabase
    .from('jobs')
    .insert(jobData)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Get jobs for a project (simple version)
 */
export async function getProjectJobs(projectId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Fetch jobs with filters and project data
 * 
 * This is the main function for fetching jobs for listing pages.
 * It includes project token info and submission/application counts.
 * 
 * @param projectId - Optional project ID to filter by
 * @param filters - Optional filters for status, category, and job type
 * @returns Array of jobs with project info and counts
 * 
 * @example
 * // Get all open jobs
 * const jobs = await fetchJobs(undefined, { status: 'open' })
 * 
 * // Get contest jobs for a specific project
 * const contestJobs = await fetchJobs(projectId, { is_contest: true })
 */
export async function fetchJobs(
  projectId?: string, 
  filters?: JobFilters
): Promise<JobWithDetails[]> {
  let query = supabase
    .from('jobs')
    .select(`
      *,
      projects:project_id (
        token_name,
        token_symbol
      )
    `)

  // Apply filters
  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.category) {
    query = query.eq('category', filters.category)
  }

  if (filters?.is_contest !== undefined) {
    query = query.eq('is_contest', filters.is_contest)
  }

  // Order by created_at desc
  query = query.order('created_at', { ascending: false })

  const { data: jobs, error } = await query

  if (error) throw error
  if (!jobs) return []

  // For each job, fetch submission count (contests) or application count (regular jobs)
  const jobsWithCounts = await Promise.all(
    jobs.map(async (job) => {
      if (job.is_contest) {
        // Get submission count for contests
        const { count } = await supabase
          .from('job_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', job.id)

        return { ...job, submissionCount: count || 0, applicationCount: 0 }
      } else {
        // Get application count for regular jobs
        const { count } = await supabase
          .from('job_applications')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', job.id)

        return { ...job, submissionCount: 0, applicationCount: count || 0 }
      }
    })
  )

  return jobsWithCounts as JobWithDetails[]
}

/**
 * Fetch a single job by ID with all related data
 * 
 * This is the main function for job detail pages.
 * For contest jobs, it includes all submissions.
 * For regular jobs, use getJobApplications() separately.
 * 
 * @param jobId - The UUID of the job to fetch
 * @returns Job with project info, submissions (for contests), and counts
 * 
 * @example
 * const job = await fetchJobById(jobId)
 * if (job?.is_contest) {
 *   console.log(`Contest has ${job.submissionCount} submissions`)
 *   job.job_submissions?.forEach(sub => console.log(sub.worker_wallet))
 * }
 */
export async function fetchJobById(jobId: string): Promise<JobWithDetails | null> {
  const { data: job, error } = await supabase
    .from('jobs')
    .select(`
      *,
      projects:project_id (
        token_name,
        token_symbol,
        profile_image_url
      ),
      job_submissions (
        id,
        worker_wallet,
        message,
        image_urls,
        submitted_at,
        is_selected_winner,
        winner_position,
        prize_amount_tokens
      )
    `)
    .eq('id', jobId)
    .single()

  if (error) {
    console.error('Error fetching job:', error)
    return null
  }

  // Count submissions for contest jobs
  if (job.is_contest) {
    const { count } = await supabase
      .from('job_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', jobId)

    return { ...job, submissionCount: count || 0 } as JobWithDetails
  }

  // Count applications for regular jobs
  const { count } = await supabase
    .from('job_applications')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', jobId)

  return { ...job, applicationCount: count || 0 } as JobWithDetails
}

/**
 * Apply to a job
 * 
 * Creates a job application and notifies the job poster.
 * Also initializes revision tracking fields when revisions_offered is provided.
 * 
 * @param applicationData.revisions_offered - Number of revisions offered ('1', '2', 'unlimited', etc.)
 *   - If provided, revisions_used is set to 0 and revisions_remaining is auto-computed by trigger
 *   - If null, no revision tracking is enabled for this application
 */
export async function applyToJob(applicationData: {
  job_id: string
  applicant_wallet: string
  pitch: string
  image_urls?: string[]
  estimated_completion: string
  committed_completion_date: string
  revisions_offered?: string | null
}): Promise<JobApplication> {
  // Prepare insert data with revision fields
  const insertData: any = {
    job_id: applicationData.job_id,
    applicant_wallet: applicationData.applicant_wallet,
    pitch: applicationData.pitch,
    image_urls: applicationData.image_urls,
    estimated_completion: applicationData.estimated_completion,
    committed_completion_date: applicationData.committed_completion_date,
    // Revision tracking
    revisions_offered: applicationData.revisions_offered || null,
    revisions_used: 0, // Always start at 0
    // revisions_remaining is auto-computed by the database trigger
    last_revision_requested_at: null
  }

  // Create the application
  const { data, error } = await supabase
    .from('job_applications')
    .insert(insertData)
    .select()
    .single()

  if (error) throw error

  // Notify the job poster (non-blocking)
  try {
    const { data: job } = await supabase
      .from('jobs')
      .select('poster_wallet, title, project_id')
      .eq('id', applicationData.job_id)
      .single()

    if (job) {
      await notificationService.createNotification({
        userWallet: job.poster_wallet,
        type: 'job_application_received',
        actorWallet: applicationData.applicant_wallet,
        referenceId: applicationData.job_id,
        referenceType: 'job',
        metadata: {
          job_title: job.title,
          project_id: job.project_id
        }
      })
    }
  } catch (notificationError) {
    console.error('[applyToJob] Failed to create notification:', notificationError)
    // Don't throw - notification failure should not block application
  }

  return data
}

/**
 * Get job by ID
 */
export async function getJobById(jobId: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (error) {
    console.error('Error fetching job:', error)
    return null
  }
  return data
}

/**
 * Get applications for a job
 */
export async function getJobApplications(jobId: string): Promise<JobApplication[]> {
  const { data, error } = await supabase
    .from('job_applications')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Check if user has already applied to a job
 */
export async function hasAppliedToJob(
  jobId: string,
  walletAddress: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('job_applications')
    .select('id')
    .eq('job_id', jobId)
    .eq('applicant_wallet', walletAddress)
    .maybeSingle()

  if (error) {
    console.error('Error checking application:', error)
    return false
  }

  return !!data
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  status: 'open' | 'assigned' | 'submitted' | 'completed' | 'disputed' | 'cancelled',
  additionalData?: {
    assigned_to?: string
    assigned_at?: string
    submitted_at?: string
    completed_at?: string
    cancelled_at?: string
  }
): Promise<Job> {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
    ...additionalData
  }

  const { data, error } = await supabase
    .from('jobs')
    .update(updateData)
    .eq('id', jobId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Get jobs by poster wallet
 */
export async function getJobsByPoster(posterWallet: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('poster_wallet', posterWallet)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Get jobs by assigned worker
 */
export async function getJobsByWorker(workerWallet: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('assigned_to', workerWallet)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Get jobs where user has applied
 */
export async function getJobsByApplicant(applicantWallet: string): Promise<Job[]> {
  // Get all job IDs where user has applied
  const { data: applications, error: appError } = await supabase
    .from('job_applications')
    .select('job_id')
    .eq('applicant_wallet', applicantWallet)

  if (appError) throw appError
  if (!applications || applications.length === 0) return []

  const jobIds = applications.map(app => app.job_id)

  // Get the jobs
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .in('id', jobIds)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Get application count for a job
 */
export async function getJobApplicationCount(jobId: string): Promise<number> {
  const { count, error } = await supabase
    .from('job_applications')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', jobId)

  if (error) {
    console.error('Error getting application count:', error)
    return 0
  }

  return count || 0
}

/**
 * Assign a job to a worker
 * 
 * This function:
 * 1. Fetches the worker's application to get their committed completion date
 * 2. Sets the job status to 'assigned'
 * 3. Records the worker's wallet address
 * 4. Sets hard_deadline from the worker's committed_completion_date
 * 5. Notifies the assigned worker
 * 
 * The hard_deadline becomes the binding deadline that the worker must meet.
 * If the worker doesn't submit work by this date, the job will be auto-cancelled
 * and karma penalties will be applied.
 * 
 * @param jobId - The UUID of the job to assign
 * @param workerWallet - The wallet address of the worker being assigned
 * @returns Object with success status and optional error message
 * 
 * @example
 * const result = await assignJobToWorker(jobId, workerWallet)
 * if (result.success) {
 *   console.log('Job assigned successfully')
 * } else {
 *   console.error('Assignment failed:', result.error)
 * }
 */
export async function assignJobToWorker(
  jobId: string,
  workerWallet: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get worker's committed deadline from their application
    const { data: application, error: appError } = await supabase
      .from('job_applications')
      .select('committed_completion_date')
      .eq('job_id', jobId)
      .eq('applicant_wallet', workerWallet)
      .single()
    
    if (appError || !application) {
      console.error('Application not found:', appError)
      return {
        success: false,
        error: 'Application not found'
      }
    }
    
    // Update job with assignment AND set hard deadline
    const { error } = await supabase
      .from('jobs')
      .update({
        status: 'assigned',
        assigned_to: workerWallet,
        assigned_at: new Date().toISOString(),
        hard_deadline: application.committed_completion_date, // Set binding deadline from worker's commitment
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (error) throw error

    // Notify the assigned worker (non-blocking)
    try {
      const { data: job } = await supabase
        .from('jobs')
        .select('poster_wallet, title, category')
        .eq('id', jobId)
        .single()

      if (job) {
        await notificationService.createNotification({
          userWallet: workerWallet,
          type: 'job_assigned',
          actorWallet: job.poster_wallet,
          referenceId: jobId,
          referenceType: 'job',
          metadata: {
            job_title: job.title,
            job_type: job.category
          }
        })
      }
    } catch (notificationError) {
      console.error('[assignJobToWorker] Failed to create notification:', notificationError)
      // Continue - notification failure is non-critical
    }

    return { success: true }
  } catch (error) {
    console.error('Error assigning job:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to assign job'
    }
  }
}

/**
 * Get application with applicant stats (karma and completed jobs)
 */
export async function getApplicationWithStats(
  applicationId: string,
  projectId: string
): Promise<JobApplication & { 
  applicant_karma?: number
  applicant_completed_jobs?: number
} | null> {
  try {
    const { data: application, error: appError } = await supabase
      .from('job_applications')
      .select('*')
      .eq('id', applicationId)
      .single()

    if (appError || !application) {
      console.error('Error fetching application:', appError)
      return null
    }

    // Get karma
    const { data: karmaData } = await supabase
      .from('wallet_karma')
      .select('total_karma_points')
      .eq('wallet_address', application.applicant_wallet)
      .eq('project_id', projectId)
      .maybeSingle()

    // Get completed jobs count
    const { count: completedCount } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', application.applicant_wallet)
      .eq('status', 'completed')

    return {
      ...application,
      applicant_karma: karmaData?.total_karma_points || 0,
      applicant_completed_jobs: completedCount || 0
    }
  } catch (error) {
    console.error('Error getting application with stats:', error)
    return null
  }
}

/**
 * Get the assigned worker's application for a job
 * 
 * This function retrieves the application of the currently assigned worker,
 * including all revision-related fields. Useful for:
 * - Displaying revision status on job detail pages
 * - Tracking revision usage for assigned jobs
 * - Showing worker commitment details post-assignment
 * 
 * @param jobId - The UUID of the job
 * @param workerWallet - The wallet address of the assigned worker
 * @returns JobApplication with all fields including revision data, or null if not found
 * 
 * @example
 * const application = await getAssignedWorkerApplication(jobId, job.assigned_to)
 * if (application) {
 *   console.log(`Revisions offered: ${application.revisions_offered}`)
 *   console.log(`Revisions used: ${application.revisions_used}`)
 *   console.log(`Revisions remaining: ${application.revisions_remaining}`)
 * }
 */
export async function getAssignedWorkerApplication(
  jobId: string,
  workerWallet: string
): Promise<JobApplication | null> {
  try {
    const { data, error } = await supabase
      .from('job_applications')
      .select('*')
      .eq('job_id', jobId)
      .eq('applicant_wallet', workerWallet)
      .single()

    if (error) {
      console.error('Error fetching assigned worker application:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error in getAssignedWorkerApplication:', error)
    return null
  }
}

/**
 * Submit completed work for a job
 * 
 * This function:
 * 1. Creates a submission record with deliverables (message, images, links)
 * 2. Updates job status to 'submitted'
 * 3. Sets submitted_at timestamp
 * 4. Sets release_scheduled_at to 10 days from submission
 * 5. Notifies the job poster
 * 
 * The release_scheduled_at triggers the automatic payment release countdown.
 * If the poster doesn't manually release payment or open a dispute within 10 days,
 * the payment will be automatically released to the worker by the cron job.
 * 
 * @param jobId - The UUID of the job to submit work for
 * @param workerWallet - The wallet address of the worker submitting work
 * @param submissionData - Object containing submission details
 * @param submissionData.message - Delivery message describing the completed work
 * @param submissionData.image_urls - Array of Supabase storage URLs for deliverable images
 * @param submissionData.external_links - Array of external links (Google Drive, Figma, etc.)
 * @returns Object with success status and optional error message
 * 
 * @example
 * const result = await submitWork(jobId, workerWallet, {
 *   message: "Completed all design mockups as requested",
 *   image_urls: ["https://...image1.jpg", "https://...image2.png"],
 *   external_links: ["https://drive.google.com/..."]
 * })
 * if (result.success) {
 *   console.log('Work submitted successfully - 10 day countdown started')
 * } else {
 *   console.error('Submission failed:', result.error)
 * }
 */
export async function submitWork(
  jobId: string,
  workerWallet: string,
  submissionData: {
    message: string
    image_urls: string[]
    external_links: string[]
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Create submission record
    const { error: submissionError } = await supabase
      .from('job_submissions')
      .insert({
        job_id: jobId,
        worker_wallet: workerWallet,
        message: submissionData.message,
        image_urls: submissionData.image_urls,
        external_links: submissionData.external_links,
        submitted_at: new Date().toISOString()
      })
    
    if (submissionError) throw submissionError
    
    // Calculate release date (10 days from now)
    const releaseDate = new Date()
    releaseDate.setDate(releaseDate.getDate() + 10)
    
    // Update job status and set release_scheduled_at
    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        release_scheduled_at: releaseDate.toISOString(), // 10 days from now
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
    
    if (jobError) throw jobError

    // Notify the job poster (non-blocking)
    try {
      const { data: job } = await supabase
        .from('jobs')
        .select('poster_wallet, title, project_id')
        .eq('id', jobId)
        .single()

      if (job) {
        await notificationService.createNotification({
          userWallet: job.poster_wallet,
          type: 'job_submitted',
          actorWallet: workerWallet,
          referenceId: jobId,
          referenceType: 'job',
          metadata: {
            job_title: job.title,
            project_id: job.project_id
          }
        })
      }
    } catch (notificationError) {
      console.error('[submitWork] Failed to create notification:', notificationError)
      // Continue - notification failure is non-critical
    }
    
    return { success: true }
    
  } catch (error) {
    console.error('Error submitting work:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit work'
    }
  }
}
