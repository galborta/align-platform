# 🎨 Work Submission Modal - Visual Guide

**Visual reference for the enhanced work submission modal with auto-release information**

---

## 📱 Complete Modal Layout

```
╔═══════════════════════════════════════════════════════════════╗
║  Submit Completed Work                                   [X]  ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │ ⚠️  SECURITY WARNING                                     │ ║
║  │                                                          │ ║
║  │ Poster: Review all files carefully before downloading.  │ ║
║  │ Never run executable files from unknown sources.        │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │ ℹ️  ⏰ AUTO-RELEASE PROTECTION                    (NEW)  │ ║
║  │                                                          │ ║
║  │ After you submit, the poster has 10 days to review      │ ║
║  │ your work.                                               │ ║
║  │                                                          │ ║
║  │ If they don't take action within 10 days, payment       │ ║
║  │ will be automatically released to you.                  │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │ 💰 PAYMENT BREAKDOWN                              (NEW)  │ ║
║  │                                                          │ ║
║  │ You will receive:                                        │ ║
║  │                                                          │ ║
║  │     95.00 SOL                                            │ ║
║  │                                                          │ ║
║  │ (95% of locked amount, 5% platform fee)                 │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║     ▲ Dark background (#0a0a0a)                              ║
║     ▲ Lime green amount (#E3F06F)                            ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │ ⚠️  QUALITY REMINDER                              (NEW)  │ ║
║  │                                                          │ ║
║  │ Submit only high-quality work that meets the job        │ ║
║  │ requirements. Poor quality may result in disputes       │ ║
║  │ or revision requests.                                   │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │ Delivery Message *                                       │ ║
║  │ ┌─────────────────────────────────────────────────────┐ │ ║
║  │ │ Describe what you've delivered and how it meets     │ │ ║
║  │ │ the KPIs...                                          │ │ ║
║  │ │                                                      │ │ ║
║  │ │                                                      │ │ ║
║  │ │                                                      │ │ ║
║  │ └─────────────────────────────────────────────────────┘ │ ║
║  │ 0 / 2,000 characters                                    │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  Deliverable Images (Optional)                     0 / 5     ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │ [📤 Upload Images]                                       │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║  Upload images of your completed work (optional, max 5)      ║
║                                                               ║
║  External Links (Optional)                         0 / 5     ║
║  Google Drive, Figma, GitHub links, etc.                     ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │ 🔗 https://drive.google.com/...              [-]         │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║  [+ Add Another Link]                                        ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │ WHEN POSTER RELEASES PAYMENT, YOU'LL EARN:              │ ║
║  │                                                          │ ║
║  │ 🏆 +500 karma                                            │ ║
║  │                                                          │ ║
║  │ Note: You already earned karma for applying             │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  [Cancel]                                  [Submit Work]  ⏳ ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## 🎨 Section Breakdown

### 1. Auto-Release Protection Info
```
┌─────────────────────────────────────────────────┐
│ ℹ️  ⏰ AUTO-RELEASE PROTECTION                  │
├─────────────────────────────────────────────────┤
│                                                 │
│ After you submit, the poster has 10 days       │
│ to review your work.                            │
│                                                 │
│ If they don't take action within 10 days,      │
│ payment will be automatically released to you. │
│                                                 │
└─────────────────────────────────────────────────┘

Color Scheme:
- Background: Light blue (#E3F2FD)
- Icon: Blue (#2196F3)
- Text: Dark (#1A1A1E)
- Border: Blue accent

Typography:
- Title: AlertTitle component (bold)
- Body: Typography variant="body2" (14px)
```

### 2. Payment Breakdown
```
┌─────────────────────────────────────────────────┐
│ 💰 PAYMENT BREAKDOWN                            │
│                                                 │
│ You will receive:                               │
│                                                 │
│        95.00 SOL                                │
│                                                 │
│ (95% of locked amount, 5% platform fee)        │
│                                                 │
└─────────────────────────────────────────────────┘

Color Scheme:
- Background: Very dark (#0a0a0a)
- Label: Light gray (#E5E7F0)
- Amount: Lime green (#E3F06F) ← ACCENT COLOR
- Caption: Medium gray (#6F7280)
- Border radius: 4px

Typography:
- Label: Typography variant="subtitle2" (14px, semi-bold)
- Amount: Typography variant="h5" (24px, bold)
- Caption: Typography variant="caption" (12px)

Layout:
- Padding: 16px (p: 2)
- Margin bottom: 16px (mb: 2)
```

### 3. Quality Warning
```
┌─────────────────────────────────────────────────┐
│ ⚠️  QUALITY REMINDER                            │
├─────────────────────────────────────────────────┤
│                                                 │
│ Submit only high-quality work that meets the   │
│ job requirements. Poor quality may result in   │
│ disputes or revision requests.                 │
│                                                 │
└─────────────────────────────────────────────────┘

Color Scheme:
- Background: Light orange (#FFF4E6)
- Icon: Orange (#FB923C)
- Text: Dark (#1A1A1E)
- Border: Orange accent

Typography:
- Body: Typography variant="body2" (14px)
```

---

## 🎨 Color Palette

```
ALERT BACKGROUNDS
┌──────────────────────────────────┐
│ Security Warning (existing)      │
│ Background: #FFF4E6 (Lt Orange)  │
│ Icon: #FB923C (Orange)           │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Auto-Release Info (NEW)          │
│ Background: #E3F2FD (Lt Blue)    │
│ Icon: #2196F3 (Blue)             │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Payment Breakdown (NEW)          │
│ Background: #0a0a0a (Very Dark)  │
│ Amount: #E3F06F (Lime) ★         │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Quality Warning (NEW)            │
│ Background: #FFF4E6 (Lt Orange)  │
│ Icon: #FB923C (Orange)           │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Karma Preview (existing)         │
│ Background: #EEE7FF (Lt Purple)  │
│ Icon: #7C4DFF (Purple)           │
└──────────────────────────────────┘
```

---

## 📊 Information Hierarchy

```
PRIORITY LEVELS

HIGH PRIORITY (Top → Bottom)
├─ Security Warning
│  └─ Important for poster safety
│
├─ Auto-Release Protection ← NEW
│  └─ Critical worker information
│
├─ Payment Breakdown ← NEW
│  └─ Key financial information
│
└─ Quality Warning ← NEW
   └─ Important expectations

MEDIUM PRIORITY
├─ Delivery Message (required)
├─ Deliverable Images (optional)
└─ External Links (optional)

LOW PRIORITY
└─ Karma Preview (motivational)
```

---

## 🎯 Visual Hierarchy

```
1. ATTENTION GRABBERS
   ⏰ Auto-release icon + title
   💰 Payment amount (large, lime)
   ⚠️ Warning icons

2. PRIMARY CONTENT
   - Auto-release explanation
   - Payment breakdown
   - Quality reminder

3. FORM FIELDS
   - Delivery message (largest)
   - Image upload
   - Link inputs

4. SUPPORTING INFO
   - Karma preview
   - Character counts
   - Helper text
```

---

## 📐 Spacing & Layout

```
VERTICAL SPACING

[Modal Title]
  ↓ pt: 2 (16px)
[Security Warning]
  ↓ mb: 3 (24px)
[Auto-Release Info]
  ↓ mb: 2 (16px)
[Payment Breakdown]
  ↓ mb: 2 (16px)
[Quality Warning]
  ↓ mb: 3 (24px)
[Delivery Message]
  ↓ mb: 3 (24px)
[Images Section]
  ↓ mb: 6 (48px)
[Links Section]
  ↓ mb: 6 (48px)
[Karma Preview]
  ↓ (no mb, at bottom)
[Action Buttons]
```

---

## 💡 Key Visual Elements

### Amount Display (Most Prominent)
```
╔═════════════════════════════╗
║                             ║
║      95.00 SOL              ║
║                             ║
╚═════════════════════════════╝
  ↑
  24px, bold, lime green (#E3F06F)
  ↑
  Dark background for contrast
```

### Countdown Timer Concept (Future)
```
┌─────────────────────────────┐
│ ⏰ Auto-release in:         │
│                             │
│    7 days 14 hours          │
│                             │
│ or payment guaranteed       │
└─────────────────────────────┘
  Could be added below info alert
```

---

## 📱 Responsive Breakpoints

### Desktop (≥1024px)
```
Modal width: 900px (maxWidth: 'md')
Padding: 24px
Image grid: 5 columns
Text: Full size
All alerts: Full width
```

### Tablet (768px - 1023px)
```
Modal width: 90% viewport
Padding: 20px
Image grid: 3-4 columns
Text: Full size
Alerts stack naturally
```

### Mobile (< 768px)
```
Modal width: 95% viewport
Padding: 16px
Image grid: 2-3 columns
Text: Slightly smaller
Amount: Still prominent (20px)
Alerts: Full width, wrap text
```

---

## 🎬 Interactive States

### Loading State (Submitting)
```
┌───────────────────────────────┐
│                               │
│  [◐ Uploading images...]      │
│                               │
│  Image 1 of 3: [████▓▓▓▓▓▓]   │
│                               │
└───────────────────────────────┘

Button disabled:
[Cancel]  [⏳ Submitting...]
```

### Error State
```
┌───────────────────────────────┐
│ ❌ ERROR                       │
│                               │
│ Failed to submit work.        │
│ Please try again.             │
└───────────────────────────────┘
  Red background
  Error text
  Retry option
```

### Success (Toast, not in modal)
```
┌───────────────────────────────┐
│ ✅ Work submitted!             │
│    Waiting for poster review  │
└───────────────────────────────┘
  Purple background (#7C4DFF)
  4 second duration
  Modal closes
```

---

## 🔍 Accessibility

### Screen Reader Flow
```
1. "Dialog: Submit Completed Work"
2. "Warning: Poster, review all files carefully..."
3. "Info: Auto-Release Protection"
   "After you submit, the poster has 10 days..."
4. "You will receive: 95.00 SOL"
   "(95% of locked amount, 5% platform fee)"
5. "Warning: Submit only high-quality work..."
6. "Delivery Message, required"
7. "Deliverable Images, optional"
8. "External Links, optional"
9. "When poster releases payment, you'll earn: +500 karma"
10. "Button: Cancel"
11. "Button: Submit Work"
```

### Focus Order
```
1. [X] Close button
2. [Delivery Message] textarea
3. [Upload Images] button
4. [Image 1] × button (if exists)
5. [Image 2] × button (if exists)
6. [Link 1] input field
7. [Link 1] - button
8. [+ Add Link] button (if < 5)
9. [Cancel] button
10. [Submit Work] button
```

### ARIA Labels
```typescript
- Dialog: aria-labelledby="modal-title"
- Close button: aria-label="Close modal"
- Image upload: aria-label="Upload deliverable images"
- Remove image: aria-label="Remove image {index}"
- Add link: aria-label="Add another external link"
- Remove link: aria-label="Remove link"
```

---

## 📊 Visual Weight Distribution

```
VISUAL WEIGHT (Eye Tracking Flow)

1. Payment Amount (95.00 SOL)
   ↓ Lime green, large, dark background
   
2. Alert Icons (⏰ ⚠️ ℹ️)
   ↓ Colors draw attention
   
3. Alert Titles (Bold, contrasting)
   ↓ "Auto-Release Protection"
   
4. Delivery Message Field
   ↓ Large textarea
   
5. Action Buttons
   ↓ Bottom, primary colored
   
6. Supporting Info
   ↓ Helper text, character counts
```

---

## 🎨 Design Principles Applied

### 1. **Clarity**
- Simple language ("10 days")
- Specific amounts ("95.00 SOL")
- Clear actions ("automatically released")

### 2. **Transparency**
- Show platform fee (5%)
- Explain auto-release system
- Warn about quality expectations

### 3. **Confidence**
- Guaranteed payment message
- Clear timeline
- Protection mechanism explained

### 4. **Hierarchy**
- Most important info first
- Visual weight on payment
- Progressive disclosure

### 5. **Consistency**
- Material UI components
- ALIGN color palette
- Existing modal patterns

---

Built with 🎨 for clear communication! 📢





