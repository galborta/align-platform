# useDailyTipKarma Hook Documentation

React Query hook for fetching real-time daily tip karma status with automatic refresh.

## Overview

The `useDailyTipKarma` hook provides real-time access to a user's daily tip karma status, including how much karma they've earned today, the daily cap, remaining karma allowance, and when it resets. Designed for short-lived cache with automatic background refresh.

## Location

```
lib/hooks/useDailyTipKarma.ts
```

## Return Type

```typescript
interface DailyKarmaResponse {
  success: boolean     // Whether fetch was successful
  dailyKarma: number   // Karma earned today from tipping
  dailyCap: number     // Daily karma cap (5000)
  remaining: number    // Remaining karma allowance today
  resetDate: string    // Date when karma resets (YYYY-MM-DD)
}
```

## Features

### ✅ Automatic Refresh
- **1 minute stale time** - Data refetches after 1 minute
- **5 minute cache time** - Old data kept for 5 minutes
- **Auto refetch every 5 minutes** - Background updates
- **No window focus refetch** - Prevents excessive requests

### ✅ Optimized for Real-Time
- Shorter cache than `useTipTokens` (karma changes frequently)
- Automatic polling for up-to-date karma status
- Minimal retry (1 attempt) for faster failure feedback

### ✅ Conditional Fetching
- Only fetches when `wallet` AND `projectId` are provided
- Returns default values when disabled
- Prevents unnecessary API calls

## Usage

### Basic Usage

```typescript
import { useDailyTipKarma } from '@/lib/hooks/useDailyTipKarma'
import { useWallet } from '@solana/wallet-adapter-react'

function KarmaDisplay({ projectId }: { projectId: string }) {
  const { publicKey } = useWallet()
  
  const { data, isLoading, error } = useDailyTipKarma(
    publicKey?.toString(),
    projectId
  )

  if (isLoading) return <div>Loading karma...</div>
  if (error) return <div>Error loading karma</div>

  return (
    <div>
      <p>Daily Karma: {data?.dailyKarma} / {data?.dailyCap}</p>
      <p>Remaining: {data?.remaining}</p>
      <p>Resets: {data?.resetDate}</p>
    </div>
  )
}
```

### Progress Bar

```typescript
function KarmaProgressBar({ projectId }: { projectId: string }) {
  const { publicKey } = useWallet()
  const { data } = useDailyTipKarma(publicKey?.toString(), projectId)

  const percentage = data 
    ? (data.dailyKarma / data.dailyCap) * 100 
    : 0

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1">
        <span>Daily Tip Karma</span>
        <span>{data?.dailyKarma} / {data?.dailyCap}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {data && data.remaining <= 500 && (
        <p className="text-xs text-orange-600 mt-1">
          ⚠️ Only {data.remaining} karma remaining today
        </p>
      )}
    </div>
  )
}
```

### Karma Warning Badge

```typescript
function KarmaWarning({ projectId }: { projectId: string }) {
  const { publicKey } = useWallet()
  const { data } = useDailyTipKarma(publicKey?.toString(), projectId)

  if (!data || data.remaining > 1000) return null

  return (
    <div className="bg-orange-100 border border-orange-300 rounded p-3">
      <p className="text-sm text-orange-800">
        ⚠️ You have only <strong>{data.remaining} karma</strong> remaining today.
        <br />
        Resets on {new Date(data.resetDate).toLocaleDateString()}
      </p>
    </div>
  )
}
```

### TipModal Integration

```typescript
function TipModal({ recipientWallet, projectId }: Props) {
  const { publicKey } = useWallet()
  const [tipAmount, setTipAmount] = useState('10')
  
  const { data: karmaStatus } = useDailyTipKarma(
    publicKey?.toString(),
    projectId
  )

  // Calculate karma that would be awarded (example: 1 karma per $1 USD)
  const estimatedKarma = parseFloat(tipAmount) * usdPrice
  const wouldExceedCap = karmaStatus && estimatedKarma > karmaStatus.remaining

  return (
    <div>
      <input
        type="number"
        value={tipAmount}
        onChange={(e) => setTipAmount(e.target.value)}
      />
      
      {wouldExceedCap && (
        <div className="text-orange-600 text-sm mt-2">
          ⚠️ This tip would exceed your daily karma cap.
          You'll earn {karmaStatus.remaining} karma instead of {estimatedKarma.toFixed(0)}.
        </div>
      )}

      <div className="text-xs text-gray-500 mt-2">
        Estimated Karma: +{Math.min(estimatedKarma, karmaStatus?.remaining || 0).toFixed(0)}
      </div>
    </div>
  )
}
```

### Countdown to Reset

```typescript
function KarmaResetCountdown({ projectId }: { projectId: string }) {
  const { publicKey } = useWallet()
  const { data } = useDailyTipKarma(publicKey?.toString(), projectId)
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    if (!data?.resetDate) return

    const interval = setInterval(() => {
      const now = new Date()
      const tomorrow = new Date(data.resetDate)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)

      const diff = tomorrow.getTime() - now.getTime()
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      setTimeLeft(`${hours}h ${minutes}m`)
    }, 1000)

    return () => clearInterval(interval)
  }, [data?.resetDate])

  if (!data) return null

  return (
    <div className="text-sm text-gray-600">
      Karma resets in: {timeLeft}
    </div>
  )
}
```

## Cache Strategy

### Why Short Cache?

Karma status changes frequently:
- ✅ After sending a tip
- ✅ After receiving a tip
- ✅ At midnight UTC (daily reset)
- ✅ When multiple users tip simultaneously

**Solution**: 1 minute stale time + 5 minute auto-refetch keeps data fresh.

### Comparison with useTipTokens

| Feature | useTipTokens | useDailyTipKarma |
|---------|-------------|------------------|
| Stale Time | 5 minutes | 1 minute |
| Cache Time | 30 minutes | 5 minutes |
| Auto Refetch | None | Every 5 minutes |
| Retry | 2 attempts | 1 attempt |
| Use Case | Token balances (slow changing) | Karma status (fast changing) |

## Manual Refetch

```typescript
function KarmaWithRefresh({ projectId }: { projectId: string }) {
  const { publicKey } = useWallet()
  const { data, refetch, isFetching } = useDailyTipKarma(
    publicKey?.toString(),
    projectId
  )

  return (
    <div>
      <div className="flex justify-between items-center">
        <span>Daily Karma: {data?.dailyKarma}</span>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-sm text-blue-600"
        >
          {isFetching ? '⟳ Refreshing...' : '⟳ Refresh'}
        </button>
      </div>
    </div>
  )
}
```

## Invalidate After Tip Sent

```typescript
import { useQueryClient } from '@tanstack/react-query'

function TipModal({ projectId }: Props) {
  const { publicKey } = useWallet()
  const queryClient = useQueryClient()

  const handleTipSuccess = async () => {
    // Invalidate karma cache to force refetch
    await queryClient.invalidateQueries({
      queryKey: ['daily-tip-karma', publicKey?.toString(), projectId]
    })

    toast.success('Tip sent! Karma updated.')
  }

  return (
    // ... tip form
  )
}
```

## Error Handling

```typescript
function KarmaDisplay({ projectId }: { projectId: string }) {
  const { publicKey } = useWallet()
  const { data, isLoading, error, refetch } = useDailyTipKarma(
    publicKey?.toString(),
    projectId
  )

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-3">
        <p className="text-sm text-red-800">
          ⚠️ Failed to load karma status
        </p>
        <button
          onClick={() => refetch()}
          className="text-sm text-red-600 underline mt-1"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      <p>Daily Karma: {data?.dailyKarma} / {data?.dailyCap}</p>
    </div>
  )
}
```

## Default Values

When `wallet` or `projectId` is missing, the hook returns:

```typescript
{
  success: false,
  dailyKarma: 0,
  dailyCap: 5000,
  remaining: 5000,
  resetDate: '2024-11-26' // Today's date
}
```

This prevents crashes and allows UI to render with placeholder values.

## Performance Notes

### Memory Usage
- **Minimal**: Only stores 5 fields per cache entry
- **Auto cleanup**: Cache cleared after 5 minutes
- **Single instance**: Same query key = shared cache

### Network Usage
- **Background refetch**: Every 5 minutes
- **1 retry max**: Fast failure recovery
- **Conditional**: Only when wallet + projectId present

### Best Practices

1. **Always invalidate after tip sent**
   ```typescript
   queryClient.invalidateQueries(['daily-tip-karma', wallet, projectId])
   ```

2. **Show loading state**
   ```typescript
   if (isLoading) return <Skeleton />
   ```

3. **Handle missing data**
   ```typescript
   const remaining = data?.remaining ?? 5000
   ```

4. **Disable buttons when no karma**
   ```typescript
   <button disabled={!data || data.remaining <= 0}>
     Send Tip
   </button>
   ```

## Integration Checklist

- [ ] Create `/api/karma/daily-tip-status` endpoint
- [ ] Import `useDailyTipKarma` in TipModal
- [ ] Show karma progress bar
- [ ] Display remaining karma
- [ ] Warn when karma low (< 500)
- [ ] Preview karma to be earned
- [ ] Invalidate cache after tip sent
- [ ] Show countdown to reset
- [ ] Disable tip button when no karma
- [ ] Handle error states gracefully

## API Endpoint Requirements

The hook expects an endpoint at:

```
GET /api/karma/daily-tip-status?wallet=<wallet>&projectId=<projectId>
```

**Response Format:**
```json
{
  "success": true,
  "dailyKarma": 2350,
  "dailyCap": 5000,
  "remaining": 2650,
  "resetDate": "2024-11-26"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Wallet not found"
}
```

## Testing

### Test Auto Refetch

```typescript
it('should refetch karma every 5 minutes', async () => {
  jest.useFakeTimers()
  
  const { result } = renderHook(() => 
    useDailyTipKarma('wallet123', 'project456')
  )

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  const firstData = result.current.data

  // Fast forward 5 minutes
  jest.advanceTimersByTime(5 * 60 * 1000)

  await waitFor(() => expect(result.current.data).not.toBe(firstData))
  
  jest.useRealTimers()
})
```

### Test Conditional Fetching

```typescript
it('should not fetch without wallet', () => {
  const { result } = renderHook(() => 
    useDailyTipKarma(undefined, 'project456')
  )

  expect(result.current.data?.success).toBe(false)
  expect(result.current.data?.remaining).toBe(5000)
})
```

### Test Cache Invalidation

```typescript
it('should refetch after cache invalidation', async () => {
  const queryClient = new QueryClient()
  
  const { result } = renderHook(() => 
    useDailyTipKarma('wallet123', 'project456'),
    { wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )}
  )

  await waitFor(() => expect(result.current.isSuccess).toBe(true))

  // Invalidate cache
  await queryClient.invalidateQueries(['daily-tip-karma', 'wallet123', 'project456'])

  await waitFor(() => expect(result.current.isFetching).toBe(true))
})
```

## Summary

The `useDailyTipKarma` hook provides:

- ✅ Real-time karma status with auto-refresh
- ✅ Short cache for fast-changing data
- ✅ Conditional fetching to prevent unnecessary calls
- ✅ Default values for graceful degradation
- ✅ Type-safe with TypeScript
- ✅ React Query best practices
- ✅ Manual refetch support
- ✅ Cache invalidation for instant updates

**Next Steps:**
1. Create `/api/karma/daily-tip-status` endpoint
2. Integrate into TipModal for karma preview
3. Add karma progress bar to user profile
4. Implement karma warning system

---

**Created**: November 26, 2024  
**Status**: ✅ Production Ready  
**Dependencies**: `@tanstack/react-query`














