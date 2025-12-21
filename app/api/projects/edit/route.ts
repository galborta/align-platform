import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyRequestSignature } from '@/lib/signature-auth'
import { canEditProject } from '@/lib/permissions'

/**
 * POST /api/projects/edit
 * 
 * Edit project information (description, profile_image_url)
 * Projects are always live after creation
 * Requires signature verification and editor permissions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      project_id, 
      description, 
      profile_image_url,
      wallet, 
      signature, 
      message 
    } = body

    console.log('[Edit Project API] Request received:', {
      project_id,
      wallet: wallet?.slice(0, 8),
      hasDescription: description !== undefined,
      hasImageUrl: profile_image_url !== undefined
    })

    // Validate required fields
    if (!project_id || !wallet || !signature || !message) {
      console.error('[Edit Project API] Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields: project_id, wallet, signature, and message are required' },
        { status: 400 }
      )
    }

    // At least one field must be provided
    if (description === undefined && profile_image_url === undefined) {
      console.error('[Edit Project API] No fields to update')
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Verify signature
    const signatureVerification = verifyRequestSignature(
      { wallet, signature, message },
      { action: 'Edit', resourceId: project_id }
    )

    if (!signatureVerification.success) {
      console.error('[Edit Project API] Signature verification failed:', signatureVerification.error)
      return NextResponse.json(
        { error: signatureVerification.error || 'Invalid signature' },
        { status: 403 }
      )
    }

    console.log('[Edit Project API] ✅ Signature verified')

    // Check edit permissions (includes session validation for editors)
    const editPermission = await canEditProject(project_id, wallet)
    
    if (!editPermission.canEdit) {
      console.error('[Edit Project API] Permission denied:', editPermission.reason)
      return NextResponse.json(
        { error: editPermission.reason || 'Not authorized to edit this project' },
        { status: 403 }
      )
    }

    console.log('[Edit Project API] ✅ Permissions verified')

    const supabase = supabaseAdmin

    // Fetch current project
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .single()

    if (fetchError || !project) {
      console.error('[Edit Project API] Project not found:', fetchError)
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    console.log('[Edit Project API] Project found:', project.token_name)

    // Build updates object (only changed fields)
    const updates: any = {}
    const changedFields: string[] = []

    // Description
    if (description !== undefined && description !== project.description) {
      // Validate description
      if (description.trim().length < 10) {
        return NextResponse.json(
          { error: 'Description must be at least 10 characters' },
          { status: 400 }
        )
      }
      if (description.length > 500) {
        return NextResponse.json(
          { error: 'Description must be under 500 characters' },
          { status: 400 }
        )
      }
      updates.description = description.trim()
      changedFields.push('description')
    }

    // Profile Image URL
    if (profile_image_url !== undefined && profile_image_url !== project.profile_image_url) {
      // Validate URL if provided (can be null to clear)
      if (profile_image_url && !isValidURL(profile_image_url)) {
        return NextResponse.json(
          { error: 'Invalid profile image URL format (must start with http:// or https://)' },
          { status: 400 }
        )
      }
      updates.profile_image_url = profile_image_url || null
      changedFields.push('profile_image_url')
    }

    // If no actual changes, return early
    if (changedFields.length === 0) {
      console.log('[Edit Project API] No changes detected')
      return NextResponse.json({
        success: true,
        changed_fields: [],
        message: 'No changes detected'
      })
    }

    console.log('[Edit Project API] Updating fields:', changedFields)

    // Update project
    updates.updated_at = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', project_id)

    if (updateError) {
      console.error('[Edit Project API] Error updating project:', updateError)
      return NextResponse.json(
        { error: 'Failed to update project' },
        { status: 500 }
      )
    }

    console.log('[Edit Project API] ✅ Project updated successfully')

    // Log to admin_logs
    try {
      await supabase
        .from('admin_logs')
        .insert({
          action: 'project_edited',
          admin_wallet: wallet,
          project_id: project_id,
          details: {
            changed_fields: changedFields,
            project_name: project.token_name
          }
        })
      console.log('[Edit Project API] ✅ Activity logged')
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error('[Edit Project API] Failed to log activity:', logError)
    }

    return NextResponse.json({
      success: true,
      changed_fields: changedFields,
      message: 'Project updated successfully'
    })

  } catch (error) {
    console.error('[Edit Project API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Validate URL format
 * Must start with http:// or https://
 */
function isValidURL(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

