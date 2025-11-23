import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import { getWalletTokenData } from '@/lib/token-balance'

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

// Get or create conversation between two users
export async function getOrCreateConversation(
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
    
    // Return existing conversation
    if (existingConv) {
      return existingConv
    }
    
    // Create new conversation
    const { data: newConv, error: insertError } = await supabase
      .from('conversations')
      .insert({
        participant_1: participant1,
        participant_2: participant2
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('Error creating conversation:', insertError)
      return null
    }
    
    return newConv
    
  } catch (error) {
    console.error('Error in getOrCreateConversation:', error)
    return null
  }
}

// Check if sender can message recipient
export async function canMessageUser(
  senderWallet: string,
  recipientWallet: string,
  projectId?: string
): Promise<{ canMessage: boolean; reason?: string }> {
  try {
    // 1. Check if sender is blocked by recipient (or vice versa)
    const { data: blocked } = await supabase
      .from('blocked_users')
      .select('id')
      .or(`and(blocker_wallet.eq.${recipientWallet},blocked_wallet.eq.${senderWallet}),and(blocker_wallet.eq.${senderWallet},blocked_wallet.eq.${recipientWallet})`)
      .maybeSingle()
    
    if (blocked) {
      return {
        canMessage: false,
        reason: 'User has been blocked'
      }
    }
    
    // 2. Get recipient's profile to check message permissions
    const { data: recipientProfile } = await supabase
      .from('user_profiles')
      .select('allow_messages_from, privacy_level')
      .eq('wallet_address', recipientWallet)
      .maybeSingle()
    
    // If no profile exists, default to allowing messages
    if (!recipientProfile) {
      return { canMessage: true }
    }
    
    // 3. Check message permissions
    const { allow_messages_from } = recipientProfile
    
    if (allow_messages_from === 'nobody') {
      return {
        canMessage: false,
        reason: 'User is not accepting messages'
      }
    }
    
    if (allow_messages_from === 'everyone') {
      return { canMessage: true }
    }
    
    // 4. If 'holders_only', verify both hold tokens
    if (allow_messages_from === 'holders_only') {
      if (!projectId) {
        return {
          canMessage: false,
          reason: 'Token holding verification requires a project ID'
        }
      }
      
      // Get project token mint
      const { data: project } = await supabase
        .from('projects')
        .select('token_mint')
        .eq('id', projectId)
        .single()
      
      if (!project) {
        return {
          canMessage: false,
          reason: 'Project not found'
        }
      }
      
      // Check if both users hold tokens
      const [senderTokens, recipientTokens] = await Promise.all([
        getWalletTokenData(senderWallet, project.token_mint),
        getWalletTokenData(recipientWallet, project.token_mint)
      ])
      
      if (!senderTokens || senderTokens.balance === 0) {
        return {
          canMessage: false,
          reason: 'You must hold tokens to message this user'
        }
      }
      
      if (!recipientTokens || recipientTokens.balance === 0) {
        return {
          canMessage: false,
          reason: 'Recipient does not hold tokens'
        }
      }
      
      return { canMessage: true }
    }
    
    // Default: allow
    return { canMessage: true }
    
  } catch (error) {
    console.error('Error in canMessageUser:', error)
    return {
      canMessage: false,
      reason: 'Error checking message permissions'
    }
  }
}

// Mark all unread messages in a conversation as read
export async function markConversationAsRead(
  conversationId: string,
  readerWallet: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('messages')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('conversation_id', conversationId)
      .neq('sender_wallet', readerWallet) // Don't mark own messages
      .eq('is_read', false)
    
    if (error) {
      console.error('Error marking messages as read:', error)
      return false
    }
    
    return true
    
  } catch (error) {
    console.error('Error in markConversationAsRead:', error)
    return false
  }
}

// Get count of unread messages for a user
export async function getUnreadCount(
  walletAddress: string
): Promise<number> {
  try {
    // Get all conversations where user is a participant
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .or(`participant_1.eq.${walletAddress},participant_2.eq.${walletAddress}`)
    
    if (convError || !conversations) {
      console.error('Error fetching conversations:', convError)
      return 0
    }
    
    if (conversations.length === 0) {
      return 0
    }
    
    const conversationIds = conversations.map(c => c.id)
    
    // Count unread messages in those conversations (not sent by user)
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

