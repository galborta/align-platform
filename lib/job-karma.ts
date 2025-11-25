/**
 * Job Karma Helper Functions
 * Convenience functions for awarding karma during job lifecycle events
 */

import { supabase } from './supabase'
import {
  calculateJobKarma,
  calculateJobCompletionKarma,
  calculateApplicationUpvoteBonusKarma,
  calculateDisputeVoteBonusKarma
} from './karma'

/**
 * Get token percentage for a wallet in a project
 */
async function getTokenPercentage(walletAddress: string, tokenMint: string): Promise<number> {
  // TODO: Implement actual token balance checking via Helius/RPC
  // For now, return a placeholder
  console.warn('getTokenPercentage not implemented - using placeholder value')
  return 0.5 // Placeholder: 0.5%
}

/**
 * Award karma to a wallet for a specific project
 */
async function awardKarma(params: {
  walletAddress: string
  projectId: string
  karmaAmount: number
  incrementApplications?: boolean
  incrementJobsPosted?: boolean
  incrementJobsCompleted?: boolean
  incrementDisputeVotesCast?: boolean
  incrementDisputeVotesWon?: boolean
}) {
  const {
    walletAddress,
    projectId,
    karmaAmount,
    incrementApplications = false,
    incrementJobsPosted = false,
    incrementJobsCompleted = false,
    incrementDisputeVotesCast = false,
    incrementDisputeVotesWon = false
  } = params

  // Get or create wallet_karma record
  const { data: existingKarma } = await supabase
    .from('wallet_karma')
    .select('*')
    .eq('wallet_address', walletAddress)
    .eq('project_id', projectId)
    .single()

  if (!existingKarma) {
    // Create new record
    const { error } = await supabase.from('wallet_karma').insert({
      wallet_address: walletAddress,
      project_id: projectId,
      total_karma_points: karmaAmount,
      applications_submitted_count: incrementApplications ? 1 : 0,
      jobs_posted_as_poster_count: incrementJobsPosted ? 1 : 0,
      jobs_completed_as_worker_count: incrementJobsCompleted ? 1 : 0,
      dispute_votes_cast_count: incrementDisputeVotesCast ? 1 : 0,
      dispute_votes_won_count: incrementDisputeVotesWon ? 1 : 0
    })

    if (error) throw error
  } else {
    // Update existing record
    const updates: any = {
      total_karma_points: existingKarma.total_karma_points + karmaAmount
    }

    if (incrementApplications) {
      updates.applications_submitted_count = existingKarma.applications_submitted_count + 1
    }
    if (incrementJobsPosted) {
      updates.jobs_posted_as_poster_count = existingKarma.jobs_posted_as_poster_count + 1
    }
    if (incrementJobsCompleted) {
      updates.jobs_completed_as_worker_count = existingKarma.jobs_completed_as_worker_count + 1
    }
    if (incrementDisputeVotesCast) {
      updates.dispute_votes_cast_count = existingKarma.dispute_votes_cast_count + 1
    }
    if (incrementDisputeVotesWon) {
      updates.dispute_votes_won_count = existingKarma.dispute_votes_won_count + 1
    }

    const { error } = await supabase
      .from('wallet_karma')
      .update(updates)
      .eq('wallet_address', walletAddress)
      .eq('project_id', projectId)

    if (error) throw error
  }
}

/**
 * Award karma when a user posts a job (immediate 25%)
 */
export async function awardPostJobKarma(
  posterWallet: string,
  projectId: string,
  tokenMint: string
) {
  const tokenPercentage = await getTokenPercentage(posterWallet, tokenMint)
  const immediateKarma = calculateJobKarma('POST_JOB', tokenPercentage, true)

  await awardKarma({
    walletAddress: posterWallet,
    projectId,
    karmaAmount: immediateKarma,
    incrementJobsPosted: true
  })

  return immediateKarma
}

/**
 * Award karma when a user applies to a job (immediate 25%)
 */
export async function awardApplyToJobKarma(
  applicantWallet: string,
  projectId: string,
  tokenMint: string
) {
  const tokenPercentage = await getTokenPercentage(applicantWallet, tokenMint)
  const immediateKarma = calculateJobKarma('APPLY_TO_JOB', tokenPercentage, true)

  await awardKarma({
    walletAddress: applicantWallet,
    projectId,
    karmaAmount: immediateKarma,
    incrementApplications: true
  })

  return immediateKarma
}

/**
 * Award karma when a user upvotes an application
 */
export async function awardUpvoteApplicationKarma(
  voterWallet: string,
  projectId: string,
  tokenMint: string
) {
  const tokenPercentage = await getTokenPercentage(voterWallet, tokenMint)
  const karma = calculateJobKarma('UPVOTE_APPLICATION', tokenPercentage, true)

  await awardKarma({
    walletAddress: voterWallet,
    projectId,
    karmaAmount: karma
  })

  return karma
}

/**
 * Award karma when a user votes on a dispute
 */
export async function awardDisputeVoteKarma(
  voterWallet: string,
  projectId: string,
  tokenMint: string
) {
  const tokenPercentage = await getTokenPercentage(voterWallet, tokenMint)
  const karma = calculateJobKarma('VOTE_ON_DISPUTE', tokenPercentage, true)

  await awardKarma({
    walletAddress: voterWallet,
    projectId,
    karmaAmount: karma,
    incrementDisputeVotesCast: true
  })

  return karma
}

/**
 * Award karma when a job completes successfully
 * Awards both USD-based completion karma and delayed karma from initial actions
 */
export async function awardJobCompletionKarma(params: {
  jobId: string
  projectId: string
  tokenMint: string
  posterWallet: string
  workerWallet: string
  jobUsdValue: number
  winningApplicationId: string
}) {
  const {
    projectId,
    tokenMint,
    posterWallet,
    workerWallet,
    jobUsdValue,
    winningApplicationId
  } = params

  // 1. Award USD-based completion karma (no tier multiplier)
  const completionKarma = calculateJobCompletionKarma(jobUsdValue)

  await awardKarma({
    walletAddress: posterWallet,
    projectId,
    karmaAmount: completionKarma
  })

  await awardKarma({
    walletAddress: workerWallet,
    projectId,
    karmaAmount: completionKarma,
    incrementJobsCompleted: true
  })

  // 2. Award delayed karma to poster (75% of POST_JOB)
  const posterTokenPercentage = await getTokenPercentage(posterWallet, tokenMint)
  const delayedPosterKarma = calculateJobKarma('POST_JOB', posterTokenPercentage, false)

  await awardKarma({
    walletAddress: posterWallet,
    projectId,
    karmaAmount: delayedPosterKarma
  })

  // 3. Award delayed karma to worker (75% of APPLY_TO_JOB)
  const workerTokenPercentage = await getTokenPercentage(workerWallet, tokenMint)
  const delayedWorkerKarma = calculateJobKarma('APPLY_TO_JOB', workerTokenPercentage, false)

  await awardKarma({
    walletAddress: workerWallet,
    projectId,
    karmaAmount: delayedWorkerKarma
  })

  // 4. Award bonus karma to voters who upvoted winning application
  const { data: upvoters } = await supabase
    .from('job_application_votes')
    .select('voter_wallet')
    .eq('application_id', winningApplicationId)

  if (upvoters && upvoters.length > 0) {
    const bonusKarma = calculateApplicationUpvoteBonusKarma(jobUsdValue)

    for (const upvoter of upvoters) {
      await awardKarma({
        walletAddress: upvoter.voter_wallet,
        projectId,
        karmaAmount: bonusKarma
      })
    }
  }

  return {
    posterKarma: completionKarma + delayedPosterKarma,
    workerKarma: completionKarma + delayedWorkerKarma,
    upvoterBonus: upvoters ? calculateApplicationUpvoteBonusKarma(jobUsdValue) : 0
  }
}

/**
 * Award bonus karma to dispute voters on the winning side
 */
export async function awardDisputeResolutionKarma(params: {
  disputeId: string
  projectId: string
  jobUsdValue: number
  winningSide: 'release' | 'refund'
}) {
  const { disputeId, projectId, jobUsdValue, winningSide } = params

  // Get all votes on this dispute
  const { data: votes } = await supabase
    .from('job_dispute_votes')
    .select('voter_wallet, vote')
    .eq('dispute_id', disputeId)

  if (!votes || votes.length === 0) return { awardedCount: 0, bonusKarma: 0 }

  const bonusKarma = calculateDisputeVoteBonusKarma(jobUsdValue)
  let awardedCount = 0

  // Award bonus to voters on winning side
  for (const vote of votes) {
    if (vote.vote === winningSide) {
      await awardKarma({
        walletAddress: vote.voter_wallet,
        projectId,
        karmaAmount: bonusKarma,
        incrementDisputeVotesWon: true
      })
      awardedCount++
    }
  }

  return { awardedCount, bonusKarma }
}

/**
 * Apply penalty when a job is cancelled
 */
export async function applyJobCancellationPenalty(
  posterWallet: string,
  projectId: string
) {
  const penaltyKarma = -50 // No tier multiplier on penalties

  await awardKarma({
    walletAddress: posterWallet,
    projectId,
    karmaAmount: penaltyKarma
  })

  return penaltyKarma
}

/**
 * Apply penalty when worker fails to deliver (dispute lost)
 */
export async function applyFailToDeliverPenalty(
  workerWallet: string,
  projectId: string
) {
  const penaltyKarma = -50 // No tier multiplier on penalties

  await awardKarma({
    walletAddress: workerWallet,
    projectId,
    karmaAmount: penaltyKarma
  })

  return penaltyKarma
}

/**
 * Get job-related karma stats for a wallet
 */
export async function getJobKarmaStats(walletAddress: string, projectId: string) {
  const { data, error } = await supabase
    .from('wallet_karma')
    .select('*')
    .eq('wallet_address', walletAddress)
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
    return {
      applications_submitted_count: 0,
      jobs_completed_as_worker_count: 0,
      jobs_posted_as_poster_count: 0,
      dispute_votes_cast_count: 0,
      dispute_votes_won_count: 0,
      dispute_win_rate: 0
    }
  }

  const disputeWinRate = data.dispute_votes_cast_count > 0
    ? (data.dispute_votes_won_count / data.dispute_votes_cast_count) * 100
    : 0

  return {
    applications_submitted_count: data.applications_submitted_count,
    jobs_completed_as_worker_count: data.jobs_completed_as_worker_count,
    jobs_posted_as_poster_count: data.jobs_posted_as_poster_count,
    dispute_votes_cast_count: data.dispute_votes_cast_count,
    dispute_votes_won_count: data.dispute_votes_won_count,
    dispute_win_rate: disputeWinRate
  }
}


