import { useState, useEffect } from 'react';
import { DollarSign, Clock, ArrowDownLeft, X, Loader2 } from 'lucide-react';
import { ref as dbRef, onValue } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../AuthContext';
import {
  fetchAffiliateCommissions,
  fetchAffiliatePayouts,
  requestAffiliateWithdrawal,
  type AffiliateStats,
  type AffiliateCommission,
  type AffiliatePayout,
} from './affiliateHelpers';

function WithdrawModal({
  available,
  onClose,
  onSuccess,
}: {
  available: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) { setError('Enter a valid amount'); return; }
    if (num < 10)               { setError('Minimum withdrawal is $10'); return; }
    if (num > available)        { setError(`Maximum is $${available.toFixed(2)}`); return; }

    setLoading(true);
    setError('');
    try {
      await requestAffiliateWithdrawal(num);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Withdraw Funds</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          Available: <span className="text-white font-semibold">${available.toFixed(2)}</span>
        </p>

        <div className="relative mb-4">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            min="10"
            max={available}
            step="0.01"
            className="w-full bg-[#0E1422] border border-slate-700 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
          />
        </div>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handle}
            disabled={loading}
            className="flex-1 bg-primary hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Withdraw
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    available: 'text-emerald-400 bg-emerald-500/10',
    paid:      'text-slate-400 bg-slate-700/50',
    pending:   'text-yellow-400 bg-yellow-500/10',
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? 'text-slate-400 bg-slate-700/50'}`}>
      {label}
    </span>
  );
}

export default function AffiliatePayoutsTab() {
  const { user } = useAuth();
  const [stats, setStats]               = useState<AffiliateStats | null>(null);
  const [commissions, setCommissions]   = useState<AffiliateCommission[]>([]);
  const [payouts, setPayouts]           = useState<AffiliatePayout[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [listLoading, setListLoading]   = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);

  // Read balances directly from Firebase RTDB (real-time, no server needed)
  useEffect(() => {
    if (!user) return;
    const unsub = onValue(dbRef(database, `affiliates/${user.uid}`), (snap) => {
      if (snap.exists()) {
        const d = snap.val() as Record<string, unknown>;
        setStats({
          referralCode:             String(d.referralCode             ?? ''),
          totalClicks:              Number(d.totalClicks              ?? 0),
          totalReferrals:           Number(d.totalReferrals           ?? 0),
          pendingBalance:           Number(d.pendingBalance           ?? 0),
          availableBalance:         Number(d.availableBalance         ?? 0),
          lifetimeEarnings:         Number(d.lifetimeEarnings         ?? 0),
          totalWithdrawn:           Number(d.totalWithdrawn           ?? 0),
          stripeConnectedAccountId: (d.stripeConnectedAccountId as string | null) ?? null,
        });
      }
      setStatsLoading(false);
    });
    return () => unsub();
  }, [user]);

  const loadLists = () => {
    setListLoading(true);
    Promise.all([fetchAffiliateCommissions(), fetchAffiliatePayouts()])
      .then(([c, p]) => { setCommissions(c.commissions); setPayouts(p.payouts); })
      .catch(() => { setCommissions([]); setPayouts([]); })
      .finally(() => setListLoading(false));
  };

  useEffect(() => { loadLists(); }, []);

  if (statsLoading && listLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Payouts</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your earnings and withdrawals</p>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
          <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-3">
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white">${(stats?.availableBalance ?? 0).toFixed(2)}</p>
          <p className="text-slate-500 text-xs mt-0.5">Available to withdraw</p>
          <button
            onClick={() => setShowWithdraw(true)}
            disabled={(stats?.availableBalance ?? 0) < 10}
            className="mt-4 w-full bg-primary hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 rounded-xl transition-colors"
          >
            Withdraw
          </button>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
          <div className="w-9 h-9 bg-yellow-500/10 rounded-xl flex items-center justify-center mb-3">
            <Clock className="w-4 h-4 text-yellow-400" />
          </div>
          <p className="text-2xl font-bold text-white">${(stats?.pendingBalance ?? 0).toFixed(2)}</p>
          <p className="text-slate-500 text-xs mt-0.5">Pending (awaiting order completion)</p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
          <div className="w-9 h-9 bg-slate-700/40 rounded-xl flex items-center justify-center mb-3">
            <ArrowDownLeft className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-white">${(stats?.totalWithdrawn ?? 0).toFixed(2)}</p>
          <p className="text-slate-500 text-xs mt-0.5">Total withdrawn</p>
        </div>
      </div>

      {/* Commission History */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Commission History</h3>
        {commissions.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-500 text-sm">No commissions yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-slate-800">
                  <th className="text-left pb-2.5 font-medium">Date</th>
                  <th className="text-left pb-2.5 font-medium">Order</th>
                  <th className="text-left pb-2.5 font-medium">Buyer</th>
                  <th className="text-left pb-2.5 font-medium">Order Value</th>
                  <th className="text-left pb-2.5 font-medium">Commission</th>
                  <th className="text-left pb-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="py-3 text-slate-400 pr-4">
                      {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-3 text-slate-400 font-mono text-xs pr-4">{c.orderId.substring(0, 8)}…</td>
                    <td className="py-3 text-slate-300 pr-4">{c.buyerName}</td>
                    <td className="py-3 text-slate-300 pr-4">${c.orderAmount.toFixed(2)}</td>
                    <td className="py-3 text-white font-semibold pr-4">${c.commissionAmount.toFixed(2)}</td>
                    <td className="py-3"><StatusPill status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout History */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Payout History</h3>
        {payouts.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-500 text-sm">No withdrawals yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-slate-800">
                  <th className="text-left pb-2.5 font-medium">Date</th>
                  <th className="text-left pb-2.5 font-medium">Amount</th>
                  <th className="text-left pb-2.5 font-medium">Status</th>
                  <th className="text-left pb-2.5 font-medium">Transfer ID</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="py-3 text-slate-400 pr-4">
                      {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-3 text-white font-semibold pr-4">${p.amount.toFixed(2)}</td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        Paid
                      </span>
                    </td>
                    <td className="py-3 text-slate-500 font-mono text-xs">{p.stripeTransferId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showWithdraw && (
        <WithdrawModal
          available={stats?.availableBalance ?? 0}
          onClose={() => setShowWithdraw(false)}
          onSuccess={() => { setShowWithdraw(false); loadLists(); }}
        />
      )}
    </div>
  );
}
