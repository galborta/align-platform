# Database Types Quick Reference

**Quick lookup for escrow system TypeScript types**

---

## 📦 Import Statement

```typescript
import { Database } from '@/types/database';
```

---

## 🗂️ Table Types

### platform_settings
```typescript
type PlatformSetting = Database['public']['Tables']['platform_settings']['Row'];
type NewPlatformSetting = Database['public']['Tables']['platform_settings']['Insert'];
type UpdatePlatformSetting = Database['public']['Tables']['platform_settings']['Update'];

// Enum types
type SettingKey = 'fee_percentage' | 'fee_wallet_address' | 'escrow_wallet_address';
```

### admin_wallets
```typescript
type AdminWallet = Database['public']['Tables']['admin_wallets']['Row'];
type NewAdminWallet = Database['public']['Tables']['admin_wallets']['Insert'];
type UpdateAdminWallet = Database['public']['Tables']['admin_wallets']['Update'];

// Enum types
type AdminRole = 'super_admin' | 'moderator';
```

### job_escrow_transactions
```typescript
type EscrowTransaction = Database['public']['Tables']['job_escrow_transactions']['Row'];
type NewEscrowTransaction = Database['public']['Tables']['job_escrow_transactions']['Insert'];
type UpdateEscrowTransaction = Database['public']['Tables']['job_escrow_transactions']['Update'];

// Enum types
type TransactionType = 'lock' | 'release_to_worker' | 'refund_to_poster' | 'fee_collection' | 'partial_release';
type TransactionStatus = 'pending' | 'confirmed' | 'failed';
```

### jobs (updated)
```typescript
type Job = Database['public']['Tables']['jobs']['Row'];
type NewJob = Database['public']['Tables']['jobs']['Insert'];
type UpdateJob = Database['public']['Tables']['jobs']['Update'];

// New escrow fields available:
// - escrow_locked: boolean
// - escrow_tx_signature: string | null
// - escrow_amount_tokens: number | null
// - escrow_token_mint: string | null
// - poster_desired_completion: string | null
// - worker_committed_completion: string | null
// - hard_deadline: string | null
// - release_scheduled_at: string | null
// - release_paused: boolean
// - release_paused_by: string | null
// - release_paused_at: string | null
// - revision_requests_count: number
// - last_revision_requested_at: string | null
// - fee_percentage_at_creation: number
```

### job_disputes (updated)
```typescript
type JobDispute = Database['public']['Tables']['job_disputes']['Row'];
type NewJobDispute = Database['public']['Tables']['job_disputes']['Insert'];
type UpdateJobDispute = Database['public']['Tables']['job_disputes']['Update'];

// New admin resolution fields available:
// - admin_wallet: string | null
// - admin_resolution_notes: string | null
// - admin_decided_at: string | null
// - worker_percentage: number | null (0-100)
// - poster_percentage: number | null (0-100)
```

---

## 🔧 Common Patterns

### Query
```typescript
const { data } = await supabase
  .from('platform_settings')
  .select('*')
  .eq('setting_key', 'fee_percentage')
  .single();
// data is typed as PlatformSetting | null
```

### Insert
```typescript
const { data, error } = await supabase
  .from('admin_wallets')
  .insert({
    wallet_address: 'abc123',
    role: 'moderator',
    added_by: 'xyz789'
  });
```

### Update
```typescript
const { data, error } = await supabase
  .from('jobs')
  .update({
    escrow_locked: true,
    hard_deadline: new Date().toISOString()
  })
  .eq('id', jobId);
```

---

## 📊 Enum Reference

| Field | Values |
|-------|--------|
| `setting_key` | `fee_percentage`, `fee_wallet_address`, `escrow_wallet_address` |
| `admin_role` | `super_admin`, `moderator` |
| `transaction_type` | `lock`, `release_to_worker`, `refund_to_poster`, `fee_collection`, `partial_release` |
| `transaction_status` | `pending`, `confirmed`, `failed` |
| `job_status` | `open`, `assigned`, `submitted`, `completed`, `disputed`, `cancelled` |
| `dispute_outcome` | `release_to_worker`, `refund_to_poster` |

---

## 🎯 Type Safety Examples

### ✅ Good - Type Safe
```typescript
const settingKey: SettingKey = 'fee_percentage'; // ✅ Valid
const role: AdminRole = 'super_admin'; // ✅ Valid
const status: TransactionStatus = 'confirmed'; // ✅ Valid
```

### ❌ Bad - Will Cause Type Error
```typescript
const settingKey: SettingKey = 'invalid_key'; // ❌ Type error
const role: AdminRole = 'admin'; // ❌ Type error
const status: TransactionStatus = 'success'; // ❌ Type error
```

---

## 🔍 Helper Function Examples

### Get Platform Fee
```typescript
async function getPlatformFee(): Promise<number> {
  const { data } = await supabase
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', 'fee_percentage')
    .single();
  
  return parseFloat(data?.setting_value || '5');
}
```

### Check Admin Status
```typescript
async function isUserAdmin(wallet: string): Promise<boolean> {
  const { data } = await supabase
    .from('admin_wallets')
    .select('is_active')
    .eq('wallet_address', wallet)
    .eq('is_active', true)
    .single();
  
  return !!data;
}
```

### Get Job Escrow Status
```typescript
interface EscrowStatus {
  locked: boolean
  amount: number | null
  deadline: Date | null
  isPaused: boolean
}

async function getJobEscrowStatus(jobId: string): Promise<EscrowStatus | null> {
  const { data: job } = await supabase
    .from('jobs')
    .select('escrow_locked, escrow_amount_tokens, hard_deadline, release_paused')
    .eq('id', jobId)
    .single();
  
  if (!job) return null;
  
  return {
    locked: job.escrow_locked,
    amount: job.escrow_amount_tokens,
    deadline: job.hard_deadline ? new Date(job.hard_deadline) : null,
    isPaused: job.release_paused
  };
}
```

---

## 📝 Field Descriptions

### Platform Settings
- **setting_key**: Unique identifier for the setting
- **setting_value**: String value (numeric values stored as strings)
- **updated_by**: Wallet address of admin who last modified

### Admin Wallets
- **wallet_address**: Solana wallet with admin privileges
- **role**: `super_admin` (full control) or `moderator` (limited)
- **is_active**: Can be deactivated without deletion

### Escrow Transactions
- **transaction_type**: Type of escrow operation
- **from_wallet** / **to_wallet**: Source and destination
- **amount_tokens**: Raw token amount (consider decimals)
- **tx_signature**: Solana transaction signature (null until sent)
- **status**: `pending` → `confirmed` or `failed`

### Job Escrow Fields
- **escrow_locked**: Whether funds are currently in escrow
- **hard_deadline**: Auto-release after this time
- **release_paused**: Paused by poster (revision) or admin
- **fee_percentage_at_creation**: Locked fee % (prevents retroactive changes)

### Dispute Resolution
- **admin_wallet**: Admin who resolved (null if community resolved)
- **worker_percentage** / **poster_percentage**: Must sum to 100
- **admin_resolution_notes**: Explanation for decision

---

For detailed documentation, see: [DATABASE_TYPES_COMPLETE.md](DATABASE_TYPES_COMPLETE.md)













