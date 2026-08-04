import Stripe from 'stripe';

// Shared Stripe client for controllers that need it (e.g. admin post deletion
// cancelling a post's location subscription). Mirrors the instance in app.ts.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

/**
 * True when a Stripe id we have stored can't be used with the API key this
 * server is running on.
 *
 * The cause that matters here is a mode switch. Ids minted under `sk_test_…`
 * are invisible to `sk_live_…`, so every Connect account, customer and
 * subscription id already sitting in the database becomes a dangling reference
 * the moment the keys change. Without this, a seller who onboarded in test mode
 * can never onboard again in live mode: the stored account id is reused
 * forever and every call against it fails.
 *
 * Stripe does not report the two cases the same way. Both shapes below were
 * captured from the live API on 2026-08-05 rather than assumed:
 *
 *   customers / subscriptions  invalid_request_error, code `resource_missing`
 *                              "No such customer: 'cus_…'"
 *   Connect accounts           api_error / invalid_request_error, **no code**,
 *                              message naming the mode mismatch:
 *                              "The account acct_… was a test account created
 *                               with a testmode key, and therefore can only be
 *                               used with testmode keys."
 *                              "You tried to create a live mode account link
 *                               for an account that was created in test mode."
 *
 * Because the Connect case carries no `code`, a `code === 'resource_missing'`
 * check alone silently misses it — hence the message match, kept narrow enough
 * not to fire on unrelated errors.
 *
 * Connection and rate-limit failures are deliberately excluded: a transient
 * outage must not be read as a dead id, or callers would discard a perfectly
 * good connected account and mint a duplicate.
 */
export function isUnusableStripeId(err: unknown): boolean {
  const e = err as { type?: string; code?: string; message?: string } | undefined;
  if (!e) return false;
  if (e.type === 'StripeConnectionError' || e.type === 'StripeRateLimitError') return false;
  if (e.code === 'resource_missing') return true;

  const msg = (e.message ?? '').toLowerCase();
  return msg.includes('testmode key') || (msg.includes('test mode') && msg.includes('live mode'));
}
