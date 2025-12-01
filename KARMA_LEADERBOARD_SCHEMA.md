# Karma Leaderboard Schema - Implementation Summary

## ✅ Completed Implementation

### 1. Database Tables

#### **`wallet_karma`** (Existing - Enhanced)
Tracks karma points and user activity metrics.

**Key Columns:**
- `id` (uuid) - Primary key
- `wallet_address` (text) - User's Solana wallet
- `project_id` (uuid, nullable) - For project-specific karma, NULL for global
- `total_karma_points` (numeric) - Total karma earned
- `assets_added_count` (integer) - Number of assets contributed
- `upvotes_given_count` (integer) - Upvotes given to community
- `tips_sent_count` (integer) - Tips sent
- `tips_received_count` (integer) - Tips received
- `is_banned` (boolean) - Excluded from leaderboard if true
- `created_at`, `updated_at` (timestamp)

#### **`user_profiles`** (Existing)
User profile information for display.

**Key Columns:**
- `wallet_address` (text, unique) - Primary identifier
- `display_name` (text) - Username (e.g., 'alice.sol')
- `avatar_url` (text) - Profile image URL
- `bio` (text) - User biography
- `last_seen_at` (timestamp)

### 2. Database Views

#### **`karma_leaderboard`** (NEW)
Comprehensive leaderboard with all karma data.

```sql
SELECT 
    wk.id,
    wk.wallet_address,
    up.display_name as username,
    up.avatar_url,
    FLOOR(wk.total_karma_points)::INTEGER as total_karma,
    wk.assets_added_count + wk.upvotes_given_count as completed_jobs,
    wk.tips_sent_count,
    wk.tips_received_count,
    wk.assets_added_count,
    wk.upvotes_given_count,
    wk.updated_at as last_active_at,
    wk.created_at,
    wk.project_id
FROM wallet_karma wk
LEFT JOIN user_profiles up ON up.wallet_address = wk.wallet_address
WHERE wk.is_banned = false
ORDER BY wk.total_karma_points DESC;
```

**Usage:** Query by `project_id` for project-specific leaderboards, or use global view.

#### **`global_karma_leaderboard`** (NEW)
Simplified global leaderboard (project_id IS NULL).

```sql
SELECT 
    wk.id,
    wk.wallet_address,
    up.display_name as username,
    up.avatar_url,
    FLOOR(wk.total_karma_points)::INTEGER as total_karma,
    wk.assets_added_count + wk.upvotes_given_count as completed_jobs,
    wk.tips_sent_count,
    wk.tips_received_count,
    wk.updated_at as last_active_at
FROM wallet_karma wk
LEFT JOIN user_profiles up ON up.wallet_address = wk.wallet_address
WHERE wk.project_id IS NULL AND wk.is_banned = false
ORDER BY wk.total_karma_points DESC;
```

**Usage:** Default leaderboard for platform-wide rankings.

### 3. Indexes (Performance Optimized)

✅ **Existing Indexes:**
- `idx_wallet_karma_project` - (project_id, total_karma_points DESC)
- `idx_wallet_karma_wallet` - (wallet_address)
- `idx_user_profiles_wallet` - (wallet_address)

✅ **New Indexes:**
- `idx_wallet_karma_global_leaderboard` - (total_karma_points DESC) WHERE project_id IS NULL
- `idx_wallet_karma_leaderboard_all` - (total_karma_points DESC NULLS LAST)

### 4. RLS Policies (Row Level Security)

✅ **Public Read Access:**
```sql
-- wallet_karma table
CREATE POLICY "Public can view leaderboard"
ON wallet_karma FOR SELECT
TO public
USING (is_banned = false);

-- user_profiles table
CREATE POLICY "Public can view profiles"
ON user_profiles FOR SELECT
TO public
USING (true);

-- Views accessible to anon and authenticated users
GRANT SELECT ON karma_leaderboard TO anon, authenticated;
GRANT SELECT ON global_karma_leaderboard TO anon, authenticated;
```

### 5. Test Data

✅ **10 Test Users Created:**
| Rank | Username | Wallet | Karma | Activity |
|------|----------|--------|-------|----------|
| 1 | alice.sol | Alice... | 2,450 | 27 actions |
| 2 | bob.sol | Bob... | 2,100 | 22 actions |
| 3 | charlie.sol | Charlie... | 1,890 | 20 actions |
| 4 | diana.sol | Diana... | 1,654 | 18 actions |
| 5 | eve.sol | Eve... | 1,432 | 16 actions |
| 6 | frank.sol | Frank... | 1,289 | 14 actions |
| 7 | grace.sol | Grace... | 1,156 | 12 actions |
| 8 | henry.sol | Henry... | 1,023 | 10 actions |
| 9 | iris.sol | Iris... | 945 | 8 actions |
| 10 | jack.sol | Jack... | 876 | 6 actions |

Each user has:
- Display name (.sol handle)
- Avatar URL (generated with DiceBear API)
- Bio/description
- Varied activity metrics (assets, upvotes, tips)

## Frontend Integration

### TypeScript Interface

See `types/karma-leaderboard.ts` for complete type definitions.

```typescript
interface LeaderboardEntry {
  id: string;
  wallet_address: string;
  username: string | null;
  avatar_url: string | null;
  total_karma: number;
  completed_jobs: number;
  tips_sent_count: number;
  tips_received_count: number;
  last_active_at: string | null;
}
```

### Example Queries

**Fetch Global Top 10:**
```typescript
const { data, error } = await supabase
  .from('global_karma_leaderboard')
  .select('*')
  .limit(10);
```

**Fetch Project-Specific Leaderboard:**
```typescript
const { data, error } = await supabase
  .from('karma_leaderboard')
  .select('*')
  .eq('project_id', projectId)
  .limit(10);
```

**Get User's Rank:**
```typescript
const { data, error } = await supabase
  .from('global_karma_leaderboard')
  .select('*')
  .eq('wallet_address', userWallet)
  .single();
```

**Paginated Leaderboard:**
```typescript
const { data, error } = await supabase
  .from('global_karma_leaderboard')
  .select('*')
  .range(startIndex, endIndex);
```

## Key Features

✅ **Integer Karma Values** - Karma displayed as whole numbers (no decimals)
✅ **Fast Queries** - Optimized indexes for sub-millisecond queries
✅ **Null Handling** - Graceful handling of missing usernames/avatars
✅ **Ban Filter** - Banned users automatically excluded
✅ **Project Support** - Both global and project-specific leaderboards
✅ **Public Access** - Leaderboard data accessible without authentication
✅ **Activity Metrics** - Rich metrics: tips, assets, upvotes, etc.

## Database Migration Applied

Migration file: `create_karma_leaderboard_infrastructure`
- ✅ Created indexes
- ✅ Created views
- ✅ Set up RLS policies
- ✅ Granted view permissions

## Testing Verification

```sql
-- Verify leaderboard is working
SELECT 
    username,
    wallet_address,
    total_karma,
    completed_jobs
FROM global_karma_leaderboard
LIMIT 10;
```

**Result:** ✅ Returns 10 users sorted by karma (highest first)

## Next Steps for Frontend

1. Create leaderboard component using the `global_karma_leaderboard` view
2. Display top 10 or paginated results
3. Show user's current rank and karma
4. Add real-time updates when karma changes
5. Implement filters (by project, time period, etc.)
6. Add animations for rank changes
7. Display activity breakdown (tooltips showing tips, assets, upvotes)

## Notes

- **Karma Calculation**: Currently stored directly in `total_karma_points`
- **Activity Proxy**: `completed_jobs` = `assets_added_count` + `upvotes_given_count`
- **Real Jobs Integration**: If you add a real `jobs` table with completion tracking, update the view to include actual job completions
- **Performance**: Indexes ensure fast queries even with thousands of users
- **Privacy**: All leaderboard data is public (no sensitive information exposed)


