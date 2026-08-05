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
): Promise<Reservation> {
  const balanceRef = walletRef.child(balanceField);
  let available = 0;

  // Two passes, because an aborted transaction is ambiguous: it means either
  // "genuinely not enough funds" or "the first, local invocation saw a cold
  // cache". The explicit read ahead of each attempt resolves it — it warms the
  // cache *and* gives an accurate figure for the error message. A second pass
  // therefore only reports insufficient when a fresh read agrees.
  for (let attempt = 0; attempt < 2; attempt++) {
    available = Number((await balanceRef.get()).val() ?? 0);
    if (available < amount) return { ok: false, available };

    const result = await balanceRef.transaction((current: number | null) => {
      const balance = Number(current ?? 0);
      if (balance < amount) return;                     // undefined = abort
      return round2(balance - amount);
    });

    if (result.committed) {
      await walletRef.child('updatedAt').set(Date.now());
      return { ok: true };
    }
    // Aborted: either a cold cache (retry succeeds) or a concurrent withdrawal
    // took the funds first (the next read reports the real, lower balance).
  }

  return { ok: false, available };
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
  const page = await stripe.transfers.list({ destination, created: { gte }, limit: 100 });
  for (const transfer of page.data) {
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
