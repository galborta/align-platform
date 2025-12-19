# Privacy System Testing Guide

## Quick Start Testing

### Prerequisites
- Two test wallets (Wallet A and Wallet B)
- At least one token project
- Test tokens distributed to wallets

### Test Setup

#### User A Setup (Profile Owner)
1. Connect with Wallet A
2. Go to Profile Settings
3. Set privacy level:
   - Option 1: "Public" (baseline)
   - Option 2: "Holders Only" (requires common holdings)
   - Option 3: "Private" (maximum privacy)
4. Set allow_messages_from:
   - Option 1: "Everyone"
   - Option 2: "Holders Only"
   - Option 3: "Nobody"

#### User B Setup (Visitor)
1. Connect with Wallet B
2. Control token holdings:
   - For positive tests: Hold tokens in same project as User A
   - For negative tests: Hold no tokens or different project

## Test Scenarios

### Scenario 1: Public Profile (Baseline)
**Setup:**
- User A: privacy_level = "public"
- User A: allow_messages_from = "everyone"
- User B: Any token holdings (doesn't matter)

**Expected Results:**
- ✅ User B sees full profile
- ✅ User B sees online status (if User A is online)
- ✅ User B can send messages
- ✅ Message button is enabled
- ✅ No restricted messages shown

**Test Steps:**
1. User B visits User A's profile
2. Check all profile sections are visible
3. Check online status indicator is shown
4. Click "Message" button
5. Send a test message
6. Verify message delivers successfully

---

### Scenario 2: Holders Only Profile - With Holdings
**Setup:**
- User A: privacy_level = "holders_only"
- User A: allow_messages_from = "holders_only"
- User B: Holds tokens in Project X (same as User A)

**Expected Results:**
- ✅ User B sees full profile
- ✅ User B sees online status
- ✅ User B can send messages
- ✅ No restrictions shown

**Test Steps:**
1. Verify both users hold tokens in same project
2. User B visits User A's profile
3. Check all profile sections are visible
4. Check online badge is shown
5. Send a message
6. Verify message delivers

---

### Scenario 3: Holders Only Profile - Without Holdings
**Setup:**
- User A: privacy_level = "holders_only"
- User A: allow_messages_from = "holders_only"
- User B: Holds no tokens OR different project

**Expected Results:**
- ⛔ User B sees restricted profile view
- ⛔ Message shows: "This is a Holder-Only Profile"
- ⛔ Online status is hidden
- ⛔ Message button is disabled/hidden
- ⛔ Detailed message: "Hold tokens in a common project to view full profile details"

**Test Steps:**
1. Verify User B doesn't hold tokens in common project
2. User B visits User A's profile
3. **Check**: Avatar and display name shown
4. **Check**: "Holder-Only Profile" badge visible
5. **Check**: Large lock icon (🔒) displayed
6. **Check**: Profile sections (bio, stats) are hidden
7. **Check**: Online status indicator is NOT shown
8. **Check**: Message button disabled or shows tooltip
9. Try clicking message button (should show error or do nothing)

---

### Scenario 4: Private Profile
**Setup:**
- User A: privacy_level = "private"
- User B: Any token holdings

**Expected Results:**
- ⛔ User B sees "Private Profile" message
- ⛔ No profile details shown at all
- ⛔ Lock icon (🔐) displayed
- ⛔ Message: "This user has set their profile to private"
- ⛔ No messaging possible

**Test Steps:**
1. User B visits User A's profile
2. **Check**: Only "Private Profile" header shown
3. **Check**: Large lock icon (🔐) displayed
4. **Check**: Generic message, no user details
5. **Check**: No online status
6. **Check**: No action buttons
7. Verify profile sections completely hidden

---

### Scenario 5: Online Status in Conversations
**Setup:**
- User A: privacy_level = "holders_only"
- User A and User B have existing conversation
- User B: No token holdings

**Expected Results:**
- ✅ Conversation still appears in list
- ⛔ No online badge for User A
- ⛔ No "Online" / "Offline" text shown
- ✅ Can still view old messages
- ⛔ Cannot send new messages (if allow_messages_from = "holders_only")

**Test Steps:**
1. Create conversation while User B has holdings
2. User B transfers tokens (loses holdings)
3. Wait 5+ minutes (cache expiry)
4. User B opens Messages sidebar
5. **Check**: Conversation still in list
6. **Check**: User A's avatar shown without online badge
7. **Check**: No status text below name
8. Try sending message (should fail with error)

---

### Scenario 6: Message Attempt - Privacy Block
**Setup:**
- User A: allow_messages_from = "holders_only"
- User B: No token holdings
- Existing conversation between users

**Expected Results:**
- ⛔ Message input shows error
- ⛔ Send button is disabled
- ⛔ Error text: "This user only accepts messages from token holders"
- ⛔ Typing doesn't trigger typing indicator

**Test Steps:**
1. User B opens conversation with User A
2. **Check**: Error message shown above/in message input
3. **Check**: Text input is disabled OR shows error
4. **Check**: Send button is grayed out
5. Try typing anyway (should be prevented)
6. Try clicking Send (should show toast error)

---

### Scenario 7: Cache Behavior
**Setup:**
- User A: privacy_level = "holders_only"
- User B: Initially no holdings

**Expected Results:**
- Phase 1: Restricted view (no holdings)
- Phase 2: Still restricted (cache hasn't expired)
- Phase 3: Full view (cache expired, holdings detected)

**Test Steps:**
1. User B visits User A's profile
2. **Check**: Sees restricted view
3. User B acquires tokens in common project (via transfer)
4. User B refreshes page immediately
5. **Check**: Still sees restricted view (cache)
6. Wait 5+ minutes
7. User B refreshes page
8. **Check**: Now sees full profile

**Note**: Cache key is `${viewerWallet}-${targetWallet}`, 5-minute TTL

---

## Automated Testing Checklist

### UserProfileView Privacy
- [ ] Public profile shows all content
- [ ] Holders-only profile shows restricted view for non-holders
- [ ] Holders-only profile shows full view for holders
- [ ] Private profile shows "Private Profile" message
- [ ] Online status hidden when privacy restricts
- [ ] Online status shown when allowed
- [ ] Message button disabled for restricted users
- [ ] Privacy badge displays correct icon and text

### MessageThread Privacy
- [ ] Online badge shown when allowed
- [ ] Online badge hidden when restricted
- [ ] "Online/Offline" text shown when allowed
- [ ] Status text empty when restricted
- [ ] Avatar still shown (with or without badge)
- [ ] Message input works when allowed
- [ ] Message input blocked when restricted
- [ ] Error messages display correctly

### ConversationList Privacy
- [ ] Online badges for holders (when viewer is holder)
- [ ] No badges for holders (when viewer isn't holder)
- [ ] Offline badges shown when status visible
- [ ] Conversation still listed (privacy only affects new interactions)
- [ ] Avatar display works with/without badge
- [ ] Unread counts still shown
- [ ] Last message preview still shown

### Messaging Privacy
- [ ] Public users can be messaged by anyone
- [ ] Holders-only users can be messaged by holders
- [ ] Holders-only users block non-holders
- [ ] Private users block everyone
- [ ] Error messages are clear and helpful
- [ ] Rate limiting still works
- [ ] Typing indicators respect privacy
- [ ] Message delivery respects privacy

### Token Holder Verification
- [ ] Common holdings detected correctly
- [ ] Project-specific holdings detected
- [ ] Cache works (repeated checks are fast)
- [ ] Cache expires after 5 minutes
- [ ] Handles no token holdings gracefully
- [ ] Handles multiple projects correctly
- [ ] Performance is acceptable (<500ms)

## Browser Testing Steps

### Setup
```bash
# Start development server
npm run dev
```

### Manual Test Flow
1. **Open two browser windows/profiles**
   - Window 1: User A (profile owner)
   - Window 2: User B (visitor)

2. **Connect wallets**
   - Window 1: Connect Wallet A
   - Window 2: Connect Wallet B

3. **Set privacy level (Window 1)**
   - Go to `/profile/settings`
   - Change privacy level
   - Change allow_messages_from
   - Save settings

4. **Test profile view (Window 2)**
   - Navigate to User A's profile
   - Check visibility
   - Check online status
   - Try messaging

5. **Test conversations (Both windows)**
   - Create conversation
   - Send messages
   - Check online status
   - Test restrictions

6. **Verify edge cases**
   - No wallet connected
   - Same wallet viewing own profile
   - Token balance changes
   - Cache expiry

## Common Issues & Solutions

### Issue: Profile always shows as public
**Solution**: Check database - ensure `privacy_level` column exists and is set correctly

### Issue: Cache doesn't expire
**Solution**: Wait full 5 minutes, or call `clearPrivacyCache()` manually

### Issue: Token holdings not detected
**Solution**: 
- Verify token mint address is correct
- Check `getWalletTokenData()` function
- Ensure RPC endpoint is working
- Check for API rate limits

### Issue: Online status always hidden
**Solution**: Verify `is_online` column in `user_profiles` is updating correctly

### Issue: Error "Cannot read property 'privacy_level'"
**Solution**: User profile doesn't exist - ensure profile is created on first login

## Performance Testing

### Load Test
1. **Profile Load Time**
   - Target: <2 seconds for initial load
   - Measure: Time from navigation to full render
   - Includes: Profile fetch + privacy check + token verification

2. **Cache Performance**
   - Target: <50ms for cached privacy checks
   - Measure: Second profile view within 5 minutes
   - Should skip token verification

3. **Conversation List**
   - Target: <3 seconds for 50 conversations
   - Measure: List render with privacy checks
   - Should batch token verification

### Optimization Opportunities
- Batch profile privacy checks
- Pre-fetch privacy settings
- Longer cache TTL for verified holders
- Background cache refresh

## Debugging Tools

### Check Privacy Settings
```javascript
// In browser console
const { data: profile } = await supabase
  .from('user_profiles')
  .select('privacy_level, allow_messages_from')
  .eq('wallet_address', 'USER_WALLET')
  .single()

console.log('Privacy Settings:', profile)
```

### Check Token Holdings
```javascript
// In browser console
const holdings = await hasCommonTokenHoldings(
  'VIEWER_WALLET',
  'TARGET_WALLET'
)
console.log('Has Common Holdings:', holdings)
```

### Clear Cache
```javascript
// In browser console
clearPrivacyCache()
console.log('Privacy cache cleared')
```

### Monitor Cache
```javascript
// Add to privacy.ts for debugging
console.log('Cache size:', holderCache.size)
console.log('Cache entries:', Array.from(holderCache.entries()))
```

## Success Criteria

### Functional
- ✅ All 7 test scenarios pass
- ✅ No console errors
- ✅ Appropriate messages shown
- ✅ Privacy respected throughout app

### Performance
- ✅ Profile loads in <2 seconds
- ✅ Cached checks in <50ms
- ✅ No UI blocking/freezing

### User Experience
- ✅ Clear feedback for restricted access
- ✅ Helpful error messages
- ✅ Consistent behavior across components
- ✅ Smooth transitions between states

---

**Testing Date**: November 23, 2025  
**Tester**: _______________  
**Results**: _______________  
**Notes**: _______________


















