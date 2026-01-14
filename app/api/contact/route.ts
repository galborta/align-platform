import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { sendEmailDirect } from '@/app/api/emails/send/route';

/**
 * Extract client IP address from request headers
 */
function getClientIP(request: NextRequest): string {
  // Check common headers for client IP (in order of priority)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }
  
  return 'unknown';
}

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/contact
 * 
 * Handles contact form submissions with rate limiting and email delivery
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;
    
    // ==================== VALIDATION ====================
    
    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          details: 'All fields are required: name, email, subject, message'
        },
        { status: 400 }
      );
    }
    
    // Validate name length
    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      return NextResponse.json(
        { 
          error: 'Invalid name',
          details: 'Name must be between 1 and 100 characters'
        },
        { status: 400 }
      );
    }
    
    // Validate email format
    const trimmedEmail = email.trim();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return NextResponse.json(
        { 
          error: 'Invalid email',
          details: 'Please provide a valid email address'
        },
        { status: 400 }
      );
    }
    
    // Validate subject length
    const trimmedSubject = subject.trim();
    if (trimmedSubject.length < 1 || trimmedSubject.length > 150) {
      return NextResponse.json(
        { 
          error: 'Invalid subject',
          details: 'Subject must be between 1 and 150 characters'
        },
        { status: 400 }
      );
    }
    
    // Validate message length
    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 10 || trimmedMessage.length > 1000) {
      return NextResponse.json(
        { 
          error: 'Invalid message',
          details: 'Message must be between 10 and 1000 characters'
        },
        { status: 400 }
      );
    }
    
    // ==================== RATE LIMITING ====================
    const clientIP = getClientIP(request);
    const rateLimitResult = rateLimit(clientIP, 'contact');
    
    if (!rateLimitResult.success) {
      console.warn(`[Contact API] Rate limit exceeded for IP: ${clientIP}`);
      return NextResponse.json(
        { 
          error: rateLimitResult.error || 'Too many requests',
          details: 'You can only submit 3 contact forms per hour. Please try again later.',
          resetIn: rateLimitResult.resetIn
        },
        { status: 429 }
      );
    }
    
    console.log(`[Contact API] Processing contact form from: ${trimmedName} <${trimmedEmail}>`);
    console.log(`[Contact API] Rate limit remaining: ${rateLimitResult.remaining}`);
    
    // ==================== SEND EMAIL ====================
    const emailResult = await sendEmailDirect({
      type: 'contact_form',
      to: 'galborta@protonmail.com',
      data: {
        name: trimmedName,
        email: trimmedEmail,
        subject: trimmedSubject,
        message: trimmedMessage,
        submittedAt: new Date().toLocaleString('en-US', {
          dateStyle: 'long',
          timeStyle: 'short'
        })
      }
    });
    
    if (!emailResult.success) {
      console.error('[Contact API] Failed to send email:', emailResult.error);
      return NextResponse.json(
        { 
          error: 'Failed to send message',
          details: 'We encountered an error sending your message. Please try again later.'
        },
        { status: 500 }
      );
    }
    
    console.log('[Contact API] Email sent successfully. Message ID:', emailResult.messageId);
    
    return NextResponse.json({
      success: true,
      message: 'Your message has been sent successfully!'
    });
    
  } catch (error) {
    console.error('[Contact API] Exception:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: 'An unexpected error occurred. Please try again later.'
      },
      { status: 500 }
    );
  }
}
