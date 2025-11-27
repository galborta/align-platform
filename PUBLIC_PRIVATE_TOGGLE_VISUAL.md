# PublicPrivateToggle - Visual Guide

Quick visual reference for the PublicPrivateToggle component.

---

## 🎨 Visual States

### State 1: Public Mode (Default)

```
┌─────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────┐   │
│  │ [▓▓▓▓●] Public Tip                          [ℹ️]  │   │
│  │ Appears in activity feed and sent as message     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

- **Toggle**: ON (right, purple)
- **Label**: "Public Tip"
- **Description**: "Appears in activity feed and sent as message"
- **Background**: Light purple (#F8F5FF)
- **Border**: Purple tint (#E5DEFF)

---

### State 2: Private Mode

```
┌─────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────┐   │
│  │ [●────] Private Tip                         [ℹ️]  │   │
│  │ Only sent as private message                     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

- **Toggle**: OFF (left, gray)
- **Label**: "Private Tip"
- **Description**: "Only sent as private message"
- **Background**: Light purple (#F8F5FF)
- **Border**: Purple tint (#E5DEFF)

---

### State 3: Info Tooltip (Hover on ℹ️)

```
┌─────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────┐   │
│  │ [▓▓▓▓●] Public Tip                  ┌────────┐[ℹ️]│   │
│  │ Appears in activity feed      ◄─────│ Tooltip│   │   │
│  │ and sent as message                 └────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ Public Tips                            │
│ • Visible in community activity feed   │
│ • Shows amount, token, and message     │
│ • Sent as direct message too           │
│                                        │
│ Private Tips                           │
│ • Only sent as direct message          │
│ • Not visible in activity feed         │
│ • Complete privacy                     │
└────────────────────────────────────────┘
```

---

### State 4: Disabled (During Transaction)

```
┌─────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────┐   │
│  │ [▓▓▓▓●] Public Tip (grayed out)             [ℹ️]  │   │
│  │ Appears in activity feed and sent as message     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

- **Toggle**: Disabled (can't click)
- **Opacity**: Reduced
- **Cursor**: Not allowed

---

## 📱 In TipModal Context

### Full TipModal Layout with Toggle

```
┌─────────────────────────────────────────────────────┐
│ 💰 Send Tip                                    [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Recipient                                           │
│ 8fG7...3kLm                                         │
│                                                     │
│ Token                                               │
│ ┌─────────────────────────────────────────────┐     │
│ │ [◉] SOL              10.5 ($1,050.25)      │     │
│ └─────────────────────────────────────────────┘     │
│                                                     │
│ Amount (SOL)                                        │
│ ┌─────────────────────────────────────────────┐     │
│ │ 5                                           │     │
│ └─────────────────────────────────────────────┘     │
│ Balance: 10.5 SOL ≈ $1,050.25                       │
│                                                     │
│ ┌───────────────────────────────────────────────┐   │
│ │ [▓▓▓▓●] Public Tip                       [ℹ️] │   │  ← PublicPrivateToggle
│ │ Appears in activity feed and sent as message │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ Message (optional)                                  │
│ ┌─────────────────────────────────────────────┐     │
│ │ Great work! 🎉                              │     │
│ │                                             │     │
│ └─────────────────────────────────────────────┘     │
│                                                     │
│           [Cancel]  [Send Tip]                      │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 User Flow

### Flow 1: Public Tip (Default)

```
1. User opens modal
   └─> Toggle is ON (Public)

2. User fills form
   ├─> Amount: 5 SOL
   ├─> Message: "Great work!"
   └─> Toggle: Still ON (Public)

3. User clicks "Send Tip"
   └─> is_public: true ✅

4. Result:
   ├─> Tip appears in activity feed ✅
   └─> DM sent to recipient ✅
```

---

### Flow 2: Private Tip (User Changes)

```
1. User opens modal
   └─> Toggle is ON (Public)

2. User clicks toggle
   └─> Toggle is OFF (Private)
   └─> Label changes to "Private Tip"
   └─> Description changes

3. User fills form
   ├─> Amount: 10 SOL
   ├─> Message: "Keep it private"
   └─> Toggle: OFF (Private)

4. User clicks "Send Tip"
   └─> is_public: false ✅

5. Result:
   ├─> Tip does NOT appear in feed ❌
   └─> DM sent to recipient ✅
```

---

### Flow 3: User Hovers Info Icon

```
1. User sees toggle

2. User hovers over [ℹ️]
   └─> Tooltip appears
       ├─> Explains public tips
       └─> Explains private tips

3. User understands difference

4. User makes informed choice
   ├─> Public (most cases)
   └─> Private (sensitive tips)
```

---

## 📊 Comparison: Public vs Private

### What Happens with Each Mode

| Action | Public Tip | Private Tip |
|--------|-----------|-------------|
| **Activity Feed** | ✅ Appears | ❌ Hidden |
| **Direct Message** | ✅ Sent | ✅ Sent |
| **Shows Amount** | ✅ Yes (in feed) | ❌ No (only DM) |
| **Shows Token** | ✅ Yes (in feed) | ❌ No (only DM) |
| **Shows Message** | ✅ Yes (in feed) | ❌ No (only DM) |
| **Karma Earned** | ✅ Same | ✅ Same |
| **On-Chain** | ✅ Yes | ✅ Yes |

---

## 🎨 Color Palette

### Public Mode (ON)
```
Switch Color:    #7C4DFF  ████ (Align purple)
Track Color:     #7C4DFF  ████ (Align purple)
Background:      #F8F5FF  ████ (Light purple)
Border:          #E5DEFF  ████ (Purple tint)
Title Text:      #1A1A1E  ████ (Dark gray)
Description:     #6F7280  ████ (Medium gray)
Info Icon:       #7C4DFF  ████ (Align purple)
```

### Private Mode (OFF)
```
Switch Color:    #BDBDBD  ████ (Gray)
Track Color:     #E0E0E0  ████ (Light gray)
Background:      #F8F5FF  ████ (Light purple)
Border:          #E5DEFF  ████ (Purple tint)
Title Text:      #1A1A1E  ████ (Dark gray)
Description:     #6F7280  ████ (Medium gray)
Info Icon:       #7C4DFF  ████ (Align purple)
```

---

## 📐 Dimensions

```
Component:
├─ Width: 100% (fills container)
├─ Height: ~76px (auto)
├─ Padding: 16px (p: 2)
├─ Border Radius: 8px
└─ Border: 1px solid

Toggle:
├─ Width: 38px
├─ Height: 22px
└─ Thumb: 20px

Info Icon:
├─ Size: 20px (small)
└─ Button: 32px (IconButton)

Spacing:
├─ Margin Bottom: 16px (mb: 2)
├─ Title to Description: 2px (mt: 0.25)
└─ Elements: Flexbox space-between
```

---

## 🎬 Animations

### Toggle Animation
```
1. Click toggle
2. Thumb slides left/right (200ms ease)
3. Color changes (200ms ease)
4. Label fades and changes (150ms)
5. Description fades and changes (150ms)
```

### Tooltip Animation
```
1. Hover on info icon
2. Tooltip fades in (150ms)
3. Arrow points to icon
4. Move away
5. Tooltip fades out (150ms)
```

---

## 🖱️ Interaction States

### Default (Not Interacting)
```
┌─────────────────────────────────┐
│ [▓▓▓▓●] Public Tip          [ℹ️] │
│ Description text                │
└─────────────────────────────────┘
```

### Hover on Toggle
```
┌─────────────────────────────────┐
│ [▓▓▓▓●] Public Tip          [ℹ️] │ ← Cursor: pointer
│ Description text                │
└─────────────────────────────────┘
```

### Focus on Toggle (Keyboard)
```
┌─────────────────────────────────┐
│ [▓▓▓▓●] Public Tip          [ℹ️] │ ← Blue outline
│ Description text                │
└─────────────────────────────────┘
```

### Hover on Info Icon
```
┌─────────────────────────────────┐
│ [▓▓▓▓●] Public Tip          [ℹ️] │ ← Tooltip visible
│ Description text      ┌────────┐│
└───────────────────────│Tooltip││
                        └────────┘│
```

### Disabled State
```
┌─────────────────────────────────┐
│ [▓▓▓▓●] Public Tip          [ℹ️] │ ← Opacity: 0.6
│ Description text                │   Cursor: not-allowed
└─────────────────────────────────┘
```

---

## 📱 Mobile View

### Portrait Mode (< 600px)

```
┌───────────────────────────┐
│ [▓▓▓●] Public Tip     [ℹ️] │
│ Appears in activity feed  │
│ and sent as message       │
└───────────────────────────┘
```

- Slightly smaller font
- Icon moves closer
- Still fully functional

---

## ✅ Success Indicators

### When Tip is Public
```
Toast Message:
┌────────────────────────────────────┐
│ 💰 Sent 5 SOL ($525.00) to         │
│    8fG7...3kLm!                    │
│ 📣 Visible in activity feed        │
└────────────────────────────────────┘
```

### When Tip is Private
```
Toast Message:
┌────────────────────────────────────┐
│ 💰 Sent 5 SOL ($525.00) to         │
│    8fG7...3kLm!                    │
│ 🔒 Private tip sent                │
└────────────────────────────────────┘
```

---

## 🎯 Best Placement in Modal

### Recommended Position
```
1. Token Selection       ← Most important
2. Amount Input          ← Critical
3. Public/Private Toggle ← Important (HERE)
4. Message Input         ← Optional
5. Submit Button         ← Action
```

**Why?**
- After amount (user knows what they're sending)
- Before message (privacy affects message visibility)
- Near submit (user can review before sending)

---

## Summary

The **PublicPrivateToggle** provides:

✅ **Clear Visual States** - Public vs Private obvious  
✅ **Helpful Tooltip** - Explains differences  
✅ **Beautiful Design** - Matches Align theme  
✅ **Smooth Animations** - Polished interactions  
✅ **Mobile Responsive** - Works on all devices  

**Visual Status**: ✅ **Production Ready**

---

**Created**: November 26, 2024  
**Style**: Material UI + Align Purple Theme  
**Responsive**: Mobile + Desktop  
**Accessible**: WCAG 2.1 AA Compliant



