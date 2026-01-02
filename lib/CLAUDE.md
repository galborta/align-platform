# Lib Directory - Intent Node

**Parent:** [`/CLAUDE.md`](../CLAUDE.md)

## Purpose & Scope

Core utilities, business logic, and external integrations. The "backend" logic layer of the application.

**Responsibilities:**
- Solana blockchain interactions (wallet signatures, token balances, escrow)
- Supabase client configuration and helpers
- Business logic (jobs, messaging, karma, notifications)
- Data transformation and validation
- Third-party service integrations (Helius RPC, email)

**Out of Scope:** UI components (in `/components`), routing (in `/app`)

## File Organization

### By Concern
- **Authentication:** `signature-auth.ts`, `wallet-validation.ts`, `admin-auth.ts`
- **Blockchain:** `solana.ts`, `solana/*`, `token-balance.ts`, `escrow-payout.ts`
- **Messaging:** `messaging.ts`, `MessagingContext.tsx`, `presence.ts`, `privacy.ts`
- **Jobs:** `jobs.ts`, `job-*.ts` (comments, karma, notifications, drafts, etc)
- **Notifications:** `notifications.ts`, `notifications/*`
- **Data Management:** `feed-*.ts` (queries, subscriptions, batching, transform)
- **Utilities:** `cache.ts`, `debounce.ts`, `rate-limit.ts`

### Subdirectories
- **`database/`** - Raw database operations and queries
- **`solana/`** - Blockchain-specific helpers
- **`hooks/`** - Custom React hooks
- **`emails/`** - Email templates (React Email)
- **`services/`** - External service integrations
- **`middleware/`** - API middleware (auth, rate limiting)
- **`notifications/`** - Notification delivery logic
- **`permissions/`** - Permission checking utilities

## Critical Patterns

### 1. Wallet Signature Verification

**Entry Point:** `signature-auth.ts`

All authenticated operations verify wallet ownership via cryptographic signature:

```typescript
import { verifyWalletSignature } from '@/lib/signature-auth'

// In API route
const { wallet, signature, message } = await request.json()

const verification = await verifyWalletSignature({
  wallet,
  signature,
  message,
  expectedAction: 'CREATE_JOB', // prevents replay attacks
  maxAge: 300, // 5 minutes
})

if (!verification.valid) {
  return Response.json({ error: 'Invalid signature' }, { status: 401 })
}
```

**Message Format:**
```
Action: CREATE_JOB
Nonce: <random-string>
Timestamp: <unix-timestamp-ms>
```

**Security Invariants:**
- Nonce prevents replay attacks (single-use)
- Timestamp prevents old signatures (max 5min age)
- Action type scopes permission (can't reuse job signature for profile update)

**Anti-pattern:** Never skip signature verification for "convenience"

### 2. Token Balance & Holder Verification

**Entry Point:** `token-balance.ts`

Checking if wallet holds project tokens:

```typescript
import { getTokenBalance } from '@/lib/token-balance'

const balance = await getTokenBalance(walletAddress, tokenMint)

if (balance === 0) {
  throw new Error('Not a token holder')
}
```

**Caching:** Balances cached 5min in-memory to reduce RPC calls.

**Important:** Cache is per-process. In serverless (Vercel), each function invocation may have cold cache.

**When to Check:**
- Messaging (can only DM holders)
- Job submissions (holders-only jobs)
- Voting (karma-weighted by holdings)
- Profile visibility (respects privacy settings)

### 3. Escrow Payments

**Entry Point:** `escrow-payout.ts`

Job payments flow through Solana escrow (Program Derived Address):

```typescript
import { createEscrowAccount, releaseEscrow } from '@/lib/escrow-payout'

// When job is created
const escrowPDA = await createEscrowAccount({
  amount,
  tokenMint,
  projectOwner,
  jobId,
})

// When work is approved
const txSignature = await releaseEscrow({
  escrowPDA,
  recipient: submitterWallet,
  projectOwnerWallet,
})
```

**Security Model:**
- Escrow created with project owner as authority
- Release requires project owner signature
- Funds locked until approval or deadline expiry
- No direct wallet-to-wallet transfers

**Deadline Enforcement:**
If deadline passes with no approval, funds return to project owner.

### 4. Real-time Subscriptions

**Entry Point:** `feed-subscriptions.ts`

Messaging uses Supabase real-time channels:

```typescript
import { subscribeToMessages } from '@/lib/feed-subscriptions'

const subscription = subscribeToMessages(
  conversationId,
  (message) => {
    // New message received
    updateUI(message)
  }
)

// Cleanup
subscription.unsubscribe()
```

**Batching:** Feed updates batched to prevent subscription overload (see `feed-batching.ts`)

**Pattern:**
```typescript
// Good: Single subscription for conversation
subscribeToMessages(conversationId, callback)

// Bad: Subscription per message
messages.forEach(msg => subscribeToMessage(msg.id, callback))
```

### 5. Permissions & Privacy

**Entry Points:** `permissions.ts`, `privacy.ts`

Privacy levels: Public, Holders Only, Private

```typescript
import { canViewProfile } from '@/lib/privacy'

const visible = await canViewProfile({
  profileUserId,
  viewerWallet,
  tokenMint,
})

if (!visible) {
  throw new Error('Profile is private')
}
```

**RLS Enforcement:**
Privacy also enforced at database level via RLS policies. Application logic is defense-in-depth.

**Pattern:** Always check privacy before displaying user data.

### 6. Karma System

**Entry Points:** `karma.ts`, `job-karma.ts`

Community curation via karma-weighted voting:

```typescript
import { calculateKarma } from '@/lib/karma'

const userKarma = await calculateKarma(userId, projectId)

// Karma sources:
// - Job completions (+10 per job)
// - Upvotes received (+1 per upvote)
// - Successful submissions (+5 per approval)
// - Disputes lost (-5 per loss)
```

**Voting Weight:**
```typescript
votePower = sqrt(karma) * tokenBalance
```

Prevents sybil attacks (can't just create many accounts) while weighting by contribution.

### 7. Notification System

**Entry Points:** `notifications.ts`, `job-notifications.ts`

Notifications created by system events:

```typescript
import { createNotification } from '@/lib/notifications'

await createNotification({
  userId: recipient,
  type: 'JOB_SUBMITTED',
  title: 'New submission',
  message: `${submitter} submitted work for "${jobTitle}"`,
  actionUrl: `/jobs/${jobId}/submissions`,
  metadata: { jobId, submissionId },
})
```

**Delivery:**
- In-app (real-time via Supabase channel)
- Email (via Resend API, see `email-service.ts`)

**Types:** `JOB_CREATED`, `JOB_SUBMITTED`, `MESSAGE_RECEIVED`, `VOTE_CAST`, etc.

### 8. Database Queries

**Entry Point:** `feed-queries.ts`

Complex feed queries (jobs, submissions, reviews):

```typescript
import { getJobFeed } from '@/lib/feed-queries'

const jobs = await getJobFeed({
  projectId,
  status: 'open',
  limit: 20,
  offset: 0,
})
```

**Pagination:** Cursor-based for real-time feeds, offset-based for static lists.

**Joins:** Use `.select('*, project:projects(*)')` pattern for related data.

**RLS:** All queries respect RLS policies. Service role only used in Edge Functions.

## Supabase Client Patterns

### Client-Side
```typescript
import { createClient } from '@/lib/supabase'

const supabase = createClient() // anon key, RLS enforced
```

### Server-Side (RSC, Route Handlers)
```typescript
import { createClient } from '@/lib/supabase/server'

const supabase = createClient() // cookies for auth, still uses anon key
```

### Admin (Edge Functions only)
```typescript
import { createServiceClient } from '@/lib/supabase/admin'

const supabase = createServiceClient() // service role, bypasses RLS
```

**Critical:** Service role NEVER used in frontend code. It's for Edge Functions only.

## Blockchain Interaction Patterns

All Solana operations go through `lib/solana/*`:

```typescript
import { getConnection } from '@/lib/solana/connection'
import { getTokenBalance } from '@/lib/token-balance'
import { verifyWalletSignature } from '@/lib/signature-auth'

// Good: Centralized helpers
const connection = getConnection()
const balance = await getTokenBalance(wallet, mint)

// Bad: Direct RPC in components
import { Connection } from '@solana/web3.js'
const connection = new Connection(rpcUrl)
```

**Connection Pooling:** `lib/solana/connection.ts` maintains connection pool.

**Retry Logic:** Built into helpers, handles RPC rate limits.

## Common Anti-Patterns

**❌ Skipping Signature Verification**
```typescript
// WRONG
if (body.wallet === expectedWallet) { ... }

// CORRECT
const verified = await verifyWalletSignature(...)
if (!verified.valid) { throw new Error('Unauthorized') }
```

**❌ Direct RPC Calls**
```typescript
// WRONG
const connection = new Connection(...)
const balance = await connection.getTokenAccountsByOwner(...)

// CORRECT
const balance = await getTokenBalance(wallet, mint)
```

**❌ Using Service Role Client-Side**
```typescript
// WRONG (in browser code)
import { createServiceClient } from '@/lib/supabase/admin'

// CORRECT
import { createClient } from '@/lib/supabase'
```

**❌ Ignoring Privacy Levels**
```typescript
// WRONG
const profile = await supabase.from('profiles').select('*').eq('id', userId).single()

// CORRECT
const profile = await getVisibleProfile(userId, viewerWallet)
```

## Error Handling

All lib functions throw typed errors:

```typescript
class WalletVerificationError extends Error {
  constructor(message: string, public code: string) {
    super(message)
  }
}

throw new WalletVerificationError('Invalid signature', 'INVALID_SIGNATURE')
```

**Pattern:** Catch at API route boundary, return appropriate HTTP status.

## Rate Limiting

**Entry Point:** `rate-limit.ts`

Auth endpoints rate limited by IP:

```typescript
import { rateLimit } from '@/lib/rate-limit'

const limiter = rateLimit({ max: 10, window: '1m' })

const allowed = await limiter.check(request)
if (!allowed) {
  return Response.json({ error: 'Rate limited' }, { status: 429 })
}
```

**Storage:** In-memory (resets on function cold start in serverless).

**Limits:**
- Auth: 10/min
- Job creation: 5/min
- Message send: 20/min

## Subdirectory Guides

**Working on blockchain?** → [`lib/solana/CLAUDE.md`](./solana/CLAUDE.md)  
**Working on database queries?** → [`lib/database/CLAUDE.md`](./database/CLAUDE.md)  
**Working on permissions?** → [`lib/permissions/CLAUDE.md`](./permissions/CLAUDE.md)  
**Working on notifications?** → [`lib/notifications/CLAUDE.md`](./notifications/CLAUDE.md)

## Quick Reference

**Job Operations:** `jobs.ts`, `job-*.ts`  
**Messaging:** `messaging.ts`, `MessagingContext.tsx`  
**Auth:** `signature-auth.ts`, `wallet-validation.ts`  
**Blockchain:** `token-balance.ts`, `escrow-payout.ts`, `solana/*`  
**Data Queries:** `feed-queries.ts`, `feed-subscriptions.ts`
