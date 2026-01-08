/**
 * Analytics Data Fetching
 * 
 * Calculates campaign performance metrics for social media jobs.
 * Provides comprehensive analytics for posters and platform admins.
 * 
 * Usage:
 * ```typescript
 * const metrics = await getCampaignMetrics(posterWallet)
 * console.log(metrics.totalCampaigns)
 * ```
 */

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type Job = Database['public']['Tables']['jobs']['Row']
type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

// ==================== TYPES ====================

/**
 * Campaign metrics interface
 * Comprehensive analytics for social media campaigns
 */
export interface CampaignMetrics {
  // Campaign stats
  totalCampaigns: number
  activeCampaigns: number
  completedCampaigns: number
  cancelledCampaigns: number
  
  // Financial metrics
  totalBudgetLocked: number
  totalPaid: number
  totalRefunded: number
  averageBudget: number
  totalBudgetUtilization: number // percentage
  
  // Participation metrics
  totalSubmissions: number
  averageParticipants: number
  approvalRate: number
  rejectionRate: number
  pendingSubmissions: number
  
  // Efficiency metrics
  manualApprovalRate: number
  autoApprovalRate: number
  averageTimeToPayment: number // hours
  averageTimeToSubmission: number // hours
  
  // Recent trends
  campaignsThisWeek: number
  campaignsLastWeek: number
  growthRate: number
  
  // Distribution insights
  submissionsThisWeek: number
  paymentsThisWeek: number
}

/**
 * Worker-specific metrics
 */
export interface WorkerMetrics {
  totalSubmissions: number
  approvedSubmissions: number
  rejectedSubmissions: number
  pendingSubmissions: number
  totalEarned: number
  averageEarning: number
  approvalRate: number
  campaignsParticipated: number
  averageTimeToSubmit: number // hours after campaign creation
}

// ==================== CAMPAIGN METRICS ====================

/**
 * Get comprehensive campaign metrics
 * 
 * @param posterWallet - Optional wallet address to filter by poster
 * @returns Campaign metrics object
 * 
 * @example
 * ```typescript
 * // Platform-wide metrics
 * const allMetrics = await getCampaignMetrics()
 * 
 * // Poster-specific metrics
 * const posterMetrics = await getCampaignMetrics('wallet123...')
 * ```
 */
export async function getCampaignMetrics(
  posterWallet?: string
): Promise<CampaignMetrics> {
  const supabase = createClient()
  
  try {
    // Build query for social media jobs
    let jobsQuery = supabase
      .from('jobs')
      .select('*')
      .eq('is_social_media_job', true)
    
    // Filter by poster if provided
    if (posterWallet) {
      jobsQuery = jobsQuery.eq('poster_wallet', posterWallet)
    }
    
    const { data: jobs, error: jobsError } = await jobsQuery
    
    if (jobsError) throw jobsError
    if (!jobs || jobs.length === 0) {
      return getEmptyMetrics()
    }
    
    // Get all job IDs for submission query
    const jobIds = jobs.map(j => j.id)
    
    // Fetch all submissions for these jobs
    const { data: submissions, error: subsError } = await supabase
      .from('job_submissions')
      .select('*')
      .in('job_id', jobIds)
    
    if (subsError) throw subsError
    
    // Calculate metrics
    return calculateMetrics(jobs, submissions || [])
    
  } catch (error) {
    console.error('[Analytics] Error fetching campaign metrics:', error)
    throw error
  }
}

/**
 * Get worker-specific metrics
 * 
 * @param workerWallet - Worker wallet address
 * @returns Worker metrics object
 */
export async function getWorkerMetrics(
  workerWallet: string
): Promise<WorkerMetrics> {
  const supabase = createClient()
  
  try {
    // Fetch all submissions by this worker
    const { data: submissions, error: subsError } = await supabase
      .from('job_submissions')
      .select('*, jobs!inner(*)')
      .eq('worker_wallet', workerWallet)
      .eq('jobs.is_social_media_job', true)
    
    if (subsError) throw subsError
    if (!submissions || submissions.length === 0) {
      return getEmptyWorkerMetrics()
    }
    
    return calculateWorkerMetrics(submissions)
    
  } catch (error) {
    console.error('[Analytics] Error fetching worker metrics:', error)
    throw error
  }
}

// ==================== CALCULATION HELPERS ====================

/**
 * Calculate campaign metrics from jobs and submissions
 */
function calculateMetrics(
  jobs: Job[],
  submissions: JobSubmission[]
): CampaignMetrics {
  const now = new Date()
  
  // Campaign status counts
  const totalCampaigns = jobs.length
  const activeCampaigns = jobs.filter(j => 
    j.status === 'open' || j.status === 'active'
  ).length
  const completedCampaigns = jobs.filter(j => 
    j.status === 'completed' || j.social_payments_distributed
  ).length
  const cancelledCampaigns = jobs.filter(j => 
    j.status === 'cancelled'
  ).length
  
  // Financial metrics
  const totalBudgetLocked = jobs.reduce((sum, j) => 
    sum + (j.social_total_budget_usd || 0), 0
  )
  
  const totalPaid = jobs.reduce((sum, j) => 
    sum + (j.social_actual_budget_released || 0), 0
  )
  
  const totalRefunded = totalBudgetLocked - totalPaid
  
  const averageBudget = totalCampaigns > 0 
    ? totalBudgetLocked / totalCampaigns 
    : 0
  
  const totalBudgetUtilization = totalBudgetLocked > 0
    ? (totalPaid / totalBudgetLocked) * 100
    : 0
  
  // Submission metrics
  const totalSubmissions = submissions.length
  const approvedSubmissions = submissions.filter(s => 
    s.social_approval_status === 'approved' ||
    s.social_approval_status === 'auto_approved' ||
    s.social_payment_released
  ).length
  const rejectedSubmissions = submissions.filter(s => 
    s.social_approval_status === 'denied'
  ).length
  const pendingSubmissions = submissions.filter(s => 
    s.social_approval_status === 'pending'
  ).length
  
  const averageParticipants = completedCampaigns > 0 
    ? totalSubmissions / completedCampaigns 
    : 0
  
  const approvalRate = totalSubmissions > 0
    ? (approvedSubmissions / totalSubmissions) * 100
    : 0
  
  const rejectionRate = totalSubmissions > 0
    ? (rejectedSubmissions / totalSubmissions) * 100
    : 0
  
  // Approval type breakdown
  const manualApprovals = submissions.filter(s => 
    s.social_approval_status === 'approved'
  ).length
  
  const autoApprovals = submissions.filter(s => 
    s.social_approval_status === 'auto_approved'
  ).length
  
  const totalApprovals = manualApprovals + autoApprovals
  
  const manualApprovalRate = totalApprovals > 0
    ? (manualApprovals / totalApprovals) * 100
    : 0
  
  const autoApprovalRate = totalApprovals > 0
    ? (autoApprovals / totalApprovals) * 100
    : 0
  
  // Time metrics
  const averageTimeToPayment = calculateAverageTimeToPayment(submissions)
  const averageTimeToSubmission = calculateAverageTimeToSubmission(submissions, jobs)
  
  // Trend metrics
  const campaignsThisWeek = countCampaignsInRange(jobs, 7)
  const campaignsLastWeek = countCampaignsInRange(jobs, 14, 7)
  const growthRate = calculateGrowthRate(campaignsThisWeek, campaignsLastWeek)
  
  const submissionsThisWeek = countSubmissionsInRange(submissions, 7)
  const paymentsThisWeek = countPaymentsInRange(submissions, 7)
  
  return {
    totalCampaigns,
    activeCampaigns,
    completedCampaigns,
    cancelledCampaigns,
    totalBudgetLocked,
    totalPaid,
    totalRefunded,
    averageBudget,
    totalBudgetUtilization,
    totalSubmissions,
    averageParticipants,
    approvalRate,
    rejectionRate,
    pendingSubmissions,
    manualApprovalRate,
    autoApprovalRate,
    averageTimeToPayment,
    averageTimeToSubmission,
    campaignsThisWeek,
    campaignsLastWeek,
    growthRate,
    submissionsThisWeek,
    paymentsThisWeek
  }
}

/**
 * Calculate worker-specific metrics
 */
function calculateWorkerMetrics(submissions: any[]): WorkerMetrics {
  const totalSubmissions = submissions.length
  
  const approvedSubmissions = submissions.filter(s => 
    s.social_approval_status === 'approved' ||
    s.social_approval_status === 'auto_approved' ||
    s.social_payment_released
  ).length
  
  const rejectedSubmissions = submissions.filter(s => 
    s.social_approval_status === 'denied'
  ).length
  
  const pendingSubmissions = submissions.filter(s => 
    s.social_approval_status === 'pending'
  ).length
  
  const totalEarned = submissions
    .filter(s => s.social_payment_released)
    .reduce((sum, s) => sum + (s.social_payment_amount_usd || 0), 0)
  
  const averageEarning = approvedSubmissions > 0
    ? totalEarned / approvedSubmissions
    : 0
  
  const approvalRate = totalSubmissions > 0
    ? (approvedSubmissions / totalSubmissions) * 100
    : 0
  
  // Count unique campaigns
  const uniqueJobIds = new Set(submissions.map(s => s.job_id))
  const campaignsParticipated = uniqueJobIds.size
  
  // Calculate average time to submit after campaign creation
  const averageTimeToSubmit = calculateAverageSubmissionTime(submissions)
  
  return {
    totalSubmissions,
    approvedSubmissions,
    rejectedSubmissions,
    pendingSubmissions,
    totalEarned,
    averageEarning,
    approvalRate,
    campaignsParticipated,
    averageTimeToSubmit
  }
}

// ==================== TIME CALCULATIONS ====================

/**
 * Calculate average time from submission to payment
 */
function calculateAverageTimeToPayment(submissions: JobSubmission[]): number {
  const paidSubmissions = submissions.filter(s => 
    s.social_payment_released && s.submitted_at
  )
  
  if (paidSubmissions.length === 0) return 0
  
  const totalHours = paidSubmissions.reduce((sum, s) => {
    const submittedAt = new Date(s.submitted_at!)
    // Use updated_at as proxy for payment time
    const paidAt = new Date(s.updated_at)
    const hours = (paidAt.getTime() - submittedAt.getTime()) / (1000 * 60 * 60)
    return sum + Math.max(0, hours) // Ensure non-negative
  }, 0)
  
  return totalHours / paidSubmissions.length
}

/**
 * Calculate average time from campaign creation to first submission
 */
function calculateAverageTimeToSubmission(
  submissions: JobSubmission[],
  jobs: Job[]
): number {
  if (submissions.length === 0) return 0
  
  const jobMap = new Map(jobs.map(j => [j.id, j]))
  
  const validSubmissions = submissions.filter(s => {
    const job = jobMap.get(s.job_id)
    return job && s.submitted_at && job.created_at
  })
  
  if (validSubmissions.length === 0) return 0
  
  const totalHours = validSubmissions.reduce((sum, s) => {
    const job = jobMap.get(s.job_id)!
    const jobCreated = new Date(job.created_at)
    const submitted = new Date(s.submitted_at!)
    const hours = (submitted.getTime() - jobCreated.getTime()) / (1000 * 60 * 60)
    return sum + Math.max(0, hours)
  }, 0)
  
  return totalHours / validSubmissions.length
}

/**
 * Calculate average submission time for worker
 */
function calculateAverageSubmissionTime(submissions: any[]): number {
  const validSubmissions = submissions.filter(s => 
    s.submitted_at && s.jobs?.created_at
  )
  
  if (validSubmissions.length === 0) return 0
  
  const totalHours = validSubmissions.reduce((sum, s) => {
    const jobCreated = new Date(s.jobs.created_at)
    const submitted = new Date(s.submitted_at)
    const hours = (submitted.getTime() - jobCreated.getTime()) / (1000 * 60 * 60)
    return sum + Math.max(0, hours)
  }, 0)
  
  return totalHours / validSubmissions.length
}

// ==================== DATE RANGE HELPERS ====================

/**
 * Count campaigns created within date range
 */
function countCampaignsInRange(
  jobs: Job[], 
  daysAgo: number, 
  endDaysAgo: number = 0
): number {
  const now = new Date()
  const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
  const endDate = new Date(now.getTime() - endDaysAgo * 24 * 60 * 60 * 1000)
  
  return jobs.filter(j => {
    const created = new Date(j.created_at)
    return created >= startDate && created <= endDate
  }).length
}

/**
 * Count submissions within date range
 */
function countSubmissionsInRange(
  submissions: JobSubmission[],
  daysAgo: number
): number {
  const cutoff = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  return submissions.filter(s => {
    if (!s.submitted_at) return false
    return new Date(s.submitted_at) >= cutoff
  }).length
}

/**
 * Count payments within date range
 */
function countPaymentsInRange(
  submissions: JobSubmission[],
  daysAgo: number
): number {
  const cutoff = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  return submissions.filter(s => {
    if (!s.social_payment_released || !s.updated_at) return false
    return new Date(s.updated_at) >= cutoff
  }).length
}

/**
 * Calculate growth rate percentage
 */
function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

// ==================== EMPTY METRICS ====================

/**
 * Return empty metrics structure
 */
function getEmptyMetrics(): CampaignMetrics {
  return {
    totalCampaigns: 0,
    activeCampaigns: 0,
    completedCampaigns: 0,
    cancelledCampaigns: 0,
    totalBudgetLocked: 0,
    totalPaid: 0,
    totalRefunded: 0,
    averageBudget: 0,
    totalBudgetUtilization: 0,
    totalSubmissions: 0,
    averageParticipants: 0,
    approvalRate: 0,
    rejectionRate: 0,
    pendingSubmissions: 0,
    manualApprovalRate: 0,
    autoApprovalRate: 0,
    averageTimeToPayment: 0,
    averageTimeToSubmission: 0,
    campaignsThisWeek: 0,
    campaignsLastWeek: 0,
    growthRate: 0,
    submissionsThisWeek: 0,
    paymentsThisWeek: 0
  }
}

/**
 * Return empty worker metrics
 */
function getEmptyWorkerMetrics(): WorkerMetrics {
  return {
    totalSubmissions: 0,
    approvedSubmissions: 0,
    rejectedSubmissions: 0,
    pendingSubmissions: 0,
    totalEarned: 0,
    averageEarning: 0,
    approvalRate: 0,
    campaignsParticipated: 0,
    averageTimeToSubmit: 0
  }
}

// ==================== EXPORTS ====================

export default {
  getCampaignMetrics,
  getWorkerMetrics
}

