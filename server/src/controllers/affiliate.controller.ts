import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { type Response } from 'express';
import { type AuthRequest } from '../middleware/requireAuth';
import { formatMoney } from '../utils/money';
import { isUnusableStripeId } from '../stripeClient';
import {
  reserveFunds, releaseFunds, createPayoutTransfer, findTransferForWithdrawal,
  isPlatformBalanceShort, PLATFORM_BALANCE_SHORT_MESSAGE,
  clearanceState, daysUntil, type ClearanceState,
} from '../payouts';

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
        clearingBalance: 0,
        withdrawableBalance: 0,
        nextClearsAt: null,
        lifetimeEarnings: 0,
        totalWithdrawn: 0,
        stripeConnectedAccountId: null,
      });
      return;
    }

    const data = snap.val() as AffiliateData;
    const available = data.availableBalance ?? 0;
    const { uncleared, nextClearsAt } = await affiliateClearance(affiliateId);

    res.json({
      referralCode: data.referralCode ?? '',
      totalClicks: data.totalClicks ?? 0,
      totalReferrals: data.totalReferrals ?? 0,
      pendingBalance: data.pendingBalance ?? 0,
      availableBalance: available,
      // Commissions released but still seasoning, and what can actually be
      // withdrawn today. See the clearance notes in payouts.ts.
      clearingBalance: uncleared,
      withdrawableBalance: Math.max(0, Number((available - uncleared).toFixed(2))),
      nextClearsAt,
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
        // Lets the dashboard show what is still seasoning without a second
        // round trip, and match the gate the withdraw endpoint enforces.
        clearsAt: (c as { clearsAt?: number }).clearsAt ?? null,
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

// Commissions released but still inside their clearance window. Mirrors the
// seller calculation in app.ts, reading affiliateCommissions instead of the
// wallet ledger — only released rows carry `clearsAt`.
async function affiliateClearance(affiliateId: string): Promise<ClearanceState> {
  const snap = await admin.database().ref('affiliateCommissions')
    .orderByChild('affiliateId').equalTo(affiliateId).get();
  return clearanceState(
    snap.val() as Record<string, Record<string, unknown>> | null, 'commissionAmount',
  );
}

// Records a completed transfer. The balance was already debited at reservation
// time, so this never touches availableBalance.
async function settleAffiliatePayout(
  affiliateId: string, payoutId: string, amount: number, transferId: string,
): Promise<void> {
  const db = admin.database();
  const now = Date.now();
  await db.ref().update({
    [`affiliatePayouts/${payoutId}/status`]:           'paid',
    [`affiliatePayouts/${payoutId}/stripeTransferId`]: transferId,
    [`affiliatePayouts/${payoutId}/settledAt`]:        now,
    [`affiliates/${affiliateId}/totalWithdrawn`]: admin.database.ServerValue.increment(amount),
    [`affiliates/${affiliateId}/updatedAt`]:     now,
  });
}

// Mirrors reconcilePendingWithdrawals() in app.ts — see the comment there for
// why Stripe's records, not a replayed idempotency key, are the source of truth.
async function reconcilePendingAffiliatePayouts(affiliateId: string, destination: string): Promise<void> {
  try {
    const db = admin.database();
    const snap = await db.ref('affiliatePayouts')
      .orderByChild('affiliateId').equalTo(affiliateId).get();
    if (!snap.exists()) return;

    const rows = snap.val() as Record<string, {
      amount?: number; status?: string; createdAt?: number;
    }>;

    for (const [payoutId, row] of Object.entries(rows)) {
      if (row.status !== 'pending' || !row.amount) continue;
      if (Date.now() - (row.createdAt ?? 0) < 2 * 60 * 1000) continue;

      const transfer = await findTransferForWithdrawal(destination, payoutId, row.createdAt ?? 0);
      if (transfer) {
        console.warn(`/api/affiliate/withdraw: reconciled ${payoutId} — transfer ${transfer.id} had succeeded unrecorded`);
        await settleAffiliatePayout(affiliateId, payoutId, row.amount, transfer.id);
      } else {
        console.warn(`/api/affiliate/withdraw: reconciled ${payoutId} — no transfer exists, releasing $${formatMoney(row.amount)}`);
        await releaseFunds(db.ref(`affiliates/${affiliateId}`), 'availableBalance', row.amount);
        await db.ref(`affiliatePayouts/${payoutId}`).update({
          status: 'failed', failureReason: 'No matching transfer found during reconciliation', settledAt: Date.now(),
        });
      }
    }
  } catch (err) {
    console.error('/api/affiliate/withdraw: reconciliation pass failed:', err);
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

    const stripeAccountId = affiliate.stripeConnectedAccountId;
    if (!stripeAccountId) {
      res.status(400).json({ error: 'Connect a Stripe account first' }); return;
    }

    let account: Stripe.Account;
    try {
      account = await stripe.accounts.retrieve(stripeAccountId);
    } catch (err) {
      // Refuse rather than guess — see the seller withdraw path in app.ts.
      if (!isUnusableStripeId(err)) throw err;
      res.status(400).json({ error: 'Connect a Stripe account first' }); return;
    }
    if (!account.payouts_enabled) {
      res.status(400).json({ error: 'Complete Stripe onboarding before withdrawing' }); return;
    }

    await reconcilePendingAffiliatePayouts(affiliateId, stripeAccountId);

    // Clearance gate — same rule as seller payouts, see payouts.ts.
    const { uncleared, nextClearsAt } = await affiliateClearance(affiliateId);
    if (uncleared > 0) {
      const availableNow = Number(
        (await db.ref(`affiliates/${affiliateId}/availableBalance`).get()).val() ?? 0,
      );
      const withdrawable = Math.max(0, Number((availableNow - uncleared).toFixed(2)));
      if (amount > withdrawable) {
        res.status(400).json({
          error: withdrawable > 0
            ? `You can withdraw $${formatMoney(withdrawable)} right now. `
              + `$${formatMoney(uncleared)} is still clearing and unlocks in ${daysUntil(nextClearsAt!)} day(s).`
            : `Your commissions are still clearing. $${formatMoney(uncleared)} unlocks in `
              + `${daysUntil(nextClearsAt!)} day(s).`,
          withdrawable, clearing: uncleared, nextClearsAt,
        });
        return;
      }
    }

    // Reserve before paying — same ordering as the seller path, for the same
    // reason: a crash after the transfer must never leave the funds both sent
    // and still spendable, and concurrent requests must not both clear the
    // same balance. See server/src/payouts.ts.
    const payoutId = db.ref('affiliatePayouts').push().key!;
    const affiliateRef = db.ref(`affiliates/${affiliateId}`);
    // Clearance floor enforced inside the transaction — see app.ts.
    const reservation = await reserveFunds(affiliateRef, 'availableBalance', amount, uncleared);

    if (!reservation.ok) {
      res.status(400).json({
        error: `Insufficient balance. Available: $${formatMoney(reservation.available ?? 0)}`,
      });
      return;
    }

    // Re-check the floor against current figures — a commission released
    // mid-request would have made the floor used above stale. See app.ts.
    const afterUncleared = (await affiliateClearance(affiliateId)).uncleared;
    const afterBalance = Number(
      (await db.ref(`affiliates/${affiliateId}/availableBalance`).get()).val() ?? 0,
    );
    if (afterBalance < afterUncleared) {
      await releaseFunds(affiliateRef, 'availableBalance', amount);
      console.warn(
        `/api/affiliate/withdraw: released ${affiliateId}'s reservation of $${formatMoney(amount)} — `
        + `a new commission landed mid-request and the clearance floor no longer held.`,
      );
      res.status(409).json({
        error: 'Your balance changed while this withdrawal was being prepared. Please try again.',
      });
      return;
    }

    await db.ref(`affiliatePayouts/${payoutId}`).set({
      affiliateId, amount, status: 'pending', createdAt: Date.now(),
    });

    let transfer: Stripe.Transfer;
    try {
      transfer = await createPayoutTransfer(stripeAccountId, amount, payoutId, affiliateId);
    } catch (err) {
      await releaseFunds(affiliateRef, 'availableBalance', amount);
      await db.ref(`affiliatePayouts/${payoutId}`).update({
        status: 'failed',
        failureReason: err instanceof Error ? err.message : 'Transfer failed',
        settledAt: Date.now(),
      });

      if (isPlatformBalanceShort(err)) {
        console.error(
          `/api/affiliate/withdraw: platform balance too low to transfer $${formatMoney(amount)} ` +
          `to ${stripeAccountId} (affiliate ${affiliateId}).`,
        );
        res.status(400).json({ error: PLATFORM_BALANCE_SHORT_MESSAGE }); return;
      }
      throw err;
    }

    await settleAffiliatePayout(affiliateId, payoutId, amount, transfer.id);

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

    // Discard an id minted in the other mode so a fresh account is created
    // below — otherwise the affiliate is stuck on a dead id forever.
    if (stripeAccountId) {
      try {
        await stripe.accounts.retrieve(stripeAccountId);
      } catch (err) {
        if (!isUnusableStripeId(err)) throw err;
        console.warn(`/api/affiliate/connect/link: discarding unusable account ${stripeAccountId} for ${affiliateId}`);
        stripeAccountId = '';
      }
    }

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
    let account: Stripe.Account;
    try {
      account = await stripe.accounts.retrieve(stripeAccountId);
    } catch (err) {
      if (!isUnusableStripeId(err)) throw err;
      res.json({ payoutsEnabled: false, chargesEnabled: false, detailsSubmitted: false }); return;
    }
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
