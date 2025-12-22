# Social Asset Review System - Quick Start Guide

**For developers who need to get up to speed quickly.**

---

## 🚀 What Is This?

A system where community members submit social media accounts and domains for projects, and editors approve/reject them with karma rewards.

---

## 📁 File Locations

### API Endpoints (Sprint 2)
```
app/api/assets/
├── approve/route.ts         # Approve pending asset
├── reject/route.ts          # Reject pending asset
└── ban-user/route.ts        # Ban submitter
```

### Helper Functions
```
lib/permissions/
└── editor-permissions.ts    # Permission checking

lib/notifications/
└── social-asset-notifications.ts  # Notification helpers

lib/karma.ts                 # Karma calculations
```

### Components (Sprint 1)
```
components/
└── AddAssetModal.tsx        # Asset submission form
```

### Database
```
supabase-migrations/
└── 056_social_asset_review_system.sql
```

---

## 🎯 Core Concepts

### Asset Classification
- **Official** - Project-owned accounts (e.g., @ProjectTwitter)
- **Affiliated** - Community/partner accounts (e.g., @FanPage)

### Asset Types
- **Social** - Instagram, Twitter, TikTok, YouTube
- **Domain** - Websites (stored as platform='domain')

### Karma Split
- **25%** - Awarded immediately on submission
- **75%** - Awarded when editor approves
- **0%** - No deduction if rejected

### Verification Status
- `pending` - Just submitted, awaiting review
- `verified` - Approved by editor
- `rejected` - Rejected by editor
- `hidden` - User banned or asset reported

---

## 🔌 API Usage

### Approve Asset
```typescript
POST /api/assets/approve

{
  "assetId": "uuid",
  "projectId": "uuid",
  "editorWallet": "wallet_address"
}

→ Awards 75% karma to submitter
→ Moves to social_assets table
→ Sends notification
```

### Reject Asset
```typescript
POST /api/assets/reject

{
  "assetId": "uuid",
  "projectId": "uuid",
  "editorWallet": "wallet_address",
  "reason": "Not affiliated"  // optional
}

→ Updates status to 'rejected'
→ Does NOT deduct karma
→ Sends notification with reason
```

### Ban User
```typescript
POST /api/assets/ban-user

{
  "userWallet": "wallet_address",
  "projectId": "uuid",
  "editorWallet": "wallet_address",
  "reason": "Spam",
  "duration": "30d"  // or "7d", "90d", "permanent"
}

→ Sets is_banned = true
→ Hides all pending assets
→ Calculates expiration date
```

---

## 🔐 Permission Checking

### Quick Check
```typescript
import { checkEditorPermission, requireEditorPermission } from '@/lib/permissions/editor-permissions'

const permissionCheck = await checkEditorPermission(projectId, wallet)
const error = requireEditorPermission(permissionCheck)

if (error) {
  return NextResponse.json({ error: error.error }, { status: error.status })
}

// User is authorized ✅
```

### Permission Hierarchy
```
Creator (project owner)
  ├─ Can approve/reject assets
  ├─ Can ban users
  ├─ Can add/remove editors
  └─ Can delete project

Editor (in editor_wallets array)
  ├─ Can approve/reject assets
  ├─ Can ban users
  ├─ Can add new editors
  └─ Cannot remove editors

Community Member
  ├─ Can submit assets
  └─ Can view verified assets
```

---

## ⭐ Karma Calculation

### Formula
```typescript
karma = BASE_KARMA × TIER_MULTIPLIER × SPLIT_PERCENTAGE
```

### Example
User with 2% token supply:
```
Tier: Whale (1.0%+) → 5.5x multiplier
Base: 100 points for asset submission

Immediate (25%): 100 × 5.5 × 0.25 = 137.5
Approval (75%): 100 × 5.5 × 0.75 = 412.5
Total: 550 karma
```

### Code
```typescript
import { calculateKarma } from '@/lib/karma'

// Calculate immediate karma (25%)
const immediateKarma = calculateKarma('add', tokenPercentage, true)

// Calculate approval karma (75% = 3x immediate)
const approvalKarma = immediateKarma * 3
```

---

## 📊 Database Queries

### Get Pending Assets
```sql
SELECT * FROM pending_assets
WHERE project_id = 'uuid'
AND verification_status = 'pending'
ORDER BY created_at DESC;
```

### Get Asset with Classification
```sql
SELECT 
  id,
  asset_type,
  asset_classification,
  asset_data,
  submitter_wallet,
  verification_status
FROM pending_assets
WHERE id = 'uuid';
```

### Check User Ban Status
```sql
SELECT is_banned, banned_at, ban_expires_at
FROM wallet_karma
WHERE wallet_address = 'wallet'
AND project_id = 'uuid';
```

### Award Karma (RPC)
```sql
SELECT add_karma(
  'wallet_address',
  'project_uuid',
  412.5
);
```

---

## 🔔 Notifications

### Send Approval Notification
```typescript
import { notifyAssetApproved } from '@/lib/notifications/social-asset-notifications'

await notifyAssetApproved(
  submitterWallet,
  projectId,
  assetId,
  'social',  // or 'domain'
  { platform: 'twitter', handle: 'example' },
  'official',  // or 'affiliated'
  editorWallet,
  412.5  // karma awarded
)
```

### Send Rejection Notification
```typescript
import { notifyAssetRejected } from '@/lib/notifications/social-asset-notifications'

await notifyAssetRejected(
  submitterWallet,
  projectId,
  assetId,
  'social',
  { platform: 'instagram', handle: 'test' },
  'affiliated',
  editorWallet,
  'Account not related to project'  // optional reason
)
```

---

## 🧪 Quick Test

### Test Approval
```bash
curl -X POST http://localhost:3000/api/assets/approve \
  -H "Content-Type: application/json" \
  -d '{"assetId":"YOUR_UUID","projectId":"YOUR_UUID","editorWallet":"YOUR_WALLET"}'
```

### Verify in DB
```sql
-- Check asset moved to social_assets
SELECT * FROM social_assets ORDER BY created_at DESC LIMIT 1;

-- Check karma awarded
SELECT total_karma_points FROM wallet_karma 
WHERE wallet_address = 'submitter_wallet';

-- Check notification sent
SELECT * FROM notifications 
WHERE type = 'social_asset_approved' 
ORDER BY created_at DESC LIMIT 1;
```

---

## 🐛 Common Issues

### Issue: "Project not found"
**Cause:** Invalid project UUID or project doesn't exist  
**Fix:** Verify project exists: `SELECT * FROM projects WHERE id = 'uuid'`

### Issue: "Unauthorized"
**Cause:** Wallet is not creator or editor  
**Fix:** Check editor list: `SELECT creator_wallet, editor_wallets FROM projects WHERE id = 'uuid'`

### Issue: "Asset is already verified"
**Cause:** Trying to approve/reject non-pending asset  
**Fix:** Check status: `SELECT verification_status FROM pending_assets WHERE id = 'uuid'`

### Issue: Karma not awarded
**Cause:** RPC function failed or not available  
**Fix:** Check function exists: `SELECT add_karma('test', 'uuid', 1)`

---

## 📝 Code Snippets

### Check if User is Banned
```typescript
const { data: karma } = await supabase
  .from('wallet_karma')
  .select('is_banned, ban_expires_at')
  .eq('wallet_address', userWallet)
  .eq('project_id', projectId)
  .single()

if (karma?.is_banned) {
  // Check if ban expired
  if (karma.ban_expires_at) {
    const expired = new Date(karma.ban_expires_at) < new Date()
    if (!expired) {
      return { error: 'User is banned' }
    }
  } else {
    return { error: 'User is permanently banned' }
  }
}
```

### Get Asset Data (Type-Safe)
```typescript
interface SocialAssetData {
  platform: string
  handle: string
  followerTier?: string
}

interface DomainAssetData {
  domain: string
  url: string
}

const assetData = pendingAsset.asset_data as SocialAssetData | DomainAssetData

if (pendingAsset.asset_type === 'social') {
  const data = assetData as SocialAssetData
  console.log(data.platform, data.handle)
} else {
  const data = assetData as DomainAssetData
  console.log(data.domain, data.url)
}
```

---

## 🎓 Learning Path

1. **Read** `SOCIAL_ASSET_REVIEW_SYSTEM_OVERVIEW.md` (15 min)
2. **Review** database schema in `056_social_asset_review_system.sql` (10 min)
3. **Study** one API endpoint: `app/api/assets/approve/route.ts` (15 min)
4. **Test** with curl commands from test files (15 min)
5. **Build** Sprint 3 Admin UI (next sprint)

**Total:** ~1 hour to understand the system

---

## 🔗 Related Docs

- `SPRINT_2_SUMMARY.md` - Detailed Sprint 2 summary
- `SOCIAL_ASSET_REVIEW_SYSTEM_OVERVIEW.md` - Complete system overview
- `app/api/assets/__tests__/*.test.ts` - Test documentation

---

## 🆘 Need Help?

1. Check the test files for examples
2. Review the OVERVIEW document for architecture
3. Look at similar endpoints in `app/api/` for patterns
4. Check Supabase logs for database errors

---

**Quick Start Complete!** 🎉

You should now understand:
- ✅ What the system does
- ✅ Where files are located
- ✅ How to use the APIs
- ✅ How permissions work
- ✅ How karma is calculated
- ✅ How to test everything

Ready for Sprint 3? Let's build the admin UI! 🚀

