import { useEffect, useState } from 'react';
import { Eye, Pencil, UserX, UserCheck, Plus } from 'lucide-react';
import AdminPagination from './AdminPagination';

export interface AdminUser {
  uid: string;
  name: string;
  email: string;
  username: string;
  photoURL: string;
  accountType: string;
  role: string;
  createdAt: number;
  disabled?: boolean;
}

interface Props {
  users: AdminUser[];
  loading: boolean;
  pageSize?: number;
  onView:         (user: AdminUser) => void;
  onEdit:         (user: AdminUser) => void;
  onDelete:       (user: AdminUser) => void;
  onNew?:         () => void;
}

const SkeletonRow = () => (
  <tr className="border-b border-slate-800/50">
    {[160, 60, 60, 80, 80].map((w, i) => (
      <td key={i} className="px-5 py-3">
        <div className="h-4 bg-slate-800 rounded animate-pulse" style={{ width: `${w}px` }} />
      </td>
    ))}
  </tr>
);

const accountBadge = (type: string) => {
  if (type === 'seller')    return 'bg-emerald-500/10 text-emerald-400';
  if (type === 'affiliate') return 'bg-orange-500/10 text-orange-400';
  return 'bg-blue-500/10 text-blue-400';
};

const SELECT_CLASS =
  'bg-surface-raised border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors';

const AdminUsersTable = ({ users, loading, pageSize = 100, onView, onEdit, onDelete, onNew }: Props) => {
  const [page, setPage] = useState(0);
  const [typeFilter,   setTypeFilter]   = useState<'all' | 'buyer' | 'seller'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deactivated'>('all');
  useEffect(() => { setPage(0); }, [users.length, typeFilter, statusFilter]);

  // Affiliates have their own tab — exclude them (and admins) from the Users list.
  const base = users.filter((u) => u.role !== 'admin' && u.accountType !== 'affiliate');
  const nonAdmins = base.filter((u) => {
    if (typeFilter !== 'all' && u.accountType !== typeFilter) return false;
    if (statusFilter === 'active'      &&  u.disabled) return false;
    if (statusFilter === 'deactivated' && !u.disabled) return false;
    return true;
  });
  const visible = nonAdmins.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">Users</h3>
          {!loading && <span className="text-xs text-slate-500">{nonAdmins.length.toLocaleString()} total</span>}
        </div>
        <div className="flex items-center gap-2">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className={SELECT_CLASS} aria-label="Filter by account type">
            <option value="all">All types</option>
            <option value="buyer">Buyers</option>
            <option value="seller">Sellers</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={SELECT_CLASS} aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
          </select>
          {onNew && (
            <button
              onClick={onNew}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-blue-400 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New User
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {['User', 'Account', 'Status', 'Joined', 'Actions'].map((h) => (
                <th
                  key={h}
                  className={`px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide ${h === 'Actions' ? 'text-right' : 'text-left'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : visible.map((u) => (
                  <tr key={u.uid} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    {/* User: avatar + name + email */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.name} loading="lazy" decoding="async" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-blue-400">{u.name?.charAt(0)?.toUpperCase() ?? '?'}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-white font-medium text-sm truncate">{u.name || '—'}</p>
                          <p className="text-slate-500 text-xs truncate">{u.email || '—'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Account type */}
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${accountBadge(u.accountType)}`}>
                        {u.accountType}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      {u.disabled ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">Deactivated</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">Active</span>
                      )}
                    </td>

                    {/* Joined */}
                    <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onView(u)}
                          title="View"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onEdit(u)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(u)}
                          title={u.disabled ? 'Reactivate' : 'Deactivate'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.disabled
                              ? 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                              : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                          }`}
                        >
                          {u.disabled ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {!loading && nonAdmins.length === 0 && (
          <p className="text-center text-slate-500 text-sm py-10">No users found</p>
        )}
      </div>

      {!loading && (
        <AdminPagination page={page} pageSize={pageSize} total={nonAdmins.length} onPageChange={setPage} />
      )}
    </div>
  );
};

export default AdminUsersTable;
