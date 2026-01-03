# Orggly Email Templates

This directory contains all email templates and reusable email components for the Orggly platform.

## 📁 Directory Structure

```
emails/
├── components/          # Reusable email components
│   ├── EmailLayout.tsx     # Base layout wrapper with header/footer
│   ├── EmailButton.tsx     # Styled button component
│   └── EmailFooter.tsx     # Standard footer with branding
│
├── templates/           # Complete email templates
│   ├── SubmissionConfirmation.tsx  # User receives after submitting
│   ├── AdminNotification.tsx       # Admin receives for new submissions
│   ├── ProjectApproved.tsx         # User receives when approved
│   └── ProjectRejected.tsx         # User receives when rejected
│
└── README.md           # This file
```

## 🎨 Design System Reference

All email templates follow the Orggly design system defined in:
- `/DESIGN-SYSTEM.md` - Complete brand identity and design tokens
- `/DESIGN_SYSTEM_IMPLEMENTATION.md` - Implementation guidelines

### Brand Colors for Emails

**Primary Colors:**
```css
--page-background: #E3F06F;    /* Lime yellow-green (use sparingly in emails) */
--card-background: #FFFFFF;     /* White - main content background */
--accent-primary: #7C4DFF;      /* Purple - buttons, links, CTAs */
--accent-primary-soft: #EEE7FF; /* Soft purple - backgrounds */
--accent-success: #36C170;      /* Green - success messages */
--accent-success-soft: #E3F8ED; /* Soft green - backgrounds */
```

**Text Colors:**
```css
--text-primary: #1A1A1E;   /* Almost black - body text */
--text-secondary: #6F7280; /* Medium gray - secondary text */
--text-muted: #A3A7B5;     /* Light gray - helper text */
```

### Typography

**Fonts:**
- **Headings**: Space Grotesk (bold, weights: 600-700)
- **Body**: Satoshi (weights: 400-600)
- **Logo**: Gluten (for "Orggly" branding)

**Font Sizes:**
- Headline: 24px
- Title: 20px
- Body: 16px
- Small: 14px
- Caption: 12px

## 🛠️ Development Commands

### Preview Emails Locally
```bash
npm run email              # Start email dev server
npm run email:preview      # Preview in browser
```

Visit `http://localhost:3000` to see all email templates with hot reload.

## ✉️ Email Template Guidelines

### 1. Mobile-First Design
- Use single-column layouts (max-width: 600px)
- Large touch targets for buttons (min 44px height)
- Readable font sizes (min 16px for body)

### 2. Email Client Compatibility
- Use inline styles (React Email handles this)
- Test in Gmail, Outlook, Apple Mail
- Avoid CSS Grid and Flexbox (limited support)
- Use tables for layout if needed

### 3. Branding Consistency
- Include Orggly logo at top
- Use brand colors consistently
- Purple accent for CTAs
- White background for main content
- Include footer with social links

### 4. Accessibility
- Alt text for all images
- High contrast text (WCAG AA)
- Semantic HTML structure
- Clear call-to-action buttons

### 5. Content Guidelines
- Clear subject lines (< 50 characters)
- Personalized greetings
- Single clear CTA per email
- Brief, scannable content
- Include unsubscribe link (footer)

## 📧 Email Templates Overview

### User-Facing Emails

**1. Submission Confirmation**
- **Sent**: Immediately after user submits project
- **Purpose**: Confirm receipt, set expectations
- **CTA**: None (informational)
- **Tone**: Friendly, reassuring

**2. Project Approved**
- **Sent**: When admin approves submission
- **Purpose**: Deliver creation link, celebrate
- **CTA**: "Complete Your Profile" button with token link
- **Tone**: Exciting, congratulatory

**3. Project Rejected**
- **Sent**: When admin rejects submission
- **Purpose**: Provide feedback, encourage reapplication
- **CTA**: Optional "Learn More" link
- **Tone**: Professional, constructive

### Admin Emails

**4. Admin Notification**
- **Sent**: When new project submitted
- **Purpose**: Alert admin to review submission
- **CTA**: "Review Submission" button linking to /messages
- **Tone**: Informational, urgent

## 🔧 Component Usage Examples

### EmailLayout Component
```tsx
import { EmailLayout } from './components/EmailLayout'

export default function MyEmail() {
  return (
    <EmailLayout previewText="Your project has been approved!">
      <h1>Content here</h1>
    </EmailLayout>
  )
}
```

### EmailButton Component
```tsx
import { EmailButton } from './components/EmailButton'

<EmailButton 
  href="https://orggly.com/create?token=abc123"
  text="Complete Your Profile"
  variant="primary"
/>
```

## 🚀 Sending Emails

Emails are sent via Resend API in API routes:
- `/app/api/submissions/create/route.ts` - Confirmation email
- `/app/api/admin/submissions/approve/route.ts` - Approval email
- `/app/api/admin/submissions/reject/route.ts` - Rejection email

See implementation documentation in each API route file.

## 📚 Resources

- [React Email Documentation](https://react.email/docs)
- [Resend API Documentation](https://resend.com/docs)
- [Orggly Design System](../DESIGN-SYSTEM.md)
- [Email Client Support](https://www.caniemail.com/)

## ⚠️ Important Notes

1. **Test Before Deploying**: Always send test emails to multiple clients
2. **Environment Variables**: Ensure `RESEND_API_KEY` is set
3. **Rate Limits**: Resend has sending limits (check dashboard)
4. **Deliverability**: Monitor bounce rates and spam reports
5. **Unsubscribe**: Required by law (included in footer)

---

**Created**: December 14, 2024  
**Sprint**: Email Integration (Sprint 4)  
**Platform**: Orggly Project Submission System




