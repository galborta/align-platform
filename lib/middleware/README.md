# API Middleware Utilities

Centralized middleware helpers for API route validation and authorization.

## 📁 Files

- `requireVerifiedWallet.ts` - Core verification checker
- `withVerifiedWallet.ts` - Convenience wrapper that returns NextResponse
- `index.ts` - Barrel export

---

## 🔧 `requireVerifiedWallet(walletAddress)`

Core function that checks if a wallet is verified in the database.

### Usage

```typescript
import { requireVerifiedWallet } from '@/lib/middleware'

export async function POST(request: Request) {
  const { wallet } = await request.json()
  
  const { verified, error } = await requireVerifiedWallet(wallet)
  
  if (!verified) {
    return NextResponse.json({ error }, { status: 403 })
  }
  
  // Continue with verified wallet logic
}
```

### Returns

```typescript
{
  verified: boolean
  error?: string // Only present if not verified
}
```

---

## 🚀 `withVerifiedWallet(walletAddress)`

Convenience wrapper that returns a NextResponse error if not verified.

### Usage (Recommended)

```typescript
import { withVerifiedWallet } from '@/lib/middleware'

export async function POST(request: Request) {
  const { wallet } = await request.json()
  
  // Early return pattern - cleaner code
  const verificationError = await withVerifiedWallet(wallet)
  if (verificationError) return verificationError
  
  // Continue with verified wallet logic
}
```

### Returns

- `NextResponse` with 403 error if not verified
- `null` if verified (continue processing)

---

## 📋 Implementation Examples

### Example 1: Job Creation API

```typescript
// app/api/jobs/create/route.ts
import { withVerifiedWallet } from '@/lib/middleware'

export async function POST(request: Request) {
  const { poster_wallet, title, description, ... } = await request.json()
  
  // Verify wallet before allowing job creation
  const verificationError = await withVerifiedWallet(poster_wallet)
  if (verificationError) return verificationError
  
  // Validate other fields...
  if (!title || !description) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  
  // Create job...
  const { data: job } = await supabaseAdmin
    .from('jobs')
    .insert({ poster_wallet, title, description })
    .select()
    .single()
  
  return NextResponse.json({ success: true, job })
}
```

### Example 2: Tip Recording API

```typescript
// app/api/tips/record/route.ts
import { withVerifiedWallet } from '@/lib/middleware'

export async function POST(request: Request) {
  const { fromWallet, toWallet, amountTokens, ... } = await request.json()
  
  // Verify sender wallet
  const verificationError = await withVerifiedWallet(fromWallet)
  if (verificationError) return verificationError
  
  // Validate tip data...
  if (!amountTokens || amountTokens <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }
  
  // Record tip...
  const { data: tip } = await supabase
    .from('chat_tips')
    .insert({ from_wallet: fromWallet, to_wallet: toWallet, amount_tokens: amountTokens })
    .select()
    .single()
  
  return NextResponse.json({ success: true, tip })
}
```

### Example 3: Multiple Wallet Verification

```typescript
// When you need to verify multiple wallets
import { requireVerifiedWallet } from '@/lib/middleware'

export async function POST(request: Request) {
  const { senderWallet, recipientWallet } = await request.json()
  
  // Verify both wallets
  const [senderCheck, recipientCheck] = await Promise.all([
    requireVerifiedWallet(senderWallet),
    requireVerifiedWallet(recipientWallet)
  ])
  
  if (!senderCheck.verified) {
    return NextResponse.json({ error: 'Sender wallet not verified' }, { status: 403 })
  }
  
  if (!recipientCheck.verified) {
    return NextResponse.json({ error: 'Recipient wallet not verified' }, { status: 403 })
  }
  
  // Continue...
}
```

---

## ⚡ Benefits

### Before (Duplicated Code)

```typescript
// Repeated in every API route
const { data: profile } = await supabaseAdmin
  .from('user_profiles')
  .select('wallet_verified')
  .eq('wallet_address', wallet)
  .single()

if (!profile?.wallet_verified) {
  return NextResponse.json({ error: 'Wallet not verified' }, { status: 403 })
}
```

### After (DRY Principle)

```typescript
// One line per verification check
const verificationError = await withVerifiedWallet(wallet)
if (verificationError) return verificationError
```

### Advantages

✅ **Consistent** - Same verification logic everywhere  
✅ **Maintainable** - Update once, apply everywhere  
✅ **Testable** - Single function to unit test  
✅ **Readable** - Clear intent with early return pattern  
✅ **Type-safe** - TypeScript ensures correct usage  

---

## 🎯 Where to Use

Apply wallet verification middleware to these API endpoints:

- ✅ `/api/jobs/create` - Job creation
- ✅ `/api/tips/record` - Tip recording
- ✅ `/api/messages/send` - Message sending (already has inline check)
- ✅ `/api/jobs/[jobId]/apply` - Job applications (if API exists)
- ✅ Any other endpoint requiring verified wallets

---

## 🧪 Testing

```typescript
// __tests__/lib/middleware/requireVerifiedWallet.test.ts
import { requireVerifiedWallet } from '@/lib/middleware'

describe('requireVerifiedWallet', () => {
  it('should return verified: true for verified wallet', async () => {
    const result = await requireVerifiedWallet('VerifiedWalletAddress...')
    expect(result.verified).toBe(true)
    expect(result.error).toBeUndefined()
  })
  
  it('should return verified: false for unverified wallet', async () => {
    const result = await requireVerifiedWallet('UnverifiedWalletAddress...')
    expect(result.verified).toBe(false)
    expect(result.error).toBe('Wallet verification required')
  })
})
```

---

## 📝 Notes

- Uses `supabaseAdmin` for server-side queries (bypasses RLS)
- Returns consistent error messages
- Safe for concurrent checks (stateless)
- Handles missing profiles gracefully (treats as unverified)

---

## 🔄 Future Enhancements

Potential improvements for future iterations:

1. **Caching** - Cache verification status for 5 minutes
2. **Batch verification** - Verify multiple wallets in one query
3. **Custom error messages** - Allow custom error messages per route
4. **Audit logging** - Log verification attempts
5. **Rate limiting** - Prevent verification check spam

```typescript
// Example: Cached verification (future)
export async function requireVerifiedWalletCached(walletAddress: string) {
  const cached = await redis.get(`wallet:verified:${walletAddress}`)
  if (cached !== null) return { verified: cached === 'true' }
  
  const result = await requireVerifiedWallet(walletAddress)
  await redis.setex(`wallet:verified:${walletAddress}`, 300, result.verified.toString())
  
  return result
}
```

