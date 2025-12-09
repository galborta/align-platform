/**
 * Session Helper Utilities
 * 
 * Provides helper functions for managing Supabase authentication sessions
 */

import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'

/**
 * Get a valid Supabase session, refreshing if necessary
 * 
 * @returns Session object or null if authentication fails
 */
export async function getValidSession(): Promise<Session | null> {
  // Try to get existing session
  let session = (await supabase.auth.getSession()).data.session
  
  // If no session or expired, try to refresh
  if (!session) {
    const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
    
    if (refreshError || !refreshedSession) {
      console.warn('[Session] Failed to refresh session:', refreshError?.message)
      return null
    }
    
    session = refreshedSession
    console.log('[Session] Successfully refreshed expired session')
  }
  
  return session
}

/**
 * Get session with error message for user feedback
 * 
 * @returns Object with session and optional error message
 */
export async function getSessionWithError(): Promise<{
  session: Session | null
  error: string | null
}> {
  const session = await getValidSession()
  
  if (!session) {
    return {
      session: null,
      error: 'Authentication session expired. Please refresh the page and try again.'
    }
  }
  
  return { session, error: null }
}

