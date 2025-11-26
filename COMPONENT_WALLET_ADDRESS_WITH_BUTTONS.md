# WalletAddressWithButtons Component

**Created**: November 26, 2024  
**File**: `/components/WalletAddressWithButtons.tsx`  
**Status**: ✅ Ready for Integration  
**Purpose**: Inline wallet display with [Message] and [Tip] action buttons

---

## Overview

A reusable component for displaying wallet addresses with inline action buttons in a compact, non-disruptive format. Designed specifically for feed items and dense layouts where icon buttons would be too bulky.

## Key Features

✅ **Inline Display** - Minimal layout disruption  
✅ **Profile Links** - Click address to view profile (opens in new tab)  
✅ **[Message] Button** - Privacy-aware messaging with permission checks  
✅ **[Tip] Button** - Integrated with TipModal and full validation  
✅ **Tier Badges** - Optional supporter/holder badges  
✅ **Smart Privacy** - Hides buttons when viewing own address  
✅ **Event Isolation** - Stops propagation to prevent unwanted navigation  
✅ **Compact Mode** - For tight spaces like feed items  
✅ **Error Handling** - Validates props and shows user-friendly error messages  
✅ **Toast Notifications** - Provides feedback for validation errors  

---

## Props Interface

```typescript
interface WalletAddressWithButtonsProps {
  address: string              // Wallet address (required)
  displayName?: string | null  // Display name (shows truncated address if not provided)
  showMessage?: boolean        // Show [Message] button (default: false)
  showTip?: boolean           // Show [Tip] button (default: false)
  tierBadge?: boolean         // Show "Holder" badge (default: false)
  compact?: boolean           // Compact mode (smaller fonts) (default: false)
  className?: string          // Additional CSS classes
  projectId?: string          // Project UUID (required for messaging)
  tokenMint?: string          // Token mint address (required for tipping)
}
```

---

## Usage Examples

### Basic Usage (Address Only)

```tsx
import { WalletAddressWithButtons } from '@/components/WalletAddressWithButtons'

<WalletAddressWithButtons 
  address="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
/>
// Renders: 7xKX...gAsU (clickable link to profile)
```

### With Display Name

```tsx
<WalletAddressWithButtons 
  address="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  displayName="Alice"
/>
// Renders: Alice (clickable link to profile)
```

### Full Featured (Feed Item)

```tsx
<WalletAddressWithButtons 
  address="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  displayName="Alice"
  showMessage
  showTip
  tierBadge
  projectId="project-uuid-123"
  tokenMint="token-mint-456"
/>
// Renders: Alice [Holder] [Message] [Tip]
```

### Compact Mode (Batched Modal)

```tsx
<WalletAddressWithButtons 
  address="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  showMessage
  showTip
  compact
  projectId="project-uuid-123"
  tokenMint="token-mint-456"
/>
// Renders smaller fonts for dense layouts
```

---

## Integration Points

### 1. Feed Items (FeedItem.tsx)

Replace truncated addresses in feed activity text:

```tsx
// Before:
<strong>{truncateAddress(data.actorWallet)}</strong> posted job

// After:
<WalletAddressWithButtons 
  address={data.actorWallet}
  showMessage
  showTip
  compact
  projectId={projectId}
  tokenMint={tokenMint}
/> posted job
```

### 2. Batched Activity Modal

Replace truncated addresses in participant lists:

```tsx
// In BatchedActivityModal.tsx line 198-201
<WalletAddressWithButtons 
  address={participant.wallet}
  showMessage
  showTip
  compact
  projectId={projectId}
  tokenMint={tokenMint}
/>
```

### 3. Job Detail Pages

Use in applicant lists, comment authors, etc.:

```tsx
<WalletAddressWithButtons 
  address={applicant.wallet_address}
  displayName={applicant.display_name}
  showMessage
  showTip
  tierBadge
  projectId={job.project_id}
  tokenMint={project.token_mint}
/>
```

---

## Behavior Details

### Privacy-Aware Messaging

The component automatically checks if the current user can message the target wallet:
- Respects privacy settings (`allow_messages_from`)
- Requires token holding for private profiles
- Only shows [Message] button if permissions pass
- Handles async permission checking gracefully

### Self Detection

Automatically hides action buttons when viewing own address:
```tsx
const isSelf = currentWallet === address
// If true, no [Message] or [Tip] buttons shown
```

### Event Propagation

All click handlers call `e.stopPropagation()` to prevent:
- Unwanted feed item navigation
- Modal dismissals
- Parent element click handlers

### Profile Links

Address/name is wrapped in `<Link>` that:
- Opens in new tab (`target="_blank"`)
- Navigates to `/profile/{address}`
- Has security attributes (`rel="noopener noreferrer"`)
- Stops propagation on click

---

## Styling

### Text Buttons

Buttons use minimal styling:
- No borders or backgrounds
- Color-coded: [Message] = primary blue, [Tip] = success green
- Hover effect: underline + darker color
- Font size: 10-11px (compact: 10px, normal: 11px)

### Address/Name

- Font weight: 600 (semibold)
- Monospace font for truncated addresses
- Normal font for display names
- Hover: underline + primary color

### Tier Badge

- Small chip with "Holder" label
- Primary color scheme
- Height: 16-18px based on compact mode
- Font size: 9-10px

---

## Error Handling & Validation

The component includes comprehensive validation and user feedback:

### Tip Validation

Before opening TipModal, the component validates:
1. **projectId** is provided
2. **tokenMint** is provided
3. **Wallet is connected**

If validation fails, displays toast notification:
- "Tipping not available for this item" (missing props)
- "Please connect your wallet to send tips" (no wallet)

### Error Logging

All validation errors are logged to console with context:
```typescript
console.error('Cannot open tip modal: missing projectId or tokenMint', {
  projectId,
  tokenMint,
  address
})
```

### Button Visibility

The [Tip] button only shows when ALL conditions are met:
- `showTip={true}`
- `tokenMint` is provided
- `projectId` is provided
- Not viewing own address

This prevents users from clicking a button that won't work.

---

## Dependencies

- `@mui/material` - Box, Typography, Chip
- `next/link` - Profile links
- `@solana/wallet-adapter-react` - Wallet connection
- `@/lib/MessagingContext` - Message opening
- `@/lib/messaging` - Permission checks
- `@/components/TipModal` - Tip functionality
- `react-hot-toast` - Toast notifications

---

## Next Steps for Full Integration

### Step 1: Update FeedItem.tsx

Pass `tokenMint` prop to FeedItem component:

```tsx
// In ActivityFeed.tsx
<FeedItem 
  item={item}
  projectId={projectId}
  tokenMint={project.token_mint} // Add this
  onClickBatched={handleBatchedItemClick}
/>
```

### Step 2: Fetch tokenMint in ActivityFeed

```tsx
// In ActivityFeed.tsx
const [tokenMint, setTokenMint] = useState<string | null>(null)

useEffect(() => {
  async function loadProject() {
    const { data } = await supabase
      .from('projects')
      .select('token_mint')
      .eq('id', projectId)
      .single()
    
    if (data) {
      setTokenMint(data.token_mint)
    }
  }
  loadProject()
}, [projectId])
```

### Step 3: Replace Truncated Addresses

Update `getActivityContent()` in FeedItem.tsx to use the new component.

### Step 4: Update BatchedActivityModal

Replace line 198-201 with WalletAddressWithButtons.

---

## Testing Checklist

- [ ] Renders with address only
- [ ] Renders with display name
- [ ] Shows tier badge when enabled
- [ ] [Message] button opens conversation
- [ ] [Tip] button opens TipModal
- [ ] Hides buttons for own address
- [ ] Profile link opens in new tab
- [ ] Compact mode renders smaller
- [ ] Respects privacy settings
- [ ] Handles missing tokenMint gracefully
- [ ] Event propagation doesn't break parent clicks

---

## Performance Notes

- Privacy check runs on mount (async)
- Results cached by `canMessageUser` function
- TipModal only mounts when opened
- Minimal re-renders (no unnecessary state updates)

---

## Differences from WalletAddressWithMessage

| Feature | WalletAddressWithMessage | WalletAddressWithButtons |
|---------|-------------------------|-------------------------|
| Layout | Icon buttons (horizontal) | Text buttons (inline) |
| Copy button | ✅ IconButton | ❌ Removed |
| Message button | 🔵 Icon | 🔤 [Message] text |
| Tip button | 🟢 Icon | 🟢 [Tip] text |
| Profile view | Dialog modal | New tab link |
| Tier badge | ❌ | ✅ |
| Compact mode | ❌ | ✅ |
| Use case | Detailed views | Feed items, lists |

---

## Example Output

### Normal Mode
```
Alice [Holder] [Message] [Tip]
```

### Compact Mode
```
7xKX...gAsU [Message] [Tip]
```

### Own Address
```
Alice [Holder]
```
(No action buttons when viewing self)

---

## Component Status

✅ **Created** - Component file exists  
✅ **Documented** - Full documentation complete  
⏳ **Integrated** - Needs integration into FeedItem  
⏳ **Tested** - Needs testing in feed context  

---

## Related Files

- `/components/WalletAddressWithMessage.tsx` - Original icon-based version
- `/components/FeedItem.tsx` - Primary integration target
- `/components/BatchedActivityModal.tsx` - Secondary integration target
- `/components/TipModal.tsx` - Tip functionality
- `/lib/messaging.ts` - Privacy check functions
- `/lib/MessagingContext.tsx` - Message opening

---

**Ready for integration into the feed system! 🚀**

