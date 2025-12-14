import { Resend } from 'resend';
import { render } from '@react-email/render';
import { NextResponse } from 'next/server';
import AdminNotification from '@/emails/templates/AdminNotification';
import ProjectApproved from '@/emails/templates/ProjectApproved';
import ProjectRejected from '@/emails/templates/ProjectRejected';

const FROM_EMAIL = process.env.EMAIL_FROM || 'Orggly <notifications@orggly.com>';

// Lazy initialization of Resend client to avoid build-time errors
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  return new Resend(apiKey);
}

export async function POST(request: Request) {
  try {
    // Check for API key before processing
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Email service is not configured. RESEND_API_KEY is missing.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { type, to, data } = body;
    
    if (!type || !to || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: type, to, data' },
        { status: 400 }
      );
    }
    
    let subject = '';
    let emailHtml = '';
    
    switch (type) {
      case 'admin_notification':
        subject = `New Project Submission: ${data.tokenSymbol}`;
        emailHtml = render(
          AdminNotification({
            submitterName: data.submitterName,
            submitterEmail: data.submitterEmail,
            tokenSymbol: data.tokenSymbol,
            tokenName: data.tokenName,
            contractAddress: data.contractAddress,
            role: data.role,
            message: data.message,
            submittedAt: data.submittedAt,
            conversationUrl: data.conversationUrl
          })
        );
        break;
        
      case 'project_approved':
        subject = `🎉 Your project ${data.tokenSymbol} has been approved!`;
        emailHtml = render(
          ProjectApproved({
            submitterName: data.submitterName,
            tokenSymbol: data.tokenSymbol,
            tokenName: data.tokenName,
            creationLink: data.creationLink
          })
        );
        break;
        
      case 'project_rejected':
        subject = 'Update on your Orggly submission';
        emailHtml = render(
          ProjectRejected({
            submitterName: data.submitterName,
            tokenSymbol: data.tokenSymbol,
            tokenName: data.tokenName
          })
        );
        break;
        
      default:
        return NextResponse.json(
          { error: `Unknown email type: ${type}` },
          { status: 400 }
        );
    }
    
    const resend = getResendClient();
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: emailHtml,
    });
    
    if (result.error) {
      console.error('Resend error:', result.error);
      return NextResponse.json(
        { error: 'Failed to send email', details: result.error },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      messageId: result.data?.id
    });
    
  } catch (error) {
    console.error('Email sending error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
