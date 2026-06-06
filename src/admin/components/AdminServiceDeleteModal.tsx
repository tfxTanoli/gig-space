import { useEffect, useState } from 'react';
import { X, AlertTriangle, Trash2, Tag } from 'lucide-react';
import { ref as dbRef, get, remove } from 'firebase/database';
import { database } from '../../firebase';
import { type AdminService } from './AdminServicesTable';

interface Props {
  service: AdminService;
  onClose: () => void;
  onSuccess: (id: string) => void;
}

const AdminServiceDeleteModal = ({ service, onClose, onSuccess }: Props) => {
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      const svcRef = dbRef(database, `services/${service.id}`);
      const snap = await get(svcRef);
      if (!snap.exists()) { setError('Service not found'); return; }
      await remove(svcRef);
      onSuccess(service.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete service');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">Delete Service</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mx-auto mb-4">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>

          <p className="text-center text-white font-semibold mb-1">
            Delete this listing?
          </p>
          <p className="text-center text-slate-500 text-sm mb-5">
            This will permanently remove the service from the platform. This action cannot be undone.
          </p>

          {/* Service preview */}
          <div className="bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/50 mb-4">
            <div className="flex items-center gap-3">
              {service.imageUrl ? (
                <img
                  src={service.imageUrl}
                  alt={service.title}
                  className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-slate-700/60"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <Tag className="w-4 h-4 text-slate-500" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">{service.title || 'â€”'}</p>
                <p className="text-xs text-slate-500 truncate">{service.sellerName} Â· ${service.price.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2.5 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Associated orders and messages referencing this service will remain in the database but will lose the service link.</span>
          </div>

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
            className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deletingâ€¦' : 'Delete Listing'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminServiceDeleteModal;
