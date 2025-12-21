/**
 * Permission Checking Utilities for Project Editors
 * 
 * Centralized permission checking functions that determine what actions
 * a user can perform on a project. Handles both creator and editor permissions,
 * with session validation for editors.
 * 
 * @module lib/permissions
 */

import { supabase } from '@/lib/supabase'

/**
 * Complete set of permissions for a wallet on a project
 */
export interface ProjectPermissions {
  /** True if wallet is the project creator */
  isCreator: boolean
  /** True if wallet is in editor_wallets array (not including creator) */
  isEditor: boolean
  /** True if wallet can edit project (creator or editor with valid session) */
  canEdit: boolean
  /** True if wallet can add new editors (creator or existing editor) */
  canAddEditors: boolean
  /** True if wallet can remove editors (creator only) */
  canRemoveEditors: boolean
  /** True if wallet can approve/reject assets (creator or editor) */
  canApproveAssets: boolean
}

/**
 * Get all permissions for a wallet on a project
 * 
 * Fetches project data and calculates all permission flags in one call.
 * Returns a complete permissions object with all boolean flags.
 * 
 * @param projectId - UUID of the project
 * @param walletAddress - Wallet address to check permissions for (null if not connected)
 * @returns ProjectPermissions object with all permission flags
 * 
 * @example
 * const perms = await getProjectPermissions('project-uuid', '7xK9...')
 * if (perms.canEdit) {
 *   showEditButton()
 * }
 * if (perms.canRemoveEditors) {
 *   showRemoveEditorButton()
 * }
 */
export async function getProjectPermissions(
  projectId: string,
  walletAddress: string | null
): Promise<ProjectPermissions> {
  // No wallet = no permissions
  if (!walletAddress) {
    return {
      isCreator: false,
      isEditor: false,
      canEdit: false,
      canAddEditors: false,
      canRemoveEditors: false,
      canApproveAssets: false
    }
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('creator_wallet, editor_wallets')
    .eq('id', projectId)
    .single()

  // Project not found = no permissions
  if (error || !project) {
    return {
      isCreator: false,
      isEditor: false,
      canEdit: false,
      canAddEditors: false,
      canRemoveEditors: false,
      canApproveAssets: false
    }
  }

  const isCreator = project.creator_wallet === walletAddress
  const isEditor = project.editor_wallets?.includes(walletAddress) || false

  return {
    isCreator,
    isEditor,
    canEdit: isCreator || isEditor, // Creator or editor can edit (session checked separately)
    canAddEditors: isCreator || isEditor, // Creator or editor can add editors
    canRemoveEditors: isCreator, // Only creator can remove editors
    canApproveAssets: isCreator || isEditor // Creator or editor can approve assets
  }
}

/**
 * Check if wallet is project creator
 * 
 * Simple check to determine if the wallet owns the project.
 * 
 * @param projectId - UUID of the project
 * @param walletAddress - Wallet address to check (null if not connected)
 * @returns true if wallet is the project creator
 * 
 * @example
 * if (await isProjectCreator('project-uuid', wallet)) {
 *   showCreatorOnlyFeatures()
 * }
 */
export async function isProjectCreator(
  projectId: string,
  walletAddress: string | null
): Promise<boolean> {
  if (!walletAddress) return false

  const { data: project } = await supabase
    .from('projects')
    .select('creator_wallet')
    .eq('id', projectId)
    .single()

  return project?.creator_wallet === walletAddress
}

/**
 * Check if wallet is project editor (or creator)
 * 
 * Returns true if wallet is either the creator OR in the editor_wallets array.
 * This is the basic permission check before checking session validity.
 * 
 * @param projectId - UUID of the project
 * @param walletAddress - Wallet address to check (null if not connected)
 * @returns true if wallet is creator or in editor_wallets array
 * 
 * @example
 * if (await isProjectEditor('project-uuid', wallet)) {
 *   // User has editor role, now check session validity
 *   const result = await canEditProject('project-uuid', wallet)
 * }
 */
export async function isProjectEditor(
  projectId: string,
  walletAddress: string | null
): Promise<boolean> {
  if (!walletAddress) return false

  const { data: project } = await supabase
    .from('projects')
    .select('creator_wallet, editor_wallets')
    .eq('id', projectId)
    .single()

  if (!project) return false

  return (
    project.creator_wallet === walletAddress ||
    project.editor_wallets?.includes(walletAddress) ||
    false
  )
}

/**
 * Check if wallet can edit project (has permission AND valid session)
 * 
 * This is the complete check that should be used before allowing edits.
 * It verifies both:
 * 1. User is creator or editor
 * 2. If editor (not creator), has valid active session
 * 
 * Creators bypass session checks and can always edit.
 * Editors must have a valid 24-hour session.
 * 
 * @param projectId - UUID of the project
 * @param walletAddress - Wallet address to check (null if not connected)
 * @returns Object with canEdit boolean and optional reason string
 * 
 * @example
 * const result = await canEditProject('project-uuid', wallet)
 * if (!result.canEdit) {
 *   if (result.reason === 'Session expired - please verify again') {
 *     promptForSignature()
 *   } else {
 *     showError(result.reason)
 *   }
 * }
 */
export async function canEditProject(
  projectId: string,
  walletAddress: string | null
): Promise<{ canEdit: boolean; reason?: string }> {
  if (!walletAddress) {
    return { canEdit: false, reason: 'No wallet connected' }
  }

  // Check if user is editor or creator
  const isEditor = await isProjectEditor(projectId, walletAddress)
  
  if (!isEditor) {
    return { canEdit: false, reason: 'Not authorized as editor' }
  }

  // Creators don't need session verification
  const isCreator = await isProjectCreator(projectId, walletAddress)
  if (isCreator) {
    return { canEdit: true }
  }

  // Editors need valid session
  const { hasValidSession } = await import('./editors')
  const hasSession = await hasValidSession(projectId, walletAddress)

  if (!hasSession) {
    return { canEdit: false, reason: 'Session expired - please verify again' }
  }

  return { canEdit: true }
}

/**
 * Require editor permission or throw error
 * 
 * Useful for API routes that need to enforce editor permissions.
 * Throws an error if the wallet is not an editor, which can be caught
 * and returned as a 403 response.
 * 
 * @param projectId - UUID of the project
 * @param walletAddress - Wallet address to check (null if not connected)
 * @throws Error if wallet is not an editor
 * 
 * @example
 * // In an API route
 * try {
 *   await requireEditorPermission(projectId, wallet)
 *   // Proceed with editor action
 * } catch (error) {
 *   return NextResponse.json({ error: error.message }, { status: 403 })
 * }
 */
export async function requireEditorPermission(
  projectId: string,
  walletAddress: string | null
): Promise<void> {
  const isEditor = await isProjectEditor(projectId, walletAddress)
  
  if (!isEditor) {
    throw new Error('Not authorized as editor for this project')
  }
}

/**
 * Require creator permission or throw error
 * 
 * Useful for API routes that need to enforce creator-only permissions
 * (like removing editors, deleting projects, etc.).
 * 
 * @param projectId - UUID of the project
 * @param walletAddress - Wallet address to check (null if not connected)
 * @throws Error if wallet is not the creator
 * 
 * @example
 * // In an API route for removing editors
 * try {
 *   await requireCreatorPermission(projectId, wallet)
 *   // Proceed with creator-only action
 * } catch (error) {
 *   return NextResponse.json({ error: error.message }, { status: 403 })
 * }
 */
export async function requireCreatorPermission(
  projectId: string,
  walletAddress: string | null
): Promise<void> {
  const isCreator = await isProjectCreator(projectId, walletAddress)
  
  if (!isCreator) {
    throw new Error('Only project creator can perform this action')
  }
}

