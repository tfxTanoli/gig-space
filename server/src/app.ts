import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';

// ─── Firebase Admin ───────────────────────────────────────────────────────────
if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8')
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  } else {
    admin.initializeApp({
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }
}
const db = admin.database();

// ─── Stripe ───────────────────────────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// ─── Express ──────────────────────────────────────────────────────────────────
const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const PLATFORM_FEE_PERCENT = 5;

app.use(cors({ origin: FRONTEND_URL }));

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
    success_url: `${FRONTEND_URL}/buyer-dashboard?tab=Orders&payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${FRONTEND_URL}/buyer-dashboard?tab=Messages`,
    metadata: {
      buyerId, sellerId, serviceId, conversationId, messageId,
      offerAmount: String(offerAmount),
      platformFeePercent: String(PLATFORM_FEE_PERCENT),
      platformFeeCents: String(platformFeeCents),
      sellerAmountCents: String(sellerAmountCents),
    },
  });

  res.json({ sessionId: session.id, url: session.url });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/approve-delivery
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/orders/approve-delivery', requireAuth, async (req: AuthRequest, res: Response) => {
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

  await db.ref().update(updates);
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/connect/link
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/connect/link', requireAuth, async (req: AuthRequest, res: Response) => {
  const sellerId = req.uid!;
  const returnUrl = `${FRONTEND_URL}/seller-dashboard?tab=Payouts`;
  const refreshUrl = `${FRONTEND_URL}/seller-dashboard?tab=Payouts&connect_refresh=true`;

  const walletSnap = await db.ref(`wallets/${sellerId}/stripeConnectedAccountId`).get();
  let stripeAccountId: string = walletSnap.val() as string;

  if (!stripeAccountId) {
    const userSnap = await db.ref(`users/${sellerId}`).get();
    const user = userSnap.val() as { email?: string } | null;
    const account = await stripe.accounts.create({
      type: 'express',
      email: user?.email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    });
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
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/connect/status
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/connect/status', requireAuth, async (req: AuthRequest, res: Response) => {
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
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/withdraw
// ─────────────────────────────────────────────────────────────────────────────
const MINIMUM_WITHDRAWAL = 10;

app.post('/api/withdraw', requireAuth, async (req: AuthRequest, res: Response) => {
  const sellerId = req.uid!;
  const { amount } = req.body as { amount: number };

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
});

// ─────────────────────────────────────────────────────────────────────────────
// Webhook handlers
// ─────────────────────────────────────────────────────────────────────────────
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const meta = session.metadata;
  if (!meta) return;

  const { buyerId, sellerId, serviceId, conversationId, messageId,
    offerAmount, platformFeePercent, platformFeeCents, sellerAmountCents } = meta;

  const existing = await db.ref('payments')
    .orderByChild('stripeSessionId').equalTo(session.id).limitToFirst(1).get();
  if (existing.exists()) { console.log(`Session ${session.id} already processed`); return; }

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

  await db.ref().update({
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
  });
  console.log(`Order ${orderId} created for session ${session.id}`);
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

export default app;
