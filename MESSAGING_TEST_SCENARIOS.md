# Messaging System - End-to-End Test Scenarios

**Test Date**: November 23, 2025  
**Tester**: _____________  
**Environment**: Development  
**Browser**: _____________  
**Status**: 🔄 In Progress

---

## Test Setup

### Prerequisites
- [ ] Development server running (`npm run dev`)
- [ ] Two test wallets available
  - Wallet A: _______________
  - Wallet B: _______________
- [ ] Test tokens distributed
- [ ] Browser notifications enabled
- [ ] Console open for debugging

### Test Data
```
Project: _______________
Token Mint: _______________
Wallet A Holdings: _______________
Wallet B Holdings: _______________
```

---

## 1. Profile System

### Test 1.1: Create Profile with Display Name + Bio
**Steps:**
1. Connect Wallet A
2. Navigate to profile settings
3. Set display name: "Test User Alpha"
4. Set bio: "Testing the messaging system"
5. Save changes

**Expected:**
- ✅ Profile saves successfully
- ✅ Display name appears in header
- ✅ Toast confirmation shown
- ✅ Changes persist on refresh

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 1.2: Update Avatar URL
**Steps:**
1. Go to profile settings
2. Valid URL: Enter `https://api.dicebear.com/7.x/avataaars/svg?seed=TestUser`
3. Save and verify avatar appears
4. Invalid URL: Enter `not-a-url`
5. Save and check error handling

**Expected:**
- ✅ Valid URL shows avatar preview
- ✅ Invalid URL shows error or placeholder
- ✅ Avatar appears in messages/profile

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 1.3: Change Privacy Level (All 3 Levels)
**Steps:**
1. Set privacy to "Public" → Save
2. Verify with Wallet B (should see full profile)
3. Set privacy to "Holders Only" → Save
4. Verify with Wallet B non-holder (should see restricted view)
5. Set privacy to "Private" → Save
6. Verify with Wallet B (should see private message)

**Expected:**
- ✅ Each level enforces correct restrictions
- ✅ Changes apply immediately (after cache expiry)
- ✅ Appropriate messages shown

**Actual:**
- [ ] Pass / [ ] Fail
- Privacy Level Results:
  - Public: _______________
  - Holders Only: _______________
  - Private: _______________

---

### Test 1.4: View Own Profile
**Steps:**
1. Click on own avatar/name
2. Check all sections visible
3. Verify edit button appears

**Expected:**
- ✅ Full profile shown regardless of privacy setting
- ✅ Edit button visible
- ✅ All stats displayed

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 1.5: View Other User's Profile (Holder/Non-Holder)
**Steps:**
1. Wallet B (holder) views Wallet A's holder-only profile
2. Check full profile visible
3. Wallet B transfers tokens (becomes non-holder)
4. Wait 5+ minutes (cache expiry)
5. Refresh and view profile again

**Expected:**
- ✅ Holder sees full profile
- ✅ Non-holder sees restricted view
- ✅ Cache respects 5-minute TTL

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 1.6: Edit Profile Saves Correctly
**Steps:**
1. Edit display name
2. Edit bio
3. Edit avatar URL
4. Save changes
5. Refresh page
6. Check values persisted

**Expected:**
- ✅ All fields save
- ✅ No data loss on refresh
- ✅ Changes visible to other users

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## 2. Core Messaging

### Test 2.1: Send First Message to New User
**Steps:**
1. Wallet A clicks "New Message"
2. Enter Wallet B address
3. Click "Start Conversation"
4. Type first message: "Hello from Test User Alpha!"
5. Press Send or Enter

**Expected:**
- ✅ Conversation created
- ✅ Message appears immediately (optimistic UI)
- ✅ Message persists after refresh
- ✅ Conversation appears in list

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 2.2: Receive Message + Notification
**Steps:**
1. Wallet B opens Messages sidebar
2. Wallet A sends message to Wallet B
3. Check notification appears (if browser tab not focused)
4. Check unread badge updates
5. Check sound plays (if enabled)

**Expected:**
- ✅ Browser notification appears
- ✅ Unread count increments
- ✅ Toast notification shown (if tab focused)
- ✅ Sound plays (if enabled)
- ✅ Notification has correct content preview

**Actual:**
- [ ] Pass / [ ] Fail
- Notification Details: _______________

---

### Test 2.3: See Typing Indicator
**Steps:**
1. Wallet A and B in same conversation
2. Wallet A starts typing
3. Check Wallet B sees "typing..."
4. Wallet A stops typing for 3+ seconds
5. Check indicator disappears

**Expected:**
- ✅ "typing..." appears when user types
- ✅ Indicator clears after 3 seconds of inactivity
- ✅ Indicator clears when message sent
- ✅ No lag or flickering

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 2.4: Read Receipts Update (✓ → ✓✓)
**Steps:**
1. Wallet A sends message (should show single ✓)
2. Wallet B opens conversation (marks as read)
3. Check Wallet A sees double ✓✓
4. Verify `read_at` timestamp updates

**Expected:**
- ✅ Single check initially
- ✅ Double check after read
- ✅ Updates in real-time
- ✅ Correct timestamp in database

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 2.5: Messages Appear in Real-Time
**Steps:**
1. Open conversation in both windows
2. Send message from Wallet A
3. Check appears immediately in Wallet B (without refresh)
4. Send from Wallet B
5. Check appears in Wallet A

**Expected:**
- ✅ Messages appear instantly (<1 second)
- ✅ No page refresh needed
- ✅ Correct sender identification
- ✅ Timestamp accurate

**Actual:**
- [ ] Pass / [ ] Fail
- Latency: _______________

---

### Test 2.6: Scroll to Load Older Messages
**Steps:**
1. Create 60+ messages in conversation
2. Open conversation (should show last 50)
3. Scroll to top
4. Check older messages load automatically

**Expected:**
- ✅ Initial load shows latest 50 messages
- ✅ Scrolling up loads next batch
- ✅ No duplicate messages
- ✅ Smooth loading animation

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 2.7: Send Message with Enter Key
**Steps:**
1. Type message in input
2. Press Enter (without Shift)
3. Verify message sends

**Expected:**
- ✅ Message sends immediately
- ✅ Input field clears
- ✅ No newline added to message

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 2.8: Shift+Enter Adds New Line
**Steps:**
1. Type "Line 1"
2. Press Shift+Enter
3. Type "Line 2"
4. Press Shift+Enter
5. Type "Line 3"
6. Press Enter to send

**Expected:**
- ✅ Message contains 3 lines
- ✅ Formatting preserved
- ✅ No premature sending
- ✅ Displays correctly in conversation

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## 3. Conversation Management

### Test 3.1: Conversations Sorted by Recent
**Steps:**
1. Create 3 conversations (A, B, C)
2. Send message in conversation A
3. Wait 1 minute
4. Send message in conversation B
5. Check order: B, A, C

**Expected:**
- ✅ Most recent conversation at top
- ✅ Updates in real-time when new message received
- ✅ Unread conversations prioritized

**Actual:**
- [ ] Pass / [ ] Fail
- Observed Order: _______________

---

### Test 3.2: Unread Badge Appears/Disappears
**Steps:**
1. Wallet A sends message to Wallet B
2. Check Wallet B sees unread badge with count
3. Wallet B opens conversation
4. Check badge disappears
5. Check unread count decrements

**Expected:**
- ✅ Badge appears on new message
- ✅ Count is accurate
- ✅ Badge clears when conversation opened
- ✅ Purple badge color (#7C4DFF)

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 3.3: Last Message Preview Updates
**Steps:**
1. Send message "First message"
2. Check preview shows "First message"
3. Send message "Second message"
4. Check preview updates to "Second message"
5. Other user sends message "Reply"
6. Check preview updates

**Expected:**
- ✅ Preview shows latest message
- ✅ Updates in real-time
- ✅ Truncates long messages (50 chars)
- ✅ Shows "No messages yet" for new conversations

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 3.4: Search Conversations by Name/Wallet
**Steps:**
1. Have 3+ conversations
2. Enter search query matching display name
3. Check conversation appears
4. Enter wallet address fragment
5. Check conversation appears
6. Clear search

**Expected:**
- ✅ Search filters conversations
- ✅ Matches display name
- ✅ Matches wallet address
- ✅ Clear button works
- ✅ Results update as you type

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 3.5: Delete Conversation
**Steps:**
1. Hover over conversation
2. Click delete icon
3. Confirm deletion
4. Check conversation removed from list
5. Check messages deleted from database

**Expected:**
- ✅ Delete icon appears on hover
- ✅ Confirmation dialog shown
- ✅ Conversation removed immediately
- ✅ Cannot be undone
- ✅ Other user's conversation unaffected

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 3.6: Mute Conversation
**Steps:**
1. Right-click conversation or open menu
2. Click "Mute"
3. Send message from other user
4. Check no notification received
5. Unmute conversation

**Expected:**
- ✅ Mute option available
- ✅ Muted conversations still show in list
- ✅ No notifications when muted
- ✅ Unmute restores notifications
- ✅ Visual indicator for muted state

**Actual:**
- [ ] Pass / [ ] Fail / [ ] Not Implemented
- Notes: _______________

---

## 4. Entry Points

### Test 4.1: Click Header Icon → Sidebar Opens
**Steps:**
1. Click message icon in AppHeader
2. Check sidebar opens from right
3. Close sidebar
4. Press Cmd/Ctrl+M (keyboard shortcut)

**Expected:**
- ✅ Sidebar opens smoothly
- ✅ Shows conversation list
- ✅ Unread badge visible
- ✅ Keyboard shortcut works
- ✅ ESC key closes sidebar

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 4.2: Message from Project Chat
**Steps:**
1. Open project page
2. Click on user's name in chat
3. Click "Message" button
4. Check conversation opens with pre-filled recipient

**Expected:**
- ✅ Messages sidebar opens
- ✅ Conversation with user opens
- ✅ Ready to type immediately
- ✅ Correct recipient selected

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 4.3: Message from Karma Leaderboard
**Steps:**
1. Open karma leaderboard
2. Click on user entry
3. Click "Message" button
4. Verify conversation opens

**Expected:**
- ✅ Opens messages sidebar
- ✅ Correct recipient
- ✅ Shows user's profile info

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 4.4: Message from Admin Dashboard
**Steps:**
1. Login as admin
2. Navigate to admin dashboard
3. Find user in admin panels
4. Click message/contact button
5. Verify admin override works (can message anyone)

**Expected:**
- ✅ Admin can message blocked users
- ✅ Admin can message private profiles
- ✅ Admin override flag works
- ✅ No privacy restrictions for admin

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 4.5: Message from User Profile
**Steps:**
1. Navigate to another user's profile
2. Click "Message" button
3. Check sidebar opens with conversation
4. Send test message

**Expected:**
- ✅ Message button visible (if allowed)
- ✅ Opens correct conversation
- ✅ Can send immediately
- ✅ Button disabled if blocked/private

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 4.6: All Entry Points Pre-fill Recipient
**Steps:**
1. Test each entry point above
2. Verify recipient wallet is auto-filled
3. Check no manual entry needed
4. Confirm conversation creates correctly

**Expected:**
- ✅ All entry points auto-fill
- ✅ No need to enter wallet address manually
- ✅ Seamless UX from any location

**Actual:**
- [ ] Pass / [ ] Fail
- Entry Points Tested: _______________

---

## 5. Notifications

### Test 5.1: Request Permission
**Steps:**
1. First time user connects wallet
2. Check browser permission prompt appears
3. Accept permission
4. Verify stored in settings

**Expected:**
- ✅ Permission requested on first use
- ✅ Choice remembered
- ✅ Can change in profile settings
- ✅ Graceful handling if denied

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 5.2: Receive Browser Notification
**Steps:**
1. Open messages in one tab
2. Minimize or switch to different tab
3. Send message from another user
4. Check notification appears

**Expected:**
- ✅ Notification shows outside focused tab
- ✅ Contains sender name and message preview
- ✅ Has app icon
- ✅ Plays sound (if enabled)

**Actual:**
- [ ] Pass / [ ] Fail
- Notification Content: _______________

---

### Test 5.3: Click Notification Opens Conversation
**Steps:**
1. Receive notification
2. Click on notification
3. Check browser focuses tab
4. Check conversation opens automatically

**Expected:**
- ✅ Brings app to foreground
- ✅ Opens messages sidebar
- ✅ Shows correct conversation
- ✅ Notification dismissed

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 5.4: No Notification if Tab Focused
**Steps:**
1. Have messages sidebar open
2. Focused on conversation
3. Receive message
4. Check no browser notification appears
5. Check in-app toast shows instead

**Expected:**
- ✅ No browser notification when focused
- ✅ Message appears in thread immediately
- ✅ Optional: subtle in-app notification/sound

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 5.5: Quiet Hours Respected
**Steps:**
1. Go to notification settings
2. Enable quiet hours (e.g., 10 PM - 8 AM)
3. Send test message during quiet hours
4. Check no notification received
5. Send message during active hours
6. Check notification appears

**Expected:**
- ✅ No notifications during quiet hours
- ✅ Messages still received (just silent)
- ✅ Unread badges still update
- ✅ Active hours work normally

**Actual:**
- [ ] Pass / [ ] Fail / [ ] Not Implemented
- Notes: _______________

---

### Test 5.6: Sound Plays (if enabled)
**Steps:**
1. Enable notification sound in settings
2. Receive message
3. Check sound plays
4. Disable sound
5. Receive message
6. Check no sound

**Expected:**
- ✅ Sound toggle in settings
- ✅ Sound plays when enabled
- ✅ Silent when disabled
- ✅ Pleasant notification sound

**Actual:**
- [ ] Pass / [ ] Fail / [ ] Not Implemented
- Notes: _______________

---

### Test 5.7: Notification Preview Respects Setting
**Steps:**
1. Enable full preview in settings
2. Receive message
3. Check notification shows full message
4. Disable preview (show sender only)
5. Receive message
6. Check notification shows only sender name

**Expected:**
- ✅ Preview setting in notification settings
- ✅ Full preview shows message content
- ✅ Private mode shows "New message" only
- ✅ Setting persists

**Actual:**
- [ ] Pass / [ ] Fail / [ ] Not Implemented
- Notes: _______________

---

## 6. Search

### Test 6.1: Search Messages Finds Matches
**Steps:**
1. Have conversation with 20+ messages
2. Search for specific word/phrase
3. Check results show matching messages
4. Try case-insensitive search
5. Try partial word match

**Expected:**
- ✅ Search finds all matches
- ✅ Case-insensitive
- ✅ Partial matches work
- ✅ Results show context
- ✅ Fast search (<500ms)

**Actual:**
- [ ] Pass / [ ] Fail
- Search Query: _______________
- Results Count: _______________

---

### Test 6.2: Highlights Appear in Results
**Steps:**
1. Search for word
2. Check results show highlights
3. Verify highlight color is visible
4. Check highlights are accurate

**Expected:**
- ✅ Search term highlighted in yellow (#FEF08A)
- ✅ All instances highlighted
- ✅ Readable against background
- ✅ Maintains text formatting

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 6.3: Click Result Opens Conversation
**Steps:**
1. Search for message
2. Click on search result
3. Check conversation opens
4. Check scrolls to matched message

**Expected:**
- ✅ Opens correct conversation
- ✅ Scrolls to message
- ✅ Highlights fades after few seconds
- ✅ Search clears

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 6.4: Scroll to Searched Message
**Steps:**
1. Search for old message (50+ messages back)
2. Click result
3. Check conversation loads
4. Check auto-scrolls to message
5. Check message is visible/highlighted

**Expected:**
- ✅ Loads conversation with history
- ✅ Scrolls to exact message
- ✅ Message highlighted temporarily
- ✅ Can scroll up/down from there

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 6.5: Clear Search Returns to List
**Steps:**
1. Perform search
2. Click clear button (X)
3. Check returns to conversation list
4. Check all conversations visible again

**Expected:**
- ✅ Clear button visible when searching
- ✅ Returns to full list
- ✅ Search input clears
- ✅ Results reset

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## 7. Privacy & Blocking

### Test 7.1: Block User → Can't Message
**Steps:**
1. Open conversation with user
2. Click menu → Block user
3. Confirm with reason
4. Check conversation closes
5. Try to message blocked user
6. Check error appears

**Expected:**
- ✅ Block confirmation modal appears
- ✅ Option to delete history
- ✅ Reason field (optional)
- ✅ Can't send new messages
- ✅ Error: "User is blocked"

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 7.2: Unblock User → Can Message
**Steps:**
1. View blocked user's profile
2. Click "Unblock" button
3. Confirm unblock
4. Try sending message
5. Verify message delivers

**Expected:**
- ✅ Unblock button visible
- ✅ Confirmation required
- ✅ Can message immediately after unblock
- ✅ Toast: "User unblocked"

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 7.3: Blocked User Can't See Online Status
**Steps:**
1. Block user
2. From blocked user's account, view your profile
3. Check no online status shown
4. Check in conversation list (if exists)
5. Verify no online badge

**Expected:**
- ✅ No online/offline indicator
- ✅ No green dot
- ✅ No status text
- ✅ Avatar shown without badge

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 7.4: Holder-Only Privacy Enforced
**Steps:**
1. Set privacy to "Holders Only"
2. From non-holder account, view profile
3. Check restricted view shown
4. Try to message (should fail)
5. From holder account, verify full access

**Expected:**
- ✅ Non-holder sees restricted view
- ✅ Lock icon and message shown
- ✅ Can't message
- ✅ Holder sees full profile

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 7.5: Private Profile Hidden from Search
**Steps:**
1. Set profile to "Private"
2. From another account, search for user
3. Check profile doesn't appear in results
4. Try direct navigation to profile
5. Check shows "Private Profile" message

**Expected:**
- ✅ Excluded from search results
- ✅ Direct access shows private message
- ✅ No profile details leaked
- ✅ No messaging possible

**Actual:**
- [ ] Pass / [ ] Fail / [ ] Search Not Implemented
- Notes: _______________

---

### Test 7.6: Token Holder Check Works
**Steps:**
1. Set profile to "Holders Only"
2. Verify both users hold tokens in Project X
3. Check full access granted
4. User B sells all tokens
5. Wait 5+ minutes (cache expiry)
6. Check access now restricted

**Expected:**
- ✅ Common holdings detected
- ✅ Full access for holders
- ✅ Restricted access for non-holders
- ✅ Cache respects TTL
- ✅ Accurate balance checks

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## 8. Online Presence

### Test 8.1: User Goes Online on Connect
**Steps:**
1. Connect wallet
2. Check `is_online` set to true in database
3. Check `last_seen_at` updates
4. Check other users see green dot

**Expected:**
- ✅ Status updates immediately on connect
- ✅ Real-time update for other users
- ✅ Green dot appears in conversations
- ✅ "Online" text shows

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 8.2: Green Dot Appears for Online Users
**Steps:**
1. Two users online
2. Check conversation list shows green dot
3. Check message thread shows green dot
4. Check profile shows online status
5. Verify animated pulse effect

**Expected:**
- ✅ Green dot (#44b700) visible
- ✅ Pulse animation on dot
- ✅ Consistent across all views
- ✅ Clear visual indicator

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 8.3: User Goes Offline on Disconnect
**Steps:**
1. Disconnect wallet or close tab
2. Wait 5 seconds
3. Check other user sees offline status
4. Check dot turns gray
5. Check shows "Offline" text

**Expected:**
- ✅ Updates within 5 seconds
- ✅ Dot turns gray (#9E9E9E)
- ✅ "Offline" text appears
- ✅ No pulse animation

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 8.4: Last Seen Updates Correctly
**Steps:**
1. User goes offline
2. Check "Last seen X minutes ago" appears
3. Wait 1 hour
4. Check updates to "Last seen 1 hour ago"
5. Check database has accurate timestamp

**Expected:**
- ✅ Relative time displayed
- ✅ Updates dynamically
- ✅ Human-readable format
- ✅ Accurate calculation

**Actual:**
- [ ] Pass / [ ] Fail
- Display Format: _______________

---

## 9. Edge Cases

### Test 9.1: Send to Self → Error or Allowed?
**Steps:**
1. Try to start conversation with own wallet
2. Check error handling

**Expected:**
- ✅ Error: "Cannot message yourself"
- ✅ Prevents conversation creation
- ✅ Clear error message

**Actual:**
- [ ] Pass / [ ] Fail
- Behavior: _______________

---

### Test 9.2: Send 10+ Messages Quickly → Rate Limit
**Steps:**
1. Rapidly send 10 messages
2. Try to send 11th message
3. Check rate limit error appears
4. Wait 1 minute
5. Try sending again

**Expected:**
- ✅ Rate limit: 10 messages per minute
- ✅ Error: "Rate limit exceeded. Try again in X seconds"
- ✅ Countdown shown
- ✅ Limit resets after window

**Actual:**
- [ ] Pass / [ ] Fail
- Rate Limit: _______________
- Error Message: _______________

---

### Test 9.3: Message Blocked User → Error
**Steps:**
1. Block user
2. Try to send message
3. Check error appears
4. Check message doesn't send

**Expected:**
- ✅ Input disabled or error shown
- ✅ Error: "You have blocked this user"
- ✅ Message not sent
- ✅ Clear unblock instructions

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 9.4: Deleted Message Shows Placeholder
**Steps:**
1. Send message
2. Delete message (if feature exists)
3. Check placeholder appears
4. Check other user sees deletion

**Expected:**
- ✅ Shows "Message deleted" placeholder
- ✅ Timestamp preserved
- ✅ Real-time update for recipient
- ✅ Can't be recovered

**Actual:**
- [ ] Pass / [ ] Fail / [ ] Not Implemented
- Notes: _______________

---

### Test 9.5: Network Error → Retry Logic
**Steps:**
1. Open DevTools → Network tab
2. Throttle to "Offline"
3. Try sending message
4. Check error handling
5. Restore connection
6. Check automatic retry or manual option

**Expected:**
- ✅ Error message shown
- ✅ Message marked as failed
- ✅ Retry button appears
- ✅ Auto-sends when connection restored

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 9.6: Long Messages (4500+ chars) → Warning
**Steps:**
1. Type message with 4000 characters
2. Check no warning
3. Type beyond 4500 characters
4. Check character counter appears
5. Try to exceed 5000 characters
6. Check hard limit enforced

**Expected:**
- ✅ Counter appears at 4500 chars
- ✅ Shows X/5000
- ✅ Turns red near limit
- ✅ Hard limit at 5000
- ✅ Error if trying to exceed

**Actual:**
- [ ] Pass / [ ] Fail
- Character Limit: _______________

---

## 10. Mobile Responsive

### Test 10.1: Sidebar Full-Width on Mobile
**Steps:**
1. Resize browser to mobile width (< 600px)
2. Open messages sidebar
3. Check takes full viewport width
4. Check back button works
5. Check close button accessible

**Expected:**
- ✅ Sidebar is 100% width on mobile
- ✅ Slides in from right
- ✅ Can navigate back
- ✅ No horizontal scroll

**Actual:**
- [ ] Pass / [ ] Fail
- Screen Width: _______________

---

### Test 10.2: Conversations List Scrollable
**Steps:**
1. On mobile, have 10+ conversations
2. Scroll conversation list
3. Check smooth scrolling
4. Check no content cut off

**Expected:**
- ✅ Smooth scroll
- ✅ All conversations accessible
- ✅ No z-index issues
- ✅ Search bar stays fixed

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 10.3: Message Bubbles Readable
**Steps:**
1. Open conversation on mobile
2. Check message text size
3. Check bubble width
4. Check no text overflow
5. Test with long words/URLs

**Expected:**
- ✅ Readable font size (14px+)
- ✅ Appropriate bubble width
- ✅ Word wrap works
- ✅ Long URLs break correctly

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 10.4: Keyboard Opens Properly
**Steps:**
1. On mobile device, tap message input
2. Check keyboard appears
3. Check input stays visible
4. Check can scroll messages while typing
5. Check keyboard doesn't cover input

**Expected:**
- ✅ Keyboard appears instantly
- ✅ Input scrolls into view
- ✅ Send button accessible
- ✅ Can see recent messages

**Actual:**
- [ ] Pass / [ ] Fail
- Device: _______________

---

### Test 10.5: Touch Interactions Work
**Steps:**
1. Tap to open conversation
2. Swipe to scroll messages
3. Long-press for context menu (if exists)
4. Pinch to zoom (should be disabled)
5. Pull to refresh (if exists)

**Expected:**
- ✅ Tap targets large enough (44px+)
- ✅ Smooth swipe scrolling
- ✅ No accidental zooming
- ✅ Touch feedback visible

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## Test Summary

### Statistics
- Total Tests: 78
- Passed: _____ / 78
- Failed: _____ / 78
- Not Implemented: _____ / 78
- Pass Rate: _____%

### Critical Bugs Found
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Minor Bugs Found
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### UI/UX Issues
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Performance Issues
1. _______________________________________________
2. _______________________________________________

### Browser Compatibility
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile Safari
- [ ] Mobile Chrome

### Recommendations
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Next Steps
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

**Test Completed**: _______________  
**Sign-off**: _______________  
**Ready for Production**: [ ] Yes / [ ] No / [ ] With Fixes















