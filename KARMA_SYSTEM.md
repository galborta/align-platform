# 🏆 Karma System Documentation

**File**: `/lib/karma.ts`  
**Status**: ✅ Complete  
**Purpose**: Token-weighted reputation system for community curation

---

## Overview

The karma system incentivizes good curation behavior and discourages spam/abuse through a sophisticated point-based reputation system with tier multipliers.

---

## Core Concepts

### 1. Tier-Based Multipliers

Larger token holders earn more karma per action (proportional to their stake).

| Tier | Supply % Required | Multiplier | Example Holder |
|------|------------------|------------|----------------|
| **🐋 Mega** | ≥5.0% | 7x | Top whale |
| **💎 Whale** | 1.0-5.0% | 5.5x | Major holder |
| **🟢 Holder** | 0.1-1.0% | 3x | Significant holder |
| **⚪ Small** | <0.1% | 1x | Retail holder |

**Why?** Prevents spam while giving influence to committed stakeholders.

---

### 2. Base Karma Points

Actions have base values BEFORE tier multipliers are applied:

```typescript
BASE_KARMA = {
  ADD_ASSET: 100,   // Submit new asset
  UPVOTE: 10,       // Upvote an asset
  REPORT: 5         // Report an asset
}
```

---

### 3. Two-Phase Reward System

Karma is awarded in TWO phases to encourage patience:

#### Phase 1: Immediate (25%)
Awarded instantly when you take action.

#### Phase 2: Delayed (75%)
Awarded when the asset reaches final state (verified/hidden).

**Example**: Mega holder upvotes an asset
```
Base: 10 points
Tier: 7x multiplier
Total: 70 points

Immediate: 70 × 25% = 17.5 points (awarded now)
Delayed: 70 × 75% = 52.5 points (awarded on verification)
```

**Why?** Prevents gaming. You must wait to see if your vote was correct.

---

## Verification Thresholds

Assets progress through statuses based on upvote weight OR voter count.

### Backed Status
Asset shows community interest (light green indicator).

**Requirements** (either condition):
- ✅ **0.5% of supply** voting upvote
- ✅ **5 unique voters** upvoting

### Verified Status  
Asset is confirmed legitimate (full verification).

**Requirements** (either condition):
- ✅ **5% of supply** voting upvote
- ✅ **10 unique voters** upvoting

### Status Flow
```
Pending → Backed → Verified
```

**Example**:
```
Token has 1B supply

Backed needs:
- 5M tokens (0.5%) upvoting
- OR 5 unique voters

Verified needs:
- 50M tokens (5%) upvoting  
- OR 10 unique voters

This means:
- 10 holders at 0.5% each = verified ✓
- 1 holder at 5% = verified ✓
- 5 small holders (<0.1%) = backed ✓
```

---

## Hidden Thresholds (Reports)

Assets can be hidden if enough holders report them. Thresholds increase with status to prevent malicious hiding.

| Current Status | Supply % Needed | OR Reporters Needed |
|----------------|-----------------|---------------------|
| **Pending** | 2% | 3 reporters |
| **Backed** | 3% | 5 reporters |
| **Verified** | 10% | 15 reporters |

**Why Higher for Verified?** Once an asset is verified by the community, it should be VERY hard to remove it.

**Example**:
```
Verified Instagram account needs:
- 10% of supply reporting it
- OR 15 unique reporters

This prevents single whale manipulation
```

---

## Karma Calculation Examples

### Example 1: Small Holder Submits Asset

```typescript
User holds: 0.05% of supply
Tier: small (1x multiplier)
Action: ADD_ASSET (100 base)

Immediate karma: 100 × 1 × 0.25 = 25 points
Delayed karma: 100 × 1 × 0.75 = 75 points (on verification)

Total potential: 100 points
```

### Example 2: Whale Upvotes Asset

```typescript
User holds: 2.3% of supply
Tier: whale (5.5x multiplier)
Action: UPVOTE (10 base)

Immediate karma: 10 × 5.5 × 0.25 = 13.75 points
Delayed karma: 10 × 5.5 × 0.75 = 41.25 points (on verification)

Total potential: 55 points
```

### Example 3: Mega Holder Reports Asset

```typescript
User holds: 7.1% of supply
Tier: mega (7x multiplier)
Action: REPORT (5 base)

Immediate karma: 5 × 7 × 0.25 = 8.75 points
Delayed karma: 5 × 7 × 0.75 = 26.25 points (if hidden)

Total potential: 35 points
```

---

## Karma Outcomes by Scenario

### ✅ Scenario 1: You Upvoted, Asset Gets Verified

```
Immediate karma: Already awarded ✓
Delayed karma: AWARDED ✓

Result: Full karma points!
```

### ❌ Scenario 2: You Upvoted, Asset Gets Hidden

```
Immediate karma: Already awarded (keep it)
Delayed karma: NOT AWARDED ❌

Penalty: -30% of total possible karma

Example:
- Whale upvotes (55 total possible)
- Asset gets hidden
- Lost: 55 × 30% = -16.5 penalty
```

### ✅ Scenario 3: You Reported, Asset Gets Hidden

```
Immediate karma: Already awarded ✓
Delayed karma: AWARDED ✓
Bonus: +50% of total karma for correct report

Example:
- Holder reports (15 total)
- Asset gets hidden
- Bonus: 15 × 50% = +7.5 points
- Total: 15 + 7.5 = 22.5 points!
```

### ❌ Scenario 4: You Reported, Asset Gets Verified

```
Immediate karma: Already awarded (keep it)
Delayed karma: NOT AWARDED ❌

Penalty: -20% of total possible karma

False reports are less severely punished than bad upvotes
(20% vs 30%) because reports are harder to judge.
```

---

## Warning System

Progressive discipline for bad behavior.

### Warning Triggers

Users receive warnings for:
- Upvoting 3+ assets that get hidden
- Reporting 5+ assets that get verified
- Submitting spam/invalid assets repeatedly
- Ban evasion attempts

### Warning Decay

```typescript
WARNING_DECAY_DAYS: 30    // Warning disappears from record
WARNING_ACTIVE_DAYS: 90   // Only count warnings from last 90 days
```

**Example Timeline**:
```
Day 0: Warning #1 issued
Day 90: Warning #1 still active
Day 91: Warning #1 no longer counts toward ban
Day 120 (30 + 90): Warning #1 deleted from record
```

### Ban Conditions

Two different ban thresholds based on karma:

#### High-Risk Users (Karma ≤ 0)
```
Ban at: 2 active warnings
Reason: Already proven unreliable + warnings
```

#### Regular Users (Karma > 0)
```
Ban at: 3 active warnings
Reason: Repeated bad behavior despite good history
```

### Ban Duration
```
- First ban: 7 days
- Second ban: 30 days
- Third ban: Permanent (requires appeal)
```

---

## API Usage Examples

### Check Verification Status
```typescript
import { checkVerificationStatus } from '@/lib/karma'

const status = checkVerificationStatus(
  totalUpvoteWeight,  // 4.2% of supply
  uniqueUpvoters      // 8 unique voters
)

// Returns: 'backed' 
// (4.2% < 5% for verified, but 8 voters > 5 for backed)
```

### Calculate Karma on Upvote
```typescript
import { calculateKarma, getTier } from '@/lib/karma'

const userSupply = 1.5 // 1.5% of supply
const tier = getTier(userSupply) // { name: 'whale', multiplier: 5.5 }

// Immediate karma (awarded now)
const immediate = calculateKarma('upvote', userSupply, true)
// Returns: 13.75

// Delayed karma (awarded on verification)
const delayed = calculateKarma('upvote', userSupply, false)
// Returns: 41.25
```

### Check If Asset Should Be Hidden
```typescript
import { checkHiddenStatus } from '@/lib/karma'

const shouldHide = checkHiddenStatus(
  'verified',     // Current status
  8.5,            // 8.5% supply reporting
  12              // 12 unique reporters
)

// Returns: false
// (Need 10% supply OR 15 reporters to hide verified asset)
```

### Check Ban Status
```typescript
import { checkBanStatus } from '@/lib/karma'

const warnings = [
  { timestamp: '2024-11-01T12:00:00Z', reason: 'Upvoted spam' },
  { timestamp: '2024-11-15T14:30:00Z', reason: 'Upvoted scam' },
  { timestamp: '2024-02-01T10:00:00Z', reason: 'Old warning' } // >90 days ago
]

const result = checkBanStatus(-5, warnings)

// Returns: { shouldBan: true, reason: 'Zero karma with 2+ warnings' }
// Note: Old warning doesn't count (>90 days)
```

---

## Karma Leaderboard

Projects can display top contributors:

```typescript
// Query top karma holders
const { data } = await supabase
  .from('wallet_karma')
  .select('*')
  .eq('project_id', projectId)
  .order('total_karma_points', { ascending: false })
  .limit(10)

// Display with tier badges
data.forEach((user, index) => {
  const tier = getTier(user.token_percentage)
  console.log(`#${index + 1} ${user.wallet_address}`)
  console.log(`Karma: ${user.total_karma_points}`)
  console.log(`Tier: ${tier.name} (${tier.multiplier}x)`)
})
```

---

## Balancing Considerations

### Why These Numbers?

**Tier Multipliers** (1x, 3x, 5.5x, 7x):
- Logarithmic scaling prevents mega holders from dominating
- Small holders can still participate meaningfully
- 7x max ensures no single wallet has absolute power

**Verification Thresholds** (0.5%, 5%):
- 0.5% = ~5-10 medium holders = shows genuine interest
- 5% = requires broad consensus or major holder buy-in
- Dual threshold (supply OR voters) prevents single-point failure

**Hidden Thresholds** (2%, 3%, 10%):
- Lower than verification (easier to report than verify)
- Escalating with status (harder to remove verified assets)
- 10% for verified = extremely high bar = protects legitimate assets

**Immediate Reward** (25%):
- Enough to encourage participation
- Not so much that delayed rewards don't matter
- Creates tension: "Will my vote be correct?"

---

## Anti-Gaming Measures

### 1. Delayed Rewards
Can't instantly farm karma. Must wait for outcome.

### 2. Penalties for Wrong Votes
Lose more karma for bad upvotes (-30%) than you gain.

### 3. Tier Multipliers
Large holders can't Sybil attack (splitting tokens = lower tier = less karma).

### 4. Dual Thresholds
Can't bypass with pure voter count or pure supply weight.

### 5. Active Warning Window
Can't wait out bans. Recent behavior matters.

### 6. Progressive Bans
First ban = warning. Third ban = permanent.

---

## Future Enhancements

### Phase 2 Features
- [ ] Karma decay for inactive wallets
- [ ] Bonus karma for early voters
- [ ] Season-based karma resets
- [ ] Karma trading/delegation
- [ ] NFT badges for top contributors

### Balancing Adjustments
Based on real usage data:
- Adjust tier breakpoints (currently 0.1%, 1%, 5%)
- Tune multipliers (currently 1x, 3x, 5.5x, 7x)
- Modify thresholds (currently 0.5%, 5%)
- Change immediate % (currently 25%)

---

## Testing Checklist

### Unit Tests Needed
- [ ] `getTier()` returns correct tier for all ranges
- [ ] `calculateKarma()` applies multipliers correctly
- [ ] `checkVerificationStatus()` handles edge cases (exactly 5%)
- [ ] `checkHiddenStatus()` enforces escalating thresholds
- [ ] `checkBanStatus()` filters old warnings correctly

### Integration Tests Needed  
- [ ] Karma awarded on asset verification
- [ ] Karma penalty on asset hidden
- [ ] Ban triggers at correct warning count
- [ ] Tier changes reflected in karma calculations
- [ ] Edge case: User votes, then sells tokens

---

## Performance Considerations

### Optimizations
```typescript
// Cache tier calculations (expensive divisions)
const tierCache = new Map<string, Tier>()

export function getTierCached(percentage: number): Tier {
  const key = percentage.toFixed(2)
  if (!tierCache.has(key)) {
    tierCache.set(key, getTier(percentage))
  }
  return tierCache.get(key)!
}
```

### Database Queries
```sql
-- Efficient karma aggregation
SELECT 
  wallet_address,
  total_karma_points,
  RANK() OVER (ORDER BY total_karma_points DESC) as rank
FROM wallet_karma
WHERE project_id = $1
  AND is_banned = false
ORDER BY total_karma_points DESC
LIMIT 100;
```

---

## 🎯 Summary

The karma system creates a self-regulating community where:
- ✅ Good actors are rewarded with reputation
- ❌ Bad actors lose karma and get banned
- 🐋 Major holders have proportional influence
- ⚪ Small holders can still participate
- ⏰ Patience is rewarded (delayed karma)
- 🎯 Accuracy matters (penalties for wrong votes)

**Result**: High-quality, community-verified IP assets with minimal admin intervention.

---

**Status**: ✅ Core logic complete  
**Next**: Implement in API endpoints (`/api/assets/submit`, `/api/assets/vote`)

