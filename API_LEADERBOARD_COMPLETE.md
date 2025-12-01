# ✅ Karma Leaderboard API - Complete Implementation

## Overview

Two production-ready API endpoints for fetching karma leaderboard data:
1. **`/api/leaderboard`** - Fetch top karma earners
2. **`/api/leaderboard/user-rank`** - Get specific user's rank and stats

---

## 📍 Endpoint 1: Leaderboard List

### **GET `/api/leaderboard`**

Fetches the top karma earners, sorted by total karma (highest first).

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | 10 | Number of users to return (max: 100) |
| `period` | string | No | 'all' | Time filter: 'day', 'week', 'month', 'all' |
| `projectId` | string | No | null | Filter by project ID (null = global leaderboard) |

### Response Format

```typescript
type LeaderboardResponse = LeaderboardEntry[]

interface LeaderboardEntry {
  id: string
  wallet_address: string
  username: string | null
  avatar_url: string | null
  total_karma: number
  completed_jobs: number
  tips_sent_count: number
  tips_received_count: number
  last_active_at: string | null
}
```

### Example Requests

```bash
# Get top 10 users (default)
curl http://localhost:3000/api/leaderboard

# Get top 5 users
curl http://localhost:3000/api/leaderboard?limit=5

# Get top 20 users from this week
curl http://localhost:3000/api/leaderboard?limit=20&period=week

# Get top 10 from specific project
curl http://localhost:3000/api/leaderboard?projectId=abc-123-def

# Get top 50 active in last 24 hours
curl http://localhost:3000/api/leaderboard?limit=50&period=day
```

### Example Response

```json
[
  {
    "id": "uuid-1",
    "wallet_address": "AliceTop1111111111111111111111111111111111111",
    "username": "alice.sol",
    "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
    "total_karma": 2450,
    "completed_jobs": 27,
    "tips_sent_count": 45,
    "tips_received_count": 68,
    "last_active_at": "2025-12-01T13:57:12.449381"
  },
  {
    "id": "uuid-2",
    "wallet_address": "BobSecond222222222222222222222222222222222222",
    "username": "bob.sol",
    "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=bob",
    "total_karma": 2100,
    "completed_jobs": 22,
    "tips_sent_count": 38,
    "tips_received_count": 52,
    "last_active_at": "2025-12-01T13:45:00.000000"
  }
]
```

### Error Handling

- **Empty Result**: Returns empty array `[]` with 200 status
- **Invalid Parameters**: Returns error message with 400 status
- **Server Error**: Returns empty array `[]` with 200 status (graceful degradation)

### Caching

```
Cache-Control: public, s-maxage=60, stale-while-revalidate=300
```

- **Fresh for**: 60 seconds
- **Stale revalidation**: 5 minutes
- **CDN/Edge cacheable**: Yes

---

## 📍 Endpoint 2: User Rank

### **GET `/api/leaderboard/user-rank`**

Fetches a specific user's rank, karma stats, and percentile.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `wallet` | string | **Yes** | - | User's wallet address |
| `projectId` | string | No | null | Project ID (null = global rank) |

### Response Format

```typescript
interface UserRankResponse {
  rank: number              // 1-based position (1 = top)
  total_karma: number       // Total karma points
  username: string | null   // Display name
  avatar_url: string | null // Profile image URL
  completed_jobs: number    // Number of activities
  tips_sent_count: number   // Tips sent
  tips_received_count: number // Tips received
  last_active_at: string | null // Last activity timestamp
  total_users: number       // Total users in leaderboard
  percentile: number        // 0-100 (100 = top 1%)
}
```

### Example Requests

```bash
# Get user's global rank
curl "http://localhost:3000/api/leaderboard/user-rank?wallet=AliceTop1111111111111111111111111111111111111"

# Get user's rank for specific project
curl "http://localhost:3000/api/leaderboard/user-rank?wallet=BobSecond222222222222222222222222222222222222&projectId=abc-123"
```

### Example Response

```json
{
  "rank": 1,
  "total_karma": 2450,
  "username": "alice.sol",
  "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
  "completed_jobs": 27,
  "tips_sent_count": 45,
  "tips_received_count": 68,
  "last_active_at": "2025-12-01T13:57:12.449381",
  "total_users": 11,
  "percentile": 100
}
```

### Error Responses

**User Not Found (404):**
```json
{
  "error": "User not found in leaderboard",
  "rank": null,
  "total_karma": 0,
  "username": null,
  "avatar_url": null,
  "completed_jobs": 0,
  "tips_sent_count": 0,
  "tips_received_count": 0,
  "last_active_at": null,
  "total_users": 0,
  "percentile": 0
}
```

**Missing Wallet (400):**
```json
{
  "error": "Wallet address is required"
}
```

### Caching

```
Cache-Control: public, s-maxage=30, stale-while-revalidate=120
```

- **Fresh for**: 30 seconds
- **Stale revalidation**: 2 minutes
- **CDN/Edge cacheable**: Yes

---

## 🔨 Frontend Integration

### React Hook Example

```typescript
// hooks/useLeaderboard.ts
import { useState, useEffect } from 'react'

interface LeaderboardEntry {
  id: string
  wallet_address: string
  username: string | null
  avatar_url: string | null
  total_karma: number
  completed_jobs: number
  tips_sent_count: number
  tips_received_count: number
  last_active_at: string | null
}

export function useLeaderboard(limit = 10, period = 'all') {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true)
        const params = new URLSearchParams({
          limit: limit.toString(),
          period
        })
        
        const response = await fetch(`/api/leaderboard?${params}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard')
        }
        
        const data = await response.json()
        setLeaderboard(data)
        setError(null)
      } catch (err) {
        console.error('Leaderboard fetch error:', err)
        setError('Failed to load leaderboard')
        setLeaderboard([])
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [limit, period])

  return { leaderboard, loading, error }
}
```

### User Rank Hook Example

```typescript
// hooks/useUserRank.ts
import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

interface UserRank {
  rank: number
  total_karma: number
  username: string | null
  avatar_url: string | null
  completed_jobs: number
  tips_sent_count: number
  tips_received_count: number
  last_active_at: string | null
  total_users: number
  percentile: number
}

export function useUserRank(projectId?: string) {
  const { publicKey } = useWallet()
  const [userRank, setUserRank] = useState<UserRank | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!publicKey) {
      setUserRank(null)
      setLoading(false)
      return
    }

    async function fetchUserRank() {
      try {
        setLoading(true)
        const wallet = publicKey!.toBase58()
        const params = new URLSearchParams({ wallet })
        
        if (projectId) {
          params.append('projectId', projectId)
        }
        
        const response = await fetch(`/api/leaderboard/user-rank?${params}`)
        
        if (response.status === 404) {
          // User not on leaderboard yet
          setUserRank(null)
          setError(null)
          return
        }
        
        if (!response.ok) {
          throw new Error('Failed to fetch user rank')
        }
        
        const data = await response.json()
        setUserRank(data)
        setError(null)
      } catch (err) {
        console.error('User rank fetch error:', err)
        setError('Failed to load rank')
        setUserRank(null)
      } finally {
        setLoading(false)
      }
    }

    fetchUserRank()
  }, [publicKey, projectId])

  return { userRank, loading, error }
}
```

### Component Example

```tsx
// components/KarmaLeaderboard.tsx
'use client'

import { useLeaderboard } from '@/hooks/useLeaderboard'
import { useState } from 'react'

export function KarmaLeaderboard() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'all'>('all')
  const { leaderboard, loading, error } = useLeaderboard(10, period)

  if (loading) {
    return <div>Loading leaderboard...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  if (leaderboard.length === 0) {
    return <div>No users on leaderboard yet.</div>
  }

  return (
    <div className="karma-leaderboard">
      <div className="filters">
        <button onClick={() => setPeriod('day')}>Today</button>
        <button onClick={() => setPeriod('week')}>This Week</button>
        <button onClick={() => setPeriod('month')}>This Month</button>
        <button onClick={() => setPeriod('all')}>All Time</button>
      </div>

      <ol className="leaderboard-list">
        {leaderboard.map((user, index) => (
          <li key={user.id} className="leaderboard-entry">
            <span className="rank">#{index + 1}</span>
            <img 
              src={user.avatar_url || '/default-avatar.png'} 
              alt={user.username || 'User'}
              className="avatar"
            />
            <div className="user-info">
              <div className="username">
                {user.username || truncateAddress(user.wallet_address)}
              </div>
              <div className="stats">
                {user.total_karma.toLocaleString()} karma · 
                {user.completed_jobs} activities
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function truncateAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}
```

---

## 🧪 Testing

### Manual Testing

```bash
# Start dev server
npm run dev

# Test leaderboard endpoint
curl http://localhost:3000/api/leaderboard

# Test with parameters
curl "http://localhost:3000/api/leaderboard?limit=5&period=week"

# Test user rank endpoint
curl "http://localhost:3000/api/leaderboard/user-rank?wallet=AliceTop1111111111111111111111111111111111111"

# Test invalid parameters
curl "http://localhost:3000/api/leaderboard?limit=invalid"
curl "http://localhost:3000/api/leaderboard?period=invalid"
curl "http://localhost:3000/api/leaderboard/user-rank"
```

### Expected Results

✅ **Successful Responses:**
- Status: 200
- Content-Type: application/json
- Cache-Control header present
- Data sorted by karma descending

✅ **Error Handling:**
- Invalid parameters return 400
- Missing required params return 400
- Database errors return empty array (graceful)
- User not found returns 404 with default values

---

## ⚡ Performance

### Response Times (Expected)

| Endpoint | Cached | Uncached | Notes |
|----------|--------|----------|-------|
| `/api/leaderboard` | < 5ms | < 50ms | Uses indexed views |
| `/api/leaderboard/user-rank` | < 5ms | < 100ms | Requires count queries |

### Optimization Features

- ✅ **Database Indexes**: Views use optimized indexes
- ✅ **Query Limits**: Max 100 users per request
- ✅ **Edge Caching**: CDN-friendly cache headers
- ✅ **Stale While Revalidate**: Serves stale data during refresh
- ✅ **Graceful Degradation**: Returns empty arrays on errors

### Caching Strategy

```
Endpoint                    Cache Duration    Stale While Revalidate
/api/leaderboard            60s              5 minutes
/api/leaderboard/user-rank  30s              2 minutes
```

**Recommendation**: Use SWR or React Query on frontend with matching cache times.

---

## 🔒 Security

### Input Validation

- ✅ Limit parameter capped at 100
- ✅ Period validated against whitelist
- ✅ SQL injection prevented (Supabase parameterized queries)
- ✅ No sensitive data exposed

### Rate Limiting

**Recommended** (not implemented):
- Add rate limiting middleware
- Limit: 100 requests per minute per IP
- Use Next.js middleware or edge function

### CORS

Default Next.js API routes allow same-origin only. For cross-origin access, add CORS headers.

---

## 📊 Monitoring

### Logs to Watch

```typescript
// Error logs
console.error('Leaderboard fetch error:', error)
console.error('Error in leaderboard endpoint:', error)
console.error('Error fetching user data:', userError)
```

### Metrics to Track

- Response times (p50, p95, p99)
- Error rates by endpoint
- Cache hit rates
- Most common limit values
- Period filter usage

---

## 🎯 Next Steps

1. **Add Rate Limiting** - Implement per-IP rate limits
2. **Add Analytics** - Track endpoint usage
3. **Add Pagination** - Support offset/cursor pagination for large lists
4. **Add Filtering** - Filter by username, karma range, etc.
5. **Add Sorting** - Support different sort orders (by tips, jobs, etc.)
6. **Add WebSocket** - Real-time leaderboard updates
7. **Add Export** - CSV/JSON export functionality

---

## 📦 Files Created

1. ✅ `/app/api/leaderboard/route.ts` - Main leaderboard endpoint
2. ✅ `/app/api/leaderboard/user-rank/route.ts` - User rank endpoint
3. ✅ `API_LEADERBOARD_COMPLETE.md` - This documentation

---

## ✅ Summary

**Status**: Production Ready ✓

**Features**:
- ✓ Top karma earners endpoint
- ✓ User-specific rank endpoint
- ✓ Time period filtering (day, week, month, all)
- ✓ Project-specific and global leaderboards
- ✓ Proper error handling
- ✓ Cache headers for performance
- ✓ TypeScript types
- ✓ Input validation
- ✓ Graceful degradation

**Ready for**: Frontend integration, production deployment


