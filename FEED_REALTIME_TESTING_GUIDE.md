# Activity Feed Real-time Testing Guide 🧪

Quick guide to test and verify that real-time subscriptions are working correctly.

---

## 🚀 Quick Start

### 1. Start Development Server
```bash
npm run dev
```

### 2. Open Project Page
Navigate to any project detail page:
```
http://localhost:3000/project/[project-id]
```

### 3. Open Browser Console
Press `F12` and check for subscription logs:
```
🔔 Setting up feed subscriptions for project: abc-123
```

You should see **10 subscription channels** created (one per activity table).

---

## ✅ Test Scenarios

### Test 1: Real-time Job Posting

**Setup**:
1. Open project page in **Tab A**
2. Open same project in **Tab B**

**Steps**:
1. In Tab B, click "Create Job"
2. Fill in job details and submit
3. Switch to Tab A

**Expected Result**:
- Console log: `📋 New job: { id: ..., title: ... }`
- Console log: `📨 Received real-time event: job_posted`
- Console log: `✅ Adding 1 new item(s) to feed`
- **Job appears at top of feed in Tab A instantly** (no refresh)

**Pass Criteria**: ✅ Job visible in Tab A within 1 second

---

### Test 2: Real-time Application

**Setup**:
1. Have an open job in the project
2. Open project page in **Tab A**
3. Open job detail in **Tab B**

**Steps**:
1. In Tab B, submit a job application
2. Switch to Tab A

**Expected Result**:
- Console log: `📝 New application: ...`
- Console log: `📨 Received real-time event: job_applied`
- **Application activity appears in Tab A feed instantly**

**Pass Criteria**: ✅ Application visible in Tab A within 1 second

---

### Test 3: Real-time Asset Submission

**Setup**:
1. Open project page in **Tab A**
2. Open project admin dashboard in **Tab B**

**Steps**:
1. In Tab B, go to "Pending Assets" tab
2. Submit a new asset (social/creative/legal)
3. Switch to Tab A

**Expected Result**:
- Console log: `🎨 New asset: ...`
- Console log: `📨 Received real-time event: asset_submitted`
- **Asset submission appears in Tab A feed instantly**

**Pass Criteria**: ✅ Asset visible in Tab A within 1 second

---

### Test 4: Real-time Tips

**Setup**:
1. Open project page in **Tab A**
2. Open project chat in **Tab B**

**Steps**:
1. In Tab B, send a **public tip** to another user
2. Switch to Tab A

**Expected Result**:
- Console log: `💰 New tip: ...`
- Console log: `📨 Received real-time event: tip_sent`
- **Tip activity appears in Tab A feed instantly**

**Pass Criteria**: ✅ Tip visible in Tab A within 1 second

---

### Test 5: Debouncing (Rapid Events)

**Setup**:
1. Open project page in **Tab A**
2. Have 3 friends with wallets ready

**Steps**:
1. All 3 friends upvote same application within 1 second
2. Watch Tab A console

**Expected Result**:
- Console logs: 3x `👍 New application vote: ...`
- **Wait 500ms**
- Console log: `📨 Received real-time event: job_application_upvoted` (batched)
- **Feed updates ONCE with all 3 votes** (not 3 separate updates)

**Pass Criteria**: ✅ Single feed update after 500ms delay

---

### Test 6: Deduplication

**Setup**:
1. Open project page (feed loads with initial 20 items)
2. Perform a new activity (e.g., post job)

**Steps**:
1. Wait for activity to appear in feed via subscription
2. Hard refresh page (Cmd+Shift+R / Ctrl+Shift+F5)

**Expected Result**:
- New activity appears via real-time
- After refresh, activity still shows **only once** (not duplicated)

**Pass Criteria**: ✅ No duplicate items after refresh

---

### Test 7: Memory Cleanup

**Setup**:
1. Open project page
2. Open browser console

**Steps**:
1. Verify subscriptions setup: `🔔 Setting up feed subscriptions`
2. Navigate away from project page
3. Check console logs

**Expected Result**:
- Console log: `🔕 Cleaning up feed subscriptions`
- No lingering WebSocket connections (check Network tab)

**Pass Criteria**: ✅ Cleanup log appears, WebSockets closed

---

### Test 8: Job Status Changes

**Setup**:
1. Open project page in **Tab A**
2. Have a job that's "assigned" status

**Steps**:
1. In Tab B (or via admin), mark job as "completed"
2. Switch to Tab A

**Expected Result**:
- Console log: `✅ Job completed: ...`
- Console log: `📨 Received real-time event: job_completed`
- **Job completion activity appears in Tab A feed**

**Pass Criteria**: ✅ Completion status visible instantly

---

### Test 9: Asset Verification

**Setup**:
1. Open project page in **Tab A**
2. Have a pending asset with enough votes

**Steps**:
1. Cast final vote to push asset to "verified" status
2. Switch to Tab A

**Expected Result**:
- Console log: `✅ Asset verified: ...`
- Console log: `📨 Received real-time event: asset_verified`
- **Asset verification appears in Tab A feed**

**Pass Criteria**: ✅ Verification status visible instantly

---

### Test 10: Karma Milestone

**Setup**:
1. Open project page in **Tab A**
2. Have a wallet close to karma milestone (e.g., 995 karma)

**Steps**:
1. Earn karma to cross threshold (e.g., reach 1,000)
2. Switch to Tab A

**Expected Result**:
- Console log: `🏆 Karma milestone: 1000 ...`
- Console log: `📨 Received real-time event: karma_milestone`
- **Karma milestone celebration appears in Tab A feed**

**Pass Criteria**: ✅ Milestone visible instantly

---

## 🔍 Debugging Tools

### Check WebSocket Connections

**Chrome DevTools**:
1. Open DevTools (F12)
2. Go to Network tab
3. Filter: `WS` (WebSocket)
4. Should see 10 active WebSocket connections

**Expected Channels**:
- `feed_jobs_[projectId]`
- `feed_applications_[projectId]`
- `feed_app_votes_[projectId]`
- `feed_comments_[projectId]`
- `feed_submissions_[projectId]`
- `feed_disputes_[projectId]`
- `feed_assets_[projectId]`
- `feed_asset_votes_[projectId]`
- `feed_tips_[projectId]`
- `feed_karma_[projectId]`

### Check Console Logs

**Normal Operation**:
```
🔔 Setting up feed subscriptions for project: abc-123
📋 New job: { id: '...', title: '...' }
📨 Received real-time event: job_posted
✅ Adding 1 new item(s) to feed
```

**Deduplication**:
```
📨 Received real-time event: job_posted
All items already in feed (duplicate)
```

**Cleanup**:
```
🔕 Cleaning up feed subscriptions
```

### Check Supabase Dashboard

1. Go to Supabase Dashboard
2. Navigate to project
3. Go to "Realtime" section
4. Should see active subscriptions when project page is open

---

## 🐛 Common Issues

### Issue: No real-time updates appearing

**Possible Causes**:
1. WebSocket connections not established
2. Supabase Realtime not enabled
3. Project ID mismatch
4. Browser blocking WebSockets

**Debug Steps**:
1. Check Network tab for WebSocket connections
2. Verify project ID in console logs
3. Check browser console for errors
4. Try different browser

---

### Issue: Duplicate items in feed

**Possible Causes**:
1. Deduplication logic not working
2. Item ID generation inconsistent
3. Multiple subscriptions to same table

**Debug Steps**:
1. Check item IDs in console
2. Verify `existingIds` Set is working
3. Check for multiple `setupFeedSubscriptions` calls

---

### Issue: Feed updates but very slowly

**Possible Causes**:
1. Network latency
2. Debounce delay too long
3. Transform function slow

**Debug Steps**:
1. Check time between DB change and UI update
2. Measure debounce delay (should be 500ms)
3. Profile transform function performance

---

### Issue: Memory increasing over time

**Possible Causes**:
1. Subscriptions not cleaned up
2. Event queue not being cleared
3. Feed items accumulating

**Debug Steps**:
1. Navigate away and check cleanup logs
2. Verify `unsubscribe()` is called
3. Check memory profiler in DevTools

---

## 📊 Performance Benchmarks

### Expected Latency

| Event | Database → UI | Acceptable |
|-------|---------------|------------|
| Job Posted | 50-200ms | ✅ < 500ms |
| Application | 100-300ms | ✅ < 500ms |
| Vote | 50-150ms | ✅ < 300ms |
| Comment | 100-250ms | ✅ < 500ms |
| Asset Verified | 150-400ms | ✅ < 500ms |

### Memory Usage

| State | Memory | Acceptable |
|-------|--------|------------|
| Initial Load | ~25MB | ✅ < 50MB |
| 10 Channels Open | ~27MB | ✅ < 50MB |
| After 100 Events | ~30MB | ✅ < 60MB |
| After Cleanup | ~25MB | ✅ Returns to baseline |

### Network Bandwidth

| Event Type | Data Size | Acceptable |
|------------|-----------|------------|
| Job Posted | ~1-2KB | ✅ < 5KB |
| Vote | ~0.5KB | ✅ < 2KB |
| Asset Verified | ~2-3KB | ✅ < 5KB |

---

## ✅ Final Checklist

Before marking real-time as working, verify:

- [ ] All 10 WebSocket connections established
- [ ] Job posting appears in other tabs instantly
- [ ] Application submission appears instantly
- [ ] Asset activities appear instantly
- [ ] Tip activities appear instantly
- [ ] Vote batching working (500ms debounce)
- [ ] No duplicate items after refresh
- [ ] Cleanup logs appear when navigating away
- [ ] Memory returns to baseline after cleanup
- [ ] Latency < 500ms for most activities

---

## 🎉 Success Criteria

**Real-time subscriptions working if**:

✅ New activities appear in feed within 1 second  
✅ Multiple tabs receive updates simultaneously  
✅ No duplicate items in feed  
✅ Proper cleanup on unmount  
✅ Console logs confirm event flow  
✅ WebSocket connections visible in Network tab  

**The Activity Feed is truly LIVE!** 🚀

---

**Questions?** Check the main documentation:
- `/FEED_REALTIME_SUBSCRIPTIONS_COMPLETE.md`
- `/lib/feed-subscriptions.ts` (inline comments)
- `/components/ActivityFeed.tsx` (subscription setup)


