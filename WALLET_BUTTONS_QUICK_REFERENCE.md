# WalletAddressWithButtons - Quick Reference Card

**Component**: `WalletAddressWithButtons`  
**Purpose**: Inline wallet display with action buttons  
**Status**: ✅ Ready

---

## Import

```typescript
import { WalletAddressWithButtons } from '@/components/WalletAddressWithButtons'
```

---

## Props (Quick)

```typescript
<WalletAddressWithButtons 
  address={string}           // Required
  displayName={string}       // Optional
  showMessage={boolean}      // Default: false
  showTip={boolean}          // Default: false
  tierBadge={boolean}        // Default: false
  compact={boolean}          // Default: false
  projectId={string}         // Required for messaging
  tokenMint={string}         // Required for tipping
/>
```

---

## Common Patterns

### Pattern 1: Feed Item (Most Common)
```tsx
<WalletAddressWithButtons 
  address={wallet}
  showMessage
  showTip
  compact
  projectId={projectId}
  tokenMint={tokenMint}
/>
```

### Pattern 2: With Display Name
```tsx
<WalletAddressWithButtons 
  address={wallet}
  displayName="Alice"
  showMessage
  showTip
  projectId={projectId}
  tokenMint={tokenMint}
/>
```

### Pattern 3: With Tier Badge
```tsx
<WalletAddressWithButtons 
  address={wallet}
  displayName="Alice"
  showMessage
  showTip
  tierBadge
  projectId={projectId}
  tokenMint={tokenMint}
/>
```

### Pattern 4: Address Only (No Actions)
```tsx
<WalletAddressWithButtons 
  address={wallet}
/>
```

---

## Visual Output

### With All Features
```
Input:  address="7xKX..." displayName="Alice" showMessage showTip tierBadge
Output: Alice [Holder] [Message] [Tip]
```

### Without Display Name
```
Input:  address="7xKX..." showMessage showTip
Output: 7xKX...gAsU [Message] [Tip]
```

### Viewing Own Address
```
Input:  address={currentWallet} showMessage showTip
Output: Alice [Holder]
        (No action buttons shown)
```

---

## Integration Quick Steps

### Step 1: Add to ActivityFeed
```typescript
// ActivityFeed.tsx
const [tokenMint, setTokenMint] = useState<string | null>(null)

useEffect(() => {
  // Fetch tokenMint from projects table
}, [projectId])
```

### Step 2: Pass to FeedItem
```typescript
// ActivityFeed.tsx
<FeedItem 
  item={item}
  projectId={projectId}
  tokenMint={tokenMint}  // Add this
  onClickBatched={handleBatchedItemClick}
/>
```

### Step 3: Use in FeedItem
```typescript
// FeedItem.tsx - Replace this:
<strong>{truncateAddress(wallet)}</strong>

// With this:
<WalletAddressWithButtons 
  address={wallet}
  showMessage
  showTip
  compact
  projectId={projectId}
  tokenMint={tokenMint}
/>
```

---

## Behavior Checklist

✅ Address is clickable → opens profile in new tab  
✅ [Message] button → opens MessagingSidebar  
✅ [Tip] button → opens TipModal  
✅ Privacy checks → hides [Message] if restricted  
✅ Self detection → hides buttons for own address  
✅ Event propagation → stops bubbling  
✅ Display name → shows instead of address if provided  
✅ Tier badge → shows "Holder" chip if enabled  
✅ Compact mode → smaller fonts  

---

## Testing Quick Check

```bash
# 1. Does it render?
✓ Shows wallet address or display name

# 2. Does profile link work?
✓ Click address → new tab → correct profile

# 3. Does [Message] work?
✓ Click [Message] → MessagingSidebar opens → correct conversation

# 4. Does [Tip] work?
✓ Click [Tip] → TipModal opens → correct recipient

# 5. Does privacy work?
✓ [Message] hidden when can't message

# 6. Does self-detection work?
✓ No buttons when viewing own address

# 7. Does compact mode work?
✓ Smaller fonts when compact={true}

# 8. Does tier badge work?
✓ Shows [Holder] when tierBadge={true}
```

---

## Troubleshooting

### Problem: [Message] button doesn't show
**Check:**
- `showMessage={true}` is set
- `projectId` is provided
- Not viewing own address
- Privacy check passed

### Problem: [Tip] button doesn't show
**Check:**
- `showTip={true}` is set
- `tokenMint` is provided
- Not viewing own address

### Problem: Display name doesn't show
**Check:**
- `displayName` prop is provided
- Value is not null/undefined

### Problem: Tier badge doesn't show
**Check:**
- `tierBadge={true}` is set

### Problem: Profile link doesn't work
**Check:**
- Address is valid
- Route `/profile/[address]` exists

---

## Performance Tips

✅ **Do:** Reuse same projectId/tokenMint for all instances  
✅ **Do:** Let privacy checks cache results  
✅ **Do:** Use compact mode in dense layouts  
❌ **Don't:** Fetch new tokenMint for each wallet  
❌ **Don't:** Create new projectId strings  

---

## Activity Type Replacements

| Activity Type | Wallet Fields to Replace |
|--------------|-------------------------|
| job_posted | actorWallet |
| job_applied | actorWallet |
| job_application_upvoted | actorWallet, applicantWallet |
| job_assigned | assignedTo |
| job_submitted | actorWallet |
| job_completed | actorWallet |
| job_comment | actorWallet |
| asset_submitted | submitterWallet |
| asset_upvoted | voterWallet |
| tip_sent | fromWallet, toWallet |
| karma_milestone | wallet |

---

## Files Reference

📄 **Component**: `/components/WalletAddressWithButtons.tsx`  
📖 **Full Docs**: `/COMPONENT_WALLET_ADDRESS_WITH_BUTTONS.md`  
💡 **Examples**: `/WALLET_ADDRESS_BUTTONS_EXAMPLES.tsx`  
🔧 **Integration**: `/WALLET_BUTTONS_INTEGRATION_GUIDE.md`  
📋 **Summary**: `/SESSION_WALLET_ENRICHMENT_COMPLETE.md`  

---

## Key Dependencies

```typescript
// Required
'@mui/material'               // Box, Typography, Chip
'next/link'                   // Profile links
'@solana/wallet-adapter-react' // Wallet connection
'@/lib/MessagingContext'      // Message opening
'@/lib/messaging'             // Privacy checks
'@/components/TipModal'       // Tip functionality
```

---

## One-Liner Summary

> Replace `truncateAddress()` with `<WalletAddressWithButtons>` to transform static addresses into rich, actionable user interactions with inline [Message] and [Tip] buttons.

---

**Keep this reference open while integrating! 📌**






