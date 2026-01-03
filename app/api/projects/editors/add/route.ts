import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyRequestSignature } from '@/lib/signature-auth'
import { validateEditorWallets } from '@/lib/wallet-validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { project_id, editor_wallet, wallet, signature, message } = body

    console.log('[Add Editor API] Request received:', {
      project_id,
      editor_wallet: editor_wallet?.slice(0, 8),
      requester: wallet?.slice(0, 8)
    })

    // Validate required fields
    if (!project_id || !editor_wallet || !wallet || !signature || !message) {
      console.error('[Add Editor API] Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields: project_id, editor_wallet, wallet, signature, and message are required' },
        { status: 400 }
      )
    }

    // Verify signature
    const signatureVerification = verifyRequestSignature(
      { wallet, signature, message },
      { action: 'Add editor', resourceId: project_id }
    )

    if (!signatureVerification.success) {
      console.error('[Add Editor API] Signature verification failed:', signatureVerification.error)
      return NextResponse.json(
        { error: signatureVerification.error || 'Invalid signature' },
        { status: 403 }
      )
    }

    console.log('[Add Editor API] ✅ Signature verified')

    // Initialize Supabase client
    const supabase = supabaseAdmin

    // Fetch project to verify permissions
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('id, creator_wallet, editor_wallets, token_name')
      .eq('id', project_id)
      .single()

    if (fetchError) {
      console.error('[Add Editor API] Error fetching project:', fetchError)
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    if (!project) {
      console.error('[Add Editor API] Project not found:', project_id)
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    console.log('[Add Editor API] Project found:', project.token_name)

    // Check if requester is creator or existing editor
    const isCreator = wallet === project.creator_wallet
    const isEditor = project.editor_wallets?.includes(wallet) || false

    console.log('[Add Editor API] Permission check:', { isCreator, isEditor })

    if (!isCreator && !isEditor) {
      console.error('[Add Editor API] Permission denied for wallet:', wallet.slice(0, 8))
      return NextResponse.json(
        { error: 'Only project creator or existing editors can add new editors' },
        { status: 403 }
      )
    }

    // Validate editor wallet
    const validation = validateEditorWallets(
      [editor_wallet],
      {
        creatorWallet: project.creator_wallet,
        existingEditors: project.editor_wallets || [],
        maxEditors: 20
      }
    )

    if (!validation.valid) {
      console.error('[Add Editor API] Validation failed:', validation.error)
      return NextResponse.json(
        { error: validation.error || 'Invalid editor wallet' },
        { status: 400 }
      )
    }

    console.log('[Add Editor API] ✅ Validation passed')

    // Add editor to array
    const updatedEditors = [...(project.editor_wallets || []), editor_wallet]

    const { error: updateError } = await supabase
      .from('projects')
      .update({
        editor_wallets: updatedEditors,
        updated_at: new Date().toISOString()
      })
      .eq('id', project_id)

    if (updateError) {
      console.error('[Add Editor API] Error updating project:', updateError)
      return NextResponse.json(
        { error: 'Failed to add editor to project' },
        { status: 500 }
      )
    }

    console.log('[Add Editor API] ✅ Editor added to project')

    // Log the action in admin_logs
    try {
      await supabase
        .from('admin_logs')
        .insert({
          action: 'editor_added',
          admin_wallet: wallet,
          project_id: project_id,
          details: {
            editor_wallet,
            added_by: wallet,
            project_name: project.token_name,
            timestamp: new Date().toISOString()
          }
        })
      console.log('[Add Editor API] ✅ Admin log created')
    } catch (logError) {
      console.error('[Add Editor API] Warning: Failed to create admin log:', logError)
      // Non-critical - continue
    }

    // Create notification for the new editor
    try {
      await supabase
        .from('notifications')
        .insert({
          type: 'editor_added',
          user_wallet: editor_wallet,
          actor_wallet: wallet,
          reference_type: 'project',
          reference_id: project_id,
          title: 'Added as Project Editor',
          message: `You've been added as an editor for ${project.token_name}`,
          metadata: {
            project_id,
            project_name: project.token_name,
            added_by: wallet
          }
        })
      console.log('[Add Editor API] ✅ Notification created')
    } catch (notifError) {
      console.error('[Add Editor API] Warning: Failed to create notification:', notifError)
      // Non-critical - continue
    }

    console.log('[Add Editor API] ✅ Success - Editor added:', editor_wallet.slice(0, 8))

    return NextResponse.json({
      success: true,
      editor_wallet,
      message: 'Editor added successfully'
    })

  } catch (error) {
    console.error('[Add Editor API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


