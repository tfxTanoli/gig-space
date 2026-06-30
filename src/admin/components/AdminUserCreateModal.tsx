import { useEffect, useState } from 'react';
import { X, AlertTriangle, UserPlus } from 'lucide-react';
import { adminCreateUser } from '../adminApi';
import { type AdminUser } from './AdminUsersTable';

interface Props {
  onClose: () => void;
  onSuccess: (user: AdminUser) => void;
}

const INPUT_CLASS =
  'w-full bg-surface-raised border border-slate-700/60 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-colors';

const AdminUserCreateModal = ({ onClose, onSuccess }: Props) => {
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [accountType, setAccountType] = useState<'buyer' | 'seller'>('buyer');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleCreate = async () => {
    if (!email.trim() || !password) { setError('Email and password are required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError(null);
    setSaving(true);
    try {
      const created = await adminCreateUser({ name: name.trim(), email: email.trim(), password, accountType });
      onSuccess({
        uid: created.uid,
        name: created.name,
        email: created.email,
        username: created.username,
        photoURL: created.photoURL,
        accountType: created.accountType,
        role: created.role,
        createdAt: created.createdAt,
        disabled: created.disabled,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">New User</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2.5 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className={INPUT_CLASS} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" className={INPUT_CLASS} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className={INPUT_CLASS} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Account type</label>
            <select value={accountType} onChange={(e) => setAccountType(e.target.value as 'buyer' | 'seller')} className={INPUT_CLASS}>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-800">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={saving} className="flex-1 py-2 rounded-lg bg-primary hover:bg-blue-400 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminUserCreateModal;
