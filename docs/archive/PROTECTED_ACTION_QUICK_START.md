# 🚀 ProtectedAction - Quick Start Guide

**TL;DR**: Wrap any UI element to ensure wallet is connected + verified before action executes.

---

## ⚡ 5-Minute Integration

### Step 1: Import

```tsx
import { ProtectedAction } from '@/components/ProtectedAction'
```

### Step 2: Wrap Your Button

```tsx
// Before
<Button onClick={handleCreateJob}>
  Create Job
</Button>

// After
<ProtectedAction 
  onAuthorized={handleCreateJob}
  actionName="create a job"
>
  <Button>Create Job</Button>
</ProtectedAction>
```

### Step 3: Done! 🎉

The component automatically:
- ✅ Checks if wallet is connected (opens modal if not)
- ✅ Checks if wallet is verified (shows error + auto-triggers verification)
- ✅ Only calls `onAuthorized` when both conditions are met

---

## 📦 Common Use Cases

### Create Job Button

```tsx
<ProtectedAction onAuthorized={() => setJobModalOpen(true)} actionName="create a job">
  <Button variant="contained">Create Job</Button>
</ProtectedAction>
```

### Send Tip Button

```tsx
<ProtectedAction onAuthorized={() => setTipModalOpen(true)} actionName="send a tip">
  <IconButton><MonetizationOnIcon /></IconButton>
</ProtectedAction>
```

### Send Message Button

```tsx
<ProtectedAction onAuthorized={sendMessage} actionName="send messages">
  <IconButton><SendIcon /></IconButton>
</ProtectedAction>
```

### Apply to Job Button

```tsx
<ProtectedAction onAuthorized={handleApply} actionName="apply to this job">
  <Button fullWidth>Apply Now</Button>
</ProtectedAction>
```

---

## 🎯 Props

| Prop | Required | Default | Example |
|------|----------|---------|---------|
| `children` | ✅ | - | `<Button>Click</Button>` |
| `onAuthorized` | ✅ | - | `() => createJob()` |
| `actionName` | ❌ | "perform this action" | `"create a job"` |
| `wrapper` | ❌ | `true` | `false` to avoid div wrapper |

---

## 🔄 User Flow

```
1. User clicks element
   ↓
2. Is wallet connected?
   NO → Open wallet modal + error
   YES → Continue
   ↓
3. Is wallet verified?
   NO → Show error + auto-trigger verification
   YES → Continue
   ↓
4. Execute onAuthorized()
```

---

## 💡 Tips

- Use descriptive `actionName` for better error messages
- `onAuthorized` only runs when fully authorized (no need to check inside)
- Works with any React element (buttons, links, cards, custom components)
- Set `wrapper={false}` if you need to avoid an extra div wrapper

---

## 📚 Full Documentation

See `PROTECTED_ACTION_COMPONENT.md` for:
- Complete API reference
- Advanced usage examples
- Testing guide
- Migration guide
- Best practices

---

## 🎉 That's It!

You now have a reusable component that handles wallet connection + verification for any action in your app!

