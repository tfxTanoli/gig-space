import { useEffect } from 'react';
import { X, Link2 } from 'lucide-react';
import { type AdminAffiliate } from './AdminAffiliatesTable';

interface Props {
  affiliate: AdminAffiliate;
  onClose: () => void;
}

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-800/60 last:border-0">
    <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
    <span className="text-sm text-white text-right">{value}</span>
  </div>
);

const AdminAffiliateViewModal = ({ affiliate, onClose }: Props) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Link2 className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Affiliate Details</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-800/60">
            {affiliate.photoURL ? (
              <img src={affiliate.photoURL} alt={affiliate.name} loading="lazy" decoding="async" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
                {(affiliate.name || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{affiliate.name || '—'}</p>
              <p className="text-xs text-slate-500 truncate">{affiliate.email}</p>
            </div>
          </div>

          <Field label="Username" value={affiliate.username || '—'} />
          <Field label="Referral Code" value={
            affiliate.referralCode
              ? <span className="font-mono text-xs bg-slate-800 px-2 py-1 rounded">{affiliate.referralCode}</span>
              : '—'
          } />
          <Field label="Total Referrals" value={affiliate.totalReferrals} />
          <Field label="Lifetime Earnings" value={`$${affiliate.lifetimeEarnings.toFixed(2)}`} />
          <Field label="Available Balance" value={
            <span className="text-emerald-400 font-semibold">${affiliate.availableBalance.toFixed(2)}</span>
          } />
          <Field label="Pending Balance" value={
            <span className="text-yellow-400">${affiliate.pendingBalance.toFixed(2)}</span>
          } />
          <Field label="Joined" value={affiliate.createdAt ? new Date(affiliate.createdAt).toLocaleDateString() : '—'} />
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminAffiliateViewModal;
