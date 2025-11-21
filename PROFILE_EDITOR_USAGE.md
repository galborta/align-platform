# Project Profile Editor - Quick Usage Guide

## How to Access
1. Navigate to Admin Dashboard: `/admin`
2. Click "Moderate" button on any project
3. Click the "Project Profile" tab

## Quick Actions Guide

### 📝 Editing Basic Info
1. Click on any field to edit
2. Token Name, Symbol, Creator, Status are all editable
3. Mint Address and dates are read-only
4. Changes show in "Modified fields" chips

### 🖼️ Changing Profile Image

**Option 1: Upload File**
```
1. Click "📤 Upload New File"
2. Select image (JPG, PNG, GIF, WebP)
3. Preview appears instantly
4. Click "💾 Save All Changes" to upload
```

**Option 2: Use URL**
```
1. Click "🔗 Enter URL"
2. Paste image URL in text field
3. Preview updates live
4. Click "💾 Save All Changes"
```

**Option 3: Remove**
```
1. Click "🗑️ Remove Image"
2. Confirm dialog
3. Resets to token symbol placeholder
4. Click "💾 Save All Changes"
```

### ✍️ Editing Description
1. Type in large textarea (supports markdown)
2. Character count shown below
3. Click "Preview" to see formatted version
4. Click "Clear" to empty (requires confirmation)

### 🔗 Adding Social Links
Fill in optional fields:
- Website URL
- Twitter handle (@username)
- Discord invite link
- Telegram group link

### 🔧 Custom Metadata (Advanced)
1. Enter valid JSON in the metadata editor
2. Must be properly formatted
3. Useful for custom data not in main fields

### 💾 Saving Changes
1. Make any edits
2. Yellow warning appears: "⚠️ Unsaved Changes"
3. Review changed fields (shown as chips)
4. Click "💾 Save All Changes" button
5. Wait for success toast
6. Warning disappears when saved

### 🔄 Discarding Changes
1. Click "Discard Changes" button
2. Confirm in dialog
3. Form resets to last saved state

### ⚠️ Danger Zone Actions

**Reset to Default Image:**
- Removes custom image
- Shows token symbol letter
- Requires confirmation

**Clear All Profile Data:**
- Clears: description, image, social links, metadata
- Keeps: name, symbol, mint, creator
- Requires confirmation
- Must save to apply

## Tips & Tricks

### ✅ Best Practices
- Save frequently to avoid losing work
- Use Preview for description before saving
- Test image URLs before saving (preview shows if broken)
- Keep metadata as valid JSON

### ⚠️ Common Mistakes
- ❌ Don't navigate away without saving (browser warns you)
- ❌ Don't upload huge images (5MB max)
- ❌ Don't enter invalid JSON in metadata
- ❌ Don't forget to click Save after selecting file

### 🔍 Troubleshooting

**Image not loading?**
- Check URL is public and accessible
- Verify image file type is supported
- Check file size is under 5MB
- Look for error in preview area

**Changes not saving?**
- Check for error toast notification
- Verify you have admin permissions
- Check browser console for errors
- Try refreshing page and re-editing

**Unsaved changes warning won't go away?**
- Make sure you clicked "Save All Changes"
- Check for error toast
- Try "Discard Changes" and re-edit
- Refresh page (you'll lose changes)

## Keyboard Shortcuts

Currently none implemented, but could add:
- `Ctrl/Cmd + S` - Save changes
- `Ctrl/Cmd + Z` - Discard changes
- `Ctrl/Cmd + P` - Preview description

## Field Limits

- **Token Name**: No limit (recommended < 50 chars)
- **Token Symbol**: No limit (recommended 2-10 chars)
- **Description**: No limit (character count shown)
- **Image File**: 5 MB max
- **Image Dimensions**: 400x400 minimum recommended
- **URLs**: No limit (must be valid URLs)
- **Metadata**: No limit (must be valid JSON)

## Visual Indicators

| Indicator | Meaning |
|-----------|---------|
| Yellow warning banner | You have unsaved changes |
| Orange chips | Fields that were modified |
| Purple "Save" button | Ready to save |
| Gray "Save" button | Nothing to save |
| Spinning circle | Saving in progress |
| Green checkmark | All changes saved |
| Red border | Invalid input |
| Blue info box | Helpful information |

## Example Workflow

### Scenario: New Project Setup
```
1. Load project page (just created)
2. Go to Profile tab
3. Upload logo image
4. Write description
5. Add website URL
6. Add Twitter handle
7. Review changes (4 fields modified)
8. Click Save
9. Wait for success toast
10. Done! ✅
```

### Scenario: Quick Status Change
```
1. Load project page
2. Go to Profile tab
3. Change Status dropdown: Pending → Live
4. Click Save
5. Done! ✅
```

### Scenario: Brand Refresh
```
1. Load project page
2. Go to Profile tab
3. Click "Upload New File"
4. Select new logo
5. Edit description
6. Update social links
7. Review 4 changed fields
8. Click Save
9. Wait for upload + save
10. Done! ✅
```

## Need Help?

- Check browser console for errors
- Verify admin permissions
- Try refreshing the page
- Check network connection
- Verify Supabase Storage is configured
- Contact development team if issues persist

---

**Remember:** Always click "💾 Save All Changes" after editing!

