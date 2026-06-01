import { auth } from '../firebase';
import type {
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  WithdrawRequest,
  WithdrawResponse,
  StripeConnectStatus,
  SavedPaymentMethod,
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
 * Creates a Stripe subscription for extra listing locations ($5/month each).
 * Backend must implement POST /api/subscriptions/create-listing-subscription.
 * Returns a PaymentIntent client secret and the new subscription ID.
 */
export async function createListingSubscription(payload: {
  extraLocationCount: number;
  serviceId: string;
}): Promise<{ clientSecret: string; subscriptionId: string }> {
  return apiFetch<{ clientSecret: string; subscriptionId: string }>(
    '/api/subscriptions/create-listing-subscription',
    payload as unknown as Record<string, unknown>,
  );
}

export async function cancelListingSubscription(subscriptionId: string): Promise<void> {
  return apiFetch<void>('/api/subscriptions/cancel-listing-subscription', { subscriptionId });
}
