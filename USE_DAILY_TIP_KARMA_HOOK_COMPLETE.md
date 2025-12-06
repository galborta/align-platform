# ✅ useDailyTipKarma Hook - Complete

Real-time karma status hook with automatic refresh for the Enhanced Tip System.

## What Was Created

### 1. React Query Hook
**File**: `lib/hooks/useDailyTipKarma.ts` (47 lines)

```typescript
interface DailyKarmaResponse {
  success: boolean
  dailyKarma: number
  dailyCap: number
  remaining: number
  resetDate: string
}

export function useDailyTipKarma(
  wallet: string | undefined,
  projectId: string | undefined
)
```

### 2. Complete Documentation
**File**: `HOOK_USE_DAILY_TIP_KARMA.md` (600+ lines)

## Key Features

### ⚡ Real-Time Updates
- **1 minute stale time** - Fresh data after 1 minute
- **5 minute cache time** - Short-lived cache
- **Auto refetch every 5 minutes** - Background polling
- **1 retry max** - Fast failure feedback

### 📊 Karma Tracking
- Daily karma earned from tipping
- Daily cap (5000)
- Remaining karma allowance
- Reset date (midnight UTC)

### 🎯 Optimized for Fast-Changing Data
Unlike `useTipTokens` (5 min stale), this hook uses:
- Shorter cache times (karma changes frequently)
- Automatic polling (updates every 5 minutes)
- Minimal retry (faster errors)

## Usage Examples

### Basic Display
```typescript
const { data, isLoading, error } = useDailyTipKarma(
  publicKey?.toString(),
  projectId
)

return (
  <div>
    <p>Daily Karma: {data?.dailyKarma} / {data?.dailyCap}</p>
    <p>Remaining: {data?.remaining}</p>
  </div>
)
```

### Progress Bar
```typescript
const percentage = data 
  ? (data.dailyKarma / data.dailyCap) * 100 
  : 0

return (
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div 
      className="bg-blue-600 h-2 rounded-full"
      style={{ width: `${percentage}%` }}
    />
  </div>
)
```

### TipModal Integration
```typescript
const { data: karmaStatus } = useDailyTipKarma(
  publicKey?.toString(),
  projectId
)

const estimatedKarma = parseFloat(tipAmount) * usdPrice
const wouldExceedCap = karmaStatus && estimatedKarma > karmaStatus.remaining

return (
  <div>
    {wouldExceedCap && (
      <div className="text-orange-600">
        ⚠️ This tip would exceed your daily karma cap.
        You'll earn {karmaStatus.remaining} karma instead.
      </div>
    )}
  </div>
)
```

### Invalidate After Tip
```typescript
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

const handleTipSuccess = async () => {
  // Force immediate refetch
  await queryClient.invalidateQueries({
    queryKey: ['daily-tip-karma', publicKey?.toString(), projectId]
  })
}
```

## Cache Strategy

| Feature | Value | Reason |
|---------|-------|--------|
| Stale Time | 1 minute | Karma changes frequently |
| Cache Time | 5 minutes | Short-lived data |
| Refetch Interval | 5 minutes | Keep data current |
| Window Focus Refetch | false | Prevent excessive requests |
| Retry | 1 | Fast failure feedback |

## Comparison with useTipTokens

| Feature | useTipTokens | useDailyTipKarma |
|---------|-------------|------------------|
| **Data Type** | Token balances | Karma status |
| **Change Frequency** | Slow (manual transfers) | Fast (tips, daily reset) |
| **Stale Time** | 5 minutes | 1 minute |
| **Cache Time** | 30 minutes | 5 minutes |
| **Auto Refetch** | None | Every 5 minutes |
| **Retry** | 2 attempts | 1 attempt |

## Integration Points

### 1. TipModal (Primary)
- Show remaining karma
- Preview karma to be earned
- Warn when karma low
- Disable when no karma remaining

### 2. User Profile
- Display karma progress bar
- Show daily stats
- Countdown to reset

### 3. Activity Feed
- Show karma earned per tip
- Display daily totals
- Highlight achievements

## API Endpoint Required

The hook expects:

```
GET /api/karma/daily-tip-status?wallet=<wallet>&projectId=<projectId>
```

**Response:**
```json
{
  "success": true,
  "dailyKarma": 2350,
  "dailyCap": 5000,
  "remaining": 2650,
  "resetDate": "2024-11-26"
}
```

**Implementation Priority**: HIGH
This endpoint must be created before the hook can be used.

## Default Values

When wallet/projectId missing:
```typescript
{
  success: false,
  dailyKarma: 0,
  dailyCap: 5000,
  remaining: 5000,
  resetDate: '2024-11-26' // Today
}
```

Prevents crashes and allows graceful degradation.

## Files Created

1. ✅ `lib/hooks/useDailyTipKarma.ts` - Hook implementation (47 lines)
2. ✅ `HOOK_USE_DAILY_TIP_KARMA.md` - Complete documentation (600+ lines)
3. ✅ `USE_DAILY_TIP_KARMA_HOOK_COMPLETE.md` - This summary

## Quality Checklist

- ✅ No linter errors
- ✅ TypeScript type-safe
- ✅ React Query best practices
- ✅ Automatic polling
- ✅ Conditional fetching
- ✅ Default values
- ✅ Manual refetch support
- ✅ Cache invalidation
- ✅ Comprehensive documentation
- ✅ Integration examples

## Next Steps

### Immediate (Required)
1. **Create API endpoint**: `/api/karma/daily-tip-status`
   - Query `wallet_karma` table
   - Calculate remaining karma
   - Return response matching `DailyKarmaResponse` interface

### Week 1
1. Integrate into TipModal
   - Show karma progress bar
   - Display remaining karma
   - Preview karma to be earned
   - Warn when karma < 500
   - Disable tip when karma = 0

### Week 2
1. Add to user profile
   - Daily karma stats
   - Progress visualization
   - Countdown to reset
   - Karma history chart

### Week 3
1. Activity feed integration
   - Show karma earned per tip
   - Display daily totals
   - Highlight milestones (1000, 2500, 5000)

## Testing Scenarios

### 1. Auto Refetch
```typescript
// Should refetch every 5 minutes automatically
jest.advanceTimersByTime(5 * 60 * 1000)
```

### 2. Cache Invalidation
```typescript
// Should refetch immediately after tip sent
await queryClient.invalidateQueries(['daily-tip-karma'])
```

### 3. Conditional Fetching
```typescript
// Should not fetch without wallet
useDailyTipKarma(undefined, projectId)
// data.success === false
```

### 4. Daily Reset
```typescript
// Should show 0 karma at midnight UTC
// Should update resetDate to next day
```

## Performance Notes

### Network
- Background refetch every 5 minutes
- Lightweight response (5 fields)
- 1 retry max (fast failure)

### Memory
- Small cache footprint
- Auto cleanup after 5 minutes
- Shared cache per wallet+project

### Battery
- Refetch interval pauses when page hidden
- No window focus refetch
- Efficient polling

## Common Use Cases

### 1. Karma Cap Warning
```typescript
if (karmaStatus?.remaining <= 500) {
  return <Warning>Only {karmaStatus.remaining} karma left today!</Warning>
}
```

### 2. Tip Validation
```typescript
const canSendTip = karmaStatus && karmaStatus.remaining > 0
<button disabled={!canSendTip}>Send Tip</button>
```

### 3. Karma Preview
```typescript
const estimatedKarma = tipAmountUSD // 1 USD = 1 karma
const actualKarma = Math.min(estimatedKarma, karmaStatus?.remaining || 0)

return <span>You'll earn +{actualKarma} karma</span>
```

### 4. Progress Visualization
```typescript
const percentage = (karmaStatus.dailyKarma / karmaStatus.dailyCap) * 100
return <ProgressBar value={percentage} />
```

## Success Metrics

### Week 1
- [ ] API endpoint created and tested
- [ ] Hook integrated into TipModal
- [ ] Karma preview shows correct values
- [ ] Progress bar updates in real-time

### Week 2
- [ ] Users see karma warnings when low
- [ ] Tip button disables at 0 remaining
- [ ] Cache invalidation works after tips
- [ ] Auto refetch updates every 5 minutes

### Week 3
- [ ] Profile shows daily karma stats
- [ ] Activity feed displays karma earned
- [ ] Countdown to reset is accurate
- [ ] No performance issues with polling

## Documentation Includes

1. **API Reference** - Hook signature and types
2. **Usage Examples** - 6 real-world examples
3. **Integration Patterns** - TipModal, Profile, Feed
4. **Cache Strategy** - Detailed explanation
5. **Error Handling** - Loading, error, retry states
6. **Performance Notes** - Network, memory, battery
7. **Testing Guide** - Unit test examples
8. **Best Practices** - Do's and don'ts

---

## Summary

The `useDailyTipKarma` hook provides real-time karma status with:

- ✅ Automatic background refresh every 5 minutes
- ✅ Short cache optimized for fast-changing data
- ✅ Default values for graceful degradation
- ✅ Type-safe TypeScript interface
- ✅ React Query best practices
- ✅ Comprehensive documentation
- ✅ Integration examples

**Status**: 🟢 **Ready for API Endpoint**

Once `/api/karma/daily-tip-status` is created, this hook is production-ready!

---

**Created**: November 26, 2024  
**Linter Status**: ✅ No errors  
**Dependencies**: `@tanstack/react-query`  
**Related**: `useTipTokens`, Enhanced Tip System








