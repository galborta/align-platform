# Admin Submission System - Quick Start Guide

**Ready to Use**: YES ✅  
**Production Status**: Ready for deployment

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Submit a Test Project

Visit: `http://localhost:3000/submit-project`

Fill out:
- Name: `Test User`
- Email: `test@example.com`
- Contract: `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
- Token Symbol: `TEST`
- Token Name: `Test Token`
- Role: `Founder`
- Message: `Testing the submission system`

Click **Submit Project**

### Step 2: Connect as Admin

Wallet: `Eyyue9xYUiGFqQ8yjBowfiiAgG41hD4mAxb79nThN6ev`

### Step 3: Check Notification

Look for notification badge (🔔) in header

### Step 4: Open Messages

Visit: `http://localhost:3000/messages`

You should see:
- Conversation with purple **PROJECT SUBMISSION** tag
- Tag is pulsing (unread indicator)

### Step 5: Review Submission

Click the conversation

You'll see:
- System message with submission details
- **✓ Accept Project** button (green)
- **✕ Reject Project** button (red)

### Step 6: Take Action

**To Approve:**
1. Click "✓ Accept Project"
2. Review confirmation modal
3. Click "Yes, Accept Project"
4. Wait for processing
5. Success message appears
6. Creation link copied to clipboard
7. Tag disappears from conversation
8. Approval message appears in thread

**To Reject:**
1. Click "✕ Reject Project"
2. Review confirmation modal
3. Click "Yes, Reject Project"
4. Wait for processing
5. Success message appears
6. Tag disappears
7. Rejection message appears in thread

---

## 📱 UI Reference

### Conversation List
```
┌─────────────────────────────────────┐
│ John Doe  [PROJECT SUBMISSION] ●    │
│ 🚀 New Project Submission           │
│ 2 minutes ago                       │
├─────────────────────────────────────┤
│ Alice Smith                         │
│ Thanks for the update!              │
│ 1 hour ago                          │
└─────────────────────────────────────┘
```

### Message Thread (Submission)
```
┌─────────────────────────────────────┐
│ [System Message]                    │
│ 🚀 New Project Submission           │
│ Name: John Doe                      │
│ Email: john@example.com             │
│ Token: TEST - Test Token            │
│ ...                                 │
│                                     │
│ [✓ Accept Project] [✕ Reject]      │
└─────────────────────────────────────┘
```

### After Approval
```
┌─────────────────────────────────────┐
│ [System Message]                    │
│ 🚀 New Project Submission           │
│ ...                                 │
│                                     │
│ [Admin Message]                     │
│ ✅ Great news! Your project has     │
│ been selected to join Orggly...     │
│ https://orggly.com/projects/...     │
└─────────────────────────────────────┘
```

---

## 🔍 Database Queries

### View All Pending Submissions
```sql
SELECT 
  id,
  name,
  email,
  token_symbol,
  token_name,
  status,
  conversation_id,
  submitted_at
FROM project_submissions
WHERE status = 'pending'
ORDER BY submitted_at DESC;
```

### View Submission Conversations
```sql
SELECT 
  c.id,
  c.tags,
  c.submission_id,
  c.last_message_at,
  ps.name,
  ps.email,
  ps.status
FROM conversations c
JOIN project_submissions ps ON c.submission_id = ps.id
WHERE c.tags @> ARRAY['Project Submission']
ORDER BY c.last_message_at DESC;
```

### View Creation Tokens
```sql
SELECT 
  token,
  contract_address,
  email,
  status,
  created_at,
  expires_at
FROM project_creation_tokens
WHERE status = 'pending'
ORDER BY created_at DESC;
```

---

## ⚙️ Configuration

### Admin Wallets
**File**: `lib/admin-auth.ts`
```typescript
export const ADMIN_WALLETS = [
  'Eyyue9xYUiGFqQ8yjBowfiiAgG41hD4mAxb79nThN6ev'
]
```

**To add more admins**: Add wallet addresses to array

### App URL
**Environment Variable**: `NEXT_PUBLIC_APP_URL`
- Development: `http://localhost:3000`
- Production: `https://orggly.com`

Used in creation links sent to approved projects.

---

## 🐛 Troubleshooting

### Buttons Not Showing
**Cause**: Submission status not 'pending'  
**Fix**: Check `project_submissions.status`

### Tag Not Appearing
**Cause**: Tag not added during submission  
**Fix**: Check `conversations.tags` array

### Approval Fails
**Cause**: Admin wallet not in `ADMIN_WALLETS`  
**Fix**: Verify wallet address in `lib/admin-auth.ts`

### Message Not Sent
**Cause**: Conversation ID missing  
**Fix**: Check `project_submissions.conversation_id`

### Creation Link Not Copied
**Cause**: Browser clipboard API blocked  
**Fix**: Use HTTPS or allow clipboard in browser settings

---

## 📞 Support

### Check Console Logs
All operations are logged with prefixes:
- `[Create Submission]` - Submission API
- `[Approve Submission]` - Approve API
- `[Reject Submission]` - Reject API
- `[MessageThread]` - UI component

### Database Verification
```sql
-- Check submission
SELECT * FROM project_submissions WHERE id = 'uuid';

-- Check conversation
SELECT * FROM conversations WHERE submission_id = 'uuid';

-- Check messages
SELECT * FROM messages WHERE conversation_id = 'uuid';

-- Check notifications
SELECT * FROM notifications WHERE reference_id = 'uuid';
```

---

## ✨ Features

✅ Auto-create admin conversation  
✅ Tag conversations  
✅ Notify admins  
✅ Display tags in UI  
✅ Approve with token generation  
✅ Reject with message  
✅ Real-time updates  
✅ Mobile responsive  
✅ Clipboard copy  
✅ Error handling  
✅ Loading states  
✅ Confirmation modals  
✅ Success feedback

---

**System Ready to Use!** 🎉

For full technical documentation, see:
- `ADMIN_CONVERSATION_INTEGRATION_COMPLETE.md`
- `SPRINT_ADMIN_INTEGRATION_FINAL.md`
