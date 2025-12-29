import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
// NOTE: Email sending removed from here - should be done via API routes (server-side only)
// See lib/emails/dispute-emails.ts for email templates

type NotificationInsert = Database['public']['Tables']['notifications']['Insert']

interface DisputeNotificationMetadata {
  job_id: string
  job_title?: string
  disputing_party?: 'poster' | 'worker'
  reason?: string
  worker_percentage?: number
  poster_percentage?: number
  resolution_notes?: string
  admin_wallet?: string
  [key: string]: any
}

/**
 * Notify all active global admins when a dispute is created
 * 
 * @param disputeId - UUID of the dispute
 * @param jobId - UUID of the job
 * @param disputingParty - 'poster' or 'worker'
 * @param disputingWallet - Wallet address of whoever opened the dispute
 * @param reason - Dispute reason text
 */
export async function notifyAdminNewDispute(
  disputeId: string,
  jobId: string,
  disputingParty: 'poster' | 'worker',
  disputingWallet: string,
  reason: string
) {
  try {
    console.log('🔔 notifyAdminNewDispute called with:', {
      disputeId,
      jobId,
      disputingParty,
      disputingWallet: disputingWallet.slice(0, 8) + '...',
      reasonLength: reason.length
    })

    // Get job details for context
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('title, poster_wallet, assigned_to')
      .eq('id', jobId)
      .single()

    if (jobError) {
      console.error('Error fetching job:', jobError)
    }

    const jobTitle = job?.title || 'Unknown Job'

    // Query admin_wallets table for active admins
    console.log('🛡️ Fetching active global admins from admin_wallets...')
    const { data: admins, error: adminError } = await supabase
      .from('admin_wallets')
      .select('wallet_address')
      .eq('is_active', true)

    if (adminError) {
      console.error('Error fetching admin wallets:', adminError)
      return
    }

    if (!admins || admins.length === 0) {
      console.log('⚠️ No active admin wallets found')
      return
    }

    console.log(`Found ${admins.length} active admin(s)`)

    const metadata: DisputeNotificationMetadata = {
      job_id: jobId,
      job_title: jobTitle,
      disputing_party: disputingParty,
      reason: reason.slice(0, 500) // Truncate long reasons
    }

    // Create in-app notifications for each admin
    const notifications: NotificationInsert[] = admins.map(admin => ({
      user_wallet: admin.wallet_address,
      type: 'admin_dispute_new',
      title: `⚖️ New Dispute: ${jobTitle}`,
      message: `${disputingParty === 'poster' ? 'Job poster' : 'Worker'} opened a dispute`,
      actor_wallet: disputingWallet,
      reference_id: disputeId,
      reference_type: 'dispute',
      metadata,
      priority: 'high'
    }))

    console.log('Attempting to insert dispute notifications:', notifications.length)

    const { data, error } = await supabase
      .from('notifications')
      .insert(notifications)
      .select()

    if (error) {
      console.error('Failed to create dispute notifications:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
    } else {
      console.log(`✅ Dispute notifications created successfully: ${data?.length} notification(s)`)
    }

    // TODO: Email notifications should be sent via API route (server-side only)
    // The email templates are available in lib/emails/dispute-emails.ts
    // For now, in-app notifications are the primary notification method
    console.log('📧 Email notifications skipped (should be done via API route)')

  } catch (err) {
    console.error('Error in notifyAdminNewDispute:', err)
  }
}

/**
 * Notify poster and worker when admin resolves dispute
 * 
 * @param disputeId - UUID of the dispute
 * @param jobId - UUID of the job
 * @param posterWallet - Job poster wallet
 * @param workerWallet - Job worker wallet
 * @param adminWallet - Admin who resolved
 * @param workerPercentage - Percentage awarded to worker
 * @param posterPercentage - Percentage awarded to poster
 * @param resolutionNotes - Admin's explanation
 */
export async function notifyDisputeResolved(
  disputeId: string,
  jobId: string,
  posterWallet: string,
  workerWallet: string,
  adminWallet: string,
  workerPercentage: number,
  posterPercentage: number,
  resolutionNotes: string
) {
  try {
    console.log('🔔 notifyDisputeResolved called with:', {
      disputeId,
      jobId,
      posterWallet: posterWallet.slice(0, 8) + '...',
      workerWallet: workerWallet.slice(0, 8) + '...',
      workerPercentage,
      posterPercentage
    })

    // Get job details for context
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('title')
      .eq('id', jobId)
      .single()

    if (jobError) {
      console.error('Error fetching job:', jobError)
    }

    const jobTitle = job?.title || 'Unknown Job'

    const metadata: DisputeNotificationMetadata = {
      job_id: jobId,
      job_title: jobTitle,
      worker_percentage: workerPercentage,
      poster_percentage: posterPercentage,
      resolution_notes: resolutionNotes.slice(0, 500),
      admin_wallet: adminWallet
    }

    // Notify the poster
    const posterNotification: NotificationInsert = {
      user_wallet: posterWallet,
      type: 'job_dispute_resolved',
      title: `⚖️ Dispute Resolved: ${jobTitle}`,
      message: `Admin resolved the dispute. You receive ${posterPercentage}% of escrow.`,
      actor_wallet: adminWallet,
      reference_id: disputeId,
      reference_type: 'dispute',
      metadata,
      priority: 'high'
    }

    // Notify the worker
    const workerNotification: NotificationInsert = {
      user_wallet: workerWallet,
      type: 'job_dispute_resolved',
      title: `⚖️ Dispute Resolved: ${jobTitle}`,
      message: `Admin resolved the dispute. You receive ${workerPercentage}% of escrow.`,
      actor_wallet: adminWallet,
      reference_id: disputeId,
      reference_type: 'dispute',
      metadata,
      priority: 'high'
    }

    console.log('Attempting to insert resolution notifications for poster and worker...')

    const { data, error } = await supabase
      .from('notifications')
      .insert([posterNotification, workerNotification])
      .select()

    if (error) {
      console.error('Failed to create dispute resolution notifications:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
    } else {
      console.log(`✅ Dispute resolution notifications created successfully: ${data?.length} notification(s)`)
    }

    // TODO: Email notifications should be sent via API route (server-side only)
    // The email templates are available in lib/emails/dispute-emails.ts
    // For now, in-app notifications are the primary notification method
    console.log('📧 Resolution email notifications skipped (should be done via API route)')

  } catch (err) {
    console.error('Error in notifyDisputeResolved:', err)
  }
}

/**
 * Helper function to get pending disputes count for admin badge
 */
export async function getPendingDisputesCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('job_disputes')
      .select('id', { count: 'exact', head: true })
      .is('admin_wallet', null) // Not yet resolved by admin
      .neq('status', 'resolved')

    if (error) {
      console.error('Error counting pending disputes:', error)
      return 0
    }

    return count || 0
  } catch (err) {
    console.error('Error in getPendingDisputesCount:', err)
    return 0
  }
}

/**
 * Get pending disputes with job context for admin review
 */
export async function getPendingDisputesForAdmin(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('job_disputes')
      .select(`
        id,
        job_id,
        status,
        opened_by,
        reason,
        created_at,
        ends_at,
        jobs (
          id,
          title,
          poster_wallet,
          assigned_to,
          budget_amount,
          budget_token
        )
      `)
      .is('admin_wallet', null)
      .neq('status', 'resolved')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching pending disputes:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Error in getPendingDisputesForAdmin:', err)
    return []
  }
}

