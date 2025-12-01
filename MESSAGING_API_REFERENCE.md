# 📚 Messaging System - API Reference

Complete API documentation for `/lib/messaging.ts`

---

## Table of Contents

1. [Profile Management](#profile-management)
2. [Conversation Management](#conversation-management)
3. [Message Operations](#message-operations)
4. [Blocking & Privacy](#blocking--privacy)
5. [Status & Presence](#status--presence)
6. [Utilities](#utilities)

---

## Profile Management

### `getOrCreateProfile()`

Gets an existing user profile or creates a new one with default settings.

**Signature:**
```typescript
async function getOrCreateProfile(
  walletAddress: string
): Promise<UserProfile | null>
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `walletAddress` | `string` | Yes | Solana wallet address (base58) |

**Returns:**
- `UserProfile` - User profile object
- `null` - If error occurs

**Profile Structure:**
```typescript
{
  wallet_address: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  privacy_level: 'public' | 'holders_only' | 'private'
  allow_messages_from: 'everyone' | 'holders_only' | 'nobody'
  is_online: boolean
  last_seen_at: string
  created_at: string
  updated_at: string
}
```

**Default Values:**
```typescript
{
  privacy_level: 'public',
  allow_messages_from: 'everyone',
  is_online: false
}
```

**Example Usage:**
```typescript
import { getOrCreateProfile } from '@/lib/messaging'

const profile = await getOrCreateProfile('ABC123...')
if (profile) {
  console.log(profile.display_name)
}
```

**Error Handling:**
```typescript
// Returns null on error
const profile = await getOrCreateProfile(walletAddress)
if (!profile) {
  // Handle error - profile couldn't be created/fetched
}
```

---

## Conversation Management

### `getOrCreateConversation()`

Gets an existing conversation between two users or creates a new one.

**Signature:**
```typescript
async function getOrCreateConversation(
  wallet1: string,
  wallet2: string
): Promise<Conversation | null>
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `wallet1` | `string` | Yes | First participant's wallet |
| `wallet2` | `string` | Yes | Second participant's wallet |

**Returns:**
- `Conversation` - Conversation object
- `null` - If error occurs

**Conversation Structure:**
```typescript
{
  id: string (UUID)
  participant_1: string  // Always alphabetically first
  participant_2: string  // Always alphabetically second
  last_message_at: string | null
  created_at: string
  updated_at: string
}
```

**Implementation Notes:**
- Participants are automatically ordered alphabetically
- Creates unique conversation per pair
- Idempotent - safe to call multiple times

**Example Usage:**
```typescript
import { getOrCreateConversation } from '@/lib/messaging'

// Order doesn't matter - always returns same conversation
const conv1 = await getOrCreateConversation('ABC...', 'XYZ...')
const conv2 = await getOrCreateConversation('XYZ...', 'ABC...')
// conv1.id === conv2.id (true)
```

---

### `getUserConversations()`

Gets all conversations for a user with unread counts.

**Signature:**
```typescript
async function getUserConversations(
  walletAddress: string
): Promise<Array<Conversation & { unread_count: number }>>
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `walletAddress` | `string` | Yes | User's wallet address |

**Returns:**
- `Array<Conversation & { unread_count: number }>` - Conversations with unread counts
- Empty array on error

**Sorting:**
- Ordered by `last_message_at` descending (newest first)

**Example Usage:**
```typescript
const conversations = await getUserConversations(currentWallet)

conversations.forEach(conv => {
  console.log(`Conversation ${conv.id}: ${conv.unread_count} unread`)
})
```

**Performance:**
- Uses database indexes
- Parallel unread count fetching
- Optimized for 20-50 conversations

---

### `getConversationMessages()`

Gets messages for a conversation with pagination.

**Signature:**
```typescript
async function getConversationMessages(
  conversationId: string,
  limit?: number,
  offset?: number
): Promise<Message[]>
```

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `conversationId` | `string` | Yes | - | Conversation UUID |
| `limit` | `number` | No | `50` | Messages per page |
| `offset` | `number` | No | `0` | Starting offset |

**Returns:**
- `Message[]` - Array of message objects (oldest first)
- Empty array on error

**Message Structure:**
```typescript
{
  id: string (UUID)
  conversation_id: string
  sender_wallet: string
  content: string
  is_read: boolean
  read_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}
```

**Pagination:**
```typescript
// First page (50 messages)
const messages1 = await getConversationMessages(convId, 50, 0)

// Second page (next 50)
const messages2 = await getConversationMessages(convId, 50, 50)

// Third page
const messages3 = await getConversationMessages(convId, 50, 100)
```

**Example Usage:**
```typescript
const messages = await getConversationMessages(conversationId)
console.log(`Fetched ${messages.length} messages`)

// Load more
const moreMessages = await getConversationMessages(
  conversationId,
  50,
  messages.length
)
```

---

## Message Operations

### `markConversationAsRead()`

Marks all unread messages in a conversation as read.

**Signature:**
```typescript
async function markConversationAsRead(
  conversationId: string,
  readerWallet: string
): Promise<boolean>
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `conversationId` | `string` | Yes | Conversation UUID |
| `readerWallet` | `string` | Yes | Wallet of user reading |

**Returns:**
- `true` - Messages marked as read
- `false` - Error occurred

**Behavior:**
- Only marks messages sent by other user
- Sets `is_read = true`
- Sets `read_at` timestamp
- Updates `updated_at`

**Example Usage:**
```typescript
import { markConversationAsRead } from '@/lib/messaging'

// When user opens conversation
const success = await markConversationAsRead(convId, currentWallet)
if (success) {
  console.log('Messages marked as read')
}
```

**Best Practices:**
```typescript
// Call when:
// 1. User opens conversation
// 2. User views messages
// 3. App gains focus (if conversation open)

useEffect(() => {
  if (conversationId && currentWallet) {
    markConversationAsRead(conversationId, currentWallet)
  }
}, [conversationId, currentWallet])
```

---

### `getUnreadCount()`

Gets total count of unread messages for a user across all conversations.

**Signature:**
```typescript
async function getUnreadCount(
  walletAddress: string
): Promise<number>
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `walletAddress` | `string` | Yes | User's wallet address |

**Returns:**
- `number` - Count of unread messages
- `0` - If no unread or error

**Performance:**
- Optimized with two-query approach
- Uses database indexes
- ~5-10ms with indexes

**Example Usage:**
```typescript
const unreadCount = await getUnreadCount(currentWallet)
console.log(`${unreadCount} unread messages`)

// Update badge
setBadgeCount(unreadCount)
```

**Real-time Updates:**
```typescript
// Poll every 30 seconds
useEffect(() => {
  const interval = setInterval(async () => {
    const count = await getUnreadCount(currentWallet)
    setUnreadCount(count)
  }, 30000)
  
  return () => clearInterval(interval)
}, [currentWallet])
```

---

## Blocking & Privacy

### `canMessageUser()`

Checks if a sender can message a recipient based on privacy settings and blocks.

**Signature:**
```typescript
async function canMessageUser(
  senderWallet: string,
  recipientWallet: string,
  projectId?: string,
  adminOverride?: boolean
): Promise<{ canMessage: boolean; reason?: string }>
```

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `senderWallet` | `string` | Yes | - | Sender's wallet |
| `recipientWallet` | `string` | Yes | - | Recipient's wallet |
| `projectId` | `string` | No | `undefined` | Project context |
| `adminOverride` | `boolean` | No | `false` | Bypass checks |

**Returns:**
```typescript
{
  canMessage: boolean
  reason?: string  // Present if canMessage is false
}
```

**Reasons:**
- `"User has been blocked"`
- `"User has disabled messaging"`
- `"Must hold common tokens"`
- `"Privacy settings restrict messaging"`

**Check Order:**
1. Admin override (bypasses all)
2. Block status (bidirectional)
3. Privacy level checks
4. Token holder verification (if needed)

**Example Usage:**
```typescript
const check = await canMessageUser(senderWallet, recipientWallet)

if (check.canMessage) {
  // Show message composer
} else {
  // Show error: check.reason
  toast.error(check.reason)
}
```

**With Project Context:**
```typescript
// Check for specific project
const check = await canMessageUser(
  sender,
  recipient,
  'project-uuid-123'
)
```

---

### `blockUser()`

Blocks a user and optionally deletes message history.

**Signature:**
```typescript
async function blockUser(
  blockerWallet: string,
  blockedWallet: string,
  reason?: string,
  deleteHistory?: boolean
): Promise<{ success: boolean; error?: string }>
```

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `blockerWallet` | `string` | Yes | - | User doing the blocking |
| `blockedWallet` | `string` | Yes | - | User being blocked |
| `reason` | `string` | No | `undefined` | Optional block reason |
| `deleteHistory` | `boolean` | No | `true` | Delete messages |

**Returns:**
```typescript
{
  success: boolean
  error?: string  // Present if success is false
}
```

**Behavior:**
1. Creates block record
2. Finds conversation between users
3. If `deleteHistory = true`:
   - Soft deletes all messages
   - Deletes conversation

**Example Usage:**
```typescript
const result = await blockUser(
  currentWallet,
  targetWallet,
  'spam',
  true  // Delete history
)

if (result.success) {
  toast.success('User blocked')
} else {
  toast.error(result.error)
}
```

**Block Reasons:**
```typescript
// Common reasons
const reasons = [
  'spam',
  'harassment',
  'inappropriate_content',
  'scam',
  'other'
]

await blockUser(current, target, 'spam', true)
```

---

### `unblockUser()`

Removes a block between two users.

**Signature:**
```typescript
async function unblockUser(
  blockerWallet: string,
  blockedWallet: string
): Promise<{ success: boolean; error?: string }>
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `blockerWallet` | `string` | Yes | User who blocked |
| `blockedWallet` | `string` | Yes | User who was blocked |

**Returns:**
```typescript
{
  success: boolean
  error?: string
}
```

**Example Usage:**
```typescript
const result = await unblockUser(currentWallet, targetWallet)

if (result.success) {
  toast.success('User unblocked')
}
```

**Note:** Does not restore deleted message history.

---

### `isUserBlocked()`

Simple boolean check if users are blocked (bidirectional).

**Signature:**
```typescript
async function isUserBlocked(
  wallet1: string,
  wallet2: string
): Promise<boolean>
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `wallet1` | `string` | Yes | First wallet |
| `wallet2` | `string` | Yes | Second wallet |

**Returns:**
- `true` - Users are blocked (either direction)
- `false` - Not blocked or error

**Example Usage:**
```typescript
const blocked = await isUserBlocked(wallet1, wallet2)

if (blocked) {
  // Hide message button
  // Show "Blocked" indicator
}
```

---

### `isBlocked()`

Detailed block status with additional information.

**Signature:**
```typescript
async function isBlocked(
  wallet1: string,
  wallet2: string
): Promise<{
  isBlocked: boolean
  blockedBy?: string
  blockedUser?: string
  reason?: string
}>
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `wallet1` | `string` | Yes | First wallet |
| `wallet2` | `string` | Yes | Second wallet |

**Returns:**
```typescript
{
  isBlocked: boolean
  blockedBy?: string     // Wallet who blocked
  blockedUser?: string   // Wallet who was blocked
  reason?: string        // Block reason
}
```

**Example Usage:**
```typescript
const status = await isBlocked(wallet1, wallet2)

if (status.isBlocked) {
  if (status.blockedBy === wallet1) {
    // Current user blocked the other
    console.log('You blocked this user')
  } else {
    // Other user blocked current user
    console.log('This user blocked you')
  }
  
  if (status.reason) {
    console.log(`Reason: ${status.reason}`)
  }
}
```

---

### `getBlockedUsers()`

Gets list of users blocked by a wallet with pagination.

**Signature:**
```typescript
async function getBlockedUsers(
  walletAddress: string,
  limit?: number,
  offset?: number
): Promise<{
  blockedUsers: Array<{
    id: string
    blocked_wallet: string
    reason: string | null
    created_at: string
  }>
  hasMore: boolean
}>
```

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `walletAddress` | `string` | Yes | - | User's wallet |
| `limit` | `number` | No | `50` | Results per page |
| `offset` | `number` | No | `0` | Starting offset |

**Returns:**
```typescript
{
  blockedUsers: Array<{
    id: string
    blocked_wallet: string
    reason: string | null
    created_at: string
  }>
  hasMore: boolean
}
```

**Example Usage:**
```typescript
const { blockedUsers, hasMore } = await getBlockedUsers(currentWallet)

blockedUsers.forEach(blocked => {
  console.log(`Blocked: ${blocked.blocked_wallet}`)
  if (blocked.reason) {
    console.log(`Reason: ${blocked.reason}`)
  }
})

if (hasMore) {
  // Load more button
}
```

**Pagination:**
```typescript
// First page
const page1 = await getBlockedUsers(wallet, 20, 0)

// Second page
const page2 = await getBlockedUsers(wallet, 20, 20)
```

---

## Status & Presence

### `updateOnlineStatus()`

Updates user's online status and last seen timestamp.

**Signature:**
```typescript
async function updateOnlineStatus(
  walletAddress: string,
  isOnline: boolean
): Promise<boolean>
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `walletAddress` | `string` | Yes | User's wallet |
| `isOnline` | `boolean` | Yes | Online status |

**Returns:**
- `true` - Status updated
- `false` - Error occurred

**Behavior:**
- Sets `is_online` field
- Updates `last_seen_at` timestamp
- Updates `updated_at`

**Example Usage:**
```typescript
// When user connects wallet
await updateOnlineStatus(wallet, true)

// When user disconnects or closes tab
await updateOnlineStatus(wallet, false)
```

**Auto Presence:**
```typescript
useEffect(() => {
  if (!currentWallet) return
  
  // Set online on mount
  updateOnlineStatus(currentWallet, true)
  
  // Set offline on unmount
  return () => {
    updateOnlineStatus(currentWallet, false)
  }
}, [currentWallet])
```

**Visibility Events:**
```typescript
useEffect(() => {
  const handleVisibility = () => {
    if (document.hidden) {
      updateOnlineStatus(currentWallet, false)
    } else {
      updateOnlineStatus(currentWallet, true)
    }
  }
  
  document.addEventListener('visibilitychange', handleVisibility)
  return () => document.removeEventListener('visibilitychange', handleVisibility)
}, [currentWallet])
```

---

## Error Handling

### Standard Error Pattern

All functions follow consistent error handling:

```typescript
try {
  // Database operations
  const { data, error } = await supabase...
  
  if (error) {
    console.error('Specific error:', error)
    return /* appropriate default value */
  }
  
  return data
  
} catch (error) {
  console.error('Unexpected error:', error)
  return /* appropriate default value */
}
```

### Error Return Values

| Function | Error Return |
|----------|--------------|
| `getOrCreateProfile()` | `null` |
| `getOrCreateConversation()` | `null` |
| `markConversationAsRead()` | `false` |
| `getUnreadCount()` | `0` |
| `updateOnlineStatus()` | `false` |
| `isUserBlocked()` | `false` |
| `blockUser()` | `{ success: false, error: string }` |
| `unblockUser()` | `{ success: false, error: string }` |
| `getUserConversations()` | `[]` |
| `getConversationMessages()` | `[]` |
| `getBlockedUsers()` | `{ blockedUsers: [], hasMore: false }` |

### Best Practices

```typescript
// Always check return values
const profile = await getOrCreateProfile(wallet)
if (!profile) {
  // Handle error
  return
}

// For operations that return objects
const result = await blockUser(w1, w2)
if (!result.success) {
  toast.error(result.error || 'Unknown error')
}

// For counts, zero is valid
const count = await getUnreadCount(wallet)
// count is guaranteed to be a number
```

---

## Performance Tips

### Caching

```typescript
// Profile caching (10 minutes)
import { useProfileCache } from '@/lib/ProfileCacheContext'

const { getProfile } = useProfileCache()
const profile = await getProfile(wallet) // Cached
```

### Pagination

```typescript
// Load messages in chunks
const CHUNK_SIZE = 50

// Initial load
const messages = await getConversationMessages(convId, CHUNK_SIZE, 0)

// Load more on scroll
const loadMore = async () => {
  const more = await getConversationMessages(
    convId,
    CHUNK_SIZE,
    messages.length
  )
  setMessages([...more, ...messages])
}
```

### Batch Operations

```typescript
// Fetch multiple profiles in parallel
const profiles = await Promise.all(
  wallets.map(wallet => getOrCreateProfile(wallet))
)
```

### Real-time Subscriptions

```typescript
// Subscribe to conversation updates
const channel = supabase
  .channel(`conversation:${convId}`)
  .on('postgres_changes', 
    { 
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${convId}`
    },
    (payload) => {
      // Handle new message
    }
  )
  .subscribe()

// Cleanup
return () => supabase.removeChannel(channel)
```

---

## TypeScript Types

### Import Types

```typescript
import { Database } from '@/types/database'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']
type Conversation = Database['public']['Tables']['conversations']['Row']
type Message = Database['public']['Tables']['messages']['Row']
type BlockedUser = Database['public']['Tables']['blocked_users']['Row']
```

### Privacy Enums

```typescript
type PrivacyLevel = 'public' | 'holders_only' | 'private'
type AllowMessagesFrom = 'everyone' | 'holders_only' | 'nobody'
```

---

## Rate Limiting

### Message Sending

- **Limit:** 10 messages per minute per user
- **Implementation:** Database trigger
- **Error:** Returns error on exceeded limit

### Status Updates

- **Recommended:** Update every 30 seconds
- **Implementation:** Client-side throttling

---

## Database Indexes

**Required indexes for optimal performance:**

```sql
-- Messages table
CREATE INDEX idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC);

CREATE INDEX idx_messages_unread 
ON messages(conversation_id, is_read, sender_wallet);

-- Conversations table
CREATE INDEX idx_conversations_participant1 
ON conversations(participant_1, last_message_at DESC);

CREATE INDEX idx_conversations_participant2 
ON conversations(participant_2, last_message_at DESC);

-- User profiles
CREATE INDEX idx_user_profiles_wallet_lastseen 
ON user_profiles(wallet_address, last_seen_at);
```

---

## Security Considerations

### Row Level Security (RLS)

All tables have RLS policies:
- Users can only read their own data
- Privacy settings are enforced at database level
- Block status checked before message insert

### Input Validation

```typescript
// Always validate inputs
if (!walletAddress || walletAddress.length < 32) {
  return null
}

// Sanitize message content
const sanitized = content.trim().slice(0, 5000)
```

---

## Migration Path

### Updating Functions

When modifying these functions:

1. Update function signature
2. Update TypeScript types
3. Update this documentation
4. Add tests for new behavior
5. Deploy with migration

---

**Last Updated:** November 24, 2025  
**Version:** 1.0.0  
**Status:** Production Ready ✅







