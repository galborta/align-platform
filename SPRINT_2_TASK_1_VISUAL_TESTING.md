# 🎯 Campaign Type Selector - Visual Testing Guide

## Quick Access
**Test URL:** `http://localhost:3001/test/campaign-type-selector`

---

## ✅ Desktop Testing Checklist (≥600px)

### Initial State
- [ ] Modal opens smoothly when button clicked
- [ ] Modal is centered on screen
- [ ] Background overlay is dark with blur effect
- [ ] Modal has rounded corners (24px radius)
- [ ] Width is responsive but max ~600px

### Header Section
- [ ] Purple campaign icon (🔊) visible on left
- [ ] Title reads "Create Social Media Campaign"
- [ ] Title uses Space Grotesk font, bold, 24px
- [ ] Close button (X) is visible on right
- [ ] Close button is clickable and closes modal

### Subtitle
- [ ] Gray text explaining the purpose
- [ ] Uses Satoshi font, 16px
- [ ] Good spacing below header

### Campaign Options

**Retweet Campaign Card:**
- [ ] Repeat icon (↻) is 40px, purple color
- [ ] Icon on left side
- [ ] Title "Retweet Campaign" is bold, Space Grotesk
- [ ] Description text is gray, readable
- [ ] "Best for" pill shows "Amplifying content, launches"
- [ ] Pill has light gray background initially

**Original Tweet Campaign Card:**
- [ ] Create icon (✏️) is 40px, purple color
- [ ] Icon on left side
- [ ] Title "Original Tweet Campaign" is bold, Space Grotesk
- [ ] Description text is gray, readable
- [ ] "Best for" pill shows "Diverse perspectives, engagement"
- [ ] Pill has light gray background initially

### Interaction States

**Hover (before selection):**
- [ ] Cursor changes to pointer
- [ ] Border color changes to purple
- [ ] Card lifts slightly (2px up)
- [ ] Shadow appears underneath
- [ ] Background gets subtle purple tint

**Selection:**
- [ ] Radio button fills with purple
- [ ] Card border becomes 2px solid purple
- [ ] Card background changes to soft purple (#EEE7FF)
- [ ] "Best for" pill background changes to light purple
- [ ] Pill text turns purple

**Hover (after selection):**
- [ ] Selected card maintains purple state
- [ ] Hover still shows lift and shadow
- [ ] Other (unselected) card shows hover state

### Footer Buttons

**Cancel Button:**
- [ ] Left-aligned
- [ ] Gray text
- [ ] Rounded pill shape (fully rounded)
- [ ] Hover shows light gray background
- [ ] Clicking closes modal

**Continue Button:**
- [ ] Right-aligned
- [ ] Initially disabled (gray background)
- [ ] Gray text when disabled
- [ ] No shadow when disabled
- [ ] After selection:
  - [ ] Background turns purple (#7C4DFF)
  - [ ] Text turns white
  - [ ] Purple shadow appears underneath
  - [ ] Hover makes button slightly darker
  - [ ] Hover increases shadow intensity
  - [ ] Clicking fires callback and closes modal

---

## 📱 Mobile Testing Checklist (<600px)

### Layout Changes
- [ ] Modal takes full screen (no rounded corners)
- [ ] No background visible (modal is 100% height/width)
- [ ] Title is slightly smaller (20px)
- [ ] Close button is 40px (easier to tap)

### Content Area
- [ ] All text is readable
- [ ] Icons maintain 40px size
- [ ] Cards stack nicely vertically
- [ ] Proper padding on all sides (reduced from desktop)

### Buttons
- [ ] Cancel and Continue buttons stack vertically
- [ ] Cancel is on TOP (reversed order for mobile)
- [ ] Both buttons are full-width
- [ ] Both buttons maintain rounded pill shape
- [ ] Touch targets are at least 40px tall
- [ ] Proper spacing between buttons

### Touch Interactions
- [ ] Tapping cards selects them
- [ ] Tap feedback is instant
- [ ] No double-tap zoom issues
- [ ] Scrolling works if content overflows

---

## ⌨️ Keyboard Testing

### Tab Navigation
- [ ] Press Tab to cycle through:
  1. Close button (X)
  2. First radio button
  3. Second radio button
  4. Cancel button
  5. Continue button
- [ ] Focus indicator is visible (purple outline)
- [ ] Focus stays within modal (trapped)

### Keyboard Actions
- [ ] `ESC` key closes modal
- [ ] `Enter` on radio button selects it
- [ ] `Space` on radio button selects it
- [ ] `Enter` on Continue (when enabled) submits
- [ ] `Enter` on Cancel closes modal

---

## 🎨 Design System Verification

### Colors
- [ ] Purple accent: `#7C4DFF` (main interactive color)
- [ ] Soft purple: `#EEE7FF` (selected background)
- [ ] Text primary: `#1A1A1E` (almost black)
- [ ] Text secondary: `#6F7280` (medium gray)
- [ ] Border subtle: `#E5E7F0` (light gray borders)
- [ ] Card background: `#FFFFFF` (pure white)

### Typography
- [ ] Headings use Space Grotesk font
- [ ] Body text uses Satoshi font
- [ ] Font weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- [ ] Line heights feel balanced
- [ ] Letter spacing is tight for headings

### Spacing
- [ ] Consistent padding (24px on desktop)
- [ ] Proper gaps between elements
- [ ] Breathing room around text
- [ ] Not cramped, not too spacious

### Shadows
- [ ] Hover shadow: `0 4px 12px rgba(124, 77, 255, 0.15)`
- [ ] Button shadow: `0 4px 14px rgba(124, 77, 255, 0.3)`
- [ ] Button hover: `0 6px 20px rgba(124, 77, 255, 0.4)`

---

## 🔧 Functional Testing

### State Management
- [ ] Initially, no option is selected
- [ ] Continue button is disabled
- [ ] Selecting an option enables Continue
- [ ] Only one option can be selected at a time
- [ ] Switching selection works correctly

### Callbacks
- [ ] Clicking Cancel calls `onClose()` without `onSelect()`
- [ ] Clicking X calls `onClose()` without `onSelect()`
- [ ] Clicking ESC calls `onClose()` without `onSelect()`
- [ ] Clicking overlay calls `onClose()` without `onSelect()`
- [ ] Clicking Continue calls `onSelect(type)` with correct type
- [ ] After `onSelect()`, modal closes

### Type Values
- [ ] Retweet option returns `'retweet'`
- [ ] Original Tweet option returns `'original_tweet'`
- [ ] Selected type displays in test page confirmation box

---

## 🐛 Edge Cases to Test

### Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

### Screen Sizes
- [ ] 320px width (iPhone SE)
- [ ] 375px width (iPhone 12/13)
- [ ] 768px width (iPad portrait)
- [ ] 1024px width (iPad landscape)
- [ ] 1440px width (laptop)
- [ ] 1920px width (desktop)

### Interactions
- [ ] Rapid clicking doesn't break state
- [ ] Opening/closing repeatedly works
- [ ] Selecting different options in succession works
- [ ] Double-clicking Continue only fires once

### Accessibility
- [ ] Screen reader announces modal correctly
- [ ] Screen reader reads options properly
- [ ] Focus visible for keyboard users
- [ ] Color contrast meets WCAG AA standards
- [ ] Works without mouse (keyboard only)

---

## 🎯 Performance Checks

### Load Time
- [ ] Modal appears instantly when button clicked
- [ ] No visible lag or jank
- [ ] Animations are smooth (60fps)

### Hover/Click Response
- [ ] Hover effects are immediate
- [ ] Click response is instant
- [ ] No delayed state updates

---

## ✅ Final Sign-Off Checklist

Before marking Task 1 complete:

- [ ] All desktop tests pass
- [ ] All mobile tests pass
- [ ] Keyboard navigation works perfectly
- [ ] Design system is followed exactly
- [ ] Functional tests all pass
- [ ] No console errors
- [ ] No React warnings
- [ ] No accessibility violations
- [ ] Code has no linter errors
- [ ] Component is properly exported
- [ ] Test page works as expected

---

## 🟢 Status Indicators

Use these emoji to track your testing:

- ✅ **Green (Pass):** Feature works perfectly
- 🟡 **Yellow (Minor Issue):** Works but needs small fix
- 🔴 **Red (Fail):** Broken, needs fixing

---

## 📸 Screenshot Checklist

Take screenshots of:

1. Initial state (desktop)
2. Hover state on Retweet option
3. Selected state (Retweet selected)
4. Selected state (Original Tweet selected)
5. Full mobile view (< 600px)
6. Mobile with option selected
7. Keyboard focus visible
8. Test page success state

---

## 🚀 Testing Commands

```bash
# Start dev server
npm run dev

# Access test page
open http://localhost:3001/test/campaign-type-selector

# Check for linter errors
npm run lint

# Run type checking
npx tsc --noEmit
```

---

**Happy Testing!** 🎉

If everything passes, Task 1 is complete and ready for integration!

