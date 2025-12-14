# Email Integration Guide - Orggly Project Submission System

**Sprint 4**: Email Integration with Resend & React Email  
**Status**: Implementation Complete  
**Date**: December 14, 2024

---

## 📋 Overview

This guide covers the complete email integration for the Orggly project submission system. All email templates are built with React Email components and sent via the Resend API.

---

## 🗂️ File Structure

```
align-platform/
├── emails/
│   ├── components/
│   │   ├── EmailLayout.tsx          # Base layout wrapper
│   │   └── EmailButton.tsx          # CTA button component
│   ├── templates/
│   │   ├── AdminNotification.tsx    # Admin alert for new submissions
│   │   ├── ProjectApproved.tsx      # Approval email with creation link
│   │   └── ProjectRejected.tsx      # Professional rejection email
│   └── README.md                    # Email templates documentation
│
├── app/api/emails/send/
│   └── route.ts                     # Centralized email API endpoint
│
└── lib/
    └── email-service.ts             # Helper functions for sending emails
```

---

## ⚙️ Environment Variables

Add these to your `.env.local` file:

```bash
# Resend API Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx

# Email From Address
EMAIL_FROM="Orggly <notifications@orggly.com>"

# Admin Email Addresses (comma-separated)
ADMIN_EMAILS="admin@orggly.com,team@orggly.com"

# App URL (for email links)
NEXT_PUBLIC_APP_URL=https://orggly.com
```

### Getting Your Resend API Key

1. Sign up at [resend.com](https://resend.com)
2. Verify your domain (or use Resend's test domain for development)
3. Create an API key in the dashboard
4. Copy the key to `RESEND_API_KEY` in `.env.local`

**Development:** You can use Resend's test mode with `onboarding@resend.dev` as the from address.

---

## 📧 Email Templates

### 1. Admin Notification
**File:** `emails/templates/AdminNotification.tsx`  
**Trigger:** User submits new project  
**Recipient:** All admin emails  
**Subject:** `New Project Submission: {TOKEN_SYMBOL}`

**Required Data:**
```typescript
{
  submitterName: string;
  submitterEmail: string;
  tokenSymbol: string;
  tokenName: string;
  contractAddress: string;
  role: string;
  message?: string;
  submittedAt: string;  // Formatted date
  conversationUrl: string;  // Link to /messages
}
```

### 2. Project Approved
**File:** `emails/templates/ProjectApproved.tsx`  
**Trigger:** Admin approves submission  
**Recipient:** Submitter email  
**Subject:** `🎉 Your project {TOKEN_SYMBOL} has been approved!`

**Required Data:**
```typescript
{
  submitterName: string;
  tokenSymbol: string;
  tokenName: string;
  creationLink: string;  // Full URL with token
}
```

### 3. Project Rejected
**File:** `emails/templates/ProjectRejected.tsx`  
**Trigger:** Admin rejects submission  
**Recipient:** Submitter email  
**Subject:** `Update on your Orggly submission`

**Required Data:**
```typescript
{
  submitterName: string;
  tokenSymbol: string;
  tokenName: string;
}
```

---

## 🔌 API Integration

### Centralized Email API

**Endpoint:** `POST /api/emails/send`

**Request Body:**
```json
{
  "type": "admin_notification" | "project_approved" | "project_rejected",
  "to": "email@example.com" | ["email1@example.com", "email2@example.com"],
  "data": {
    // Template-specific data
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "messageId": "msg_xxxxxxxxxx"
}
```

**Error Response (400/500):**
```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

---

## 💻 Usage Examples

### Option 1: Direct API Call (Server-Side)

```typescript
// In any API route
const response = await fetch('/api/emails/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'project_approved',
    to: 'user@example.com',
    data: {
      submitterName: 'John Doe',
      tokenSymbol: 'TEST',
      tokenName: 'Test Token',
      creationLink: 'https://orggly.com/projects/create?token=abc123'
    }
  })
});

const result = await response.json();
console.log('Email sent:', result.messageId);
```

### Option 2: Using Email Service Helpers (Recommended)

```typescript
import { sendProjectApproval, sendProjectRejection, sendAdminNotification } from '@/lib/email-service';

// Send approval email
const approvalResult = await sendProjectApproval('user@example.com', {
  submitterName: 'John Doe',
  tokenSymbol: 'TEST',
  tokenName: 'Test Token',
  creationLink: 'https://orggly.com/projects/create?token=abc123'
});

if (approvalResult.success) {
  console.log('Approval email sent:', approvalResult.messageId);
} else {
  console.error('Failed to send email:', approvalResult.error);
}

// Send rejection email
const rejectionResult = await sendProjectRejection('user@example.com', {
  submitterName: 'John Doe',
  tokenSymbol: 'TEST',
  tokenName: 'Test Token'
});

// Send admin notification
const adminResult = await sendAdminNotification(
  ['admin1@orggly.com', 'admin2@orggly.com'],
  {
    submitterName: 'John Doe',
    submitterEmail: 'john@example.com',
    tokenSymbol: 'TEST',
    tokenName: 'Test Token',
    contractAddress: 'TokenkegQfeZy...',
    role: 'Founder',
    message: 'Please add our project',
    submittedAt: 'December 14, 2024 at 1:00 PM',
    conversationUrl: 'https://orggly.com/messages'
  }
);
```

---

## 🔗 Integration Points

### 1. Submission Creation
**File:** `app/api/submissions/create/route.ts`

**Add after creating submission:**
```typescript
import { sendAdminNotification } from '@/lib/email-service';

// After successful submission creation
const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];

await sendAdminNotification(adminEmails, {
  submitterName: trimmedName,
  submitterEmail: trimmedEmail,
  tokenSymbol,
  tokenName,
  contractAddress: trimmedAddress,
  role,
  message: message?.trim() || undefined,
  submittedAt: new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short'
  }),
  conversationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/messages`
});
```

### 2. Project Approval
**File:** `app/api/admin/submissions/approve/route.ts`

**Add after approval:**
```typescript
import { sendProjectApproval } from '@/lib/email-service';

// After creating token and updating status
await sendProjectApproval(submission.email, {
  submitterName: submission.name,
  tokenSymbol: submission.token_symbol,
  tokenName: submission.token_name,
  creationLink
});
```

### 3. Project Rejection
**File:** `app/api/admin/submissions/reject/route.ts`

**Add after rejection:**
```typescript
import { sendProjectRejection } from '@/lib/email-service';

// After updating status to rejected
await sendProjectRejection(submission.email, {
  submitterName: submission.name,
  tokenSymbol: submission.token_symbol,
  tokenName: submission.token_name
});
```

---

## 🧪 Testing

### Local Development Preview

```bash
# Start email dev server
npm run email

# Open browser to preview all templates
# Visit: http://localhost:3000
```

### Send Test Email

```bash
curl -X POST http://localhost:3000/api/emails/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "project_approved",
    "to": "test@example.com",
    "data": {
      "submitterName": "Test User",
      "tokenSymbol": "TEST",
      "tokenName": "Test Token",
      "creationLink": "https://orggly.com/projects/create?token=abc123"
    }
  }'
```

### Testing Checklist

- [ ] Resend API key configured
- [ ] Email FROM address verified (or using test domain)
- [ ] Admin emails configured
- [ ] Test admin notification email
- [ ] Test approval email (check creation link)
- [ ] Test rejection email
- [ ] Check emails in Gmail, Outlook, Apple Mail
- [ ] Verify mobile rendering
- [ ] Test with real submission flow

---

## 🎨 Customizing Email Templates

All templates use the Orggly design system. To customize:

### Colors
Edit inline styles in template files:
```typescript
const myStyle = {
  backgroundColor: '#7C4DFF',  // var(--accent-primary)
  color: '#FFFFFF',
  // ...
};
```

### Layout
Edit `emails/components/EmailLayout.tsx` to change:
- Logo/header
- Footer text
- Container styling
- Background colors

### Buttons
Edit `emails/components/EmailButton.tsx` to change:
- Button colors
- Border radius
- Padding/sizing

---

## 🚨 Troubleshooting

### Email Not Sending

1. **Check API Key:**
   ```bash
   echo $RESEND_API_KEY
   ```

2. **Check Server Logs:**
   ```bash
   # Look for "[Email Service]" and "Resend error:" logs
   npm run dev
   ```

3. **Verify Domain:**
   - Production: Domain must be verified in Resend dashboard
   - Development: Use `onboarding@resend.dev`

4. **Check Rate Limits:**
   - Free tier: 100 emails/day
   - Check Resend dashboard for usage

### Template Rendering Issues

1. **Import Errors:**
   - Verify all `@react-email/components` are imported
   - Check template file paths are correct

2. **TypeScript Errors:**
   - Ensure all required props are passed
   - Check types match interface definitions

3. **Styling Issues:**
   - Use inline styles only (no CSS modules)
   - Test in email preview tool first

### Links Not Working

1. **Check Environment Variables:**
   ```bash
   echo $NEXT_PUBLIC_APP_URL
   ```

2. **Verify Link Format:**
   - Must be absolute URLs
   - Include protocol (https://)

---

## 📊 Email Analytics

Track email performance in Resend dashboard:
- Delivery rates
- Open rates (if tracking enabled)
- Click rates
- Bounce rates
- Spam complaints

**Note:** Email tracking pixels are disabled by default for privacy.

---

## 🔐 Security Best Practices

1. **API Key Protection:**
   - Never commit API keys to git
   - Use environment variables only
   - Rotate keys regularly

2. **Email Validation:**
   - Validate email addresses before sending
   - Rate limit email sending endpoints
   - Sanitize user input in templates

3. **Data Privacy:**
   - Don't include sensitive data in emails
   - Use secure links (HTTPS only)
   - Include unsubscribe mechanism

4. **Spam Prevention:**
   - Use verified sender domain
   - Include physical address in footer
   - Avoid spam trigger words
   - Monitor bounce rates

---

## 📚 Resources

- [React Email Documentation](https://react.email/docs)
- [Resend API Documentation](https://resend.com/docs)
- [Orggly Design System](../DESIGN-SYSTEM.md)
- [Email Client Compatibility](https://www.caniemail.com/)
- [Email Testing Tools](https://litmus.com/)

---

## ✅ Deployment Checklist

Before deploying to production:

- [ ] Set production `RESEND_API_KEY`
- [ ] Verify sender domain in Resend
- [ ] Update `EMAIL_FROM` to production address
- [ ] Configure `ADMIN_EMAILS` with real admin addresses
- [ ] Set `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Test all email flows in staging
- [ ] Monitor first production emails
- [ ] Set up error alerting for email failures
- [ ] Document email flow for team

---

**Integration Complete!** 🎉

All email templates are built and ready to integrate into the submission flow.
