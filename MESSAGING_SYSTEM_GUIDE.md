# 📬 Align Messaging System - User Guide

## Overview

The Align messaging system enables secure, private direct messaging between token holders on the Solana blockchain. Connect with project teams, community members, and other holders through an intuitive, real-time messaging interface.

---

## 🌟 Features

### Real-Time Messaging
- **Instant delivery** - Messages appear in real-time
- **Typing indicators** - See when someone is typing
- **Read receipts** - Know when messages are read (✓ sent, ✓✓ read)
- **Online status** - See who's currently online

### Privacy & Security
- **Privacy controls** - Choose who can message you
- **Block users** - Prevent unwanted messages
- **Holders-only** - Limit messages to token holders
- **Encrypted storage** - Messages stored securely

### Rich Features
- **Multi-line messages** - Up to 5,000 characters
- **Message search** - Find old messages quickly
- **Conversation management** - Delete, archive conversations
- **Profile integration** - Message from any profile

---

## 📋 System Architecture

### Database Tables

```
┌─────────────────┐
│ user_profiles   │  ← Identity & Privacy Settings
├─────────────────┤
│ - wallet_address│
│ - display_name  │
│ - privacy_level │
│ - allow_messages│
└─────────────────┘
         │
         ├──────────────────┐
         ↓                  ↓
┌─────────────────┐  ┌─────────────────┐
│ conversations   │  │ blocked_users   │
├─────────────────┤  ├─────────────────┤
│ - participant_1 │  │ - blocker_wallet│
│ - participant_2 │  │ - blocked_wallet│
│ - last_message  │  │ - reason        │
└─────────────────┘  └─────────────────┘
         │
         ↓
┌─────────────────┐
│ messages        │
├─────────────────┤
│ - conversation  │
│ - sender_wallet │
│ - content       │
│ - is_read       │
│ - created_at    │
└─────────────────┘
         │
         ↓
┌─────────────────┐
│ typing_indicat. │  ← Real-time indicators
└─────────────────┘
```

### Message Flow

```
User A                    Supabase                    User B
  │                          │                          │
  │─── Send Message ────────>│                          │
  │    (via MessageComposer) │                          │
  │                          │                          │
  │                          │──── Real-time Update ───>│
  │                          │   (Supabase Realtime)    │
  │                          │                          │
  │                          │<─── Mark as Read ────────│
  │                          │                          │
  │<─── Read Receipt ────────│                          │
  │    (✓✓ indicator)        │                          │
```

---

## 🚀 Getting Started

### 1. Set Up Your Profile

**Navigate to Profile Settings:**
1. Click your wallet address in the header
2. Select "Profile Settings"
3. Click "Edit Profile"

**Configure your profile:**
```
Display Name: Your name or username
Bio: Short description
Avatar: Upload profile picture (optional)
```

### 2. Configure Privacy Settings

**Privacy Level:**
- **Public** - Anyone can view your profile and send messages
- **Holders Only** - Only token holders in common projects can contact you
- **Private** - Profile hidden, messages disabled

**Message Settings:**
- **Everyone** - Accept messages from anyone
- **Holders Only** - Only token holders can message
- **Nobody** - Disable messaging completely

**Recommended Settings:**
```
Privacy Level: Public
Allow Messages From: Holders Only
```

### 3. Start Messaging

**Method 1: From Profile**
1. Visit any user's profile
2. Click "Message" button
3. Start conversation

**Method 2: From Sidebar**
1. Press `Cmd+M` (Mac) or `Ctrl+M` (Windows)
2. Click "New Message" (+)
3. Enter wallet address
4. Click "Start Conversation"

---

## 💬 Using the Messaging System

### Opening Messages

**Keyboard Shortcut:**
- Press `Cmd+M` (Mac) or `Ctrl+M` (Windows)

**Click Icon:**
- Click the mail icon in header
- Badge shows unread count

### Sending Messages

**Compose:**
1. Type in the text field at bottom
2. Use `Shift+Enter` for new line
3. Press `Enter` to send

**Features:**
- Up to 5,000 characters per message
- Character counter appears at 4,500
- Messages deliver instantly

### Managing Conversations

**View Conversations:**
- **All** tab - Shows all conversations
- **Unread** tab - Shows only unread

**Delete Conversation:**
1. Hover over conversation
2. Click trash icon
3. Confirm deletion

**Search Messages:**
1. Type in search bar
2. Minimum 3 characters
3. Click result to jump to conversation

### Online Status

**Status Indicators:**
- 🟢 Green dot = Online now
- ⚪ No dot = Offline

**Note:** Only visible if user's privacy settings allow

---

## 🛡️ Privacy & Security

### Blocking Users

**To Block:**
1. Open conversation with user
2. Click menu (⋮) in header
3. Select "Block User"
4. Choose reason (optional)
5. Choose to delete message history
6. Click "Block"

**What Happens:**
- User can't send you new messages
- You can't send messages to them
- Conversation disappears (optional)
- Can be reversed by unblocking

**To Unblock:**
1. Go to Profile Settings
2. Click "Blocked Users" tab
3. Find user
4. Click "Unblock"

### Privacy Best Practices

**Protect Your Privacy:**
- ✅ Set appropriate privacy level
- ✅ Use holders-only for sensitive discussions
- ✅ Block spammers immediately
- ✅ Don't share sensitive info in messages

**Token Holder Verification:**
- System automatically verifies token holdings
- Only holders in common projects can message (if enabled)
- Verification updates every 5 minutes

---

## 🔍 Search & Organization

### Message Search

**Search Features:**
- Full-text search across all messages
- Highlights matching terms
- Shows sender and timestamp
- Search history saved

**Search Tips:**
```
✓ Use specific keywords
✓ Check spelling
✓ Try different terms
✗ Avoid very short queries (< 3 chars)
```

### Conversation Management

**Sorting:**
- Unread conversations appear first
- Then sorted by most recent message
- Real-time updates maintain order

**Filtering:**
- All: Shows everything
- Unread: Only conversations with unread messages

---

## ⚠️ Troubleshooting

### Common Issues

**Can't Send Messages:**
```
Problem: Send button disabled
Causes:
  - Empty message
  - User blocked you
  - Privacy settings restrict messaging
  - Not a token holder (if required)

Solution:
  1. Check message isn't empty
  2. Verify you hold required tokens
  3. Check user's profile for restrictions
```

**Messages Not Appearing:**
```
Problem: Messages don't show up
Causes:
  - Poor internet connection
  - Real-time subscription issue
  - Browser cache problem

Solution:
  1. Refresh the page
  2. Check internet connection
  3. Clear browser cache
  4. Try different browser
```

**Can't Find Conversation:**
```
Problem: Conversation missing
Causes:
  - User deleted their account
  - You deleted the conversation
  - User blocked you

Solution:
  1. Check "All" tab (not just "Unread")
  2. Use search to find messages
  3. Start new conversation if needed
```

**Typing Indicator Issues:**
```
Problem: Typing indicator stuck or not showing
Causes:
  - Network latency
  - Real-time connection dropped

Solution:
  - Automatic timeout after 3 seconds
  - Refresh if persists
```

---

## 📱 Mobile Experience

### Mobile Features

**Responsive Design:**
- Full-screen messaging on mobile
- Touch-optimized interface
- Native keyboard support

**Best Practices:**
- Use in portrait mode
- Allow notifications (future feature)
- Keep app tab open for real-time updates

---

## 🔧 Admin Guide

### Monitoring

**Supabase Dashboard:**
1. Navigate to Table Editor
2. Check `messages` table for activity
3. Monitor `blocked_users` for abuse
4. Review RLS policy logs

**Key Metrics:**
```sql
-- Total messages
SELECT COUNT(*) FROM messages;

-- Active users (last 24h)
SELECT COUNT(DISTINCT sender_wallet) 
FROM messages 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Blocked users count
SELECT COUNT(*) FROM blocked_users;
```

### Moderation

**Handle Reports:**
1. Check blocked_users table
2. Review block reasons
3. Investigate reported users
4. Take action if needed

**Spam Prevention:**
- Rate limiting: 10 messages/minute
- Character limit: 5,000 per message
- Automatic duplicate detection

### Performance

**Database Optimization:**
- Indexes on all query columns
- Cursor-based pagination
- Profile caching (10 min TTL)
- Message caching in React state

**Real-Time Efficiency:**
- Subscribe only to active conversations
- Unsubscribe on close
- Batch presence updates

---

## 📊 Analytics & Metrics

### User Engagement

**Tracking:**
- Messages sent/received
- Active conversations
- Response times
- Peak usage hours

**Supabase Query:**
```sql
-- Messages per day (last 7 days)
SELECT 
  DATE(created_at) as day,
  COUNT(*) as message_count
FROM messages
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day DESC;
```

---

## 🚨 Error Handling

### User-Facing Errors

**Network Errors:**
- Toast notification: "Failed to send message"
- Retry automatically
- Message saved in local state

**Permission Errors:**
- Clear message: "User has messaging disabled"
- Suggest checking privacy settings
- Link to help documentation

**Rate Limit Errors:**
- Toast: "Slow down! Too many messages"
- Show countdown timer
- Resume after cooldown

---

## 💡 Tips & Best Practices

### For Users

**Effective Communication:**
- ✅ Be respectful and professional
- ✅ Use clear, concise messages
- ✅ Respond promptly to important messages
- ✅ Keep conversations on-topic

**Privacy:**
- ✅ Review privacy settings regularly
- ✅ Block spam/unwanted users
- ✅ Don't share wallet private keys
- ✅ Report abusive behavior

### For Developers

**Integration:**
- Use `useMessaging()` hook for global state
- Subscribe to real-time updates
- Handle offline gracefully
- Cache profiles aggressively

**Performance:**
- Implement pagination for long conversations
- Use cursor-based pagination
- Batch profile fetches
- Optimize images with Next.js Image

---

## 🔗 Related Documentation

- [Messaging API Reference](./MESSAGING_API_REFERENCE.md) - Developer API docs
- [Migration Guide](./MESSAGING_MIGRATION_GUIDE.md) - Setup instructions
- [Performance Optimization](./MESSAGING_PERFORMANCE_OPTIMIZATION_COMPLETE.md) - Technical optimizations
- [Integration Guide](./MESSAGING_OPTIMIZATION_INTEGRATION.md) - Integration steps

---

## 📞 Support

**Issues:**
- Check [Troubleshooting](#-troubleshooting) section
- Review error messages carefully
- Clear cache and refresh

**Contact:**
- Discord: [Your Discord]
- Twitter: [Your Twitter]
- GitHub Issues: [Repository]

---

**Last Updated:** November 24, 2025  
**Version:** 1.0.0  
**Status:** Production Ready ✅




