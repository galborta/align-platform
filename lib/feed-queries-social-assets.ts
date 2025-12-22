import { supabase } from '@/lib/supabase'

/**
 * Fetch pending social assets for a project (for yellow feed)
 * Returns assets awaiting editor review
 */
export async function fetchPendingSocialAssets(
  projectId: string,
  limit: number = 20,
  offset: number = 0
) {
  try {
    const { data, error } = await supabase
      .from('pending_assets')
      .select(`
        id,
        asset_type,
        asset_data,
        asset_classification,
        submitter_wallet,
        submission_token_balance,
        submission_token_percentage,
        verification_status,
        created_at,
        approved_by,
        approved_at,
        rejected_by,
        rejected_at,
        rejection_reason
      `)
      .eq('project_id', projectId)
      .in('verification_status', ['pending', 'verified', 'rejected'])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching pending assets:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Error in fetchPendingSocialAssets:', err)
    return []
  }
}

/**
 * Count pending social assets awaiting review
 * Used for badge counter in sidebar
 */
export async function countPendingSocialAssets(projectId: string) {
  try {
    const { count, error } = await supabase
      .from('pending_assets')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('verification_status', 'pending')

    if (error) {
      console.error('Error counting pending assets:', error)
      return 0
    }

    return count || 0
  } catch (err) {
    console.error('Error in countPendingSocialAssets:', err)
    return 0
  }
}

/**
 * Transform raw pending assets into display format
 */
export interface SocialAssetFeedItem {
  id: string
  assetType: 'social' | 'domain'
  classification: 'official' | 'affiliated'
  platform?: string
  handle?: string
  domain?: string
  url?: string
  followerTier?: string
  submitterWallet: string
  submissionTokenPercentage: number
  status: 'pending' | 'verified' | 'rejected'
  createdAt: string
  approvedBy?: string
  approvedAt?: string
  rejectedBy?: string
  rejectedAt?: string
  rejectionReason?: string
}

export function transformPendingAsset(asset: any): SocialAssetFeedItem {
  const assetData = asset.asset_data || {}
  
  const base: SocialAssetFeedItem = {
    id: asset.id,
    assetType: asset.asset_type,
    classification: asset.asset_classification || 'official',
    submitterWallet: asset.submitter_wallet,
    submissionTokenPercentage: asset.submission_token_percentage,
    status: asset.verification_status,
    createdAt: asset.created_at,
    approvedBy: asset.approved_by,
    approvedAt: asset.approved_at,
    rejectedBy: asset.rejected_by,
    rejectedAt: asset.rejected_at,
    rejectionReason: asset.rejection_reason
  }

  if (asset.asset_type === 'social') {
    return {
      ...base,
      platform: assetData.platform,
      handle: assetData.handle,
      followerTier: assetData.followerTier
    }
  } else if (asset.asset_type === 'domain') {
    return {
      ...base,
      domain: assetData.domain,
      url: assetData.url
    }
  }

  return base
}

