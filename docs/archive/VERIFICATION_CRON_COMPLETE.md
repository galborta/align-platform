# Automated Verification System - Complete

## 🎯 What Was Implemented

A fully automated cron job system that checks pending assets every 5 minutes and transitions them through verification states based on community votes.

---

## ✅ Files Created

1. **`/app/api/check-verifications/route.ts`** - API endpoint for cron job
2. **`/supabase-migrations/007_add_karma_management_functions.sql`** - SQL functions
3. **`/vercel.json`** - Cron configuration
4. **`/CRON_SETUP.md`** - Complete setup guide

---

## 🔑 CRON_SECRET Explained

### What is it?

The `CRON_SECRET` is a **random string you generate yourself** to authenticate cron job requests. It acts as a password to protect your verification endpoint.

### Where does it come from?

**You generate it!** It's not something you get from a service. Think of it like creating a strong password.

### How to generate it:

**Option 1 - OpenSSL (Recommended)**:
```bash
openssl rand -base64 32
```

**Option 2 - Node.js**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option 3 - Online**:
Visit https://generate-secret.vercel.app/32

**Example Output**: `K9j3mN8pQ2rT7vX1wZ4yA6bC8dE0fG2h`

---

## 📍 Where to Add CRON_SECRET

### 1. Local Development (`.env.local`)

Create a file called `.env.local` in your project root (same folder as `package.json`):

```bash
# .env.local
CRON_SECRET=K9j3mN8pQ2rT7vX1wZ4yA6bC8dE0fG2h
```

**⚠️ Important**: 
- This file should **NOT** be committed to git (it's automatically ignored)
- Each developer needs their own copy
- Use the **same secret** as production for consistency

---

### 2. Production (Vercel Dashboard)

1. Go to https://vercel.com
2. Select your project
3. Click **Settings** (top navigation)
4. Click **Environment Variables** (left sidebar)
5. Click **Add New**
6. Fill in:
   - **Name**: `CRON_SECRET`
   - **Value**: `K9j3mN8pQ2rT7vX1wZ4yA6bC8dE0fG2h` (your generated secret)
   - **Environments**: ✓ Production, ✓ Preview, ✓ Development
7. Click **Save**
8. **Redeploy** your project for changes to take effect

---

## 🚀 Quick Setup Steps

### Step 1: Apply SQL Migration

```bash
# In Supabase SQL Editor, run:
supabase-migrations/007_add_karma_management_functions.sql
```

### Step 2: Generate Secret

```bash
openssl rand -base64 32
# Output: K9j3mN8pQ2rT7vX1wZ4yA6bC8dE0fG2h
```

### Step 3: Add to .env.local

```bash
echo "CRON_SECRET=K9j3mN8pQ2rT7vX1wZ4yA6bC8dE0fG2h" >> .env.local
```

### Step 4: Add to Vercel

Go to Vercel Dashboard → Settings → Environment Variables → Add:
- Name: `CRON_SECRET`
- Value: `K9j3mN8pQ2rT7vX1wZ4yA6bC8dE0fG2h`

### Step 5: Deploy

```bash
git add .
git commit -m "Add automated verification cron job"
git push
```

---

## 🔄 How It Works

### Every 5 Minutes:

```
Vercel Cron triggers
  ↓
Calls /api/check-verifications with Authorization header
  ↓
API checks CRON_SECRET
  ↓
Processes all pending/backed assets
  ↓
Transitions states based on thresholds
  ↓
Awards karma
  ↓
Posts chat messages
  ↓
Returns success
```

### State Transitions:

**PENDING → BACKED**
- 0.5% supply OR 5 voters
- Posts green "Community Backed" message

**BACKED → VERIFIED**
- 5% supply OR 10 voters
- Awards remaining 75% karma to all voters
- Copies to main assets table
- Posts purple "Verified" message

**ANY → HIDDEN**
- 2-10% reports (depends on current status)
- Deducts karma from upvoters
- Warns submitter (may trigger ban)
- Rewards reporters
- Posts red "Rejected" message

---

## 🧪 Testing

### Test Locally:

```bash
# Start your dev server
npm run dev

# In another terminal, trigger the cron:
curl -X GET http://localhost:3000/api/check-verifications \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Expected response:
# {"success":true,"processed":2}
```

### Test in Production:

```bash
# After deploying to Vercel:
curl -X GET https://your-domain.vercel.app/api/check-verifications \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 📊 Monitoring

### Check Cron Execution:

1. Go to Vercel Dashboard
2. Select your project
3. Go to **Settings → Cron Jobs**
4. See last execution time and status

### Check Logs:

1. Go to Vercel Dashboard
2. Select your project
3. Go to **Deployments → Latest → Functions**
4. Find `/api/check-verifications`
5. View execution logs

---

## 🔍 Troubleshooting

### "Unauthorized" Error

**Problem**: CRON_SECRET doesn't match

**Fix**: 
- Check for typos
- Ensure same secret in both `.env.local` and Vercel
- Redeploy after adding to Vercel

### No Assets Processed

**Problem**: Returns `{"processed":0}`

**Fix**:
- Check if assets meet thresholds
- Verify assets are in `pending` or `backed` status
- Check vote counts are correct

### Functions Not Found

**Problem**: SQL errors about missing functions

**Fix**:
- Apply migration 007
- Verify with: `SELECT routine_name FROM information_schema.routines WHERE routine_name IN ('increment_assets_added', 'add_warning');`

---

## 📈 What Happens Next

Once set up, the system will automatically:

1. ✅ Check assets every 5 minutes
2. ✅ Transition to BACKED when thresholds met
3. ✅ Transition to VERIFIED when thresholds met
4. ✅ Award 75% karma to voters on verification
5. ✅ Copy verified assets to main tables
6. ✅ Hide assets with too many reports
7. ✅ Warn and ban bad actors
8. ✅ Post status updates to chat feed

---

## 🎉 You're All Set!

Your automated verification system is ready. Assets will now progress through states automatically based on community votes. No manual intervention needed!

**Key Points to Remember**:
- `CRON_SECRET` is a random string **you generate**
- Add it to both `.env.local` and Vercel
- Keep it secret (don't commit to git)
- Runs every 5 minutes automatically
- Check Vercel logs to monitor execution

For detailed setup instructions, see **`CRON_SETUP.md`**.

Good luck! 🚀

