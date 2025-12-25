import { supabase } from '@/lib/supabase'

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  authorized: boolean
  isCreator: boolean
  isEditor: boolean
  isGlobalAdmin: boolean
  project?: {
    id: string
    creator_wallet: string
    editor_wallets: string[]
  }
  error?: string
}

/**
 * Check if a wallet has editor permissions for a project
 * 
 * A wallet has editor permissions if:
 * - It's a global admin, OR
 * - It's the project creator, OR
 * - It's in the project's editor_wallets array
 * 
 * @param projectId - The project ID to check
 * @param walletAddress - The wallet address to check
 * @returns PermissionCheckResult with authorization status
 */
export async function checkEditorPermission(
  projectId: string,
  walletAddress: string
): Promise<PermissionCheckResult> {
  try {
    // Check if global admin first
    const { data: adminData } = await supabase
      .from('admin_wallets')
      .select('wallet_address')
      .eq('wallet_address', walletAddress)
      .maybeSingle()
    
    const isGlobalAdmin = !!adminData

    // Fetch project with creator and editors
    const { data: project, error } = await supabase
      .from('projects')
      .select('id, creator_wallet, editor_wallets')
      .eq('id', projectId)
      .single()

    if (error || !project) {
      // Global admins can still operate even if project not found in some cases
      if (isGlobalAdmin) {
        return {
          authorized: true,
          isCreator: false,
          isEditor: false,
          isGlobalAdmin: true,
          error: 'Project not found but global admin'
        }
      }
      return {
        authorized: false,
        isCreator: false,
        isEditor: false,
        isGlobalAdmin: false,
        error: 'Project not found'
      }
    }

    // Check if wallet is creator or editor
    const isCreator = project.creator_wallet === walletAddress
    const isEditor = project.editor_wallets?.includes(walletAddress) || false

    return {
      authorized: isGlobalAdmin || isCreator || isEditor,
      isCreator,
      isEditor,
      isGlobalAdmin,
      project: {
        id: project.id,
        creator_wallet: project.creator_wallet,
        editor_wallets: project.editor_wallets || []
      }
    }
  } catch (err) {
    console.error('Error checking editor permission:', err)
    return {
      authorized: false,
      isCreator: false,
      isEditor: false,
      isGlobalAdmin: false,
      error: 'Failed to check permissions'
    }
  }
}

/**
 * Check if a wallet has creator permissions (stricter than editor)
 * Global admins also have creator-level permissions
 * 
 * @param projectId - The project ID to check
 * @param walletAddress - The wallet address to check
 * @returns PermissionCheckResult with authorization status
 */
export async function checkCreatorPermission(
  projectId: string,
  walletAddress: string
): Promise<PermissionCheckResult> {
  const result = await checkEditorPermission(projectId, walletAddress)
  
  return {
    ...result,
    // Global admins have creator-level permissions
    authorized: result.isCreator || result.isGlobalAdmin
  }
}

/**
 * Middleware-style permission checker for API routes
 * Returns null if authorized, or error object if not
 */
export function requireEditorPermission(
  permissionResult: PermissionCheckResult
): { error: string; status: number } | null {
  if (!permissionResult.authorized) {
    return {
      error: permissionResult.error || 'Unauthorized: Only project creators and editors can perform this action',
      status: 403
    }
  }
  return null
}

