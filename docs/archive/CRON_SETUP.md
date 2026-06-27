# Verification Cron Job Setup Guide

## 🎯 Overview

This system automatically checks pending assets every 5 minutes and transitions them through verification states (pending → backed → verified) or hides them if they receive too many reports.

---

## 📁 Files Created

1. **`/app/api/check-verifications/route.ts`** - API endpoint that processes assets
2. **`/supabase-migrations/007_add_karma_management_functions.sql`** - SQL functions
3. **`/vercel.json`** - Cron job configuration

---

## 🔧 Setup Instructions

### Step 1: Apply SQL Migration

1. Go to **Supabase Dashboard → SQL Editor**
2. Copy contents of `supabase-migrations/007_add_karma_management_functions.sql`
3. Run the migration
4. Verify functions exist:

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('increment_assets_added', 'add_warning');
```

Should return 2 rows.

---

### Step 2: Generate CRON_SECRET

The `CRON_SECRET` is a **random string you generate yourself** to authenticate cron requests. This prevents unauthorized access to your verification endpoint.

#### Option A: Using OpenSSL (Recommended)

```bash
openssl rand -base64 32
```

Example output: `K9j3mN8pQ2rT7vX1wZ4yA6bC8dE0fG2h`

#### Option B: Using Node.js

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### Option C: Online Generator

Visit: https://generate-secret.vercel.app/32

**⚠️ Important**: 
- Use a **unique, random string**
- Keep it secret (don't commit to git)
- Use the same value in both local and production environments

---

### Step 3: Add to .env.local (Local Development)

Create or update `.env.local` in your project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Solana RPC
NEXT_PUBLIC_RPC_ENDPOINT=https://api.mainnet-beta.solana.com

# Helius API
NEXT_PUBLIC_HELIUS_API_KEY=your-helius-api-key
NEXT_PUBLIC_HELIUS_API_URL=https://mainnet.helius-rpc.com

# Cron Secret (paste the random string you generated)
CRON_SECRET=K9j3mN8pQ2rT7vX1wZ4yA6bC8dE0fG2h
```

---

### Step 4: Add to Vercel (Production)

1. Go to **Vercel Dashboard → Your Project → Settings → Environment Variables**
2. Add new variable:
   - **Key**: `CRON_SECRET`
   - **Value**: `K9j3mN8pQ2rT7vX1wZ4yA6bC8dE0fG2h` (paste your generated secret)
   - **Environments**: Production, Preview, Development (check all)
3. Click **Save**
4. Redeploy your project for changes to take effect

**Screenshot Guide**:
```
Vercel Dashboard
  → Settings
    → Environment Variables
      → Add New
        Name: CRON_SECRET
        Value: [your-secret]
        ✓ Production
        ✓ Preview  
        ✓ Development
      → Save
```

---

## 🔄 How It Works

### Cron Schedule

The cron job runs **every 5 minutes**:
```json
"schedule": "*/5 * * * *"
```

**Cron Syntax Breakdown**:
- `*/5` - Every 5 minutes
- `*` - Every hour
- `*` - Every day of month
- `*` - Every month
- `*` - Every day of week

### Authentication Flow

```
Vercel Cron → Sends request with Authorization header
  ↓
API checks: Authorization === `Bearer ${CRON_SECRET}`
  ↓
If match → Process assets
If no match → Return 401 Unauthorized
```

### Asset Processing

For each pending/backed asset:

1. **Check for BACKED transition**:
   - Threshold: 0.5% supply OR 5 voters
   - Action: Update status, post chat message

2. **Check for VERIFIED transition**:
   - Threshold: 5% supply OR 10 voters
   - Action: Update status, award remaining 75% karma, copy to main tables, post chat message

3. **Check for HIDDEN transition**:
   - Threshold: Varies by current status (2-10% reports)
   - Action: Update status, deduct karma from upvoters, warn submitter, reward reporters

---

## 📊 State Transitions

### PENDING → BACKED

**Conditions**: 
- `total_upvote_weight >= 0.5%` OR
- `unique_upvoters_count >= 5`

**Actions**:
1. Set `verification_status = 'backed'`
2. Post green "Community Backed" message to chat
3. Log to console

**Karma**: No additional karma awarded (already got 25%)

---

### BACKED → VERIFIED

**Conditions**:
- `total_upvote_weight >= 5%` OR
- `unique_upvoters_count >= 10`

**Actions**:
1. Set `verification_status = 'verified'`
2. Set `verified_at = NOW()`
3. Award remaining 75% karma to all upvoters
4. Award remaining 75% karma to submitter
5. Increment `assets_added_count` for submitter
6. Copy asset to main table (`social_assets`, `creative_assets`, or `legal_assets`)
7. Post purple "Verified" message to chat
8. Log to console

**Karma Distribution**:
```typescript
// Each upvoter gets:
remainingKarma = BASE_KARMA.UPVOTE * tier_multiplier * 0.75

// Submitter gets:
remainingKarma = BASE_KARMA.ADD_ASSET * tier_multiplier * 0.75
```

---

### ANY → HIDDEN

**Conditions (based on current status)**:

**PENDING**:
- `total_report_weight >= 2%` OR
- `unique_reporters_count >= 3`

**BACKED**:
- `total_report_weight >= 3%` OR
- `unique_reporters_count >= 5`

**VERIFIED**:
- `total_report_weight >= 10%` OR
- `unique_reporters_count >= 15`

**Actions**:
1. Set `verification_status = 'hidden'`
2. Set `hidden_at = NOW()`
3. **Deduct** 25% karma from all upvoters (their immediate karma)
4. **Deduct** 25% karma from submitter
5. Add warning to submitter (may trigger ban if 2-3 active warnings)
6. **Award** 100% karma (25% + 75%) to all reporters
7. Post red "Rejected" message to chat
8. Log to console

**Ban Logic** (in `add_warning` function):
- If karma ≤ 0 AND 2+ active warnings → BAN
- If 3+ active warnings → BAN
- Active = within last 90 days
- Ban posts "Wallet Banned" message to chat

---

## 🧪 Testing

### Local Testing

1. **Trigger manually** (for testing):

```bash
curl -X GET http://localhost:3000/api/check-verifications \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

2. **Check response**:

```json
{
  "success": true,
  "processed": 3
}
```

3. **Verify in Supabase**:
   - Check `pending_assets` table for status changes
   - Check `curation_chat_messages` for new messages
   - Check `wallet_karma` for karma updates

---

### Production Testing

1. **Deploy to Vercel**
2. **Check Vercel Logs**:
   - Go to Vercel Dashboard → Deployments → Latest → Functions
   - Find `/api/check-verifications`
   - Check execution logs

3. **Manual trigger** (if needed):

```bash
curl -X GET https://your-domain.vercel.app/api/check-verifications \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

4. **Monitor Cron Execution**:
   - Vercel Dashboard → Settings → Cron Jobs
   - Shows last execution time and status

---

## 🔍 Debugging

### Common Issues

#### "Unauthorized" Response

**Problem**: CRON_SECRET doesn't match

**Solutions**:
- Verify secret in Vercel environment variables
- Check for typos or extra spaces
- Ensure secret is the same in local `.env.local` and Vercel
- Redeploy after adding/updating secret

---

#### Functions Not Found

**Problem**: `increment_assets_added` or `add_warning` doesn't exist

**Solutions**:
- Apply migration `007_add_karma_management_functions.sql`
- Check Supabase logs for errors
- Verify permissions granted to `authenticated` and `anon` roles

---

#### No Assets Processed

**Problem**: `processed: 0` even with pending assets

**Solutions**:
- Check thresholds in `/lib/karma.ts`
- Verify assets have votes
- Check `total_upvote_weight` and `unique_upvoters_count` values
- Ensure assets are in `pending` or `backed` status

---

#### Karma Not Awarded

**Problem**: Status changes but karma not updating

**Solutions**:
- Check `add_karma` RPC exists (from migration 004)
- Verify `wallet_karma` table exists
- Check Supabase logs for RPC errors
- Ensure correct `project_id` being passed

---

## 📈 Monitoring

### What to Watch

1. **Cron execution frequency**: Should run every 5 minutes
2. **Processing count**: `processed` should match expected transitions
3. **Database growth**: `social_assets`, `creative_assets`, `legal_assets` should grow
4. **Karma distribution**: Check `wallet_karma` totals are reasonable
5. **Ban rate**: Monitor `is_banned = true` count

### Useful Queries

**Check recent transitions**:
```sql
SELECT * FROM curation_chat_messages
WHERE message_type IN ('asset_backed', 'asset_verified', 'asset_hidden')
ORDER BY created_at DESC
LIMIT 20;
```

**Check pending assets ready for transition**:
```sql
SELECT 
  id,
  verification_status,
  total_upvote_weight,
  unique_upvoters_count
FROM pending_assets
WHERE verification_status IN ('pending', 'backed')
  AND (
    total_upvote_weight >= 0.5 
    OR unique_upvoters_count >= 5
  );
```

**Check banned wallets**:
```sql
SELECT 
  wallet_address,
  total_karma_points,
  warning_count,
  banned_at
FROM wallet_karma
WHERE is_banned = true;
```

---

## 🔐 Security

### Why CRON_SECRET is Important

Without authentication:
- ❌ Anyone could trigger verification checks
- ❌ Could spam the endpoint
- ❌ Could manipulate timing of status transitions
- ❌ Could DoS your database

With CRON_SECRET:
- ✅ Only Vercel Cron can trigger
- ✅ Rate-limited by cron schedule
- ✅ Predictable, controlled execution
- ✅ Protected from abuse

### Best Practices

1. **Never commit** CRON_SECRET to git
2. **Use different secrets** for different projects
3. **Rotate secrets** periodically (every 6-12 months)
4. **Store securely** in password manager
5. **Limit access** to environment variables

---

## 🚀 Deployment Checklist

Before going live:

- [ ] SQL migration 007 applied
- [ ] Functions verified in Supabase
- [ ] CRON_SECRET generated (32+ characters)
- [ ] CRON_SECRET added to `.env.local`
- [ ] CRON_SECRET added to Vercel
- [ ] `vercel.json` committed to git
- [ ] Project redeployed to Vercel
- [ ] Manual test successful
- [ ] Cron appears in Vercel dashboard
- [ ] First automatic execution successful
- [ ] Monitoring set up

---

## 📞 Support

If you encounter issues:

1. Check Vercel function logs
2. Check Supabase logs
3. Verify all migrations applied
4. Test manually with curl
5. Check environment variables are set

---

## 🎉 You're Done!

Your cron job should now automatically check verifications every 5 minutes. Assets will transition states based on community votes, karma will be distributed fairly, and bad actors will be warned/banned automatically.

**Next Steps**:
- Monitor first few executions
- Watch for status transitions
- Check karma distribution
- Verify chat messages appear

Good luck! 🚀

