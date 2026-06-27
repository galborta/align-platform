# Escrow Confirmation Screen - Visual Guide

## 🎨 Before & After

### BEFORE (Single Screen)
```
┌────────────────────────────────────────┐
│  Post a Job                            │
├────────────────────────────────────────┤
│  [Job Form]                            │
│  • Title                               │
│  • Category                            │
│  • Description                         │
│  • KPIs                                │
│  • Payment Amount                      │
│  • Assignment Mode                     │
│                                        │
│  ┌────────┐  ┌──────────┐            │
│  │ Cancel │  │ Post Job │            │
│  └────────┘  └──────────┘            │
└────────────────────────────────────────┘
```

### AFTER (Two Screens)

**SCREEN 1: Job Details**
```
┌────────────────────────────────────────┐
│  Post a Job                            │
├────────────────────────────────────────┤
│  [Job Form]                            │
│  • Title                               │
│  • Category                            │
│  • Description                         │
│  • KPIs                                │
│  • Payment Amount                      │
│  • Assignment Mode                     │
│  • Desired Completion (NEW!)          │
│    [Dropdown: 1, 3, 7, 14, 21, 30,    │
│     45, 60, 90 days or No preference]  │
│                                        │
│  ┌────────┐  ┌────────────────────┐  │
│  │ Cancel │  │ Review & Lock 🔒   │  │
│  └────────┘  └────────────────────┘  │
└────────────────────────────────────────┘
```

**SCREEN 2: Escrow Confirmation** (NEW!)
```
┌────────────────────────────────────────┐
│  🔒 Review & Lock Tokens              │
├────────────────────────────────────────┤
│                                        │
│  ┌─────────────────────────────────┐  │
│  │ JOB SUMMARY                     │  │
│  │ Design new logo for NUBCAT      │  │
│  │ [Design] [Review Applications]  │  │
│  └─────────────────────────────────┘  │
│                                        │
│  ┌─────────────────────────────────┐  │
│  │ ESCROW BREAKDOWN                │  │
│  │                                 │  │
│  │ Worker Receives:     100 NUB    │  │
│  │ Platform Fee (5%):    +5 NUB    │  │
│  │ ─────────────────────────────── │  │
│  │ 🔒 Total Locked:     105 NUB    │  │
│  │                   ≈ $52.50 USD  │  │
│  └─────────────────────────────────┘  │
│                                        │
│  ✅ SOL Balance: 0.0523 SOL           │
│                                        │
│  ┌─────────────────────────────────┐  │
│  │ ⚠️ Tokens will be locked until  │  │
│  │ job completion. Funds released  │  │
│  │ automatically 10 days after     │  │
│  │ work submission.                │  │
│  └─────────────────────────────────┘  │
│                                        │
│  ┌───────────┐  ┌──────────────────┐ │
│  │ ← Back    │  │ Confirm & Lock 🔒│ │
│  └───────────┘  └──────────────────┘ │
└────────────────────────────────────────┘
```

---

## 🎨 Color Usage

### Job Summary Card
- Background: `#F8F5FF` (light purple)
- Border: `#E5DEFF` (purple border)
- Title text: `#1A1A1E` (dark)
- Category chip: `#E3F06F` (lime) on dark text
- Assignment chip: `#E5E7F0` (gray) on `#6F7280` (gray text)

### Escrow Breakdown Card
- Border: `2px solid #7C4DFF` (purple - emphasis!)
- Section header: `#7C4DFF` (purple)
- Labels: `#6F7280` (gray)
- Values: `#1A1A1E` (dark)
- Total locked: `#7C4DFF` (purple, 20px, bold)
- Lock icon: `#7C4DFF`

### Warning Alert
- Background: `#FFF4E6` (light orange)
- Icon: `#FB923C` (orange)
- Text: `#1A1A1E` (dark)
- Bold text: `600 weight`

### Balance Check
- Icon: `#36C170` (green) if sufficient, `#FB923C` (orange) if low
- Text: `#6F7280` (gray)

### Buttons
- **Back to Edit**: 
  - Border: `1px solid #E5E7F0`
  - Text: `#6F7280`
  - Hover: `#F8F9FA` background
- **Confirm & Lock**:
  - Background: `#7C4DFF`
  - Text: `#fff`
  - Hover: `#6B3FEE`
  - Disabled: `#E5E7F0` bg, `#A3A7B5` text

---

## 💬 User Flow Diagram

```
Start
  │
  ├─ User clicks "Create Job"
  │
  ├─ SCREEN 1: Fill Job Form
  │   ├─ Enter title
  │   ├─ Select category
  │   ├─ Write description
  │   ├─ Write KPIs
  │   ├─ Set payment amount
  │   ├─ Choose assignment mode
  │   └─ (Optional) Set desired date
  │
  ├─ Click "Review & Lock Tokens"
  │   │
  │   ├─ Form validation runs
  │   │   ├─ ❌ Invalid → Show errors, stay on form
  │   │   └─ ✅ Valid → Continue
  │
  ├─ SCREEN 2: Confirmation
  │   ├─ View job summary
  │   ├─ Review escrow breakdown
  │   ├─ Check balances
  │   ├─ Read warning
  │   │
  │   ├─ User choice:
  │   │   ├─ Click "Back to Edit" → Return to SCREEN 1
  │   │   └─ Click "Confirm & Lock Tokens"
  │   │       │
  │   │       ├─ Show loading state
  │   │       ├─ (TODO) Execute Solana transfer
  │   │       ├─ Create job in database
  │   │       └─ Show success toast
  │
  └─ Done! Job created with escrow locked
```

---

## 📱 Responsive Behavior

### Desktop (>768px)
- Modal width: 600px (confirmation), 900px (form)
- Two-column button layout
- Side-by-side chips in job summary

### Mobile (<768px)
- Modal width: 100% - 32px margin
- Full-width buttons, stacked vertically
- Chips wrap to multiple lines
- Touch-friendly targets (48px minimum)
- Reduced font sizes (title: 20px)

---

## 🔄 State Management

### Form Screen States
```typescript
// Form data
title, category, description, kpis
paymentAmount, assignmentMode
desiredCompletion (new!)

// Validation
errors: Record<string, string>
usdValue, tokenPrice, priceError
checkingPrice, belowMinimum

// Loading
loading, hasScrolled
```

### Confirmation Screen States
```typescript
// Screen control
showConfirmation: boolean
isLocking: boolean
lockError: string | null

// Platform data
feePercentage: number
solBalance: number
tokenBalance: number

// Computed
escrowBreakdown = {
  totalLocked, feeAmount, workerReceives
}
```

---

## 🎯 Key Interactions

### 1. Clicking "Review & Lock Tokens"
- Triggers: `handleReviewAndLock()`
- Validates entire form
- If valid: Sets `showConfirmation = true`
- If invalid: Shows toast + keeps errors visible

### 2. Clicking "Back to Edit"
- Triggers: `handleBackToEdit()`
- Sets `showConfirmation = false`
- Clears `lockError`
- Returns to form with data preserved

### 3. Clicking "Confirm & Lock Tokens"
- Triggers: `handleConfirmAndLock()`
- Sets `isLocking = true`
- Shows loading spinner on button
- (TODO) Executes Solana transfer
- Creates job in database
- Shows success toast
- Closes modal
- Calls `onJobCreated()` callback

---

## 🔢 Calculation Examples

### Example 1: Basic Job
```
Input:
  Payment: 100 NUB
  Fee: 5%

Calculation:
  Worker receives: 100 NUB
  Platform fee: 100 × 0.05 = 5 NUB
  Total locked: 100 + 5 = 105 NUB

Display:
  Worker Receives:    100 NUB
  Platform Fee (5%):   +5 NUB
  ─────────────────────────────
  🔒 Total Locked:    105 NUB
```

### Example 2: Large Job
```
Input:
  Payment: 10,000 USDC
  Fee: 5%

Calculation:
  Worker receives: 10,000 USDC
  Platform fee: 10,000 × 0.05 = 500 USDC
  Total locked: 10,000 + 500 = 10,500 USDC

Display:
  Worker Receives:    10,000.00 USDC
  Platform Fee (5%):     +500.00 USDC
  ───────────────────────────────────
  🔒 Total Locked:    10,500.00 USDC
```

---

## ✅ Validation Checks

### Form Screen
- ✅ Title: 1-200 characters
- ✅ Category: Must select one
- ✅ Description: 1-5000 characters
- ✅ KPIs: 1-2000 characters
- ✅ Payment: Minimum $5 USD, positive number
- ✅ Token price available (Helius API)

### Confirmation Screen
- ✅ Fee percentage loaded from database
- ✅ SOL balance sufficient for transaction fees
- ⏳ Token balance sufficient (to be implemented)
- ⏳ Escrow wallet address valid (to be implemented)

---

## 🎬 Animation & Transitions

### Screen Transitions
- Form → Confirmation: Instant (no animation)
- Confirmation → Form: Instant (no animation)
- Modal open/close: Material UI default fade

### Loading States
- Button text changes: "Review & Lock" → "Locking Tokens..."
- Spinner appears next to button text
- Button becomes disabled
- "Back to Edit" button also disabled during locking

### Success
- Toast notification slides in from top
- Purple background (`#7C4DFF`)
- Auto-dismiss after 4 seconds
- Modal closes immediately after success

---

## 🐛 Error Handling

### Current Implementation
```typescript
if (lockError) {
  <Alert severity="error">
    {lockError}
  </Alert>
}
```

### Future Error States
- ❌ Transaction rejected by user
- ❌ Insufficient token balance
- ❌ Insufficient SOL for fees
- ❌ Network timeout
- ❌ Invalid escrow wallet
- ❌ Database error

---

## 📊 Success Metrics

### User Experience
- **Before**: 1 screen, immediate commitment
- **After**: 2 screens, informed decision
- **Transparency**: User sees exact breakdown
- **Control**: Can review and go back

### Business Value
- Reduces accidental job posts
- Increases user confidence
- Shows platform professionalism
- Prepares for real escrow implementation

---

## 🚀 What's Next

### Immediate (Sprint 2)
1. Implement actual Solana token transfer
2. Add transaction confirmation wait
3. Update database with signature
4. Log to `job_escrow_transactions` table

### Future Enhancements
1. Show token balance in confirmation screen
2. Add estimated transaction time
3. Draft saving functionality
4. Transaction history link
5. Retry mechanism for failed transfers

---

## 📸 Screenshot Checklist

When testing, verify these visuals:

- [ ] Job summary card has light purple background
- [ ] Category chip has lime background
- [ ] Escrow breakdown card has purple border (2px)
- [ ] Total locked amount is large and purple
- [ ] Warning box has orange icon and beige background
- [ ] Balance check has green checkmark
- [ ] Back button has gray border
- [ ] Confirm button has purple background
- [ ] Buttons are full-width and stacked
- [ ] Lock icons appear on confirmation screen
- [ ] All text is readable and properly sized


