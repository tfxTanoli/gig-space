import { auth } from '../firebase';

const API_URL = import.meta.env.VITE_API_URL || '';

async function authedFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error || `Request failed (${res.status})`);
  return data as T;
}

export interface CreatedUser {
  uid: string;
  name: string;
  email: string;
  username: string;
  photoURL: string;
  accountType: string;
  role: string;
  createdAt: number;
  disabled: boolean;
}

export const adminCreateUser = (body: { name: string; email: string; password: string; accountType: 'buyer' | 'seller' }) =>
  authedFetch<CreatedUser>('/api/admin/users', { method: 'POST', body: JSON.stringify(body) });

export const adminCreateAffiliate = (body: { name: string; email: string; password: string }) =>
  authedFetch<CreatedUser & { referralCode: string }>('/api/admin/affiliates', { method: 'POST', body: JSON.stringify(body) });

export const adminSetUserDisabled = (uid: string, disabled: boolean) =>
  authedFetch<{ success: boolean; disabled: boolean }>(`/api/admin/users/${uid}/disabled`, {
    method: 'PATCH',
    body: JSON.stringify({ disabled }),
  });

export const adminImpersonate = (uid: string) =>
  authedFetch<{ token: string }>(`/api/admin/users/${uid}/impersonate`, { method: 'POST' });

// Deletes a post: cancels its Stripe location subscription, then hard-deletes a
// clean post or archives one that has orders. Returns whether it was archived.
export const adminDeleteService = (id: string) =>
  authedFetch<{ success: boolean; archived: boolean }>(`/api/admin/services/${id}`, { method: 'DELETE' });

export interface AdminMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  imageURL: string | null;
  type: string;
  timestamp: number;
}

export const adminGetOrderMessages = (orderId: string) =>
  authedFetch<{ messages: AdminMessage[]; conversationId: string }>(`/api/admin/orders/${orderId}/messages`);

export interface ListingReview {
  rating: number;
  text: string;
  author: string;
  photo: string;
  time: number;
}

export interface ListingBusiness {
  placeId: string;
  name: string;
  address: string;
  rating: number;
  reviewCount: number;
  description: string;
  type: string;
  images: string[];
  reviews: ListingReview[];
}

export const adminSearchListings = (body: { keyword: string; city: string }) =>
  authedFetch<{ businesses: ListingBusiness[] }>('/api/admin/listings/search', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const adminGenerateListings = (body: { category: string; subcategory: string; language: string; businesses: ListingBusiness[] }) =>
  authedFetch<{ created: { id: string; name: string }[]; count: number }>('/api/admin/listings/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
