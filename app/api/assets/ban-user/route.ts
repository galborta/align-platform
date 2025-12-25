import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkEditorPermission, requireEditorPermission } from '@/lib/permissions/editor-permissions'

/**
 * POST /api/assets/ban-user
 * 
 * Bans a user from submitting assets and cleans up their submissions
 * - Sets is_banned = true in wallet_karma
 * - Hides all pending assets from this user for this project
 * - Records ban reason and duration
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
      reason,
      duration // 'permanent' | '7d' | '30d' | '90d'
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

    // Use actual projectId (handle 'all' case for global admin)
    let actualProjectId = projectId
    if (projectId === 'all') {
      // For global admin banning from 'all' view, get project from user's first asset
      const { data: userAsset } = await supabase
        .from('pending_assets')
        .select('project_id')
        .eq('submitter_wallet', userWallet)
        .limit(1)
        .single()
      
      if (userAsset) {
        actualProjectId = userAsset.project_id
      } else {
        return NextResponse.json(
          { error: 'No assets found for this user to determine project' },
          { status: 400 }
        )
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

    // 2. Calculate ban expiration
    let banExpiresAt: string | null = null
    if (duration && duration !== 'permanent') {
      const days = parseInt(duration.replace('d', ''))
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + days)
      banExpiresAt = expiryDate.toISOString()
    }

    // 3. Update wallet_karma to ban user
    const { data: karma, error: karmaFetchError } = await supabase
      .from('wallet_karma')
      .select('*')
      .eq('wallet_address', userWallet)
      .eq('project_id', actualProjectId)
      .single()

    if (karmaFetchError || !karma) {
      // Create karma record if doesn't exist
      const { error: createError } = await supabase
        .from('wallet_karma')
        .insert({
          wallet_address: userWallet,
          project_id: actualProjectId,
          is_banned: true,
          banned_at: new Date().toISOString(),
          ban_expires_at: banExpiresAt,
          warning_count: 0,
          warnings: [{
            reason: reason || 'Banned for asset submission violations',
            issued_at: new Date().toISOString(),
            issued_by: editorWallet
          }]
        })
      
      if (createError) {
        console.error('Failed to create karma record:', createError)
        return NextResponse.json(
          { error: 'Failed to ban user' },
          { status: 500 }
        )
      }
    } else {
      // Update existing karma record
      const warnings = karma.warnings || []
      warnings.push({
        reason: reason || 'Banned for asset submission violations',
        issued_at: new Date().toISOString(),
        issued_by: editorWallet
      })

      const { error: updateError } = await supabase
        .from('wallet_karma')
        .update({
          is_banned: true,
          banned_at: new Date().toISOString(),
          ban_expires_at: banExpiresAt,
          warning_count: warnings.length,
          warnings
        })
        .eq('wallet_address', userWallet)
        .eq('project_id', actualProjectId)
      
      if (updateError) {
        console.error('Failed to update karma record:', updateError)
        return NextResponse.json(
          { error: 'Failed to ban user' },
          { status: 500 }
        )
      }
    }

    // 4. Hide ALL assets from this user (pending, verified, rejected - all become hidden)
    const { data: userAssets } = await supabase
      .from('pending_assets')
      .select('id, verification_status')
      .eq('submitter_wallet', userWallet)
      .eq('project_id', actualProjectId)
      .neq('verification_status', 'hidden')  // Don't update already hidden ones

    if (userAssets && userAssets.length > 0) {
      const assetIds = userAssets.map(a => a.id)
      
      const { error: hideError } = await supabase
        .from('pending_assets')
        .update({
          verification_status: 'hidden',
          hidden_at: new Date().toISOString()
        })
        .in('id', assetIds)
      
      if (hideError) {
        console.error('Failed to hide assets:', hideError)
        // Continue anyway - ban is more important
      }
    }
    
    // Count includes all statuses that were hidden
    const pendingAssets = userAssets || []

    // 5. Log admin action
    await supabase
      .from('admin_logs')
      .insert({
        admin_wallet: editorWallet,
        action: 'user_banned',
        entity_type: 'wallet_karma',
        entity_id: userWallet,
        project_id: actualProjectId,
        details: {
          banned_wallet: userWallet,
          reason: reason || 'Asset submission violations',
          duration: duration || 'permanent',
          ban_expires_at: banExpiresAt,
          pending_assets_hidden: pendingAssets?.length || 0
        }
      })

    return NextResponse.json({
      success: true,
      message: 'User banned successfully',
      assetsHidden: pendingAssets?.length || 0,
      banExpiresAt
    })

  } catch (error) {
    console.error('Error in user ban:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

