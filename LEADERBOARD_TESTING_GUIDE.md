# 🧪 LeaderboardWidget - Testing Guide

Quick guide to test the homepage integration of the LeaderboardWidget.

---

## 🚀 Quick Start

### 1. Start Development Server

```bash
npm run dev
# or
yarn dev
```

### 2. Navigate to Homepage

Open browser to: `http://localhost:3000`

---

## 📋 Desktop Testing (> 1024px)

### Visual Check
1. ✅ **Layout**
   - Projects on left (70% width)
   - Leaderboard on right (30% width, ~400px)
   - 24px gap between columns
   
2. ✅ **Leaderboard Widget**
   - White background (#FFFFFF)
   - Rounded corners (24px border radius)
   - Drop shadow visible
   - "🏆 Top Contributors" heading

3. ✅ **Sticky Behavior**
   - Scroll down the page slowly
   - Widget should "stick" at top of viewport (100px from top)
   - Widget stays visible while scrolling projects
   - Widget should NOT cover navbar

4. ✅ **Content**
   - Top 10 users displayed
   - Medals for top 3: 🥇 🥈 🥉
   - Numeric ranks for 4-10
   - Avatars (40x40px) or gradient fallbacks
   - Usernames or truncated wallet addresses
   - Karma values formatted with commas

5. ✅ **Interactions**
   - Hover over rows → background changes to subtle gray
   - Click "View Full Leaderboard →" → should navigate

6. ✅ **Scrollbar** (if > 10 users or long content)
   - Internal scrolling within widget
   - Custom styled scrollbar (8px width, subtle color)
   - Smooth scroll behavior

---

## 📱 Tablet Testing (768px - 1024px)

### Resize Browser
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M / Cmd+Shift+M)
3. Select iPad or set width to 900px

### Visual Check
1. ✅ **Layout**
   - Sidebar narrower (~320px)
   - Projects still visible on left
   - Single column project grid

2. ✅ **Sticky Still Works**
   - Scroll down
   - Leaderboard should still stick

---

## 📱 Mobile Testing (< 768px)

### Resize Browser
1. Set width to 375px (iPhone) or 640px (generic mobile)

### Visual Check
1. ✅ **Layout**
   - Single column layout
   - Projects appear first
   - Leaderboard appears below projects (full width)

2. ✅ **NOT Sticky**
   - Scroll down through projects
   - Leaderboard should scroll normally (not stick)
   - Leaderboard visible after scrolling past all projects

3. ✅ **Sizing**
   - Avatars smaller (36x36px on mobile)
   - Text readable
   - Proper spacing

---

## 🧪 State Testing

### Loading State
1. Throttle network in DevTools (Slow 3G)
2. Refresh page
3. ✅ Should see skeleton loading animation
4. ✅ 10 gray placeholder rows pulsing

### Error State
1. Temporarily break API (change endpoint to `/api/leaderboard-broken`)
2. Refresh page
3. ✅ Should see error message
4. ✅ "Unable to load leaderboard"

### Empty State
1. Clear database test data (or filter by project with no users)
2. Refresh page
3. ✅ Should see empty state:
   - Trophy icon 🏆
   - "No karma earned yet"
   - "Complete jobs to get on the leaderboard!"
   - "Browse Jobs" button

### Populated State (Normal)
1. Ensure API returns data
2. Refresh page
3. ✅ Should see:
   - 10 user rows
   - Proper formatting
   - Interactive elements

---

## 🎯 Interaction Testing

### Row Hover
1. Hover mouse over each leaderboard row
2. ✅ Background should change to subtle gray
3. ✅ Smooth transition (0.2s)

### Link Click
1. Click "View Full Leaderboard →" link
2. ✅ Should navigate to `/leaderboard` (404 is fine for now)
3. ✅ Text should underline on hover

### Scrolling (Desktop)
1. Scroll page down slowly
2. ✅ Widget should stick at top
3. ✅ Smooth, no jank or jumping
4. ✅ Widget maintains position relative to viewport

---

## ⚡ Performance Testing

### Load Time
1. Open DevTools → Network tab
2. Refresh page
3. ✅ Skeleton appears < 50ms
4. ✅ Data loads < 200ms (with cache)
5. ✅ Widget interactive < 500ms

### Scroll Performance
1. Open DevTools → Performance tab
2. Record while scrolling
3. ✅ 60fps maintained
4. ✅ No red bars (layout thrashing)
5. ✅ Smooth sticky positioning

---

## 🐛 Common Issues & Fixes

### Issue: Widget Not Sticky

**Symptom:** Widget scrolls with page instead of sticking

**Check:**
1. Browser zoom is 100% (not 80% or 125%)
2. Browser supports `position: sticky` (all modern browsers do)
3. Parent `.karma-sidebar` has `align-self: start`

**Fix:** Clear browser cache and hard refresh (Ctrl+Shift+R)

---

### Issue: Widget Too Tall / Cut Off

**Symptom:** Bottom of widget hidden

**Check:**
1. Viewport height > 600px
2. `max-height: calc(100vh - 124px)` is applied
3. `overflow-y: auto` is set

**Fix:** Scroll within widget or increase viewport height

---

### Issue: Leaderboard Shows Placeholder

**Symptom:** Widget replaced but still shows "Top 10 karma leaders will appear here..."

**Check:**
1. API endpoint `/api/leaderboard` is running
2. Database has test data
3. No CORS or network errors in console

**Fix:**
1. Check API logs: `http://localhost:3000/api/leaderboard?limit=10`
2. Verify database migration ran: `004_create_karma_leaderboard_infrastructure.sql`
3. Check Supabase connection

---

### Issue: Widget Not Responsive on Mobile

**Symptom:** Widget stays 400px width on mobile, cuts off

**Check:**
1. Media query is applied: `@media (max-width: 768px)`
2. DevTools shows correct viewport width
3. CSS not overridden by other styles

**Fix:** Clear browser cache, check CSS specificity

---

## 📊 API Testing

### Test Endpoint Directly

```bash
# Fetch top 10
curl http://localhost:3000/api/leaderboard?limit=10

# Expected Response:
[
  {
    "id": "uuid",
    "wallet_address": "3kXpY8...R9mLq",
    "username": "alice.sol",
    "avatar_url": null,
    "total_karma": 2450,
    "completed_jobs": 15,
    ...
  },
  ...
]
```

### Test with Browser

1. Open: `http://localhost:3000/api/leaderboard?limit=10`
2. ✅ Should see JSON array
3. ✅ 10 entries max
4. ✅ Ordered by `total_karma` DESC

---

## ✅ Final Checklist

Before deploying, verify ALL items:

### Functionality
- [ ] Widget appears on homepage
- [ ] Sticky works on desktop
- [ ] Static on mobile
- [ ] Loading state shows
- [ ] Error state works
- [ ] Empty state displays
- [ ] All 10 users visible
- [ ] Medals show for top 3
- [ ] Hover interactions work
- [ ] Link is clickable

### Visual
- [ ] Proper spacing (24px grid gap)
- [ ] Correct colors (white widget, lime page)
- [ ] Rounded corners (24px)
- [ ] Drop shadow visible
- [ ] Typography correct (Space Grotesk headings, Satoshi body)
- [ ] Avatars sized correctly (40px desktop, 36px mobile)

### Performance
- [ ] Page loads < 500ms
- [ ] Skeleton appears instantly
- [ ] Smooth 60fps scrolling
- [ ] No console errors
- [ ] No linter errors

### Responsive
- [ ] Desktop: 2-column grid, sticky sidebar
- [ ] Tablet: Narrower sidebar, still sticky
- [ ] Mobile: Stacked layout, no sticky

---

## 🎉 Success Criteria

Your integration is successful when:

1. ✅ **Desktop**: Leaderboard visible in right sidebar, stays in view while scrolling
2. ✅ **Mobile**: Leaderboard appears below projects, scrolls normally
3. ✅ **Performance**: Page loads fast, smooth scrolling, no errors
4. ✅ **States**: Loading, error, empty, and populated states all work
5. ✅ **Design**: Matches ALIGN design system (colors, fonts, spacing)

---

## 📞 Need Help?

If issues persist:

1. Check console for errors (F12 → Console)
2. Review API logs: `http://localhost:3000/api/leaderboard`
3. Verify database migration: Check Supabase `karma_leaderboard` view exists
4. Compare code with documentation:
   - `LEADERBOARD_HOMEPAGE_INTEGRATION_COMPLETE.md`
   - `LEADERBOARD_WIDGET_COMPLETE.md`

---

**Happy Testing! 🚀**


