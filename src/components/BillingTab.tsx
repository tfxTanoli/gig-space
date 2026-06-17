import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../AuthContext';

import { ShieldCheck, CreditCard, Clock, CheckCircle, XCircle, Loader2, Plus, Trash2 } from 'lucide-react';

function CardBrandIcon({ brand }: { brand: string }) {
  switch (brand.toLowerCase()) {
    case 'visa':
      return (
        <svg viewBox="0 0 50 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-auto">
          <text x="25" y="14" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14" fill="white" letterSpacing="0.5">VISA</text>
        </svg>
      );
    case 'mastercard':
      return (
        <svg viewBox="0 0 38 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-auto">
          <circle cx="14" cy="12" r="10" fill="#EB001B" />
          <circle cx="24" cy="12" r="10" fill="#F79E1B" />
          <path d="M19 4.8a10 10 0 0 1 0 14.4A10 10 0 0 1 19 4.8z" fill="#FF5F00" />
        </svg>
      );
    case 'amex':
      return (
        <svg viewBox="0 0 48 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-auto">
          <rect width="48" height="30" rx="4" fill="#2557D6" />
          <text x="24" y="21" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="11" fill="white">AMEX</text>
        </svg>
      );
    case 'discover':
      return (
        <svg viewBox="0 0 48 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-auto">
          <rect width="48" height="30" rx="4" fill="#F76F21" />
          <text x="13" y="20" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="9" fill="white">DISC</text>
          <circle cx="35" cy="15" r="9" fill="#F9A12E" />
        </svg>
      );
    default:
      return <CreditCard className="w-4 h-4 text-slate-400" />;
  }
}
import type { Payment, SavedPaymentMethod } from '../stripe/types';
import { listPaymentMethods, removePaymentMethod } from '../stripe/paymentHelpers';
import AddPaymentMethodModal from './AddPaymentMethodModal';

const statusStyles: Record<string, string> = {
  paid:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  released: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  refunded: 'bg-red-500/10 text-red-400 border-red-500/20',
  failed:   'bg-slate-700/40 text-slate-400 border-slate-600',
  pending:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
};

const statusLabel: Record<string, string> = {
  paid:     'In escrow',
  released: 'Released',
  refunded: 'Refunded',
  failed:   'Failed',
  pending:  'Pending',
};

function statusIcon(status: string) {
  switch (status) {
    case 'paid':     return <Clock className="w-4 h-4 text-blue-400" />;
    case 'released': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    case 'refunded': return <XCircle className="w-4 h-4 text-red-400" />;
    default:         return <CreditCard className="w-4 h-4 text-slate-400" />;
  }
}

export default function BillingTab() {
  const { user, loading: authLoading } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchMethods = useCallback(async () => {
    if (!user) return;
    setLoadingMethods(true);
    try {
      const methods = await listPaymentMethods();
      setSavedMethods(methods);
    } catch {
      // silently fail — show empty state
    } finally {
      setLoadingMethods(false);
    }
  }, [user]);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  const handleRemove = async (pmId: string) => {
    setRemovingId(pmId);
    try {
      await removePaymentMethod(pmId);
      setSavedMethods((prev) => prev.filter((m) => m.id !== pmId));
    } catch {
      // silently fail
    } finally {
      setRemovingId(null);
    }
  };

  useEffect(() => {
    // If auth is still resolving, wait
    if (authLoading) return;
    // If no user, nothing to load
    if (!user) {
      setPayments([]);
      setLoading(false);
      return;
    }

    const q = query(ref(database, 'payments'), orderByChild('buyerId'), equalTo(user.uid));
    return onValue(
      q,
      (snap) => {
        if (!snap.exists()) {
          setPayments([]);
          setLoading(false);
          return;
        }
        const result: Payment[] = [];
        snap.forEach((child) => {
          result.push({ id: child.key!, ...child.val() } as Payment);
        });
        setPayments(result.sort((a, b) => b.createdAt - a.createdAt));
        setLoading(false);
      },
      (_err) => {
        // Permission error or network issue — stop spinner and show empty state
        setPayments([]);
        setLoading(false);
      }
    );
  }, [user, authLoading]);

  const totalSpent = payments
    .filter((p) => p.status === 'paid' || p.status === 'released')
    .reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div>
        <h2 className="text-xl font-bold text-white">Billing & Payments</h2>
        <p className="text-slate-400 text-sm mt-1">Your payment history through Gigspace escrow.</p>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-surface border border-slate-800 rounded-xl p-4">
          <p className="text-slate-300 text-xs mb-1">Total spent</p>
          <p className="text-white text-xl font-bold">${totalSpent.toFixed(2)}</p>
        </div>
        <div className="bg-surface border border-slate-800 rounded-xl p-4">
          <p className="text-slate-300 text-xs mb-1">Active orders</p>
          <p className="text-blue-400 text-xl font-bold">
            {payments.filter((p) => p.status === 'paid').length}
          </p>
        </div>
        <div className="bg-surface border border-slate-800 rounded-xl p-4 col-span-2 sm:col-span-1">
          <p className="text-slate-300 text-xs mb-1">Completed</p>
          <p className="text-emerald-400 text-xl font-bold">
            {payments.filter((p) => p.status === 'released').length}
          </p>
        </div>
      </div>

      {/* Escrow info banner */}
      <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3.5">
        <ShieldCheck className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-blue-400 text-sm font-medium">Secured by escrow</p>
          <p className="text-blue-300/60 text-xs mt-0.5 leading-relaxed">
            Payments are held securely until you approve the delivery. Funds are only released to the
            seller once you're satisfied with the work.
          </p>
        </div>
      </div>

      {/* Saved payment methods */}
      <div className="bg-surface border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Saved payment methods</h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-blue-400 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add new
          </button>
        </div>

        {loadingMethods ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
          </div>
        ) : savedMethods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <CreditCard className="w-9 h-9 text-slate-500" />
            <p className="text-slate-400 text-sm">No saved payment methods.</p>
            <p className="text-slate-500 text-xs text-center max-w-xs">
              Save a card for faster checkout on future orders.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {savedMethods.map((pm) => (
              <div key={pm.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-14 h-9 rounded-md bg-slate-800 border border-slate-600 flex items-center justify-center shrink-0 overflow-hidden">
                  <CardBrandIcon brand={pm.brand} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">
                    {pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1)} ending in {pm.last4}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Expires {String(pm.expMonth).padStart(2, '0')}/{pm.expYear}
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(pm.id)}
                  disabled={removingId === pm.id}
                  className="text-slate-600 hover:text-red-400 transition-colors disabled:opacity-40"
                  title="Remove card"
                >
                  {removingId === pm.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddPaymentMethodModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchMethods(); }}
        />
      )}

      {/* Payment history */}
      <div className="bg-surface border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h3 className="text-white font-semibold text-sm">Payment history</h3>
        </div>

        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <CreditCard className="w-10 h-10 text-slate-500" />
            <p className="text-slate-400 text-sm">No payments yet.</p>
            <p className="text-slate-500 text-xs">Payments appear here after you accept an offer.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {payments.map((payment) => (
              <div key={payment.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  {statusIcon(payment.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    Order #{payment.orderId.slice(-6).toUpperCase()}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {new Date(payment.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white text-sm font-semibold">${payment.amount.toFixed(2)}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${statusStyles[payment.status] ?? statusStyles.pending}`}>
                    {statusLabel[payment.status] ?? payment.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
