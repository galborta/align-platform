# ✅ Cron Job Setup - Ready to Deploy

**Project:** align-platform  
**Project ID:** szunhbkqmfbbcrefycxh  
**Region:** eu-north-1 (Sweden)  
**Edge Function URL:** `https://szunhbkqmfbbcrefycxh.supabase.co/functions/v1/auto-release-payments`

---

## 🚀 Quick Start (5 Minutes)

### Option A: Automated Setup (Recommended)

```bash
cd supabase/functions/auto-release-payments
./generate-and-setup-cron.sh
```

This script will:
1. ✅ Generate a secure CRON_SECRET
2. ✅ Update your SQL file automatically
3. ✅ Provide copy-paste instructions for Supabase Dashboard
4. ✅ Give you the exact curl command to test

**Then just:**
1. Copy environment variables to Supabase Dashboard
2. Run the SQL in Supabase SQL Editor
3. Test with the provided curl command
4. Done! ✨

---

### Option B: Manual Setup

If you prefer to do it manually, follow these steps:

#### 1. Generate CRON_SECRET

```bash
openssl rand -base64 32
```

Save this secret! You'll need it multiple times.

#### 2. Set Environment Variables

**Supabase Dashboard** → Edge Functions → auto-release-payments → Settings:

| Variable | Value |
|----------|-------|
| `CRON_SECRET` | Your generated secret |
| `APP_URL` | `https://your-domain.com` |
| `SERVICE_AUTH_TOKEN` | `auto-release-internal` |
| `ADMIN_WALLET` | `GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S` |

**Vercel Dashboard** → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `SERVICE_AUTH_TOKEN` | `auto-release-internal` |

#### 3. Update and Run SQL

1. Edit `setup-cron-production.sql`
2. Replace `YOUR_CRON_SECRET` with your actual secret
3. Go to **Supabase Dashboard** → **SQL Editor**
4. Copy and paste the entire SQL file
5. Click **RUN**

#### 4. Test

```bash
curl -X POST https://szunhbkqmfbbcrefycxh.supabase.co/functions/v1/auto-release-payments \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

Expected response: `{"success": true, ...}`

---

## 📋 What Was Created

### Production-Ready Files

```
supabase/functions/auto-release-payments/
├── setup-cron-production.sql .......... SQL with your project ref
├── generate-and-setup-cron.sh ......... Automated setup wizard
└── schedule-cron.sql .................. Generic template

Root directory/
└── CRON_SETUP_INSTRUCTIONS.md ......... Step-by-step guide
└── CRON_SETUP_COMPLETE.md ............. This file
```

### Key Updates

✅ **SQL script pre-configured** with your project reference:
   - Project Ref: `szunhbkqmfbbcrefycxh`
   - Function URL: `https://szunhbkqmfbbcrefycxh.supabase.co/functions/v1/auto-release-payments`
   - Schedule: Every hour at :00 (`0 * * * *`)

✅ **Automated setup script** that:
   - Generates secure CRON_SECRET
   - Updates SQL file automatically
   - Provides copy-paste commands

✅ **Complete documentation** with:
   - Step-by-step instructions
   - Troubleshooting guide
   - Monitoring queries
   - Verification checklist

---

## ⏰ Schedule Configuration

**Current:** Every hour at :00 minutes

```
0 * * * *
│ │ │ │ │
│ │ │ │ └─ Day of week (0-6, Sunday=0)
│ │ │ └─── Month (1-12)
│ │ └───── Day of month (1-31)
│ └─────── Hour (0-23)
└───────── Minute (0-59)
```

**Examples:**
- `0 * * * *` - Every hour at :00 (current)
- `*/15 * * * *` - Every 15 minutes
- `0 */2 * * *` - Every 2 hours at :00
- `0 9,17 * * *` - 9 AM and 5 PM daily

---

## 🔐 Security Configuration

### Required Secrets

| Secret | Where Used | Purpose |
|--------|------------|---------|
| `CRON_SECRET` | pg_cron → Edge Function | Authenticate cron requests |
| `SERVICE_AUTH_TOKEN` | Edge Function → API | Authenticate internal calls |
| `ESCROW_WALLET_PRIVATE_KEY` | API → Blockchain | Sign transactions |

### Security Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: pg_cron → Edge Function                        │
│          Validates: CRON_SECRET                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Edge Function → Release API                    │
│          Validates: SERVICE_AUTH_TOKEN                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Release API → Blockchain                       │
│          Signs with: ESCROW_WALLET_PRIVATE_KEY          │
│          (Server-side only, never exposed)              │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Monitoring

### Check Cron Status

```sql
-- Verify job is scheduled
SELECT * FROM cron.job WHERE jobname = 'auto-release-payments';
```

### View Execution History

```sql
-- Last 10 runs
SELECT 
  runid,
  status,
  start_time,
  end_time,
  return_message
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-release-payments')
ORDER BY start_time DESC
LIMIT 10;
```

### Check Auto-Released Jobs

```sql
-- Jobs released today
SELECT 
  id,
  title,
  completed_at,
  escrow_amount_tokens
FROM jobs 
WHERE status = 'completed'
  AND completed_at::date = CURRENT_DATE
  AND escrow_locked = false;
```

### View Edge Function Logs

**Supabase Dashboard** → Edge Functions → auto-release-payments → Logs

---

## 🧪 Testing Procedures

### 1. Manual Trigger Test

```bash
curl -X POST https://szunhbkqmfbbcrefycxh.supabase.co/functions/v1/auto-release-payments \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Expected:** `{"success": true, "message": "Auto-release batch processed", ...}`

### 2. Create Test Job (Optional)

To test the full flow:

```sql
-- Set a job's release date to the past
UPDATE jobs 
SET release_scheduled_at = NOW() - INTERVAL '1 hour'
WHERE id = 'your-test-job-id';

-- Verify it's eligible
SELECT * FROM jobs 
WHERE status = 'submitted' 
  AND release_paused = false 
  AND escrow_locked = true
  AND release_scheduled_at <= NOW();
```

Then wait for next cron run or trigger manually.

### 3. Verify First Automatic Run

**After the top of the next hour:**

```sql
-- Check execution
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-release-payments')
ORDER BY start_time DESC LIMIT 1;
```

---

## 🚨 Troubleshooting

### "Unauthorized" Response

**Fix:** 
- Verify CRON_SECRET in Edge Function settings
- Check SQL script has correct secret (no spaces/line breaks)

### "APP_URL not configured"

**Fix:**
- Add `APP_URL` environment variable in Edge Function settings
- Wait 1 minute for it to apply

### Cron Not Running

**Fix:**
1. Check extensions enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
   ```
2. Verify job exists:
   ```sql
   SELECT * FROM cron.job;
   ```

### Jobs Not Being Released

**Fix:**
1. Check for eligible jobs:
   ```sql
   SELECT COUNT(*) FROM jobs 
   WHERE status = 'submitted' 
     AND release_paused = false 
     AND escrow_locked = true
     AND release_scheduled_at <= NOW();
   ```
2. If count > 0, check Edge Function logs
3. Test release API manually

---

## ✅ Deployment Checklist

Before marking complete:

- [ ] Run automated setup script OR manual setup
- [ ] CRON_SECRET generated and saved securely
- [ ] All 4 environment variables set in Supabase Edge Function
- [ ] SERVICE_AUTH_TOKEN added to Vercel
- [ ] SQL script executed successfully in Supabase
- [ ] Job appears in `cron.job` table
- [ ] Manual curl test returns 200
- [ ] First automatic execution successful (wait for top of hour)
- [ ] No errors in Edge Function logs
- [ ] Execution history shows "succeeded"

---

## 📚 Documentation Reference

| Document | Purpose | Link |
|----------|---------|------|
| **CRON_SETUP_INSTRUCTIONS.md** | Detailed step-by-step guide | Complete walkthrough |
| **AUTO_RELEASE_QUICK_START.md** | 15-minute deployment | Quick start |
| **AUTO_RELEASE_EDGE_FUNCTION_COMPLETE.md** | Technical reference | Full docs |
| **CRON_SETUP_COMPLETE.md** | This file | Setup summary |

---

## 🎯 Expected Behavior

Once deployed:

1. **Every hour at :00 minutes:**
   - pg_cron triggers Edge Function
   - Edge Function queries for eligible jobs
   - Each job's payment is released
   - Worker receives notification
   - Job status updated to 'completed'
   - Transactions logged

2. **If a job fails:**
   - Error logged
   - Retry on next hour (up to 3 times)
   - After 3 failures: job paused, admin notified

3. **Performance:**
   - Processes up to 50 jobs per run
   - Completes in < 60 seconds
   - Success rate > 95% expected

---

## 🎉 You're All Set!

**Next Step:** Run the automated setup script:

```bash
cd supabase/functions/auto-release-payments
./generate-and-setup-cron.sh
```

Then follow the on-screen instructions. Setup takes ~5 minutes.

**Need Help?** See `CRON_SETUP_INSTRUCTIONS.md` for detailed guidance.

---

**Status:** ✅ Ready for Deployment  
**Estimated Setup Time:** 5 minutes  
**Last Updated:** November 27, 2025


