import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface Editor {
  wallet_address: string
  added_at: string
  added_by: string
  last_active?: string
  added_via?: 'creation' | 'invite' | 'direct'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    console.log('[Get Editors API] Fetching editors for project:', projectId)

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const supabase = supabaseAdmin

    // Fetch project with editor wallets
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, creator_wallet, editor_wallets, created_at')
      .eq('id', projectId)
      .single()

    if (projectError) {
      console.error('[Get Editors API] Error fetching project:', projectError)
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    if (!project) {
      console.error('[Get Editors API] Project not found:', projectId)
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    const editorWallets = project.editor_wallets || []
    console.log('[Get Editors API] Found', editorWallets.length, 'editors')

    // Build editor metadata array
    const editors: Editor[] = []

    // For each editor wallet, fetch metadata from admin_logs and editor_sessions
    for (const editorWallet of editorWallets) {
      // Try to find when they were added (from admin_logs)
      const { data: addLog } = await supabase
        .from('admin_logs')
        .select('created_at, admin_wallet, details')
        .eq('project_id', projectId)
        .eq('action', 'editor_added')
        .contains('details', { editor_wallet: editorWallet })
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // Try to find last active time (from editor_sessions)
      const { data: lastSession } = await supabase
        .from('editor_sessions')
        .select('last_activity_at')
        .eq('project_id', projectId)
        .eq('editor_wallet', editorWallet)
        .order('last_activity_at', { ascending: false })
        .limit(1)
        .single()

      // Determine how they were added
      let addedVia: 'creation' | 'invite' | 'direct' = 'direct'
      
      // If added at project creation time (within 1 minute of project creation)
      if (addLog && project.created_at) {
        const addTime = new Date(addLog.created_at).getTime()
        const createTime = new Date(project.created_at).getTime()
        const timeDiff = Math.abs(addTime - createTime)
        
        if (timeDiff < 60000) { // Within 1 minute
          addedVia = 'creation'
        }
      }

      editors.push({
        wallet_address: editorWallet,
        added_at: addLog?.created_at || project.created_at,
        added_by: addLog?.admin_wallet || project.creator_wallet,
        last_active: lastSession?.last_activity_at || undefined,
        added_via: addedVia
      })
    }

    console.log('[Get Editors API] ✅ Returning', editors.length, 'editors with metadata')

    return NextResponse.json({
      success: true,
      editors,
      total: editors.length,
      creator_wallet: project.creator_wallet
    })

  } catch (error) {
    console.error('[Get Editors API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

