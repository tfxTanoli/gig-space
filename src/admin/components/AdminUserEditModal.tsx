import { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { ref as dbRef, get, update, query, orderByChild, equalTo } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { type AdminUser } from './AdminUsersTable';

interface Props {
  user: AdminUser;
  onClose: () => void;
  onSuccess: (updated: AdminUser) => void;
}

// Propagate user profile changes to all denormalized copies across the DB.
// Called only when name / username / photoURL actually changed.
async function fanOutUserProfile(
  uid: string,
  changed: { name?: string; username?: string; photoURL?: string },
) {
  const patches: Promise<void>[] = [];

  // ── Services (sellerId index exists) ─────────────────────────────────────
  const svcQ = query(dbRef(database, 'services'), orderByChild('sellerId'), equalTo(uid));
  const svcSnap = await get(svcQ);
  svcSnap.forEach((child) => {
    const svcPatch: Record<string, string> = {};
    if (changed.name     !== undefined) svcPatch.sellerName     = changed.name;
    if (changed.username !== undefined) svcPatch.sellerUsername = changed.username;
    if (changed.photoURL !== undefined) svcPatch.sellerPhotoURL = changed.photoURL;
    if (Object.keys(svcPatch).length > 0) {
      patches.push(update(dbRef(database, `services/${child.key}`), svcPatch));
    }
  });

  // ── Orders as buyer (buyerId index exists) ────────────────────────────────
  const buyerOrdersQ = query(dbRef(database, 'orders'), orderByChild('buyerId'), equalTo(uid));
  const buyerSnap = await get(buyerOrdersQ);
  buyerSnap.forEach((child) => {
    const patch: Record<string, string> = {};
    if (changed.name     !== undefined) patch.buyerName  = changed.name;
    if (changed.photoURL !== undefined) patch.buyerPhoto = changed.photoURL;
    if (Object.keys(patch).length > 0) {
      patches.push(update(dbRef(database, `orders/${child.key}`), patch));
    }
  });

  // ── Orders as seller (sellerId index exists) ──────────────────────────────
  const sellerOrdersQ = query(dbRef(database, 'orders'), orderByChild('sellerId'), equalTo(uid));
  const sellerOrdersSnap = await get(sellerOrdersQ);
  sellerOrdersSnap.forEach((child) => {
    const patch: Record<string, string> = {};
    if (changed.name     !== undefined) patch.sellerName  = changed.name;
    if (changed.photoURL !== undefined) patch.sellerPhoto = changed.photoURL;
    if (Object.keys(patch).length > 0) {
      patches.push(update(dbRef(database, `orders/${child.key}`), patch));
    }
  });

  // ── Conversations as buyer ────────────────────────────────────────────────
  const buyerConvsQ = query(dbRef(database, 'conversations'), orderByChild('buyerId'), equalTo(uid));
  const buyerConvsSnap = await get(buyerConvsQ);
  buyerConvsSnap.forEach((child) => {
    const patch: Record<string, string> = {};
    if (changed.name     !== undefined) patch.buyerName     = changed.name;
    if (changed.photoURL !== undefined) patch.buyerPhotoURL = changed.photoURL;
    if (Object.keys(patch).length > 0) {
      patches.push(update(dbRef(database, `conversations/${child.key}`), patch));
    }
  });

  // ── Conversations as seller ───────────────────────────────────────────────
  const sellerConvsQ = query(dbRef(database, 'conversations'), orderByChild('sellerId'), equalTo(uid));
  const sellerConvsSnap = await get(sellerConvsQ);
  sellerConvsSnap.forEach((child) => {
    const patch: Record<string, string> = {};
    if (changed.name     !== undefined) patch.sellerName     = changed.name;
    if (changed.photoURL !== undefined) patch.sellerPhotoURL = changed.photoURL;
    if (Object.keys(patch).length > 0) {
      patches.push(update(dbRef(database, `conversations/${child.key}`), patch));
    }
  });

  await Promise.all(patches);
}

const AdminUserEditModal = ({ user, onClose, onSuccess }: Props) => {
  const { user: authUser } = useAuth();

  const [name,        setName]        = useState(user.name);
  const [username,    setUsername]    = useState(user.username);
  const [accountType, setAccountType] = useState(user.accountType);
  const [role,        setRole]        = useState(user.role);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const isSelf = authUser?.uid === user.uid;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = async () => {
    if (!authUser) return;

    if (!['user', 'admin'].includes(role)) {
      setError('Role must be "user" or "admin"'); return;
    }
    if (!['buyer', 'seller', 'affiliate'].includes(accountType)) {
      setError('Account type must be "buyer", "seller", or "affiliate"'); return;
    }
    if (isSelf && role !== 'admin') {
      setError('You cannot remove your own admin role'); return;
    }

    setError(null);
    setSaving(true);
    try {
      const userRef = dbRef(database, `users/${user.uid}`);
      const snap = await get(userRef);
      if (!snap.exists()) { setError('User not found'); return; }

      const trimmedName     = name.trim();
      const trimmedUsername = username.trim();

      await update(userRef, {
        name:        trimmedName,
        username:    trimmedUsername,
        accountType,
        role,
      });

      // Fan out profile changes to all denormalized copies so buyer/seller
      // dashboards, service listings, orders, and conversations reflect the
      // new values immediately without a page reload.
      const changed: { name?: string; username?: string; photoURL?: string } = {};
      if (trimmedName     !== user.name)     changed.name     = trimmedName;
      if (trimmedUsername !== user.username) changed.username = trimmedUsername;
      // photoURL is not editable here, but if it ever is, add it to changed.

      if (Object.keys(changed).length > 0) {
        await fanOutUserProfile(user.uid, changed);
      }

      const fresh = (await get(userRef)).val() as Record<string, unknown>;
      onSuccess({
        uid: user.uid,
        name:        String(fresh?.name        ?? ''),
        email:       String(fresh?.email       ?? ''),
        username:    String(fresh?.username    ?? ''),
        photoURL:    String(fresh?.photoURL    ?? ''),
        accountType: String(fresh?.accountType ?? 'buyer'),
        role:        String(fresh?.role        ?? 'user'),
        createdAt:   Number(fresh?.createdAt   ?? 0),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-white">Edit User</h2>
            <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2.5 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Account Type</label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors"
            >
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
              <option value="affiliate">Affiliate</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">System Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isSelf}
              className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            {isSelf && (
              <p className="text-xs text-slate-500 mt-1">You cannot change your own role.</p>
            )}
            {role === 'admin' && !isSelf && (
              <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                This user will gain full admin access.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-primary hover:bg-blue-400 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminUserEditModal;
