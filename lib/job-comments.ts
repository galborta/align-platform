/**
 * Job Comments Helper Functions
 * Functions for fetching and posting comments on job postings
 * Updated for token-holder only commenting with 2000 char limit
 */

import { supabase } from './supabase'
import { Database } from '@/types/database'
import { Connection } from '@solana/web3.js'
import { getHolderInfo } from './token-balance'

export type JobComment = Database['public']['Tables']['job_comments']['Row']

/**
 * Get all comments for a specific job with replies
 * Returns comments ordered by created_at ASC (oldest first, chat-style)
 * Includes both top-level comments and replies
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
 * Post a new comment on a job or reply to an existing comment
 * Validates token holdings on-chain before posting
 */
export async function postJobComment(
  jobId: string,
  walletAddress: string,
  commentText: string,
  tokenMint: string,
  parentCommentId?: string
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

    // Verify token holdings on-chain (same as chat)
    const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com'
    const connection = new Connection(rpcEndpoint, 'confirmed')

    console.log(`Checking token holdings for comment: ${walletAddress}`)
    const holderInfo = await getHolderInfo(walletAddress, tokenMint, connection)

    if (!holderInfo) {
      console.error(`No holder info returned for wallet ${walletAddress}`)
      return { 
        success: false, 
        error: 'You must hold project tokens to comment. Make sure you are connected to the correct network.' 
      }
    }

    console.log(`Holder validated: ${walletAddress} holds ${Number(holderInfo.balance)} tokens (${holderInfo.percentage.toFixed(6)}%)`)

    // Insert comment
    const insertData: any = {
      job_id: jobId,
      wallet_address: walletAddress,
      message: trimmedMessage
    }
    
    // Only add parent_comment_id if provided (for replies)
    if (parentCommentId) {
      insertData.parent_comment_id = parentCommentId
    }
    
    const { error } = await supabase
      .from('job_comments')
      .insert(insertData)

    if (error) {
      console.error('Error posting job comment:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      console.error('Insert data:', insertData)
      return { success: false, error: 'Failed to post comment. Please try again.' }
    }

    return { success: true }
  } catch (err) {
    console.error('Error in postJobComment:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

