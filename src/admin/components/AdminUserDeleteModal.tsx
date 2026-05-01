import { useEffect, useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { type AdminUser } from './AdminUsersTable';

interface Props {
  user: AdminUser;
  onClose: () => void;
  onSuccess: (uid: string) => void;
}

const AdminUserDeleteModal = ({ user, onClose, onSuccess }: Props) => {
  const { user: authUser } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDelete = async () => {
    if (!authUser) return;
    setError(null);
    setDeleting(true);
    try {
      const token = await authUser.getIdToken();
      const res = await fetch(`/api/admin/users/${user.uid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to delete user'); return; }
      onSuccess(user.uid);
      onClose();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">Delete User</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mx-auto mb-4">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>

          <p className="text-center text-white font-semibold mb-1">
            Delete "{user.name || 'this user'}"?
          </p>
          <p className="text-center text-slate-500 text-sm mb-5">
            This will permanently remove the account from Firebase Auth and the database. This action cannot be undone.
          </p>

          {/* User preview */}
          <div className="bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/50 mb-4">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-blue-400">
                    {user.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">{user.name || '—'}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2.5 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>The user's services, orders, and wallet data will remain in the database but will be unlinked.</span>
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2.5 border border-red-500/20">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete User'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminUserDeleteModal;
