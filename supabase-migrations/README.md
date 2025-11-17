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

**Status**: ⏳ Pending

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

