# Sprint 4: Context Preparation Prompt

## Goal
Prepare for **Sprint 4: Enhanced Notification System with Email Integration**

Sprint 4 will implement comprehensive notification handling for the Social Asset Review system, update notification click routing to the yellow feed, and integrate email notifications through the existing Resend service.

## Duration
**Day 4** - Notification handlers, routing, and email integration

## Your Task
Read the following code files carefully to gather all necessary context. Do NOT make any changes yet - just read and understand the existing architecture.

---

## 📚 Reading List

### **Sprint 3 Foundation (Yellow Feed)**
Read these first to understand what we just built:

1. **`SPRINT_3_COMPLETE.md`**
   - Summary of the yellow feed implementation
   - Component architecture and data flow
   - Real-time subscription patterns
   - API integration details

2. **`SOCIAL_ASSET_REVIEW_QUICK_START.md`**
   - User flow and feature overview
   - How the review process works
   - Expected notification touchpoints

3. **`lib/feed-queries-social-assets.ts`**
   - Data fetching functions
   - `SocialAssetFeedItem` interface
   - Asset transformation logic

4. **`components/admin/SocialAssetFeedItem.tsx`**
   - Feed item component with action handlers
   - Approve/Reject/Ban implementations
   - Current toast notifications (need to enhance)

5. **`components/admin/SocialAssetFeed.tsx`**
   - Feed container component
   - Real-time subscription setup
   - Pagination and state management

6. **`components/MessagesSidebar.tsx`**
   - Integration of yellow feed
   - Section selector logic
   - Project context detection

---

### **Existing Notification System**
Understand how notifications currently work:

7. **`lib/notifications/social-asset-notifications.ts`**
   - `notifyAssetPending()` - When asset is submitted
   - `notifyAssetApproved()` - When asset is approved
   - `notifyAssetRejected()` - When asset is rejected
   - Notification metadata structure
   - How notifications are inserted into database

8. **`types/database.ts`**
   - `NotificationType` enum (includes `social_asset_*` types)
   - `NotificationMetadata` interface
   - `notifications` table structure
   - Look for asset-related notification fields

9. **`lib/hooks/useNotifications.ts`**
   - How notifications are fetched and displayed
   - Real-time subscription to notifications table
   - `markAsRead()` function
   - Notification state management

10. **`components/NotificationBell.tsx`**
    - Notification dropdown UI
    - How notifications are rendered
    - Click handling for different notification types
    - Current routing logic (needs updating)

---

### **Notification Click Routing**
Understand current navigation patterns:

11. **`lib/hooks/useMessageNotifications.ts`** (if exists)
    - How message notifications open the sidebar
    - Navigation patterns for different notification types

12. **`lib/MessagingContext.tsx`**
    - `openMessages()` function
    - `targetWallet` state
    - How to programmatically open messages sidebar

13. **`components/AppHeader.tsx`**
    - NotificationBell integration
    - Message badge integration
    - How clicking notifications navigates

---

### **Email Notification System (Resend)**
Understand the existing email infrastructure:

14. **`lib/email/resend-client.ts`** or **`lib/resend.ts`**
    - Resend API client setup
    - Existing email sending functions
    - Email template patterns

15. **Search for Resend usage:**
    - Look in `app/api/` folder for existing email endpoints
    - Check how job notifications send emails
    - Find email template examples

16. **Environment Variables:**
    - Check `.env.example` or `.env.local` for:
      - `RESEND_API_KEY`
      - Email sender configuration
      - Any email-related settings

---

### **API Endpoints for Social Assets**
Review the API handlers that need notification integration:

17. **`app/api/assets/approve/route.ts`**
    - Current approval logic
    - Where to add enhanced notifications
    - Response format
    - Error handling

18. **`app/api/assets/reject/route.ts`**
    - Current rejection logic
    - Rejection reason handling
    - Where to add enhanced notifications

19. **`app/api/assets/ban-user/route.ts`**
    - Ban user logic
    - Multiple asset hiding
    - Where to add ban notifications

---

### **Design System & UI Patterns**
Understand styling for notifications:

20. **`DESIGN-SYSTEM.md`**
    - Color palette for notification types
    - `accentWarning: #FFC857` (yellow for asset submissions)
    - Typography for notification text
    - Icon library (Material Icons Rounded)

21. **`DESIGN_SYSTEM_IMPLEMENTATION.md`**
    - CSS variables available
    - Typography utility classes
    - Color usage patterns

---

### **Database Schema**
Understand data structures:

22. **`supabase-migrations/056_social_asset_review_system.sql`**
    - `pending_assets` table structure
    - Approval/rejection tracking columns
    - Notification-relevant fields

23. **`types/database.ts`** (review again for notifications)
    - Complete notification metadata structure
    - All notification types
    - Table relationships

---

### **Permission System**
Understand who should receive notifications:

24. **`lib/permissions/editor-permissions.ts`**
    - `checkEditorPermission()` function
    - How to determine if user is editor/creator
    - Permission check patterns

25. **Review notification targeting logic:**
    - Who gets notified when an asset is submitted?
    - Who gets notified when an asset is approved/rejected?
    - Do all editors get notified, or just one?

---

### **Existing Notification Examples**
Study how other features send notifications:

26. **Search for notification patterns:**
    - `grep -r "notifyAsset" app/api/`
    - `grep -r "notifications.insert" app/api/`
    - Look for job-related notifications
    - Look for message notifications

27. **Job notification examples** (if applicable):
    - How job assignments send notifications
    - How completion notifications work
    - Email + in-app notification pattern

---

## 📋 Ready Checklist

Before starting Sprint 4, confirm you understand:

### Yellow Feed Architecture:
- [ ] How the social asset feed is integrated into MessagesSidebar
- [ ] Project context detection and permission checking
- [ ] Section selector UI (Messages vs Asset Reviews)
- [ ] Badge counter and real-time updates
- [ ] Feed item actions (approve/reject/ban)

### Current Notification System:
- [ ] How notifications are created and stored
- [ ] `NotificationType` enum and `NotificationMetadata` structure
- [ ] Real-time subscription pattern for notifications
- [ ] How notifications appear in the NotificationBell dropdown
- [ ] Current click handling and navigation

### Email System (Resend):
- [ ] How Resend client is configured
- [ ] Existing email sending patterns
- [ ] Email template structure
- [ ] Environment variables needed
- [ ] Error handling for email failures

### API Integration Points:
- [ ] Where to add notification logic in approve/reject/ban endpoints
- [ ] How to batch notifications for multiple actions
- [ ] Permission checks before sending notifications
- [ ] Response format consistency

### Routing & Navigation:
- [ ] How to open MessagesSidebar programmatically
- [ ] How to set active section to 'social-assets'
- [ ] How to highlight a specific asset in the feed
- [ ] URL structure for deep linking

---

## 🎯 Sprint 4 Goals

Once you've read all the context, you'll be ready to implement:

### Task 4.1: Enhanced In-App Notifications
**Goal:** Improve notification creation in API endpoints

**Deliverables:**
- Update `/api/assets/approve` to send richer notifications
- Update `/api/assets/reject` to include rejection reason in notification
- Add notification for ban actions
- Batch notifications for multiple editors (if applicable)
- Include asset details (platform, handle, classification) in metadata

**Notification Types:**
- `social_asset_pending` → Already exists, verify implementation
- `social_asset_approved` → Enhance with karma amount, asset details
- `social_asset_rejected` → Enhance with rejection reason
- `social_asset_user_banned` → NEW - notify editors when user is banned

### Task 4.2: Notification Click Routing
**Goal:** Make clicking notifications open the yellow feed

**Deliverables:**
- Update `NotificationBell.tsx` click handler
- Detect `social_asset_*` notification types
- Open MessagesSidebar with `activeSection: 'social-assets'`
- Optionally scroll to/highlight the specific asset
- Add deep linking support (optional)

**User Flow:**
```
User clicks notification
  ↓
Detect notification type (social_asset_*)
  ↓
Extract projectId from metadata
  ↓
Navigate to /project/[projectId]
  ↓
Open MessagesSidebar
  ↓
Set activeSection to 'social-assets'
  ↓
(Optional) Highlight specific asset
```

### Task 4.3: Email Notifications (Resend)
**Goal:** Send email notifications for key events

**Deliverables:**
- Create email templates for:
  - Asset approved (to submitter)
  - Asset rejected (to submitter, with reason)
  - New asset submitted (to editors)
  - User banned (to editors)
- Implement email sending in API endpoints
- Handle email failures gracefully (log, don't block)
- Add email preferences (optional)

**Email Template Structure:**
```
Subject: [Align] Your social asset was approved!

Hi [Wallet],

Great news! Your [Platform] account @[Handle] for [Project Name] has been approved!

You earned [X.X karma] for this quality submission.

View your verified asset: [Link to project]

Keep contributing!
- The Align Team
```

### Task 4.4: Notification Preferences (Optional)
**Goal:** Allow users to control notification settings

**Deliverables:**
- Add notification preferences table/column
- Create preferences UI in settings
- Check preferences before sending notifications
- Default: all notifications enabled

### Task 4.5: Testing & Refinement
**Goal:** Verify all notification flows work correctly

**Test Cases:**
- [ ] Approve asset → Submitter gets in-app + email notification
- [ ] Reject asset → Submitter gets notification with reason
- [ ] Ban user → Editors get notification
- [ ] Click notification → Opens yellow feed on correct project
- [ ] Email delivery failures don't block API responses
- [ ] Real-time updates work for all editors

---

## 🔍 Key Questions to Answer

While reading the code, look for answers to:

1. **Notification Targeting:**
   - When an asset is submitted, who gets notified? (All editors? Just creator?)
   - Should notifications be batched or individual?
   - How to avoid notification spam?

2. **Email Configuration:**
   - What's the sender email address?
   - Are there rate limits to consider?
   - Should emails be queued or sent immediately?
   - How to handle undeliverable emails?

3. **Navigation:**
   - Can we pass state to MessagesSidebar to auto-open a section?
   - Should we add URL query params (`?section=social-assets`)?
   - How to handle notifications for deleted assets?

4. **Metadata Structure:**
   - What data should be included in notification metadata?
   - How to make notifications future-proof?
   - Should we include asset snapshots or just IDs?

5. **User Experience:**
   - Should notifications be dismissible?
   - Auto-mark as read when clicking?
   - Show notification preview in dropdown?
   - Group similar notifications?

---

## 📊 Data Structure Summary

### Notification Metadata (Asset Review):
```typescript
interface AssetReviewNotificationMetadata {
  asset_id: string
  asset_type: 'social' | 'domain'
  asset_classification: 'official' | 'affiliated'
  asset_platform?: string       // For social assets
  asset_handle?: string          // For social assets
  asset_domain?: string          // For domain assets
  project_id: string
  project_name?: string
  submitter_wallet?: string      // For editor notifications
  editor_wallet?: string         // For submitter notifications
  karma_awarded?: number         // For approval notifications
  rejection_reason?: string      // For rejection notifications
  banned_duration?: string       // For ban notifications
  assets_hidden_count?: number   // For ban notifications
}
```

### Email Notification Events:
```typescript
type EmailNotificationEvent =
  | 'asset_submitted'        // To editors
  | 'asset_approved'         // To submitter
  | 'asset_rejected'         // To submitter
  | 'user_banned'            // To editors
  | 'asset_upvoted'          // To submitter (future)
```

---

## 🎨 Design Guidelines

### Notification Styling:
- **Yellow (#FFB800)** for asset submission notifications
- **Purple (#7C4DFF)** for approval notifications
- **Red (#EF4444)** for rejection notifications
- **Gray (#6F7280)** for ban notifications

### Email Styling:
- Use Align logo in header
- Lime yellow (#E3F06F) accent color
- Clean, simple HTML templates
- Mobile-responsive design
- Clear call-to-action buttons

### Notification Text:
- **Title:** Short, action-oriented (e.g., "Asset Approved!")
- **Body:** Concise, includes key details
- **Action:** Clear next step (e.g., "View in Feed")

---

## 📁 Files You'll Modify in Sprint 4

### API Endpoints:
- `app/api/assets/approve/route.ts` - Add enhanced notifications + email
- `app/api/assets/reject/route.ts` - Add enhanced notifications + email
- `app/api/assets/ban-user/route.ts` - Add ban notifications + email

### Notification System:
- `lib/notifications/social-asset-notifications.ts` - Enhance notification functions
- `components/NotificationBell.tsx` - Update click handling for routing

### Email System:
- `lib/email/asset-review-emails.ts` - NEW - Email templates and sending logic
- Create email template files (HTML/text)

### Navigation:
- `lib/MessagingContext.tsx` - Add function to open with specific section
- `components/MessagesSidebar.tsx` - Add prop for initial section

### Types:
- `types/database.ts` - Verify notification metadata types
- `types/email.ts` - NEW (optional) - Email-related types

---

## 🚀 Response Format

When you're ready, reply with:

**"✅ Context gathered for Sprint 4!"**

Then provide a brief summary covering:

1. **Notification System Architecture**
   - Current notification flow
   - Metadata structure
   - Real-time subscription pattern

2. **Email Integration Status**
   - Resend client configuration
   - Existing email patterns
   - Template approach

3. **Routing Strategy**
   - How to open yellow feed from notifications
   - MessagesSidebar state management
   - Navigation patterns

4. **API Enhancement Plan**
   - Where to add notification logic
   - Notification batching strategy
   - Email sending integration

5. **Key Integration Points**
   - Functions to modify
   - New files to create
   - Testing approach

6. **Any concerns or missing pieces**

---

## ⚠️ Important Notes

- **Read-Only Phase:** Do not make any changes during context gathering
- **Ask Questions:** If anything is unclear, ask before Sprint 4 begins
- **Document Gaps:** Note any missing documentation or unclear patterns
- **Version Check:** Ensure you understand the current state after Sprint 3

---

## 📞 Ready to Start?

Once you've read all the files and gathered context, let me know you're ready for Sprint 4 implementation!

---

**Created:** December 22, 2025  
**Sprint:** 4  
**Focus:** Notification handlers, routing, and email integration  
**Prerequisites:** Sprint 3 complete (Yellow Feed)

