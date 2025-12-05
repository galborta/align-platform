# ✅ Payment Release System - Testing Checklist

**Comprehensive testing guide for the complete payment release system**

---

## 📋 Pre-Test Setup

### Environment Variables
```bash
# Verify these are set in .env.local
✓ ESCROW_WALLET_PRIVATE_KEY
✓ ESCROW_WALLET_ADDRESS
✓ FEE_WALLET_ADDRESS
✓ SUPABASE_SERVICE_ROLE_KEY
✓ NEXT_PUBLIC_HELIUS_RPC_URL
```

### Database Tables
```sql
-- Verify tables exist
✓ jobs
✓ job_submissions
✓ job_escrow_transactions
✓ job_applications
✓ wallet_karma
```

### Test Accounts
```
✓ Poster wallet (with SOL for fees)
✓ Worker wallet
✓ Escrow wallet (funded with test tokens)
✓ Fee collection wallet
```

---

## 🧪 Complete Test Flow

### ✅ Test 1: Work Submission

**Objective:** Verify work submission sets release_scheduled_at to 10 days from now

**Steps:**
1. Create job with escrow locked
2. Apply as worker
3. Get assigned to job
4. Submit work with deliverables:
   - Delivery message (required)
   - Images (optional, max 5)
   - External links (optional, max 5)

**Verify:**
```sql
SELECT 
  id,
  status,
  submitted_at,
  release_scheduled_at,
  EXTRACT(DAY FROM (release_scheduled_at - submitted_at)) as days_until_release
FROM jobs 
WHERE id = '[JOB_ID]';
```

**Expected Results:**
- ✅ `status` = 'submitted'
- ✅ `submitted_at` is set to current timestamp
- ✅ `release_scheduled_at` is exactly 10 days after `submitted_at`
- ✅ `days_until_release` = 10

**Check UI:**
- ✅ Auto-release info shown in submission modal
- ✅ Payment breakdown: "You will receive 95.00 SOL"
- ✅ Quality warning displayed
- ✅ Success toast: "Work submitted! Waiting for poster review 📬"

---

### ✅ Test 2: Countdown Timer

**Objective:** Verify countdown timer displays and updates correctly

**Steps:**
1. Navigate to job detail page (as poster)
2. Observe countdown in submitted work section
3. Wait 1 minute, refresh page
4. Check countdown updated

**Verify UI Elements:**
```
⏰ Auto-release in 9d 23h 59m
```

**Expected Results:**
- ✅ Countdown shows days and hours
- ✅ Updates on page refresh
- ✅ Shows urgency when < 3 days remain
- ✅ Color changes: Blue → Orange → Red

**Urgency Levels:**
| Days Remaining | Color | Alert Type |
|----------------|-------|------------|
| 7-10 days      | Blue  | Info       |
| 3-6 days       | Orange| Warning    |
| 0-2 days       | Red   | Error      |

---

### ✅ Test 3: Payment Breakdown Display

**Objective:** Verify payment amounts calculate correctly

**Test Cases:**

#### Case A: 100 SOL Job
```
Locked Amount:     100 SOL
Platform Fee (5%):   5 SOL
─────────────────────────
Worker Receives:    95 SOL
```

#### Case B: 50 USDC Job
```
Locked Amount:      50 USDC
Platform Fee (5%):  2.5 USDC
─────────────────────────
Worker Receives:   47.5 USDC
```

#### Case C: 33.33 SOL Job
```
Locked Amount:     33.33 SOL
Platform Fee (5%):  1.67 SOL
─────────────────────────
Worker Receives:   31.66 SOL
```

**Verify:**
- ✅ All calculations correct (95% / 5% split)
- ✅ 2 decimal places displayed
- ✅ Token symbol shows correctly
- ✅ Amounts bold and prominent

---

### ✅ Test 4: Release Payment Button

**Objective:** Verify "Release Payment Now" button shows for poster

**Steps:**
1. Log in as poster
2. Navigate to submitted job
3. Locate "Release Payment Now" button

**Button Requirements:**
- ✅ Only visible to poster
- ✅ Only shows when status = 'submitted'
- ✅ Purple background (#7C4DFF)
- ✅ Enabled (not disabled)
- ✅ On click → opens confirmation dialog

**Verify Hidden For:**
- ✅ Not poster (worker, other users)
- ✅ Status not 'submitted' (open, assigned, completed)
- ✅ Release paused by admin

---

### ✅ Test 5: Confirmation Dialog

**Objective:** Verify confirmation dialog displays all information correctly

**Steps:**
1. Click "Release Payment Now"
2. Review dialog contents

**Dialog Sections:**
```
┌────────────────────────────────────┐
│ ✅ Confirm Payment Release         │
├────────────────────────────────────┤
│ You are about to release payment…  │
│                                    │
│ [Payment Breakdown Alert]          │
│  Locked Amount:     100 SOL        │
│  Platform Fee (5%):   5 SOL        │
│  ─────────────────────────         │
│  Worker Receives:    95 SOL        │
│                                    │
│ [What Happens Next]                │
│  ✓ Worker receives payment         │
│  ✓ Platform fee collected          │
│  ✓ Both earn karma                 │
│  ✓ Job marked completed            │
│                                    │
│ ⚠️ Transactions cannot be reversed │
│                                    │
│ [Cancel]   [Confirm Release] ⏳    │
└────────────────────────────────────┘
```

**Verify:**
- ✅ Payment breakdown accurate
- ✅ "What Happens Next" section clear
- ✅ Warning about irreversibility shown
- ✅ Cancel button works
- ✅ Confirm button enabled
- ✅ Mobile responsive

---

### ✅ Test 6: Payment Release Execution

**Objective:** Verify both blockchain transactions execute successfully

**Steps:**
1. Click "Confirm Release" in dialog
2. Wait for transactions to process (15-30 seconds)
3. Observe loading state

**Transaction 1: Worker Payment**
```
From: Escrow Wallet
To:   Worker Wallet
Amount: 95 SOL (95% of 100)
```

**Transaction 2: Platform Fee**
```
From: Escrow Wallet
To:   Fee Wallet
Amount: 5 SOL (5% of 100)
```

**Verify During Execution:**
- ✅ Button shows "Releasing..." with spinner
- ✅ Cancel button disabled
- ✅ Dialog stays open
- ✅ No errors in console

**Check Blockchain:**
```bash
# Worker payment
solana confirm [WORKER_TX_SIGNATURE] --url mainnet-beta

# Platform fee
solana confirm [FEE_TX_SIGNATURE] --url mainnet-beta
```

**Expected:**
- ✅ Both transactions confirmed
- ✅ Worker balance increased by 95 SOL
- ✅ Fee wallet balance increased by 5 SOL
- ✅ Escrow balance decreased by 100 SOL

---

### ✅ Test 7: Job Status Update

**Objective:** Verify job status updates to 'completed'

**SQL Verification:**
```sql
SELECT 
  id,
  status,
  completed_at,
  escrow_locked,
  updated_at
FROM jobs 
WHERE id = '[JOB_ID]';
```

**Expected Results:**
- ✅ `status` = 'completed'
- ✅ `completed_at` is set to current timestamp
- ✅ `escrow_locked` = false
- ✅ `updated_at` is recent timestamp

**UI Verification:**
- ✅ Success toast: "🎉 Payment released! Worker received 95.00 SOL"
- ✅ Dialog closes automatically
- ✅ Page refreshes to show new status
- ✅ Transaction signatures logged to console

---

### ✅ Test 8: Transaction Records Created

**Objective:** Verify both transactions are recorded in database

**SQL Query:**
```sql
SELECT 
  transaction_type,
  from_wallet,
  to_wallet,
  amount_tokens,
  token_mint,
  token_symbol,
  tx_signature,
  status,
  confirmed_at,
  created_at
FROM job_escrow_transactions 
WHERE job_id = '[JOB_ID]'
ORDER BY created_at;
```

**Expected Record 1: Worker Payment**
```
transaction_type: 'release_to_worker'
from_wallet: [Escrow Wallet Address]
to_wallet: [Worker Wallet Address]
amount_tokens: 95.00
token_mint: [SOL Mint Address]
token_symbol: 'SOL'
tx_signature: '5wHu2a3bZpT7...'
status: 'confirmed'
confirmed_at: '2025-11-27T...'
```

**Expected Record 2: Platform Fee**
```
transaction_type: 'fee_collection'
from_wallet: [Escrow Wallet Address]
to_wallet: [Fee Wallet Address]
amount_tokens: 5.00
token_mint: [SOL Mint Address]
token_symbol: 'SOL'
tx_signature: '3kLp9xV2cRtM...'
status: 'confirmed'
confirmed_at: '2025-11-27T...'
```

**Verify:**
- ✅ 2 records created (worker + fee)
- ✅ All fields populated correctly
- ✅ Transaction signatures match blockchain
- ✅ Amounts sum to escrow amount (95 + 5 = 100)
- ✅ Timestamps reasonable (within last few minutes)

---

### ✅ Test 9: Success State Display

**Objective:** Verify completion banner shows correctly after payment release

**Navigate To:** Job detail page (after release)

**Expected UI:**
```
┌───────────────────────────────────────┐
│ ✅ Job Completed Successfully         │
│ Completed on Nov 27, 2025             │
├───────────────────────────────────────┤
│ Worker Received:    95.00 SOL         │
│ Platform Fee (5%):   5.00 SOL         │
│                                       │
│ Worker payment: 5wHu2a3b...Axur2 🔗   │
│ Platform fee: 3kLp9xV2...Bwt3 🔗      │
│                                       │
│ 🏆 Karma Distributed                  │
│ Worker: +5,000 karma                  │
│ Poster: +5,000 karma                  │
│ 💎 Bonus to upvoters                  │
└───────────────────────────────────────┘
```

**Verify Elements:**
- ✅ Dark green background (#0a3d0a)
- ✅ Green border (#4caf50)
- ✅ Completion date formatted correctly
- ✅ Payment amounts displayed
- ✅ Transaction signatures present
- ✅ Links formatted properly (first 8 + last 6 chars)
- ✅ Karma amounts calculated correctly

**Verify Styling:**
- ✅ CheckCircleIcon (40px, green)
- ✅ Title: h6, bold, green
- ✅ Date: body2, light green
- ✅ Divider: green
- ✅ Amounts: bold green for worker, light for fee

---

### ✅ Test 10: Transaction Links on Solscan

**Objective:** Verify Solscan links work and display transaction details

**Steps:**
1. Click worker payment link
2. Verify opens in new tab
3. Check transaction details on Solscan
4. Return to page
5. Click platform fee link
6. Verify opens in new tab
7. Check transaction details on Solscan

**Worker Payment Link:**
```
URL: https://solscan.io/tx/{workerTxSignature}
Target: _blank
```

**Platform Fee Link:**
```
URL: https://solscan.io/tx/{feeTxSignature}
Target: _blank
```

**Verify on Solscan:**
- ✅ Transaction found
- ✅ Status: Success ✓
- ✅ From: Escrow wallet address
- ✅ To: Worker/Fee wallet address
- ✅ Amount: 95/5 tokens
- ✅ Token: SOL (or correct token)
- ✅ Timestamp matches completed_at

**Link Behavior:**
- ✅ Hover: underline appears
- ✅ Color: #66bb6a (medium green)
- ✅ External icon shows (OpenInNew)
- ✅ Mobile: links tappable

---

## 🚨 Error Cases to Test

### Error Test 1: Wrong User Tries to Release
**Setup:** Log in as worker or non-poster

**Expected:**
- ✅ "Release Payment Now" button not visible
- ✅ If API called directly: 403 Forbidden
- ✅ Error: "Only poster can release payment"

---

### Error Test 2: Wrong Job Status
**Setup:** Try to release job that's not 'submitted'

**Expected:**
- ✅ Button not visible for non-submitted jobs
- ✅ If API called: 400 Bad Request
- ✅ Error: "Job must be in submitted status (current: [status])"

---

### Error Test 3: Insufficient Escrow Balance
**Setup:** 
1. Create job with 100 SOL
2. Manually reduce escrow balance to 50 SOL
3. Try to release payment

**Expected:**
- ✅ Pre-flight validation fails
- ✅ Error in dialog: "Insufficient escrow balance"
- ✅ Shows actual vs required balance
- ✅ Transaction not attempted

---

### Error Test 4: Release Paused by Admin
**Setup:**
```sql
UPDATE jobs 
SET release_paused = true,
    paused_by = '[ADMIN_WALLET]',
    pause_reason = 'Under investigation'
WHERE id = '[JOB_ID]';
```

**Expected:**
- ✅ "Release Payment Now" button disabled
- ✅ Warning shown: "Payment release is paused"
- ✅ If API called: 400 Bad Request
- ✅ Pause reason displayed

---

### Error Test 5: Network/RPC Timeout
**Setup:** Disconnect internet or use slow RPC

**Expected:**
- ✅ Loading state shows
- ✅ After timeout: error displayed in dialog
- ✅ Error: "Transaction timeout" or "Network error"
- ✅ Dialog stays open
- ✅ User can retry
- ✅ Job status unchanged (still 'submitted')

---

### Error Test 6: Transaction Fails but DB Updates
**Setup:** Simulate transaction failure after DB update

**Expected:**
- ✅ Error logged to console
- ✅ Admin alerted (future feature)
- ✅ Manual intervention required
- ✅ Audit trail preserved

---

## 📊 Performance Tests

### Performance Test 1: Large Image Uploads
**Setup:**
- Upload 5 images (each 8-10 MB)
- Submit work

**Expected:**
- ✅ Upload progress shown
- ✅ All images uploaded successfully
- ✅ Total time < 30 seconds
- ✅ No timeout errors

---

### Performance Test 2: API Response Time
**Measure:**
```javascript
console.time('Release Payment')
await fetch('/api/jobs/[jobId]/release-payment', {...})
console.timeEnd('Release Payment')
```

**Expected:**
- ✅ Pre-flight validation: < 1 second
- ✅ Worker transaction: < 15 seconds
- ✅ Fee transaction: < 15 seconds
- ✅ DB updates: < 1 second
- ✅ **Total time: < 35 seconds**

---

### Performance Test 3: Page Load Time
**Measure:** Time to display completion banner

**Expected:**
- ✅ Job data fetched: < 2 seconds
- ✅ Transactions fetched: < 1 second
- ✅ Banner renders: < 100ms
- ✅ **Total time: < 3.5 seconds**

---

## 🔐 Security Tests

### Security Test 1: Private Key Exposure
**Check:**
```javascript
// In browser console
console.log(process.env.ESCROW_WALLET_PRIVATE_KEY)
```

**Expected:**
- ✅ Returns `undefined` (not accessible client-side)
- ✅ Key only in server-side .env.local
- ✅ Never sent to client
- ✅ Never logged to console

---

### Security Test 2: SQL Injection
**Attempt:**
```
jobId = "'; DROP TABLE jobs; --"
```

**Expected:**
- ✅ Query fails safely
- ✅ No tables dropped
- ✅ Error handled gracefully
- ✅ Supabase parameterized queries protect

---

### Security Test 3: XSS in Submission
**Attempt:**
```
deliveryMessage = "<script>alert('XSS')</script>"
```

**Expected:**
- ✅ Script not executed
- ✅ Rendered as text, not HTML
- ✅ React escapes by default

---

## 📱 Cross-Browser Tests

### Browser Test Matrix
| Browser | Version | Status |
|---------|---------|--------|
| Chrome  | Latest  | ✓      |
| Firefox | Latest  | ✓      |
| Safari  | Latest  | ✓      |
| Edge    | Latest  | ✓      |
| Mobile Safari | iOS 15+ | ✓   |
| Chrome Mobile | Android | ✓   |

**Test Each Browser:**
- ✅ Modal displays correctly
- ✅ Buttons work
- ✅ Links open
- ✅ Styling consistent
- ✅ No console errors

---

## 🎨 Visual Regression Tests

### Take Screenshots
1. Completion banner (desktop)
2. Completion banner (mobile)
3. Confirmation dialog (desktop)
4. Confirmation dialog (mobile)
5. Work submission modal (desktop)
6. Work submission modal (mobile)

**Compare:**
- ✅ Layout consistent
- ✅ Colors match design
- ✅ Typography correct
- ✅ Spacing appropriate

---

## ✅ Final Verification Checklist

Before marking complete, verify ALL items:

### Work Submission ✓
- [ ] Sets release_scheduled_at (+10 days)
- [ ] Creates submission record
- [ ] Updates job status to 'submitted'
- [ ] Shows auto-release info in modal
- [ ] Displays payment breakdown
- [ ] Shows quality warning

### Countdown Timer ✓
- [ ] Displays correctly
- [ ] Updates on refresh
- [ ] Shows urgency (<3 days)
- [ ] Color coding works

### Payment Release ✓
- [ ] Button shows for poster only
- [ ] Confirmation dialog displays
- [ ] Payment amounts correct
- [ ] Worker receives 95%
- [ ] Platform gets 5%
- [ ] Both transactions execute
- [ ] Transactions confirmed on-chain

### Database Updates ✓
- [ ] Job status → 'completed'
- [ ] completed_at timestamp set
- [ ] escrow_locked → false
- [ ] 2 transaction records created
- [ ] Transaction signatures stored

### UI Display ✓
- [ ] Completion banner shows
- [ ] Green theme applied
- [ ] Payment breakdown visible
- [ ] Transaction links work
- [ ] Solscan opens in new tab
- [ ] Karma distributed shown
- [ ] Mobile responsive

### Error Handling ✓
- [ ] Wrong user rejected
- [ ] Wrong status prevented
- [ ] Insufficient balance caught
- [ ] Paused release blocked
- [ ] Network errors handled
- [ ] Errors displayed clearly

### Security ✓
- [ ] Private key secure
- [ ] SQL injection protected
- [ ] XSS prevented
- [ ] Server-side only execution

### Performance ✓
- [ ] Page loads < 3.5s
- [ ] Payment release < 35s
- [ ] Image uploads work
- [ ] No timeouts

### Cross-Browser ✓
- [ ] Chrome works
- [ ] Firefox works
- [ ] Safari works
- [ ] Edge works
- [ ] Mobile works

---

## 🎉 Test Completion Certificate

```
╔═══════════════════════════════════════╗
║                                       ║
║   ✅ PAYMENT RELEASE SYSTEM           ║
║      TESTING COMPLETE                 ║
║                                       ║
║   All Tests Passed: ___/___           ║
║                                       ║
║   Tested By: _________________        ║
║   Date: ______________________        ║
║   Environment: _______________        ║
║                                       ║
║   Ready for Production: [ ]           ║
║                                       ║
╚═══════════════════════════════════════╝
```

---

**Created:** November 27, 2025  
**Component:** Payment Release System  
**Status:** ✅ Ready for Testing

---

Test thoroughly, ship confidently! 🚀✨





