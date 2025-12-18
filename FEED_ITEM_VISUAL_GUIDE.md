# FeedItem Component - Visual Guide

## Component Overview

The `FeedItem` component displays individual activities in the feed with color-coded icons, formatted text, and relative timestamps.

---

## Visual Structure

```
┌─────────────────────────────────────────────────────────────┐
│  ╭─────╮  **User** posted job: Designer Needed              │
│  │  🔧  │  5m ago                                            │
│  ╰─────╯                                                     │
└─────────────────────────────────────────────────────────────┘
   Icon      Content with formatted text
   (40px)    and relative timestamp
```

---

## Color-Coded Categories

### 🟣 Job Activities (Purple)
- **Icon Background**: `#F3E5F5` (light purple)
- **Icon Color**: `#7C4DFF` (purple)
- **Border on Hover**: `#7C4DFF`

**Activity Types:**
- `job_posted` - 🔧 Work icon
- `job_applied` - 👤 PersonAdd icon
- `job_application_upvoted` - 👍 ThumbUp icon
- `job_assigned` - 📋 AssignmentInd icon
- `job_submitted` - ✅ CheckCircle icon
- `job_completed` - 🎉 Celebration icon
- `job_disputed` - ⚖️ Gavel icon
- `job_comment` - 💬 Comment icon

### 🔵 Asset Activities (Blue)
- **Icon Background**: `#E3F2FD` (light blue)
- **Icon Color**: `#2196F3` (blue)
- **Border on Hover**: `#2196F3`

**Activity Types:**
- `asset_submitted` - ➕ AddBox icon
- `asset_upvoted` - 👍 ThumbUp icon
- `asset_backed` - ⭐ Star icon
- `asset_verified` - ✓ Verified icon
- `asset_hidden` - 👁️ VisibilityOff icon

### 🟢 Tip Activities (Lime)
- **Icon Background**: `#F9FBE7` (light lime)
- **Icon Color**: `#CDDC39` (lime)
- **Border on Hover**: `#CDDC39`

**Activity Types:**
- `tip_sent` - 💵 AttachMoney icon

### 🟠 Karma Activities (Orange)
- **Icon Background**: `#FFF3E0` (light orange)
- **Icon Color**: `#FF9800` (orange)
- **Border on Hover**: `#FF9800`

**Activity Types:**
- `karma_milestone` - 🏆 EmojiEvents icon

---

## Example Feed Items

### Job Posted
```
┌─────────────────────────────────────────────────────────────┐
│  ╭─────╮  Ab8x...K9pL posted job: Senior Designer          │
│  │ 🔧  │  2h ago                                            │
│  ╰─────╯                                                     │
└─────────────────────────────────────────────────────────────┘
```

### Application Upvoted (Batched)
```
┌─────────────────────────────────────────────────────────────┐
│  ╭─────╮  5 holders upvoted Qw3r...T8yU's application  [+4]│
│  │ 👍  │  15m ago                                           │
│  ╰─────╯                                                     │
└─────────────────────────────────────────────────────────────┘
```

### Job Completed
```
┌─────────────────────────────────────────────────────────────┐
│  ╭─────╮  Logo Design completed by Zx9c...V5bN 🎉         │
│  │ 🎉  │  3h ago                                            │
│  ╰─────╯                                                     │
└─────────────────────────────────────────────────────────────┘
```

### Asset Verified
```
┌─────────────────────────────────────────────────────────────┐
│  ╭─────╮  twitter asset verified ✓                         │
│  │ ✓  │  1d ago                                            │
│  ╰─────╯                                                     │
└─────────────────────────────────────────────────────────────┘
```

### Tip Sent
```
┌─────────────────────────────────────────────────────────────┐
│  ╭─────╮  Ab8x...K9pL tipped Qw3r...T8yU 100 USDC         │
│  │ 💵  │  30m ago                                           │
│  ╰─────╯                                                     │
└─────────────────────────────────────────────────────────────┘
```

### Karma Milestone
```
┌─────────────────────────────────────────────────────────────┐
│  ╭─────╮  Zx9c...V5bN reached 10k karma 🏆               │
│  │ 🏆  │  5h ago                                            │
│  ╰─────╯                                                     │
└─────────────────────────────────────────────────────────────┘
```

### Karma Milestone (Batched)
```
┌─────────────────────────────────────────────────────────────┐
│  ╭─────╮  8 holders reached 5k karma 🏆                [+7]│
│  │ 🏆  │  6h ago                                            │
│  ╰─────╯                                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Interactive States

### Default State
- Border: `1px solid divider`
- Background: `background.paper` (white)
- Cursor: `default` (or `pointer` if batched)

### Hover State
- Border color changes to category color (purple/blue/lime/orange)
- Background: `action.hover` (subtle gray)
- Box shadow: `0 2px 8px rgba(0,0,0,0.08)`
- Icon scales up slightly: `transform: scale(1.1)`

### Batched Item State
- Shows badge with `+N` count
- Cursor: `pointer`
- Click to expand and show all items

---

## Animations

### Fade In (On Mount)
```css
@keyframes fadeIn {
  from: { 
    opacity: 0;
    transform: translateY(-10px);
  }
  to: { 
    opacity: 1;
    transform: translateY(0);
  }
}
```
Duration: `0.3s ease-in`

### Icon Hover
```css
transform: scale(1.1)
transition: transform 0.2s
```

---

## Text Formatting

### Strong Elements
Activity actors and important values are wrapped in `<strong>` tags:
- Wallet addresses: `<strong>Ab8x...K9pL</strong>`
- Action receivers: `<strong>Qw3r...T8yU</strong>`
- Counts: `<strong>5 holders</strong>`
- Thresholds: `<strong>backing threshold</strong>`

### Emojis
Some activities include emojis for visual emphasis:
- Job completed: 🎉
- Karma milestone: 🏆
- Asset verified: ✓

---

## Relative Time Format

### Short Intervals (< 1 minute)
`5s ago`, `30s ago`, `59s ago`

### Minutes (< 1 hour)
`1m ago`, `15m ago`, `59m ago`

### Hours (< 1 day)
`1h ago`, `5h ago`, `23h ago`

### Days (< 1 week)
`1d ago`, `3d ago`, `6d ago`

### Weeks (< 1 month)
`1w ago`, `2w ago`, `3w ago`

### Months+
Falls back to date string: `11/26/2024`

---

## Number Formatting

### Thousands (1K+)
- `1,234` → `1.2k`
- `5,678` → `5.7k`
- `999,999` → `1000.0k`

### Millions (1M+)
- `1,234,567` → `1.2M`
- `5,678,901` → `5.7M`

---

## Wallet Address Truncation

Full address: `Ab8xK9pLQw3rT8yUZx9cV5bN`
Truncated: `Ab8x...V5bN`

Format: First 4 chars + `...` + Last 4 chars

---

## Accessibility

### ARIA Attributes (Future Enhancement)
```jsx
<Box 
  role="article"
  aria-label={`Activity: ${getActivityLabel(item.type)}`}
>
```

### Keyboard Navigation (Future Enhancement)
- Tab to focus item
- Enter to expand batched items
- Escape to close expanded view

### Screen Reader (Future Enhancement)
Announce:
- Activity type
- Actor wallet (abbreviated)
- Action description
- Relative time

---

## Props Interface

```typescript
interface FeedItemProps {
  item: FeedItemType
  onClickBatched?: (item: FeedItemType) => void
}

interface FeedItemType {
  id: string
  type: ActivityType
  timestamp: Date
  data: Record<string, any>
  batchedCount?: number
  batchedItems?: any[]
}
```

---

## Usage Example

```tsx
import { FeedItem } from '@/components/FeedItem'

// Single item
<FeedItem 
  item={{
    id: '123',
    type: 'job_posted',
    timestamp: new Date(),
    data: {
      actorWallet: 'Ab8xK9pLQw3rT8yUZx9cV5bN',
      jobTitle: 'Senior Designer'
    }
  }}
/>

// Batched item with callback
<FeedItem 
  item={{
    id: '456',
    type: 'job_application_upvoted',
    timestamp: new Date(),
    data: {
      applicantWallet: 'Qw3rT8yUZx9cV5bN',
    },
    batchedCount: 5,
    batchedItems: [...]
  }}
  onClickBatched={(item) => {
    console.log('Expand batched items:', item.batchedItems)
  }}
/>
```

---

## Integration with ActivityFeed

```tsx
<ActivityFeed projectId="project-123">
  {feedItems.map(item => (
    <FeedItem key={item.id} item={item} />
  ))}
</ActivityFeed>
```

---

## Future Enhancements

### Phase 1: Rich User Profiles
- Replace truncated addresses with `WalletAddressWithMessage` component
- Show user avatars
- Display user display names

### Phase 2: Click to View Details
- Open job detail page
- Show asset preview modal
- View tip transaction on Solscan

### Phase 3: Expand Batched Items
- Inline expansion to show all batched items
- Accordion-style reveal
- "Show less" collapse button

### Phase 4: Reactions
- Like/heart button
- Comment on activities
- Share activity link

### Phase 5: Rich Media
- Job thumbnail images
- Asset preview images
- Profile pictures
- Token logos

---

**Component File:** `/components/FeedItem.tsx`  
**Created:** November 26, 2024  
**Status:** Complete ✅












