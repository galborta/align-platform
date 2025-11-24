# Conversation Archive Feature

## Overview
Implemented a conversation archive system that allows users to hide conversations from their view without permanently deleting them. This provides a better user experience with reversible actions while preserving all message data.

## Database Changes (Applied ✅)

### Migration: `016_add_conversation_archive.sql`

Added two new boolean columns to the `conversations` table:
- `archived_by_participant_1`: Tracks if participant_1 has archived the conversation
- `archived_by_participant_2`: Tracks if participant_2 has archived the conversation

**Why two fields?**
- Each participant can independently archive their view
- If both archive, conversation still exists (can be restored)
- Messages are preserved for both users
- One user archiving doesn't affect the other user's view

### Indexes Created
```sql
idx_conversations_archived (participant_1, archived_by_participant_1)
idx_conversations_archived_p2 (participant_2, archived_by_participant_2)
```

## Code Changes

### 1. ConversationList.tsx
**Query Updates:**
- Now fetches `archived_by_participant_1` and `archived_by_participant_2` fields
- Filters out archived conversations client-side based on current user
- Only shows conversations where the current user hasn't archived them

**Delete Handler → Archive Handler:**
- Changed from permanent deletion to archiving
- Determines which participant is archiving
- Updates the appropriate archive field
- Confirmation message now says "Archive" instead of "Delete"
- Mentions conversations can be restored later

### 2. lib/messaging.ts
Added three new functions:

#### `archiveConversation(conversationId, currentWallet)`
- Archives a conversation for the current user
- Determines which archive field to update based on participant
- Returns boolean indicating success

#### `unarchiveConversation(conversationId, currentWallet)`
- Restores an archived conversation to the user's view
- Can be used in a future "Archived Conversations" settings page
- Returns boolean indicating success

#### `getArchivedConversations(walletAddress)`
- Fetches all conversations archived by a specific user
- Useful for displaying archived conversations in settings
- Returns array of archived Conversation objects

## Benefits

### Data Preservation ✅
- **No Data Loss**: Messages are never deleted
- **Debugging**: Support team can always access conversation history
- **Legal/Compliance**: Message history retained for audit purposes

### User Experience ✅
- **Reversible**: Users can restore archived conversations anytime
- **Independent**: Each user controls their own view
- **Clean Interface**: Unwanted conversations hidden from list
- **Peace of Mind**: "Archive" feels safer than "Delete"

### Performance ✅
- **Indexed Queries**: Archive fields are indexed for fast filtering
- **Efficient Filtering**: Client-side filtering on already-fetched data
- **No Breaking Changes**: Existing conversations work without migration

## How It Works

### Archiving Flow:
1. User clicks delete (trash) icon on conversation
2. Confirmation: "Archive this conversation? You can restore it later from settings."
3. System determines if user is participant_1 or participant_2
4. Updates appropriate `archived_by_participant_X` field to `true`
5. Conversation disappears from user's conversation list
6. Other participant still sees the conversation (unless they also archive)

### Filtering Logic:
```typescript
// In ConversationList.tsx
const filteredConvData = convData?.filter(conv => {
  const isParticipant1 = conv.participant_1 === currentWallet
  return isParticipant1 
    ? !conv.archived_by_participant_1  // Show if not archived by participant_1
    : !conv.archived_by_participant_2  // Show if not archived by participant_2
}) || []
```

## Future Enhancements

### Archived Conversations View (Suggested)
Create a settings page to view and restore archived conversations:

```typescript
// Example implementation for settings page
import { getArchivedConversations, unarchiveConversation } from '@/lib/messaging'

const ArchivedConversationsPage = () => {
  const [archived, setArchived] = useState([])
  
  useEffect(() => {
    const loadArchived = async () => {
      const archivedConvs = await getArchivedConversations(currentWallet)
      setArchived(archivedConvs)
    }
    loadArchived()
  }, [currentWallet])
  
  const handleRestore = async (conversationId) => {
    const success = await unarchiveConversation(conversationId, currentWallet)
    if (success) {
      // Refresh list
      setArchived(prev => prev.filter(c => c.id !== conversationId))
    }
  }
  
  // ... render archived conversations with restore buttons
}
```

### Auto-Archive Old Conversations (Optional)
- Archive conversations with no activity for 90+ days
- Notify users before auto-archiving
- Provide easy restore option

## Testing

### Test Cases to Verify:
1. ✅ Archive a conversation → it disappears from list
2. ✅ Other participant still sees conversation after one user archives
3. ✅ Archived conversations don't appear in "All" or "Unread" tabs
4. ✅ New messages to archived conversation don't break anything
5. ✅ Both users can independently archive the same conversation
6. 🔜 Restore archived conversation (when settings page is built)

### Manual Testing Steps:
```bash
# 1. Start messaging sidebar
# 2. Send messages to create a conversation
# 3. Click the trash/delete icon on a conversation
# 4. Confirm it says "Archive this conversation? You can restore it later from settings."
# 5. Click OK
# 6. Verify conversation disappears from list
# 7. Check from other user's account - conversation should still be visible
# 8. Database check: SELECT * FROM conversations WHERE id = '<conversation_id>'
#    Should show archived_by_participant_X = true for the user who archived
```

## Status

✅ **COMPLETE AND DEPLOYED**
- Database migration applied to production
- Code changes deployed
- No linter errors
- Fully functional

## Files Changed

1. `/supabase-migrations/016_add_conversation_archive.sql` - Database migration
2. `/components/ConversationList.tsx` - UI and archive logic
3. `/lib/messaging.ts` - Archive/unarchive helper functions
4. `/CONVERSATION_ARCHIVE_FEATURE.md` - This documentation

## Notes

- **Backward Compatible**: Existing conversations work without migration (default archived = false)
- **No Breaking Changes**: All existing functionality preserved
- **Performance Impact**: Minimal - indexed queries remain fast
- **Data Safety**: Messages are never deleted, improving data integrity

