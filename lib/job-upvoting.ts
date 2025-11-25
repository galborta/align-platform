/**
 * Job Application Upvoting Functions
 * Handles upvoting job applications with token-weighted voting
 */

import { supabase } from './supabase'
import { Database } from '@/types/database'

type Vote = Database['public']['Tables']['job_application_votes']['Row']
type VoteInsert = Database['public']['Tables']['job_application_votes']['Insert']

/**
 * Calculate tier multiplier based on token percentage
 */
function calculateTierMultiplier(tokenPercentage: number): number {
  if (tokenPercentage >= 3) return 7      // Mega: 3%+
  if (tokenPercentage >= 1) return 5.5    // Whale: 1-3%
  if (tokenPercentage >= 0.1) return 3    // Holder: 0.1-1%
  return 1                                 // Small Holder: <0.1%
}

/**
 * Upvote a job application
 * Awards immediate karma to the voter based on their token holdings
 */
export async function upvoteApplication(
  applicationId: string,
  voterWallet: string,
  projectId: string
): Promise<{ success: boolean; error?: string; karma?: number }> {
  try {
    // 1. Query wallet_token_balances for voter's token_percentage
    const { data: balanceData, error: balanceError } = await supabase
      .from('wallet_token_balances')
      .select('token_percentage')
      .eq('wallet_address', voterWallet)
      .eq('project_id', projectId)
      .maybeSingle()

    if (balanceError) {
      console.error('Error fetching token balance:', balanceError)
      return { success: false, error: 'Failed to fetch token balance' }
    }

    // 2. Validate percentage > 0 (must hold tokens)
    const tokenPercentage = balanceData?.token_percentage || 0
    if (tokenPercentage <= 0) {
      return { success: false, error: 'Must hold tokens to upvote' }
    }

    // 3. Check job_application_votes - prevent duplicate votes
    const { data: existingVote, error: voteCheckError } = await supabase
      .from('job_application_votes')
      .select('id')
      .eq('application_id', applicationId)
      .eq('voter_wallet', voterWallet)
      .maybeSingle()

    if (voteCheckError) {
      console.error('Error checking existing vote:', voteCheckError)
      return { success: false, error: 'Failed to check existing vote' }
    }

    if (existingVote) {
      return { success: false, error: 'Already voted on this application' }
    }

    // 4. Calculate tierMultiplier
    const tierMultiplier = calculateTierMultiplier(tokenPercentage)

    // 5. Insert vote
    const voteData: VoteInsert = {
      application_id: applicationId,
      voter_wallet: voterWallet,
      vote_weight: tokenPercentage
    }

    const { error: insertError } = await supabase
      .from('job_application_votes')
      .insert(voteData)

    if (insertError) {
      console.error('Error inserting vote:', insertError)
      return { success: false, error: 'Failed to record vote' }
    }

    // 6. Award immediate karma: 5 × tierMultiplier
    const karmaAmount = 5 * tierMultiplier

    // Get or create wallet_karma record
    const { data: existingKarma } = await supabase
      .from('wallet_karma')
      .select('total_karma_points')
      .eq('wallet_address', voterWallet)
      .eq('project_id', projectId)
      .maybeSingle()

    if (!existingKarma) {
      // Create new record
      const { error: karmaError } = await supabase.from('wallet_karma').insert({
        wallet_address: voterWallet,
        project_id: projectId,
        total_karma_points: karmaAmount
      })

      if (karmaError) {
        console.error('Error awarding karma:', karmaError)
      }
    } else {
      // Update existing record
      const { error: karmaError } = await supabase
        .from('wallet_karma')
        .update({
          total_karma_points: existingKarma.total_karma_points + karmaAmount
        })
        .eq('wallet_address', voterWallet)
        .eq('project_id', projectId)

      if (karmaError) {
        console.error('Error awarding karma:', karmaError)
      }
    }

    return { 
      success: true, 
      karma: karmaAmount 
    }

  } catch (err) {
    console.error('Unexpected error in upvoteApplication:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    }
  }
}

/**
 * Get all votes for a job application
 * Returns aggregated vote data
 */
export async function getApplicationVotes(applicationId: string): Promise<{
  totalWeight: number
  voterCount: number
  voters: Vote[]
}> {
  try {
    const { data: votes, error } = await supabase
      .from('job_application_votes')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching application votes:', error)
      return { totalWeight: 0, voterCount: 0, voters: [] }
    }

    if (!votes || votes.length === 0) {
      return { totalWeight: 0, voterCount: 0, voters: [] }
    }

    // Sum vote_weight for totalWeight
    const totalWeight = votes.reduce((sum, vote) => sum + vote.vote_weight, 0)

    return {
      totalWeight,
      voterCount: votes.length,
      voters: votes
    }

  } catch (err) {
    console.error('Unexpected error in getApplicationVotes:', err)
    return { totalWeight: 0, voterCount: 0, voters: [] }
  }
}

/**
 * Check if a user has already voted on an application
 */
export async function hasUserVoted(
  applicationId: string,
  voterWallet: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('job_application_votes')
      .select('id')
      .eq('application_id', applicationId)
      .eq('voter_wallet', voterWallet)
      .maybeSingle()

    if (error) {
      console.error('Error checking if user voted:', error)
      return false
    }

    return !!data

  } catch (err) {
    console.error('Unexpected error in hasUserVoted:', err)
    return false
  }
}

