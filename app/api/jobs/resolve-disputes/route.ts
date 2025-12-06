import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { notificationService } from '@/lib/services/notificationService'

export async function POST(request: NextRequest) {
  try {
    // Find all active disputes that have expired
    const { data: expiredDisputes, error: fetchError } = await supabase
      .from('job_disputes')
      .select(`
        *,
        job:jobs(
          *,
          projects:project_id (
            token_symbol
          )
        )
      `)
      .eq('status', 'active')
      .lt('ends_at', new Date().toISOString())

    if (fetchError) {
      console.error('Error fetching expired disputes:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch disputes' },
        { status: 500 }
      )
    }

    if (!expiredDisputes || expiredDisputes.length === 0) {
      return NextResponse.json({
        message: 'No expired disputes to resolve',
        resolved: 0
      })
    }

    const results = []

    // Process each expired dispute
    for (const dispute of expiredDisputes) {
      try {
        // Fetch all votes for this dispute
        const { data: votes, error: votesError } = await supabase
          .from('job_dispute_votes')
          .select('*')
          .eq('dispute_id', dispute.id)

        if (votesError) throw votesError

        // Calculate vote weights
        const releaseWeight = votes
          ?.filter(v => v.vote === 'release')
          .reduce((sum, v) => sum + v.vote_weight, 0) || 0

        const refundWeight = votes
          ?.filter(v => v.vote === 'refund')
          .reduce((sum, v) => sum + v.vote_weight, 0) || 0

        // Determine outcome (tie defaults to release - benefit of doubt)
        const outcome = releaseWeight >= refundWeight 
          ? 'release_to_worker' 
          : 'refund_to_poster'

        // Update dispute status
        const { error: updateDisputeError } = await supabase
          .from('job_disputes')
          .update({
            status: 'resolved',
            outcome,
            resolved_at: new Date().toISOString()
          })
          .eq('id', dispute.id)

        if (updateDisputeError) throw updateDisputeError

        const job = Array.isArray(dispute.job) ? dispute.job[0] : dispute.job
        // Extract token_symbol from joined project data
        const tokenSymbol = (job?.projects as any)?.token_symbol || 'tokens'

        if (outcome === 'release_to_worker') {
          // Release to Worker outcome
          
          // Update job status to completed
          const { error: jobUpdateError } = await supabase
            .from('jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', dispute.job_id)

          if (jobUpdateError) throw jobUpdateError

          // TODO: Award karma to worker (completion karma)
          // const workerKarma = job.payment_amount_usd * 50
          // await awardKarma(job.assigned_to, job.project_id, workerKarma)

          // TODO: Award bonus karma to voters who voted "release"
          // const releaseVoters = votes?.filter(v => v.vote === 'release') || []
          // for (const voter of releaseVoters) {
          //   const bonusKarma = job.payment_amount_usd * 5 * voter.tier_multiplier
          //   await awardKarma(voter.voter_wallet, job.project_id, bonusKarma)
          // }

          // TODO: Transfer payment to worker (Phase 2: on-chain escrow)
          // await releaseEscrow(job.id, job.assigned_to)

          // TODO: Notify both parties
          // await notifyParties(dispute.job_id, 'release_to_worker')

          results.push({
            disputeId: dispute.id,
            jobId: dispute.job_id,
            outcome: 'release_to_worker',
            releaseWeight,
            refundWeight,
            totalVoters: votes?.length || 0
          })

        } else {
          // Refund to Poster outcome
          
          // Update job status to cancelled
          const { error: jobUpdateError } = await supabase
            .from('jobs')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', dispute.job_id)

          if (jobUpdateError) throw jobUpdateError

          // Create failure record for worker (disputed and lost)
          if (job.assigned_to) {
            const { error: failureError } = await supabase
              .from('job_failures')
              .insert({
                job_id: dispute.job_id,
                worker_wallet: job.assigned_to,
                failure_type: 'disputed_lost'
              })

            if (failureError) {
              console.error('Error creating failure record:', failureError)
            }
          }

          // TODO: Award karma to poster (completion karma - they were right)
          // const posterKarma = job.payment_amount_usd * 50
          // await awardKarma(job.poster_wallet, job.project_id, posterKarma)

          // TODO: Award bonus karma to voters who voted "refund"
          // const refundVoters = votes?.filter(v => v.vote === 'refund') || []
          // for (const voter of refundVoters) {
          //   const bonusKarma = job.payment_amount_usd * 5 * voter.tier_multiplier
          //   await awardKarma(voter.voter_wallet, job.project_id, bonusKarma)
          // }

          // TODO: Refund payment to poster (Phase 2: on-chain escrow)
          // await refundEscrow(job.id, job.poster_wallet)

          // ✨ NEW: Notify poster of refund (HIGH PRIORITY - triggers browser notification)
          try {
            await notificationService.createNotification({
              userWallet: job.poster_wallet,
              type: 'payment_refunded',
              referenceId: dispute.job_id,
              referenceType: 'payment',
              metadata: {
                amount: job.payment_amount,
                token: tokenSymbol,
                job_title: job.title
              }
            })
            console.log(`🔔 Payment refund notification sent to ${job.poster_wallet}`)
          } catch (notificationError) {
            console.error('Failed to create refund notification:', notificationError)
            // Don't fail dispute resolution if notification fails
          }

          results.push({
            disputeId: dispute.id,
            jobId: dispute.job_id,
            outcome: 'refund_to_poster',
            releaseWeight,
            refundWeight,
            totalVoters: votes?.length || 0
          })
        }

      } catch (disputeError) {
        console.error(`Error resolving dispute ${dispute.id}:`, disputeError)
        results.push({
          disputeId: dispute.id,
          error: 'Failed to resolve dispute'
        })
      }
    }

    return NextResponse.json({
      message: `Resolved ${results.filter(r => !r.error).length} of ${expiredDisputes.length} disputes`,
      results
    })

  } catch (error) {
    console.error('Error in resolve-disputes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to check how many disputes are ready to resolve
export async function GET(request: NextRequest) {
  try {
    const { data: expiredDisputes, error } = await supabase
      .from('job_disputes')
      .select('id, job_id, ends_at')
      .eq('status', 'active')
      .lt('ends_at', new Date().toISOString())

    if (error) {
      console.error('Error fetching expired disputes:', error)
      return NextResponse.json(
        { error: 'Failed to fetch disputes' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      count: expiredDisputes?.length || 0,
      disputes: expiredDisputes || []
    })
  } catch (error) {
    console.error('Error in resolve-disputes GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

