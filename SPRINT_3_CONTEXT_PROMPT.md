# Sprint 3 Context Preparation Prompt

**For AI Assistant:** Please read the code carefully to prepare for Sprint 3: Yellow Feed Implementation

---

## 🎯 Sprint 3 Overview

**Sprint:** Social Asset Review System - Sprint 3  
**Goal:** Create the "Social Asset Submissions" feed in Messages sidebar with real-time updates, badge counters, and feed item components.  
**Duration:** Day 3 (4-6 hours)

---

## 📋 Context Gathering Instructions

I've completed Sprint 1 (Database & Submission UI) and Sprint 2 (API Endpoints). Now I need to prepare for Sprint 3: building the admin/editor UI for reviewing pending social asset submissions.

**Please read the following files carefully to understand the current system and UI patterns before we start Sprint 3:**

---

## 1️⃣ **Sprint 1 & 2 Foundation (MUST READ)**

These files contain the complete context of what was built in Sprint 1 & 2:

### Sprint Summaries
- `SOCIAL_ASSET_REVIEW_SYSTEM_OVERVIEW.md` - Complete system architecture and data flows
- `SPRINT_2_SUMMARY.md` - Sprint 2 API implementation details
- `QUICK_START_SOCIAL_ASSETS.md` - Quick reference for the system

### Database Schema
- `supabase-migrations/056_social_asset_review_system.sql` - Table structure, columns, indexes
- `types/database.ts` - Look for:
  - `pending_assets` table structure
  - `social_assets` table structure
  - `asset_classification` type
  - Notification types related to social assets

### API Endpoints (Sprint 2)
- `app/api/assets/approve/route.ts` - Approval endpoint
- `app/api/assets/reject/route.ts` - Rejection endpoint
- `app/api/assets/ban-user/route.ts` - Ban user endpoint

### Notification System
- `lib/notifications/social-asset-notifications.ts` - Notification helpers for asset review

---

## 2️⃣ **Messages Sidebar Structure (CRITICAL)**

Understand the existing Messages sidebar to know where to add the new feed:

### Files to Read
- Search for `Messages` or `Sidebar` components in `app/` and `components/` directories
- Look for any existing feed implementations
- Find navigation/tab patterns
- Identify layout components

### What to Look For
- How is the Messages sidebar currently structured?
- Are there existing tabs or sections?
- What is the navigation pattern?
- Where would "Social Asset Submissions" fit?
- What styling/design system is used?

---

## 3️⃣ **Feed Component Patterns**

Find existing feed implementations to match the pattern:

### Search For
- Feed components (any list-based UI showing items)
- Activity feeds
- Notification feeds
- Chat message lists
- Job submission lists
- Contest submission lists

### Files to Check
```
app/
  messages/
  jobs/
  contests/
components/
  Feed*
  List*
  *Feed*
  *List*
```

### What to Learn
- How are feed items rendered?
- What is the card/item component structure?
- How is infinite scroll implemented?
- How are timestamps displayed?
- How are user avatars shown?
- What loading states exist?

---

## 4️⃣ **Badge Counter Implementation**

Understand how unread/pending counts are displayed:

### Search For
- Badge components
- Counter badges
- Unread indicators
- Notification counts
- Pending counts

### Files to Check
```
components/
  Badge*
  Counter*
  Notification*
lib/
  hooks/
    use*Count*
    use*Badge*
```

### What to Learn
- How are badges positioned?
- What colors indicate different states?
- How are counts updated in real-time?
- What is the badge component API?

---

## 5️⃣ **Real-Time Updates Pattern**

Understand how real-time subscriptions work in the app:

### Search For
- Supabase subscriptions
- Real-time updates
- useEffect with supabase.channel
- Realtime hooks

### Files to Check
```
lib/
  hooks/
    use*Subscription*
    use*Realtime*
  supabase.ts
components/
  *that use real-time*
```

### What to Learn
- How are Supabase subscriptions set up?
- How is real-time data merged with existing state?
- How are subscriptions cleaned up?
- What is the pattern for real-time counts?

---

## 6️⃣ **Design System Components**

Understand the design system to maintain consistency:

### Files to Read
- `DESIGN-SYSTEM.md` - Complete design system documentation
- `components/` - Look for reusable components:
  - Button variants
  - Card components
  - List items
  - Badges
  - Typography
  - Colors
  - Spacing

### What to Learn
- What are the primary/secondary button styles?
- What card styles exist?
- What typography scale is used?
- What colors represent different states?
- What spacing system is used?

---

## 7️⃣ **Permission/Auth Context**

Understand how editor permissions are checked in the UI:

### Files to Read
- `lib/permissions/editor-permissions.ts` - Permission helpers (Sprint 2)
- `lib/permissions.ts` - Existing permission utilities
- Look for React hooks that check permissions
- Find context providers for auth/permissions

### What to Learn
- How do we check if current user is editor?
- Is there a usePermissions hook?
- How is the current wallet accessed?
- What loading states exist for permissions?

---

## 8️⃣ **Modal/Dialog Patterns**

Since we'll need approve/reject/ban modals:

### Search For
- Modal components
- Dialog components
- Confirmation dialogs
- Form modals

### Files to Check
```
components/
  Modal*
  Dialog*
  *Modal*
  AddAssetModal.tsx (example from Sprint 1)
```

### What to Learn
- What modal library is used? (MUI Dialog?)
- What is the modal open/close pattern?
- How are forms structured in modals?
- What button layouts are used?

---

## 9️⃣ **Data Fetching Patterns**

Understand how data is fetched and managed:

### Search For
- React hooks for data fetching
- Supabase query patterns
- Loading states
- Error handling

### Files to Check
```
lib/
  hooks/
    use*Query*
    use*Fetch*
app/api/
  (existing endpoints)
```

### What to Learn
- Is there a custom hook for fetching?
- How are loading/error states handled?
- Is there a query cache?
- What is the refetch pattern?

---

## 🔟 **Existing Admin/Editor UI**

Find any existing admin or editor interfaces:

### Search For
- Admin dashboards
- Editor panels
- Review interfaces
- Approval UIs

### Files to Check
```
app/
  admin/
  dashboard/
  editor/
components/
  Admin*
  Editor*
```

### What to Learn
- What does an admin interface look like?
- How are actions (approve/reject) presented?
- What feedback is shown after actions?
- What error handling exists?

---

## 📊 Data Structure Summary (From Sprint 1 & 2)

After reading the above, you should understand:

### pending_assets Table
```typescript
{
  id: string
  project_id: string
  asset_type: 'social' | 'domain'
  asset_classification: 'official' | 'affiliated'
  asset_data: {
    // For social
    platform?: string
    handle?: string
    followerTier?: string
    // For domain
    domain?: string
    url?: string
  }
  submitter_wallet: string
  verification_status: 'pending' | 'verified' | 'rejected' | 'hidden'
  submission_token_balance: number
  submission_token_percentage: number
  approved_by?: string
  approved_at?: string
  rejected_by?: string
  rejected_at?: string
  rejection_reason?: string
  created_at: string
}
```

### API Endpoints Available (Sprint 2)
- `POST /api/assets/approve` - Approve asset
- `POST /api/assets/reject` - Reject asset  
- `POST /api/assets/ban-user` - Ban submitter

---

## ✅ Ready Checklist

After reading all the above files, you should be able to answer:

- [ ] Where is the Messages sidebar located?
- [ ] What component structure should the new feed use?
- [ ] How are badge counters implemented?
- [ ] How do we set up real-time subscriptions?
- [ ] What design system components can we use?
- [ ] How do we check if user is an editor?
- [ ] What modal pattern should we follow?
- [ ] How do we fetch pending assets?
- [ ] What loading/error states exist?
- [ ] How do we show success/error feedback?

---

## 🎯 Sprint 3 Goals (After Context Gathering)

Once context is gathered, Sprint 3 will build:

1. **"Social Asset Submissions" Feed Item in Sidebar**
   - Yellow badge with pending count
   - Positioned in Messages sidebar
   - Real-time count updates

2. **Pending Assets Feed View**
   - List of all pending submissions
   - Filter by status, type, classification
   - Sort by date, submitter
   - Real-time additions

3. **Asset Review Card Component**
   - Display asset details (platform, handle, domain)
   - Show submitter info
   - Display classification badge
   - Show submission date
   - Quick approve/reject actions

4. **Approve/Reject Modal**
   - Approve button → calls API
   - Reject button → opens reason modal
   - Success/error feedback
   - Optimistic updates

5. **Ban User Modal**
   - Duration selector (7d/30d/90d/permanent)
   - Reason input
   - Confirmation
   - Calls ban API

6. **Real-Time Updates**
   - Subscribe to pending_assets table
   - Update count badge in real-time
   - Add new submissions to feed
   - Remove approved/rejected items

---

## 📝 Response Format

When you're ready, please respond with:

**"✅ Context gathered and ready for Sprint 3!"**

Then provide a brief summary including:
1. Messages sidebar location and structure
2. Recommended component patterns to follow
3. Badge counter implementation approach
4. Real-time subscription pattern
5. Design system components available
6. Any concerns or missing pieces

**If any critical files are missing or unclear, please ask for clarification before proceeding with Sprint 3.**

---

## 🚀 Let's Build Sprint 3!

Once you confirm you have full context, I'll provide the detailed Sprint 3 task list and we'll begin implementation.

