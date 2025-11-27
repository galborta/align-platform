# 🕒 Cron Job Setup Instructions for Auto-Release Payments

**Project:** align-platform  
**Project Ref:** szunhbkqmfbbcrefycxh  
**Region:** eu-north-1  
**Schedule:** Every hour at :00 minutes

---

## 🎯 Quick Setup (5 Minutes)

### Step 1: Generate Your CRON_SECRET

Run this command in your terminal:

```bash
openssl rand -base64 32
```

**Example output:** `K9j3mN8pQ2rT7vX1wZ4yA6bC8dE0fG2h5iJ7kL9mN1oP`

**⚠️ SAVE THIS SECRET!** You'll need it in multiple places.

---

### Step 2: Set Environment Variables

#### A. In Supabase Edge Function

1. Go to **Supabase Dashboard**
2. Navigate to **Edge Functions** → **auto-release-payments**
3. Click **Settings** tab
4. Add these variables:

| Variable | Value |
|----------|-------|
| `CRON_SECRET` | Your generated secret from Step 1 |
| `APP_URL` | `https://your-domain.com` |
| `SERVICE_AUTH_TOKEN` | `auto-release-internal` |
| `ADMIN_WALLET` | `GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S` |

5. Click **Save**

#### B. In Next.js App (Vercel)

1. Go to **Vercel Dashboard** → Your Project
2. **Settings** → **Environment Variables**
3. Add:
   - **Name:** `SERVICE_AUTH_TOKEN`
   - **Value:** `auto-release-internal`
4. **Save** and **Redeploy**

---

### Step 3: Update and Run the SQL Script

1. Open: `supabase/functions/auto-release-payments/setup-cron-production.sql`

2. **Replace `YOUR_CRON_SECRET`** with your actual secret from Step 1:
   ```sql
   'Authorization', 'Bearer YOUR_ACTUAL_SECRET_HERE'
   ```

3. Go to **Supabase Dashboard** → **SQL Editor**

4. **Copy and paste the entire SQL script**

5. Click **RUN**

6. **Verify output** shows the job was created:
   ```
   jobid | jobname               | schedule  | active | database
   ------|----------------------|-----------|--------|----------
   123   | auto-release-payments | 0 * * * * | t      | postgres
   ```

---

### Step 4: Test the Setup

#### Manual Test

Run this in your terminal (replace `YOUR_CRON_SECRET`):

```bash
curl -X POST https://szunhbkqmfbbcrefycxh.supabase.co/functions/v1/auto-release-payments \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Expected response:**
```json
{
  "success": true,
  "message": "Auto-release batch processed",
  "total": 0,
  "successes": 0,
  "failures": 0,
  "timestamp": "2025-11-27T15:00:00.000Z"
}
```

---

### Step 5: Monitor First Execution

**Wait for the top of the next hour** (e.g., if it's 2:37 PM, wait until 3:00 PM).

#### Check Execution History

Run this in **Supabase SQL Editor**:

```sql
SELECT 
  jobid,
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

**Expected output after first run:**
```
jobid | runid | status    | start_time          | end_time            | return_message
------|-------|-----------|---------------------|---------------------|----------------
123   | 456   | succeeded | 2025-11-27 15:00:00 | 2025-11-27 15:00:02 | OK
```

#### Check Edge Function Logs

1. Go to **Supabase Dashboard**
2. **Edge Functions** → **auto-release-payments**
3. Click **Logs** tab
4. Look for entries around the top of the hour

---

## 📊 Cron Schedule Options

Current setup: **Every hour at :00** (`0 * * * *`)

### Common Schedule Alternatives

| Schedule | Cron Expression | Description |
|----------|----------------|-------------|
| Every 15 min | `*/15 * * * *` | Runs at :00, :15, :30, :45 |
| Every 30 min | `*/30 * * * *` | Runs at :00, :30 |
| Every hour | `0 * * * *` | Runs at :00 (current) |
| Every 2 hours | `0 */2 * * *` | Runs at 2:00, 4:00, 6:00... |
| Every 6 hours | `0 */6 * * *` | Runs at 6:00, 12:00, 18:00, 00:00 |
| Daily at 9 AM | `0 9 * * *` | Runs at 9:00 AM every day |

### To Change Schedule

1. Go to **Supabase SQL Editor**
2. Run:
   ```sql
   SELECT cron.unschedule('auto-release-payments');
   
   SELECT cron.schedule(
     'auto-release-payments',
     '*/15 * * * *',  -- Change this line
     $$ ... rest of SQL ... $$
   );
   ```

---

## 🚨 Troubleshooting

### Issue: "Unauthorized" in logs

**Cause:** CRON_SECRET mismatch

**Fix:**
1. Verify the secret in Edge Function settings
2. Verify the secret in SQL script matches exactly
3. No extra spaces or line breaks

### Issue: "APP_URL not configured"

**Cause:** Missing environment variable

**Fix:**
1. Go to Edge Function settings
2. Add `APP_URL=https://your-domain.com`
3. Save and wait a minute for it to apply

### Issue: Cron not running

**Cause:** Extension not enabled or job not scheduled

**Fix:**
1. Run: `SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');`
2. Should return 2 rows
3. Run: `SELECT * FROM cron.job;`
4. Should show your job

### Issue: Jobs not being released

**Cause:** No eligible jobs or API issue

**Fix:**
1. Check for eligible jobs:
   ```sql
   SELECT * FROM jobs 
   WHERE status = 'submitted' 
     AND release_paused = false 
     AND escrow_locked = true
     AND release_scheduled_at <= NOW();
   ```
2. If jobs exist, check Edge Function logs for errors
3. Test release API manually

---

## 📈 Monitoring Commands

### Check if cron is scheduled
```sql
SELECT * FROM cron.job WHERE jobname = 'auto-release-payments';
```

### View last 10 executions
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-release-payments')
ORDER BY start_time DESC
LIMIT 10;
```

### Count successful vs failed runs today
```sql
SELECT 
  status,
  COUNT(*) as count
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-release-payments')
  AND start_time::date = CURRENT_DATE
GROUP BY status;
```

### Check jobs auto-released today
```sql
SELECT 
  id,
  title,
  assigned_to,
  completed_at,
  escrow_amount_tokens,
  token_symbol
FROM jobs 
WHERE status = 'completed'
  AND completed_at::date = CURRENT_DATE
  AND escrow_locked = false
ORDER BY completed_at DESC;
```

---

## ✅ Verification Checklist

After setup, confirm:

- [ ] CRON_SECRET generated and saved
- [ ] CRON_SECRET set in Edge Function settings
- [ ] APP_URL set in Edge Function settings
- [ ] SERVICE_AUTH_TOKEN set in Edge Function settings
- [ ] ADMIN_WALLET set in Edge Function settings
- [ ] SERVICE_AUTH_TOKEN added to Vercel
- [ ] SQL script updated with CRON_SECRET
- [ ] SQL script executed successfully
- [ ] Job appears in `cron.job` table
- [ ] Manual test curl returns 200
- [ ] First automatic execution successful
- [ ] Logs show successful execution
- [ ] No errors in Edge Function logs

---

## 🎉 Success!

Once all checks pass, your auto-release system is fully operational! 

Jobs will automatically release payments every hour to workers who submitted work more than 10 days ago.

**Next:** Monitor the system for the first 24 hours to ensure smooth operation.

---

## 📞 Need Help?

- Review: [AUTO_RELEASE_EDGE_FUNCTION_COMPLETE.md](./AUTO_RELEASE_EDGE_FUNCTION_COMPLETE.md)
- Check: [FINAL_AUTO_RELEASE_SUMMARY.md](./FINAL_AUTO_RELEASE_SUMMARY.md)
- Test manually with curl
- Check Edge Function logs
- Verify environment variables

---

**Setup Time:** ~5 minutes  
**Status:** Ready to activate  
**Last Updated:** November 27, 2025

