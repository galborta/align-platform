# Authentication Fix Plan

## Problem
- API endpoints require Supabase JWT authentication
- Users only verify wallet ownership via signatures (no JWT sessions created)
- When trying to cancel jobs or perform other actions, users get "Authentication required"

## Current State
- Wallet verification creates profile in `user_profiles` table
- No Supabase auth.users entry or JWT session created
- API endpoints check for JWT tokens that don't exist

## Solution Options

### Option 1: Create Supabase Auth Sessions (Recommended Long-term)
After wallet verification, create a Supabase auth user and session:
1. In `/api/wallet/verify`, after profile creation, call `supabaseAdmin.auth.admin.createUser()`
2. Return session token to frontend
3. Frontend stores session and uses for API calls

**Pros:**
- Works with existing API JWT checks
- Standard auth pattern
- Session management built-in

**Cons:**
- Requires migration to link existing profiles to auth.users
- Changes to wallet verification flow
- Need to handle session expiry/refresh

### Option 2: Wallet-Signature Per-Action (Web3 Native)
For each sensitive action, user signs a message:
1. Frontend generates action-specific message (e.g., "Cancel job ABC123")
2. User signs message with wallet
3. API verifies signature matches wallet and wallet is authorized

**Pros:**
- More secure (requires private key for each action)
- True Web3 authentication
- No session management needed
- Non-repudiation (signed proof of each action)

**Cons:**
- More wallet popups (UX friction)
- Need to update all API endpoints
- Need to handle nonces to prevent replay attacks

### Option 3: Hybrid Approach
Support both JWT (when available) AND wallet signatures:
1. Check for JWT first (future-proof)
2. Fall back to wallet signature verification
3. Gradually migrate to JWT sessions

## Recommended Immediate Fix
Use **Option 3 (Hybrid)** but implement signature auth first:

1. Update API endpoints to accept wallet signatures:
   ```typescript
   // Check for JWT (future)
   if (authHeader?.startsWith('Bearer ')) {
     // Existing JWT flow
   } else {
     // Wallet signature verification
     const { wallet, signature, message } = body
     if (!verifySolanaSignature(message, signature, wallet)) {
       return 401
     }
   }
   ```

2. Frontend signs message for each action:
   ```typescript
   const message = `Cancel job ${jobId} at ${Date.now()}`
   const signature = await signMessage(new TextEncoder().encode(message))
   
   await fetch('/api/jobs/${jobId}/cancel', {
     body: JSON.stringify({
       wallet: publicKey.toString(),
       signature: bs58.encode(signature),
       message,
       skip_karma_penalty: true
     })
   })
   ```

This provides immediate security while allowing future JWT migration.

