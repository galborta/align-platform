# 🚀 Admin Escrow Dashboard - Quick Reference

## Access URL
```
https://your-app.com/admin/escrow-releases
```

---

## 🔐 Login Steps
1. Navigate to `/admin/escrow-releases`
2. Connect admin wallet
3. Sign verification message
4. Dashboard loads automatically

---

## 📊 Dashboard Sections

### Stats Cards (Top)
- **Pending**: Total releases scheduled
- **Overdue**: Releases past due date
- **Failed**: Releases paused after 3 retries
- **Success Rate**: Overall success percentage

### Filters
- **Search**: Job title, ID, or worker wallet
- **Token**: Filter by SOL, USDC, etc.

### Pending Releases Table
- Jobs scheduled for auto-release
- Countdown timer
- Actions: Release Now, Pause

### Failed Releases Table
- Jobs that failed after 3 retries
- Error messages
- Actions: Manual Release, Resume

### Recent Attempts Log
- Last 10 release attempts
- Status and transaction signatures

---

## 🎯 Common Actions

### Release Payment Now
1. Find job in pending table
2. Click "Release Now"
3. Confirm action
4. Payment sent immediately

### Pause Auto-Release
1. Find job in pending table
2. Click "Pause"
3. Auto-release stops
4. Requires manual intervention

### Resume Auto-Release
1. Find job in failed table
2. Click "Resume Auto-Release"
3. Countdown restarts

### Search for Job
1. Type in search box
2. Results filter instantly
3. Search by title, ID, or wallet

### Filter by Token
1. Click "Token" dropdown
2. Select token (SOL, USDC, etc.)
3. View filtered results

---

## ⚡ Quick Troubleshooting

### Release Failed - What to Do?

**Check Error Message**:
- `Insufficient funds` → Add funds to escrow wallet
- `Network error` → Wait for retry
- `Invalid wallet` → Contact support

**Actions**:
1. Review error in failed table
2. Fix underlying issue
3. Click "Manual Release" to retry
4. Or "Resume Auto-Release" to let system retry

### Overdue Release

**Why?**:
- Cron job not running
- System paused the release
- Network issues

**Actions**:
1. Check if release is paused
2. Click "Release Now" for immediate release
3. Check cron job logs

### Job Not Showing Up

**Check**:
- Job status is "submitted"
- `release_scheduled_at` is set
- `release_paused` is false
- `escrow_locked` is true

---

## 🔄 Auto-Refresh

**Default**: Enabled (60 seconds)

**Controls**:
- ▶️ Play icon = Auto-refresh ON (green)
- ⏸️ Pause icon = Auto-refresh OFF (gray)
- 🔄 Refresh icon = Manual refresh

---

## 🎨 Color Coding

- 🔵 **Blue** = Normal pending
- 🟠 **Orange** = Overdue
- 🔴 **Red** = Failed/Paused
- 🟢 **Green** = Success

---

## 📱 Mobile Access

The dashboard is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones

---

## 🔒 Security

- ✅ Only admin wallet can access
- ✅ Must sign verification message
- ✅ Session expires after 24 hours
- ✅ Auto-logout on wallet disconnect

---

## 📞 Need Help?

**Error Messages**:
- Check `last_release_error` column
- Review Recent Attempts Log
- Check transaction on Solscan

**Manual Release Not Working**:
1. Check escrow wallet balance
2. Verify job status is "submitted"
3. Ensure escrow is locked
4. Check RPC connection

**Dashboard Not Loading**:
1. Verify admin wallet connected
2. Check wallet address matches `ADMIN_WALLET`
3. Sign verification message
4. Refresh page

---

## 🎯 Best Practices

### Daily Checks
- Review overdue releases
- Check failed releases
- Monitor success rate

### Weekly Reviews
- Analyze error patterns
- Review success rates by token
- Check cron job performance

### When Problems Arise
1. Check error message
2. Verify escrow balance
3. Test manual release
4. Resume auto-release if fixed

---

## 📊 Useful Queries

### Find All Overdue
```sql
SELECT * FROM jobs
WHERE status = 'submitted'
  AND release_scheduled_at <= NOW()
  AND release_paused = false
ORDER BY release_scheduled_at ASC;
```

### Check Success Rate
```sql
SELECT 
  COUNT(*) FILTER (WHERE status = 'confirmed') * 100.0 / COUNT(*) as success_rate
FROM job_escrow_transactions
WHERE transaction_type = 'release_to_worker'
  AND created_at > NOW() - INTERVAL '7 days';
```

### Find Failed Jobs
```sql
SELECT * FROM jobs
WHERE status = 'submitted'
  AND release_paused = true
ORDER BY release_paused_at DESC;
```

---

## 🚨 Emergency Procedures

### Mass Failures
1. Pause auto-refresh
2. Check escrow wallet balance
3. Verify RPC connection
4. Review error patterns
5. Fix underlying issue
6. Resume auto-releases

### Single Job Stuck
1. Check job details
2. Review error message
3. Manual release
4. Monitor next job

---

## 📈 Success Metrics

**Target Success Rate**: >95%  
**Max Overdue Time**: <1 hour  
**Failed Jobs**: <5% of total  

---

## 🔗 Related Pages

- Main Admin: `/admin`
- Project Admin: `/admin/projects/[id]`
- Job Details: `/project/[id]/jobs/[jobId]`

---

## 📚 Full Documentation

For complete details, see:
- `ADMIN_ESCROW_DASHBOARD_COMPLETE.md`
- `RETRY_TRACKING_SYSTEM_COMPLETE.md`

---

**Last Updated**: November 27, 2025  
**Status**: Production Ready 🚀








