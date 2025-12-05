# Notification Icons

## Required Icons for Browser Notifications

Place these icons in this directory for the notification system to use them:

### 1. message-icon.png
- **Size**: 256x256px
- **Format**: PNG with transparency
- **Purpose**: Main notification icon shown in the notification popup
- **Recommendation**: Use your app logo or a message/chat icon

### 2. badge-icon.png
- **Size**: 96x96px
- **Format**: PNG with transparency
- **Purpose**: Smaller badge icon shown in system tray/notification center
- **Recommendation**: Simplified version of your logo

## Design Guidelines

### Best Practices
- Use high contrast for visibility
- Keep design simple and recognizable
- Test on both light and dark backgrounds
- Ensure transparency is properly set
- Use your brand colors

### Example Tools
- Figma, Sketch, Adobe XD
- Online icon generators
- PNG optimizers (TinyPNG, ImageOptim)

## Fallback Behavior

If these icons are not provided:
- Notifications will use the browser's default icon
- Functionality will still work normally
- Only visual appearance is affected

## Usage in Code

The notification system automatically uses these icons:

```typescript
const notification = new Notification(title, {
  icon: senderProfile?.avatar_url || '/icons/message-icon.png',
  badge: '/icons/badge-icon.png',
  // ... other options
})
```

## Testing

After adding icons:
1. Clear browser cache
2. Go to Profile Settings → Notifications
3. Click "Send Test Notification"
4. Verify icons appear correctly

## Current Status

⚠️ **TODO**: Add these icon files to enable custom notification icons.

Until then, notifications will use:
- Sender's avatar as the icon (if available)
- Browser default icon (if no avatar)












