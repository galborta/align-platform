import { Resend } from 'resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://orggly.com'
const FROM_EMAIL = process.env.EMAIL_FROM || 'Orggly <notifications@orggly.com>'

// Lazy initialization to avoid errors on client-side imports
let resendInstance: Resend | null = null

function getResend(): Resend {
  if (!resendInstance) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured')
    }
    resendInstance = new Resend(process.env.RESEND_API_KEY)
  }
  return resendInstance
}

/**
 * Send email to admin when a new dispute is created
 */
export async function sendDisputeCreatedEmail(
  adminEmail: string,
  disputeData: {
    disputeId: string
    jobId: string
    jobTitle: string
    disputingParty: 'poster' | 'worker'
    reason: string
    createdAt: string
  }
): Promise<boolean> {
  try {
    const partyLabel = disputeData.disputingParty === 'poster' ? 'Job Poster' : 'Worker'
    const formattedDate = new Date(disputeData.createdAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `⚖️ [Admin Action Required] New Dispute: ${disputeData.jobTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #FF6B35 0%, #FF8A5B 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .header h1 { color: white; margin: 0; font-size: 24px; }
              .header .emoji { font-size: 48px; display: block; margin-bottom: 10px; }
              .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
              .dispute-info { background: #FFF4F0; border-left: 4px solid #FF6B35; padding: 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
              .dispute-info p { margin: 8px 0; }
              .dispute-info strong { color: #FF6B35; }
              .reason-box { background: #f8f9fa; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .reason-box h3 { margin-top: 0; color: #333; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
              .reason-box p { margin-bottom: 0; color: #555; white-space: pre-wrap; }
              .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
              .badge-admin { background: #FF6B35; color: white; }
              .badge-urgent { background: #EF4444; color: white; animation: pulse 2s infinite; }
              @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
              .button { display: inline-block; padding: 14px 28px; background: #FF6B35; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; font-size: 16px; }
              .button:hover { background: #E55A2B; }
              .alert-box { background: #FEF3C7; border: 1px solid #F59E0B; padding: 15px; border-radius: 8px; margin: 20px 0; }
              .alert-box p { margin: 0; color: #92400E; font-size: 14px; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <span class="emoji">⚖️</span>
                <h1>New Dispute Requires Review</h1>
              </div>
              <div class="content">
                <div class="alert-box">
                  <p><strong>🚨 Admin Action Required:</strong> A new dispute has been opened and requires your review.</p>
                </div>

                <div class="dispute-info">
                  <p><strong>Job:</strong> ${disputeData.jobTitle}</p>
                  <p><strong>Opened By:</strong> <span class="badge badge-admin">${partyLabel}</span></p>
                  <p><strong>Created:</strong> ${formattedDate}</p>
                  <p><strong>Dispute ID:</strong> <code>${disputeData.disputeId.slice(0, 8)}...</code></p>
                </div>

                <div class="reason-box">
                  <h3>📝 Dispute Reason</h3>
                  <p>${disputeData.reason}</p>
                </div>

                <p>As a global admin, you can:</p>
                <ul>
                  <li>Review the dispute details and evidence</li>
                  <li>See the job's KPIs and submission</li>
                  <li>Resolve the dispute by splitting the escrow between parties</li>
                </ul>

                <div style="text-align: center;">
                  <a href="${APP_URL}/jobs/${disputeData.jobId}?tab=disputes" class="button">
                    Review Dispute →
                  </a>
                </div>

                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                  You're receiving this email because you are a global admin on Align.
                </p>
              </div>
              <div class="footer">
                <p>This is an automated admin notification from Align.</p>
                <p>Need help? Visit our <a href="${APP_URL}/support">admin support page</a>.</p>
              </div>
            </div>
          </body>
        </html>
      `
    })

    if (error) {
      console.error('Failed to send dispute created email:', error)
      return false
    }

    console.log('✅ Dispute created email sent to admin:', data?.id)
    return true
  } catch (error) {
    console.error('Error sending dispute created email:', error)
    return false
  }
}

/**
 * Send email to user when dispute is resolved
 */
export async function sendDisputeResolvedEmail(
  userEmail: string,
  resolutionData: {
    disputeId: string
    jobTitle: string
    workerPercentage: number
    posterPercentage: number
    resolutionNotes: string
    resolvedAt: string
  }
): Promise<boolean> {
  try {
    const formattedDate = new Date(resolutionData.resolvedAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    // Determine the outcome description
    let outcomeDescription: string
    if (resolutionData.workerPercentage === 100) {
      outcomeDescription = 'The worker receives 100% of the escrow.'
    } else if (resolutionData.posterPercentage === 100) {
      outcomeDescription = 'The poster receives a full refund (100% of escrow).'
    } else {
      outcomeDescription = `The escrow will be split: ${resolutionData.workerPercentage}% to worker, ${resolutionData.posterPercentage}% to poster.`
    }

    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      subject: `⚖️ Dispute Resolved: ${resolutionData.jobTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10B981 0%, #34D399 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .header h1 { color: white; margin: 0; font-size: 24px; }
              .header .emoji { font-size: 48px; display: block; margin-bottom: 10px; }
              .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
              .resolution-info { background: #F0FDF4; border-left: 4px solid #10B981; padding: 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
              .resolution-info p { margin: 8px 0; }
              .resolution-info strong { color: #059669; }
              .split-box { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
              .split-box .percentages { display: flex; justify-content: space-around; margin: 15px 0; }
              .split-box .percentage { text-align: center; }
              .split-box .percentage .number { font-size: 32px; font-weight: 700; color: #7C4DFF; }
              .split-box .percentage .label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
              .notes-box { background: #FFF7ED; border: 1px solid #FDBA74; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .notes-box h3 { margin-top: 0; color: #C2410C; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
              .notes-box p { margin-bottom: 0; color: #9A3412; white-space: pre-wrap; }
              .button { display: inline-block; padding: 14px 28px; background: #7C4DFF; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; font-size: 16px; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <span class="emoji">✅</span>
                <h1>Dispute Resolved</h1>
              </div>
              <div class="content">
                <p>Good news! The dispute on <strong>${resolutionData.jobTitle}</strong> has been resolved by an Align administrator.</p>

                <div class="resolution-info">
                  <p><strong>Job:</strong> ${resolutionData.jobTitle}</p>
                  <p><strong>Resolved:</strong> ${formattedDate}</p>
                  <p><strong>Outcome:</strong> ${outcomeDescription}</p>
                </div>

                <div class="split-box">
                  <h3 style="margin-top: 0; color: #333; font-size: 16px;">Escrow Distribution</h3>
                  <div class="percentages">
                    <div class="percentage">
                      <div class="number">${resolutionData.workerPercentage}%</div>
                      <div class="label">To Worker</div>
                    </div>
                    <div class="percentage">
                      <div class="number">${resolutionData.posterPercentage}%</div>
                      <div class="label">To Poster</div>
                    </div>
                  </div>
                </div>

                ${resolutionData.resolutionNotes ? `
                  <div class="notes-box">
                    <h3>📝 Admin's Resolution Notes</h3>
                    <p>${resolutionData.resolutionNotes}</p>
                  </div>
                ` : ''}

                <p>The escrow funds will be distributed according to this resolution. If you have any questions about this decision, please contact support.</p>

                <div style="text-align: center;">
                  <a href="${APP_URL}/messages" class="button">
                    View on Align
                  </a>
                </div>
              </div>
              <div class="footer">
                <p>This is an automated notification from Align.</p>
                <p>Questions? Reply to this email or visit our <a href="${APP_URL}/support">support page</a>.</p>
              </div>
            </div>
          </body>
        </html>
      `
    })

    if (error) {
      console.error('Failed to send dispute resolved email:', error)
      return false
    }

    console.log('✅ Dispute resolved email sent:', data?.id)
    return true
  } catch (error) {
    console.error('Error sending dispute resolved email:', error)
    return false
  }
}

