# 🪝 useTipTokens Hook Documentation

**File**: `lib/hooks/useTipTokens.ts`  
**Status**: ✅ Complete  
**Dependencies**: `@tanstack/react-query`

---

## 📋 Overview

A custom React Query hook that fetches a user's SPL token holdings with real-time USD values from the `/api/tokens/user-holdings` endpoint.

**Features:**
- ✅ Automatic caching (5 minute freshness, 30 minute retention)
- ✅ Conditional fetching (only when wallet and projectId provided)
- ✅ Exponential backoff retry (2 retries with increasing delays)
- ✅ TypeScript type safety
- ✅ No window focus refetching

---

## 🔧 API

### Function Signature

```typescript
function useTipTokens(
  wallet: string | undefined,
  projectId: string | undefined
): UseQueryResult<TipTokensResponse>
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `wallet` | `string \| undefined` | Yes* | User's Solana wallet address |
| `projectId` | `string \| undefined` | Yes* | Project ID for token prioritization |

*Hook will not fetch if either is undefined

### Return Value

Returns a React Query result object:

```typescript
{
  data: TipTokensResponse | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
  // ... other React Query properties
}
```

### TipTokensResponse Type

```typescript
interface TipTokensResponse {
  success: boolean
  tokens: TipToken[]
  projectToken: string | null
}
```

---

## 💻 Usage

### Basic Example

```tsx
import { useTipTokens } from '@/lib/hooks/useTipTokens'
import { useWallet } from '@solana/wallet-adapter-react'

export function TokenSelector({ projectId }: { projectId: string }) {
  const { publicKey } = useWallet()
  const { data, isLoading, error } = useTipTokens(
    publicKey?.toString(),
    projectId
  )

  if (isLoading) return <div>Loading tokens...</div>
  if (error) return <div>Error loading tokens</div>

  const tokens = data?.tokens || []

  return (
    <select>
      {tokens.map(token => (
        <option key={token.mint} value={token.mint}>
          {token.symbol} - {token.balance.toFixed(4)} (${token.usdValue.toFixed(2)})
        </option>
      ))}
    </select>
  )
}
```

### Advanced Example with State

```tsx
import { useState } from 'react'
import { useTipTokens } from '@/lib/hooks/useTipTokens'
import { useWallet } from '@solana/wallet-adapter-react'
import { TipToken } from '@/types/database'

export function TipModal({ 
  recipientWallet, 
  projectId 
}: {
  recipientWallet: string
  projectId: string
}) {
  const { publicKey } = useWallet()
  const { data, isLoading, error, refetch } = useTipTokens(
    publicKey?.toString(),
    projectId
  )

  const [selectedToken, setSelectedToken] = useState<TipToken | null>(null)
  const [amount, setAmount] = useState('')

  // Auto-select first token (project token) when loaded
  useEffect(() => {
    if (data?.tokens && data.tokens.length > 0 && !selectedToken) {
      setSelectedToken(data.tokens[0])
    }
  }, [data, selectedToken])

  const handleRefresh = () => {
    refetch()
  }

  if (!publicKey) {
    return <div>Please connect your wallet</div>
  }

  if (isLoading) {
    return <div>Loading available tokens...</div>
  }

  if (error) {
    return (
      <div>
        <p>Failed to load tokens</p>
        <button onClick={handleRefresh}>Retry</button>
      </div>
    )
  }

  const tokens = data?.tokens || []

  if (tokens.length === 0) {
    return <div>No eligible tokens found (minimum $0.10 value required)</div>
  }

  const usdValue = selectedToken?.usdPrice 
    ? parseFloat(amount) * selectedToken.usdPrice 
    : null

  return (
    <div>
      <h2>Send Tip</h2>

      {/* Token Selector */}
      <select 
        value={selectedToken?.mint} 
        onChange={(e) => {
          const token = tokens.find(t => t.mint === e.target.value)
          setSelectedToken(token || null)
        }}
      >
        {tokens.map(token => (
          <option key={token.mint} value={token.mint}>
            {token.symbol} - {token.balance.toFixed(4)} (${token.usdValue.toFixed(2)})
          </option>
        ))}
      </select>

      {/* Amount Input */}
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        max={selectedToken?.balance}
      />

      {/* USD Preview */}
      {usdValue && (
        <p>≈ ${usdValue.toFixed(2)} USD</p>
      )}

      {/* Refresh Button */}
      <button onClick={handleRefresh}>
        🔄 Refresh Prices
      </button>

      <button onClick={handleSendTip}>
        Send {amount} {selectedToken?.symbol}
      </button>
    </div>
  )
}
```

---

## ⚙️ Configuration

### Query Key
```typescript
['tip-tokens', wallet, projectId]
```

Used for caching and invalidation. Unique per wallet + project combination.

### Cache Behavior

| Setting | Value | Description |
|---------|-------|-------------|
| `staleTime` | 5 minutes | Data considered fresh for 5 minutes |
| `cacheTime` | 30 minutes | Cache persists in memory for 30 minutes |
| `refetchOnWindowFocus` | false | Don't refetch when user returns to tab |
| `enabled` | `!!wallet && !!projectId` | Only fetch when both provided |
| `retry` | 2 | Retry failed requests twice |
| `retryDelay` | Exponential | 1s, 2s, 4s (capped at 30s) |

### Retry Logic

Exponential backoff with cap:
```typescript
retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
```

- Attempt 1: 1 second delay
- Attempt 2: 2 seconds delay
- Attempt 3+: 4+ seconds (capped at 30s)

---

## 🎯 Use Cases

### 1. TipModal Token Selection
Show user's available tokens for tipping with USD values

### 2. Portfolio Display
Display user's token holdings with real-time prices

### 3. Multi-Token Tip UI
Let users choose which token to send as a tip

### 4. Balance Checker
Verify user has sufficient balance before transactions

---

## 🔄 Cache Management

### Manual Refetch
```tsx
const { refetch } = useTipTokens(wallet, projectId)

// User clicks "Refresh prices"
<button onClick={() => refetch()}>Refresh</button>
```

### Invalidate Cache (Advanced)
```tsx
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

// Invalidate all tip-tokens queries
queryClient.invalidateQueries({ queryKey: ['tip-tokens'] })

// Invalidate specific wallet
queryClient.invalidateQueries({ 
  queryKey: ['tip-tokens', walletAddress] 
})

// Remove from cache entirely
queryClient.removeQueries({ queryKey: ['tip-tokens'] })
```

---

## 🎨 Integration Patterns

### Pattern 1: Auto-Select Project Token

```tsx
const { data } = useTipTokens(wallet, projectId)
const [selectedToken, setSelectedToken] = useState<TipToken | null>(null)

useEffect(() => {
  if (data?.tokens && data.tokens.length > 0) {
    // First token is always project token (if projectId provided)
    setSelectedToken(data.tokens[0])
  }
}, [data])
```

### Pattern 2: Check for Sufficient Balance

```tsx
const { data } = useTipTokens(wallet, projectId)
const [amount, setAmount] = useState('')
const [selectedToken, setSelectedToken] = useState<TipToken | null>(null)

const hasSufficientBalance = selectedToken 
  ? parseFloat(amount) <= selectedToken.balance
  : false

<button disabled={!hasSufficientBalance}>
  Send Tip
</button>
```

### Pattern 3: Loading Skeleton

```tsx
const { data, isLoading } = useTipTokens(wallet, projectId)

if (isLoading) {
  return (
    <div>
      <Skeleton width={200} height={40} />
      <Skeleton width={150} height={30} />
      <Skeleton width={180} height={30} />
    </div>
  )
}
```

### Pattern 4: Error Boundary

```tsx
import { ErrorBoundary } from 'react-error-boundary'

function TokenSelectorWithError() {
  const { data, error } = useTipTokens(wallet, projectId)

  if (error) throw error

  return <TokenSelector tokens={data?.tokens} />
}

<ErrorBoundary fallback={<div>Failed to load tokens</div>}>
  <TokenSelectorWithError />
</ErrorBoundary>
```

---

## 🚨 Error Handling

### Network Errors
```tsx
const { error, isError, refetch } = useTipTokens(wallet, projectId)

if (isError) {
  return (
    <Alert severity="error">
      <AlertTitle>Failed to load tokens</AlertTitle>
      {error?.message || 'Network error'}
      <Button onClick={() => refetch()}>Try Again</Button>
    </Alert>
  )
}
```

### Empty State
```tsx
const { data, isLoading } = useTipTokens(wallet, projectId)

if (!isLoading && (!data?.tokens || data.tokens.length === 0)) {
  return (
    <div>
      <p>No eligible tokens found</p>
      <p>Tokens must have a value of at least $0.10</p>
    </div>
  )
}
```

### Wallet Not Connected
```tsx
const { publicKey } = useWallet()
const { data } = useTipTokens(publicKey?.toString(), projectId)

if (!publicKey) {
  return <WalletConnectButton />
}
```

---

## ⚡ Performance

### Caching Benefits
- **First Load**: ~1-2 seconds (API call)
- **Cached Load**: Instant (< 1ms)
- **Stale Refetch**: Background update, shows cached data first

### Memory Usage
- Each query ~1-5 KB (depends on token count)
- Max 20 tokens per query
- Auto-cleanup after 30 minutes

### Network Optimization
- Deduplication: Multiple components using same query share one request
- Background refetch: Updates cache without blocking UI
- Retry with backoff: Prevents request spam on errors

---

## 🧪 Testing

### Test with Mock Data

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'

const mockTokens = [
  {
    mint: 'NUB123',
    symbol: 'NUB',
    balance: 100,
    usdValue: 50,
    usdPrice: 0.5,
    decimals: 9,
    logoUrl: null
  }
]

// Mock the API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({
      success: true,
      tokens: mockTokens,
      projectToken: 'NUB123'
    })
  })
) as jest.Mock

test('useTipTokens loads tokens', async () => {
  const queryClient = new QueryClient()
  
  const { result } = renderHook(
    () => useTipTokens('wallet123', 'project456'),
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )
    }
  )

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.tokens).toHaveLength(1)
})
```

---

## 📚 Related

**API Endpoint**: `app/api/tokens/user-holdings/route.ts`  
**Types**: `types/database.ts` (TipToken interface)  
**Components**: `components/TipModal.tsx` (primary consumer)  
**Documentation**: `API_TOKEN_HOLDINGS.md`

---

## ✅ Best Practices

### Do ✅
- Use the hook at component level (not in render functions)
- Check `isLoading` before rendering token data
- Handle error state with retry option
- Provide feedback during loading
- Use `refetch()` for manual refresh

### Don't ❌
- Don't call the hook conditionally
- Don't fetch without wallet/projectId
- Don't ignore error states
- Don't call API directly (use the hook)
- Don't forget to handle empty state

---

## 🎉 Summary

**What it does:**
- ✅ Fetches user's SPL tokens with USD values
- ✅ Caches for 5 minutes (fresh) / 30 minutes (stale)
- ✅ Retries failed requests automatically
- ✅ Only fetches when needed

**Benefits:**
- 🚀 Fast (uses React Query cache)
- 🔄 Automatic refetching
- 💪 Type-safe
- 🎯 Easy to use
- ⚡ Optimized performance

**Ready to use in TipModal and any component needing token selection!**

---

**Status**: ✅ **Production Ready**








