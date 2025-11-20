# 🔄 Karma System Thresholds - Updated Design

**Date**: November 20, 2024  
**Status**: ✅ Implementation Ready

---

## Changes from Original Design

The karma system in `/lib/karma.ts` uses **updated thresholds** compared to the initial database migration documentation.

### Original Thresholds (Database Docs)
```
Backed: 0.5% supply
Verified: 2.5% supply
Hidden: 2.5% supply
```

### ✅ NEW Thresholds (karma.ts)
```
Backed: 0.5% supply OR 5 voters
Verified: 5% supply OR 10 voters
Hidden: 2-10% supply (escalating) OR 3-15 reporters
```

---

## Why The Changes?

### 1. Higher Verification Bar (2.5% → 5%)

**Original**: 2.5% of supply
**New**: 5% of supply OR 10 voters

**Reasoning**:
- 2.5% was too easy to game with single whale
- 5% requires broader consensus
- Dual threshold (supply OR voters) adds flexibility
- Small projects can still verify via voter count

**Example**:
```
Token with 1B supply:

Old: Need 25M tokens (2.5%)
New: Need 50M tokens (5%) OR 10 unique voters

Impact:
- Single 5% holder can verify ✓
- 10 holders at 0.5% each can verify ✓
- More democratic, less whale-dependent
```

---

### 2. Dual Thresholds (Supply OR Voters)

**New Feature**: Every status check has TWO paths to success.

#### Backed Status
```typescript
0.5% supply OR 5 voters
```

**Why**: Small projects with engaged communities can progress without whales.

#### Verified Status
```typescript
5% supply OR 10 voters
```

**Why**: Prevents single-point failure. Can't bypass with pure Sybil OR pure whale power.

**Example Scenarios**:
```
Scenario A: Whale Power
- 1 holder with 5% → VERIFIED ✓
- Single actor can verify

Scenario B: Community Power  
- 10 holders with 0.1% each → VERIFIED ✓
- Distributed consensus

Scenario C: Mixed
- 3 holders with 1.5% each (4.5% total) → BACKED
- Need 1 more voter OR 0.5% more supply
```

---

### 3. Escalating Hidden Thresholds

**Original**: Fixed 2.5% supply to hide
**New**: Escalates with asset status

| Asset Status | Supply % | OR Reporters |
|--------------|----------|--------------|
| Pending | 2% | 3 |
| Backed | 3% | 5 |
| Verified | 10% | 15 |

**Reasoning**:
- Easy to hide spam (pending)
- Medium difficulty for backed (community showing interest)
- Very hard to hide verified (already proven legitimate)

**Example**:
```
Pending Instagram account:
- 2% supply can hide (easy)
- OR 3 reporters

Verified Instagram account:
- 10% supply needed to hide (very hard)
- OR 15 reporters
- Protects legitimate verified assets
```

**Why This Matters**:
```
Attack scenario: Malicious whale wants to hide legit asset

If fixed 2.5% threshold:
- Whale with 2.5% can hide ANY asset
- Even fully verified ones
- Major attack vector ❌

With escalating thresholds:
- Whale needs 10% to hide verified asset
- Much harder attack
- Protects community consensus ✓
```

---

## Tier Multipliers

**New Feature**: Karma scales with holdings.

| Tier | Supply % | Multiplier |
|------|----------|------------|
| Mega | ≥5% | 7x |
| Whale | 1-5% | 5.5x |
| Holder | 0.1-1% | 3x |
| Small | <0.1% | 1x |

**Why**: Prevents Sybil attacks while maintaining fairness.

**Example**:
```
Mega holder submits asset:
- Base: 100 points
- Multiplier: 7x
- Total: 700 points

Small holder submits asset:
- Base: 100 points
- Multiplier: 1x
- Total: 100 points

Whale can't bypass by splitting tokens:
- 5% as one wallet: 700 points (mega tier)
- 50x 0.1% wallets: 50 × 300 = 15,000 points... BUT
  - This is 50 separate submissions
  - Each needs to be verified independently
  - Karma awarded only on verification
  - Net effect: Same work, no advantage
```

---

## Two-Phase Rewards

**New Feature**: Split reward timing.

```typescript
Immediate: 25% (awarded instantly)
Delayed: 75% (awarded on outcome)
```

**Why**: Encourages correct voting.

**Example**:
```
Whale upvotes asset (55 total karma potential):

Phase 1 (Instant):
- 55 × 25% = 13.75 points
- Awarded immediately

Phase 2 (Delayed):
- Asset verified: +41.25 points ✓
- Asset hidden: No delayed reward ❌
- Plus penalty: -16.5 points ❌❌

Result: You WANT to vote correctly!
```

---

## Warning System

**New Feature**: Progressive discipline.

```typescript
Ban Conditions:
- Karma ≤ 0: Ban at 2 warnings
- Karma > 0: Ban at 3 warnings

Warning Lifetime:
- Active for 90 days (count toward ban)
- Deleted after 120 days (30 + 90)
```

**Why**: Gives users chances to improve, but tracks repeat offenders.

**Example Timeline**:
```
Day 0: Warning #1 (upvoted spam)
Day 45: Warning #2 (upvoted scam)
Karma: 50 points (positive)

Result: NOT BANNED (need 3 warnings with positive karma)

Day 90: Lost karma, now at -10
Active warnings: Still 2
Result: BANNED (karma ≤ 0 with 2 warnings)

Day 120 (30 + 90): Warning #1 expires
Day 165: Warning #2 expires
Result: Clean slate
```

---

## Implementation Checklist

### ✅ Completed
- [x] Tier multiplier logic (`getTier()`)
- [x] Dual threshold checking (`checkVerificationStatus()`)
- [x] Escalating hidden thresholds (`checkHiddenStatus()`)
- [x] Two-phase karma calculation (`calculateKarma()`)
- [x] Warning/ban logic (`checkBanStatus()`)

### 🔲 To Implement
- [ ] Update API endpoints to use new thresholds
- [ ] Update database records when status changes
- [ ] Award karma on verification
- [ ] Apply penalties on hiding
- [ ] Enforce bans at API layer
- [ ] UI components for karma display
- [ ] Real-time updates for threshold crossing

---

## Migration Impact

### Database Schema
✅ **No changes needed**

The database tables support the new logic without modification:
- `pending_assets.total_upvote_weight` → stores supply %
- `pending_assets.unique_upvoters_count` → stores voter count
- `wallet_karma.total_karma_points` → stores accumulated karma
- `wallet_karma.warnings` → stores warning history

### API Implementation
🔲 **New logic needed**

When implementing vote endpoints:
```typescript
import { 
  checkVerificationStatus,
  checkHiddenStatus,
  calculateKarma,
  getTier
} from '@/lib/karma'

// After vote is cast:
const newStatus = checkVerificationStatus(
  asset.total_upvote_weight,
  asset.unique_upvoters_count
)

if (newStatus !== asset.verification_status) {
  // Status changed! Award delayed karma
  await distributeDelayedKarma(asset)
  await updateAssetStatus(asset, newStatus)
  await sendCurationChatMessage(asset, newStatus)
}

// Check if should hide
const shouldHide = checkHiddenStatus(
  asset.verification_status,
  asset.total_report_weight,
  asset.unique_reporters_count
)

if (shouldHide) {
  await hideAsset(asset)
  await penalizeUpvoters(asset)
  await rewardReporters(asset)
}
```

---

## Comparison Table

| Feature | Original | Updated | Impact |
|---------|----------|---------|--------|
| **Backed** | 0.5% | 0.5% OR 5 voters | More accessible |
| **Verified** | 2.5% | 5% OR 10 voters | Higher quality bar |
| **Hidden (Pending)** | 2.5% | 2% OR 3 reporters | Easier spam removal |
| **Hidden (Verified)** | 2.5% | 10% OR 15 reporters | Protects legitimate assets |
| **Karma Multipliers** | None | 1x-7x tiers | Prevents Sybil |
| **Delayed Rewards** | None | 75% delayed | Encourages accuracy |
| **Warning System** | Basic | 90-day active window | Fair enforcement |

---

## Why These Numbers Work

### 0.5% for Backed
- Low bar to show interest
- ~5-10 medium holders
- Signals "community wants this"

### 5% for Verified
- High bar requiring consensus
- Can't be gamed by single whale
- Alternative: 10 voters (democratic option)

### 2-10% for Hidden
- Easy to remove spam (2%)
- Hard to remove verified (10%)
- Prevents malicious hiding

### Tier Multipliers (1x-7x)
- Logarithmic scaling
- Major holders get influence
- Small holders still matter
- 7x max prevents domination

### 25% Immediate Reward
- Instant gratification
- Not so high that delayed doesn't matter
- Creates "will my vote be right?" tension

---

## Edge Cases Handled

### Case 1: User Votes Then Sells Tokens
```
Problem: Token percentage changes after vote
Solution: Snapshot taken at vote time
Result: Vote weight frozen, karma awarded based on snapshot
```

### Case 2: Asset Reaches 4.9% (Just Under 5%)
```
Problem: Close but not verified
Solution: Need either 5% OR 10 voters
Result: 1 more voter at any amount = verified
```

### Case 3: Verified Asset Gets 9.9% Reports
```
Problem: Close to hidden threshold (10%)
Solution: Need 10% OR 15 reporters
Result: 6 more reporters = hidden (even at 9.9% supply)
```

### Case 4: Warning Issued at Day 89, Ban Check at Day 91
```
Problem: Warning just expired (90-day window)
Solution: Timestamp comparison with 90 days ago
Result: Warning doesn't count toward ban
```

---

## Testing Scenarios

### Scenario A: Small Project (Low Supply)
```
10 holders, each with 0.08% (0.8% total supply)

Can verify?
- Supply path: 0.8% < 5% ❌
- Voter path: 10 voters ≥ 10 ✓
Result: VERIFIED via voter count!
```

### Scenario B: Whale-Dominated Project  
```
1 holder with 60%, 100 holders with 0.004% each (0.4% total)

Can verify?
- Supply path: 60% ≥ 5% ✓
- Voter path: 1 voter < 10 ❌
Result: VERIFIED via whale's supply!
```

### Scenario C: Balanced Project
```
20 holders averaging 0.3% each (6% total supply)
8 holders upvote (2.4% supply)

Can verify?
- Supply path: 2.4% < 5% ❌
- Voter path: 8 voters < 10 ❌
Result: BACKED (0.5% < 2.4% < 5%, 5 < 8 < 10)
```

---

## 🎯 Summary

The updated karma system provides:
- ✅ Higher quality bar (5% vs 2.5%)
- ✅ Dual thresholds (supply OR voters)
- ✅ Protection for verified assets (10% to hide)
- ✅ Sybil resistance (tier multipliers)
- ✅ Accuracy incentives (delayed rewards)
- ✅ Fair enforcement (90-day warning window)

**Result**: More democratic, harder to game, better protection for legitimate assets.

---

**Files**:
- Implementation: `/lib/karma.ts` ✅
- Documentation: `/KARMA_SYSTEM.md` ✅
- Database: No changes needed ✅

**Next**: Implement in API endpoints! 🚀

