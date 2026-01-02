# Align Platform - Root Intent Node

## Purpose & Scope

Modular infrastructure for Solana token projects. Provides:
- Project dashboards and treasury management
- IP verification and team transparency
- Real-time direct messaging between holders
- Community curation with karma-weighted voting
- Job marketplace for token projects (social media, content creation)

**Out of Scope:** Does not handle token creation, minting, or smart contract deployment.

## Tech Stack & Architecture

```
Frontend (Next.js 14) ←→ Supabase (DB + Auth + Real-time) ←→ Solana (Blockchain)
```

- **Next.js 14** with App Router (TypeScript, React Server Components)
- **Supabase** for backend (PostgreSQL + RLS + Edge Functions + Real-time subscriptions)
- **Solana Web3.js** for blockchain interactions (wallet signatures, token balance verification)
- **Material UI v5** + **Tailwind CSS** for UI
- **Playwright** (E2E tests) + **Vitest** (unit tests)

## Entry Points

### Pages (Next.js App Router)
- `/` - Landing page (`app/page.tsx`)
- `/projects` - Project directory
- `/projects/[id]` - Individual project dashboard
- `/messages` - DM inbox (real-time messaging)
- `/profile` - User profile and settings
- `/jobs` - Job marketplace
- `/review` - Content review queue (karma-based curation)

### API Routes
- `/api/auth/*` - Wallet signature verification
- `/api/jobs/*` - Job creation, escrow, submissions
- `/api/messages/*` - DM operations
- `/api/notifications/*` - Notification management
- `/api/revisions/*` - Project update history

## Critical Invariants

**Authentication & Authorization:**
- All authenticated operations require valid Solana wallet signature
- Signature verification uses cryptographic challenge-response (see `lib/signature-auth.ts`)
- Never bypass signature validation for "convenience" - this is the security foundation

**Database Security (RLS):**
- Row-Level Security (RLS) enforces all permissions at database level
- Never use service role client in frontend code
- Client-side code uses anon key, RLS handles authorization based on `auth.jwt()`

**Holder Verification:**
- Token holder status verified via on-chain token balance
- Cached with 5-minute TTL to reduce RPC calls (see `lib/token-balance.ts`)
- Jobs, messaging, voting all gated by holder verification

**Privacy Levels:**
- Profiles have three privacy levels: Public, Holders Only, Private
- Privacy rules enforced via RLS policies and application logic
- Never mix data from different privacy levels in same query

**Escrow Safety:**
- Job payments held in escrow (Program Derived Address on Solana)
- Release requires project owner signature + submission approval
- No direct wallet-to-wallet transfers without escrow

## Architecture Patterns

**Client-Server Separation:**
- Server Components fetch data, Client Components handle interactivity
- Avoid mixing data fetching and UI state in same component
- Use React Context for cross-cutting concerns (wallet, messaging)

**Real-time Updates:**
- Messaging uses Supabase real-time subscriptions (`lib/feed-subscriptions.ts`)
- Notifications use polling with real-time channel for instant delivery
- Feed items batch updates to prevent subscription overload

**Blockchain Interaction:**
- All Solana interactions go through `lib/solana/*` helpers
- Never call RPC directly from components
- Connection pooling and retry logic in `lib/solana/connection.ts`

**Caching Strategy:**
- Profile data cached via React Context (`lib/ProfileCacheContext.tsx`)
- Token balances cached 5min in-memory
- Static metadata cached at build time

## Anti-Patterns

**❌ Direct RPC Calls from Components**
```typescript
// WRONG
const connection = new Connection(...)
const balance = await connection.getTokenAccountsByOwner(...)

// CORRECT
import { getTokenBalance } from '@/lib/token-balance'
const balance = await getTokenBalance(wallet, tokenMint)
```

**❌ Bypassing RLS with Service Role**
```typescript
// WRONG (in client-side code)
import { createServiceClient } from '@/lib/supabase'

// CORRECT
import { createClient } from '@/lib/supabase'
const supabase = createClient() // uses anon key, RLS enforces access
```

**❌ Mixing Privacy Levels**
```typescript
// WRONG
.select('*, profiles!inner(*)')

// CORRECT - check privacy level first, then join
const { data: profile } = await getVisibleProfile(userId, viewerWallet)
```

**❌ Storing Wallet Signatures Client-Side**
Signatures are single-use nonces. Generate fresh on each auth attempt.

**❌ Assuming Supabase Auth User = Wallet Owner**
Users can be logged in without wallet connected. Always verify wallet signature.

## Subsystems

Each subsystem has its own Intent Node covering implementation details:

- **[`app/CLAUDE.md`](./app/CLAUDE.md)** - Next.js routing, pages, layouts
- **[`components/CLAUDE.md`](./components/CLAUDE.md)** - React component library, shared UI patterns
- **[`lib/CLAUDE.md`](./lib/CLAUDE.md)** - Core utilities, blockchain integration, business logic
- **[`supabase/CLAUDE.md`](./supabase/CLAUDE.md)** - Database schema, RLS policies, Edge Functions
- **[`types/CLAUDE.md`](./types/CLAUDE.md)** - TypeScript type definitions

## Related Documentation

- **Messaging System:** [`MESSAGING_DOCUMENTATION_INDEX.md`](./MESSAGING_DOCUMENTATION_INDEX.md)
- **Deployment:** [`MESSAGING_DEPLOYMENT_RUNBOOK.md`](./MESSAGING_DEPLOYMENT_RUNBOOK.md)
- **API Reference:** [`MESSAGING_API_REFERENCE.md`](./MESSAGING_API_REFERENCE.md)

## Common Pitfall: Token Amounts & Decimals

Solana token amounts are stored as raw integers. SPL tokens typically have 6-9 decimals.

```typescript
// Raw amount from blockchain: 1000000 (6 decimals) = 1.0 tokens
// Always use utility functions:
import { fromLamports, toLamports } from '@/lib/solana/amounts'

const displayAmount = fromLamports(rawAmount, decimals) // "1.000000"
const rawAmount = toLamports(displayAmount, decimals)   // 1000000
```

## Development Workflow

```bash
# Local dev with hot reload
npm run dev

# Type checking
npm run lint

# Run tests
npm run test        # E2E (Playwright)
npm run test:unit   # Unit tests (Vitest)

# Build for production
npm run build
npm start
```

## Security Notes

- **Recent Security Fix:** API endpoints now validate wallet ownership via cryptographic signatures (Jan 2025)
- **Signature Format:** Message must include nonce, timestamp, and action type
- **Rate Limiting:** Implemented on auth endpoints (`lib/rate-limit.ts`)

## Quick Navigation

**Working on Jobs?** → [`lib/CLAUDE.md`](./lib/CLAUDE.md) → Job utilities  
**Working on Messaging?** → [`app/messages/CLAUDE.md`](./app/messages/CLAUDE.md)  
**Working on RLS Policies?** → [`supabase/CLAUDE.md`](./supabase/CLAUDE.md)  
**Working on Wallet Integration?** → [`lib/solana/CLAUDE.md`](./lib/solana/CLAUDE.md)
