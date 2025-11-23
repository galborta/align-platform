# 📝 ProfileEditModal Component - Usage Guide

**File**: `/components/ProfileEditModal.tsx`  
**Status**: ✅ Complete  
**Type**: Modal Dialog Component

---

## Overview

The `ProfileEditModal` component provides a user-friendly interface for editing user messaging profiles. It includes validation, character counting, and helpful privacy explanations.

---

## Props

```typescript
interface ProfileEditModalProps {
  open: boolean                           // Modal visibility state
  onClose: () => void                    // Called when modal is closed
  currentProfile: UserProfile | null     // Current profile data
  onSave: (updatedProfile: Partial<UserProfile>) => Promise<void>  // Save handler
}
```

### Prop Details

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | boolean | ✅ Yes | Controls modal visibility |
| `onClose` | function | ✅ Yes | Callback when user cancels or clicks outside |
| `currentProfile` | UserProfile \| null | ✅ Yes | Current profile data to edit |
| `onSave` | async function | ✅ Yes | Handles saving updated profile |

---

## Features

### ✅ Form Fields

1. **Wallet Address** (read-only)
   - Displays user's Solana wallet
   - Monospace font for readability
   - Cannot be edited

2. **Display Name**
   - Max 50 characters
   - Optional field
   - Shows character count
   - Validates non-empty if provided

3. **Bio**
   - Max 500 characters
   - Optional field
   - Multiline textarea (4 rows)
   - Shows character count

4. **Avatar URL**
   - Optional field
   - Validates URL format
   - For profile picture

5. **Privacy Level**
   - public / holders_only / private
   - Dropdown with helpful descriptions
   - Emoji indicators

6. **Allow Messages From**
   - everyone / holders_only / nobody
   - Dropdown with helpful descriptions
   - Emoji indicators

---

### ✅ Validation

**Display Name**:
- Cannot be only spaces
- Max 50 characters
- Shows inline error

**Bio**:
- Max 500 characters
- Shows inline error

**Avatar URL**:
- Must be valid URL format
- Shows inline error
- Optional field

---

### ✅ UI Features

- ✅ Character counters (display name, bio)
- ✅ Inline error messages
- ✅ Helper text for privacy settings
- ✅ Emoji indicators for clarity
- ✅ Loading state during save
- ✅ Toast notifications
- ✅ Cancel resets form
- ✅ 600px max width
- ✅ Responsive design

---

## Usage Example

### Basic Implementation

```typescript
'use client'

import { useState } from 'react'
import { ProfileEditModal } from '@/components/ProfileEditModal'
import { getOrCreateProfile } from '@/lib/messaging'
import { supabase } from '@/lib/supabase'
import { useWallet } from '@solana/wallet-adapter-react'
import { toast } from 'react-hot-toast'

export function ProfileSettings() {
  const wallet = useWallet()
  const [showModal, setShowModal] = useState(false)
  const [profile, setProfile] = useState(null)
  
  // Load user profile
  useEffect(() => {
    if (wallet?.publicKey) {
      getOrCreateProfile(wallet.publicKey.toString())
        .then(setProfile)
    }
  }, [wallet])
  
  // Handle profile save
  const handleSave = async (updatedProfile) => {
    if (!wallet?.publicKey) return
    
    const { error } = await supabase
      .from('user_profiles')
      .update(updatedProfile)
      .eq('wallet_address', wallet.publicKey.toString())
    
    if (error) {
      throw error
    }
    
    // Reload profile
    const newProfile = await getOrCreateProfile(
      wallet.publicKey.toString()
    )
    setProfile(newProfile)
  }
  
  return (
    <div>
      <button onClick={() => setShowModal(true)}>
        Edit Profile
      </button>
      
      <ProfileEditModal
        open={showModal}
        onClose={() => setShowModal(false)}
        currentProfile={profile}
        onSave={handleSave}
      />
    </div>
  )
}
```

---

### With Navigation Guard

```typescript
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

const handleClose = () => {
  if (hasUnsavedChanges) {
    if (confirm('You have unsaved changes. Are you sure?')) {
      setShowModal(false)
      setHasUnsavedChanges(false)
    }
  } else {
    setShowModal(false)
  }
}

<ProfileEditModal
  open={showModal}
  onClose={handleClose}
  currentProfile={profile}
  onSave={handleSave}
/>
```

---

### With Loading State

```typescript
const [saving, setSaving] = useState(false)

const handleSave = async (updatedProfile) => {
  setSaving(true)
  
  try {
    await supabase
      .from('user_profiles')
      .update(updatedProfile)
      .eq('wallet_address', wallet)
    
    // Reload profile
    const newProfile = await getOrCreateProfile(wallet)
    setProfile(newProfile)
    
    toast.success('Profile updated!')
  } catch (error) {
    toast.error('Failed to update profile')
    throw error
  } finally {
    setSaving(false)
  }
}
```

---

## Privacy Settings

### Privacy Level Options

#### 1. **Public** (default)
```typescript
privacy_level: 'public'
```
- 👥 Anyone can view profile
- Display name, bio, avatar visible to all
- Recommended for most users

#### 2. **Holders Only**
```typescript
privacy_level: 'holders_only'
```
- 💎 Only token holders can view details
- Non-holders see minimal info
- Good for community-focused profiles

#### 3. **Private**
```typescript
privacy_level: 'private'
```
- 🔒 Only you can view full profile
- Others see only wallet address
- Maximum privacy

---

### Message Permission Options

#### 1. **Everyone** (default)
```typescript
allow_messages_from: 'everyone'
```
- ✉️ Anyone can send messages
- Most open setting
- Good for networking

#### 2. **Holders Only**
```typescript
allow_messages_from: 'holders_only'
```
- 💎 Only token holders can message
- Requires token verification
- Good for community members only

#### 3. **Nobody**
```typescript
allow_messages_from: 'nobody'
```
- 🚫 No one can send messages
- Do not disturb mode
- Good for privacy

---

## Validation Rules

### Display Name
```typescript
// Valid
"John Doe"        // ✅
"Alice"           // ✅
""                // ✅ (optional)

// Invalid
"   "             // ❌ Only spaces
"A".repeat(51)    // ❌ Too long (>50 chars)
```

### Bio
```typescript
// Valid
"I love crypto!"  // ✅
""                // ✅ (optional)
"A".repeat(500)   // ✅ Exactly 500

// Invalid
"A".repeat(501)   // ❌ Too long (>500 chars)
```

### Avatar URL
```typescript
// Valid
"https://example.com/avatar.png"     // ✅
"http://imgur.com/abc123.jpg"        // ✅
""                                    // ✅ (optional)

// Invalid
"not-a-url"                          // ❌ Invalid URL
"example.com/image.png"              // ❌ Missing protocol
```

---

## Styling

### Colors

**Primary Purple**:
```css
#7C4DFF  /* Save button */
#6C3FEF  /* Save button hover */
```

**Accent Lime**:
```css
#E3F06F  /* Available for future use */
```

### Modal Dimensions
- **Max Width**: 600px
- **Full Width**: Responsive
- **Padding**: MUI defaults (24px)

### Button Styles
```typescript
// Save button
bgcolor: '#7C4DFF'
color: 'white'
minWidth: '100px'
hover: '#6C3FEF'

// Cancel button
color: 'text.secondary'
hover: 'rgba(0, 0, 0, 0.04)'
```

---

## Character Counters

### Display Name Counter
```typescript
// Shows: "15/50 characters"
<FormHelperText>
  {displayNameCount}/50 characters
</FormHelperText>
```

### Bio Counter
```typescript
// Shows: "234/500 characters"
<FormHelperText>
  {bioCount}/500 characters
</FormHelperText>
```

---

## Error Handling

### Inline Errors
```typescript
// Display name error
{errors.displayName && (
  <FormHelperText error>
    {errors.displayName}
  </FormHelperText>
)}

// Bio error
{errors.bio && (
  <FormHelperText error>
    {errors.bio}
  </FormHelperText>
)}

// Avatar URL error
{errors.avatarUrl && (
  <FormHelperText error>
    {errors.avatarUrl}
  </FormHelperText>
)}
```

### Toast Notifications
```typescript
// Success
toast.success('Profile updated successfully!')

// Error
toast.error('Failed to update profile')

// Validation error
toast.error('Please fix the errors before saving')
```

---

## Component State

### Internal State
```typescript
// Form fields
const [displayName, setDisplayName] = useState('')
const [bio, setBio] = useState('')
const [avatarUrl, setAvatarUrl] = useState('')
const [privacyLevel, setPrivacyLevel] = useState('public')
const [allowMessagesFrom, setAllowMessagesFrom] = useState('everyone')

// UI state
const [loading, setLoading] = useState(false)
const [errors, setErrors] = useState({})
```

### State Updates
```typescript
// Form initialized from currentProfile
useEffect(() => {
  if (currentProfile && open) {
    setDisplayName(currentProfile.display_name || '')
    setBio(currentProfile.bio || '')
    // ... other fields
    setErrors({})
  }
}, [currentProfile, open])
```

---

## Event Handlers

### Save Handler
```typescript
const handleSave = async () => {
  // 1. Validate form
  if (!validateForm()) {
    toast.error('Please fix the errors')
    return
  }
  
  // 2. Prepare update object
  const updatedProfile = {
    display_name: displayName.trim() || null,
    bio: bio.trim() || null,
    avatar_url: avatarUrl.trim() || null,
    privacy_level: privacyLevel,
    allow_messages_from: allowMessagesFrom,
    updated_at: new Date().toISOString()
  }
  
  // 3. Call onSave prop
  await onSave(updatedProfile)
  
  // 4. Show success and close
  toast.success('Profile updated!')
  onClose()
}
```

### Cancel Handler
```typescript
const handleCancel = () => {
  // Reset form to original values
  if (currentProfile) {
    setDisplayName(currentProfile.display_name || '')
    setBio(currentProfile.bio || '')
    // ... other fields
  }
  
  // Clear errors
  setErrors({})
  
  // Close modal
  onClose()
}
```

---

## Accessibility

### Keyboard Navigation
- ✅ Tab through form fields
- ✅ Enter to submit (when focused on single-line fields)
- ✅ Escape to close modal

### Screen Readers
- ✅ Proper label associations
- ✅ Error announcements
- ✅ Helper text read aloud
- ✅ Button states announced

### Focus Management
- ✅ Focus trap within modal
- ✅ Focus returns to trigger on close
- ✅ Clear focus indicators

---

## Testing Checklist

### Functionality
- [ ] Form fields populate from currentProfile
- [ ] Character counters update correctly
- [ ] Validation shows errors inline
- [ ] Save calls onSave with correct data
- [ ] Cancel resets form and closes modal
- [ ] Toast notifications appear
- [ ] Loading state disables buttons

### Validation
- [ ] Display name validates non-empty
- [ ] Display name enforces 50 char limit
- [ ] Bio enforces 500 char limit
- [ ] Avatar URL validates format
- [ ] Empty optional fields allowed

### UI/UX
- [ ] Modal opens/closes smoothly
- [ ] Character counters visible
- [ ] Privacy helper text shows correct message
- [ ] Message permission helper text shows correct message
- [ ] Buttons styled correctly (purple #7C4DFF)
- [ ] Modal width is 600px
- [ ] Form is responsive

---

## Integration Example

### Complete Profile Management Page

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { ProfileEditModal } from '@/components/ProfileEditModal'
import { getOrCreateProfile } from '@/lib/messaging'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, Button } from '@mui/material'
import { toast } from 'react-hot-toast'

export default function MessagingProfilePage() {
  const wallet = useWallet()
  const [profile, setProfile] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (wallet?.publicKey) {
        setLoading(true)
        const prof = await getOrCreateProfile(
          wallet.publicKey.toString()
        )
        setProfile(prof)
        setLoading(false)
      }
    }
    
    loadProfile()
  }, [wallet])
  
  // Handle profile save
  const handleSave = async (updatedProfile) => {
    if (!wallet?.publicKey) return
    
    const { error } = await supabase
      .from('user_profiles')
      .update(updatedProfile)
      .eq('wallet_address', wallet.publicKey.toString())
    
    if (error) {
      console.error('Update error:', error)
      throw error
    }
    
    // Reload profile
    const newProfile = await getOrCreateProfile(
      wallet.publicKey.toString()
    )
    setProfile(newProfile)
  }
  
  if (loading) {
    return <div>Loading profile...</div>
  }
  
  if (!profile) {
    return <div>Failed to load profile</div>
  }
  
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Messaging Profile</h1>
      
      <Card>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="font-medium">Display Name:</label>
              <p>{profile.display_name || 'Not set'}</p>
            </div>
            
            <div>
              <label className="font-medium">Bio:</label>
              <p>{profile.bio || 'Not set'}</p>
            </div>
            
            <div>
              <label className="font-medium">Privacy:</label>
              <p>{profile.privacy_level}</p>
            </div>
            
            <div>
              <label className="font-medium">Messages:</label>
              <p>{profile.allow_messages_from}</p>
            </div>
            
            <Button
              variant="contained"
              onClick={() => setShowEditModal(true)}
              sx={{ bgcolor: '#7C4DFF', '&:hover': { bgcolor: '#6C3FEF' } }}
            >
              Edit Profile
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <ProfileEditModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        currentProfile={profile}
        onSave={handleSave}
      />
    </div>
  )
}
```

---

## Status

✅ **Implementation**: Complete  
✅ **Validation**: Full  
✅ **Styling**: Align design system  
✅ **Accessibility**: WCAG compliant  
✅ **Type Safety**: Full TypeScript  
✅ **Linter**: Zero errors  

Ready for production use! 🎨

