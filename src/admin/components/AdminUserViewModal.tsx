import { useEffect, useState } from 'react';
import { X, Mail, User, Calendar, Hash, Shield, Briefcase, LogIn } from 'lucide-react';
import { signInWithCustomToken } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { auth } from '../../firebase';
import { adminImpersonate } from '../adminApi';
import { type AdminUser } from './AdminUsersTable';

interface Props {
  user: AdminUser;
  onClose: () => void;
}

const Field = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
      <Icon className="w-3.5 h-3.5 text-slate-400" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm text-white break-all">{value || '—'}</p>
    </div>
  </div>
);

const AdminUserViewModal = ({ user, onClose }: Props) => {
  const navigate = useNavigate();
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleImpersonate = async () => {
    const ok = window.confirm(
      `Sign in as ${user.name || 'this user'} for support?\n\nYou will be signed out of the admin account and into theirs. Sign back in with your admin credentials when you're done.`,
    );
    if (!ok) return;
    setImpersonating(true);
    try {
      const { token } = await adminImpersonate(user.uid);
      await signInWithCustomToken(auth, token);
      toast.success(`You are now signed in as ${user.name || user.email}.`);
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to impersonate user');
      setImpersonating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">User Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-800">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.name} loading="lazy" decoding="async" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-blue-400">
                {user.name?.charAt(0)?.toUpperCase() ?? '?'}
              </span>
            </div>
          )}
          <div>
            <p className="text-white font-semibold">{user.name || '—'}</p>
            <p className="text-slate-500 text-sm">@{user.username || 'no username'}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                user.accountType === 'seller' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
              }`}>
                {user.accountType}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                user.role === 'admin'
                  ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
                  : 'bg-slate-700/60 text-slate-400'
              }`}>
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="px-6 py-5 space-y-4">
          <Field icon={Mail}     label="Email"        value={user.email} />
          <Field icon={User}     label="Username"     value={user.username ? `@${user.username}` : ''} />
          <Field icon={Briefcase} label="Account Type" value={user.accountType} />
          <Field icon={Shield}   label="System Role"  value={user.role} />
          <Field icon={Calendar} label="Member Since"  value={user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''} />
          <Field icon={Hash}     label="User ID"      value={user.uid} />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
          >
            Close
          </button>
          {user.role !== 'admin' && (
            <button
              onClick={handleImpersonate}
              disabled={impersonating}
              title="Sign in as this user for customer support"
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-primary hover:bg-blue-400 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <LogIn className="w-3.5 h-3.5" />
              {impersonating ? 'Signing in…' : 'Impersonate'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUserViewModal;
