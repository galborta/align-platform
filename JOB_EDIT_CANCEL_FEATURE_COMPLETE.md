# ✏️🚫 Job Edit & Cancel Feature - Complete Documentation

**Job posters can now edit job details or cancel jobs with proper safeguards and karma penalties**

---

## 📋 Overview

This feature allows job posters to edit their job postings or cancel them entirely, with built-in safeguards to protect applicants and maintain system integrity. Editing a job with existing applications invalidates those applications, requiring applicants to reapply. Cancelling a job applies a karma penalty and has weekly limits to prevent abuse.

---

## 🎯 Features Implemented

### 1. **Edit Job Functionality** ✅

#### CreateJobModal Updates
📄 `components/CreateJobModal.tsx`

**New Props:**
- `mode?: 'create' | 'edit'` - Determines modal behavior
- `existingJob?: Job` - Pre-fills form in edit mode

**Edit Mode Behavior:**

1. **Form Pre-population**
   - Title, description, KPIs, category pre-filled
   - Payment amount displayed but disabled
   - Assignment mode pre-selected

2. **Payment Field Restrictions**
   - Payment amount field is disabled in edit mode
   - Helper text: "Payment amount cannot be changed after posting"
   - Prevents changing escrow amount after job is posted

3. **Application Warning** (if applications exist)
   - Orange warning alert at top of modal
   - Shows count of applications that will be invalidated
   - Warning text: "⚠️ Warning: Editing this job will INVALIDATE all existing applications"
   - Count display: "X application(s) will need to reapply"

4. **Confirmation Checkbox** (if applications exist)
   - Required checkbox before submission
   - Text: "I understand that X application(s) will be invalidated and applicants must reapply"
   - Submit button disabled until checked
   - Orange themed to match warning

5. **Update Logic**
   - Updates job fields (title, description, KPIs, category, assignment_mode)
   - Sets all existing applications to `is_invalidated = true`
   - Preserves applications (they remain visible but greyed out)
   - Shows success toast with invalidation count

---

### 2. **Cancel Job Functionality** ✅

#### Job Detail Page Updates
📄 `app/project/[id]/jobs/[jobId]/page.tsx`

**Cancel Job Flow:**

1. **Poster clicks "Cancel Job" button**
   - Red outline button next to "Edit Job"
   - Only visible to job poster
   - Only available for jobs with status 'open' or 'assigned'

2. **Confirmation Dialog Appears**
   ```
   Title: "🚫 Cancel Job?"
   Warning: "This action cannot be undone"
   ```

3. **Consequences List:**
   - ❌ You will lose **-50 karma**
   - 💰 Payment will be returned to your wallet
   - 🚫 All applications will be invalidated
   - ⏰ Cannot repost same job for 24 hours

4. **Cancellation Limit Check**
   - Maximum 10 cancellations per week per wallet
   - Checks last 7 days from current time
   - Query counts cancelled jobs in past week
   - If at limit: "You've cancelled 10 jobs this week. Try again next week."

5. **On Confirm:**
   - Updates job status to 'cancelled'
   - Sets `cancelled_at` timestamp
   - Invalidates all applications (`is_invalidated = true`)
   - Applies karma penalty (-50 × tier multiplier) ⏳ TODO Sprint 2.3
   - Returns tokens from escrow ⏳ TODO Phase 2
   - Sends notifications to applicants ⏳ TODO Sprint 2.3
   - Success toast: "Job cancelled. -50 karma penalty applied 🚫"

---

## 🗄️ Database Schema

### Existing Fields Used

```sql
-- jobs table
jobs {
  status: 'cancelled' (new usage)
  cancelled_at: TIMESTAMPTZ (already exists)
  updated_at: TIMESTAMPTZ
}

-- job_applications table
job_applications {
  is_invalidated: BOOLEAN (already exists)
  updated_at: TIMESTAMPTZ
}
```

### Cancellation Tracking

**Method 1: Using jobs table** (Currently Implemented)
```sql
-- Count cancellations in past 7 days
SELECT COUNT(*) 
FROM jobs
WHERE poster_wallet = $1
  AND status = 'cancelled'
  AND cancelled_at >= NOW() - INTERVAL '7 days'
```

**Method 2: Dedicated table** (Future Enhancement)
```sql
CREATE TABLE job_cancellations (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  poster_wallet TEXT NOT NULL,
  cancelled_at TIMESTAMPTZ DEFAULT NOW(),
  karma_penalty_applied INTEGER,
  reason TEXT,
  week_number INTEGER -- For tracking weekly limits
);
```

---

## 🔄 Complete Workflows

### Edit Job Workflow (No Applications)

```
Poster clicks "Edit Job"
  ↓
CreateJobModal opens in edit mode
  ↓
Form pre-filled with existing data
  ↓
Payment field disabled
  ↓
Poster makes changes
  ↓
Clicks "Update Job"
  ↓
Job record updated in database
  ↓
Success toast: "Job updated successfully!"
  ↓
Modal closes, job detail refreshes
```

### Edit Job Workflow (With Applications)

```
Poster clicks "Edit Job"
  ↓
CreateJobModal opens in edit mode
  ↓
Form pre-filled with existing data
  ↓
WARNING: "3 applications will be invalidated"
  ↓
Checkbox appears: "I understand..."
  ↓
Poster makes changes
  ↓
Checks confirmation checkbox
  ↓
Clicks "Update Job"
  ↓
Job record updated in database
  ↓
All applications set to is_invalidated = true
  ↓
Success toast: "Job updated. 3 applications invalidated."
  ↓
Modal closes, job detail refreshes
  ↓
Applications show "Invalidated" badge (greyed out)
```

### Cancel Job Workflow

```
Poster clicks "Cancel Job"
  ↓
Confirmation dialog appears
  ↓
Shows consequences and warnings
  ↓
Poster clicks "Cancel Job" (confirm)
  ↓
Check cancellation limit:
  - Query jobs where:
    * poster_wallet = current user
    * status = 'cancelled'
    * cancelled_at >= 7 days ago
  - Count results
  ↓
IF count >= 10:
  ↓
  Show error toast
  Close dialog
  STOP
  ↓
ELSE:
  ↓
  Update job:
    - status = 'cancelled'
    - cancelled_at = NOW()
  ↓
  Invalidate all applications:
    - is_invalidated = true
  ↓
  Apply karma penalty (TODO)
  ↓
  Return tokens from escrow (TODO)
  ↓
  Send notifications (TODO)
  ↓
  Success toast
  ↓
  Refresh job detail
```

---

## 🎨 UI/UX Design

### Edit Mode Differences

| Field | Create Mode | Edit Mode |
|-------|------------|-----------|
| Title | "Post a Job" | "Edit Job" |
| Payment Amount | Editable | **Disabled** (greyed out) |
| Payment Helper | Min $5 USD | "Cannot be changed after posting" |
| Warning Alert | Not shown | **Shown if applications exist** |
| Confirmation Checkbox | Not shown | **Required if applications exist** |
| Submit Button | "Post Job" | "Update Job" |
| Submit Disabled | Price checks | + Checkbox if applications |

### Warning Alert Design

```
┌────────────────────────────────────────────────────┐
│ ⚠️ WARNING                                         │
│                                                    │
│ ⚠️ Warning: Editing this job will INVALIDATE     │
│ all existing applications.                        │
│                                                    │
│ 3 applications will need to reapply.             │
└────────────────────────────────────────────────────┘

Colors:
- Background: #FFF4E6 (light orange)
- Icon: #FB923C (orange)
- Text: #1A1A1E (black)
- Border: 1px solid #FB923C
```

### Confirmation Checkbox Design

```
┌────────────────────────────────────────────────────┐
│ ☑️ I understand that 3 applications will be       │
│    invalidated and applicants must reapply        │
└────────────────────────────────────────────────────┘

Colors:
- Checkbox: #FB923C (orange) when checked
- Text: #1A1A1E (black)
- Font size: 14px
```

### Cancel Confirmation Dialog

```
┌──────────────────────────────────────────┐
│ 🚫 Cancel Job?                           │
├──────────────────────────────────────────┤
│                                          │
│ Are you sure you want to cancel this    │
│ job? This action cannot be undone.       │
│                                          │
│ ┌────────────────────────────────────┐  │
│ │ CONSEQUENCES:                      │  │
│ │                                    │  │
│ │ ❌ You will lose -50 karma        │  │
│ │ 💰 Payment returned to wallet     │  │
│ │ 🚫 All applications invalidated   │  │
│ │ ⏰ Cannot repost for 24 hours     │  │
│ └────────────────────────────────────┘  │
│                                          │
│ Note: You can cancel up to 10 jobs      │
│ per week. Excessive cancellations       │
│ may affect your reputation.              │
│                                          │
│         [Keep Job]    [Cancel Job]       │
└──────────────────────────────────────────┘

Colors:
- Header Icon: #EF4444 (red)
- Consequences Box: #FEF2F2 (light red) bg
- Consequences Border: #FEE2E2 (red)
- Warning Box: #FFF4E6 (light orange) bg
- Cancel Button: #EF4444 (red) bg
```

---

## 💎 Karma System Integration

### Karma Penalties

#### Cancel Job Penalty
```typescript
Base Penalty: -50 karma
With Tier Multiplier:
- Small holder (1x): -50 karma
- Holder (3x): -150 karma
- Whale (5.5x): -275 karma
- Mega (7x): -350 karma

Purpose: Discourages frivolous cancellations
Application: Immediate upon cancellation
```

### Karma Tracking

```typescript
// Current implementation (TODO in Sprint 2.3)
async function applyCancellationPenalty(
  walletAddress: string,
  projectId: string,
  tierMultiplier: number
) {
  const penalty = -50 * tierMultiplier
  
  await supabase
    .from('wallet_karma')
    .update({
      total_karma_points: supabase.raw(`total_karma_points + ${penalty}`),
      jobs_cancelled_count: supabase.raw('jobs_cancelled_count + 1')
    })
    .eq('wallet_address', walletAddress)
    .eq('project_id', projectId)
}
```

---

## 🔐 Security & Validation

### Edit Job Validations

1. **Ownership Check**
   ```typescript
   if (job.poster_wallet !== publicKey.toString()) {
     toast.error('Only the job poster can edit this job')
     return
   }
   ```

2. **Status Check**
   ```typescript
   if (job.status === 'completed' || job.status === 'cancelled') {
     toast.error('Cannot edit completed or cancelled jobs')
     return
   }
   ```

3. **Application Acknowledgment** (if applications exist)
   ```typescript
   if (applicationCount > 0 && !understoodInvalidation) {
     toast.error('Please confirm you understand applications will be invalidated')
     return
   }
   ```

### Cancel Job Validations

1. **Ownership Check**
   ```typescript
   if (job.poster_wallet !== publicKey.toString()) {
     toast.error('Only the job poster can cancel this job')
     return
   }
   ```

2. **Status Check**
   ```typescript
   const cancellableStatuses = ['open', 'assigned']
   if (!cancellableStatuses.includes(job.status)) {
     toast.error('Cannot cancel jobs in this status')
     return
   }
   ```

3. **Weekly Limit Check**
   ```typescript
   const { count } = await supabase
     .from('jobs')
     .select('id', { count: 'exact', head: true })
     .eq('poster_wallet', walletAddress)
     .eq('status', 'cancelled')
     .gte('cancelled_at', sevenDaysAgo)

   if (count >= 10) {
     toast.error("You've cancelled 10 jobs this week. Try again next week.")
     return
   }
   ```

---

## 📊 Application Invalidation

### What Happens to Invalidated Applications

#### Database State
```typescript
Before Edit/Cancel:
{
  id: 'app-123',
  job_id: 'job-456',
  applicant_wallet: '4x3y...2a1b',
  is_invalidated: false,
  pitch: 'My application...',
  // ...other fields
}

After Edit/Cancel:
{
  id: 'app-123',
  job_id: 'job-456',
  applicant_wallet: '4x3y...2a1b',
  is_invalidated: true, // ← Changed
  pitch: 'My application...',
  // ...other fields
}
```

#### UI Display

**Before Invalidation:**
```
┌────────────────────────────────────────┐
│ 4x3y...2a1b 📋   [Pick This Applicant]│
│                                        │
│ Karma: 1,250  Completed: 5            │
│ Estimated: 3 days                      │
│                                        │
│ Application pitch...                   │
└────────────────────────────────────────┘

Border: gray
Background: white
Opacity: 1.0
```

**After Invalidation:**
```
┌────────────────────────────────────────┐
│ 4x3y...2a1b 📋   [Invalidated - Edited]│
│                                        │
│ Karma: 1,250  Completed: 5            │
│ Estimated: 3 days                      │
│                                        │
│ Application pitch...                   │
└────────────────────────────────────────┘

Border: gray
Background: gray-100
Opacity: 0.6
No "Pick" button
```

### Applicant Experience

1. **Notification** (Sprint 2.3)
   - Toast/push notification: "Job 'Design Landing Page' was edited. Your application was invalidated."
   - Shows in notifications center
   - Links back to job detail

2. **Can Reapply**
   - Job still shows in job list
   - "Apply for This Job" button reappears
   - Can submit new application
   - Old application remains visible (for record-keeping)

3. **No Karma Loss**
   - Applicants don't lose karma when invalidated
   - Only immediate karma was already earned
   - Delayed karma wasn't awarded yet

---

## 🚀 Deployment Checklist

### Database
- [x] `is_invalidated` field exists in job_applications
- [x] `cancelled_at` field exists in jobs
- [x] Proper indexes on frequently queried fields
- [ ] Create job_cancellations table (optional, future)

### Backend
- [x] Edit job logic in CreateJobModal
- [x] Cancel job logic in job detail page
- [x] Cancellation limit query
- [x] Application invalidation logic
- [ ] Karma penalty application (Sprint 2.3)
- [ ] Token return from escrow (Phase 2)

### Frontend
- [x] Edit mode UI in CreateJobModal
- [x] Warning alert for applications
- [x] Confirmation checkbox
- [x] Cancel confirmation dialog
- [x] Disabled payment field in edit mode
- [x] Proper button text ("Update Job" vs "Post Job")
- [x] Loading states
- [x] Error handling

### Notifications
- [ ] Notify applicants when job edited (Sprint 2.3)
- [ ] Notify applicants when job cancelled (Sprint 2.3)
- [ ] Email notifications (Phase 3)

---

## 📱 Responsive Design

### Mobile (<640px)
- Warning alert: Full width, larger touch targets
- Checkbox: Larger hit area
- Buttons: Stacked vertically
- Dialog: Full-screen modal on small screens

### Tablet (640px - 1024px)
- Warning alert: Slightly condensed
- Buttons: Side by side (50/50)
- Dialog: Medium width (500px)

### Desktop (>1024px)
- Warning alert: Full layout
- Buttons: Optimal spacing
- Dialog: Large width (600px)
- Hover effects active

---

## ✅ Testing Checklist

### Edit Job Tests

#### Without Applications
- [ ] Edit button visible to poster
- [ ] Edit button not visible to others
- [ ] Modal opens with pre-filled data
- [ ] Payment field is disabled
- [ ] Can change title, description, KPIs, category
- [ ] No warning alert shown
- [ ] No checkbox shown
- [ ] "Update Job" button works
- [ ] Job updates successfully
- [ ] Toast shows success message
- [ ] Page refreshes with new data

#### With Applications
- [ ] Warning alert appears
- [ ] Shows correct application count
- [ ] Confirmation checkbox appears
- [ ] Submit disabled without checkbox
- [ ] Can check checkbox
- [ ] Submit enabled after checkbox
- [ ] All applications get invalidated
- [ ] Applications show "Invalidated" badge
- [ ] Applications greyed out
- [ ] Toast shows invalidation count
- [ ] Applicants can reapply

### Cancel Job Tests

#### Basic Flow
- [ ] Cancel button visible to poster
- [ ] Cancel button not visible to others
- [ ] Confirmation dialog appears
- [ ] Shows all consequences
- [ ] "Keep Job" button closes dialog
- [ ] "Cancel Job" button triggers cancellation
- [ ] Job status changes to 'cancelled'
- [ ] cancelled_at timestamp set
- [ ] Applications invalidated
- [ ] Success toast appears
- [ ] Page refreshes

#### Limit Tests
- [ ] Can cancel up to 10 jobs per week
- [ ] 11th cancellation shows error
- [ ] Error message clear and helpful
- [ ] Limit resets after 7 days
- [ ] Limit per wallet (not per project)

#### Edge Cases
- [ ] Cannot cancel completed job
- [ ] Cannot cancel disputed job
- [ ] Cannot cancel already cancelled job
- [ ] Cannot edit cancelled job
- [ ] Loading states work correctly
- [ ] Error handling works

---

## 🐛 Known Issues / TODOs

### High Priority (Sprint 2.3)
1. **Karma Penalty Not Applied**
   - TODO: Implement `applyCancellationPenalty()` function
   - Connect to karma system
   - Update wallet_karma table

2. **Notifications Missing**
   - TODO: Send notifications to applicants when job edited
   - TODO: Send notifications to applicants when job cancelled
   - TODO: Email notifications

3. **Escrow Return**
   - TODO: Return tokens from escrow when job cancelled
   - Requires Phase 2 on-chain escrow implementation

### Medium Priority
4. **24-Hour Repost Restriction**
   - TODO: Track job cancellations with title/description hash
   - TODO: Block reposts of "same" job within 24 hours
   - Need fuzzy matching algorithm

5. **Cancellation Reason**
   - Enhancement: Allow poster to provide cancellation reason
   - Store in database for analytics
   - Show to applicants

6. **Reputation Impact**
   - Enhancement: Track cancellation history on profile
   - Show "Reliability Score" based on cancellations
   - Warn other users about frequent cancellers

### Low Priority
7. **Undo Cancellation**
   - Enhancement: Allow "undo" within 5 minutes
   - Revert status, restore applications
   - Refund karma penalty

8. **Partial Edits**
   - Enhancement: Only invalidate applications if critical fields changed
   - Track which fields changed
   - Smarter invalidation logic

---

## 📚 Related Documentation

- [Job System Complete Summary](./JOB_SYSTEM_COMPLETE_SUMMARY.md)
- [Job Assignment Feature](./JOB_ASSIGNMENT_FEATURE_COMPLETE.md)
- [Work Submission Feature](./WORK_SUBMISSION_FEATURE_COMPLETE.md)
- [Karma System](./lib/karma.ts)

---

## 🎓 Usage Examples

### For Developers

#### Opening Edit Modal
```typescript
import { CreateJobModal } from '@/components/CreateJobModal'

// In job detail page
const [showEditModal, setShowEditModal] = useState(false)

<Button onClick={() => setShowEditModal(true)}>
  Edit Job
</Button>

<CreateJobModal
  isOpen={showEditModal}
  onClose={() => setShowEditModal(false)}
  mode="edit"
  existingJob={job}
  projectId={project.id}
  tokenMint={project.token_mint}
  tokenSymbol={project.token_symbol}
  walletAddress={publicKey.toString()}
  onJobCreated={() => {
    fetchJobData() // Refresh
  }}
/>
```

#### Checking Cancellation Limit
```typescript
const checkCancellationLimit = async (walletAddress: string) => {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { count, error } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('poster_wallet', walletAddress)
    .eq('status', 'cancelled')
    .gte('cancelled_at', sevenDaysAgo.toISOString())

  if (error) throw error
  
  return {
    count: count || 0,
    canCancel: (count || 0) < 10
  }
}
```

---

## 📊 Feature Status

| Component | Status | Sprint |
|-----------|--------|--------|
| Edit Mode UI | ✅ Complete | 2.2 |
| Application Warning | ✅ Complete | 2.2 |
| Confirmation Checkbox | ✅ Complete | 2.2 |
| Payment Field Disable | ✅ Complete | 2.2 |
| Cancel Dialog | ✅ Complete | 2.2 |
| Cancellation Limit | ✅ Complete | 2.2 |
| Application Invalidation | ✅ Complete | 2.2 |
| Karma Penalty | ⏳ Pending | 2.3 |
| Notifications | ⏳ Pending | 2.3 |
| Escrow Return | ⏳ Pending | Phase 2 |
| 24hr Repost Block | ⏳ Pending | 2.4 |

---

**Status:** ✅ **CORE FEATURES COMPLETE**

**Created:** November 25, 2025  
**Features:** Edit Job, Cancel Job  
**Sprint:** 2.2 (Job Management)

---

Built with ❤️ for flexible, fair job management! ✏️🚫



