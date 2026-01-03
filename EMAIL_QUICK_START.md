# ⚡ Email Integration - Quick Start

**5-Minute Setup Guide**

---

## ✅ Step 1: Get Resend API Key

```bash
# 1. Sign up: https://resend.com
# 2. Get API Key: https://resend.com/api-keys
# 3. Copy the key (starts with "re_")
```

---

## ✅ Step 2: Add to .env.local

```bash
# Required Environment Variables
RESEND_API_KEY=re_your_key_here
EMAIL_FROM="Orggly <onboarding@resend.dev>"
ADMIN_EMAIL=your-email@example.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## ✅ Step 3: Test It

```bash
# Start server
npm run dev

# Submit test project
open http://localhost:3000/submit-project

# Check your email (ADMIN_EMAIL)
# Should receive admin notification within 2 minutes
```

---

## 📧 Email Flow

### User Submits Project
- ✅ Admin gets email notification
- ✅ User sees success modal
- ✅ Admin conversation created

### Admin Approves
- ✅ User gets approval email with creation link
- ✅ In-app approval message sent

### Admin Rejects
- ✅ User gets professional rejection email
- ✅ In-app rejection message sent

---

## 🧪 Manual Test Commands

### Test Admin Notification
```bash
curl -X POST http://localhost:3000/api/emails/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "admin_notification",
    "to": "admin@example.com",
    "data": {
      "submitterName": "Test User",
      "submitterEmail": "test@example.com",
      "tokenSymbol": "TEST",
      "tokenName": "Test Token",
      "contractAddress": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      "role": "Founder",
      "submittedAt": "December 14, 2024",
      "conversationUrl": "http://localhost:3000/messages"
    }
  }'
```

### Test Approval Email
```bash
curl -X POST http://localhost:3000/api/emails/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "project_approved",
    "to": "user@example.com",
    "data": {
      "submitterName": "Test User",
      "tokenSymbol": "TEST",
      "tokenName": "Test Token",
      "creationLink": "http://localhost:3000/projects/create?token=test123"
    }
  }'
```

### Test Rejection Email
```bash
curl -X POST http://localhost:3000/api/emails/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "project_rejected",
    "to": "user@example.com",
    "data": {
      "submitterName": "Test User",
      "tokenSymbol": "TEST",
      "tokenName": "Test Token"
    }
  }'
```

---

## 🎨 Preview Emails

```bash
npm run email
# Opens: http://localhost:3000
```

---

## 🚨 Troubleshooting

### Email Not Sending?

**Check API Key:**
```bash
echo $RESEND_API_KEY
```

**Check Server Logs:**
```bash
npm run dev
# Look for: "[Create Submission] Admin email notification sent"
```

**Check Resend Dashboard:**
```bash
open https://resend.com/emails
```

### Email in Spam?
- ✅ Mark as "Not Spam"
- ✅ Check [mail-tester.com](https://www.mail-tester.com)
- ✅ Use verified domain in production

---

## 📚 Full Documentation

- **Setup Guide:** `EMAIL_SETUP_GUIDE.md`
- **Integration Guide:** `emails/EMAIL_INTEGRATION_GUIDE.md`
- **Sprint Summary:** `SPRINT_4_EMAIL_INTEGRATION_COMPLETE.md`
- **Templates:** `emails/README.md`

---

## ✅ Checklist

- [ ] Resend API key added to `.env.local`
- [ ] `EMAIL_FROM` configured
- [ ] `ADMIN_EMAIL` set
- [ ] `NEXT_PUBLIC_APP_URL` set
- [ ] Dev server restarted
- [ ] Test submission sent
- [ ] Email received
- [ ] Email renders correctly
- [ ] Links work

---

## 🎯 Production Setup

### 1. Verify Domain
```bash
# Add domain at: https://resend.com/domains
# Add DNS records (SPF, DKIM, DMARC)
# Wait for verification
```

### 2. Update .env
```bash
RESEND_API_KEY=re_production_key
EMAIL_FROM="Orggly <notifications@orggly.com>"
ADMIN_EMAIL=admin@orggly.com
NEXT_PUBLIC_APP_URL=https://orggly.com
```

### 3. Deploy & Test
```bash
# Deploy to production
# Submit test project
# Verify emails arrive
```

---

**Setup Time:** 5 minutes  
**Sprint:** Email Integration (Sprint 4)  
**Status:** ✅ Ready to Use

---

**Questions?** See full documentation in `EMAIL_SETUP_GUIDE.md`




