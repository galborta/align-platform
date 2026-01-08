# API Testing Guide: Social Job Submission Endpoint

## Quick Test Commands

### 1. Test with cURL (requires valid wallet signature)

```bash
curl -X POST http://localhost:3000/api/jobs/social/{JOB_ID}/submit \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "YOUR_WALLET_ADDRESS",
    "signature": "BASE58_SIGNATURE",
    "message": "Submit to social job: {JOB_ID}\nTimestamp: 1704384000000",
    "follower_range": {
      "min_followers": 1000,
      "max_followers": 5000
    },
    "social_tweet_link": "https://x.com/username/status/123456789",
    "social_payment_amount_usd": 25.00
  }'
```

### 2. Test Error Scenarios

#### Invalid Tweet URL
```bash
# Should return: invalid_tweet_url
"social_tweet_link": "https://facebook.com/post/123"
```

#### Budget Exhausted
```bash
# Submit multiple times until budget runs out
# Should eventually return: budget_exhausted
```

#### Duplicate Submission
```bash
# Submit twice with same wallet
# Second attempt should return: already_submitted
```

#### Duplicate Tweet
```bash
# Submit with same tweet link but different wallet
# Should return: duplicate_tweet
```

#### Campaign Ended
```bash
# Test with job past social_campaign_end_date
# Should return: campaign_ended
```

## Browser Console Testing

### Open SubmissionModal and Monitor

```javascript
// In browser console
// Monitor fetch requests
const originalFetch = window.fetch
window.fetch = async (...args) => {
  console.log('Fetch request:', args)
  const response = await originalFetch(...args)
  const clone = response.clone()
  const data = await clone.json()
  console.log('Fetch response:', data)
  return response
}
```

## Expected Response Formats

### Success (200)
```json
{
  "success": true,
  "submission_id": "550e8400-e29b-41d4-a716-446655440000",
  "payment_reserved": 50.00,
  "payment_status": "pending",
  "auto_approve_date": "2024-01-15T12:00:00Z",
  "message": "Submission received successfully"
}
```

### Error (400 - Bad Request)
```json
{
  "success": false,
  "error": "already_submitted"
}
```

### Error (401 - Unauthorized)
```json
{
  "success": false,
  "error": "invalid_signature"
}
```

### Error (404 - Not Found)
```json
{
  "success": false,
  "error": "job_not_found"
}
```

### Error (500 - Internal Server Error)
```json
{
  "success": false,
  "error": "internal_error",
  "message": "Detailed error message"
}
```

## Validation Checklist

### Before Submission
- ✅ Wallet connected
- ✅ Tier selected
- ✅ Tweet link entered (valid format)
- ✅ Both checkboxes confirmed
- ✅ Campaign still accepting submissions

### During Submission
- ✅ Signature obtained from wallet
- ✅ API call made with correct data
- ✅ Loading state displayed

### After Submission
- ✅ Success: Modal closes, callback triggered
- ✅ Error: User-friendly message displayed
- ✅ Form remains editable on error

## Database Verification

### Check Submission Created
```sql
SELECT * FROM job_submissions 
WHERE job_id = 'YOUR_JOB_ID' 
ORDER BY submitted_at DESC 
LIMIT 1;
```

### Check Job Status Updated
```sql
SELECT id, title, status, updated_at 
FROM jobs 
WHERE id = 'YOUR_JOB_ID';
-- Status should be 'active' after first submission
```

### Check Budget Reserved
```sql
SELECT 
  social_total_budget_usd,
  social_actual_budget_released
FROM jobs 
WHERE id = 'YOUR_JOB_ID';
-- Released amount should increase by tier price
```

## Common Issues & Fixes

### Issue: "invalid_signature"
**Cause**: Wallet signature verification failed
**Fix**: 
- Ensure message format matches: `Submit to social job: {jobId}\nTimestamp: {timestamp}`
- Check timestamp is within 5 minutes
- Verify wallet is connected

### Issue: "invalid_tweet_url"
**Cause**: Tweet URL format doesn't match pattern
**Fix**: 
- Use format: `https://x.com/username/status/123456` or `https://twitter.com/username/status/123456`
- Remove query parameters if causing issues

### Issue: "budget_exhausted"
**Cause**: Campaign has no remaining budget
**Fix**: 
- Check `social_actual_budget_released` vs `social_total_budget_usd`
- Campaign may need budget increase

### Issue: "invalid_tier"
**Cause**: Submitted follower range doesn't match any tier
**Fix**: 
- Verify `social_budget_tiers` in database
- Ensure frontend and backend tier lists match

## Monitoring & Logs

### Server Logs to Check
```
[Social Submit API] Processing submission for job {jobId}
[Social Submit API] Verified wallet: {wallet}...
[Social Submit API] Job found: {title}
[Social Submit API] Matched tier: {min}-{max} ($X)
[Social Submit API] Budget reserved successfully
[Social Submit API] Submission created: {id}
[Social Submit API] Updated job status to active
```

### Frontend Logs to Check
```
[SubmissionModal] Starting submission process...
[SubmissionModal] Requesting wallet signature...
[SubmissionModal] Signature obtained
[SubmissionModal] Calling API endpoint...
[SubmissionModal] API response: { status: 200, success: true }
[SubmissionModal] Submission successful: {id}
```

## Performance Testing

### Load Test Scenario
```bash
# Test concurrent submissions (should handle gracefully)
for i in {1..10}; do
  curl -X POST ... & # Run in parallel
done
wait
```

### Expected Behavior
- First submission succeeds
- Subsequent submissions from same wallet return `already_submitted`
- Budget reservation prevents overspending
- No race conditions in database

## Security Testing

### Test Cases
1. **Replay Attack**: Try submitting with old timestamp (> 5 min)
2. **Modified Data**: Change tier price in request (should fail validation)
3. **SQL Injection**: Try malicious strings in tweet URL (should be sanitized)
4. **XSS**: Try script tags in fields (should be escaped)

### Expected Results
- ✅ Old timestamps rejected
- ✅ Price modifications detected
- ✅ SQL injection attempts blocked by prepared statements
- ✅ XSS attempts escaped by framework

