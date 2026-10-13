import * as admin from 'firebase-admin';
import type Stripe from 'stripe';
import { stripe, isUnusableStripeId } from './stripeClient';

/* ─── Paid extra locations ─────────────────────────────────────────────────────
 * Extra locations on a post cost $5/month each, billed by a Stripe
 * subscription. The browser used to be trusted to only save locations it had
 * paid for. Now the server records what Stripe says is paid:
 *
 *   listingPaid/{serviceId} = { subscriptionId, quantity, qkey, updatedAt }
 *
 * and the database rules refuse extra locations on a live or paused post
 * beyond `quantity` (qkey is quantity as a string: "no extraLocations/{qkey}"
 * is how a rule says "at most quantity entries"). Only this server writes it.
 *
 * It is kept in step with Stripe by:
 *  - confirmPaid(): right after the seller pays (the editor calls it before
 *    saving the post);
 *  - syncService(): whenever the editor opens a post, plus the reduce/cancel
 *    endpoints;
 *  - the customer.subscription.* webhooks and a daily reconcile, so a
 *    subscription that ends (card fails, cancelled in Stripe) takes its
 *    locations off the post.
 * A Stripe error that isn't a definite answer (network, rate limit) never
 * removes anything: the post keeps its locations until Stripe says otherwise.
 */

const db = () => admin.database();

/** Whether the subscription currently pays for its locations. */
export function isPaying(sub: Stripe.Subscription): boolean {
  if (['active', 'trialing', 'past_due'].includes(sub.status)) return true;
  // A bank (ACH) first payment stays "processing" for days with the
  // subscription "incomplete". Count it; if it fails, Stripe ends the
  // subscription and the sync below removes the locations.
  if (sub.status === 'incomplete') {
    const inv = sub.latest_invoice as Stripe.Invoice | string | null;
    const pi = inv && typeof inv !== 'string' ? (inv.payment_intent as Stripe.PaymentIntent | string | null) : null;
    return !!pi && typeof pi !== 'string' && (pi.status === 'processing' || pi.status === 'succeeded');
  }
  return false;
}

const quantityOf = (sub: Stripe.Subscription) => sub.items.data[0]?.quantity ?? 0;

async function retrieve(subscriptionId: string): Promise<Stripe.Subscription | 'gone'> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice.payment_intent'] });
  } catch (err) {
    // A definite "no such subscription" (incl. an id from the other Stripe
    // mode) means nothing is paid. Anything else is rethrown so callers leave
    // the post alone.
    if (isUnusableStripeId(err)) return 'gone';
    throw err;
  }
}

function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (v && typeof v === 'object') return Object.values(v).filter((x): x is string => typeof x === 'string');
  return [];
}

/**
 * Records what is paid for a post and makes the post agree: extra locations
 * beyond the paid quantity are removed, and with nothing paid the record and
 * the post's subscriptionId are cleared.
 */
export async function applyPaid(serviceId: string, subscriptionId: string | null, quantity: number): Promise<number> {
  const svc = (await db().ref(`services/${serviceId}`).get()).val() as { extraLocations?: unknown; subscriptionId?: string } | null;
  const updates: Record<string, unknown> = {};
  const extras = asList(svc?.extraLocations);
  if (subscriptionId && quantity > 0) {
    updates[`listingPaid/${serviceId}`] = { subscriptionId, quantity, qkey: String(quantity), updatedAt: Date.now() };
    if (svc) {
      updates[`services/${serviceId}/subscriptionId`] = subscriptionId;
      if (extras.length > quantity) updates[`services/${serviceId}/extraLocations`] = extras.slice(0, quantity);
    }
  } else {
    updates[`listingPaid/${serviceId}`] = null;
    if (svc) {
      updates[`services/${serviceId}/subscriptionId`] = null;
      // Drafts keep the seller's picks until they pay; anything else loses
      // locations that are no longer paid for.
      const status = (await db().ref(`services/${serviceId}/status`).get()).val();
      if (status !== 'draft' && extras.length) updates[`services/${serviceId}/extraLocations`] = null;
    }
  }
  await db().ref().update(updates);
  return subscriptionId ? quantity : 0;
}

/** A newer paid subscription for this post that never got recorded (tab closed after paying). */
async function findUnrecorded(serviceId: string): Promise<Stripe.Subscription | null> {
  try {
    const found = await stripe.subscriptions.search({
      query: `metadata['serviceId']:'${serviceId.replace(/'/g, '')}'`,
      expand: ['data.latest_invoice.payment_intent'],
      limit: 10,
    });
    return found.data.filter(isPaying).sort((a, b) => b.created - a.created)[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Brings one post in line with Stripe and returns how many extra locations
 * are paid. Leaves the post untouched if Stripe can't give a definite answer.
 */
export async function syncService(serviceId: string): Promise<number> {
  const current = (await db().ref(`services/${serviceId}/subscriptionId`).get()).val() as string | null;
  let sub: Stripe.Subscription | 'gone' | null = current ? await retrieve(current) : null;
  if (!sub || sub === 'gone' || !isPaying(sub)) {
    const unrecorded = await findUnrecorded(serviceId);
    if (unrecorded) sub = unrecorded;
  }
  if (sub && sub !== 'gone' && isPaying(sub)) return applyPaid(serviceId, sub.id, quantityOf(sub));
  if (current || sub === 'gone') return applyPaid(serviceId, null, 0);
  // No subscription anywhere: make sure no stale record lingers.
  await db().ref(`listingPaid/${serviceId}`).remove();
  return 0;
}

/**
 * Called by the editor right after a successful payment, before it saves the
 * post. Waits briefly for Stripe to mark the first invoice paid, records the
 * new quantity, and only then cancels the subscription it replaces (crediting
 * that one's unused time).
 */
export async function confirmPaid(uid: string, serviceId: string, subscriptionId: string): Promise<number> {
  const [user, svc] = await Promise.all([
    db().ref(`users/${uid}`).get().then((s) => s.val() as { stripeCustomerId?: string; role?: string } | null),
    db().ref(`services/${serviceId}`).get().then((s) => s.val() as { sellerId?: string; subscriptionId?: string } | null),
  ]);
  if (!svc || (svc.sellerId !== uid && user?.role !== 'admin')) throw Object.assign(new Error('Not your post'), { status: 403 });

  let sub: Stripe.Subscription | 'gone' = 'gone';
  for (let i = 0; i < 8; i++) {
    sub = await retrieve(subscriptionId);
    if (sub === 'gone' || isPaying(sub)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (sub === 'gone') throw Object.assign(new Error('Subscription not found'), { status: 404 });
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  if (user?.role !== 'admin' && customer !== user?.stripeCustomerId) throw Object.assign(new Error('Not your subscription'), { status: 403 });
  if (sub.metadata?.serviceId && sub.metadata.serviceId !== serviceId) throw Object.assign(new Error('Subscription is for another post'), { status: 400 });
  if (!isPaying(sub)) throw Object.assign(new Error('Payment has not gone through yet. Please try again in a moment.'), { status: 409 });

  const paid = await applyPaid(serviceId, sub.id, quantityOf(sub));
  const old = svc.subscriptionId;
  if (old && old !== sub.id) {
    try { await stripe.subscriptions.cancel(old, { prorate: true }); } catch { /* already ended */ }
  }
  return paid;
}

/** Webhook: a subscription changed or ended in Stripe. */
export async function syncSubscriptionEvent(sub: Stripe.Subscription): Promise<void> {
  let serviceId = sub.metadata?.serviceId || '';
  if (!serviceId) {
    const snap = await db().ref('services').orderByChild('subscriptionId').equalTo(sub.id).limitToFirst(1).get();
    serviceId = snap.exists() ? Object.keys(snap.val())[0] : '';
  }
  if (!serviceId) return;
  // A replaced subscription ending must not touch the post now paid by its successor.
  const current = (await db().ref(`services/${serviceId}/subscriptionId`).get()).val();
  if (current && current !== sub.id) return;
  await syncService(serviceId);
}

/** Daily: every post with a subscription or a paid record, checked against Stripe. */
export async function reconcileAll(): Promise<{ checked: number; paid: number; cleared: number; errors: number; unpaidExtras: string[] }> {
  const [services, paid] = await Promise.all([
    db().ref('services').get().then((s) => (s.val() ?? {}) as Record<string, { subscriptionId?: string; extraLocations?: unknown; status?: string; sellerId?: string }>),
    db().ref('listingPaid').get().then((s) => (s.val() ?? {}) as Record<string, unknown>),
  ]);
  const ids = new Set([...Object.keys(paid), ...Object.entries(services).filter(([, s]) => s?.subscriptionId).map(([id]) => id)]);
  const result = { checked: 0, paid: 0, cleared: 0, errors: 0, unpaidExtras: [] as string[] };
  for (const id of ids) {
    result.checked++;
    try {
      if (!services[id]) { await db().ref(`listingPaid/${id}`).remove(); result.cleared++; continue; }
      (await syncService(id)) > 0 ? result.paid++ : result.cleared++;
    } catch (err) {
      result.errors++;
      console.error('[listingPaid] reconcile failed for', id, err instanceof Error ? err.message : err);
    }
  }
  // Reported, not changed: live posts showing extra locations with no
  // subscription at all (admin-granted, or saved before the rules enforced it).
  for (const [id, s] of Object.entries(services)) {
    if (s && !s.subscriptionId && s.status && s.status !== 'draft' && s.status !== 'deleted' && asList(s.extraLocations).length) result.unpaidExtras.push(id);
  }
  return result;
}
