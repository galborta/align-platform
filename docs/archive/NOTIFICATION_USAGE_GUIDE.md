# 🔔 Notification System - Quick Usage Guide

## For End Users

### How to Enable Notifications

1. **Navigate to Profile Settings**
   - Click your profile icon in the header
   - Select "Settings"

2. **Go to Notifications Tab**
   - Click the "Notifications" tab (4th tab)

3. **Enable Browser Notifications**
   - Click the "Enable Notifications" button
   - Your browser will ask for permission
   - Click "Allow" in the browser popup

4. **Customize Your Preferences** (optional)
   - Toggle notification sound on/off
   - Choose message preview level:
     - **Full Message**: See sender name and message content
     - **Sender Only**: Only see who sent it
     - **No Preview**: Just "New message"

5. **Test It**
   - Click "Send Test Notification" button
   - You should see a test notification appear

### How Notifications Work

**You'll Get Notified When:**
- ✅ Someone sends you a message
- ✅ You're not currently viewing the chat
- ✅ Notifications are enabled
- ✅ The conversation is not muted

**You Won't Get Notified When:**
- ❌ You send a message yourself
- ❌ You're actively using the app (tab is focused)
- ❌ Notifications are disabled
- ❌ The conversation is muted

### Muting Conversations

To mute a specific conversation (coming soon):
1. Open the conversation
2. Click the menu icon (⋮)
3. Select "Mute notifications"

### Notification Click Behavior

When you click a notification:
- The app window will focus
- The messages sidebar will open
- The notification will close

---

## For Developers

### Quick Integration

The notification system is already integrated in `LayoutClient.tsx`. No additional setup needed!

### Using the Hook Directly

```typescript
import { useMessageNotifications } from '@/lib/notifications'

function MyComponent() {
  const wallet = useWallet()
  
  const {
    permissionStatus,
    isEnabled,
    requestPermission,
    toggleNotifications,
    canShowNotifications
  } = useMessageNotifications(
    wallet.publicKey?.toBase58(),
    (conversationId) => {
      // Handle notification click
      console.log('Clicked notification for:', conversationId)
    }
  )
  
  return (
    <div>
      <p>Status: {permissionStatus}</p>
      <p>Enabled: {isEnabled ? 'Yes' : 'No'}</p>
      {!canShowNotifications && (
        <button onClick={requestPermission}>
          Enable Notifications
        </button>
      )}
    </div>
  )
}
```

### Showing Manual Notifications

```typescript
import { showMessageNotification } from '@/lib/notifications'

// Show a notification
await showMessageNotification(
  message,         // Message object from DB
  senderProfile,   // Sender's profile
  conversationId,  // Conversation ID
  currentWallet,   // Current user's wallet
  () => {
    // Optional: Handle click
    openMessages()
  }
)
```

### Testing

```typescript
import { showTestNotification } from '@/lib/notifications'

// Show a test notification
showTestNotification()
```

### Checking Permissions

```typescript
import { canShowNotifications } from '@/lib/notifications'

if (canShowNotifications()) {
  console.log('Ready to show notifications!')
} else {
  console.log('Permission not granted or not supported')
}
```

---

## Common Issues

### "Notifications are blocked"

**Solution:**
1. Check browser settings (site permissions)
2. Ensure you clicked "Allow" in the permission popup
3. Try in a different browser to test
4. Check if browser supports notifications

### "No sound playing"

**Solution:**
1. Check sound preference is enabled (Settings → Notifications)
2. Ensure browser allows audio autoplay
3. Check system volume is not muted
4. Try test notification to verify

### "Notification not appearing"

**Solution:**
1. Make sure the app tab is not focused (open another tab)
2. Check notification preference is enabled
3. Verify conversation is not muted
4. Check browser permission is granted
5. Try test notification first

---

## Best Practices

### For Better User Experience

1. **Enable notifications** to stay connected
2. **Use "Sender Only" preview** when in public spaces
3. **Mute busy conversations** during focus time
4. **Test notifications** after enabling to ensure they work
5. **Keep browser updated** for best compatibility

### For Privacy

1. Use **"No Preview"** mode for maximum privacy
2. Mute notifications when sharing screen
3. Disable sound in quiet environments
4. Check what's visible in notifications before enabling

---

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Notifications | ✅ | ✅ | ✅ | ✅ |
| Sound | ✅ | ✅ | ✅ | ✅ |
| Click Action | ✅ | ✅ | ✅ | ✅ |
| Page Visibility | ✅ | ✅ | ✅ | ✅ |

**Minimum Versions:**
- Chrome: 22+
- Firefox: 22+
- Safari: 6+
- Edge: All versions

---

## FAQs

### Q: Do notifications work on mobile?
**A:** Yes! Supported on Chrome (Android), Firefox (Android), and Safari (iOS 16.4+).

### Q: Can I customize the notification sound?
**A:** Currently, there's a standard pleasant beep. Custom sounds may be added in the future.

### Q: Do notifications work when the app is closed?
**A:** Currently, no. Notifications only work when the app is open in a background tab. Service Worker implementation for background notifications is planned.

### Q: Are notifications private?
**A:** Yes! You control the preview level. Choose "No Preview" for maximum privacy.

### Q: Can I mute specific conversations?
**A:** Yes! Mute/unmute functionality is available through the conversation settings.

### Q: Do notifications cost anything?
**A:** No! Browser notifications are completely free and use minimal resources.

---

## Support

If you have issues:
1. Check this guide first
2. Try the test notification
3. Check browser console for errors
4. Verify database migration was applied
5. Check that real-time subscriptions are working

---

**Enjoy your new notification system! 🎉**



















