# Job System Setup - Complete ✅

## Overview

A comprehensive token-gated bounty/job system has been added to the ALIGN platform, enabling project creators to post jobs, receive applications, manage assignments, and handle disputes through community voting.

---

## ✅ Migration Applied

**File:** `supabase-migrations/017_create_job_system_tables.sql`  
**Status:** ✅ Applied to Supabase  
**Created:** November 24, 2025

---

## 📊 Database Schema

### 6 New Tables Created

#### 1. `jobs` - Main Job Listings
```sql
- id (UUID)
- project_id (FK to projects)
- poster_wallet (TEXT)
- title (TEXT, max 200 chars)
- description (TEXT, max 5000 chars)
- kpis (TEXT, max 2000 chars)
- category (ENUM: design, marketing, development, content, community, other)
- payment_amount_tokens (NUMERIC)
- payment_amount_usd (NUMERIC, min $5)
- status (ENUM: open, assigned, submitted, completed, disputed, cancelled)
- assignment_mode (ENUM: first_come, review)
- assigned_to (TEXT, nullable)
- assigned_at, submitted_at, completed_at, cancelled_at (TIMESTAMP)
- created_at, updated_at (TIMESTAMP)
```

#### 2. `job_applications` - Worker Applications
```sql
- id (UUID)
- job_id (FK to jobs)
- applicant_wallet (TEXT)
- pitch (TEXT, max 2000 chars)
- image_urls (TEXT[])
- estimated_completion (TEXT)
- is_invalidated (BOOLEAN)
- created_at, updated_at (TIMESTAMP)
- UNIQUE: (job_id, applicant_wallet)
```

#### 3. `job_application_votes` - Token-Weighted Voting
```sql
- id (UUID)
- application_id (FK to job_applications)
- voter_wallet (TEXT)
- vote_weight (NUMERIC)
- created_at (TIMESTAMP)
- UNIQUE: (application_id, voter_wallet)
```

#### 4. `job_submissions` - Work Delivery
```sql
- id (UUID)
- job_id (FK to jobs)
- worker_wallet (TEXT)
- message (TEXT, max 2000 chars)
- image_urls (TEXT[])
- external_links (TEXT[])
- submitted_at (TIMESTAMP)
```

#### 5. `job_disputes` - Conflict Resolution
```sql
- id (UUID)
- job_id (FK to jobs)
- opened_by (ENUM: poster, worker)
- reason (TEXT, max 1000 chars)
- status (ENUM: active, resolved)
- outcome (ENUM: release_to_worker, refund_to_poster)
- created_at, ends_at, resolved_at (TIMESTAMP)
```

#### 6. `job_dispute_votes` - Community Arbitration
```sql
- id (UUID)
- dispute_id (FK to job_disputes)
- voter_wallet (TEXT)
- vote (ENUM: release, refund)
- vote_weight (NUMERIC)
- created_at (TIMESTAMP)
- UNIQUE: (dispute_id, voter_wallet)
```

---

## 🔐 Security Features

### Row Level Security (RLS)
All tables have RLS enabled with permissive policies for MVP:

**Jobs:**
- ✅ Anyone can view jobs
- ✅ Anyone can create jobs (poster verification in app logic)
- ✅ Anyone can update jobs (owner verification in app logic)

**Applications:**
- ✅ Anyone can view applications
- ✅ Token holders can apply (verification in app logic)
- ✅ Applicants can update own applications

**Votes:**
- ✅ Anyone can view votes
- ✅ Token holders can vote (weight verification in app logic)

**Submissions:**
- ✅ Anyone can view submissions
- ✅ Workers can submit work

**Disputes:**
- ✅ Anyone can view disputes
- ✅ Parties can create disputes
- ✅ Token holders can vote on disputes

### Token Holder Verification
Token holder checks and vote weight calculations should be implemented in application logic using the existing `token-balance.ts` utilities.

---

## ⚡ Performance Optimizations

### Indexes Created
```sql
idx_jobs_project              - Fast project job lookup
idx_jobs_poster               - Fast poster job history
idx_jobs_status               - Filter by job status
idx_job_applications_job      - Fast application lookup per job
idx_job_applications_applicant - Fast user application history
idx_job_application_votes_application - Vote aggregation
idx_job_disputes_job          - Dispute lookup per job
idx_job_disputes_status       - Active disputes query
```

### Real-Time Subscriptions
Enabled for:
- ✅ `jobs` - Live job updates
- ✅ `job_applications` - New applications in real-time
- ✅ `job_application_votes` - Live vote tallies

---

## 🔧 Environment Configuration

### Required: Helius API Key

Add to `.env.local`:
```bash
NEXT_PUBLIC_HELIUS_API_KEY=your_helius_api_key_here
```

**Why needed:**
- Token price validation for job payments
- Ensures minimum $5 USD payment requirement
- Real-time price data for payment amounts

**Get your key:**
1. Visit [https://helius.dev](https://helius.dev)
2. Sign up (free tier available)
3. Create API key
4. Add to `.env.local`

See updated [SETUP.md](./SETUP.md) for complete environment configuration.

---

## 📝 TypeScript Types

### Updated: `types/database.ts`

All 6 new tables have complete TypeScript definitions including:
- **Row**: Full table schema with proper types
- **Insert**: Types for creating records (optional fields marked)
- **Update**: Types for updating records (all optional)

**Example Usage:**
```typescript
import { Database } from '@/types/database'

type Job = Database['public']['Tables']['jobs']['Row']
type JobInsert = Database['public']['Tables']['jobs']['Insert']
type JobUpdate = Database['public']['Tables']['jobs']['Update']

// Create a new job
const newJob: JobInsert = {
  project_id: projectId,
  poster_wallet: walletAddress,
  title: 'Design new logo',
  description: 'We need a modern logo...',
  kpis: 'High resolution, multiple formats',
  category: 'design',
  payment_amount_tokens: 1000,
  payment_amount_usd: 50,
  assignment_mode: 'review'
}
```

---

## 🎯 Job Workflow

### 1. Job Creation
```
Poster → Create Job → Status: 'open'
```

### 2. Application Process

**Mode: first_come**
```
Worker → Apply → Auto-assigned → Status: 'assigned'
```

**Mode: review**
```
Worker → Apply → Community Votes → Poster Assigns → Status: 'assigned'
```

### 3. Work Submission
```
Worker → Submit Work → Status: 'submitted'
```

### 4. Completion
```
Poster → Approve → Status: 'completed' → Payment Released
```

### 5. Dispute Resolution
```
Party → Open Dispute → Community Votes → Status: 'disputed'
→ Resolved (release_to_worker | refund_to_poster)
```

---

## 🚀 Next Steps for Implementation

### 1. ✅ Job Management Functions (COMPLETE)
Created `lib/jobs.ts` with functions:
```typescript
✅ createJob()
✅ getProjectJobs() (was getJobsByProject)
✅ getJobsByPoster()
✅ applyToJob()
✅ getJobApplications()
✅ hasAppliedToJob()
✅ updateJobStatus()
✅ getJobById()
✅ getJobsByWorker()
- voteOnApplication() (TODO)
- assignJob() (TODO)
- submitWork() (TODO)
- approveWork() (TODO)
- openDispute() (TODO)
- voteOnDispute() (TODO)
- resolveDispute() (TODO)
```

Created `lib/helius.ts` for price validation:
```typescript
✅ getTokenPriceUsd()
✅ validateMinimumUsdValue()
```

**See:** [JOB_SYSTEM_LIBRARIES.md](./JOB_SYSTEM_LIBRARIES.md) for full documentation

### 2. Build UI Components
```
components/
  - JobBoard.tsx           # Browse all jobs
  - JobCard.tsx            # Individual job preview
  - CreateJobModal.tsx     # Post new job
  - JobDetail.tsx          # Full job view
  - ApplicationCard.tsx    # Application display
  - SubmitWorkModal.tsx    # Work submission form
  - DisputeModal.tsx       # Dispute filing/voting
```

### 3. Create Pages
```
app/
  jobs/
    page.tsx              # Job board
    [id]/
      page.tsx            # Job detail
      apply/
        page.tsx          # Application form
```

### 4. Integration Points

**Token Balance:**
- Use `getWalletTokenData()` to verify holder status
- Calculate vote weight from token percentage
- Apply tier multipliers for voting power

**Privacy System:**
- Check `canMessageUser()` before allowing direct contact
- Respect privacy settings for applicant profiles

**Messaging System:**
- Enable poster-applicant communication
- Notify on application status changes
- Alert on dispute votes

**Karma System:**
- Award karma for completed jobs
- Penalize for disputes lost
- Track job completion rate

---

## 💡 Feature Ideas

### Phase 1 (MVP)
- [x] Database schema
- [ ] Create job
- [ ] Apply to job
- [ ] Vote on applications
- [ ] Submit work
- [ ] Complete job
- [ ] Dispute system

### Phase 2
- [ ] Job templates
- [ ] Milestone-based payments
- [ ] Escrow smart contract
- [ ] Job categories with custom fields
- [ ] Application portfolios
- [ ] Worker ratings/reviews
- [ ] Job recommendations

### Phase 3
- [ ] Recurring jobs
- [ ] Job subscriptions
- [ ] Team jobs (multiple workers)
- [ ] Job agencies/intermediaries
- [ ] Advanced analytics
- [ ] Job marketplace

---

## 📊 Business Logic Considerations

### Payment Flow
1. **Job Creation**: Funds held by poster (off-chain for MVP)
2. **Assignment**: Funds locked (future: escrow smart contract)
3. **Completion**: Funds released to worker
4. **Dispute**: Community votes determine fund destination

### Vote Weight Calculation
```typescript
// Use existing tier system from karma.ts
const tier = getTier(tokenPercentage)
const voteWeight = tokenPercentage * tier.multiplier
```

### Application Selection (Review Mode)
```typescript
// Tally votes
const totalWeight = votes.reduce((sum, v) => sum + v.vote_weight, 0)
const threshold = projectTotalSupply * 0.05 // 5% of supply

if (totalWeight >= threshold) {
  // Assign to applicant with most votes
}
```

### Dispute Resolution
```typescript
// Vote for 72 hours
// Tally at end
if (releaseVotes > refundVotes) {
  // Release payment to worker
} else {
  // Refund poster
}
```

---

## 🔍 Query Examples

### Get Open Jobs for Project
```typescript
const { data: jobs } = await supabase
  .from('jobs')
  .select('*')
  .eq('project_id', projectId)
  .eq('status', 'open')
  .order('created_at', { ascending: false })
```

### Get Applications with Vote Counts
```typescript
const { data: applications } = await supabase
  .from('job_applications')
  .select(`
    *,
    job_application_votes (
      vote_weight
    )
  `)
  .eq('job_id', jobId)
```

### Check if User Already Applied
```typescript
const { data: existing } = await supabase
  .from('job_applications')
  .select('id')
  .eq('job_id', jobId)
  .eq('applicant_wallet', walletAddress)
  .maybeSingle()
```

---

## ✅ Testing Checklist

- [ ] Create job with all fields
- [ ] Apply to job (first_come mode)
- [ ] Apply to job (review mode)
- [ ] Vote on applications
- [ ] Assign job to applicant
- [ ] Submit work with attachments
- [ ] Approve work and complete job
- [ ] Open dispute
- [ ] Vote on dispute
- [ ] Resolve dispute
- [ ] Test all RLS policies
- [ ] Test real-time subscriptions
- [ ] Verify token holder checks
- [ ] Test edge cases (duplicate applications, invalid states)

---

## 📚 Related Documentation

- [Token Balance System](./TOKEN_BALANCE_COMPLETE.md)
- [Karma System](./KARMA_SYSTEM.md)
- [Messaging System](./MESSAGING_SYSTEM_GUIDE.md)
- [Privacy System](./PRIVACY_SYSTEM_COMPLETE.md)

---

**Status:** ✅ Database Schema Complete  
**Next:** Implement business logic in `lib/jobs.ts`  
**Priority:** High - Core platform feature  
**Timeline:** 2-3 days for full implementation

---

**Created:** November 24, 2025  
**Migration:** `017_create_job_system_tables.sql`  
**Applied to:** Production Database ✅

