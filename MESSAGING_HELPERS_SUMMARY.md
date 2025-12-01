# 📚 Messaging Helpers - Quick Reference

**File**: `/lib/messaging.ts`  
**Status**: ✅ Complete

---

## All Functions (9 total)

### Required Functions (5)

| Function | Purpose | Returns |
|----------|---------|---------|
| `getOrCreateProfile(wallet)` | Get/create user profile | `UserProfile \| null` |
| `getOrCreateConversation(w1, w2)` | Get/create conversation | `Conversation \| null` |
| `canMessageUser(sender, recipient, projectId?)` | Check message permissions | `{ canMessage, reason? }` |
| `markConversationAsRead(convId, wallet)` | Mark messages as read | `boolean` |
| `getUnreadCount(wallet)` | Get total unread count | `number` |

### Bonus Functions (4)

| Function | Purpose | Returns |
|----------|---------|---------|
| `updateOnlineStatus(wallet, isOnline)` | Update online status | `boolean` |
| `isUserBlocked(w1, w2)` | Quick block check | `boolean` |
| `getUserConversations(wallet)` | Get all conversations | `Conversation[]` |
| `getConversationMessages(convId, limit?, offset?)` | Get messages with pagination | `Message[]` |

---

## Quick Usage Examples

### Send a Message
```typescript
import { getOrCreateConversation, canMessageUser } from '@/lib/messaging'

// Check permission
const { canMessage } = await canMessageUser(sender, recipient)
if (!canMessage) return

// Get conversation
const conv = await getOrCreateConversation(sender, recipient)

// Send message
await supabase.from('messages').insert({
  conversation_id: conv.id,
  sender_wallet: sender,
  content: text
})
```

### Load Conversations
```typescript
import { getUserConversations } from '@/lib/messaging'

const conversations = await getUserConversations(wallet)
// Each has: id, participants, last_message_at, unread_count
```

### Load Messages
```typescript
import { getConversationMessages, markConversationAsRead } from '@/lib/messaging'

const messages = await getConversationMessages(convId)
await markConversationAsRead(convId, wallet)
```

### Show Unread Badge
```typescript
import { getUnreadCount } from '@/lib/messaging'

const count = await getUnreadCount(wallet)
// Display: {count > 0 && <Badge>{count}</Badge>}
```

---

## Features

✅ **Type-Safe** - Full TypeScript support  
✅ **Error Handling** - Graceful degradation  
✅ **Performance** - Indexed queries  
✅ **Privacy** - Permission checking  
✅ **Blocking** - Bidirectional block support  
✅ **Token-Gated** - Holders-only messaging  

---

## Key Patterns

### 1. Profile Management
```typescript
// Auto-creates if doesn't exist
const profile = await getOrCreateProfile(wallet)
```

### 2. Conversation Deduplication
```typescript
// Automatically orders wallets alphabetically
const conv = await getOrCreateConversation(walletA, walletB)
// Same conversation regardless of order
```

### 3. Permission Checking
```typescript
const { canMessage, reason } = await canMessageUser(sender, recipient)
// Checks: blocks, privacy settings, token holding
```

### 4. Batch Read Marking
```typescript
// Marks all unread messages at once
await markConversationAsRead(convId, wallet)
```

---

## Complete Flow

```typescript
// 1. Ensure profiles exist
await getOrCreateProfile(wallet)

// 2. Check permissions
const { canMessage } = await canMessageUser(sender, recipient, projectId)

// 3. Get/create conversation
const conv = await getOrCreateConversation(sender, recipient)

// 4. Send message
await supabase.from('messages').insert({ ... })

// 5. Load messages
const messages = await getConversationMessages(conv.id)

// 6. Mark as read
await markConversationAsRead(conv.id, wallet)

// 7. Get unread count
const unread = await getUnreadCount(wallet)
```

---

## Real-time Integration

### Subscribe to New Messages
```typescript
supabase
  .channel(`messages:${convId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${convId}`
  }, (payload) => {
    // Add message to UI
    setMessages(prev => [...prev, payload.new])
  })
  .subscribe()
```

### Subscribe to Online Status
```typescript
supabase
  .channel('online-status')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'user_profiles'
  }, (payload) => {
    // Update user status in UI
    updateUserStatus(payload.new)
  })
  .subscribe()
```

---

## Error Handling

All functions return safe defaults on error:
- `null` for object functions
- `false` for boolean functions
- `0` for number functions
- `[]` for array functions

Errors are logged to console for debugging.

---

## Status

✅ **Implementation**: Complete  
✅ **Type Safety**: Full TypeScript  
✅ **Testing**: Ready  
✅ **Documentation**: Complete  
✅ **Linter**: Zero errors  

Ready for production use! 🚀









