import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

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
    // Get all editors for this project
    const { data: project } = await supabase
      .from('projects')
      .select('creator_wallet, editor_wallets')
      .eq('id', projectId)
      .single()
    
    if (!project) return
    
    // Create notification for creator and all editors
    const editorWallets = [
      project.creator_wallet,
      ...(project.editor_wallets || [])
    ]
    
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
    
    const { error } = await supabase
      .from('notifications')
      .insert(notifications)
    
    if (error) {
      console.error('Failed to create asset pending notifications:', error)
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
    
    const { error } = await supabase
      .from('notifications')
      .insert(notification)
    
    if (error) {
      console.error('Failed to create asset approved notification:', error)
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
    
    const { error } = await supabase
      .from('notifications')
      .insert(notification)
    
    if (error) {
      console.error('Failed to create asset rejected notification:', error)
    }
  } catch (err) {
    console.error('Error in notifyAssetRejected:', err)
  }
}

