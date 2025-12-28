import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { notifyAdminNewDispute } from '@/lib/notifications/dispute-notifications'
import { sendDisputeCreatedEmail } from '@/lib/emails/dispute-emails'

/**
 * POST /api/disputes/notify-admin
 * 
 * Notifies all active global admins about a new dispute
 * - Creates in-app notifications
 * - Sends email notifications to admins with email addresses
 * - Called after a dispute is created
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { 
      disputeId, 
      jobId,
      disputingParty,
      disputingWallet,
      reason
    } = body

    // Validate required fields
    if (!disputeId || !jobId || !disputingParty || !disputingWallet || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: disputeId, jobId, disputingParty, disputingWallet, reason' },
        { status: 400 }
      )
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('title')
      .eq('id', jobId)
      .single()

    if (jobError) {
      console.error('Error fetching job:', jobError)
    }

    const jobTitle = job?.title || 'Unknown Job'

    // 1. Create in-app notifications for all admins
    await notifyAdminNewDispute(
      disputeId,
      jobId,
      disputingParty,
      disputingWallet,
      reason
    )

    // 2. Send email notifications to admins
    try {
      // Get all active admins with email addresses
      const { data: admins, error: adminError } = await supabase
        .from('admin_wallets')
        .select('wallet_address, email')
        .eq('is_active', true)

      if (adminError) {
        console.error('Error fetching admins:', adminError)
      } else if (admins && admins.length > 0) {
        const emailPromises = admins
          .filter(admin => admin.email)
          .map(admin => 
            sendDisputeCreatedEmail(admin.email!, {
              disputeId,
              jobId,
              jobTitle,
              disputingParty,
              reason: reason.slice(0, 500),
              createdAt: new Date().toISOString()
            })
          )

        if (emailPromises.length > 0) {
          const results = await Promise.allSettled(emailPromises)
          const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length
          console.log(`✅ Sent ${successCount}/${emailPromises.length} dispute notification emails`)
        }
      }
    } catch (emailError) {
      console.error('Failed to send admin notification emails:', emailError)
      // Don't fail the whole operation if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Admin notifications sent successfully'
    })

  } catch (error) {
    console.error('Error notifying admins of dispute:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

