import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import { getWalletTokenData } from '@/lib/token-balance'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']
type PrivacyLevel = 'public' | 'holders_only' | 'private'
type AllowMessagesFrom = 'everyone' | 'holders_only' | 'nobody'

// Cache for token holder status (5 min TTL)
const holderCache = new Map<string, { isHolder: boolean; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Check if viewer holds tokens in any project where target also holds tokens
 */
export async function hasCommonTokenHoldings(
  viewerWallet: string,
  targetWallet: string
): Promise<boolean> {
  const cacheKey = `${viewerWallet}-${targetWallet}`
  const cached = holderCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.isHolder
  }
  
  try {
    // Get all projects where target holds tokens
    const { data: targetKarma } = await supabase
      .from('wallet_karma')
      .select('project_id, projects!inner(token_mint)')
      .eq('wallet_address', targetWallet)
    
    if (!targetKarma || targetKarma.length === 0) {
      holderCache.set(cacheKey, { isHolder: false, timestamp: Date.now() })
      return false
    }
    
    // Check if viewer holds tokens in any of these projects
    for (const karma of targetKarma) {
      const project = karma.projects as any
      if (project?.token_mint) {
        const tokenData = await getWalletTokenData(viewerWallet, project.token_mint)
        if (tokenData && tokenData.balance > 0) {
          holderCache.set(cacheKey, { isHolder: true, timestamp: Date.now() })
          return true
        }
      }
    }
    
    holderCache.set(cacheKey, { isHolder: false, timestamp: Date.now() })
    return false
    
  } catch (error) {
    console.error('Error checking common holdings:', error)
    return false
  }
}

/**
 * Check if viewer holds tokens in a specific project
 */
export async function holdsTokensInProject(
  walletAddress: string,
  projectId: string
): Promise<boolean> {
  const cacheKey = `${walletAddress}-${projectId}`
  const cached = holderCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.isHolder
  }
  
  try {
    // Get project token mint
    const { data: project } = await supabase
      .from('projects')
      .select('token_mint')
      .eq('id', projectId)
      .single()
    
    if (!project) {
      holderCache.set(cacheKey, { isHolder: false, timestamp: Date.now() })
      return false
    }
    
    // Check if wallet holds tokens
    const tokenData = await getWalletTokenData(walletAddress, project.token_mint)
    const isHolder = tokenData !== null && tokenData.balance > 0
    
    holderCache.set(cacheKey, { isHolder, timestamp: Date.now() })
    return isHolder
    
  } catch (error) {
    console.error('Error checking token holdings:', error)
    return false
  }
}

/**
 * Check if viewer can see target user's profile
 */
export async function canViewProfile(
  viewerWallet: string | null | undefined,
  targetProfile: UserProfile
): Promise<{
  canView: boolean
  reason?: string
  hiddenSections?: string[]
}> {
  // User can always view their own profile
  if (viewerWallet === targetProfile.wallet_address) {
    return { canView: true }
  }
  
  const privacyLevel = targetProfile.privacy_level || 'public'
  
  // Public profiles are visible to everyone
  if (privacyLevel === 'public') {
    return { canView: true }
  }
  
  // Private profiles are only visible to the owner
  if (privacyLevel === 'private') {
    return {
      canView: false,
      reason: 'This user has a private profile'
    }
  }
  
  // Holders-only profiles require token holdings
  if (privacyLevel === 'holders_only') {
    if (!viewerWallet) {
      return {
        canView: false,
        reason: 'Connect your wallet to view this holder-only profile'
      }
    }
    
    const hasCommonHoldings = await hasCommonTokenHoldings(
      viewerWallet,
      targetProfile.wallet_address
    )
    
    if (!hasCommonHoldings) {
      return {
        canView: false,
        reason: 'This is a holder-only profile. Hold tokens in a common project to view details.',
        hiddenSections: ['bio', 'stats', 'activity']
      }
    }
    
    return { canView: true }
  }
  
  return { canView: true }
}

/**
 * Check if viewer can see target's online status
 */
export async function canSeeOnlineStatus(
  viewerWallet: string | null | undefined,
  targetProfile: UserProfile
): Promise<boolean> {
  // User can always see their own status
  if (viewerWallet === targetProfile.wallet_address) {
    return true
  }
  
  const privacyLevel = targetProfile.privacy_level || 'public'
  
  // Public: everyone can see
  if (privacyLevel === 'public') {
    return true
  }
  
  // Private: nobody can see
  if (privacyLevel === 'private') {
    return false
  }
  
  // Holders-only: only holders can see
  if (privacyLevel === 'holders_only' && viewerWallet) {
    return await hasCommonTokenHoldings(viewerWallet, targetProfile.wallet_address)
  }
  
  return false
}

/**
 * Check if viewer can message target based on privacy settings
 */
export async function canMessageBasedOnPrivacy(
  senderWallet: string,
  recipientWallet: string,
  recipientProfile: UserProfile | null,
  projectId?: string
): Promise<{ canMessage: boolean; reason?: string }> {
  // If no profile, default to public behavior
  if (!recipientProfile) {
    return { canMessage: true }
  }
  
  const allowMessagesFrom = recipientProfile.allow_messages_from || 'everyone'
  const privacyLevel = recipientProfile.privacy_level || 'public'
  
  // Private profiles: nobody can message
  if (privacyLevel === 'private') {
    return {
      canMessage: false,
      reason: 'This user has messaging disabled'
    }
  }
  
  // Check allow_messages_from setting
  if (allowMessagesFrom === 'nobody') {
    return {
      canMessage: false,
      reason: 'This user is not accepting messages'
    }
  }
  
  if (allowMessagesFrom === 'everyone') {
    return { canMessage: true }
  }
  
  // holders_only: verify token holdings
  if (allowMessagesFrom === 'holders_only') {
    // If projectId provided, check holdings in that project
    if (projectId) {
      const [senderHolds, recipientHolds] = await Promise.all([
        holdsTokensInProject(senderWallet, projectId),
        holdsTokensInProject(recipientWallet, projectId)
      ])
      
      if (!senderHolds) {
        return {
          canMessage: false,
          reason: 'You must hold tokens in this project to message this user'
        }
      }
      
      if (!recipientHolds) {
        return {
          canMessage: false,
          reason: 'This user is no longer a token holder'
        }
      }
      
      return { canMessage: true }
    }
    
    // No projectId: check for any common holdings
    const hasCommon = await hasCommonTokenHoldings(senderWallet, recipientWallet)
    
    if (!hasCommon) {
      return {
        canMessage: false,
        reason: 'This user only accepts messages from token holders. Hold tokens in a common project to message.'
      }
    }
    
    return { canMessage: true }
  }
  
  return { canMessage: true }
}

/**
 * Filter users based on privacy settings for search/suggestions
 */
export async function filterUsersByPrivacy(
  viewerWallet: string | null | undefined,
  users: UserProfile[]
): Promise<UserProfile[]> {
  if (!viewerWallet) {
    // Not logged in: only show public users
    return users.filter(u => u.privacy_level === 'public' || !u.privacy_level)
  }
  
  const filtered: UserProfile[] = []
  
  for (const user of users) {
    // Skip own profile
    if (user.wallet_address === viewerWallet) {
      continue
    }
    
    const privacyLevel = user.privacy_level || 'public'
    
    // Include public users
    if (privacyLevel === 'public') {
      filtered.push(user)
      continue
    }
    
    // Exclude private users
    if (privacyLevel === 'private') {
      continue
    }
    
    // For holders-only: check if viewer holds common tokens
    if (privacyLevel === 'holders_only') {
      const hasCommon = await hasCommonTokenHoldings(viewerWallet, user.wallet_address)
      if (hasCommon) {
        filtered.push(user)
      }
    }
  }
  
  return filtered
}

/**
 * Clear privacy cache (useful after token transfers)
 */
export function clearPrivacyCache(): void {
  holderCache.clear()
}

/**
 * Get privacy level display info
 */
export function getPrivacyLevelInfo(level: PrivacyLevel): {
  label: string
  description: string
  icon: string
} {
  const info = {
    public: {
      label: 'Public',
      description: 'Anyone can view your profile and send messages',
      icon: '🌐'
    },
    holders_only: {
      label: 'Holders Only',
      description: 'Only token holders in common projects can view and message',
      icon: '🔒'
    },
    private: {
      label: 'Private',
      description: 'Profile is hidden and messaging is disabled',
      icon: '🔐'
    }
  }
  
  return info[level] || info.public
}






