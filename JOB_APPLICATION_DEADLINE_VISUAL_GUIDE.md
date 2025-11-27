# 📸 Job Application Deadline Commitment - Visual Guide

**Feature**: Deadline Picker with Fast Delivery Bonuses  
**Date**: November 27, 2024

---

## 🎨 UI Components

### 1. Committed Completion Date Picker

```
┌─────────────────────────────────────────────┐
│ Committed Completion Date * ⓘ              │
│                                             │
│ ┌─────────────────────────────────────┐    │
│ │  Select completion date             │    │
│ │                           📅         │    │
│ └─────────────────────────────────────┘    │
│ This becomes a HARD deadline after          │
│ assignment                                  │
└─────────────────────────────────────────────┘
```

**Tooltip (ⓘ)**:
> You MUST deliver by this date. Missing it will result in karma penalties and job cancellation.

---

### 2. Poster's Desired Deadline (When Available)

```
┌─────────────────────────────────────────────┐
│ ℹ️  Poster's desired completion:            │
│    Dec 04, 2024                             │
└─────────────────────────────────────────────┘
```

**Style**: Blue info alert  
**Purpose**: Shows what the job poster is hoping for

---

### 3. Fast Delivery Bonus Alert (≤7 days)

```
┌─────────────────────────────────────────────┐
│ ✅  🎉 Fast delivery bonus: +20% karma for  │
│    3-day completion!                        │
└─────────────────────────────────────────────┘
```

**Variants**:
- 3 days or less: "+20% karma"
- 7 days or less: "+10% karma"
- More than 7 days: (no alert shown)

**Style**: Green success alert

---

### 4. Deadline Commitment Warning

```
┌─────────────────────────────────────────────┐
│ ⚠️  Deadline Commitment                     │
│                                             │
│ By submitting, you commit to delivering    │
│ work by Dec 30, 2024. Missing this         │
│ deadline without submission will result in:│
│                                             │
│ • Job cancellation with full refund to     │
│   poster                                    │
│ • Karma penalty for ghosting (-100 karma)  │
│ • Failure record on your profile           │
└─────────────────────────────────────────────┘
```

**Style**: Orange warning alert  
**Purpose**: Crystal clear consequences  
**Always shows**: When deadline is selected

---

### 5. Updated Karma Preview

```
┌─────────────────────────────────────────────┐
│ YOU'LL EARN:                                │
│                                             │
│ Immediate (now)          +14 karma          │
│ On completion            +524 karma         │
│ ─────────────────────────────────────────── │
│ 🚀 Fast delivery bonus applied: +20%       │
└─────────────────────────────────────────────┘
```

**Features**:
- Shows updated karma with bonus included
- Bonus indicator only appears when applicable
- Purple background (#EEE7FF)

---

## 📱 Full Modal Layout

```
╔═══════════════════════════════════════════════╗
║  Apply for This Job                      ✖    ║
╠═══════════════════════════════════════════════╣
║                                               ║
║  Your Pitch *                                 ║
║  ┌─────────────────────────────────────────┐ ║
║  │ Explain why you're the right person... │ ║
║  │                                         │ ║
║  │                                         │ ║
║  └─────────────────────────────────────────┘ ║
║  0 / 2,000 characters                         ║
║                                               ║
║  Portfolio Images (Optional)                  ║
║  [Upload Images] 0 / 5 images                 ║
║                                               ║
║  Estimated Completion Time *                  ║
║  ┌─────────────────────────────────────────┐ ║
║  │ 1-3 days                         ▼     │ ║
║  └─────────────────────────────────────────┘ ║
║                                               ║
║  ┌───────────────────────────────────────┐   ║
║  │ Committed Completion Date * ⓘ        │   ║
║  │ ┌─────────────────────────────────┐  │   ║
║  │ │ Dec 30, 2024              📅   │  │   ║
║  │ └─────────────────────────────────┘  │   ║
║  │ This becomes a HARD deadline         │   ║
║  └───────────────────────────────────────┘   ║
║                                               ║
║  ┌───────────────────────────────────────┐   ║
║  │ ℹ️  Poster's desired completion:      │   ║
║  │    Dec 04, 2024                       │   ║
║  └───────────────────────────────────────┘   ║
║                                               ║
║  ┌───────────────────────────────────────┐   ║
║  │ ✅ 🎉 Fast delivery bonus: +20% karma│   ║
║  │    for 3-day completion!              │   ║
║  └───────────────────────────────────────┘   ║
║                                               ║
║  ┌───────────────────────────────────────┐   ║
║  │ ⚠️  Deadline Commitment               │   ║
║  │                                       │   ║
║  │ By submitting, you commit to         │   ║
║  │ delivering work by Dec 30, 2024.     │   ║
║  │ Missing this deadline will result in:│   ║
║  │                                       │   ║
║  │ • Job cancellation with full refund  │   ║
║  │ • Karma penalty for ghosting         │   ║
║  │ • Failure record on your profile     │   ║
║  └───────────────────────────────────────┘   ║
║                                               ║
║  ┌───────────────────────────────────────┐   ║
║  │ YOUR PROFILE                          │   ║
║  │                                       │   ║
║  │ [Builder (3 jobs)]  [150 karma]      │   ║
║  │                                       │   ║
║  │ Visible to the job poster             │   ║
║  └───────────────────────────────────────┘   ║
║                                               ║
║  ┌───────────────────────────────────────┐   ║
║  │ YOU'LL EARN:                          │   ║
║  │                                       │   ║
║  │ Immediate (now)          +14 karma    │   ║
║  │ On completion            +524 karma   │   ║
║  │ ─────────────────────────────────────│   ║
║  │ 🚀 Fast delivery bonus: +20%         │   ║
║  └───────────────────────────────────────┘   ║
║                                               ║
╠═══════════════════════════════════════════════╣
║                      [Cancel] [Submit]        ║
╚═══════════════════════════════════════════════╝
```

---

## 🎨 Color Palette

### Primary Colors
- **Purple (Primary)**: `#7C4DFF` - Buttons, icons, headings
- **Green (Success)**: `#36C170` - Immediate karma, success states
- **Orange (Warning)**: `#FB923C` - Warnings, deadlines
- **Blue (Info)**: `#2563EB` - Info alerts, poster's deadline

### Background Colors
- **Light Purple**: `#EEE7FF` - Karma preview box
- **Light Gray**: `#F8F9FC` - Profile section
- **Light Green**: `#E8F9F1` - Success alerts
- **Light Orange**: `#FFF4E6` - Warning alerts
- **Light Blue**: `#E8F4FF` - Info alerts

### Text Colors
- **Primary**: `#1A1A1E` - Main text
- **Secondary**: `#6F7280` - Labels, helper text
- **Tertiary**: `#A3A7B5` - Subtle text

---

## 📐 Spacing & Layout

### Component Spacing
```css
margin-bottom: 24px (mb-3)  // Between major sections
margin-bottom: 16px (mb-2)  // Between related items
margin-bottom: 12px (mb-1.5) // Between sub-items
```

### Responsive Breakpoints
- **Mobile**: < 640px (full width, stacked)
- **Tablet**: 640px - 1024px (full width, some side-by-side)
- **Desktop**: > 1024px (max-width modal, optimal layout)

---

## 🎭 State Variations

### No Deadline Selected
```
┌─────────────────────────────────────────────┐
│ Committed Completion Date * ⓘ              │
│ ┌─────────────────────────────────────────┐ │
│ │ Select completion date          📅     │ │
│ └─────────────────────────────────────────┘ │
│ This becomes a HARD deadline after          │
│ assignment                                  │
└─────────────────────────────────────────────┘

[Karma preview shows base amounts]
[No warning box]
```

### Deadline Selected (3 days)
```
┌─────────────────────────────────────────────┐
│ Committed Completion Date * ⓘ              │
│ ┌─────────────────────────────────────────┐ │
│ │ Dec 30, 2024                    📅     │ │
│ └─────────────────────────────────────────┘ │
│ This becomes a HARD deadline after          │
│ assignment                                  │
└─────────────────────────────────────────────┘

[Green alert: +20% bonus]
[Orange warning box appears]
[Karma preview shows +20% amounts]
```

### Deadline Selected (14 days)
```
┌─────────────────────────────────────────────┐
│ Committed Completion Date * ⓘ              │
│ ┌─────────────────────────────────────────┐ │
│ │ Jan 10, 2025                    📅     │ │
│ └─────────────────────────────────────────┘ │
│ This becomes a HARD deadline after          │
│ assignment                                  │
└─────────────────────────────────────────────┘

[No bonus alert]
[Orange warning box appears]
[Karma preview shows base amounts]
```

### Validation Error
```
┌─────────────────────────────────────────────┐
│ Committed Completion Date * ⓘ              │
│ ┌─────────────────────────────────────────┐ │
│ │ [empty]                         📅     │ │ [RED BORDER]
│ └─────────────────────────────────────────┘ │
│ ❌ Completion date is required              │
└─────────────────────────────────────────────┘
```

---

## 📱 Mobile View

```
┌─────────────────┐
│ Apply for This  │
│ Job         ✖   │
├─────────────────┤
│                 │
│ [Pitch field]   │
│                 │
│ [Images]        │
│                 │
│ [Est. time]     │
│                 │
│ ┌─────────────┐ │
│ │ Deadline    │ │
│ │ Dec 30      │ │
│ └─────────────┘ │
│                 │
│ [Info alert]    │
│                 │
│ [Bonus alert]   │
│                 │
│ [Warning]       │
│                 │
│ [Profile]       │
│                 │
│ [Karma]         │
│                 │
├─────────────────┤
│ Cancel | Submit │
└─────────────────┘
```

**Mobile Optimizations**:
- Full width components
- Stacked alerts
- Touch-friendly date picker
- Readable text sizes (16px minimum)
- No horizontal scroll

---

## 🔄 Interaction States

### DatePicker Interaction
1. **Closed**: Shows selected date or placeholder
2. **Open**: Calendar popup appears
3. **Selecting**: Hovering over dates
4. **Selected**: Date confirmed
5. **Validated**: Checkmark or error shown

### Submit Button States
1. **Disabled**: Gray background, no deadline selected
2. **Enabled**: Purple background, all fields valid
3. **Loading**: Spinner + "Submitting..."
4. **Success**: Closes modal, shows toast

---

## 🎯 Key Visual Elements

### Icons Used
- 📅 Calendar icon (date picker)
- ⓘ Info icon (tooltip trigger)
- ℹ️ Info indicator (alerts)
- ✅ Success checkmark
- ⚠️ Warning triangle
- 🎉 Party emoji (bonus)
- 🚀 Rocket emoji (fast delivery)
- 💼 Briefcase (jobs completed)
- 🏆 Trophy (karma points)

### Typography
- **Headings**: Space Grotesk, 700 weight
- **Body**: Inter, 400/500 weight
- **Mono**: SF Mono (wallet addresses)

---

**This visual guide helps designers and developers understand the exact UI implementation!** ✨

