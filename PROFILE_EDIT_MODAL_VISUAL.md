# 🎨 ProfileEditModal - Visual Structure

**File**: `/components/ProfileEditModal.tsx`

---

## Visual Layout (600px Modal)

```
┌─────────────────────────────────────────────────┐
│  Edit Profile                                 ✕ │
├─────────────────────────────────────────────────┤
│                                                 │
│  ℹ️ Customize your messaging profile. Your     │
│     wallet address cannot be changed.          │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Wallet Address                            │ │
│  │ 7xKXtg2...abc123 (monospace, disabled)    │ │
│  │ Your wallet address (cannot be changed)   │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Display Name                              │ │
│  │ [John Doe________________]                │ │
│  │ 8/50 characters                           │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Bio                                       │ │
│  │ [I love building on Solana!___________]  │ │
│  │ [__________________________________]      │ │
│  │ [__________________________________]      │ │
│  │ [__________________________________]      │ │
│  │ 31/500 characters                         │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Avatar URL                                │ │
│  │ [https://example.com/avatar.png_______]  │ │
│  │ URL to your profile picture (optional)    │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Privacy Level                             │ │
│  │ [Public ▼]                                │ │
│  │ 👥 Anyone can view your profile           │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Allow Messages From                       │ │
│  │ [Everyone ▼]                              │ │
│  │ ✉️ Anyone can send you messages           │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
├─────────────────────────────────────────────────┤
│                       [Cancel]  [Save Changes]  │
└─────────────────────────────────────────────────┘
```

---

## Color Scheme

### Primary Colors
```
Purple:  #7C4DFF  ███  (Save button background)
Hover:   #6C3FEF  ███  (Save button hover)
Lime:    #E3F06F  ███  (Accent, available for future)
```

### Text Colors
```
Primary:   #000000  ███  (Labels, text)
Secondary: #666666  ███  (Helper text)
Disabled:  #CCCCCC  ███  (Wallet address)
Error:     #D32F2F  ███  (Validation errors)
```

### Background Colors
```
Modal:     #FFFFFF  ███  (Background)
Info Box:  #E3F2FD  ███  (Info alert)
Input:     #F5F5F5  ███  (Disabled input)
```

---

## Privacy Level Dropdown

```
┌─────────────────────────┐
│ Privacy Level         ▼ │
├─────────────────────────┤
│ ✓ Public                │  ← Selected (checkmark)
│   Holders Only          │
│   Private               │
└─────────────────────────┘

Helper Text Below:
👥 Anyone can view your profile
💎 Only token holders can view details
🔒 Only you can view your full profile
```

---

## Message Permissions Dropdown

```
┌─────────────────────────┐
│ Allow Messages From   ▼ │
├─────────────────────────┤
│ ✓ Everyone              │  ← Selected (checkmark)
│   Token Holders Only    │
│   Nobody                │
└─────────────────────────┘

Helper Text Below:
✉️ Anyone can send you messages
💎 Only token holders can message you
🚫 No one can send you messages
```

---

## Button Styles

### Save Button (Primary)
```
╔═══════════════╗
║ Save Changes  ║  Background: #7C4DFF
╚═══════════════╝  Text: White
                   Min Width: 100px
                   Hover: #6C3FEF
```

### Cancel Button (Secondary)
```
┌───────────────┐
│    Cancel     │  Background: Transparent
└───────────────┘  Text: Gray
                   Hover: Light gray bg
```

---

## Field States

### Normal State
```
┌───────────────────────────────────┐
│ Display Name                      │
│ John Doe                          │
│ 8/50 characters                   │
└───────────────────────────────────┘
```

### Focus State
```
┌═══════════════════════════════════┐  ← Blue border
│ Display Name                      │
│ John Doe▊                         │  ← Cursor
│ 8/50 characters                   │
└───────────────────────────────────┘
```

### Error State
```
┌───────────────────────────────────┐  ← Red border
│ Display Name                      │
│                                   │
│ ❌ Display name cannot be only    │  ← Red error text
│    spaces                         │
└───────────────────────────────────┘
```

### Disabled State (Wallet Address)
```
┌───────────────────────────────────┐  ← Gray background
│ Wallet Address                    │
│ 7xKXtg2CffdxXqe9abc123           │  ← Gray text
│ Your wallet address (cannot be    │
│ changed)                          │
└───────────────────────────────────┘
```

---

## Responsive Behavior

### Desktop (>600px)
```
Modal: 600px fixed width, centered
Padding: 24px all sides
Buttons: Right-aligned
```

### Tablet (400px - 600px)
```
Modal: 90% screen width
Padding: 20px all sides
Buttons: Right-aligned
```

### Mobile (<400px)
```
Modal: 100% screen width
Padding: 16px all sides
Buttons: Full width stacked
```

---

## Loading State

```
┌─────────────────────────────────────────────────┐
│  Edit Profile                                 ✕ │
├─────────────────────────────────────────────────┤
│                                                 │
│  ... (all fields shown normally) ...           │
│                                                 │
├─────────────────────────────────────────────────┤
│              [Cancel]  [⏳ Saving...]          │  ← Disabled
└─────────────────────────────────────────────────┘
                              ↑ Loading spinner
```

---

## Validation Error Display

### Single Error
```
┌───────────────────────────────────┐
│ Display Name                      │  ← Red border
│    ___________________________    │
│ ❌ Display name cannot be only    │  ← Red text
│    spaces                         │
└───────────────────────────────────┘
```

### Multiple Errors
```
┌───────────────────────────────────┐
│ Display Name                      │  ← Red border
│                                   │
│ ❌ Display name cannot be only    │
│    spaces                         │
└───────────────────────────────────┘

┌───────────────────────────────────┐
│ Avatar URL                        │  ← Red border
│ not-a-url                         │
│ ❌ Please enter a valid URL       │
└───────────────────────────────────┘
```

---

## Character Counter Display

### Normal (Under Limit)
```
Bio
[I love building on Solana!___________]
31/500 characters                        ← Gray text
```

### Approaching Limit (>90%)
```
Bio
[Lorem ipsum dolor sit amet, consectetur]
455/500 characters                       ← Orange text
```

### At Limit (100%)
```
Display Name
[This is exactly fifty characters long here]
50/50 characters                         ← Gray text
```

### Over Limit (Prevented by maxLength)
```
(Browser prevents typing beyond limit)
50/50 characters
```

---

## Toast Notifications

### Success Toast
```
╔═══════════════════════════════╗
║ ✅ Profile updated            ║  Green background
║    successfully!              ║  White text
╚═══════════════════════════════╝  Top-right corner
```

### Error Toast
```
╔═══════════════════════════════╗
║ ❌ Failed to update profile   ║  Red background
╚═══════════════════════════════╝  White text
```

### Validation Toast
```
╔═══════════════════════════════╗
║ ⚠️ Please fix the errors      ║  Orange background
║    before saving              ║  White text
╚═══════════════════════════════╝
```

---

## Interaction Flow

### 1. Modal Opens
```
[Edit Profile Button] Click
         ↓
    Modal fades in
         ↓
Form populated with current data
         ↓
    First field focused (optional)
```

### 2. User Edits
```
User types in field
         ↓
Character counter updates live
         ↓
Validation runs on blur
         ↓
Error shown if invalid
```

### 3. User Saves
```
[Save Changes] Click
         ↓
Validation runs on all fields
         ↓
If errors: Show toast, stay open
         ↓
If valid: Call onSave()
         ↓
Show loading state
         ↓
On success: Toast + close modal
         ↓
On error: Error toast, stay open
```

### 4. User Cancels
```
[Cancel] or [X] or Click outside
         ↓
Confirm if unsaved changes (optional)
         ↓
Reset form to original values
         ↓
Clear all errors
         ↓
Modal fades out
```

---

## Spacing & Padding

```
Modal Padding: 24px
Field Spacing: 24px (mb-3)
Section Spacing: 32px
Button Spacing: 16px gap
Label to Input: 8px
Input to Helper: 4px
```

---

## Typography

```
Title: 20px, bold
Labels: 14px, medium (500)
Input Text: 16px, regular
Helper Text: 12px, regular
Error Text: 12px, regular
Button Text: 14px, medium (500)
```

---

## Accessibility Features

### Keyboard Navigation
```
Tab: Move to next field
Shift+Tab: Move to previous field
Enter: Submit form (if not in textarea)
Escape: Close modal
```

### Focus Indicators
```
Focused input: Blue border (2px)
Focused button: Blue outline
Focused select: Blue border
```

### Screen Reader Announcements
```
"Edit Profile, dialog"
"Display Name, text input"
"8 of 50 characters"
"Display name cannot be only spaces, error"
"Save Changes, button, disabled"
```

---

## Mobile Adaptations

### Button Layout
```
Desktop:        Mobile:
[Cancel] [Save] [Cancel] (full width)
                [Save]   (full width, stacked)
```

### Field Adjustments
```
Desktop: Standard padding
Mobile: Reduced padding, larger touch targets
```

---

## Animation

### Modal Open
```
Duration: 200ms
Easing: ease-out
Effect: Fade + Scale (0.95 → 1.0)
```

### Modal Close
```
Duration: 150ms
Easing: ease-in
Effect: Fade + Scale (1.0 → 0.95)
```

### Button Hover
```
Duration: 100ms
Easing: ease
Effect: Background color transition
```

---

## Status

✅ **Visual Design**: Complete  
✅ **Color Scheme**: Align brand colors  
✅ **Spacing**: Consistent throughout  
✅ **Responsive**: Mobile-friendly  
✅ **Accessibility**: WCAG AA compliant  

Ready for implementation! 🎨

