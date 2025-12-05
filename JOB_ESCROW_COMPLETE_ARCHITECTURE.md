# Job Escrow System - Complete Architecture

## 🏗️ System Overview

The Job Escrow & Payment System is built across two migrations (028 & 029) and provides complete escrow lifecycle management with admin controls.

---

## 📊 Database Schema

### Migration 028: Foundation Tables

#### `platform_settings` - Global Configuration
```sql
┌─────────────────────────────────────────┐
│         platform_settings              │
├─────────────────────────────────────────┤
│ id (uuid, PK)                          │
│ setting_key (text, unique)             │
│   - 'fee_percentage' → '5.0'           │
│   - 'fee_wallet_address' → 'abc...'    │
│   - 'escrow_wallet_address' → 'def...' │
│ setting_value (text)                   │
│ updated_by (text)                      │
│ updated_at (timestamptz)               │
│ created_at (timestamptz)               │
└─────────────────────────────────────────┘
```

#### `admin_wallets` - Admin Access Control
```sql
┌─────────────────────────────────────────┐
│            admin_wallets               │
├─────────────────────────────────────────┤
│ id (uuid, PK)                          │
│ wallet_address (text, unique)          │
│ role (text)                            │
│   - 'super_admin' | 'moderator'        │
│ added_by (text)                        │
│ added_at (timestamptz)                 │
│ is_active (boolean)                    │
└─────────────────────────────────────────┘
```

#### `job_escrow_transactions` - Audit Trail
```sql
┌─────────────────────────────────────────┐
│      job_escrow_transactions           │
├─────────────────────────────────────────┤
│ id (uuid, PK)                          │
│ job_id (uuid, FK → jobs.id)            │
│ transaction_type (text)                │
│   - 'lock' | 'release_to_worker'       │
│   - 'refund_to_poster' | 'fee_collection'│
│   - 'partial_release'                  │
│ from_wallet (text)                     │
│ to_wallet (text)                       │
│ amount_tokens (numeric)                │
│ token_mint (text)                      │
│ token_symbol (text)                    │
│ tx_signature (text, unique)            │
│ status (text)                          │
│   - 'pending' | 'confirmed' | 'failed' │
│ retry_count (integer)                  │
│ error_message (text)                   │
│ created_at (timestamptz)               │
│ confirmed_at (timestamptz)             │
└─────────────────────────────────────────┘
```

### Migration 029: Extended Jobs Table

#### `jobs` - Core Job Table (Extended)
```sql
┌─────────────────────────────────────────────────────────────┐
│                          jobs                               │
├─────────────────────────────────────────────────────────────┤
│ ┌─ ORIGINAL FIELDS ────────────────────────────────────┐    │
│ │ id (uuid, PK)                                        │    │
│ │ project_id (uuid, FK)                                │    │
│ │ poster_wallet (text)                                 │    │
│ │ title (text)                                         │    │
│ │ description (text)                                   │    │
│ │ kpis (text)                                          │    │
│ │ category (text)                                      │    │
│ │ payment_amount_tokens (numeric) ← Payment to worker  │    │
│ │ payment_amount_usd (numeric)                         │    │
│ │ status (text)                                        │    │
│ │ assignment_mode (text)                               │    │
│ │ assigned_to (text)                                   │    │
│ │ assigned_at (timestamptz)                            │    │
│ │ submitted_at (timestamptz)                           │    │
│ │ completed_at (timestamptz)                           │    │
│ │ cancelled_at (timestamptz)                           │    │
│ │ created_at (timestamptz)                             │    │
│ │ updated_at (timestamptz)                             │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│ ┌─ NEW: ESCROW TRACKING (Migration 029) ──────────────┐    │
│ │ escrow_locked (boolean, default: false)             │    │
│ │ escrow_tx_signature (text)                          │    │
│ │ escrow_amount_tokens (numeric) ← Payment + Fee      │    │
│ │ escrow_token_mint (text)                            │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│ ┌─ NEW: DEADLINE MANAGEMENT (Migration 029) ──────────┐    │
│ │ poster_desired_completion (timestamptz)             │    │
│ │ worker_committed_completion (timestamptz)           │    │
│ │ hard_deadline (timestamptz)                         │    │
│ │ release_scheduled_at (timestamptz)                  │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│ ┌─ NEW: RELEASE CONTROLS (Migration 029) ─────────────┐    │
│ │ release_paused (boolean, default: false)            │    │
│ │ release_paused_by (text)                            │    │
│ │ release_paused_at (timestamptz)                     │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│ ┌─ NEW: REVISION TRACKING (Migration 029) ────────────┐    │
│ │ revision_requests_count (integer, default: 0)       │    │
│ │ last_revision_requested_at (timestamptz)            │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│ ┌─ NEW: FEE TRACKING (Migration 029) ─────────────────┐    │
│ │ fee_percentage_at_creation (numeric, default: 5.0)  │    │
│ └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete Job Lifecycle

### Phase 1: Job Creation with Escrow Lock
```
┌──────────────────────────────────────────────────────────────┐
│ POSTER CREATES JOB                                           │
│                                                              │
│ 1. Fill out job details (title, description, KPIs)          │
│ 2. Select payment amount: 100 tokens                         │
│ 3. Platform calculates escrow: 100 * 1.05 = 105 tokens     │
│ 4. Poster approves & signs transaction                       │
│ 5. Tokens transferred to escrow wallet                       │
│                                                              │
│ ┌──────────────────────────────────────────────────┐         │
│ │ Database Updates:                                │         │
│ │ jobs table:                                      │         │
│ │   status = 'open'                                │         │
│ │   payment_amount_tokens = 100                    │         │
│ │   escrow_locked = true                           │         │
│ │   escrow_tx_signature = '5wHu2...'              │         │
│ │   escrow_amount_tokens = 105                     │         │
│ │   escrow_token_mint = 'So11...'                 │         │
│ │   fee_percentage_at_creation = 5.0               │         │
│ │                                                  │         │
│ │ job_escrow_transactions table:                   │         │
│ │   transaction_type = 'lock'                      │         │
│ │   from_wallet = poster                           │         │
│ │   to_wallet = escrow_wallet                      │         │
│ │   amount_tokens = 105                            │         │
│ │   status = 'confirmed'                           │         │
│ └──────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

### Phase 2: Application & Assignment
```
┌──────────────────────────────────────────────────────────────┐
│ WORKER APPLIES                                               │
│                                                              │
│ 1. Worker submits application with pitch                     │
│ 2. Worker specifies estimated completion date                │
│ 3. Community/poster votes (if review mode)                   │
│ 4. Job assigned to worker                                    │
│                                                              │
│ ┌──────────────────────────────────────────────────┐         │
│ │ Database Updates:                                │         │
│ │ jobs table:                                      │         │
│ │   status = 'assigned'                            │         │
│ │   assigned_to = worker_wallet                    │         │
│ │   assigned_at = NOW()                            │         │
│ │   worker_committed_completion = '2024-12-15'     │         │
│ └──────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

### Phase 3: Work Submission
```
┌──────────────────────────────────────────────────────────────┐
│ WORKER SUBMITS WORK                                          │
│                                                              │
│ 1. Worker uploads deliverables                               │
│ 2. Auto-release countdown starts (10 days)                   │
│ 3. Poster has 10 days to review                             │
│                                                              │
│ ┌──────────────────────────────────────────────────┐         │
│ │ Database Updates:                                │         │
│ │ jobs table:                                      │         │
│ │   status = 'submitted'                           │         │
│ │   submitted_at = NOW()                           │         │
│ │   release_scheduled_at = NOW() + 10 days         │         │
│ └──────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

### Phase 4a: Revision Request
```
┌──────────────────────────────────────────────────────────────┐
│ POSTER REQUESTS REVISIONS                                    │
│                                                              │
│ 1. Poster clicks "Request Revisions"                         │
│ 2. Auto-release paused                                       │
│ 3. Worker receives notification                              │
│ 4. Worker resubmits                                          │
│ 5. Auto-release countdown resets (10 days)                   │
│                                                              │
│ ┌──────────────────────────────────────────────────┐         │
│ │ Database Updates (On Request):                   │         │
│ │ jobs table:                                      │         │
│ │   release_paused = true                          │         │
│ │   release_paused_by = poster_wallet              │         │
│ │   release_paused_at = NOW()                      │         │
│ │   revision_requests_count += 1                   │         │
│ │   last_revision_requested_at = NOW()             │         │
│ │                                                  │         │
│ │ Database Updates (On Resubmit):                  │         │
│ │ jobs table:                                      │         │
│ │   release_paused = false                         │         │
│ │   release_scheduled_at = NOW() + 10 days         │         │
│ └──────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

### Phase 4b: Dispute
```
┌──────────────────────────────────────────────────────────────┐
│ POSTER OPENS DISPUTE                                         │
│                                                              │
│ 1. Poster clicks "Open Dispute"                              │
│ 2. Auto-release paused                                       │
│ 3. Community votes on outcome                                │
│ 4. Admin may intervene                                       │
│                                                              │
│ ┌──────────────────────────────────────────────────┐         │
│ │ Database Updates:                                │         │
│ │ jobs table:                                      │         │
│ │   status = 'disputed'                            │         │
│ │   release_paused = true                          │         │
│ │   release_paused_by = poster_wallet              │         │
│ │                                                  │         │
│ │ job_disputes table:                              │         │
│ │   (new dispute record created)                   │         │
│ └──────────────────────────────────────────────────┘         │
│                                                              │
│ OUTCOME 1: REFUND TO POSTER                                  │
│ ┌──────────────────────────────────────────────────┐         │
│ │ jobs table:                                      │         │
│ │   status = 'cancelled'                           │         │
│ │   escrow_locked = false                          │         │
│ │                                                  │         │
│ │ job_escrow_transactions (2 records):             │         │
│ │   1. type='refund_to_poster', amount=100        │         │
│ │   2. type='fee_collection', amount=5 (optional) │         │
│ └──────────────────────────────────────────────────┘         │
│                                                              │
│ OUTCOME 2: RELEASE TO WORKER                                 │
│ ┌──────────────────────────────────────────────────┐         │
│ │ jobs table:                                      │         │
│ │   status = 'completed'                           │         │
│ │   escrow_locked = false                          │         │
│ │                                                  │         │
│ │ job_escrow_transactions (2 records):             │         │
│ │   1. type='release_to_worker', amount=100       │         │
│ │   2. type='fee_collection', amount=5            │         │
│ └──────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

### Phase 4c: Automatic Release (Happy Path)
```
┌──────────────────────────────────────────────────────────────┐
│ AUTO-RELEASE AFTER 10 DAYS                                   │
│                                                              │
│ 1. Cron job runs every 15 minutes                           │
│ 2. Calls get_jobs_needing_auto_release()                    │
│ 3. Finds jobs where:                                         │
│    - status = 'submitted'                                    │
│    - release_scheduled_at <= NOW()                           │
│    - release_paused = false                                  │
│    - escrow_locked = true                                    │
│ 4. For each job:                                             │
│    a. Transfer payment_amount_tokens to worker               │
│    b. Transfer fee to platform fee wallet                    │
│    c. Update job status                                      │
│    d. Log transactions                                       │
│                                                              │
│ ┌──────────────────────────────────────────────────┐         │
│ │ Database Updates:                                │         │
│ │ jobs table:                                      │         │
│ │   status = 'completed'                           │         │
│ │   completed_at = NOW()                           │         │
│ │   escrow_locked = false                          │         │
│ │                                                  │         │
│ │ job_escrow_transactions (2 records):             │         │
│ │   1. transaction_type = 'release_to_worker'     │         │
│ │      from_wallet = escrow_wallet                 │         │
│ │      to_wallet = worker_wallet                   │         │
│ │      amount_tokens = 100                         │         │
│ │      status = 'confirmed'                        │         │
│ │                                                  │         │
│ │   2. transaction_type = 'fee_collection'        │         │
│ │      from_wallet = escrow_wallet                 │         │
│ │      to_wallet = fee_wallet                      │         │
│ │      amount_tokens = 5                           │         │
│ │      status = 'confirmed'                        │         │
│ └──────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Helper Functions

### Database Functions (Created in Migration 029)

```sql
-- Quick escrow check
SELECT job_has_active_escrow('job-uuid-here');
→ Returns: true/false

-- Time until auto-release
SELECT time_until_release('job-uuid-here');
→ Returns: '2 days 5 hours 30 minutes'

-- Check if overdue
SELECT is_release_overdue('job-uuid-here');
→ Returns: true/false

-- Get all jobs needing release (for cron)
SELECT * FROM get_jobs_needing_auto_release();
→ Returns: TABLE(job_id, release_scheduled_at, time_overdue)
```

### Platform Settings Functions (Created in Migration 028)

```sql
-- Get setting value
SELECT get_platform_setting('fee_percentage');
→ Returns: '5.0'

-- Update setting (admin only)
SELECT update_platform_setting('fee_percentage', '4.5', 'admin_wallet');
→ Returns: true/false

-- Check admin role
SELECT get_admin_role('wallet_address');
→ Returns: 'super_admin' | 'moderator' | NULL

-- Check if wallet is admin
SELECT is_admin_wallet('wallet_address');
→ Returns: true/false
```

---

## 📍 Key Indexes

### Jobs Table Indexes (Migration 029)
```sql
-- Fast escrow lookups
idx_jobs_escrow_locked     ON (escrow_locked, created_at)
idx_jobs_escrow_status     ON (escrow_locked, status, created_at)

-- Deadline monitoring
idx_jobs_hard_deadline     ON (hard_deadline, status)

-- Auto-release cron
idx_jobs_release_scheduled ON (release_scheduled_at, release_paused, status)

-- Admin monitoring
idx_jobs_release_paused    ON (release_paused, release_paused_at)
```

### Other Indexes (Migration 028)
```sql
-- Platform settings
idx_platform_settings_key  ON (setting_key)

-- Admin wallets
idx_admin_wallets_address  ON (wallet_address)
idx_admin_wallets_active   ON (is_active)

-- Escrow transactions
idx_job_escrow_tx_job      ON (job_id)
idx_job_escrow_tx_status   ON (status)
idx_job_escrow_tx_type     ON (transaction_type)
```

---

## 🎯 Common Query Patterns

### Find jobs with active escrow
```typescript
const { data } = await supabase
  .from('jobs')
  .select('*')
  .eq('escrow_locked', true);
```

### Get jobs needing auto-release
```typescript
const { data } = await supabase
  .rpc('get_jobs_needing_auto_release');
```

### Get job with time until release
```typescript
const { data: job } = await supabase
  .from('jobs')
  .select('*')
  .eq('id', jobId)
  .single();

const { data: timeUntil } = await supabase
  .rpc('time_until_release', { p_job_id: jobId });
```

### Get transaction history for a job
```typescript
const { data } = await supabase
  .from('job_escrow_transactions')
  .select('*')
  .eq('job_id', jobId)
  .order('created_at', { ascending: false });
```

### Check if user is admin
```typescript
const { data: isAdmin } = await supabase
  .rpc('is_admin_wallet', { p_wallet_address: walletAddress });
```

---

## 🔐 Security Model

### Row Level Security (RLS)
- ✅ Jobs table: Poster/worker/admin access
- ✅ Platform settings: Admin-only updates
- ✅ Admin wallets: Read-only for users
- ✅ Escrow transactions: Read-only audit trail

### Function Security
- All helper functions use `SECURITY DEFINER`
- Only authorized wallets can update platform settings
- Admin checks enforce role-based access

### Transaction Validation
- Escrow lock requires on-chain verification
- Transaction signatures stored for audit
- Retry mechanism for failed transactions

---

## 📊 Monitoring Dashboard (To Build)

### Admin Dashboard View
```
┌────────────────────────────────────────────────────────┐
│ ESCROW SYSTEM OVERVIEW                                 │
├────────────────────────────────────────────────────────┤
│ Total Value Locked:                                    │
│   - SOL: 1,234.56 ($45,678)                           │
│   - USDC: 9,876.54 ($9,876)                           │
│   - NUBCAT: 50,000,000 ($12,345)                      │
│                                                        │
│ Active Escrows: 42 jobs                               │
│ Pending Auto-Release: 8 jobs                          │
│ Paused Releases: 3 jobs (2 disputes, 1 revision)      │
│                                                        │
│ Last 24 Hours:                                         │
│   - Locks: 15 jobs                                     │
│   - Releases: 12 jobs                                  │
│   - Refunds: 2 jobs                                    │
│   - Fees Collected: 245.67 tokens                      │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Implementation Roadmap

### ✅ Phase 1: Database Foundation (COMPLETE)
- Migration 028: Core escrow tables
- Migration 029: Job escrow fields
- TypeScript types updated
- Documentation created

### ⏳ Phase 2: Job Creation with Escrow (NEXT)
- Update CreateJobModal.tsx
- Implement token transfer logic
- Set escrow fields on success
- Error handling & retries

### ⏳ Phase 3: Auto-Release System
- Create cron endpoint
- Implement payment release logic
- Transaction logging
- Deploy cron schedule (15 min)

### ⏳ Phase 4: Job Detail Enhancements
- Escrow status display
- Countdown timer
- Revision request button
- Manual release button

### ⏳ Phase 5: Admin Controls
- Admin dashboard page
- Manual release/refund
- Pause/unpause controls
- Transaction audit log

### ⏳ Phase 6: Testing & QA
- Unit tests
- Integration tests
- E2E tests (Playwright)
- Security audit

---

## 📚 Related Documentation

- **Field Guide**: `JOB_ESCROW_FIELDS_GUIDE.md`
- **Quick Reference**: `JOB_ESCROW_FIELDS_COMPLETE.md`
- **Migration Success**: `MIGRATION_029_ESCROW_FIELDS_SUCCESS.md`
- **Foundation**: `JOB_ESCROW_SYSTEM_FOUNDATION.md`
- **Quick Ref (028)**: `JOB_ESCROW_QUICK_REFERENCE.md`

---

## 🎉 Summary

The Job Escrow System is now fully architected with:
- **3 new tables** (platform_settings, admin_wallets, job_escrow_transactions)
- **14 new job fields** (escrow tracking, deadlines, release controls, revisions, fees)
- **10 indexes** (optimized for common queries)
- **8 helper functions** (escrow checks, admin controls)
- **4 check constraints** (data validation)
- **Complete audit trail** (all transactions logged)
- **Admin controls** (manual override capability)
- **Auto-release system** (10-day countdown)

**Status**: 🟢 Database foundation complete, ready for UI implementation

**Next Step**: Implement escrow lock in `CreateJobModal.tsx`






