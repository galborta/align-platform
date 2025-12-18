# Messaging Performance Optimization - Integration Guide

## Quick Start

### Step 1: Add ProfileCacheProvider to Layout

Update `components/LayoutClient.tsx`:

```tsx
import { ProfileCacheProvider } from '@/lib/ProfileCacheContext'

export function LayoutClient({ children }: { children: ReactNode }) {
  const wallet = useWallet()
  
  usePresenceTracking(wallet.publicKey?.toBase58())
  
  return (
    <ProfileCacheProvider>
      <MessagingProvider currentWallet={wallet.publicKey?.toBase58()}>
        {children}
        <MessagesSidebarWrapper />
      </MessagingProvider>
    </ProfileCacheProvider>
  )
}
```

### Step 2: Use OptimizedAvatar Everywhere

Replace all Avatar components:

```tsx
// Before
import { Avatar } from '@mui/material'
<Avatar src={profile?.avatar_url} sx={{ width: 48, height: 48 }} />

// After
import { OptimizedAvatar } from '@/components/OptimizedAvatar'
<OptimizedAvatar src={profile?.avatar_url} size={48} />
```

**Files to update:**
- `components/MessageThread.tsx` ✅ (done)
- `components/ConversationList.tsx` ✅ (done)
- `components/UserProfileView.tsx` (optional)
- `components/ProfileEditModal.tsx` (optional)

### Step 3: Clear Cache on Wallet Disconnect

Update wallet disconnect handler:

```tsx
import { clearAllCaches } from '@/lib/cache'
import { useProfileCache } from '@/lib/ProfileCacheContext'

// In your wallet disconnect handler
const handleDisconnect = () => {
  clearAllCaches()
  profileCache.clearCache()
  // ... rest of disconnect logic
}
```

### Step 4: Update Token Balance Caching

Replace direct calls with cached versions:

```tsx
// Before
import { getWalletTokenData } from '@/lib/token-balance'
const data = await getWalletTokenData(wallet, mint)

// After
import { getCachedTokenData } from '@/lib/token-balance'
const data = await getCachedTokenData(wallet, mint)
```

### Step 5: Restart Development Server

The changes require a server restart for Next.js image configuration:

```bash
npm run dev
```

---

## Verification Checklist

### ✅ Test Conversation List Performance

1. Open messages sidebar
2. Should load < 500ms for 20 conversations
3. Click "Load more" - should load next 20 instantly
4. Check browser DevTools Network tab - should see batched queries

### ✅ Test Message Pagination

1. Open a conversation with 100+ messages
2. Scroll to top
3. Click "Load older messages"
4. Should load instantly with cursor-based pagination
5. Check Network tab - should query with `lt` filter, not `range`

### ✅ Test Profile Caching

1. Open a user profile
2. Close and reopen immediately
3. Second load should be instant (< 1ms)
4. Console log: `Profile loaded from cache`

### ✅ Test Image Lazy Loading

1. Open messages sidebar with many conversations
2. Open DevTools Network tab
3. Scroll down slowly
4. Images should load as they come into view (not all at once)
5. Images should be WebP format

### ✅ Test Real-Time Subscription Cleanup

1. Open conversation A
2. Switch to conversation B
3. Open browser console
4. Should see channel cleanup logs
5. Check Supabase Dashboard - should show 1-2 active channels, not 5+

### ✅ Test Cache Invalidation

1. Update your profile
2. Cache should auto-invalidate
3. Profile should show new data immediately

---

## Performance Monitoring

### Check Cache Hit Rates

Add to your component:

```tsx
useEffect(() => {
  console.log('📊 Cache Stats:')
  console.log('- Profile cache size:', profileCache.size())
  console.log('- Token cache size:', tokenHolderCache.size())
}, [])
```

### Monitor Database Query Count

In Supabase Dashboard:
1. Go to Database → Query Performance
2. Check "Most Frequent Queries"
3. Should see significant reduction in messaging queries

### Check Index Usage

Run in Supabase SQL Editor:

```sql
SELECT 
  schemaname,
  tablename, 
  indexname, 
  idx_scan as times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
  AND tablename IN ('messages', 'conversations', 'user_profiles')
ORDER BY idx_scan DESC;
```

---

## Common Issues & Solutions

### Issue: "Image hostname not configured"

**Solution:** Make sure `next.config.js` is updated and server is restarted:

```bash
npm run dev
```

### Issue: Profile cache not working

**Solution:** Ensure `ProfileCacheProvider` wraps your app:

```tsx
// Correct order:
<ProfileCacheProvider>
  <MessagingProvider>
    {children}
  </MessagingProvider>
</ProfileCacheProvider>
```

### Issue: Real-time subscriptions not cleaning up

**Solution:** Check channel refs are properly stored and cleaned:

```tsx
const channelRef = useRef<any>(null)

useEffect(() => {
  channelRef.current = supabase.channel(...)
  
  return () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }
  }
}, [deps])
```

### Issue: Cursor pagination not working

**Solution:** Ensure you're using `lt()` filter, not `range()`:

```tsx
// ❌ Wrong
.range(offset, offset + limit)

// ✅ Correct
.lt('created_at', cursor)
.limit(limit + 1)
```

---

## Rollback Plan

If optimizations cause issues:

### 1. Disable Profile Cache

Comment out in `LayoutClient.tsx`:

```tsx
// <ProfileCacheProvider>
  <MessagingProvider>
    {children}
  </MessagingProvider>
// </ProfileCacheProvider>
```

### 2. Revert to Offset Pagination

In `MessageThread.tsx`, change back to:

```tsx
.range(offset, offset + MESSAGES_PER_PAGE - 1)
```

### 3. Remove Database Indexes

Run in Supabase SQL Editor:

```sql
DROP INDEX IF EXISTS idx_messages_conversation_created;
DROP INDEX IF EXISTS idx_conversations_p1_last_message;
-- etc.
```

---

## Additional Optimizations (Optional)

### 1. Add Service Worker for Offline Caching

```tsx
// public/sw.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('align-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/globals.css',
        // Add static assets
      ])
    })
  )
})
```

### 2. Implement Virtual Scrolling

For very long message lists:

```tsx
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={600}
  itemCount={messages.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <MessageBubble message={messages[index]} />
    </div>
  )}
</FixedSizeList>
```

### 3. Add Request Coalescing

Prevent duplicate simultaneous requests:

```tsx
const pendingRequests = new Map<string, Promise<any>>()

export async function getProfileWithCoalescing(wallet: string) {
  const existing = pendingRequests.get(wallet)
  if (existing) return existing
  
  const promise = getProfile(wallet)
  pendingRequests.set(wallet, promise)
  
  const result = await promise
  pendingRequests.delete(wallet)
  
  return result
}
```

---

## Support

If you encounter issues:
1. Check browser console for errors
2. Check Supabase logs in dashboard
3. Verify all migrations ran successfully
4. Check cache sizes aren't growing unbounded

---

**Last Updated:** November 24, 2025  
**Status:** Ready for Production ✅















