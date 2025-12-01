# 🚀 Messaging System - Deployment Runbook

**Purpose:** Step-by-step guide for deploying the messaging system to production.

**Estimated Time:** 30-45 minutes  
**Last Updated:** November 24, 2025  
**Version:** 1.0.0

---

## 📋 Pre-Deployment Checklist

### 1. Code Review

- [ ] All code changes reviewed and approved
- [ ] All linter errors resolved (`npm run lint`)
- [ ] TypeScript compilation successful (`npm run build`)
- [ ] No console errors in dev environment
- [ ] All merge conflicts resolved

### 2. Testing

- [ ] Unit tests pass (`npm test` - if applicable)
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] Manual testing completed (see [Testing Checklist](#testing-checklist))
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile responsive testing (iOS, Android)

### 3. Documentation

- [ ] User guide created (`MESSAGING_SYSTEM_GUIDE.md`)
- [ ] API reference complete (`MESSAGING_API_REFERENCE.md`)
- [ ] Migration guide ready (`MESSAGING_MIGRATION_GUIDE.md`)
- [ ] README.md updated with messaging features
- [ ] Changelog updated with release notes

### 4. Dependencies

- [ ] All npm packages up to date
- [ ] No critical security vulnerabilities (`npm audit`)
- [ ] Package-lock.json committed
- [ ] All peer dependencies resolved

---

## 🗄️ Database Deployment

### Step 1: Review Migration Files

**Location:** `/supabase-migrations/`

**Files to deploy:**
```
013_create_messaging_tables.sql
014_add_notification_preferences.sql
015_add_block_reason.sql (if not already applied)
```

### Step 2: Backup Database

**Before applying migrations:**

```bash
# Via Supabase Dashboard
1. Go to Database > Backups
2. Click "Create Backup"
3. Name: "pre-messaging-deployment-YYYY-MM-DD"
4. Wait for completion
5. Download backup file (optional)
```

**Via CLI (if available):**
```bash
supabase db dump -f backup-$(date +%Y%m%d).sql
```

### Step 3: Apply Migrations

**Via Supabase MCP:**

```typescript
// Use Supabase MCP in Cursor
await mcp_Supabase_apply_migration({
  project_id: 'your-project-id',
  name: 'create_messaging_tables',
  query: `-- content of 013_create_messaging_tables.sql`
})
```

**Via Supabase Dashboard:**

1. Navigate to **SQL Editor**
2. Click **"New Query"**
3. Copy contents of `013_create_messaging_tables.sql`
4. Click **"Run"**
5. Verify success message
6. Repeat for remaining migrations

**Via Supabase CLI:**

```bash
supabase db push
```

### Step 4: Verify Tables Created

**SQL Query to verify:**

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'user_profiles',
  'conversations',
  'messages',
  'blocked_users',
  'typing_indicators'
);

-- Should return 5 rows
```

### Step 5: Verify Indexes

**SQL Query:**

```sql
-- Check indexes
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('messages', 'conversations', 'user_profiles')
ORDER BY tablename, indexname;

-- Verify these indexes exist:
-- idx_messages_conversation_created
-- idx_messages_unread
-- idx_conversations_participant1
-- idx_conversations_participant2
-- idx_user_profiles_wallet_lastseen
```

### Step 6: Verify RLS Policies

**SQL Query:**

```sql
-- Check RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'user_profiles',
  'conversations',
  'messages',
  'blocked_users',
  'typing_indicators'
);

-- All should have rowsecurity = true

-- Count policies
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
```

### Step 7: Enable Realtime

**Via Supabase Dashboard:**

1. Go to **Database > Replication**
2. Find these tables and enable replication:
   - `messages`
   - `conversations`
   - `typing_indicators`
   - `user_profiles` (for online status)
3. Click **Save**

**Verify with SQL:**

```sql
-- Check realtime is enabled
SELECT 
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename IN ('messages', 'conversations', 'typing_indicators', 'user_profiles');
```

---

## 🔧 Environment Variables

### Step 1: Verify Environment Variables

**Required Variables:**

```bash
# .env.local (Development)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Production
NEXT_PUBLIC_SUPABASE_URL=https://your-production-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
```

### Step 2: Set Production Variables

**Vercel:**

1. Go to project **Settings > Environment Variables**
2. Add/verify:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Set environment: **Production**
4. Click **Save**

**Other Platforms:**

Follow platform-specific instructions for setting environment variables.

### Step 3: Verify Variables

**Test script:**

```bash
# Verify variables are set
echo "SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}"
echo "ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY:0:20}..." # Show first 20 chars

# Should not be empty
```

---

## 🏗️ Build & Deploy

### Step 1: Clean Build

```bash
# Remove previous builds
rm -rf .next
rm -rf out
rm -rf node_modules/.cache

# Reinstall dependencies (optional but recommended)
rm -rf node_modules
npm install

# Run linter
npm run lint

# Type check
npx tsc --noEmit

# Build
npm run build
```

### Step 2: Check Build Output

**Look for:**
- ✅ No TypeScript errors
- ✅ No build warnings
- ✅ Bundle size is reasonable
- ✅ All routes compiled successfully

**Expected output:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Creating an optimized production build
✓ Collecting page data
✓ Finalizing page optimization

Route (app)                              Size     First Load JS
...
```

### Step 3: Test Production Build Locally

```bash
# Start production server locally
npm start

# Or with Next.js
npx next start
```

**Manual Testing:**
- [ ] Open http://localhost:3000
- [ ] Connect wallet
- [ ] Open messaging sidebar (Cmd/Ctrl + M)
- [ ] Send test message
- [ ] Verify real-time updates work
- [ ] Check console for errors

### Step 4: Deploy to Production

**Vercel (Recommended):**

```bash
# Via Git (Automatic)
git add .
git commit -m "feat: deploy messaging system v1.0.0"
git push origin main

# Via Vercel CLI
vercel --prod
```

**Manual Deploy:**
1. Push to main branch
2. Vercel auto-deploys
3. Wait for deployment
4. Check deployment logs

**Other Platforms:**

Follow platform-specific deployment process.

### Step 5: Verify Deployment

**After deployment:**

- [ ] Visit production URL
- [ ] Check health endpoint (if available)
- [ ] Verify no 404s in browser console
- [ ] Check Supabase connection works
- [ ] Test wallet connection
- [ ] Send test message

---

## ✅ Testing Checklist

### Manual Testing

#### Basic Functionality

- [ ] **Connect Wallet**
  - [ ] Phantom wallet connects
  - [ ] Solflare wallet connects
  - [ ] Wallet address shows in header
  - [ ] Profile auto-created on first connect

- [ ] **Open Messaging**
  - [ ] Click mail icon in header
  - [ ] Keyboard shortcut (Cmd/Ctrl + M) works
  - [ ] Sidebar opens smoothly
  - [ ] Shows empty state if no messages

- [ ] **Send Message**
  - [ ] Can start new conversation
  - [ ] Can type message (up to 5000 chars)
  - [ ] Enter key sends message
  - [ ] Shift+Enter creates new line
  - [ ] Message appears immediately

- [ ] **Receive Message**
  - [ ] Real-time message appears
  - [ ] Unread count updates
  - [ ] Notification badge shows
  - [ ] Sound plays (if enabled)

- [ ] **Read Receipts**
  - [ ] Sent messages show ✓
  - [ ] Read messages show ✓✓
  - [ ] Updates in real-time

- [ ] **Online Status**
  - [ ] Green dot shows when user online
  - [ ] Updates when user connects/disconnects
  - [ ] Respects privacy settings

#### Privacy & Blocking

- [ ] **Privacy Settings**
  - [ ] Can change privacy level
  - [ ] Can change message permissions
  - [ ] Settings save successfully
  - [ ] Settings enforced immediately

- [ ] **Block User**
  - [ ] Block button accessible
  - [ ] Can select block reason
  - [ ] Can choose to delete history
  - [ ] Block confirmation works
  - [ ] Conversation disappears if deleted

- [ ] **Blocked Behavior**
  - [ ] Can't send messages to blocked user
  - [ ] Blocked user can't send messages
  - [ ] Can view blocked users list
  - [ ] Can unblock users

#### Search & Navigation

- [ ] **Message Search**
  - [ ] Search bar accessible
  - [ ] Can search message content
  - [ ] Results highlight matches
  - [ ] Can click result to open conversation

- [ ] **Conversation List**
  - [ ] Shows all conversations
  - [ ] Unread filter works
  - [ ] Sorted correctly (unread first)
  - [ ] Can scroll through conversations
  - [ ] Can delete conversations

#### Edge Cases

- [ ] **Rate Limiting**
  - [ ] Sending 10+ messages shows error
  - [ ] Rate limit resets after 1 minute

- [ ] **Long Messages**
  - [ ] 5000 char limit enforced
  - [ ] Character counter shows at 4500
  - [ ] Can't send over limit

- [ ] **Network Issues**
  - [ ] Offline detection works
  - [ ] Retry mechanism functions
  - [ ] Error messages clear

- [ ] **Multiple Tabs**
  - [ ] Messages sync across tabs
  - [ ] No duplicate notifications
  - [ ] State consistent

### Automated Testing

```bash
# Run E2E tests
npm run test:e2e

# Tests should cover:
# - Wallet connection
# - Message sending/receiving
# - Real-time updates
# - Privacy controls
# - Blocking functionality
```

---

## 📊 Post-Deployment Monitoring

### Step 1: Immediate Checks (First 15 Minutes)

**Supabase Dashboard:**

1. Go to **Database > Logs**
2. Monitor for errors
3. Check query performance

**Application Logs:**

```bash
# Vercel logs
vercel logs --follow

# Look for:
# - Supabase connection errors
# - Real-time subscription issues
# - Rate limit hits
# - Authentication failures
```

**User Monitoring:**

- [ ] Check first user messages sent
- [ ] Verify real-time updates working
- [ ] Monitor error rates in Sentry (if available)

### Step 2: Performance Monitoring (First Hour)

**Database Performance:**

```sql
-- Check slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
WHERE query LIKE '%messages%'
OR query LIKE '%conversations%'
ORDER BY mean_time DESC
LIMIT 10;
```

**Metrics to Track:**

- [ ] Message send latency (should be < 200ms)
- [ ] Real-time subscription lag (should be < 100ms)
- [ ] Database query times (should be < 50ms)
- [ ] Page load time (should be < 3s)

### Step 3: User Engagement (First 24 Hours)

**Analytics Queries:**

```sql
-- Total messages sent
SELECT COUNT(*) FROM messages 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Active users
SELECT COUNT(DISTINCT sender_wallet) 
FROM messages 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Average messages per user
SELECT AVG(message_count) FROM (
  SELECT sender_wallet, COUNT(*) as message_count
  FROM messages
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY sender_wallet
) subquery;
```

**User Feedback:**

- [ ] Monitor Discord for feedback
- [ ] Check Twitter mentions
- [ ] Review support tickets
- [ ] Track error reports

### Step 4: Issue Response Plan

**If Issues Detected:**

1. **Assess Severity**
   - Critical: System down, data loss
   - High: Feature broken, widespread issues
   - Medium: Some users affected
   - Low: Minor UI issues

2. **Immediate Actions**
   - Document issue clearly
   - Check error logs for stack traces
   - Identify affected users
   - Determine if rollback needed

3. **Communication**
   - Critical/High: Immediate status page update
   - Medium: Twitter announcement
   - Low: Track for next update

4. **Rollback Procedure** (if needed)
   ```bash
   # Via Vercel
   vercel rollback [deployment-url]
   
   # Via Git
   git revert [commit-hash]
   git push origin main
   ```

---

## 🔄 Rollback Procedure

### When to Rollback

**Critical Issues:**
- Database data corruption
- Complete system failure
- Security vulnerability
- Massive performance degradation

**Process:**

### Step 1: Immediate Rollback

```bash
# Vercel: Revert to previous deployment
1. Go to Deployments
2. Find last stable deployment
3. Click "..." menu
4. Select "Promote to Production"

# Git: Revert commits
git revert HEAD
git push origin main
```

### Step 2: Database Rollback

```sql
-- If migrations need to be reversed
-- Carefully crafted down migrations

-- Drop tables (CAUTION!)
DROP TABLE IF EXISTS typing_indicators CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS blocked_users CASCADE;
-- Don't drop user_profiles if used elsewhere
```

**⚠️ WARNING:** Database rollback will delete data. Only do this in emergencies.

### Step 3: Restore from Backup

```bash
# If data needs to be restored
1. Go to Supabase Dashboard
2. Database > Backups
3. Find pre-deployment backup
4. Click "Restore"
5. Confirm restoration
```

### Step 4: Verify Rollback

- [ ] Check application loads
- [ ] Verify old functionality works
- [ ] Confirm no messaging UI elements
- [ ] Test core features unaffected

### Step 5: Post-Rollback

- [ ] Announce rollback to users
- [ ] Document what went wrong
- [ ] Fix issues in development
- [ ] Plan re-deployment

---

## 📢 User Communication

### Pre-Deployment Announcement

**24 Hours Before:**

```markdown
🚀 New Feature Alert!

Tomorrow we're launching our messaging system! 

What to expect:
✅ Direct messaging with token holders
✅ Privacy controls
✅ Real-time chat
✅ Read receipts

The platform will be briefly unavailable during deployment (5-10 minutes).

Deployment window: [DATE] at [TIME] [TIMEZONE]
```

### Deployment Day

**Start of Deployment:**

```markdown
🔧 Maintenance Mode

We're deploying the messaging system now. 
Platform will be back in 5-10 minutes.

Follow here for updates: [STATUS PAGE]
```

**After Successful Deployment:**

```markdown
✅ Messaging is LIVE!

New features available now:
🔹 Send direct messages
🔹 Real-time chat
🔹 Privacy controls
🔹 Block users

Get started: [LINK TO MIGRATION GUIDE]

Questions? Check our FAQ: [LINK]
```

### Post-Deployment

**24 Hours After:**

```markdown
📊 Messaging System - Day 1 Report

- [X] messages sent
- [Y] active users
- [Z]% positive feedback

Thank you for trying it out!

Found a bug? Report it here: [LINK]
Have feedback? Let us know: [LINK]
```

---

## 🐛 Known Issues & Workarounds

### Issue 1: Real-time Subscription Lag

**Symptoms:**
- Messages delayed by 5+ seconds
- Typing indicators not showing

**Workaround:**
```typescript
// Increase subscription timeout
const channel = supabase
  .channel('conversation', {
    config: {
      broadcast: { self: true },
      presence: { key: wallet }
    }
  })
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Connected to real-time')
    }
  })
```

### Issue 2: High Database Load

**Symptoms:**
- Slow query times
- Timeouts

**Solution:**
```sql
-- Add missing indexes if needed
CREATE INDEX IF NOT EXISTS idx_messages_sender 
ON messages(sender_wallet, created_at DESC);

-- Analyze tables
ANALYZE messages;
ANALYZE conversations;
```

### Issue 3: Rate Limit False Positives

**Symptoms:**
- Users blocked when not sending fast

**Solution:**
- Adjust rate limit trigger (see database function)
- Clear rate limit cache

---

## 📝 Deployment Log Template

```markdown
# Messaging System Deployment - [DATE]

## Deployment Details
- **Date:** [YYYY-MM-DD]
- **Time:** [HH:MM TZ]
- **Deployed By:** [NAME]
- **Version:** 1.0.0
- **Commit:** [COMMIT HASH]

## Pre-Deployment Checks
- [ ] Code reviewed
- [ ] Tests passed
- [ ] Database backed up
- [ ] Documentation complete

## Deployment Steps
- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] Build completed
- [ ] Deployed to production
- [ ] Post-deployment tests passed

## Issues Encountered
[List any issues and resolutions]

## Performance Metrics
- Average response time: [X ms]
- Database query time: [Y ms]
- First message sent: [TIME]

## User Feedback
[Summary of initial feedback]

## Next Steps
[Any follow-up actions needed]

## Sign-off
Deployment completed successfully: [YES/NO]
Signed: [NAME]
```

---

## 🎯 Success Criteria

**Deployment is successful when:**

- [ ] All database migrations applied without errors
- [ ] Production build completes successfully
- [ ] Application loads without errors
- [ ] Users can send and receive messages
- [ ] Real-time updates work correctly
- [ ] Privacy controls function properly
- [ ] Block system operates as expected
- [ ] No critical errors in logs for 1 hour
- [ ] Performance metrics within acceptable range
- [ ] Zero data loss incidents
- [ ] Positive initial user feedback

**Performance Targets:**

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Message send latency | < 200ms | < 500ms |
| Real-time lag | < 100ms | < 300ms |
| Database query time | < 50ms | < 200ms |
| Page load time | < 3s | < 5s |
| Error rate | < 0.1% | < 1% |

---

## 📞 Emergency Contacts

**On-Call Team:**
- Tech Lead: [NAME] - [PHONE/SLACK]
- Backend Dev: [NAME] - [PHONE/SLACK]
- Frontend Dev: [NAME] - [PHONE/SLACK]

**External:**
- Supabase Support: support@supabase.io
- Vercel Support: [Support Portal]

**Escalation Path:**
1. On-call developer (immediate)
2. Tech lead (15 minutes)
3. CTO (30 minutes)
4. CEO (1 hour - critical only)

---

## 📚 Additional Resources

- [Messaging System Guide](./MESSAGING_SYSTEM_GUIDE.md)
- [API Reference](./MESSAGING_API_REFERENCE.md)
- [Migration Guide](./MESSAGING_MIGRATION_GUIDE.md)
- [Performance Optimization](./MESSAGING_PERFORMANCE_OPTIMIZATION_COMPLETE.md)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**Deployment Runbook Version:** 1.0.0  
**Last Updated:** November 24, 2025  
**Maintained By:** Engineering Team  
**Review Schedule:** Quarterly







