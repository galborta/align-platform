# Supabase Migrations

This directory contains SQL migrations for the ALIGN platform database.

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the contents of the migration file
6. Click **Run** to execute the migration

### Option 2: Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase db push
```

## Migrations

### 001_create_chat_messages.sql

**Status**: ✅ Completed

**Description**: Creates the `chat_messages` table for real-time project chat functionality with token holder verification.

**Features**:
- Message storage with 500 character limit
- Token holder tier tracking (mega, whale, holder, small)
- Token balance and percentage tracking
- Row Level Security (RLS) policies
- Performance indexes
- Real-time subscriptions enabled

**Tables Created**:
- `chat_messages`

**Indexes Created**:
- `idx_project_messages` - Fast lookups by project
- `idx_wallet_messages` - Fast lookups by wallet

**RLS Policies**:
- Anyone can read messages for live projects
- Anyone can insert messages (holdings validated in API)

---

### 002_add_project_description.sql

**Status**: ✅ Completed

**Description**: Adds description field to projects table.

---

### 003_create_community_curation_tables.sql

**Status**: ✅ Completed

**Description**: Creates tables for community curation system (pending_assets, asset_votes, wallet_karma, curation_chat_messages).

---

### 004_add_karma_rpc_function.sql

**Status**: ✅ Completed

**Description**: Creates the add_karma RPC function for karma management.

---

### 005_fix_curation_chat_rls.sql

**Status**: ✅ Completed

**Description**: Fixes RLS policies for curation chat messages.

---

### 006_add_vote_increment_functions.sql

**Status**: ⏳ **RUN THIS FIRST**

**Description**: Adds RPC functions for atomic vote increment operations in the community curation system.

**Functions Created**:
- `increment_upvote(p_asset_id UUID, p_weight NUMERIC)` - Atomically updates upvote weight and count
- `increment_report(p_asset_id UUID, p_weight NUMERIC)` - Atomically updates report weight and count

**Why These Functions?**
- Ensures atomic updates to vote counts and weights
- Prevents race conditions when multiple users vote simultaneously
- Cleaner code than manual UPDATE statements
- Consistent timestamp updates

**Required For**: AssetVotingCard component to function properly

**To Apply**:
1. Go to Supabase Dashboard > SQL Editor
2. Copy contents of `006_add_vote_increment_functions.sql`
3. Run the migration
4. Verify with: `SELECT routine_name FROM information_schema.routines WHERE routine_name IN ('increment_upvote', 'increment_report');`

---

### 007_add_karma_management_functions.sql

**Status**: ⏳ **RUN THIS SECOND**

**Description**: Adds RPC functions for karma management and automated status transitions.

**Functions Created**:
- `increment_assets_added(p_wallet TEXT, p_project_id UUID)` - Increments verified asset count for a wallet
- `add_warning(p_wallet TEXT, p_project_id UUID, p_reason TEXT)` - Adds warning and checks ban conditions

**Why These Functions?**
- Automated karma distribution when assets are verified
- Automatic ban enforcement based on warning thresholds
- Posts chat messages when wallets are banned
- Tracks active warnings (within 90 days)

**Ban Logic**:
- 2+ warnings with karma ≤ 0 → Ban
- 3+ warnings regardless of karma → Ban
- Only warnings within 90 days count

**Required For**: Automated verification cron job (`/api/check-verifications`)

**To Apply**:
1. Go to Supabase Dashboard > SQL Editor
2. Copy contents of `007_add_karma_management_functions.sql`
3. Run the migration
4. Verify with: `SELECT routine_name FROM information_schema.routines WHERE routine_name IN ('increment_assets_added', 'add_warning');`

---

## After Running Migrations

1. ✅ Mark the migration as completed in this README
2. ✅ Verify the table exists in Supabase Dashboard > Table Editor
3. ✅ Test the realtime subscription in your app
4. ✅ Commit the migration file to version control

## Troubleshooting

### Error: relation "projects" does not exist

Make sure your `projects` table exists first. This migration requires it for the foreign key constraint.

### Error: extension "uuid-ossp" not available

Enable the uuid-ossp extension in Supabase Dashboard > Database > Extensions.

### Realtime not working

1. Check that the table is added to the publication:
```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

2. Verify in Supabase Dashboard > Database > Replication

