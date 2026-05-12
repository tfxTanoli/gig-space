import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// While using the test key, Resend only allows sending FROM onboarding@resend.dev.
// Once you verify a custom domain in the Resend dashboard, change this to your own address.
const FROM = 'GigSpace <onboarding@resend.dev>';
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export type NotificationType =
  | 'message'
  | 'offer'
  | 'offer_accepted'
  | 'delivery'
  | 'revision'
  | 'review';

export interface EmailPayload {
  type: NotificationType;
  title: string;
  body: string;
  senderName: string;
  orderId?: string;
  conversationId?: string;
  serviceId?: string;
}

// ── Route mapping: each notification type → the best destination page ────────
function buildCtaUrl(payload: EmailPayload): string {
  switch (payload.type) {
    case 'message':
    case 'offer':
      // Both message and offer live in the Messages tab
      return payload.conversationId
        ? `${APP_URL}/buyer-dashboard?tab=Messages`
        : `${APP_URL}/buyer-dashboard?tab=Messages`;

    case 'offer_accepted':
      // Seller gets this when buyer accepts; buyer gets this on payment success
      return payload.orderId
        ? `${APP_URL}/seller-dashboard?tab=Orders`
        : `${APP_URL}/seller-dashboard?tab=Orders`;

    case 'delivery':
      // Buyer always receives delivery notifications
      return payload.orderId
        ? `${APP_URL}/buyer-dashboard?tab=Orders`
        : `${APP_URL}/buyer-dashboard?tab=Orders`;

    case 'revision':
      // Seller receives revision requests
      return payload.orderId
        ? `${APP_URL}/seller-dashboard?tab=Orders`
        : `${APP_URL}/seller-dashboard?tab=Orders`;

    case 'review':
      return `${APP_URL}/seller-dashboard?tab=Reviews`;

    default:
      return APP_URL;
  }
}

function buildCtaLabel(type: NotificationType): string {
  const map: Record<NotificationType, string> = {
    message: 'View Message',
    offer: 'View Offer',
    offer_accepted: 'View Order',
    delivery: 'Review Delivery',
    revision: 'View Revision Request',
    review: 'View Review',
  };
  return map[type] ?? 'Open GigSpace';
}

interface BadgeMeta { emoji: string; color: string; label: string }
function badgeMeta(type: NotificationType): BadgeMeta {
  const map: Record<NotificationType, BadgeMeta> = {
    message:       { emoji: '💬', color: '#6366f1', label: 'New Message'    },
    offer:         { emoji: '🏷️', color: '#8b5cf6', label: 'New Offer'      },
    offer_accepted:{ emoji: '✅', color: '#10b981', label: 'Offer Accepted'  },
    delivery:      { emoji: '📦', color: '#f59e0b', label: 'Order Delivered' },
    revision:      { emoji: '🔄', color: '#ef4444', label: 'Revision Request'},
    review:        { emoji: '⭐', color: '#f59e0b', label: 'New Review'      },
  };
  return map[type] ?? { emoji: '🔔', color: '#6366f1', label: 'Notification' };
}

function buildHtml(payload: EmailPayload, recipientName: string): string {
  const ctaUrl   = buildCtaUrl(payload);
  const ctaLabel = buildCtaLabel(payload.type);
  const badge    = badgeMeta(payload.type);
  const year     = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${payload.title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- ── TOP BRAND BAR ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);padding:28px 40px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;text-decoration:none;">
                      Gig<span style="color:#a5b4fc;">Space</span>
                    </span>
                    <br />
                    <span style="font-size:12px;color:#a5b4fc;letter-spacing:1px;text-transform:uppercase;margin-top:4px;display:inline-block;">Freelance Marketplace</span>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;background:${badge.color};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;padding:5px 12px;border-radius:20px;">${badge.label}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── HERO EMOJI ── -->
          <tr>
            <td style="background:linear-gradient(180deg,#ede9fe 0%,#f8fafc 100%);padding:36px 40px;text-align:center;border-bottom:1px solid #e2e8f0;">
              <div style="display:inline-block;background:#ffffff;border-radius:50%;width:80px;height:80px;line-height:80px;text-align:center;font-size:42px;box-shadow:0 4px 16px rgba(99,102,241,0.18);">
                ${badge.emoji}
              </div>
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td style="padding:36px 40px 0;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:0.8px;">Hey ${recipientName} 👋</p>
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0f172a;line-height:1.3;">${payload.title}</h1>
              ${payload.body ? `
              <p style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#475569;">${payload.body}</p>
              ` : ''}
            </td>
          </tr>

          <!-- ── CTA BUTTON ── -->
          <tr>
            <td style="padding:0 40px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,${badge.color} 0%,#4f46e5 100%);border-radius:10px;box-shadow:0 4px 12px rgba(99,102,241,0.35);">
                    <a href="${ctaUrl}"
                       target="_blank"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
                      ${ctaLabel} &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback text link -->
              <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
                Button not working? <a href="${ctaUrl}" target="_blank" style="color:#6366f1;text-decoration:underline;">${ctaUrl}</a>
              </p>
            </td>
          </tr>

          <!-- ── DIVIDER ── -->
          <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent);margin:0 40px;"></td></tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="padding:28px 40px;background:#f8fafc;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 6px;font-size:13px;color:#64748b;line-height:1.6;">
                      You received this email because you have an account on
                      <a href="${APP_URL}" target="_blank" style="color:#6366f1;text-decoration:none;font-weight:600;">GigSpace</a>.
                    </p>
                    <p style="margin:0;font-size:12px;color:#94a3b8;">
                      &copy; ${year} GigSpace. All rights reserved.
                    </p>
                  </td>
                  <td align="right" style="vertical-align:bottom;">
                    <span style="font-size:22px;font-weight:800;color:#e2e8f0;letter-spacing:-0.5px;">GS</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

export async function sendEmailNotification(
  recipientEmail: string,
  recipientName: string,
  payload: EmailPayload
): Promise<void> {
  const html = buildHtml(payload, recipientName);

  const { error } = await resend.emails.send({
    from: FROM,
    to: recipientEmail,
    subject: `${badgeMeta(payload.type).emoji} ${payload.title}`,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }
}
