import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import { getWalletTokenData } from '@/lib/token-balance'
import { canMessageBasedOnPrivacy } from '@/lib/privacy'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']
type Conversation = Database['public']['Tables']['conversations']['Row']

// Get or create user profile
export async function getOrCreateProfile(
  walletAddress: string
): Promise<UserProfile | null> {
  try {
    // Check if profile exists
    const { data: existingProfile, error: selectError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('wallet_address', walletAddress)
      .maybeSingle()
    
    if (selectError) {
      console.error('Error fetching profile:', selectError)
      return null
    }
    
    // Return existing profile
    if (existingProfile) {
      return existingProfile
    }
    
    // Create new profile with defaults
    const { data: newProfile, error: insertError } = await supabase
      .from('user_profiles')
      .insert({
        wallet_address: walletAddress,
        privacy_level: 'public',
        allow_messages_from: 'everyone',
        is_online: false
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('Error creating profile:', insertError)
      return null
    }
    
    return newProfile
    
  } catch (error) {
    console.error('Error in getOrCreateProfile:', error)
    return null
  }
}

// Get existing conversation between two users (without creating)
export async function getExistingConversation(
  wallet1: string,
  wallet2: string
): Promise<Conversation | null> {
  try {
    // Order wallets alphabetically for consistency
    const participant1 = wallet1 < wallet2 ? wallet1 : wallet2
    const participant2 = wallet1 < wallet2 ? wallet2 : wallet1
    
    // Check if conversation exists
    const { data: existingConv, error: selectError } = await supabase
      .from('conversations')
      .select('*')
      .eq('participant_1', participant1)
      .eq('participant_2', participant2)
      .maybeSingle()
    
    if (selectError) {
      console.error('Error fetching conversation:', selectError)
      return null
    }
    
    return existingConv
    
  } catch (error) {
    console.error('Error in getExistingConversation:', error)
    return null
  }
}

// Get or create conversation between two users
// Uses API route for proper RLS handling
export async function getOrCreateConversation(
  wallet1: string,
  wallet2: string
): Promise<Conversation | null> {
  try {
    // Order wallets alphabetically for consistency
    const participant1 = wallet1 < wallet2 ? wallet1 : wallet2
    const participant2 = wallet1 < wallet2 ? wallet2 : wallet1
    
    // First, try to get existing conversation (this works client-side)
    const { data: existingConv, error: selectError } = await supabase
      .from('conversations')
      .select('*')
      .eq('participant_1', participant1)
      .eq('participant_2', participant2)
      .maybeSingle()
    
    if (selectError) {
      console.error('Error fetching conversation:', selectError)
      // Continue to try creating via API
    }
    
    // Return existing conversation
    if (existingConv) {
      return existingConv
    }
    
    // Create new conversation via API (handles RLS properly)
    console.log('[Messaging] Creating conversation via API...')
    const response = await fetch('/api/conversations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentWallet: wallet1,
        targetWallet: wallet2
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Error creating conversation via API:', data.error)
      return null
    }

    return data.conversation
    
  } catch (error) {
    console.error('Error in getOrCreateConversation:', error)
    return null
  }
}

// Check if sender can message recipient
export async function canMessageUser(
  senderWallet: string,
  recipientWallet: string,
  projectId?: string,
  adminOverride: boolean = false
): Promise<{ canMessage: boolean; reason?: string }> {
  try {
    // Admin override bypasses all checks
    if (adminOverride) {
      return { canMessage: true }
    }
    
    // 1. Check if sender is blocked by recipient (or vice versa)
    // Wrapped in try-catch so missing table doesn't break messaging
    try {
      const { data: blocked, error: blockedError } = await supabase
        .from('blocked_users')
        .select('id')
        .or(`and(blocker_wallet.eq.${recipientWallet},blocked_wallet.eq.${senderWallet}),and(blocker_wallet.eq.${senderWallet},blocked_wallet.eq.${recipientWallet})`)
        .maybeSingle()
      
      if (blockedError) {
        // Table might not exist - log and continue
        console.warn('[canMessageUser] blocked_users check failed, continuing:', blockedError.message)
      } else if (blocked) {
        return {
          canMessage: false,
          reason: 'User has been blocked'
        }
      }
    } catch (blockCheckError) {
      console.warn('[canMessageUser] blocked_users check error, continuing:', blockCheckError)
    }
    
    // 2. Get recipient's profile to check privacy and message permissions
    const { data: recipientProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('wallet_address', recipientWallet)
      .maybeSingle()
    
    // 3. Check privacy-based messaging permissions
    const privacyCheck = await canMessageBasedOnPrivacy(
      senderWallet,
      recipientWallet,
      recipientProfile,
      projectId
    )
    
    if (!privacyCheck.canMessage) {
      return privacyCheck
    }
    
    // Default: allow
    return { canMessage: true }
    
  } catch (error) {
    console.error('Error in canMessageUser:', error)
    // Allow messaging on error - don't block users due to system issues
    return { canMessage: true }
  }
}

// Mark all unread messages in a conversation as read
export async function markConversationAsRead(
  conversationId: string,
  readerWallet: string
): Promise<boolean> {
  try {
    console.log('[markConversationAsRead] Marking messages as read for conversation:', conversationId, 'reader:', readerWallet.slice(0, 8))
    
    const { data, error } = await supabase
      .from('messages')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('conversation_id', conversationId)
      .neq('sender_wallet', readerWallet) // Don't mark own messages
      .eq('is_read', false)
      .select('id')
    
    if (error) {
      console.error('[markConversationAsRead] Error:', error)
      return false
    }
    
    console.log('[markConversationAsRead] Marked', data?.length || 0, 'messages as read')
    
    return true
    
  } catch (error) {
    console.error('Error in markConversationAsRead:', error)
    return false
  }
}

// Get count of unread messages for a user (optimized)
export async function getUnreadCount(
  walletAddress: string
): Promise<number> {
  try {
    // Step 1: Get conversation IDs (fast, just IDs, uses index)
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .or(`participant_1.eq.${walletAddress},participant_2.eq.${walletAddress}`)
    
    if (!conversations || conversations.length === 0) {
      // No conversations yet - this is expected, not an error
      return 0
    }
    
    const conversationIds = conversations.map(c => c.id)
    
    // Step 2: Count unread messages using index (very fast with proper index)
    const { count, error: countError } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', conversationIds)
      .neq('sender_wallet', walletAddress)
      .eq('is_read', false)
    
    if (countError) {
      console.error('Error counting unread messages:', countError)
      return 0
    }
    
    return count || 0
    
  } catch (error) {
    console.error('Error in getUnreadCount:', error)
    return 0
  }
}

// Update user online status
export async function updateOnlineStatus(
  walletAddress: string,
  isOnline: boolean
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        is_online: isOnline,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', walletAddress)
    
    if (error) {
      console.error('Error updating online status:', error)
      return false
    }
    
    return true
    
  } catch (error) {
    console.error('Error in updateOnlineStatus:', error)
    return false
  }
}

// Check if user is blocked (helper for UI)
export async function isUserBlocked(
  wallet1: string,
  wallet2: string
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('blocked_users')
      .select('id')
      .or(`and(blocker_wallet.eq.${wallet1},blocked_wallet.eq.${wallet2}),and(blocker_wallet.eq.${wallet2},blocked_wallet.eq.${wallet1})`)
      .maybeSingle()
    
    return !!data
    
  } catch (error) {
    console.error('Error checking block status:', error)
    return false
  }
}

// Block a user
export async function blockUser(
  blockerWallet: string,
  blockedWallet: string,
  reason?: string,
  deleteHistory: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Check not blocking self
    if (blockerWallet === blockedWallet) {
      return { success: false, error: 'Cannot block yourself' }
    }
    
    // 2. Insert block record
    const { error: blockError } = await supabase
      .from('blocked_users')
      .insert({
        blocker_wallet: blockerWallet,
        blocked_wallet: blockedWallet,
        reason: reason || null
      })
    
    if (blockError) {
      console.error('Error blocking user:', blockError)
      return { success: false, error: 'Failed to block user' }
    }
    
    // 3. Find conversation between users
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant_1.eq.${blockerWallet},participant_2.eq.${blockedWallet}),and(participant_1.eq.${blockedWallet},participant_2.eq.${blockerWallet})`)
      .maybeSingle()
    
    if (conversation && deleteHistory) {
      // 4. Soft delete all messages in the conversation
      const { error: deleteError } = await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('conversation_id', conversation.id)
      
      if (deleteError) {
        console.error('Error deleting messages:', deleteError)
      }
      
      // 5. Delete the conversation
      const { error: convDeleteError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversation.id)
      
      if (convDeleteError) {
        console.error('Error deleting conversation:', convDeleteError)
      }
    }
    
    return { success: true }
    
  } catch (error) {
    console.error('Error in blockUser:', error)
    return { success: false, error: 'An error occurred' }
  }
}

// Unblock a user
export async function unblockUser(
  blockerWallet: string,
  blockedWallet: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_wallet', blockerWallet)
      .eq('blocked_wallet', blockedWallet)
    
    if (error) {
      console.error('Error unblocking user:', error)
      return { success: false, error: 'Failed to unblock user' }
    }
    
    return { success: true }
    
  } catch (error) {
    console.error('Error in unblockUser:', error)
    return { success: false, error: 'An error occurred' }
  }
}

// Check bidirectional block status with details
export async function isBlocked(
  wallet1: string,
  wallet2: string
): Promise<{
  isBlocked: boolean
  blockedBy?: string
  blockedUser?: string
  reason?: string
}> {
  try {
    const { data } = await supabase
      .from('blocked_users')
      .select('blocker_wallet, blocked_wallet, reason')
      .or(`and(blocker_wallet.eq.${wallet1},blocked_wallet.eq.${wallet2}),and(blocker_wallet.eq.${wallet2},blocked_wallet.eq.${wallet1})`)
      .maybeSingle()
    
    if (!data) {
      return { isBlocked: false }
    }
    
    return {
      isBlocked: true,
      blockedBy: data.blocker_wallet,
      blockedUser: data.blocked_wallet,
      reason: data.reason || undefined
    }
    
  } catch (error) {
    console.error('Error in isBlocked:', error)
    return { isBlocked: false }
  }
}

// Get list of blocked users with pagination
export async function getBlockedUsers(
  walletAddress: string,
  limit: number = 50,
  offset: number = 0
): Promise<{
  blockedUsers: Array<{
    id: string
    blocked_wallet: string
    reason: string | null
    created_at: string
  }>
  hasMore: boolean
}> {
  try {
    const { data, error } = await supabase
      .from('blocked_users')
      .select('id, blocked_wallet, reason, created_at')
      .eq('blocker_wallet', walletAddress)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit)
    
    if (error) {
      console.error('Error fetching blocked users:', error)
      return { blockedUsers: [], hasMore: false }
    }
    
    return {
      blockedUsers: data || [],
      hasMore: (data?.length || 0) === limit + 1
    }
    
  } catch (error) {
    console.error('Error in getBlockedUsers:', error)
    return { blockedUsers: [], hasMore: false }
  }
}

// Get user's conversations with last message preview
export async function getUserConversations(
  walletAddress: string
): Promise<Array<Conversation & { unread_count: number }>> {
  try {
    // Get all conversations
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1.eq.${walletAddress},participant_2.eq.${walletAddress}`)
      .order('last_message_at', { ascending: false })
    
    if (convError || !conversations) {
      console.error('Error fetching conversations:', convError)
      return []
    }
    
    // Get unread counts for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_wallet', walletAddress)
          .eq('is_read', false)
        
        return {
          ...conv,
          unread_count: count || 0
        }
      })
    )
    
    return conversationsWithUnread
    
  } catch (error) {
    console.error('Error in getUserConversations:', error)
    return []
  }
}

// Get messages for a conversation with pagination
export async function getConversationMessages(
  conversationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Database['public']['Tables']['messages']['Row'][]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) {
      console.error('Error fetching messages:', error)
      return []
    }
    
    // Reverse to show oldest first
    return data?.reverse() || []
    
  } catch (error) {
    console.error('Error in getConversationMessages:', error)
    return []
  }
}

// Archive a conversation for a specific user
export async function archiveConversation(
  conversationId: string,
  currentWallet: string
): Promise<boolean> {
  try {
    // Get conversation to determine which participant is archiving
    const { data: conv, error: fetchError } = await supabase
      .from('conversations')
      .select('participant_1, participant_2')
      .eq('id', conversationId)
      .maybeSingle()
    
    if (fetchError || !conv) {
      console.error('Error fetching conversation for archive:', fetchError)
      return false
    }

    // Determine which archive field to update
    const isParticipant1 = conv.participant_1 === currentWallet
    const archiveField = isParticipant1 
      ? 'archived_by_participant_1' 
      : 'archived_by_participant_2'

    // Archive the conversation
    const { error } = await supabase
      .from('conversations')
      .update({ [archiveField]: true })
      .eq('id', conversationId)

    if (error) {
      console.error('Error archiving conversation:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in archiveConversation:', error)
    return false
  }
}

// Unarchive a conversation for a specific user
export async function unarchiveConversation(
  conversationId: string,
  currentWallet: string
): Promise<boolean> {
  try {
    // Get conversation to determine which participant is unarchiving
    const { data: conv, error: fetchError } = await supabase
      .from('conversations')
      .select('participant_1, participant_2')
      .eq('id', conversationId)
      .maybeSingle()
    
    if (fetchError || !conv) {
      console.error('Error fetching conversation for unarchive:', fetchError)
      return false
    }

    const isParticipant1 = conv.participant_1 === currentWallet
    const archiveField = isParticipant1 
      ? 'archived_by_participant_1' 
      : 'archived_by_participant_2'

    // Unarchive the conversation
    const { error } = await supabase
      .from('conversations')
      .update({ [archiveField]: false })
      .eq('id', conversationId)

    if (error) {
      console.error('Error unarchiving conversation:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in unarchiveConversation:', error)
    return false
  }
}

// Get archived conversations for a user
export async function getArchivedConversations(
  walletAddress: string
): Promise<Conversation[]> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1.eq.${walletAddress},participant_2.eq.${walletAddress}`)
    
    if (error) {
      console.error('Error fetching archived conversations:', error)
      return []
    }

    // Filter to only show conversations archived by this user
    const archivedConversations = data?.filter(conv => {
      const isParticipant1 = conv.participant_1 === walletAddress
      return isParticipant1 
        ? conv.archived_by_participant_1 
        : conv.archived_by_participant_2
    }) || []

    return archivedConversations
  } catch (error) {
    console.error('Error in getArchivedConversations:', error)
    return []
  }
}

