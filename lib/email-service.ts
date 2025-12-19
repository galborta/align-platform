/**
 * Email Service Utility
 * 
 * Centralized service for sending emails via the /api/emails/send endpoint
 * 
 * @module lib/email-service
 */

// ==================== TYPES ====================

interface BaseEmailData {
  [key: string]: any;
}

interface AdminNotificationData extends BaseEmailData {
  submitterName: string;
  submitterEmail: string;
  tokenSymbol: string;
  tokenName: string;
  contractAddress: string;
  role: string;
  message?: string;
  submittedAt: string;
  conversationUrl: string;
}

interface ProjectApprovedData extends BaseEmailData {
  submitterName: string;
  tokenSymbol: string;
  tokenName: string;
  creationLink: string;
}

interface ProjectRejectedData extends BaseEmailData {
  submitterName: string;
  tokenSymbol: string;
  tokenName: string;
}

type EmailType = 'admin_notification' | 'project_approved' | 'project_rejected';

interface SendEmailParams {
  type: EmailType;
  to: string | string[];
  data: AdminNotificationData | ProjectApprovedData | ProjectRejectedData;
}

interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  details?: any;
}

// ==================== EMAIL SERVICE ====================

/**
 * Send an email via the centralized email API
 * 
 * @param params - Email parameters
 * @returns Promise with result
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResponse> {
  try {
    const response = await fetch('/api/emails/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[Email Service] Failed to send email:', result);
      return {
        success: false,
        error: result.error || 'Failed to send email',
        details: result.details,
      };
    }

    console.log('[Email Service] Email sent successfully:', result.messageId);
    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error('[Email Service] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Send admin notification email for new project submission
 */
export async function sendAdminNotification(
  adminEmails: string[],
  data: AdminNotificationData
): Promise<SendEmailResponse> {
  return sendEmail({
    type: 'admin_notification',
    to: adminEmails,
    data,
  });
}

/**
 * Send project approval email to submitter
 */
export async function sendProjectApproval(
  submitterEmail: string,
  data: ProjectApprovedData
): Promise<SendEmailResponse> {
  return sendEmail({
    type: 'project_approved',
    to: submitterEmail,
    data,
  });
}

/**
 * Send project rejection email to submitter
 */
export async function sendProjectRejection(
  submitterEmail: string,
  data: ProjectRejectedData
): Promise<SendEmailResponse> {
  return sendEmail({
    type: 'project_rejected',
    to: submitterEmail,
    data,
  });
}

// ==================== EXPORTS ====================

export type {
  SendEmailParams,
  SendEmailResponse,
  AdminNotificationData,
  ProjectApprovedData,
  ProjectRejectedData,
};



