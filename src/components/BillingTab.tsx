import { useState, useEffect } from 'react';
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../AuthContext';
import { ShieldCheck, CreditCard, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { Payment } from '../stripe/types';

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
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(ref(database, 'payments'), orderByChild('buyerId'), equalTo(user.uid));
    return onValue(q, (snap) => {
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
    });
  }, [user]);

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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-white">Billing & Payments</h2>
        <p className="text-slate-400 text-sm mt-1">Your payment history through Gigspace escrow.</p>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-1">Total spent</p>
          <p className="text-white text-xl font-bold">${totalSpent.toFixed(2)}</p>
        </div>
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-1">Active orders</p>
          <p className="text-blue-400 text-xl font-bold">
            {payments.filter((p) => p.status === 'paid').length}
          </p>
        </div>
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 col-span-2 sm:col-span-1">
          <p className="text-slate-400 text-xs mb-1">Completed</p>
          <p className="text-emerald-400 text-xl font-bold">
            {payments.filter((p) => p.status === 'released').length}
          </p>
        </div>
      </div>

      {/* Escrow info banner */}
      <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3.5">
        <ShieldCheck className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-blue-300 text-sm font-medium">Secured by escrow</p>
          <p className="text-blue-400/70 text-xs mt-0.5 leading-relaxed">
            Payments are held securely until you approve the delivery. Funds are only released to the
            seller once you're satisfied with the work.
          </p>
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h3 className="text-white font-semibold text-sm">Payment history</h3>
        </div>

        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <CreditCard className="w-10 h-10 text-slate-700" />
            <p className="text-slate-500 text-sm">No payments yet.</p>
            <p className="text-slate-600 text-xs">Payments appear here after you accept an offer.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {payments.map((payment) => (
              <div key={payment.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-[#0E1422] border border-slate-800 flex items-center justify-center shrink-0">
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
