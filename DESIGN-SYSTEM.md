# Align - Brand Identity & Design System Brief

## Project Overview

**Platform Name:** Align  
**Tagline Options:** 
- "Transparency for creator tokens"
- "Where IP meets ownership"
- "Aligning creators and communities"

**Purpose:** A platform that creates transparency and accountability between memecoin/creator token holders and the creators who own the IP (social accounts, brands, characters). Enables revenue sharing and public IP declarations.

**Target Users:**
1. **Creators** - Memecoin founders, influencers, artists with tokens
2. **Token Holders** - Crypto investors who hold creator/meme tokens
3. **Observers** - Anyone researching projects for investment

---

## FINALIZED BRAND DECISIONS

### Logo ✓ APPROVED
**Horizontal Logo:**
- Icon: Two geometric bars aligning with connecting bridge
- Wordmark: "ALIGN" in custom geometric letterforms
- Font: Space Grotesk (for logo text consistency)
- Format: SVG provided (see below)
- Works in monochrome, will be colored with brand colors

**Square Icon:**
- Abstract "A" formed by two bars + bridge
- Perfect for: App icon, favicon, social profiles
- Scalable: 16px to 200px
- Format: SVG provided (see below)

**Logo Files:**
```svg
<!-- Horizontal Logo -->
<svg width="500" height="140" viewBox="0 0 500 140" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="140" fill="white"/>
  <g transform="translate(0, 20)">
    <path d="M20 100 L20 0 L45 0 L45 100 Z" fill="black"/>
    <path d="M100 100 L100 0 L75 0 L75 100 Z" fill="black"/>
    <rect x="45" y="45" width="30" height="10" fill="black"/>
  </g>
  <g transform="translate(130, 20)" fill="black">
    <path d="M0 100 L0 0 L20 0 L20 100 Z"/>
    <rect x="20" y="45" width="20" height="10"/>
    <path d="M60 100 L60 0 L80 0 L80 100 Z"/>
    <rect x="60" y="90" width="40" height="10"/>
    <rect x="120" y="0" width="20" height="100"/>
    <path d="M180 0 L240 0 L240 20 L200 20 L200 80 L240 80 L240 100 L180 100 Z"/>
    <path d="M280 100 L280 0 L300 0 L300 70 L340 0 L340 100 L320 100 L320 45 L300 80 L300 100 Z"/>
  </g>
</svg>

<!-- Square Icon -->
<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="white"/>
  <path d="M60 150 L60 50 L85 50 L85 150 Z" fill="black"/>
  <path d="M140 150 L140 50 L115 50 L115 150 Z" fill="black"/>
  <rect x="85" y="95" width="30" height="10" fill="black"/>
</svg>
```

### Color Palette ✓ FINALIZED

**Primary Brand Colors:**
```
pageBackground: #E3F06F (lime yellow-green - distinctive, friendly)
cardBackground: #FFFFFF (pure white for content)
accentPrimary: #7C4DFF (vibrant purple - main interactive color)
accentPrimarySoft: #EEE7FF (soft purple background)
accentSuccess: #36C170 (green for positive actions)
accentSuccessSoft: #E3F8ED (soft green background)
accentWarning: #FFC857 (yellow for attention)
```

**Text Colors:**
```
textPrimary: #1A1A1E (almost black)
textSecondary: #6F7280 (medium gray)
textMuted: #A3A7B5 (light gray)
```

**UI Colors:**
```
subtleBackground: #F7F8FB (nested elements)
borderSubtle: #E5E7F0 (use sparingly)
iconDefault: #B6BAC7 (neutral icons)
shadowColor: rgba(15, 23, 42, 0.06)
```

**Badge Colors (for Achievement Badges):**
```
Verified Creator: #36C170 (green) - trustworthy
Strong IP: #F59E0B (gold) - valuable, premium
Consistent Distributor: #3B82F6 (blue) - reliable
High Yield: #F59E0B (gold) - profitable
```

### Color Hierarchy & Nesting Rules ⚠️ CRITICAL

**RULE: Never use the same background color at multiple nesting levels**

When `pageBackground` (#E3F06F - lime-green) is used at the page level:

**❌ DON'T:**
- Use `pageBackground` again for nested containers, cards, or items
- Use green colors (`accentSuccess` #36C170) on green backgrounds
- Repeat parent background colors at any nesting level
- Create green-on-green or same-color-on-same-color situations

**✅ DO:**
- Use `cardBackground` (#FFFFFF) for primary containers on pages
- Use `subtleBackground` (#F7F8FB) for items within white containers
- Use `accentPrimarySoft` (#EEE7FF) for highlighted areas
- Maintain clear visual separation between nesting levels

**Nesting Hierarchy Pattern:**
```
Level 1 (Page): pageBackground (#E3F06F - lime-green)
  └─ Level 2 (Cards/Sections): cardBackground (#FFFFFF - white)
       └─ Level 3 (Items/Rows): cardBackground (#FFFFFF) or subtleBackground (#F7F8FB)
            └─ Level 4 (Highlights): accentPrimarySoft (#EEE7FF - light purple)
```

**General Principle:** Each nesting level must have visual separation through distinct background colors. This creates proper visual hierarchy and ensures readability. Never stack similar colors or repeat the parent's background color.

**Examples:**
- ✅ GOOD: Lime page → White card → White or gray item → Purple highlight
- ❌ BAD: Lime page → White card → Lime item (repeats page color)
- ❌ BAD: Lime page → Green button/accent (green on green)

### Typography ✓ FINALIZED

**Font Families:**
```
Titles/Display: Space Grotesk (Google Fonts - free)
- Used for: Hero text, page titles, card headers
- Weights needed: Regular (400), Medium (500), SemiBold (600), Bold (700)
- Geometric, modern, slightly quirky
- Great for large display text

Body/Interface: Satoshi (Commercial)
- Used for: All body text, buttons, labels, captions
- Weights needed: Regular (400), Medium (500), SemiBold (600), Bold (700), + Italic variants
- Clean, highly readable
- Perfect for UI and long-form text

Monospace (for addresses/tokens): JetBrains Mono or system monospace
- Used for: Wallet addresses, token amounts, code
- Weight: Regular (400)
```

**Type Scale:**
```
Display (Hero): 48px / Space Grotesk Bold
Title (Cards): 22px / Space Grotesk SemiBold  
Headline (Names): 18px / Space Grotesk SemiBold
Body: 16px / Satoshi Regular
Body Small: 14px / Satoshi Regular
Caption: 12px / Satoshi Regular
Label (Buttons): 14px / Satoshi Medium
```

### Icons ✓ FINALIZED

**Icon Library:** Material Icons (Rounded variant)
- Stroke width: 1.5px
- Style: Rounded corners, friendly
- Sizes: 16px (small), 20px (medium), 24px (large)

**Social Platform Icons: USE BRAND LOGOS**
- Instagram: Official Instagram logo (gradient or solid)
- Twitter/X: Official X logo (black or brand color)
- TikTok: Official TikTok logo (black or brand color)
- YouTube: Official YouTube logo (red or monochrome)
- Reason: Brand recognition, looks more professional, immediately identifiable

**Where to Get Brand Logos:**
- Simple Icons (simpleicons.org) - free SVG brand logos
- Official brand press kits
- Font Awesome brands (has most social logos)

**Other Icons (Material Icons):**
- Wallet: account_balance_wallet
- USDC/Token: monetization_on or paid
- Claim/Receive: call_received
- Distribution: sync_alt or swap_horiz
- Team/People: group or people
- Verified: check_circle
- Star (for Strong IP): star
- Refresh (for Consistent): refresh or replay
- Trending Up (for High Yield): trending_up
- Settings/Menu: more_vert (three dots)
- Close: close
- Search: search
- Filter: filter_list
- External Link: open_in_new
- Copy: content_copy
- Info: info
- Warning: warning
- Error: error

---

## Design System Foundation

**Base System:** Lime Design System (provided JSON)
- All spacing, shadows, radii from Lime
- Card styling, layout principles from Lime
- Component patterns from Lime

**Component Library:** Material Design 3
- All forms, buttons, tables, navigation from Material
- Styled with Align brand colors
- Maintains accessibility standards

**Custom Elements:** Align-specific designs
- Logo and branding
- 4 achievement badges
- IP declaration layouts
- Distribution/claim components
- Project cards

---

## Brand Identity Deliverables

### Phase 1: Core Brand (Week 1-2)

#### 1. Logo Design

**Requirements:**
- Primary logo (full wordmark)
- Icon/symbol version (for app icon, favicon, social profiles)
- Horizontal lockup
- Vertical lockup
- Light background version
- Dark background version
- Monochrome version

**Format Deliverables:**
- SVG (vector, editable)
- PNG (transparent background: 512px, 1024px, 2048px)
- Favicon (16x16, 32x32, 64x64)

**Concept Direction:**
The logo should convey:
- Trust and transparency
- Connection/alignment between parties
- Professional but not corporate
- Tech-forward, crypto-native

**Visual Ideas to Explore:**
- Two elements coming together/aligning
- Bridge or connection metaphor
- Checkmark/verification symbol
- Clean, geometric shapes
- Could incorporate "A" letterform

**Avoid:**
- Overly playful/cartoonish
- Generic corporate look
- Complicated illustrations
- Anything that looks like existing crypto logos

#### 2. Color Palette

**Primary Brand Color:**
This is your main identity color. Consider:

**Option A: Deep Blue/Navy**
- Conveys: Trust, stability, professionalism
- Examples: Coinbase, Twitter
- Good for: Enterprise adoption, serious tone
- Risk: Could feel corporate/boring

**Option B: Purple/Violet**
- Conveys: Innovation, creativity, premium
- Examples: Phantom Wallet, Twitch
- Good for: Crypto-native feel, stands out
- Risk: Competitive (many crypto products use purple)

**Option C: Teal/Cyan**
- Conveys: Modern, fresh, transparent
- Examples: Unique in crypto space
- Good for: Differentiation, tech-forward
- Risk: Less "serious" association

**Option D: Dark Green**
- Conveys: Growth, money, success
- Examples: Robinhood (but they're controversial)
- Good for: Financial product association
- Risk: Can feel money-focused vs trust-focused

**Recommendation:** Deep blue-purple (blend) or pure deep purple
- Balances trust (blue) with innovation (purple)
- Crypto-native without being generic
- Works well with gold accents for achievements

**Secondary/Accent Colors:**
- **Gold/Amber** (#F59E0B or similar) - For badges, achievements, yield/money concepts
- **Green** (#10B981) - For success states, verified checkmarks
- **Red** (#EF4444) - For errors, warnings
- **Blue** (#3B82F6) - For info, links

**Neutral Grays:**
Essential for UI:
- **Text Primary:** #111827 (almost black)
- **Text Secondary:** #6B7280 (medium gray)
- **Text Tertiary:** #9CA3AF (light gray)
- **Background:** #FFFFFF (white)
- **Background Alt:** #F9FAFB (off-white)
- **Borders:** #E5E7EB (light gray)

**Dark Mode Palette:**
- **Background:** #0F172A (very dark blue-gray)
- **Background Alt:** #1E293B (dark blue-gray)
- **Text Primary:** #F8FAFC (off-white)
- **Text Secondary:** #CBD5E1
- **Borders:** #334155

#### 3. Typography

**Heading Font (Display):**
Characteristics needed:
- Bold, confident
- Clean and legible
- Modern but not trendy
- Works at large sizes
- Good weight variety

**Suggestions:**
- **Inter** (free, very popular in crypto)
- **Sora** (geometric, modern)
- **Space Grotesk** (unique, slightly quirky)
- **Satoshi** (premium feel)

**Body Text Font:**
Must be extremely readable at small sizes.

**Suggestions:**
- **Inter** (can double as heading font)
- **DM Sans** (clean, friendly)
- **Work Sans** (professional, readable)

**Monospace/Code Font (for numbers, addresses):**
For displaying wallet addresses, token amounts, stats:
- **JetBrains Mono**
- **Fira Code**
- **IBM Plex Mono**

**Type Scale:**
```
Display: 48px / 60px line height (hero text)
H1: 36px / 44px
H2: 30px / 38px
H3: 24px / 32px
H4: 20px / 28px
Body Large: 18px / 28px
Body: 16px / 24px
Body Small: 14px / 20px
Caption: 12px / 16px
```

**Font Weights:**
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700

#### 4. Badge Designs (Critical!)

Badges are your signature feature. They need to be:
- Instantly recognizable
- Desirable (creators want them)
- Distinctive from each other
- Work at small and large sizes
- Look good on light and dark backgrounds

**Badge 1: Verified Creator ✓**
- **Meaning:** At least 1 verified social asset
- **Color:** Green (#10B981)
- **Icon:** Checkmark or shield with checkmark
- **Feel:** Official, trustworthy, foundational
- **Priority:** Highest - everyone wants this

**Badge 2: Strong IP ⭐**
- **Meaning:** 100k+ followers OR registered IP
- **Color:** Gold/Amber (#F59E0B)
- **Icon:** Star, crown, or medal
- **Feel:** Achievement, premium, valuable
- **Priority:** High - signals real value

**Badge 3: Consistent Distributor 🔵**
- **Meaning:** 3+ distributions in 3+ months
- **Color:** Blue (#3B82F6)
- **Icon:** Clock with checkmark, or streak flame
- **Feel:** Reliable, committed, trustworthy
- **Priority:** Medium - for active projects

**Badge 4: High Yield 💰**
- **Meaning:** >20% APY to holders
- **Color:** Gold/Green gradient
- **Icon:** Coins, dollar sign, or gem
- **Feel:** Valuable, rewarding, profitable
- **Priority:** Medium - aspirational

**Badge Design System:**
- Size: 32px x 32px (default)
- Larger version: 64px x 64px (for profile display)
- Shape: Consistent (all circles? all shields? mix?)
- Border: 2-3px outline in badge color
- Background: Subtle gradient or solid
- Icon: Simple, bold, instantly readable

**Deliverables per badge:**
- SVG (vector)
- PNG 32px, 64px, 128px
- Variations: Full color, monochrome, outline only
- States: Active, inactive (grayed out)

#### 5. Iconography

**Icon Style:**
- Stroke weight: 2px
- Style: Outline (not filled)
- Corner radius: 2px (slightly rounded)
- Consistent geometric construction

**Required Icons:**
- Instagram (platform)
- Twitter/X (platform)
- TikTok (platform)
- YouTube (platform)
- Wallet (connection)
- Dollar/USDC (revenue)
- Users (holders)
- Chart up (yield)
- Shield (verification)
- Info circle
- Warning triangle
- Success checkmark
- Copy (clipboard)
- External link
- Menu/hamburger
- Close (X)
- Chevron down/up
- Search
- Filter

**Icon Pack Recommendation:**
- **Heroicons** (free, matches Tailwind)
- **Feather Icons** (simple, elegant)
- **Phosphor Icons** (extensive, modern)

---

## Design System Deliverables

### Phase 2: Component Library (Week 2-3)

#### 1. Buttons

**Primary Button:**
- Background: Primary brand color
- Text: White
- Padding: 12px 24px
- Border radius: 8px
- Font: Medium weight, 16px
- Hover: Slightly darker shade
- Active: Even darker
- Disabled: 50% opacity

**Secondary Button:**
- Background: Transparent
- Border: 2px solid primary color
- Text: Primary color
- Same sizing as primary

**Tertiary/Ghost Button:**
- Background: Transparent
- Text: Primary color
- No border
- Hover: Light background tint

**Sizes:**
- Small: 8px 16px, 14px text
- Medium: 12px 24px, 16px text (default)
- Large: 16px 32px, 18px text

**States to design:**
- Default
- Hover
- Active (being clicked)
- Disabled
- Loading (with spinner)

#### 2. Form Inputs

**Text Input:**
- Height: 44px (mobile-friendly)
- Padding: 12px 16px
- Border: 1px solid gray
- Border radius: 8px
- Focus state: Primary color border, subtle shadow
- Error state: Red border
- Success state: Green border

**Dropdown/Select:**
- Same styling as text input
- Chevron icon on right
- Dropdown menu: White background, subtle shadow
- Options: Hover state with light background

**Checkbox:**
- Size: 20px x 20px
- Border: 2px solid gray
- Border radius: 4px
- Checked: Primary color background with white checkmark

**Radio Button:**
- Size: 20px x 20px (circular)
- Similar styling to checkbox

**Toggle Switch:**
- Width: 44px, height: 24px
- Off: Gray background
- On: Primary color background
- Animated transition

**File Upload:**
- Dashed border box
- "Upload" button
- Drag and drop visual feedback
- File preview for images

#### 3. Cards

**Standard Card:**
- Background: White
- Border: 1px solid light gray
- Border radius: 12px
- Padding: 24px
- Subtle shadow (optional)

**Hover Card (for clickable items):**
- Hover: Slight lift effect (shadow increases)
- Transition: 0.2s ease

**Stat Card:**
- Large number at top
- Label below
- Optional icon
- Optional change indicator (+/- with color)

**Project Card:**
- Thumbnail/avatar
- Project name
- Badge display area
- Key stats (holders, distributed)
- CTA button

#### 4. Tables/Lists

**Table:**
- Header: Slightly darker background, bold text
- Rows: Alternating backgrounds (zebra striping optional)
- Borders: Subtle horizontal lines
- Padding: 12px 16px per cell
- Hover: Row highlights on hover
- Sortable columns: Chevron icon

**List Items:**
- Padding: 16px
- Border bottom: 1px light gray
- Hover: Light background tint

#### 5. Navigation

**Top Navigation Bar:**
- Height: 64px
- Background: White (light) or dark (dark mode)
- Logo on left
- Navigation links in center
- Wallet connect button on right
- Mobile: Hamburger menu

**Sidebar Navigation (optional):**
- Width: 240px
- Background: Slightly different from page background
- Links with icons
- Active state: Different background + bold

#### 6. Modals/Dialogs

**Modal:**
- Overlay: Dark background, 50% opacity
- Modal box: White, centered
- Max width: 500px
- Padding: 32px
- Close button (X) in top right
- Header, body, footer sections

**Toast/Notification:**
- Appears top-right
- Auto-dismisses after 5s
- Types: Success (green), Error (red), Info (blue), Warning (yellow)
- Icon + message + close button

#### 7. Loading States

**Spinner:**
- Primary color
- Size variants: 16px, 24px, 32px
- Smooth animation

**Skeleton Screens:**
- Gray placeholder boxes
- Subtle shimmer animation
- Matches layout of actual content

**Progress Bar:**
- Height: 8px
- Background: Light gray
- Fill: Primary color
- Animated loading

#### 8. Empty States

**Illustration + Message:**
- Simple illustration (not too detailed)
- Helpful message explaining why empty
- Clear CTA to fix it
- Examples:
  - "No projects yet" → "Add your first project"
  - "No distributions" → "Deposit your first revenue"

#### 9. Stats Display

**Large Number Stats:**
- Big number (36px+)
- Small label below
- Optional trend indicator
- Optional chart sparkline

**Metric Cards:**
- Icon on left
- Label and value on right
- Color-coded based on meaning

#### 10. Badge Display

**Single Badge:**
- Icon with tooltip on hover
- Tooltip explains meaning

**Multiple Badges:**
- Row of badge icons
- Max 4 shown, "+X more" indicator
- Clicking opens modal with all badges + descriptions

---

## Key Screen Mockups

### Phase 3: High-Fidelity Screens (Week 3-4)

#### 1. Landing Page

**Hero Section:**
- Bold headline (value proposition)
- Subheadline (how it works)
- Primary CTA ("Add Your Project")
- Secondary CTA ("Explore Projects")
- Hero image/illustration

**How It Works Section:**
3 steps with icons:
1. "Declare Your IP" (Instagram icon)
2. "Share Revenue" (dollar icon)
3. "Build Trust" (badge icons)

**Featured Projects:**
- 3-4 project cards
- Show badges prominently
- Key stats visible

**Stats Section:**
- Total value distributed
- Number of projects
- Number of distributions
- Animated counters

**CTA Section:**
- For Creators: "Launch on Align"
- For Holders: "Explore Projects"

**Footer:**
- Links (Docs, Twitter, etc)
- Legal (Terms, Privacy)

**Mobile responsive:** All sections stack vertically

#### 2. Creator Dashboard (Multi-step flow)

**Step 1: Connect Wallet**
- Large "Connect Wallet" button
- Supported wallet icons shown
- Clean, simple

**Step 2: Enter Token**
- Input field for token address
- "Validate" button
- Shows token info once validated

**Step 3: Declare IP (Key Screen!)**

**Social Assets Section:**
- Checkboxes for each platform
- For each enabled platform:
  - Handle input (auto-formatted @)
  - Follower tier dropdown
  - Unique verification code displayed
  - Instructions: "Add 'align-abc123' to your Instagram bio"
  - "Request Verification" button
  - Status indicator (pending/verified)

**Creative Assets Section:**
- Character/mascot upload
- Logo upload  
- Content library URL

**Legal Assets Section:**
- Domain name inputs (+ Add More button)
- Trademark form fields
- Copyright description

**Revenue Sources:**
- Checkboxes with icons
- Multi-select

**Step 4: Team Wallets**
- Input fields for wallet addresses
- "+ Add Another" button
- Shows calculated team %

**Step 5: Review & Sign**
- Summary card showing everything declared
- Legal ToS checkbox
- "Sign Commitment" button (triggers wallet)
- "Submit for Review" button

**Step 6: Pending Review**
- Status: "Pending Review"
- Message: "Our team is reviewing your project. You'll get an email within 24-48 hours."
- What happens next explanation

**Post-Approval Dashboard:**
- Project overview card (stats, badges)
- "Add Revenue Commitment" section
- Distribution history table
- Community support received
- Edit profile button

#### 3. Token Holder Dashboard

**Portfolio View:**
- List of all projects held
- Each shows:
  - Project name + avatar
  - Your holdings
  - Claimable amount (if any)
  - Total earned
  - Badges

**Claim Section:**
- "Claim All" button (prominent)
- Or individual claim buttons per project

**Project Details Modal:**
When clicking a project:
- Full IP registry display
  - All social assets with verification status
  - Creative assets with images
  - Legal assets
  - Revenue sources
- Revenue commitment details
- Distribution history for this project
- "Send Tokens to Creator" button

**Earnings Summary:**
- Total earned across all projects
- Breakdown by project (pie chart?)
- Historical timeline

#### 4. Public Explorer

**Project List View:**
- Search bar at top
- Filter options:
  - By badge
  - By platform (Instagram, Twitter, etc)
  - By follower tier
  - By revenue share %
- Sort options:
  - Most distributed
  - Highest yield
  - Most holders
  - Recently added

**Project Cards in Grid:**
Each card shows:
- Project avatar/logo
- Project name + token symbol
- Badges row
- Key stats:
  - Follower count (summed)
  - Revenue share %
  - Total distributed
  - Holder yield %
- "View Details" button

**Project Detail Page:**

**Header Section:**
- Large project avatar
- Project name
- Token symbol + contract address (copy button)
- Badge row (prominent)
- Key stats row

**IP Registry Section:**
- Social Assets tab (default)
  - List of all socials with:
    - Platform icon
    - Handle (clickable link)
    - Follower tier
    - Verification status
- Creative Assets tab
  - Images displayed
  - Descriptions
- Legal Assets tab
  - List of domains, trademarks, copyrights
- Revenue Sources tab
  - Current and planned sources

**Transparency Section:**
- Team wallets listed with % holdings
- Top 10 holders (anonymized addresses) with %
- Total holder count

**Distribution Section:**
- Revenue commitment details (X% to holders)
- Total distributed to date
- Distribution history table:
  - Date
  - Amount
  - Holders who claimed
  - Yield %

**Revenue Stats:**
- Total distributed
- Last distribution date
- Average per distribution
- Holder yield (simple %)
- Distribution frequency

#### 5. Admin Panel (Your Review Interface)

**Pending Reviews Queue:**
- List of projects awaiting review
- Each shows:
  - Project name
  - Token address
  - Submission date
  - Quick preview (badges requested)
- Sort: Oldest first

**Review Detail Screen:**

**Project Overview:**
- Token info (pulled from chain)
- Creator wallet address

**IP Assets Review:**
For each social asset:
- Platform + handle
- Claimed follower tier
- Verification code shown
- "Check Bio" button (opens profile in new tab)
- Checkbox: "Verified"

For creative/legal assets:
- Display uploaded images
- Show entered text

**Team Wallets:**
- List of declared team wallets
- On-chain % holdings calculated

**Review Checklist:**
- [ ] Follower counts roughly match claims
- [ ] No obvious bot accounts
- [ ] Verification codes present in bios
- [ ] Project seems legitimate
- [ ] No known scam history

**Actions:**
- "Approve Project" button (green)
- "Reject Project" button (red)
  - Opens modal: "Reason for rejection" text field
  - Sends to creator
- "Request More Info" button (yellow)
  - Opens modal for questions

**Approved Projects Dashboard:**
- List of all live projects
- Quick stats
- Ability to:
  - Pause project (if issues arise)
  - Edit project (admin override)
  - View activity

---

## Design Principles

### 1. Transparency First
Everything should feel open and honest. No hidden information. Clear data display.

### 2. Trust Through Design
Professional polish. No bugs or broken states. Smooth interactions.

### 3. Accessibility
- WCAG AA compliant contrast ratios
- Keyboard navigation support
- Screen reader friendly
- Touch targets: Minimum 44px x 44px

### 4. Mobile-First
Design for mobile, scale up to desktop. Most users will be on mobile.

### 5. Performance
- Fast loading
- Optimized images
- Smooth animations (60fps)
- No janky scrolling

### 6. Consistency
Every button looks like a button. Every card looks like a card. Predictable patterns.

### 7. Progressive Disclosure
Don't overwhelm with information. Show basics, reveal details on demand.

---

## Responsive Breakpoints

```
Mobile: 320px - 639px (single column)
Tablet: 640px - 1023px (flexible columns)
Desktop: 1024px - 1439px (multi-column)
Large Desktop: 1440px+ (max-width container)
```

**Layout Strategy:**
- Mobile: Stack everything vertically
- Tablet: 2-column grid where appropriate
- Desktop: 3+ column grid, sidebar navigation
- Large: Centered content, max-width 1280px

---

## Animation & Interaction

**Timing:**
- Micro-interactions: 150-200ms
- Page transitions: 300ms
- Modal open/close: 200ms
- Hover states: Instant (0ms delay)

**Easing:**
- Default: ease-in-out
- Entrances: ease-out (feels snappy)
- Exits: ease-in (feels smooth)

**Animations to Include:**
- Badge earning (celebratory pop-in)
- Claim success (coins falling?)
- Distribution notification (slide-in toast)
- Loading states (smooth skeleton→content transition)
- Number counting (for stats)

**Avoid:**
- Slow animations (nothing over 500ms)
- Distracting motion
- Animations that delay functionality

---

## Accessibility Requirements

### Color Contrast
- Text on background: Minimum 4.5:1
- Large text (18px+): Minimum 3:1
- UI components: Minimum 3:1

### Focus States
- Visible focus ring on all interactive elements
- Never remove outline without custom replacement
- Keyboard navigation order matches visual order

### Alt Text
- All images have descriptive alt text
- Decorative images: alt=""
- Icons with meaning: aria-label

### Form Labels
- Every input has a visible label
- Error messages are descriptive
- Success states are communicated

### Responsive Text
- Base: 16px (never smaller for body text)
- Mobile: Can be 14px minimum for UI elements
- Line height: Minimum 1.5x for readability

---

## File Organization

Deliverable structure for designer:

```
/align-design-system/
  /01-brand/
    align-logo.svg
    align-logo-icon.svg
    align-logo-dark.svg
    color-palette.pdf
    typography-guide.pdf
  
  /02-badges/
    verified-creator.svg
    verified-creator.png (32px, 64px, 128px)
    strong-ip.svg
    strong-ip.png (32px, 64px, 128px)
    consistent-distributor.svg
    consistent-distributor.png (32px, 64px, 128px)
    high-yield.svg
    high-yield.png (32px, 64px, 128px)
  
  /03-components/
    buttons.fig (or .sketch)
    forms.fig
    cards.fig
    navigation.fig
    modals.fig
    
  /04-screens/
    landing-page.fig
    creator-dashboard.fig
    holder-dashboard.fig
    public-explorer.fig
    admin-panel.fig
    
  /05-mobile/
    (mobile versions of all screens)
  
  /06-style-guide/
    design-system-documentation.pdf
    
  /07-assets/
    /icons/
    /illustrations/
    /images/
```

---

## Designer Brief Template

When hiring, send them this:

**Project:** Align - Creator token transparency platform  
**Deliverables:** Full brand identity + UI design system  
**Timeline:** 4-5 weeks  
**Budget:** $6k-12k  

**Phase 1 (Week 1-2):** Brand identity
- Logo (multiple formats)
- Color palette
- Typography
- 4 badge designs
- Icon style guide

**Phase 2 (Week 2-3):** Component library
- Buttons, forms, cards, navigation, modals
- Light and dark mode
- All states (hover, active, disabled, etc)

**Phase 3 (Week 3-4):** Screen mockups
- Landing page
- Creator dashboard (full flow)
- Token holder dashboard  
- Public explorer
- Admin panel
- Mobile versions

**Phase 4 (Week 4-5):** Documentation + handoff
- Design system documentation
- Developer handoff files
- Asset export
- Style guide PDF

**Tools:** Figma preferred (for developer handoff)

**References:** 
- Jupiter (for clean crypto UI)
- Birdeye (for data display)
- Phantom (for friendly crypto feel)
- Linear (for professional polish)

**Vibe:** Professional but accessible. Trust through design. Crypto-native but not generic.

---

## Review Checkpoints

**After Week 1:**
- ✓ Logo concepts (3 options)
- ✓ Color palette (2-3 options)
- ✓ Typography pairing
- **Decision:** Pick direction, refine

**After Week 2:**
- ✓ Final logo (all formats)
- ✓ Final color palette
- ✓ Badge designs (all 4)
- ✓ Component library started
- **Decision:** Approve brand, start screens

**After Week 3:**
- ✓ All components designed
- ✓ Landing page mockup
- ✓ Key screens in progress
- **Decision:** Approve components, continue screens

**After Week 4:**
- ✓ All screens designed (desktop)
- ✓ Mobile versions
- **Decision:** Final revisions

**After Week 5:**
- ✓ Design system documentation
- ✓ All files organized and delivered
- ✓ Developer handoff complete
- **Decision:** Sign off, start development

---

## Questions to Answer Before Starting

**For You (Gabriel):**
1. What's your gut reaction to purple vs blue vs other colors?
2. Any crypto products whose design you really admire?
3. Any crypto products whose design you hate?
4. How formal vs casual should the tone be? (Coinbase formal or Phantom friendly?)
5. Do you have existing brand elements? (Even a sketch helps)

**For Designer Selection:**
1. Do they have crypto/web3 work in portfolio?
2. Can they do both brand identity AND UI design?
3. Do they work in Figma? (Critical for dev handoff)
4. What's their typical timeline?
5. Can they do both light and dark mode?
6. Do they understand accessibility requirements?

---

## Budget Breakdown

**Lean ($6k-8k):**
- Logo + brand: $2k
- Badge designs: $500
- Component library: $1.5k
- Key screens only: $2k-4k
- Basic documentation: Included
- Total: $6k-8k

**Standard ($8k-12k):**
- Full brand identity: $3k
- Badge designs: $800
- Complete component library: $2.5k
- All screen mockups: $4k-6k
- Full documentation: $500-1k
- Total: $8k-12k

**Premium ($12k-15k):**
- Everything in Standard, plus:
- Brand strategy consultation: $1k
- Multiple logo concepts: +$500
- Animation guidelines: +$500
- Marketing assets: +$1k
- Extended revisions: +$500
- Total: $12k-15k

**Recommendation:** Go with Standard ($8k-12k) - It's comprehensive enough to build from and not wasteful.

---

## Next Steps

1. **This Week:**
   - Decide on color direction preference
   - Look at 5 crypto products you like visually
   - Screenshot what you like about them
   - Write 5 words describing how Align should feel

2. **Next Week:**
   - Post designer job on Dribbble, Upwork, Twitter
   - Review portfolios (prioritize crypto experience)
   - Interview 3-5 designers
   - Share this brief with top candidates

3. **Week 3:**
   - Hire designer
   - First checkpoint: Logo concepts
   - Give feedback, iterate

4. **Week 4-5:**
   - Weekly reviews
   - Keep designer on track
   - Approve each phase

5. **Week 6:**
   - Final delivery
   - Assets organized
   - Ready for development handoff

Ready to start? Let me know your color preference and we can refine the brief for designers.


design json: {
  "meta": {
    "name": "Lime Dashboard Design System",
    "version": "1.0.0",
    "description": "High-level design guidelines distilled from a soft, bright productivity dashboard. This file is intended to guide AI tools to recreate the same look and feel consistently across the app."
  },
  "designPrinciples": [
    {
      "name": "Soft but Structured",
      "description": "Use soft, rounded shapes and bright accents, but always within a clear grid and hierarchy. The UI should feel friendly and approachable without losing professional clarity."
    },
    {
      "name": "Clarity Over Decoration",
      "description": "Every color, shadow, and shape must serve a purpose: hierarchy, status, or emphasis. Avoid unnecessary borders, lines, or visual noise. Let typography, spacing, and subtle contrast do the heavy lifting."
    },
    {
      "name": "Whitespace as a First-Class Element",
      "description": "Generous white space inside and between cards keeps a dense dashboard feeling calm and breathable. Space is a design tool: use it to group related content and separate modules."
    },
    {
      "name": "Single Strong Accent",
      "description": "Use a single saturated purple as the primary accent for interaction and status. Supporting colors (green for success, soft yellow background) should never compete with the main accent."
    },
    {
      "name": "Human-Centric Information Design",
      "description": "Surface the most important elements first: names, titles, and current status. Secondary information like timestamps, roles, and helper text should be visually lighter and smaller."
    },
    {
      "name": "Minimal Chrome",
      "description": "Avoid visible borders where possible. Prefer elevation, color contrast, and spacing to separate elements. Cards sit on a colored background; components sit inside cards."
    }
  ],
  "foundations": {
    "colors": {
      "palette": {
        "pageBackground": "#E3F06F",
        "cardBackground": "#FFFFFF",
        "subtleBackground": "#F7F8FB",
        "accentPrimary": "#7C4DFF",
        "accentPrimarySoft": "#EEE7FF",
        "accentSuccess": "#36C170",
        "accentSuccessSoft": "#E3F8ED",
        "accentWarning": "#FFC857",
        "textPrimary": "#1A1A1E",
        "textSecondary": "#6F7280",
        "textMuted": "#A3A7B5",
        "iconDefault": "#B6BAC7",
        "borderSubtle": "#E5E7F0",
        "shadowColor": "rgba(15, 23, 42, 0.06)"
      },
      "semantics": {
        "background.page": {
          "token": "pageBackground",
          "usage": "The full-page canvas color. Always a soft lime / yellow-green wash behind all cards. Never used for content areas."
        },
        "background.card": {
          "token": "cardBackground",
          "usage": "Default surface for all content cards, lists, and components. Always white."
        },
        "background.nested": {
          "token": "subtleBackground",
          "usage": "Use for subtle nested elements inside cards (secondary buttons, inner chips if needed)."
        },
        "accent.primary": {
          "token": "accentPrimary",
          "usage": "Use for core interactive highlights: progress rings, active toggles, primary small accents, key status labels."
        },
        "accent.primarySoft": {
          "token": "accentPrimarySoft",
          "usage": "Use as a soft halo or background behind primary accent elements when more contrast is needed without heaviness."
        },
        "accent.success": {
          "token": "accentSuccess",
          "usage": "Positive actions and states (e.g. Accept button, success chips). Should never overpower accent.primary."
        },
        "accent.warning": {
          "token": "accentWarning",
          "usage": "Subtle attention or counts (e.g. unread badge) where warning is informational, not alarming."
        },
        "text.primary": {
          "token": "textPrimary",
          "usage": "High-importance text: names, main titles, key labels."
        },
        "text.secondary": {
          "token": "textSecondary",
          "usage": "Supporting text: roles, section subtitles, control labels."
        },
        "text.muted": {
          "token": "textMuted",
          "usage": "Low-emphasis meta information: timestamps, helper text, calendar days not in focus."
        },
        "border.subtle": {
          "token": "borderSubtle",
          "usage": "Use only when absolutely needed to separate elements; prefer spacing and shadows first."
        }
      }
    },
    "typography": {
      "fontFamilies": {
        "primary": [
          "system-ui",
          "-apple-system",
          "SF Pro Rounded",
          "SF Pro Text",
          "Inter",
          "Nunito",
          "sans-serif"
        ]
      },
      "textStyles": {
        "display": {
          "fontSize": 28,
          "lineHeight": 1.4,
          "fontWeight": 700,
          "letterSpacing": -0.02,
          "color": "text.primary",
          "usage": "Hero card titles such as project names. Should feel bold and confident but not huge."
        },
        "title": {
          "fontSize": 22,
          "lineHeight": 1.4,
          "fontWeight": 600,
          "letterSpacing": -0.01,
          "color": "text.primary",
          "usage": "Section/card titles, e.g. Notifications, Integrations."
        },
        "headline": {
          "fontSize": 18,
          "lineHeight": 1.4,
          "fontWeight": 600,
          "letterSpacing": -0.01,
          "color": "text.primary",
          "usage": "Important labels or names, such as user names or milestone titles."
        },
        "body": {
          "fontSize": 14,
          "lineHeight": 1.6,
          "fontWeight": 400,
          "letterSpacing": 0,
          "color": "text.secondary",
          "usage": "Primary body copy within cards and notifications."
        },
        "bodyStrong": {
          "fontSize": 14,
          "lineHeight": 1.6,
          "fontWeight": 500,
          "letterSpacing": 0,
          "color": "text.primary",
          "usage": "Key phrases within body text that need subtle emphasis."
        },
        "caption": {
          "fontSize": 12,
          "lineHeight": 1.4,
          "fontWeight": 400,
          "letterSpacing": 0,
          "color": "text.muted",
          "usage": "Timestamps, meta labels, helper text, and calendar day labels."
        },
        "label": {
          "fontSize": 13,
          "lineHeight": 1.4,
          "fontWeight": 500,
          "letterSpacing": 0,
          "color": "text.secondary",
          "usage": "Button labels, small pills, and toggle labels."
        }
      }
    },
    "spacing": {
      "scale": {
        "xxs": 4,
        "xs": 8,
        "sm": 12,
        "md": 16,
        "lg": 24,
        "xl": 32,
        "xxl": 40
      },
      "guidelines": [
        "Use lg (24) as the default padding inside major cards.",
        "Use md (16) padding for compact cards and inner content groups.",
        "Use xs (8) or sm (12) between related elements in the same group (avatar and name, name and role).",
        "Use lg (24) or xl (32) as vertical gaps between stacked cards.",
        "Never cram elements tighter than xxs (4); the design relies on comfortable breathing room."
      ]
    },
    "radii": {
      "cardLarge": {
        "value": 24,
        "usage": "Default outer card containers across the layout."
      },
      "cardExtraLarge": {
        "value": 28,
        "usage": "Special hero modules that should feel more playful or cloud-like."
      },
      "control": {
        "value": 999,
        "usage": "Pills, tags, buttons, chips, and toggles. Use fully rounded shapes for controls."
      },
      "avatar": {
        "value": 999,
        "usage": "All avatars are perfect circles."
      }
    },
    "shadows": {
      "card": {
        "offsetX": 0,
        "offsetY": 20,
        "blurRadius": 40,
        "spreadRadius": 0,
        "color": "shadowColor",
        "usage": "Primary elevation for dashboard cards. Soft, wide, low-opacity shadow to lift cards gently from the colored background."
      },
      "chip": {
        "offsetX": 0,
        "offsetY": 8,
        "blurRadius": 20,
        "spreadRadius": 0,
        "color": "rgba(15, 23, 42, 0.08)",
        "usage": "For brand chips (Stripe, Visa, etc.) and pill elements that should appear tappable."
      },
      "floating": {
        "offsetX": 0,
        "offsetY": 24,
        "blurRadius": 60,
        "spreadRadius": 0,
        "color": "rgba(15, 23, 42, 0.10)",
        "usage": "For menus or elements that temporarily float above cards (dropdowns, dialogs)."
      }
    },
    "iconography": {
      "style": "Rounded, minimal icons with simple shapes and no heavy outlines.",
      "stroke": {
        "width": 1.5,
        "color": "iconDefault"
      },
      "sizes": {
        "sm": 16,
        "md": 20,
        "lg": 24
      },
      "usageNotes": [
        "Use simple three-dot icons for secondary actions in card headers and list rows.",
        "Status icons should be small and secondary to text; they should never compete with the main accent color fill.",
        "Keep icon language consistent: slightly rounded corners, soft curves, no overly angular or sharp pictograms."
      ]
    }
  },
  "layout": {
    "grid": {
      "type": "multi-column dashboard",
      "columnsDesktop": 12,
      "gutter": 24,
      "outerMargin": 32,
      "columnUsage": [
        "Use a left column for personal and notification-related modules.",
        "Central columns focus on scheduling and people (calendar and assignee lists).",
        "Right columns surface project status, milestones, and integrations."
      ],
      "alignmentRules": [
        "Align card edges along the same vertical grid lines to create a stable rhythm.",
        "Keep vertical gaps between stacked cards consistent within each column.",
        "Ensure avatars and text blocks line up across rows to avoid visual jitter."
      ]
    },
    "cards": {
      "stacking": "Cards sit on the colored page background with consistent spacing and shared shadows.",
      "padding": {
        "default": "lg",
        "compact": "md"
      },
      "headerLayout": "Header row contains the primary label on the left and a minimal control (such as an overflow menu) on the right.",
      "contentLayout": "Use vertical sections inside cards separated by spacing, not borders. Group related rows together so the card reads as small stories rather than disconnected snippets."
    },
    "density": {
      "description": "Moderate information density with generous whitespace and clear grouping.",
      "rules": [
        "Prefer multiple smaller cards over one very dense card.",
        "Keep a consistent rhythm of text sizes and line heights to avoid visual noise.",
        "Use white space to create clear stories: profile overview, notification feed, calendar, project status, integrations."
      ]
    }
  },
  "components": {
    "Card": {
      "purpose": "Primary container for grouped information such as profile summary, notifications, calendar, or project details.",
      "anatomy": [
        "container",
        "header (optional)",
        "body",
        "footer (optional)"
      ],
      "styles": {
        "container": {
          "backgroundColor": "background.card",
          "borderRadius": "cardLarge",
          "shadow": "card",
          "padding": "lg"
        },
        "header": {
          "layout": "horizontal, space-between, vertically centered",
          "titleTextStyle": "title",
          "metaTextStyle": "caption",
          "rightIcon": "three-dots or subtle icon button with iconDefault color"
        },
        "body": {
          "layout": "vertical stacking with clear grouping and spacing.md between rows"
        },
        "footer": {
          "layout": "horizontal actions or secondary information, lighter typographic treatment"
        }
      }
    },
    "ProfileHeaderCard": {
      "purpose": "Showcase the main user, their role, and key skill tags in a welcoming way.",
      "anatomy": [
        "container",
        "avatar",
        "name",
        "role",
        "skillTags",
        "overflowMenu"
      ],
      "styles": {
        "container": {
          "base": "Card.container",
          "alignment": "left",
          "verticalSpacing": "sm"
        },
        "avatar": {
          "shape": "circle",
          "size": 64,
          "borderRadius": "avatar",
          "position": "top-left, with space.md to the name below"
        },
        "name": {
          "textStyle": "headline",
          "color": "text.primary"
        },
        "role": {
          "textStyle": "body",
          "color": "text.secondary"
        },
        "skillTags": {
          "layout": "horizontal wrap with gap.xs",
          "component": "TagPill"
        },
        "overflowMenu": {
          "position": "top-right",
          "icon": "three-dots",
          "touchTarget": 32
        }
      }
    },
    "TagPill": {
      "purpose": "Represent skills, categories, and small labels in a soft, unobtrusive way.",
      "anatomy": [
        "container",
        "label"
      ],
      "styles": {
        "container": {
          "backgroundColor": "background.nested or cardBackground",
          "borderRadius": "control",
          "paddingHorizontal": 12,
          "paddingVertical": 6,
          "shadow": "chip (very subtle for most tags)",
          "border": "none"
        },
        "label": {
          "textStyle": "label",
          "color": "text.secondary"
        }
      }
    },
    "Button": {
      "purpose": "Trigger actions such as accepting an invitation, viewing details, or marking all as read.",
      "variants": {
        "primary": {
          "backgroundColor": "accentSuccess",
          "textColor": "#FFFFFF",
          "borderRadius": "control",
          "paddingHorizontal": 16,
          "paddingVertical": 8,
          "textStyle": "label"
        },
        "secondary": {
          "backgroundColor": "cardBackground",
          "textColor": "text.secondary",
          "borderRadius": "control",
          "paddingHorizontal": 16,
          "paddingVertical": 8,
          "borderColor": "border.subtle",
          "borderWidth": 1,
          "textStyle": "label"
        },
        "ghost": {
          "backgroundColor": "transparent",
          "textColor": "text.secondary",
          "borderRadius": "control",
          "paddingHorizontal": 12,
          "paddingVertical": 6,
          "textStyle": "label"
        }
      },
      "states": {
        "default": "As specified above.",
        "hover": "Slightly darken the background and increase shadow subtly, without changing shape.",
        "pressed": "Reduce elevation and darken background by 5–10%.",
        "disabled": "Reduce opacity of background and text to ~40%, remove shadow."
      }
    },
    "Avatar": {
      "purpose": "Visually represent people across the interface: profile, assignees, and notification actors.",
      "anatomy": [
        "image",
        "optionalStatusBadge"
      ],
      "styles": {
        "image": {
          "shape": "circle",
          "sizes": {
            "lg": 64,
            "md": 40,
            "sm": 32,
            "xs": 24
          },
          "borderRadius": "avatar",
          "shadow": "none or very subtle for stacked avatars"
        },
        "stackedGroup": {
          "overlap": 8,
          "maxVisible": 5,
          "border": {
            "color": "cardBackground",
            "width": 2
          }
        }
      }
    },
    "NotificationItem": {
      "purpose": "Communicate recent events and allow quick actions (accept, deny, view more).",
      "anatomy": [
        "container",
        "avatar",
        "contentText",
        "timestamp",
        "primaryAction",
        "secondaryAction",
        "overflowMenu"
      ],
      "styles": {
        "container": {
          "backgroundColor": "cardBackground",
          "borderRadius": 16,
          "padding": "md",
          "layout": "horizontal with avatar on the left, text in the middle, actions on the right",
          "spacing": "md between sections"
        },
        "contentText": {
          "primary": {
            "textStyle": "bodyStrong"
          },
          "secondary": {
            "textStyle": "body"
          }
        },
        "timestamp": {
          "textStyle": "caption",
          "color": "text.muted"
        },
        "primaryAction": {
          "component": "Button.primary"
        },
        "secondaryAction": {
          "component": "Button.secondary"
        },
        "overflowMenu": {
          "icon": "three-dots",
          "size": "md"
        }
      }
    },
    "PeopleListItem": {
      "purpose": "Show a person involved in the project, with role and a subtle contextual action (chat).",
      "anatomy": [
        "container",
        "avatar",
        "name",
        "role",
        "actionIcon"
      ],
      "styles": {
        "container": {
          "backgroundColor": "cardBackground",
          "borderRadius": 20,
          "padding": "md",
          "shadow": "card (very soft, smaller blur)",
          "layout": "horizontal with avatar, text, and right-aligned action"
        },
        "name": {
          "textStyle": "bodyStrong"
        },
        "role": {
          "textStyle": "caption"
        },
        "actionIcon": {
          "shape": "circle",
          "size": 32,
          "backgroundColor": "subtleBackground",
          "iconColor": "accentPrimary"
        }
      }
    },
    "ToggleSwitch": {
      "purpose": "Represent binary settings for integrations and features.",
      "anatomy": [
        "track",
        "thumb"
      ],
      "styles": {
        "track": {
          "height": 24,
          "width": 44,
          "borderRadius": "control",
          "backgroundColorOn": "accentPrimary",
          "backgroundColorOff": "subtleBackground"
        },
        "thumb": {
          "size": 18,
          "borderRadius": "control",
          "backgroundColor": "cardBackground",
          "shadow": "chip"
        }
      },
      "states": {
        "on": "Track filled with accentPrimary, thumb aligned to right.",
        "off": "Track filled with subtleBackground, thumb aligned to left.",
        "hover": "Slightly increase shadow on thumb.",
        "disabled": "Reduce opacity of both track and thumb."
      }
    },
    "ProgressCircle": {
      "purpose": "Visualize completion percentage for tasks or projects in a compact, friendly way.",
      "anatomy": [
        "backgroundRing",
        "foregroundRing",
        "centerLabel"
      ],
      "styles": {
        "backgroundRing": {
          "strokeColor": "border.subtle",
          "thickness": 4
        },
        "foregroundRing": {
          "strokeColor": "accentPrimary",
          "thickness": 4,
          "cap": "round"
        },
        "centerLabel": {
          "textStyle": "label",
          "color": "text.primary"
        }
      }
    },
    "Calendar": {
      "purpose": "Provide a monthly view of dates with a clear indication of the selected day.",
      "anatomy": [
        "container",
        "header",
        "weekdaysRow",
        "daysGrid"
      ],
      "styles": {
        "container": {
          "base": "Card.container"
        },
        "header": {
          "layout": "horizontal, space-between",
          "textStyle": "headline",
          "controls": "subtle chevron icons for previous/next month"
        },
        "weekdaysRow": {
          "textStyle": "caption",
          "color": "text.muted",
          "alignment": "center"
        },
        "dayCell": {
          "size": 32,
          "textStyle": "body",
          "alignment": "center",
          "borderRadius": "control"
        },
        "dayStates": {
          "default": {
            " textColor": "text.secondary",
            "backgroundColor": "transparent"
          },
          "selected": {
            "textColor": "#FFFFFF",
            "backgroundColor": "accentPrimary"
          },
          "outOfMonth": {
            "textColor": "text.muted",
            "backgroundColor": "transparent"
          }
        }
      }
    },
    "Badge": {
      "purpose": "Show small counts or status labels such as unread counts.",
      "anatomy": [
        "container",
        "label"
      ],
      "styles": {
        "container": {
          "backgroundColor": "accentWarning",
          "borderRadius": "control",
          "paddingHorizontal": 8,
          "paddingVertical": 4
        },
        "label": {
          "textStyle": "caption",
          "color": "#000000"
        }
      }
    },
    "IntegrationItem": {
      "purpose": "Represent a connected integration (Slack, Google Meet, Github) with a short description and toggle.",
      "anatomy": [
        "icon",
        "name",
        "description",
        "toggle"
      ],
      "styles": {
        "container": {
          "layout": "horizontal, space-between",
          "paddingVertical": "sm",
          "paddingHorizontal": 0
        },
        "name": {
          "textStyle": "bodyStrong"
        },
        "description": {
          "textStyle": "caption"
        },
        "toggle": {
          "component": "ToggleSwitch"
        }
      }
    },
    "BrandChip": {
      "purpose": "Show payment or service providers (Stripe, Visa, PayPal, Mastercard) as branded chips.",
      "anatomy": [
        "container",
        "brandLogo"
      ],
      "styles": {
        "container": {
          "backgroundColor": "cardBackground",
          "borderRadius": "control",
          "paddingHorizontal": 16,
          "paddingVertical": 10,
          "shadow": "chip"
        },
        "brandLogo": {
          "maxHeight": 18,
          "maxWidth": 48,
          "alignment": "center"
        }
      }
    },
    "MilestoneCard": {
      "purpose": "Communicate a specific milestone, its due date, and its progress visually.",
      "anatomy": [
        "container",
        "title",
        "meta",
        "progressCircle",
        "assigneeAvatars",
        "ctaButton"
      ],
      "styles": {
        "container": {
          "base": "Card.container",
          "layout": "two-column: text on the left, progress and avatars on the right"
        },
        "title": {
          "textStyle": "headline"
        },
        "meta": {
          "labelStyle": "caption",
          "valueStyle": "bodyStrong"
        },
        "progressCircle": {
          "component": "ProgressCircle"
        },
        "assigneeAvatars": {
          "component": "Avatar.stackedGroup"
        },
        "ctaButton": {
          "component": "Button.secondary"
        }
      }
    }
  }
}


