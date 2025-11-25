/**
 * Job Comments Helper Functions
 * Functions for fetching and posting comments on job postings
 * Updated for token-holder only commenting with 2000 char limit
 */

import { supabase } from './supabase'
import { Database } from '@/types/database'

export type JobComment = Database['public']['Tables']['job_comments']['Row']

/**
 * Get all comments for a specific job
 * Returns comments ordered by created_at ASC (oldest first, chat-style)
 */
export async function getJobComments(jobId: string): Promise<JobComment[]> {
  try {
    const { data, error } = await supabase
      .from('job_comments')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching job comments:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Error in getJobComments:', err)
    return []
  }
}

/**
 * Post a new comment on a job
 * Validates message content before inserting
 * Note: RLS policy will verify token holder status
 */
export async function postJobComment(
  jobId: string,
  walletAddress: string,
  commentText: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate message
    const trimmedMessage = commentText.trim()
    
    if (!trimmedMessage) {
      return { success: false, error: 'Comment cannot be empty' }
    }

    if (trimmedMessage.length > 2000) {
      return { success: false, error: 'Comment is too long (max 2000 characters)' }
    }

    // Insert comment (RLS will check token holder status)
    const { error } = await supabase
      .from('job_comments')
      .insert({
        job_id: jobId,
        commenter_wallet: walletAddress,
        comment_text: trimmedMessage
      })

    if (error) {
      console.error('Error posting job comment:', error)
      // Check if it's a token holder restriction error
      if (error.message?.includes('policy')) {
        return { success: false, error: 'You must hold project tokens to comment' }
      }
      return { success: false, error: 'Failed to post comment. Please try again.' }
    }

    return { success: true }
  } catch (err) {
    console.error('Error in postJobComment:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

