import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { User, Loader2, CheckCircle, ExternalLink, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, onValue, update } from 'firebase/database';
import { storage, database } from '../firebase';
import { useAuth } from '../AuthContext';
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
  const { user, userProfile } = useAuth();
  const [name, setName]         = useState('');
  const [username, setUsername] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile]       = useState<File | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saveSuccess, setSaveSuccess]   = useState(false);
  const [error, setError]               = useState('');
  const [stats, setStats]               = useState<AffiliateStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(userProfile?.name ?? '');
    setUsername(userProfile?.username ?? '');
    setPhotoPreview(userProfile?.photoURL ?? null);
  }, [userProfile]);

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
    if (!username.trim()) { setError('Please enter a username.'); return; }

    setSaving(true);
    setError('');
    setSaveSuccess(false);

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
        username: username.trim(),
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
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full bg-[#0E1422] border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
          />
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
    </div>
  );
}
