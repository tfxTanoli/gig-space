import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { User, Loader2, CheckCircle, ExternalLink, AlertCircle, Link as LinkIcon, Eye, EyeOff, Trash2 } from 'lucide-react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, onValue, update } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { storage, database } from '../firebase';
import { useAuth } from '../AuthContext';
import { useUsernameAvailability } from '../useUsernameAvailability';
import { normalizeUsername, validateUsername, claimUsername } from '../username';
import {
  getAffiliateConnectLink,
  checkAffiliateConnectStatus,
  type AffiliateStats,
} from './affiliateHelpers';

function AffiliateStripeConnectCard({ stats }: { stats: AffiliateStats | null }) {
  const [connectStatus, setConnectStatus] = useState<{
    payoutsEnabled: boolean; chargesEnabled: boolean; detailsSubmitted: boolean;
  } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stats?.stripeConnectedAccountId) return;
    setStatusLoading(true);
    checkAffiliateConnectStatus(stats.stripeConnectedAccountId)
      .then(setConnectStatus)
      .catch(console.error)
      .finally(() => setStatusLoading(false));
  }, [stats?.stripeConnectedAccountId]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const { url } = await getAffiliateConnectLink();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Stripe. Try again.');
      setConnecting(false);
    }
  };

  const isFullyEnabled = connectStatus?.payoutsEnabled && connectStatus?.chargesEnabled;

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#635bff]/10 border border-[#635bff]/20 flex items-center justify-center shrink-0">
          <LinkIcon className="w-5 h-5 text-[#635bff]" />
        </div>
        <div>
          <h3 className="text-white font-semibold text-sm">Stripe Payout Account</h3>
          <p className="text-slate-500 text-xs mt-0.5">Connect your bank account to receive withdrawals</p>
        </div>
      </div>

      {statusLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
        </div>
      ) : !stats?.stripeConnectedAccountId ? (
        <div className="space-y-3">
          <p className="text-slate-400 text-sm">
            Connect a Stripe account to withdraw your available balance directly to your bank.
          </p>
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 text-xs leading-relaxed">{error}</p>
            </div>
          )}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center justify-center gap-2 w-full bg-[#635bff] hover:bg-[#5147e6] disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            {connecting ? 'Connecting…' : 'Connect Stripe Account'}
          </button>
        </div>
      ) : isFullyEnabled ? (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-emerald-400 text-sm font-medium">Payouts enabled</span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="text-yellow-400 text-sm">
              {connectStatus?.detailsSubmitted
                ? 'Stripe is reviewing your account'
                : 'Complete your Stripe onboarding to enable payouts'}
            </span>
          </div>
          {!connectStatus?.detailsSubmitted && (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center justify-center gap-2 w-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 disabled:opacity-60 text-yellow-300 text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              {connecting ? 'Loading…' : 'Complete Onboarding'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AffiliateSettingsTab() {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName]         = useState('');
  const [username, setUsername] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile]       = useState<File | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saveSuccess, setSaveSuccess]   = useState(false);
  const [error, setError]               = useState('');
  const [stats, setStats]               = useState<AffiliateStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete account state
  const [deleteOpen, setDeleteOpen]               = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword]       = useState('');
  const [deleteShowPassword, setDeleteShowPassword] = useState(false);
  const [deleteLoading, setDeleteLoading]         = useState(false);
  const [deleteMsg, setDeleteMsg]                 = useState<string | null>(null);

  const isEmailProvider =
    user?.providerData.some((p) => p.providerId === 'password') ?? false;

  const handleDeleteAccount = async () => {
    if (!user) return;

    setDeleteLoading(true);
    setDeleteMsg(null);

    try {
      if (isEmailProvider) {
        if (!deletePassword) {
          setDeleteMsg('Enter your current password to confirm.');
          setDeleteLoading(false);
          return;
        }
        if (!user.email) throw new Error('No email on account');
        const credential = EmailAuthProvider.credential(user.email, deletePassword);
        await reauthenticateWithCredential(user, credential);
      } else {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, provider);
      }

      const token = await user.getIdToken();
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        const errMsg = body.error ?? 'Failed to delete account';
        if (res.status === 400 && errMsg.toLowerCase().includes('active order')) {
          toast.error('You have an active order that must be completed before you can delete your account.');
          setDeleteLoading(false);
          return;
        }
        throw new Error(errMsg);
      }

      await logout();
      navigate('/');
    } catch (err: unknown) {
      const isWrongPassword =
        err instanceof Error &&
        (err.message.includes('wrong-password') ||
          err.message.includes('invalid-credential') ||
          err.message.includes('INVALID_LOGIN_CREDENTIALS'));
      setDeleteMsg(
        isWrongPassword
          ? 'Incorrect password.'
          : err instanceof Error ? err.message : 'Failed to delete account.',
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    setName(userProfile?.name ?? '');
    setUsername(userProfile?.username ?? '');
    setPhotoPreview(userProfile?.photoURL ?? null);
  }, [userProfile]);

  const { status: usernameStatus, message: usernameMessage } = useUsernameAvailability(
    username,
    user?.uid,
  );

  useEffect(() => {
    if (!user) return;
    const unsub = onValue(dbRef(database, `affiliates/${user.uid}`), (snap) => {
      if (!snap.exists()) return;
      const d = snap.val() as Record<string, unknown>;
      setStats({
        referralCode:             String(d.referralCode             ?? ''),
        totalClicks:              Number(d.totalClicks              ?? 0),
        totalReferrals:           Number(d.totalReferrals           ?? 0),
        pendingBalance:           Number(d.pendingBalance           ?? 0),
        availableBalance:         Number(d.availableBalance         ?? 0),
        lifetimeEarnings:         Number(d.lifetimeEarnings         ?? 0),
        totalWithdrawn:           Number(d.totalWithdrawn           ?? 0),
        stripeConnectedAccountId: (d.stripeConnectedAccountId as string | null) ?? null,
      });
    });
    return () => unsub();
  }, [user]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { setError('Image must be under 1MB.'); return; }
    setPhotoFile(file);
    setError('');
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim())     { setError('Please enter your name.'); return; }
    const uname = normalizeUsername(username);
    if (!uname) { setError('Please enter a username.'); return; }
    const usernameError = validateUsername(uname);
    if (usernameError) { setError(usernameError); return; }
    if (usernameStatus === 'taken') { setError('This username is already taken.'); return; }

    setSaving(true);
    setError('');
    setSaveSuccess(false);

    try {
      await claimUsername(user.uid, uname, userProfile?.username);
    } catch {
      setError('This username is already taken.');
      setSaving(false);
      return;
    }

    try {
      let photoURL = userProfile?.photoURL ?? '';
      if (photoFile) {
        try {
          const imgRef = storageRef(storage, `profilePhotos/${user.uid}`);
          await uploadBytes(imgRef, photoFile);
          photoURL = await getDownloadURL(imgRef);
        } catch { /* fall back to existing photo */ }
      }

      await update(dbRef(database, `users/${user.uid}`), {
        name:     name.trim(),
        username: uname,
        photoURL,
      });

      setPhotoFile(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your profile and payout account</p>
      </div>

      {/* Profile card */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" />
          <h3 className="text-white font-semibold text-sm">Profile</h3>
        </div>

        {/* Photo upload */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#4B5563] flex items-center justify-center shrink-0 overflow-hidden">
            {photoPreview ? (
              <img src={photoPreview} alt="Profile" decoding="async" className="w-full h-full object-cover" />
            ) : (
              <svg width="40" height="40" viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="21" r="10" fill="#6B7280" />
                <ellipse cx="28" cy="52" rx="22" ry="12" fill="#6B7280" />
              </svg>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#1e293b] hover:bg-[#263347] text-white font-medium py-2 px-4 rounded-lg border border-slate-600/60 transition-colors text-sm"
            >
              Change photo
            </button>
            <p className="text-slate-500 text-xs mt-1">JPG or PNG. 1MB max.</p>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div>
          <label className="block text-slate-400 text-xs font-medium mb-1.5">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-[#0E1422] border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
          />
        </div>

        <div>
          <label className="block text-slate-400 text-xs font-medium mb-1.5">Username</label>
          <div className="relative">
            <input
              value={username}
              onChange={e => setUsername(normalizeUsername(e.target.value))}
              className={`w-full bg-[#0E1422] border rounded-xl px-4 py-3 pr-10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                usernameStatus === 'available'
                  ? 'border-green-500/60'
                  : usernameStatus === 'taken' || usernameStatus === 'invalid'
                    ? 'border-red-500/60'
                    : 'border-slate-700/50 focus:border-primary/50'
              }`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {usernameStatus === 'checking' && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
              {usernameStatus === 'available' && <CheckCircle className="w-4 h-4 text-green-500" />}
              {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <AlertCircle className="w-4 h-4 text-red-500" />}
            </span>
          </div>
          {(usernameStatus === 'taken' || usernameStatus === 'invalid') && usernameMessage && (
            <p className="text-red-400 text-sm mt-1.5">{usernameMessage}</p>
          )}
          {usernameStatus === 'available' && (
            <p className="text-green-500 text-sm mt-1.5">Username is available.</p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 px-5 rounded-xl transition-colors"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving…' : saveSuccess ? '✓ Saved' : 'Save changes'}
        </button>
      </div>

      {/* Stripe Connect */}
      <AffiliateStripeConnectCard stats={stats} />

      {/* Delete Account */}
      <div className="bg-[#111827] border border-red-900/40 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Delete account</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Permanently remove your account and all associated data. This cannot be undone.
            </p>
          </div>
        </div>

        {!deleteOpen ? (
          <button
            onClick={() => { setDeleteOpen(true); setDeleteMsg(null); setDeleteConfirmText(''); setDeletePassword(''); }}
            className="text-sm font-medium px-5 py-2 rounded-lg border border-red-700/50 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Delete my account
          </button>
        ) : (
          <div className="space-y-4">
            {stats && (stats.availableBalance > 0 || stats.pendingBalance > 0) && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                <p className="text-amber-400 text-sm font-medium">Affiliate balance will be forfeited</p>
                <p className="text-amber-300/80 text-xs mt-1">
                  You have <span className="font-semibold">${(stats.availableBalance + stats.pendingBalance).toFixed(2)}</span> in affiliate earnings.
                  Any unpaid commissions will be forfeited upon deletion.
                </p>
              </div>
            )}

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <p className="text-red-300 text-xs leading-relaxed">
                All your data will be permanently deleted — including your profile and affiliate link.
                Any unpaid commissions will be forfeited upon deletion.
              </p>
            </div>

            {isEmailProvider && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Current password
                </label>
                <div className="relative">
                  <input
                    type={deleteShowPassword ? 'text' : 'password'}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full bg-[#0E1422] border border-slate-700 text-white text-sm px-4 py-2.5 pr-11 rounded-xl focus:outline-none focus:border-red-500/60 transition-colors placeholder-slate-600"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setDeleteShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {deleteShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Type <span className="text-white font-mono">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full bg-[#0E1422] border border-slate-700 text-white text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:border-red-500/60 transition-colors placeholder-slate-600"
                placeholder="DELETE"
              />
            </div>

            {deleteMsg && (
              <p className="text-sm text-red-400">{deleteMsg}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmText !== 'DELETE' || (isEmailProvider && !deletePassword)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
              >
                {deleteLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</>
                ) : (
                  <><Trash2 className="w-4 h-4" /> Permanently delete account</>
                )}
              </button>
              <button
                onClick={() => { setDeleteOpen(false); setDeleteMsg(null); }}
                disabled={deleteLoading}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
