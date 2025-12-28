import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { notifyDisputeResolved } from '@/lib/notifications/dispute-notifications'
import { sendDisputeResolvedEmail } from '@/lib/emails/dispute-emails'

/**
 * POST /api/disputes/resolve
 * 
 * Resolves a dispute as an admin
 * - Calls record_admin_resolution RPC
 * - Creates in-app notifications for poster and worker
 * - Sends email notifications
 * - Requires global admin permissions
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { 
      disputeId, 
      adminWallet,
      workerPercentage,
      posterPercentage,
      resolutionNotes 
    } = body

    // Validate required fields
    if (!disputeId || !adminWallet || workerPercentage === undefined || posterPercentage === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: disputeId, adminWallet, workerPercentage, posterPercentage' },
        { status: 400 }
      )
    }

    // Validate percentages sum to 100
    if (workerPercentage + posterPercentage !== 100) {
      return NextResponse.json(
        { error: 'Worker and poster percentages must sum to 100' },
        { status: 400 }
      )
    }

    // 1. Verify admin permission
    const { data: adminData, error: adminError } = await supabase
      .from('admin_wallets')
      .select('wallet_address')
      .eq('wallet_address', adminWallet)
      .eq('is_active', true)
      .maybeSingle()

    if (adminError || !adminData) {
      return NextResponse.json(
        { error: 'Unauthorized: Not a global admin' },
        { status: 403 }
      )
    }

    // 2. Get dispute details (with job info)
    const { data: dispute, error: disputeError } = await supabase
      .from('job_disputes')
      .select(`
        id,
        job_id,
        status,
        jobs (
          id,
          title,
          poster_wallet,
          assigned_to
        )
      `)
      .eq('id', disputeId)
      .single()

    if (disputeError || !dispute) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      )
    }

    const job = dispute.jobs as any
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found for this dispute' },
        { status: 404 }
      )
    }

    // 3. Call the resolution RPC function
    const { error: rpcError } = await supabase.rpc('record_admin_resolution', {
      p_dispute_id: disputeId,
      p_admin_wallet: adminWallet,
      p_worker_percentage: workerPercentage,
      p_poster_percentage: posterPercentage,
      p_resolution_notes: resolutionNotes || ''
    })

    if (rpcError) {
      console.error('Resolution RPC error:', rpcError)
      return NextResponse.json(
        { error: rpcError.message || 'Failed to record resolution' },
        { status: 500 }
      )
    }

    // 4. Create in-app notifications for poster and worker
    await notifyDisputeResolved(
      disputeId,
      dispute.job_id,
      job.poster_wallet,
      job.assigned_to,
      adminWallet,
      workerPercentage,
      posterPercentage,
      resolutionNotes || ''
    )

    // 5. Send email notifications
    try {
      // Get user profiles with emails
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('wallet_address, email')
        .in('wallet_address', [job.poster_wallet, job.assigned_to])

      const resolutionData = {
        disputeId,
        jobTitle: job.title,
        workerPercentage,
        posterPercentage,
        resolutionNotes: resolutionNotes || '',
        resolvedAt: new Date().toISOString()
      }

      // Send to poster
      const posterProfile = profiles?.find(p => p.wallet_address === job.poster_wallet)
      if (posterProfile?.email) {
        await sendDisputeResolvedEmail(posterProfile.email, resolutionData)
      }

      // Send to worker
      const workerProfile = profiles?.find(p => p.wallet_address === job.assigned_to)
      if (workerProfile?.email) {
        await sendDisputeResolvedEmail(workerProfile.email, resolutionData)
      }

      console.log('✅ Resolution emails sent')
    } catch (emailError) {
      console.error('Failed to send resolution emails:', emailError)
      // Don't fail the whole operation if email fails
    }

    // 6. Log admin action
    await supabase
      .from('admin_logs')
      .insert({
        admin_wallet: adminWallet,
        action: 'dispute_resolved',
        entity_type: 'dispute',
        entity_id: disputeId,
        details: {
          job_id: dispute.job_id,
          job_title: job.title,
          worker_percentage: workerPercentage,
          poster_percentage: posterPercentage,
          resolution_notes: resolutionNotes
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Dispute resolved successfully',
      disputeId,
      workerPercentage,
      posterPercentage
    })

  } catch (error) {
    console.error('Error resolving dispute:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

