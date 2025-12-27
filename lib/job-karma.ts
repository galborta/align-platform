/**
 * Job Karma Helper Functions
 * Convenience functions for awarding karma during job lifecycle events
 * 
 * KARMA SYSTEM - NEW SYSTEM (December 2024)
 * - Removed tier multipliers from all job-related actions
 * - Worker completion karma: USD × 50
 * - Poster completion karma: USD × 20
 * - Voting bonuses: flat 50 karma
 * - Penalties scale with job value
 * - Old karma is grandfathered (not recalculated)
 */

import { supabase } from './supabase'
import {
  calculateJobKarma,
  calculateJobCompletionKarma,
  calculateApplicationUpvoteBonusKarma,
  calculateDisputeVoteBonusKarma,
  calculateCancellationPenalty,
  calculateFailurePenalty
} from './karma'
import { notificationService } from './services/notificationService'

/**
 * Award karma to a wallet for a specific project
 * Automatically creates notifications for milestones, warnings, and bans
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

  const currentKarma = existingKarma?.total_karma_points || 0
  const newKarma = currentKarma + karmaAmount

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

  // ==================== KARMA NOTIFICATIONS ====================
  // Check for milestones, warnings, and bans after karma update
  
  try {
    // 1. Check for MILESTONE crossings (positive achievements)
    if (karmaAmount > 0) {
      const milestones = [100, 500, 1000, 5000, 10000]
      const crossedMilestone = milestones.find(
        m => currentKarma < m && newKarma >= m
      )

      if (crossedMilestone) {
        await notificationService.createNotification({
          userWallet: walletAddress,
          type: 'karma_milestone',
          referenceType: 'karma',
          metadata: {
            karma_points: newKarma,
            karma_level: crossedMilestone.toString()
          }
        })
        console.log(`🎉 Karma milestone notification: ${walletAddress} reached ${crossedMilestone}`)
      }
    }

    // 2. Check for WARNING (first time going negative or dropping to -50)
    if (karmaAmount < 0) {
      // Warning at 0 threshold
      if (currentKarma >= 0 && newKarma < 0) {
        await notificationService.createNotification({
          userWallet: walletAddress,
          type: 'karma_warning',
          referenceType: 'karma',
          metadata: {
            karma_points: newKarma
          }
        })
        console.log(`⚠️ Karma warning notification: ${walletAddress} dropped below 0`)
      }
      
      // Warning at -50 threshold
      if (currentKarma >= -50 && newKarma < -50 && newKarma >= -100) {
        await notificationService.createNotification({
          userWallet: walletAddress,
          type: 'karma_warning',
          referenceType: 'karma',
          metadata: {
            karma_points: newKarma
          }
        })
        console.log(`⚠️ Karma warning notification: ${walletAddress} dropped below -50`)
      }

      // 3. Check for BAN (dropping below -100)
      if (currentKarma >= -100 && newKarma < -100) {
        await notificationService.createNotification({
          userWallet: walletAddress,
          type: 'karma_ban',
          referenceType: 'karma',
          metadata: {
            karma_points: newKarma
          }
        })
        console.log(`🚫 Karma ban notification: ${walletAddress} dropped below -100`)
      }
    }

  } catch (notificationError) {
    console.error('Failed to create karma notification:', notificationError)
    // Don't fail karma award if notification fails
  }
}

/**
 * Award karma when a user posts a job
 * NEW SYSTEM: No immediate karma for posting - karma is awarded only on completion
 */
export async function awardPostJobKarma(
  posterWallet: string,
  projectId: string
) {
  // NEW SYSTEM: No immediate karma for posting
  // Karma is awarded only on completion (USD × 20)
  return 0
}

/**
 * Award karma when a user applies to a job
 * NEW SYSTEM: No immediate karma for applying - karma is awarded only on completion if you win
 */
export async function awardApplyToJobKarma(
  applicantWallet: string,
  projectId: string
) {
  // NEW SYSTEM: No immediate karma for applying
  // Karma is awarded only on completion if you win (USD × 50)
  await awardKarma({
    walletAddress: applicantWallet,
    projectId,
    karmaAmount: 0,
    incrementApplications: true
  })
  
  return 0
}

/**
 * Award karma when a user upvotes an application
 * NEW SYSTEM: No tier multipliers - everyone earns same for same action
 */
export async function awardUpvoteApplicationKarma(
  voterWallet: string,
  projectId: string
) {
  const karma = calculateJobKarma('UPVOTE_APPLICATION', true)

  await awardKarma({
    walletAddress: voterWallet,
    projectId,
    karmaAmount: karma
  })

  return karma
}

/**
 * Award karma when a user votes on a dispute
 * NEW SYSTEM: No tier multipliers - everyone earns same for same action
 */
export async function awardDisputeVoteKarma(
  voterWallet: string,
  projectId: string
) {
  const karma = calculateJobKarma('VOTE_ON_DISPUTE', true)

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
 * NEW SYSTEM: Worker earns USD × 50, Poster earns USD × 20
 * No delayed karma bonuses (POST_JOB and APPLY_TO_JOB are 0)
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
    posterWallet,
    workerWallet,
    jobUsdValue,
    winningApplicationId
  } = params

  // 1. Award USD-based completion karma (NEW SYSTEM: different amounts)
  const posterCompletionKarma = calculateJobCompletionKarma(jobUsdValue, false)  // false = poster
  const workerCompletionKarma = calculateJobCompletionKarma(jobUsdValue, true)   // true = worker

  await awardKarma({
    walletAddress: posterWallet,
    projectId,
    karmaAmount: posterCompletionKarma
  })

  await awardKarma({
    walletAddress: workerWallet,
    projectId,
    karmaAmount: workerCompletionKarma,
    incrementJobsCompleted: true
  })

  // 2. No delayed karma in new system (POST_JOB and APPLY_TO_JOB are 0)

  // 3. Award bonus karma to voters who upvoted winning application
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
    posterKarma: posterCompletionKarma,
    workerKarma: workerCompletionKarma,
    upvoterBonus: upvoters ? calculateApplicationUpvoteBonusKarma(jobUsdValue) : 0
  }
}

/**
 * Award bonus karma to dispute voters on the winning side
 * NEW SYSTEM: Flat 50 karma bonus for correct vote
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
 * NEW SYSTEM: Penalty scales with job value (USD × 5)
 */
export async function applyJobCancellationPenalty(
  posterWallet: string,
  projectId: string,
  jobUsdValue: number
) {
  const penaltyKarma = calculateCancellationPenalty(jobUsdValue)

  await awardKarma({
    walletAddress: posterWallet,
    projectId,
    karmaAmount: penaltyKarma
  })

  return penaltyKarma
}

/**
 * Apply penalty when worker fails to deliver (dispute lost)
 * NEW SYSTEM: Penalty scales with job value (USD × 10)
 */
export async function applyFailToDeliverPenalty(
  workerWallet: string,
  projectId: string,
  jobUsdValue: number
) {
  const penaltyKarma = calculateFailurePenalty(jobUsdValue)

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

/**
 * Award bonus karma to voters who upvoted the winning application
 * Called when a job completes successfully (payment released)
 * NEW SYSTEM (Dec 2024): Flat 50 karma bonus instead of USD-based
 */
export async function awardApplicationUpvoterBonuses(
  jobId: string,
  jobUsdValue: number
): Promise<void> {
  try {
    // Get job details to find the winning worker
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('assigned_to, project_id')
      .eq('id', jobId)
      .single()

    if (jobError) throw jobError
    if (!job || !job.assigned_to) {
      console.log('No worker assigned, skipping upvoter bonuses')
      return
    }

    // Find the winning application (the one that got assigned)
    const { data: winningApp, error: appError } = await supabase
      .from('job_applications')
      .select('id')
      .eq('job_id', jobId)
      .eq('applicant_wallet', job.assigned_to)
      .maybeSingle()

    if (appError) throw appError
    if (!winningApp) {
      console.log('No winning application found')
      return
    }

    // Get all voters who upvoted the winning application
    const { data: votes, error: votesError } = await supabase
      .from('job_application_votes')
      .select('voter_wallet')
      .eq('application_id', winningApp.id)

    if (votesError) throw votesError
    if (!votes || votes.length === 0) {
      console.log('No upvotes on winning application')
      return
    }

    // NEW SYSTEM: Flat 50 karma bonus for all voters (no tier multipliers)
    const bonusKarma = calculateApplicationUpvoteBonusKarma(jobUsdValue)

    // Award karma to each voter
    for (const vote of votes) {
      await awardKarma({
        walletAddress: vote.voter_wallet,
        projectId: job.project_id,
        karmaAmount: bonusKarma
      })
      console.log(`✅ Awarded ${bonusKarma} bonus karma to ${vote.voter_wallet}`)
    }

    console.log(`Completed upvoter bonus distribution for job ${jobId} (${votes.length} voters)`)
  } catch (error) {
    console.error('Error awarding upvoter bonuses:', error)
  }
}
