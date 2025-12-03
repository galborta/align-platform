# Homepage Layout Implementation

## ✅ Completed

### Files Modified
- **`app/page.tsx`** - Added two-column grid layout with sidebar

---

## 🏗️ Layout Structure

The homepage now follows a **3-section vertical flow:**

### 1. Hero Section
- **Component:** `<Hero />`
- **Height:** 85vh
- **Background:** Lime (#E3F06F)
- **Content:** Main headline + CTA buttons

### 2. Features Overview Section
- **Purpose:** Quick showcase of Align's 3 core features
- **Layout:** 3-column grid (responsive)
- **Cards:**
  - IP Verification
  - Team Transparency
  - Optional Treasury
- **Background:** Lime (continues from hero)

### 3. Main Content Grid
- **Two-column layout:**
  - **Left:** Active Projects section (70%)
  - **Right:** Karma Leaderboard sidebar (30%)
- **Background:** Lime (maintains consistency)

---

## 📐 Grid Layout Specifications

### Desktop Layout (> 1024px)

```css
.content-grid {
  display: grid;
  grid-template-columns: 1fr 400px;  /* Projects | Sidebar */
  gap: var(--space-lg);              /* 24px */
  max-width: var(--container-max-width);  /* 1280px */
  padding: 0 var(--content-padding);
  align-items: start;
}
```

**Column Breakdown:**
- **Projects (Left):** Flexible width (1fr)
- **Sidebar (Right):** Fixed 400px width
- **Gap:** 24px between columns

### Tablet Layout (768px - 1024px)

```css
.content-grid {
  grid-template-columns: 1fr 320px;  /* Narrower sidebar */
  gap: var(--space-md);              /* 16px */
}
```

**Changes:**
- Sidebar reduced to 320px
- Smaller gap (16px)
- Projects grid becomes single column

### Mobile Layout (< 768px)

```css
.content-grid {
  grid-template-columns: 1fr;       /* Single column */
  gap: var(--space-xl);             /* 32px vertical spacing */
}

.karma-sidebar {
  position: static;                 /* No sticky positioning */
}
```

**Changes:**
- Stacked single-column layout
- Leaderboard appears below projects
- Sidebar not sticky (flows normally)

---

## 🎨 Design System Compliance

### Color Nesting Hierarchy

Following Align's **critical nesting rules:**

```
Level 1: Lime background (#E3F06F)
  ├─ Level 2: White cards (#FFFFFF)
  │    └─ Level 3: Subtle background (#F7F8FB) for nested items
  └─ Never repeat lime at nested levels ✓
```

**Implementation:**
- ✅ Page background: `var(--page-background)` (lime)
- ✅ Feature cards: `var(--card-background)` (white)
- ✅ Projects placeholder: `var(--card-background)` (white)
- ✅ Karma sidebar card: `var(--card-background)` (white)
- ✅ **No color violations:** Green never on green, no lime nesting

### Spacing System

All spacing uses design system variables:

```css
--space-xxs: 4px
--space-xs: 8px
--space-sm: 12px
--space-md: 16px
--space-lg: 24px    /* Primary gap */
--space-xl: 32px    /* Section spacing */
--space-xxl: 40px   /* Major section padding */
```

**Applied:**
- Container padding: `var(--space-xxl)`
- Grid gap: `var(--space-lg)` desktop, `var(--space-md)` tablet
- Section margins: `var(--space-lg)`
- Card padding: `var(--space-lg)`

### Typography

Following design system type scale:

**Section Headings:**
```css
font-family: var(--font-heading);     /* Space Grotesk */
font-size: var(--text-title);         /* 22px */
font-weight: var(--weight-semibold);  /* 600 */
color: var(--text-primary);
```

**Sidebar Headings:**
```css
font-family: var(--font-heading);     /* Space Grotesk */
font-size: var(--text-headline);      /* 18px */
font-weight: var(--weight-semibold);  /* 600 */
color: var(--text-primary);
```

**Placeholder Text:**
```css
font-family: var(--font-body);        /* Satoshi */
font-size: var(--text-body-small);    /* 14px */
color: var(--text-secondary);
font-style: italic;
```

### Shadows & Borders

**Card Shadows:**
```css
box-shadow: var(--shadow-card);
/* 0 20px 40px 0 rgba(15, 23, 42, 0.06) */
```

**Border Radius:**
```css
border-radius: var(--radius-card-lg);
/* 24px for all cards */
```

---

## 📦 Component Structure

### Projects Section (Left Column)

```tsx
<section className="projects-section">
  <h2 className="section-heading">Active Projects</h2>
  <div className="projects-grid">
    <div className="projects-grid-placeholder">
      <p>Project cards will appear here in Sprint 2...</p>
    </div>
  </div>
</section>
```

**Features:**
- Heading: "Active Projects" (22px, Space Grotesk)
- Grid ready for project cards (auto-fill, min 300px)
- White placeholder card with shadow
- Placeholder text in Satoshi, 14px, italic

### Karma Sidebar (Right Column)

```tsx
<aside className="karma-sidebar">
  <div className="karma-card">
    <h3 className="sidebar-heading">Karma Leaderboard</h3>
    <div className="leaderboard-placeholder">
      <p>Top 10 karma leaders will appear here in Sprint 4...</p>
    </div>
  </div>
</aside>
```

**Features:**
- **Sticky positioning:** `top: 100px` (accounts for navbar)
- White card with 24px border radius
- Card shadow for elevation
- Min-height: 400px
- Heading: 18px Space Grotesk
- Placeholder text in Satoshi, 14px, italic

---

## 🎯 Sticky Sidebar Behavior

### Desktop/Tablet (> 768px)

```css
.karma-sidebar {
  position: sticky;
  top: 100px;
  align-self: start;
}
```

**Behavior:**
- Sidebar sticks to viewport when scrolling
- Stops at `top: 100px` (below navbar)
- Stays aligned with top of content grid
- Scrolls with content on mobile

### Mobile (< 768px)

```css
.karma-sidebar {
  position: static;
}
```

**Behavior:**
- Normal flow (not sticky)
- Appears below projects section
- Full width available

---

## 🎨 Design Principles Applied

### 1. **Soft but Structured** (from design.json)
- ✅ Rounded cards (24px radius)
- ✅ Generous padding (24px inside cards)
- ✅ Soft shadows (subtle elevation)
- ✅ Clean, organized grid

### 2. **Whitespace as First-Class Element**
- ✅ 24px gap between columns
- ✅ 40px section padding
- ✅ Comfortable breathing room
- ✅ Not cramped

### 3. **Minimal Chrome**
- ✅ No excessive borders
- ✅ Subtle shadows only
- ✅ Focus on content
- ✅ Clean, professional aesthetic

### 4. **Clarity Over Decoration**
- ✅ Simple grid structure
- ✅ Clear section hierarchy
- ✅ No unnecessary decoration
- ✅ Lime + white provides visual interest

---

## 📱 Responsive Breakpoints

### Desktop (> 1024px)
- Two-column grid: 1fr + 400px
- Sidebar sticky (top: 100px)
- Projects grid: auto-fill columns (min 300px)
- Full padding: 40px

### Tablet (768px - 1024px)
- Two-column grid: 1fr + 320px (narrower sidebar)
- Sidebar still sticky
- Projects grid: single column
- Reduced gap: 16px

### Mobile (< 768px)
- Single column: 1fr
- Sidebar not sticky (normal flow)
- Leaderboard below projects
- Reduced padding: 24px
- Full-width cards

---

## ✅ Quality Checklist

- [x] Uses all CSS variables from design system
- [x] Follows color nesting rules (no violations)
- [x] Proper spacing throughout (lg, xl, xxl)
- [x] Typography uses correct scales and weights
- [x] Cards have proper shadows and radius
- [x] Sticky sidebar on desktop/tablet
- [x] Responsive on all breakpoints
- [x] Semantic HTML (<main>, <section>, <aside>)
- [x] Placeholder content styled correctly
- [x] No linter errors
- [x] Compiles successfully

---

## 🚀 Ready for Sprint 2 & 4

### Sprint 2: Projects Integration

The layout is ready to receive project cards:

```tsx
// Replace placeholder with:
{projects.map(project => (
  <ProjectCard key={project.id} project={project} />
))}
```

**Grid will automatically:**
- Arrange cards in columns (min 300px each)
- Adjust to available space
- Maintain 24px gap
- Stack on mobile

### Sprint 4: Karma Leaderboard

The sidebar is ready for leaderboard widget:

```tsx
// Replace placeholder with:
<KarmaLeaderboard topUsers={topTenUsers} />
```

**Sidebar will:**
- Stay sticky on scroll (desktop)
- Show top 10 users
- Maintain white card styling
- Flow normally on mobile

---

## 📊 Layout Metrics

**Desktop:**
- Container max-width: 1280px
- Projects column: ~846px (flexible)
- Sidebar column: 400px (fixed)
- Gap: 24px

**Tablet:**
- Container max-width: 1024px
- Projects column: ~688px (flexible)
- Sidebar column: 320px (fixed)
- Gap: 16px

**Mobile:**
- Container max-width: 100%
- Single column: full width
- Vertical gap: 32px

---

## 🎯 Next Steps

### Phase 1: Content Population
1. **Sprint 2:** Add project cards to left column
2. **Sprint 4:** Add leaderboard widget to sidebar
3. Remove placeholder text when content loads

### Phase 2: Enhancements (Optional)
1. Add loading skeletons for projects
2. Add loading skeleton for leaderboard
3. Add empty state illustrations
4. Add "Load More" pagination
5. Add filter/sort controls

### Phase 3: Polish
1. Add hover states to project cards
2. Add scroll animations (fade in)
3. Add transition effects
4. Optimize for performance

---

**Status:** ✅ Complete - Ready for Content  
**Implementation Date:** November 30, 2025  
**Next Milestone:** Sprint 2 - Project Cards Integration



