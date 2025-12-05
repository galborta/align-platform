# 🚀 Job Escrow System - Quick Reference Guide

**For developers integrating the escrow system**

---

## 📋 Quick Facts

- **3 New Tables**: `platform_settings`, `admin_wallets`, `job_escrow_transactions`
- **10 New Indexes**: Optimized for common queries
- **4 Helper Functions**: Admin checks, setting management
- **RLS Enabled**: Row-level security on all tables
- **Migration Applied**: `028_create_job_escrow_system.sql` ✅

---

## 🔑 TypeScript Types

```typescript
import { Database } from '@/types/database'

// Type aliases for convenience
type PlatformSetting = Database['public']['Tables']['platform_settings']['Row']
type AdminWallet = Database['public']['Tables']['admin_wallets']['Row']
type EscrowTransaction = Database['public']['Tables']['job_escrow_transactions']['Row']
```

---

## ⚙️ Platform Settings

### Get Fee Percentage

```typescript
const { data: feePercentage } = await supabase
  .rpc('get_platform_setting', {
    p_setting_key: 'fee_percentage'
  })

const fee = parseFloat(feePercentage) // 5.0
```

### Get Escrow Wallet Address

```typescript
const { data: escrowWallet } = await supabase
  .rpc('get_platform_setting', {
    p_setting_key: 'escrow_wallet_address'
  })
```

### Update Setting (Admin Only)

```typescript
// Check admin status first
const { data: role } = await supabase
  .rpc('get_admin_role', {
    p_wallet_address: walletAddress
  })

if (role === 'super_admin') {
  await supabase.rpc('update_platform_setting', {
    p_setting_key: 'fee_percentage',
    p_setting_value: '3.5',
    p_updated_by: walletAddress
  })
}
```

---

## 👤 Admin Management

### Check if User is Admin

```typescript
const { data: isAdmin } = await supabase
  .rpc('is_admin_wallet', {
    p_wallet_address: walletAddress
  })

if (isAdmin) {
  // Show admin controls
}
```

### Get Admin Role

```typescript
const { data: role } = await supabase
  .rpc('get_admin_role', {
    p_wallet_address: walletAddress
  })

// role: 'super_admin' | 'moderator' | null
```

### Add New Admin

```typescript
const { error } = await supabase
  .from('admin_wallets')
  .insert({
    wallet_address: newAdminWallet,
    role: 'moderator',
    added_by: superAdminWallet,
    is_active: true
  })
```

### Deactivate Admin

```typescript
await supabase
  .from('admin_wallets')
  .update({ is_active: false })
  .eq('wallet_address', adminToDeactivate)
```

---

## 💰 Escrow Transactions

### Create Transaction Record

```typescript
const { data: transaction, error } = await supabase
  .from('job_escrow_transactions')
  .insert({
    job_id: jobId,
    transaction_type: 'lock',
    from_wallet: posterWallet,
    to_wallet: escrowWallet,
    amount_tokens: 1050,
    token_mint: tokenMintAddress,
    token_symbol: 'SOL',
    status: 'pending'
  })
  .select()
  .single()
```

### Update Transaction Status

```typescript
// After Solana transfer succeeds
await supabase
  .from('job_escrow_transactions')
  .update({
    status: 'confirmed',
    tx_signature: solanaSignature,
    confirmed_at: new Date().toISOString()
  })
  .eq('id', transactionId)
```

### Mark Transaction as Failed

```typescript
await supabase
  .from('job_escrow_transactions')
  .update({
    status: 'failed',
    error_message: error.message,
    retry_count: currentRetryCount + 1
  })
  .eq('id', transactionId)
```

### Get Job Transactions

```typescript
const { data: transactions } = await supabase
  .from('job_escrow_transactions')
  .select('*')
  .eq('job_id', jobId)
  .order('created_at', { ascending: false })
```

### Get Pending Transactions

```typescript
const { data: pending } = await supabase
  .from('job_escrow_transactions')
  .select('*')
  .eq('status', 'pending')
  .order('created_at', { ascending: true })
```

---

## 📊 Transaction Types

| Type | Description | When to Use |
|------|-------------|-------------|
| `lock` | Poster → Escrow | Job creation |
| `release_to_worker` | Escrow → Worker | Job completion |
| `refund_to_poster` | Escrow → Poster | Cancellation/dispute |
| `fee_collection` | Escrow → Fee wallet | Platform fee |
| `partial_release` | Escrow → Worker | Milestone payments |

---

## 🔐 Transaction Statuses

| Status | Description | Next Actions |
|--------|-------------|--------------|
| `pending` | Awaiting confirmation | Poll for confirmation |
| `confirmed` | On-chain verified | Update job status |
| `failed` | Transaction failed | Retry or notify user |

---

## 💡 Common Patterns

### Pattern 1: Lock Funds on Job Creation

```typescript
// 1. Calculate total amount (payment + fee)
const jobAmount = 1000
const feePercentage = 5.0
const feeAmount = jobAmount * (feePercentage / 100)
const totalAmount = jobAmount + feeAmount

// 2. Create transaction record
const { data: txRecord } = await supabase
  .from('job_escrow_transactions')
  .insert({
    job_id: jobId,
    transaction_type: 'lock',
    from_wallet: posterWallet,
    to_wallet: escrowWallet,
    amount_tokens: totalAmount,
    token_mint: tokenMint,
    token_symbol: tokenSymbol,
    status: 'pending'
  })
  .select()
  .single()

// 3. Execute Solana transfer (see TipModal.tsx for reference)
const signature = await executeSolanaTransfer(/* params */)

// 4. Update record with signature
await supabase
  .from('job_escrow_transactions')
  .update({
    tx_signature: signature,
    status: 'confirmed',
    confirmed_at: new Date().toISOString()
  })
  .eq('id', txRecord.id)
```

---

### Pattern 2: Release Payment on Completion

```typescript
// 1. Get fee percentage
const { data: feePercentageStr } = await supabase
  .rpc('get_platform_setting', {
    p_setting_key: 'fee_percentage'
  })
const feePercentage = parseFloat(feePercentageStr)

// 2. Calculate amounts
const jobAmount = job.payment_amount_tokens
const feeAmount = jobAmount * (feePercentage / 100)

// 3. Create worker payment transaction
const { data: workerTx } = await supabase
  .from('job_escrow_transactions')
  .insert({
    job_id: jobId,
    transaction_type: 'release_to_worker',
    from_wallet: escrowWallet,
    to_wallet: workerWallet,
    amount_tokens: jobAmount,
    token_mint: job.token_mint,
    token_symbol: job.token_symbol,
    status: 'pending'
  })
  .select()
  .single()

// 4. Create fee collection transaction
const { data: feeTx } = await supabase
  .from('job_escrow_transactions')
  .insert({
    job_id: jobId,
    transaction_type: 'fee_collection',
    from_wallet: escrowWallet,
    to_wallet: feeWallet,
    amount_tokens: feeAmount,
    token_mint: job.token_mint,
    token_symbol: job.token_symbol,
    status: 'pending'
  })
  .select()
  .single()

// 5. Execute both transfers
// 6. Update both records to 'confirmed'
// 7. Update job status to 'completed'
```

---

### Pattern 3: Refund on Cancellation

```typescript
// 1. Get original lock transaction
const { data: lockTx } = await supabase
  .from('job_escrow_transactions')
  .select('*')
  .eq('job_id', jobId)
  .eq('transaction_type', 'lock')
  .eq('status', 'confirmed')
  .single()

// 2. Create refund transaction
const { data: refundTx } = await supabase
  .from('job_escrow_transactions')
  .insert({
    job_id: jobId,
    transaction_type: 'refund_to_poster',
    from_wallet: escrowWallet,
    to_wallet: lockTx.from_wallet, // Original poster
    amount_tokens: lockTx.amount_tokens, // Full amount
    token_mint: lockTx.token_mint,
    token_symbol: lockTx.token_symbol,
    status: 'pending'
  })
  .select()
  .single()

// 3. Execute refund transfer
// 4. Update record to 'confirmed'
// 5. Update job status to 'cancelled'
```

---

## 🛡️ Admin Controls

### View All Transactions

```typescript
// For admin dashboard
const { data: allTransactions } = await supabase
  .from('job_escrow_transactions')
  .select(`
    *,
    jobs!inner (
      id,
      title,
      poster_wallet,
      assigned_to
    )
  `)
  .order('created_at', { ascending: false })
  .limit(100)
```

### Retry Failed Transaction

```typescript
async function retryFailedTransaction(transactionId: string) {
  // 1. Get transaction details
  const { data: tx } = await supabase
    .from('job_escrow_transactions')
    .select('*')
    .eq('id', transactionId)
    .single()

  // 2. Check if retry limit reached
  if (tx.retry_count >= 3) {
    throw new Error('Max retries reached')
  }

  // 3. Reset to pending
  await supabase
    .from('job_escrow_transactions')
    .update({
      status: 'pending',
      error_message: null
    })
    .eq('id', transactionId)

  // 4. Attempt transfer again
  // 5. Update based on result
}
```

### Manual Release (Emergency)

```typescript
async function manualRelease(
  adminWallet: string,
  jobId: string,
  recipient: 'worker' | 'poster'
) {
  // 1. Verify admin
  const { data: role } = await supabase
    .rpc('get_admin_role', {
      p_wallet_address: adminWallet
    })

  if (role !== 'super_admin') {
    throw new Error('Unauthorized')
  }

  // 2. Create manual release transaction
  // 3. Execute transfer
  // 4. Log admin action
  await supabase
    .from('admin_logs')
    .insert({
      admin_wallet: adminWallet,
      action: 'manual_escrow_release',
      entity_type: 'job',
      entity_id: jobId,
      details: {
        recipient,
        reason: 'Manual intervention'
      }
    })
}
```

---

## 📈 Analytics Queries

### Total Escrow Volume

```typescript
const { data: volume } = await supabase
  .from('job_escrow_transactions')
  .select('amount_tokens, token_symbol')
  .eq('status', 'confirmed')
```

### Platform Fees Collected

```typescript
const { data: fees } = await supabase
  .from('job_escrow_transactions')
  .select('amount_tokens, amount_usd')
  .eq('transaction_type', 'fee_collection')
  .eq('status', 'confirmed')
```

### Failed Transaction Rate

```typescript
const { count: total } = await supabase
  .from('job_escrow_transactions')
  .select('*', { count: 'exact', head: true })

const { count: failed } = await supabase
  .from('job_escrow_transactions')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'failed')

const failureRate = (failed / total) * 100
```

---

## 🔍 Debugging

### Check Transaction Status

```typescript
const { data: tx } = await supabase
  .from('job_escrow_transactions')
  .select('*')
  .eq('id', transactionId)
  .single()

console.log({
  status: tx.status,
  signature: tx.tx_signature,
  error: tx.error_message,
  retries: tx.retry_count
})
```

### Verify On-Chain

```typescript
import { Connection } from '@solana/web3.js'

const connection = new Connection(rpcEndpoint)
const txInfo = await connection.getTransaction(tx.tx_signature)

if (txInfo?.meta?.err) {
  console.error('Transaction failed on-chain:', txInfo.meta.err)
} else {
  console.log('Transaction confirmed on-chain')
}
```

---

## ⚠️ Important Notes

1. **Always check admin status** before allowing admin actions
2. **Store transaction signatures** for on-chain verification
3. **Implement retry logic** for failed transactions (max 3 retries)
4. **Log all admin actions** in `admin_logs` table
5. **Calculate fees dynamically** from platform_settings
6. **Validate amounts** before creating transactions
7. **Handle race conditions** when multiple transactions pending
8. **Poll for confirmations** after submitting to blockchain

---

## 🎯 Next Steps

### Phase 1: Escrow Library
Create `lib/escrow.ts` with these functions:
- `lockJobFunds(jobId, amount, token)`
- `releaseToWorker(jobId)`
- `refundToPoster(jobId)`
- `calculateTotalWithFee(amount)`
- `retryFailedTransaction(txId)`

### Phase 2: Integration
Update existing job functions:
- `createJob()` → call `lockJobFunds()`
- Release payment → call `releaseToWorker()`
- Cancel job → call `refundToPoster()`

### Phase 3: Admin Dashboard
Build admin UI for:
- View all transactions
- Manage platform settings
- Add/remove admins
- Manual interventions

---

## 📚 Related Files

- **Migration**: `supabase-migrations/028_create_job_escrow_system.sql`
- **Types**: `types/database.ts`
- **Documentation**: `JOB_ESCROW_SYSTEM_FOUNDATION.md`
- **Reference for Solana transfers**: `components/TipModal.tsx`

---

## 🆘 Common Issues

### Issue: Transaction stuck in pending
**Solution**: Implement polling with timeout, retry after 30 seconds

### Issue: Fee calculation wrong
**Solution**: Always fetch latest fee_percentage from platform_settings

### Issue: Admin check fails
**Solution**: Ensure `is_active = true` in admin_wallets table

### Issue: Duplicate transaction signatures
**Solution**: Check for existing signature before inserting

---

**Created**: November 27, 2024  
**Status**: ✅ Ready for Implementation  
**Next**: Build `lib/escrow.ts`






