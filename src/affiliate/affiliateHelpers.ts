import { auth } from '../firebase';

const API_URL = import.meta.env.VITE_API_URL || '';

async function apiGet<T>(path: string): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || `Server error ${res.status}`);
  return data as T;
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || `Server error ${res.status}`);
  return data as T;
}

export interface AffiliateStats {
  referralCode: string;
  totalClicks: number;
  totalReferrals: number;
  pendingBalance: number;
  availableBalance: number;
  lifetimeEarnings: number;
  totalWithdrawn: number;
  stripeConnectedAccountId: string | null;
}

export interface AffiliateCommission {
  id: string;
  orderId: string;
  buyerId: string;
  buyerName: string;
  orderAmount: number;
  platformFeeAmount: number;
  commissionAmount: number;
  status: 'pending' | 'available' | 'paid';
  createdAt: number;
  releasedAt: number | null;
}

export interface AffiliateReferral {
  id: string;
  referredUserId: string;
  referredUserName: string;
  referredUserEmail: string;
  status: 'signed_up' | 'ordered' | 'completed';
  createdAt: number;
}

export interface AffiliatePayout {
  id: string;
  amount: number;
  status: string;
  stripeTransferId: string;
  createdAt: number;
}

export const fetchAffiliateStats = () =>
  apiGet<AffiliateStats>('/api/affiliate/me');

export const fetchAffiliateCommissions = () =>
  apiGet<{ commissions: AffiliateCommission[] }>('/api/affiliate/commissions');

export const fetchAffiliateReferrals = () =>
  apiGet<{ referrals: AffiliateReferral[] }>('/api/affiliate/referrals');

export const fetchAffiliatePayouts = () =>
  apiGet<{ payouts: AffiliatePayout[] }>('/api/affiliate/payouts');

export const requestAffiliateWithdrawal = (amount: number) =>
  apiPost<{ success: boolean; transferId: string }>('/api/affiliate/withdraw', { amount });

export const getAffiliateConnectLink = () =>
  apiPost<{ url: string }>('/api/affiliate/connect/link', {});

export const checkAffiliateConnectStatus = (stripeAccountId: string) =>
  apiPost<{ payoutsEnabled: boolean; chargesEnabled: boolean; detailsSubmitted: boolean }>(
    '/api/affiliate/connect/status',
    { stripeAccountId },
  );
