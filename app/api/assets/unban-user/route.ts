import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkEditorPermission, requireEditorPermission } from '@/lib/permissions/editor-permissions'

/**
 * POST /api/assets/unban-user
 * 
 * Unbans a user and restores their hidden assets
 * - Sets is_banned = false in wallet_karma
 * - Restores all hidden assets from this user for this project to pending
 * - Logs admin action
 * - Requires editor or creator permissions
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { 
      userWallet, 
      projectId, 
      editorWallet,
      assetId  // Optional: specific asset to restore
    } = body

    // Validate required fields
    if (!userWallet || !projectId || !editorWallet) {
      return NextResponse.json(
        { error: 'Missing required fields: userWallet, projectId, editorWallet' },
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

    // Use asset's projectId if the passed one is 'all' (global admin view)
    let actualProjectId = projectId
    
    // If projectId is 'all' and we have an assetId, get the projectId from the asset
    if (projectId === 'all' && assetId) {
      const { data: asset } = await supabase
        .from('pending_assets')
        .select('project_id')
        .eq('id', assetId)
        .single()
      
      if (asset) {
        actualProjectId = asset.project_id
      }
    }

    // Global admins can do anything - skip project permission check
    if (!isGlobalAdmin) {
      // 1. Verify editor has permission
      const permissionCheck = await checkEditorPermission(actualProjectId, editorWallet)
      const permissionError = requireEditorPermission(permissionCheck)
      
      if (permissionError) {
        return NextResponse.json(
          { error: permissionError.error },
          { status: permissionError.status }
        )
      }
    }

    // 2. Update wallet_karma to unban user
    const { error: karmaError } = await supabase
      .from('wallet_karma')
      .update({
        is_banned: false,
        banned_at: null,
        ban_expires_at: null
      })
      .eq('wallet_address', userWallet)
      .eq('project_id', actualProjectId)

    if (karmaError) {
      console.error('Failed to update karma record:', karmaError)
      // Continue anyway - restoring assets is still important
    }

    // 3. Restore all hidden assets from this user
    const { data: hiddenAssets, error: fetchError } = await supabase
      .from('pending_assets')
      .select('id')
      .eq('submitter_wallet', userWallet)
      .eq('project_id', actualProjectId)
      .eq('verification_status', 'hidden')

    let assetsRestored = 0
    if (hiddenAssets && hiddenAssets.length > 0) {
      const assetIds = hiddenAssets.map(a => a.id)
      
      const { error: restoreError } = await supabase
        .from('pending_assets')
        .update({
          verification_status: 'pending',
          hidden_at: null
        })
        .in('id', assetIds)
      
      if (restoreError) {
        console.error('Failed to restore hidden assets:', restoreError)
      } else {
        assetsRestored = assetIds.length
      }
    }

    // 4. Log admin action
    await supabase
      .from('admin_logs')
      .insert({
        admin_wallet: editorWallet,
        action: 'user_unbanned',
        entity_type: 'wallet_karma',
        entity_id: userWallet,
        project_id: actualProjectId,
        details: {
          unbanned_wallet: userWallet,
          assets_restored: assetsRestored
        }
      })

    return NextResponse.json({
      success: true,
      message: 'User unbanned successfully',
      assetsRestored
    })

  } catch (error) {
    console.error('Error in user unban:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

