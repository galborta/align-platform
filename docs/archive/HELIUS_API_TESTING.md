# Helius API Testing Guide ✅

## Overview

Test suite to validate Helius API integration for token price validation in the job system.

---

## 🧪 Test Component Created

**File:** `components/HeliusTestComponent.tsx`  
**Test Page:** `app/test/helius/page.tsx`  
**Access:** Navigate to `/test/helius` in your browser

---

## 🚀 Quick Start

### 1. No Setup Required! ✅

The test uses **DexScreener API** (free, no key needed) - the same API your project pages already use successfully.

### 2. Start Dev Server (if not running)

```bash
npm run dev
```

### 3. Open Test Page

Navigate to: [http://localhost:3000/test/helius](http://localhost:3000/test/helius)

### 4. Run Tests

Click the "Run Helius API Tests" button and check:
- ✅ UI results display
- ✅ Browser console logs

---

## 📊 Test Cases

### Test 1: Get NUB Token Price

**Function:** `getTokenPriceUsd()`

**Expected Behavior:**
```
✅ Console shows: "✅ Price fetched: $0.023" (example)
✅ UI shows green card with price
✅ Price is a positive number
```

**Actual Test:**
```typescript
const price = await getTokenPriceUsd(NUB_MINT)
console.log(`✅ Price fetched: $${price}`)
```

**Possible Outcomes:**
- **Success:** Returns number (e.g., 0.023456)
- **No Data:** Returns null (token has no price)
- **Error:** Returns null (API error, gracefully handled)

---

### Test 2: Validate 300 Tokens Minimum

**Function:** `validateMinimumUsdValue()`

**Expected Behavior:**
```
✅ Console shows: "Token Amount: 300"
✅ Console shows: "USD Value: $X.XX"
✅ Console shows: "Valid (≥$5): ✅ Yes" or "❌ No"
✅ UI shows validation result
```

**Actual Test:**
```typescript
const validation = await validateMinimumUsdValue(NUB_MINT, 300, 5)
console.log(`USD Value: $${validation.usdValue?.toFixed(2)}`)
console.log(`Valid (≥$5): ${validation.valid ? '✅ Yes' : '❌ No'}`)
```

**Example Results:**

If NUB price is $0.02:
```
300 tokens × $0.02 = $6.00
Valid: ✅ true (meets $5 minimum)
```

If NUB price is $0.01:
```
300 tokens × $0.01 = $3.00
Valid: ❌ false (below $5 minimum)
```

---

### Test 3: Invalid Mint Handling

**Function:** `getTokenPriceUsd()` with fake mint

**Expected Behavior:**
```
✅ Console shows: "✅ Gracefully returned null for invalid mint"
✅ UI shows green card (success)
✅ No errors thrown
✅ No console errors
```

**Actual Test:**
```typescript
const fakeMint = '1111111111111111111111111111111111111111111'
const fakePrice = await getTokenPriceUsd(fakeMint)

if (fakePrice === null) {
  console.log('✅ Gracefully returned null')
}
```

**Why This Matters:**
- Job system must handle tokens without price data
- No crashes when users enter invalid mints
- Graceful degradation of features

---

## 🔍 Console Output Example

When tests run successfully, you should see:

```
🧪 Starting Helius API Tests...
==================================================

📊 Test 1: Get NUB Token Price
Mint: GtDZKAqvMZMnti46ZewMiXCa4oXF4bZxwQPoKzXPFxZn
✅ Price fetched: $0.023456

💰 Test 2: Validate 300 Tokens ($5 minimum)
Token Amount: 300
USD Value: $7.04
Valid (≥$5): ✅ Yes

🔍 Test 3: Invalid Mint Address (Error Handling)
Fake Mint: 1111111111111111111111111111111111111111111
✅ Gracefully returned null for invalid mint

==================================================
✅ All tests completed!
```

---

## 🎯 Success Criteria

### ✅ All Tests Pass When:

1. **Price Fetch:**
   - Console shows price in format: `$X.XXXXXX`
   - UI card is green with price displayed
   - Price is a positive number

2. **Validation:**
   - Console shows USD value calculation
   - Console shows valid/invalid status
   - UI shows correct validation result
   - Math is correct: tokens × price = USD

3. **Error Handling:**
   - No console errors
   - Returns null for invalid mint
   - UI shows success (green card)
   - Application doesn't crash

---

## ⚠️ Troubleshooting

### Issue: All Tests Show Red/Failed

**Cause:** Network issue or API unavailable

**Solution:**
1. Check internet connection
2. Try again in a few moments (DexScreener rate limit)
3. Hard refresh browser: `Ctrl+Shift+R` or `Cmd+Shift+R`

---

### Issue: Test 1 Shows "No price data available"

**Cause:** Token might not have price on Helius

**Solution:**
1. Check if token is listed on DEX
2. Try with a well-known token (SOL, USDC)
3. Update `NUB_MINT` in `HeliusTestComponent.tsx`:

```typescript
// Try with SOL
const SOL_MINT = 'So11111111111111111111111111111111111111112'

// Or USDC
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
```

---

### Issue: Console Shows API Errors

**Possible Causes:**
- Rate limit exceeded
- Network issues
- Token not listed on any DEX

**Solutions:**
```
❌ "429 Too Many Requests"
   → Wait a minute, DexScreener rate limit

❌ Network error
   → Check internet connection

❌ "No price data for token"
   → Token not listed on DEX yet (this is expected for new tokens)
```

---

## 🔧 Customizing Tests

### Test Different Token

Edit `components/HeliusTestComponent.tsx`:

```typescript
// Change this line
const NUB_MINT = 'YOUR_TOKEN_MINT_HERE'
```

### Test Different Amount

Edit the test call:

```typescript
// Test with 1000 tokens instead of 300
const validation = await validateMinimumUsdValue(NUB_MINT, 1000, 5)
```

### Test Different Minimum

```typescript
// Test $10 minimum instead of $5
const validation = await validateMinimumUsdValue(NUB_MINT, 300, 10)
```

---

## 📋 Integration Checklist

Before using in production:

- [x] Test component created
- [x] Test page accessible at `/test/helius`
- [ ] Helius API key configured
- [ ] Tests run successfully
- [ ] Console shows expected output
- [ ] UI displays results correctly
- [ ] Error handling works (invalid mint returns null)
- [ ] Price validation logic works
- [ ] Ready to integrate into job creation flow

---

## 🚀 Next Steps After Testing

Once tests pass:

1. **Remove Test Page** (optional for production):
   ```bash
   rm -rf app/test/helius
   ```

2. **Keep Test Component** (useful for debugging):
   - Keep `HeliusTestComponent.tsx` for future testing
   - Can be used in admin/debug pages

3. **Integrate into Job System:**
   ```typescript
   // In CreateJobModal.tsx
   import { validateMinimumUsdValue } from '@/lib/helius'
   
   const validation = await validateMinimumUsdValue(
     tokenMint,
     paymentTokens,
     5
   )
   
   if (!validation.valid) {
     setError(`Payment must be at least $5 (currently $${validation.usdValue})`)
     return
   }
   ```

---

## 📊 Expected Test Results Summary

| Test | Input | Expected Output | Pass Criteria |
|------|-------|----------------|---------------|
| **Price Fetch** | NUB Mint | $0.023 (example) | Number or null, no errors |
| **Validation (Above Min)** | 300 tokens, $5 min | valid: true, usdValue: $7.04 | Correct math, true if ≥$5 |
| **Validation (Below Min)** | 100 tokens, $5 min | valid: false, usdValue: $2.35 | Correct math, false if <$5 |
| **Invalid Mint** | Fake address | null | Returns null, no crash |

---

## 🎓 Understanding the Tests

### Why These Tests Matter

**For Job System:**
- Ensures payments meet minimum $5 USD
- Prevents jobs with negligible payment
- Provides USD transparency for users

**For User Experience:**
- Clear error messages about payment amounts
- Real-time validation before posting
- No surprises after transaction

**For Platform:**
- Maintains quality of job marketplace
- Prevents spam/low-value jobs
- Professional standard

---

## 📞 Support

**If tests fail:**
1. Check console for detailed error messages
2. Verify API key in `.env.local`
3. Check [Helius Status](https://status.helius.dev)
4. Review [JOB_SYSTEM_LIBRARIES.md](./JOB_SYSTEM_LIBRARIES.md)

**API Key Issues:**
- Free tier: 100,000 requests/day
- Sign up: [https://helius.dev](https://helius.dev)
- Dashboard: [https://dashboard.helius.dev](https://dashboard.helius.dev)

---

**Created:** November 24, 2025  
**Status:** ✅ Ready to Test  
**Files:**
- `components/HeliusTestComponent.tsx`
- `app/test/helius/page.tsx`
- `lib/helius.ts`

**Test URL:** [http://localhost:3000/test/helius](http://localhost:3000/test/helius)

