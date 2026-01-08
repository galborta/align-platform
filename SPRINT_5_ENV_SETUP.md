# Sprint 5: Campaign Completion - Environment Setup

## Required Environment Variables

### CRON_SECRET

**Purpose:** Authenticates cron job requests to prevent unauthorized access

**Generate a secure secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Local Development (.env.local):**
```bash
CRON_SECRET=your-random-secret-here
```

**Production (Vercel):**
1. Go to Vercel dashboard → Your Project → Settings → Environment Variables
2. Add new variable:
   - Name: `CRON_SECRET`
   - Value: (paste your generated secret)
   - Environment: Production, Preview, Development
3. Save and redeploy

## Testing Locally

### Manual Trigger (Development Only)

```bash
# Without auth (works in dev mode)
curl http://localhost:3000/api/cron/auto-approve-campaigns

# With auth header (production-like)
curl -H "Authorization: Bearer your-cron-secret" \
  http://localhost:3000/api/cron/auto-approve-campaigns
```

### Expected Response

```json
{
  "success": true,
  "message": "Processed X campaigns",
  "processed": 5,
  "campaigns_with_submissions": 3,
  "campaigns_without_submissions": 2,
  "duration_ms": 1234,
  "details": [
    {
      "job_id": "uuid",
      "job_title": "Campaign Name",
      "submission_count": 0,
      "action_taken": "notified_zero_submissions"
    },
    {
      "job_id": "uuid",
      "job_title": "Campaign Name 2",
      "submission_count": 5,
      "action_taken": "auto_approved_pending",
      "auto_approved_count": 2
    }
  ],
  "timestamp": "2025-01-03T..."
}
```

## Vercel Cron Configuration

Already added to `vercel.json`:

```json
{
  "path": "/api/cron/auto-approve-campaigns",
  "schedule": "*/5 * * * *"
}
```

**Schedule:** Every 5 minutes

## Cron Job Flow

1. **Authentication:** Verifies `CRON_SECRET` header
2. **Query:** Finds campaigns past `social_review_deadline`
3. **Process Each Campaign:**
   - **Zero submissions:** Notify poster (can cancel for refund, no penalty)
   - **Has submissions:** Auto-approve pending, notify workers
4. **Mark Processed:** Set `social_payments_distributed = true`
5. **Return Summary:** Details of processed campaigns

## Security Notes

- ✅ CRON_SECRET required in production (bypassed in dev)
- ✅ Service role used for database access (elevated permissions)
- ✅ Each campaign processed only once (via flag)
- ✅ Independent error handling (one failure doesn't stop others)

## Monitoring

Check logs in Vercel dashboard:
- Functions → Select cron function → Logs
- Look for `[Campaign Cron]` prefix

## Next Steps

After verifying cron job works:
- Task 2: Implement payment distribution logic
- Task 3: Build budget refund calculation
- Task 4: Create early closure endpoint
- Task 5: Implement cancellation with karma penalty

