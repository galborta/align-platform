# 🚀 Unified Notification System - Quick Start Guide

## 📦 What You Need

1. **Migration File**: `/supabase/migrations/015_create_notifications_system.sql`
2. **Types**: Already updated in `/types/database.ts`

---

## ⚡ Quick Setup

### Step 1: Apply Migration

```bash
# Option 1: Using Supabase CLI
cd supabase
supabase db push

# Option 2: Copy SQL to Supabase Dashboard
# Go to: https://app.supabase.com/project/YOUR_PROJECT/sql
# Copy contents of 015_create_notifications_system.sql
# Click "Run"
```

### Step 2: Verify Migration

```sql
-- Check table exists
SELECT COUNT(*) FROM notifications;

-- Check indexes
SELECT * FROM pg_indexes WHERE tablename = 'notifications';

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'notifications';

-- Check functions
SELECT proname FROM pg_proc WHERE proname LIKE '%notification%';
```

---

## 🎯 Common Use Cases

### 1. Send Job Assigned Notification

```typescript
import { supabase } from '@/lib/supabase'
import type { NotificationInsert } from '@/types/database'

const notification: NotificationInsert = {
  user_wallet: workerWallet,
  type: 'job_assigned',
  actor_wallet: posterWallet,
  reference_id: jobId,
  reference_type: 'job',
  metadata: {
    job_title: "Logo Design",
    job_type: "design"
  }
}

await supabase.from('notifications').insert(notification)
```

### 2. Send Tip Notification (with Batching)

```typescript
const batchKey = `tip_${recipientWallet}_USDC_${new Date().toISOString().split('T')[0]}`

// Check for existing batch
const { data: existing } = await supabase
  .from('notifications')
  .select('*')
  .eq('batch_group_key', batchKey)
  .eq('is_read', false)
  .maybeSingle()

if (existing) {
  // Increment existing batch
  await supabase.rpc('increment_batch_count', {
    notification_id: existing.id
  })
} else {
  // Create new batch
  const notification: NotificationInsert = {
    user_wallet: recipientWallet,
    type: 'tip_received',
    actor_wallet: senderWallet,
    reference_type: 'tip',
    batch_group_key: batchKey,
    metadata: {
      amount: 10,
      token: 'USDC'
    }
  }
  
  await supabase.from('notifications').insert(notification)
}
```

### 3. Get User's Notifications

```typescript
const { data: notifications } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_wallet', userWallet)
  .order('created_at', { ascending: false })
  .limit(20)
```

### 4. Get Unread Count

```typescript
const { data: count } = await supabase.rpc('get_unread_notification_count', {
  wallet_address: userWallet
})
```

### 5. Mark Notifications as Read

```typescript
// Mark specific notifications
const { data: updated } = await supabase.rpc('mark_notifications_read', {
  wallet_address: userWallet,
  notification_ids: [id1, id2, id3]
})

// Mark all as read
const { data: updated } = await supabase.rpc('mark_all_notifications_read', {
  wallet_address: userWallet
})
```

---

## 📋 All Notification Types

### Job Notifications
- `job_application_received` - Someone applied to your job
- `job_assigned` - You were assigned to a job
- `job_submitted` - Worker submitted work
- `job_completed` - Job was completed
- `job_dispute_created` - Dispute opened on job
- `job_dispute_vote` - Someone voted on dispute
- `job_comment` - New comment on job

### Asset Notifications
- `asset_upvote` - Someone upvoted your asset
- `asset_verified` - Your asset was verified
- `asset_hidden` - Your asset was hidden by admin

### Social Notifications
- `tip_received` - You received a tip
- `message_received` - New message received

### Karma Notifications
- `karma_milestone` - Reached karma milestone
- `karma_warning` - Karma warning issued
- `karma_ban` - User was banned

### Payment Notifications
- `payment_released` - Payment was released
- `payment_refunded` - Payment was refunded

### Admin Notifications
- `admin_dispute_new` - New dispute for review
- `admin_job_new` - New job posted
- `admin_asset_new` - New asset submitted
- `admin_revenue_earned` - Platform earned revenue

---

## 🎨 Metadata Examples

### Job Notification
```typescript
metadata: {
  job_title: "Logo Design for NFT Project",
  job_type: "design",
  applicant_count: 5
}
```

### Payment Notification
```typescript
metadata: {
  amount: 100,
  token: "USDC",
  token_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
}
```

### Karma Notification
```typescript
metadata: {
  karma_points: 50,
  karma_level: "Trusted",
  new_karma_score: 350,
  old_karma_score: 300
}
```

### Batch Notification
```typescript
metadata: {
  amount: 45.5,  // Total from 3 tips
  token: "USDC"
}
// batch_count: 3
```

---

## 🔍 Database Functions

### `get_unread_notification_count(wallet_address text)`
Returns unread count for a user.

```typescript
const { data } = await supabase.rpc('get_unread_notification_count', {
  wallet_address: userWallet
})
// data = 5
```

### `mark_notifications_read(wallet_address text, notification_ids uuid[])`
Marks specific notifications as read.

```typescript
const { data } = await supabase.rpc('mark_notifications_read', {
  wallet_address: userWallet,
  notification_ids: ['uuid1', 'uuid2']
})
// data = 2 (number of rows updated)
```

### `mark_all_notifications_read(wallet_address text)`
Marks all notifications as read.

```typescript
const { data } = await supabase.rpc('mark_all_notifications_read', {
  wallet_address: userWallet
})
// data = 12 (number of rows updated)
```

### `increment_batch_count(notification_id uuid)`
Increments batch count and refreshes timestamp.

```typescript
const { data } = await supabase.rpc('increment_batch_count', {
  notification_id: existingNotification.id
})
// data = updated notification object
```

---

## 🔒 Security (RLS)

The table is protected by Row Level Security:

- ✅ Users can **view** their own notifications
- ✅ Users can **update** their own notifications (mark as read)
- ✅ Users can **delete** their own notifications
- ✅ Admins can **view** all notifications
- ✅ Service role can **insert** notifications

---

## 📊 Performance Tips

1. **Use Indexes**: Queries are optimized with 5 indexes
2. **Batch Similar Events**: Use `batch_group_key` to group similar notifications
3. **Limit Results**: Always use `.limit()` when fetching notifications
4. **Use RPC Functions**: For counting and marking as read
5. **Cleanup is Automatic**: Keeps last 500 per user automatically

---

## 🐛 Troubleshooting

### Notifications Not Appearing

```typescript
// Check table exists
const { data, error } = await supabase.from('notifications').select('count')
if (error) console.error('Table does not exist:', error)

// Check RLS policies
// Run in Supabase SQL Editor:
// SELECT * FROM pg_policies WHERE tablename = 'notifications';
```

### Unread Count Wrong

```typescript
// Use the RPC function, not direct count
const { data: count } = await supabase.rpc('get_unread_notification_count', {
  wallet_address: userWallet
})
```

### Batch Not Incrementing

```typescript
// Make sure batch_group_key is consistent
const batchKey = `tip_${recipientWallet}_${token}_${date}`

// Check for existing batch with is_read = false
const { data } = await supabase
  .from('notifications')
  .select('*')
  .eq('batch_group_key', batchKey)
  .eq('is_read', false)  // Important!
  .maybeSingle()
```

---

## 🎯 Next Steps

1. **Apply migration** (`015_create_notifications_system.sql`)
2. **Create notification library** (`/lib/unified-notifications.ts`)
3. **Update UI components** (NotificationBell, etc.)
4. **Migrate existing notifications**
5. **Test thoroughly**

---

## 📚 Related Files

- **Migration**: `/supabase/migrations/015_create_notifications_system.sql`
- **Types**: `/types/database.ts`
- **Full Documentation**: `UNIFIED_NOTIFICATION_SYSTEM_COMPLETE.md`
- **Old Job Notifications**: `JOB_NOTIFICATION_SYSTEM_COMPLETE.md`
- **Browser Notifications**: `NOTIFICATION_SYSTEM_COMPLETE.md`

---

**Ready to start using the unified notification system!** 🚀

