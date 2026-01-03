# Manual Testing Checklist for Notification System

Comprehensive manual testing scenarios for the ALIGN notification system. Use this checklist to verify functionality that's difficult to automate.

## Setup

- [ ] Two browser windows (Chrome regular + Chrome incognito) OR
- [ ] Two different browsers (Chrome + Firefox) OR
- [ ] Two devices (Desktop + Mobile)

**User Setup:**
- User A: Primary test account
- User B: Secondary test account

## 1. Basic Notification Flow

### 1.1 Notification Bell
- [ ] Bell icon visible in header when logged in
- [ ] Bell icon NOT visible when logged out
- [ ] Unread badge shows correct count
- [ ] Badge has purple background (#7C4DFF)
- [ ] Badge updates when new notification arrives
- [ ] Badge shows "99+" for 100+ notifications

### 1.2 Notification Dropdown
- [ ] Click bell → dropdown opens
- [ ] Dropdown shows last 4 notifications
- [ ] Dropdown has "Notifications" title
- [ ] "Mark all read" button visible when unread exist
- [ ] "View all" button in footer
- [ ] Dropdown closes when clicking outside
- [ ] Dropdown closes when pressing Escape key

### 1.3 Notification Display
- [ ] Each notification shows icon (based on type)
- [ ] Each notification shows actor avatar
- [ ] Each notification shows title text
- [ ] Each notification shows body text
- [ ] Each notification shows time ago ("5m ago")
- [ ] Unread notifications have purple background
- [ ] Read notifications have white background
- [ ] Unread dot visible for unread notifications

## 2. Real-Time Notifications

### 2.1 New Notification Arrival
**User A** (Receiver):
- [ ] Have dropdown CLOSED
- [ ] See badge count increment instantly
- [ ] Hear notification sound (if enabled)
- [ ] See browser notification (if permitted)

**User A** (Receiver with dropdown OPEN):
- [ ] Have dropdown OPEN
- [ ] New notification appears at top of list
- [ ] Badge count increments
- [ ] No page refresh needed

### 2.2 Real-Time Scenarios to Test
**Tip Notification:**
- [ ] User B tips User A
- [ ] User A sees "Bob tipped you" instantly

**Job Application:**
- [ ] User B applies to User A's job
- [ ] User A sees "Bob applied to your job" instantly

**Asset Upvote:**
- [ ] User B upvotes User A's asset
- [ ] User A sees "Bob upvoted your asset" instantly

**Message Received:**
- [ ] User B sends message to User A
- [ ] User A sees "New message from Bob" instantly

## 3. Auto-Mark as Read

### 3.1 Dropdown Auto-Read (10 seconds)
- [ ] Open dropdown with unread notifications
- [ ] Don't click anything
- [ ] Wait 10 seconds
- [ ] Notifications turn from purple → white background
- [ ] Unread dots disappear
- [ ] Badge count decreases

### 3.2 Click to Mark Read
- [ ] Open dropdown
- [ ] Click any notification
- [ ] Notification immediately marked as read
- [ ] Badge count decreases by 1
- [ ] Dropdown closes

### 3.3 Mark All as Read
- [ ] Have 3+ unread notifications
- [ ] Click "Mark all as read"
- [ ] All notifications turn white
- [ ] Badge count goes to 0
- [ ] Button disappears

## 4. Notification Panel (Full Screen)

### 4.1 Opening Panel
- [ ] Click "View all" in dropdown footer
- [ ] Panel slides in from right
- [ ] Panel is 400px wide on desktop
- [ ] Panel is full screen on mobile
- [ ] Panel shows "Notifications" title
- [ ] Close button (X) visible

### 4.2 Filter Tabs
- [ ] "All" tab shows all notifications
- [ ] "Unread" tab shows only unread
- [ ] "Unread" tab shows count "(3)"
- [ ] Admin tab visible ONLY if user is admin
- [ ] Admin tab shows admin notification count
- [ ] Switching tabs updates list instantly

### 4.3 Infinite Scroll
- [ ] Scroll to bottom of panel
- [ ] Loading spinner appears
- [ ] More notifications load automatically
- [ ] "No more notifications" appears at end
- [ ] Smooth scrolling (no jumps)

### 4.4 Empty States
**All Notifications Tab:**
- [ ] Shows "🔔" bell emoji
- [ ] Shows "No notifications yet"

**Unread Tab:**
- [ ] Shows "No unread notifications"

**Admin Tab (if admin):**
- [ ] Shows "🛡️" shield emoji
- [ ] Shows "No admin notifications"

## 5. Notification Types & Icons

Test each notification type shows correct icon and color:

### Job Notifications
- [ ] `job_application_received`: Briefcase (Blue)
- [ ] `job_assigned`: CheckCircle (Blue)
- [ ] `job_submitted`: Upload (Gray)
- [ ] `job_completed`: DollarSign (Green)
- [ ] `job_dispute_created`: AlertTriangle (Red)
- [ ] `job_dispute_vote`: ThumbsUp (Gray)
- [ ] `job_comment`: MessageSquare (Gray)

### Asset Notifications
- [ ] `asset_upvote`: ThumbsUp (Gray)
- [ ] `asset_verified`: BadgeCheck (Green)
- [ ] `asset_hidden`: EyeOff (Red)

### Payment Notifications
- [ ] `tip_received`: DollarSign (Blue)
- [ ] `payment_released`: ArrowDown (Green)
- [ ] `payment_refunded`: ArrowUp (Gray)

### Social Notifications
- [ ] `message_received`: Mail (Gray)

### Karma Notifications
- [ ] `karma_milestone`: Award (Green)
- [ ] `karma_warning`: AlertCircle (Yellow)
- [ ] `karma_ban`: ShieldX (Red)

### Admin Notifications
- [ ] `admin_dispute_new`: Shield (Purple)
- [ ] `admin_job_new`: Shield (Purple)
- [ ] `admin_asset_new`: Shield (Purple)
- [ ] `admin_revenue_earned`: Shield (Purple)

## 6. Notification Batching

### 6.1 Asset Upvotes (Batchable)
**Setup:** User A posts an asset
- [ ] User B upvotes → shows "Bob upvoted your asset"
- [ ] User C upvotes within 5 min → shows "2 people upvoted your asset"
- [ ] User D upvotes within 5 min → shows "3 people upvoted your asset"
- [ ] Batch shows count badge/chip
- [ ] Clicking chevron expands batch details
- [ ] Details show asset name and count

### 6.2 Job Comments (Batchable)
**Setup:** User A posts a job
- [ ] User B comments → shows "Bob commented on your job"
- [ ] User C comments within 5 min → shows "2 people commented"
- [ ] Batch shows count
- [ ] Expandable shows details

### 6.3 Dispute Votes (Batchable)
**Setup:** Dispute exists
- [ ] Multiple votes within 5 min → batched
- [ ] Shows "3 people voted on dispute"

### 6.4 Non-Batchable Types
Test these do NOT batch:
- [ ] `job_assigned` (separate for each job)
- [ ] `job_completed` (separate for each job)
- [ ] `message_received` (separate for each message)
- [ ] `karma_milestone` (individual achievements)

### 6.5 Batch Window (5 minutes)
- [ ] First upvote at 12:00pm
- [ ] Second upvote at 12:04pm → batched ✅
- [ ] Third upvote at 12:06pm → NEW batch (>5 min) ✅

## 7. Navigation

### 7.1 Job Notifications
**`job_application_received`:**
- [ ] Click → navigates to `/jobs/[id]?tab=applications`
- [ ] Applications tab is active
- [ ] Can see applicant list

**`job_assigned`:**
- [ ] Click → navigates to `/jobs/[id]`
- [ ] Job details visible

**`job_submitted`:**
- [ ] Click → navigates to `/jobs/[id]?tab=submissions`
- [ ] Submissions tab active

**`job_dispute_created`:**
- [ ] Click → navigates to `/jobs/[id]?tab=disputes`
- [ ] Disputes tab active

### 7.2 Asset Notifications
- [ ] Click asset notification → opens asset modal OR
- [ ] Navigates to `/assets?asset=[id]`

### 7.3 Message Notifications
- [ ] Click message notification → opens messages sidebar
- [ ] Correct conversation is selected
- [ ] Can reply immediately

### 7.4 Karma Notifications
- [ ] Click karma notification → navigates to `/profile`
- [ ] User's own profile displayed

### 7.5 Admin Notifications (Admin Only)
**`admin_dispute_new`:**
- [ ] Click → navigates to job with disputes tab

**`admin_asset_new`:**
- [ ] Click → navigates to `/admin/assets?pending=[id]`

**`admin_revenue_earned`:**
- [ ] Click → navigates to `/admin/revenue`

## 8. Admin Features

### 8.1 Admin Badge & Styling
**Admin notifications should have:**
- [ ] Purple left border (4px solid)
- [ ] Shield icon in top-right corner
- [ ] Purple accent color

**Admin tab in panel:**
- [ ] Only visible if user is admin
- [ ] Shows count: "Admin (3)"
- [ ] Filters to admin notifications only
- [ ] Empty state shows shield emoji

### 8.2 Admin User Testing
**As non-admin:**
- [ ] Admin tab NOT visible
- [ ] Can still see admin notifications in "All" tab
- [ ] Admin notifications have purple border

**As admin:**
- [ ] Admin tab visible
- [ ] Tab shows correct count
- [ ] Can filter to admin only
- [ ] All admin notifications have styling

## 9. Mobile Responsiveness

### 9.1 Mobile Dropdown (< 640px)
- [ ] Dropdown is full width
- [ ] Shows 2 notifications (not 4)
- [ ] Larger touch targets (min 44px)
- [ ] Text readable (not truncated)
- [ ] Icons appropriately sized

### 9.2 Mobile Panel
- [ ] Panel is full screen
- [ ] Tabs are tappable (larger)
- [ ] Scroll works smoothly
- [ ] Close button accessible
- [ ] Swipe down to close (if implemented)

### 9.3 Mobile Navigation
- [ ] All notification clicks work
- [ ] Navigation doesn't break layout
- [ ] Back button works

### 9.4 Test on Devices
- [ ] iPhone SE (375px)
- [ ] iPhone 12/13 (390px)
- [ ] iPad (768px)
- [ ] Android phone

## 10. Loading & Error States

### 10.1 Loading States
**Dropdown:**
- [ ] Shows 4 skeleton loaders while fetching
- [ ] Skeleton matches notification layout
- [ ] Smooth fade-in when loaded

**Panel:**
- [ ] Shows 8 skeleton loaders
- [ ] Spinner for "load more"
- [ ] "Refreshing..." indicator

### 10.2 Error States
**Network error:**
- [ ] Disconnect internet
- [ ] Open dropdown
- [ ] See error message (red banner)
- [ ] See "Try Again" button
- [ ] Clicking retries successfully

**Supabase offline:**
- [ ] Stop Supabase
- [ ] See error message
- [ ] Data doesn't disappear (graceful degradation)

### 10.3 Refreshing
- [ ] Pull to refresh (mobile, if implemented)
- [ ] Shows "Refreshing..." indicator
- [ ] Doesn't flicker or lose scroll position
- [ ] Error message if refresh fails

## 11. Edge Cases

### 11.1 Long Content
- [ ] Very long notification title → truncated with ellipsis
- [ ] Very long asset/job name → truncated
- [ ] Hover shows full text (tooltip, if implemented)

### 11.2 Many Notifications
- [ ] 99+ badge shows "99+"
- [ ] Panel handles 500+ notifications
- [ ] Infinite scroll works smoothly
- [ ] No performance issues

### 11.3 Time Display
- [ ] Just now → "Just now"
- [ ] 5 minutes ago → "5m ago"
- [ ] 1 hour ago → "1h ago"
- [ ] Yesterday → "1d ago"
- [ ] 1 week ago → date format (Dec 15)

### 11.4 Multiple Tabs/Windows
**User A in two tabs:**
- [ ] Mark as read in tab 1 → updates in tab 2
- [ ] New notification appears in both tabs
- [ ] No duplicate notifications

### 11.5 Deleted/Missing References
- [ ] Job notification for deleted job → still shows
- [ ] Click doesn't break (404 page or graceful error)
- [ ] Asset notification for hidden asset → works

## 12. Browser Notifications (Optional)

### 12.1 Permission Request
- [ ] First notification triggers permission dialog
- [ ] "Allow" → enables browser notifications
- [ ] "Block" → no browser notifications

### 12.2 Browser Notification Display
**When enabled:**
- [ ] Shows notification icon
- [ ] Shows title and body
- [ ] Clicking opens app
- [ ] Clicking navigates to relevant page
- [ ] Multiple notifications don't spam

### 12.3 Sound
- [ ] Notification sound plays (if enabled)
- [ ] Sound is not annoying
- [ ] Can be muted in settings

## 13. Performance

### 13.1 Load Time
- [ ] Dropdown opens < 500ms
- [ ] Panel opens < 1s
- [ ] Notifications fetch < 2s
- [ ] Real-time updates < 3s

### 13.2 Network Throttling
**Slow 3G:**
- [ ] Shows loading states
- [ ] Doesn't timeout
- [ ] Error messages if fails

### 13.3 Large Datasets
- [ ] 100+ notifications load smoothly
- [ ] Infinite scroll doesn't lag
- [ ] Marking all read < 3s

## 14. Accessibility

### 14.1 Keyboard Navigation
- [ ] Tab to notification bell
- [ ] Enter opens dropdown
- [ ] Arrow keys navigate notifications
- [ ] Enter clicks notification
- [ ] Escape closes dropdown

### 14.2 Screen Reader
- [ ] Bell has aria-label
- [ ] Badge announces count
- [ ] Notifications are readable
- [ ] "Mark as read" announced

### 14.3 Color Contrast
- [ ] Text readable on all backgrounds
- [ ] Icons visible
- [ ] Purple badge passes WCAG AA

## Testing Matrix

| Scenario | Chrome | Firefox | Safari | Mobile Chrome | Mobile Safari |
|----------|--------|---------|--------|---------------|---------------|
| Basic flow | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Real-time | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Batching | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Navigation | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Mobile UI | N/A | N/A | N/A | ⬜ | ⬜ |

## Bug Report Template

When finding a bug, document:
```markdown
**Bug:** Brief description
**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected:** What should happen
**Actual:** What actually happened
**Browser:** Chrome 120 / Firefox 121 / etc.
**Device:** Desktop / iPhone 13 / etc.
**Screenshots:** [attach if relevant]
**Console Errors:** [paste any errors]
```

## Sign-Off

Once all items are checked:
- [ ] All critical paths tested ✅
- [ ] No blocking bugs found ✅
- [ ] Performance acceptable ✅
- [ ] Mobile experience good ✅
- [ ] Accessibility passes ✅

**Tested by:** ________________  
**Date:** ________________  
**Build/Version:** ________________  

---

**Notes:**
- Not all items need to pass 100% - document what doesn't work
- Focus on critical user journeys first
- Test with real user data when possible
- Report UX issues even if not "bugs"












