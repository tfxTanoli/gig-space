import { auth } from '../firebase';
import type {
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  WithdrawRequest,
  WithdrawResponse,
  StripeConnectStatus,
} from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ── Helper: get Firebase ID token and call the Express API ───────────────────
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

// ─────────────────────────────────────────────────────────────────────────────

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
