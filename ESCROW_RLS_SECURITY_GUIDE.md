# Escrow System RLS Security Guide

**Migration**: `031_add_escrow_system_rls.sql`  
**Date**: November 27, 2024  
**Status**: ✅ Deployed to database

---

## 🎯 Overview

This document details the Row Level Security (RLS) policies implemented for the job escrow system. RLS ensures that users can only access data they're authorized to see, providing database-level security beyond application logic.

---

## 🔒 Security Model

### Authentication Method
All policies use `auth.jwt() ->> 'wallet_address'` to identify the authenticated user. This assumes the JWT token contains the user's wallet address.

### Service Role
Backend operations (cron jobs, escrow processing) use `service_role` which bypasses RLS. This is checked via `auth.jwt() ->> 'role' = 'service_role'`.

### Admin Roles
- **super_admin**: Can manage admin_wallets, platform_settings
- **moderator**: Can manage disputes, view audit logs

---

## 📊 Table-by-Table Policies

### 1. `platform_settings` (4 policies)

#### SELECT: "Anyone can view platform settings"
```sql
USING (true)
```
**Purpose**: Public transparency  
**Allows**: Everyone to view fee percentages and wallet addresses  
**Rationale**: Users need to know fee structure before creating jobs

#### INSERT: "Active admins can insert settings"
```sql
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_wallets 
    WHERE wallet_address = auth.jwt() ->> 'wallet_address'
      AND is_active = true
  )
)
```
**Purpose**: Only active admins can add new settings  
**Requires**: Admin wallet with `is_active = true`

#### UPDATE: "Active admins can update settings"
```sql
USING (
  EXISTS (
    SELECT 1 FROM admin_wallets 
    WHERE wallet_address = auth.jwt() ->> 'wallet_address'
      AND is_active = true
  )
)
```
**Purpose**: Only active admins can modify settings  
**Requires**: Admin wallet with `is_active = true`

#### DELETE: "Active admins can delete settings"
```sql
USING (
  EXISTS (
    SELECT 1 FROM admin_wallets 
    WHERE wallet_address = auth.jwt() ->> 'wallet_address'
      AND is_active = true
  )
)
```
**Purpose**: Only active admins can remove settings  
**Requires**: Admin wallet with `is_active = true`

---

### 2. `admin_wallets` (5 policies)

#### SELECT: "Anyone can view admin wallets"
```sql
USING (true)
```
**Purpose**: Transparency and accountability  
**Allows**: Everyone to see who the admins are  
**Rationale**: Public trust requires knowing who has admin powers

#### INSERT: "Super admins can add admins"
```sql
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_wallets 
    WHERE wallet_address = auth.jwt() ->> 'wallet_address'
      AND role = 'super_admin'
      AND is_active = true
  )
)
```
**Purpose**: Only super_admins can add new admins  
**Requires**: Active super_admin role  
**Prevents**: Regular admins from adding new admins

#### UPDATE: "Super admins can update admins"
```sql
USING (
  EXISTS (
    SELECT 1 FROM admin_wallets 
    WHERE wallet_address = auth.jwt() ->> 'wallet_address'
      AND role = 'super_admin'
      AND is_active = true
  )
)
```
**Purpose**: Only super_admins can modify admin records  
**Use cases**: Deactivate admins, change roles  
**Requires**: Active super_admin role

#### DELETE: "Super admins can remove admins"
```sql
USING (
  EXISTS (
    SELECT 1 FROM admin_wallets 
    WHERE wallet_address = auth.jwt() ->> 'wallet_address'
      AND role = 'super_admin'
      AND is_active = true
  )
)
```
**Purpose**: Only super_admins can delete admin records  
**Requires**: Active super_admin role

---

### 3. `job_escrow_transactions` (4 policies)

#### SELECT: "Job parties can view transactions" (Policy 1 of 2)
```sql
USING (
  EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_escrow_transactions.job_id
      AND (
        jobs.poster_wallet = auth.jwt() ->> 'wallet_address'
        OR jobs.assigned_to = auth.jwt() ->> 'wallet_address'
      )
  )
)
```
**Purpose**: Job poster and worker can see their job's transactions  
**Allows**: Poster or assigned worker to view escrow transactions  
**Prevents**: Other users from seeing transaction details

#### SELECT: "Admins can view all transactions" (Policy 2 of 2)
```sql
USING (
  EXISTS (
    SELECT 1 FROM admin_wallets 
    WHERE wallet_address = auth.jwt() ->> 'wallet_address'
      AND is_active = true
  )
)
```
**Purpose**: Admin audit trail access  
**Allows**: Active admins to view all escrow transactions  
**Use case**: Dispute resolution, system monitoring

**Note**: The two SELECT policies are combined with OR logic, so a user can view transactions if they match EITHER policy.

#### INSERT: "Service role can insert transactions"
```sql
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
)
```
**Purpose**: Only backend can create transaction records  
**Allows**: Service role (backend) only  
**Prevents**: Users from manipulating transaction logs  
**Rationale**: Users might try to create fake transaction records

#### UPDATE: "Service role can update transactions"
```sql
USING (
  auth.jwt() ->> 'role' = 'service_role'
)
```
**Purpose**: Only backend can update transaction status  
**Allows**: Service role to mark transactions as confirmed/failed  
**Prevents**: Users from modifying transaction status

#### DELETE: No policy (immutable)
**Purpose**: Transactions are permanent audit log  
**Allows**: No one (not even admins or service role)  
**Rationale**: Audit logs must be immutable for compliance

---

### 4. `jobs` (5 policies)

#### SELECT: "Anyone can view jobs" (existing, unchanged)
```sql
USING (true)
```
**Purpose**: Public job board  
**Allows**: Everyone to browse jobs

#### INSERT: "Poster can create jobs" (existing, unchanged)
```sql
WITH CHECK (true)
```
**Purpose**: Anyone can create jobs  
**Note**: Token holder validation happens in application logic

#### UPDATE: "Poster can update own jobs with restrictions" (updated)
```sql
USING (
  poster_wallet = auth.jwt() ->> 'wallet_address'
  AND (
    escrow_locked = false 
    OR status IN ('completed', 'cancelled', 'disputed')
  )
  AND (
    status NOT IN ('assigned', 'submitted')
    OR escrow_locked = false
  )
)
WITH CHECK (
  poster_wallet = auth.jwt() ->> 'wallet_address'
)
```
**Purpose**: Poster can update their jobs with escrow protection  
**Allows**: Poster to update if:
  - Escrow not locked, OR
  - Job is completed/cancelled/disputed
**Prevents**:
  - Updates after escrow lock (except final statuses)
  - Cancellation if job is assigned or submitted
**Rationale**: Once funds are locked and work assigned, job details shouldn't change

#### UPDATE: "Admins can update any job" (new)
```sql
USING (
  EXISTS (
    SELECT 1 FROM admin_wallets 
    WHERE wallet_address = auth.jwt() ->> 'wallet_address'
      AND is_active = true
  )
)
```
**Purpose**: Admins can intervene in any job  
**Use cases**: Dispute resolution, manual escrow release/refund  
**Allows**: Active admins to update any job

#### UPDATE: "Service role can update jobs" (new)
```sql
USING (
  auth.jwt() ->> 'role' = 'service_role'
)
```
**Purpose**: Backend operations on jobs  
**Use cases**: Auto-release cron, escrow status updates  
**Allows**: Service role to update any job

---

### 5. `job_disputes` (4 policies)

#### SELECT: "Anyone can view disputes" (existing, unchanged)
```sql
USING (true)
```
**Purpose**: Public dispute transparency

#### INSERT: "Parties can create disputes" (existing, unchanged)
```sql
WITH CHECK (true)
```
**Purpose**: Allow dispute creation  
**Note**: Validation in application logic

#### UPDATE: "Admins can update disputes" (new)
```sql
USING (
  EXISTS (
    SELECT 1 FROM admin_wallets 
    WHERE wallet_address = auth.jwt() ->> 'wallet_address'
      AND is_active = true
  )
)
```
**Purpose**: Admins can resolve disputes  
**Use cases**: Set admin_wallet, worker_percentage, poster_percentage  
**Allows**: Active admins to update any dispute

#### UPDATE: "Service role can update disputes" (new)
```sql
USING (
  auth.jwt() ->> 'role' = 'service_role'
)
```
**Purpose**: Backend dispute processing  
**Use cases**: Status updates after escrow split  
**Allows**: Service role to update any dispute

---

## 🛠️ Helper Functions

### 1. `is_authenticated_admin() → BOOLEAN`
```sql
RETURN EXISTS (
  SELECT 1 FROM admin_wallets 
  WHERE wallet_address = auth.jwt() ->> 'wallet_address'
    AND is_active = true
);
```
**Purpose**: Check if current user is an active admin  
**Returns**: `true` if user is in admin_wallets with is_active=true  
**Use in RLS**: Can be used in future policies

### 2. `is_authenticated_super_admin() → BOOLEAN`
```sql
RETURN EXISTS (
  SELECT 1 FROM admin_wallets 
  WHERE wallet_address = auth.jwt() ->> 'wallet_address'
    AND role = 'super_admin'
    AND is_active = true
);
```
**Purpose**: Check if current user is an active super admin  
**Returns**: `true` if user is super_admin and active  
**Use in RLS**: Can be used in future policies

### 3. `is_job_poster(job_id UUID) → BOOLEAN`
```sql
RETURN EXISTS (
  SELECT 1 FROM jobs 
  WHERE id = p_job_id
    AND poster_wallet = auth.jwt() ->> 'wallet_address'
);
```
**Purpose**: Check if current user is the poster of a specific job  
**Parameters**: `job_id` - Job to check  
**Returns**: `true` if user is the job poster  
**Use in RLS**: Can be used in future policies

### 4. `is_job_worker(job_id UUID) → BOOLEAN`
```sql
RETURN EXISTS (
  SELECT 1 FROM jobs 
  WHERE id = p_job_id
    AND assigned_to = auth.jwt() ->> 'wallet_address'
);
```
**Purpose**: Check if current user is the assigned worker of a specific job  
**Parameters**: `job_id` - Job to check  
**Returns**: `true` if user is the assigned worker  
**Use in RLS**: Can be used in future policies

### 5. `job_has_escrow_lock(job_id UUID) → BOOLEAN`
```sql
RETURN EXISTS (
  SELECT 1 FROM jobs 
  WHERE id = p_job_id
    AND escrow_locked = true
);
```
**Purpose**: Check if a job has active escrow lock  
**Parameters**: `job_id` - Job to check  
**Returns**: `true` if escrow_locked = true  
**Use in RLS**: Can be used in future policies

---

## 🔐 Security Checklist

### What's Protected ✅
- [x] Platform settings: Only admins can modify
- [x] Admin wallets: Only super_admins can modify
- [x] Escrow transactions: Only service role can create/update
- [x] Transaction audit log: Immutable (no DELETE policy)
- [x] Job updates: Restricted after escrow lock
- [x] Dispute resolution: Only admins can set split percentages
- [x] Admin transparency: Public can view admin list

### What's Public 🌐
- [x] Platform settings (fee %, wallet addresses)
- [x] Admin wallet list (transparency)
- [x] All jobs (public job board)
- [x] All disputes (public transparency)

### Service Role Powers ⚙️
- [x] Create escrow transactions
- [x] Update transaction status
- [x] Update job status (auto-release)
- [x] Update dispute status (after resolution)

### Admin Powers 👑
- [x] View all escrow transactions
- [x] Update platform settings
- [x] Update any job (dispute resolution)
- [x] Update any dispute (resolution)
- [x] Super_admins: Manage admin_wallets

---

## 📋 Policy Matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| **platform_settings** | Public | Active Admins | Active Admins | Active Admins |
| **admin_wallets** | Public | Super Admins | Super Admins | Super Admins |
| **job_escrow_transactions** | Job parties OR Admins | Service Role | Service Role | No one (immutable) |
| **jobs** | Public | Anyone | Poster (if not locked) OR Admins OR Service | (not specified) |
| **job_disputes** | Public | Anyone | Admins OR Service | (not specified) |

---

## 🎯 Common Use Cases

### 1. User Views Their Escrow Transactions
```typescript
// User's JWT contains their wallet_address
const { data } = await supabase
  .from('job_escrow_transactions')
  .select('*')
  .eq('job_id', jobId);

// RLS automatically filters to only show transactions where:
// - User is job poster, OR
// - User is assigned worker, OR
// - User is an active admin
```

### 2. Admin Views All Transactions
```typescript
// Admin's JWT contains their wallet_address (in admin_wallets)
const { data } = await supabase
  .from('job_escrow_transactions')
  .select('*');

// RLS allows access because user is in admin_wallets with is_active=true
```

### 3. Backend Creates Transaction
```typescript
// Service role JWT
const { data } = await supabase
  .from('job_escrow_transactions')
  .insert({
    job_id: jobId,
    transaction_type: 'lock',
    from_wallet: posterWallet,
    to_wallet: escrowWallet,
    amount_tokens: 105,
    tx_signature: signature
  });

// RLS allows because jwt contains role='service_role'
```

### 4. Poster Tries to Edit Job After Escrow Lock
```typescript
// User's JWT contains their wallet_address
const { error } = await supabase
  .from('jobs')
  .update({ payment_amount_tokens: 200 }) // Try to change payment
  .eq('id', jobId);

// RLS blocks because escrow_locked=true and status is 'assigned'
// Error: "new row violates row-level security policy"
```

### 5. Admin Resolves Dispute
```typescript
// Admin's JWT contains their wallet_address (in admin_wallets)
const { data } = await supabase
  .from('job_disputes')
  .update({
    admin_wallet: adminWallet,
    worker_percentage: 60,
    poster_percentage: 40,
    admin_resolution_notes: 'Fair split...'
  })
  .eq('id', disputeId);

// RLS allows because user is in admin_wallets with is_active=true
```

---

## 🚨 Security Best Practices

### 1. JWT Token Security
```typescript
// ✅ Good: JWT contains wallet_address
{
  "wallet_address": "5wHu2...",
  "role": "authenticated"
}

// ❌ Bad: Missing wallet_address
{
  "user_id": "123",
  "role": "authenticated"
}
```

### 2. Service Role Usage
```typescript
// ✅ Good: Use service role for backend operations
const supabaseService = createClient(url, SERVICE_ROLE_KEY);

// ❌ Bad: Use user's token for backend operations
const supabaseUser = createClient(url, user.token);
```

### 3. Admin Checks
```typescript
// ✅ Good: Check admin status before showing admin UI
const { data: isAdmin } = await supabase
  .rpc('is_authenticated_admin');

if (!isAdmin) {
  redirect('/');
}

// ❌ Bad: Trust client-side admin flag
if (user.isAdmin) { // Can be manipulated
  showAdminPanel();
}
```

### 4. Transaction Creation
```typescript
// ✅ Good: Create transactions from backend with service role
// Backend API route
export async function POST(request: Request) {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  await supabase.from('job_escrow_transactions').insert(...);
}

// ❌ Bad: Let users create transactions
// Frontend
await supabase.from('job_escrow_transactions').insert(...); // Will fail
```

---

## 🧪 Testing RLS Policies

### Test as Regular User
```sql
-- Set JWT to regular user
SET request.jwt.claims = '{"wallet_address": "user123"}';

-- Should succeed
SELECT * FROM platform_settings;
SELECT * FROM admin_wallets;

-- Should only show user's jobs
SELECT * FROM job_escrow_transactions;

-- Should fail
UPDATE platform_settings SET setting_value = '10.0';
INSERT INTO job_escrow_transactions VALUES (...);
```

### Test as Admin
```sql
-- Set JWT to admin user (must exist in admin_wallets)
SET request.jwt.claims = '{"wallet_address": "admin456"}';

-- Should succeed
SELECT * FROM job_escrow_transactions; -- All transactions
UPDATE platform_settings SET setting_value = '10.0';
UPDATE jobs SET status = 'completed' WHERE id = '...';

-- Should fail (not super_admin)
INSERT INTO admin_wallets VALUES (...);
```

### Test as Service Role
```sql
-- Set JWT to service role
SET request.jwt.claims = '{"role": "service_role"}';

-- Should succeed
INSERT INTO job_escrow_transactions VALUES (...);
UPDATE job_escrow_transactions SET status = 'confirmed';
UPDATE jobs SET escrow_locked = false;

-- Should succeed (service bypasses most RLS)
-- But good practice: Only use for intended operations
```

---

## 📊 Policy Statistics

### Total Policies Created
- **platform_settings**: 4 policies
- **admin_wallets**: 4 policies (1 existing kept)
- **job_escrow_transactions**: 4 policies
- **jobs**: 3 policies (2 existing kept + 3 new)
- **job_disputes**: 2 policies (2 existing kept + 2 new)
- **Total**: 17 policies

### Total Helper Functions
- 5 RLS helper functions
- All granted to `authenticated` role

---

## 🔄 Migration Summary

### What Was Changed
1. ✅ Enabled RLS on 3 escrow tables
2. ✅ Created 12 new policies for escrow tables
3. ✅ Updated jobs policies to include escrow_locked checks
4. ✅ Added 2 new policies for job_disputes
5. ✅ Created 5 helper functions for RLS
6. ✅ Granted execute permissions on helper functions

### Backward Compatibility
- ✅ All existing policies preserved where possible
- ✅ Existing user flows continue to work
- ✅ New restrictions only apply to escrow-locked jobs
- ✅ Public access maintained for transparency

---

## 🚀 Next Steps

### Application Layer
1. **Update Authentication**: Ensure JWT contains `wallet_address`
2. **Service Role Setup**: Configure SERVICE_ROLE_KEY for backend
3. **Error Handling**: Catch RLS policy violations gracefully
4. **Admin UI**: Check `is_authenticated_admin()` before rendering

### Testing
1. **Unit Tests**: Test helper functions
2. **Integration Tests**: Test RLS policies with different roles
3. **E2E Tests**: Test user flows with RLS enabled

### Monitoring
1. **Log RLS Failures**: Track policy violation attempts
2. **Admin Actions**: Log all admin operations
3. **Service Role Usage**: Monitor service role operations

---

## 📁 Related Files

- **Migration**: `supabase-migrations/031_add_escrow_system_rls.sql`
- **Previous Escrow Migrations**:
  - `028_create_job_escrow_system.sql` (tables)
  - `029_add_escrow_fields_to_jobs.sql` (fields)
  - `030_add_admin_resolution_to_disputes.sql` (admin resolution)
- **Original Job RLS**: `017_create_job_system_tables.sql`

---

**Documentation Created**: November 27, 2024  
**Status**: ✅ Complete and deployed  
**Security Level**: Database-enforced row-level security active


