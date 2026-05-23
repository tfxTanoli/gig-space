import { useState, useEffect } from 'react';
import {
  DollarSign, Clock, ArrowDownLeft, ArrowUpRight, X, Loader2,
  FileText, BanknoteArrowDown, ExternalLink, AlertCircle, CheckCircle,
  Link as LinkIcon,
} from 'lucide-react';
import { ref as dbRef, onValue } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../AuthContext';
import {
  fetchAffiliateCommissions,
  fetchAffiliatePayouts,
  requestAffiliateWithdrawal,
  getAffiliateConnectLink,
  checkAffiliateConnectStatus,
  type AffiliateStats,
  type AffiliateCommission,
  type AffiliatePayout,
} from './affiliateHelpers';

/* ── Stripe Connect card ──────────────────────────────────────────────────── */

function AffiliateStripeConnectCard({ stats }: { stats: AffiliateStats | null }) {
  const [connectStatus, setConnectStatus] = useState<{
    payoutsEnabled: boolean; chargesEnabled: boolean; detailsSubmitted: boolean;
  } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [connecting, setConnecting]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  useEffect(() => {
    if (!stats?.stripeConnectedAccountId) return;
    setStatusLoading(true);
    checkAffiliateConnectStatus(stats.stripeConnectedAccountId)
      .then(setConnectStatus)
      .catch(console.error)
      .finally(() => setStatusLoading(false));
  }, [stats?.stripeConnectedAccountId]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const { url } = await getAffiliateConnectLink();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Stripe. Try again.');
      setConnecting(false);
    }
  };

  const isFullyEnabled = connectStatus?.payoutsEnabled && connectStatus?.chargesEnabled;

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#635bff]/10 border border-[#635bff]/20 flex items-center justify-center shrink-0">
          <LinkIcon className="w-5 h-5 text-[#635bff]" />
        </div>
        <div>
          <h3 className="text-white font-semibold text-sm">Stripe Payout Account</h3>
          <p className="text-slate-500 text-xs mt-0.5">Connect your bank account to receive withdrawals</p>
        </div>
      </div>

      {!stats?.stripeConnectedAccountId && (
        <p className="text-slate-400 text-xs leading-relaxed">
          Your commissions are tracked automatically — no Stripe connection needed. Connect Stripe
          only when you're ready to withdraw your available balance to your bank.
        </p>
      )}

      {statusLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
        </div>
      ) : !stats?.stripeConnectedAccountId ? (
        <div className="space-y-3">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 text-xs leading-relaxed">{error}</p>
            </div>
          )}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-2 bg-[#635bff] hover:bg-[#5147e6] disabled:opacity-60 text-white text-sm font-semibold py-2.5 px-5 rounded-xl transition-colors"
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            {connecting ? 'Connecting…' : 'Connect Stripe Account'}
          </button>
        </div>
      ) : isFullyEnabled ? (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-emerald-400 text-sm font-medium">Payouts enabled</span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="text-yellow-400 text-sm">
              {connectStatus?.detailsSubmitted
                ? 'Stripe is reviewing your account'
                : 'Complete your Stripe onboarding to enable payouts'}
            </span>
          </div>
          {!connectStatus?.detailsSubmitted && (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 disabled:opacity-60 text-yellow-300 text-sm font-semibold py-2.5 px-5 rounded-xl transition-colors"
            >
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              {connecting ? 'Loading…' : 'Complete Onboarding'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Withdraw modal ───────────────────────────────────────────────────────── */

function WithdrawModal({
  available,
  onClose,
  onSuccess,
}: {
  available: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

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

/* ── Status pills ─────────────────────────────────────────────────────────── */

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

/* ── Main component ───────────────────────────────────────────────────────── */

export default function AffiliatePayoutsTab() {
  const { user } = useAuth();
  const [stats, setStats]               = useState<AffiliateStats | null>(null);
  const [commissions, setCommissions]   = useState<AffiliateCommission[]>([]);
  const [payouts, setPayouts]           = useState<AffiliatePayout[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [listLoading, setListLoading]   = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);

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

  const available = stats?.availableBalance ?? 0;

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
          <p className="text-2xl font-bold text-white">${available.toFixed(2)}</p>
          <p className="text-slate-500 text-xs mt-0.5">Available to withdraw</p>
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

      {/* Withdraw button */}
      <button
        onClick={() => setShowWithdraw(true)}
        disabled={available < 10}
        className="flex items-center gap-2 bg-primary hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
      >
        <ArrowUpRight className="w-4 h-4" />
        Withdraw funds
        {available < 10 && (
          <span className="text-blue-300 font-normal">(min $10)</span>
        )}
      </button>

      {/* Stripe Connect */}
      <AffiliateStripeConnectCard stats={stats} />

      {/* Commission History */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="text-white font-semibold text-sm">Commission History</h3>
        </div>
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
        <div className="flex items-center gap-2 mb-4">
          <BanknoteArrowDown className="w-4 h-4 text-primary" />
          <h3 className="text-white font-semibold text-sm">Payout History</h3>
        </div>
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
          available={available}
          onClose={() => setShowWithdraw(false)}
          onSuccess={() => { setShowWithdraw(false); loadLists(); }}
        />
      )}
    </div>
  );
}
