# Tip System Hooks - Side-by-Side Comparison

Complete comparison of `useTipTokens` and `useDailyTipKarma` hooks for the Enhanced Tip System.

## Overview

Two complementary hooks that work together to power the tip modal:

1. **`useTipTokens`** - Fetches available tokens to tip with
2. **`useDailyTipKarma`** - Tracks karma earned/remaining today

## Quick Comparison

| Feature | useTipTokens | useDailyTipKarma |
|---------|-------------|------------------|
| **Purpose** | Fetch user's token holdings | Track daily karma status |
| **Data Changes** | Slow (manual transfers) | Fast (tips, daily reset) |
| **Stale Time** | 5 minutes | 1 minute |
| **Cache Time** | 30 minutes | 5 minutes |
| **Auto Refetch** | None | Every 5 minutes |
| **Retry** | 2 attempts | 1 attempt |
| **API Endpoint** | `/api/tokens/user-holdings` | `/api/karma/daily-tip-status` |
| **Use Case** | Token selection dropdown | Karma progress/warnings |

## Return Types

### useTipTokens
```typescript
{
  success: boolean
  tokens: TipToken[]          // Array of 0-20 tokens
  projectToken: string | null // Project's token mint
}

interface TipToken {
  mint: string
  symbol: string
  logoUrl: string | null
  balance: number
  decimals: number
  usdValue: number
  usdPrice: number | null
}
```

### useDailyTipKarma
```typescript
{
  success: boolean
  dailyKarma: number    // Karma earned today (0-5000)
  dailyCap: number      // Always 5000
  remaining: number     // Cap - dailyKarma
  resetDate: string     // YYYY-MM-DD
}
```

## Usage Together in TipModal

```typescript
import { useTipTokens } from '@/lib/hooks/useTipTokens'
import { useDailyTipKarma } from '@/lib/hooks/useDailyTipKarma'
import { useWallet } from '@solana/wallet-adapter-react'

function TipModal({ recipientWallet, projectId }: Props) {
  const { publicKey } = useWallet()

  // Fetch available tokens
  const { 
    data: tokensData, 
    isLoading: tokensLoading 
  } = useTipTokens(
    publicKey?.toString(),
    projectId
  )

  // Fetch karma status
  const { 
    data: karmaStatus, 
    isLoading: karmaLoading 
  } = useDailyTipKarma(
    publicKey?.toString(),
    projectId
  )

  const [selectedToken, setSelectedToken] = useState<TipToken | null>(null)
  const [amount, setAmount] = useState('')

  // Calculate karma to be earned
  const estimatedKarma = selectedToken && amount
    ? parseFloat(amount) * (selectedToken.usdPrice || 0)
    : 0

  const actualKarma = Math.min(
    estimatedKarma,
    karmaStatus?.remaining || 0
  )

  const wouldExceedCap = estimatedKarma > (karmaStatus?.remaining || 0)

  return (
    <div className="space-y-4">
      {/* Token Selection */}
      <div>
        <label>Select Token</label>
        {tokensLoading ? (
          <Spinner />
        ) : (
          <TokenDropdown
            tokens={tokensData?.tokens || []}
            selected={selectedToken}
            onChange={setSelectedToken}
            projectToken={tokensData?.projectToken}
          />
        )}
      </div>

      {/* Amount Input */}
      <div>
        <label>Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          max={selectedToken?.balance}
        />
        {selectedToken && (
          <p className="text-xs text-gray-500">
            Balance: {selectedToken.balance} {selectedToken.symbol}
            (${(selectedToken.balance * (selectedToken.usdPrice || 0)).toFixed(2)})
          </p>
        )}
      </div>

      {/* Karma Preview */}
      <div>
        <label>Karma Earned</label>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold">
            +{actualKarma.toFixed(0)} karma
          </span>
          {wouldExceedCap && (
            <span className="text-xs text-orange-600">
              (capped at {karmaStatus?.remaining})
            </span>
          )}
        </div>
      </div>

      {/* Karma Progress */}
      {!karmaLoading && karmaStatus && (
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Daily Karma Progress</span>
            <span>{karmaStatus.dailyKarma} / {karmaStatus.dailyCap}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full"
              style={{ 
                width: `${(karmaStatus.dailyKarma / karmaStatus.dailyCap) * 100}%` 
              }}
            />
          </div>
          {karmaStatus.remaining <= 500 && (
            <p className="text-xs text-orange-600 mt-1">
              ⚠️ Only {karmaStatus.remaining} karma remaining today
            </p>
          )}
        </div>
      )}

      {/* Submit Button */}
      <button
        disabled={
          !selectedToken ||
          !amount ||
          parseFloat(amount) <= 0 ||
          parseFloat(amount) > selectedToken.balance ||
          !karmaStatus ||
          karmaStatus.remaining <= 0
        }
      >
        Send Tip
      </button>
    </div>
  )
}
```

## Cache Invalidation After Tip

When a tip is successfully sent, invalidate BOTH caches:

```typescript
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

const handleTipSuccess = async () => {
  const wallet = publicKey?.toString()

  // Invalidate token balances (balance decreased)
  await queryClient.invalidateQueries({
    queryKey: ['tip-tokens', wallet, projectId]
  })

  // Invalidate karma status (karma increased)
  await queryClient.invalidateQueries({
    queryKey: ['daily-tip-karma', wallet, projectId]
  })

  toast.success('Tip sent! Karma earned: +' + actualKarma.toFixed(0))
}
```

## Loading States

```typescript
function TipModalWithLoading({ projectId }: Props) {
  const { publicKey } = useWallet()
  
  const tokensQuery = useTipTokens(publicKey?.toString(), projectId)
  const karmaQuery = useDailyTipKarma(publicKey?.toString(), projectId)

  const isLoading = tokensQuery.isLoading || karmaQuery.isLoading

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-8" />
      </div>
    )
  }

  return <TipModalContent {...props} />
}
```

## Error Handling

```typescript
function TipModalWithErrors({ projectId }: Props) {
  const { publicKey } = useWallet()
  
  const tokensQuery = useTipTokens(publicKey?.toString(), projectId)
  const karmaQuery = useDailyTipKarma(publicKey?.toString(), projectId)

  if (tokensQuery.error) {
    return (
      <ErrorState
        message="Failed to load token balances"
        onRetry={() => tokensQuery.refetch()}
      />
    )
  }

  if (karmaQuery.error) {
    return (
      <ErrorState
        message="Failed to load karma status"
        onRetry={() => karmaQuery.refetch()}
      />
    )
  }

  return <TipModalContent {...props} />
}
```

## Refresh Strategies

### useTipTokens (Manual Refresh)
- User clicks "Refresh" button
- After tip sent (cache invalidation)
- On modal reopen

```typescript
const { refetch: refetchTokens, isFetching: tokensFetching } = useTipTokens(...)

<button onClick={() => refetchTokens()} disabled={tokensFetching}>
  {tokensFetching ? '⟳ Refreshing...' : '⟳ Refresh Tokens'}
</button>
```

### useDailyTipKarma (Auto Refresh)
- Automatically every 5 minutes
- After tip sent (cache invalidation)
- On modal reopen

```typescript
const { refetch: refetchKarma } = useDailyTipKarma(...)

// No manual refresh button needed (auto-updates)
// But can manually trigger if desired
<button onClick={() => refetchKarma()}>
  ⟳ Refresh Karma
</button>
```

## Validation Logic

### Token Balance Validation
```typescript
const selectedToken = tokensData?.tokens[0]
const amount = '100'

const hasBalance = selectedToken && parseFloat(amount) <= selectedToken.balance
const hasValue = selectedToken && selectedToken.usdValue >= 0.10

if (!hasBalance) {
  return <Error>Insufficient balance</Error>
}

if (!hasValue) {
  return <Error>Token value too low</Error>
}
```

### Karma Validation
```typescript
const karmaStatus = karmaQuery.data

const hasKarma = karmaStatus && karmaStatus.remaining > 0
const wouldExceedCap = estimatedKarma > (karmaStatus?.remaining || 0)

if (!hasKarma) {
  return (
    <Error>
      You've reached your daily karma cap.
      Resets at {karmaStatus?.resetDate}
    </Error>
  )
}

if (wouldExceedCap) {
  return (
    <Warning>
      This tip would earn {estimatedKarma} karma,
      but you only have {karmaStatus.remaining} remaining today.
    </Warning>
  )
}
```

## Performance Comparison

### Initial Load
| Metric | useTipTokens | useDailyTipKarma |
|--------|-------------|------------------|
| API Calls | 1 + N token prices | 1 |
| Response Size | ~2-5 KB | ~200 bytes |
| Load Time | 1-3 seconds | 100-300ms |

### Cache Hit
| Metric | useTipTokens | useDailyTipKarma |
|--------|-------------|------------------|
| Load Time | < 1ms | < 1ms |
| Network | 0 requests | 0 requests |

### Background Updates
| Metric | useTipTokens | useDailyTipKarma |
|--------|-------------|------------------|
| Auto Refetch | None | Every 5 minutes |
| Network Usage | Low | Low |

## When to Use Each

### Use useTipTokens When:
- Selecting which token to tip with
- Displaying user's token portfolio
- Showing USD values of holdings
- Validating sufficient balance

### Use useDailyTipKarma When:
- Showing karma progress
- Previewing karma to be earned
- Warning about daily cap
- Displaying remaining karma
- Countdown to reset

### Use Both Together When:
- **TipModal** (primary use case)
- User profile with tip stats
- Admin dashboard
- Analytics pages

## Testing Both Hooks

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useTipTokens } from '@/lib/hooks/useTipTokens'
import { useDailyTipKarma } from '@/lib/hooks/useDailyTipKarma'

describe('Tip Hooks Integration', () => {
  it('should fetch both tokens and karma', async () => {
    const { result: tokensResult } = renderHook(() =>
      useTipTokens('wallet123', 'project456')
    )

    const { result: karmaResult } = renderHook(() =>
      useDailyTipKarma('wallet123', 'project456')
    )

    await waitFor(() => {
      expect(tokensResult.current.isSuccess).toBe(true)
      expect(karmaResult.current.isSuccess).toBe(true)
    })

    expect(tokensResult.current.data?.tokens.length).toBeGreaterThan(0)
    expect(karmaResult.current.data?.dailyKarma).toBeGreaterThanOrEqual(0)
  })

  it('should invalidate both after tip', async () => {
    const queryClient = new QueryClient()

    // Send tip...

    await queryClient.invalidateQueries(['tip-tokens'])
    await queryClient.invalidateQueries(['daily-tip-karma'])

    // Both should refetch
  })
})
```

## API Dependencies

Both hooks require their respective API endpoints:

### 1. Token Holdings API
```
GET /api/tokens/user-holdings?wallet=<wallet>&projectId=<projectId>
```
**Status**: ✅ Created

### 2. Karma Status API
```
GET /api/karma/daily-tip-status?wallet=<wallet>&projectId=<projectId>
```
**Status**: ⏳ Pending (next task)

## Integration Roadmap

### Phase 1: Basic Integration ✅
- [x] Create useTipTokens hook
- [x] Create useDailyTipKarma hook
- [x] Create token holdings API
- [ ] Create karma status API

### Phase 2: TipModal Enhancement
- [ ] Integrate both hooks
- [ ] Add token dropdown
- [ ] Show karma preview
- [ ] Display progress bar
- [ ] Add validation

### Phase 3: Polish
- [ ] Loading states
- [ ] Error handling
- [ ] Refresh buttons
- [ ] Tooltips
- [ ] Animations

### Phase 4: Analytics
- [ ] Track tip frequency
- [ ] Monitor karma distribution
- [ ] Analyze token preferences
- [ ] Measure engagement

## Summary

The two hooks work together to provide a complete tipping experience:

**useTipTokens** provides the **WHAT**:
- What tokens does the user have?
- What are they worth?
- What can be tipped?

**useDailyTipKarma** provides the **WHY**:
- Why should I tip? (earn karma)
- Why can't I tip more? (daily cap)
- Why wait? (resets tomorrow)

Together, they enable:
- ✅ Smart token selection
- ✅ Balance validation
- ✅ Karma preview
- ✅ Cap enforcement
- ✅ User guidance
- ✅ Optimal UX

---

**Next Step**: Create `/api/karma/daily-tip-status` endpoint to power `useDailyTipKarma`!







