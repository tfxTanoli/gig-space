import { Eye, Pencil, Trash2 } from 'lucide-react';

export interface AdminUser {
  uid: string;
  name: string;
  email: string;
  username: string;
  photoURL: string;
  accountType: string;
  role: string;
  createdAt: number;
}

interface Props {
  users: AdminUser[];
  loading: boolean;
  onView:   (user: AdminUser) => void;
  onEdit:   (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
}

const SkeletonRow = () => (
  <tr className="border-b border-slate-800/50">
    {[100, 160, 70, 60, 70, 80].map((w, i) => (
      <td key={i} className="px-5 py-3">
        <div className="h-4 bg-slate-800 rounded animate-pulse" style={{ width: `${w}px` }} />
      </td>
    ))}
  </tr>
);

const AdminUsersTable = ({ users, loading, onView, onEdit, onDelete }: Props) => (
  <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
    <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-white">Users</h3>
      {!loading && <span className="text-xs text-slate-500">{users.length} shown</span>}
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            {['Name', 'Email', 'Account', 'Role', 'Joined', 'Actions'].map((h) => (
              <th
                key={h}
                className={`px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide ${
                  h === 'Actions' ? 'text-right' : 'text-left'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : users.map((u) => (
                <tr
                  key={u.uid}
                  className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                >
                  {/* Name + avatar */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt={u.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-blue-400">
                            {u.name?.charAt(0)?.toUpperCase() ?? '?'}
                          </span>
                        </div>
                      )}
                      <span className="text-white font-medium whitespace-nowrap">{u.name || '—'}</span>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-5 py-3 text-slate-400 max-w-[180px] truncate">{u.email || '—'}</td>

                  {/* Account type */}
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                      u.accountType === 'seller'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {u.accountType}
                    </span>
                  </td>

                  {/* System role */}
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                      u.role === 'admin'
                        ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
                        : 'bg-slate-700/60 text-slate-400'
                    }`}>
                      {u.role}
                    </span>
                  </td>

                  {/* Joined */}
                  <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
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
                        title="Delete"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>

      {!loading && users.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-10">No users found</p>
      )}
    </div>
  </div>
);

export default AdminUsersTable;
