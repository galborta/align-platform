import { supabase } from '@/lib/supabase'

export interface ProjectToken {
  id: string
  token: string
  contract_address: string
  email: string
  submission_id: string
  created_by: string
  created_at: string
  expires_at: string | null
  status: 'pending' | 'completed'
  completed_at: string | null
}

/**
 * Validates a project creation token
 * @param token - The token string to validate
 * @returns ProjectToken object if valid, null otherwise
 */
export async function validateProjectToken(token: string): Promise<ProjectToken | null> {
  if (!token || token.trim() === '') {
    return null
  }
  
  try {
    const { data, error } = await supabase
      .from('project_creation_tokens')
      .select('*')
      .eq('token', token)
      .single()
    
    if (error || !data) {
      console.error('Token validation error:', error)
      return null
    }
    
    // Check if token is already completed
    if (data.status === 'completed') {
      console.log('Token already used')
      return null
    }
    
    // Check if token has expired (if expires_at is set)
    if (data.expires_at) {
      const expiryDate = new Date(data.expires_at)
      if (expiryDate < new Date()) {
        console.log('Token expired')
        return null
      }
    }
    
    return data as ProjectToken
    
  } catch (error) {
    console.error('Error validating token:', error)
    return null
  }
}

/**
 * Marks a token as completed after project creation
 * @param tokenId - The token ID to mark as completed
 * @returns true if successful, false otherwise
 */
export async function markTokenAsCompleted(tokenId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('project_creation_tokens')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', tokenId)
    
    if (error) {
      console.error('Error marking token as completed:', error)
      return false
    }
    
    return true
    
  } catch (error) {
    console.error('Error updating token:', error)
    return false
  }
}

/**
 * Fetches the latest draft for a token
 * @param tokenId - The token ID to fetch draft for
 * @returns Draft form data if exists, null otherwise
 */
export async function getTokenDraft(tokenId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('project_drafts')
      .select('form_data')
      .eq('token_id', tokenId)
      .order('last_saved', { ascending: false })
      .limit(1)
      .single()
    
    if (error || !data) {
      return null
    }
    
    return data.form_data
    
  } catch (error) {
    console.error('Error fetching draft:', error)
    return null
  }
}

/**
 * Saves or updates a draft for a token
 * @param tokenId - The token ID
 * @param contractAddress - The contract address
 * @param formData - The form data to save
 * @returns true if successful, false otherwise
 */
export async function saveDraft(
  tokenId: string,
  contractAddress: string,
  formData: any
): Promise<boolean> {
  try {
    // Upsert the draft (insert or update)
    const { error } = await supabase
      .from('project_drafts')
      .upsert({
        token_id: tokenId,
        contract_address: contractAddress,
        form_data: formData,
        last_saved: new Date().toISOString(),
        completed: false
      }, {
        onConflict: 'token_id'
      })
    
    if (error) {
      console.error('Error saving draft:', error)
      return false
    }
    
    return true
    
  } catch (error) {
    console.error('Error in saveDraft:', error)
    return false
  }
}
