# ✅ Community Curation Database Migration - COMPLETE

**Date**: November 20, 2024  
**Migration**: `003_create_community_curation_tables`  
**Status**: ✅ Successfully Applied

---

## Summary

Successfully created 4 new database tables for the community curation system that enables token holders to collectively verify IP assets through weighted, token-gated voting.

---

## Tables Created

| Table Name | Columns | Purpose |
|------------|---------|---------|
| `pending_assets` | 16 | Asset submission queue with voting metrics |
| `asset_votes` | 8 | Individual vote records (upvote/report) |
| `wallet_karma` | 14 | Reputation system per wallet per project |
| `curation_chat_messages` | 11 | System messages for curation events |

---

## What Was Done

### ✅ 1. Database Schema
- Created 4 tables with proper relationships
- Added 7 performance indexes
- Set up Row Level Security (RLS) policies
- Enabled Supabase Realtime subscriptions

### ✅ 2. TypeScript Types
- Updated `/types/database.ts` with all new table types
- Added Row, Insert, and Update interfaces
- No linter errors

### ✅ 3. Documentation
- Created migration file: `/supabase-migrations/003_create_community_curation_tables.sql`
- Created comprehensive guide: `/COMMUNITY_CURATION_SETUP.md`

---

## Key Features

### 🎯 Token-Gated Voting
Every vote is weighted by token holdings percentage. Major holders have more influence, preventing spam.

### 🏆 Karma System
- **+10 points**: Asset you submitted gets verified
- **+1 point**: Asset you upvoted gets verified  
- **+5 points**: Asset you reported gets hidden
- **-5 points**: Asset you upvoted gets hidden
- **Auto-ban**: 3 warnings = 7-day ban

### 📊 Verification Thresholds
```
Pending  →  0.5% upvotes  →  Backed
         →  2.5% upvotes  →  Verified
         →  2.5% reports →  Hidden
```

### 🔔 Activity Feed
System generates chat messages for:
- Assets added
- Assets backed (0.5%)
- Assets verified (2.5%)
- Assets hidden
- Wallets banned

---

## Security Features

### ✅ Row Level Security
- Pending assets: Read only for live projects
- All tables: Anyone can read
- Votes/submissions: Token validation in API layer

### ✅ Database Constraints
- One vote per wallet per asset (unique constraint)
- One karma record per wallet per project
- Cascade deletes when projects removed

### ✅ Abuse Prevention
- Karma penalties for bad votes
- Warning system with automatic bans
- 7-day ban duration
- Warning history tracked in JSONB

---

## Performance Optimizations

### Indexes Created
```sql
-- Fast lookups by project & status
idx_pending_assets_project (project_id, verification_status)

-- Fast lookups by submitter wallet
idx_pending_assets_submitter (submitter_wallet)

-- Fast vote aggregation
idx_asset_votes_pending (pending_asset_id)

-- Fast karma leaderboard
idx_wallet_karma_project (project_id, total_karma_points DESC)

-- Fast activity feed
idx_curation_chat_project (project_id, created_at DESC)
```

---

## Verification

### ✅ Database Tables
```sql
asset_votes: 8 columns ✓
curation_chat_messages: 11 columns ✓
pending_assets: 16 columns ✓
wallet_karma: 14 columns ✓
```

### ✅ TypeScript Types
All tables added to `/types/database.ts` with no linter errors.

### ✅ Realtime Enabled
All 4 tables added to `supabase_realtime` publication.

---

## Next Implementation Steps

### Phase 1: Core API Endpoints
1. **POST /api/assets/submit**
   - Verify token holdings
   - Create pending_asset
   - Send curation chat message
   - Initialize wallet_karma if needed

2. **POST /api/assets/vote**
   - Verify token holdings
   - Check if already voted (enforce unique constraint)
   - Insert vote with balance snapshot
   - Update pending_asset vote weights
   - Check threshold transitions
   - Award karma if status changes
   - Send chat message if status changes

3. **GET /api/assets/pending**
   - List pending assets for project
   - Include vote counts and status
   - Filter by verification_status

4. **GET /api/assets/karma**
   - Get wallet karma for project
   - Include rank among all holders

### Phase 2: UI Components
1. **AssetSubmissionModal**
   - Form for social/creative/legal assets
   - Token holding check
   - Submission confirmation

2. **PendingAssetCard**
   - Display asset details
   - Show vote counts & progress bars
   - Upvote/Report buttons
   - Real-time vote updates

3. **KarmaBadge**
   - Display user's karma score
   - Show rank (e.g., "Top 10%")
   - Warning count indicator

4. **CurationFeed**
   - System messages mixed with chat
   - Different styling from user messages
   - Icons for different event types

### Phase 3: Business Logic
1. **Vote Weight Calculation**
   ```typescript
   // Example logic
   const voteWeight = (tokenBalance / totalSupply) * 100
   await updateAssetVoteWeight(assetId, voteWeight)
   await checkThresholdTransition(assetId)
   ```

2. **Status Transitions**
   ```typescript
   if (upvoteWeight >= 2.5 && status === 'backed') {
     await verifyAsset(assetId)
     await distributeKarma(assetId, 'verified')
     await sendChatMessage('asset_verified')
   }
   ```

3. **Karma Distribution**
   ```typescript
   // Asset verified
   await awardKarma(submitter, 10)
   await awardKarma(upvoters, 1)
   
   // Asset hidden
   await penalizeKarma(upvoters, -5)
   await awardKarma(reporters, 5)
   ```

4. **Ban System**
   ```typescript
   if (warningCount >= 3) {
     await banWallet(wallet, {
       duration: 7 * 24 * 60 * 60 * 1000, // 7 days
       reason: '3 strikes'
     })
   }
   ```

---

## Example Data Flow

### User Submits Instagram Account
```
1. User clicks "Add Social Account"
2. Form: Platform=Instagram, Handle=@sillynubcat
3. Frontend calls: POST /api/assets/submit
4. API verifies user holds tokens
5. API creates pending_asset:
   {
     asset_type: 'social',
     asset_data: { platform: 'instagram', handle: 'sillynubcat' },
     submitter_wallet: '7x8k...',
     submission_token_percentage: 0.234,
     verification_status: 'pending'
   }
6. API creates curation_chat_message:
   {
     message_type: 'asset_added',
     asset_summary: 'instagram @sillynubcat',
     wallet_address: '7x8k...',
     token_percentage: 0.234
   }
7. Realtime broadcasts to all users
8. UI shows: "🎯 7x8k... (0.23%) added instagram @sillynubcat"
```

### Multiple Users Upvote
```
1. User A (0.3% holder) clicks ⬆️ Upvote
2. API creates asset_vote, updates total_upvote_weight: 0.534%
3. Status changes: 'pending' → 'backed' (>0.5% threshold)
4. Chat message: "✅ instagram @sillynubcat is BACKED (2 holders, 0.53%)"

5. User B (0.8% holder) clicks ⬆️ Upvote  
6. API updates total_upvote_weight: 1.334%

7. Users C, D, E upvote (total: 2.6%)
8. Status changes: 'backed' → 'verified' (>2.5% threshold)
9. Karma distributed:
   - Submitter: +10 points
   - Voters A-E: +1 point each
10. Chat message: "🎉 instagram @sillynubcat is VERIFIED! (5 holders, 2.6%)"
```

---

## Testing Checklist

### Database Level
- [x] Tables created
- [x] Columns match schema
- [x] RLS policies active
- [x] Realtime enabled
- [x] Indexes created
- [x] Foreign keys working

### API Level (To Build)
- [ ] Token verification works
- [ ] Vote weight calculated correctly
- [ ] One vote per wallet enforced
- [ ] Status transitions trigger correctly
- [ ] Karma distributed properly
- [ ] Ban system works
- [ ] Chat messages created

### UI Level (To Build)
- [ ] Submission form validates
- [ ] Vote buttons disabled for banned users
- [ ] Real-time updates work
- [ ] Karma badge displays
- [ ] Progress bars accurate
- [ ] Chat messages styled differently

---

## File Changes Summary

### Created
- ✅ `/supabase-migrations/003_create_community_curation_tables.sql`
- ✅ `/COMMUNITY_CURATION_SETUP.md`
- ✅ `/CURATION_MIGRATION_COMPLETE.md` (this file)

### Modified
- ✅ `/types/database.ts` - Added 4 new table types

---

## Migration Rollback (If Needed)

To rollback this migration:
```sql
-- Drop tables in reverse order (respects foreign keys)
DROP TABLE IF EXISTS curation_chat_messages CASCADE;
DROP TABLE IF EXISTS asset_votes CASCADE;
DROP TABLE IF EXISTS wallet_karma CASCADE;
DROP TABLE IF EXISTS pending_assets CASCADE;
```

---

## Production Considerations

### ⚠️ Before Deploying
1. **Monitor Vote Weights**: Ensure no single wallet dominates
2. **Set Karma Limits**: Consider max karma per wallet
3. **Archive Old Data**: Auto-archive verified/hidden assets after 30 days
4. **Rate Limiting**: Limit submissions/votes per wallet per hour
5. **Ban Appeals**: Add manual admin override for bans

### 💡 Recommended Monitoring
- Average time to verification
- Most active voters
- Karma distribution (ensure fairness)
- Report vs upvote ratio
- Ban rate (should be <1% of users)

---

## Success Metrics

Track these to measure system health:
- **Participation Rate**: % of holders who vote
- **Verification Time**: Average time from submission to verification
- **Accuracy Rate**: % of verified assets that are legitimate
- **False Positives**: % of hidden assets that were actually valid
- **Karma Distribution**: Gini coefficient (lower = more fair)

---

## 🎉 Status: READY FOR DEVELOPMENT

Database foundation is complete and verified. Ready to build API endpoints and UI components!

**Total Tables**: 4 new tables  
**Total Indexes**: 7 performance indexes  
**Total RLS Policies**: 5 security policies  
**TypeScript Types**: 100% coverage  
**Realtime**: Enabled for all tables  

---

**Next**: Build `/api/assets/submit` endpoint 🚀

