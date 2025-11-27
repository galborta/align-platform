import { supabase } from './supabase'
import { Database } from '@/types/database'

type Job = Database['public']['Tables']['jobs']['Row']
type JobInsert = Database['public']['Tables']['jobs']['Insert']
type JobApplication = Database['public']['Tables']['job_applications']['Row']
type JobApplicationInsert = Database['public']['Tables']['job_applications']['Insert']

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
 * Get jobs for a project
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
 * Apply to a job
 */
export async function applyToJob(applicationData: {
  job_id: string
  applicant_wallet: string
  pitch: string
  image_urls?: string[]
  estimated_completion: string
  committed_completion_date: string
}): Promise<JobApplication> {
  const { data, error } = await supabase
    .from('job_applications')
    .insert(applicationData)
    .select()
    .single()

  if (error) throw error
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
 * Submit completed work for a job
 * 
 * This function:
 * 1. Creates a submission record with deliverables (message, images, links)
 * 2. Updates job status to 'submitted'
 * 3. Sets submitted_at timestamp
 * 4. Sets release_scheduled_at to 10 days from submission
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
    
    return { success: true }
    
  } catch (error) {
    console.error('Error submitting work:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit work'
    }
  }
}
