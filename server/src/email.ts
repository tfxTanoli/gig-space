import { Resend } from 'resend';

const FROM = 'Gigspace <team@gigspace.co>';
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
// Email images must load from a PUBLIC URL — localhost is unreachable by email clients,
// and most clients (Gmail/Outlook) block SVG, so we use a hosted PNG.
// Defaults to the production site; override with EMAIL_ASSET_URL if assets live elsewhere.
const ASSET_URL = process.env.EMAIL_ASSET_URL || 'https://gig-space.vercel.app';

// ─── Notification-based email types (sent via /api/notifications/email) ───────
export type NotificationType =
  | 'message'
  | 'offer'
  | 'offer_accepted'
  | 'order_placed'
  | 'delivery'
  | 'revision'
  | 'order_approved'
  | 'payment_received'
  | 'refund_issued'
  | 'affiliate_commission'
  | 'review'
  | 'referral_order';

export interface EmailPayload {
  type: NotificationType;
  title: string;
  body: string;
  senderName: string;
  orderId?: string;
  conversationId?: string;
  serviceId?: string;
  serviceTitle?: string;
  commissionAmount?: string;
}

// ─── Shared dark-theme HTML shell ─────────────────────────────────────────────
// All 20 templates share this outer wrapper; inner content varies.

const GIGSPACE_LOGO_IMG = `<img src="${ASSET_URL}/email-logo.png" width="120" height="31" alt="Gigspace" style="display:block;border:0;outline:none;height:31px;width:120px;" />`;

function shell(iconBoxBg: string, iconContent: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
</head>
<body style="margin:0;padding:0;background-color:#0d1224;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d1224;padding:48px 16px 40px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">

          <!-- ── CARD ── -->
          <tr>
            <td style="background-color:#111827;border-radius:16px;padding:40px 40px 36px;border:1px solid #1f2937;">

              <!-- Logo inside card — centered -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <a href="${APP_URL}" target="_blank" style="text-decoration:none;display:inline-block;">
                      ${GIGSPACE_LOGO_IMG}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Icon box — table-cell for reliable centering in all email clients -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="56" height="56" style="width:56px;height:56px;background-color:${iconBoxBg};border-radius:14px;text-align:center;vertical-align:middle;font-size:26px;line-height:1;">
                    ${iconContent}
                  </td>
                </tr>
              </table>

              <!-- Body content -->
              ${bodyHtml}

            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0;font-size:13px;color:#4b5563;">
                Too many emails? <a href="${APP_URL}/unsubscribe" target="_blank" style="color:#4b5563;text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// Same outer card + logo + footer as shell(), but WITHOUT the standalone icon
// box — lets a template place its own icon (e.g. inline beside the heading).
function shellPlain(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
</head>
<body style="margin:0;padding:0;background-color:#0d1224;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d1224;padding:48px 16px 40px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">

          <!-- ── CARD ── -->
          <tr>
            <td style="background-color:#111827;border-radius:16px;padding:40px 40px 36px;border:1px solid #1f2937;">

              <!-- Logo inside card — centered -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <a href="${APP_URL}" target="_blank" style="text-decoration:none;display:inline-block;">
                      ${GIGSPACE_LOGO_IMG}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Body content -->
              ${bodyHtml}

            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0;font-size:13px;color:#4b5563;">
                Too many emails? <a href="${APP_URL}/unsubscribe" target="_blank" style="color:#4b5563;text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ── Reusable HTML building blocks ──────────────────────────────────────────────
function h(text: string): string {
  return `<h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.35;">${text}</h1>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#9ca3af;">${text}</p>`;
}

function pWhite(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#ffffff;">${text}</p>`;
}

function bold(text: string): string {
  return `<strong style="color:#ffffff;">${text}</strong>`;
}

function serviceBlock(title: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#ffffff;">${title}</p>`;
}

function ctaButton(label: string, url: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
  <tr>
    <td style="background-color:#3b82f6;border-radius:8px;">
      <a href="${url}" target="_blank"
         style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
        ${label} &rarr;
      </a>
    </td>
  </tr>
</table>`;
}

function divider(): string {
  return `<div style="height:1px;background-color:#1f2937;margin:8px 0 20px;"></div>`;
}

function signOff(text: string): string {
  return `<p style="margin:20px 0 0;font-size:15px;line-height:1.7;color:#ffffff;">${text.replace(/\n/g, '<br/>')}</p>`;
}

function preCta(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#ffffff;font-weight:500;">${text}</p>`;
}

function bulletList(items: string[]): string {
  const lis = items.map(i => `<li style="margin-bottom:6px;font-size:15px;line-height:1.6;color:#9ca3af;">${i}</li>`).join('');
  return `<ul style="margin:0 0 16px;padding-left:20px;">${lis}</ul>`;
}

// ── SVG icons used in icon boxes ───────────────────────────────────────────────

const EDIT_SVG = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:auto;">
  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const REFUND_SVG = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:auto;">
  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="1" y1="10" x2="23" y2="10" stroke="#d1d5db" stroke-width="2"/>
  <path d="M9 15l-2-2 2-2" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M7 13h4a2 2 0 0 0 0-4" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const CARD_SVG = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:auto;">
  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="1" y1="10" x2="23" y2="10" stroke="#d1d5db" stroke-width="2"/>
</svg>`;

const FINGERPRINT_SVG = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:auto;">
  <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 0 0 8 11a4 4 0 1 1 8 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0 0 15.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 0 0 8 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const STOP_ICON = `&#128683;`;

// ── Template builders ──────────────────────────────────────────────────────────

export function buildWelcomeSellerEmail(): string {
  const body = `
    ${h('Welcome to Gigspace. We&#39;re glad you&#39;re here!')}
    ${p('Your account is ready. Now lets create your first post so buyers can find you.')}
    ${p('Once your post is live, it will be visible to people searching for services in your area. You can edit it anytime, create additional posts for other services, or expand to more locations whenever you&#39;re ready.')}
    ${preCta('&#128071; Click below to create your first post.')}
    ${ctaButton('Create post', `${APP_URL}/seller-dashboard`)}
    ${p('If you have any questions, our support team is just an email away.')}
    ${divider()}
    ${signOff('Cheers,\nThe Gigspace Team')}
  `;
  return shell('#1e2640', '👋', body);
}

export function buildWelcomeBuyerEmail(): string {
  const body = `
    ${h('Welcome to Gigspace. We&#39;re glad you&#39;re here!')}
    ${p('Your account is ready. Now lets connect you with a service professional to start your first project.')}
    ${p('From local home services to digital freelancers, Gigspace makes it easy to connect with local pros, compare offers, and get projects completed faster.')}
    ${preCta('&#128071; Click below to hire for your first project.')}
    ${ctaButton('Browse services', `${APP_URL}/search`)}
    ${p('If you have any questions, our support team is just an email away.')}
    ${divider()}
    ${signOff('Cheers,\nThe Gigspace Team')}
  `;
  return shell('#1e2640', '👋', body);
}

export function buildWelcomeAffiliateEmail(): string {
  const body = `
    ${h('Welcome to the Gigspace Affiliate Program!')}
    ${p('You can now start earning commissions by referring buyers and sellers to the platform. Every time a service is completed through your referral, you earn 50% of our platform fee.')}
    ${p('Your affiliate dashboard gives you access to:')}
    ${bulletList(['Your referral link and codes', 'Commission tracking', 'Earnings and payout history', 'Performance analytics'])}
    ${preCta('&#128071; Ready to start earning?')}
    ${ctaButton('Get your affiliate link', `${APP_URL}/affiliate-dashboard`)}
    ${divider()}
    ${signOff('Thanks for being part of the Gigspace team!')}
  `;
  return shell('#1e2640', '👋', body);
}

export function buildPasswordResetEmail(firstName: string, resetLink: string): string {
  const keyIcon = `<svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
<path d="M8 0.5H36C40.1421 0.5 43.5 3.85786 43.5 8V36C43.5 40.1421 40.1421 43.5 36 43.5H8C3.85786 43.5 0.5 40.1421 0.5 36V8C0.5 3.85786 3.85786 0.5 8 0.5Z" fill="#1D293D"/>
<path d="M8 0.5H36C40.1421 0.5 43.5 3.85786 43.5 8V36C43.5 40.1421 40.1421 43.5 36 43.5H8C3.85786 43.5 0.5 40.1421 0.5 36V8C0.5 3.85786 3.85786 0.5 8 0.5Z" stroke="#314158"/>
<path d="M12.586 27.4142C12.2109 27.7891 12.0001 28.2978 12 28.8282V31.0002C12 31.2654 12.1054 31.5197 12.2929 31.7073C12.4804 31.8948 12.7348 32.0002 13 32.0002H16C16.2652 32.0002 16.5196 31.8948 16.7071 31.7073C16.8946 31.5197 17 31.2654 17 31.0002V30.0002C17 29.7349 17.1054 29.4806 17.2929 29.2931C17.4804 29.1055 17.7348 29.0002 18 29.0002H19C19.2652 29.0002 19.5196 28.8948 19.7071 28.7073C19.8946 28.5197 20 28.2654 20 28.0002V27.0002C20 26.7349 20.1054 26.4806 20.2929 26.2931C20.4804 26.1055 20.7348 26.0002 21 26.0002H21.172C21.7024 26 22.211 25.7893 22.586 25.4142L23.4 24.6002C24.7898 25.0843 26.3028 25.0825 27.6915 24.5949C29.0801 24.1074 30.2622 23.163 31.0444 21.9163C31.8265 20.6696 32.1624 19.1943 31.9971 17.7319C31.8318 16.2695 31.1751 14.9064 30.1344 13.8657C29.0937 12.825 27.7307 12.1683 26.2683 12.003C24.8058 11.8378 23.3306 12.1737 22.0839 12.9558C20.8372 13.7379 19.8928 14.92 19.4052 16.3087C18.9177 17.6973 18.9159 19.2103 19.4 20.6002L12.586 27.4142Z" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M26.5 18C26.7761 18 27 17.7761 27 17.5C27 17.2239 26.7761 17 26.5 17C26.2239 17 26 17.2239 26 17.5C26 17.7761 26.2239 18 26.5 18Z" fill="white" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  const body = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="vertical-align:middle;padding-right:14px;line-height:1;">${keyIcon}</td>
        <td style="vertical-align:middle;font-size:18px;font-weight:700;color:#ffffff;">Reset your password</td>
      </tr>
    </table>
    ${p(`Hi ${firstName},`)}
    ${p('We received a request to reset your Gigspace password.')}
    ${p('If you made this request, just click the button below to create a new password. This link will expire in 1 hour.')}
    ${ctaButton('Reset password', resetLink)}
    ${p(`Here are some ${bold('tips')} for creating a strong password:`)}
    ${bulletList(['Use a mix of letters, numbers, and symbols.', 'Avoid common words and phrases.', "Don't reuse passwords from other sites."])}
    ${p("If you didn't request a password reset, you can safely ignore this email &#8212; your current password will remain unchanged.")}
    ${signOff('Stay safe,\nThe Gigspace Team')}
  `;
  return shellPlain(body);
}

export function buildPasswordUpdatedEmail(firstName: string): string {
  const body = `
    ${h('Password updated!')}
    ${p(`Hi ${firstName},`)}
    ${p(`Your Gigspace password has been changed successfully. If you did not initiate this change, please ${bold('contact us')} immediately to ensure the security of your account.`)}
    ${p('Your security is our top priority!')}
    ${divider()}
    ${signOff('Stay safe,\nThe Gigspace Team')}
  `;
  return shell('#14532d', '✅', body);
}

export function buildOfferReceivedEmail(firstName: string, serviceTitle: string): string {
  const body = `
    ${h('New offer received!')}
    ${p(`Hi ${firstName},`)}
    ${p("You've received a new offer for:")}
    ${serviceBlock(serviceTitle)}
    ${p('Review the details and respond directly from your dashboard.')}
    ${ctaButton('View offer', `${APP_URL}/buyer-dashboard?tab=Messages`)}
    ${divider()}
    ${signOff('Congrats,\nThe Gigspace Team')}
  `;
  return shell('#14532d', '✅', body);
}

export function buildOfferAcceptedSellerEmail(firstName: string, serviceTitle: string): string {
  const body = `
    ${h('New offer received!')}
    ${p(`Hi ${firstName},`)}
    ${p("You've received a new offer for:")}
    ${serviceBlock(serviceTitle)}
    ${p('Review the details and respond directly from your dashboard.')}
    ${ctaButton('View offer', `${APP_URL}/seller-dashboard?tab=Orders`)}
    ${divider()}
    ${signOff('Congrats,\nThe Gigspace Team')}
  `;
  return shell('#14532d', '✅', body);
}

export function buildOrderPlacedBuyerEmail(firstName: string, serviceTitle: string): string {
  const body = `
    ${h('New offer received!')}
    ${p(`Hi ${firstName},`)}
    ${p("You've received a new offer for:")}
    ${serviceBlock(serviceTitle)}
    ${p('Review the details and respond directly from your dashboard.')}
    ${ctaButton('View offer', `${APP_URL}/buyer-dashboard?tab=Orders`)}
    ${divider()}
    ${signOff('Congrats,\nThe Gigspace Team')}
  `;
  return shell('#14532d', '✅', body);
}

export function buildWorkDeliveredBuyerEmail(firstName: string, serviceTitle: string): string {
  const body = `
    ${h('Congrats! They loved your work!')}
    ${p(`Hi ${firstName},`)}
    ${p('Your order has been accepted for the following project:')}
    ${serviceBlock(serviceTitle)}
    ${p('Your funds will become available for withdrawal after the escrow processing period (typically 3&#8211;5 business days).')}
    ${ctaButton('Login to dashboard', `${APP_URL}/buyer-dashboard?tab=Orders`)}
    ${divider()}
    ${signOff('Congrats,\nThe Gigspace Team')}
  `;
  return shell('#1e2640', '🎉', body);
}

export function buildOrderApprovedSellerEmail(firstName: string, serviceTitle: string): string {
  const body = `
    ${h('Congrats! They loved your work!')}
    ${p(`Hi ${firstName},`)}
    ${p('Your order has been accepted for the following project:')}
    ${serviceBlock(serviceTitle)}
    ${p('Your funds will become available for withdrawal after the escrow processing period (typically 3&#8211;5 business days).')}
    ${ctaButton('Login to dashboard', `${APP_URL}/seller-dashboard?tab=Orders`)}
    ${divider()}
    ${signOff('Congrats,\nThe Gigspace Team')}
  `;
  return shell('#1e2640', '🎉', body);
}

export function buildRevisionRequestedEmail(firstName: string, serviceTitle: string): string {
  const body = `
    ${h('Revision Requested')}
    ${p(`Hi ${firstName},`)}
    ${p('A revision has been requested for the following project:')}
    ${serviceBlock(serviceTitle)}
    ${p('Please review their feedback and make any requested changes before resubmitting your work.')}
    ${ctaButton('Login to dashboard', `${APP_URL}/seller-dashboard?tab=Orders`)}
    ${divider()}
    ${signOff('Thank you,\nThe Gigspace Team')}
  `;
  return shell('#7c2d12', EDIT_SVG, body);
}

export function buildPaymentReceivedSellerEmail(firstName: string, serviceTitle: string): string {
  const body = `
    ${h('Payment received!')}
    ${p(`Hi ${firstName},`)}
    ${p("You've received a payment for the following order:")}
    ${serviceBlock(serviceTitle)}
    ${p('Your earnings have been updated in your dashboard and are now available for withdrawal.')}
    ${ctaButton('View earnings', `${APP_URL}/seller-dashboard?tab=Earnings`)}
    ${divider()}
    ${signOff('Congrats,\nThe Gigspace Team')}
  `;
  return shell('#1e2640', '🪅', body);
}

export function buildRefundIssuedBuyerEmail(firstName: string, serviceTitle: string): string {
  const body = `
    ${h('Your refund has been issued')}
    ${p(`Hi ${firstName},`)}
    ${p('A refund has been issued for the following order:')}
    ${serviceBlock(serviceTitle)}
    ${p('Please allow a few business days for the refund to appear on your original payment method.')}
    ${ctaButton('View order', `${APP_URL}/buyer-dashboard?tab=Orders`)}
    ${divider()}
    ${signOff('Thanks for being a loyal customer,\nThe Gigspace Team')}
  `;
  return shell('#14532d', REFUND_SVG, body);
}

export function buildPostUpgradedEmail(firstName: string, subscriptionPrice: string, nextBillingDate: string): string {
  const body = `
    ${h('Your subscription is now active!')}
    ${p(`Hi ${firstName},`)}
    ${p('Your seller subscription is now active. Your services will now begin appearing in more potential buyer search results.')}
    ${pWhite(`${bold('Amount:')} ${subscriptionPrice}/month<br/>${bold('Next billing date:')} ${nextBillingDate}`)}
    ${ctaButton('Manage subscription', `${APP_URL}/seller-dashboard?tab=Settings`)}
    ${divider()}
    ${signOff('Congrats,\nThe Gigspace Team')}
  `;
  return shell('#1e2640', '🚀', body);
}

export function buildPostDowngradedEmail(firstName: string): string {
  const body = `
    ${h('Your subscription is canceled')}
    ${p(`Hi ${firstName},`)}
    ${p('Your Gigspace subscription has been canceled successfully.')}
    ${p("You'll continue to have access to your subscription benefits until the end of your current billing period.")}
    ${p('After that, your listings will move to the free plan and may appear less frequently in buyer search results.')}
    ${ctaButton('Manage subscription', `${APP_URL}/seller-dashboard?tab=Settings`)}
    ${divider()}
    ${signOff('Thanks,\nThe Gigspace Team')}
  `;
  return shell('#7f1d1d', STOP_ICON, body);
}

export function buildPaymentFailedEmail(firstName: string): string {
  const body = `
    ${h('Please update your payment info')}
    ${p(`Hi ${firstName},`)}
    ${p('We were unable to process your recent payment.')}
    ${p('Please update your billing information to avoid interruptions to your account.')}
    ${ctaButton('Update billing', `${APP_URL}/seller-dashboard?tab=Settings`)}
    ${divider()}
    ${signOff('Thanks,\nThe Gigspace Team')}
  `;
  return shell('#7c2d12', CARD_SVG, body);
}

export function buildAffiliateCommissionEmail(firstName: string, commissionAmount: string): string {
  const body = `
    ${h('You earned some commission!')}
    ${p(`Hi ${firstName},`)}
    ${p('You earned a new affiliate commission from a completed order on Gigspace.')}
    ${pWhite(`${bold('Commission Amount:')} ${commissionAmount}`)}
    ${p('Your earnings dashboard has been updated and is available for withdrawal.')}
    ${ctaButton('View earnings', `${APP_URL}/affiliate-dashboard`)}
    ${divider()}
    ${signOff('Congrats,\nThe Gigspace Team')}
  `;
  return shell('#1e2640', '🪅', body);
}

export function buildAccountDeactivatedEmail(firstName: string): string {
  const body = `
    ${h('Your account is deactivated')}
    ${p(`Hi ${firstName},`)}
    ${p('Your Gigspace account has been deactivated.')}
    ${p('If you believe this was done in error or would like additional information, please contact support.')}
    ${ctaButton('Contact support', 'mailto:support@gigspace.co')}
    ${divider()}
    ${signOff('Thanks,\nThe Gigspace Team')}
  `;
  return shell('#7f1d1d', STOP_ICON, body);
}

export function buildVerifyEmailEmail(firstName: string, verifyLink: string): string {
  const body = `
    ${h('Verify your new email address')}
    ${p(`Hi ${firstName},`)}
    ${p('You recently updated the email address associated with your Gigspace account.')}
    ${p('To confirm this change, please use the button below.')}
    ${ctaButton('Verify email address', verifyLink)}
    ${p('Once confirmed, your account will keep its blue checkmark and remain eligible for the &#8220;Verified&#8221; search filter.')}
    ${p(`If you didn't make this change, you can ignore this email or ${bold('contact support')}.`)}
    ${divider()}
    ${signOff('Cheers,\nThe Gigspace Team')}
  `;
  return shell('#1e2640', FINGERPRINT_SVG, body);
}

export function buildVerificationCodeEmail(_firstName: string, code: string): string {
  const fingerprintIcon = `<svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
<path d="M8 0.5H36C40.1421 0.5 43.5 3.85786 43.5 8V36C43.5 40.1421 40.1421 43.5 36 43.5H8C3.85786 43.5 0.5 40.1421 0.5 36V8C0.5 3.85786 3.85786 0.5 8 0.5Z" fill="#1D293D"/>
<path d="M8 0.5H36C40.1421 0.5 43.5 3.85786 43.5 8V36C43.5 40.1421 40.1421 43.5 36 43.5H8C3.85786 43.5 0.5 40.1421 0.5 36V8C0.5 3.85786 3.85786 0.5 8 0.5Z" stroke="#314158"/>
<path d="M22 20C21.4696 20 20.9609 20.2107 20.5858 20.5858C20.2107 20.9609 20 21.4696 20 22C20 23.02 19.9 24.51 19.74 26" stroke="white" stroke-opacity="0.9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M24 23.1201C24 25.5001 24 29.5001 23 32.0001" stroke="white" stroke-opacity="0.9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M27.29 31.02C27.41 30.42 27.72 28.72 27.79 28" stroke="white" stroke-opacity="0.9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M12 22C12 19.9012 12.6604 17.8556 13.8876 16.1529C15.1148 14.4502 16.8466 13.1769 18.8377 12.5132C20.8288 11.8495 22.9783 11.8291 24.9817 12.4549C26.985 13.0807 28.7407 14.3209 30 16" stroke="white" stroke-opacity="0.9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M12 26H12.01" stroke="white" stroke-opacity="0.9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M31.8 26C32 24 31.931 20.646 31.8 20" stroke="white" stroke-opacity="0.9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M15 29.5C15.5 28 16 25 16 22C15.999 21.3189 16.114 20.6425 16.34 20" stroke="white" stroke-opacity="0.9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M18.65 32C18.86 31.34 19.1 30.68 19.22 30" stroke="white" stroke-opacity="0.9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M19 16.7999C19.9124 16.2732 20.9474 15.9959 22.001 15.9961C23.0545 15.9963 24.0894 16.2738 25.0017 16.8009C25.9139 17.328 26.6713 18.0859 27.1976 18.9986C27.7239 19.9112 28.0007 20.9464 28 21.9999V23.9999" stroke="white" stroke-opacity="0.9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  const body = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="vertical-align:middle;padding-right:14px;line-height:1;">${fingerprintIcon}</td>
        <td style="vertical-align:middle;font-size:18px;font-weight:700;color:#ffffff;">Here is your verification code:</td>
      </tr>
    </table>
    <p style="margin:0 0 20px;font-size:34px;line-height:1;font-weight:700;letter-spacing:12px;color:#3b82f6;">${code}</p>
    ${p('Please make sure you never share this code with anyone.')}
    ${p(`${bold('Note:')} The code will expire in 15 minutes.`)}
    ${signOff('Cheers,\nThe Gigspace Team')}
  `;
  return shellPlain(body);
}

// ── Notification email dispatcher ─────────────────────────────────────────────
// Maps notification types to the correct dark-themed template + subject line.

function buildNotificationEmail(payload: EmailPayload, recipientName: string): { subject: string; html: string } {
  const firstName = recipientName.split(' ')[0] || recipientName;
  const serviceTitle = payload.serviceTitle || payload.title || 'Your service';

  switch (payload.type) {
    case 'offer':
      return {
        subject: 'New offer received!',
        html: buildOfferReceivedEmail(firstName, serviceTitle),
      };
    case 'offer_accepted':
      return {
        subject: 'Your offer was accepted on Gigspace',
        html: buildOfferAcceptedSellerEmail(firstName, serviceTitle),
      };
    case 'order_placed':
      return {
        subject: 'Your Gigspace order has been placed',
        html: buildOrderPlacedBuyerEmail(firstName, serviceTitle),
      };
    case 'delivery':
      return {
        subject: `Congrats! ${payload.senderName} delivered your work!`,
        html: buildWorkDeliveredBuyerEmail(firstName, serviceTitle),
      };
    case 'order_approved':
      return {
        subject: 'Congrats! Your work order on Gigspace was approved!',
        html: buildOrderApprovedSellerEmail(firstName, serviceTitle),
      };
    case 'revision':
      return {
        subject: 'An order revision has been requested',
        html: buildRevisionRequestedEmail(firstName, serviceTitle),
      };
    case 'payment_received':
      return {
        subject: "You've received a new payment on Gigspace!",
        html: buildPaymentReceivedSellerEmail(firstName, serviceTitle),
      };
    case 'refund_issued':
      return {
        subject: 'Your order on Gigspace has been refunded',
        html: buildRefundIssuedBuyerEmail(firstName, serviceTitle),
      };
    case 'affiliate_commission':
      return {
        subject: 'You earned a new Gigspace Affiliate commission!',
        html: buildAffiliateCommissionEmail(firstName, payload.commissionAmount || '$0.00'),
      };
    // message and review: explicitly no email
    default:
      return { subject: '', html: '' };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function sendEmailNotification(
  recipientEmail: string,
  recipientName: string,
  payload: EmailPayload
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email notification');
    return;
  }

  // Skip types that don't need email
  if (payload.type === 'message' || payload.type === 'review' || payload.type === 'referral_order') {
    return;
  }

  const { subject, html } = buildNotificationEmail(payload, recipientName);
  if (!subject || !html) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: FROM, to: recipientEmail, subject, html });
  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
}

export async function sendTransactionalEmail(
  recipientEmail: string,
  subject: string,
  html: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping transactional email');
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: FROM, to: recipientEmail, subject, html });
  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
}
