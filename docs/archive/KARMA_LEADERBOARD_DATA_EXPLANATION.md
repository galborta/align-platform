# ✅ Karma Leaderboard - Data Structure Explanation

## Current Status: **WORKING CORRECTLY** ✅

The leaderboard system is functioning exactly as designed. Here's what's happening:

---

## 🎯 How The System Works

### Homepage (Global Leaderboard)
- **Query:** `global_karma_leaderboard` view
- **Filter:** `WHERE project_id IS NULL`
- **Shows:** Platform-wide karma leaders (not tied to any specific project)

### Project Pages (Project-Specific Leaderboard)
- **Query:** `karma_leaderboard` view with `projectId` filter
- **Filter:** `WHERE project_id = '<specific-project-id>'`
- **Shows:** Top karma earners within that specific project

---

## 📊 Current Database State

### Global Karma Entries (Homepage)

**Query Results from `wallet_karma WHERE project_id IS NULL`:**

| Wallet Address | Total Karma | Assets Added | Upvotes Given | Tips Sent | Tips Received |
|----------------|-------------|--------------|---------------|-----------|---------------|
| AliceTop1111... | 2,450 | 15 | 12 | 45 | 68 |
| BobSecond222... | 2,100 | 12 | 10 | 38 | 52 |
| CharlieThird33... | 1,890 | 11 | 9 | 32 | 41 |
| DianaFourth444... | 1,654 | 10 | 8 | 28 | 35 |
| EveFifth555... | 1,432 | 9 | 7 | 24 | 29 |
| FrankSixth666... | 1,289 | 8 | 6 | 20 | 23 |
| GraceSeventh77... | 1,156 | 7 | 5 | 17 | 19 |
| HenryEighth888... | 1,023 | 6 | 4 | 14 | 15 |
| IrisNinth999... | 945 | 5 | 3 | 11 | 12 |
| JackTenth1010... | 876 | 4 | 2 | 8 | 9 |

**Status:** ⚠️ **This is seed/test data** - These are demo accounts created for testing.

---

### Project-Specific Karma Entries

**Query Results from `wallet_karma WHERE project_id IS NOT NULL`:**

| Wallet Address | Project ID | Total Karma |
|----------------|------------|-------------|
| GxPUe7pziu2Rx... | f14b15f5-636f-4689-8d17-12fbc49b7e04 | 236.25 |

**Status:** ✅ **This is real user data** - This user earned karma within a specific project.

---

## 🔍 What You're Seeing

### On Homepage (`/`)
You're seeing the **test/seed data** because:
1. ✅ The leaderboard is correctly querying `global_karma_leaderboard`
2. ✅ The view correctly filters for `project_id IS NULL` (global entries)
3. ⚠️ The only global karma entries in the database are the test accounts (AliceTop111..., BobSecond222..., etc.)

**This is not "dummy data" - it's real data in the database, just from test accounts created during development.**

---

## 💡 Why Real Users Don't Appear on Homepage

The real user (`GxPUe7pziu2Rx...`) has karma in a **project-specific entry** (`project_id = f14b15f5-...`), not a global entry.

**Two approaches to karma tracking:**

### Approach 1: Separate Global & Project Karma (Current)
- Users have separate karma counters for:
  - Global platform karma (`project_id IS NULL`)
  - Per-project karma (`project_id = <project>`)
- **Pros:** Users can have different rankings on different projects
- **Cons:** Actions in projects don't increase global karma

### Approach 2: Aggregate Global from Projects
- Global karma = SUM of all project-specific karma for a user
- **Pros:** All actions count toward global rank
- **Cons:** Need to recalculate global leaderboard from all projects

---

## 🛠️ Options to Fix

### Option 1: Remove Seed Data (Quick Fix)
Show real users by deleting test accounts:

```sql
-- Delete test accounts from global leaderboard
DELETE FROM wallet_karma 
WHERE project_id IS NULL 
  AND wallet_address LIKE '%Top111%' 
  OR wallet_address LIKE '%Second222%'
  OR wallet_address LIKE '%Third333%'
  -- ... continue for all test addresses
```

**Result:** Homepage will show empty or show only real global karma entries.

---

### Option 2: Aggregate Global Karma (Recommended)
Create global karma as sum of all project karma:

```sql
-- Insert/update global karma aggregated from all projects
INSERT INTO wallet_karma (wallet_address, project_id, total_karma_points, ...)
SELECT 
  wallet_address,
  NULL as project_id,
  SUM(total_karma_points) as total_karma_points,
  SUM(assets_added_count) as assets_added_count,
  SUM(upvotes_given_count) as upvotes_given_count,
  SUM(tips_sent_count) as tips_sent_count,
  SUM(tips_received_count) as tips_received_count,
  -- ... other aggregated fields
FROM wallet_karma
WHERE project_id IS NOT NULL
GROUP BY wallet_address
ON CONFLICT (wallet_address, project_id) 
DO UPDATE SET
  total_karma_points = EXCLUDED.total_karma_points,
  assets_added_count = EXCLUDED.assets_added_count,
  -- ... update all fields
```

**Result:** Homepage shows real users with aggregated karma from all projects.

---

### Option 3: Change Global Leaderboard to Show All Projects
Modify the view to aggregate on-the-fly:

```sql
-- Drop existing view
DROP VIEW IF EXISTS global_karma_leaderboard;

-- Create aggregated view
CREATE OR REPLACE VIEW global_karma_leaderboard AS
SELECT
  MIN(wk.id) as id,
  wk.wallet_address,
  up.display_name AS username,
  up.avatar_url,
  FLOOR(SUM(wk.total_karma_points))::INTEGER AS total_karma,
  SUM(wk.assets_added_count + wk.upvotes_given_count) AS completed_jobs,
  SUM(wk.tips_sent_count) as tips_sent_count,
  SUM(wk.tips_received_count) as tips_received_count,
  MAX(up.last_seen_at) AS last_active_at
FROM wallet_karma wk
LEFT JOIN user_profiles up ON up.wallet_address = wk.wallet_address
WHERE wk.is_banned = false
GROUP BY wk.wallet_address, up.display_name, up.avatar_url
ORDER BY total_karma DESC;
```

**Result:** Homepage aggregates karma from ALL projects (both global and project-specific entries).

---

## 🎯 Recommended Solution

**Option 3** (Aggregate View) is the best approach because:
- ✅ No need to manage duplicate data
- ✅ Always up-to-date (calculated from source)
- ✅ Shows real users immediately
- ✅ Users earn global karma from any project activity
- ✅ No background jobs needed to sync

---

## 🧪 Testing After Fix

### 1. Delete Seed Data (If using Option 1)
```sql
DELETE FROM wallet_karma 
WHERE project_id IS NULL 
  AND wallet_address ~ '^[A-Za-z]+111+$|^[A-Za-z]+222+$|^[A-Za-z]+333+$';
```

### 2. Check Homepage Leaderboard
Navigate to `http://localhost:3003` and verify:
- Real wallet addresses appear (like `GxPUe7pziu2Rx...`)
- Karma totals make sense
- No test accounts visible

### 3. Check Project Leaderboard
Navigate to `/project/f14b15f5-636f-4689-8d17-12fbc49b7e04` and verify:
- Project-specific rankings shown
- Same user may have different rank per project

---

## 📚 Summary

| Component | Status | Notes |
|-----------|--------|-------|
| **Views** | ✅ Created | `global_karma_leaderboard` and `karma_leaderboard` exist |
| **API** | ✅ Working | Correctly queries global vs project-specific |
| **Frontend** | ✅ Working | Homepage correctly calls API without `projectId` |
| **Data** | ⚠️ Test Data | Global entries are seed accounts, need real data |

**Next Step:** Choose Option 1, 2, or 3 above to show real users on homepage.

**Recommended:** Option 3 (Aggregate View) for best long-term solution.

