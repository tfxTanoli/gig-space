import { useEffect, useState } from 'react';
import { X, AlertTriangle, UserX, UserCheck } from 'lucide-react';
import { ref as dbRef, update } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { adminSetUserDisabled } from '../adminApi';
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

  const reactivating = !!user.disabled;

  const handleDelete = async () => {
    if (!authUser) return;
    if (authUser.uid === user.uid) {
      setError('You cannot deactivate your own account'); return;
    }
    setError(null);
    setDeleting(true);
    try {
      // Write the `disabled` flag — enforced at sign-in by AuthContext, so it
      // works even if the backend is unreachable.
      await update(dbRef(database, `users/${user.uid}`), {
        disabled: !reactivating,
        disabledAt: reactivating ? null : Date.now(),
        disabledBy: reactivating ? null : authUser.uid,
        ...(reactivating ? {} : { role: 'user' }),
      });

      // Best-effort: harden at the Firebase Auth level (disable the auth account
      // and revoke active sessions). Non-fatal if the backend isn't deployed —
      // the RTDB flag above already blocks new sign-ins.
      try {
        await adminSetUserDisabled(user.uid, !reactivating);
      } catch { /* non-fatal — RTDB flag still enforces deactivation */ }

      onSuccess(user.uid);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${reactivating ? 'reactivate' : 'deactivate'} user`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header — title intentionally omitted; the action is stated in the body */}
        <div className="flex items-center justify-end px-6 py-4">
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6">
          <div className={`flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4 border ${reactivating ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            {reactivating ? <UserCheck className="w-5 h-5 text-emerald-400" /> : <UserX className="w-5 h-5 text-red-400" />}
          </div>

          <p className="text-center text-white font-semibold mb-1">
            {reactivating ? 'Reactivate' : 'Deactivate'} "{user.name || 'this user'}"?
          </p>
          <p className="text-center text-slate-500 text-sm mb-5">
            {reactivating
              ? 'This restores the user\'s access to Gigspace. Their account type and data are unchanged.'
              : 'This blocks the user from signing in to Gigspace and revokes any admin role. The record stays for audit history.'}
          </p>

          {/* User preview */}
          <div className="bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/50 mb-4">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.name} loading="lazy" decoding="async" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
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

          {!reactivating && (
            <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-700/50">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Their posts, orders, and wallet data remain in the database for audit and stay linked to the account, so you can reactivate them later.</span>
            </div>
          )}

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
            className={`flex-1 py-2 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-50 ${
              reactivating ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {deleting
              ? (reactivating ? 'Reactivating…' : 'Deactivating…')
              : (reactivating ? 'Reactivate' : 'Deactivate')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminUserDeleteModal;
