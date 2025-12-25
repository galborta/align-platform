# Asset Reviews Integration - Conversation List Implementation

## Problem
Asset Reviews were implemented as a separate section toggle in Messages Sidebar, but should appear as a special conversation item in the conversation list (like Project Submissions), with an "Asset Review" tag.

## Solution Overview
Make Asset Reviews appear in the conversation list as a special item, similar to how Project Submissions work:
- Show at the top of the conversation list
- Display with a yellow/amber "Asset Review" tag
- Show pending count badge
- When clicked, open the Social Asset Feed in thread view

## Required Changes

### 1. **ConversationList.tsx** - Add Asset Reviews Special Item

Add props to accept asset review data:

```typescript
interface ConversationListProps {
  currentWallet: string
  onSelectConversation: (conversationId: string) => void
  filter?: 'all' | 'unread'
  refreshTrigger?: number
  // NEW: Asset Reviews props
  showAssetReviews?: boolean
  pendingAssetsCount?: number
  onAssetReviewsClick?: () => void
}
```

Add special list item at the top (before conversations):

```typescript
<List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
  {/* Asset Reviews Special Item */}
  {showAssetReviews && (
    <ListItem disablePadding>
      <ListItemButton
        onClick={() => onAssetReviewsClick?.()}
        sx={{
          py: 2,
          px: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '&:hover': {
            bgcolor: 'rgba(255, 184, 0, 0.04)'
          }
        }}
      >
        <ListItemAvatar>
          <Avatar sx={{ bgcolor: '#FFB800', color: 'white' }}>
            <RateReviewIcon />
          </Avatar>
        </ListItemAvatar>

        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  color: 'text.primary'
                }}
              >
                Asset Reviews
              </Typography>
              
              <Chip
                label="Asset Review"
                size="small"
                sx={{
                  background: 'linear-gradient(135deg, #FFB800, #FFA000)',
                  color: 'white',
                  borderRadius: '20px',
                  height: '22px',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.3px',
                  padding: '0 4px',
                  flexShrink: 0,
                  '& .MuiChip-label': {
                    padding: '0 8px',
                    lineHeight: '22px'
                  },
                  animation: pendingAssetsCount > 0 ? `${pulseAnimation} 2s ease-in-out infinite` : 'none'
                }}
              />

              {pendingAssetsCount > 0 && (
                <Badge
                  badgeContent={pendingAssetsCount > 99 ? '99+' : pendingAssetsCount}
                  sx={{
                    ml: 'auto',
                    '& .MuiBadge-badge': {
                      bgcolor: '#FFB800',
                      color: 'white',
                      fontWeight: 700
                    }
                  }}
                />
              )}
            </Box>
          }
          secondary={
            <Typography variant="body2" color="text.secondary">
              Review pending social assets
            </Typography>
          }
        />
      </ListItemButton>
    </ListItem>
  )}

  {/* Regular Conversations */}
  {filteredConversations.map((conv) => (
    // ... existing conversation list items
  ))}
</List>
```

### 2. **MessagesSidebar.tsx** - Remove Section Toggle, Add Asset Reviews Handler

Remove the section toggle buttons and simplify:

```typescript
// Remove activeSection state
const [showingAssetReviews, setShowingAssetReviews] = useState(false)

// Add handler for Asset Reviews click
const handleAssetReviewsClick = useCallback(() => {
  setView('thread')
  setShowingAssetReviews(true)
  setSelectedConversationId(null)
  setRecipientWallet('')
}, [])

// Update handleBackToList to reset asset reviews
const handleBackToList = () => {
  setView('list')
  setSelectedConversationId(null)
  setRecipientWallet('')
  setSearchQuery('')
  setSearchResults([])
  setShowingAssetReviews(false)  // NEW: Reset asset reviews
}

// Update handleSelectConversation to reset asset reviews
const handleSelectConversation = async (conversationId: string) => {
  // ... existing code
  setShowingAssetReviews(false)  // NEW: Reset when selecting regular conversation
  // ...
}
```

Remove the entire section toggle UI and replace with:

```typescript
{/* List View */}
{view === 'list' && !isLoadingThread && (
  <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
    {/* Search Bar */}
    <Box sx={{ p: 2, position: 'relative' }}>
      {/* ... existing search bar ... */}
    </Box>

    {/* Tabs for filtering */}
    <Box sx={{ px: 2, pb: 1 }}>
      <Tabs value={filterTab} onChange={(_, v) => setFilterTab(v)} centered>
        <Tab value="all" label="All" />
        <Tab value="unread" label="Unread" icon={<Badge badgeContent={unreadCount} color="error" />} />
      </Tabs>
    </Box>

    {/* Conversation List with Asset Reviews */}
    <Box sx={{ flex: 1, overflow: 'auto' }}>
      {currentWallet ? (
        <ConversationList
          currentWallet={currentWallet}
          onSelectConversation={handleSelectConversation}
          filter={filterTab}
          refreshTrigger={refreshTrigger}
          showAssetReviews={isCreatorOrEditor || isGlobalAdmin}
          pendingAssetsCount={pendingAssetsCount}
          onAssetReviewsClick={handleAssetReviewsClick}
        />
      ) : (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Connect your wallet to view messages
          </Typography>
        </Box>
      )}
    </Box>
  </Box>
)}
```

### 3. **MessagesSidebar.tsx** - Thread View for Asset Reviews

Update the thread view to handle asset reviews:

```typescript
{/* Thread View */}
{view === 'thread' && (
  <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    {/* Header */}
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      p: 2,
      borderBottom: '1px solid',
      borderColor: 'divider'
    }}>
      <IconButton onClick={handleBackToList} size="small">
        <ArrowBackIcon />
      </IconButton>

      <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
        {showingAssetReviews ? (
          <>
            Asset Reviews
            {isGlobalAdmin && !projectId && (
              <Chip 
                label="Global Admin" 
                size="small" 
                sx={{ ml: 1, bgcolor: '#FFB800', color: 'white', fontWeight: 600 }}
              />
            )}
          </>
        ) : (
          'Messages'
        )}
      </Typography>

      <IconButton onClick={onClose} size="small">
        <CloseIcon />
      </IconButton>
    </Box>

    {/* Content */}
    <Box sx={{ flex: 1, overflow: 'hidden' }}>
      {showingAssetReviews ? (
        // Social Asset Feed
        <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {isGlobalAdmin && !projectId
              ? 'Review all community-submitted social accounts and domains across all projects'
              : 'Review community-submitted social accounts and domains for your project'
            }
          </Typography>
          <SocialAssetFeed
            projectId={projectId || 'all'}
            editorWallet={currentWallet}
          />
        </Box>
      ) : (
        // Regular Message Thread
        selectedConversationId && (
          <MessageThread
            conversationId={selectedConversationId}
            currentWallet={currentWallet}
            recipientWallet={recipientWallet}
            onRefreshList={() => setRefreshTrigger(prev => prev + 1)}
          />
        )
      )}
    </Box>
  </Box>
)}
```

## Visual Result

The Messages Sidebar will now show:

```
┌─────────────────────────────────────────┐
│  Messages                         [x]   │
├─────────────────────────────────────────┤
│  🔍 Search messages...                  │
├─────────────────────────────────────────┤
│       All  |  Unread                    │
├─────────────────────────────────────────┤
│  [⭐] Asset Reviews                     │
│       [Asset Review] • 3                │
│       Review pending social assets      │
├─────────────────────────────────────────┤
│  [📋] Project Submission                │
│       [Project Submission]              │
│       Foo Token - Admin Conversation    │
├─────────────────────────────────────────┤
│  [👤] alice.sol                         │
│       Hey, how's it going?              │
│       2m ago                             │
├─────────────────────────────────────────┤
│  ... more conversations ...             │
└─────────────────────────────────────────┘
```

## Benefits

1. ✅ Consistent with Project Submissions UI pattern
2. ✅ Asset Reviews appear in the main conversation flow
3. ✅ Clear visual distinction with yellow/amber tag
4. ✅ Pending count badge shows urgency
5. ✅ No confusing section toggles
6. ✅ Global admins see all projects' assets
7. ✅ Project editors see only their project's assets

## Status

⚠️ **NOT YET IMPLEMENTED** - This document describes the required changes.

To implement, apply the changes above to:
- `components/ConversationList.tsx`
- `components/MessagesSidebar.tsx`

