import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { canEditProject } from '@/lib/permissions'

/**
 * POST /api/assets/approve
 * 
 * Allows project editors to approve or reject pending social assets
 * submitted by the community.
 * 
 * @route POST /api/assets/approve
 * @access Editors and project creators only
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { asset_id, project_id, action, wallet, rejection_reason } = body

    // Validate required fields
    if (!asset_id || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: asset_id and action are required' },
        { status: 400 }
      )
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    // Fetch the pending asset with project details
    const { data: asset, error: fetchError } = await supabase
      .from('pending_assets')
      .select(`
        *,
        projects!inner (
          id,
          token_name,
          creator_wallet,
          editor_wallets
        )
      `)
      .eq('id', asset_id)
      .single()

    if (fetchError || !asset) {
      console.error('Error fetching asset:', fetchError)
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    const project = asset.projects as any

    // Check permissions if wallet is provided
    if (wallet) {
      const editPermission = await canEditProject(project.id, wallet)
      if (!editPermission.canEdit) {
        return NextResponse.json(
          { error: 'Not authorized to approve assets for this project' },
          { status: 403 }
        )
      }
    }

    const assetData = asset.asset_data as any

    // ============================================
    // APPROVE ACTION
    // ============================================
    if (action === 'approve') {
      // 1. Update pending asset status to verified
      const { error: updateError } = await supabase
        .from('pending_assets')
        .update({
          verification_status: 'verified',
          verified_at: new Date().toISOString()
        })
        .eq('id', asset_id)

      if (updateError) {
        console.error('Error updating pending asset:', updateError)
        return NextResponse.json(
          { error: 'Failed to approve asset' },
          { status: 500 }
        )
      }

      // 2. Create verified social asset
      const { error: insertError } = await supabase
        .from('social_assets')
        .insert({
          project_id: asset.project_id,
          platform: assetData.platform?.toLowerCase() || '',
          handle: assetData.handle || '',
          follower_tier: assetData.follower_tier || null,
          verified: true,
          verified_at: new Date().toISOString(),
          verified_by: wallet || null
        })

      if (insertError) {
        console.error('Error creating social asset:', insertError)
        return NextResponse.json(
          { error: 'Failed to create verified social asset' },
          { status: 500 }
        )
      }

      // 3. Log approval action
      if (wallet) {
        await supabase
          .from('admin_logs')
          .insert({
            action: 'social_asset_approved',
            admin_wallet: wallet,
            project_id: asset.project_id,
            entity_id: asset_id,
            entity_type: 'pending_asset',
            details: {
              asset_type: asset.asset_type,
              platform: assetData.platform,
              handle: assetData.handle,
              project_name: project.token_name,
              submitter_wallet: asset.submitter_wallet
            }
          })
      }

      // 4. Send notification to submitter
      await supabase
        .from('notifications')
        .insert({
          type: 'social_asset_approved',
          user_wallet: asset.submitter_wallet,
          message: `Your ${assetData.platform} account @${assetData.handle} was approved for ${project.token_name}`,
          reference_id: asset.project_id,
          reference_type: 'project',
          metadata: {
            platform: assetData.platform,
            handle: assetData.handle,
            project_name: project.token_name,
            project_id: asset.project_id,
            asset_id: asset_id
          }
        })

      return NextResponse.json({
        success: true,
        message: 'Asset approved successfully',
        data: {
          asset_id,
          platform: assetData.platform,
          handle: assetData.handle
        }
      })
    }

    // ============================================
    // REJECT ACTION
    // ============================================
    if (action === 'reject') {
      // 1. Update pending asset status to hidden/rejected
      const { error: updateError } = await supabase
        .from('pending_assets')
        .update({
          verification_status: 'hidden',
          hidden_at: new Date().toISOString()
        })
        .eq('id', asset_id)

      if (updateError) {
        console.error('Error updating pending asset:', updateError)
        return NextResponse.json(
          { error: 'Failed to reject asset' },
          { status: 500 }
        )
      }

      // 2. Log rejection action
      if (wallet) {
        await supabase
          .from('admin_logs')
          .insert({
            action: 'social_asset_rejected',
            admin_wallet: wallet,
            project_id: asset.project_id,
            entity_id: asset_id,
            entity_type: 'pending_asset',
            details: {
              asset_type: asset.asset_type,
              platform: assetData.platform,
              handle: assetData.handle,
              rejection_reason: rejection_reason || null,
              project_name: project.token_name,
              submitter_wallet: asset.submitter_wallet
            }
          })
      }

      // 3. Send notification to submitter
      const reasonText = rejection_reason ? `: ${rejection_reason}` : ''
      await supabase
        .from('notifications')
        .insert({
          type: 'social_asset_rejected',
          user_wallet: asset.submitter_wallet,
          message: `Your ${assetData.platform} account @${assetData.handle} was not approved for ${project.token_name}${reasonText}`,
          reference_id: asset.project_id,
          reference_type: 'project',
          metadata: {
            platform: assetData.platform,
            handle: assetData.handle,
            rejection_reason: rejection_reason || null,
            project_name: project.token_name,
            project_id: asset.project_id,
            asset_id: asset_id
          }
        })

      return NextResponse.json({
        success: true,
        message: 'Asset rejected successfully',
        data: {
          asset_id,
          platform: assetData.platform,
          handle: assetData.handle,
          rejection_reason: rejection_reason || null
        }
      })
    }

    // Should never reach here due to action validation above
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error in asset approval endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

