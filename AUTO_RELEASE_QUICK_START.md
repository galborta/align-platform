# 🚀 Auto-Release Quick Start Guide

Get your auto-release payment system up and running in 15 minutes.

---

## Prerequisites Checklist

Before you begin, make sure you have:

- [ ] Supabase account with an active project
- [ ] Node.js installed (v18+)
- [ ] Terminal access
- [ ] Project deployed to Vercel/production

---

## Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

Verify installation:
```bash
supabase --version
```

---

## Step 2: Login and Link Project

### Login
```bash
npx supabase login
```

This will open your browser for authentication.

### Link to Your Project
```bash
cd /path/to/align-platform
npx supabase link --project-ref YOUR_PROJECT_REF
```

**Find your project ref:**
1. Go to Supabase Dashboard
2. Click on your project
3. Go to Settings → API
4. Copy the "Project URL" - the ref is the subdomain
   - Example: `https://abcdefghijk.supabase.co` → ref is `abcdefghijk`

---

## Step 3: Deploy Edge Function

```bash
cd supabase/functions/auto-release-payments
./deploy.sh
```

Or manually:
```bash
npx supabase functions deploy auto-release-payments
```

Expected output:
```
✅ Function deployed successfully!
URL: https://your-ref.supabase.co/functions/v1/auto-release-payments
```

---

## Step 4: Set Environment Variables

### Option A: Via Supabase Dashboard (Easiest)

1. Go to **Edge Functions** in Supabase Dashboard
2. Click **auto-release-payments**
3. Click **Settings** tab
4. Add these variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `CRON_SECRET` | Generate random 32-char string | Use `openssl rand -base64 32` |
| `APP_URL` | `https://your-domain.com` | Your production URL |
| `SERVICE_AUTH_TOKEN` | `auto-release-internal` | Or generate secure token |
| `ADMIN_WALLET` | Your admin wallet address | For failure notifications |

### Option B: Via CLI

```bash
# Generate a secure CRON_SECRET
CRON_SECRET=$(openssl rand -base64 32)

# Set secrets
npx supabase secrets set CRON_SECRET="$CRON_SECRET"
npx supabase secrets set APP_URL="https://align.app"
npx supabase secrets set SERVICE_AUTH_TOKEN="auto-release-internal"
npx supabase secrets set ADMIN_WALLET="YOUR_ADMIN_WALLET_HERE"
```

**Save your CRON_SECRET!** You'll need it for the next step.

---

## Step 5: Schedule Cron Job

### Method 1: Via Supabase Dashboard (Recommended)

1. Go to **Database** → **Cron Jobs** in Supabase Dashboard
2. Click **+ Create a new cron job**
3. Fill in:
   - **Name:** `auto-release-payments`
   - **Schedule:** `*/15 * * * *` (every 15 minutes)
   - **SQL Command:** (see below)

```sql
SELECT
  net.http_post(
    url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-release-payments',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    body:='{}'::jsonb,
    timeout_milliseconds:=60000
  ) as request_id;
```

**Replace:**
- `YOUR_PROJECT_REF` with your actual project ref
- `YOUR_CRON_SECRET` with the secret you generated

4. Click **Create**

### Method 2: Via SQL Editor

1. Go to **SQL Editor** in Supabase Dashboard
2. Open `supabase/functions/auto-release-payments/schedule-cron.sql`
3. Update `YOUR_PROJECT_REF` and `YOUR_CRON_SECRET`
4. Run the SQL

---

## Step 6: Add SERVICE_AUTH_TOKEN to Next.js App

Add to your `.env.local` or Vercel environment variables:

```bash
SERVICE_AUTH_TOKEN=auto-release-internal
```

**Vercel:**
1. Go to Vercel Dashboard → Your Project
2. Settings → Environment Variables
3. Add: `SERVICE_AUTH_TOKEN` = `auto-release-internal`
4. Redeploy

---

## Step 7: Test the Function

### Test 1: Manual Trigger

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-release-payments \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "message": "Auto-release batch processed",
  "total": 0,
  "successes": 0,
  "failures": 0,
  "timestamp": "2025-11-27T10:30:00.000Z"
}
```

### Test 2: Create Test Job (Optional)

To test the full flow:

1. Create a job in your app
2. Assign it to a worker
3. Worker submits work
4. Manually set release date to past:

```sql
UPDATE jobs 
SET release_scheduled_at = NOW() - INTERVAL '1 hour'
WHERE id = 'your-test-job-id';
```

5. Wait for next cron run (max 15 minutes) or trigger manually
6. Verify job was completed and payment released

---

## Step 8: Monitor Execution

### View Logs

**Dashboard:**
1. Go to **Edge Functions** → **auto-release-payments**
2. Click **Logs** tab
3. Watch real-time execution

**CLI:**
```bash
npx supabase functions logs auto-release-payments --tail
```

### Check Cron Status

```sql
-- View cron job
SELECT * FROM cron.job WHERE jobname = 'auto-release-payments';

-- View execution history
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-release-payments')
ORDER BY start_time DESC
LIMIT 10;
```

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Edge Function deployed and accessible
- [ ] All environment variables set
- [ ] Cron job scheduled and active
- [ ] Test request returns 200 status
- [ ] Logs showing "No jobs ready for auto-release" (if no eligible jobs)
- [ ] (Optional) Test job completed and payment released

---

## 🎯 You're Done!

Your auto-release system is now operational! Jobs will automatically release payments 10 days after work submission.

### What Happens Next

**Every 15 minutes:**
1. Cron triggers Edge Function
2. Function queries for eligible jobs
3. Each job's payment is released
4. Worker receives notification
5. Transactions logged for audit

**If a release fails:**
1. Error logged
2. Retry on next cron run (up to 3 times)
3. After 3 failures: job paused, admin notified

---

## 🆘 Troubleshooting

### "Unauthorized" Response
- Check CRON_SECRET matches in both function settings and cron SQL
- Verify no extra spaces or line breaks

### "APP_URL not configured"
- Ensure environment variable is set
- Redeploy function after adding variable

### Jobs Not Being Released
- Check jobs meet criteria: `SELECT * FROM get_jobs_needing_auto_release();`
- Verify cron is running: `SELECT * FROM cron.job;`
- Check Edge Function logs for errors

### Need Help?
- See full documentation: [AUTO_RELEASE_EDGE_FUNCTION_COMPLETE.md](./AUTO_RELEASE_EDGE_FUNCTION_COMPLETE.md)
- Check session summary: [SESSION_AUTO_RELEASE_EDGE_FUNCTION_COMPLETE.md](./SESSION_AUTO_RELEASE_EDGE_FUNCTION_COMPLETE.md)

---

## 📚 Additional Resources

- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **pg_cron Documentation:** https://github.com/citusdata/pg_cron
- **Deno Manual:** https://deno.land/manual

---

**Happy Auto-Releasing! 🎉**




