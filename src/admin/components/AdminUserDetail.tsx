import { useEffect, useState } from 'react';
import {
  ArrowLeft, LogIn, Pencil, UserX, UserCheck, Package, DollarSign, CreditCard,
  MapPin, Loader2, ExternalLink, Wallet, ShoppingBag,
} from 'lucide-react';
import { signInWithCustomToken } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { auth } from '../../firebase';
import { adminGetUserStats, adminImpersonate, type AdminUserStats } from '../adminApi';
import { type AdminUser } from './AdminUsersTable';

interface Props {
  user: AdminUser;
  onBack: () => void;
  onEdit: (u: AdminUser) => void;
  onDeactivate: (u: AdminUser) => void;
}

const fmtUSD = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (ts: number) => ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const StatCard = ({ icon: Icon, label, value, color = 'text-white' }: {
  icon: React.ElementType; label: string; value: string | number; color?: string;
}) => (
  <div className="bg-surface rounded-xl border border-slate-800 p-4">
    <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wide">
      <Icon className="w-3.5 h-3.5" /> {label}
    </div>
    <p className={`text-xl font-bold mt-1.5 ${color}`}>{value}</p>
  </div>
);

export default function AdminUserDetail({ user, onBack, onEdit, onDeactivate }: Props) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStats(null); setError(null);
    adminGetUserStats(user.uid)
      .then((s) => { if (!cancelled) setStats(s); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load stats'); });
    return () => { cancelled = true; };
  }, [user.uid]);

  const handleImpersonate = async () => {
    if (!window.confirm(`Sign in as ${user.name || 'this user'} for support?\n\nYou'll be signed out of admin and into their account.`)) return;
    setImpersonating(true);
    try {
      const { token } = await adminImpersonate(user.uid);
      await signInWithCustomToken(auth, token);
      toast.success(`Signed in as ${user.name || user.email}.`);
      navigate('/', { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to impersonate');
      setImpersonating(false);
    }
  };

  const isSeller = (stats?.accountType ?? user.accountType) === 'seller';

  return (
    <div>
      {/* Header with back arrow + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to users
        </button>
        <div className="flex items-center gap-2">
          {user.role !== 'admin' && (
            <button onClick={handleImpersonate} disabled={impersonating} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-blue-400 text-white text-xs font-semibold transition-colors disabled:opacity-50">
              <LogIn className="w-3.5 h-3.5" /> {impersonating ? 'Signing in…' : 'Impersonate'}
            </button>
          )}
          <button onClick={() => onEdit(user)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button onClick={() => onDeactivate(user)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${user.disabled ? 'bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20' : 'bg-red-600/10 text-red-400 hover:bg-red-600/20'}`}>
            {user.disabled ? <><UserCheck className="w-3.5 h-3.5" /> Reactivate</> : <><UserX className="w-3.5 h-3.5" /> Deactivate</>}
          </button>
        </div>
      </div>

      {/* Identity */}
      <div className="bg-surface rounded-xl border border-slate-800 p-5 mb-5 flex items-center gap-4">
        {user.photoURL ? (
          <img src={user.photoURL} alt={user.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-blue-400">{user.name?.charAt(0)?.toUpperCase() ?? '?'}</span>
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-white truncate">{user.name || '—'}</h1>
          <p className="text-slate-500 text-sm truncate">{user.email}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${user.accountType === 'seller' ? 'bg-emerald-500/10 text-emerald-400' : user.accountType === 'affiliate' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'}`}>{user.accountType}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.disabled ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{user.disabled ? 'Deactivated' : 'Active'}</span>
            <span className="text-slate-600 text-xs">Joined {fmtDate(user.createdAt)}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-3 border border-red-500/20 mb-5">
          {error} — ensure the backend admin API is reachable.
        </div>
      )}

      {stats === null && !error ? (
        <div className="py-12 flex justify-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : stats && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            {isSeller ? (
              <>
                <StatCard icon={Package}     label="Posts"            value={stats.postsCount} />
                <StatCard icon={ShoppingBag} label="Completed Sales"  value={stats.salesCount} />
                <StatCard icon={DollarSign}  label="Sales Total"      value={fmtUSD(stats.salesTotal)} color="text-emerald-400" />
                <StatCard icon={CreditCard}  label="Subscription /mo" value={stats.subscriptionCount ? fmtUSD(stats.subscriptionAmount) : '—'} color="text-blue-400" />
                <StatCard icon={Wallet}      label="Lifetime Earnings" value={fmtUSD(stats.wallet.lifetimeEarnings)} />
                <StatCard icon={Wallet}      label="Available"         value={fmtUSD(stats.wallet.availableBalance)} color="text-emerald-400" />
                <StatCard icon={Wallet}      label="Pending"           value={fmtUSD(stats.wallet.pendingBalance)} color="text-yellow-400" />
                <StatCard icon={ShoppingBag} label="Orders Placed"     value={stats.ordersAsBuyer} />
              </>
            ) : (
              <>
                <StatCard icon={ShoppingBag} label="Orders Placed" value={stats.ordersAsBuyer} />
                <StatCard icon={DollarSign}  label="Total Spent"   value={fmtUSD(stats.spentTotal)} color="text-emerald-400" />
                <StatCard icon={Package}     label="Posts"         value={stats.postsCount} />
                <StatCard icon={CreditCard}  label="Subscription /mo" value={stats.subscriptionCount ? fmtUSD(stats.subscriptionAmount) : '—'} color="text-blue-400" />
              </>
            )}
          </div>

          {/* Seller business info */}
          {isSeller && (stats.seller.category || stats.seller.location) && (
            <div className="bg-surface rounded-xl border border-slate-800 p-5 mb-5">
              <h3 className="text-sm font-semibold text-white mb-3">Business</h3>
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                {stats.seller.category && <div><span className="text-slate-500">Category: </span><span className="text-slate-300 capitalize">{stats.seller.category}</span></div>}
                {stats.seller.location && <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-500" /><span className="text-slate-300">{stats.seller.location}</span></div>}
              </div>
            </div>
          )}

          {/* Posts list */}
          <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Posts</h3>
              <span className="text-xs text-slate-500">{stats.posts.length} total</span>
            </div>
            {stats.posts.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-10">No posts created.</p>
            ) : (
              <ul className="divide-y divide-slate-800/60">
                {stats.posts.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-800/20 transition-colors">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.title} className="w-10 h-10 rounded-lg object-cover border border-slate-700/60 flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700/60 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate">{p.title || '—'}</p>
                      <p className="text-slate-500 text-xs capitalize">{p.category || '—'} · {fmtDate(p.createdAt)}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${p.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>{p.status}</span>
                    <button onClick={() => window.open(`/service-detail?id=${p.id}`, '_blank', 'noopener,noreferrer')} title="Open post" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors flex-shrink-0">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {impersonating && <div className="fixed bottom-4 right-4 flex items-center gap-2 text-xs text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Signing in…</div>}
    </div>
  );
}
