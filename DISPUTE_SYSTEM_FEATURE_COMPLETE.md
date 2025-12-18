# ⚖️ Job Dispute System - Complete Documentation

**Community-driven dispute resolution for job submissions with token-weighted voting**

---

## 📋 Overview

The dispute system allows either the job poster or worker to open a dispute when they disagree about whether submitted work meets the specified KPIs. The community then votes using token-weighted voting to decide whether payment should be released to the worker or refunded to the poster.

---

## 🎯 Features Implemented

### 1. **Open Dispute Modal** ✅
📄 `components/OpenDisputeModal.tsx`

**Modal Components:**

#### Who's Opening (Auto-Detected)
- Read-only display showing user's role
- Chip badge: "Poster" (purple) or "Worker" (blue)
- Contextual explanation of dispute perspective

#### Dispute Reason Field
- TextField multiline, 6 rows
- Max 1000 characters
- Character counter
- Required field
- Context-specific placeholders:
  - **Poster:** "Explain how the submitted work fails to meet the KPIs you specified..."
  - **Worker:** "Explain why the poster's rejection is unreasonable..."

#### Review KPIs (Reference)
- Shows original KPIs from job posting
- Read-only, grey background box
- Help text: "The community will vote based on these success criteria"
- Allows both parties to reference agreed criteria

#### Review Submission (Summary)
- Shows truncated submission message (150 chars)
- Link to view full submission details
- Click navigates back to job detail page

#### Dispute Process Information
- Blue informational box
- Explains complete voting process:
  - ✓ Community voting begins immediately
  - ⏱️ Voting lasts 14 days
  - ⚖️ Token-weighted votes decide outcome
  - 📦 If >50% vote to release: Worker gets payment
  - 💰 If >50% vote to refund: Poster gets refund
  - 🏆 All voters earn karma for participating

#### Warning Box
- Orange background
- Warns about public nature of disputes
- Cautions about reputation impact
- Encourages communication first

---

## 🗄️ Database Schema

### job_disputes Table

```sql
CREATE TABLE job_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) NOT NULL,
  opened_by TEXT NOT NULL, -- 'poster' or 'worker'
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- 'active' or 'resolved'
  outcome TEXT, -- 'release_to_worker', 'refund_to_poster', or NULL
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ, -- Voting deadline (14 days from created_at)
  resolved_at TIMESTAMPTZ
);
```

### jobs Table Update

```sql
-- Job status includes 'disputed'
status TEXT CHECK (status IN (
  'open', 'assigned', 'submitted', 
  'completed', 'disputed', 'cancelled'
))
```

---

## 🔄 Dispute Flow

### Opening a Dispute

```
Job status = 'submitted'
  ↓
Poster clicks "Open Dispute" (OR Worker clicks in edge case)
  ↓
OpenDisputeModal appears
  ↓
User sees:
  - Their role (Poster/Worker)
  - KPIs for reference
  - Submission summary
  - Dispute process explanation
  - Warning about public disputes
  ↓
User enters dispute reason (max 1000 chars)
  ↓
User clicks "Open Dispute"
  ↓
System creates dispute record:
  - job_id
  - opened_by ('poster' or 'worker')
  - reason
  - ends_at = NOW() + 14 days
  ↓
System updates job:
  - status = 'disputed'
  - updated_at = NOW()
  ↓
Success toast: "Dispute opened. Community voting begins now. ⚖️"
  ↓
Notification sent to other party (TODO Sprint 2.3)
  ↓
Modal closes
  ↓
Job detail page refreshes
  ↓
Job shows 'disputed' status
```

---

## 🎨 UI Design Specifications

### Modal Layout

```
┌────────────────────────────────────────────────┐
│ ⚖️ Open Dispute                                │
├────────────────────────────────────────────────┤
│                                                │
│ YOU ARE: [Poster] (purple chip)                │
│ As the job poster, you're disputing...         │
│                                                │
│ ─────────────────────────────────────────────  │
│                                                │
│ Dispute Reason *                               │
│ ┌────────────────────────────────────────────┐ │
│ │ Explain how the submitted work fails...   │ │
│ │ [6 rows of text]                          │ │
│ │                                           │ │
│ └────────────────────────────────────────────┘ │
│ 234 / 1000 characters                          │
│                                                │
│ ─────────────────────────────────────────────  │
│                                                │
│ ORIGINAL KPIs (FOR REFERENCE)                  │
│ ┌────────────────────────────────────────────┐ │
│ │ Original KPIs text here...                │ │
│ └────────────────────────────────────────────┘ │
│ 💡 Community will vote based on these          │
│                                                │
│ ─────────────────────────────────────────────  │
│                                                │
│ SUBMITTED WORK                                 │
│ ┌────────────────────────────────────────────┐ │
│ │ Submission message preview...             │ │
│ │ View submission details ↗                 │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ ─────────────────────────────────────────────  │
│                                                │
│ ℹ️ HOW DISPUTES WORK:                         │
│ • Community voting begins immediately          │
│ • Voting lasts 14 days                         │
│ • Token-weighted votes decide outcome          │
│ • If >50% vote to release: Worker gets $       │
│ • If >50% vote to refund: Poster gets refund   │
│ • All voters earn karma                        │
│                                                │
│ ⚠️ IMPORTANT:                                  │
│ • Disputes are public                          │
│ • False disputes may hurt reputation           │
│ • Consider communicating first                 │
│                                                │
│         [Cancel]    [⚖️ Open Dispute]          │
└────────────────────────────────────────────────┘

Colors:
- Title: #1A1A1E (black)
- Role Badge (Poster): #EEE7FF bg, #7C4DFF text
- Role Badge (Worker): #E8F4FF bg, #2563EB text
- Info Box: #EEF2FF bg, #4F46E5 icon
- Warning Box: #FFF4E6 bg, #FB923C icon
- Submit Button: #EF4444 (red) bg
```

---

## 💻 Implementation Details

### Props Interface

```typescript
interface OpenDisputeModalProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  openedBy: 'poster' | 'worker'
  jobKpis: string
  submissionSummary: string
  onDisputeOpened?: () => void
}
```

### Validation Rules

```typescript
const validateForm = () => {
  // Reason is required
  if (!reason.trim()) {
    return false
  }
  
  // Max 1000 characters
  if (reason.length > 1000) {
    return false
  }
  
  return true
}
```

### Database Operations

```typescript
// Create dispute
const { error } = await supabase
  .from('job_disputes')
  .insert({
    job_id: jobId,
    opened_by: openedBy,
    reason: reason.trim(),
    ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
  })

// Update job status
await supabase
  .from('jobs')
  .update({
    status: 'disputed',
    updated_at: new Date().toISOString()
  })
  .eq('id', jobId)
```

---

## 🔐 Security & Validation

### Who Can Open Disputes

1. **Poster:**
   - Can open dispute on 'submitted' jobs
   - Must be the job poster (wallet check)
   - Reason: Work doesn't meet KPIs

2. **Worker:**
   - Can open dispute on 'submitted' jobs (edge case)
   - Must be the assigned worker (wallet check)
   - Reason: Poster rejection is unreasonable

### Access Control

```typescript
// In job detail page
const isPoster = publicKey?.toString() === job.poster_wallet
const isWorker = publicKey?.toString() === job.assigned_to

// Only show "Open Dispute" button if:
const canOpenDispute = 
  job.status === 'submitted' && 
  submission && 
  (isPoster || isWorker)
```

### Input Validation

- Reason must not be empty
- Reason max 1000 characters
- Wallet must be connected
- User must be poster or worker
- Job must be in 'submitted' status

---

## 📱 Responsive Design

### Mobile (<640px)
- Full-width modal
- Stacked information boxes
- Larger touch targets
- Buttons full-width and stacked
- Smaller font sizes

### Tablet (640px - 1024px)
- Medium-width modal (600px)
- Side-by-side buttons
- Comfortable spacing

### Desktop (>1024px)
- Optimal modal width (700px)
- Side-by-side buttons
- Best readability
- Hover effects

---

## 🚀 Integration with Job Detail Page

### Button Placement

Located in "Submitted Work" section, visible only to poster:

```jsx
{/* Poster Actions */}
{isPoster && (
  <div className="flex gap-3">
    <Button onClick={handleReleasePayment}>
      Release Payment
    </Button>
    <Button onClick={handleOpenDispute}>
      Open Dispute
    </Button>
  </div>
)}
```

### Modal Integration

```jsx
{job && submission && publicKey && (
  <OpenDisputeModal
    isOpen={showDisputeModal}
    onClose={() => setShowDisputeModal(false)}
    jobId={job.id}
    openedBy={isPoster ? 'poster' : 'worker'}
    jobKpis={job.kpis}
    submissionSummary={submission.message}
    onDisputeOpened={() => {
      fetchJobData() // Refresh to show dispute status
    }}
  />
)}
```

---

## ✅ Testing Checklist

### Modal Display
- [ ] Modal opens when "Open Dispute" clicked
- [ ] Correct role badge shown (Poster/Worker)
- [ ] Role-specific description displays
- [ ] KPIs show correctly
- [ ] Submission summary truncates at 150 chars
- [ ] Dispute process info displays
- [ ] Warning box shows
- [ ] Modal closes on Cancel
- [ ] Modal closes on backdrop click (if not loading)

### Form Validation
- [ ] Empty reason shows error
- [ ] Character counter updates in real-time
- [ ] Max 1000 characters enforced
- [ ] Submit button disabled when invalid
- [ ] Error clears when typing

### Submission
- [ ] Creates dispute record in database
- [ ] Sets correct opened_by value
- [ ] Sets ends_at to 14 days from now
- [ ] Updates job status to 'disputed'
- [ ] Shows success toast
- [ ] Closes modal on success
- [ ] Refreshes job detail page
- [ ] Shows error on failure

### Access Control
- [ ] Button only shows for poster/worker
- [ ] Button only shows on submitted jobs
- [ ] Wallet connection required
- [ ] Correct openedBy passed to modal

### Edge Cases
- [ ] Works for poster opening dispute
- [ ] Works for worker opening dispute
- [ ] Handles network errors gracefully
- [ ] Handles database errors
- [ ] Loading state prevents double-submit

---

## 🐛 Known Issues / TODOs

### High Priority (Sprint 2.3)
1. **Notifications**
   - TODO: Send notification to other party when dispute opened
   - TODO: Email notification
   - TODO: In-app notification badge

2. **Dispute Detail Page**
   - TODO: Create `/disputes/[id]` page
   - TODO: Show dispute reason
   - TODO: Show voting interface
   - TODO: Show current vote count

3. **Voting System**
   - TODO: Implement token-weighted voting
   - TODO: Create dispute_votes table
   - TODO: Calculate vote percentages
   - TODO: Auto-resolve after 14 days

4. **Karma Distribution**
   - TODO: Award karma to voters
   - TODO: Calculate karma based on vote weight
   - TODO: Distribute on resolution

### Medium Priority (Sprint 2.4)
5. **Dispute History**
   - TODO: Show past disputes on profile
   - TODO: Track dispute win/loss rate
   - TODO: Reputation score based on disputes

6. **Communication**
   - TODO: Allow comments/rebuttals
   - TODO: Evidence upload
   - TODO: Mediator assignment (high-value disputes)

### Low Priority (Future)
7. **Analytics**
   - TODO: Dispute statistics dashboard
   - TODO: Common dispute reasons
   - TODO: Resolution time analytics

8. **Improvements**
   - TODO: Dispute templates
   - TODO: Suggested resolutions
   - TODO: Automatic evidence collection

---

## 📊 Dispute Statistics (Future)

### User Reputation Metrics
- Disputes opened (as poster/worker)
- Dispute win rate
- Average dispute resolution time
- Community trust score

### Platform Metrics
- Total disputes opened
- Average resolution time
- Dispute outcome breakdown
- Most common dispute reasons

---

## 🎓 Usage Examples

### Opening a Dispute (Poster)

```typescript
// User clicks "Open Dispute" on submitted work
<Button onClick={handleOpenDispute}>
  Open Dispute
</Button>

// Modal opens with poster context
<OpenDisputeModal
  isOpen={true}
  onClose={() => setShowDisputeModal(false)}
  jobId="job-123"
  openedBy="poster"
  jobKpis="Original KPIs text..."
  submissionSummary="Worker's submission message..."
  onDisputeOpened={() => {
    // Refresh job data to show 'disputed' status
    fetchJobData()
  }}
/>

// User enters reason
"The submitted design doesn't include the mobile responsive 
version as specified in the KPIs. Only desktop version was 
provided. The color scheme also doesn't match our brand 
guidelines (blue instead of purple)."

// User clicks "Open Dispute"
// System creates dispute and updates job status
```

### Opening a Dispute (Worker - Edge Case)

```typescript
// Worker feels poster rejection is unreasonable
<OpenDisputeModal
  isOpen={true}
  onClose={() => setShowDisputeModal(false)}
  jobId="job-456"
  openedBy="worker"
  jobKpis="Original KPIs text..."
  submissionSummary="My submission message..."
  onDisputeOpened={() => {
    fetchJobData()
  }}
/>

// Worker enters reason
"I delivered exactly what was specified in the KPIs. All 
3 design variations were included, and I provided source 
files in both Figma and Sketch as requested. The poster 
is not responding to my messages asking for clarification."

// Opens dispute for community review
```

---

## 📚 Related Documentation

- [Job System Complete Summary](./JOB_SYSTEM_COMPLETE_SUMMARY.md)
- [Work Submission Feature](./WORK_SUBMISSION_FEATURE_COMPLETE.md)
- [Community Curation Setup](./COMMUNITY_CURATION_SETUP.md) (for voting system)

---

## 🔮 Future Enhancements

### Phase 1 (Sprint 2.3)
- Voting interface on dispute detail page
- Token-weighted vote calculation
- Automatic resolution after 14 days
- Karma distribution to voters

### Phase 2 (Sprint 2.4)
- Dispute comments/discussion
- Evidence upload (images, files)
- Mediator assignment for high-value disputes
- Dispute templates

### Phase 3 (Sprint 3.x)
- Reputation system integration
- Dispute analytics dashboard
- Automatic evidence collection
- AI-assisted resolution suggestions

### Phase 4 (Future)
- Escrow integration (automatic payment/refund)
- Multi-stage dispute process
- Appeal system
- Professional mediators

---

## 📊 Feature Status

| Component | Status | File |
|-----------|--------|------|
| Open Dispute Modal | ✅ Complete | `components/OpenDisputeModal.tsx` |
| Modal Integration | ✅ Complete | `app/project/[id]/jobs/[jobId]/page.tsx` |
| Database Schema | ✅ Complete | `types/database.ts` |
| Dispute Creation | ✅ Complete | Modal submit handler |
| Job Status Update | ✅ Complete | Updates to 'disputed' |
| Voting System | ⏳ Pending | Sprint 2.3 |
| Dispute Resolution | ⏳ Pending | Sprint 2.3 |
| Notifications | ⏳ Pending | Sprint 2.3 |
| Karma Distribution | ⏳ Pending | Sprint 2.3 |

---

**Status:** ✅ **DISPUTE OPENING COMPLETE**  
**Voting System:** ⏳ Sprint 2.3

**Created:** November 25, 2025  
**Feature:** Dispute Opening & Modal  
**Sprint:** 2.2 (Job Management)

---

**Files Created:** 1  
**Files Modified:** 1  
**Lines Added:** ~350  
**Linter Errors:** 0  

Built with ❤️ for fair, community-driven dispute resolution! ⚖️













