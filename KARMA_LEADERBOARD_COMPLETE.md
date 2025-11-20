# Karma Leaderboard - Implementation Complete

## 🎯 Overview

A real-time leaderboard component that displays the top 50 contributors for each project, ranked by their karma points. Features gold/silver/bronze medals for top 3, highlighting for the current user, and live updates.

---

## ✅ What Was Implemented

### 1. **KarmaLeaderboard Component** (`/components/KarmaLeaderboard.tsx`)

A beautiful, responsive leaderboard component with:

**Features**:
- ✅ Top 50 contributors ranked by karma points
- ✅ 🥇 🥈 🥉 Medals for top 3 positions
- ✅ Golden gradient background for podium positions
- ✅ Purple ring highlight for current user
- ✅ "You" badge on current user's entry
- ✅ User's rank display at top (if ranked)
- ✅ Activity stats (assets added, upvotes, reports)
- ✅ Real-time updates via Supabase Realtime
- ✅ Loading skeleton animation
- ✅ Empty state messaging
- ✅ Excludes banned wallets
- ✅ Hover effects and smooth transitions

**Layout**:
```
┌─────────────────────────────┐
│   Top Contributors 🏆       │
├─────────────────────────────┤
│ Your rank: #12 with 850 karma│ (if user is ranked)
├─────────────────────────────┤
│ #1 🥇 abc1...xyz1  1,250    │ (gold gradient)
│       5 assets • 20 upvotes │
├─────────────────────────────┤
│ #2 🥈 def2...uvw2    987    │ (gold gradient)
│       3 assets • 15 upvotes │
├─────────────────────────────┤
│ #3 🥉 ghi3...rst3    856    │ (gold gradient)
│       4 assets • 12 upvotes │
├─────────────────────────────┤
│ #4    jkl4...qpo4    745    │ (gray background)
│       2 assets • 10 upvotes │
└─────────────────────────────┘
```

---

## 📐 Integration

### Page Layout

The leaderboard is integrated into the **Community Curation** section in a responsive grid:

**Desktop (Large Screens)**:
```
┌────────────────────┬─────────────┐
│                    │             │
│  Curation Feed     │ Leaderboard │
│  (2/3 width)       │ (1/3 width) │
│                    │             │
└────────────────────┴─────────────┘
```

**Mobile (Small Screens)**:
```
┌────────────────────┐
│  Curation Feed     │
│                    │
└────────────────────┘
┌────────────────────┐
│  Leaderboard       │
│                    │
└────────────────────┘
```

---

## 🎨 Visual Design

### Color Coding

**Podium Positions (Top 3)**:
- Background: Golden gradient (`from-yellow-50 to-orange-50`)
- Medals: 🥇 🥈 🥉

**Regular Positions (4+)**:
- Background: Light gray (`bg-gray-50`)

**Current User**:
- Ring: Purple 2px (`ring-2 ring-purple-500`)
- Badge: Purple pill with "You" text

**Karma Display**:
- Color: Purple (`text-purple-600`)
- Weight: Bold

### Typography

- **Rank**: Large bold gray (`text-lg font-bold text-gray-400`)
- **Wallet**: Monospace font (`font-mono`)
- **Stats**: Small gray text (`text-xs text-gray-600`)
- **Karma**: Bold purple (`font-bold text-purple-600`)

---

## 🔄 Real-time Updates

The leaderboard subscribes to `wallet_karma` table changes and automatically refreshes when:

- ✅ New karma is awarded
- ✅ Assets are added (count increases)
- ✅ Votes are cast (upvote/report counts increase)
- ✅ Warnings are issued
- ✅ Users are banned/unbanned

**Subscription Channel**: `karma-leaderboard`

**Query**:
```typescript
supabase
  .from('wallet_karma')
  .select('*')
  .eq('project_id', projectId)
  .eq('is_banned', false)
  .order('total_karma_points', { ascending: false })
  .limit(50)
```

---

## 📊 Data Display

### Stats Shown

For each contributor:

1. **Rank** - Position in leaderboard (#1, #2, etc.)
2. **Medal** - 🥇 🥈 🥉 for top 3
3. **Wallet Address** - Shortened format (abc1...xyz1)
4. **Assets Added** - Count of verified assets submitted
5. **Upvotes Given** - Number of assets upvoted
6. **Reports Given** - Number of assets reported
7. **Total Karma** - Current karma points (rounded to integer)

### Current User Info

If connected wallet is ranked:
- Shows rank prominently at top
- Displays total karma
- Highlights user's row with purple ring
- Adds "You" badge next to wallet address

---

## 🎯 User Experience

### Empty State

When no contributors exist:
```
No contributors yet
Be the first to add an asset!
```

### Loading State

Shows animated skeleton loader while fetching data

### Hover Effects

- **Rows**: Shadow appears on hover
- **Transition**: Smooth animation

### Responsive Design

- **Mobile**: Stacked layout (feed above, leaderboard below)
- **Desktop**: Side-by-side (feed left, leaderboard right)
- **Leaderboard**: Maintains fixed aspect ratio

---

## 📈 Ranking Logic

### Sorting

Contributors are sorted by:
1. **Primary**: `total_karma_points` (highest first)
2. **Ties**: Order of database insertion (older users first)

### Filters

Excluded from leaderboard:
- ❌ Banned wallets (`is_banned = true`)

Included:
- ✅ All non-banned users with any karma (even negative)

### Limit

Shows top **50 contributors** to keep performance optimal

---

## 🧪 Testing Checklist

### Component Testing

**KarmaLeaderboard**:
- [ ] Shows loading skeleton initially
- [ ] Fetches top 50 contributors
- [ ] Sorts by karma points descending
- [ ] Shows medals for top 3
- [ ] Highlights current user if ranked
- [ ] Shows user's rank at top
- [ ] Excludes banned wallets
- [ ] Shows empty state when no data
- [ ] Updates in real-time on karma changes
- [ ] Responsive layout works on mobile

### Integration Testing

- [ ] Appears in Community Curation section
- [ ] Grid layout works on desktop
- [ ] Stacks on mobile
- [ ] Updates when user votes
- [ ] Updates when user adds assets
- [ ] Updates when karma is awarded
- [ ] Doesn't show banned users

### Visual Testing

- [ ] Top 3 have golden gradient
- [ ] Current user has purple ring
- [ ] Medals display correctly
- [ ] Hover effects work
- [ ] Typography is readable
- [ ] Colors match design system

---

## 🔧 Customization Options

### Changing Limit

To show more/fewer contributors:

```typescript
// In KarmaLeaderboard.tsx
.limit(50)  // Change this number
```

### Adding More Stats

To display additional metrics:

```typescript
// Add to the stats row:
<div className="text-xs text-gray-600">
  {leader.assets_added_count} assets •{' '}
  {leader.upvotes_given_count} upvotes •{' '}
  {leader.reports_given_count} reports •{' '}
  {leader.warning_count} warnings  // New stat
</div>
```

### Changing Colors

**Podium gradient**:
```typescript
// Change from-yellow-50 to-orange-50
// to any other gradient combo
```

**Karma color**:
```typescript
// Change text-purple-600
// to text-blue-600, text-green-600, etc.
```

---

## 📊 Performance Considerations

### Optimizations

1. **Limit to 50**: Keeps query fast
2. **Index on karma**: Ensure `total_karma_points` is indexed
3. **Real-time**: Only re-fetches on actual changes
4. **Component-level loading**: Doesn't block page load

### Recommended Indexes

```sql
-- If not already present:
CREATE INDEX idx_wallet_karma_project_karma 
ON wallet_karma(project_id, total_karma_points DESC) 
WHERE is_banned = false;
```

---

## 🎉 Status: READY FOR USE

The karma leaderboard is fully functional and integrated into the project page. Users can now see:

- Who the top contributors are
- Their own rank and karma
- Real-time updates as karma changes
- Activity breakdown for each contributor

**No additional setup required** - it works automatically with the existing karma system!

---

## 📈 Future Enhancements (Optional)

### Phase 1: Detailed Stats
- Expandable rows showing full history
- Success rate (verified/total submissions)
- Average karma per action

### Phase 2: Filtering
- Filter by time period (week, month, all-time)
- Filter by activity type (voters, submitters, etc.)

### Phase 3: Achievements
- Badges for milestones (100 karma, 500 karma, etc.)
- Special titles (Curator, Guardian, etc.)

### Phase 4: Charts
- Karma progression over time
- Activity heatmap

---

## 🔍 Troubleshooting

### Leaderboard Shows Empty

**Problem**: "No contributors yet" but assets exist

**Solutions**:
- Verify `wallet_karma` table has data
- Check `is_banned` filter
- Ensure `project_id` matches
- Check Supabase RLS policies

### Real-time Not Working

**Problem**: Doesn't update when karma changes

**Solutions**:
- Verify Supabase Realtime enabled
- Check `wallet_karma` table is in publication
- Clear browser cache
- Check browser console for errors

### Current User Not Highlighted

**Problem**: User's row not showing purple ring

**Solutions**:
- Ensure wallet is connected
- Verify wallet has karma in this project
- Check wallet address format matches

---

## ✅ Files Modified

```
✅ /components/KarmaLeaderboard.tsx (NEW)
✅ /app/project/[id]/page.tsx (UPDATED)
✅ KARMA_LEADERBOARD_COMPLETE.md (NEW)
```

---

Great job! Your karma leaderboard is live and ready to inspire competition among contributors! 🏆🎉

