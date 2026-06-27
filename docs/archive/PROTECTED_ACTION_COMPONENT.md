# ✅ ProtectedAction Component - Complete Guide

**File**: `components/ProtectedAction.tsx`  
**Purpose**: Reusable wrapper that ensures wallet connection + verification before allowing actions  
**Status**: ✅ **COMPLETE**

---

## 🎯 What It Does

The `ProtectedAction` component wraps any UI element (buttons, links, cards, etc.) and automatically handles the wallet connection + verification flow before executing the desired action.

### Flow Diagram

```
User Clicks Element
       ↓
┌──────────────────┐
│ Connected?       │──No──→ Open Wallet Modal + Show Error
└──────────────────┘
       ↓ Yes
┌──────────────────┐
│ Checking Status? │──Yes──→ Show "Checking..." Toast
└──────────────────┘
       ↓ No
┌──────────────────┐
│ Verified?        │──No──→ Show "Please verify" Error
└──────────────────┘         (Auto-triggers verification flow)
       ↓ Yes
┌──────────────────┐
│ Execute Action   │
└──────────────────┘
```

---

## 📝 API Reference

### Props

```typescript
interface ProtectedActionProps {
  children: ReactNode          // The UI element to wrap
  onAuthorized: () => void     // Callback when user is authorized
  actionName?: string          // Descriptive name for error messages
  wrapper?: boolean            // Whether to use wrapper div (default: true)
}
```

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `children` | `ReactNode` | ✅ Yes | - | The UI element to wrap (button, link, etc.) |
| `onAuthorized` | `() => void` | ✅ Yes | - | Function to call when user is verified |
| `actionName` | `string` | ❌ No | `"perform this action"` | Action name for error messages |
| `wrapper` | `boolean` | ❌ No | `true` | Use wrapper div or clone child element |

---

## 🚀 Usage Examples

### Example 1: Basic Button Wrapper

```tsx
import { ProtectedAction } from '@/components/ProtectedAction'
import { Button } from '@mui/material'

function MyComponent() {
  const handleCreateJob = () => {
    // This only runs if wallet is connected AND verified
    console.log('Creating job...')
    // ... job creation logic
  }

  return (
    <ProtectedAction 
      onAuthorized={handleCreateJob}
      actionName="create a job"
    >
      <Button variant="contained">
        Create Job
      </Button>
    </ProtectedAction>
  )
}
```

### Example 2: Custom Button

```tsx
import { ProtectedAction } from '@/components/ProtectedAction'

function TipButton({ recipientWallet }: { recipientWallet: string }) {
  const handleSendTip = () => {
    console.log('Opening tip modal...')
    setTipModalOpen(true)
  }

  return (
    <ProtectedAction 
      onAuthorized={handleSendTip}
      actionName="send a tip"
    >
      <button className="custom-button">
        💰 Send Tip
      </button>
    </ProtectedAction>
  )
}
```

### Example 3: Link Wrapper

```tsx
import { ProtectedAction } from '@/components/ProtectedAction'
import Link from 'next/link'

function ApplyButton({ jobId }: { jobId: string }) {
  const router = useRouter()
  
  const handleApply = () => {
    router.push(`/jobs/${jobId}/apply`)
  }

  return (
    <ProtectedAction 
      onAuthorized={handleApply}
      actionName="apply to this job"
    >
      <Link href={`/jobs/${jobId}/apply`} onClick={(e) => e.preventDefault()}>
        Apply Now
      </Link>
    </ProtectedAction>
  )
}
```

### Example 4: Card/Complex Element

```tsx
import { ProtectedAction } from '@/components/ProtectedAction'
import { Card, CardContent, Typography } from '@mui/material'

function JobCard({ job }: { job: Job }) {
  const handleCardClick = () => {
    console.log('Opening job details...')
    // Only authorized users can view details
  }

  return (
    <ProtectedAction 
      onAuthorized={handleCardClick}
      actionName="view job details"
    >
      <Card sx={{ cursor: 'pointer' }}>
        <CardContent>
          <Typography variant="h6">{job.title}</Typography>
          <Typography variant="body2">{job.description}</Typography>
        </CardContent>
      </Card>
    </ProtectedAction>
  )
}
```

### Example 5: Form Submit

```tsx
import { ProtectedAction } from '@/components/ProtectedAction'
import { Button } from '@mui/material'

function MessageForm() {
  const [message, setMessage] = useState('')

  const handleSendMessage = async () => {
    // Only runs if verified
    const response = await fetch('/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({ message })
    })
    
    if (response.ok) {
      toast.success('Message sent!')
      setMessage('')
    }
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <textarea 
        value={message} 
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
      />
      
      <ProtectedAction 
        onAuthorized={handleSendMessage}
        actionName="send messages"
      >
        <Button type="submit">
          Send Message
        </Button>
      </ProtectedAction>
    </form>
  )
}
```

---

## 🎨 Integration Examples

### CreateJobModal Integration

**Before** (no protection):
```tsx
<Button onClick={handleCreateJob}>
  Create Job
</Button>
```

**After** (with ProtectedAction):
```tsx
<ProtectedAction 
  onAuthorized={handleCreateJob}
  actionName="create a job"
>
  <Button>Create Job</Button>
</ProtectedAction>
```

### TipModal Integration

**Before**:
```tsx
<Button onClick={() => setTipModalOpen(true)}>
  Send Tip
</Button>
```

**After**:
```tsx
<ProtectedAction 
  onAuthorized={() => setTipModalOpen(true)}
  actionName="send a tip"
>
  <Button>Send Tip</Button>
</ProtectedAction>
```

### MessageComposer Integration

**Before**:
```tsx
<IconButton onClick={sendMessage}>
  <SendIcon />
</IconButton>
```

**After**:
```tsx
<ProtectedAction 
  onAuthorized={sendMessage}
  actionName="send messages"
>
  <IconButton>
    <SendIcon />
  </IconButton>
</ProtectedAction>
```

---

## 🔧 Advanced Usage

### With Loading State

```tsx
function CreateJobButton() {
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateJob = async () => {
    setIsCreating(true)
    try {
      await createJob(...)
      toast.success('Job created!')
    } catch (error) {
      toast.error('Failed to create job')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <ProtectedAction 
      onAuthorized={handleCreateJob}
      actionName="create a job"
    >
      <Button disabled={isCreating}>
        {isCreating ? 'Creating...' : 'Create Job'}
      </Button>
    </ProtectedAction>
  )
}
```

### With Conditional Logic

```tsx
function ApplyButton({ job, hasApplied }: Props) {
  const handleApply = () => {
    if (hasApplied) {
      toast.info('You have already applied to this job')
      return
    }
    // Proceed with application
    setApplicationModalOpen(true)
  }

  return (
    <ProtectedAction 
      onAuthorized={handleApply}
      actionName="apply to jobs"
    >
      <Button disabled={hasApplied}>
        {hasApplied ? 'Already Applied' : 'Apply Now'}
      </Button>
    </ProtectedAction>
  )
}
```

### Without Wrapper (Direct Element Cloning)

```tsx
// Use wrapper={false} to avoid extra div wrapper
<ProtectedAction 
  onAuthorized={handleAction}
  actionName="perform action"
  wrapper={false}
>
  <Button>Action</Button>
</ProtectedAction>

// This clones the Button and adds onClick handler directly
// Useful when you need to avoid DOM nesting issues
```

---

## 💡 Best Practices

### ✅ DO

- **Use descriptive action names**
  ```tsx
  actionName="create a job"
  actionName="send a tip"
  actionName="apply to this job"
  ```

- **Keep onAuthorized handlers clean**
  ```tsx
  const handleCreateJob = async () => {
    setLoading(true)
    try {
      await createJob(...)
    } catch (error) {
      handleError(error)
    } finally {
      setLoading(false)
    }
  }
  ```

- **Provide user feedback**
  ```tsx
  const handleAction = async () => {
    const result = await doSomething()
    if (result.success) {
      toast.success('Action completed!')
    } else {
      toast.error('Action failed')
    }
  }
  ```

### ❌ DON'T

- **Don't wrap already-protected elements**
  ```tsx
  // BAD: Double wrapping
  <ProtectedAction onAuthorized={...}>
    <ProtectedAction onAuthorized={...}>
      <Button>Click</Button>
    </ProtectedAction>
  </ProtectedAction>
  ```

- **Don't use for public actions**
  ```tsx
  // BAD: Viewing public content doesn't need protection
  <ProtectedAction onAuthorized={viewPublicPost}>
    <Link>View Post</Link>
  </ProtectedAction>
  ```

- **Don't skip action names**
  ```tsx
  // BAD: Generic error message
  <ProtectedAction onAuthorized={handleAction}>
    <Button>Submit</Button>
  </ProtectedAction>
  
  // GOOD: Specific error message
  <ProtectedAction 
    onAuthorized={handleAction}
    actionName="submit your application"
  >
    <Button>Submit</Button>
  </ProtectedAction>
  ```

---

## 🧪 Testing

### Manual Testing Checklist

Test each state:

1. **Wallet Not Connected**
   - [ ] Click protected element
   - [ ] Should show "Please connect your wallet first"
   - [ ] Should open wallet modal
   - [ ] Action should NOT execute

2. **Wallet Connected, Not Verified**
   - [ ] Click protected element
   - [ ] Should show "Please verify your wallet to [action]"
   - [ ] WalletVerificationFlow should auto-trigger
   - [ ] Action should NOT execute

3. **Wallet Connected and Verified**
   - [ ] Click protected element
   - [ ] Action should execute immediately
   - [ ] No error messages

4. **During Verification Check**
   - [ ] Click while `isLoading` is true
   - [ ] Should show "Checking verification status..."
   - [ ] Action should NOT execute

### Example Test Cases

```tsx
// Test: Not connected
it('shows error when wallet not connected', () => {
  const onAuthorized = jest.fn()
  const { getByText } = render(
    <ProtectedAction onAuthorized={onAuthorized} actionName="test">
      <button>Click Me</button>
    </ProtectedAction>
  )
  
  fireEvent.click(getByText('Click Me'))
  expect(onAuthorized).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalledWith('Please connect your wallet first')
})

// Test: Connected but not verified
it('shows error when not verified', () => {
  // Mock: connected = true, isVerified = false
  const onAuthorized = jest.fn()
  const { getByText } = render(
    <ProtectedAction onAuthorized={onAuthorized} actionName="create a job">
      <button>Click Me</button>
    </ProtectedAction>
  )
  
  fireEvent.click(getByText('Click Me'))
  expect(onAuthorized).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalledWith('Please verify your wallet to create a job')
})

// Test: Verified
it('executes action when verified', () => {
  // Mock: connected = true, isVerified = true
  const onAuthorized = jest.fn()
  const { getByText } = render(
    <ProtectedAction onAuthorized={onAuthorized} actionName="test">
      <button>Click Me</button>
    </ProtectedAction>
  )
  
  fireEvent.click(getByText('Click Me'))
  expect(onAuthorized).toHaveBeenCalled()
})
```

---

## 🆚 Comparison with VerifyToUnlockButton

| Feature | ProtectedAction | VerifyToUnlockButton |
|---------|----------------|----------------------|
| **Use Case** | Wrap existing UI elements | Replace button with verify button |
| **Flexibility** | Wraps any element | Button only |
| **Visual** | Uses your design | Predefined verify button style |
| **Best For** | Existing UI, complex elements | New buttons, simple actions |

### When to Use Each

**Use ProtectedAction when:**
- ✅ You have existing UI elements (buttons, cards, links)
- ✅ You want to keep your custom design
- ✅ You need to protect complex interactions

**Use VerifyToUnlockButton when:**
- ✅ You want a consistent verify button across the app
- ✅ You're building new UI from scratch
- ✅ You want the built-in verification flow UI

### Example Comparison

```tsx
// ProtectedAction: Keeps your button design
<ProtectedAction onAuthorized={handleAction} actionName="create job">
  <Button variant="contained" color="primary" size="large">
    Create Job
  </Button>
</ProtectedAction>

// VerifyToUnlockButton: Replaces button entirely
{!isVerified ? (
  <VerifyToUnlockButton 
    label="Create Job" 
    onVerified={handleAction}
    size="large"
  />
) : (
  <Button onClick={handleAction}>Create Job</Button>
)}
```

---

## 🔄 Migration Guide

### Migrating Existing Components

**Step 1**: Import ProtectedAction
```tsx
import { ProtectedAction } from '@/components/ProtectedAction'
```

**Step 2**: Identify actions that need protection
- Job creation buttons
- Tip sending buttons
- Message sending buttons
- Application submission buttons

**Step 3**: Wrap with ProtectedAction
```tsx
// Before
<Button onClick={handleCreateJob}>Create Job</Button>

// After
<ProtectedAction onAuthorized={handleCreateJob} actionName="create a job">
  <Button>Create Job</Button>
</ProtectedAction>
```

**Step 4**: Update click handlers
```tsx
// Before: Handler checks verification
const handleClick = () => {
  if (!isVerified) {
    toast.error('Please verify')
    return
  }
  createJob()
}

// After: Handler assumes verification
const handleClick = () => {
  // ProtectedAction ensures this only runs when verified
  createJob()
}
```

---

## 📊 Implementation Status

### Components to Update

| Component | File | Status | Priority |
|-----------|------|--------|----------|
| CreateJobModal | `components/CreateJobModal.tsx` | ⏳ TODO | High |
| TipModal | `components/TipModal.tsx` | ⏳ TODO | High |
| MessageComposer | `components/MessageComposer.tsx` | ⏳ TODO | Medium |
| JobApplicationModal | `components/JobApplicationModal.tsx` | ✅ Page-level protection | Low |

---

## ✨ Summary

**ProtectedAction is a powerful wrapper that:**
- ✅ Ensures wallet connection before actions
- ✅ Ensures wallet verification before actions
- ✅ Provides clear user feedback at each step
- ✅ Works with any UI element (buttons, links, cards, etc.)
- ✅ Maintains your custom design and styling
- ✅ Simplifies frontend protection logic

**Next Steps:**
1. Integrate into CreateJobModal
2. Integrate into TipModal
3. Integrate into MessageComposer
4. Test all flows end-to-end

The component is **production-ready** and can be used immediately! 🚀

