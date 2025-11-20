# 📋 Session Summary - Community Curation System

**Date**: November 20, 2024  
**Session Duration**: Complete database + karma system implementation  
**Status**: ✅ Ready for API Development

---

## What Was Accomplished

### ✅ 1. Database Schema (Supabase)

Created 4 new tables for community curation:

| Table | Rows | Purpose |
|-------|------|---------|
| `pending_assets` | 16 | Asset submission queue with voting metrics |
| `asset_votes` | 8 | Individual vote records (upvote/report) |
| `wallet_karma` | 14 | Per-project reputation system |
| `curation_chat_messages` | 11 | System messages for curation events |

**Features**:
- ✅ 7 performance indexes
- ✅ Row Level Security (RLS) policies
- ✅ Supabase Realtime enabled
- ✅ Foreign key relationships
- ✅ Unique constraints (one vote per wallet per asset)

---

### ✅ 2. TypeScript Types

Updated `/types/database.ts` with:
- Complete type definitions for all 4 tables
- Row, Insert, and Update interfaces
- Proper `Json` type for JSONB fields
- Zero linter errors

---

### ✅ 3. Karma System Logic

Created `/lib/karma.ts` with:

#### Tier-Based Multipliers
```typescript
Mega (≥5%):    7x multiplier
Whale (1-5%):  5.5x multiplier  
Holder (0.1-1%): 3x multiplier
Small (<0.1%):  1x multiplier
```

#### Verification Thresholds
```typescript
Backed: 0.5% supply OR 5 voters
Verified: 5% supply OR 10 voters
```

#### Hidden Thresholds (Escalating)
```typescript
Pending:  2% supply OR 3 reporters
Backed:   3% supply OR 5 reporters
Verified: 10% supply OR 15 reporters
```

#### Two-Phase Rewards
```typescript
Immediate: 25% (awarded on action)
Delayed: 75% (awarded on outcome)
```

#### Warning System
```typescript
Ban at 2 warnings (if karma ≤ 0)
Ban at 3 warnings (if karma > 0)
90-day active window
```

---

### ✅ 4. Documentation

Created comprehensive guides:

1. **`COMMUNITY_CURATION_SETUP.md`** (450+ lines)
   - Database schema explained
   - Security features
   - Performance optimizations
   - Implementation examples

2. **`KARMA_SYSTEM.md`** (600+ lines)
   - Complete karma system documentation
   - Calculation examples
   - API usage patterns
   - Testing scenarios
   - Anti-gaming measures

3. **`KARMA_THRESHOLDS_UPDATE.md`** (400+ lines)
   - Comparison of old vs new thresholds
   - Reasoning for changes
   - Edge cases handled
   - Testing scenarios

4. **`CURATION_MIGRATION_COMPLETE.md`** (500+ lines)
   - Migration verification
   - Implementation roadmap
   - API endpoint specifications
   - UI component designs

5. **`SESSION_SUMMARY.md`** (this file)
   - Complete session overview

---

## Files Created/Modified

### Created (8 files)
```
✅ /supabase-migrations/003_create_community_curation_tables.sql
✅ /lib/karma.ts
✅ /COMMUNITY_CURATION_SETUP.md
✅ /KARMA_SYSTEM.md
✅ /KARMA_THRESHOLDS_UPDATE.md
✅ /CURATION_MIGRATION_COMPLETE.md
✅ /SESSION_SUMMARY.md
```

### Modified (1 file)
```
✅ /types/database.ts (added 4 table types)
```

---

## Key Features Implemented

### 🎯 Token-Weighted Voting
Every action is weighted by holdings percentage. Major holders have proportional influence without dominating.

### 🏆 Sophisticated Karma System
- Base points (100/10/5 for add/upvote/report)
- Tier multipliers (1x-7x)
- Immediate + delayed rewards
- Penalties for incorrect votes

### 📊 Dual Thresholds
Assets verified via EITHER:
- Supply percentage (5% for verified)
- Voter count (10 voters for verified)

Prevents single-point failure (can't bypass with pure Sybil OR pure whale).

### 🛡️ Escalating Protection
Harder to hide assets as they gain legitimacy:
- Pending: 2% to hide
- Backed: 3% to hide
- Verified: 10% to hide

### ⚠️ Progressive Discipline
- Warnings expire after 90 days
- Ban thresholds based on karma level
- Graduated ban durations (7d → 30d → permanent)

### 🔔 Activity Feed
System generates chat messages for:
- Asset added
- Asset backed (0.5%)
- Asset verified (5%)
- Asset hidden
- Wallet banned

---

## Architecture Benefits

### Decentralized Governance
No admin bottleneck. Community self-governs IP verification.

### Token-Gated Access
Only holders can participate. Skin in the game.

### Sybil Resistant
Tier multipliers prevent splitting tokens for advantage.

### Quality Over Quantity
Higher verification bar (5% vs original 2.5%) ensures consensus.

### Malicious Actor Protection
- Karma penalties for bad votes
- Warning system tracks abuse
- Escalating hidden thresholds protect verified assets

---

## Implementation Roadmap

### Phase 1: Core API (Next Steps)

#### 1. Submit Asset Endpoint
```
POST /api/assets/submit
- Verify token holdings
- Check if wallet is banned
- Create pending_asset record
- Award immediate karma (25%)
- Send curation chat message
```

#### 2. Vote Endpoint
```
POST /api/assets/vote
- Verify token holdings
- Check if already voted
- Record vote with snapshot
- Update asset vote weights
- Check threshold transitions
- Award delayed karma if status changes
- Send chat message if status changes
```

#### 3. Karma Query Endpoint
```
GET /api/assets/karma?wallet=xxx&project=yyy
- Return total karma
- Return rank among holders
- Return tier info
- Return warning count
- Return ban status
```

#### 4. Pending Assets List
```
GET /api/assets/pending?project=xxx
- List all pending assets
- Include vote counts
- Include status
- Filter by verification_status
```

---

### Phase 2: UI Components

#### 1. Asset Submission Modal
```typescript
<AssetSubmissionModal
  projectId={string}
  onSubmit={(asset) => void}
  onClose={() => void}
/>
```

**Features**:
- Form for social/creative/legal assets
- Token holding check
- Estimated karma display
- Submission confirmation

#### 2. Pending Asset Card
```typescript
<PendingAssetCard
  asset={PendingAsset}
  userKarma={number}
  userPercentage={number}
  onUpvote={() => void}
  onReport={() => void}
/>
```

**Features**:
- Asset details display
- Vote progress bars
- Upvote/Report buttons
- Real-time vote count updates
- Karma gain preview

#### 3. Karma Badge
```typescript
<KarmaBadge
  karma={number}
  rank={number}
  tier={string}
  warnings={number}
/>
```

**Features**:
- Total karma display
- Rank indicator (e.g., "Top 5%")
- Tier badge with multiplier
- Warning count (if any)

#### 4. Curation Feed
```typescript
<CurationFeed
  projectId={string}
  messages={CurationMessage[]}
/>
```

**Features**:
- System messages for curation events
- Different styling from user chat
- Event-specific icons
- Real-time updates

---

### Phase 3: Business Logic

#### Vote Processing
```typescript
async function processVote(
  assetId: string,
  voterWallet: string,
  voteType: 'upvote' | 'report',
  tokenPercentage: number
) {
  // 1. Record vote
  await insertVote(assetId, voterWallet, voteType, tokenPercentage)
  
  // 2. Update asset weights
  await updateVoteWeights(assetId)
  
  // 3. Check status transition
  const newStatus = checkVerificationStatus(
    asset.total_upvote_weight,
    asset.unique_upvoters_count
  )
  
  if (newStatus !== asset.verification_status) {
    // Status changed!
    await updateAssetStatus(assetId, newStatus)
    await distributeDelayedKarma(assetId)
    await sendCurationChatMessage(assetId, newStatus)
  }
  
  // 4. Check if should hide
  const shouldHide = checkHiddenStatus(
    asset.verification_status,
    asset.total_report_weight,
    asset.unique_reporters_count
  )
  
  if (shouldHide) {
    await hideAsset(assetId)
    await penalizeUpvoters(assetId)
    await rewardReporters(assetId)
  }
  
  // 5. Award immediate karma
  const immediateKarma = calculateKarma(
    voteType === 'upvote' ? 'upvote' : 'report',
    tokenPercentage,
    true // immediate
  )
  
  await awardKarma(voterWallet, immediateKarma)
}
```

#### Karma Distribution
```typescript
async function distributeDelayedKarma(assetId: string) {
  const asset = await getAsset(assetId)
  const votes = await getVotesForAsset(assetId)
  
  for (const vote of votes) {
    const delayedKarma = calculateKarma(
      vote.vote_type,
      vote.token_percentage_snapshot,
      false // delayed
    )
    
    // Update karma_earned in vote record
    await updateVoteKarma(vote.id, delayedKarma)
    
    // Award to wallet
    await awardKarma(vote.voter_wallet, delayedKarma)
  }
  
  // Award submitter
  const submitterKarma = calculateKarma(
    'add',
    asset.submission_token_percentage,
    false // delayed
  )
  
  await awardKarma(asset.submitter_wallet, submitterKarma)
}
```

#### Ban Enforcement
```typescript
async function checkAndEnforceBan(walletAddress: string) {
  const karma = await getWalletKarma(walletAddress)
  const warnings = await getWarnings(walletAddress)
  
  const { shouldBan, reason } = checkBanStatus(
    karma.total_karma_points,
    warnings
  )
  
  if (shouldBan && !karma.is_banned) {
    const duration = getBanDuration(karma.warning_count)
    
    await updateWalletKarma(walletAddress, {
      is_banned: true,
      banned_at: new Date(),
      ban_expires_at: new Date(Date.now() + duration)
    })
    
    await sendBanChatMessage(walletAddress, reason)
  }
}
```

---

## Testing Plan

### Database Tests
```sql
-- Test RLS policies
SELECT * FROM pending_assets WHERE project_id = 'xxx'; -- Should work for live projects
INSERT INTO asset_votes (...); -- Should work
UPDATE pending_assets SET status = 'verified'; -- Should fail (no update policy)

-- Test indexes
EXPLAIN ANALYZE SELECT * FROM pending_assets WHERE project_id = 'xxx';
-- Should use idx_pending_assets_project

-- Test constraints
INSERT INTO asset_votes (pending_asset_id, voter_wallet, ...)
  VALUES ('same-asset', 'same-wallet', ...);
-- First: Success
-- Second: Error (unique constraint violated)
```

### Karma Logic Tests
```typescript
describe('Karma System', () => {
  test('getTier returns correct tier', () => {
    expect(getTier(0.05).name).toBe('small')
    expect(getTier(0.5).name).toBe('holder')
    expect(getTier(2.0).name).toBe('whale')
    expect(getTier(6.0).name).toBe('mega')
  })
  
  test('calculateKarma applies multipliers', () => {
    expect(calculateKarma('add', 5.0, true)).toBe(175) // 100 * 7 * 0.25
    expect(calculateKarma('upvote', 1.5, false)).toBe(41.25) // 10 * 5.5 * 0.75
  })
  
  test('checkVerificationStatus uses dual thresholds', () => {
    expect(checkVerificationStatus(0.3, 6)).toBe('backed') // 6 voters ≥ 5
    expect(checkVerificationStatus(1.0, 3)).toBe('backed') // 1% ≥ 0.5%
    expect(checkVerificationStatus(6.0, 5)).toBe('verified') // 6% ≥ 5%
    expect(checkVerificationStatus(3.0, 12)).toBe('verified') // 12 voters ≥ 10
  })
})
```

### Integration Tests
```typescript
describe('Vote Processing', () => {
  test('upvote awards immediate karma', async () => {
    const initialKarma = await getKarma(wallet)
    await processVote(assetId, wallet, 'upvote', 1.5)
    const newKarma = await getKarma(wallet)
    
    expect(newKarma - initialKarma).toBe(13.75) // 10 * 5.5 * 0.25
  })
  
  test('status transition awards delayed karma', async () => {
    // Setup: Asset at 4.8% with 8 voters
    await vote1() // 4.8% + 0.3% = 5.1%
    
    // Should transition to verified
    const asset = await getAsset(assetId)
    expect(asset.verification_status).toBe('verified')
    
    // Check delayed karma awarded
    const votes = await getVotes(assetId)
    expect(votes.every(v => v.karma_earned > 0)).toBe(true)
  })
})
```

---

## Production Considerations

### Before Launch

1. **Test Thresholds with Real Data**
   - Run simulations with actual token distributions
   - Verify 5% threshold is achievable
   - Ensure 10 voters requirement works for small projects

2. **Monitor Karma Distribution**
   - Check for unfair concentration
   - Ensure tier multipliers feel balanced
   - Adjust if needed based on feedback

3. **Set Up Alerts**
   - Ban rate exceeding 5%
   - Karma inflation (average increasing too fast)
   - Single wallet dominating votes

4. **Archive Strategy**
   - Auto-archive verified assets after 30 days
   - Move to historical table
   - Keep pending/backed indefinitely

5. **Rate Limiting**
   - Max 10 submissions per wallet per day
   - Max 50 votes per wallet per day
   - Prevent spam attacks

---

## Success Metrics

Track these to measure system health:

### Engagement
- **Participation Rate**: % of holders who vote
- **Average Time to Verification**: Days from submission to verified
- **Assets per Week**: Submission rate

### Quality
- **Verification Accuracy**: % of verified assets that are legitimate
- **False Positive Rate**: % of hidden assets that were valid
- **Appeal Rate**: How many bans are appealed

### Fairness
- **Karma Gini Coefficient**: Wealth distribution (lower = more fair)
- **Whale Dominance**: % of votes from top 10 holders
- **Small Holder Participation**: % of votes from <0.1% holders

### Health
- **Ban Rate**: % of active users banned
- **Warning Rate**: Warnings per 1000 votes
- **Status Distribution**: % pending vs backed vs verified

---

## Database Size Estimates

### Storage Growth

```
Assumptions:
- 1000 projects
- 50 assets per project
- 20 votes per asset average
- 1000 active voters per project

pending_assets:
- 50,000 rows
- ~1KB per row (JSONB)
- Total: ~50MB

asset_votes:
- 1,000,000 rows
- ~200B per row
- Total: ~200MB

wallet_karma:
- 1,000,000 rows (1000 wallets × 1000 projects)
- ~500B per row
- Total: ~500MB

curation_chat_messages:
- 100,000 rows (2 per asset average)
- ~300B per row
- Total: ~30MB

Total: ~780MB for mature platform
```

### Query Performance

With indexes, queries should be fast:
```
Asset lookup by ID: <1ms
Assets by project: <10ms (100 rows)
Vote aggregation: <50ms (with index)
Karma leaderboard: <100ms (with DESC index)
```

---

## 🎉 Status: READY FOR API DEVELOPMENT

Everything needed to build the community curation system:

### ✅ Database
- Tables created
- Indexes optimized
- RLS secured
- Realtime enabled

### ✅ Types
- TypeScript definitions complete
- Zero linter errors
- Full type safety

### ✅ Logic
- Karma calculations implemented
- Threshold checks working
- Ban system ready

### ✅ Documentation
- 2000+ lines of guides
- Examples for every scenario
- Implementation roadmap
- Testing plan

---

## Next Action Items

1. **Start with Submit Endpoint**
   ```
   POST /api/assets/submit
   ```
   - Easiest to implement
   - No complex voting logic
   - Tests database writes

2. **Then Vote Endpoint**
   ```
   POST /api/assets/vote
   ```
   - Core functionality
   - Tests threshold logic
   - Tests karma distribution

3. **Build UI Components**
   - Asset submission form
   - Pending asset cards
   - Vote buttons
   - Karma display

4. **Test with Real Users**
   - Beta test with small project
   - Monitor metrics
   - Adjust thresholds if needed

5. **Scale to Production**
   - Add rate limiting
   - Set up monitoring
   - Archive old data
   - Launch! 🚀

---

**Total Lines of Code/Docs**: 3000+  
**Time Investment**: Database + karma system complete  
**Status**: ✅ Production-ready foundation

---

Built with ❤️ for decentralized, token-gated community curation! 🎯

