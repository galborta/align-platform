# 🧪 How to Test Your New Profile Features

**Date**: November 23, 2025  
**Status**: Ready to Test!

---

## 🚀 Quick Start

1. **Start your dev server** (if not running):
   ```bash
   npm run dev
   ```

2. **Open your browser**:
   ```
   http://localhost:3000
   ```

3. **Connect your wallet** using the "Connect Wallet" button

4. **You should see a purple person icon (👤) appear next to your wallet button!**

---

## ✅ Test Checklist

### 1. Profile Dropdown Navigation

**Steps**:
1. ✅ Connect your wallet
2. ✅ Look for purple person icon (👤) in header
3. ✅ Click the person icon
4. ✅ Dropdown menu should appear with:
   - "View Profile"
   - "Settings"
5. ✅ Click "View Profile" → Should navigate to `/profile`
6. ✅ Click back, open menu again
7. ✅ Click "Settings" → Should navigate to `/profile/settings`

**Expected**:
- Purple icon appears only when wallet connected
- Dropdown opens on click
- Menu items navigate correctly
- Dropdown closes after selection
- Purple theme throughout

---

### 2. Profile Settings Page

**URL**: `http://localhost:3000/profile/settings`

**Steps**:
1. ✅ Navigate via dropdown or direct URL
2. ✅ Should see 3 tabs:
   - Profile
   - Privacy
   - Blocked Users

**Test Profile Tab**:
1. ✅ Click "Edit Profile" button
2. ✅ Modal should open with your current data
3. ✅ Try changing:
   - Display name
   - Bio
   - Avatar URL
   - Privacy level
   - Message permissions
4. ✅ Click "Save Changes"
5. ✅ Should see success toast
6. ✅ Modal closes
7. ✅ New data appears on page

**Test Privacy Tab**:
1. ✅ See two radio groups:
   - Profile Visibility
   - Message Permissions
2. ✅ Select different options
3. ✅ See live preview update
4. ✅ Click "Save Privacy Settings"
5. ✅ Should see success toast

**Test Blocked Users Tab**:
1. ✅ Should show "No blocked users" initially
2. ✅ (You can test blocking from UserProfileView)

---

### 3. View Profile Page

**URL**: `http://localhost:3000/profile`

**Steps**:
1. ✅ Navigate via dropdown
2. ✅ Should see your profile:
   - Wallet address
   - Display name (or "Not set")
   - Bio (or "Not set")
   - Avatar preview

**Note**: This is a simple view page created earlier. The settings page is more feature-rich!

---

### 4. UserProfileView Component (Fixed TODOs)

**To Test Block Functionality**:

You'll need to integrate UserProfileView somewhere (like in a community page). For now, here's what was fixed:

**What Changed**:
1. ✅ Added `currentUserWallet` prop
2. ✅ Implemented block functionality
3. ✅ Added dynamic tier badge calculation

**When you use UserProfileView**:
```typescript
<UserProfileView
  walletAddress="some-user-wallet"
  currentUserWallet={wallet?.publicKey?.toString()}
  projectId="project-id"
  onClose={() => setShowProfile(false)}
  onMessage={(wallet) => console.log('Message', wallet)}
/>
```

**Features to Test**:
- ✅ Message button checks permissions (uses currentUserWallet)
- ✅ Block button works (inserts into blocked_users table)
- ✅ Tier badge shows MEGA/WHALE/HOLDER/SMALL based on token %
- ✅ Loading state while calculating tier

---

## 🎯 What to Look For

### Visual Checks

**Header**:
```
✅ Purple person icon appears (when connected)
✅ Icon is to the left of wallet button
✅ Icon has hover effect (light purple bg)
```

**Dropdown Menu**:
```
✅ Opens below icon
✅ Has 2 options with icons
✅ Hover effect on items (light purple)
✅ Closes when clicking outside
```

**Settings Page**:
```
✅ Three tabs with icons
✅ Purple accent color throughout
✅ Back button in header
✅ Wallet address chip in header
```

---

## 🐛 Common Issues & Fixes

### Issue: Profile icon doesn't appear
**Fix**: Make sure your wallet is connected. The icon only shows when `wallet?.publicKey` exists.

### Issue: Dropdown doesn't work
**Fix**: Check browser console for errors. Make sure Material UI is installed.

### Issue: Settings page shows "Loading forever"
**Fix**: Check that your wallet is connected. The page requires authentication.

### Issue: Profile edit modal doesn't save
**Fix**: Check browser console. Verify Supabase connection and RLS policies.

### Issue: Tier badge shows wrong tier
**Fix**: Verify projectId is provided and project has a token_mint. Check token balance calculation.

---

## 📸 Expected Screenshots

### 1. Header with Profile Icon
```
┌─────────────────────────────────────────┐
│  Align          👤  [7xKX...f456]      │
└─────────────────────────────────────────┘
                  ↑ Purple icon
```

### 2. Dropdown Open
```
┌─────────────────────────────────────────┐
│  Align          👤  [7xKX...f456]      │
│              ┌─────────────────┐       │
│              │ 👤 View Profile │       │
│              │ ⚙️  Settings    │       │
│              └─────────────────┘       │
└─────────────────────────────────────────┘
```

### 3. Settings Page
```
┌─────────────────────────────────────────┐
│ ← Profile Settings     7xKX...f456     │
├─────────────────────────────────────────┤
│ 👤 Profile | 👁️ Privacy | 🚫 Blocked  │
│     ═══                                 │
├─────────────────────────────────────────┤
│  Profile Information   [Edit Profile]  │
│                                         │
│  Wallet Address                        │
│  7xKXtg2C...                           │
│                                         │
│  Display Name                          │
│  Not set                               │
└─────────────────────────────────────────┘
```

---

## 🎉 Success Criteria

You're all set if you can:

- ✅ See purple profile icon when wallet connected
- ✅ Open dropdown menu
- ✅ Navigate to "View Profile"
- ✅ Navigate to "Settings"
- ✅ Edit profile via modal
- ✅ Change privacy settings
- ✅ See blocked users tab

---

## 📝 Quick Commands

```bash
# Start dev server
npm run dev

# Check for errors
npm run build

# View in browser
open http://localhost:3000
```

---

## 🆘 Need Help?

**Check Files**:
- `/TODOS_COMPLETE.md` - What was changed
- `/PROFILE_SETTINGS_PAGE_COMPLETE.md` - Settings page docs
- `/PROFILE_DROPDOWN_VISUAL.md` - Visual guide
- `/USER_PROFILE_VIEW_COMPLETE.md` - UserProfileView docs

**Browser Console**:
- Open DevTools (F12)
- Look for errors in Console tab
- Check Network tab for failed requests

---

## 🚀 Ready to Test!

1. Connect wallet
2. Click purple icon
3. Explore your profile!

Have fun testing! 🎉



