# Testing Wallet Requirement Implementation

**Date**: December 19, 2024  
**Feature**: Wallet connection requirement for project submission

---

## 🎯 Test Objectives

Verify that:
1. ✅ Submission form requires wallet connection
2. ✅ Connected wallet is displayed clearly as "Project Creator"
3. ✅ Submitter wallet is saved to database
4. ✅ Admin approval uses submitter wallet (not admin wallet)
5. ✅ Project creator is the submitter (not admin)
6. ✅ Creator can access "Manage Team" functionality

---

## 📋 Test Plan

### **Test 1: Submission Form - Wallet Connection Required**

**Steps:**
1. Navigate to `/submit-project`
2. **BEFORE connecting wallet:**
   - [ ] Verify wallet connection section is visible
   - [ ] Verify warning message: "Connect Your Wallet"
   - [ ] Try filling form and clicking submit
   - [ ] **Expected**: Submit button should be disabled

3. **Connect wallet:**
   - [ ] Click "Connect Wallet" or use WalletMultiButton
   - [ ] Choose your wallet (Phantom, Solflare, etc.)
   - [ ] Approve connection

4. **AFTER connecting wallet:**
   - [ ] Verify wallet address is displayed (e.g., "Eyyu...N6ev")
   - [ ] Verify label: "Project Creator Wallet"
   - [ ] Verify success checkmark ✅ appears
   - [ ] Verify message changes to: "Creator Wallet Connected"
   - [ ] Verify info text explains admin permissions
   - [ ] Submit button should now be enabled
   - [ ] **Wallet button should still be visible** (now showing wallet address)
   
5. **Test wallet switching:**
   - [ ] Click the wallet button (shows your address)
   - [ ] Click "Disconnect" or "Change Wallet"
   - [ ] Reconnect with a different wallet
   - [ ] Verify the new wallet address displays correctly
   - [ ] Verify all UI updates properly

**Pass Criteria:**
- ✅ Cannot submit without wallet
- ✅ Clear visual feedback when connected
- ✅ Wallet address displayed correctly

---

### **Test 2: Form Submission with Wallet**

**Steps:**
1. While wallet is connected, fill out the form:
   - **Name**: Test User
   - **Email**: test@example.com
   - **Contract Address**: [Valid Solana token mint]
   - **Role**: Founder
   - **Message**: Testing wallet requirement

2. Click "Submit Application"

3. **Check browser console** (F12):
   - [ ] Look for log: `Submitter Wallet: [your-wallet]...`

4. **Check database** (Supabase):
   - Go to Table Editor → `project_submissions`
   - Find your submission (sort by `submitted_at DESC`)
   - [ ] Verify `submitter_wallet` column contains your wallet address
   - [ ] Verify it's NOT null

**Pass Criteria:**
- ✅ Submission succeeds
- ✅ `submitter_wallet` saved in database
- ✅ Wallet address matches connected wallet

---

### **Test 3: Admin Approval Flow**

**Steps:**
1. Log in as admin (or have admin account ready)

2. Navigate to `/admin/submissions`

3. Find your test submission

4. Click "Approve"

5. **Check server logs** (terminal where Next.js is running):
   - [ ] Look for log: `Project creator will be: [your-wallet]... (submitter)`
   - [ ] Should NOT say `(admin - legacy)`

6. **Check database**:
   - Go to Table Editor → `project_creation_tokens`
   - Find the newly created token
   - [ ] Verify `created_by` column = your submitter wallet (NOT admin wallet)

**Pass Criteria:**
- ✅ Approval succeeds
- ✅ Logs show "(submitter)" not "(admin - legacy)"
- ✅ Token `created_by` = submitter wallet

---

### **Test 4: Project Creation**

**Steps:**
1. Check email for creation link (or get token from database)

2. Navigate to `/projects/create?token=[your-token]`

3. Complete project creation (all 5 steps)

4. Submit project

5. **Check database**:
   - Go to Table Editor → `projects`
   - Find your newly created project
   - [ ] Verify `creator_wallet` = your submitter wallet (NOT admin wallet)

**Pass Criteria:**
- ✅ Project created successfully
- ✅ `creator_wallet` matches your wallet

---

### **Test 5: Creator Permissions**

**Steps:**
1. Navigate to your newly created project page:
   - `/project/[project-id]`

2. **As the creator** (connected with submitter wallet):
   - [ ] Verify "Manage Team" button is visible in project header
   - [ ] Button should be next to or near "Edit Project"

3. Click "Manage Team" button

4. **In the modal**:
   - [ ] Verify you're shown as "Creator" (blue card)
   - [ ] Verify your wallet address is displayed correctly
   - [ ] Verify "(You)" indicator appears next to your wallet
   - [ ] Verify "Cannot Remove" label appears
   - [ ] Verify "Add New Editor" section is visible

**Pass Criteria:**
- ✅ "Manage Team" button visible to creator
- ✅ Creator displayed correctly in modal
- ✅ Can access editor management

---

### **Test 6: Non-Creator Cannot Access**

**Steps:**
1. Disconnect your wallet (or connect a different wallet)

2. Navigate to the same project page

3. **Verify**:
   - [ ] "Manage Team" button should NOT be visible
   - [ ] Only public project info is shown

**Pass Criteria:**
- ✅ "Manage Team" hidden from non-creators
- ✅ Proper permission enforcement

---

### **Test 7: Add Editor (Bonus)**

**Steps:**
1. As creator, open "Manage Team" modal

2. Enter a valid Solana wallet address in the input

3. Click "Add"

4. **Wallet signature prompt should appear**:
   - [ ] Sign the message
   - [ ] Wait for confirmation

5. **Verify**:
   - [ ] Success message appears
   - [ ] New editor appears in the list
   - [ ] Editor card shows "Remove" button (you're creator)

**Pass Criteria:**
- ✅ Can add editors
- ✅ Signature required
- ✅ Editor appears in list

---

## 🔍 Verification Checklist

### Database Checks

Run these SQL queries in Supabase SQL Editor:

**1. Check submissions have submitter_wallet:**
```sql
SELECT 
  id,
  name,
  email,
  submitter_wallet,
  submitted_at
FROM project_submissions
WHERE submitted_at > NOW() - INTERVAL '1 hour'
ORDER BY submitted_at DESC;
```
- [ ] New submissions have `submitter_wallet` populated

**2. Check tokens use submitter wallet:**
```sql
SELECT 
  pct.id,
  pct.created_by,
  ps.submitter_wallet,
  ps.name,
  pct.created_at
FROM project_creation_tokens pct
JOIN project_submissions ps ON pct.submission_id = ps.id
WHERE pct.created_at > NOW() - INTERVAL '1 hour'
ORDER BY pct.created_at DESC;
```
- [ ] `created_by` matches `submitter_wallet`

**3. Check projects have correct creator:**
```sql
SELECT 
  p.id,
  p.token_name,
  p.creator_wallet,
  ps.submitter_wallet,
  p.created_at
FROM projects p
JOIN project_creation_tokens pct ON p.creator_wallet = pct.created_by
JOIN project_submissions ps ON pct.submission_id = ps.id
WHERE p.created_at > NOW() - INTERVAL '1 hour'
ORDER BY p.created_at DESC;
```
- [ ] `creator_wallet` matches `submitter_wallet`

---

## 🐛 Troubleshooting

### Issue: Submit button stays disabled
**Fix**: Make sure wallet is fully connected (check console for errors)

### Issue: submitter_wallet is NULL in database
**Fix**: Check that migration was applied correctly:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'project_submissions' 
AND column_name = 'submitter_wallet';
```

### Issue: Still showing admin wallet as creator
**Fix**: Check API logs - should show "(submitter)" not "(admin - legacy)"

### Issue: "Manage Team" button not showing
**Fix**: Verify project `creator_wallet` matches your connected wallet address

---

## ✅ Success Criteria

All tests pass when:
- ✅ Users cannot submit without connecting wallet
- ✅ Clear messaging about wallet becoming creator
- ✅ Submitter wallet saved in database
- ✅ Admin approval uses submitter wallet
- ✅ Projects have correct creator
- ✅ Creators can manage their projects
- ✅ Non-creators cannot access management

---

## 📊 Test Results

| Test | Status | Notes |
|------|--------|-------|
| 1. Wallet Connection UI | ⬜ | |
| 2. Form Submission | ⬜ | |
| 3. Admin Approval | ⬜ | |
| 4. Project Creation | ⬜ | |
| 5. Creator Permissions | ⬜ | |
| 6. Non-Creator Access | ⬜ | |
| 7. Add Editor | ⬜ | |

**Overall Status**: ⬜ Not Started / 🟡 In Progress / ✅ Passed / ❌ Failed

---

## 🎉 Next Steps After Testing

Once all tests pass:
1. ✅ Update documentation
2. ✅ Notify team of new flow
3. ✅ Monitor submissions for issues
4. ✅ Consider adding analytics tracking

---

**Tester**: _________________  
**Date**: _________________  
**Result**: _________________

