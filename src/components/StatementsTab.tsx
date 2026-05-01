import { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../AuthContext';
import {
  FileText, Download, TrendingUp, Calendar,
  ArrowDownLeft, ArrowUpRight, RotateCcw, DollarSign,
  ChevronLeft, ChevronRight, Loader2, Filter,
} from 'lucide-react';
import type { WalletTransaction } from '../stripe/types';

type TxFilter = 'all' | 'payment_received' | 'withdrawal' | 'refund';

const TYPE_LABELS: Record<TxFilter, string> = {
  all: 'All',
  payment_received: 'Earnings',
  withdrawal: 'Withdrawals',
  refund: 'Refunds',
};

const TYPE_BADGE: Record<WalletTransaction['type'], string> = {
  payment_received: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  withdrawal:       'bg-blue-500/15    text-blue-400    border-blue-500/20',
  refund:           'bg-red-500/15     text-red-400     border-red-500/20',
  platform_fee:     'bg-slate-700/60   text-slate-400   border-slate-600',
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function txIcon(type: WalletTransaction['type']) {
  switch (type) {
    case 'payment_received': return <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />;
    case 'withdrawal':       return <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />;
    case 'refund':           return <RotateCcw className="w-3.5 h-3.5 text-red-400" />;
    default:                 return <DollarSign className="w-3.5 h-3.5 text-slate-400" />;
  }
}

function amountColor(type: WalletTransaction['type']) {
  switch (type) {
    case 'payment_received': return 'text-emerald-400';
    case 'withdrawal':       return 'text-blue-400';
    case 'refund':           return 'text-red-400';
    default:                 return 'text-slate-400';
  }
}

function exportCSV(rows: WalletTransaction[]) {
  const header = 'Date,Type,Description,Amount\n';
  const body = rows.map((tx) => {
    const date = new Date(tx.createdAt).toLocaleDateString('en-US');
    const type = tx.type.replace(/_/g, ' ');
    const desc = `"${tx.description.replace(/"/g, '""')}"`;
    const amount = (tx.amount >= 0 ? '+' : '') + tx.amount.toFixed(2);
    return `${date},${type},${desc},${amount}`;
  }).join('\n');

  const blob = new Blob([header + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gigspace-statements-${new Date().toISOString().slice(0, 7)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StatementsTab() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState<TxFilter>('all');
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // 0-11 or null = all

  useEffect(() => {
    if (!user) return;
    const txRef = ref(database, `walletTransactions/${user.uid}`);
    const unsub = onValue(txRef, (snap) => {
      if (!snap.exists()) { setTransactions([]); setLoading(false); return; }
      const result: WalletTransaction[] = [];
      snap.forEach((child) => result.push({ id: child.key!, ...child.val() }));
      result.sort((a, b) => b.createdAt - a.createdAt);
      setTransactions(result);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const years = useMemo(() => {
    if (transactions.length === 0) return [new Date().getFullYear()];
    const set = new Set(transactions.map((tx) => new Date(tx.createdAt).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [transactions]);

  // Monthly totals for the selected year (earnings only for the bar chart)
  const monthlyEarnings = useMemo(() => {
    const totals = Array(12).fill(0) as number[];
    transactions.forEach((tx) => {
      const d = new Date(tx.createdAt);
      if (d.getFullYear() === selectedYear && tx.type === 'payment_received') {
        totals[d.getMonth()] += tx.amount;
      }
    });
    return totals;
  }, [transactions, selectedYear]);

  const maxMonthly = Math.max(...monthlyEarnings, 1);

  // Summary cards
  const now = new Date();
  const thisMonth = useMemo(() =>
    transactions
      .filter((tx) => {
        const d = new Date(tx.createdAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && tx.type === 'payment_received';
      })
      .reduce((s, tx) => s + tx.amount, 0),
  [transactions]);

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = useMemo(() =>
    transactions
      .filter((tx) => {
        const d = new Date(tx.createdAt);
        return d.getFullYear() === lastMonthDate.getFullYear() && d.getMonth() === lastMonthDate.getMonth() && tx.type === 'payment_received';
      })
      .reduce((s, tx) => s + tx.amount, 0),
  [transactions]);

  const ytd = useMemo(() =>
    transactions
      .filter((tx) => new Date(tx.createdAt).getFullYear() === now.getFullYear() && tx.type === 'payment_received')
      .reduce((s, tx) => s + tx.amount, 0),
  [transactions]);

  const totalWithdrawn = useMemo(() =>
    transactions
      .filter((tx) => tx.type === 'withdrawal')
      .reduce((s, tx) => s + Math.abs(tx.amount), 0),
  [transactions]);

  // Filtered rows for the table
  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const d = new Date(tx.createdAt);
      const yearMatch = d.getFullYear() === selectedYear;
      const monthMatch = selectedMonth === null || d.getMonth() === selectedMonth;
      const typeMatch = typeFilter === 'all' || tx.type === typeFilter;
      return yearMatch && monthMatch && typeMatch;
    });
  }, [transactions, selectedYear, selectedMonth, typeFilter]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  const currentMonthName = MONTH_NAMES[now.getMonth()];
  const lastMonthName = MONTH_NAMES[lastMonthDate.getMonth()];

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Statements</h2>
          <p className="text-slate-400 text-sm mt-1">Earnings history and transaction records.</p>
        </div>
        <button
          onClick={() => exportCSV(filtered)}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-sm font-medium px-4 py-2 rounded-xl border border-slate-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label={`${currentMonthName} earnings`}
          value={fmt(thisMonth)}
          sub="This month"
          accent="emerald"
          icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
        />
        <SummaryCard
          label={`${lastMonthName} earnings`}
          value={fmt(lastMonth)}
          sub="Last month"
          accent="slate"
          icon={<Calendar className="w-4 h-4 text-slate-400" />}
        />
        <SummaryCard
          label="Year to date"
          value={fmt(ytd)}
          sub={String(now.getFullYear())}
          accent="blue"
          icon={<FileText className="w-4 h-4 text-blue-400" />}
        />
        <SummaryCard
          label="Total paid out"
          value={fmt(totalWithdrawn)}
          sub="All time"
          accent="slate"
          icon={<ArrowUpRight className="w-4 h-4 text-slate-400" />}
        />
      </div>

      {/* Monthly bar chart */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white text-sm font-semibold">Monthly Earnings</p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedYear((y) => y - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-slate-300 text-sm font-medium w-12 text-center">{selectedYear}</span>
            <button
              onClick={() => setSelectedYear((y) => y + 1)}
              disabled={selectedYear >= now.getFullYear()}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-end gap-1.5 h-28">
          {MONTH_NAMES.map((month, i) => {
            const val = monthlyEarnings[i];
            const heightPct = val > 0 ? Math.max((val / maxMonthly) * 100, 6) : 0;
            const isSelected = selectedMonth === i;
            const isCurrentMonth = selectedYear === now.getFullYear() && i === now.getMonth();

            return (
              <button
                key={month}
                onClick={() => setSelectedMonth(isSelected ? null : i)}
                className="flex-1 flex flex-col items-center gap-1 group"
                title={`${month}: ${fmt(val)}`}
              >
                <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                  <div
                    className={`w-full rounded-t-md transition-all duration-200 ${
                      val === 0
                        ? 'bg-slate-800 opacity-40'
                        : isSelected
                        ? 'bg-blue-500'
                        : isCurrentMonth
                        ? 'bg-emerald-500 group-hover:bg-emerald-400'
                        : 'bg-slate-600 group-hover:bg-slate-500'
                    }`}
                    style={{ height: val > 0 ? `${heightPct}%` : '4px' }}
                  />
                </div>
                <span className={`text-[10px] font-medium transition-colors ${isSelected ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                  {month}
                </span>
              </button>
            );
          })}
        </div>

        {selectedMonth !== null && (
          <p className="text-xs text-slate-500 mt-3">
            Showing {MONTH_NAMES[selectedMonth]} {selectedYear} —{' '}
            <button onClick={() => setSelectedMonth(null)} className="text-blue-400 hover:text-blue-300">
              clear filter
            </button>
          </p>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        {(Object.keys(TYPE_LABELS) as TxFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setTypeFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              typeFilter === f
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-white hover:border-slate-500'
            }`}
          >
            {TYPE_LABELS[f]}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Transaction table */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="hidden sm:grid grid-cols-[1fr_2fr_auto_auto] gap-4 px-5 py-3 border-b border-slate-800">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Date</p>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Description</p>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Type</p>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide text-right">Amount</p>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FileText className="w-10 h-10 text-slate-700" />
            <p className="text-slate-500 text-sm">No transactions found.</p>
            {(typeFilter !== 'all' || selectedMonth !== null) && (
              <button
                onClick={() => { setTypeFilter('all'); setSelectedMonth(null); }}
                className="text-blue-400 hover:text-blue-300 text-xs"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filtered.map((tx) => {
              const date = new Date(tx.createdAt);
              const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={tx.id} className="grid grid-cols-[auto_1fr] sm:grid-cols-[1fr_2fr_auto_auto] gap-3 sm:gap-4 items-center px-5 py-3.5 hover:bg-slate-800/30 transition-colors">
                  {/* Icon (mobile) */}
                  <div className="sm:hidden w-8 h-8 rounded-lg bg-[#0E1422] border border-slate-800 flex items-center justify-center shrink-0">
                    {txIcon(tx.type)}
                  </div>

                  {/* Date */}
                  <div className="hidden sm:block">
                    <p className="text-slate-300 text-sm">{dateStr}</p>
                    <p className="text-slate-600 text-xs mt-0.5">{timeStr}</p>
                  </div>

                  {/* Description + mobile date */}
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{tx.description}</p>
                    <p className="text-slate-500 text-xs mt-0.5 sm:hidden">{dateStr}</p>
                    {tx.orderId && (
                      <p className="text-slate-600 text-xs mt-0.5 hidden sm:block truncate">Order #{tx.orderId.slice(-8)}</p>
                    )}
                  </div>

                  {/* Type badge */}
                  <span className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border whitespace-nowrap ${TYPE_BADGE[tx.type]}`}>
                    {txIcon(tx.type)}
                    {tx.type.replace(/_/g, ' ')}
                  </span>

                  {/* Amount */}
                  <span className={`text-sm font-semibold shrink-0 text-right ${amountColor(tx.type)}`}>
                    {tx.amount >= 0 ? '+' : ''}{fmt(Math.abs(tx.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Summary card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  sub: string;
  accent: 'emerald' | 'blue' | 'slate';
  icon: React.ReactNode;
}

const accentMap: Record<string, string> = {
  emerald: 'border-emerald-500/20 bg-emerald-500/5',
  blue:    'border-blue-500/20    bg-blue-500/5',
  slate:   'border-slate-700      bg-slate-800/40',
};

function SummaryCard({ label, value, sub, accent, icon }: SummaryCardProps) {
  return (
    <div className={`bg-[#111827] border rounded-xl p-4 ${accentMap[accent]}`}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <p className="text-slate-400 text-xs font-medium truncate">{label}</p>
      </div>
      <p className="text-white text-lg font-bold leading-tight">{value}</p>
      <p className="text-slate-600 text-xs mt-1">{sub}</p>
    </div>
  );
}
