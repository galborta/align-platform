import { supabase } from '@/lib/supabase'

/**
 * Fetch pending social assets for a project (for yellow feed)
 * Returns assets awaiting editor review
 * @param projectId - Project ID to filter by, or null for global admin view (all projects)
 */
export async function fetchPendingSocialAssets(
  projectId: string | null,
  limit: number = 20,
  offset: number = 0
) {
  try {
    // For global admin view (projectId is null), we need to join with projects to get names
    let query = supabase
      .from('pending_assets')
      .select(`
        id,
        project_id,
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
        rejection_reason,
        projects:project_id (
          token_name
        )
      `)

    // Only filter by project_id if provided (not global admin)
    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query
      .in('verification_status', ['pending', 'verified', 'rejected', 'hidden'])  // Show all statuses for management (including hidden/banned)
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
 * @param projectId - Project ID to filter by, or 'all' for global admin view
 */
export async function countPendingSocialAssets(projectId: string | null) {
  try {
    let query = supabase
      .from('pending_assets')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'pending')

    // Only filter by project_id if not 'all' (global admin view)
    if (projectId && projectId !== 'all') {
      query = query.eq('project_id', projectId)
    }

    const { count, error } = await query

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
  projectId?: string  // For global admin view - show which project the asset belongs to
  projectName?: string  // Project name for global admin view
  assetType: 'social' | 'domain'
  classification: 'official' | 'affiliated'
  platform?: string
  handle?: string
  domain?: string
  url?: string
  followerTier?: string
  submitterWallet: string
  submissionTokenPercentage: number
  status: 'pending' | 'verified' | 'rejected' | 'hidden'
  createdAt: string
  approvedBy?: string
  approvedAt?: string
  rejectedBy?: string
  rejectedAt?: string
  rejectionReason?: string
}

export function transformPendingAsset(asset: any): SocialAssetFeedItem {
  const assetData = asset.asset_data || {}
  
  // Extract project name from joined data (for global admin view)
  const projectName = asset.projects?.token_name || undefined
  
  const base: SocialAssetFeedItem = {
    id: asset.id,
    projectId: asset.project_id,  // Include project_id for global admin view
    projectName,  // Include project name for global admin view
    assetType: asset.asset_type,
    classification: asset.asset_classification || 'official',
    submitterWallet: asset.submitter_wallet,
    submissionTokenPercentage: asset.submission_token_percentage || 0,
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

