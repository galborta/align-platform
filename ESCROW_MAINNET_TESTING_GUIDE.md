# Escrow System - Mainnet Testing Guide

**Date**: November 27, 2024  
**Network**: Mainnet-Beta (Production) 🔴  
**Status**: Ready for Testing

---

## ⚠️ **IMPORTANT: REAL MONEY AT RISK**

This is **MAINNET** - all transactions use **real tokens** and **real SOL**.
- Tokens locked cannot be retrieved without completing the job flow
- Failed transactions may still cost gas fees
- Double-check all amounts before confirming
- Start with small test amounts

---

## ✅ Mainnet Configuration Verified

Your platform is already configured for mainnet:

```typescript
// lib/wallet-config.tsx
const network = WalletAdapterNetwork.Mainnet  ✅

// Environment Variables (should be set)
NEXT_PUBLIC_HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=xxx
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=xxx
```

**The escrow system will automatically use mainnet** because:
1. It uses `useConnection()` from wallet adapter (mainnet)
2. API uses `NEXT_PUBLIC_HELIUS_RPC_URL` (mainnet)
3. All Solscan links point to mainnet (no `?cluster=devnet`)

---

## 🧪 Mainnet Testing Checklist

### Pre-Testing Setup

- [ ] **Verify RPC URL** is mainnet Helius
  ```bash
  echo $NEXT_PUBLIC_HELIUS_RPC_URL
  # Should contain: mainnet.helius-rpc.com
  ```

- [ ] **Check Platform Settings** in database
  ```sql
  SELECT * FROM platform_settings WHERE setting_key = 'escrow_wallet_address';
  -- Should return a valid mainnet wallet address
  ```

- [ ] **Verify Escrow Wallet** has correct address
  - Should be a wallet you control
  - Should be on mainnet
  - Backup private key securely

- [ ] **Fund Test Wallet** with small amounts
  - Min 0.1 SOL for transaction fees
  - Small amount of project token (e.g., 10-20 tokens)
  - Don't test with large amounts initially

---

## 🎯 Test Scenario 1: Successful Job Creation

### Steps

1. **Open CreateJobModal**
   - Navigate to project page
   - Click "Post Job" or "Create Job"
   - Modal should open

2. **Fill Job Form**
   ```
   Title: "Test Escrow Job - DO NOT APPLY"
   Description: "This is a test job to verify escrow locking. Do not apply."
   KPIs: "Test completion"
   Category: development
   Payment: 10 [TOKEN] (small test amount)
   Completion: 7 days
   ```

3. **Review & Lock**
   - Click "Review & Lock Tokens"
   - Should see loading (validating balances)
   - Should show confirmation screen

4. **Verify Confirmation Screen**
   ```
   Job Summary:
   ✅ Title shown
   ✅ Payment shown
   ✅ Category shown
   
   Escrow Breakdown:
   ✅ Locked Amount: 10.5 TOKEN (payment + 5%)
   ✅ Platform Fee: 0.5 TOKEN
   ✅ Worker Receives: 10 TOKEN
   
   Balance Checks:
   ✅ SOL Balance shown (should be >= 0.01)
   ✅ Token Balance shown
   ✅ Warning about locking
   ```

5. **Confirm & Lock**
   - Click "Confirm & Lock Tokens"
   - Wallet should prompt to sign
   - **Approve in wallet** (Phantom/Solflare/etc.)

6. **Wait for Confirmation**
   ```
   Toast messages:
   "Locking tokens in escrow..." (with spinner)
   "Creating job..."
   "Job posted! 🎉 Tokens locked in escrow"
   ```

7. **Verify Success**
   - Modal closes
   - Job appears in jobs list
   - Status: "open"

8. **Check Solscan**
   - Copy transaction signature from logs or database
   - Visit: `https://solscan.io/tx/{signature}`
   - Should show:
     - ✅ Status: Success
     - ✅ From: Your wallet
     - ✅ To: Escrow wallet
     - ✅ Amount: 10.5 tokens
     - ✅ Confirmed on mainnet

9. **Check Database**
   ```sql
   SELECT * FROM jobs 
   WHERE poster_wallet = 'YOUR_WALLET'
   ORDER BY created_at DESC 
   LIMIT 1;
   
   -- Verify:
   -- escrow_locked = true
   -- escrow_tx_signature = 'transaction-signature'
   -- escrow_amount_tokens = 10.5
   -- escrow_token_mint = 'token-mint-address'
   ```

10. **Check Escrow Transactions Log**
    ```sql
    SELECT * FROM job_escrow_transactions 
    WHERE job_id = 'job-id-from-above'
    ORDER BY created_at DESC;
    
    -- Verify:
    -- transaction_type = 'lock'
    -- from_wallet = your wallet
    -- to_wallet = escrow wallet
    -- amount_tokens = 10.5
    -- status = 'confirmed'
    -- tx_signature matches
    ```

11. **Check Escrow Wallet Balance**
    - Visit: `https://solscan.io/account/{escrow_wallet_address}`
    - Should show increased token balance
    - Token balance should include your 10.5 tokens

---

## 🚨 Test Scenario 2: Error Handling - Insufficient Balance

### Steps

1. **Create Wallet with Insufficient Tokens**
   - Use wallet with < payment amount

2. **Try to Create Job**
   - Fill form with payment amount > balance
   - Click "Review & Lock Tokens"

3. **Expected Behavior**
   ```
   ❌ Should show error toast:
   "Insufficient token balance. You have 5 but need 10.5"
   
   ❌ Should NOT show confirmation screen
   ❌ Should stay on form
   ```

---

## 🔄 Test Scenario 3: Draft Recovery

### Setup: Simulate Escrow Success + Job Creation Failure

**Option A: Disconnect Internet**
1. Create job normally
2. During "Creating job..." phase, disconnect internet
3. Job creation will fail

**Option B: Force Database Error** (for testing)
1. Temporarily break database connection
2. Create job
3. Escrow succeeds, job creation fails

### Steps

1. **Trigger Failure**
   - Use one of the methods above
   - Should see error message:
     ```
     "⚠️ Tokens were locked successfully, but job creation failed.
      Your progress has been saved and can be recovered.
      Please refresh the page to see recovery options.
      Transaction: 5wHu2..."
     ```

2. **Verify Draft Saved**
   ```sql
   SELECT * FROM job_drafts 
   WHERE poster_wallet = 'YOUR_WALLET'
   ORDER BY created_at DESC 
   LIMIT 1;
   
   -- Verify:
   -- recovery_status = 'needs_recovery'
   -- escrow_tx_signature is present
   -- draft_data contains job details
   ```

3. **Refresh Page**
   - Reload the jobs page
   - Should see recovery banner:
     ```
     ⚠️ 1 Job Needs Recovery
     [Recover Jobs] button
     ```

4. **Open Recovery Modal**
   - Click "Recover Jobs"
   - Should show modal with draft details:
     - Title
     - Payment amount
     - Category
     - Transaction signature
     - [Recover] [Delete] buttons

5. **Recover Draft**
   - Click "Recover" button
   - Should see loading: "Recovering..."
   - Should show success toast: "Job recovered successfully! 🎉"
   - Should redirect to job page

6. **Verify Recovery**
   ```sql
   -- Check job created
   SELECT * FROM jobs WHERE escrow_tx_signature = 'signature-from-draft';
   -- Should exist now
   
   -- Check draft marked as recovered
   SELECT * FROM job_drafts WHERE id = 'draft-id';
   -- recovery_status should be 'recovered'
   ```

7. **Verify No Double-Spending**
   - Job should use same transaction signature
   - No second escrow transfer
   - Only one transaction on blockchain

---

## 🛑 Test Scenario 4: Transaction Rejection

### Steps

1. **Create Job**
   - Fill form
   - Click "Review & Lock Tokens"
   - Click "Confirm & Lock Tokens"

2. **Reject in Wallet**
   - When wallet prompts
   - Click "Reject" or "Cancel"

3. **Expected Behavior**
   ```
   ❌ Error message shown
   ❌ No job created
   ❌ No tokens transferred
   ❌ No draft saved (because escrow didn't succeed)
   ✅ User stays on confirmation screen
   ✅ Can try again
   ```

---

## 💰 Test Scenario 5: Small Amount Test

**Recommended for first mainnet test**

### Steps

1. **Use Minimum Amounts**
   ```
   Payment: $5 USD worth of tokens (minimum allowed)
   
   Example:
   - If token = $0.50, use 10 tokens
   - Fee: 0.5 tokens (5%)
   - Total locked: 10.5 tokens
   - Cost: ~$5.25
   ```

2. **Complete Full Flow**
   - Create job
   - Lock escrow
   - Verify on Solscan
   - Check database
   - Check escrow wallet balance

3. **Success Criteria**
   - ✅ Transaction confirmed
   - ✅ Tokens in escrow wallet
   - ✅ Job created in database
   - ✅ Transaction logged
   - ✅ No errors

---

## 📊 What to Monitor

### During Testing

1. **Browser Console**
   ```javascript
   // Watch for logs:
   "Creating job with escrow: {...}"
   "Verifying transaction on-chain: ..."
   "Transaction verified successfully"
   "Job created successfully: ..."
   ```

2. **Network Tab**
   ```
   POST /api/jobs/create
   Status: 201 Created
   Response: { success: true, job: {...} }
   ```

3. **Wallet**
   - Transaction prompts
   - Balance decreases
   - Transaction history

4. **Solscan**
   - Transaction status
   - Confirmation count
   - Instruction details

### After Testing

1. **Database State**
   ```sql
   -- All jobs with escrow
   SELECT 
     id, 
     title, 
     escrow_locked,
     escrow_amount_tokens,
     status
   FROM jobs 
   WHERE escrow_locked = true
   ORDER BY created_at DESC;
   ```

2. **Escrow Transactions**
   ```sql
   SELECT 
     transaction_type,
     amount_tokens,
     token_symbol,
     status,
     created_at
   FROM job_escrow_transactions
   ORDER BY created_at DESC;
   ```

3. **Draft Recovery Status**
   ```sql
   SELECT 
     recovery_status,
     COUNT(*) as count
   FROM job_drafts
   GROUP BY recovery_status;
   ```

---

## 🔍 Verification Checklist

After each test:

- [ ] **Transaction on Solscan**
  - Signature matches database
  - Status: Success
  - From: Your wallet
  - To: Escrow wallet
  - Amount: Correct (payment + 5%)

- [ ] **Job in Database**
  - `escrow_locked = true`
  - `escrow_tx_signature` set
  - `escrow_amount_tokens` correct
  - `status = 'open'`

- [ ] **Escrow Transaction Logged**
  - Row in `job_escrow_transactions`
  - `transaction_type = 'lock'`
  - `status = 'confirmed'`
  - Signature matches

- [ ] **Escrow Wallet Balance**
  - Balance increased by locked amount
  - Visible on Solscan

- [ ] **No Errors in Logs**
  - Browser console clean
  - Server logs clean
  - No unexpected errors

---

## ⚠️ Common Issues & Solutions

### Issue 1: "Insufficient SOL for transaction fees"
**Cause**: Wallet doesn't have enough SOL for gas + ATA creation  
**Solution**: Add 0.1 SOL to wallet  
**Prevention**: Always keep >= 0.1 SOL in wallet

### Issue 2: "Transaction not found on-chain"
**Cause**: Transaction signature not yet confirmed  
**Solution**: Wait 10-30 seconds, refresh Solscan  
**Prevention**: Wait for confirmation before creating job

### Issue 3: "Failed to create job in database"
**Cause**: Database connection issue, validation error  
**Solution**: Check draft recovery banner, click "Recover"  
**Prevention**: Ensure stable network connection

### Issue 4: Escrow wallet balance not showing
**Cause**: ATA not created, wrong token mint  
**Solution**: Check transaction details on Solscan  
**Prevention**: Verify token mint address in database

### Issue 5: Recovery banner not showing
**Cause**: Draft not saved, wrong wallet connected  
**Solution**: Check `job_drafts` table manually  
**Prevention**: Ensure wallet address matches

---

## 🎯 Success Criteria

**Test is successful if:**

1. ✅ Job created with real mainnet transaction
2. ✅ Tokens visible in escrow wallet on Solscan
3. ✅ Job record in database with correct escrow fields
4. ✅ Transaction logged in `job_escrow_transactions`
5. ✅ Recovery flow works if job creation fails
6. ✅ Error handling works for insufficient balance
7. ✅ Transaction rejection handled gracefully
8. ✅ All Solscan links work and show mainnet data

---

## 📝 Test Report Template

```markdown
# Escrow System Mainnet Test Report

**Date**: YYYY-MM-DD
**Tester**: Name
**Wallet**: Wallet Address
**Network**: Mainnet

## Test Results

### Test 1: Successful Job Creation
- [ ] Job created successfully
- [ ] Escrow locked
- [ ] Transaction on Solscan
- [ ] Database records correct
- **Amount Tested**: X tokens
- **Transaction**: [signature]

### Test 2: Error Handling
- [ ] Insufficient balance error works
- [ ] Transaction rejection works
- [ ] Error messages clear

### Test 3: Draft Recovery
- [ ] Draft saved when job creation fails
- [ ] Recovery banner shows
- [ ] Recovery successful
- [ ] No double-spending

## Issues Found
1. [Description]
2. [Description]

## Recommendations
1. [Recommendation]
2. [Recommendation]

## Conclusion
✅ PASS / ❌ FAIL

**Signed**: _____________
```

---

## 🚀 Post-Testing Actions

After successful testing:

1. **Document Results**
   - Save test report
   - Record transaction signatures
   - Note any issues

2. **Clean Up Test Jobs**
   ```sql
   -- Mark test jobs
   UPDATE jobs 
   SET status = 'cancelled',
       description = description || ' [TEST JOB - DO NOT PROCESS]'
   WHERE title LIKE '%Test%' 
     AND poster_wallet = 'YOUR_WALLET';
   ```

3. **Monitor Production**
   - Watch for real user jobs
   - Monitor error rates
   - Check draft creation rate

4. **Set Up Alerts**
   - High draft creation rate
   - Failed transactions
   - Escrow wallet balance anomalies

---

## 💡 Best Practices

1. **Start Small**
   - First test: $5-10 worth
   - Second test: $20-50 worth
   - Scale up gradually

2. **Test Each Scenario**
   - Happy path first
   - Error cases second
   - Edge cases third

3. **Verify Everything**
   - Check Solscan for every transaction
   - Check database for every job
   - Check escrow wallet balance

4. **Document Everything**
   - Transaction signatures
   - Test amounts
   - Any issues encountered

5. **Have Backup Plan**
   - Keep record of all transaction signatures
   - Know how to access escrow wallet
   - Have support contact ready

---

## 🆘 Emergency Contacts

**If Something Goes Wrong:**

1. **Save Transaction Signature**
   - Copy from error message
   - Or get from browser console
   - Or check wallet history

2. **Check Solscan**
   - Verify transaction status
   - Check if tokens actually transferred

3. **Check Recovery**
   - Look for recovery banner
   - Check `job_drafts` table

4. **Contact Support**
   - Provide transaction signature
   - Provide wallet address
   - Describe what happened

---

## ✅ Final Checklist

Before starting mainnet testing:

- [ ] RPC URL is mainnet
- [ ] Escrow wallet address set
- [ ] Platform settings configured
- [ ] Service role key set
- [ ] Test wallet funded with small amounts
- [ ] Backup of transaction signatures ready
- [ ] Know how to check Solscan
- [ ] Know how to check database
- [ ] Read this entire guide
- [ ] Understand real money is at risk

**Ready? Let's test on mainnet!** 🚀

---

**Remember**: 
- This is **REAL MONEY** 💰
- Start with **SMALL AMOUNTS** 💵
- **VERIFY EVERYTHING** ✅
- **DOCUMENT EVERYTHING** 📝

Good luck! 🍀












