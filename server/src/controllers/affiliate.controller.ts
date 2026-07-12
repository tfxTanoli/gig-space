import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { type Response } from 'express';
import { type AuthRequest } from '../middleware/requireAuth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
// FRONTEND_URL may be a comma-separated list of allowed origins (see app.ts's
// CORS setup) — Stripe Connect return/refresh URLs need one canonical URL,
// so use the first origin (the raw value produced a malformed href).
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
const MINIMUM_WITHDRAWAL = 10;

interface AffiliateData {
  referralCode?: string;
  totalClicks?: number;
  totalReferrals?: number;
  pendingBalance?: number;
  availableBalance?: number;
  lifetimeEarnings?: number;
  totalWithdrawn?: number;
  stripeConnectedAccountId?: string;
  createdAt?: number;
}

interface CommissionData {
  affiliateId?: string;
  orderId?: string;
  buyerId?: string;
  buyerName?: string;
  orderAmount?: number;
  platformFeeAmount?: number;
  commissionAmount?: number;
  status?: string;
  createdAt?: number;
  releasedAt?: number;
}

interface ReferralData {
  affiliateId?: string;
  referredUserId?: string;
  referredUserName?: string;
  referredUserEmail?: string;
  status?: string;
  createdAt?: number;
}

interface PayoutData {
  affiliateId?: string;
  amount?: number;
  status?: string;
  stripeTransferId?: string;
  createdAt?: number;
}

// GET /api/affiliate/me
export async function getAffiliate(req: AuthRequest, res: Response): Promise<void> {
  try {
    const affiliateId = req.uid!;
    const db = admin.database();
    const snap = await db.ref(`affiliates/${affiliateId}`).get();

    if (!snap.exists()) {
      res.json({
        referralCode: '',
        totalClicks: 0,
        totalReferrals: 0,
        pendingBalance: 0,
        availableBalance: 0,
        lifetimeEarnings: 0,
        totalWithdrawn: 0,
        stripeConnectedAccountId: null,
      });
      return;
    }

    const data = snap.val() as AffiliateData;
    res.json({
      referralCode: data.referralCode ?? '',
      totalClicks: data.totalClicks ?? 0,
      totalReferrals: data.totalReferrals ?? 0,
      pendingBalance: data.pendingBalance ?? 0,
      availableBalance: data.availableBalance ?? 0,
      lifetimeEarnings: data.lifetimeEarnings ?? 0,
      totalWithdrawn: data.totalWithdrawn ?? 0,
      stripeConnectedAccountId: data.stripeConnectedAccountId ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/affiliate/me error:', msg);
    res.status(500).json({ error: msg });
  }
}

// GET /api/affiliate/commissions
export async function getCommissions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const affiliateId = req.uid!;
    const db = admin.database();
    const snap = await db.ref('affiliateCommissions')
      .orderByChild('affiliateId')
      .equalTo(affiliateId)
      .get();

    const data: Record<string, CommissionData> = snap.val() ?? {};
    const commissions = Object.entries(data)
      .map(([id, c]) => ({
        id,
        orderId: c.orderId ?? '',
        buyerId: c.buyerId ?? '',
        buyerName: c.buyerName ?? 'Buyer',
        orderAmount: c.orderAmount ?? 0,
        platformFeeAmount: c.platformFeeAmount ?? 0,
        commissionAmount: c.commissionAmount ?? 0,
        status: c.status ?? 'pending',
        createdAt: c.createdAt ?? 0,
        releasedAt: c.releasedAt ?? null,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json({ commissions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/affiliate/commissions error:', msg);
    res.status(500).json({ error: msg });
  }
}

// GET /api/affiliate/referrals
export async function getReferrals(req: AuthRequest, res: Response): Promise<void> {
  try {
    const affiliateId = req.uid!;
    const db = admin.database();
    const snap = await db.ref('affiliateReferrals')
      .orderByChild('affiliateId')
      .equalTo(affiliateId)
      .get();

    const data: Record<string, ReferralData> = snap.val() ?? {};
    const referrals = Object.entries(data)
      .map(([id, r]) => ({
        id,
        referredUserId: r.referredUserId ?? '',
        referredUserName: r.referredUserName ?? 'User',
        referredUserEmail: r.referredUserEmail ?? '',
        status: r.status ?? 'signed_up',
        createdAt: r.createdAt ?? 0,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json({ referrals });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/affiliate/referrals error:', msg);
    res.status(500).json({ error: msg });
  }
}

// GET /api/affiliate/payouts
export async function getPayouts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const affiliateId = req.uid!;
    const db = admin.database();
    const snap = await db.ref('affiliatePayouts')
      .orderByChild('affiliateId')
      .equalTo(affiliateId)
      .get();

    const data: Record<string, PayoutData> = snap.val() ?? {};
    const payouts = Object.entries(data)
      .map(([id, p]) => ({
        id,
        amount: p.amount ?? 0,
        status: p.status ?? 'paid',
        stripeTransferId: p.stripeTransferId ?? '',
        createdAt: p.createdAt ?? 0,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json({ payouts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/affiliate/payouts error:', msg);
    res.status(500).json({ error: msg });
  }
}

// POST /api/affiliate/withdraw
export async function requestWithdrawal(req: AuthRequest, res: Response): Promise<void> {
  try {
    const affiliateId = req.uid!;
    const { amount } = req.body as { amount: number };

    if (!amount || amount < MINIMUM_WITHDRAWAL) {
      res.status(400).json({ error: `Minimum withdrawal is $${MINIMUM_WITHDRAWAL}` }); return;
    }

    const db = admin.database();
    const snap = await db.ref(`affiliates/${affiliateId}`).get();
    if (!snap.exists()) { res.status(404).json({ error: 'Affiliate account not found' }); return; }

    const affiliate = snap.val() as AffiliateData;
    const available = affiliate.availableBalance ?? 0;

    if (amount > available) {
      res.status(400).json({ error: `Insufficient balance. Available: $${available.toFixed(2)}` }); return;
    }

    const stripeAccountId = affiliate.stripeConnectedAccountId;
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
    const payoutId = db.ref('affiliatePayouts').push().key!;

    await db.ref().update({
      [`affiliatePayouts/${payoutId}`]: {
        affiliateId, amount, stripeTransferId: transfer.id, status: 'paid', createdAt: now,
      },
      [`affiliates/${affiliateId}/availableBalance`]: admin.database.ServerValue.increment(-amount),
      [`affiliates/${affiliateId}/totalWithdrawn`]:   admin.database.ServerValue.increment(amount),
      [`affiliates/${affiliateId}/updatedAt`]:        now,
    });

    res.json({ success: true, transferId: transfer.id, payoutId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/affiliate/withdraw error:', msg);
    res.status(500).json({ error: msg });
  }
}

// POST /api/affiliate/connect/link
export async function getConnectLink(req: AuthRequest, res: Response): Promise<void> {
  try {
    const affiliateId = req.uid!;
    const returnUrl  = `${FRONTEND_URL}/affiliate-dashboard?tab=Settings`;
    const refreshUrl = `${FRONTEND_URL}/affiliate-dashboard?tab=Settings&connect_refresh=true`;

    const db = admin.database();
    const snap = await db.ref(`affiliates/${affiliateId}/stripeConnectedAccountId`).get();
    let stripeAccountId: string = snap.val() as string;

    if (!stripeAccountId) {
      const userSnap = await db.ref(`users/${affiliateId}`).get();
      const user = userSnap.val() as { email?: string } | null;

      const account = await stripe.accounts.create({
        controller: {
          stripe_dashboard: { type: 'express' },
          fees: { payer: 'application' },
          losses: { payments: 'application' },
          requirement_collection: 'stripe',
        },
        ...(user?.email ? { email: user.email } : {}),
      });

      stripeAccountId = account.id;
      await db.ref(`affiliates/${affiliateId}`).update({
        stripeConnectedAccountId: stripeAccountId,
        updatedAt: Date.now(),
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
    console.error('/api/affiliate/connect/link error:', msg);
    res.status(500).json({ error: msg });
  }
}

// POST /api/affiliate/connect/status
export async function getConnectStatus(req: AuthRequest, res: Response): Promise<void> {
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
    console.error('/api/affiliate/connect/status error:', msg);
    res.status(500).json({ error: msg });
  }
}
