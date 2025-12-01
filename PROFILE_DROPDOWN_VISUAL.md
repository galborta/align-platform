# 🎨 Profile Dropdown - Visual Guide

**Location**: Home page header (after wallet connects)

---

## Header with Profile Dropdown

### Before Connection
```
┌─────────────────────────────────────────────────────┐
│  Align                        [Connect Wallet]      │
└─────────────────────────────────────────────────────┘
```

### After Connection
```
┌─────────────────────────────────────────────────────┐
│  Align               👤  [7xKX...f456]              │
│                      ↑    ↑                         │
│                   Profile  Wallet Button            │
└─────────────────────────────────────────────────────┘
```

---

## Dropdown Menu (Opened)

```
┌─────────────────────────────────────────────────────┐
│  Align               👤  [7xKX...f456]              │
│                      │                              │
│                      ▼                              │
│                  ┌──────────────────┐              │
│                  │ 👤 View Profile  │              │
│                  │ ⚙️  Settings     │              │
│                  └──────────────────┘              │
└─────────────────────────────────────────────────────┘
```

---

## Menu States

### Normal
```
┌──────────────────┐
│ 👤 View Profile  │  BG: White
│ ⚙️  Settings     │  Text: Black
└──────────────────┘  Icons: Purple (#7C4DFF)
```

### Hover
```
┌──────────────────┐
│ 👤 View Profile  │  BG: rgba(124, 77, 255, 0.08)
└──────────────────┘  Light purple tint
```

---

## Icon Button

### Normal
```
┌─────┐
│ 👤  │  Color: #7C4DFF (purple)
└─────┘  Background: Transparent
```

### Hover
```
┌─────┐
│ 👤  │  Color: #7C4DFF
└─────┘  Background: rgba(124, 77, 255, 0.08)
```

---

## Full Flow

### 1. User Connects Wallet
```
[Connect Wallet] → Wallet connected → Profile icon appears
```

### 2. User Clicks Profile Icon
```
Click 👤 → Dropdown opens → Shows 2 options
```

### 3. User Selects Option
```
Click "View Profile" → Navigate to /profile → Close dropdown
Click "Settings"     → Navigate to /profile/settings → Close dropdown
```

### 4. User Clicks Outside
```
Click anywhere → Dropdown closes
```

---

## Mobile View

```
┌─────────────────────────┐
│  Align        👤  💼    │  Compact icons
└─────────────────────────┘

Dropdown (full width):
┌─────────────────────────┐
│ 👤 View Profile         │
│ ⚙️  Settings            │
└─────────────────────────┘
```

---

## Color Scheme

```
Icon:        #7C4DFF (purple)
Icon Hover:  rgba(124, 77, 255, 0.08) (light purple bg)
Menu BG:     #FFFFFF (white)
Menu Hover:  rgba(124, 77, 255, 0.08)
Text:        #000000 (black)
```

---

## Positioning

- **Profile Icon**: Left of WalletButton
- **Dropdown**: Below icon, aligned right
- **Min Width**: 200px
- **Padding**: 12px vertical, 16px horizontal per item
- **Gap**: 16px between icon and text

---

## Accessibility

### Keyboard Navigation
```
Tab:        Focus profile icon
Enter:      Open dropdown
Arrow Down: Next menu item
Arrow Up:   Previous menu item
Enter:      Select item
Escape:     Close dropdown
```

### Screen Reader
```
"Profile menu button"
"Menu open"
"View Profile menu item"
"Settings menu item"
"Menu closed"
```

---

## Implementation Details

```typescript
// State
const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

// Open menu
onClick={(e) => setAnchorEl(e.currentTarget)}

// Close menu
onClose={() => setAnchorEl(null)}

// Check if open
open={Boolean(anchorEl)}
```

---

## Status

✅ **Implemented**: Yes  
✅ **Purple Theme**: #7C4DFF  
✅ **Responsive**: Mobile-friendly  
✅ **Accessible**: Keyboard + screen reader  
✅ **Only Shows**: When wallet connected  

Ready to use! 🎉









