# Job Escrow System - Quick Start Guide

**For Developers** 🚀

---

## 🎯 What Is This?

A complete system that locks tokens in escrow when jobs are posted, preventing rug pulls and ensuring worker payment.

---

## 📦 Key Files

```
lib/
  ├── solana/
  │   └── escrow-transfer.ts      # Token transfer to escrow
  ├── job-drafts.ts                # Draft recovery
  └── platform-settings.ts         # Config fetcher

components/
  ├── CreateJobModal.tsx           # Job creation with escrow
  └── DraftRecoveryBanner.tsx      # Recovery UI

app/
  └── api/
      └── jobs/
          └── create/
              └── route.ts         # Job creation API

supabase-migrations/
  └── 033_create_job_drafts_table.sql  # Draft recovery table
```

---

## 🚀 Quick Usage

### 1. Create Job with Escrow

```typescript
import { CreateJobModal } from '@/components/CreateJobModal'

<CreateJobModal
  isOpen={open}
  onClose={handleClose}
  mode="create"
  projectId={projectId}
  tokenMint="So11111111111111111111111111111111111111112"  // SOL
  tokenSymbol="SOL"
  walletAddress={wallet.address}
  onJobCreated={handleJobCreated}
/>
```

**User Flow:**
1. Fill form
2. Click "Review & Lock Tokens"
3. See confirmation with escrow breakdown
4. Click "Confirm & Lock Tokens"
5. Approve in wallet
6. Job created ✅

---

### 2. Add Recovery Banner

```typescript
import { DraftRecoveryBanner } from '@/components/DraftRecoveryBanner'

export default function JobsPage() {
  const { address } = useWallet()
  
  return (
    <div>
      {address && (
        <DraftRecoveryBanner 
          walletAddress={address} 
          projectId={projectId}
        />
      )}
      
      {/* Rest of page */}
    </div>
  )
}
```

**Shows When:**
- User has drafts where escrow succeeded but job creation failed
- One-click recovery

---

### 3. Use Escrow Functions

```typescript
import { 
  transferToEscrow, 
  validateEscrowTransfer,
  calculateEscrowAmount 
} from '@/lib/solana/escrow-transfer'

// Calculate total (payment + fee)
const total = calculateEscrowAmount(100, 5) // 105

// Validate balance before transfer
const validation = await validateEscrowTransfer(
  connection,
  wallet.publicKey,
  tokenMint,
  total,
  9 // decimals
)

if (!validation.valid) {
  console.error(validation.error)
  return
}

// Transfer to escrow
const result = await transferToEscrow(
  {
    connection,
    senderWallet: wallet.publicKey,
    tokenMint,
    amount: total,
    decimals: 9
  },
  wallet.signTransaction
)

if (result.success) {
  console.log('Signature:', result.signature)
}
```

---

### 4. Use Job Drafts

```typescript
import { 
  saveDraft, 
  getDraftsForRecovery,
  retryJobCreationFromDraft
} from '@/lib/job-drafts'

// Save draft on error
try {
  const escrowResult = await transferToEscrow(...)
  await createJob(...)
} catch (error) {
  if (escrowResult?.signature) {
    await saveDraft(walletAddress, projectId, jobData, escrowResult.signature)
  }
}

// Load drafts
const drafts = await getDraftsForRecovery(walletAddress)

// Recover a draft
const job = await retryJobCreationFromDraft(draft)
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=xxx

# Optional (fetched from DB if not set)
ESCROW_WALLET_ADDRESS=GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S
```

### Platform Settings (Database)

```sql
-- Check current settings
SELECT * FROM platform_settings;

-- Expected rows:
-- fee_percentage: 5.0
-- escrow_wallet_address: GxPUe7...
-- fee_wallet_address: GxPUe7...
```

---

## 📊 Database Schema

### Jobs Table (Extended)

```typescript
interface Job {
  // Existing fields
  id: string
  project_id: string
  poster_wallet: string
  title: string
  description: string
  payment_amount_tokens: number
  
  // NEW: Escrow fields
  escrow_locked: boolean
  escrow_tx_signature: string | null
  escrow_amount_tokens: number | null
  escrow_token_mint: string | null
  fee_percentage_at_creation: number
  poster_desired_completion: string | null
}
```

### Job Drafts Table

```typescript
interface JobDraft {
  id: string
  poster_wallet: string
  project_id: string
  draft_data: JobDraftData
  escrow_tx_signature: string | null
  recovery_status: 'pending' | 'draft' | 'needs_recovery' | 'recovered' | 'failed'
  created_at: string
  updated_at: string
}
```

---

## 🔍 How It Works

### Escrow Flow

```
1. User fills job form
   ↓
2. Pre-validation (balance checks)
   ↓
3. Show confirmation screen
   ↓
4. User approves
   ↓
5. Transfer tokens to escrow wallet
   - Creates ATA if needed
   - Sends tokens
   - Waits for confirmation
   ↓
6. Create job in database
   - Set escrow_locked = true
   - Store tx signature
   ↓
7. Log to job_escrow_transactions
   ↓
8. Success!
```

### Recovery Flow

```
1. Escrow succeeds, job creation fails
   ↓
2. Save draft with tx signature
   ↓
3. Show recovery banner
   ↓
4. User clicks "Recover"
   ↓
5. Retry job creation with existing signature
   - API verifies signature on-chain
   - Creates job
   - Marks draft as recovered
   ↓
6. Success!
```

---

## 🚨 Error Handling

### Common Errors

**Insufficient SOL:**
```
"Insufficient SOL for transaction fees (need at least 0.01 SOL)"
```
**Fix:** Add more SOL to wallet

**Insufficient Tokens:**
```
"Insufficient token balance. You have 50 but need 105"
```
**Fix:** Add more tokens to wallet

**Transaction Rejected:**
```
"Transaction was rejected by user"
```
**Fix:** User needs to approve in wallet

**Escrow Success, Job Fail:**
```
"Tokens were locked successfully, but job creation failed.
Your progress has been saved and can be recovered."
```
**Fix:** Check recovery banner and click "Recover"

---

## 🧪 Testing

### Test on Devnet

```bash
# 1. Switch to devnet
# In wallet: Settings → Network → Devnet

# 2. Get devnet SOL
# Visit: https://faucet.solana.com

# 3. Get devnet tokens
# Mint test tokens or use existing devnet token

# 4. Create job
# Fill form → Review → Confirm → Approve in wallet

# 5. Check Solscan
# Visit: https://solscan.io/?cluster=devnet
# Paste transaction signature

# 6. Verify database
SELECT * FROM jobs WHERE escrow_locked = true ORDER BY created_at DESC LIMIT 1;

# 7. Test recovery
# Disconnect internet after escrow succeeds
# Should save draft and show recovery banner
```

---

## 📈 Monitoring

### Key Queries

```sql
-- Jobs with escrow locked
SELECT COUNT(*) FROM jobs WHERE escrow_locked = true;

-- Recent escrow transactions
SELECT * FROM job_escrow_transactions 
ORDER BY confirmed_at DESC LIMIT 10;

-- Drafts needing recovery
SELECT COUNT(*) FROM job_drafts 
WHERE recovery_status = 'needs_recovery';

-- Total value locked in escrow
SELECT 
  token_mint,
  SUM(escrow_amount_tokens) as total_locked
FROM jobs 
WHERE escrow_locked = true 
  AND status IN ('open', 'assigned', 'in_progress')
GROUP BY token_mint;
```

---

## 🎯 Quick Reference

### Escrow Amounts

```
Payment: 100 tokens
Fee (5%): 5 tokens
Total Locked: 105 tokens
Worker Receives: 100 tokens
Platform Receives: 5 tokens
```

### Transaction Costs

```
SOL needed:
- Transaction fee: ~0.00001 SOL
- ATA creation (if needed): ~0.00203 SOL
- Total recommended: >= 0.01 SOL
```

### Status Values

**Jobs:**
- `open` - Accepting applications
- `assigned` - Worker selected
- `in_progress` - Work started
- `completed` - Work submitted
- `cancelled` - Job cancelled

**Drafts:**
- `pending` - Not submitted yet
- `draft` - User saved draft
- `needs_recovery` - Escrow succeeded, job failed
- `recovered` - Successfully recovered
- `failed` - Recovery failed

---

## 🔗 Related Docs

- **ESCROW_CONFIRMATION_SCREEN_COMPLETE.md** - UI details
- **ESCROW_TRANSFER_UTILITY_COMPLETE.md** - Transfer functions
- **DRAFT_RECOVERY_SYSTEM_COMPLETE.md** - Recovery system
- **API_JOBS_CREATE_COMPLETE.md** - API endpoint
- **JOB_ESCROW_SPRINT_1_COMPLETE.md** - Full sprint summary

---

## 💡 Tips

1. **Always validate before transfer**
   - Check SOL balance >= 0.01
   - Check token balance >= total amount
   - Show user clear error if insufficient

2. **Wait for confirmation**
   - Don't create job until transfer confirmed
   - Use `confirmed` commitment level
   - Show loading state

3. **Save drafts on error**
   - If escrow succeeds but job fails
   - Store transaction signature
   - User can recover later

4. **Log everything**
   - Use console.log for debugging
   - Log to job_escrow_transactions
   - Store transaction signatures

5. **User-friendly errors**
   - Clear messages
   - Action items
   - Transaction signatures for support

---

## 🆘 Troubleshooting

**Modal won't open:**
- Check wallet connected
- Check all required props passed

**Validation fails:**
- Check RPC connection
- Check wallet has sufficient balance
- Check token mint address correct

**Transfer fails:**
- Check wallet connected
- Check user approved transaction
- Check network not congested

**Job creation fails:**
- Check database connection
- Check all required fields provided
- Check logs for specific error

**Recovery doesn't work:**
- Check draft exists in database
- Check transaction signature valid
- Check API endpoint accessible

---

## ✅ Checklist

Before deploying:

- [ ] Migration run on database
- [ ] Platform settings configured
- [ ] Environment variables set
- [ ] RPC URL configured
- [ ] Service role key set
- [ ] Escrow wallet address set
- [ ] Test on devnet
- [ ] Error handling tested
- [ ] Recovery flow tested
- [ ] Monitoring queries prepared

---

**Ready to build? Let's go!** 🚀







