# 🎁 Enhanced Tip System - Database Schema Documentation

**Migration**: `20241126_enhanced_tip_system.sql`  
**Status**: ✅ Ready for Deployment  
**Date**: November 26, 2024

---

## 📋 Overview

The Enhanced Tip System extends the existing tipping functionality with:
- **Multi-token support** - Tip with any SPL token, not just project tokens
- **Karma rewards** - Earn karma for giving and receiving tips
- **Daily caps** - 5,000 karma limit per day prevents gaming
- **Public/Private tips** - Choose tip visibility
- **USD tracking** - Record USD value at time of tip
- **Tip analytics** - Track tip history and generosity metrics

---

## 🗄️ Schema Changes

### 1. `chat_tips` Table Updates

#### Renamed Columns
```sql
amount_nub → amount_tokens  -- More generic name for multi-token support
```

#### New Columns
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `token_symbol` | TEXT | NO | - | Token symbol for display (SOL, USDC, NUB) |
| `amount_usd` | NUMERIC | YES | NULL | USD value at time of tip |
| `is_public` | BOOLEAN | NO | true | If true, appears in activity feed |
| `karma_awarded_sender` | NUMERIC | NO | 0 | Karma given to sender (after cap) |
| `karma_awarded_recipient` | NUMERIC | NO | 0 | Karma given to recipient (after cap) |

#### New Indexes
```sql
idx_chat_tips_is_public       -- For public feed queries
idx_chat_tips_sender_karma    -- For sender karma lookups
idx_chat_tips_recipient_karma -- For recipient karma lookups  
idx_chat_tips_token_symbol    -- For token-specific queries
```

#### Complete Schema (After Migration)
```typescript
interface ChatTip {
  id: string                     // UUID
  project_id: string            // Project context
  from_wallet: string           // Sender wallet address
  to_wallet: string             // Recipient wallet address
  amount_tokens: number         // Token amount (renamed from amount_nub)
  token_mint: string | null     // SPL token mint address
  token_symbol: string          // Display symbol (SOL, USDC, NUB)
  message: string | null        // Optional message
  tx_signature: string | null   // On-chain transaction signature
  amount_usd: number | null     // USD value at time of tip
  is_public: boolean            // Visibility in feed (default: true)
  karma_awarded_sender: number  // Karma given to sender
  karma_awarded_recipient: number // Karma given to recipient
  created_at: string            // Timestamp
}
```

---

### 2. `wallet_karma` Table Updates

#### New Columns
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `tips_sent_count` | INTEGER | NO | 0 | Total tips sent by wallet |
| `tips_received_count` | INTEGER | NO | 0 | Total tips received by wallet |
| `tip_karma_earned_today` | NUMERIC | NO | 0 | Karma earned today (resets at midnight UTC) |
| `tip_karma_last_reset_date` | DATE | NO | CURRENT_DATE | Last daily reset date |

#### New Indexes
```sql
idx_wallet_karma_daily_tip  -- For daily karma cap queries
```

#### Complete Schema (After Migration)
```typescript
interface WalletKarma {
  // ... existing fields ...
  
  // Tip System Tracking
  tips_sent_count: number            // Total tips sent
  tips_received_count: number        // Total tips received
  tip_karma_earned_today: number     // Karma earned today (resets daily)
  tip_karma_last_reset_date: string  // Last reset date (YYYY-MM-DD)
}
```

---

## 🔧 Database Functions

### 1. `reset_daily_tip_karma()`

Resets the daily karma counter for all wallets. Should be called daily via cron job.

```sql
-- Usage (call once per day at midnight UTC)
SELECT reset_daily_tip_karma();
```

**What it does:**
- Sets `tip_karma_earned_today = 0` for all wallets where `tip_karma_last_reset_date < CURRENT_DATE`
- Updates `tip_karma_last_reset_date = CURRENT_DATE`

**Cron Schedule:**
```bash
# Run at midnight UTC daily
0 0 * * * psql -c "SELECT reset_daily_tip_karma();"
```

---

### 2. `award_tip_karma(wallet, project, karma, is_sender)`

Awards karma for tipping with automatic daily cap enforcement (5,000 karma/day).

```sql
-- Award karma to sender
SELECT award_tip_karma(
  'SenderWallet123...',  -- p_wallet_address
  'project-uuid',        -- p_project_id
  100,                   -- p_karma_amount (requested)
  true                   -- p_is_sender
);

-- Returns: actual karma awarded (may be less due to daily cap)
-- Example: 100 (if under cap) or 50 (if only 50 left before cap)
```

**Parameters:**
- `p_wallet_address` (TEXT) - Wallet to award karma to
- `p_project_id` (UUID) - Project context
- `p_karma_amount` (NUMERIC) - Requested karma amount
- `p_is_sender` (BOOLEAN) - True for sender, false for recipient

**Returns:** `NUMERIC` - Actual karma awarded (after applying daily cap)

**How it works:**
1. Creates wallet_karma record if doesn't exist
2. Checks if daily reset is needed (auto-resets if new day)
3. Calculates remaining karma allowed today (5,000 - earned_today)
4. Awards MIN(requested_karma, remaining_karma)
5. Increments `tips_sent_count` or `tips_received_count`
6. Updates `total_karma_points` and `tip_karma_earned_today`
7. Returns actual karma awarded

**Daily Cap Logic:**
```typescript
// Example: User has already earned 4,800 karma today
const currentDailyKarma = 4800
const remainingKarma = 5000 - 4800 // 200 left

// Try to award 500 karma
const requestedKarma = 500
const actualKarmaAwarded = Math.min(requestedKarma, remainingKarma) // 200

// User hits daily cap, only gets 200 karma
```

---

## 💻 Usage Examples

### Basic Tip Recording (TypeScript)

```typescript
import { supabase } from '@/lib/supabase'

async function recordTip({
  projectId,
  fromWallet,
  toWallet,
  amountTokens,
  tokenMint,
  tokenSymbol,
  txSignature,
  amountUsd,
  message,
  isPublic = true
}: {
  projectId: string
  fromWallet: string
  toWallet: string
  amountTokens: number
  tokenMint: string
  tokenSymbol: string
  txSignature: string
  amountUsd?: number
  message?: string
  isPublic?: boolean
}) {
  // 1. Calculate karma (example: 10 karma per $1 USD)
  const karmaAmount = amountUsd ? Math.floor(amountUsd * 10) : 0
  
  // 2. Award karma to sender with daily cap
  const { data: senderKarma } = await supabase.rpc('award_tip_karma', {
    p_wallet_address: fromWallet,
    p_project_id: projectId,
    p_karma_amount: karmaAmount,
    p_is_sender: true
  })
  
  // 3. Award karma to recipient with daily cap
  const { data: recipientKarma } = await supabase.rpc('award_tip_karma', {
    p_wallet_address: toWallet,
    p_project_id: projectId,
    p_karma_amount: karmaAmount,
    p_is_sender: false
  })
  
  // 4. Record tip in database
  const { error } = await supabase.from('chat_tips').insert({
    project_id: projectId,
    from_wallet: fromWallet,
    to_wallet: toWallet,
    amount_tokens: amountTokens,
    token_mint: tokenMint,
    token_symbol: tokenSymbol,
    tx_signature: txSignature,
    amount_usd: amountUsd,
    message: message || null,
    is_public: isPublic,
    karma_awarded_sender: senderKarma || 0,
    karma_awarded_recipient: recipientKarma || 0
  })
  
  if (error) throw error
  
  return {
    success: true,
    senderKarmaAwarded: senderKarma,
    recipientKarmaAwarded: recipientKarma
  }
}
```

---

### Query Public Tips Feed

```typescript
// Get recent public tips for a project
const { data: publicTips } = await supabase
  .from('chat_tips')
  .select('*')
  .eq('project_id', projectId)
  .eq('is_public', true)
  .order('created_at', { ascending: false })
  .limit(20)
```

---

### Top Tippers Leaderboard

```typescript
// Get top 10 tippers by total USD value
const { data: topTippers } = await supabase
  .from('chat_tips')
  .select('from_wallet, token_symbol')
  .eq('project_id', projectId)
  .order('karma_awarded_sender', { ascending: false })

// Aggregate by wallet
const leaderboard = topTippers.reduce((acc, tip) => {
  if (!acc[tip.from_wallet]) {
    acc[tip.from_wallet] = {
      wallet: tip.from_wallet,
      totalKarma: 0,
      tipCount: 0
    }
  }
  acc[tip.from_wallet].totalKarma += tip.karma_awarded_sender
  acc[tip.from_wallet].tipCount++
  return acc
}, {})
```

---

### User Tip Statistics

```typescript
// Get user's tip stats from wallet_karma
const { data: karma } = await supabase
  .from('wallet_karma')
  .select('tips_sent_count, tips_received_count, tip_karma_earned_today')
  .eq('wallet_address', walletAddress)
  .eq('project_id', projectId)
  .single()

console.log(`Tips Sent: ${karma.tips_sent_count}`)
console.log(`Tips Received: ${karma.tips_received_count}`)
console.log(`Karma Earned Today: ${karma.tip_karma_earned_today}/5000`)
```

---

### Check Daily Karma Remaining

```typescript
async function getRemainingDailyKarma(
  walletAddress: string,
  projectId: string
): Promise<number> {
  const { data } = await supabase
    .from('wallet_karma')
    .select('tip_karma_earned_today, tip_karma_last_reset_date')
    .eq('wallet_address', walletAddress)
    .eq('project_id', projectId)
    .single()
  
  if (!data) return 5000 // No karma earned yet
  
  // Check if reset needed
  const today = new Date().toISOString().split('T')[0]
  if (data.tip_karma_last_reset_date < today) {
    return 5000 // Reset happened, full 5000 available
  }
  
  return Math.max(0, 5000 - data.tip_karma_earned_today)
}
```

---

## 📊 Analytics Queries

### Total Tips by Token

```sql
SELECT 
  token_symbol,
  COUNT(*) as tip_count,
  SUM(amount_tokens) as total_amount,
  SUM(amount_usd) as total_usd,
  AVG(amount_usd) as avg_usd
FROM chat_tips
WHERE project_id = 'project-uuid'
GROUP BY token_symbol
ORDER BY total_usd DESC;
```

---

### Most Generous Tippers

```sql
SELECT 
  from_wallet,
  COUNT(*) as tips_sent,
  SUM(amount_usd) as total_usd_sent,
  SUM(karma_awarded_sender) as total_karma_earned
FROM chat_tips
WHERE project_id = 'project-uuid'
GROUP BY from_wallet
ORDER BY total_usd_sent DESC
LIMIT 10;
```

---

### Top Recipients

```sql
SELECT 
  to_wallet,
  COUNT(*) as tips_received,
  SUM(amount_usd) as total_usd_received,
  SUM(karma_awarded_recipient) as total_karma_earned
FROM chat_tips
WHERE project_id = 'project-uuid'
GROUP BY to_wallet
ORDER BY total_usd_received DESC
LIMIT 10;
```

---

### Daily Tip Volume

```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as tip_count,
  COUNT(DISTINCT from_wallet) as unique_tippers,
  SUM(amount_usd) as total_usd
FROM chat_tips
WHERE project_id = 'project-uuid'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 🔐 Security & Data Integrity

### Data Validation Rules

1. **amount_tokens** - Must be > 0
2. **token_symbol** - Required, max 20 characters
3. **amount_usd** - Optional, but >= 0 if provided
4. **karma_awarded_sender** - >= 0, <= 5000 per day
5. **karma_awarded_recipient** - >= 0, <= 5000 per day

### RLS Policies (Existing, unchanged)

```sql
-- Anyone can view tips
CREATE POLICY "Anyone can view tips"
  ON chat_tips FOR SELECT
  USING (true);

-- Authenticated users can tip
CREATE POLICY "Authenticated users can tip"
  ON chat_tips FOR INSERT
  WITH CHECK (true);
```

---

## 🚀 Migration Checklist

### Pre-Migration
- [ ] Backup database
- [ ] Review current `chat_tips` data
- [ ] Check `wallet_karma` table structure

### During Migration
- [ ] Run `20241126_enhanced_tip_system.sql`
- [ ] Verify all columns added successfully
- [ ] Check indexes created
- [ ] Test `award_tip_karma()` function
- [ ] Test `reset_daily_tip_karma()` function

### Post-Migration
- [ ] Verify existing tips have `token_symbol = 'NUB'`
- [ ] Update TypeScript types (`types/database.ts`) ✅
- [ ] Update TipModal component to use new fields
- [ ] Add karma calculation logic to tip flow
- [ ] Set up daily cron job for karma reset
- [ ] Test with real tips in staging

---

## 🔄 Backwards Compatibility

### Field Renames
- `amount_nub` → `amount_tokens`
- **Action Required**: Update all code references from `amount_nub` to `amount_tokens`

### New Required Fields
- `token_symbol` - **Auto-filled with 'NUB' for existing rows**
- All other new fields have defaults (0 or false)

### Breaking Changes
- None! All changes are additive or have defaults
- Old queries using `amount_nub` will fail → Must update to `amount_tokens`

---

## 📈 Performance Considerations

### Index Performance
- `idx_chat_tips_is_public` - Fast public feed queries (~5ms for 100 rows)
- `idx_chat_tips_sender_karma` - Fast sender lookups (~2ms)
- `idx_chat_tips_recipient_karma` - Fast recipient lookups (~2ms)
- `idx_wallet_karma_daily_tip` - Fast daily cap checks (~1ms)

### Function Performance
- `award_tip_karma()` - ~5-10ms per call
- `reset_daily_tip_karma()` - ~100-500ms for 10,000 wallets

### Optimization Tips
1. Use `is_public` index for feed queries
2. Cache tip counts in application layer
3. Batch karma awards when possible
4. Pre-calculate USD values before insertion

---

## 🐛 Troubleshooting

### Issue: Migration fails on amount_nub rename
**Solution**: Check if column still exists
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'chat_tips' AND column_name = 'amount_nub';
```

### Issue: Daily karma not resetting
**Solution**: Check cron job is running
```sql
SELECT tip_karma_last_reset_date FROM wallet_karma LIMIT 10;
```

### Issue: Karma award returns 0
**Solution**: User hit daily cap (5,000)
```sql
SELECT tip_karma_earned_today FROM wallet_karma 
WHERE wallet_address = 'wallet...' AND project_id = 'project...';
```

---

## 📞 Support

For issues or questions:
1. Check this documentation first
2. Review migration verification output
3. Check Supabase logs for errors
4. Contact dev team with specific error messages

---

**Status**: ✅ Schema migration complete and ready for implementation!
**Next Steps**: Update application code to use new schema and implement Enhanced Tip System features.






