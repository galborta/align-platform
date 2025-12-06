/**
 * Revision Offering Utilities
 * 
 * Core utility functions for managing revision offerings in job applications.
 * Handles parsing, calculation, formatting, and validation of revision data.
 * Also includes backend logic for requesting revisions.
 */

import { supabase } from './supabase'
import { notificationService } from './services/notificationService'
import type { RevisionOffering, RevisionStatus, JobApplication } from '@/types/database'

// ==================== CONSTANTS ====================

/**
 * Threshold for triggering high revision count warnings on unlimited revision jobs.
 * When a job with unlimited revisions reaches this count, warnings are sent to both parties.
 */
export const UNLIMITED_WARNING_THRESHOLD = 10

// ==================== PARSING FUNCTIONS ====================

/**
 * Parse a revision offering string value into a typed RevisionOffering
 * 
 * @param value - Raw string value from database ('unlimited', '3', null, etc.)
 * @returns RevisionOffering ('unlimited' | number) or null if not specified
 * 
 * @example
 * parseRevisionOffering('unlimited') // => 'unlimited'
 * parseRevisionOffering('3') // => 3
 * parseRevisionOffering(null) // => null
 * parseRevisionOffering('invalid') // => null
 */
export function parseRevisionOffering(value: string | null): RevisionOffering | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  
  if (value === 'unlimited') {
    return 'unlimited'
  }
  
  const parsed = parseInt(value, 10)
  if (isNaN(parsed) || parsed < 0) {
    console.warn(`Invalid revision offering value: ${value}`)
    return null
  }
  
  return parsed
}

/**
 * Convert a RevisionOffering back to string format for database storage
 * 
 * @param offering - RevisionOffering value to convert
 * @returns String suitable for database storage
 * 
 * @example
 * serializeRevisionOffering('unlimited') // => 'unlimited'
 * serializeRevisionOffering(3) // => '3'
 * serializeRevisionOffering(null) // => null
 */
export function serializeRevisionOffering(offering: RevisionOffering | null): string | null {
  if (offering === null) {
    return null
  }
  
  if (offering === 'unlimited') {
    return 'unlimited'
  }
  
  return offering.toString()
}

// ==================== CALCULATION FUNCTIONS ====================

/**
 * Calculate remaining revisions based on offered amount and used count
 * 
 * @param offered - String value of revisions offered ('unlimited', '3', etc.)
 * @param used - Number of revisions already used
 * @returns String representation of remaining revisions
 * 
 * @example
 * calculateRemaining('unlimited', 5) // => 'unlimited'
 * calculateRemaining('3', 1) // => '2'
 * calculateRemaining('2', 5) // => '0' (can't go negative)
 * calculateRemaining(null, 0) // => null
 */
export function calculateRemaining(offered: string | null, used: number): string | null {
  if (offered === null || offered === '') {
    return null
  }
  
  if (offered === 'unlimited') {
    return 'unlimited'
  }
  
  const offeredNum = parseInt(offered, 10)
  if (isNaN(offeredNum)) {
    return null
  }
  
  return Math.max(offeredNum - used, 0).toString()
}

/**
 * Get the full revision status for a job application
 * 
 * @param app - Job application object (or partial with revision fields)
 * @returns RevisionStatus object with parsed offered, used, and remaining values
 * 
 * @example
 * const status = getRevisionStatus(application)
 * console.log(status.remaining) // 2 or 'unlimited'
 */
export function getRevisionStatus(
  app: Pick<JobApplication, 'revisions_offered' | 'revisions_used' | 'revisions_remaining'>
): RevisionStatus {
  return {
    offered: parseRevisionOffering(app.revisions_offered),
    used: app.revisions_used ?? 0,
    remaining: parseRevisionOffering(app.revisions_remaining)
  }
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Check if a worker can request another revision based on their offering
 * 
 * Returns true if:
 * - Unlimited revisions were offered
 * - There are remaining revisions (offered > used)
 * 
 * @param app - Job application object with revision fields
 * @returns Boolean indicating if revision can be requested
 * 
 * @example
 * if (canRequestRevision(application)) {
 *   // Show "Request Revision" button
 * }
 */
export function canRequestRevision(
  app: Pick<JobApplication, 'revisions_offered' | 'revisions_used' | 'revisions_remaining'>
): boolean {
  const offered = parseRevisionOffering(app.revisions_offered)
  
  // No revisions were offered
  if (offered === null) {
    return false
  }
  
  // Unlimited revisions
  if (offered === 'unlimited') {
    return true
  }
  
  // Check if there are remaining revisions
  const used = app.revisions_used ?? 0
  return offered > used
}

/**
 * Check if this would be a "voluntary" revision (beyond what was offered)
 * 
 * A voluntary revision is one where:
 * - No revisions were offered, OR
 * - All offered revisions have been used
 * 
 * This is useful for UI messaging and potentially different handling.
 * 
 * @param app - Job application object with revision fields
 * @returns Boolean indicating if revision would be voluntary
 * 
 * @example
 * if (isVoluntaryRevision(application)) {
 *   showWarning('This revision is beyond what the worker offered')
 * }
 */
export function isVoluntaryRevision(
  app: Pick<JobApplication, 'revisions_offered' | 'revisions_used' | 'revisions_remaining'>
): boolean {
  const offered = parseRevisionOffering(app.revisions_offered)
  
  // No revisions were offered - any revision is voluntary
  if (offered === null) {
    return true
  }
  
  // Unlimited - never voluntary
  if (offered === 'unlimited') {
    return false
  }
  
  // All offered revisions used up
  const used = app.revisions_used ?? 0
  return used >= offered
}

/**
 * Validate a revision offering value before saving
 * 
 * @param value - Value to validate
 * @returns Object with isValid flag and optional error message
 * 
 * @example
 * const { isValid, error } = validateRevisionOffering(userInput)
 * if (!isValid) {
 *   showError(error)
 * }
 */
export function validateRevisionOffering(
  value: string | null | undefined
): { isValid: boolean; error?: string } {
  // Null/empty is valid (means no revisions offered)
  if (value === null || value === undefined || value === '') {
    return { isValid: true }
  }
  
  // 'unlimited' is valid
  if (value === 'unlimited') {
    return { isValid: true }
  }
  
  // Must be a valid non-negative integer
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    return { 
      isValid: false, 
      error: 'Must be "unlimited" or a valid number' 
    }
  }
  
  if (parsed < 0) {
    return { 
      isValid: false, 
      error: 'Cannot offer negative revisions' 
    }
  }
  
  return { isValid: true }
}

// ==================== DISPLAY HELPERS ====================

/**
 * Format revision status for display in the UI
 * 
 * @param app - Job application object with revision fields
 * @returns Human-readable string describing revision status
 * 
 * @example
 * formatRevisionStatus(app) // => "2 of 3 revisions used"
 * formatRevisionStatus(app) // => "Unlimited revisions (2 used)"
 * formatRevisionStatus(app) // => "No revisions offered"
 */
export function formatRevisionStatus(
  app: Pick<JobApplication, 'revisions_offered' | 'revisions_used' | 'revisions_remaining'>
): string {
  const offered = parseRevisionOffering(app.revisions_offered)
  const used = app.revisions_used ?? 0
  
  if (offered === null) {
    return 'No revisions offered'
  }
  
  if (offered === 'unlimited') {
    if (used === 0) {
      return 'Unlimited revisions'
    }
    return `Unlimited revisions (${used} used)`
  }
  
  if (used === 0) {
    return `${offered} revision${offered === 1 ? '' : 's'} offered`
  }
  
  return `${used} of ${offered} revision${offered === 1 ? '' : 's'} used`
}

/**
 * Format remaining revisions for compact display
 * 
 * @param app - Job application object with revision fields
 * @returns Short string like "2 left", "∞", or "-"
 * 
 * @example
 * formatRemainingShort(app) // => "2 left"
 * formatRemainingShort(app) // => "∞"
 * formatRemainingShort(app) // => "-"
 */
export function formatRemainingShort(
  app: Pick<JobApplication, 'revisions_offered' | 'revisions_used' | 'revisions_remaining'>
): string {
  const remaining = parseRevisionOffering(app.revisions_remaining)
  
  if (remaining === null) {
    return '-'
  }
  
  if (remaining === 'unlimited') {
    return '∞'
  }
  
  if (remaining === 0) {
    return '0 left'
  }
  
  return `${remaining} left`
}

/**
 * Format revision offering for display in application cards
 * 
 * @param offered - Revision offering value
 * @returns Display string for the offering
 * 
 * @example
 * formatRevisionOffering('unlimited') // => "Unlimited revisions"
 * formatRevisionOffering('3') // => "3 revisions"
 * formatRevisionOffering('1') // => "1 revision"
 * formatRevisionOffering(null) // => "No revisions"
 */
export function formatRevisionOffering(offered: string | null): string {
  const parsed = parseRevisionOffering(offered)
  
  if (parsed === null) {
    return 'No revisions'
  }
  
  if (parsed === 'unlimited') {
    return 'Unlimited revisions'
  }
  
  return `${parsed} revision${parsed === 1 ? '' : 's'}`
}

// ==================== BADGE/UI HELPER ====================

/**
 * Get badge color based on revision status
 * 
 * @param app - Job application object with revision fields
 * @returns Color name for badge styling
 * 
 * @example
 * const color = getRevisionBadgeColor(app)
 * <Badge color={color}>{formatRemainingShort(app)}</Badge>
 */
export function getRevisionBadgeColor(
  app: Pick<JobApplication, 'revisions_offered' | 'revisions_used' | 'revisions_remaining'>
): 'success' | 'warning' | 'error' | 'default' {
  const offered = parseRevisionOffering(app.revisions_offered)
  
  if (offered === null) {
    return 'default'
  }
  
  if (offered === 'unlimited') {
    return 'success'
  }
  
  const remaining = parseRevisionOffering(app.revisions_remaining)
  
  if (remaining === null || remaining === 0) {
    return 'error'
  }
  
  if (typeof remaining === 'number' && remaining === 1) {
    return 'warning'
  }
  
  return 'success'
}

// ==================== BACKEND OPERATIONS ====================

/**
 * Request revision data structure
 */
export interface RevisionRequestData {
  notes: string
  images?: string[]
  isVoluntary?: boolean
}

/**
 * Result of a revision request operation
 */
export interface RevisionRequestResult {
  success: boolean
  error?: string
  revisionNumber?: number
}

/**
 * Request a revision from an assigned worker
 * 
 * This function:
 * 1. Validates job status is 'submitted'
 * 2. Gets job_applications data for assigned worker
 * 3. Checks revisions_remaining (or handles voluntary)
 * 4. Increments revisions_used
 * 5. Updates last_revision_requested_at
 * 6. Creates job_comment with is_revision_request metadata
 * 7. Creates notification for worker
 * 
 * @param jobId - The job ID
 * @param revisionData - Notes, images, and voluntary flag
 * @param posterWallet - Wallet of the job poster (requestor)
 * @param workerWallet - Wallet of the assigned worker
 * @returns Success status and revision number
 * 
 * @example
 * const result = await requestRevision(
 *   jobId,
 *   { notes: 'Please update the colors...', images: ['url1'], isVoluntary: false },
 *   posterWallet,
 *   workerWallet
 * )
 */
export async function requestRevision(
  jobId: string,
  revisionData: RevisionRequestData,
  posterWallet: string,
  workerWallet: string
): Promise<RevisionRequestResult> {
  try {
    // 1. Validate job status
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('status, title, poster_wallet, assigned_to, project_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return { success: false, error: 'Job not found' }
    }

    if (job.status !== 'submitted') {
      return { success: false, error: 'Job must be in submitted status to request revisions' }
    }

    if (job.poster_wallet !== posterWallet) {
      return { success: false, error: 'Only the job poster can request revisions' }
    }

    if (job.assigned_to !== workerWallet) {
      return { success: false, error: 'Worker wallet mismatch' }
    }

    // 2. Get job application data for the assigned worker
    const { data: application, error: appError } = await supabase
      .from('job_applications')
      .select('id, revisions_offered, revisions_used, revisions_remaining')
      .eq('job_id', jobId)
      .eq('applicant_wallet', workerWallet)
      .single()

    if (appError || !application) {
      return { success: false, error: 'Application not found for assigned worker' }
    }

    // 3. Check if revision is allowed (unless voluntary)
    const currentUsed = application.revisions_used ?? 0
    const newRevisionNumber = currentUsed + 1
    
    if (!revisionData.isVoluntary) {
      const hasRevisions = canRequestRevision(application)
      if (!hasRevisions) {
        return { 
          success: false, 
          error: 'No committed revisions remaining. You can still request a voluntary revision.' 
        }
      }
    }

    // 4. Increment revisions_used
    // Note: revisions_remaining is calculated by a database trigger
    const { error: updateError } = await supabase
      .from('job_applications')
      .update({
        revisions_used: newRevisionNumber,
        last_revision_requested_at: new Date().toISOString()
      })
      .eq('id', application.id)

    if (updateError) {
      console.error('Error updating revision count:', updateError)
      return { success: false, error: 'Failed to update revision count' }
    }

    // 5. Create job comment with revision request metadata
    const commentMessage = buildRevisionCommentMessage(revisionData, newRevisionNumber, revisionData.isVoluntary)
    
    const { error: commentError } = await supabase
      .from('job_comments')
      .insert({
        job_id: jobId,
        wallet_address: posterWallet,
        message: commentMessage,
        // Store metadata in comment (images as part of message for now)
        // In future: could add metadata JSON column to job_comments
      })

    if (commentError) {
      console.error('Error creating revision comment:', commentError)
      // Non-critical - continue anyway
    }

    // 6. Update job status back to 'assigned' to indicate work needed
    const { error: jobUpdateError } = await supabase
      .from('jobs')
      .update({
        status: 'assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (jobUpdateError) {
      console.error('Error updating job status:', jobUpdateError)
      // Continue - the revision request was logged
    }

    // 7. Create notification for worker
    // Use different notification type for voluntary revisions so they see Accept/Decline buttons
    try {
      const notificationType = revisionData.isVoluntary 
        ? 'voluntary_revision_requested' 
        : 'revision_requested'

      await notificationService.createNotification({
        userWallet: workerWallet,
        type: notificationType,
        actorWallet: posterWallet,
        referenceId: jobId,
        referenceType: 'job',
        metadata: {
          job_title: job.title,
          revision_number: newRevisionNumber,
          is_voluntary: revisionData.isVoluntary ?? false,
          notes_preview: revisionData.notes.slice(0, 100)
        }
      })
    } catch (notificationError) {
      console.error('[requestRevision] Failed to create notification:', notificationError)
      // Non-critical - continue anyway
    }

    // 8. Check for high revision count warning (unlimited jobs only)
    // Only trigger at exact threshold to send warning once
    const isUnlimited = application.revisions_offered === 'unlimited'
    if (isUnlimited && newRevisionNumber === UNLIMITED_WARNING_THRESHOLD) {
      await sendHighRevisionCountWarnings(
        jobId,
        job.title,
        posterWallet,
        workerWallet,
        newRevisionNumber
      )
    }

    // 9. Create feed event for revision request
    try {
      // Calculate revisions remaining for the feed event
      let revisionsRemaining: string | number = 'unlimited'
      if (application.revisions_offered !== 'unlimited') {
        const offered = parseInt(String(application.revisions_offered), 10) || 0
        revisionsRemaining = Math.max(0, offered - newRevisionNumber)
      }

      // Use type assertion since feed_events table isn't in generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('feed_events').insert({
        project_id: job.project_id,
        event_type: 'job_revision_requested',
        actor_wallet: posterWallet,
        entity_id: jobId,
        entity_type: 'job',
        metadata: {
          job_id: jobId,
          job_title: job.title,
          revision_number: newRevisionNumber,
          revisions_remaining: revisionsRemaining,
          is_voluntary: revisionData.isVoluntary ?? false,
          worker_wallet: workerWallet
        }
      })
    } catch (feedError) {
      console.error('[requestRevision] Feed event error (non-critical):', feedError)
      // Non-critical - continue anyway
    }

    return { 
      success: true, 
      revisionNumber: newRevisionNumber 
    }
  } catch (err) {
    console.error('Error in requestRevision:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Build a formatted comment message for the revision request
 */
function buildRevisionCommentMessage(
  data: RevisionRequestData,
  revisionNumber: number,
  isVoluntary?: boolean
): string {
  const header = isVoluntary 
    ? `🔄 **Voluntary Revision Request**`
    : `🔄 **Revision Request #${revisionNumber}**`
  
  let message = `${header}\n\n${data.notes}`

  if (data.images && data.images.length > 0) {
    message += `\n\n📎 Reference Images:\n`
    data.images.forEach((url, i) => {
      message += `- Image ${i + 1}: ${url}\n`
    })
  }

  return message
}

/**
 * Get the assigned worker's application for a job
 * 
 * @param jobId - The job ID
 * @param workerWallet - The assigned worker's wallet
 * @returns The application record or null
 */
export async function getAssignedWorkerApplication(
  jobId: string,
  workerWallet: string
): Promise<JobApplication | null> {
  try {
    const { data: application, error } = await supabase
      .from('job_applications')
      .select('*')
      .eq('job_id', jobId)
      .eq('applicant_wallet', workerWallet)
      .single()

    if (error) {
      console.error('Error fetching assigned worker application:', error)
      return null
    }

    return application as JobApplication
  } catch (error) {
    console.error('Error in getAssignedWorkerApplication:', error)
    return null
  }
}

// ==================== REVISION SUBMISSION ====================

/**
 * Revision submission data structure
 */
export interface RevisionSubmissionData {
  notes: string
  images: string[]
  links?: string[]
  revisionNumber: number
}

/**
 * Result of a revision submission operation
 */
export interface RevisionSubmissionResult {
  success: boolean
  error?: string
}

/**
 * Submit revised work in response to a revision request
 * 
 * This function:
 * 1. Validates job status and worker
 * 2. Updates/creates job_submission record (overwriting previous)
 * 3. Creates job_comment with revision submission metadata
 * 4. Updates job status back to 'submitted'
 * 5. Creates notification for poster
 * 
 * @param jobId - The job ID
 * @param revisionData - Notes, images, links, and revision number
 * @param workerWallet - Wallet of the worker submitting
 * @returns Success status
 */
export async function submitRevision(
  jobId: string,
  revisionData: RevisionSubmissionData,
  workerWallet: string
): Promise<RevisionSubmissionResult> {
  try {
    // 1. Validate job and worker
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('status, title, poster_wallet, assigned_to, project_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return { success: false, error: 'Job not found' }
    }

    if (job.assigned_to !== workerWallet) {
      return { success: false, error: 'Only the assigned worker can submit revisions' }
    }

    // Job should be in 'assigned' status (after revision request was made)
    if (job.status !== 'assigned') {
      return { success: false, error: `Cannot submit revision when job is in "${job.status}" status` }
    }

    // 2. Check if there's an existing submission to update
    const { data: existingSubmission } = await supabase
      .from('job_submissions')
      .select('id')
      .eq('job_id', jobId)
      .eq('worker_wallet', workerWallet)
      .single()

    // Build submission message combining revision notes with metadata
    const submissionMessage = `📝 **Revision #${revisionData.revisionNumber} Submitted**\n\n${revisionData.notes}`

    if (existingSubmission) {
      // Update existing submission
      const { error: updateError } = await supabase
        .from('job_submissions')
        .update({
          message: submissionMessage,
          image_urls: revisionData.images,
          external_links: revisionData.links || [],
          submitted_at: new Date().toISOString()
        })
        .eq('id', existingSubmission.id)

      if (updateError) {
        console.error('Error updating submission:', updateError)
        return { success: false, error: 'Failed to update submission' }
      }
    } else {
      // Create new submission
      const { error: insertError } = await supabase
        .from('job_submissions')
        .insert({
          job_id: jobId,
          worker_wallet: workerWallet,
          message: submissionMessage,
          image_urls: revisionData.images,
          external_links: revisionData.links || [],
          submitted_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('Error creating submission:', insertError)
        return { success: false, error: 'Failed to create submission' }
      }
    }

    // 3. Create job_comment for timeline tracking
    const commentMessage = buildRevisionSubmissionComment(revisionData)
    
    const { error: commentError } = await supabase
      .from('job_comments')
      .insert({
        job_id: jobId,
        wallet_address: workerWallet,
        message: commentMessage
      })

    if (commentError) {
      console.error('Error creating revision comment:', commentError)
      // Non-critical - continue
    }

    // 4. Update job status back to 'submitted' and reset auto-release timer
    const releaseDate = new Date()
    releaseDate.setDate(releaseDate.getDate() + 10) // 10 days from now

    const { error: jobUpdateError } = await supabase
      .from('jobs')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        release_scheduled_at: releaseDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (jobUpdateError) {
      console.error('Error updating job status:', jobUpdateError)
      return { success: false, error: 'Failed to update job status' }
    }

    // 5. Notify the poster
    try {
      await notificationService.createNotification({
        userWallet: job.poster_wallet,
        type: 'job_submitted', // Reuse existing type for revision submissions
        actorWallet: workerWallet,
        referenceId: jobId,
        referenceType: 'job',
        metadata: {
          job_title: job.title,
          project_id: job.project_id || undefined,
          revision_number: revisionData.revisionNumber,
          is_revision: true
        }
      })
    } catch (notificationError) {
      console.error('[submitRevision] Failed to create notification:', notificationError)
      // Non-critical - continue
    }

    // 6. Create feed event for revision submission
    try {
      // Use type assertion since feed_events table isn't in generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('feed_events').insert({
        project_id: job.project_id,
        event_type: 'job_revision_submitted',
        actor_wallet: workerWallet,
        entity_id: jobId,
        entity_type: 'job',
        metadata: {
          job_id: jobId,
          job_title: job.title,
          revision_number: revisionData.revisionNumber,
          poster_wallet: job.poster_wallet
        }
      })
    } catch (feedError) {
      console.error('[submitRevision] Feed event error (non-critical):', feedError)
      // Non-critical - continue
    }

    return { success: true }
  } catch (err) {
    console.error('Error in submitRevision:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Build a formatted comment message for the revision submission
 */
function buildRevisionSubmissionComment(data: RevisionSubmissionData): string {
  let message = `✅ **Revision #${data.revisionNumber} Submitted**\n\n${data.notes}`

  if (data.images && data.images.length > 0) {
    message += `\n\n📎 Updated Deliverables:\n`
    data.images.forEach((url, i) => {
      message += `- Image ${i + 1}: ${url}\n`
    })
  }

  if (data.links && data.links.length > 0) {
    message += `\n🔗 External Links:\n`
    data.links.forEach((url, i) => {
      message += `- ${url}\n`
    })
  }

  return message
}

/**
 * Get the latest revision request for a job
 * 
 * @param jobId - The job ID
 * @returns The latest revision request comment or null
 */
export async function getLatestRevisionRequest(
  jobId: string
): Promise<{
  revisionNumber: number
  isVoluntary: boolean
  notes: string
  requestedAt: string
  images: string[]
} | null> {
  try {
    const { data: comments, error } = await supabase
      .from('job_comments')
      .select('*')
      .eq('job_id', jobId)
      .like('message', '%**Revision Request%')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !comments || comments.length === 0) {
      return null
    }

    const comment = comments[0]
    const message = comment.message

    // Parse revision number
    const revisionMatch = message.match(/Revision Request #(\d+)/)
    const revisionNumber = revisionMatch ? parseInt(revisionMatch[1], 10) : 1

    // Check if voluntary
    const isVoluntary = message.includes('Voluntary Revision Request')

    // Extract notes
    const lines = message.split('\n')
    const headerIndex = lines.findIndex((l: string) => l.includes('**Revision Request'))
    let notes = ''
    let images: string[] = []
    
    if (headerIndex !== -1) {
      const imagesIndex = lines.findIndex((l: string) => l.includes('📎 Reference Images:'))
      const notesLines = imagesIndex > -1 
        ? lines.slice(headerIndex + 2, imagesIndex)
        : lines.slice(headerIndex + 2)
      notes = notesLines.join('\n').trim()
      
      // Extract images
      if (imagesIndex > -1) {
        for (let i = imagesIndex + 1; i < lines.length; i++) {
          const urlMatch = lines[i].match(/https?:\/\/[^\s]+/)
          if (urlMatch) {
            images.push(urlMatch[0])
          }
        }
      }
    }

    return {
      revisionNumber,
      isVoluntary,
      notes,
      requestedAt: comment.created_at || new Date().toISOString(),
      images
    }
  } catch (error) {
    console.error('Error fetching latest revision request:', error)
    return null
  }
}

// ==================== VOLUNTARY REVISION RESPONSES ====================

/**
 * Result of a voluntary revision action
 */
export interface VoluntaryRevisionResult {
  success: boolean
  error?: string
}

/**
 * Accept a voluntary revision request
 * 
 * This function:
 * 1. Validates job and worker
 * 2. Increments revisions_used (tracking even beyond commitment)
 * 3. Creates acceptance comment for timeline
 * 4. Notifies poster that worker accepted
 * 5. Worker can now submit revision normally
 * 
 * @param jobId - The job ID
 * @param workerWallet - Wallet of the worker accepting
 * @returns Success status
 */
export async function acceptVoluntaryRevision(
  jobId: string,
  workerWallet: string
): Promise<VoluntaryRevisionResult> {
  try {
    // 1. Validate job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('status, title, poster_wallet, assigned_to, project_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return { success: false, error: 'Job not found' }
    }

    if (job.assigned_to !== workerWallet) {
      return { success: false, error: 'Only the assigned worker can respond to revision requests' }
    }

    if (job.status !== 'assigned') {
      return { success: false, error: `Cannot respond to revision when job is in "${job.status}" status` }
    }

    // 2. Get worker's application to update revision tracking
    const { data: application, error: appError } = await supabase
      .from('job_applications')
      .select('id, revisions_used, revisions_offered, revisions_remaining')
      .eq('job_id', jobId)
      .eq('applicant_wallet', workerWallet)
      .single()

    if (appError || !application) {
      return { success: false, error: 'Application not found' }
    }

    // 3. Increment revisions_used (even though beyond commitment)
    // This tracks total revisions done for metrics/history
    const newRevisionsUsed = (application.revisions_used || 0) + 1

    const { error: updateError } = await supabase
      .from('job_applications')
      .update({
        revisions_used: newRevisionsUsed,
        last_revision_requested_at: new Date().toISOString()
      })
      .eq('id', application.id)

    if (updateError) {
      console.error('Error updating application:', updateError)
      return { success: false, error: 'Failed to update revision tracking' }
    }

    // 4. Create acceptance comment for timeline
    const acceptanceMessage = `✅ **Voluntary Revision Accepted**\n\nThe worker has accepted the voluntary revision request. They will submit revised work shortly.`
    
    const { error: commentError } = await supabase
      .from('job_comments')
      .insert({
        job_id: jobId,
        wallet_address: workerWallet,
        message: acceptanceMessage
      })

    if (commentError) {
      console.error('Error creating acceptance comment:', commentError)
      // Non-critical - continue
    }

    // 5. Notify the poster
    try {
      await notificationService.createNotification({
        userWallet: job.poster_wallet,
        type: 'voluntary_revision_accepted',
        actorWallet: workerWallet,
        referenceId: jobId,
        referenceType: 'job',
        metadata: {
          job_title: job.title,
          project_id: job.project_id || undefined
        }
      })
    } catch (notificationError) {
      console.error('[acceptVoluntaryRevision] Failed to create notification:', notificationError)
      // Non-critical - continue
    }

    return { success: true }
  } catch (err) {
    console.error('Error in acceptVoluntaryRevision:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Decline a voluntary revision request
 * 
 * This function:
 * 1. Validates job and worker
 * 2. Creates decline comment for timeline
 * 3. Updates job status back to 'submitted' (poster can approve or dispute)
 * 4. Notifies poster of decline
 * 
 * No penalties for declining a voluntary revision.
 * 
 * @param jobId - The job ID
 * @param workerWallet - Wallet of the worker declining
 * @param reason - Optional reason for declining
 * @returns Success status
 */
/**
 * Get the full revision request history for a job
 * Parses revision request comments to build a timeline
 * 
 * @param jobId - The job ID
 * @returns Array of revision requests with details
 */
export async function getRevisionHistory(
  jobId: string
): Promise<Array<{
  number: number
  notes: string
  requestedAt: string
  submittedAt?: string
  isVoluntary: boolean
}>> {
  try {
    // Fetch all revision-related comments
    const { data: comments, error } = await supabase
      .from('job_comments')
      .select('*')
      .eq('job_id', jobId)
      .or('message.ilike.%Revision Request%,message.ilike.%Revision Submitted%')
      .order('created_at', { ascending: true })

    if (error || !comments) {
      console.error('Error fetching revision history:', error)
      return []
    }

    const revisionRequests: Array<{
      number: number
      notes: string
      requestedAt: string
      submittedAt?: string
      isVoluntary: boolean
    }> = []

    // Track submissions by revision number
    const submissions: Record<number, string> = {}

    for (const comment of comments) {
      const message = comment.message || ''
      
      // Check if it's a revision request
      const requestMatch = message.match(/\*\*(?:Voluntary )?Revision Request #(\d+)\*\*/)
      if (requestMatch) {
        const revisionNumber = parseInt(requestMatch[1], 10)
        const isVoluntary = message.includes('Voluntary Revision Request')
        
        // Extract notes (everything after the header, before images)
        const lines = message.split('\n')
        const headerIndex = lines.findIndex((l: string) => l.includes('**Revision Request'))
        const imagesIndex = lines.findIndex((l: string) => l.includes('📎 Reference Images:'))
        
        let notes = ''
        if (headerIndex !== -1) {
          const endIndex = imagesIndex > -1 ? imagesIndex : lines.length
          notes = lines.slice(headerIndex + 2, endIndex).join('\n').trim()
        }

        revisionRequests.push({
          number: revisionNumber,
          notes,
          requestedAt: comment.created_at || new Date().toISOString(),
          isVoluntary
        })
      }

      // Check if it's a revision submission
      const submissionMatch = message.match(/\*\*Revision #(\d+) Submitted\*\*/)
      if (submissionMatch) {
        const revisionNumber = parseInt(submissionMatch[1], 10)
        submissions[revisionNumber] = comment.created_at || new Date().toISOString()
      }
    }

    // Match submissions to requests
    return revisionRequests.map(req => ({
      ...req,
      submittedAt: submissions[req.number]
    }))
  } catch (error) {
    console.error('Error in getRevisionHistory:', error)
    return []
  }
}

export async function declineVoluntaryRevision(
  jobId: string,
  workerWallet: string,
  reason?: string
): Promise<VoluntaryRevisionResult> {
  try {
    // 1. Validate job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('status, title, poster_wallet, assigned_to, project_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return { success: false, error: 'Job not found' }
    }

    if (job.assigned_to !== workerWallet) {
      return { success: false, error: 'Only the assigned worker can respond to revision requests' }
    }

    if (job.status !== 'assigned') {
      return { success: false, error: `Cannot respond to revision when job is in "${job.status}" status` }
    }

    // 2. Create decline comment for timeline
    let declineMessage = `❌ **Voluntary Revision Declined**\n\nThe worker has declined the voluntary revision request (no penalty applied).`
    if (reason) {
      declineMessage += `\n\n**Reason:** ${reason}`
    }
    declineMessage += `\n\nThe poster can now approve the current work or open a dispute.`
    
    const { error: commentError } = await supabase
      .from('job_comments')
      .insert({
        job_id: jobId,
        wallet_address: workerWallet,
        message: declineMessage
      })

    if (commentError) {
      console.error('Error creating decline comment:', commentError)
      // Non-critical - continue
    }

    // 3. Update job status back to 'submitted' so poster can take action
    // The submission is still there - poster can approve or dispute
    const { error: jobUpdateError } = await supabase
      .from('jobs')
      .update({
        status: 'submitted',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (jobUpdateError) {
      console.error('Error updating job status:', jobUpdateError)
      return { success: false, error: 'Failed to update job status' }
    }

    // 4. Notify the poster
    try {
      await notificationService.createNotification({
        userWallet: job.poster_wallet,
        type: 'voluntary_revision_declined',
        actorWallet: workerWallet,
        referenceId: jobId,
        referenceType: 'job',
        metadata: {
          job_title: job.title,
          project_id: job.project_id || undefined,
          notes_preview: reason || undefined
        }
      })
    } catch (notificationError) {
      console.error('[declineVoluntaryRevision] Failed to create notification:', notificationError)
      // Non-critical - continue
    }

    return { success: true }
  } catch (err) {
    console.error('Error in declineVoluntaryRevision:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ==================== WARNING SYSTEM ====================

/**
 * Send high revision count warnings to both poster and worker
 * 
 * Called when an unlimited revision job hits the warning threshold.
 * Notifies both parties and optionally flags for admin review.
 * 
 * @param jobId - The job ID
 * @param jobTitle - Title of the job
 * @param posterWallet - Poster's wallet address
 * @param workerWallet - Worker's wallet address
 * @param revisionCount - Current revision count
 */
async function sendHighRevisionCountWarnings(
  jobId: string,
  jobTitle: string,
  posterWallet: string,
  workerWallet: string,
  revisionCount: number
): Promise<void> {
  try {
    // Get project_id for navigation
    const { data: job } = await supabase
      .from('jobs')
      .select('project_id')
      .eq('id', jobId)
      .single()

    const projectId = job?.project_id || undefined

    // 1. Notify poster about high revision count
    await notificationService.createNotification({
      userWallet: posterWallet,
      type: 'high_revision_count_warning_poster',
      actorWallet: posterWallet, // Self-triggered by system
      referenceId: jobId,
      referenceType: 'job',
      metadata: {
        job_title: jobTitle,
        project_id: projectId,
        revision_count: revisionCount
      }
    })

    // 2. Notify worker about high revision count (with dispute option hint)
    await notificationService.createNotification({
      userWallet: workerWallet,
      type: 'high_revision_count_warning_worker',
      actorWallet: posterWallet, // Triggered by poster's requests
      referenceId: jobId,
      referenceType: 'job',
      metadata: {
        job_title: jobTitle,
        project_id: projectId,
        revision_count: revisionCount
      }
    })

    // 3. Create a system comment on the job for visibility
    const warningComment = `⚠️ **High Revision Count Warning**

This job has reached **${revisionCount} revisions**, which exceeds the typical threshold for unlimited revision jobs.

**For the Poster:** Consider whether the job scope has changed significantly. If so, creating a new job may be more appropriate.

**For the Worker:** If you believe the revision requests are unreasonable or beyond the original scope, you can open a dispute.

This is an automated system notice.`

    await supabase
      .from('job_comments')
      .insert({
        job_id: jobId,
        wallet_address: 'SYSTEM', // Use SYSTEM as author for automated messages
        message: warningComment
      })

    // 4. Flag for admin review (if admin system exists)
    // This creates an admin notification
    try {
      await notificationService.notifyAdminsOfNewDispute({
        jobId,
        jobTitle,
        reason: `[HIGH REVISION COUNT] Job has ${revisionCount} revisions on an unlimited offering. May require review.`,
        creatorWallet: posterWallet
      })
    } catch (adminError) {
      console.error('[sendHighRevisionCountWarnings] Failed to notify admins:', adminError)
      // Non-critical
    }

    console.log(`[sendHighRevisionCountWarnings] Warnings sent for job ${jobId} at ${revisionCount} revisions`)
  } catch (error) {
    console.error('[sendHighRevisionCountWarnings] Error sending warnings:', error)
    // Non-critical - don't throw, revision request should still succeed
  }
}

