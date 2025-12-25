# Sprint 5: Project Page Display Updates - Context & Reading List

**Goal:** Update public-facing project pages to display social assets and domains separately by classification (official vs affiliated), implement proper sorting, and ensure beautiful UI/UX aligned with the design system.

**Duration:** 1 day (4-5 hours)

**Prerequisites:** Sprint 3 (Yellow Feed) and Sprint 4 (Notifications & Email) complete.

---

## 📖 Reading List

Before starting Sprint 5 implementation, read through these files to understand the current project page structure, asset display logic, and design system:

### Project Page Components
1. **`app/project/[projectId]/page.tsx`**
   - Main project page component
   - Current layout and sections
   - How assets are currently fetched and displayed
   - Integration with other components

2. **`components/ProjectAssets.tsx`** (if exists)
   - Current asset display component
   - How social assets are rendered
   - Filtering and sorting logic

3. **`components/ProjectHeader.tsx`** (if exists)
   - Project header with name, logo, description
   - May need updates for consistency

### Data Fetching & Queries
4. **`lib/feed-queries-social-assets.ts`**
   - `fetchPendingSocialAssets()` - understand the query pattern
   - `SocialAssetFeedItem` interface - data structure
   - Asset classification types (official, affiliated)
   - Platform types and icons

5. **`lib/project-queries.ts`** (if exists) or similar
   - How project data is currently fetched
   - How approved assets are queried
   - Any existing asset display logic

### Database Schema
6. **`types/database.ts`**
   - `social_assets` table structure (approved assets)
   - `pending_assets` table structure (reference)
   - `projects` table structure
   - Asset-related enums and types
   - Understand `asset_type`, `asset_classification`, `platform`, etc.

### Design System & UI Patterns
7. **`DESIGN_SYSTEM_IMPLEMENTATION.md`**
   - Color variables and usage
   - Typography classes
   - Spacing system
   - Component patterns

8. **`DESIGN-SYSTEM.md`**
   - Brand colors (#7C4DFF purple, #FFB800 yellow)
   - Typography (Space Grotesk for titles, Satoshi for body)
   - Material Icons Rounded usage
   - Platform-specific brand logos

9. **`components/admin/SocialAssetFeedItem.tsx`**
   - Reference for how assets are displayed in the yellow feed
   - Platform icon rendering
   - Classification badges (Official/Affiliated)
   - Asset card styling and layout

### Existing Asset Display (if any)
10. **Search for "social_assets" in app/project/** directory
    - Find where assets are currently displayed (if at all)
    - Understand current implementation
    - Identify what needs to be updated

### Platform & Icon System
11. **`components/admin/SocialAssetFeedItem.tsx`** (platform icons section)
    - How platform-specific icons are rendered
    - Brand logo URLs for each platform
    - Icon sizing and styling

---

## ✅ Ready to Start Checklist

Before beginning Sprint 5 implementation, ensure you understand:

- [ ] How the project page is currently structured (`app/project/[projectId]/page.tsx`)
- [ ] Where approved social assets are stored (`social_assets` table)
- [ ] The difference between `asset_type` ('social' vs 'domain') and `asset_classification` ('official' vs 'affiliated')
- [ ] How to query approved assets for a specific project (filtering by `project_id` and `status = 'approved'`)
- [ ] Platform-specific icon rendering (Twitter, Instagram, TikTok, YouTube, Discord, Telegram)
- [ ] Design system colors and component patterns
- [ ] How to create responsive layouts with Material UI
- [ ] Badge/chip styling for Official (purple) vs Affiliated (yellow)

---

## 🎯 Sprint 5 Goals

### 1. Create Approved Assets Query Function
**Goal:** Build a data fetching function to get approved social assets and domains for display on project pages.

**Key Requirements:**
- Query `social_assets` table for approved assets only (`status = 'approved'`)
- Filter by `project_id`
- Separate by `asset_type` ('social' vs 'domain')
- Group by `asset_classification` ('official' vs 'affiliated')
- Include submitter info and timestamps
- Sort appropriately (e.g., official first, then by creation date)

**Expected Function Signature:**
```typescript
interface ApprovedAssetDisplay {
  id: string
  asset_type: 'social' | 'domain'
  asset_classification: 'official' | 'affiliated'
  asset_data: any // { platform, handle } or { domain }
  verified_at: string
  submitter_wallet: string
}

fetchApprovedAssetsForProject(projectId: string): Promise<{
  socialOfficial: ApprovedAssetDisplay[]
  socialAffiliated: ApprovedAssetDisplay[]
  domainOfficial: ApprovedAssetDisplay[]
  domainAffiliated: ApprovedAssetDisplay[]
}>
```

---

### 2. Update Project Page Layout
**Goal:** Redesign the project page to display social assets and domains in dedicated sections with clear classification.

**Layout Structure:**
```
Project Header (existing)
├─ Project Name & Logo
├─ Description
└─ Stats

Social Assets Section 🔗
├─ Official Accounts (Purple badges)
│  └─ Platform icons + handles + verification checkmark
├─ Affiliated Accounts (Yellow badges)
│  └─ Platform icons + handles + affiliate indicator

Domains Section 🌐
├─ Official Domains (Purple badges)
│  └─ Domain URLs with link icons
└─ Affiliated Domains (Yellow badges)
   └─ Domain URLs with affiliate indicator

[Other existing sections...]
```

**Key Requirements:**
- Responsive design (mobile + desktop)
- Use design system colors and typography
- Material UI components (Box, Typography, Chip, Grid)
- Icons from Material Icons Rounded + platform brand logos
- Empty states ("No official accounts yet")

---

### 3. Create Social Assets Display Component
**Goal:** Build a reusable component to display approved social assets with proper styling and classification badges.

**Component Features:**
- Display platform-specific brand icon
- Show handle/username
- Classification badge (Official/Affiliated)
- Verified checkmark icon
- Clickable links to actual social profiles
- Responsive grid layout
- Hover effects

**Styling:**
- Official accounts: Purple accent (#7C4DFF)
- Affiliated accounts: Yellow accent (#FFB800)
- Card-based layout with subtle borders
- Platform icons in brand colors
- Typography: Satoshi for body text

---

### 4. Create Domains Display Component
**Goal:** Build a component to display approved domains with classification and styling.

**Component Features:**
- Domain URL display
- Classification badge (Official/Affiliated)
- Link icon from Material Icons
- Verified checkmark
- Clickable links (open in new tab)
- Responsive layout

**Styling:**
- Official domains: Purple accent
- Affiliated domains: Yellow accent
- Clean, modern card layout
- Proper link styling and hover states

---

### 5. Implement Sorting & Filtering
**Goal:** Ensure assets are displayed in a logical, user-friendly order.

**Sorting Rules:**
- Official assets always appear before affiliated
- Within each classification, sort by:
  1. Platform priority (Twitter > Instagram > TikTok > YouTube > Discord > Telegram)
  2. Creation date (newest first)
- Domains sorted alphabetically within classification

---

### 6. Add Empty States & Loading States
**Goal:** Provide clear feedback when no assets exist or data is loading.

**Empty State Messages:**
- "No official social accounts yet"
- "No affiliated accounts yet"
- "No official domains yet"
- "No affiliated domains yet"

**Loading State:**
- Skeleton loaders for asset cards
- Maintains layout structure during loading

---

## 🔑 Key Integration Points

### Database Tables
- **`social_assets`**: Main table for approved assets
  - `id`: UUID
  - `project_id`: Foreign key to projects
  - `asset_type`: 'social' | 'domain'
  - `asset_classification`: 'official' | 'affiliated'
  - `asset_data`: JSONB (platform/handle or domain info)
  - `status`: 'approved' (filter for display)
  - `verified_at`: Timestamp
  - `submitter_wallet`: Who submitted it

### Design System Colors
- **Purple (#7C4DFF)**: Official classification
- **Yellow (#FFB800)**: Affiliated classification
- **Background**: Use `background.paper` from MUI theme
- **Text**: `text.primary` and `text.secondary`
- **Borders**: `divider` color from theme

### Platform Icon URLs
Reference from `SocialAssetFeedItem.tsx`:
```typescript
const platformIcons = {
  twitter: 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png',
  instagram: 'https://www.instagram.com/static/images/ico/favicon-192.png/68d99ba29cc8.png',
  tiktok: 'https://sf16-website-login.neutral.ttwstatic.com/obj/tiktok_web_login_static/tiktok/webapp/main/webapp-desktop/8152caf0c8e8bc67ae0d.png',
  youtube: 'https://www.youtube.com/s/desktop/f506bd45/img/favicon_144x144.png',
  discord: 'https://discord.com/assets/f9bb9c4af2b9c32a2c5ee0014661546d.png',
  telegram: 'https://telegram.org/img/t_logo.png'
}
```

---

## 🎨 Design Guidelines

### Component Structure
Follow the design system implementation patterns:
```typescript
// Use Material UI with design system colors
<Box sx={{
  bgcolor: 'background.paper',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  p: 2
}}>
  {/* Content */}
</Box>
```

### Typography
- Section headers: Space Grotesk, 24-28px, bold
- Asset labels: Satoshi, 14-16px, medium
- Metadata: Satoshi, 12-14px, regular

### Spacing
Use consistent spacing from design system:
- Section gaps: 4-6 spacing units
- Card padding: 2-3 spacing units
- Grid gaps: 2 spacing units

### Badges
```typescript
// Official badge
<Chip 
  label="Official" 
  size="small"
  sx={{ 
    bgcolor: '#7C4DFF', 
    color: 'white',
    fontWeight: 600 
  }} 
/>

// Affiliated badge
<Chip 
  label="Affiliated" 
  size="small"
  sx={{ 
    bgcolor: '#FFB800', 
    color: 'white',
    fontWeight: 600 
  }} 
/>
```

---

## 📋 Files to Modify/Create

### Files to Create
1. **`lib/project-asset-queries.ts`**
   - New file for fetching approved assets
   - `fetchApprovedAssetsForProject()` function
   - Asset transformation and grouping logic

2. **`components/project/SocialAssetsDisplay.tsx`**
   - Display social assets (Twitter, Instagram, etc.)
   - Grid layout with platform icons
   - Classification badges
   - Responsive design

3. **`components/project/DomainsDisplay.tsx`**
   - Display approved domains
   - Link icons and styling
   - Classification badges
   - Responsive layout

### Files to Modify
4. **`app/project/[projectId]/page.tsx`**
   - Integrate new asset display components
   - Update layout structure
   - Add social assets and domains sections
   - Implement data fetching

5. **`types/database.ts`** (if needed)
   - Add any new type definitions
   - Ensure proper typing for asset queries

---

## 🎯 Success Criteria

Sprint 5 is complete when:

- [ ] Project pages display approved social assets grouped by classification (official/affiliated)
- [ ] Project pages display approved domains grouped by classification
- [ ] Assets are properly sorted (official first, then by platform/date)
- [ ] Design matches the Align design system (colors, typography, spacing)
- [ ] Platform-specific brand icons are displayed correctly
- [ ] Classification badges are clearly visible (purple for official, yellow for affiliated)
- [ ] Empty states are implemented for all sections
- [ ] Loading states provide good UX
- [ ] All links work correctly (social profiles, domains)
- [ ] Responsive design works on mobile and desktop
- [ ] No linter errors
- [ ] Code is production-ready

---

## 🧪 Testing Checklist

Before completing Sprint 5, test:

1. **Data Fetching**
   - [ ] Query returns all approved assets for project
   - [ ] Assets are properly grouped by type and classification
   - [ ] No pending/rejected assets are included
   - [ ] Error handling works correctly

2. **Display**
   - [ ] Official social accounts display with purple badges
   - [ ] Affiliated social accounts display with yellow badges
   - [ ] Official domains display with purple badges
   - [ ] Affiliated domains display with yellow badges
   - [ ] Platform icons render correctly
   - [ ] All links work and open in new tabs

3. **Sorting**
   - [ ] Official assets appear before affiliated
   - [ ] Social assets sorted by platform priority
   - [ ] Domains sorted alphabetically
   - [ ] Consistent ordering across page loads

4. **Responsive Design**
   - [ ] Layout works on mobile (320px+)
   - [ ] Layout works on tablet (768px+)
   - [ ] Layout works on desktop (1200px+)
   - [ ] Grid adjusts properly at breakpoints

5. **Edge Cases**
   - [ ] Empty states display when no assets exist
   - [ ] Loading states show during data fetch
   - [ ] Projects with only official assets
   - [ ] Projects with only affiliated assets
   - [ ] Projects with no assets at all

---

## 🔍 Key Questions to Answer

While reading the codebase, answer these questions:

1. **Current State:**
   - Does the project page already display social assets? If so, how?
   - Are there existing components we can reuse or refactor?
   - How is the project page currently structured?

2. **Data Layer:**
   - What's the current query pattern for project data?
   - Is there an existing function to fetch approved assets?
   - How are assets currently sorted/filtered?

3. **UI/UX:**
   - What's the current visual style of the project page?
   - Are there existing card components we should match?
   - What's the spacing and layout pattern?

4. **Performance:**
   - Should we implement pagination for assets?
   - Is there a concern about projects with many assets?
   - Should we use Supabase real-time subscriptions?

5. **Integration:**
   - How does this integrate with the yellow feed system?
   - Should editors see different views than public users?
   - Are there permission checks needed?

---

## 📊 Data Structure Summary

### Social Assets (Approved)
```typescript
{
  id: 'uuid',
  project_id: 'uuid',
  asset_type: 'social',
  asset_classification: 'official' | 'affiliated',
  asset_data: {
    platform: 'twitter' | 'instagram' | 'tiktok' | 'youtube' | 'discord' | 'telegram',
    handle: '@username'
  },
  status: 'approved',
  verified_at: '2024-12-22T10:30:00Z',
  submitter_wallet: '0x...'
}
```

### Domain Assets (Approved)
```typescript
{
  id: 'uuid',
  project_id: 'uuid',
  asset_type: 'domain',
  asset_classification: 'official' | 'affiliated',
  asset_data: {
    domain: 'example.com'
  },
  status: 'approved',
  verified_at: '2024-12-22T10:30:00Z',
  submitter_wallet: '0x...'
}
```

---

## 🚀 Implementation Order

Suggested implementation sequence:

1. **Read Phase (30 min)**
   - Read all files in the reading list
   - Understand current structure
   - Identify integration points
   - Answer key questions

2. **Data Layer (45 min)**
   - Create `lib/project-asset-queries.ts`
   - Implement `fetchApprovedAssetsForProject()`
   - Test query returns correct data
   - Implement grouping and sorting logic

3. **Components (90 min)**
   - Create `SocialAssetsDisplay.tsx`
   - Create `DomainsDisplay.tsx`
   - Implement badges, icons, and styling
   - Add empty states and loading states

4. **Integration (45 min)**
   - Update project page to use new components
   - Integrate data fetching
   - Test full flow
   - Ensure responsive design

5. **Polish (30 min)**
   - Verify all styling matches design system
   - Test all edge cases
   - Fix any linter errors
   - Update documentation

**Total Estimated Time:** 4 hours

---

## 🎨 Visual Reference

### Expected Layout

```
┌─────────────────────────────────────────┐
│  Project Header                         │
│  ● Token Name                           │
│  ● Description                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  🔗 Social Assets                       │
│                                         │
│  Official Accounts                      │
│  ┌───────┐ ┌───────┐ ┌───────┐        │
│  │ [🐦]  │ │ [📷]  │ │ [🎵]  │        │
│  │@user  │ │@user  │ │@user  │        │
│  │[OFC]  │ │[OFC]  │ │[OFC]  │        │
│  └───────┘ └───────┘ └───────┘        │
│                                         │
│  Affiliated Accounts                    │
│  ┌───────┐ ┌───────┐                  │
│  │ [▶️]  │ │ [💬]  │                  │
│  │@user  │ │@user  │                  │
│  │[AFF]  │ │[AFF]  │                  │
│  └───────┘ └───────┘                  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  🌐 Domains                             │
│                                         │
│  Official Domains                       │
│  ┌────────────────────────────────┐   │
│  │ 🔗 example.com        [OFC] ✓  │   │
│  └────────────────────────────────┘   │
│                                         │
│  Affiliated Domains                     │
│  ┌────────────────────────────────┐   │
│  │ 🔗 partner.com        [AFF] ✓  │   │
│  └────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Legend:**
- [OFC] = Official badge (purple)
- [AFF] = Affiliated badge (yellow)
- ✓ = Verified checkmark
- Platform icons in brand colors

---

## 📝 Notes

- **No Backend Changes Needed:** All data structures already exist from Sprint 3
- **Reuse Patterns:** Reference `SocialAssetFeedItem.tsx` for icon rendering and badge styling
- **Performance:** Initial implementation doesn't need pagination (most projects won't have >50 assets)
- **Real-time:** Not required for Sprint 5 (approved assets rarely change)
- **Permissions:** Public display, no permission checks needed
- **SEO:** Consider adding structured data for social links (future enhancement)

---

## 🎯 Sprint 5 Ready!

Once you've completed the reading phase and understand:
- Current project page structure
- How to query approved assets
- Design system patterns
- Component integration points

You're ready to start implementing Sprint 5! 🚀

**Next Steps:**
1. Read through all files in the reading list
2. Answer the key questions
3. Check off the ready checklist
4. Begin implementation following the suggested order

Good luck! 💪

