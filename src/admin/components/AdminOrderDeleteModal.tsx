import { useEffect, useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { ref as dbRef, remove } from 'firebase/database';
import { database } from '../../firebase';
import { type AdminOrder } from './AdminOrdersTable';

interface Props {
  order: AdminOrder;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  in_progress: 'bg-blue-500/10 text-blue-400',
  delivered:   'bg-yellow-500/10 text-yellow-400',
  completed:   'bg-emerald-500/10 text-emerald-400',
  cancelled:   'bg-red-500/10 text-red-400',
};

const AdminOrderDeleteModal = ({ order, onClose, onSuccess }: Props) => {
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
      await remove(dbRef(database, `orders/${order.orderId}`));
      onSuccess(order.orderId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete order');
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
          <h2 className="text-sm font-semibold text-white">Delete Order</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mx-auto mb-4">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>

          <p className="text-center text-white font-semibold mb-1">Delete this order?</p>
          <p className="text-center text-slate-500 text-sm mb-5">
            The order will be permanently removed and will no longer appear in buyer or seller dashboards.
          </p>

          {/* Order preview */}
          <div className="bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/50 mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">{order.orderId.slice(0, 12)}…</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[order.status] ?? 'bg-slate-700 text-slate-400'}`}>
                {order.status?.replace(/_/g, ' ') || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{order.buyerName} → {order.sellerName}</span>
              <span className="text-white font-semibold">${order.amount.toFixed(2)}</span>
            </div>
            {order.serviceTitle && (
              <p className="text-xs text-slate-500 truncate">"{order.serviceTitle}"</p>
            )}
          </div>

          <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2.5 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Payment records and wallet balances are not automatically reversed. Handle any refunds separately before deleting.</span>
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
            {deleting ? 'Deleting…' : 'Delete Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDeleteModal;
