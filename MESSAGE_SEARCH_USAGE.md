# 📖 Message Search - Usage Guide

## 🚀 Quick Start

### For Users

#### Basic Search
1. Open Messages sidebar (click profile icon → Messages)
2. Click the search box at the top
3. Type at least 3 characters
4. Wait ~300ms for results to appear
5. Click any result to open that conversation

#### Using Search History
1. Click the search box (without typing)
2. See your last 5 searches in a dropdown
3. Click any previous search to run it again

#### Clearing Search
- **Option 1**: Click the ❌ button in the search box
- **Option 2**: Press `ESC` key
- **Option 3**: Delete all text manually

---

## 🎯 Search Tips

### What Gets Searched
- ✅ All your message content (sent and received)
- ✅ Only conversations you're part of
- ✅ Case-insensitive (finds "Hello", "hello", "HELLO")

### Best Practices
- **Use 3+ characters**: Shorter searches show a warning
- **Be specific**: "meeting notes" is better than "notes"
- **Check spelling**: No fuzzy matching yet
- **Recent first**: Results ordered by newest first

### Examples

| Search Query | Will Find |
|--------------|-----------|
| `hello` | Any message containing "hello", "Hello", "HELLO" |
| `meeting tomorrow` | Messages with both words (in any order) |
| `project update` | Messages discussing project updates |
| `wallet address` | Messages mentioning wallet addresses |

---

## 🎨 Understanding Results

### Result Card Format

```
[Sender Name] [You]        2 hours ago
This is the message content with the
highlighted search term in context...
```

### What You'll See
- **Sender**: Display name (or wallet address if no name set)
- **"You" Chip**: Appears on your own messages
- **Timestamp**: Relative time (e.g., "2 hours ago")
- **Snippet**: First 100 characters of message
- **Highlights**: Yellow background on matching words

### Result Actions
- **Click result** → Opens conversation
- **Search clears** → Automatically after opening

---

## 📱 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `ESC` | Clear search (if active) or close sidebar |
| `Cmd/Ctrl + M` | Toggle sidebar |

---

## 🔍 Search States

### Loading
```
🔄 Searching messages...
```
*Appears briefly while searching (usually < 500ms)*

### No Results
```
🔍 No messages found for 'your query'
   Try different keywords or check spelling
```
*Shows when no matches found*

### Search Too Short
```
⚠️ Type at least 3 characters to search
```
*Appears below input when 1-2 characters typed*

### Results Found
```
12 results found

[Result 1]
[Result 2]
...
```
*Shows up to 50 matching messages*

---

## 🎯 Common Use Cases

### 1. Finding Past Conversations
**Scenario**: "Where did we discuss that deadline?"

```
1. Search: "deadline"
2. See all messages mentioning deadlines
3. Click the relevant result
4. Continue conversation from there
```

### 2. Looking Up Information
**Scenario**: "What wallet address did they send me?"

```
1. Search: wallet address pattern (e.g., "8kK5")
2. Find message with the address
3. Copy address from message
```

### 3. Following Up
**Scenario**: "Need to respond to that message about..."

```
1. Search: topic keyword
2. Find unread or recent message
3. Open conversation
4. Send reply
```

---

## 💡 Pro Tips

### 1. Use Search History
Don't retype common searches - click from history dropdown!

### 2. Be Specific
More specific = fewer results = easier to find what you want

### 3. Try Variations
If first search doesn't work, try synonyms:
- "mtg" → "meeting"
- "proj" → "project"
- "tmrw" → "tomorrow"

### 4. Combine with Filters
1. Search for topic
2. Look at timestamps to find recent
3. Check "You" chip to find your messages

### 5. Clear Often
Clear search to return to conversation list for easier navigation

---

## 🐛 Troubleshooting

### "No results found"

**Possible Causes:**
- ❌ Word spelled differently in actual message
- ❌ Search term too specific
- ❌ Message was deleted
- ❌ Conversation archived/removed

**Solutions:**
- ✅ Try broader search terms
- ✅ Check spelling variations
- ✅ Try synonyms
- ✅ Look in conversation list manually

### Search Not Working

**Possible Causes:**
- ❌ Less than 3 characters typed
- ❌ No internet connection
- ❌ Database connection issue

**Solutions:**
- ✅ Type at least 3 characters
- ✅ Check internet connection
- ✅ Refresh page
- ✅ Try again in a moment

### Results Won't Open

**Possible Causes:**
- ❌ Conversation was deleted
- ❌ Other user blocked you
- ❌ Temporary connection issue

**Solutions:**
- ✅ Refresh page
- ✅ Check internet connection
- ✅ Try opening from conversation list

---

## 🎓 Advanced Usage

### Search Patterns

While we don't support full search operators yet, you can still use strategic patterns:

**Finding Recent Messages:**
1. Search for unique recent keyword
2. Results ordered by newest first
3. Top results are most recent

**Finding Specific Sender:**
1. Search for unique phrase they used
2. Look at sender name in results
3. Distinguish between multiple matches

**Finding Your Messages:**
1. Search for your typical phrases
2. Look for "You" chip in results
3. Review what you sent

---

## 📊 Limitations (Current Version)

### Not Yet Supported
- ❌ Search by date range
- ❌ Search by sender
- ❌ Search operators (from:, in:, etc.)
- ❌ Fuzzy matching (typo tolerance)
- ❌ Attachment search
- ❌ Scroll to exact message in thread

### Workarounds
- **Date filtering**: Look at timestamps in results
- **Sender filtering**: Check sender name in each result
- **Typo handling**: Try multiple spelling variations

---

## 🔄 Integration with Other Features

### Works With:
✅ **Conversation List**: Returns to list when cleared  
✅ **Unread Filter**: Unread count still shown  
✅ **Message Composer**: Send message after search  
✅ **Profile Settings**: Settings don't affect search  
✅ **Notifications**: Get notified even while searching  

### Independent Of:
✅ **Privacy Settings**: Search always works for your messages  
✅ **Blocked Users**: Won't see messages from blocked users  
✅ **Muted Conversations**: Still searchable  

---

## 📱 Mobile Usage

### Touch Interactions
- **Tap search box** → Shows keyboard and history
- **Tap X button** → Clears search
- **Tap result** → Opens conversation
- **Swipe** → Scroll through results

### Mobile-Specific Tips
1. **Use history**: Faster than typing on mobile
2. **Short queries**: Easier to type, still effective
3. **Landscape mode**: More results visible at once

---

## 🎯 Best Use Cases

### ✅ Perfect For:
- Finding specific information shared in messages
- Looking up past conversations by topic
- Searching for links/addresses/codes
- Following up on mentions
- Reviewing what you sent someone

### ❌ Not Ideal For:
- Browsing (use conversation list instead)
- Finding very recent messages (scroll conversation)
- Searching attachments (not yet supported)
- Vague searches (be specific!)

---

## 📞 Need Help?

### Still Can't Find What You're Looking For?

1. **Try conversation list**: Browse manually
2. **Check conversation**: Open and scroll
3. **Ask sender**: "Did you message me about...?"
4. **Verify message exists**: May have been deleted

### Found a Bug?

If search isn't working as expected:
1. Note what you searched
2. Note what happened vs. what you expected
3. Report to development team
4. Include browser/device info

---

## ✨ Summary

Message search is a powerful tool for finding information quickly. Remember:

1. **Type 3+ characters** for best results
2. **Use search history** to save time
3. **Be specific** for fewer, more relevant results
4. **Click results** to open conversations instantly
5. **Clear search** to return to conversation list

**Happy searching!** 🔍

---

**Version**: 1.0  
**Last Updated**: November 2025  
**Feature Status**: ✅ Production Ready





