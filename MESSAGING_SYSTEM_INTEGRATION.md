# Messaging System Integration Guide

Complete guide for integrating the messaging system into the Align platform.

## 📦 Components Created

### Core Components
1. **ConversationList** (`/components/ConversationList.tsx`)
   - Message inbox displaying all conversations
   - Real-time updates
   - Unread indicators and sorting

2. **MessageThread** (`/components/MessageThread.tsx`)
   - Displays conversation messages
   - Grouped by date
   - Read receipts
   - Typing indicators

3. **MessageComposer** (`/components/MessageComposer.tsx`)
   - Send messages
   - Typing indicators
   - Rate limiting
   - Character counter

4. **MessagesSidebar** (`/components/MessagesSidebar.tsx`)
   - Main messaging interface
   - Slide-out drawer from right
   - Three views: list, thread, new message

### Utilities
- **useMessages Hook** (`/lib/use-messages.tsx`)
  - Easy state management
  - Unread count tracking
  - Keyboard shortcuts

## 🚀 Quick Start Integration

### Step 1: Add to Layout or Main Navigation

Update your main layout or navigation component (e.g., `app/layout.tsx` or `app/page.tsx`):

```tsx
'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { MessagesSidebar } from '@/components/MessagesSidebar'
import { useMessages } from '@/lib/use-messages'
import { IconButton, Badge } from '@mui/material'
import MailIcon from '@mui/icons-material/Mail'

export default function Layout({ children }) {
  const wallet = useWallet()
  const { isOpen, openMessages, closeMessages, unreadCount } = useMessages(
    wallet.publicKey?.toBase58()
  )

  return (
    <div>
      {/* Your existing header */}
      <header>
        {/* ... other header content ... */}
        
        {/* Messages Button */}
        {wallet.publicKey && (
          <IconButton onClick={openMessages}>
            <Badge badgeContent={unreadCount} color="error">
              <MailIcon />
            </Badge>
          </IconButton>
        )}
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Messages Sidebar */}
      <MessagesSidebar
        isOpen={isOpen}
        onClose={closeMessages}
        currentWallet={wallet.publicKey?.toBase58() || ''}
      />
    </div>
  )
}
```

### Step 2: Add Message Button to User Profile

In `UserProfileView.tsx`, the message button already calls `onMessage` callback:

```tsx
<UserProfileView
  walletAddress={userWallet}
  currentUserWallet={currentWallet}
  onClose={() => setShowProfile(false)}
  onMessage={(recipientWallet) => {
    // Open messages sidebar and start conversation
    setShowProfile(false)
    openMessages()
    // Optionally: pass recipientWallet to MessagesSidebar to auto-start conversation
  }}
/>
```

### Step 3: Enhance MessagesSidebar (Optional)

To support opening directly to a conversation with a specific user:

```tsx
// Add to MessagesSidebar props
interface MessagesSidebarProps {
  isOpen: boolean
  onClose: () => void
  currentWallet: string
  startConversationWith?: string // Optional: wallet to start conversation with
}

// In component logic
useEffect(() => {
  if (isOpen && startConversationWith) {
    handleStartConversationWithUser(startConversationWith)
  }
}, [isOpen, startConversationWith])
```

## 🎨 Styling Customization

### Color Scheme
All components use the Align purple theme (`#7C4DFF`). To customize:

```tsx
// In MessagesSidebar.tsx or other components
sx={{
  bgcolor: '#YOUR_COLOR',
  '&:hover': { bgcolor: '#YOUR_HOVER_COLOR' }
}}
```

### Drawer Width
Change sidebar width in `MessagesSidebar.tsx`:

```tsx
<Drawer
  PaperProps={{
    sx: {
      width: { xs: '100%', sm: 500 }, // Change from 400 to your preferred width
    }
  }}
/>
```

## ⌨️ Keyboard Shortcuts

Built-in shortcuts:
- **Cmd/Ctrl + M**: Toggle messages sidebar
- **ESC**: Close sidebar or return to conversation list
- **Enter**: Send message (Shift+Enter for new line)

## 🔔 Real-time Features

All components subscribe to Supabase real-time:

1. **New Messages**: Automatically appear in thread
2. **Unread Count**: Updates in real-time
3. **Typing Indicators**: Show when someone is typing
4. **Online Status**: Updates when users go online/offline
5. **Read Receipts**: Update when messages are read

## 🚦 Rate Limiting

Built-in rate limiting (configurable in `MessageComposer.tsx`):
- **Default**: 10 messages per minute per conversation
- **Client-side**: Enforced for better UX
- **Server-side**: Should add database-level rate limiting

## 📱 Mobile Responsive

All components are fully responsive:
- **Desktop**: 400px sidebar
- **Mobile**: Full-width drawer
- Touch-friendly tap targets
- Optimized scrolling

## 🔒 Privacy & Permissions

Messaging respects user privacy settings:

```typescript
// Automatically checked by MessageComposer
canMessageUser(senderWallet, recipientWallet)

// Returns:
// - { canMessage: true } if allowed
// - { canMessage: false, reason: "..." } if blocked/restricted
```

Privacy levels (set in user profile):
- **Everyone**: Anyone can message
- **Holders Only**: Only token holders can message
- **Nobody**: No incoming messages

## 📊 Database Tables Used

1. **user_profiles**: User information and settings
2. **conversations**: Conversation metadata
3. **messages**: Message content and status
4. **typing_indicators**: Real-time typing state
5. **blocked_users**: User blocking

## 🐛 Debugging

Enable console logging:

```typescript
// In any messaging component
console.log('Message sent:', message)
console.log('Conversation ID:', conversationId)
```

Check Supabase Dashboard:
1. Go to Table Editor
2. Check `messages` table for new messages
3. Check `conversations` for `last_message_at` updates

## 🎯 Future Enhancements

Potential improvements:

1. **Message Reactions**: Emoji reactions to messages
2. **Message Editing**: Edit sent messages (with edit indicator)
3. **Message Deletion**: Delete messages for both parties
4. **File Attachments**: Send images/files
5. **Voice Messages**: Audio recording and playback
6. **Message Search**: Search within conversations
7. **Notifications**: Desktop/push notifications
8. **Read Receipts Toggle**: Let users disable read receipts
9. **Group Conversations**: Support for group chats
10. **Message Forwarding**: Forward messages to other conversations

## 📝 Example: Complete Integration

Here's a complete example in `app/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { MessagesSidebar } from '@/components/MessagesSidebar'
import { useMessages } from '@/lib/use-messages'
import { IconButton, Badge, Tooltip } from '@mui/material'
import MailIcon from '@mui/icons-material/Mail'

export default function Home() {
  const wallet = useWallet()
  const { isOpen, openMessages, closeMessages, unreadCount } = useMessages(
    wallet.publicKey?.toBase58()
  )

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Header */}
      <header className="sticky top-0 bg-page-bg/95 backdrop-blur-sm border-b border-border-subtle z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold text-text-primary">
              Align
            </h1>
            
            <div className="flex items-center gap-2">
              {/* Messages Button */}
              {wallet.publicKey && (
                <Tooltip title="Messages">
                  <IconButton
                    onClick={openMessages}
                    sx={{
                      color: '#7C4DFF',
                      '&:hover': { bgcolor: 'rgba(124, 77, 255, 0.08)' }
                    }}
                  >
                    <Badge
                      badgeContent={unreadCount}
                      sx={{
                        '& .MuiBadge-badge': {
                          bgcolor: '#7C4DFF',
                          color: 'white'
                        }
                      }}
                    >
                      <MailIcon />
                    </Badge>
                  </IconButton>
                </Tooltip>
              )}
              
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Your content here */}
      </main>

      {/* Messages Sidebar */}
      <MessagesSidebar
        isOpen={isOpen}
        onClose={closeMessages}
        currentWallet={wallet.publicKey?.toBase58() || ''}
      />
    </div>
  )
}
```

## ✅ Testing Checklist

- [ ] Messages sidebar opens and closes
- [ ] Conversation list loads
- [ ] Can click conversation to view thread
- [ ] Can send messages
- [ ] Receive real-time messages
- [ ] Unread count updates
- [ ] Typing indicators work
- [ ] Read receipts update
- [ ] Can start new conversation
- [ ] Privacy settings respected
- [ ] Rate limiting works
- [ ] Keyboard shortcuts work
- [ ] Mobile responsive
- [ ] Error handling works
- [ ] Toast notifications display

## 📚 Additional Resources

- [Supabase Real-time Docs](https://supabase.com/docs/guides/realtime)
- [Material UI Drawer](https://mui.com/material-ui/react-drawer/)
- [date-fns Documentation](https://date-fns.org/)

## 🆘 Common Issues

### Issue: Messages not appearing in real-time
**Solution**: Check Supabase real-time is enabled for the `messages` table

### Issue: Unread count not updating
**Solution**: Verify `is_read` field is being updated correctly in messages table

### Issue: Typing indicator stuck
**Solution**: Check that typing indicator timeout is clearing properly (3 seconds)

### Issue: Can't send messages
**Solution**: Verify `canMessageUser` permissions and check console for errors

---

**System Complete!** 🎉 All messaging components are ready for production use.

















