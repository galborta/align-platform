# Job System Karma Integration

## Overview

The karma system has been extended to reward participation in the job marketplace. Job-related actions earn karma based on both token holdings (tier multipliers) and USD value of jobs.

---

## Base Karma Constants

Added to `BASE_KARMA` in `/lib/karma.ts`:

```typescript
POST_JOB: 50              // Posting a job
APPLY_TO_JOB: 50          // Applying to a job
UPVOTE_APPLICATION: 10    // Upvoting an application
COMPLETE_JOB_POSTER: 0    // Calculated from USD value
COMPLETE_JOB_WORKER: 0    // Calculated from USD value
VOTE_ON_DISPUTE: 5        // Voting on a dispute
CANCEL_JOB: -50           // Cancelling a job (penalty)
FAIL_TO_DELIVER: -50      // Worker ghost/dispute lost (penalty)
```

---

## Karma Calculation Functions

### 1. `calculateJobCompletionKarma(usdValue: number)`

Calculates karma for successful job completion (both poster and worker earn equally).

**Formula:** `USD value × 50`

**Examples:**
- $10 job → 500 karma each
- $50 job → 2,500 karma each
- $100 job → 5,000 karma each

```typescript
import { calculateJobCompletionKarma } from '@/lib/karma'

// When job completes successfully
const jobUsdValue = 50
const karmaEarned = calculateJobCompletionKarma(jobUsdValue) // 2,500

// Award to both poster and worker
await awardKarma(posterWallet, karmaEarned)
await awardKarma(workerWallet, karmaEarned)
```

---

### 2. `calculateApplicationUpvoteBonusKarma(usdValue: number)`

Bonus karma for voters who upvoted the winning application when the job completes successfully.

**Formula:** `USD value × 10`

**Examples:**
- $10 job completes → +100 bonus per correct upvoter
- $50 job completes → +500 bonus per correct upvoter
- $100 job completes → +1,000 bonus per correct upvoter

```typescript
import { calculateApplicationUpvoteBonusKarma } from '@/lib/karma'

// When job completes, reward voters who upvoted the winner
const jobUsdValue = 50
const bonusKarma = calculateApplicationUpvoteBonusKarma(jobUsdValue) // 500

// Award to each voter who upvoted the winning application
for (const voter of winningApplicationVoters) {
  await awardKarma(voter.wallet, bonusKarma)
}
```

---

### 3. `calculateDisputeVoteBonusKarma(usdValue: number)`

Bonus karma for voters who voted on the winning side of a dispute.

**Formula:** `USD value × 10`

**Examples:**
- $10 job dispute → +100 bonus for correct voters
- $50 job dispute → +500 bonus for correct voters
- $100 job dispute → +1,000 bonus for correct voters

```typescript
import { calculateDisputeVoteBonusKarma } from '@/lib/karma'

// When dispute resolves, reward voters on winning side
const jobUsdValue = 50
const bonusKarma = calculateDisputeVoteBonusKarma(jobUsdValue) // 500
const winningSide = outcome === 'release_to_worker' ? 'release' : 'refund'

// Award to voters on winning side
for (const vote of disputeVotes) {
  if (vote.vote === winningSide) {
    await awardKarma(vote.voter_wallet, bonusKarma)
  }
}
```

---

### 4. `calculateJobKarma(action, tokenPercentage, isImmediate)`

Calculates karma for standard job actions (not USD-based), applying tier multipliers and immediate/delayed split.

**Parameters:**
- `action` - Job action from BASE_KARMA (e.g., 'POST_JOB', 'APPLY_TO_JOB')
- `tokenPercentage` - User's % of token supply (for tier multiplier)
- `isImmediate` - `true` for 25% immediate, `false` for 75% delayed

**Examples:**

```typescript
import { calculateJobKarma } from '@/lib/karma'

// User posts a job (0.5% token holder = 'holder' tier, 3x multiplier)
const immediateKarma = calculateJobKarma('POST_JOB', 0.5, true)
// 50 × 3 × 0.25 = 37.5 → 37 karma (immediate)

const delayedKarma = calculateJobKarma('POST_JOB', 0.5, false)
// 50 × 3 × 0.75 = 112.5 → 112 karma (on job completion)

// User upvotes an application (1.5% = 'whale' tier, 5.5x multiplier)
const upvoteKarma = calculateJobKarma('UPVOTE_APPLICATION', 1.5, true)
// 10 × 5.5 × 0.25 = 13.75 → 13 karma (immediate)
```

---

## Tier Multipliers

From `/lib/karma.ts`:

| Tier | Token % | Multiplier |
|------|---------|------------|
| Small | 0.0 - 0.1% | 1x |
| Holder | 0.1 - 1.0% | 3x |
| Whale | 1.0 - 5.0% | 5.5x |
| Mega | 5.0%+ | 7x |

**Note:** USD-based rewards (job completion, voting bonuses) do NOT use tier multipliers. Everyone earns equally based on the job's value.

---

## Database Tracking

Added to `wallet_karma` table (in `/types/database.ts`):

```typescript
applications_submitted_count: number      // Total applications submitted
jobs_completed_as_worker_count: number    // Jobs completed as worker
jobs_posted_as_poster_count: number       // Jobs posted as poster
dispute_votes_cast_count: number          // Total dispute votes cast
dispute_votes_won_count: number           // Dispute votes on winning side
```

### Calculating Dispute Win Rate

```typescript
const disputeWinRate = karma.dispute_votes_cast_count > 0
  ? (karma.dispute_votes_won_count / karma.dispute_votes_cast_count) * 100
  : 0

console.log(`Dispute Win Rate: ${disputeWinRate.toFixed(1)}%`)
```

---

## Integration Flow Examples

### Example 1: Posting a Job

```typescript
import { calculateJobKarma } from '@/lib/karma'
import { supabase } from '@/lib/supabase'

async function handleJobPost(posterWallet: string, tokenPercentage: number) {
  // Award immediate karma (25%)
  const immediateKarma = calculateJobKarma('POST_JOB', tokenPercentage, true)
  
  await supabase.rpc('award_karma', {
    wallet: posterWallet,
    project_id: projectId,
    karma_amount: immediateKarma,
    increment_jobs_posted: 1
  })
  
  // Note: Remaining 75% awarded when job completes
}
```

### Example 2: Applying to a Job

```typescript
async function handleJobApplication(applicantWallet: string, tokenPercentage: number) {
  const immediateKarma = calculateJobKarma('APPLY_TO_JOB', tokenPercentage, true)
  
  await supabase.rpc('award_karma', {
    wallet: applicantWallet,
    project_id: projectId,
    karma_amount: immediateKarma,
    increment_applications_submitted: 1
  })
}
```

### Example 3: Job Completion (Full Flow)

```typescript
import { calculateJobKarma, calculateJobCompletionKarma, calculateApplicationUpvoteBonusKarma } from '@/lib/karma'

async function handleJobCompletion(job: Job) {
  // 1. Award USD-based completion karma (both poster and worker)
  const completionKarma = calculateJobCompletionKarma(job.payment_amount_usd)
  
  await supabase.rpc('award_karma', {
    wallet: job.poster_wallet,
    project_id: job.project_id,
    karma_amount: completionKarma
  })
  
  await supabase.rpc('award_karma', {
    wallet: job.assigned_to,
    project_id: job.project_id,
    karma_amount: completionKarma,
    increment_jobs_completed_as_worker: 1
  })
  
  // 2. Award delayed karma to poster (75% of POST_JOB)
  const posterTokenPercentage = await getTokenPercentage(job.poster_wallet)
  const delayedPosterKarma = calculateJobKarma('POST_JOB', posterTokenPercentage, false)
  
  await supabase.rpc('award_karma', {
    wallet: job.poster_wallet,
    project_id: job.project_id,
    karma_amount: delayedPosterKarma
  })
  
  // 3. Award delayed karma to worker (75% of APPLY_TO_JOB)
  const workerTokenPercentage = await getTokenPercentage(job.assigned_to)
  const delayedWorkerKarma = calculateJobKarma('APPLY_TO_JOB', workerTokenPercentage, false)
  
  await supabase.rpc('award_karma', {
    wallet: job.assigned_to,
    project_id: job.project_id,
    karma_amount: delayedWorkerKarma
  })
  
  // 4. Bonus karma for voters who upvoted the winning application
  const winningApplication = await getWinningApplication(job.id, job.assigned_to)
  const upvoters = await getApplicationUpvoters(winningApplication.id)
  const bonusKarma = calculateApplicationUpvoteBonusKarma(job.payment_amount_usd)
  
  for (const upvoter of upvoters) {
    await supabase.rpc('award_karma', {
      wallet: upvoter.voter_wallet,
      project_id: job.project_id,
      karma_amount: bonusKarma
    })
  }
}
```

### Example 4: Dispute Resolution

```typescript
import { calculateDisputeVoteBonusKarma } from '@/lib/karma'

async function handleDisputeResolution(dispute: Dispute, outcome: 'release_to_worker' | 'refund_to_poster') {
  const job = await getJob(dispute.job_id)
  const bonusKarma = calculateDisputeVoteBonusKarma(job.payment_amount_usd)
  const winningSide = outcome === 'release_to_worker' ? 'release' : 'refund'
  
  // Get all votes on this dispute
  const votes = await getDisputeVotes(dispute.id)
  
  for (const vote of votes) {
    if (vote.vote === winningSide) {
      // Award bonus karma to correct voters
      await supabase.rpc('award_karma', {
        wallet: vote.voter_wallet,
        project_id: job.project_id,
        karma_amount: bonusKarma,
        increment_dispute_votes_won: 1
      })
    }
  }
}
```

### Example 5: Job Cancellation (Penalty)

```typescript
async function handleJobCancellation(posterWallet: string, tokenPercentage: number) {
  // Apply penalty (negative karma, no tier multiplier on penalties)
  const penaltyKarma = -50
  
  await supabase.rpc('award_karma', {
    wallet: posterWallet,
    project_id: projectId,
    karma_amount: penaltyKarma
  })
}
```

---

## Karma Summary by Action Type

### Fixed Base Actions (with tier multipliers)
- **Post Job**: 50 × tier multiplier (25% immediate, 75% on completion)
- **Apply to Job**: 50 × tier multiplier (25% immediate, 75% on completion)
- **Upvote Application**: 10 × tier multiplier (100% immediate)
- **Vote on Dispute**: 5 × tier multiplier (100% immediate)
- **Cancel Job**: -50 (penalty, no multiplier)
- **Fail to Deliver**: -50 (penalty, no multiplier)

### USD-Based Actions (no tier multipliers)
- **Complete Job (both)**: USD × 50 karma each
- **Application Upvote Bonus**: USD × 10 karma (if winner completes)
- **Dispute Vote Bonus**: USD × 10 karma (if voted with winner)

---

## Migration Required

You'll need to add the new columns to the `wallet_karma` table:

```sql
-- Add job tracking columns to wallet_karma
ALTER TABLE wallet_karma
ADD COLUMN applications_submitted_count INTEGER DEFAULT 0,
ADD COLUMN jobs_completed_as_worker_count INTEGER DEFAULT 0,
ADD COLUMN jobs_posted_as_poster_count INTEGER DEFAULT 0,
ADD COLUMN dispute_votes_cast_count INTEGER DEFAULT 0,
ADD COLUMN dispute_votes_won_count INTEGER DEFAULT 0;

-- Add check constraints
ALTER TABLE wallet_karma
ADD CONSTRAINT applications_submitted_non_negative CHECK (applications_submitted_count >= 0),
ADD CONSTRAINT jobs_completed_worker_non_negative CHECK (jobs_completed_as_worker_count >= 0),
ADD CONSTRAINT jobs_posted_non_negative CHECK (jobs_posted_as_poster_count >= 0),
ADD CONSTRAINT dispute_votes_cast_non_negative CHECK (dispute_votes_cast_count >= 0),
ADD CONSTRAINT dispute_votes_won_non_negative CHECK (dispute_votes_won_count >= 0);

-- Create index for job stats queries
CREATE INDEX idx_wallet_karma_job_stats ON wallet_karma(
  project_id,
  jobs_posted_as_poster_count DESC,
  jobs_completed_as_worker_count DESC
);
```

---

## Testing Checklist

- [ ] Post job → earns immediate karma
- [ ] Apply to job → earns immediate karma
- [ ] Upvote application → earns immediate karma
- [ ] Complete job → both parties earn USD-based karma + delayed karma
- [ ] Upvoters of winner → earn bonus when job completes
- [ ] Vote on dispute → earns immediate karma
- [ ] Dispute resolves → winning voters earn bonus
- [ ] Cancel job → applies penalty
- [ ] Worker fails delivery → applies penalty
- [ ] Tier multipliers work correctly for standard actions
- [ ] USD-based actions ignore tier multipliers
- [ ] Database counters increment correctly
- [ ] Dispute win rate calculation works

---

## Next Steps

1. Create migration `018_add_job_karma_tracking.sql`
2. Create Supabase RPC function `award_karma()` with job counter parameters
3. Implement karma awards in job lifecycle handlers
4. Add karma display to user profiles (show job stats)
5. Create leaderboards for job completion counts
6. Add dispute accuracy percentage to user profiles

---

## Questions?

See also:
- `/lib/karma.ts` - Core karma logic
- `/types/database.ts` - Database schema
- `JOB_SYSTEM_SETUP.md` - Job system overview


