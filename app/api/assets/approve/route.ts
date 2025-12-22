import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { calculateKarma } from '@/lib/karma'
import { notifyAssetApproved } from '@/lib/notifications/social-asset-notifications'
import { checkEditorPermission, requireEditorPermission } from '@/lib/permissions/editor-permissions'
import { sendAssetApprovedEmail } from '@/lib/emails/social-asset-emails'

/**
 * POST /api/assets/approve
 * 
 * Approves a pending social asset submission
 * - Moves asset from pending_assets to social_assets
 * - Awards remaining karma to submitter (75% = 3x the immediate 25%)
 * - Creates notification for submitter
 * - Logs admin action
 * - Requires editor or creator permissions
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { 
      assetId, 
      projectId, 
      editorWallet 
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

    // 3. Calculate karma reward (75% = 3x the immediate 25%)
    const remainingKarmaMultiplier = 3 // 75% is 3 times the initial 25%
    const baseKarma = calculateKarma('add', pendingAsset.submission_token_percentage, true)
    const karmaReward = baseKarma * remainingKarmaMultiplier

    // 4. Award karma to submitter
    const { error: karmaError } = await supabase.rpc('add_karma', {
      p_wallet: pendingAsset.submitter_wallet,
      p_project_id: projectId,
      p_karma_delta: karmaReward
    })

    if (karmaError) {
      console.error('Failed to award karma:', karmaError)
      // Continue anyway - don't fail the whole operation
    }

    // 5. Move asset to social_assets table
    const assetData = pendingAsset.asset_data as any
    let insertData: any = {
      project_id: projectId,
      verified: true,
      verified_at: new Date().toISOString(),
      created_at: pendingAsset.created_at,
      asset_classification: pendingAsset.asset_classification
    }

    if (pendingAsset.asset_type === 'social') {
      insertData = {
        ...insertData,
        platform: assetData.platform.toLowerCase(),
        handle: assetData.handle,
        follower_tier: assetData.followerTier || null,
        profile_url: null // Can be populated later if needed
      }
    } else if (pendingAsset.asset_type === 'domain') {
      // Store domain as a special "platform" type
      insertData = {
        ...insertData,
        platform: 'domain',
        handle: assetData.domain,
        profile_url: assetData.url
      }
    }

    const { data: newAsset, error: insertError } = await supabase
      .from('social_assets')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error('Failed to insert verified asset:', insertError)
      return NextResponse.json(
        { error: 'Failed to create verified asset' },
        { status: 500 }
      )
    }

    // 6. Update pending asset status
    const { error: updateError } = await supabase
      .from('pending_assets')
      .update({
        verification_status: 'verified',
        verified_at: new Date().toISOString(),
        approved_by: editorWallet,
        approved_at: new Date().toISOString()
      })
      .eq('id', assetId)

    if (updateError) {
      console.error('Failed to update pending asset:', updateError)
      // Asset is created, so continue
    }

    // 7. Create notification for submitter
    await notifyAssetApproved(
      pendingAsset.submitter_wallet,
      projectId,
      assetId,
      pendingAsset.asset_type,
      assetData,
      pendingAsset.asset_classification,
      editorWallet,
      karmaReward
    )

    // 8. Send email notification (if user has email)
    try {
      // Fetch user email from user_profiles
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('wallet_address', pendingAsset.submitter_wallet)
        .single()

      if (profile?.email) {
        await sendAssetApprovedEmail(
          profile.email,
          pendingAsset.submitter_wallet,
          pendingAsset.asset_type,
          assetData,
          pendingAsset.asset_classification,
          project?.token_name || 'this project',
          karmaReward
        )
      }
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError)
      // Don't fail the whole operation if email fails
    }

    // 9. Log admin action
    await supabase
      .from('admin_logs')
      .insert({
        admin_wallet: editorWallet,
        action: 'asset_approved',
        entity_type: 'social_asset',
        entity_id: assetId,
        project_id: projectId,
        details: {
          asset_type: pendingAsset.asset_type,
          asset_classification: pendingAsset.asset_classification,
          submitter: pendingAsset.submitter_wallet,
          karma_awarded: karmaReward,
          asset_data: assetData
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Asset approved successfully',
      karmaAwarded: karmaReward,
      assetId: newAsset.id
    })

  } catch (error) {
    console.error('Error in asset approval:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
