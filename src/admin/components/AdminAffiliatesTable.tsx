import { useEffect, useState } from 'react';
import { Eye, Pencil, UserX, UserCheck, Plus } from 'lucide-react';
import AdminPagination from './AdminPagination';

export interface AdminAffiliate {
  uid: string;
  name: string;
  email: string;
  username: string;
  photoURL: string;
  referralCode: string;
  totalReferrals: number;
  lifetimeEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  createdAt: number;
  disabled?: boolean;
}

interface Props {
  affiliates: AdminAffiliate[];
  loading: boolean;
  pageSize?: number;
  onView?:       (a: AdminAffiliate) => void;
  onEdit?:       (a: AdminAffiliate) => void;
  onDeactivate?: (a: AdminAffiliate) => void;
  onNew?:        () => void;
}

const fmtDate = (ts: number) =>
  ts ? new Date(ts).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '—';

const fmtUSD = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminAffiliatesTable({ affiliates, loading, pageSize = 100, onView, onEdit, onDeactivate, onNew }: Props) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [affiliates.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (affiliates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-white font-semibold text-base">No affiliates yet</p>
        <p className="text-slate-500 text-sm mt-1">Affiliates will appear here once they sign up.</p>
        {onNew && (
          <button
            onClick={onNew}
            className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Affiliate
          </button>
        )}
      </div>
    );
  }

  const visible = affiliates.slice(page * pageSize, (page + 1) * pageSize);
  const hasActions = onView || onEdit || onDeactivate;

  return (
    <div className="bg-surface border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">Affiliates</h3>
          <span className="text-xs text-slate-500">{affiliates.length.toLocaleString()} total</span>
        </div>
        {onNew && (
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Affiliate
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-slate-500 text-xs border-b border-slate-800 bg-background/60">
              <th className="text-left px-5 py-3.5 font-medium">Affiliate</th>
              <th className="text-left px-5 py-3.5 font-medium">Referral Code</th>
              <th className="text-left px-5 py-3.5 font-medium">Referrals</th>
              <th className="text-left px-5 py-3.5 font-medium">Lifetime Earnings</th>
              <th className="text-left px-5 py-3.5 font-medium">Available</th>
              <th className="text-left px-5 py-3.5 font-medium">Pending</th>
              <th className="text-left px-5 py-3.5 font-medium">Status</th>
              <th className="text-left px-5 py-3.5 font-medium">Joined</th>
              {hasActions && <th className="text-right px-5 py-3.5 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((a) => (
              <tr key={a.uid} className={`border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20 transition-colors ${a.disabled ? 'opacity-60' : ''}`}>
                {/* Affiliate: avatar + name + email */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {a.photoURL ? (
                      <img src={a.photoURL} alt={a.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                        {(a.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{a.name || '—'}</p>
                      <p className="text-slate-500 text-xs truncate">{a.email}</p>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4">
                  {a.referralCode ? (
                    <span className="text-slate-300 font-mono text-xs bg-slate-800 px-2 py-1 rounded">{a.referralCode}</span>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
                  )}
                </td>

                <td className="px-5 py-4 text-slate-300">{a.totalReferrals.toLocaleString()}</td>

                <td className="px-5 py-4 text-white font-semibold">{fmtUSD(a.lifetimeEarnings)}</td>

                <td className="px-5 py-4">
                  <span className="text-emerald-400 font-semibold">{fmtUSD(a.availableBalance)}</span>
                </td>

                <td className="px-5 py-4">
                  <span className="text-yellow-400">{fmtUSD(a.pendingBalance)}</span>
                </td>

                {/* Status */}
                <td className="px-5 py-4">
                  {a.disabled ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">Deactivated</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">Active</span>
                  )}
                </td>

                <td className="px-5 py-4 text-slate-500 text-xs whitespace-nowrap">{fmtDate(a.createdAt)}</td>

                {hasActions && (
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {onView && (
                        <button onClick={() => onView(a)} title="View" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onEdit && (
                        <button onClick={() => onEdit(a)} title="Edit" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeactivate && (
                        <button
                          onClick={() => onDeactivate(a)}
                          title={a.disabled ? 'Reactivate' : 'Deactivate'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            a.disabled
                              ? 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                              : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                          }`}
                        >
                          {a.disabled ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} pageSize={pageSize} total={affiliates.length} onPageChange={setPage} />
    </div>
  );
}
