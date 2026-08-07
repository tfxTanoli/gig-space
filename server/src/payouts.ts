import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { stripe } from './stripeClient';

/**
 * Shared machinery for paying a wallet balance out to a Connect account.
 *
 * The ordering here is the whole point. The original flow created the Stripe
 * transfer first and debited the wallet afterwards, which left two ways to pay
 * someone twice with real money:
 *
 *   1. The transfer succeeds, then the database write fails. The money has left
 *      the platform but the seller's balance is untouched, so they can withdraw
 *      the same funds again. Silent, and it only shows up as a shortfall later.
 *   2. Two requests arrive together. Both read the same balance, both pass the
 *      "amount > available" check, and both transfer — an overdraft the balance
 *      check was supposed to prevent.
 *
 * So funds are now reserved first, inside a Realtime Database transaction that
 * serialises concurrent callers, and only then does money move. If the transfer
 * fails the reservation is released. The worst remaining case is a transfer that
 * succeeds while the final bookkeeping write fails — the balance is already
 * debited, so nobody is paid twice, and the withdrawal is left in `pending` for
 * reconcilePendingWithdrawals() to settle from Stripe's own records.
 */

export interface Reservation {
  ok: boolean;
  available?: number;
}

/**
 * Atomically move `amount` out of `balanceField`. Concurrent callers are
 * serialised by the transaction, so the balance can never go negative however
 * many requests land at once.
 *
 * The transaction runs on the balance *field* rather than the wallet object on
 * purpose. Firebase re-invokes the update function with `null` whenever the
 * node isn't locally cached, and returning undefined from that first call
 * aborts for good — so a wallet-level "if (!current) abort" would intermittently
 * report a perfectly real wallet as missing. Treating a null balance as 0 has
 * no such failure mode: the worst it can do is report "insufficient", which is
 * both true and safe. It can never over-pay.
 */
export async function reserveFunds(
  walletRef: admin.database.Reference,
  balanceField: string,
  amount: number,
  minRemaining = 0,
): Promise<Reservation> {
  const balanceRef = walletRef.child(balanceField);
  const floor = round2(minRemaining);
  let available = 0;

  // Two passes, because an aborted transaction is ambiguous: it means either
  // "genuinely not enough funds" or "the first, local invocation saw a cold
  // cache". The explicit read ahead of each attempt resolves it — it warms the
  // cache *and* gives an accurate figure for the error message. A second pass
  // therefore only reports insufficient when a fresh read agrees.
  for (let attempt = 0; attempt < 2; attempt++) {
    available = round2(Number((await balanceRef.get()).val() ?? 0) - floor);
    if (available < amount) return { ok: false, available: Math.max(0, available) };

    const result = await balanceRef.transaction((current: number | null) => {
      const balance = Number(current ?? 0);
      // The floor must be enforced *inside* the transaction, not just by the
      // caller's earlier read. Otherwise two withdrawals that each separately
      // look affordable can both commit and together breach it — which for the
      // clearance floor means uncleared earnings leaving the platform.
      if (balance - amount < floor) return;             // undefined = abort
      return round2(balance - amount);
    });

    if (result.committed) {
      await walletRef.child('updatedAt').set(Date.now());
      return { ok: true };
    }
    // Aborted: either a cold cache (retry succeeds) or a concurrent withdrawal
    // took the funds first (the next read reports the real, lower balance).
  }

  return { ok: false, available: Math.max(0, available) };
}

/** Put a reservation back after the transfer failed. */
export async function releaseFunds(
  walletRef: admin.database.Reference,
  balanceField: string,
  amount: number,
): Promise<void> {
  await walletRef.child(balanceField).transaction(
    (current: number | null) => round2(Number(current ?? 0) + amount),
  );
  await walletRef.child('updatedAt').set(Date.now());
}

// Money is stored as a float, so trim the drift that repeated add/subtract
// introduces (0.1 + 0.2 territory) before it reaches a balance.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ─── Clearance period ─────────────────────────────────────────────────────────
 *
 * Earnings are credited the moment a buyer approves, but they are not
 * withdrawable straight away: each release carries a `clearsAt` timestamp and
 * stays locked until it passes. Two reasons, one operational and one financial.
 *
 * Operationally, card payments take about two business days to reach the
 * platform's *available* Stripe balance, which is what transfers draw on. A
 * seller withdrawing the same day would otherwise hit a failure that has
 * nothing to do with them.
 *
 * Financially, it leaves a window in which a chargeback can be handled before
 * the money is gone. Connect is configured with losses.payments = 'application',
 * so a disputed payment comes out of the platform's balance either way.
 *
 * Deliberately there is no sweep job and no third balance field. Withdrawable
 * is derived as `availableBalance - uncleared`, and `uncleared` shrinks by
 * itself as timestamps pass. Nothing has to run on a schedule for a seller to
 * get paid, which is the failure mode a cron would introduce.
 *
 * The invariant that makes the subtraction safe: uncleared funds can never be
 * withdrawn, so availableBalance is always at least the uncleared total. A new
 * release raises both by the same amount, leaving withdrawable unchanged.
 */

export const CLEARANCE_DAYS_DEFAULT = 10;

export interface ClearanceState {
  /** Credited but not yet withdrawable. */
  uncleared: number;
  /** When the next tranche unlocks, or null if nothing is pending. */
  nextClearsAt: number | null;
}

/**
 * Total still inside its clearance window. Rows without `clearsAt` are ignored,
 * which is what distinguishes a release from the escrow credit written earlier
 * in the order's life — only releases carry the timestamp.
 */
export function clearanceState(
  rows: Record<string, Record<string, unknown>> | null,
  amountKey: string,
  now: number = Date.now(),
): ClearanceState {
  if (!rows) return { uncleared: 0, nextClearsAt: null };

  let uncleared = 0;
  let nextClearsAt: number | null = null;

  for (const row of Object.values(rows)) {
    const clearsAt = Number(row?.clearsAt ?? 0);
    if (!clearsAt || clearsAt <= now) continue;
    const amount = Number(row?.[amountKey] ?? 0);
    if (!amount) continue;
    uncleared += amount;
    if (nextClearsAt === null || clearsAt < nextClearsAt) nextClearsAt = clearsAt;
  }

  return { uncleared: round2(uncleared), nextClearsAt };
}

/** Whole days until `timestamp`, floored at 1 so it never reads "in 0 days". */
export function daysUntil(timestamp: number, now: number = Date.now()): number {
  return Math.max(1, Math.ceil((timestamp - now) / 86_400_000));
}

/**
 * Create the transfer for a reserved withdrawal.
 *
 * `idempotencyKey` stops a network-level retry (the Stripe SDK retries on its
 * own) turning one withdrawal into two transfers. The withdrawal id is also
 * stamped into metadata, which is what makes reconciliation possible: Stripe's
 * idempotency keys expire after 24 hours, so replaying the request is not a
 * safe way to ask "did this already happen?" — after a day it would create a
 * second transfer. Metadata is permanent, so we look the transfer up instead.
 */
export async function createPayoutTransfer(
  destination: string,
  amount: number,
  withdrawalId: string,
  ownerId: string,
): Promise<Stripe.Transfer> {
  return stripe.transfers.create(
    {
      amount: Math.round(amount * 100),
      currency: 'usd',
      destination,
      metadata: { withdrawalId, ownerId },
    },
    { idempotencyKey: `withdrawal_${withdrawalId}` },
  );
}

/**
 * Find a transfer we may have created but failed to record, by the withdrawal
 * id stamped into its metadata. Returns null when the transfer never happened.
 */
export async function findTransferForWithdrawal(
  destination: string,
  withdrawalId: string,
  createdAtMs: number,
): Promise<Stripe.Transfer | null> {
  // A minute of slack either side covers clock skew between us and Stripe.
  const gte = Math.floor(createdAtMs / 1000) - 60;

  // Every page, not just the first. A single page would mean concluding "no
  // transfer exists" whenever the match sits past the page boundary — and this
  // function's caller responds to that by handing the money back to the
  // balance, so a missed match pays the same withdrawal out twice.
  for await (const transfer of stripe.transfers.list({ destination, created: { gte }, limit: 100 })) {
    if (transfer.metadata?.withdrawalId === withdrawalId) return transfer;
  }
  return null;
}

/**
 * True when a transfer failed because the *platform* balance is short, not the
 * user's. Card payments take a couple of days to reach the available balance
 * that transfers draw on, so this is expected early in an account's life and
 * must not be reported to the user as though their own balance were short.
 */
export function isPlatformBalanceShort(err: unknown): boolean {
  return (err as { code?: string })?.code === 'balance_insufficient';
}

export const PLATFORM_BALANCE_SHORT_MESSAGE =
  'Withdrawals are temporarily unavailable while recent payments settle. '
  + 'Your balance is unchanged — please try again in a couple of business days.';
