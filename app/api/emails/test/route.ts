/**
 * GET /api/emails/test
 * 
 * Test endpoint to verify email configuration and send a test email
 * 
 * @module app/api/emails/test
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendEmailDirect } from '../send/route';

export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const config = {
      RESEND_API_KEY: process.env.RESEND_API_KEY ? 'SET' : 'NOT SET',
      EMAIL_FROM: process.env.EMAIL_FROM || 'NOT SET',
      ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'NOT SET',
      ADMIN_EMAILS: process.env.ADMIN_EMAILS || 'NOT SET',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
    };

    // Get test email from query params or use ADMIN_EMAIL
    const testEmail = request.nextUrl.searchParams.get('email') || process.env.ADMIN_EMAIL;

    if (!testEmail || testEmail === 'NOT SET') {
      return NextResponse.json({
        success: false,
        error: 'No test email provided',
        config,
        instructions: 'Add ?email=your@email.com to the URL, or set ADMIN_EMAIL in .env.local'
      }, { status: 400 });
    }

    // Send test email
    const result = await sendEmailDirect({
      type: 'admin_notification',
      to: testEmail,
      data: {
        submitterName: 'Test User',
        submitterEmail: 'test@example.com',
        tokenSymbol: 'TEST',
        tokenName: 'Test Token',
        contractAddress: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        role: 'Founder',
        message: 'This is a test email to verify your email configuration is working correctly.',
        submittedAt: new Date().toLocaleString('en-US', {
          dateStyle: 'long',
          timeStyle: 'short'
        }),
        conversationUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://orggly.com'}/admin`
      }
    });

    return NextResponse.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      details: result.details,
      config,
      testEmail,
      message: result.success 
        ? `✅ Test email sent successfully to ${testEmail}! Check your inbox.`
        : `❌ Failed to send test email: ${result.error}`
    });

  } catch (error) {
    console.error('[Email Test] Exception:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      config: {
        RESEND_API_KEY: process.env.RESEND_API_KEY ? 'SET' : 'NOT SET',
        EMAIL_FROM: process.env.EMAIL_FROM || 'NOT SET',
        ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'NOT SET',
      }
    }, { status: 500 });
  }
}
