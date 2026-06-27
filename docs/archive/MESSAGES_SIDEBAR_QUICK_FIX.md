# Messages Sidebar - Quick Fix Guide

## Current Problem
The MessagesSidebar.tsx file has JSX structure errors due to incomplete removal of the section toggle feature.

## Quick Fix

The file currently has errors because we removed the `activeSection` state and section toggle but left broken JSX structure.

### Simple Solution

**Option 1: Revert the MessagesSidebar changes**
```bash
git checkout HEAD -- components/MessagesSidebar.tsx
```

Then we can implement the Asset Reviews feature properly as a conversation list item (like Project Submissions).

**Option 2: Manual Fix**

The core issue is that we need to:
1. Keep the notification system changes (those are good)
2. Just remove the section toggle UI properly without breaking JSX

## The Right Implementation

Asset Reviews should appear in the conversation list, not as a toggle. Here's the clean implementation:

### 1. Keep MessagesSidebar.tsx Simple
- No section toggles
- Pass asset review props to ConversationList
- ConversationList handles showing the "Asset Reviews" item

### 2. Update ConversationList.tsx to show Asset Reviews
Add these props and render an Asset Reviews item at the top of the list (similar to how Project Submissions work).

## Recommended Action

Since the file is in a broken state, the cleanest approach is:

1. **Revert MessagesSidebar.tsx:**
   ```bash
   git checkout HEAD -- components/MessagesSidebar.tsx
   ```

2. **Keep the notification fixes** in:
   - `lib/notifications/social-asset-notifications.ts`
   - `components/admin/SocialAssetFeed.tsx`
   - `lib/feed-queries-social-assets.ts`

3. **Implement Asset Reviews properly** by:
   - Adding props to `ConversationList` to show Asset Reviews
   - Making it appear as a special list item (like Project Submissions)
   - No section toggles needed

Would you like me to implement this clean approach?


