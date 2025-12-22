import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { notifyAssetRejected } from '@/lib/notifications/social-asset-notifications'
import { checkEditorPermission, requireEditorPermission } from '@/lib/permissions/editor-permissions'
import { sendAssetRejectedEmail } from '@/lib/emails/social-asset-emails'

/**
 * POST /api/assets/reject
 * 
 * Rejects a pending social asset submission
 * - Updates pending asset status to 'rejected'
 * - Records rejection reason and rejector
 * - Creates notification for submitter
 * - Logs admin action
 * - Does NOT revoke karma (immediate karma from submission is kept)
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

    // 1. Verify editor has permission and get project data
    const permissionCheck = await checkEditorPermission(projectId, editorWallet)
    const permissionError = requireEditorPermission(permissionCheck)
    
    if (permissionError) {
      return NextResponse.json(
        { error: permissionError.error },
        { status: permissionError.status }
      )
    }

    // Get project name for email
    const { data: project } = await supabase
      .from('projects')
      .select('token_name')
      .eq('id', projectId)
      .single()

    // 2. Get pending asset
    const { data: pendingAsset, error: fetchError } = await supabase
      .from('pending_assets')
      .select('*')
      .eq('id', assetId)
      .single()

    if (fetchError || !pendingAsset) {
      return NextResponse.json(
        { error: 'Pending asset not found' },
        { status: 404 }
      )
    }

    // Check if already approved/rejected
    if (pendingAsset.verification_status !== 'pending') {
      return NextResponse.json(
        { error: `Asset is already ${pendingAsset.verification_status}` },
        { status: 400 }
      )
    }

    // 3. Update pending asset to rejected status
    const { error: updateError } = await supabase
      .from('pending_assets')
      .update({
        verification_status: 'rejected',
        rejected_by: editorWallet,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason || null
      })
      .eq('id', assetId)

    if (updateError) {
      console.error('Failed to update pending asset:', updateError)
      return NextResponse.json(
        { error: 'Failed to reject asset' },
        { status: 500 }
      )
    }

    // 4. Create notification for submitter
    const assetData = pendingAsset.asset_data as any
    await notifyAssetRejected(
      pendingAsset.submitter_wallet,
      projectId,
      assetId,
      pendingAsset.asset_type,
      assetData,
      pendingAsset.asset_classification,
      editorWallet,
      reason
    )

    // 5. Send email notification (if user has email)
    try {
      // Fetch user email from user_profiles
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('wallet_address', pendingAsset.submitter_wallet)
        .single()

      if (profile?.email) {
        await sendAssetRejectedEmail(
          profile.email,
          pendingAsset.submitter_wallet,
          pendingAsset.asset_type,
          assetData,
          pendingAsset.asset_classification,
          project?.token_name || 'this project',
          reason
        )
      }
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError)
      // Don't fail the whole operation if email fails
    }

    // 6. Log admin action
    await supabase
      .from('admin_logs')
      .insert({
        admin_wallet: editorWallet,
        action: 'asset_rejected',
        entity_type: 'social_asset',
        entity_id: assetId,
        project_id: projectId,
        details: {
          asset_type: pendingAsset.asset_type,
          asset_classification: pendingAsset.asset_classification,
          submitter: pendingAsset.submitter_wallet,
          rejection_reason: reason || 'No reason provided',
          asset_data: assetData
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Asset rejected successfully'
    })

  } catch (error) {
    console.error('Error in asset rejection:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

