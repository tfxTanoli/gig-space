import { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { ref as dbRef, get, update } from 'firebase/database';
import { database } from '../../firebase';
import { type AdminService } from './AdminServicesTable';

interface Props {
  service: AdminService;
  onClose: () => void;
  onSuccess: (updated: AdminService) => void;
}

const AdminServiceEditModal = ({ service, onClose, onSuccess }: Props) => {
  const [title,  setTitle]  = useState(service.title);
  const [status, setStatus] = useState(service.status || 'active');
  const [price,  setPrice]  = useState(String(service.price));

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = async () => {
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Price must be a valid non-negative number.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const svcRef = dbRef(database, `services/${service.id}`);
      const snap = await get(svcRef);
      if (!snap.exists()) { setError('Service not found'); return; }

      await update(svcRef, {
        title: title.trim(),
        status,
        priceMin: parsedPrice,
      });

      const fresh = (await get(svcRef)).val() as Record<string, unknown>;
      const images = Array.isArray(fresh?.images) ? (fresh.images as string[]) : [];
      onSuccess({
        id:          service.id,
        title:       String(fresh?.title       ?? ''),
        sellerName:  String(fresh?.sellerName  ?? ''),
        price:       Number(fresh?.priceMin    ?? fresh?.price ?? 0),
        status:      String(fresh?.status      ?? 'active'),
        imageUrl:    images[0] ?? null,
        category:    String(fresh?.category    ?? ''),
        description: String(fresh?.description ?? ''),
        createdAt:   Number(fresh?.createdAt   ?? 0),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update service');
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
            <h2 className="text-sm font-semibold text-white">Edit Service</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[280px]">{service.title}</p>
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
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Starting Price ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors"
            />
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
            {saving ? 'Savingâ€¦' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminServiceEditModal;
