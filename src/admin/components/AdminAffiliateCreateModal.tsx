import { useEffect, useState } from 'react';
import { X, AlertTriangle, BadgeDollarSign, Copy, Check } from 'lucide-react';
import { adminCreateAffiliate } from '../adminApi';
import { type AdminAffiliate } from './AdminAffiliatesTable';

interface Props {
  onClose: () => void;
  onSuccess: (affiliate: AdminAffiliate) => void;
}

const INPUT_CLASS =
  'w-full bg-surface-raised border border-slate-700/60 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-colors';

const AdminAffiliateCreateModal = ({ onClose, onSuccess }: Props) => {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving]     = useState(false);
  const [error,  setError]      = useState<string | null>(null);

  // After creation we show the generated referral link to share.
  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      const created = await adminCreateAffiliate({ name: name.trim(), email: email.trim(), password });
      const link = `${window.location.origin}?ref=${created.referralCode}`;
      onSuccess({
        uid: created.uid,
        name: created.name,
        email: created.email,
        username: created.username,
        photoURL: created.photoURL,
        referralCode: created.referralCode,
        totalReferrals: 0,
        lifetimeEarnings: 0,
        availableBalance: 0,
        pendingBalance: 0,
        createdAt: created.createdAt,
        disabled: false,
      });
      setReferralLink(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create affiliate');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <BadgeDollarSign className="w-4 h-4 text-orange-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">{referralLink ? 'Affiliate Created' : 'New Affiliate'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {referralLink ? (
          <>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-slate-300">Share this unique referral link. Sellers who sign up through it are tied to this affiliate for commission.</p>
              <div className="flex items-center gap-2">
                <input readOnly value={referralLink} className={`${INPUT_CLASS} font-mono text-xs`} onFocus={(e) => e.target.select()} />
                <button onClick={copyLink} title="Copy link" className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex-shrink-0">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-800">
              <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-primary hover:bg-blue-400 text-white text-sm font-semibold transition-colors">
                Done
              </button>
            </div>
          </>
        ) : (
          <>
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
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-800">
              <button onClick={onClose} disabled={saving} className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 py-2 rounded-lg bg-primary hover:bg-blue-400 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {saving ? 'Creating…' : 'Create Affiliate'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminAffiliateCreateModal;
