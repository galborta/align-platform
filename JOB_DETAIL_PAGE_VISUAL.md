# Job Detail Page - Visual Guide 🎨

## Page Layout Preview

```
┌─────────────────────────────────────────────────────────────┐
│                        App Header                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ← Jobs                                              [BUTTON] │
└─────────────────────────────────────────────────────────────┘

┌────────────────────────────────────┬──────────────────────┐
│ LEFT COLUMN (2/3)                  │ RIGHT COLUMN (1/3)   │
│                                    │                      │
│ ┌────────────────────────────────┐ │ ┌──────────────────┐ │
│ │ JOB HEADER CARD                │ │ │ PAYMENT CARD     │ │
│ │ ● Open                         │ │ │ [Lime border]    │ │
│ │                                │ │ │                  │ │
│ │ Design New Logo                │ │ │ 500 NUB          │ │
│ │ [Space Grotesk, 4xl, bold]     │ │ │ ($50 USD)        │ │
│ │                                │ │ │                  │ │
│ │ Posted by: Ab12...Xy89 📋      │ │ │ 🔒 Locked in     │ │
│ │ Builder (7 jobs)               │ │ │    escrow        │ │
│ │                                │ │ └──────────────────┘ │
│ │ Posted: 2 hours ago            │ │                      │
│ │ Last updated: 1 hour ago       │ │ ┌──────────────────┐ │
│ └────────────────────────────────┘ │ │ ACTIONS CARD     │ │
│                                    │ │                  │ │
│ ┌────────────────────────────────┐ │ │ [Apply Button]   │ │
│ │ JOB DETAILS CARD               │ │ │ [Purple, big]    │ │
│ │                                │ │ │                  │ │
│ │ [Design Chip]                  │ │ │ ✨ +50 karma     │ │
│ │                                │ │ └──────────────────┘ │
│ │ Description                    │ │                      │
│ │ We need a modern logo for...  │ │                      │
│ │                                │ │                      │
│ │ Success Criteria (KPIs)        │ │                      │
│ │ - High resolution              │ │                      │
│ │ - Multiple formats             │ │                      │
│ │                                │ │                      │
│ │ 🔍 Reviewing Applications      │ │                      │
│ └────────────────────────────────┘ │                      │
│                                    │                      │
│ [Assigned Worker Card if needed]   │                      │
└────────────────────────────────────┴──────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ APPLICATIONS SECTION                                         │
│                                                              │
│ Applications                                                 │
│                                                              │
│ Application display coming in Sprint 2.2! 🚀                │
└─────────────────────────────────────────────────────────────┘
```

---

## Section Breakdowns

### 1. Job Header Card

```
┌──────────────────────────────────────────────────────┐
│  ● Open                                              │
│                                                      │
│  Design New Logo for NUB Token                      │
│  [32px, Space Grotesk, Bold, #1A1A1E]              │
│                                                      │
│  Posted by: Ab12...Xy89 📋   Builder (7 jobs)       │
│  [Shortened wallet] [Copy]    [Blue badge]          │
│                                                      │
│  Posted: 2 hours ago                                │
│  Last updated: 1 hour ago                           │
│  [Gray text, #A3A7B5]                               │
└──────────────────────────────────────────────────────┘
```

**Status Badge Examples:**
- ● **Open** (Green)
- ● **Assigned** (Yellow)
- ● **Work Submitted** (Purple)
- ● **Completed** (Gray)
- ● **In Dispute** (Red)
- ● **Cancelled** (Light Gray)

---

### 2. Payment Card (Lime Border!)

```
┌═══════════════════════════════════════════════════════╗
║  [4px Lime Border #E3F06F]                           ║
║                                                       ║
║  PAYMENT                                             ║
║                                                       ║
║  500 NUB                                             ║
║  [3xl, Bold, Purple #7C4DFF]                         ║
║                                                       ║
║  ($50 USD at posting)                                ║
║  [lg, Gray #6F7280]                                  ║
║                                                       ║
║  ┌─────────────────────────────────────────────┐    ║
║  │ 🔒 Note: Locked in escrow — released on    │    ║
║  │    completion                                │    ║
║  │ [Orange background #FFF4E6]                  │    ║
║  └─────────────────────────────────────────────┘    ║
╚═══════════════════════════════════════════════════════╝
```

---

### 3. Job Details Card

```
┌──────────────────────────────────────────────────────┐
│  [Design]                                            │
│  [Purple chip badge]                                 │
│                                                      │
│  Description                                         │
│  [Bold header]                                       │
│                                                      │
│  We need a modern logo for our token project.       │
│  Should be clean, professional, and memorable.       │
│  Must work on both light and dark backgrounds.       │
│  [Preserved line breaks, 1.7 line height]           │
│                                                      │
│  Success Criteria (KPIs)                            │
│  [Bold header]                                       │
│                                                      │
│  - High resolution PNG and SVG formats              │
│  - Multiple color variations                        │
│  - Must include brand colors (#7C4DFF)              │
│  - 3 concept variations to choose from              │
│  [Preserved formatting]                              │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │ 🔍 Reviewing Applications                  │    │
│  │ — Poster will review all applications and  │    │
│  │   choose the best candidate                │    │
│  │ [Light gray background #F8F9FC]            │    │
│  └────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**Category Colors:**
- 🎨 Design (Purple)
- 📢 Marketing (Green)
- 💻 Development (Blue)
- ✍️ Content (Orange)
- 👥 Community (Pink)
- 📦 Other (Gray)

---

### 4. Actions Card - All Variants

#### **Variant A: Can Apply (Not Poster, Job Open)**
```
┌──────────────────────────────┐
│  ACTIONS                     │
│                              │
│  ┌────────────────────────┐ │
│  │ Apply for This Job     │ │
│  │ [Purple, Large, Bold]  │ │
│  └────────────────────────┘ │
│                              │
│  ✨ You'll earn +50 karma   │
│     for applying             │
│  [Green text #36C170]        │
└──────────────────────────────┘
```

#### **Variant B: Is Poster (Can Edit/Cancel)**
```
┌──────────────────────────────┐
│  ACTIONS                     │
│                              │
│  [ Edit Job ]                │
│  [Outline button]            │
│                              │
│  [ Cancel Job ]              │
│  [Red outline #EF4444]       │
└──────────────────────────────┘
```

#### **Variant C: Assigned Worker (Can Submit)**
```
┌──────────────────────────────┐
│  ACTIONS                     │
│                              │
│  ┌────────────────────────┐ │
│  │ Submit Work            │ │
│  │ [Purple, Large]        │ │
│  └────────────────────────┘ │
└──────────────────────────────┘
```

#### **Variant D: Work Submitted (Waiting)**
```
┌──────────────────────────────┐
│  ACTIONS                     │
│                              │
│  ┌────────────────────────┐ │
│  │ Work Submitted         │ │
│  │                        │ │
│  │ Waiting for poster to  │ │
│  │ review                 │ │
│  │ [Purple bg #EEE7FF]    │ │
│  └────────────────────────┘ │
└──────────────────────────────┘
```

#### **Variant E: Not Logged In**
```
┌──────────────────────────────┐
│  ACTIONS                     │
│                              │
│  ┌────────────────────────┐ │
│  │ Connect your wallet to │ │
│  │ apply for this job     │ │
│  │ [Gray bg #F8F9FC]      │ │
│  └────────────────────────┘ │
└──────────────────────────────┘
```

#### **Variant F: Completed**
```
┌──────────────────────────────┐
│  ACTIONS                     │
│                              │
│  ┌────────────────────────┐ │
│  │ ✓ Completed            │ │
│  │                        │ │
│  │ This job has been      │ │
│  │ completed              │ │
│  │ [Green bg #E3F8ED]     │ │
│  └────────────────────────┘ │
└──────────────────────────────┘
```

---

### 5. Assigned Worker Card (Conditional)

**Shows only when job.status === 'assigned' and job.assigned_to exists**

```
┌──────────────────────────────────────────────────────┐
│  Assigned Worker                                     │
│  [Bold header]                                       │
│                                                      │
│  Ab12...Xy89  📋                                     │
│  [Shortened]  [Copy button]                         │
│                                                      │
│  Assigned 3 hours ago                               │
│  [Gray text]                                         │
└──────────────────────────────────────────────────────┘
```

---

### 6. Applications Section (Placeholder)

```
┌──────────────────────────────────────────────────────┐
│  Applications                                        │
│  [2xl, Space Grotesk, Bold]                         │
│                                                      │
│                                                      │
│         Application display coming in                │
│              Sprint 2.2! 🚀                          │
│                                                      │
│  [Center aligned, gray text]                         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Color Palette Reference

### Primary Colors
- **Purple** (#7C4DFF) - Primary actions, payment amount
- **Lime** (#E3F06F) - Background, payment card border
- **Green** (#36C170) - Success, open status
- **Yellow** (#FFC857) - Assigned status
- **Red** (#EF4444) - Disputed/cancelled status

### Text Colors
- **Primary** (#1A1A1E) - Headings, important text
- **Secondary** (#6F7280) - Labels, descriptions
- **Muted** (#A3A7B5) - Timestamps, helper text

### Background Colors
- **Lime** (#E3F06F) - Page background
- **White** (#FFFFFF) - Card backgrounds
- **Light Purple** (#EEE7FF) - Purple info boxes
- **Light Green** (#E3F8ED) - Success boxes
- **Light Orange** (#FFF4E6) - Warning/note boxes
- **Light Gray** (#F8F9FC) - Neutral info boxes

---

## Interactive States

### Hover Effects
```
Button hover:
- Background darkens slightly
- Cursor changes to pointer
- Smooth transition (150ms)

Copy button hover:
- Color changes to purple
- Tooltip appears
```

### Click Feedback
```
Copy address:
1. Click icon
2. Toast appears: "Address copied!"
3. Tooltip changes to "Copied!"
4. Resets after 2 seconds
```

---

## Responsive Breakpoints

### Desktop (≥1024px)
```
┌─────────────────────────┬──────────┐
│ Main Content (66%)      │ Sidebar  │
│                         │ (33%)    │
└─────────────────────────┴──────────┘
```

### Tablet/Mobile (<1024px)
```
┌──────────────────────────────────┐
│ Payment Card                     │
├──────────────────────────────────┤
│ Actions Card                     │
├──────────────────────────────────┤
│ Job Header                       │
├──────────────────────────────────┤
│ Job Details                      │
├──────────────────────────────────┤
│ Assigned Worker (if applicable)  │
├──────────────────────────────────┤
│ Applications                     │
└──────────────────────────────────┘
```

---

## User Flow Examples

### Flow 1: Worker Viewing Open Job
```
1. Navigate from jobs listing
2. See job header with status "● Open"
3. Review payment amount in sidebar
4. Read full description and KPIs
5. See "Apply for This Job" button
6. Click apply → (Sprint 2.2: Application form)
```

### Flow 2: Poster Viewing Their Job
```
1. Navigate from jobs listing
2. See job header with "Builder (X jobs)" badge
3. Review all job details
4. See "Edit Job" and "Cancel Job" buttons
5. Scroll to applications section (Sprint 2.2)
6. Review and assign to best applicant
```

### Flow 3: Worker Viewing Assigned Job
```
1. Navigate from "My Applications" tab
2. See status "● Assigned"
3. See their wallet in "Assigned Worker" card
4. Review job requirements again
5. See "Submit Work" button
6. Click submit → (Sprint 2.2: Submission form)
```

---

## Keyboard Navigation

```
Tab order:
1. Back button
2. Copy poster address
3. Copy assigned worker address (if shown)
4. Primary action button (Apply/Submit/Edit)
5. Secondary action button (Cancel, if shown)
```

---

## Toast Notifications

### Success (Green)
```
✓ Address copied!
```

### Info (Blue)
```
🚀 Application form coming in Sprint 2.2!
✏️ Edit job coming soon!
❌ Cancel job coming soon!
📤 Submit work coming soon!
```

---

## Edge Cases Handled

1. **No wallet connected**: Shows connect message
2. **Job not found**: Error state with back button
3. **Loading**: Centered spinner
4. **Missing project**: Graceful error
5. **Poster viewing own job**: Edit/cancel actions
6. **Worker viewing assigned job**: Submit work action
7. **Completed/cancelled jobs**: Info-only state
8. **Same created/updated time**: Only shows "Posted"
9. **No assigned worker**: Card hidden
10. **Zero job count**: Badge hidden

---

## What's Coming in Sprint 2.2

### Applications Display
```
┌──────────────────────────────────────────────────────┐
│  Applications (12)                    [Sort ▼]       │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ Ab12...Xy89  •  Applied 2 hours ago           │ │
│  │ "I have 5 years of logo design experience..." │ │
│  │ [Portfolio images]                             │ │
│  │                                                │ │
│  │ ▲ 5 upvotes (2.5% supply)                     │ │
│  │ [Assign Button] - Poster only                 │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [More applications...]                             │
└──────────────────────────────────────────────────────┘
```

---

**Status:** ✅ COMPLETE & READY FOR TESTING  
**Next:** Sprint 2.2 - Application Submission & Voting









