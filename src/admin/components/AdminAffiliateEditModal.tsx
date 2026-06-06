import { useState } from 'react';
import { X } from 'lucide-react';
import { ref as dbRef, update } from 'firebase/database';
import { database } from '../../firebase';
import type { AdminAffiliate } from './AdminAffiliatesTable';

interface Props {
  affiliate: AdminAffiliate;
  onClose: () => void;
  onSuccess: (updated: AdminAffiliate) => void;
}

export default function AdminAffiliateEditModal({ affiliate, onClose, onSuccess }: Props) {
  const [referralCode,     setReferralCode]     = useState(affiliate.referralCode);
  const [availableBalance, setAvailableBalance] = useState(String(affiliate.availableBalance));
  const [pendingBalance,   setPendingBalance]   = useState(String(affiliate.pendingBalance));
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const affUpdates: Record<string, unknown> = {
        referralCode:     referralCode.trim(),
        availableBalance: parseFloat(availableBalance) || 0,
        pendingBalance:   parseFloat(pendingBalance)   || 0,
      };
      await update(dbRef(database, `affiliates/${affiliate.uid}`), affUpdates);
      onSuccess({
        ...affiliate,
        referralCode:     referralCode.trim(),
        availableBalance: parseFloat(availableBalance) || 0,
        pendingBalance:   parseFloat(pendingBalance)   || 0,
      });
      onClose();
    } catch {
      setError('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-slate-800 rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white">Edit Affiliate</h2>
            <p className="text-xs text-slate-500 mt-0.5">{affiliate.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Referral Code</label>
            <input
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              className="w-full bg-background border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
              placeholder="referralcode"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Available Balance ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={availableBalance}
                onChange={(e) => setAvailableBalance(e.target.value)}
                className="w-full bg-background border border-slate-700 rounded-lg px-3 py-2 text-emerald-400 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Pending Balance ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={pendingBalance}
                onChange={(e) => setPendingBalance(e.target.value)}
                className="w-full bg-background border border-slate-700 rounded-lg px-3 py-2 text-yellow-400 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="bg-slate-800/40 rounded-lg px-4 py-3 text-xs text-slate-500">
            <p className="font-medium text-slate-400 mb-1">Read-only info</p>
            <p>Total Referrals: <span className="text-white">{affiliate.totalReferrals.toLocaleString()}</span></p>
            <p>Lifetime Earnings: <span className="text-white">${affiliate.lifetimeEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
            <p>Email: <span className="text-white">{affiliate.email}</span></p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
