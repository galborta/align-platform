/**
 * Job Comments Helper Functions
 * Functions for fetching and posting comments on job postings
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
 */
export async function postJobComment(
  jobId: string,
  walletAddress: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate message
    const trimmedMessage = message.trim()
    
    if (!trimmedMessage) {
      return { success: false, error: 'Comment cannot be empty' }
    }

    if (trimmedMessage.length > 1000) {
      return { success: false, error: 'Comment is too long (max 1000 characters)' }
    }

    // Insert comment
    const { error } = await supabase
      .from('job_comments')
      .insert({
        job_id: jobId,
        wallet_address: walletAddress,
        message: trimmedMessage
      })

    if (error) {
      console.error('Error posting job comment:', error)
      return { success: false, error: 'Failed to post comment. Please try again.' }
    }

    return { success: true }
  } catch (err) {
    console.error('Error in postJobComment:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

