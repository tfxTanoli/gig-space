import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import adminRouter from './routes/admin.routes';
import affiliateRouter from './routes/affiliate.routes';
import { sendEmailNotification } from './email';

// ─── Firebase Admin ───────────────────────────────────────────────────────────
if (!admin.apps.length) {
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  let credential: admin.credential.Credential | undefined;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const parsed = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8')
    );
    credential = admin.credential.cert(parsed);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    credential = admin.credential.cert(parsed);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const fs = require('fs');
    if (fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      const parsed = JSON.parse(
        fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf-8')
      );
      credential = admin.credential.cert(parsed);
    } else {
      throw new Error(
        `[Firebase] serviceAccountKey.json not found at: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}. ` +
        `Set FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_SERVICE_ACCOUNT_JSON in your environment variables.`
      );
    }
  }

  admin.initializeApp({ ...(credential ? { credential } : {}), databaseURL });
}
const db = admin.database();

// ─── Stripe ───────────────────────────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// ─── Express ──────────────────────────────────────────────────────────────────
const app = express();

// FRONTEND_URL accepts a comma-separated list of allowed origins (e.g. prod + preview)
// e.g. FRONTEND_URL=https://gig-space.vercel.app,https://gig-space-lbk7.vercel.app
const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const ALLOWED_ORIGINS = rawFrontendUrl.split(',').map(u => u.trim()).filter(Boolean);

// Hardcoded fallbacks — overridden at runtime by settings/fees in Firebase
const PLATFORM_FEE_PERCENT_DEFAULT = 5;
const MINIMUM_WITHDRAWAL_DEFAULT   = 10;

async function readFeePct(): Promise<number> {
  try {
    const snap = await db.ref('settings/fees/platformFeePercent').get();
    if (snap.exists()) return Number(snap.val());
  } catch { /* use fallback */ }
  return PLATFORM_FEE_PERCENT_DEFAULT;
}

async function readMinWithdrawal(): Promise<number> {
  try {
    const snap = await db.ref('settings/fees/minimumWithdrawal').get();
    if (snap.exists()) return Number(snap.val());
  } catch { /* use fallback */ }
  return MINIMUM_WITHDRAWAL_DEFAULT;
}

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. server-to-server, curl, Vercel health checks)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    // Return false (not an Error) so Express responds with 403, not 500
    cb(null, false);
  },
  credentials: true,
}));

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Gigspace backend is running' });
});

// ── Stripe webhook MUST come before express.json() ───────────────────────────
app.post(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string | undefined;
    const secret = process.env.STRIPE_WEBHOOK_SECRET as string;

    if (!sig) { res.status(400).send('Missing stripe-signature header'); return; }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Webhook signature failed:', msg);
      res.status(400).send(`Webhook Error: ${msg}`);
      return;
    }

    try {
      if (event.type === 'checkout.session.completed') {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      } else if (event.type === 'payment_intent.succeeded') {
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
      } else if (event.type === 'payment_intent.payment_failed') {
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
      } else if (event.type === 'charge.refunded') {
        await handleChargeRefunded(event.data.object as Stripe.Charge);
      }
    } catch (err) {
      console.error(`Error handling ${event.type}:`, err);
      res.status(500).send('Internal error'); return;
    }

    res.json({ received: true });
  }
);

// ── JSON body for all other routes ────────────────────────────────────────────
app.use(express.json());

// ─── Auth middleware ──────────────────────────────────────────────────────────
interface AuthRequest extends Request {
  uid?: string;
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(header.split('Bearer ')[1]);
    req.uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/checkout/create-session
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/checkout/create-session', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      conversationId, messageId, serviceTitle, serviceId,
      sellerName, sellerId, offerAmount, priceUnit,
    } = req.body as {
      conversationId: string; messageId: string; serviceTitle: string;
      serviceId: string; sellerName: string; sellerId: string;
      offerAmount: number; priceUnit: 'per_project' | 'per_hour';
    };

    if (!conversationId || !messageId || !serviceId || !sellerId || !offerAmount) {
      res.status(400).json({ error: 'Missing required fields' }); return;
    }
    if (offerAmount <= 0) {
      res.status(400).json({ error: 'Amount must be greater than 0' }); return;
    }

    const buyerId = req.uid!;
    const amountInCents = Math.round(offerAmount * 100);
    const PLATFORM_FEE_PERCENT = await readFeePct();
    const platformFeeCents = Math.round(amountInCents * (PLATFORM_FEE_PERCENT / 100));
    const sellerAmountCents = amountInCents - platformFeeCents;

    const description = priceUnit === 'per_hour'
      ? `${serviceTitle} — $${offerAmount}/hr (via ${sellerName})`
      : `${serviceTitle} — Fixed price (via ${sellerName})`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: serviceTitle, description },
          unit_amount: amountInCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      ui_mode: 'embedded',
      return_url: `${ALLOWED_ORIGINS[0]}/buyer-dashboard?tab=Orders&payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        buyerId, sellerId, serviceId, conversationId, messageId,
        offerAmount: String(offerAmount),
        platformFeePercent: String(PLATFORM_FEE_PERCENT),
        platformFeeCents: String(platformFeeCents),
        sellerAmountCents: String(sellerAmountCents),
      },
    });

    res.json({ sessionId: session.id, clientSecret: session.client_secret });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/checkout/create-session error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/checkout/verify-session
// Called by the frontend after embedded checkout completes.
// Creates the order if the webhook hasn't already done so (idempotent).
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/checkout/verify-session', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.body as { sessionId: string };
    if (!sessionId) { res.status(400).json({ error: 'sessionId is required' }); return; }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.buyerId !== req.uid) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    if (session.payment_status !== 'paid') {
      res.json({ status: session.payment_status, fulfilled: false }); return;
    }

    const existing = await db.ref('payments')
      .orderByChild('stripeSessionId').equalTo(session.id).limitToFirst(1).get();
    if (existing.exists()) {
      res.json({ status: 'paid', fulfilled: true, alreadyProcessed: true }); return;
    }

    await handleCheckoutCompleted(session);
    res.json({ status: 'paid', fulfilled: true, alreadyProcessed: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/checkout/verify-session error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/checkout/create-payment-intent
// Creates a PaymentIntent for Stripe Elements-based checkout.
// The frontend mounts <PaymentElement> and confirms client-side.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/checkout/create-payment-intent', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      conversationId, messageId, serviceTitle, serviceId,
      sellerName, sellerId, offerAmount, priceUnit,
    } = req.body as {
      conversationId: string; messageId: string; serviceTitle: string;
      serviceId: string; sellerName: string; sellerId: string;
      offerAmount: number; priceUnit: 'per_project' | 'per_hour';
    };

    if (!conversationId || !messageId || !serviceId || !sellerId || !offerAmount) {
      res.status(400).json({ error: 'Missing required fields' }); return;
    }
    if (offerAmount <= 0) {
      res.status(400).json({ error: 'Amount must be greater than 0' }); return;
    }

    const buyerId = req.uid!;
    const amountInCents = Math.round(offerAmount * 100);
    const PLATFORM_FEE_PERCENT = await readFeePct();
    const platformFeeCents = Math.round(amountInCents * (PLATFORM_FEE_PERCENT / 100));
    const sellerAmountCents = amountInCents - platformFeeCents;

    const walletSnap = await db.ref(`wallets/${sellerId}/stripeConnectedAccountId`).get();
    const connectedAccountId = walletSnap.val() as string | null;

    const piParams: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency: 'usd',
      payment_method_types: ['card', 'us_bank_account'],
      payment_method_options: {
        us_bank_account: { verification_method: 'automatic' },
      },
      description: priceUnit === 'per_hour'
        ? `${serviceTitle} — $${offerAmount}/hr (via ${sellerName})`
        : `${serviceTitle} — Fixed price (via ${sellerName})`,
      metadata: {
        buyerId, sellerId, serviceId, conversationId, messageId,
        offerAmount: String(offerAmount),
        platformFeePercent: String(PLATFORM_FEE_PERCENT),
        platformFeeCents: String(platformFeeCents),
        sellerAmountCents: String(sellerAmountCents),
      },
    };

    if (connectedAccountId) {
      piParams.application_fee_amount = platformFeeCents;
      piParams.transfer_data = { destination: connectedAccountId };
    }

    const pi = await stripe.paymentIntents.create(piParams);
    res.json({ clientSecret: pi.client_secret });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/checkout/create-payment-intent error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/checkout/verify-payment-intent
// Fallback for redirect-based payment methods (e.g. iDEAL).
// Retrieves the PaymentIntent and fulfils the order if succeeded.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/checkout/verify-payment-intent', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { paymentIntentId } = req.body as { paymentIntentId: string };
    if (!paymentIntentId) { res.status(400).json({ error: 'paymentIntentId is required' }); return; }

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (pi.metadata?.buyerId !== req.uid) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    if (pi.status !== 'succeeded') {
      res.json({ status: pi.status, fulfilled: false }); return;
    }

    const existing = await db.ref('payments')
      .orderByChild('stripePaymentIntentId').equalTo(pi.id).limitToFirst(1).get();
    if (existing.exists()) {
      res.json({ status: 'succeeded', fulfilled: true, alreadyProcessed: true }); return;
    }

    await handlePaymentIntentSucceeded(pi);
    res.json({ status: 'succeeded', fulfilled: true, alreadyProcessed: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/checkout/verify-payment-intent error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/approve-delivery
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/orders/approve-delivery', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.body as { orderId: string };
    if (!orderId) { res.status(400).json({ error: 'orderId is required' }); return; }

    const orderSnap = await db.ref(`orders/${orderId}`).get();
    if (!orderSnap.exists()) { res.status(404).json({ error: 'Order not found' }); return; }

    const order = orderSnap.val() as {
      buyerId?: string; sellerId?: string; status?: string;
      paymentId?: string; serviceTitle?: string;
    };

    if (order.buyerId !== req.uid) {
      res.status(403).json({ error: 'Only the buyer can approve delivery' }); return;
    }
    if (order.status !== 'delivered') {
      res.status(400).json({ error: `Order must be 'delivered' (currently '${order.status}')` }); return;
    }

    const now = Date.now();
    const updates: Record<string, unknown> = {
      [`orders/${orderId}/status`]: 'completed',
      [`orders/${orderId}/completedAt`]: now,
      [`orders/${orderId}/paymentStatus`]: 'released',
    };

    if (order.paymentId) {
      const paymentSnap = await db.ref(`payments/${order.paymentId}`).get();
      if (paymentSnap.exists()) {
        const payment = paymentSnap.val() as {
          sellerId?: string; sellerAmount?: number; status?: string;
        };
        if (payment.status === 'paid' && payment.sellerId && payment.sellerAmount) {
          const { sellerId, sellerAmount } = payment;
          updates[`payments/${order.paymentId}/status`] = 'released';
          updates[`payments/${order.paymentId}/releasedAt`] = now;
          updates[`wallets/${sellerId}/pendingBalance`]   = admin.database.ServerValue.increment(-sellerAmount);
          updates[`wallets/${sellerId}/availableBalance`] = admin.database.ServerValue.increment(sellerAmount);
          updates[`wallets/${sellerId}/lifetimeEarnings`] = admin.database.ServerValue.increment(sellerAmount);
          updates[`wallets/${sellerId}/updatedAt`] = now;
          const txId = db.ref(`walletTransactions/${sellerId}`).push().key!;
          updates[`walletTransactions/${sellerId}/${txId}`] = {
            type: 'payment_received', orderId, paymentId: order.paymentId,
            amount: sellerAmount,
            description: `Funds released for "${order.serviceTitle || 'order'}"`,
            createdAt: now,
          };
        }
      }
    }

    // ── Release affiliate commission if this order has one ─────────────────────
    const commSnap = await db.ref('affiliateCommissions')
      .orderByChild('orderId')
      .equalTo(orderId)
      .limitToFirst(1)
      .get();

    if (commSnap.exists()) {
      const commissionId = Object.keys(commSnap.val())[0];
      const commission = (commSnap.val() as Record<string, unknown>)[commissionId] as {
        affiliateId?: string; commissionAmount?: number; status?: string;
      };
      if (commission.status === 'pending' && commission.affiliateId && commission.commissionAmount) {
        const { affiliateId: affId, commissionAmount } = commission;
        updates[`affiliateCommissions/${commissionId}/status`]      = 'available';
        updates[`affiliateCommissions/${commissionId}/releasedAt`]  = now;
        updates[`affiliates/${affId}/pendingBalance`]   = admin.database.ServerValue.increment(-commissionAmount);
        updates[`affiliates/${affId}/availableBalance`] = admin.database.ServerValue.increment(commissionAmount);
        updates[`affiliates/${affId}/lifetimeEarnings`] = admin.database.ServerValue.increment(commissionAmount);
        updates[`affiliates/${affId}/updatedAt`]        = now;
      }
    }

    await db.ref().update(updates);
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/orders/approve-delivery error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/connect/link
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/connect/debug  — returns the raw Stripe error for diagnosis
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/connect/debug', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const account = await stripe.accounts.create({
      controller: {
        stripe_dashboard: { type: 'express' },
        fees: { payer: 'application' },
        losses: { payments: 'application' },
        requirement_collection: 'stripe',
      },
    });
    // If we get here, immediately delete the test account
    await stripe.accounts.del(account.id);
    res.json({ ok: true, message: 'Account creation works correctly' });
  } catch (err) {
    const se = err as { type?: string; code?: string; message?: string; statusCode?: number };
    res.status(200).json({
      ok: false,
      type: se.type,
      code: se.code,
      message: se.message,
      statusCode: se.statusCode,
    });
  }
});

app.post('/api/connect/link', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const sellerId = req.uid!;
    const returnUrl = `${ALLOWED_ORIGINS[0]}/seller-dashboard?tab=Payouts`;
    const refreshUrl = `${ALLOWED_ORIGINS[0]}/seller-dashboard?tab=Payouts&connect_refresh=true`;

    const walletSnap = await db.ref(`wallets/${sellerId}/stripeConnectedAccountId`).get();
    let stripeAccountId: string = walletSnap.val() as string;

    if (!stripeAccountId) {
      const userSnap = await db.ref(`users/${sellerId}`).get();
      const user = userSnap.val() as { email?: string } | null;
      const email = user?.email;

      let account: Stripe.Account;
      try {
        // Stripe API ≥2024-09-30: `type` removed, use `controller` instead
        account = await stripe.accounts.create({
          controller: {
            stripe_dashboard: { type: 'express' },
            fees: { payer: 'application' },
            losses: { payments: 'application' },
            requirement_collection: 'stripe',
          },
          ...(email ? { email } : {}),
        });
      } catch (primaryErr) {
        // Log the exact Stripe error for Vercel function logs
        const se = primaryErr as { type?: string; code?: string; message?: string };
        console.error('stripe.accounts.create failed:', JSON.stringify({ type: se.type, code: se.code, message: se.message }));

        // Propagate with full details so the frontend can display it
        const detail = se.message || 'Failed to create Stripe account';
        // Detect "not signed up for Connect" error specifically
        const isConnectNotEnabled =
          typeof detail === 'string' && detail.toLowerCase().includes('signed up for connect');
        const hint = isConnectNotEnabled
          ? ' Please visit https://dashboard.stripe.com/connect to enable Connect on your Stripe account.'
          : '';
        throw new Error(detail + hint);
      }

      stripeAccountId = account.id;
      await db.ref(`wallets/${sellerId}`).update({
        stripeConnectedAccountId: stripeAccountId, updatedAt: Date.now(),
      });
    }

    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    res.json({ url: link.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/connect/link error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/connect/status
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/connect/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { stripeAccountId } = req.body as { stripeAccountId: string };
    if (!stripeAccountId) {
      res.json({ payoutsEnabled: false, chargesEnabled: false, detailsSubmitted: false }); return;
    }
    const account = await stripe.accounts.retrieve(stripeAccountId);
    res.json({
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      detailsSubmitted: account.details_submitted,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/connect/status error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/withdraw
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/withdraw', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const sellerId = req.uid!;
    const { amount } = req.body as { amount: number };
    const MINIMUM_WITHDRAWAL = await readMinWithdrawal();

    if (!amount || amount < MINIMUM_WITHDRAWAL) {
      res.status(400).json({ error: `Minimum withdrawal is $${MINIMUM_WITHDRAWAL}` }); return;
    }

    const walletSnap = await db.ref(`wallets/${sellerId}`).get();
    if (!walletSnap.exists()) { res.status(404).json({ error: 'Wallet not found' }); return; }

    const wallet = walletSnap.val() as {
      availableBalance?: number; stripeConnectedAccountId?: string;
    };
    const available = wallet.availableBalance ?? 0;

    if (amount > available) {
      res.status(400).json({ error: `Insufficient balance. Available: $${available.toFixed(2)}` }); return;
    }

    const stripeAccountId = wallet.stripeConnectedAccountId;
    if (!stripeAccountId) {
      res.status(400).json({ error: 'Connect a Stripe account first' }); return;
    }

    const account = await stripe.accounts.retrieve(stripeAccountId);
    if (!account.payouts_enabled) {
      res.status(400).json({ error: 'Complete Stripe onboarding before withdrawing' }); return;
    }

    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      destination: stripeAccountId,
    });

    const now = Date.now();
    const withdrawalId = db.ref('withdrawals').push().key!;
    const txId = db.ref(`walletTransactions/${sellerId}`).push().key!;

    await db.ref().update({
      [`withdrawals/${withdrawalId}`]: {
        sellerId, amount, stripeTransferId: transfer.id, status: 'paid', createdAt: now,
      },
      [`wallets/${sellerId}/availableBalance`]: admin.database.ServerValue.increment(-amount),
      [`wallets/${sellerId}/totalWithdrawn`]:   admin.database.ServerValue.increment(amount),
      [`wallets/${sellerId}/updatedAt`]:        now,
      [`walletTransactions/${sellerId}/${txId}`]: {
        type: 'withdrawal', orderId: '', paymentId: '',
        amount: -amount,
        description: `Withdrawal — $${amount.toFixed(2)}`,
        createdAt: now,
      },
    });

    res.json({ success: true, transferId: transfer.id, withdrawalId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/withdraw error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Webhook handlers
// ─────────────────────────────────────────────────────────────────────────────
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const meta = session.metadata;
  if (!meta) return;

  const { buyerId, sellerId, serviceId, conversationId, messageId,
    offerAmount, platformFeePercent, platformFeeCents, sellerAmountCents } = meta;

  // Atomic lock — only one concurrent caller (webhook vs verify-session) can proceed.
  // Firebase transactions guarantee exactly-once commit: the second caller gets
  // committed=false and exits before any order/payment nodes are written.
  const lockRef = db.ref(`checkoutLocks/${session.id}`);
  const { committed } = await lockRef.transaction((current) => {
    if (current !== null) return; // already locked — abort (return undefined)
    return Date.now();            // claim the lock
  });
  if (!committed) {
    console.log(`Session ${session.id} already processed/processing — skipping duplicate`);
    return;
  }

  const [buyerSnap, sellerSnap, msgSnap, serviceSnap] = await Promise.all([
    db.ref(`users/${buyerId}`).get(),
    db.ref(`users/${sellerId}`).get(),
    db.ref(`messages/${conversationId}/${messageId}`).get(),
    db.ref(`services/${serviceId}`).get(),
  ]);

  const buyer   = buyerSnap.val()   as { name?: string; photoURL?: string } | null;
  const seller  = sellerSnap.val()  as { name?: string; photoURL?: string } | null;
  const msg     = msgSnap.val()     as { offer?: { serviceTitle?: string; serviceImage?: string | null; description?: string; priceUnit?: string } } | null;
  const service = serviceSnap.val() as { title?: string; images?: string[] } | null;

  const offerAmountNum = parseFloat(offerAmount);
  const platformFeePct = parseFloat(platformFeePercent);
  const platformFeeAmt = parseInt(platformFeeCents, 10) / 100;
  const sellerAmt      = parseInt(sellerAmountCents, 10) / 100;
  const serviceTitle   = msg?.offer?.serviceTitle || service?.title || 'Service';
  const serviceImage   = msg?.offer?.serviceImage ?? service?.images?.[0] ?? null;
  const now = Date.now();

  const orderId   = db.ref('orders').push().key!;
  const paymentId = db.ref('payments').push().key!;
  const txId      = db.ref(`walletTransactions/${sellerId}`).push().key!;

  const mainUpdates: Record<string, unknown> = {
    [`orders/${orderId}`]: {
      buyerId, buyerName: buyer?.name || 'Buyer', buyerPhoto: buyer?.photoURL || '',
      sellerId, sellerName: seller?.name || 'Seller', sellerPhoto: seller?.photoURL || '',
      serviceId, serviceTitle, serviceImage,
      price: offerAmountNum, priceType: msg?.offer?.priceUnit || 'per_project',
      message: msg?.offer?.description || '',
      status: 'in_progress', paymentId, paymentStatus: 'paid',
      conversationId, createdAt: now,
    },
    [`payments/${paymentId}`]: {
      orderId, conversationId, serviceId, buyerId, sellerId,
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent || '',
      amount: offerAmountNum, currency: 'usd',
      platformFeePercent: platformFeePct, platformFeeAmount: platformFeeAmt,
      sellerAmount: sellerAmt, status: 'paid', createdAt: now, paidAt: now,
    },
    [`messages/${conversationId}/${messageId}/offerStatus`]: 'accepted',
    [`messages/${conversationId}/${messageId}/orderId`]:     orderId,
    [`wallets/${sellerId}/pendingBalance`]: admin.database.ServerValue.increment(sellerAmt),
    [`wallets/${sellerId}/updatedAt`]:     now,
    [`walletTransactions/${sellerId}/${txId}`]: {
      type: 'payment_received', orderId, paymentId, amount: sellerAmt,
      description: `Payment received for "${serviceTitle}"`, createdAt: now,
    },
  };

  // ── Affiliate commission (50% of platform fee) ───────────────────────────────
  const buyerReferralSnap = await db.ref(`users/${buyerId}/referredBy`).get();
  const affiliateId = buyerReferralSnap.val() as string | null;

  if (affiliateId && affiliateId !== sellerId && affiliateId !== buyerId) {
    const commissionAmount = parseFloat((platformFeeAmt * 0.5).toFixed(2));
    if (commissionAmount > 0) {
      const commissionId = db.ref('affiliateCommissions').push().key!;
      const affNotifId = db.ref(`notifications/${affiliateId}`).push().key!;
      mainUpdates[`affiliateCommissions/${commissionId}`] = {
        affiliateId, orderId, paymentId,
        buyerId, buyerName: buyer?.name || 'Buyer',
        sellerId, orderAmount: offerAmountNum,
        platformFeeAmount: platformFeeAmt,
        commissionAmount,
        status: 'pending',
        createdAt: now,
      };
      mainUpdates[`affiliates/${affiliateId}/pendingBalance`] =
        admin.database.ServerValue.increment(commissionAmount);
      mainUpdates[`affiliates/${affiliateId}/updatedAt`] = now;
      mainUpdates[`notifications/${affiliateId}/${affNotifId}`] = {
        type: 'referral_order',
        title: 'New referral order',
        body: `You earned a $${commissionAmount.toFixed(2)} commission from a referred order.`,
        senderId: buyerId,
        senderName: buyer?.name || 'Buyer',
        orderId,
        isRead: false,
        createdAt: now,
      };
      mainUpdates[`notificationCounts/${affiliateId}/unread`] =
        admin.database.ServerValue.increment(1);
    }
  }

  await db.ref().update(mainUpdates);
  console.log(`Order ${orderId} created for session ${session.id}`);
}

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  const meta = pi.metadata;
  if (!meta?.buyerId) return; // not a gig checkout — ignore

  const { buyerId, sellerId, serviceId, conversationId, messageId,
    offerAmount, platformFeePercent, platformFeeCents, sellerAmountCents } = meta;

  const lockRef = db.ref(`checkoutLocks/${pi.id}`);
  const { committed } = await lockRef.transaction((current) => {
    if (current !== null) return;
    return Date.now();
  });
  if (!committed) {
    console.log(`PaymentIntent ${pi.id} already processed/processing — skipping duplicate`);
    return;
  }

  const [buyerSnap, sellerSnap, msgSnap, serviceSnap] = await Promise.all([
    db.ref(`users/${buyerId}`).get(),
    db.ref(`users/${sellerId}`).get(),
    db.ref(`messages/${conversationId}/${messageId}`).get(),
    db.ref(`services/${serviceId}`).get(),
  ]);

  const buyer   = buyerSnap.val()   as { name?: string; photoURL?: string } | null;
  const seller  = sellerSnap.val()  as { name?: string; photoURL?: string } | null;
  const msg     = msgSnap.val()     as { offer?: { serviceTitle?: string; serviceImage?: string | null; description?: string; priceUnit?: string } } | null;
  const service = serviceSnap.val() as { title?: string; images?: string[] } | null;

  const offerAmountNum = parseFloat(offerAmount);
  const platformFeePct = parseFloat(platformFeePercent);
  const platformFeeAmt = parseInt(platformFeeCents, 10) / 100;
  const sellerAmt      = parseInt(sellerAmountCents, 10) / 100;
  const serviceTitle   = msg?.offer?.serviceTitle || service?.title || 'Service';
  const serviceImage   = msg?.offer?.serviceImage ?? service?.images?.[0] ?? null;
  const now = Date.now();

  const orderId   = db.ref('orders').push().key!;
  const paymentId = db.ref('payments').push().key!;
  const txId      = db.ref(`walletTransactions/${sellerId}`).push().key!;

  const mainUpdates: Record<string, unknown> = {
    [`orders/${orderId}`]: {
      buyerId, buyerName: buyer?.name || 'Buyer', buyerPhoto: buyer?.photoURL || '',
      sellerId, sellerName: seller?.name || 'Seller', sellerPhoto: seller?.photoURL || '',
      serviceId, serviceTitle, serviceImage,
      price: offerAmountNum, priceType: msg?.offer?.priceUnit || 'per_project',
      message: msg?.offer?.description || '',
      status: 'in_progress', paymentId, paymentStatus: 'paid',
      conversationId, createdAt: now,
    },
    [`payments/${paymentId}`]: {
      orderId, conversationId, serviceId, buyerId, sellerId,
      stripeSessionId: '',
      stripePaymentIntentId: pi.id,
      amount: offerAmountNum, currency: 'usd',
      platformFeePercent: platformFeePct, platformFeeAmount: platformFeeAmt,
      sellerAmount: sellerAmt, status: 'paid', createdAt: now, paidAt: now,
    },
    [`messages/${conversationId}/${messageId}/offerStatus`]: 'accepted',
    [`messages/${conversationId}/${messageId}/orderId`]:     orderId,
    [`wallets/${sellerId}/pendingBalance`]: admin.database.ServerValue.increment(sellerAmt),
    [`wallets/${sellerId}/updatedAt`]:     now,
    [`walletTransactions/${sellerId}/${txId}`]: {
      type: 'payment_received', orderId, paymentId, amount: sellerAmt,
      description: `Payment received for "${serviceTitle}"`, createdAt: now,
    },
  };

  const buyerReferralSnap = await db.ref(`users/${buyerId}/referredBy`).get();
  const affiliateId = buyerReferralSnap.val() as string | null;

  if (affiliateId && affiliateId !== sellerId && affiliateId !== buyerId) {
    const commissionAmount = parseFloat((platformFeeAmt * 0.5).toFixed(2));
    if (commissionAmount > 0) {
      const commissionId = db.ref('affiliateCommissions').push().key!;
      const affNotifId = db.ref(`notifications/${affiliateId}`).push().key!;
      mainUpdates[`affiliateCommissions/${commissionId}`] = {
        affiliateId, orderId, paymentId,
        buyerId, buyerName: buyer?.name || 'Buyer',
        sellerId, orderAmount: offerAmountNum,
        platformFeeAmount: platformFeeAmt,
        commissionAmount,
        status: 'pending',
        createdAt: now,
      };
      mainUpdates[`affiliates/${affiliateId}/pendingBalance`] =
        admin.database.ServerValue.increment(commissionAmount);
      mainUpdates[`affiliates/${affiliateId}/updatedAt`] = now;
      mainUpdates[`notifications/${affiliateId}/${affNotifId}`] = {
        type: 'referral_order',
        title: 'New referral order',
        body: `You earned a $${commissionAmount.toFixed(2)} commission from a referred order.`,
        senderId: buyerId,
        senderName: buyer?.name || 'Buyer',
        orderId,
        isRead: false,
        createdAt: now,
      };
      mainUpdates[`notificationCounts/${affiliateId}/unread`] =
        admin.database.ServerValue.increment(1);
    }
  }

  await db.ref().update(mainUpdates);
  console.log(`Order ${orderId} created for PaymentIntent ${pi.id}`);
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const snap = await db.ref('payments')
    .orderByChild('stripePaymentIntentId').equalTo(paymentIntent.id).limitToFirst(1).get();
  if (!snap.exists()) return;
  const paymentId = Object.keys(snap.val())[0];
  await db.ref(`payments/${paymentId}`).update({ status: 'failed' });
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const piId = charge.payment_intent as string | undefined;
  if (!piId) return;
  const snap = await db.ref('payments')
    .orderByChild('stripePaymentIntentId').equalTo(piId).limitToFirst(1).get();
  if (!snap.exists()) return;

  const paymentId = Object.keys(snap.val())[0];
  const payment = snap.val()[paymentId] as {
    orderId?: string; sellerId?: string; sellerAmount?: number; status?: string;
  };
  if (payment.status === 'refunded') return;

  const now = Date.now();
  const updates: Record<string, unknown> = {
    [`payments/${paymentId}/status`]: 'refunded',
    [`payments/${paymentId}/refundedAt`]: now,
  };
  if (payment.status === 'paid' && payment.sellerId && payment.sellerAmount) {
    updates[`wallets/${payment.sellerId}/pendingBalance`] =
      admin.database.ServerValue.increment(-payment.sellerAmount);
    updates[`wallets/${payment.sellerId}/updatedAt`] = now;
    const txId = db.ref(`walletTransactions/${payment.sellerId}`).push().key!;
    updates[`walletTransactions/${payment.sellerId}/${txId}`] = {
      type: 'refund', orderId: payment.orderId || '', paymentId,
      amount: -payment.sellerAmount, description: 'Payment refunded', createdAt: now,
    };
  }
  if (payment.orderId) {
    updates[`orders/${payment.orderId}/status`]        = 'cancelled';
    updates[`orders/${payment.orderId}/paymentStatus`] = 'refunded';
  }
  await db.ref().update(updates);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/notifications/email
// Looks up the recipient's email via Firebase Auth and sends via Resend.
// Called fire-and-forget from the frontend's sendNotification helper.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/notifications/email', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { recipientUid, payload } = req.body as {
      recipientUid: string;
      payload: {
        type: string;
        title: string;
        body: string;
        senderName: string;
        orderId?: string;
        conversationId?: string;
        serviceId?: string;
      };
    };

    if (!recipientUid || !payload?.type || !payload?.title) {
      res.status(400).json({ error: 'recipientUid and payload (type, title) are required' });
      return;
    }

    // Fetch recipient's email + displayName from Firebase Auth
    const userRecord = await admin.auth().getUser(recipientUid);
    const recipientEmail = userRecord.email;
    const recipientName = userRecord.displayName || 'there';

    if (!recipientEmail) {
      // User has no email (e.g. anonymous) — silently skip
      res.json({ sent: false, reason: 'no_email' });
      return;
    }

    await sendEmailNotification(recipientEmail, recipientName, payload as Parameters<typeof sendEmailNotification>[2]);
    res.json({ sent: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/notifications/email error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payment-methods/setup-intent
// Creates/retrieves a Stripe Customer for the user and returns a SetupIntent
// client secret so the frontend can mount a PaymentElement to save a card.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/payment-methods/setup-intent', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.uid!;
    const userSnap = await db.ref(`users/${uid}`).get();
    const userData = userSnap.val() as { email?: string; name?: string; stripeCustomerId?: string } | null;

    let customerId = userData?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        ...(userData?.email ? { email: userData.email } : {}),
        ...(userData?.name  ? { name:  userData.name  } : {}),
        metadata: { firebaseUid: uid },
      });
      customerId = customer.id;
      await db.ref(`users/${uid}/stripeCustomerId`).set(customerId);
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card', 'us_bank_account'],
      payment_method_options: {
        us_bank_account: { verification_method: 'automatic' },
      },
      usage: 'off_session',
    });

    res.json({ clientSecret: setupIntent.client_secret });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/payment-methods/setup-intent error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payment-methods
// Lists saved card payment methods for the current user's Stripe Customer.
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/payment-methods', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.uid!;
    const snap = await db.ref(`users/${uid}/stripeCustomerId`).get();
    const customerId = snap.val() as string | null;

    if (!customerId) {
      res.json({ paymentMethods: [] }); return;
    }

    const methods = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
    res.json({
      paymentMethods: methods.data.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand ?? 'card',
        last4: pm.card?.last4 ?? '****',
        expMonth: pm.card?.exp_month ?? 0,
        expYear: pm.card?.exp_year ?? 0,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/payment-methods error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/payment-methods/:pmId
// Detaches a saved payment method from the user's Stripe Customer.
// ─────────────────────────────────────────────────────────────────────────────
app.delete('/api/payment-methods/:pmId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.uid!;
    const { pmId } = req.params;

    const snap = await db.ref(`users/${uid}/stripeCustomerId`).get();
    const customerId = snap.val() as string | null;
    if (!customerId) { res.status(404).json({ error: 'No saved methods found' }); return; }

    const pm = await stripe.paymentMethods.retrieve(pmId);
    if (pm.customer !== customerId) { res.status(403).json({ error: 'Forbidden' }); return; }

    await stripe.paymentMethods.detach(pmId);
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error(`/api/payment-methods/${req.params.pmId} delete error:`, msg);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/account/delete
// Permanently deletes the calling user's account. Blocked if they have any
// active orders (in_progress or delivered) as buyer or seller.
// Any wallet balance is forfeited back to the platform (funds are already held
// in the platform's Stripe account — no Stripe action needed).
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/account/delete', requireAuth, async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  try {
    // 1. Block if active orders exist as buyer or seller
    const [buyerOrdersSnap, sellerOrdersSnap] = await Promise.all([
      db.ref('orders').orderByChild('buyerId').equalTo(uid).get(),
      db.ref('orders').orderByChild('sellerId').equalTo(uid).get(),
    ]);

    const hasActiveOrder = (snap: admin.database.DataSnapshot) => {
      let active = false;
      snap.forEach((child) => {
        const s = (child.val() as { status?: string }).status;
        if (s === 'in_progress' || s === 'delivered') active = true;
      });
      return active;
    };

    if (hasActiveOrder(buyerOrdersSnap) || hasActiveOrder(sellerOrdersSnap)) {
      res.status(400).json({
        error: 'You have active orders. Please complete or cancel them before deleting your account.',
      });
      return;
    }

    // 2. Gather data needed for cleanup
    const [userSnap, walletSnap, servicesSnap, affiliateCodeSnap, affiliateSnap, affiliateCommissionsSnap] = await Promise.all([
      db.ref(`users/${uid}`).get(),
      db.ref(`wallets/${uid}`).get(),
      db.ref('services').orderByChild('sellerId').equalTo(uid).get(),
      db.ref('affiliateCodes').orderByValue().equalTo(uid).get(),
      db.ref(`affiliates/${uid}`).get(),
      db.ref('affiliateCommissions').orderByChild('affiliateId').equalTo(uid).get(),
    ]);

    const userData = userSnap.val() as {
      username?: string; stripeCustomerId?: string;
    } | null;

    const walletData = walletSnap.val() as {
      availableBalance?: number; pendingBalance?: number; stripeConnectedAccountId?: string;
    } | null;

    const affiliateData = affiliateSnap.val() as {
      availableBalance?: number; pendingBalance?: number; stripeConnectedAccountId?: string;
    } | null;

    const forfeited =
      (walletData?.availableBalance ?? 0) +
      (walletData?.pendingBalance ?? 0) +
      (affiliateData?.availableBalance ?? 0) +
      (affiliateData?.pendingBalance ?? 0);

    // 3. Build multi-path nullification (removes all nodes)
    const deletions: Record<string, null> = {
      [`users/${uid}`]: null,
      [`wallets/${uid}`]: null,
      [`walletTransactions/${uid}`]: null,
      [`savedServices/${uid}`]: null,
      [`userConversations/${uid}`]: null,
      [`notifications/${uid}`]: null,
      [`notificationCounts/${uid}`]: null,
      [`affiliates/${uid}`]: null,
    };

    if (userData?.username) {
      deletions[`usernames/${userData.username}`] = null;
    }

    // Remove all services owned by this user
    servicesSnap.forEach((child) => {
      deletions[`services/${child.key}`] = null;
    });

    // Remove affiliate referral code if one exists
    affiliateCodeSnap.forEach((child) => {
      deletions[`affiliateCodes/${child.key}`] = null;
    });

    // Remove orphaned affiliate commissions where this user was the affiliate
    affiliateCommissionsSnap.forEach((child) => {
      deletions[`affiliateCommissions/${child.key}`] = null;
    });

    // Log the forfeiture if there was a balance
    let forfeitureLogId: string | null = null;
    if (forfeited > 0) {
      forfeitureLogId = db.ref('accountDeletionForfeits').push().key!;
    }

    await db.ref().update(deletions);

    if (forfeitureLogId && forfeited > 0) {
      await db.ref(`accountDeletionForfeits/${forfeitureLogId}`).set({
        uid,
        amount: forfeited,
        walletAvailable: walletData?.availableBalance ?? 0,
        walletPending: walletData?.pendingBalance ?? 0,
        affiliateAvailable: affiliateData?.availableBalance ?? 0,
        affiliatePending: affiliateData?.pendingBalance ?? 0,
        createdAt: Date.now(),
      });
    }

    // 4. Delete Stripe customer (removes saved payment methods)
    const stripeCustomerId = userData?.stripeCustomerId;
    if (stripeCustomerId) {
      try {
        await stripe.customers.del(stripeCustomerId);
      } catch {
        // Non-fatal — customer may already be deleted or not exist
      }
    }

    // Delete seller Stripe connected account (non-fatal)
    const sellerStripeAccountId = walletData?.stripeConnectedAccountId;
    if (sellerStripeAccountId) {
      try {
        await stripe.accounts.del(sellerStripeAccountId);
      } catch {
        // Non-fatal — account may have a balance or already be deleted
      }
    }

    // Delete affiliate Stripe connected account (non-fatal)
    const affiliateStripeAccountId = affiliateData?.stripeConnectedAccountId;
    if (affiliateStripeAccountId) {
      try {
        await stripe.accounts.del(affiliateStripeAccountId);
      } catch {
        // Non-fatal — account may have a balance or already be deleted
      }
    }

    // 5. Delete Firebase Auth user — must be last
    await admin.auth().deleteUser(uid);

    res.json({ success: true, forfeited });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/account/delete error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscriptions/create-listing-subscription
//
// Creates a Stripe Subscription for extra listing locations ($5/month each).
// Returns a PaymentIntent client secret so the frontend can confirm the card.
//
// Flow:
//   1. Get/create Stripe Customer for the seller.
//   2. Get/create the reusable "$5/month extra location" Price, cached in
//      Firebase at settings/stripe/extraLocationPriceId so it's only created
//      once. Override with env STRIPE_EXTRA_LOCATION_PRICE_ID if set.
//   3. Cancel any existing subscription already stored on the service record
//      (handles re-publishing after editing extra locations).
//   4. Create a new subscription with payment_behavior:'default_incomplete'
//      so we get a PaymentIntent that the frontend must confirm with the card.
//   5. Return { clientSecret, subscriptionId }.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/subscriptions/create-listing-subscription', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.uid!;
    const { extraLocationCount, serviceId } = req.body as {
      extraLocationCount: number;
      serviceId: string;
    };

    if (!extraLocationCount || extraLocationCount < 1) {
      res.status(400).json({ error: 'extraLocationCount must be at least 1' });
      return;
    }

    // 1. Get or create Stripe Customer ────────────────────────────────────────
    const userSnap = await db.ref(`users/${uid}`).get();
    const userData = userSnap.val() as {
      email?: string; name?: string; stripeCustomerId?: string;
    } | null;

    let customerId = userData?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        ...(userData?.email ? { email: userData.email } : {}),
        ...(userData?.name  ? { name:  userData.name  } : {}),
        metadata: { firebaseUid: uid },
      });
      customerId = customer.id;
      await db.ref(`users/${uid}/stripeCustomerId`).set(customerId);
    }

    // 2. Get or create the recurring $5/month Price ───────────────────────────
    let priceId: string | undefined = process.env.STRIPE_EXTRA_LOCATION_PRICE_ID || undefined;

    if (!priceId) {
      const cachedSnap = await db.ref('settings/stripe/extraLocationPriceId').get();
      priceId = (cachedSnap.val() as string | null) ?? undefined;
    }

    if (!priceId) {
      const product = await stripe.products.create({
        name: 'Extra Listing Location',
        description: 'Monthly fee for each additional location on a GigSpace listing ($5/month each).',
      });
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: 500, // $5.00 in cents
        currency: 'usd',
        recurring: { interval: 'month' },
      });
      priceId = price.id;
      await db.ref('settings/stripe/extraLocationPriceId').set(priceId);
    }

    // 3. Cancel any existing subscription on this service ────────────────────
    if (serviceId) {
      const existingSubSnap = await db.ref(`services/${serviceId}/subscriptionId`).get();
      const existingSubId = existingSubSnap.val() as string | null;
      if (existingSubId) {
        try {
          await stripe.subscriptions.cancel(existingSubId);
        } catch {
          // Non-fatal: subscription may already be cancelled or not found.
        }
      }
    }

    // 4. Create subscription in incomplete state ───────────────────────────────
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId, quantity: extraLocationCount }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription', payment_method_types: ['card', 'us_bank_account'] },
      expand: ['latest_invoice.payment_intent'],
    });

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | null;

    if (!paymentIntent?.client_secret) {
      res.status(500).json({ error: 'Stripe did not return a payment intent — check subscription status.' });
      return;
    }

    res.json({ clientSecret: paymentIntent.client_secret, subscriptionId: subscription.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/subscriptions/create-listing-subscription error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscriptions/cancel-listing-subscription
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/subscriptions/cancel-listing-subscription', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId } = req.body as { subscriptionId: string };
    if (!subscriptionId) {
      res.status(400).json({ error: 'subscriptionId is required' }); return;
    }
    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch {
      // Non-fatal: subscription may already be cancelled
    }
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/subscriptions/cancel-listing-subscription error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ─── Admin routes (secured — verifyAdmin middleware handles auth + role check) ─
app.use('/api/admin', adminRouter);

// ─── Affiliate routes ─────────────────────────────────────────────────────────
app.use('/api/affiliate', affiliateRouter);

export default app;
