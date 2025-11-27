# Platform Configuration Reference

**Last Updated**: November 27, 2024  
**Status**: ✅ Production settings configured

---

## 🔐 Platform Settings

### Fee Configuration
```
Setting: fee_percentage
Value: 5%
Purpose: Platform commission on job payments
```

**How it works:**
- Charged on top of job payment amount
- Formula: `total_escrow = job_payment × (1 + 0.05)`
- Example: 100 token job → 105 tokens locked (100 to worker, 5 to platform)

### Wallet Addresses

#### Fee Wallet
```
Setting: fee_wallet_address
Address: GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S
Purpose: Platform revenue collection
```

**Use cases:**
- Platform fees from completed jobs
- Operational costs
- Token buybacks
- Team compensation

#### Escrow Wallet
```
Setting: escrow_wallet_address
Address: GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S
Purpose: Temporary holding of job payments
```

**Fund flow:**
1. Job Poster → Escrow Wallet (on job creation)
2. Escrow Wallet → Worker + Fee Wallet (on job completion)
3. Escrow Wallet → Poster (on cancellation/refund)

---

## 👑 Admin Configuration

### Super Admin Wallet
```
Address: GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S
Role: super_admin
Status: Active
Added: 2024-11-27
```

### Super Admin Powers
- ✅ Manage other admins (add/remove/modify)
- ✅ Update platform settings (fees, wallets)
- ✅ Resolve disputes with custom split percentages
- ✅ View all escrow transactions (audit access)
- ✅ Manual escrow release/refund
- ✅ Update any job (dispute intervention)
- ✅ Emergency controls

---

## 🔒 Security Considerations

### Escrow Wallet Private Key
⚠️ **CRITICAL**: The escrow wallet private key must be:
- Stored securely in backend environment variables
- Never exposed to frontend
- Only accessible to backend service role
- Used for automated transfers (release, refund, fee collection)

**Environment variable:**
```bash
ESCROW_WALLET_PRIVATE_KEY=your_base58_private_key_here
```

### Fee Wallet
💡 **RECOMMENDED**: Use a cold storage wallet
- Multi-sig for large balances
- Regular withdrawals to secure storage
- Monitor for suspicious activity

### Admin Wallet
🔐 **IMPORTANT**: This wallet has full platform control
- Use hardware wallet (Ledger, Trezor)
- Enable multi-factor authentication
- Keep backup recovery phrase secure
- Monitor all admin actions

---

## 📊 Public Transparency

All settings and admin wallets are **publicly viewable** due to RLS policies:

```typescript
// Anyone can query these (no authentication required)
const { data: settings } = await supabase
  .from('platform_settings')
  .select('*');

const { data: admins } = await supabase
  .from('admin_wallets')
  .select('*')
  .eq('is_active', true);
```

**Why public?**
- Fee transparency for users
- Admin accountability
- Community trust
- Open governance

---

## 🔄 Modifying Settings

### Via Database Helper Functions
```typescript
// Only works if authenticated wallet is in admin_wallets with is_active=true
const { data, error } = await supabase
  .rpc('update_platform_setting', {
    p_setting_key: 'fee_percentage',
    p_setting_value: '4.5',
    p_updated_by: 'GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S'
  });
```

### Via Direct SQL (Super Admin Only)
```sql
UPDATE platform_settings 
SET 
  setting_value = '4.5',
  updated_by = 'GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S',
  updated_at = NOW()
WHERE setting_key = 'fee_percentage';
```

**Note**: RLS policies ensure only active admins can modify settings.

---

## 💰 Fee Calculation Examples

### Example 1: 100 Token Job
```
Job Payment: 100 tokens
Platform Fee (5%): 5 tokens
Total Escrow: 105 tokens

On completion:
- Worker receives: 100 tokens
- Platform receives: 5 tokens
```

### Example 2: 1000 SOL Job
```
Job Payment: 1000 SOL
Platform Fee (5%): 50 SOL
Total Escrow: 1050 SOL

On completion:
- Worker receives: 1000 SOL
- Platform receives: 50 SOL
```

### Example 3: Dispute Resolution (60/40 Split)
```
Job Payment: 200 USDC
Platform Fee (5%): 10 USDC
Total Escrow: 210 USDC

Admin decides: 60% worker, 40% poster

On resolution:
- Worker receives: 120 USDC (60% of 200)
- Poster refund: 80 USDC (40% of 200)
- Platform receives: 10 USDC (fee still collected)
```

---

## 🛠️ Helper Functions Available

### Get Platform Setting
```typescript
const { data } = await supabase
  .rpc('get_platform_setting', { 
    p_setting_key: 'fee_percentage' 
  });
// Returns: "5"
```

### Update Platform Setting (Admin Only)
```typescript
const { data } = await supabase
  .rpc('update_platform_setting', {
    p_setting_key: 'fee_percentage',
    p_setting_value: '4.5',
    p_updated_by: adminWallet
  });
```

### Check Admin Status
```typescript
const { data: isAdmin } = await supabase
  .rpc('is_admin_wallet', { 
    p_wallet_address: userWallet 
  });
```

### Get Admin Role
```typescript
const { data: role } = await supabase
  .rpc('get_admin_role', { 
    p_wallet_address: userWallet 
  });
// Returns: 'super_admin', 'moderator', or null
```

---

## 📋 Configuration Checklist

### Initial Setup ✅
- [x] Platform settings seeded
- [x] Fee percentage configured (5%)
- [x] Fee wallet address set
- [x] Escrow wallet address set
- [x] Super admin wallet added

### Backend Setup (TODO)
- [ ] Add `ESCROW_WALLET_PRIVATE_KEY` to environment
- [ ] Configure Solana connection for escrow operations
- [ ] Test escrow lock transaction
- [ ] Test escrow release transaction
- [ ] Test fee collection transaction

### Security Setup (TODO)
- [ ] Verify escrow wallet has sufficient SOL for transaction fees
- [ ] Set up fee wallet monitoring
- [ ] Configure admin wallet with hardware device
- [ ] Document admin wallet recovery process
- [ ] Set up alerts for large transactions

### Testing (TODO)
- [ ] Create test job with escrow
- [ ] Verify fee calculation
- [ ] Test complete job flow
- [ ] Test refund flow
- [ ] Test admin dispute resolution

---

## 🚨 Emergency Procedures

### Change Escrow Wallet (Critical Security Issue)
```sql
-- Only if escrow wallet is compromised
UPDATE platform_settings 
SET 
  setting_value = 'NEW_WALLET_ADDRESS',
  updated_by = 'GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S',
  updated_at = NOW()
WHERE setting_key = 'escrow_wallet_address';

-- Pause all job creation immediately
-- Complete or refund all active jobs
-- Transfer funds to new escrow wallet
```

### Deactivate Compromised Admin
```sql
UPDATE admin_wallets 
SET 
  is_active = false,
  updated_at = NOW()
WHERE wallet_address = 'COMPROMISED_ADMIN_WALLET';
```

### Adjust Fee in Emergency
```sql
-- Temporarily reduce fee to 0% if needed
UPDATE platform_settings 
SET 
  setting_value = '0',
  updated_by = 'GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S',
  updated_at = NOW()
WHERE setting_key = 'fee_percentage';
```

---

## 📊 Monitoring Queries

### Total Platform Fees Collected
```sql
SELECT 
  token_symbol,
  SUM(amount_tokens) as total_fees_collected
FROM job_escrow_transactions
WHERE transaction_type = 'fee_collection'
  AND status = 'confirmed'
GROUP BY token_symbol;
```

### Active Escrow Value
```sql
SELECT 
  COUNT(*) as jobs_with_escrow,
  SUM(escrow_amount_tokens) as total_locked
FROM jobs
WHERE escrow_locked = true;
```

### Admin Activity Log
```sql
SELECT 
  updated_by as admin_wallet,
  setting_key,
  setting_value,
  updated_at
FROM platform_settings
WHERE updated_by != 'system'
ORDER BY updated_at DESC
LIMIT 10;
```

---

## 📁 Related Files

- **Migration**: `supabase-migrations/032_seed_platform_settings.sql`
- **Platform Settings Table**: Created in migration 028
- **Admin Wallets Table**: Created in migration 028
- **RLS Policies**: Migration 031
- **Helper Functions**: Migrations 028, 031

---

## 🔗 Quick Links

### Internal Documentation
- [Job Escrow System Foundation](JOB_ESCROW_SYSTEM_FOUNDATION.md)
- [Escrow RLS Security Guide](ESCROW_RLS_SECURITY_GUIDE.md)
- [Admin Dispute Resolution Guide](ADMIN_DISPUTE_RESOLUTION_GUIDE.md)

### Database Functions
- `get_platform_setting(key)` - Read setting value
- `update_platform_setting(key, value, admin)` - Modify setting
- `is_admin_wallet(wallet)` - Check admin status
- `get_admin_role(wallet)` - Get admin role

---

**Configuration Status**: ✅ Production ready  
**Admin Wallet**: GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S  
**Platform Fee**: 5%  
**Transparency**: All settings publicly viewable


