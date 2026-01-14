import { Resend } from 'resend';
import { render } from '@react-email/render';
import { NextResponse } from 'next/server';
import AdminNotification from '@/emails/templates/AdminNotification';
import ProjectApproved from '@/emails/templates/ProjectApproved';
import ProjectRejected from '@/emails/templates/ProjectRejected';
import SubmissionReceived from '@/emails/templates/SubmissionReceived';
import ContactForm from '@/emails/templates/ContactForm';

const FROM_EMAIL = process.env.EMAIL_FROM || 'Orggly <notifications@orggly.com>';

// Lazy initialization of Resend client to avoid build-time errors
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  return new Resend(apiKey);
}

// ==================== SERVER-SIDE EMAIL FUNCTION ====================
// This function can be imported directly by other server-side code
// without needing to make HTTP requests

export interface SendEmailParams {
  type: 'admin_notification' | 'project_approved' | 'project_rejected' | 'submission_received' | 'contact_form';
  to: string | string[];
  data: {
    submitterName?: string;
    submitterEmail?: string;
    tokenSymbol?: string;
    tokenName?: string;
    contractAddress?: string;
    role?: string;
    message?: string;
    submittedAt?: string;
    conversationUrl?: string;
    creationLink?: string;
    // Contact form specific fields
    name?: string;
    email?: string;
    subject?: string;
  };
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  details?: any;
}

/**
 * Send email directly from server-side code (no HTTP fetch needed)
 * This is the recommended way to send emails from API routes
 */
export async function sendEmailDirect(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    console.log('[Email] sendEmailDirect called with type:', params.type);
    console.log('[Email] Recipient(s):', Array.isArray(params.to) ? params.to.join(', ') : params.to);
    
    // Check for API key
    if (!process.env.RESEND_API_KEY) {
      console.error('[Email] ❌ RESEND_API_KEY is not configured');
      return {
        success: false,
        error: 'Email service is not configured. RESEND_API_KEY is missing.'
      };
    }
    console.log('[Email] ✅ RESEND_API_KEY is configured');

    const { type, to, data } = params;
    
    if (!type || !to || !data) {
      console.error('[Email] ❌ Missing required fields:', { type: !!type, to: !!to, data: !!data });
      return {
        success: false,
        error: 'Missing required fields: type, to, data'
      };
    }
    
    console.log('[Email] ✅ All required fields present');
    console.log('[Email] FROM address:', FROM_EMAIL);
    
    let subject = '';
    let emailHtml = '';
    
    switch (type) {
      case 'admin_notification':
        if (!data.submitterName || !data.submitterEmail || !data.contractAddress || !data.role) {
          return {
            success: false,
            error: 'Missing required fields for admin_notification'
          };
        }
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://orggly.com'
        subject = `New Project Submission: ${data.tokenSymbol}`;
        emailHtml = await render(
          AdminNotification({
            submitterName: data.submitterName,
            submitterEmail: data.submitterEmail,
            tokenSymbol: data.tokenSymbol,
            tokenName: data.tokenName,
            contractAddress: data.contractAddress,
            role: data.role,
            message: data.message,
            submittedAt: data.submittedAt || new Date().toLocaleString('en-US', {
              dateStyle: 'long',
              timeStyle: 'short'
            }),
            conversationUrl: data.conversationUrl || `${baseUrl}/admin`
          })
        );
        break;
        
      case 'project_approved':
        if (!data.submitterName || !data.creationLink) {
          return {
            success: false,
            error: 'Missing required fields for project_approved'
          };
        }
        subject = `🎉 Your project ${data.tokenSymbol} has been approved!`;
        emailHtml = await render(
          ProjectApproved({
            submitterName: data.submitterName,
            tokenSymbol: data.tokenSymbol,
            tokenName: data.tokenName,
            creationLink: data.creationLink
          })
        );
        break;
        
      case 'project_rejected':
        if (!data.submitterName) {
          return {
            success: false,
            error: 'Missing required fields for project_rejected'
          };
        }
        subject = 'Update on your Orggly submission';
        emailHtml = await render(
          ProjectRejected({
            submitterName: data.submitterName,
            tokenSymbol: data.tokenSymbol,
            tokenName: data.tokenName
          })
        );
        break;
      
      case 'submission_received':
        if (!data.submitterName) {
          return {
            success: false,
            error: 'Missing required fields for submission_received'
          };
        }
        subject = `📬 We received your submission for ${data.tokenSymbol}!`;
        emailHtml = await render(
          SubmissionReceived({
            submitterName: data.submitterName,
            tokenSymbol: data.tokenSymbol,
            tokenName: data.tokenName,
            submittedAt: data.submittedAt || new Date().toLocaleString('en-US', {
              dateStyle: 'long',
              timeStyle: 'short'
            })
          })
        );
        break;
      
      case 'contact_form':
        if (!data.name || !data.email || !data.subject || !data.message) {
          return {
            success: false,
            error: 'Missing required fields for contact_form'
          };
        }
        subject = `Contact Form: ${data.subject}`;
        emailHtml = await render(
          ContactForm({
            name: data.name,
            email: data.email,
            subject: data.subject,
            message: data.message,
            submittedAt: data.submittedAt || new Date().toLocaleString('en-US', {
              dateStyle: 'long',
              timeStyle: 'short'
            })
          })
        );
        break;
        
      default:
        return {
          success: false,
          error: `Unknown email type: ${type}`
        };
    }
    
    // Verify emailHtml is a string
    if (typeof emailHtml !== 'string') {
      console.error('[Email] ❌ emailHtml is not a string! Type:', typeof emailHtml);
      console.error('[Email] ❌ emailHtml value:', emailHtml);
      return {
        success: false,
        error: 'Failed to render email template - HTML is not a string'
      };
    }
    
    console.log('[Email] Preparing to send email via Resend...');
    console.log('[Email] Subject:', subject);
    console.log('[Email] To:', Array.isArray(to) ? to.join(', ') : to);
    console.log('[Email] From:', FROM_EMAIL);
    console.log('[Email] HTML length:', emailHtml.length, 'characters');
    
    const resend = getResendClient();
    
    // Prepare email options with optional replyTo for contact forms
    const emailOptions: any = {
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: emailHtml,
    };
    
    // Add replyTo header for contact form submissions
    if (type === 'contact_form' && data.email) {
      emailOptions.replyTo = data.email;
      console.log('[Email] Reply-To:', data.email);
    }
    
    const result = await resend.emails.send(emailOptions);
    
    if (result.error) {
      console.error('[Email] ❌ Resend API error:');
      console.error('[Email] ❌ Error object:', JSON.stringify(result.error, null, 2));
      return {
        success: false,
        error: 'Failed to send email',
        details: result.error
      };
    }
    
    console.log('[Email] ✅ Email sent successfully via Resend!');
    console.log('[Email] ✅ Message ID:', result.data?.id);
    console.log('[Email] ✅ Check Resend dashboard: https://resend.com/emails');
    return {
      success: true,
      messageId: result.data?.id
    };
    
  } catch (error) {
    console.error('[Email] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ==================== HTTP API ROUTE ====================
// This endpoint is kept for client-side usage, but server-side code
// should use sendEmailDirect() instead

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, to, data } = body;
    
    const result = await sendEmailDirect({ type, to, data });
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: result.error?.includes('not configured') ? 500 : 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      messageId: result.messageId
    });
    
  } catch (error) {
    console.error('[Email API] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
