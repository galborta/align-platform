# Job Escrow Fields Guide

## Overview

This document details the 14 new escrow-related fields added to the `jobs` table in migration `029_add_escrow_fields_to_jobs.sql`. These fields enable complete escrow lifecycle management, deadline tracking, and automated payment release.

---

## Field Categories

### 🔒 Escrow Tracking Fields

#### `escrow_locked` (boolean, default: false)
- **Purpose**: Indicates whether funds are currently held in escrow for this job
- **Set to `true`**: When poster successfully transfers tokens to escrow wallet during job creation
- **Set to `false`**: When funds are released or refunded
- **Use case**: Quick check to see if job has active escrow

```typescript
// Example: Check if job has escrow before allowing cancellation
if (job.escrow_locked) {
  await processEscrowRefund(job.id);
} else {
  await directCancel(job.id);
}
```

#### `escrow_tx_signature` (text, nullable)
- **Purpose**: Stores the Solana transaction signature of the initial escrow lock transaction
- **Format**: Base58-encoded transaction signature (e.g., `"5wHu2...xYz"`)
- **Use case**: Audit trail, transaction verification, Solscan links
- **Set on**: Successful escrow lock during job creation

```typescript
// Example: Generate Solscan link
const solscanUrl = `https://solscan.io/tx/${job.escrow_tx_signature}`;
```

#### `escrow_amount_tokens` (numeric, nullable)
- **Purpose**: Total amount of tokens locked in escrow (job payment + platform fee)
- **Calculation**: `payment_amount_tokens * (1 + fee_percentage_at_creation / 100)`
- **Example**: If job pays 100 tokens and fee is 5%, escrow_amount_tokens = 105
- **Use case**: Exact amount verification, refund processing

```typescript
// Example: Calculate escrow amount
const feeMultiplier = 1 + (job.fee_percentage_at_creation / 100);
const escrowAmount = job.payment_amount_tokens * feeMultiplier;
```

#### `escrow_token_mint` (text, nullable)
- **Purpose**: Mint address of the token held in escrow
- **Format**: Base58-encoded Solana public key
- **Use case**: Multi-token support, display correct token symbol, process transfers
- **Common values**: 
  - SOL: `"So11111111111111111111111111111111111111112"`
  - USDC: `"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"`

---

### ⏰ Deadline Management Fields

#### `poster_desired_completion` (timestamptz, nullable)
- **Purpose**: When the poster *hopes* to have the work completed (soft deadline)
- **Set on**: Job creation (optional field in CreateJobModal)
- **Not enforced**: This is informational only; doesn't trigger auto-actions
- **Use case**: Help workers understand urgency, sort jobs by timeline

```typescript
// Example: Display in job card
{job.poster_desired_completion && (
  <span>Desired by: {formatDate(job.poster_desired_completion)}</span>
)}
```

#### `worker_committed_completion` (timestamptz, nullable)
- **Purpose**: When the assigned worker commits to completing the work
- **Set on**: Job assignment (worker selects this during application or on assignment)
- **Use case**: Accountability, timeline tracking, worker reputation

```typescript
// Example: Set on job assignment
await updateJob(jobId, {
  assigned_to: workerWallet,
  assigned_at: new Date().toISOString(),
  worker_committed_completion: application.estimated_completion,
  status: 'assigned'
});
```

#### `hard_deadline` (timestamptz, nullable)
- **Purpose**: Absolute deadline after which the job is auto-cancelled or reassigned
- **Set on**: Job creation (optional, for time-sensitive jobs)
- **Enforced by**: Cron job that runs every hour
- **Use case**: Urgent jobs (event coverage, time-sensitive marketing, etc.)

```typescript
// Example: Cron job logic
const overdueJobs = await supabase
  .from('jobs')
  .select('*')
  .eq('status', 'assigned')
  .not('hard_deadline', 'is', null)
  .lt('hard_deadline', new Date().toISOString());

for (const job of overdueJobs.data) {
  await handleHardDeadlineMiss(job);
}
```

#### `release_scheduled_at` (timestamptz, nullable)
- **Purpose**: When the payment should be automatically released (escrow unlock)
- **Calculation**: Typically set to `submitted_at + 10 days` when work is submitted
- **Enforced by**: Cron job (runs every 15 minutes)
- **Can be paused by**: Setting `release_paused = true`
- **Use case**: Auto-release system, prevents indefinite escrow

```typescript
// Example: Set on work submission
await updateJob(jobId, {
  status: 'submitted',
  submitted_at: now,
  release_scheduled_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // +10 days
});
```

---

### ⏸️ Payment Release Control Fields

#### `release_paused` (boolean, default: false)
- **Purpose**: Halts the automatic payment release countdown
- **Set to `true` when**:
  - Poster opens a dispute
  - Poster requests revisions
  - Admin intervenes
- **Set to `false` when**:
  - Dispute is resolved
  - Revisions are completed
  - Admin manually releases
- **Use case**: Give time for dispute resolution or revisions without releasing funds

```typescript
// Example: Pause on dispute
await updateJob(jobId, {
  release_paused: true,
  release_paused_by: posterWallet,
  release_paused_at: new Date().toISOString(),
});
```

#### `release_paused_by` (text, nullable)
- **Purpose**: Records who paused the automatic release
- **Values**: Wallet address of poster, worker, or admin
- **Use case**: Audit trail, accountability, display in UI

```typescript
// Example: Display pause info
{job.release_paused && (
  <Alert>
    Payment release paused by {formatWallet(job.release_paused_by)}
  </Alert>
)}
```

#### `release_paused_at` (timestamptz, nullable)
- **Purpose**: When the release was paused
- **Use case**: Track pause duration, display in UI

---

### 🔄 Revision Tracking Fields

#### `revision_requests_count` (integer, default: 0)
- **Purpose**: Number of times the poster has requested revisions
- **Constraint**: Non-negative (enforced by check constraint)
- **Incremented when**: Poster clicks "Request Revisions" button
- **Use case**: Track revision frequency, worker stats, potential abuse detection

```typescript
// Example: Increment on revision request
await updateJob(jobId, {
  revision_requests_count: job.revision_requests_count + 1,
  last_revision_requested_at: new Date().toISOString(),
  release_paused: true, // Pause auto-release during revisions
});
```

#### `last_revision_requested_at` (timestamptz, nullable)
- **Purpose**: Timestamp of the most recent revision request
- **Use case**: Track revision timeline, display "last activity"

```typescript
// Example: Display revision status
{job.revision_requests_count > 0 && (
  <span>
    {job.revision_requests_count} revision{job.revision_requests_count !== 1 ? 's' : ''} requested
    (last: {formatRelativeTime(job.last_revision_requested_at)})
  </span>
)}
```

---

### 💰 Fee Tracking Fields

#### `fee_percentage_at_creation` (numeric, default: 5.0)
- **Purpose**: Locks the platform fee percentage at the time of job creation
- **Why needed**: Prevents fee changes from affecting existing jobs (fairness)
- **Constraint**: Must be between 0 and 100 (enforced by check constraint)
- **Retrieved from**: `platform_settings` table at job creation time
- **Use case**: Calculate exact escrow amount, calculate platform fee on release

```typescript
// Example: Calculate fee at job creation
const feePercentage = await getPlatformSetting('fee_percentage');
await createJob({
  ...jobData,
  fee_percentage_at_creation: parseFloat(feePercentage),
  escrow_amount_tokens: jobData.payment_amount_tokens * (1 + parseFloat(feePercentage) / 100),
});
```

---

## Helper Functions

The migration also created 4 database helper functions for working with these fields:

### `job_has_active_escrow(job_id UUID) → BOOLEAN`
```sql
SELECT job_has_active_escrow('550e8400-e29b-41d4-a716-446655440000');
-- Returns: true if job has escrow_locked = true
```

### `time_until_release(job_id UUID) → INTERVAL`
```sql
SELECT time_until_release('550e8400-e29b-41d4-a716-446655440000');
-- Returns: '2 days 5 hours 30 minutes' or NULL if no scheduled release
```

### `is_release_overdue(job_id UUID) → BOOLEAN`
```sql
SELECT is_release_overdue('550e8400-e29b-41d4-a716-446655440000');
-- Returns: true if past release_scheduled_at and not paused
```

### `get_jobs_needing_auto_release() → TABLE`
```sql
SELECT * FROM get_jobs_needing_auto_release();
-- Returns all jobs that need automatic payment release right now
```

---

## Indexes Created

For optimal query performance, the following indexes were created:

1. **`idx_jobs_escrow_locked`**: Fast lookup of jobs with active escrow
   ```sql
   CREATE INDEX idx_jobs_escrow_locked ON jobs(escrow_locked, created_at DESC)
   WHERE escrow_locked = true;
   ```

2. **`idx_jobs_hard_deadline`**: Monitor jobs approaching hard deadlines
   ```sql
   CREATE INDEX idx_jobs_hard_deadline ON jobs(hard_deadline, status)
   WHERE hard_deadline IS NOT NULL;
   ```

3. **`idx_jobs_release_scheduled`**: Find jobs needing auto-release (used by cron)
   ```sql
   CREATE INDEX idx_jobs_release_scheduled ON jobs(release_scheduled_at, release_paused, status)
   WHERE release_scheduled_at IS NOT NULL;
   ```

4. **`idx_jobs_release_paused`**: Admin view of paused releases
   ```sql
   CREATE INDEX idx_jobs_release_paused ON jobs(release_paused, release_paused_at DESC)
   WHERE release_paused = true;
   ```

5. **`idx_jobs_escrow_status`**: Common query pattern for dashboard
   ```sql
   CREATE INDEX idx_jobs_escrow_status ON jobs(escrow_locked, status, created_at DESC);
   ```

---

## Common Query Patterns

### Find all jobs with active escrow
```typescript
const { data } = await supabase
  .from('jobs')
  .select('*')
  .eq('escrow_locked', true)
  .order('created_at', { ascending: false });
```

### Find jobs needing auto-release (for cron)
```typescript
const { data } = await supabase.rpc('get_jobs_needing_auto_release');
```

### Check if specific job needs release
```typescript
const { data } = await supabase.rpc('is_release_overdue', { 
  p_job_id: jobId 
});
```

### Find jobs with paused releases
```typescript
const { data } = await supabase
  .from('jobs')
  .select('*')
  .eq('release_paused', true)
  .order('release_paused_at', { ascending: false });
```

### Get job with time until release
```typescript
const { data: job } = await supabase
  .from('jobs')
  .select('*, time_until_release:time_until_release(id)')
  .eq('id', jobId)
  .single();
```

---

## Job Lifecycle with Escrow

### 1. Job Creation
```typescript
// Poster creates job
escrow_locked = false
escrow_tx_signature = null
fee_percentage_at_creation = 5.0 // From platform_settings

// Poster locks funds in escrow
escrow_locked = true
escrow_tx_signature = "5wHu2..."
escrow_amount_tokens = 105 // 100 payment + 5 fee
escrow_token_mint = "So11..."
```

### 2. Job Assignment
```typescript
status = 'assigned'
assigned_to = workerWallet
assigned_at = now
worker_committed_completion = applicationEstimate
```

### 3. Work Submission
```typescript
status = 'submitted'
submitted_at = now
release_scheduled_at = now + 10 days
```

### 4a. Auto-Release Path (Happy Path)
```typescript
// 10 days pass...
// Cron detects: release_scheduled_at <= now && release_paused = false
// Triggers payment release:
// - Transfer payment_amount_tokens to worker
// - Transfer fee amount to platform fee wallet
// - Log transactions to job_escrow_transactions
status = 'completed'
completed_at = now
escrow_locked = false
```

### 4b. Revision Request Path
```typescript
// Poster requests revisions before auto-release
release_paused = true
release_paused_by = posterWallet
release_paused_at = now
revision_requests_count += 1
last_revision_requested_at = now

// Worker resubmits
release_paused = false
release_paused_by = null
release_paused_at = null
release_scheduled_at = now + 10 days // Reset countdown
```

### 4c. Dispute Path
```typescript
// Poster opens dispute
status = 'disputed'
release_paused = true
release_paused_by = posterWallet

// Community votes, admin intervenes...
// Outcome: Refund to poster
escrow_locked = false
status = 'cancelled'

// OR Outcome: Release to worker
escrow_locked = false
status = 'completed'
```

---

## Data Migration Results

The migration automatically backfilled existing jobs with:
- `fee_percentage_at_creation = 5.0`
- `escrow_locked = false`
- `release_paused = false`
- `revision_requests_count = 0`
- `release_scheduled_at` set for submitted jobs (submitted_at + 10 days)

---

## Next Steps for Implementation

1. **Update CreateJobModal** to:
   - Fetch fee_percentage from platform_settings
   - Lock funds in escrow wallet during job creation
   - Set escrow fields on successful transaction

2. **Update Job Detail Page** to:
   - Display escrow status and transaction link
   - Show countdown to auto-release
   - Add "Request Revisions" button (pauses release)
   - Add "Release Payment" button for manual release

3. **Create Escrow Cron Job** (`/api/cron/auto-release-payments`):
   - Call `get_jobs_needing_auto_release()`
   - Process each job: release payment + fee
   - Update job status and escrow fields
   - Log to job_escrow_transactions

4. **Update Job Cancellation Flow**:
   - Check escrow_locked
   - If true, refund to poster
   - If false, simple status update

5. **Add Admin Escrow Controls**:
   - Manual release button
   - Manual refund button
   - Pause/unpause release
   - View all jobs with active escrow

---

## Related Files
- Migration: `/supabase-migrations/029_add_escrow_fields_to_jobs.sql`
- Types: `/types/database.ts`
- Previous escrow foundation: `/supabase-migrations/028_create_job_escrow_system.sql`
- Escrow system docs: `/JOB_ESCROW_SYSTEM_FOUNDATION.md`

---

## Questions & Troubleshooting

### Q: What happens if release_scheduled_at passes but release_paused is true?
A: Nothing. The cron job skips paused jobs. The job stays in "submitted" status until release_paused is set to false, then the 10-day countdown effectively "resumes."

### Q: Can workers pause the release?
A: Typically no, but the field supports any wallet address. Current design: only poster and admins can pause.

### Q: What if fee_percentage_at_creation differs from current platform fee?
A: Jobs always use fee_percentage_at_creation for fairness. The locked fee at creation time is honored.

### Q: How do I test the auto-release system locally?
A: Set release_scheduled_at to a past time for a test job, then manually trigger the cron endpoint or use the helper function `get_jobs_needing_auto_release()`.

### Q: What if escrow_tx_signature is invalid or fake?
A: The escrow system should validate the transaction on-chain before setting escrow_locked = true. Never trust this field alone; always verify against Solana RPC.













