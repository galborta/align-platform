# Social Asset Review - Quick Start Guide

## 📖 Overview

The Social Asset Review system allows project creators and editors to review community-submitted social media accounts and domains directly from the Messages sidebar. This guide covers how to use the feature.

---

## 🚀 Getting Started

### For Project Creators/Editors:

1. **Navigate to your project page:**
   ```
   https://align.app/project/[your-project-id]
   ```

2. **Open the Messages sidebar:**
   - Click the Messages icon in the header
   - Or press the keyboard shortcut (if configured)

3. **Switch to Asset Reviews:**
   - You'll see two buttons at the top:
     - **Messages** (Purple) - Regular direct messages
     - **Asset Reviews** (Yellow) - Social asset submissions
   - Click "Asset Reviews" to view pending submissions
   - The yellow badge shows how many assets are awaiting review

---

## 🎯 Reviewing Assets

### Feed Layout:

Each asset submission displays:
- **Platform Icon** - Twitter, Instagram, TikTok, YouTube, or Domain
- **Handle/Domain** - The submitted asset identifier
- **Classification Badge** - "official" (purple) or "affiliated" (yellow)
- **Submitter Info** - Wallet address with token percentage
- **Submission Time** - Relative timestamp ("2 hours ago")
- **Action Buttons** - Approve, Reject, Ban User (in more menu)

### Asset Details:

- **Platform** - Social media platform or "Domain"
- **Follower Tier** - For social assets (e.g., "10k-50k")
- **Submitter Wallet** - With copy, message, and tip buttons
- **Token Percentage** - Submitter's holding percentage

---

## ✅ Approving Assets

### Steps:

1. Review the asset details
2. Click the green **"Approve"** button
3. Wait for confirmation toast

### What Happens:

- Asset is moved to the project's verified assets
- Submitter receives **75% karma reward** (3x the 25% they got on submission)
- Submitter gets a notification of approval
- Asset appears on the public project page
- Action is logged in admin logs

### Toast Message:
```
"Asset approved! Submitter earned X.X karma"
```

---

## ❌ Rejecting Assets

### Steps:

1. Click the red **"Reject"** button
2. A dialog opens asking for an optional reason
3. Enter a reason (recommended) explaining why the asset is being rejected
4. Click **"Reject Asset"**

### What Happens:

- Asset status changes to "rejected"
- Asset remains in the feed but visually marked as rejected
- Submitter gets a notification with your reason
- No karma is awarded
- Action is logged in admin logs

### Rejection Reasons (Examples):

- "Account doesn't match project branding"
- "Follower count doesn't meet requirements"
- "Domain is not controlled by the project"
- "Duplicate submission"
- "Suspicious or fake account"

---

## 🚫 Banning Users

Use this for repeat offenders or spam submissions.

### Steps:

1. Click the **three dots menu** (⋮) on a feed item
2. Select **"Ban User"**
3. Choose ban duration:
   - 7 days
   - 30 days
   - 90 days
   - Permanent
4. Enter a ban reason (required)
5. Click **"Ban User"**

### What Happens:

- User is banned from submitting assets for the selected duration
- All their pending assets for this project are hidden
- User gets a notification of the ban
- Action is logged in admin logs
- Toast shows: "User banned. X pending assets hidden"

### When to Ban:

- **7 days**: First offense, minor issue
- **30 days**: Repeat offender, multiple bad submissions
- **90 days**: Severe violations, intentional spam
- **Permanent**: Malicious activity, coordinated spam

---

## 📊 Feed Features

### Real-Time Updates:

- New submissions appear instantly (no refresh needed)
- Approved/rejected items update in real-time
- Badge counter updates automatically
- Multiple editors see the same changes

### Status Indicators:

- **Pending** - No special styling, full opacity
- **Approved** - Green tint background, 70% opacity
- **Rejected** - Red tint background, 70% opacity, shows rejection reason

### Hover Effects:

- Pending items show yellow border on hover
- Approved/rejected items have no hover effect
- Click and action states are visually distinct

### Pagination:

- Feed loads 20 items at a time
- "Load More" button at bottom
- "No more submissions to review" when at the end

---

## 🎨 Visual Guide

### Colors:

- **Purple (#7C4DFF)**: Official classification, Messages section
- **Yellow (#FFB800)**: Affiliated classification, Asset Reviews section
- **Green (#36C170)**: Approve button, success states
- **Red (#EF4444)**: Reject button, error states

### Badge Counter:

- **White on colored background** when section is active
- **Colored on white background** when section is inactive
- Shows "99+" when count exceeds 99
- Updates in real-time

---

## 📱 Mobile Usage

### Optimizations:

- Full-width sidebar on mobile
- Section buttons stack if needed
- Action buttons stack vertically on small screens
- Touch-friendly targets (minimum 40px)
- Dialogs are mobile-optimized
- Smooth scrolling and interactions

### Tips:

- Rotate to landscape for better view
- Use "Pull to refresh" (if available)
- Tap badge to jump to that section

---

## 🔔 Notifications

### You'll receive notifications when:

- A community member submits a new asset
- An asset you're reviewing gets upvoted heavily
- Another editor approves/rejects an asset

### Community members receive notifications when:

- Their asset is approved (with karma amount)
- Their asset is rejected (with reason)
- They are banned from submitting assets

---

## 💡 Best Practices

### Review Guidelines:

1. **Verify Authenticity:**
   - Check if the account/domain actually belongs to the project
   - Look for verification badges on social platforms
   - Verify follower count matches the tier

2. **Check Classification:**
   - **Official**: Direct project accounts (main Twitter, main Instagram)
   - **Affiliated**: Team member accounts, partner accounts, fan accounts

3. **Consider Token Percentage:**
   - Higher holders have more incentive for accuracy
   - But don't auto-approve based on percentage alone

4. **Provide Reasons:**
   - Always provide rejection reasons
   - Helps submitters improve future submissions
   - Builds trust in the review process

5. **Use Bans Sparingly:**
   - Give warnings first (via rejection reasons)
   - Use temporary bans for education
   - Reserve permanent bans for malicious activity

### Review Speed:

- Try to review within 24-48 hours
- Faster reviews encourage quality submissions
- Set a regular review schedule (e.g., daily at 2pm)

---

## 🛠️ Troubleshooting

### "Asset Reviews" button doesn't appear:

- Make sure you're on a project page (`/project/[id]`)
- Verify you're logged in with the creator or editor wallet
- Check that the project has you listed as a creator or editor
- Refresh the page and reopen the sidebar

### Badge counter stuck at 0:

- Check if pending assets exist in the database
- Verify your wallet has creator/editor permissions
- Try refreshing the page
- Check browser console for errors

### Actions not working:

- Ensure you're connected with the correct wallet
- Verify the project exists and you have permissions
- Check network connection
- Look for error toasts or console messages
- Try refreshing and retrying

### Real-time updates not appearing:

- Check if Supabase Realtime is enabled for your project
- Verify browser supports WebSockets
- Check if firewall is blocking connections
- Try refreshing the page

---

## 🔐 Security Notes

### Permission Checks:

- Only project creators and editors see the review feed
- API endpoints validate permissions server-side
- Client-side checks are for UX only
- All actions are logged in admin logs

### Data Privacy:

- Wallet addresses are publicly visible (blockchain data)
- Rejection reasons are sent to submitters
- Ban reasons are logged but not shown to banned users
- All actions are auditable via admin logs

---

## 📈 Success Metrics

### Track your review performance:

- **Approval Rate** - Percentage of assets approved vs rejected
- **Average Review Time** - Time from submission to decision
- **Community Karma** - Total karma distributed via approvals
- **Asset Quality** - Upvotes on approved assets

### Healthy Ranges:

- **Approval Rate**: 60-80% (shows quality submissions)
- **Review Time**: <24 hours (keeps community engaged)
- **Rejection Reasons**: 100% provided (builds trust)
- **Bans**: <5% of submitters (shows healthy community)

---

## 🎓 FAQ

**Q: Can I edit an asset after approving it?**  
A: No, but you can delete it from the Verified Assets section and ask for resubmission.

**Q: Can a rejected asset be resubmitted?**  
A: Yes, the submitter can submit again with corrections.

**Q: How do I appeal a ban?**  
A: Banned users should contact the project creator directly.

**Q: Can I delegate review permissions?**  
A: Yes, add editors via the project settings.

**Q: What happens to assets when an editor is removed?**  
A: Their approvals remain valid, but they lose future review access.

**Q: Can I see a history of my review actions?**  
A: Yes, check the admin logs in the project dashboard.

---

## 📞 Support

### Need Help?

- **Documentation**: See `SOCIAL_ASSET_REVIEW_SYSTEM_OVERVIEW.md`
- **API Reference**: See `QUICK_START_SOCIAL_ASSETS.md`
- **Discord**: #asset-review channel
- **Email**: support@align.app

### Report Issues:

- **Bug Reports**: GitHub Issues
- **Feature Requests**: Discord #suggestions
- **Security Issues**: security@align.app

---

## 🎉 You're Ready!

You now know how to:
- ✅ Access the Social Asset Review feed
- ✅ Approve assets and reward submitters
- ✅ Reject assets with helpful feedback
- ✅ Ban problematic users when necessary
- ✅ Use mobile and desktop interfaces
- ✅ Follow best practices for fair reviews

Happy reviewing! 🚀

---

**Last Updated:** December 22, 2025  
**Version:** 1.0.0  
**Applies To:** Align Platform v2.x

