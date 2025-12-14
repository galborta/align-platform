# Email Setup Guide - Orggly

Quick guide to configure email sending for the Orggly project submission system.

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Get Resend API Key

1. **Sign up** at [resend.com](https://resend.com)
2. **Create API Key:**
   - Go to [resend.com/api-keys](https://resend.com/api-keys)
   - Click "Create API Key"
   - Name it "Orggly Production" or "Orggly Dev"
   - Copy the key (starts with `re_`)

### Step 2: Add Environment Variables

Add these to your `.env.local` file:

```bash
# ==================== EMAIL CONFIGURATION ====================

# Resend API Key (required)
RESEND_API_KEY=re_your_key_here

# Email From Address (required)
# Development: Use Resend's test domain
EMAIL_FROM="Orggly <onboarding@resend.dev>"

# Admin Email (required)
# This email receives notifications for new submissions
ADMIN_EMAIL=your-email@example.com

# App URL (required)
# Development
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Production
# NEXT_PUBLIC_APP_URL=https://orggly.com
```

### Step 3: Test It

```bash
# 1. Start dev server
npm run dev

# 2. Submit a test project at:
http://localhost:3000/submit-project

# 3. Check your email inbox (ADMIN_EMAIL)
# You should receive an admin notification within 1-2 minutes
```

---

## 🌍 Production Setup

### Prerequisites
- Verified domain in Resend
- Production API key

### Step 1: Verify Your Domain

1. **Add Domain** in Resend:
   - Go to [resend.com/domains](https://resend.com/domains)
   - Click "Add Domain"
   - Enter `orggly.com`

2. **Add DNS Records:**
   - Add the SPF, DKIM, and DMARC records to your DNS provider
   - Wait for verification (usually 5-10 minutes)

3. **Verify Status:**
   - Check that domain shows "Verified" in dashboard

### Step 2: Update Environment Variables

Update your production `.env` (or deployment platform config):

```bash
# Production Email Configuration
RESEND_API_KEY=re_your_production_key
EMAIL_FROM="Orggly <notifications@orggly.com>"
ADMIN_EMAIL=admin@orggly.com
NEXT_PUBLIC_APP_URL=https://orggly.com
```

### Step 3: Deploy & Test

1. Deploy your application
2. Submit a test project
3. Verify emails arrive
4. Check Resend dashboard for delivery status

---

## 📧 Email Types

### 1. Admin Notification
**When:** User submits new project  
**To:** `ADMIN_EMAIL`  
**Subject:** `New Project Submission: {TOKEN}`

**Test:**
```bash
curl -X POST http://localhost:3000/api/emails/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "admin_notification",
    "to": "admin@example.com",
    "data": {
      "submitterName": "John Doe",
      "submitterEmail": "john@example.com",
      "tokenSymbol": "TEST",
      "tokenName": "Test Token",
      "contractAddress": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      "role": "Founder",
      "message": "Please add our project",
      "submittedAt": "December 14, 2024",
      "conversationUrl": "http://localhost:3000/messages"
    }
  }'
```

### 2. Project Approved
**When:** Admin approves submission  
**To:** Submitter's email  
**Subject:** `🎉 Your project {TOKEN} has been approved!`

**Test:**
```bash
curl -X POST http://localhost:3000/api/emails/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "project_approved",
    "to": "user@example.com",
    "data": {
      "submitterName": "John Doe",
      "tokenSymbol": "TEST",
      "tokenName": "Test Token",
      "creationLink": "http://localhost:3000/projects/create?token=test123"
    }
  }'
```

### 3. Project Rejected
**When:** Admin rejects submission  
**To:** Submitter's email  
**Subject:** `Update on your Orggly submission`

**Test:**
```bash
curl -X POST http://localhost:3000/api/emails/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "project_rejected",
    "to": "user@example.com",
    "data": {
      "submitterName": "John Doe",
      "tokenSymbol": "TEST",
      "tokenName": "Test Token"
    }
  }'
```

---

## 🎨 Preview Emails

Preview all email templates locally:

```bash
# Start email dev server
npm run email

# Open browser
open http://localhost:3000
```

This shows all email templates with hot reload for development.

---

## 🚨 Troubleshooting

### Email Not Sending

**Check 1: API Key**
```bash
echo $RESEND_API_KEY
# Should output: re_xxxxx...
```

**Check 2: Server Logs**
Look for these logs:
- ✅ `[Create Submission] Admin email notification sent`
- ✅ `[Approve Submission] Approval email sent`
- ✅ `[Reject Submission] Rejection email sent`

**Check 3: Resend Dashboard**
- Visit [resend.com/emails](https://resend.com/emails)
- Look for sent emails
- Check delivery status
- Review any error messages

### Email in Spam

**Common Fixes:**
1. Use verified domain (not test domain)
2. Add SPF/DKIM/DMARC records
3. Avoid spam trigger words
4. Test at [mail-tester.com](https://www.mail-tester.com)

### Wrong Email Address

**Update Environment Variable:**
```bash
# Edit .env.local
ADMIN_EMAIL=correct-email@example.com

# Restart dev server
npm run dev
```

---

## 📊 Rate Limits

### Resend Free Tier
- 100 emails/day
- 3,000 emails/month
- No credit card required

### Resend Pro Tier
- 50,000 emails/month
- $20/month
- Volume discounts available

**Check Usage:**
- Dashboard: [resend.com/overview](https://resend.com/overview)

---

## 🔐 Security

### API Key Protection

✅ **DO:**
- Store in environment variables
- Use different keys for dev/prod
- Rotate keys every 90 days
- Restrict API key permissions

❌ **DON'T:**
- Commit keys to git
- Share keys in Slack/email
- Use same key across environments
- Log keys in console

### Email Content

✅ **DO:**
- Use HTTPS links only
- Validate email addresses
- Sanitize user input
- Include unsubscribe link

❌ **DON'T:**
- Include passwords
- Include API keys
- Include sensitive data
- Use insecure links

---

## 📚 Additional Resources

- **Resend Docs:** [resend.com/docs](https://resend.com/docs)
- **React Email Docs:** [react.email/docs](https://react.email/docs)
- **Email Testing:** [litmus.com](https://litmus.com)
- **Spam Check:** [mail-tester.com](https://www.mail-tester.com)

---

## ✅ Setup Checklist

- [ ] Resend account created
- [ ] API key generated
- [ ] `RESEND_API_KEY` added to `.env.local`
- [ ] `EMAIL_FROM` configured
- [ ] `ADMIN_EMAIL` set to your email
- [ ] `NEXT_PUBLIC_APP_URL` set correctly
- [ ] Test submission sent
- [ ] Admin notification received
- [ ] Email renders correctly
- [ ] Links work properly
- [ ] Not in spam folder

---

## 💡 Tips

1. **Use Real Email:** Always test with your real email address first
2. **Check Spam:** First emails often go to spam, mark as "Not Spam"
3. **Monitor Dashboard:** Check Resend dashboard for delivery issues
4. **Test All Flows:** Test submission, approval, and rejection
5. **Mobile Test:** Check emails on mobile devices

---

**Need Help?**
- Resend Support: [resend.com/support](https://resend.com/support)
- Orggly Docs: See `EMAIL_INTEGRATION_GUIDE.md`

---

**Setup Time:** ~5 minutes  
**Last Updated:** December 14, 2024  
**Sprint:** Email Integration (Sprint 4)
