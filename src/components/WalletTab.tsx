import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../AuthContext';
import StripeConnectCard from './StripeConnectCard';
import WithdrawModal from './WithdrawModal';
import {
  DollarSign, Clock, TrendingUp, ArrowUpRight,
  ArrowDownLeft, RotateCcw, Wallet, Loader2,
} from 'lucide-react';
import type { Wallet as WalletType, WalletTransaction } from '../stripe/types';

const MIN_WITHDRAWAL = 10;

function txIcon(type: WalletTransaction['type']) {
  switch (type) {
    case 'payment_received': return <ArrowDownLeft className="w-4 h-4 text-emerald-400" />;
    case 'withdrawal':       return <ArrowUpRight className="w-4 h-4 text-blue-400" />;
    case 'refund':           return <RotateCcw className="w-4 h-4 text-red-400" />;
    default:                 return <DollarSign className="w-4 h-4 text-slate-400" />;
  }
}

function txColor(type: WalletTransaction['type']) {
  switch (type) {
    case 'payment_received': return 'text-emerald-400';
    case 'withdrawal':       return 'text-blue-400';
    case 'refund':           return 'text-red-400';
    default:                 return 'text-slate-400';
  }
}

export default function WalletTab() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;

    const walletRef = ref(database, `wallets/${user.uid}`);
    const txRef = ref(database, `walletTransactions/${user.uid}`);

    const unsubWallet = onValue(walletRef, (snap) => {
      if (snap.exists()) {
        setWallet(snap.val() as WalletType);
      } else {
        // Default empty wallet for sellers who haven't earned yet
        setWallet({
          availableBalance: 0,
          pendingBalance: 0,
          lifetimeEarnings: 0,
          totalWithdrawn: 0,
          updatedAt: Date.now(),
        });
      }
      setLoading(false);
    });

    const unsubTx = onValue(txRef, (snap) => {
      if (!snap.exists()) {
        setTransactions([]);
        return;
      }
      const result: WalletTransaction[] = [];
      snap.forEach((child) => {
        result.push({ id: child.key!, ...child.val() });
      });
      setTransactions(result.sort((a, b) => b.createdAt - a.createdAt));
    });

    return () => {
      unsubWallet();
      unsubTx();
    };
  }, [user, refreshKey]);

  const available = wallet?.availableBalance ?? 0;
  const pending = wallet?.pendingBalance ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {showWithdraw && (
        <WithdrawModal
          availableBalance={available}
          onClose={() => setShowWithdraw(false)}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}

      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-xl font-bold text-white">Payouts & Wallet</h2>
          <p className="text-slate-400 text-sm mt-1">Manage your earnings and withdraw funds.</p>
        </div>

        {/* Balance cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <BalanceCard
            label="Available"
            value={available}
            icon={<Wallet className="w-4 h-4 text-emerald-400" />}
            accent="emerald"
            tooltip="Ready to withdraw"
          />
          <BalanceCard
            label="Pending"
            value={pending}
            icon={<Clock className="w-4 h-4 text-yellow-400" />}
            accent="yellow"
            tooltip="Held in escrow — released when buyer approves delivery"
          />
          <BalanceCard
            label="Lifetime"
            value={wallet?.lifetimeEarnings ?? 0}
            icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
            accent="blue"
          />
          <BalanceCard
            label="Withdrawn"
            value={wallet?.totalWithdrawn ?? 0}
            icon={<ArrowUpRight className="w-4 h-4 text-slate-400" />}
            accent="slate"
          />
        </div>

        {/* Withdraw button */}
        <button
          onClick={() => setShowWithdraw(true)}
          disabled={available < MIN_WITHDRAWAL}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
        >
          <ArrowUpRight className="w-4 h-4" />
          Withdraw funds
          {available < MIN_WITHDRAWAL && (
            <span className="text-blue-300 font-normal">(min $10)</span>
          )}
        </button>

        {/* Stripe Connect */}
        <StripeConnectCard />

        {/* Transaction history */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h3 className="text-white font-semibold text-sm">Transaction history</h3>
          </div>

          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <DollarSign className="w-10 h-10 text-slate-700" />
              <p className="text-slate-500 text-sm">No transactions yet.</p>
              <p className="text-slate-600 text-xs">Transactions appear here when orders are paid.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0E1422] border border-slate-800 flex items-center justify-center shrink-0">
                    {txIcon(tx.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{tx.description}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {new Date(tx.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ${txColor(tx.type)}`}>
                    {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface BalanceCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: 'emerald' | 'yellow' | 'blue' | 'slate';
  tooltip?: string;
}

const accentMap: Record<string, string> = {
  emerald: 'bg-emerald-500/10 border-emerald-500/20',
  yellow:  'bg-yellow-500/10  border-yellow-500/20',
  blue:    'bg-blue-500/10    border-blue-500/20',
  slate:   'bg-slate-700/30   border-slate-700',
};

function BalanceCard({ label, value, icon, accent, tooltip }: BalanceCardProps) {
  return (
    <div
      className={`bg-[#111827] border rounded-xl p-4 ${accentMap[accent]}`}
      title={tooltip}
    >
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <p className="text-slate-400 text-xs font-medium">{label}</p>
      </div>
      <p className="text-white text-xl font-bold">${value.toFixed(2)}</p>
    </div>
  );
}
