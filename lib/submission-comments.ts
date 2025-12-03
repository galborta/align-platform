/**
 * Submission Comments Helper Functions
 * Functions for fetching and posting comments on contest submissions
 */

import { supabase } from './supabase'
import { notificationService } from './services/notificationService'

export interface SubmissionComment {
  id: string
  submission_id: string
  job_id: string
  wallet_address: string
  message: string
  parent_comment_id: string | null
  created_at: string
  updated_at: string
}

export interface SubmissionCommentWithReplies extends SubmissionComment {
  replies: SubmissionComment[]
}

/**
 * Get all comments for a specific submission
 * Returns comments ordered by created_at ASC (oldest first, chat-style)
 */
export async function getSubmissionComments(submissionId: string): Promise<SubmissionComment[]> {
  try {
    const { data, error } = await supabase
      .from('submission_comments')
      .select('*')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching submission comments:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Error in getSubmissionComments:', err)
    return []
  }
}

/**
 * Post a new comment on a submission or reply to an existing comment
 */
export async function postSubmissionComment(
  submissionId: string,
  jobId: string,
  walletAddress: string,
  commentText: string,
  parentCommentId?: string
): Promise<{ success: boolean; error?: string; comment?: SubmissionComment }> {
  try {
    // Validate message
    const trimmedMessage = commentText.trim()
    
    if (!trimmedMessage) {
      return { success: false, error: 'Comment cannot be empty' }
    }

    if (trimmedMessage.length > 2000) {
      return { success: false, error: 'Comment is too long (max 2000 characters)' }
    }

    // Insert comment
    const insertData: Record<string, any> = {
      submission_id: submissionId,
      job_id: jobId,
      wallet_address: walletAddress,
      message: trimmedMessage
    }
    
    // Only add parent_comment_id if provided (for replies)
    if (parentCommentId) {
      insertData.parent_comment_id = parentCommentId
    }
    
    const { data, error } = await supabase
      .from('submission_comments')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Error posting submission comment:', error)
      return { success: false, error: 'Failed to post comment. Please try again.' }
    }

    // ==================== CREATE FEED EVENT ====================
    try {
      // Get submission and job info for the feed event
      const { data: submission } = await supabase
        .from('job_submissions')
        .select('worker_wallet')
        .eq('id', submissionId)
        .single()

      const { data: job } = await supabase
        .from('jobs')
        .select('project_id, poster_wallet, title')
        .eq('id', jobId)
        .single()

      if (job) {
        // Create feed event
        await supabase.from('feed_events').insert({
          project_id: job.project_id,
          event_type: 'submission_comment',
          actor_wallet: walletAddress,
          reference_id: submissionId,
          reference_type: 'submission',
          event_metadata: {
            job_id: jobId,
            job_title: job.title,
            submission_id: submissionId,
            comment_text: trimmedMessage.slice(0, 100),
            submitter_wallet: submission?.worker_wallet
          }
        })

        // ==================== NOTIFY SUBMISSION OWNER ====================
        if (submission && submission.worker_wallet !== walletAddress) {
          await notificationService.createNotification({
            userWallet: submission.worker_wallet,
            type: 'submission_comment',
            actorWallet: walletAddress,
            referenceId: submissionId,
            referenceType: 'submission',
            metadata: {
              job_id: jobId,
              job_title: job.title,
              comment_text: trimmedMessage.slice(0, 100)
            }
          })
        }

        // Notify poster if they're not the commenter or submitter
        if (job.poster_wallet !== walletAddress && job.poster_wallet !== submission?.worker_wallet) {
          await notificationService.createNotification({
            userWallet: job.poster_wallet,
            type: 'submission_comment',
            actorWallet: walletAddress,
            referenceId: submissionId,
            referenceType: 'submission',
            metadata: {
              job_id: jobId,
              job_title: job.title,
              comment_text: trimmedMessage.slice(0, 100)
            }
          })
        }
      }
    } catch (feedError) {
      console.error('[postSubmissionComment] Failed to create feed event:', feedError)
      // Don't throw - feed event failure is non-critical
    }

    return { success: true, comment: data }
  } catch (err) {
    console.error('Error in postSubmissionComment:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Delete a comment (only by the owner)
 */
export async function deleteSubmissionComment(
  commentId: string,
  walletAddress: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('submission_comments')
      .delete()
      .eq('id', commentId)
      .eq('wallet_address', walletAddress)

    if (error) {
      console.error('Error deleting submission comment:', error)
      return { success: false, error: 'Failed to delete comment' }
    }

    return { success: true }
  } catch (err) {
    console.error('Error in deleteSubmissionComment:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get comment count for a submission
 */
export async function getSubmissionCommentCount(submissionId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('submission_comments')
      .select('*', { count: 'exact', head: true })
      .eq('submission_id', submissionId)

    if (error) {
      console.error('Error getting comment count:', error)
      return 0
    }

    return count || 0
  } catch (err) {
    console.error('Error in getSubmissionCommentCount:', err)
    return 0
  }
}

/**
 * Organize comments into top-level and replies
 */
export function organizeComments(comments: SubmissionComment[]): SubmissionCommentWithReplies[] {
  const topLevelComments = comments.filter(c => !c.parent_comment_id)
  
  return topLevelComments.map(comment => ({
    ...comment,
    replies: comments.filter(c => c.parent_comment_id === comment.id)
  }))
}

