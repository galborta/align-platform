# 🔧 Chat Feature Troubleshooting Guide

## Issue: "You must hold tokens" Error (403)

**Symptom**: Getting 403 Forbidden even though you hold tokens

**Common Causes & Solutions**:

---

## ✅ Fix #1: Network Mismatch (MOST COMMON)

### Problem
Your wallet is connected to **mainnet** but the API is checking **devnet** (or vice versa).

### Check Your Configuration

**Wallet Config** (`lib/wallet-config.tsx`):
```typescript
const network = WalletAdapterNetwork.Mainnet  // ← You're on MAINNET
const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(network)
```

**API Config** (`app/api/chat/send/route.ts`):
```typescript
const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com'
                    // ↑ Different env var!                  ↑ Defaults to DEVNET!
```

### Solution: Use the Same Environment Variable

**Option A: Update API to use same env var** (Recommended)

Update `app/api/chat/send/route.ts`:
```typescript
// Before
const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com'

// After
const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
```

**Option B: Set both env vars in `.env.local`**

```env
# Use the same endpoint for both!
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_RPC_ENDPOINT=https://api.mainnet-beta.solana.com

# Or if using Helius (recommended for better rate limits)
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

---

## ✅ Fix #2: Check Network in Terminal

When you try to send a message, check the terminal output:

```bash
Checking token holdings for wallet: YOUR_WALLET_ADDRESS
Token mint: TOKEN_MINT_ADDRESS
RPC endpoint: https://api.devnet.solana.com  # ← Is this correct?
```

**If it says `devnet` but your wallet is on `mainnet`** → Network mismatch!

**If it says `mainnet` but your wallet is on `devnet`** → Network mismatch!

---

## ✅ Fix #3: Verify Token Account Exists

Your wallet needs to have an **associated token account** for the token.

### Check Manually

Go to Solscan and search for your wallet:
- **Mainnet**: https://solscan.io/account/YOUR_WALLET_ADDRESS
- **Devnet**: https://solscan.io/account/YOUR_WALLET_ADDRESS?cluster=devnet

Look for the token in your "Token Accounts" section.

### If Token Account Doesn't Exist

You need to create the token account first:
1. Receive at least 1 token from someone
2. Or: Create the account manually (requires small SOL fee)

---

## ✅ Fix #4: Check Token Balance

The improved error handling will now log:

```bash
# If account doesn't exist:
No token account found for wallet YOUR_WALLET

# If account exists but balance is 0:
Token account exists but balance is 0 for wallet YOUR_WALLET

# If successful:
Holder info for YOUR_WALLET: 10 tokens (0.000001%), tier: small
```

---

## ✅ Fix #5: RPC Rate Limiting

If using public RPC endpoints, you might hit rate limits.

### Symptoms
- Intermittent failures
- Works sometimes, fails other times
- "Failed to get holder info" errors

### Solution
Use a paid RPC provider (recommended):

```env
# Helius (free tier: 100k requests/day)
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# Or QuickNode, Alchemy, etc.
```

---

## 🐛 Debug Checklist

Run through this checklist:

### 1. Check Environment Variables
```bash
# In your .env.local file
cat .env.local | grep RPC

# Should show:
# NEXT_PUBLIC_SOLANA_RPC_URL=...
# NEXT_PUBLIC_RPC_ENDPOINT=...
```

### 2. Check Network Match
- [ ] Wallet network: _____ (check wallet UI)
- [ ] API endpoint network: _____ (check terminal logs)
- [ ] Do they match? ⬜ Yes ⬜ No

### 3. Check Token Account
- [ ] Go to Solscan
- [ ] Search your wallet address
- [ ] Token appears in "Token Accounts"? ⬜ Yes ⬜ No
- [ ] Balance > 0? ⬜ Yes ⬜ No

### 4. Check Terminal Logs
When sending a message, you should see:
```bash
✅ Checking token holdings for wallet: ...
✅ Token mint: ...
✅ RPC endpoint: ...
✅ Holder info for ...: X tokens (X.XXXXXX%), tier: small
✅ Holder validated: ...
```

If you see ❌ errors instead, that's where the problem is.

---

## 🔧 Quick Fix Commands

### Restart Dev Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

### Clear Next.js Cache
```bash
rm -rf .next
npm run dev
```

### Check Environment Variables are Loaded
Add this temporarily to your API route:
```typescript
console.log('ENV CHECK:', {
  hasRpcEndpoint: !!process.env.NEXT_PUBLIC_RPC_ENDPOINT,
  hasSolanaRpcUrl: !!process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  rpcEndpoint: process.env.NEXT_PUBLIC_RPC_ENDPOINT,
  solanaRpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL
})
```

---

## 📝 Your Specific Issue

Based on your error:
```
Failed to get holder info: Error [TokenAccountNotFoundError]
POST /api/chat/send 403 (Forbidden)
```

**Most Likely Cause**: Network mismatch

**Your situation**:
- ✅ You hold 10 tokens
- ✅ Your wallet is connected
- ❌ API can't find your token account

**This means**: API is looking on the **wrong network** (probably devnet when you're on mainnet)

**Fix**: Update the API endpoint to match your wallet network (see Fix #1 above)

---

## 🚀 Apply the Fix

**Quick fix for your case**:

1. Open `app/api/chat/send/route.ts`
2. Find line 55
3. Change:
```typescript
const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com'
```

To:
```typescript
const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
```

4. Save and refresh your browser
5. Try sending a message again

**Check terminal output** - you should now see your token balance detected! ✅

---

## 📞 Still Not Working?

If you've tried everything above and it's still not working:

1. **Share terminal output** when you try to send a message
2. **Share your wallet address** (just for debugging)
3. **Share the token mint address**
4. **Confirm which network** (mainnet/devnet) your wallet is on

I'll help debug further! 🔍

