# 🚀 Enhanced Tip System - Migration & Deployment Guide

**Migration File**: `supabase-migrations/20241126_enhanced_tip_system.sql`  
**Estimated Time**: 5-10 minutes  
**Risk Level**: 🟡 Medium (column rename, but with backwards compat backfill)

---

## 📋 Pre-Deployment Checklist

### 1. Backup Database ✅
```bash
# Using Supabase CLI
supabase db dump -f backup_before_tip_enhancement.sql

# Or via Supabase Dashboard
# Settings → Database → Create backup
```

### 2. Verify Current State
```sql
-- Check existing chat_tips structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'chat_tips';

-- Count existing tips (for verification)
SELECT COUNT(*) FROM chat_tips;

-- Check wallet_karma structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'wallet_karma';
```

### 3. Review Migration File
```bash
cat supabase-migrations/20241126_enhanced_tip_system.sql
```

---

## 🔄 Deployment Steps

### Option 1: Supabase CLI (Recommended)

```bash
# 1. Navigate to project directory
cd /path/to/align-platform

# 2. Login to Supabase (if not already)
supabase login

# 3. Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# 4. Run migration
supabase db push

# 5. Verify migration
supabase db diff
```

### Option 2: Supabase Dashboard

1. Go to **Supabase Dashboard** → Your Project
2. Navigate to **SQL Editor**
3. Click **"+ New Query"**
4. Copy contents of `20241126_enhanced_tip_system.sql`
5. Paste into editor
6. Click **"Run"** (bottom right)
7. Check for success message

### Option 3: Using MCP Tool (If Available)

```bash
# Execute migration via Supabase MCP
mcp supabase execute-sql --file supabase-migrations/20241126_enhanced_tip_system.sql
```

---

## ✅ Post-Deployment Verification

### 1. Verify Schema Changes

```sql
-- Check chat_tips columns
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'chat_tips'
ORDER BY ordinal_position;

-- Expected new columns:
-- ✓ amount_tokens (renamed from amount_nub)
-- ✓ token_symbol (TEXT, NOT NULL)
-- ✓ amount_usd (NUMERIC, NULL)
-- ✓ is_public (BOOLEAN, DEFAULT true)
-- ✓ karma_awarded_sender (NUMERIC, DEFAULT 0)
-- ✓ karma_awarded_recipient (NUMERIC, DEFAULT 0)
```

### 2. Verify wallet_karma Changes

```sql
-- Check wallet_karma columns
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'wallet_karma'
WHERE column_name LIKE '%tip%'
ORDER BY ordinal_position;

-- Expected new columns:
-- ✓ tips_sent_count (INTEGER, DEFAULT 0)
-- ✓ tips_received_count (INTEGER, DEFAULT 0)
-- ✓ tip_karma_earned_today (NUMERIC, DEFAULT 0)
-- ✓ tip_karma_last_reset_date (DATE, DEFAULT CURRENT_DATE)
```

### 3. Verify Indexes

```sql
-- Check new indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN ('chat_tips', 'wallet_karma')
  AND indexname LIKE '%tip%';

-- Expected indexes:
-- ✓ idx_chat_tips_is_public
-- ✓ idx_chat_tips_sender_karma
-- ✓ idx_chat_tips_recipient_karma
-- ✓ idx_chat_tips_token_symbol
-- ✓ idx_wallet_karma_daily_tip
```

### 4. Verify Functions

```sql
-- Check functions were created
SELECT proname, prorettype::regtype 
FROM pg_proc 
WHERE proname IN ('reset_daily_tip_karma', 'award_tip_karma');

-- Expected:
-- ✓ reset_daily_tip_karma → void
-- ✓ award_tip_karma → numeric
```

### 5. Test award_tip_karma Function

```sql
-- Test karma award with daily cap
SELECT award_tip_karma(
  'TestWallet123',        -- wallet address
  (SELECT id FROM projects LIMIT 1),  -- any project id
  100,                    -- karma amount
  true                    -- is_sender
);

-- Should return: 100 (if under daily cap)

-- Check it was recorded
SELECT 
  tips_sent_count,
  total_karma_points,
  tip_karma_earned_today
FROM wallet_karma
WHERE wallet_address = 'TestWallet123';

-- Cleanup test data
DELETE FROM wallet_karma WHERE wallet_address = 'TestWallet123';
```

### 6. Verify Data Backfill

```sql
-- All existing tips should have token_symbol = 'NUB'
SELECT 
  COUNT(*) as total_tips,
  COUNT(CASE WHEN token_symbol = 'NUB' THEN 1 END) as nub_tips,
  COUNT(CASE WHEN token_symbol IS NULL THEN 1 END) as null_symbols
FROM chat_tips;

-- Expected: null_symbols = 0 (all backfilled)
```

---

## 🔧 Code Updates Required

### 1. Update TipModal Component

**File**: `components/TipModal.tsx`

```typescript
// OLD
await supabase.from('chat_tips').insert({
  amount_nub: parseFloat(amount),
  // ...
})

// NEW
await supabase.from('chat_tips').insert({
  amount_tokens: parseFloat(amount),
  token_symbol: tokenSymbol || 'NUB',
  amount_usd: usdValue || null,
  is_public: isPublic,
  karma_awarded_sender: senderKarma,
  karma_awarded_recipient: recipientKarma,
  // ...
})
```

### 2. Add Karma Award Logic

**New File**: `lib/tip-karma.ts`

```typescript
import { supabase } from './supabase'

export async function calculateTipKarma(
  amountUsd: number | null,
  tokenPercentage: number
): Promise<number> {
  if (!amountUsd) return 0
  
  // Base: 10 karma per $1 USD
  const baseKarma = Math.floor(amountUsd * 10)
  
  // Apply tier multiplier (from karma.ts)
  const tier = getTier(tokenPercentage)
  return baseKarma * tier.multiplier
}

export async function awardTipKarma({
  senderWallet,
  recipientWallet,
  projectId,
  karmaAmount
}: {
  senderWallet: string
  recipientWallet: string
  projectId: string
  karmaAmount: number
}): Promise<{
  senderKarma: number
  recipientKarma: number
}> {
  // Award to sender
  const { data: senderKarma } = await supabase.rpc('award_tip_karma', {
    p_wallet_address: senderWallet,
    p_project_id: projectId,
    p_karma_amount: karmaAmount,
    p_is_sender: true
  })

  // Award to recipient
  const { data: recipientKarma } = await supabase.rpc('award_tip_karma', {
    p_wallet_address: recipientWallet,
    p_project_id: projectId,
    p_karma_amount: karmaAmount,
    p_is_sender: false
  })

  return {
    senderKarma: senderKarma || 0,
    recipientKarma: recipientKarma || 0
  }
}
```

### 3. Update All References to amount_nub

```bash
# Search for all uses of amount_nub
grep -r "amount_nub" --include="*.ts" --include="*.tsx" .

# Update each file from amount_nub → amount_tokens
```

**Files likely needing updates:**
- `components/TipModal.tsx`
- Any tip display components
- Analytics/leaderboard components

---

## ⏰ Set Up Daily Karma Reset Cron Job

### Option 1: Supabase Edge Function (Recommended)

**File**: `supabase/functions/reset-daily-tip-karma/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error } = await supabase.rpc('reset_daily_tip_karma')

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, message: 'Daily tip karma reset complete' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

**Deploy:**
```bash
supabase functions deploy reset-daily-tip-karma
```

**Set up cron (via Supabase Dashboard or pg_cron):**
```sql
-- Install pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily reset at midnight UTC
SELECT cron.schedule(
  'reset-daily-tip-karma',
  '0 0 * * *',  -- Every day at midnight UTC
  'SELECT reset_daily_tip_karma()'
);
```

### Option 2: External Cron Service

Use services like:
- **Vercel Cron** (if deploying on Vercel)
- **GitHub Actions** (free cron)
- **Render Cron Jobs**

**GitHub Actions Example:**

`.github/workflows/reset-tip-karma.yml`
```yaml
name: Reset Daily Tip Karma
on:
  schedule:
    - cron: '0 0 * * *'  # Midnight UTC daily
  workflow_dispatch:  # Allow manual trigger

jobs:
  reset-karma:
    runs-on: ubuntu-latest
    steps:
      - name: Call Supabase Function
        run: |
          curl -X POST ${{ secrets.SUPABASE_RESET_KARMA_URL }} \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}"
```

---

## 🧪 Testing in Staging

### Test Scenario 1: Basic Tip Flow

```typescript
// 1. Send a tip
await sendTip({
  fromWallet: 'Sender123...',
  toWallet: 'Recipient456...',
  amount: 10,
  tokenSymbol: 'NUB',
  amountUsd: 5.0,
  isPublic: true
})

// 2. Verify karma was awarded
const { data: senderKarma } = await supabase
  .from('wallet_karma')
  .select('*')
  .eq('wallet_address', 'Sender123...')
  .single()

console.assert(senderKarma.tips_sent_count === 1)
console.assert(senderKarma.total_karma_points >= 50) // 5 USD × 10 karma
```

### Test Scenario 2: Daily Karma Cap

```typescript
// Send tips totaling more than 5000 karma
for (let i = 0; i < 10; i++) {
  await sendTip({
    amountUsd: 100,  // 1000 karma each
    // ...
  })
}

// Check cap was enforced
const { data: karma } = await supabase
  .from('wallet_karma')
  .select('tip_karma_earned_today')
  .eq('wallet_address', 'Sender123...')
  .single()

console.assert(karma.tip_karma_earned_today === 5000) // Capped at 5000
```

### Test Scenario 3: Daily Reset

```typescript
// 1. Manually trigger reset
await supabase.rpc('reset_daily_tip_karma')

// 2. Check all wallets reset
const { data: wallets } = await supabase
  .from('wallet_karma')
  .select('tip_karma_earned_today')

wallets.forEach(wallet => {
  console.assert(wallet.tip_karma_earned_today === 0)
})
```

---

## 🚨 Rollback Plan

If issues occur, rollback using:

```sql
-- Rollback migration (run these in reverse order)

-- 1. Drop functions
DROP FUNCTION IF EXISTS award_tip_karma(TEXT, UUID, NUMERIC, BOOLEAN);
DROP FUNCTION IF EXISTS reset_daily_tip_karma();

-- 2. Drop wallet_karma columns
ALTER TABLE wallet_karma 
  DROP COLUMN IF EXISTS tips_sent_count,
  DROP COLUMN IF EXISTS tips_received_count,
  DROP COLUMN IF EXISTS tip_karma_earned_today,
  DROP COLUMN IF EXISTS tip_karma_last_reset_date;

-- 3. Drop chat_tips columns
ALTER TABLE chat_tips 
  DROP COLUMN IF EXISTS karma_awarded_recipient,
  DROP COLUMN IF EXISTS karma_awarded_sender,
  DROP COLUMN IF EXISTS is_public,
  DROP COLUMN IF EXISTS amount_usd,
  DROP COLUMN IF EXISTS token_symbol;

-- 4. Rename column back
ALTER TABLE chat_tips 
  RENAME COLUMN amount_tokens TO amount_nub;

-- 5. Drop indexes
DROP INDEX IF EXISTS idx_wallet_karma_daily_tip;
DROP INDEX IF EXISTS idx_chat_tips_token_symbol;
DROP INDEX IF EXISTS idx_chat_tips_recipient_karma;
DROP INDEX IF EXISTS idx_chat_tips_sender_karma;
DROP INDEX IF EXISTS idx_chat_tips_is_public;

-- 6. Restore from backup
-- Use your backup file from pre-deployment
```

---

## 📊 Monitoring

### Key Metrics to Watch

1. **Migration Success Rate**
   ```sql
   SELECT COUNT(*) FROM chat_tips WHERE token_symbol IS NOT NULL;
   ```

2. **Daily Karma Usage**
   ```sql
   SELECT 
     AVG(tip_karma_earned_today) as avg_karma,
     MAX(tip_karma_earned_today) as max_karma,
     COUNT(CASE WHEN tip_karma_earned_today >= 5000 THEN 1 END) as capped_users
   FROM wallet_karma;
   ```

3. **Tip Volume**
   ```sql
   SELECT 
     DATE(created_at) as date,
     COUNT(*) as tips,
     SUM(amount_usd) as total_usd
   FROM chat_tips
   WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
   GROUP BY DATE(created_at);
   ```

---

## ✅ Deployment Success Criteria

- [ ] Migration runs without errors
- [ ] All existing tips have `token_symbol = 'NUB'`
- [ ] New columns have correct data types
- [ ] Indexes created successfully
- [ ] Functions created and tested
- [ ] No null values where NOT NULL required
- [ ] Daily karma cap enforced correctly
- [ ] Cron job scheduled for daily reset
- [ ] TypeScript types updated
- [ ] Application code updated
- [ ] Staging tests pass

---

## 🎉 Go Live!

Once all checks pass:

1. ✅ Deploy to production
2. ✅ Monitor for 24 hours
3. ✅ Verify daily reset runs at midnight UTC
4. ✅ Check error logs
5. ✅ Celebrate! 🎊

---

**Questions or Issues?**
- Check migration output for specific errors
- Review Supabase logs in Dashboard
- Test functions manually via SQL Editor
- Contact dev team if rollback needed

**Migration Status**: 🟢 Ready for deployment!




