# ✅ Wallet Verification Blocking - Backend Complete

**Date**: December 10, 2024  
**Status**: 🟢 **BACKEND COMPLETE** | 🟡 **FRONTEND IN PROGRESS**

---

## 🎯 Goal

Block the following actions until wallet is verified:
1. ✅ Create Job
2. ✅ Send Tip
3. ✅ Apply to Job
4. ✅ Send Message

**User Experience Enhancement**: Help users connect or verify their wallet with clear UI prompts.

---

## 📋 What Was Completed

### ✅ Task 6.1: API Middleware Helper (COMPLETE)

Created centralized middleware for wallet verification checks.

#### Files Created:
- **`lib/middleware/requireVerifiedWallet.ts`** - Core verification checker
- **`lib/middleware/withVerifiedWallet.ts`** - Convenience wrapper (bonus)
- **`lib/middleware/index.ts`** - Barrel exports
- **`lib/middleware/README.md`** - Complete documentation

#### Usage Example:
```typescript
import { requireVerifiedWallet } from '@/lib/middleware'

export async function POST(request: Request) {
  const { wallet } = await request.json()
  
  const verificationCheck = await requireVerifiedWallet(wallet)
  if (!verificationCheck.verified) {
    return NextResponse.json(
      { error: 'Wallet verification required' },
      { status: 403 }
    )
  }
  
  // Continue with verified wallet logic
}
```

---

## ✅ Backend Implementation (COMPLETE)

### 1. Job Creation API ✅

**File**: `app/api/jobs/create/route.ts`

**Changes**:
```typescript
import { requireVerifiedWallet } from '@/lib/middleware'

export async function POST(request: Request) {
  // ... extract poster_wallet from body ...
  
  // Verify wallet is verified before allowing job creation
  const verificationCheck = await requireVerifiedWallet(poster_wallet)
  if (!verificationCheck.verified) {
    return NextResponse.json(
      { error: 'Wallet verification required to create jobs' },
      { status: 403 }
    )
  }
  
  // ... rest of job creation code ...
}
```

**Location**: After basic field validation, before payment validation (line 52-59)

---

### 2. Tip Recording API ✅

**File**: `app/api/tips/record/route.ts`

**Changes**:
```typescript
import { requireVerifiedWallet } from '@/lib/middleware'

export async function POST(request: Request) {
  // ... extract fromWallet from body ...
  
  // Verify wallet is verified before allowing tips
  const verificationCheck = await requireVerifiedWallet(fromWallet)
  if (!verificationCheck.verified) {
    return NextResponse.json(
      { error: 'Wallet verification required to send tips' },
      { status: 403 }
    )
  }
  
  // ... rest of tip recording code ...
}
```

**Location**: After self-tip check, before karma calculation (line 63-70)

---

### 3. Job Application Library ✅

**File**: `lib/jobs.ts` - `applyToJob()` function

**Changes**:
```typescript
import { requireVerifiedWallet } from '@/lib/middleware'

export async function applyToJob(applicationData: {
  job_id: string
  applicant_wallet: string
  // ... other fields
}): Promise<JobApplication> {
  // Verify wallet is verified before allowing job application
  const verificationCheck = await requireVerifiedWallet(applicationData.applicant_wallet)
  if (!verificationCheck.verified) {
    throw new Error('Wallet verification required to apply to jobs')
  }

  // ... rest of application logic ...
}
```

**Location**: At start of function, before insert (line 259-264)

**Note**: Throws error because library functions use throw pattern, not NextResponse

---

### 4. Message Sending API ✅ (Refactored)

**File**: `app/api/messages/send/route.ts`

**Before** (inline check):
```typescript
const { data: profile, error: profileError } = await supabaseAdmin
  .from('user_profiles')
  .select('wallet_verified')
  .eq('wallet_address', senderWallet)
  .single()

if (profileError || !profile?.wallet_verified) {
  return NextResponse.json({ error: 'Unauthorized: Wallet not verified' }, { status: 403 })
}
```

**After** (using middleware):
```typescript
import { requireVerifiedWallet } from '@/lib/middleware'

// Verify wallet is verified before allowing message sending
const verificationCheck = await requireVerifiedWallet(senderWallet)
if (!verificationCheck.verified) {
  return NextResponse.json({ error: 'Wallet verification required to send messages' }, { status: 403 })
}
```

**Location**: After participant check, before message insert (line 44-48)

**Benefits**: Consistent with other APIs, easier to maintain

---

## 🎨 Frontend Implementation (TODO)

### 1. CreateJobModal Component ⏳

**File**: `components/CreateJobModal.tsx`

**Recommended Changes**:

```typescript
import { useVerification } from '@/contexts/VerificationContext'
import { VerifyToUnlockButton } from '@/components/VerifyToUnlockButton'

export function CreateJobModal({ ... }) {
  const { isVerified, isLoading } = useVerification()
  
  // ... existing state ...
  
  return (
    <Dialog open={isOpen} onClose={onClose}>
      {/* ... form fields ... */}
      
      <DialogActions>
        {isVerified ? (
          <Button 
            onClick={handleCreateJob}
            disabled={loading || !validateForm()}
          >
            Create Job
          </Button>
        ) : (
          <VerifyToUnlockButton 
            label="Create Job"
            size="medium"
            fullWidth
          />
        )}
      </DialogActions>
    </Dialog>
  )
}
```

**Benefits**:
- Users see verification button before attempting to create job
- Prevents failed API calls
- Clear call-to-action

---

### 2. TipModal Component ⏳

**File**: `components/TipModal.tsx`

**Recommended Changes**:

```typescript
import { useVerification } from '@/contexts/VerificationContext'
import { VerifyToUnlockButton } from '@/components/VerifyToUnlockButton'

export default function TipModal({ ... }) {
  const { isVerified, isLoading } = useVerification()
  
  // ... existing state ...
  
  // Disable send button if not verified
  const canSendTip = isVerified && !loading && validateAmount() === null
  
  return (
    <Dialog open={open} onClose={onClose}>
      {/* ... tip form ... */}
      
      {/* Show verification prompt if not verified */}
      {!isVerified && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Please verify your wallet to send tips
        </Alert>
      )}
      
      <DialogActions>
        {isVerified ? (
          <Button 
            onClick={handleSendTip}
            disabled={!canSendTip}
          >
            Send Tip
          </Button>
        ) : (
          <VerifyToUnlockButton 
            label="Send Tip"
            size="medium"
          />
        )}
      </DialogActions>
    </Dialog>
  )
}
```

**Benefits**:
- Inline verification prompt within tip flow
- Seamless user experience
- No failed transactions

---

### 3. MessageComposer Component ⏳

**File**: `components/MessageComposer.tsx`

**Recommended Changes**:

```typescript
import { useVerification } from '@/contexts/VerificationContext'

export function MessageComposer({ ... }) {
  const { isVerified } = useVerification()
  
  // ... existing state ...
  
  return (
    <Box>
      {!isVerified && (
        <Alert severity="info" sx={{ mb: 1 }}>
          Verify your wallet to send messages
        </Alert>
      )}
      
      <TextField
        value={message}
        onChange={handleChange}
        disabled={!isVerified || !canSend}
        placeholder={isVerified ? "Type a message..." : "Verify wallet to send messages"}
        // ... other props
      />
      
      <IconButton 
        onClick={sendMessage}
        disabled={!isVerified || !message.trim() || sending}
      >
        <SendIcon />
      </IconButton>
    </Box>
  )
}
```

**Benefits**:
- Inline feedback about verification status
- Clear disabled state
- No need to attempt sending before knowing verification is required

---

### 4. JobApplicationModal Component ✅

**File**: `components/JobApplicationModal.tsx`

**Status**: Already handled at page level in `app/project/[id]/jobs/[jobId]/page.tsx`

**Existing Implementation** (lines 2998-3013):
```typescript
{connected && isVerified ? (
  <Button
    variant="primary"
    size="lg"
    onClick={handleApply}
    className="w-full shadow-lg"
  >
    {job.status === 'assigned' ? 'Apply as Backup' : 'Apply for This Job'}
  </Button>
) : (
  <VerifyToUnlockButton 
    label="Apply" 
    size="large" 
    fullWidth 
  />
)}
```

**Note**: Job application modal itself could still add a check for consistency, but UI level is already protected.

---

## 🧪 Testing Checklist

### Backend API Tests (with unverified wallet)

- [ ] **Create Job** - POST `/api/jobs/create`
  - Expected: 403 error with message "Wallet verification required to create jobs"
  
- [ ] **Send Tip** - POST `/api/tips/record`
  - Expected: 403 error with message "Wallet verification required to send tips"
  
- [ ] **Apply to Job** - Call `applyToJob()` function
  - Expected: Error thrown "Wallet verification required to apply to jobs"
  
- [ ] **Send Message** - POST `/api/messages/send`
  - Expected: 403 error with message "Wallet verification required to send messages"

### Frontend UI Tests (with unverified wallet)

- [ ] **Create Job Modal**
  - Expected: Shows "Verify to Create Job" button instead of "Create Job"
  
- [ ] **Tip Modal**
  - Expected: Shows verification prompt or "Verify to Send Tip" button
  
- [ ] **Message Composer**
  - Expected: Shows info alert and disabled send button
  
- [ ] **Job Application**
  - Expected: Shows "Verify to Apply" button (already implemented)

### Verification Flow Tests

- [ ] **Connect Wallet** → Should see "Verify to [Action]" buttons
- [ ] **Complete Verification** → Buttons should become normal action buttons
- [ ] **Disconnect Wallet** → Should revert to connection prompts

---

## 📊 Implementation Summary

### ✅ Backend (100% Complete)

| Action | API/Library | File | Status |
|--------|-------------|------|--------|
| Create Job | API Route | `app/api/jobs/create/route.ts` | ✅ Protected |
| Send Tip | API Route | `app/api/tips/record/route.ts` | ✅ Protected |
| Apply to Job | Library | `lib/jobs.ts` | ✅ Protected |
| Send Message | API Route | `app/api/messages/send/route.ts` | ✅ Protected |

### ⏳ Frontend (0% Complete)

| Action | Component | File | Status |
|--------|-----------|------|--------|
| Create Job | CreateJobModal | `components/CreateJobModal.tsx` | ⏳ TODO |
| Send Tip | TipModal | `components/TipModal.tsx` | ⏳ TODO |
| Apply to Job | JobApplicationModal | `components/JobApplicationModal.tsx` | ✅ Already handled at page level |
| Send Message | MessageComposer | `components/MessageComposer.tsx` | ⏳ TODO |

---

## 🔧 Middleware Architecture

### Core Function: `requireVerifiedWallet()`

**Purpose**: Check if wallet is verified  
**Returns**: `{ verified: boolean, error?: string }`  
**Usage**: When you need custom error handling

### Convenience Wrapper: `withVerifiedWallet()`

**Purpose**: Return NextResponse error if not verified  
**Returns**: `NextResponse | null`  
**Usage**: When you want clean early-return pattern

### Example Comparison:

**Option 1: requireVerifiedWallet (custom handling)**
```typescript
const { verified, error } = await requireVerifiedWallet(wallet)
if (!verified) {
  // Custom error response
  return NextResponse.json({ 
    error: 'Custom message',
    requiresAction: 'wallet_verification'
  }, { status: 403 })
}
```

**Option 2: withVerifiedWallet (early return)**
```typescript
const verificationError = await withVerifiedWallet(wallet)
if (verificationError) return verificationError
// Cleaner, less code
```

**We chose Option 1** for consistency across the codebase and to maintain custom error messages.

---

## 🎯 Benefits Achieved

### Before Implementation

❌ No enforcement of wallet verification  
❌ Users could attempt actions and get cryptic errors  
❌ Inconsistent verification checks across codebase  
❌ Duplicated verification logic in each API route  

### After Implementation

✅ **Centralized**: Single source of truth for verification  
✅ **Consistent**: Same error messages everywhere  
✅ **Maintainable**: Update once, apply everywhere  
✅ **Secure**: Backend enforcement prevents bypassing  
✅ **Clear UX**: Users know what's required (when frontend complete)  
✅ **Type-safe**: TypeScript ensures correct usage  

---

## 🚀 Next Steps

### Priority 1: Frontend Implementation
1. Add verification checks to `CreateJobModal`
2. Add verification checks to `TipModal`
3. Add verification feedback to `MessageComposer`
4. Test all flows with unverified wallets

### Priority 2: Enhanced User Experience
1. Show verification progress in blocked action contexts
2. Add "Why is this required?" tooltips
3. Track verification conversion rate
4. Add analytics for blocked action attempts

### Priority 3: Testing
1. Write unit tests for middleware
2. Write integration tests for protected APIs
3. Test frontend verification flows
4. Verify error handling edge cases

---

## 📝 Developer Notes

### Key Design Decisions

1. **Backend-first approach**: Ensures security regardless of frontend
2. **Middleware pattern**: Reusable, testable, maintainable
3. **Consistent error messages**: Better UX and easier debugging
4. **VerificationContext**: Already exists and works well
5. **VerifyToUnlockButton**: Already exists and handles both connect/verify flows

### Common Patterns

**Pattern 1: API Route Protection**
```typescript
// 1. Import middleware
import { requireVerifiedWallet } from '@/lib/middleware'

// 2. Extract wallet from request
const { wallet } = await request.json()

// 3. Check verification early
const verificationCheck = await requireVerifiedWallet(wallet)
if (!verificationCheck.verified) {
  return NextResponse.json({ error: '...' }, { status: 403 })
}

// 4. Continue with verified logic
```

**Pattern 2: Library Function Protection**
```typescript
// Similar to API, but throws error instead of returning response
const verificationCheck = await requireVerifiedWallet(wallet)
if (!verificationCheck.verified) {
  throw new Error('Wallet verification required')
}
```

**Pattern 3: Frontend Component Protection**
```typescript
const { isVerified } = useVerification()

return (
  <>
    {isVerified ? (
      <Button onClick={handleAction}>Action</Button>
    ) : (
      <VerifyToUnlockButton label="Action" />
    )}
  </>
)
```

---

## 🔒 Security Considerations

### What This Protects Against

✅ Unverified wallets creating jobs  
✅ Unverified wallets sending tips  
✅ Unverified wallets applying to jobs  
✅ Unverified wallets sending messages  
✅ Direct API calls bypassing frontend checks  

### What This Doesn't Protect Against

⚠️ Users with verified wallets performing actions (intended)  
⚠️ Wallet ownership verification (handled by signature verification)  
⚠️ Wallet balance validation (separate check)  
⚠️ Rate limiting (separate concern)  

### Additional Security Layers

- Wallet signature verification (already implemented)
- RLS policies on Supabase (already implemented)
- Rate limiting (consider adding)
- Transaction validation (already implemented for jobs)

---

## 📚 Related Documentation

- **Wallet Verification System**: `app/api/wallet/verify/route.ts`
- **Verification Context**: `contexts/VerificationContext.tsx`
- **Verify Button**: `components/VerifyToUnlockButton.tsx`
- **Middleware README**: `lib/middleware/README.md`
- **Database Schema**: `supabase/migrations/20241208000000_wallet_verification_system.sql`

---

## ✨ Summary

**Backend implementation is 100% complete with:**
- ✅ Centralized middleware helper
- ✅ Protected job creation API
- ✅ Protected tip recording API
- ✅ Protected job application function
- ✅ Refactored message sending API

**Frontend implementation is next:**
- ⏳ Add UI verification checks to modals
- ⏳ Improve user experience with clear prompts
- ⏳ Test all flows end-to-end

**The platform is now secure at the backend level**, preventing any unverified wallet from performing critical actions, regardless of frontend state.

