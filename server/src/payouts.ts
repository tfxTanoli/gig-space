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

// Retries exist for cold-cache aborts, not for insufficiency: a truthful
// refusal returns immediately, so these only ever cost time on a cache miss.
const RESERVE_ATTEMPTS = 4;

/**
 * Atomically move `amount` out of `balanceField`. Concurrent callers are
 * serialised by the transaction, so the balance can never go negative however
 * many requests land at once.
 *
 * The transaction runs on the balance *field* rather than the wallet object on
 * purpose: a wallet-level "if (!current) abort" would intermittently report a
 * perfectly real wallet as missing.
 *
 * Two things guard against the cold-cache trap, which is what made this report
 * a funded wallet as insufficient in production. Firebase invokes the update
 * function with the *locally cached* value, which on a fresh connection — every
 * cold serverless invocation — is `null`. A null balance reads as 0, can never
 * satisfy the floor, and returning undefined there aborts the transaction for
 * good rather than retrying against the server. `get()` does not reliably seed
 * the cache the transaction consults, so:
 *
 *   1. A `value` listener is held for the duration. That genuinely keeps the
 *      node in the local cache, so the update function sees the real balance.
 *   2. The update function distinguishes `null` (cache cold — retry) from a
 *      real balance that is too small (a truthful refusal). A cache miss is
 *      therefore never reported to the seller as "insufficient balance".
 *
 * It still can never over-pay: every committed decrement is computed from a
 * real, server-confirmed balance inside the transaction.
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

  // Holding a listener keeps the balance in the local cache for as long as it
  // is attached, so the transaction below is handed the real value instead of
  // the `null` a cold connection would otherwise supply.
  const listener = balanceRef.on('value', () => { /* cache warmer only */ });

  try {
    for (let attempt = 0; attempt < RESERVE_ATTEMPTS; attempt++) {
      available = round2(Number((await balanceRef.get()).val() ?? 0) - floor);
      if (available < amount) return { ok: false, available: Math.max(0, available) };

      // Set only when the update function is handed a real balance. It is the
      // difference between "the funds aren't there" and "the cache was cold",
      // which look identical from an aborted transaction alone.
      let sawBalance = false;

      const result = await balanceRef.transaction((current: number | null) => {
        if (current === null) return;                   // cold cache — abort, then retry
        sawBalance = true;
        const balance = Number(current);
        // The floor must be enforced *inside* the transaction, not just by the
        // caller's earlier read. Otherwise two withdrawals that each separately
        // look affordable can both commit and together breach it — which for the
        // clearance floor means uncleared earnings leaving the platform.
        if (balance - amount < floor) return;           // undefined = abort
        return round2(balance - amount);
      });

      if (result.committed) {
        await walletRef.child('updatedAt').set(Date.now());
        return { ok: true };
      }

      if (sawBalance) {
        // A real balance was checked and refused, so this is genuine: either
        // insufficient funds or a concurrent withdrawal got there first. Report
        // the current figure rather than the one read before the attempt.
        const fresh = round2(Number((await balanceRef.get()).val() ?? 0) - floor);
        return { ok: false, available: Math.max(0, fresh) };
      }
      // Only ever saw null — the cache was cold, so try again.
    }

    return { ok: false, available: Math.max(0, available) };
  } finally {
    balanceRef.off('value', listener);
  }
}

/**
 * How much to claw back *now* from a party owed `whole` on the full charge,
 * given how much of the charge has been refunded in total and how much a
 * previous refund event already reversed.
 *
 * Proportional, because Stripe fires charge.refunded for partial refunds too —
 * a $10 refund on a $100 order must not reverse the seller's whole $90.
 *
 * Delta-based, because Stripe fires it again each time more is refunded. Only
 * the newly-refunded slice is debited, so replaying an event, or refunding in
 * instalments, can never take the same money twice.
 *
 * Never negative: a refund being reduced or an event arriving out of order
 * returns 0 rather than silently crediting someone.
 */
export function refundDebit(
  chargeTotal: number,
  refundedTotal: number,
  alreadyRefunded: number,
  whole: number,
): number {
  return Math.max(0, proportionalDelta(chargeTotal, alreadyRefunded, refundedTotal, whole));
}

/**
 * The signed adjustment for a party owed `whole` when the reversed portion of a
 * charge moves from `from` to `to`, both measured against the gross charge.
 *
 * Positive means claw back, negative means give back. Refunds only ever move in
 * one direction, but a dispute can be *won* — and then it has to restore
 * exactly what raising it took, which is why this is signed and why both
 * directions run through the same rounding.
 */
export function proportionalDelta(
  chargeTotal: number,
  from: number,
  to: number,
  whole: number,
): number {
  if (chargeTotal <= 0 || whole <= 0) return 0;
  // Clamped so an over-refund can't reverse more than was ever owed.
  const share = (part: number) =>
    round2(whole * (Math.min(Math.max(part, 0), chargeTotal) / chargeTotal));
  return round2(share(to) - share(from));
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
 * user's. This must never be reported to the user as though their own balance
 * were short — their wallet is fine, the account paying them out is not.
 */
export function isPlatformBalanceShort(err: unknown): boolean {
  return (err as { code?: string })?.code === 'balance_insufficient';
}

/* ─── Platform funding ─────────────────────────────────────────────────────────
 *
 * Transfers draw on the platform's *available* Stripe balance. Two very
 * different things make it too small, and they need opposite responses:
 *
 *   - Settlement lag. Card payments spend a couple of days in `pending` before
 *     they become available. Waiting genuinely fixes this.
 *   - A real shortfall. The money isn't in flight, it isn't there at all —
 *     usually because Stripe's processing fee, refunds or per-call charges have
 *     eaten the margin between what buyers paid and what sellers are owed. No
 *     amount of waiting fixes this; somebody has to top the account up.
 *
 * The two used to share one message that asserted the first cause. When the
 * second was true it sent the seller away to retry on a promise that could
 * never come good, and left nothing in the logs to tell an operator which case
 * they were in. So the balance is now read and the cases told apart.
 */

/** The platform's own Stripe balance, in dollars, for a single currency. */
export interface PlatformBalance {
  available: number;
  pending: number;
}

/**
 * Read the platform's Stripe balance, or null if it can't be read.
 *
 * Null means *unknown*, never *empty*: callers must fall back to letting the
 * transfer itself decide. A diagnostic call must never become the reason a
 * withdrawal that would have worked is refused.
 */
export async function readPlatformBalance(currency = 'usd'): Promise<PlatformBalance | null> {
  try {
    const balance = await stripe.balance.retrieve();
    const total = (rows: Array<{ currency: string; amount: number }>) => round2(
      rows.filter((row) => row.currency === currency)
          .reduce((sum, row) => sum + row.amount, 0) / 100,
    );
    return { available: total(balance.available), pending: total(balance.pending) };
  } catch (err) {
    console.error('readPlatformBalance failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Can the platform fund `amount` right now?
 *
 * `ok: false` only when a balance was actually read and it falls short — an
 * unreadable balance is reported as fundable so the transfer stays the
 * authority. The balance is handed back so the caller can log and phrase the
 * refusal without asking Stripe twice.
 */
export async function checkPlatformFunds(
  amount: number,
): Promise<{ ok: boolean; balance: PlatformBalance | null }> {
  const balance = await readPlatformBalance();
  return { ok: balance === null || balance.available >= amount, balance };
}

const SETTLING_MESSAGE =
  'Withdrawals are temporarily unavailable while recent payments settle. '
  + 'Your balance is unchanged — please try again in a couple of business days.';

// Says nothing it can't back up. An earlier draft claimed "our team has been
// alerted", which nothing in this codebase does — there is no alerting, only a
// console.error into the platform logs. Promising a response nobody is
// obliged to make is the same kind of untruth as promising settlement that
// isn't coming, so the message points at the one channel that does reach a
// human instead.
const SHORTFALL_MESSAGE =
  'Withdrawals are temporarily paused because of a problem on our side — this '
  + 'is not a problem with your balance, which is unchanged. Please contact '
  + 'support so we can sort it out for you.';

/**
 * What to tell the user when the platform can't fund their payout.
 *
 * Only promises settlement when money genuinely is in flight and would cover
 * the payout once it lands. An unknown balance keeps the softer wording, since
 * settlement lag is the likelier of the two and the alternative accuses the
 * platform of a shortfall we haven't confirmed.
 */
export function platformShortfallMessage(amount: number, balance: PlatformBalance | null): string {
  if (!balance) return SETTLING_MESSAGE;
  return balance.available + balance.pending >= amount ? SETTLING_MESSAGE : SHORTFALL_MESSAGE;
}

/**
 * The same situation phrased for the server log, with the figures an operator
 * needs to act on. "Balance too low" without numbers means opening the Stripe
 * dashboard to find out how low and whether waiting would have helped.
 */
export function describePlatformShortfall(
  amount: number,
  balance: PlatformBalance | null,
): string {
  if (!balance) return `requested $${money(amount)}, platform balance unreadable`;
  const short = round2(amount - balance.available);
  return `requested $${money(amount)}, available $${money(balance.available)}, `
    + `pending $${money(balance.pending)}, short $${money(short)} — `
    + (balance.available + balance.pending >= amount
      ? 'pending funds will cover it once they settle'
      : 'pending funds will NOT cover it; top up the platform balance');
}

/** Local two-decimal formatter — payouts.ts stays free of display imports. */
function money(amount: number): string {
  return (Number.isFinite(amount) ? amount : 0).toFixed(2);
}
