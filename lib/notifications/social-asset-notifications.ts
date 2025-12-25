import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { notificationService } from '@/lib/services/notificationService'

type NotificationInsert = Database['public']['Tables']['notifications']['Insert']

interface NotificationMetadata {
  asset_id?: string
  asset_classification?: 'official' | 'affiliated'
  asset_platform?: string
  asset_handle?: string
  asset_domain?: string
  rejection_reason?: string
  karma_points?: number
  project_id?: string
  [key: string]: any
}

/**
 * Create notification for new social asset submission (sent to project editors)
 */
export async function notifyAssetPending(
  projectId: string,
  assetId: string,
  submitterWallet: string,
  assetType: 'social' | 'domain',
  assetData: any,
  classification: 'official' | 'affiliated'
) {
  try {
    console.log('🔔 notifyAssetPending called with:', {
      projectId,
      assetId,
      submitterWallet,
      assetType,
      classification
    })

    // Get all editors for this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('creator_wallet, editor_wallets')
      .eq('id', projectId)
      .single()
    
    if (projectError) {
      console.error('Error fetching project:', projectError)
      return
    }

    if (!project) {
      console.log('No project found for ID:', projectId)
      return
    }
    
    console.log('Project data:', project)

    // Create notification for creator and all editors
    const editorWallets = [
      project.creator_wallet,
      ...(project.editor_wallets || [])
    ].filter(Boolean) // Remove any null/undefined values
    
    console.log('Editor wallets:', editorWallets)

    if (editorWallets.length === 0) {
      console.log('No editor wallets found')
      return
    }

    const metadata: NotificationMetadata = {
      asset_id: assetId,
      asset_classification: classification,
      project_id: projectId
    }
    
    // Add platform/domain specific metadata
    if (assetType === 'social') {
      metadata.asset_platform = assetData.platform
      metadata.asset_handle = assetData.handle
    } else {
      metadata.asset_domain = assetData.domain
    }
    
    const notifications: NotificationInsert[] = editorWallets.map(wallet => ({
      user_wallet: wallet,
      type: 'social_asset_pending',
      title: `New ${classification} ${assetType} asset submitted`,
      message: assetType === 'social'
        ? `@${assetData.handle} on ${assetData.platform}`
        : assetData.domain,
      actor_wallet: submitterWallet,
      reference_id: assetId,
      reference_type: 'asset',
      metadata,
      priority: 'high'
    }))
    
    console.log('Attempting to insert notifications:', notifications)

    const { data, error } = await supabase
      .from('notifications')
      .insert(notifications)
      .select()
    
    if (error) {
      console.error('Failed to create asset pending notifications:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
    } else {
      console.log('✅ Notifications created successfully:', data)
    }

    // Also notify all global admins from admin_wallets table
    console.log('🛡️ Notifying global admins...')
    try {
      const { data: admins, error: adminError } = await supabase
        .from('admin_wallets')
        .select('wallet_address')
        .eq('is_active', true)

      if (adminError) {
        console.error('Error fetching admin wallets:', adminError)
      } else if (admins && admins.length > 0) {
        const adminNotifications: NotificationInsert[] = admins.map(admin => ({
          user_wallet: admin.wallet_address,
          type: 'social_asset_pending',
          title: `New ${classification} ${assetType} asset submitted`,
          message: assetType === 'social'
            ? `@${assetData.handle} on ${assetData.platform}`
            : assetData.domain,
          actor_wallet: submitterWallet,
          reference_id: assetId,
          reference_type: 'asset',
          metadata,
          priority: 'high'
        }))

        const { error: adminNotifError } = await supabase
          .from('notifications')
          .insert(adminNotifications)

        if (adminNotifError) {
          console.error('Failed to notify admins:', adminNotifError)
        } else {
          console.log(`✅ Notified ${admins.length} global admin(s)`)
        }
      } else {
        console.log('⚠️ No active admin wallets found')
      }
    } catch (adminErr) {
      console.error('Error notifying admins:', adminErr)
    }
  } catch (err) {
    console.error('Error in notifyAssetPending:', err)
  }
}

/**
 * Create notification for asset approval (sent to submitter)
 */
export async function notifyAssetApproved(
  submitterWallet: string,
  projectId: string,
  assetId: string,
  assetType: 'social' | 'domain',
  assetData: any,
  classification: 'official' | 'affiliated',
  approverWallet: string,
  karmaAwarded: number
) {
  try {
    console.log('🔔 notifyAssetApproved called with:', {
      submitterWallet,
      projectId,
      assetId,
      assetType,
      classification,
      karmaAwarded
    })

    const metadata: NotificationMetadata = {
      asset_id: assetId,
      asset_classification: classification,
      project_id: projectId,
      karma_points: karmaAwarded
    }
    
    if (assetType === 'social') {
      metadata.asset_platform = assetData.platform
      metadata.asset_handle = assetData.handle
    } else {
      metadata.asset_domain = assetData.domain
    }
    
    const notification: NotificationInsert = {
      user_wallet: submitterWallet,
      type: 'social_asset_approved',
      title: `Your ${classification} ${assetType} asset was approved!`,
      message: assetType === 'social'
        ? `@${assetData.handle} on ${assetData.platform} (+${karmaAwarded.toFixed(1)} karma)`
        : `${assetData.domain} (+${karmaAwarded.toFixed(1)} karma)`,
      actor_wallet: approverWallet,
      reference_id: assetId,
      reference_type: 'asset',
      metadata,
      priority: 'normal'
    }
    
    console.log('Attempting to insert approval notification:', notification)

    const { data, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
    
    if (error) {
      console.error('Failed to create asset approved notification:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
    } else {
      console.log('✅ Approval notification created successfully:', data)
    }
  } catch (err) {
    console.error('Error in notifyAssetApproved:', err)
  }
}

/**
 * Create notification for asset rejection (sent to submitter)
 */
export async function notifyAssetRejected(
  submitterWallet: string,
  projectId: string,
  assetId: string,
  assetType: 'social' | 'domain',
  assetData: any,
  classification: 'official' | 'affiliated',
  rejectorWallet: string,
  reason?: string
) {
  try {
    console.log('🔔 notifyAssetRejected called with:', {
      submitterWallet,
      projectId,
      assetId,
      assetType,
      classification,
      reason
    })

    const metadata: NotificationMetadata = {
      asset_id: assetId,
      asset_classification: classification,
      project_id: projectId,
      rejection_reason: reason
    }
    
    if (assetType === 'social') {
      metadata.asset_platform = assetData.platform
      metadata.asset_handle = assetData.handle
    } else {
      metadata.asset_domain = assetData.domain
    }
    
    const notification: NotificationInsert = {
      user_wallet: submitterWallet,
      type: 'social_asset_rejected',
      title: `Your ${classification} ${assetType} asset was rejected`,
      message: assetType === 'social'
        ? `@${assetData.handle} on ${assetData.platform}`
        : assetData.domain,
      actor_wallet: rejectorWallet,
      reference_id: assetId,
      reference_type: 'asset',
      metadata,
      priority: 'normal'
    }
    
    console.log('Attempting to insert rejection notification:', notification)

    const { data, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
    
    if (error) {
      console.error('Failed to create asset rejected notification:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
    } else {
      console.log('✅ Rejection notification created successfully:', data)
    }
  } catch (err) {
    console.error('Error in notifyAssetRejected:', err)
  }
}

