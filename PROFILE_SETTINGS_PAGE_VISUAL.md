# 🎨 Profile Settings Page - Visual Guide

**Route**: `/profile/settings`

---

## Desktop Layout (1024px max width)

```
┌─────────────────────────────────────────────────────────────┐
│  ← Profile Settings                    7xKXtg2C...def456   │
│     ↑ Back button                       ↑ Wallet chip       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │  👤 Profile  |  👁️ Privacy  |  🚫 Blocked Users     │  │  Tabs
│  │      ↑                                                │  │
│  │   Purple indicator                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  [TAB CONTENT HERE]                                   │  │
│  │                                                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Profile Tab

```
┌─────────────────────────────────────────────────────────────┐
│  Profile Information               [✏️ Edit Profile]        │
│  Manage your display name, bio,        ↑ Purple button     │
│  and avatar                                                 │
│                                                             │
│  ───────────────────────────────────────────────────────── │
│                                                             │
│  Wallet Address                                            │
│  7xKXtg2CffdxXqe9HRqq4ajJVjcDrD5PvQabc123def456ghi789... │
│  ↑ Monospace font, full address                           │
│                                                             │
│  Display Name                                              │
│  John Doe                                                  │
│  ↑ or "Not set" in gray italic                            │
│                                                             │
│  Bio                                                        │
│  I love building on Solana and contributing to great      │
│  projects! Always happy to help out the community.        │
│  ↑ Multi-line, or "Not set"                               │
│                                                             │
│  Avatar URL                                                │
│  https://example.com/avatar.png                           │
│  ┌──────────┐                                             │
│  │  [IMG]   │  ← Preview (24x24, rounded)                │
│  └──────────┘                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Privacy Tab

```
┌─────────────────────────────────────────────────────────────┐
│  Privacy Settings                                           │
│  Control who can view your profile and send you messages   │
│                                                             │
│  Profile Visibility                                        │
│  ─────────────────                                         │
│                                                             │
│  ◉ 👥 Public                                               │
│     Anyone can view your full profile including display    │
│     name, bio, and avatar                                  │
│                                                             │
│  ○ 💎 Holders Only                                         │
│     Only token holders can view your profile details.      │
│     Others see minimal info                                │
│                                                             │
│  ○ 🔒 Private                                              │
│     Only you can view your full profile. Others only see   │
│     your wallet address                                    │
│                                                             │
│  ───────────────────────────────────────────────────────── │
│                                                             │
│  Message Permissions                                       │
│  ────────────────────                                      │
│                                                             │
│  ◉ ✉️ Everyone                                             │
│     Anyone can send you messages. Best for networking and  │
│     open communication                                     │
│                                                             │
│  ○ 💎 Token Holders Only                                   │
│     Only users who hold tokens can message you. Requires   │
│     token verification                                     │
│                                                             │
│  ○ 🚫 Nobody                                               │
│     No one can send you new messages. Good for taking a    │
│     break                                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  ℹ️ Current Settings Preview                         │  │
│  │  Profile visibility: public                          │  │
│  │  Can receive messages from: everyone                 │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │         Save Privacy Settings                        │  │
│  │          ↑ Purple button, full width                 │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Blocked Users Tab

### With Blocked Users

```
┌─────────────────────────────────────────────────────────────┐
│  Blocked Users                                              │
│  Manage users you have blocked. Blocked users cannot       │
│  message you or view your activity                         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Wallet Address     │  Blocked         │  Actions    │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  7xKXtg2C...abc123  │  2 hours ago     │ [Unblock]  │  │
│  │  9yMNopQ4...def456  │  1 day ago       │ [Unblock]  │  │
│  │  3zRStUV6...ghi789  │  3 days ago      │ [Unblock]  │  │
│  │                                                        │  │
│  │  Showing 1-3 of 3              [< 1 >]               │  │
│  └──────────────────────────────────────────────────────┘  │
│                        ↑ DataGrid                          │
└─────────────────────────────────────────────────────────────┘
```

### Empty State

```
┌─────────────────────────────────────────────────────────────┐
│  Blocked Users                                              │
│  Manage users you have blocked...                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │                    🚫                                 │  │
│  │               (gray icon, 64px)                       │  │
│  │                                                        │  │
│  │            No blocked users                           │  │
│  │         You haven't blocked anyone yet                │  │
│  │                                                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Connection Prompt (No Wallet)

```
┌─────────────────────────────────────────────────────────────┐
│  ← Profile Settings                                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │                    🔒                                 │  │
│  │               (purple icon, 64px)                     │  │
│  │                                                        │  │
│  │          Wallet Connection Required                   │  │
│  │    Please connect your wallet to manage your          │  │
│  │               profile settings                        │  │
│  │                                                        │  │
│  │            [Connect Wallet Button]                    │  │
│  │                                                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Loading State

```
┌─────────────────────────────────────────────────────────────┐
│  ← Profile Settings                                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │                    ⏳                                 │  │
│  │              Circular Progress                        │  │
│  │                                                        │  │
│  │             Loading profile...                        │  │
│  │                                                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Mobile Layout (<768px)

```
┌───────────────────────────────┐
│  ← Profile Settings           │
│     7xKX...f456               │
├───────────────────────────────┤
│  ┌───────────────────────┐   │
│  │ 👤 | 👁️ | 🚫        │   │  Tabs (compact)
│  └───────────────────────┘   │
│                               │
│  ┌───────────────────────┐   │
│  │                       │   │
│  │  [Content stacked]    │   │
│  │  [vertically]         │   │
│  │                       │   │
│  └───────────────────────┘   │
└───────────────────────────────┘
```

---

## Component States

### Edit Profile Button

**Normal**:
```
┌──────────────────────┐
│ ✏️ Edit Profile      │  BG: #7C4DFF
└──────────────────────┘  Text: White
```

**Hover**:
```
┌──────────────────────┐
│ ✏️ Edit Profile      │  BG: #6C3FEF (darker)
└──────────────────────┘  Text: White
```

---

### Save Privacy Settings Button

**Normal**:
```
┌────────────────────────────────┐
│  Save Privacy Settings         │  BG: #7C4DFF
└────────────────────────────────┘  Full width
```

**Loading**:
```
┌────────────────────────────────┐
│  ⏳ Saving...                  │  BG: Gray (disabled)
└────────────────────────────────┘  Cursor: not-allowed
```

---

### Unblock Button

**Normal**:
```
┌───────────┐
│  Unblock  │  Border: #7C4DFF
└───────────┘  Text: #7C4DFF
                BG: Transparent
```

**Hover**:
```
┌───────────┐
│  Unblock  │  Border: #6C3FEF
└───────────┘  BG: rgba(124, 77, 255, 0.04)
```

---

### Radio Buttons

**Selected**:
```
◉  Option text
↑ Purple (#7C4DFF)
```

**Unselected**:
```
○  Option text
↑ Gray
```

---

## Tab Indicator

```
Profile    Privacy    Blocked Users
  ═══                              ← Purple line (#7C4DFF)
   ↑ Active tab
```

---

## Color Palette

```
Primary:    ███ #7C4DFF  Purple (buttons, tabs, radios)
Hover:      ███ #6C3FEF  Darker purple
Background: ███ #FFFFFF  White cards
Text:       ███ #000000  Primary text
Secondary:  ███ #666666  Helper text
Border:     ███ #E0E0E0  Card borders
```

---

## Typography

```
Page Title:     30px, bold
Section Title:  20px, semibold
Body:           14px, regular
Caption:        12px, regular
Button:         16px, medium
Monospace:      Courier/Monaco (wallet)
```

---

## Spacing

```
Page Padding:      24px
Card Padding:      24px
Section Spacing:   24px
Element Spacing:   16px
Button Height:     48px (full width)
Tab Height:        48px
```

---

## Animations

### Tab Switch
```css
Transition: 200ms ease
Effect: Fade + slide
```

### Button Hover
```css
Transition: background-color 0.2s ease
```

### Modal Open
```css
Transition: 200ms ease-out
Effect: Fade + scale
```

---

## Accessibility

### Focus Indicators
```
Focused Tab:
Profile
══════    ← Blue outline
```

### Keyboard Navigation
```
Tab:        Move between tabs
Enter:      Activate button
Space:      Select radio
Arrow Keys: Navigate radios
```

### Screen Reader
```
"Profile Settings page"
"Profile tab, selected"
"Edit Profile button"
"Privacy level, public, selected"
"Unblock button for wallet 7xKX..."
```

---

## Toast Notifications

### Success
```
╔═══════════════════════════════╗
║ ✅ Profile updated           ║  Green
║    successfully!              ║
╚═══════════════════════════════╝
```

### Error
```
╔═══════════════════════════════╗
║ ❌ Failed to update profile  ║  Red
╚═══════════════════════════════╝
```

---

## Status

✅ **Visual Design**: Complete  
✅ **Responsive**: Mobile-friendly  
✅ **Accessibility**: WCAG AA  
✅ **Animations**: Smooth  
✅ **Colors**: Purple theme  

Ready for production! 🎨







