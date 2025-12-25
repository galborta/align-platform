import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkEditorPermission, requireEditorPermission } from '@/lib/permissions/editor-permissions'

/**
 * POST /api/assets/revoke
 * 
 * Revokes approval of a verified social asset
 * - Updates pending_assets status back to 'rejected'
 * - Removes the asset from social_assets table
 * - Logs admin action
 * - Requires editor or creator permissions
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { 
      assetId, 
      projectId, 
      editorWallet,
      reason 
    } = body

    // Validate required fields
    if (!assetId || !projectId || !editorWallet) {
      return NextResponse.json(
        { error: 'Missing required fields: assetId, projectId, editorWallet' },
        { status: 400 }
      )
    }

    // Check if user is a global admin first
    const { data: adminData } = await supabase
      .from('admin_wallets')
      .select('wallet_address')
      .eq('wallet_address', editorWallet)
      .maybeSingle()
    
    const isGlobalAdmin = !!adminData

    // 2. Get the pending asset record first (to get actual projectId if needed)
    const { data: pendingAsset, error: fetchError } = await supabase
      .from('pending_assets')
      .select('*')
      .eq('id', assetId)
      .single()

    if (fetchError || !pendingAsset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    // Use asset's projectId if the passed one is 'all' (global admin view)
    const actualProjectId = projectId === 'all' ? pendingAsset.project_id : projectId

    // Global admins can do anything - skip project permission check
    if (!isGlobalAdmin) {
      // Verify editor has permission for this specific project
      const permissionCheck = await checkEditorPermission(actualProjectId, editorWallet)
      const permissionError = requireEditorPermission(permissionCheck)
      
      if (permissionError) {
        return NextResponse.json(
          { error: permissionError.error },
          { status: permissionError.status }
        )
      }
    }

    // Verify asset is currently verified
    if (pendingAsset.verification_status !== 'verified') {
      return NextResponse.json(
        { error: 'Can only revoke verified assets' },
        { status: 400 }
      )
    }

    // 3. Find and delete the corresponding social_asset entry
    const assetData = pendingAsset.asset_data as any
    
    // Build query to find the social asset
    let deleteQuery = supabase
      .from('social_assets')
      .delete()
      .eq('project_id', actualProjectId)

    if (pendingAsset.asset_type === 'social') {
      deleteQuery = deleteQuery
        .eq('platform', assetData.platform?.toLowerCase())
        .eq('handle', assetData.handle)
    } else if (pendingAsset.asset_type === 'domain') {
      deleteQuery = deleteQuery
        .eq('platform', 'domain')
        .eq('handle', assetData.domain)
    }

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      console.error('Error deleting social asset:', deleteError)
      // Continue anyway - the pending_assets update is more important
    }

    // 4. Update pending asset status to rejected
    const { error: updateError } = await supabase
      .from('pending_assets')
      .update({
        verification_status: 'rejected',
        rejected_by: editorWallet,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason?.trim() ? `[REVOKED] ${reason.trim()}` : '[REVOKED]'
      })
      .eq('id', assetId)

    if (updateError) {
      console.error('Failed to update pending asset:', updateError)
      return NextResponse.json(
        { error: 'Failed to revoke asset approval' },
        { status: 500 }
      )
    }

    // 5. Log admin action
    await supabase
      .from('admin_logs')
      .insert({
        admin_wallet: editorWallet,
        action: 'asset_revoked',
        entity_type: 'social_asset',
        entity_id: assetId,
        project_id: actualProjectId,
        details: {
          asset_type: pendingAsset.asset_type,
          asset_classification: pendingAsset.asset_classification,
          submitter: pendingAsset.submitter_wallet,
          revocation_reason: reason?.trim() || 'No reason provided',
          asset_data: assetData
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Asset approval revoked successfully'
    })

  } catch (error) {
    console.error('Error in asset revocation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

