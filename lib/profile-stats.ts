import { supabase } from './supabase'

export interface ProfileStats {
  totalJobsCompleted: number
  totalJobsPosted: number
  applicationsSubmitted: number
  applicationWinRate: number
  disputesVoted: number
  disputeAccuracy: number
  totalKarma: number
}

export async function getProfileStats(
  walletAddress: string,
  projectId: string
): Promise<ProfileStats> {
  try {
    const { data, error } = await supabase
      .from('wallet_karma')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('project_id', projectId)
      .maybeSingle()

    if (error) throw error

    const applicationsSubmitted = data?.applications_submitted_count || 0
    const jobsCompleted = data?.jobs_completed_as_worker_count || 0
    const disputesCast = data?.dispute_votes_cast_count || 0
    const disputesWon = data?.dispute_votes_won_count || 0

    return {
      totalJobsCompleted: jobsCompleted,
      totalJobsPosted: data?.jobs_posted_as_poster_count || 0,
      applicationsSubmitted,
      applicationWinRate: applicationsSubmitted > 0 
        ? (jobsCompleted / applicationsSubmitted) * 100 
        : 0,
      disputesVoted: disputesCast,
      disputeAccuracy: disputesCast > 0 
        ? (disputesWon / disputesCast) * 100 
        : 0,
      totalKarma: data?.total_karma_points || 0
    }
  } catch (error) {
    console.error('Error fetching profile stats:', error)
    return {
      totalJobsCompleted: 0,
      totalJobsPosted: 0,
      applicationsSubmitted: 0,
      applicationWinRate: 0,
      disputesVoted: 0,
      disputeAccuracy: 0,
      totalKarma: 0
    }
  }
}

