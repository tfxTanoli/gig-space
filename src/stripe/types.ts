// ── Payment record (stored at payments/{paymentId}) ────────────────────────
export interface Payment {
  id: string;
  orderId: string;
  conversationId: string;
  serviceId: string;
  buyerId: string;
  sellerId: string;
  stripeSessionId: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: 'usd';
  platformFeePercent: number;
  platformFeeAmount: number;
  sellerAmount: number;
  status: PaymentStatus;
  createdAt: number;
  paidAt?: number;
  releasedAt?: number;
  refundedAt?: number;
}

export type PaymentStatus = 'pending' | 'paid' | 'released' | 'refunded' | 'failed';

// ── Seller wallet (stored at wallets/{sellerUid}) ───────────────────────────
export interface Wallet {
  availableBalance: number;
  pendingBalance: number;
  lifetimeEarnings: number;
  totalWithdrawn: number;
  stripeConnectedAccountId?: string;
  updatedAt: number;
}

// ── Wallet transaction (stored at walletTransactions/{sellerUid}/{txId}) ───
export interface WalletTransaction {
  id: string;
  type: WalletTransactionType;
  orderId: string;
  paymentId: string;
  amount: number; // positive = credit, negative = debit
  description: string;
  createdAt: number;
}

export type WalletTransactionType =
  | 'payment_received'
  | 'platform_fee'
  | 'withdrawal'
  | 'refund';

// ── Withdrawal record (stored at withdrawals/{withdrawalId}) ───────────────
export interface Withdrawal {
  id: string;
  sellerId: string;
  amount: number;
  stripeTransferId: string;
  status: 'pending' | 'paid' | 'failed';
  createdAt: number;
}

// ── Stripe Connect status ───────────────────────────────────────────────────
export interface StripeConnectStatus {
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}

// ── Cloud Function request/response shapes ─────────────────────────────────
export interface CreateCheckoutRequest {
  conversationId: string;
  messageId: string;
  serviceTitle: string;
  serviceId: string;
  sellerName: string;
  sellerId: string;
  offerAmount: number;
  priceUnit: 'per_project' | 'per_hour';
  serviceImage?: string | null;
}

export interface CreateCheckoutResponse {
  sessionId: string;
  url: string;
}

export interface WithdrawRequest {
  amount: number;
}

export interface WithdrawResponse {
  success: boolean;
  transferId: string;
  withdrawalId: string;
}
