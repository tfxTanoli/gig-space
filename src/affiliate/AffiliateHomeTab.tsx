import { useState, useEffect } from 'react';
import { Link2, Users, Clock, DollarSign, Copy, Check, TrendingUp } from 'lucide-react';
import { ref as dbRef, onValue, set } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../AuthContext';
import { fetchAffiliateCommissions, type AffiliateStats, type AffiliateCommission } from './affiliateHelpers';

function MonthlyEarningsChart({ commissions }: { commissions: AffiliateCommission[] }) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { label: d.toLocaleString('default', { month: 'short' }), month: d.getMonth(), year: d.getFullYear() };
  });

  const earnings = months.map(({ month, year }) =>
    commissions
      .filter(c => { const d = new Date(c.createdAt); return d.getMonth() === month && d.getFullYear() === year; })
      .reduce((sum, c) => sum + c.commissionAmount, 0),
  );

  const maxEarning = Math.max(...earnings, 1);

  return (
    <div className="bg-surface border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="text-white font-semibold text-sm">Monthly Earnings</h3>
      </div>
      <div className="flex items-end gap-3" style={{ height: '120px' }}>
        {months.map(({ label }, i) => {
          const pct = Math.max((earnings[i] / maxEarning) * 100, 3);
          return (
            <div key={label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span className="text-slate-500 text-xs leading-none">
                {earnings[i] > 0 ? `$${earnings[i].toFixed(0)}` : ''}
              </span>
              <div
                style={{ height: `${pct}%` }}
                className="w-full bg-primary/60 hover:bg-primary rounded-sm transition-all duration-300"
              />
              <span className="text-slate-500 text-xs leading-none">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'available') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />Available
      </span>
    );
  }
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />Paid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-yellow-400 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />Pending
    </span>
  );
}

async function initAffiliateRecord(uid: string) {
  const code = uid.substring(0, 8).toLowerCase();
  await Promise.all([
    set(dbRef(database, `affiliates/${uid}`), {
      referralCode: code,
      totalClicks: 0,
      totalReferrals: 0,
      pendingBalance: 0,
      availableBalance: 0,
      lifetimeEarnings: 0,
      totalWithdrawn: 0,
      createdAt: Date.now(),
    }),
    set(dbRef(database, `affiliateCodes/${code}`), uid),
  ]);
}

export default function AffiliateHomeTab() {
  const { user, userProfile } = useAuth();
  const [stats, setStats]           = useState<AffiliateStats | null>(null);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [statsLoading, setStatsLoading]       = useState(true);
  const [commissionsLoading, setCommissionsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // â”€â”€ Read affiliate stats directly from Firebase RTDB (real-time, no server needed) â”€â”€
  useEffect(() => {
    if (!user) return;

    const affiliateRef = dbRef(database, `affiliates/${user.uid}`);
    const unsub = onValue(affiliateRef, async (snap) => {
      if (!snap.exists()) {
        // First-time / existing user â€” auto-init their affiliate record
        try { await initAffiliateRecord(user.uid); } catch { /* ignore */ }
        return;
      }
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
      setStatsLoading(false);
    });

    return () => unsub();
  }, [user]);

  // â”€â”€ Commissions via API (needs server) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    fetchAffiliateCommissions()
      .then(c => setCommissions(c.commissions))
      .catch(() => setCommissions([]))
      .finally(() => setCommissionsLoading(false));
  }, []);

  const referralLink = stats?.referralCode
    ? `${window.location.origin}?ref=${stats.referralCode}`
    : '';

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loading = statsLoading && commissionsLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statsCards = [
    { label: 'Total Clicks',  value: (stats?.totalClicks ?? 0).toLocaleString(),       Icon: Link2,      color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
    { label: 'Referrals',     value: (stats?.totalReferrals ?? 0).toLocaleString(),     Icon: Users,      color: 'text-purple-400',  bg: 'bg-purple-500/10'  },
    { label: 'Pending',       value: `$${(stats?.pendingBalance ?? 0).toFixed(2)}`,     Icon: Clock,      color: 'text-yellow-400',  bg: 'bg-yellow-500/10'  },
    { label: 'Available',     value: `$${(stats?.availableBalance ?? 0).toFixed(2)}`,   Icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  const recentCommissions = commissions.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-lg font-semibold text-white">
          Welcome back{userProfile?.name ? `, ${userProfile.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Here's how your affiliate program is performing</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="bg-surface border border-slate-800 rounded-2xl p-4">
            <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-slate-500 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Referral Link */}
      <div className="bg-surface border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1.5">
          <Link2 className="w-4 h-4 text-primary" />
          <h3 className="text-white font-semibold text-sm">Your Referral Link</h3>
        </div>
        <p className="text-slate-400 text-xs mb-4">
          Share this link to earn 50% of every platform fee from referred orders
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-background border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-300 font-mono truncate min-w-0">
            {referralLink || (statsLoading ? 'Generating your linkâ€¦' : 'Link unavailable')}
          </div>
          <button
            onClick={copyLink}
            disabled={!referralLink}
            className="flex items-center gap-1.5 bg-primary hover:bg-blue-400 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shrink-0"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Monthly Earnings Chart */}
      <MonthlyEarningsChart commissions={commissions} />

      {/* Recent Commissions */}
      <div className="bg-surface border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-primary" />
          <h3 className="text-white font-semibold text-sm">Recent Commissions</h3>
        </div>
        {commissionsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recentCommissions.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-500 text-sm">No commissions yet</p>
            <p className="text-slate-600 text-xs mt-1">Share your referral link to start earning</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 text-xs text-slate-500 pb-2 border-b border-slate-800 gap-2">
              <span>Date</span><span>Order</span><span>Amount</span><span>Status</span>
            </div>
            {recentCommissions.map((c) => (
              <div key={c.id} className="grid grid-cols-4 gap-2 text-sm py-3 border-b border-slate-800/50 last:border-0 items-center">
                <span className="text-slate-400">
                  {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className="text-slate-400 font-mono text-xs truncate">{c.orderId.substring(0, 8)}â€¦</span>
                <span className="text-white font-medium">${c.commissionAmount.toFixed(2)}</span>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
