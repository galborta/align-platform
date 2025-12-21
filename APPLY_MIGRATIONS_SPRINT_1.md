# 🚀 Quick Start: Apply Sprint 1 Migrations

## Applying Migrations via Supabase Dashboard

### Step 1: Access SQL Editor
1. Go to https://app.supabase.com
2. Select your project: **align-platform**
3. Navigate to **SQL Editor** in left sidebar

### Step 2: Apply Each Migration (In Order)

Copy and paste the contents of each file into the SQL Editor and click **Run**.

#### Migration 1: Add editor_wallets Column
**File**: `supabase-migrations/048_add_editor_wallets_column.sql`
```sql
-- Copy entire contents and run
```
✅ **Expected Result**: Column added, index created, no errors

---

#### Migration 2: Create editor_sessions Table
**File**: `supabase-migrations/049_create_editor_sessions_table.sql`
```sql
-- Copy entire contents and run
```
✅ **Expected Result**: Table created, 3 policies, 2 functions, 4 indexes

---

#### Migration 3: Add Notification Types
**File**: `supabase-migrations/050_add_editor_notification_types.sql`
```sql
-- Copy entire contents and run
```
✅ **Expected Result**: Comments updated, verification passed

---

#### Migration 4: Document Admin Logs
**File**: `supabase-migrations/051_document_editor_admin_logs.sql`
```sql
-- Copy entire contents and run
```
✅ **Expected Result**: Comments updated, 3 indexes created, verification passed

---

#### Migration 5: Add RLS Policies
**File**: `supabase-migrations/052_add_editor_rls_policies.sql`
```sql
-- Copy entire contents and run
```
✅ **Expected Result**: 9 policies created, 1 function, no errors

---

## Verification Queries

After applying all migrations, run these checks:

### Check 1: editor_wallets Column
```sql
SELECT 
  column_name, 
  data_type,
  column_default
FROM information_schema.columns 
WHERE table_name = 'projects' 
  AND column_name = 'editor_wallets';
```
**Expected**: 1 row, data_type = 'ARRAY'

---

### Check 2: editor_sessions Table
```sql
SELECT 
  table_name,
  (SELECT count(*) FROM information_schema.columns WHERE table_name = 'editor_sessions') as column_count
FROM information_schema.tables 
WHERE table_name = 'editor_sessions';
```
**Expected**: 1 row, 10 columns

---

### Check 3: Helper Functions
```sql
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_name IN (
  'is_valid_editor_session',
  'cleanup_expired_editor_sessions',
  'is_project_editor_or_creator'
)
ORDER BY routine_name;
```
**Expected**: 3 rows

---

### Check 4: RLS Policies
```sql
SELECT 
  tablename,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE tablename IN ('projects', 'editor_sessions', 'pending_assets', 'social_assets')
  AND (policyname ILIKE '%editor%' OR policyname ILIKE '%creator%')
ORDER BY tablename, policyname;
```
**Expected**: 9 rows minimum

---

### Check 5: Indexes
```sql
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname IN (
  'idx_projects_editor_wallets',
  'idx_editor_sessions_wallet',
  'idx_editor_sessions_project',
  'idx_editor_sessions_expires',
  'idx_editor_sessions_project_wallet',
  'idx_admin_logs_action',
  'idx_admin_logs_project_action',
  'idx_admin_logs_created_at'
)
ORDER BY tablename, indexname;
```
**Expected**: 8 rows

---

## Rollback (If Needed)

If you need to undo the migrations, run in **reverse order**:

### Rollback 5: Remove RLS Policies
```sql
DROP POLICY IF EXISTS "Public can view live projects" ON projects;
DROP POLICY IF EXISTS "Editors can view their projects" ON projects;
DROP POLICY IF EXISTS "Editors can update their projects" ON projects;
DROP POLICY IF EXISTS "Creators can insert projects" ON projects;
DROP POLICY IF EXISTS "Editors can update pending assets for their projects" ON pending_assets;
DROP POLICY IF EXISTS "Editors can manage social assets for their projects" ON social_assets;
DROP FUNCTION IF EXISTS is_project_editor_or_creator(uuid, text);
```

### Rollback 4: Remove Admin Log Indexes
```sql
DROP INDEX IF EXISTS idx_admin_logs_created_at;
DROP INDEX IF EXISTS idx_admin_logs_project_action;
DROP INDEX IF EXISTS idx_admin_logs_action;
```

### Rollback 3: Remove Notification Comments
```sql
COMMENT ON TABLE notifications IS 'Notification system for user alerts.';
```

### Rollback 2: Remove editor_sessions
```sql
DROP FUNCTION IF EXISTS cleanup_expired_editor_sessions();
DROP FUNCTION IF EXISTS is_valid_editor_session(uuid, text);
DROP TABLE IF EXISTS editor_sessions CASCADE;
```

### Rollback 1: Remove editor_wallets
```sql
ALTER TABLE projects DROP COLUMN IF EXISTS editor_wallets;
DROP INDEX IF EXISTS idx_projects_editor_wallets;
```

---

## Testing After Migration

### Test 1: Add Editor to Project
```sql
-- Replace with real project ID and wallet address
UPDATE projects 
SET editor_wallets = array_append(editor_wallets, 'EditorWalletAddressHere')
WHERE id = 'project-uuid-here'
RETURNING id, creator_wallet, editor_wallets;
```

### Test 2: Create Editor Session
```sql
-- Replace with real values
INSERT INTO editor_sessions (
  project_id,
  wallet_address,
  signature,
  message
) VALUES (
  'project-uuid-here',
  'wallet-address-here',
  'signature-here',
  'I am signing in as an editor'
)
RETURNING id, expires_at;
```

### Test 3: Validate Session
```sql
-- Replace with real values
SELECT is_valid_editor_session(
  'project-uuid-here'::uuid,
  'wallet-address-here'
) as is_valid;
```
**Expected**: `true` if session exists and not expired

### Test 4: Check Permission
```sql
-- Replace with real values
SELECT is_project_editor_or_creator(
  'project-uuid-here'::uuid,
  'wallet-address-here'
) as has_access;
```
**Expected**: `true` if wallet is creator or in editor_wallets array

---

## Success Criteria ✅

After applying all migrations, you should have:

- ✅ `projects.editor_wallets` column exists
- ✅ `editor_sessions` table with 10 columns
- ✅ 3 helper functions created
- ✅ 9+ RLS policies active
- ✅ 8 performance indexes created
- ✅ Zero SQL errors
- ✅ All verification queries pass

---

## Troubleshooting

### Issue: "column already exists"
**Solution**: Column was already added. Safe to skip migration 048 or it will use `IF NOT EXISTS`.

### Issue: "policy already exists"
**Solution**: Policies exist. Migration 052 drops existing policies first, so re-run it.

### Issue: "function already exists"
**Solution**: Functions use `CREATE OR REPLACE`, so safe to re-run.

### Issue: RLS prevents updates
**Solution**: Ensure you're connected as the project creator or admin to test updates.

---

## Next: TypeScript Integration

After migrations are applied, TypeScript types are already updated in:
- `types/database.ts` - New notification types and metadata fields

No code changes needed - types are ready to use! 🎉

---

**Estimated Time**: 5-10 minutes  
**Difficulty**: Easy (copy/paste)  
**Required Access**: Supabase SQL Editor  
**Rollback Available**: Yes ✅

