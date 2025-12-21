import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyRequestSignature } from '@/lib/signature-auth'
import { isValidSolanaAddress } from '@/lib/wallet-validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { project_id, editor_wallet, wallet, signature, message } = body

    console.log('[Remove Editor API] Request received:', {
      project_id,
      editor_wallet: editor_wallet?.slice(0, 8),
      requester: wallet?.slice(0, 8)
    })

    // Validate required fields
    if (!project_id || !editor_wallet || !wallet || !signature || !message) {
      console.error('[Remove Editor API] Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields: project_id, editor_wallet, wallet, signature, and message are required' },
        { status: 400 }
      )
    }

    // Validate editor wallet format
    if (!isValidSolanaAddress(editor_wallet)) {
      return NextResponse.json(
        { error: 'Invalid Solana wallet address format' },
        { status: 400 }
      )
    }

    // Verify signature
    const signatureVerification = verifyRequestSignature(
      { wallet, signature, message },
      { action: 'Remove editor', resourceId: project_id }
    )

    if (!signatureVerification.success) {
      console.error('[Remove Editor API] Signature verification failed:', signatureVerification.error)
      return NextResponse.json(
        { error: signatureVerification.error || 'Invalid signature' },
        { status: 403 }
      )
    }

    console.log('[Remove Editor API] ✅ Signature verified')

    // Initialize Supabase client
    const supabase = supabaseAdmin

    // Fetch project to verify permissions
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('id, creator_wallet, editor_wallets, token_name')
      .eq('id', project_id)
      .single()

    if (fetchError) {
      console.error('[Remove Editor API] Error fetching project:', fetchError)
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    if (!project) {
      console.error('[Remove Editor API] Project not found:', project_id)
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    console.log('[Remove Editor API] Project found:', project.token_name)

    // Check if requester is creator (ONLY creator can remove editors)
    const isCreator = wallet === project.creator_wallet

    console.log('[Remove Editor API] Permission check:', { isCreator })

    if (!isCreator) {
      console.error('[Remove Editor API] Permission denied - only creator can remove editors')
      return NextResponse.json(
        { error: 'Only the project creator can remove editors' },
        { status: 403 }
      )
    }

    // Check if editor_wallet is actually in the editor list
    const currentEditors = project.editor_wallets || []
    if (!currentEditors.includes(editor_wallet)) {
      console.error('[Remove Editor API] Editor not found in project:', editor_wallet.slice(0, 8))
      return NextResponse.json(
        { error: 'This wallet is not an editor of this project' },
        { status: 400 }
      )
    }

    // Prevent creator from removing themselves (they're not in editor list anyway, but safety check)
    if (editor_wallet === project.creator_wallet) {
      return NextResponse.json(
        { error: 'Cannot remove the project creator' },
        { status: 400 }
      )
    }

    console.log('[Remove Editor API] ✅ Validation passed')

    // Remove editor from array
    const updatedEditors = currentEditors.filter(e => e !== editor_wallet)

    const { error: updateError } = await supabase
      .from('projects')
      .update({
        editor_wallets: updatedEditors,
        updated_at: new Date().toISOString()
      })
      .eq('id', project_id)

    if (updateError) {
      console.error('[Remove Editor API] Error updating project:', updateError)
      return NextResponse.json(
        { error: 'Failed to remove editor from project' },
        { status: 500 }
      )
    }

    console.log('[Remove Editor API] ✅ Editor removed from project')

    // Log the action in admin_logs
    try {
      await supabase
        .from('admin_logs')
        .insert({
          action: 'editor_removed',
          admin_wallet: wallet,
          project_id: project_id,
          details: {
            editor_wallet,
            removed_by: wallet,
            project_name: project.token_name,
            timestamp: new Date().toISOString()
          }
        })
      console.log('[Remove Editor API] ✅ Admin log created')
    } catch (logError) {
      console.error('[Remove Editor API] Warning: Failed to create admin log:', logError)
      // Non-critical - continue
    }

    // Create notification for the removed editor
    try {
      await supabase
        .from('notifications')
        .insert({
          type: 'editor_removed',
          user_wallet: editor_wallet,
          actor_wallet: wallet,
          reference_type: 'project',
          reference_id: project_id,
          title: 'Removed as Project Editor',
          message: `You've been removed as an editor for ${project.token_name}`,
          metadata: {
            project_id,
            project_name: project.token_name,
            removed_by: wallet
          }
        })
      console.log('[Remove Editor API] ✅ Notification created')
    } catch (notifError) {
      console.error('[Remove Editor API] Warning: Failed to create notification:', notifError)
      // Non-critical - continue
    }

    // Delete any active editor sessions for this editor on this project
    try {
      await supabase
        .from('editor_sessions')
        .delete()
        .eq('project_id', project_id)
        .eq('editor_wallet', editor_wallet)
      console.log('[Remove Editor API] ✅ Editor sessions deleted')
    } catch (sessionError) {
      console.error('[Remove Editor API] Warning: Failed to delete sessions:', sessionError)
      // Non-critical - continue
    }

    console.log('[Remove Editor API] ✅ Success - Editor removed:', editor_wallet.slice(0, 8))

    return NextResponse.json({
      success: true,
      editor_wallet,
      message: 'Editor removed successfully'
    })

  } catch (error) {
    console.error('[Remove Editor API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

