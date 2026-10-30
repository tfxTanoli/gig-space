import { auth } from '../firebase';
import type {
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  WithdrawRequest,
  WithdrawResponse,
  StripeConnectStatus,
  SavedPaymentMethod,
  BillingAddress,
  TaxBreakdown,
} from './types';

const API_URL = import.meta.env.VITE_API_URL || '';

async function apiFetch<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data as T;
}

async function apiGet<T>(path: string): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data as T;
}

async function apiDelete<T>(path: string): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data as T;
}

/**
 * Creates a Stripe embedded checkout session and returns the client secret.
 * The caller mounts the embedded checkout form using this secret.
 */
export async function startCheckout(payload: CreateCheckoutRequest): Promise<string> {
  const data = await apiFetch<CreateCheckoutResponse>(
    '/api/checkout/create-session',
    payload as unknown as Record<string, unknown>
  );
  if (!data.clientSecret) throw new Error('No client secret returned from server.');
  return data.clientSecret;
}

/**
 * Verifies a completed checkout session and creates the order if the webhook
 * hadn't already done so. Call this from the frontend after payment_success.
 */
export async function verifyCheckoutSession(sessionId: string): Promise<void> {
  await apiFetch<{ status: string; fulfilled: boolean; alreadyProcessed?: boolean }>(
    '/api/checkout/verify-session',
    { sessionId }
  );
}

/**
 * Creates a PaymentIntent for Stripe Elements-based checkout.
 * Returns the client secret used to mount <PaymentElement>.
 */
export async function startElementsCheckout(payload: CreateCheckoutRequest): Promise<string> {
  const data = await apiFetch<{ clientSecret: string }>(
    '/api/checkout/create-payment-intent',
    payload as unknown as Record<string, unknown>
  );
  if (!data.clientSecret) throw new Error('No client secret returned from server.');
  return data.clientSecret;
}

/**
 * Fallback for redirect-based payment methods (e.g. iDEAL).
 * Retrieves the PaymentIntent status and fulfils the order if succeeded.
 */
export async function verifyPaymentIntent(paymentIntentId: string): Promise<void> {
  await apiFetch<{ status: string; fulfilled: boolean }>(
    '/api/checkout/verify-payment-intent',
    { paymentIntentId }
  );
}

/**
 * Buyer approves delivery — atomically releases escrow to seller wallet.
 */
export async function approveDelivery(orderId: string): Promise<void> {
  await apiFetch<{ success: boolean }>('/api/orders/approve-delivery', { orderId });
}

/**
 * Leaves the buyer's or seller's review on a completed order. The server checks
 * the order and updates every rating total; clients can no longer write those.
 */
export async function submitOrderReview(orderId: string, rating: number, text: string): Promise<void> {
  await apiFetch<{ review: unknown }>('/api/reviews/submit', { orderId, rating, text });
}

/**
 * Returns the Stripe Connect onboarding URL for the seller.
 */
export async function getStripeConnectLink(returnUrl?: string): Promise<string> {
  const data = await apiFetch<{ url: string }>('/api/connect/link', { returnUrl });
  return data.url;
}

/**
 * Checks whether the seller's connected Stripe account has payouts enabled.
 */
export async function checkConnectStatus(
  stripeAccountId: string
): Promise<StripeConnectStatus> {
  return apiFetch<StripeConnectStatus>('/api/connect/status', { stripeAccountId });
}

/**
 * Requests a withdrawal of `amount` USD from the seller's available balance.
 */
export async function requestWithdrawal(amount: number): Promise<WithdrawResponse> {
  return apiFetch<WithdrawResponse>('/api/withdraw', { amount } as WithdrawRequest as unknown as Record<string, unknown>);
}

/**
 * Creates a Stripe SetupIntent for saving a payment method.
 * The backend also creates/retrieves a Stripe Customer for the current user.
 */
export async function createSetupIntent(): Promise<{ clientSecret: string }> {
  return apiFetch<{ clientSecret: string }>('/api/payment-methods/setup-intent', {});
}

/**
 * Lists saved payment methods for the current user.
 */
export async function listPaymentMethods(): Promise<SavedPaymentMethod[]> {
  const data = await apiGet<{ paymentMethods: SavedPaymentMethod[] }>('/api/payment-methods');
  return data.paymentMethods;
}

/**
 * Detaches (removes) a saved payment method.
 */
export async function removePaymentMethod(pmId: string): Promise<void> {
  await apiDelete<{ success: boolean }>(`/api/payment-methods/${pmId}`);
}

/**
 * Quotes subtotal/tax/total for the extra-location subscription against a
 * given billing address, without creating any Stripe object — used to show
 * the tax breakdown in the checkout summary before the seller commits to paying.
 */
export async function previewSubscriptionTax(payload: {
  extraLocationCount: number;
  address: BillingAddress;
}): Promise<TaxBreakdown> {
  return apiFetch<TaxBreakdown>(
    '/api/subscriptions/preview-tax',
    payload as unknown as Record<string, unknown>,
  );
}

/**
 * Creates a Stripe subscription for extra listing locations ($5/month each).
 * Backend must implement POST /api/subscriptions/create-listing-subscription.
 * Returns a PaymentIntent client secret, the new subscription ID, and the
 * actual subtotal/tax/total Stripe calculated for the given billing address.
 */
export async function createListingSubscription(payload: {
  extraLocationCount: number;
  serviceId: string;
  address: BillingAddress;
  name?: string;
}): Promise<{ clientSecret: string; subscriptionId: string } & TaxBreakdown> {
  return apiFetch<{ clientSecret: string; subscriptionId: string } & TaxBreakdown>(
    '/api/subscriptions/create-listing-subscription',
    payload as unknown as Record<string, unknown>,
  );
}

/**
 * Ends a post's location subscription. `replaced` is for when a newly paid
 * subscription takes over (the seller added locations): the old one's unused
 * time is credited and no "downgraded" email goes out.
 */
export async function cancelListingSubscription(subscriptionId: string, opts: { replaced?: boolean } = {}): Promise<void> {
  return apiFetch<void>('/api/subscriptions/cancel-listing-subscription', {
    subscriptionId,
    ...(opts.replaced ? { replaced: true } : {}),
  });
}

/**
 * A seller deleting their own post: removes its photos and video from Storage so
 * they are gone, not just unlisted. Call it just before the post record is
 * deleted — the server checks the post is theirs while it still can.
 */
export async function purgePostMedia(postId: string): Promise<{ removed: number; failed: number }> {
  return apiFetch(`/api/services/${encodeURIComponent(postId)}/purge-media`, {});
}

/**
 * After paying for extra locations and before saving the post: the server
 * records the paid quantity (the database only accepts that many extra
 * locations on a live post) and cancels the subscription this one replaces.
 */
export async function confirmListingSubscription(serviceId: string, subscriptionId: string): Promise<{ subscriptionId: string; paidExtraLocations: number }> {
  return apiFetch('/api/subscriptions/confirm-listing-subscription', { serviceId, subscriptionId });
}

/** How many extra locations the post's subscription currently pays for. */
export async function getListingSubscriptionStatus(serviceId: string): Promise<{ subscriptionId: string | null; paidExtraLocations: number }> {
  return apiFetch('/api/subscriptions/listing-subscription-status', { serviceId });
}

/** Bills for fewer extra locations from now on, or ends the subscription at 0. */
export async function reduceListingSubscription(serviceId: string, extraLocationCount: number): Promise<{ subscriptionId: string | null; paidExtraLocations: number }> {
  return apiFetch('/api/subscriptions/reduce-listing-subscription', { serviceId, extraLocationCount });
}
