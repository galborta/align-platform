/**
 * Editor Session Management Utilities
 * 
 * Provides functions for managing 24-hour editor sessions to reduce signature friction.
 * When an editor signs in to verify their permissions, the session is cached for 24 hours.
 * 
 * @module lib/editors
 */

import { supabase } from '@/lib/supabase'
import { verifyActionSignature } from '@/lib/signature-auth'

/**
 * Editor session data structure
 */
export interface EditorSession {
  id: string
  project_id: string
  wallet_address: string
  verified_at: string
  expires_at: string
  signature: string
  message: string
  created_at: string
}

/**
 * Check if wallet has a valid active session for project
 * 
 * @param projectId - UUID of the project
 * @param walletAddress - Wallet address to check
 * @returns true if valid session exists and hasn't expired
 * 
 * @example
 * const isValid = await hasValidSession('project-uuid', '7xK9...')
 * if (isValid) {
 *   // Allow editing without signature prompt
 * }
 */
export async function hasValidSession(
  projectId: string,
  walletAddress: string
): Promise<boolean> {
  const { data: session, error } = await supabase
    .from('editor_sessions')
    .select('expires_at')
    .eq('project_id', projectId)
    .eq('wallet_address', walletAddress)
    .single()

  if (error || !session) {
    return false
  }

  // Check if session has expired
  const expiresAt = new Date(session.expires_at)
  const now = new Date()

  return expiresAt > now
}

/**
 * Create or refresh editor session
 * 
 * Verifies the signature, checks editor permissions, and creates/updates
 * a session in the database with 24-hour expiry.
 * 
 * @param projectId - UUID of the project
 * @param walletAddress - Wallet address of the editor
 * @param signature - Base58 encoded signature
 * @param message - Original message that was signed
 * @returns Object with success status, optional sessionId, and optional error message
 * 
 * @example
 * const result = await createEditorSession(
 *   'project-uuid',
 *   '7xK9...',
 *   'signature...',
 *   'message...'
 * )
 * if (result.success) {
 *   console.log('Session created:', result.sessionId)
 * }
 */
export async function createEditorSession(
  projectId: string,
  walletAddress: string,
  signature: string,
  message: string
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  // Verify the signature is valid
  const verification = verifyActionSignature(
    walletAddress,
    signature,
    message,
    {
      action: 'verify editor access',
      resourceId: projectId,
      maxAge: 2 * 60 * 1000 // 2 minutes for verification message
    }
  )

  if (!verification.success) {
    return {
      success: false,
      error: verification.error || 'Invalid signature'
    }
  }

  // Check if user is actually an editor
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('creator_wallet, editor_wallets')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    return {
      success: false,
      error: 'Project not found'
    }
  }

  const isCreator = project.creator_wallet === walletAddress
  const isEditor = project.editor_wallets?.includes(walletAddress)

  if (!isCreator && !isEditor) {
    return {
      success: false,
      error: 'Not authorized as editor for this project'
    }
  }

  // Upsert session (update if exists, insert if not)
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24) // 24 hour expiry

  const { data: session, error: sessionError } = await supabase
    .from('editor_sessions')
    .upsert(
      {
        project_id: projectId,
        wallet_address: walletAddress,
        signature,
        message,
        verified_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      },
      {
        onConflict: 'project_id,wallet_address' // Update if exists
      }
    )
    .select('id')
    .single()

  if (sessionError) {
    console.error('[Editor Session] Error creating session:', sessionError)
    return {
      success: false,
      error: 'Failed to create session'
    }
  }

  console.log('[Editor Session] ✅ Session created/updated:', {
    projectId,
    wallet: walletAddress.slice(0, 8),
    expiresAt: expiresAt.toISOString()
  })

  return {
    success: true,
    sessionId: session.id
  }
}

/**
 * Delete editor session (logout)
 * 
 * Removes the editor session from the database, requiring re-authentication
 * on next edit attempt.
 * 
 * @param projectId - UUID of the project
 * @param walletAddress - Wallet address of the editor
 * @returns true if deletion was successful
 * 
 * @example
 * const deleted = await deleteEditorSession('project-uuid', '7xK9...')
 * if (deleted) {
 *   console.log('Session deleted, signature required on next edit')
 * }
 */
export async function deleteEditorSession(
  projectId: string,
  walletAddress: string
): Promise<boolean> {
  const { error } = await supabase
    .from('editor_sessions')
    .delete()
    .eq('project_id', projectId)
    .eq('wallet_address', walletAddress)

  if (error) {
    console.error('[Editor Session] Error deleting session:', error)
    return false
  }

  console.log('[Editor Session] Session deleted:', {
    projectId,
    wallet: walletAddress.slice(0, 8)
  })

  return true
}

/**
 * Get editor session details
 * 
 * Fetches the full session record from the database.
 * 
 * @param projectId - UUID of the project
 * @param walletAddress - Wallet address of the editor
 * @returns EditorSession object or null if not found
 * 
 * @example
 * const session = await getEditorSession('project-uuid', '7xK9...')
 * if (session) {
 *   console.log('Session expires:', session.expires_at)
 * }
 */
export async function getEditorSession(
  projectId: string,
  walletAddress: string
): Promise<EditorSession | null> {
  const { data: session, error } = await supabase
    .from('editor_sessions')
    .select('*')
    .eq('project_id', projectId)
    .eq('wallet_address', walletAddress)
    .single()

  if (error || !session) {
    return null
  }

  return session as EditorSession
}

/**
 * Format time remaining for session
 * 
 * Converts a future timestamp into a human-readable duration string.
 * 
 * @param expiresAt - ISO 8601 timestamp string
 * @returns Formatted duration string like "2h 30m" or "45m" or "Expired"
 * 
 * @example
 * formatTimeRemaining('2024-12-20T15:30:00Z') // "2h 15m"
 * formatTimeRemaining('2024-12-19T10:00:00Z') // "Expired"
 */
export function formatTimeRemaining(expiresAt: string): string {
  const expires = new Date(expiresAt)
  const now = new Date()
  const diffMs = expires.getTime() - now.getTime()

  if (diffMs < 0) {
    return 'Expired'
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  
  return `${minutes}m`
}

/**
 * Check if session will expire soon (within 1 hour)
 * 
 * Used to show warnings to users that their session is about to expire,
 * giving them time to refresh before losing access.
 * 
 * @param expiresAt - ISO 8601 timestamp string
 * @returns true if session expires within 1 hour
 * 
 * @example
 * if (isSessionExpiringSoon(session.expires_at)) {
 *   showWarning('Your session expires in less than 1 hour')
 * }
 */
export function isSessionExpiringSoon(expiresAt: string): boolean {
  const expires = new Date(expiresAt)
  const now = new Date()
  const diffMs = expires.getTime() - now.getTime()
  const oneHour = 1000 * 60 * 60

  return diffMs > 0 && diffMs < oneHour
}

