# Feed System: Wallet Enrichment Integration Guide

**Goal**: Replace truncated addresses with rich wallet components featuring inline [Message] and [Tip] actions

**Component**: `WalletAddressWithButtons.tsx` ✅ Created  
**Status**: Ready for Integration  
**Date**: November 26, 2024

---

## Visual Before/After

### BEFORE (Current State)

```
Feed Item Example:
┌─────────────────────────────────────────────┐
│ 🟣 7xKX...gAsU posted job: UI Designer     │
│    Needed                                   │
│    5m ago                                   │
└─────────────────────────────────────────────┘

Batched Modal Example:
┌─────────────────────────────────────────────┐
│ Application Voters (3)                      │
├─────────────────────────────────────────────┤
│ 👤 7xKX...gAsU              5.23%          │
│ 👤 8yMW...gBvR              3.15%          │
│ 👤 9zNY...yDwS              2.87%          │
└─────────────────────────────────────────────┘
```

### AFTER (With Enrichment)

```
Feed Item Example:
┌─────────────────────────────────────────────┐
│ 🟣 Alice [Message] [Tip] posted job: UI    │
│    Designer Needed                          │
│    5m ago                                   │
└─────────────────────────────────────────────┘

Batched Modal Example:
┌─────────────────────────────────────────────┐
│ Application Voters (3)                      │
├─────────────────────────────────────────────┤
│ 👤 Alice [Message] [Tip]    5.23%         │
│ 👤 8yMW...gBvR [Message] [Tip]  3.15%     │
│ 👤 Charlie [Holder] [Message] [Tip] 2.87% │
└─────────────────────────────────────────────┘
```

---

## Integration Checklist

### Phase 1: Component Setup ✅

- [x] Create `WalletAddressWithButtons.tsx`
- [x] Add privacy checking (canMessageUser)
- [x] Integrate TipModal
- [x] Add profile linking
- [x] Create documentation
- [x] Create examples

### Phase 2: ActivityFeed Enhancement 🔄

- [ ] Add tokenMint state to ActivityFeed
- [ ] Fetch project tokenMint on mount
- [ ] Pass tokenMint to FeedItem component
- [ ] Update FeedItem props interface

### Phase 3: FeedItem Integration 🔄

- [ ] Update FeedItemProps to include tokenMint
- [ ] Replace truncateAddress calls with WalletAddressWithButtons
- [ ] Handle 15+ activity type text blocks
- [ ] Test all activity types

### Phase 4: BatchedActivityModal Integration 🔄

- [ ] Pass tokenMint to modal
- [ ] Replace truncateAddress in participant list (line 199)
- [ ] Test with different batch types
- [ ] Verify layout in modal

### Phase 5: Testing & Polish 🔄

- [ ] Test with display names
- [ ] Test with truncated addresses
- [ ] Test message button permissions
- [ ] Test tip modal opening
- [ ] Test profile link navigation
- [ ] Test own address hiding
- [ ] Test compact mode
- [ ] Test tier badges

---

## File Modification Plan

### 1. ActivityFeed.tsx

**Changes Required:**
- Add state for tokenMint
- Fetch tokenMint from projects table
- Pass to FeedItem components

```typescript
// Add state (around line 44)
const [tokenMint, setTokenMint] = useState<string | null>(null)

// Fetch tokenMint (around line 115, inside loadFeed)
useEffect(() => {
  async function loadFeed() {
    // ... existing code ...
    
    // Add after project validation
    const { data: project } = await supabase
      .from('projects')
      .select('token_mint')
      .eq('id', projectId)
      .single()
    
    if (project) {
      setTokenMint(project.token_mint)
    }
    
    // ... rest of existing code ...
  }
  loadFeed()
}, [projectId, handleNewActivity])

// Update FeedItem usage (around line 477)
<FeedItem 
  key={item.id} 
  item={item}
  projectId={projectId}
  tokenMint={tokenMint} // Add this
  onClickBatched={handleBatchedItemClick}
/>
```

**Lines to Modify:** ~44, ~115-130, ~477-482

---

### 2. FeedItem.tsx

**Changes Required:**
- Add tokenMint to props
- Import WalletAddressWithButtons
- Replace truncateAddress calls in getActivityContent()

```typescript
// Update props interface (line 26)
interface FeedItemProps {
  item: FeedItemType
  projectId: string
  tokenMint?: string | null  // Add this
  onClickBatched?: (item: FeedItemType) => void
}

// Update component signature (line 309)
export function FeedItem({ item, projectId, tokenMint, onClickBatched }: FeedItemProps) {
  // ... existing code ...
}

// Import at top (line 1)
import { WalletAddressWithButtons } from './WalletAddressWithButtons'
```

**Replace in getActivityContent():**

#### Job Posted (line 85-90)
```typescript
// BEFORE:
case 'job_posted':
  return (
    <>
      <strong>{truncateAddress(data.actorWallet)}</strong> posted job: <span className="feed-item-link">{data.jobTitle}</span>
    </>
  )

// AFTER:
case 'job_posted':
  return (
    <>
      <WalletAddressWithButtons 
        address={data.actorWallet}
        showMessage
        showTip
        compact
        projectId={projectId}
        tokenMint={tokenMint}
      /> posted job: <span className="feed-item-link">{data.jobTitle}</span>
    </>
  )
```

#### Job Applied (line 91-96)
```typescript
// BEFORE:
case 'job_applied':
  return (
    <>
      <strong>{truncateAddress(data.actorWallet)}</strong> applied to <span className="feed-item-link">{data.jobTitle}</span>
    </>
  )

// AFTER:
case 'job_applied':
  return (
    <>
      <WalletAddressWithButtons 
        address={data.actorWallet}
        showMessage
        showTip
        compact
        projectId={projectId}
        tokenMint={tokenMint}
      /> applied to <span className="feed-item-link">{data.jobTitle}</span>
    </>
  )
```

#### Job Application Upvoted (line 97-119)
```typescript
// BEFORE:
case 'job_application_upvoted':
  if (batchedCount && batchedCount > 1) {
    return (
      <>
        <span className="batched-count" ...>
          {batchedCount} holders
        </span> upvoted <strong>{truncateAddress(data.applicantWallet)}</strong>'s application for <span className="feed-item-link">{data.jobTitle}</span>
      </>
    )
  }
  return (
    <>
      <strong>{truncateAddress(data.actorWallet)}</strong> upvoted <strong>{truncateAddress(data.applicantWallet)}</strong>'s application for <span className="feed-item-link">{data.jobTitle}</span>
    </>
  )

// AFTER:
case 'job_application_upvoted':
  if (batchedCount && batchedCount > 1) {
    return (
      <>
        <span className="batched-count" ...>
          {batchedCount} holders
        </span> upvoted <WalletAddressWithButtons 
          address={data.applicantWallet}
          showMessage
          showTip
          compact
          projectId={projectId}
          tokenMint={tokenMint}
        />'s application for <span className="feed-item-link">{data.jobTitle}</span>
      </>
    )
  }
  return (
    <>
      <WalletAddressWithButtons 
        address={data.actorWallet}
        showMessage
        showTip
        compact
        projectId={projectId}
        tokenMint={tokenMint}
      /> upvoted <WalletAddressWithButtons 
        address={data.applicantWallet}
        showMessage
        showTip
        compact
        projectId={projectId}
        tokenMint={tokenMint}
      />'s application for <span className="feed-item-link">{data.jobTitle}</span>
    </>
  )
```

**Continue pattern for remaining cases:**
- `job_assigned` (line 120-125) - Replace `data.assignedTo`
- `job_submitted` (line 126-131) - Replace `data.actorWallet`
- `job_completed` (line 132-137) - Replace `data.actorWallet`
- `job_comment` (line 144-166) - Replace `data.actorWallet`
- `asset_submitted` (line 167-172) - Replace `data.submitterWallet`
- `asset_upvoted` (line 173-195) - Replace `data.voterWallet`
- `tip_sent` (line 214-219) - Replace both `data.fromWallet` and `data.toWallet`
- `karma_milestone` (line 220-242) - Replace `data.wallet`

**Lines to Modify:** ~85-246 (entire switch statement)

---

### 3. BatchedActivityModal.tsx

**Changes Required:**
- Add tokenMint to props
- Pass to WalletAddressWithButtons in participant list

```typescript
// Update props interface (line 25)
interface BatchedActivityModalProps {
  item: FeedItem
  open: boolean
  onClose: () => void
  projectId: string
  tokenMint?: string | null  // Add this
}

// Update component signature (line 61)
export function BatchedActivityModal({ 
  item, 
  open, 
  onClose, 
  projectId,
  tokenMint  // Add this
}: BatchedActivityModalProps) {
  // ... existing code ...
}

// Import at top
import { WalletAddressWithButtons } from './WalletAddressWithButtons'

// Replace in participant list (line 195-202)
<ListItemText
  primary={
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <WalletAddressWithButtons 
        address={participant.wallet}
        showMessage
        showTip
        compact
        projectId={projectId}
        tokenMint={tokenMint}
      />
    </Box>
  }
  secondary={...}
/>
```

**Lines to Modify:** ~25, ~61, ~195-202

---

### 4. Update Modal Invocation in ActivityFeed.tsx

```typescript
// Update modal props (line 553-562)
{selectedItem && (
  <BatchedActivityModal
    item={selectedItem}
    open={modalOpen}
    onClose={() => {
      setModalOpen(false)
      setSelectedItem(null)
    }}
    projectId={projectId}
    tokenMint={tokenMint}  // Add this
  />
)}
```

**Lines to Modify:** ~560

---

## Activity Types to Update

All 15 activity types that display wallet addresses:

### Job Activities (8)
1. ✅ `job_posted` - actorWallet
2. ✅ `job_applied` - actorWallet
3. ✅ `job_application_upvoted` - actorWallet, applicantWallet
4. ✅ `job_assigned` - assignedTo
5. ✅ `job_submitted` - actorWallet
6. ✅ `job_completed` - actorWallet
7. ⚠️ `job_disputed` - No wallet shown currently
8. ✅ `job_comment` - actorWallet

### Asset Activities (3)
9. ✅ `asset_submitted` - submitterWallet
10. ✅ `asset_upvoted` - voterWallet
11. ⚠️ `asset_backed` - No wallet shown
12. ⚠️ `asset_verified` - No wallet shown
13. ⚠️ `asset_hidden` - No wallet shown

### Community Activities (2)
14. ✅ `tip_sent` - fromWallet, toWallet
15. ✅ `karma_milestone` - wallet

**Total Replacements:** ~12 activity types with visible wallets

---

## Testing Strategy

### Test Case 1: Basic Feed Display
- Load project page with live project
- Verify wallet addresses are clickable
- Verify [Message] and [Tip] buttons appear
- Verify own address shows no buttons

### Test Case 2: Profile Links
- Click wallet address
- Verify profile opens in new tab
- Verify correct wallet profile loads

### Test Case 3: Message Button
- Click [Message] on different wallet
- Verify MessagingSidebar opens
- Verify conversation with correct wallet
- Verify privacy restrictions work

### Test Case 4: Tip Button
- Click [Tip] on different wallet
- Verify TipModal opens
- Verify correct recipient
- Complete a tip transaction

### Test Case 5: Batched Activities
- Click batched activity count
- Verify modal opens
- Verify participant list shows enriched wallets
- Verify [Message] and [Tip] work in modal

### Test Case 6: Mixed Content
- Test activity with 2 wallets (upvote, tip)
- Verify both wallets are enriched
- Verify independent actions work

### Test Case 7: Display Names
- Test with user who has display name
- Verify display name shows instead of address
- Verify profile link still works

### Test Case 8: Compact Mode
- Verify smaller fonts in feed
- Verify buttons still clickable
- Verify tier badges render correctly

---

## Rollback Plan

If issues arise, rollback is simple:

1. **Revert FeedItem.tsx** to use `truncateAddress()`
2. **Remove tokenMint** from ActivityFeed state
3. **Keep WalletAddressWithButtons** for future use

All changes are additive, no data migrations required.

---

## Performance Considerations

### Impact: Minimal

- **Privacy checks**: Cached by `canMessageUser`
- **Extra renders**: None (component is pure)
- **Bundle size**: +3KB (negligible)
- **Network**: 1 extra query for tokenMint (cached)

### Optimizations

1. Privacy check results cached per wallet
2. TipModal only mounts when opened
3. Profile links use Next.js Link (prefetching)
4. Event propagation handled efficiently

---

## Success Metrics

After integration, verify:

✅ All wallet addresses are enriched  
✅ [Message] button opens conversations  
✅ [Tip] button opens tip modal  
✅ Profile links work  
✅ Privacy checks respected  
✅ Own address behavior correct  
✅ No layout breakage  
✅ No performance regression  
✅ Batched modals work  
✅ All 15 activity types tested  

---

## Next Steps

1. **Read this guide** 📖
2. **Review component code** (`WalletAddressWithButtons.tsx`)
3. **Review examples** (`WALLET_ADDRESS_BUTTONS_EXAMPLES.tsx`)
4. **Start with ActivityFeed.tsx** (add tokenMint)
5. **Move to FeedItem.tsx** (replace addresses)
6. **Update BatchedActivityModal.tsx** (enrich participants)
7. **Test thoroughly** (all cases above)
8. **Deploy gradually** (feature flag optional)

---

**Ready to transform the feed! 🚀**

**Files Created:**
- ✅ `/components/WalletAddressWithButtons.tsx`
- ✅ `/COMPONENT_WALLET_ADDRESS_WITH_BUTTONS.md`
- ✅ `/WALLET_ADDRESS_BUTTONS_EXAMPLES.tsx`
- ✅ `/WALLET_BUTTONS_INTEGRATION_GUIDE.md` (this file)

**Files to Modify:**
- 🔄 `/components/ActivityFeed.tsx`
- 🔄 `/components/FeedItem.tsx`
- 🔄 `/components/BatchedActivityModal.tsx`

**Estimated Time:** 2-3 hours for full integration + testing






