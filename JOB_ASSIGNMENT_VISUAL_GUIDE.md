# 🎨 Job Assignment Feature - Visual Guide

**Visual reference for the job assignment UI and user flows**

---

## 🖼️ Screen States

### 1. Open Job - No Applications Yet

```
┌─────────────────────────────────────────────────────────┐
│ ← Jobs                                                   │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ 🟢 OPEN                                           │  │
│ │                                                    │  │
│ │ Design New Landing Page                           │  │
│ │                                                    │  │
│ │ Posted by: 8x7y...3z2a 📋                        │  │
│ │ Posted: 2 hours ago                               │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ Applications                                       │  │
│ │                                                    │  │
│ │           No applications yet                     │  │
│ │                                                    │  │
│ │     ⚡ First applicant will be auto-assigned     │  │
│ │        (for first_come mode)                      │  │
│ └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

### 2. Open Job - With Applications (Poster View)

```
┌─────────────────────────────────────────────────────────┐
│ ← Jobs                                                   │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ 🟢 OPEN                                           │  │
│ │ Design New Landing Page                           │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ Applications (3)                                   │  │
│ │                                                    │  │
│ │ ┌─────────────────────────────────────────────┐  │  │
│ │ │ 4x3y...2a1b 📋           [Pick This Applicant]│ │  │
│ │ │                                               │ │  │
│ │ │ Karma: 1,250  Completed: 5  Estimated: 3 days│ │  │
│ │ │                                               │ │  │
│ │ │ Application Pitch:                            │ │  │
│ │ │ I have 5 years of experience in UI/UX...     │ │  │
│ │ │                                               │ │  │
│ │ │ Portfolio: [img] [img] [img]                 │ │  │
│ │ │                                               │ │  │
│ │ │ Applied 1 hour ago                           │ │  │
│ │ └─────────────────────────────────────────────┘ │  │
│ │                                                    │  │
│ │ ┌─────────────────────────────────────────────┐  │  │
│ │ │ 7z8x...5c4d 📋           [Pick This Applicant]│ │  │
│ │ │ Karma: 850   Completed: 3  Estimated: 5 days │ │  │
│ │ │ ...                                          │ │  │
│ │ └─────────────────────────────────────────────┘  │  │
│ │                                                    │  │
│ │ ┌─────────────────────────────────────────────┐  │  │
│ │ │ 2a1b...9x8y 📋           [Pick This Applicant]│ │  │
│ │ │ Karma: 450   Completed: 1  Estimated: 1 week │ │  │
│ │ │ ...                                          │ │  │
│ │ └─────────────────────────────────────────────┘  │  │
│ └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

### 3. Assignment Confirmation Dialog

```
                ┌────────────────────────────────────┐
                │ ⚠️  Assign Job?                   │
                ├────────────────────────────────────┤
                │                                    │
                │ Assign this job to:                │
                │                                    │
                │ ┌──────────────────────────────┐  │
                │ │ 4x3y...2a1b                  │  │
                │ │                              │  │
                │ │ Karma: 1,250                 │  │
                │ │ Completed: 5 jobs            │  │
                │ │ Timeline: 3 days             │  │
                │ └──────────────────────────────┘  │
                │                                    │
                │ ┌──────────────────────────────┐  │
                │ │ ⚠️  Important:               │  │
                │ │                              │  │
                │ │ Other applications will       │  │
                │ │ remain visible but cannot be │  │
                │ │ selected unless this worker  │  │
                │ │ fails to deliver.            │  │
                │ └──────────────────────────────┘  │
                │                                    │
                │         [Cancel]    [Assign]       │
                └────────────────────────────────────┘
```

---

### 4. Assigned Job - Poster View

```
┌─────────────────────────────────────────────────────────┐
│ ← Jobs                                                   │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ 🟡 ASSIGNED                                       │  │
│ │ Design New Landing Page                           │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ 🟡 Waiting for Submission                         │  │
│ │                                                    │  │
│ │ Assigned to: 4x3y...2a1b 📋                       │  │
│ │                                                    │  │
│ │ Expected completion:                               │  │
│ │ November 28, 2025                                 │  │
│ │                                                    │  │
│ │ Assigned 2 hours ago                              │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ Assigned to:                                       │  │
│ │                                                    │  │
│ │ ╔══════════════════════════════════════════════╗  │  │
│ │ ║ 4x3y...2a1b 📋              ✓ Assigned      ║  │  │
│ │ ║                                              ║  │  │
│ │ ║ Karma: 1,250  Completed: 5  Estimated: 3 days  │  │
│ │ ║                                              ║  │  │
│ │ ║ Application Pitch:                           ║  │  │
│ │ ║ I have 5 years of experience...             ║  │  │
│ │ ╚══════════════════════════════════════════════╝  │  │
│ │                                                    │  │
│ │ ┌─────────────────────────────────────────────┐  │  │
│ │ │ 7z8x...5c4d 📋                             │ │  │
│ │ │ Karma: 850   Completed: 3  Estimated: 5 days│ │  │
│ │ │ (greyed out)                                 │ │  │
│ │ └─────────────────────────────────────────────┘  │  │
│ │                                                    │  │
│ │ ┌─────────────────────────────────────────────┐  │  │
│ │ │ 2a1b...9x8y 📋                             │ │  │
│ │ │ (greyed out)                                 │ │  │
│ │ └─────────────────────────────────────────────┘  │  │
│ └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

Legend:
╔═══╗ = Green border (assigned worker)
┌───┐ = Gray border (other applications, greyed out)
```

---

### 5. Assigned Job - Worker View

```
┌─────────────────────────────────────────────────────────┐
│ ← Jobs                                                   │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ 🟡 ASSIGNED                                       │  │
│ │ Design New Landing Page                           │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ Assigned to:                                       │  │
│ │                                                    │  │
│ │ ╔══════════════════════════════════════════════╗  │  │
│ │ ║ 4x3y...2a1b (YOU) 📋        ✓ Assigned      ║  │  │
│ │ ║                                              ║  │  │
│ │ ║ Your application was selected!               ║  │  │
│ │ ╚══════════════════════════════════════════════╝  │  │
│ │                                                    │  │
│ │ ┌─────────────────────────────────────────────┐  │  │
│ │ │ 7z8x...5c4d 📋                             │ │  │
│ │ │ (other applications greyed out)              │ │  │
│ │ └─────────────────────────────────────────────┘  │  │
│ │                                                    │  │
│ │ ╔══════════════════════════════════════════════╗  │  │
│ │ ║          🎯 Time to Deliver!                 ║  │  │
│ │ ║                                              ║  │  │
│ │ ║     Expected completion: Nov 28, 2025        ║  │  │
│ │ ║                                              ║  │  │
│ │ ║     ┌──────────────────────────────────┐    ║  │  │
│ │ ║     │ 📤 Submit Your Completed Work   │    ║  │  │
│ │ ║     └──────────────────────────────────┘    ║  │  │
│ │ ╚══════════════════════════════════════════════╝  │  │
│ └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 Color Codes & Styling

### Status Colors:

```css
🟢 Open:      #36C170 (green)
🟡 Assigned:  #FFC857 (yellow/gold)
🟣 Submitted: #7C4DFF (purple)
⚪ Completed: #6B7280 (gray)
🔴 Disputed:  #EF4444 (red)
```

### Card Borders:

```css
Assigned Worker Card:
- border: 2px solid #22C55E (green-500)
- background: #F0FDF4 (green-50)

Other Applications (when assigned):
- border: 1px solid #E5E7EB (gray-200)
- background: #F9FAFB (gray-50)
- opacity: 0.6

Waiting for Submission Card:
- border: 2px solid #FFC857 (yellow)
- background: #FFFBF0 (light yellow)

Time to Deliver Card:
- border: 2px solid #7C4DFF (purple)
- background: #F8F5FF (light purple)
```

### Buttons:

```css
Primary (Assign, Submit Work):
- background: #7C4DFF (purple)
- color: white
- hover: #6C3FE0

Outline (Cancel, Edit):
- border: 1px solid #7C4DFF
- color: #7C4DFF
- hover: light purple background
```

---

## 🎬 Animation & Transitions

### 1. Assignment Flow:

```
User clicks "Pick This Applicant"
    ↓
Dialog slides up from bottom (300ms ease-out)
    ↓
User clicks "Assign"
    ↓
Button shows loading spinner (color: white)
    ↓
Success: Dialog fades out (200ms)
    ↓
Toast notification slides in from top-right
    ↓
Page refreshes data
    ↓
Cards animate to new positions:
- Assigned card: scale(0.95 → 1.0) + green glow
- Other cards: opacity(1.0 → 0.6)
```

### 2. Card Hover Effects:

```css
Application Card (when open):
  hover: border-color → purple (#7C4DFF)
  transition: border-color 200ms ease

Copy Address Button:
  hover: color → purple
  scale: 1.0 → 1.05
  transition: all 150ms ease
```

---

## 📱 Responsive Breakpoints

### Mobile (<640px):

```
- Stack all elements vertically
- Full-width buttons
- Smaller font sizes for addresses
- Chips stack instead of inline
- Dialog becomes fullscreen-ish (max-width: 100vw - 32px)
```

### Tablet (640px - 1024px):

```
- Two-column layout for stats
- Buttons inline but smaller
- Dialog: max-width: 500px
```

### Desktop (>1024px):

```
- Full layout as designed
- Three-column stats layout
- Dialog: max-width: 600px
```

---

## 🔤 Typography Hierarchy

```
Job Title:           4xl (36px) - Display Font - Bold
Section Headings:    2xl (24px) - Display Font - Bold
Subsection Titles:   lg (18px) - Body Font - Semibold
Body Text:           base (16px) - Body Font - Regular
Wallet Addresses:    base (16px) - Mono Font - Medium
Stats Labels:        sm (14px) - Body Font - Regular
Stats Values:        sm (14px) - Body Font - Semibold
Timestamps:          sm (14px) - Body Font - Regular
Button Text:         base (16px) - Body Font - Semibold
```

---

## 🎯 Interactive States

### Button States:

```
Default:
- Full color
- Cursor: pointer

Hover:
- Slightly lighter/darker shade
- Subtle shadow increase

Active (clicking):
- Scale: 0.98
- Opacity: 0.9

Disabled:
- Opacity: 0.5
- Cursor: not-allowed
- No hover effects

Loading:
- Shows spinner
- Disabled state
- Cursor: wait
```

### Application Card States:

```
Idle (Open Job):
- Border: gray-200
- Background: white
- Full opacity

Hover (Open Job):
- Border: purple-300
- Subtle shadow

Selected (Assigned):
- Border: green-500 (2px)
- Background: green-50
- Chip: "Assigned" with checkmark

Inactive (Other when assigned):
- Opacity: 0.6
- Border: gray-200
- No hover effect
```

---

## 🎨 Icon Usage

```
Status Indicators:
🟢 = Open/Available
🟡 = In Progress/Assigned
🟣 = Under Review/Submitted
✅ = Completed/Success
❌ = Cancelled/Failed
⚠️ = Warning/Important

Action Icons:
📋 = Copy Address
📤 = Submit Work
✏️ = Edit
🎯 = Target/Goal
💼 = Work/Job
🏆 = Achievement/Karma
```

---

## 🔄 User Flow Diagram

```
┌─────────────┐
│ Job Posted  │
│  (Open)     │
└──────┬──────┘
       │
       ├─ Review Mode ────────┐
       │                      │
       │                ┌─────▼──────┐
       │                │Applications│
       │                │   Arrive   │
       │                └─────┬──────┘
       │                      │
       │                ┌─────▼──────┐
       │                │   Poster   │
       │                │   Reviews  │
       │                └─────┬──────┘
       │                      │
       │                ┌─────▼──────┐
       │                │   Picks    │
       │                │ Applicant  │
       │                └─────┬──────┘
       │                      │
       └──────────────────────┤
                              │
       ┌─ First-Come ─────────┤
       │                      │
       │                ┌─────▼──────┐
       │                │   First    │
       │                │ Applicant  │
       │                │Auto-Assign │
       │                └─────┬──────┘
       │                      │
       └──────────────────────┤
                              │
                        ┌─────▼──────┐
                        │  Assigned  │
                        │   Status   │
                        └─────┬──────┘
                              │
                        ┌─────▼──────┐
                        │   Worker   │
                        │  Completes │
                        └─────┬──────┘
                              │
                        ┌─────▼──────┐
                        │  Submits   │
                        │    Work    │
                        └─────┬──────┘
                              │
                        ┌─────▼──────┐
                        │   Review   │
                        │  & Accept  │
                        └─────┬──────┘
                              │
                        ┌─────▼──────┐
                        │ Completed  │
                        │   Status   │
                        └────────────┘
```

---

## ✨ Polish Details

### Micro-interactions:

1. **Toast Notifications:**
   - Slide in from top-right
   - Auto-dismiss after 4 seconds
   - Can be manually dismissed
   - Stack if multiple

2. **Copy Address Feedback:**
   - Icon changes briefly
   - Toast confirms copy
   - Button slightly scales

3. **Loading States:**
   - Spinner in button
   - Button disabled
   - Other buttons remain enabled
   - Dialog doesn't close

4. **Empty States:**
   - Centered text
   - Lighter color
   - Helpful hint text
   - Icon or emoji

### Accessibility:

```
- All buttons have aria-labels
- Dialog has proper focus trap
- Keyboard navigation supported
- Color contrast meets WCAG AA
- Screen reader friendly addresses
- Loading states announced
```

---

## 🎭 Real-World Examples

### Example 1: High-Karma Worker

```
Application Card:
┌────────────────────────────────────────────┐
│ 4x3y...2a1b 📋          [Pick This Applicant]│
│                                            │
│ Karma: 2,500 ⭐  Completed: 12  Est: 2 days│
│                                            │
│ "I've built 10+ landing pages in the last │
│  year. Check my portfolio for recent work."│
│                                            │
│ Portfolio: [img] [img] [img] [img]        │
└────────────────────────────────────────────┘

Visual Notes:
- High karma (2,500) displays with star emoji
- Multiple completed jobs shows experience
- Short timeline (2 days) indicates confidence
- 4 portfolio images show extensive work
```

### Example 2: New Worker

```
Application Card:
┌────────────────────────────────────────────┐
│ 9x8y...1a2b 📋          [Pick This Applicant]│
│                                            │
│ Karma: 50 🌱   Completed: 0   Est: 1 week │
│                                            │
│ "This would be my first job on Align but  │
│  I have professional experience. Eager     │
│  to prove myself to the community!"        │
│                                            │
│ Portfolio: [img] [img]                    │
└────────────────────────────────────────────┘

Visual Notes:
- Low karma with seedling emoji (new member)
- Zero completed jobs (first job)
- Longer timeline (being realistic)
- Fewer portfolio images (less to show)
- Pitch emphasizes eagerness and professionalism
```

---

## 📸 Before & After Comparisons

### Applications Section - Before Assignment:

```
BEFORE (Open):
┌─────────────────────────────────┐
│ Applications (3)                │
│                                 │
│ All cards: white background     │
│ All cards: gray borders         │
│ All cards: "Pick" buttons       │
│ All cards: full opacity         │
└─────────────────────────────────┘
```

### Applications Section - After Assignment:

```
AFTER (Assigned):
┌─────────────────────────────────┐
│ Assigned to:                    │
│                                 │
│ Top card: GREEN background      │
│ Top card: GREEN border (thick)  │
│ Top card: "Assigned" chip       │
│ Top card: full opacity          │
│                                 │
│ Other cards: gray background    │
│ Other cards: gray borders       │
│ Other cards: NO buttons         │
│ Other cards: 60% opacity        │
└─────────────────────────────────┘
```

---

## 🎯 Key Visual Principles

1. **Status Through Color:**
   - Green = Success/Assigned
   - Yellow = Waiting/In Progress
   - Purple = Action Required
   - Gray = Inactive/Completed

2. **Hierarchy Through Size:**
   - Larger = More Important
   - Smaller = Supporting Info
   - Bold = Primary Actions
   - Regular = Secondary Info

3. **Feedback Through Animation:**
   - Smooth transitions (200-300ms)
   - Scale on interaction
   - Fade for state changes
   - Slide for notifications

4. **Clarity Through Spacing:**
   - Generous padding (24px+)
   - Clear section separation
   - Grouped related info
   - Aligned elements

---

**Visual Design Complete**: ✅  
**Responsive**: ✅  
**Accessible**: ✅  
**Polished**: ✅

---

Built with ❤️ for beautiful, intuitive job assignment! 🎨













