import 'dotenv/config';
import app from './app';

const PORT = process.env.PORT || 3001;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
if (!webhookSecret || webhookSecret.startsWith('whsec_YOUR_')) {
  console.warn(
    '\n⚠️  STRIPE_WEBHOOK_SECRET is missing or still set to the placeholder value.\n' +
    '   Webhook signature verification will fail for every Stripe event.\n' +
    '   To fix: Stripe Dashboard → Developers → Webhooks → your endpoint → Signing secret.\n' +
    '   Set the real value in server/.env (local) and in your Vercel environment variables.\n'
  );
}

app.listen(PORT, () => console.log(`Gigspace server running on http://localhost:${PORT}`));
