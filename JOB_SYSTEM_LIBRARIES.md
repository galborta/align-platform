# Job System Libraries - Complete ✅

## Overview

Two new library files provide the core functionality for the job/bounty system:
- **`lib/helius.ts`** - Token price validation via Helius API
- **`lib/jobs.ts`** - Job system database operations

---

## 📦 lib/helius.ts

### Purpose
Validates job payment amounts meet minimum USD thresholds using real-time token prices from Helius API.

### Functions

#### `getTokenPriceUsd(tokenMint: string): Promise<number | null>`

Fetches current USD price for a token using DexScreener API (same as project page).

**Parameters:**
- `tokenMint` (string) - Token mint address

**Returns:**
- `number` - Price in USD
- `null` - If price unavailable or error

**Example:**
```typescript
import { getTokenPriceUsd } from '@/lib/helius'

const price = await getTokenPriceUsd('GtDZKAqvMZMnti46ZewMiXCa4oXF4bZxwQPoKzXPFxZn')
// Returns: 0.023456 (NUB price in USD from DexScreener)
```

**API Used:**
- **DexScreener** - Free, no API key required
- Same API used successfully in project detail pages
- Works with most DEX-listed tokens

**Error Handling:**
- Returns `null` if token has no price data
- Returns `null` if token not listed on any DEX
- Logs errors to console

---

#### `validateMinimumUsdValue(tokenMint, tokenAmount, minUsd?): Promise<{ valid: boolean; usdValue: number | null }>`

Validates if token amount meets minimum USD threshold.

**Parameters:**
- `tokenMint` (string) - Token mint address
- `tokenAmount` (number) - Amount of tokens
- `minUsd` (number) - Minimum USD value (default: $5)

**Returns:**
```typescript
{
  valid: boolean     // true if meets threshold
  usdValue: number | null  // total USD value
}
```

**Example:**
```typescript
import { validateMinimumUsdValue } from '@/lib/helius'

const result = await validateMinimumUsdValue(
  tokenMint,
  100,  // 100 tokens
  5     // Minimum $5 USD
)

if (result.valid) {
  console.log(`Payment is valid: $${result.usdValue}`)
} else {
  console.log('Payment below minimum')
}
```

**Use Case:**
Validate job payments before posting:
```typescript
// Before creating job
const validation = await validateMinimumUsdValue(
  projectTokenMint,
  paymentTokens,
  5
)

if (!validation.valid) {
  throw new Error(`Payment must be at least $5 USD (currently $${validation.usdValue || 0})`)
}
```

---

## 📦 lib/jobs.ts

### Purpose
Provides typed database operations for the job system using Supabase.

### Types

All functions use proper TypeScript types from `types/database.ts`:

```typescript
type Job = Database['public']['Tables']['jobs']['Row']
type JobInsert = Database['public']['Tables']['jobs']['Insert']
type JobApplication = Database['public']['Tables']['job_applications']['Row']
type JobApplicationInsert = Database['public']['Tables']['job_applications']['Insert']
```

### Functions

#### `createJob(jobData): Promise<Job>`

Creates a new job posting.

**Parameters:**
```typescript
{
  project_id: string
  poster_wallet: string
  title: string
  description: string
  kpis: string
  category: 'design' | 'marketing' | 'development' | 'content' | 'community' | 'other'
  payment_amount_tokens: number
  payment_amount_usd: number
  assignment_mode: 'first_come' | 'review'
}
```

**Returns:** Created `Job` object

**Example:**
```typescript
import { createJob } from '@/lib/jobs'
import { validateMinimumUsdValue } from '@/lib/helius'

// Validate payment first
const validation = await validateMinimumUsdValue(
  project.token_mint,
  1000,
  5
)

if (!validation.valid) {
  throw new Error('Payment too low')
}

const job = await createJob({
  project_id: project.id,
  poster_wallet: wallet.publicKey.toString(),
  title: 'Design New Logo',
  description: 'Need a modern logo for our token project...',
  kpis: 'High resolution PNG and SVG, multiple variations',
  category: 'design',
  payment_amount_tokens: 1000,
  payment_amount_usd: validation.usdValue!,
  assignment_mode: 'review'
})
```

---

#### `getProjectJobs(projectId: string): Promise<Job[]>`

Fetches all jobs for a project, sorted by newest first.

**Example:**
```typescript
const jobs = await getProjectJobs(projectId)

jobs.forEach(job => {
  console.log(`${job.title} - ${job.status}`)
})
```

---

#### `applyToJob(applicationData): Promise<JobApplication>`

Submit an application to a job.

**Parameters:**
```typescript
{
  job_id: string
  applicant_wallet: string
  pitch: string
  image_urls?: string[]
  estimated_completion: string
}
```

**Example:**
```typescript
import { applyToJob, hasAppliedToJob } from '@/lib/jobs'

// Check if already applied
const alreadyApplied = await hasAppliedToJob(
  jobId,
  wallet.publicKey.toString()
)

if (alreadyApplied) {
  throw new Error('Already applied to this job')
}

// Submit application
const application = await applyToJob({
  job_id: jobId,
  applicant_wallet: wallet.publicKey.toString(),
  pitch: 'I have 5 years of experience in logo design...',
  image_urls: ['https://example.com/portfolio1.png'],
  estimated_completion: '3 days'
})
```

---

#### `getJobById(jobId: string): Promise<Job | null>`

Fetch a single job by ID.

**Example:**
```typescript
const job = await getJobById(jobId)

if (!job) {
  return <div>Job not found</div>
}
```

---

#### `getJobApplications(jobId: string): Promise<JobApplication[]>`

Get all applications for a job.

**Example:**
```typescript
const applications = await getJobApplications(jobId)

console.log(`${applications.length} applications received`)
```

---

#### `hasAppliedToJob(jobId: string, walletAddress: string): Promise<boolean>`

Check if a user has already applied.

**Example:**
```typescript
const alreadyApplied = await hasAppliedToJob(jobId, wallet)

if (alreadyApplied) {
  // Disable apply button
  setCanApply(false)
}
```

---

#### `updateJobStatus(jobId, status, additionalData?): Promise<Job>`

Update job status and related timestamps.

**Parameters:**
- `jobId` (string)
- `status` (JobStatus enum)
- `additionalData` (optional):
  - `assigned_to` (string)
  - `assigned_at` (string)
  - `submitted_at` (string)
  - `completed_at` (string)
  - `cancelled_at` (string)

**Example:**
```typescript
// Assign job to worker
await updateJobStatus(
  jobId,
  'assigned',
  {
    assigned_to: workerWallet,
    assigned_at: new Date().toISOString()
  }
)

// Mark as completed
await updateJobStatus(
  jobId,
  'completed',
  {
    completed_at: new Date().toISOString()
  }
)
```

---

#### `getJobsByPoster(posterWallet: string): Promise<Job[]>`

Get all jobs posted by a specific wallet.

**Example:**
```typescript
const myJobs = await getJobsByPoster(wallet.publicKey.toString())

console.log(`You have posted ${myJobs.length} jobs`)
```

---

#### `getJobsByWorker(workerWallet: string): Promise<Job[]>`

Get all jobs assigned to a specific wallet.

**Example:**
```typescript
const myAssignments = await getJobsByWorker(wallet.publicKey.toString())

const activeJobs = myAssignments.filter(j => 
  j.status === 'assigned' || j.status === 'submitted'
)
```

---

## 🔧 Environment Setup

### No Additional Configuration Required! ✅

**Price Validation:**
- Uses **DexScreener API** (free, no key needed)
- Same API used successfully in project pages
- Works with NUB and most DEX-listed tokens

**Note:** Helius API key (`NEXT_PUBLIC_HELIUS_API_KEY`) is optional and only used for:
- Token holder queries
- Advanced RPC features
- Not required for price validation

---

## 📋 Usage Patterns

### Pattern 1: Creating a Job with Validation

```typescript
import { createJob } from '@/lib/jobs'
import { validateMinimumUsdValue } from '@/lib/helius'
import { getWalletTokenData } from '@/lib/token-balance'

async function postJob(
  projectId: string,
  tokenMint: string,
  posterWallet: string,
  jobDetails: JobDetails
) {
  // 1. Verify poster holds tokens
  const tokenData = await getWalletTokenData(posterWallet, tokenMint)
  if (!tokenData || tokenData.balance === 0) {
    throw new Error('Must hold project tokens to post jobs')
  }

  // 2. Validate payment meets minimum
  const validation = await validateMinimumUsdValue(
    tokenMint,
    jobDetails.paymentTokens,
    5
  )

  if (!validation.valid) {
    throw new Error(
      `Payment must be at least $5 USD. Current value: $${validation.usdValue || 0}`
    )
  }

  // 3. Create job
  const job = await createJob({
    project_id: projectId,
    poster_wallet: posterWallet,
    title: jobDetails.title,
    description: jobDetails.description,
    kpis: jobDetails.kpis,
    category: jobDetails.category,
    payment_amount_tokens: jobDetails.paymentTokens,
    payment_amount_usd: validation.usdValue!,
    assignment_mode: jobDetails.assignmentMode
  })

  return job
}
```

---

### Pattern 2: Job Application Flow

```typescript
import { applyToJob, hasAppliedToJob, getJobById } from '@/lib/jobs'
import { getWalletTokenData } from '@/lib/token-balance'

async function submitApplication(
  jobId: string,
  applicantWallet: string,
  applicationData: ApplicationData
) {
  // 1. Get job details
  const job = await getJobById(jobId)
  if (!job) throw new Error('Job not found')
  if (job.status !== 'open') throw new Error('Job is not open')

  // 2. Check if already applied
  const alreadyApplied = await hasAppliedToJob(jobId, applicantWallet)
  if (alreadyApplied) throw new Error('Already applied')

  // 3. Verify applicant holds tokens
  const tokenData = await getWalletTokenData(
    applicantWallet,
    job.project_id // Need to fetch project to get token_mint
  )
  if (!tokenData || tokenData.balance === 0) {
    throw new Error('Must hold project tokens to apply')
  }

  // 4. Submit application
  const application = await applyToJob({
    job_id: jobId,
    applicant_wallet: applicantWallet,
    pitch: applicationData.pitch,
    image_urls: applicationData.portfolioImages,
    estimated_completion: applicationData.estimatedDays
  })

  return application
}
```

---

### Pattern 3: Job Status Progression

```typescript
import { updateJobStatus, getJobById } from '@/lib/jobs'

// Helper to progress job through workflow
async function progressJobStatus(
  jobId: string,
  newStatus: JobStatus,
  metadata?: any
) {
  const job = await getJobById(jobId)
  if (!job) throw new Error('Job not found')

  // Validate state transitions
  const validTransitions: Record<JobStatus, JobStatus[]> = {
    open: ['assigned', 'cancelled'],
    assigned: ['submitted', 'cancelled'],
    submitted: ['completed', 'disputed'],
    completed: [],
    disputed: ['completed', 'cancelled'],
    cancelled: []
  }

  if (!validTransitions[job.status].includes(newStatus)) {
    throw new Error(`Cannot transition from ${job.status} to ${newStatus}`)
  }

  // Update with appropriate timestamps
  const timestamps: Record<JobStatus, any> = {
    assigned: { assigned_at: new Date().toISOString() },
    submitted: { submitted_at: new Date().toISOString() },
    completed: { completed_at: new Date().toISOString() },
    cancelled: { cancelled_at: new Date().toISOString() },
    disputed: {},
    open: {}
  }

  return updateJobStatus(
    jobId,
    newStatus,
    { ...timestamps[newStatus], ...metadata }
  )
}
```

---

## 🎯 Integration Checklist

- [x] Database tables created (migration 017)
- [x] TypeScript types defined
- [x] Helius API integration
- [x] Basic CRUD operations
- [ ] Job creation UI
- [ ] Application submission UI
- [ ] Vote weighting logic
- [ ] Payment escrow (future)
- [ ] Dispute system UI

---

## 🚀 Next Steps

### Immediate (MVP)
1. Create `CreateJobModal.tsx` component
2. Add job board page (`app/jobs/page.tsx`)
3. Build job detail view
4. Implement application form
5. Add real-time subscriptions for job updates

### Short-term
1. Vote weighting based on token holdings
2. Application selection for "review" mode
3. Work submission form
4. Job completion flow
5. Basic analytics

### Future Enhancements
1. Smart contract escrow
2. Milestone-based payments
3. Reputation system
4. Job templates
5. Advanced search/filters

---

## 📊 Performance Considerations

### Caching
```typescript
// Cache token prices for 5 minutes
const priceCache = new Map<string, { price: number; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000

async function getCachedTokenPrice(tokenMint: string): Promise<number | null> {
  const cached = priceCache.get(tokenMint)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price
  }
  
  const price = await getTokenPriceUsd(tokenMint)
  if (price) {
    priceCache.set(tokenMint, { price, timestamp: Date.now() })
  }
  
  return price
}
```

### Optimistic Updates
```typescript
// Update UI immediately, sync in background
async function optimisticApply(jobId: string, application: ApplicationData) {
  // Update local state
  setApplications(prev => [...prev, {
    ...application,
    id: 'temp-' + Date.now(),
    created_at: new Date().toISOString()
  }])
  
  // Sync to database
  try {
    const result = await applyToJob(application)
    // Update with real data
    setApplications(prev => 
      prev.map(a => a.id.startsWith('temp-') ? result : a)
    )
  } catch (error) {
    // Rollback on error
    setApplications(prev => 
      prev.filter(a => !a.id.startsWith('temp-'))
    )
    throw error
  }
}
```

---

## 🔐 Security Notes

### Token Holder Verification
Always verify token holdings on the server side:

```typescript
// Client-side (can be bypassed)
const tokenData = await getWalletTokenData(wallet, tokenMint)

// Server-side API route (secure)
export async function POST(request: Request) {
  const { wallet, tokenMint } = await request.json()
  
  // Verify on server
  const tokenData = await getWalletTokenData(wallet, tokenMint)
  
  if (!tokenData || tokenData.balance === 0) {
    return new Response('Unauthorized', { status: 403 })
  }
  
  // Proceed with action
}
```

### Payment Validation
Never trust client-provided USD amounts:

```typescript
// ❌ BAD: Client provides USD amount
await createJob({
  payment_amount_usd: userProvidedAmount // Can be manipulated
})

// ✅ GOOD: Server validates USD amount
const validation = await validateMinimumUsdValue(tokenMint, tokens, 5)
await createJob({
  payment_amount_usd: validation.usdValue! // Server-calculated
})
```

---

**Status:** ✅ Libraries Complete and Ready  
**Documentation:** Complete  
**Testing:** Manual testing recommended  
**Next:** Build UI components for job system

---

**Created:** November 24, 2025  
**Files:**
- `lib/helius.ts`
- `lib/jobs.ts`
- Updated: `SETUP.md`

