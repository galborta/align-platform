# ✅ Sprint 7 - Task 1: Pending Assets View for Editors - COMPLETE

**Status**: ✅ Component Created - Ready for Integration  
**Date**: December 20, 2024

---

## 📁 File Created

**`components/project/PendingAssetsSection.tsx`** (319 lines)

---

## 🎯 What Was Built

### Component: PendingAssetsSection

A dedicated section for project editors to review and approve/reject pending social assets submitted by the community.

### Key Features

1. **Real-time Asset Loading**
   - Fetches pending assets from `pending_assets` table
   - Filters: `project_id`, `asset_type='social'`, status in `['pending', 'backed']`
   - Ordered by creation date (newest first)
   - Real-time Supabase subscription for instant updates

2. **Asset Display Cards**
   - Platform icon (uses existing logos from `/public/logos/`)
   - Platform name and handle (@username)
   - Submitter wallet (truncated: `xxxx...xxxx`)
   - Status badge (PENDING/BACKED with color coding)
   - Upvote count with thumb icon
   - Submission date (formatted)
   - Follower tier (if provided)

3. **Approval Actions**
   - **Approve Button**: Green button with checkmark icon
   - **Reject Button**: Red outline button with X icon
   - Loading state during processing (CircularProgress)
   - Disabled state for buttons during processing

4. **Reject Flow**
   - Prompts for optional rejection reason
   - Cancellable (if user clicks Cancel on prompt)
   - Sends reason to API if provided

5. **Conditional Rendering**
   - Hidden if `!canApprove` (only editors/creators see it)
   - Loading state while fetching
   - Empty state with helpful message if no assets

6. **Design System Integration**
   - Uses all CSS variables from `DESIGN_SYSTEM_IMPLEMENTATION.md`
   - Follows existing component patterns (Card, Button, Material UI icons)
   - Responsive hover effects (border color, shadow)
   - Proper spacing and typography

---

## 🎨 Component API

### Props

```typescript
interface PendingAssetsSectionProps {
  projectId: string        // UUID of the project
  canApprove: boolean      // Permission flag (from lib/permissions.ts)
}
```

### Usage Example

```tsx
import { PendingAssetsSection } from '@/components/project/PendingAssetsSection'

// In project page component
const permissions = await getProjectPermissions(projectId, wallet)

<PendingAssetsSection 
  projectId={projectId} 
  canApprove={permissions.canApproveAssets} 
/>
```

---

## 🔗 API Integration

The component calls:

```
POST /api/assets/approve
```

**Request Body (Approve):**
```json
{
  "asset_id": "uuid",
  "project_id": "uuid",
  "action": "approve"
}
```

**Request Body (Reject):**
```json
{
  "asset_id": "uuid",
  "project_id": "uuid", 
  "action": "reject",
  "rejection_reason": "optional string"
}
```

**⚠️ Note**: This API endpoint needs to be created (Task 2).

---

## 📊 Data Flow

```
1. Component mounts
   ↓
2. Fetch pending_assets from Supabase
   - Filter: project_id, asset_type='social', status in ['pending', 'backed']
   - Order: created_at DESC
   ↓
3. Display asset cards
   ↓
4. User clicks Approve/Reject
   ↓
5. Show loading state (disable buttons)
   ↓
6. Call POST /api/assets/approve
   ↓
7. On success: Refresh asset list
   ↓
8. On error: Show alert with error message
   ↓
9. Clear loading state

Real-time subscription updates list automatically when:
- New assets submitted
- Assets approved/rejected by other editors
- Asset status changes
```

---

## 🎨 Visual Design

### Card Layout

```
┌─────────────────────────────────────────────────────────┐
│ Pending Assets for Review                          [3]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 📷 Instagram - @username        [PENDING]        │  │
│  │    by xxxx...xxxx                                │  │
│  │                                                  │  │
│  │    👍 5 upvotes • Dec 20, 2024 • 10k-50k       │  │
│  │                                                  │  │
│  │                        [✓ Approve] [✗ Reject]   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 𝕏 Twitter - @handle            [BACKED]         │  │
│  │    by yyyy...yyyy                                │  │
│  │                                                  │  │
│  │    👍 12 upvotes • Dec 19, 2024 • 100k-500k    │  │
│  │                                                  │  │
│  │                        [✓ Approve] [✗ Reject]   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Color Scheme

- **Approve Button**: `var(--accent-success)` (#36C170)
- **Reject Button**: Red (#EF4444) outline
- **Pending Badge**: Gray background (#E5E7F0)
- **Backed Badge**: `var(--accent-warning)` (#FFC857)
- **Card Hover**: Purple border (`var(--accent-primary)`) + shadow
- **Icons**: Material UI icons + platform logos

### States

1. **Loading**: Centered CircularProgress spinner
2. **Empty**: Checkmark icon + "No pending assets to review" message
3. **List**: Asset cards with hover effects
4. **Processing**: Loading spinner in button, both buttons disabled

---

## ✅ Design System Compliance

Uses CSS variables from `DESIGN_SYSTEM_IMPLEMENTATION.md`:

- `--font-heading` - Asset titles (Space Grotesk)
- `--font-body` - Body text (Satoshi)
- `--font-mono` - Wallet addresses (JetBrains Mono)
- `--space-*` - All spacing (xs, sm, md, lg, xl)
- `--radius-*` - Border radius (card-lg, control)
- `--text-*` - Font sizes (headline, body-small, caption)
- `--accent-primary` - Purple hover borders
- `--accent-success` - Green approve button
- `--accent-warning` - Yellow backed badge
- `--card-background` - White cards
- `--border-subtle` - Card borders
- `--shadow-chip` - Hover shadow

---

## 🧪 Features Implemented

- ✅ Fetch pending assets from Supabase
- ✅ Filter by project, type, status
- ✅ Display platform icons (using existing logos)
- ✅ Show asset details (handle, submitter, upvotes, date)
- ✅ Approve button with loading state
- ✅ Reject button with loading state
- ✅ Rejection reason prompt
- ✅ Conditional rendering (hide if !canApprove)
- ✅ Loading state during fetch
- ✅ Empty state with helpful message
- ✅ Real-time subscription for updates
- ✅ Hover effects on cards
- ✅ Responsive layout
- ✅ Status badges (PENDING/BACKED)
- ✅ Truncated wallet addresses
- ✅ Formatted dates
- ✅ Error handling with alerts
- ✅ TypeScript types from database.ts
- ✅ Zero linting errors

---

## 📝 Next Steps

### Task 2: Create API Endpoint

Create `app/api/assets/approve/route.ts`:

1. **Validate Request**
   - Check `asset_id`, `project_id`, `action` present
   - Verify user wallet connected
   - Validate action is 'approve' or 'reject'

2. **Check Permissions**
   - Use `requireEditorPermission(projectId, wallet)`
   - Verify editor has valid session (if not creator)

3. **Approve Flow**
   - Fetch asset from `pending_assets`
   - Copy data to `social_assets` table with `verified=true`
   - Update `pending_assets.verification_status = 'verified'`
   - Award remaining karma to submitter (75%)
   - Award karma to upvoters
   - Create notification for submitter (`social_asset_approved`)

4. **Reject Flow**
   - Update `pending_assets.verification_status = 'hidden'`
   - Set `hidden_at = NOW()`
   - Store `rejection_reason` in admin logs or metadata
   - Create notification for submitter (`social_asset_rejected`)

5. **Return Response**
   - Success: `{ success: true, message: '...' }`
   - Error: `{ error: 'error message' }` with appropriate status code

---

## 🔍 Testing Checklist

### When API is Ready:

- [ ] Load section as editor - assets display correctly
- [ ] Load section as non-editor - section hidden
- [ ] Empty state shows when no pending assets
- [ ] Loading state shows during initial fetch
- [ ] Platform icons display correctly
- [ ] Wallet addresses truncated properly
- [ ] Dates formatted correctly
- [ ] Status badges show correct colors
- [ ] Upvote counts display
- [ ] Follower tier displays (if present)
- [ ] Approve button shows loading state
- [ ] Reject button shows loading state
- [ ] Both buttons disabled during processing
- [ ] Rejection prompt appears on reject click
- [ ] Can cancel rejection prompt
- [ ] Asset disappears from list after approval
- [ ] Asset disappears from list after rejection
- [ ] Real-time updates work (another editor approves)
- [ ] Error alerts show on API failure
- [ ] Hover effects work on cards
- [ ] Responsive on mobile/tablet/desktop

---

## 📚 Integration Instructions

### Step 1: Add to Project Page

In `app/project/[id]/page.tsx`:

```tsx
// Add import
import { PendingAssetsSection } from '@/components/project/PendingAssetsSection'

// In component (after permissions are loaded)
{permissions.canApproveAssets && (
  <Box sx={{ mb: 4 }}>
    <PendingAssetsSection 
      projectId={params.id as string} 
      canApprove={permissions.canApproveAssets} 
    />
  </Box>
)}
```

### Step 2: Position in Layout

Recommended placement:
- **Option A**: Below project description, above verified assets
- **Option B**: As a separate tab in project navigation
- **Option C**: In a dedicated "Editor Dashboard" section

Current project page sections:
1. Project header
2. Project description
3. Social assets (verified)
4. Team wallets
5. Jobs widget
6. Activity feed

**Recommended**: Insert between #2 and #3 for editors.

---

## 🎯 Success Criteria

- ✅ Component created and follows design system
- ✅ Zero linting errors
- ✅ TypeScript types properly defined
- ✅ Real-time updates implemented
- ✅ All UI states handled (loading, empty, error)
- ✅ Conditional rendering based on permissions
- ⏳ API endpoint created (Task 2)
- ⏳ Integrated into project page (Task 3)
- ⏳ Notifications sent on approve/reject (Task 4)

---

## 🚀 Task 1 Status

**COMPLETE** ✅

Component is production-ready and waiting for:
1. API endpoint creation (Task 2)
2. Integration into project page (Task 3)

---

**Created**: December 20, 2024  
**Component**: PendingAssetsSection  
**Lines of Code**: 319  
**Dependencies**: Supabase, Material UI, Next.js, existing UI components  
**Status**: ✅ Ready for Task 2

