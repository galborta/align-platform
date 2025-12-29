import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.EMAIL_FROM || 'Orggly <notifications@orggly.com>'

/**
 * Email template for asset approval notification
 */
export async function sendAssetApprovedEmail(
  recipientEmail: string,
  submitterWallet: string,
  assetType: 'social' | 'domain',
  assetData: any,
  classification: 'official' | 'affiliated',
  projectName: string,
  karmaAwarded: number
) {
  try {
    const assetDescription = assetType === 'social'
      ? `@${assetData.handle} on ${assetData.platform}`
      : assetData.domain

    const classificationLabel = classification === 'official' ? 'Official' : 'Affiliated'

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: `✅ Your ${classificationLabel} ${assetType === 'social' ? 'social account' : 'domain'} was approved!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #7C4DFF 0%, #FFB800 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .header h1 { color: white; margin: 0; font-size: 24px; }
              .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
              .asset-info { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .asset-info strong { color: #7C4DFF; }
              .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; color: white; }
              .badge-official { background: #7C4DFF; }
              .badge-affiliated { background: #FFB800; }
              .karma-badge { background: #4CAF50; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 10px 0; }
              .button { display: inline-block; padding: 12px 24px; background: #7C4DFF; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Asset Approved!</h1>
              </div>
              <div class="content">
                <p>Great news! Your asset submission for <strong>${projectName}</strong> has been approved by the project editors.</p>
                
                <div class="asset-info">
                  <p style="margin-top: 0;"><strong>Asset:</strong> ${assetDescription}</p>
                  <p><strong>Type:</strong> ${assetType === 'social' ? 'Social Account' : 'Domain'}</p>
                  <p style="margin-bottom: 0;">
                    <strong>Classification:</strong> 
                    <span class="badge badge-${classification}">${classificationLabel}</span>
                  </p>
                </div>

                <div class="karma-badge">
                  +${karmaAwarded.toFixed(1)} Karma Earned! 🌟
                </div>

                <p>Your asset is now verified and will be displayed on the project's page. Thank you for contributing to the ${projectName} community!</p>

                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://align.xyz'}/project/${projectName}" class="button">View Project Page</a>

                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                  Wallet: <code>${submitterWallet}</code>
                </p>
              </div>
              <div class="footer">
                <p>This is an automated notification from Align.</p>
                <p>Questions? Reply to this email or visit our <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://align.xyz'}/support">support page</a>.</p>
              </div>
            </div>
          </body>
        </html>
      `
    })

    if (error) {
      console.error('Failed to send asset approved email:', error)
      return false
    }

    console.log('✅ Asset approved email sent:', data?.id)
    return true
  } catch (error) {
    console.error('Error sending asset approved email:', error)
    return false
  }
}

/**
 * Email template for asset rejection notification
 */
export async function sendAssetRejectedEmail(
  recipientEmail: string,
  submitterWallet: string,
  assetType: 'social' | 'domain',
  assetData: any,
  classification: 'official' | 'affiliated',
  projectName: string,
  reason?: string
) {
  try {
    const assetDescription = assetType === 'social'
      ? `@${assetData.handle} on ${assetData.platform}`
      : assetData.domain

    const classificationLabel = classification === 'official' ? 'Official' : 'Affiliated'

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: `Asset Submission Review - ${projectName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #666 0%, #999 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .header h1 { color: white; margin: 0; font-size: 24px; }
              .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
              .asset-info { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .reason-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .reason-box strong { color: #856404; }
              .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; color: white; }
              .badge-official { background: #7C4DFF; }
              .badge-affiliated { background: #FFB800; }
              .button { display: inline-block; padding: 12px 24px; background: #7C4DFF; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Asset Submission Review</h1>
              </div>
              <div class="content">
                <p>Your asset submission for <strong>${projectName}</strong> has been reviewed by the project editors.</p>
                
                <div class="asset-info">
                  <p style="margin-top: 0;"><strong>Asset:</strong> ${assetDescription}</p>
                  <p><strong>Type:</strong> ${assetType === 'social' ? 'Social Account' : 'Domain'}</p>
                  <p style="margin-bottom: 0;">
                    <strong>Classification:</strong> 
                    <span class="badge badge-${classification}">${classificationLabel}</span>
                  </p>
                </div>

                ${reason ? `
                  <div class="reason-box">
                    <p style="margin-top: 0;"><strong>Editor's Note:</strong></p>
                    <p style="margin-bottom: 0;">${reason}</p>
                  </div>
                ` : ''}

                <p>Unfortunately, this asset submission was not approved at this time. This could be due to:</p>
                <ul>
                  <li>The asset doesn't meet the project's verification criteria</li>
                  <li>The asset information is incomplete or incorrect</li>
                  <li>The asset doesn't align with the project's current needs</li>
                </ul>

                <p>You're welcome to submit other assets or reach out to the project team if you have questions.</p>

                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://align.xyz'}/project/${projectName}" class="button">View Project Page</a>

                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                  Wallet: <code>${submitterWallet}</code>
                </p>
              </div>
              <div class="footer">
                <p>This is an automated notification from Align.</p>
                <p>Questions? Reply to this email or visit our <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://align.xyz'}/support">support page</a>.</p>
              </div>
            </div>
          </body>
        </html>
      `
    })

    if (error) {
      console.error('Failed to send asset rejected email:', error)
      return false
    }

    console.log('✅ Asset rejected email sent:', data?.id)
    return true
  } catch (error) {
    console.error('Error sending asset rejected email:', error)
    return false
  }
}

