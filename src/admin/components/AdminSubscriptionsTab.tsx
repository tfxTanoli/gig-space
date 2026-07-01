import { useEffect, useState } from 'react';
import { CreditCard, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminGetSubscriptions, adminCancelSubscription, type AdminSubscription } from '../adminApi';
import AdminPagination from './AdminPagination';

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-emerald-500/10 text-emerald-400',
  trialing: 'bg-blue-500/10 text-blue-400',
  past_due: 'bg-yellow-500/10 text-yellow-400',
  unpaid:   'bg-orange-500/10 text-orange-400',
  canceled: 'bg-red-500/10 text-red-400',
  incomplete: 'bg-slate-700 text-slate-300',
  incomplete_expired: 'bg-slate-700 text-slate-400',
};

const fmtUSD = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (ts: number) =>
  ts ? new Date(ts).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '—';

const PAGE_SIZE = 100;

export default function AdminSubscriptionsTab() {
  const [subs, setSubs] = useState<AdminSubscription[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const { subscriptions } = await adminGetSubscriptions();
      setSubs(subscriptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
      setSubs([]);
    }
  };

  useEffect(() => { load(); }, []);

  const doCancel = async (id: string) => {
    setCanceling(true);
    try {
      await adminCancelSubscription(id);
      setSubs((prev) => prev?.map((s) => s.id === id ? { ...s, status: 'canceled' } : s) ?? null);
      toast.success('Subscription canceled.');
      setCancelId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally { setCanceling(false); }
  };

  const active = (subs ?? []).filter((s) => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due');
  const mrr = active.reduce((sum, s) => sum + s.amount, 0);
  const visible = (subs ?? []).slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">Subscriptions</h1>
        <p className="text-slate-500 text-sm mt-0.5">Active seller location subscriptions ($5/mo per extra location)</p>
      </div>

      {/* Summary */}
      {subs !== null && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
          <div className="bg-surface rounded-xl border border-slate-800 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Active</p>
            <p className="text-2xl font-bold text-white mt-1">{active.length.toLocaleString()}</p>
          </div>
          <div className="bg-surface rounded-xl border border-slate-800 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Monthly Revenue</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{fmtUSD(mrr)}</p>
          </div>
          <div className="bg-surface rounded-xl border border-slate-800 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-white mt-1">{(subs?.length ?? 0).toLocaleString()}</p>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2.5">
          <CreditCard className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Subscriptions</h3>
        </div>

        {error && (
          <div className="m-5 flex items-start gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2.5 border border-red-500/20">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error} — ensure the backend admin API is deployed and reachable.</span>
          </div>
        )}

        {subs === null ? (
          <div className="py-12 flex justify-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : subs.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-12">No subscriptions yet. They appear here when sellers pay for extra post locations.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-800">
                    {['Seller', 'Locations', 'Amount / mo', 'Status', 'Renews', 'Actions'].map((h) => (
                      <th key={h} className={`px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => (
                    <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-white font-medium">{s.sellerName || '—'}</p>
                        <p className="text-slate-500 text-xs">{s.sellerEmail || s.sellerId || '—'}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-300">{s.quantity}</td>
                      <td className="px-5 py-3 text-white font-semibold">{fmtUSD(s.amount)}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[s.status] ?? 'bg-slate-700 text-slate-400'}`}>
                          {s.status.replace(/_/g, ' ')}
                        </span>
                        {s.cancelAtPeriodEnd && s.status !== 'canceled' && (
                          <span className="ml-1.5 text-[10px] text-yellow-400">ends soon</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(s.currentPeriodEnd)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end">
                          {(s.status === 'active' || s.status === 'trialing' || s.status === 'past_due') && (
                            cancelId === s.id ? (
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => setCancelId(null)} disabled={canceling} className="px-2 py-1 rounded-lg text-xs text-slate-400 hover:bg-slate-700 transition-colors disabled:opacity-50">Keep</button>
                                <button onClick={() => doCancel(s.id)} disabled={canceling} className="px-2 py-1 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-50">
                                  {canceling ? 'Canceling…' : 'Confirm cancel'}
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setCancelId(s.id)} title="Cancel subscription" className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                <XCircle className="w-3.5 h-3.5" /> Cancel
                              </button>
                            )
                          )}
                          {(s.status === 'canceled' || s.status.startsWith('incomplete')) && (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination page={page} pageSize={PAGE_SIZE} total={subs.length} onPageChange={setPage} />
          </>
        )}
      </div>

      {canceling && <div className="fixed bottom-4 right-4 flex items-center gap-2 text-xs text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Working…</div>}
    </>
  );
}
