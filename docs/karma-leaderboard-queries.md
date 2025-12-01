# Karma Leaderboard - Frontend Query Examples

## Quick Start

The karma leaderboard uses two main views:
- **`global_karma_leaderboard`** - Platform-wide rankings (recommended)
- **`karma_leaderboard`** - All karma data (filter by project_id if needed)

## Common Queries

### 1. Get Top 10 Users (Global Leaderboard)

```typescript
const { data: topUsers, error } = await supabase
  .from('global_karma_leaderboard')
  .select('*')
  .limit(10);

// Returns:
// [
//   {
//     id: "uuid",
//     wallet_address: "Alice...",
//     username: "alice.sol",
//     avatar_url: "https://...",
//     total_karma: 2450,
//     completed_jobs: 27,
//     tips_sent_count: 45,
//     tips_received_count: 68,
//     last_active_at: "2025-12-01T13:57:12.449381"
//   },
//   ...
// ]
```

### 2. Get User's Rank and Stats

```typescript
// Find user's position in leaderboard
const { data: userRank, error } = await supabase
  .from('global_karma_leaderboard')
  .select('*')
  .eq('wallet_address', userWalletAddress)
  .single();

// Calculate rank by counting users with higher karma
const { count: higherRankedUsers } = await supabase
  .from('global_karma_leaderboard')
  .select('*', { count: 'exact', head: true })
  .gt('total_karma', userRank.total_karma);

const userRankPosition = higherRankedUsers + 1;
```

### 3. Paginated Leaderboard (Load More)

```typescript
const PAGE_SIZE = 20;
const page = 0; // 0-indexed

const { data: leaderboard, error } = await supabase
  .from('global_karma_leaderboard')
  .select('*')
  .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
```

### 4. Get Total User Count

```typescript
const { count: totalUsers, error } = await supabase
  .from('global_karma_leaderboard')
  .select('*', { count: 'exact', head: true });

console.log(`Total users: ${totalUsers}`);
```

### 5. Project-Specific Leaderboard

```typescript
const projectId = 'your-project-uuid';

const { data: projectLeaderboard, error } = await supabase
  .from('karma_leaderboard')
  .select('*')
  .eq('project_id', projectId)
  .limit(10);
```

### 6. Get Users Above Certain Karma Threshold

```typescript
const { data: topContributors, error } = await supabase
  .from('global_karma_leaderboard')
  .select('*')
  .gte('total_karma', 1000)
  .order('total_karma', { ascending: false });
```

### 7. Search Users by Username

```typescript
const searchTerm = 'alice';

const { data: searchResults, error } = await supabase
  .from('global_karma_leaderboard')
  .select('*')
  .ilike('username', `%${searchTerm}%`)
  .order('total_karma', { ascending: false })
  .limit(10);
```

### 8. Get Users with Most Activity (Not Just Karma)

```typescript
const { data: mostActive, error } = await supabase
  .from('global_karma_leaderboard')
  .select('*')
  .order('completed_jobs', { ascending: false })
  .limit(10);
```

### 9. Get Recent Active Users

```typescript
const { data: recentlyActive, error } = await supabase
  .from('global_karma_leaderboard')
  .select('*')
  .not('last_active_at', 'is', null)
  .order('last_active_at', { ascending: false })
  .limit(10);
```

## Real-Time Updates

### Subscribe to Leaderboard Changes

```typescript
// Subscribe to wallet_karma changes
const subscription = supabase
  .channel('leaderboard-updates')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'wallet_karma',
      filter: 'project_id=is.null' // Only global karma
    },
    (payload) => {
      console.log('Karma updated:', payload);
      // Refresh leaderboard
      refetchLeaderboard();
    }
  )
  .subscribe();

// Cleanup
subscription.unsubscribe();
```

## Display Examples

### React Component Example

```tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { GlobalLeaderboardEntry } from '@/types/karma-leaderboard';

export function KarmaLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<GlobalLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      const { data, error } = await supabase
        .from('global_karma_leaderboard')
        .select('*')
        .limit(10);

      if (data) setLeaderboard(data);
      setLoading(false);
    }

    fetchLeaderboard();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="leaderboard">
      <h2>Top Contributors</h2>
      <ol>
        {leaderboard.map((user, index) => (
          <li key={user.id}>
            <div className="rank">#{index + 1}</div>
            <img 
              src={user.avatar_url || '/default-avatar.png'} 
              alt={user.username || 'Anonymous'}
            />
            <div className="details">
              <div className="username">
                {user.username || truncateAddress(user.wallet_address)}
              </div>
              <div className="karma">{user.total_karma.toLocaleString()} karma</div>
              <div className="stats">
                {user.completed_jobs} activities · 
                {user.tips_received_count} tips received
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function truncateAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
```

### User Rank Badge Component

```tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWallet } from '@solana/wallet-adapter-react';

export function UserRankBadge() {
  const { publicKey } = useWallet();
  const [rank, setRank] = useState<number | null>(null);
  const [karma, setKarma] = useState<number>(0);

  useEffect(() => {
    if (!publicKey) return;

    async function fetchUserRank() {
      const walletAddress = publicKey.toBase58();
      
      // Get user's karma
      const { data: userData } = await supabase
        .from('global_karma_leaderboard')
        .select('total_karma')
        .eq('wallet_address', walletAddress)
        .single();

      if (!userData) return;
      
      setKarma(userData.total_karma);

      // Count users with higher karma
      const { count } = await supabase
        .from('global_karma_leaderboard')
        .select('*', { count: 'exact', head: true })
        .gt('total_karma', userData.total_karma);

      setRank((count || 0) + 1);
    }

    fetchUserRank();
  }, [publicKey]);

  if (!rank) return null;

  return (
    <div className="rank-badge">
      <span className="rank">#{rank}</span>
      <span className="karma">{karma.toLocaleString()}</span>
    </div>
  );
}
```

## Performance Tips

1. **Use Pagination**: Don't load all users at once
2. **Cache Results**: Cache leaderboard data for 30-60 seconds
3. **Limit Fields**: Only select fields you need:
   ```typescript
   .select('username, total_karma, avatar_url')
   ```
4. **Use Indexes**: The database has optimized indexes for fast queries
5. **Debounce Search**: Debounce username search input

## Data Refresh Strategy

- **Initial Load**: Fetch top 10-20 users
- **User Rank**: Fetch only when user connects wallet
- **Real-time**: Subscribe to changes for live updates
- **Pagination**: Load more on scroll/button click
- **Cache**: Use SWR or React Query with 30s stale time

## Error Handling

```typescript
const { data, error } = await supabase
  .from('global_karma_leaderboard')
  .select('*')
  .limit(10);

if (error) {
  console.error('Failed to load leaderboard:', error);
  // Show error message to user
  return;
}

if (!data || data.length === 0) {
  // Show empty state
  return <EmptyLeaderboard />;
}

// Render leaderboard
```

## Notes

- All karma values are **integers** (no decimals)
- Banned users are automatically excluded
- Users without `username` should fall back to showing wallet address
- Users without `avatar_url` should show default avatar
- `last_active_at` can be null for inactive users
- Leaderboard is **public** - no authentication required


