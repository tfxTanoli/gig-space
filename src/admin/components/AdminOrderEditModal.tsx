import { useEffect, useState } from 'react';
import { X, AlertTriangle, Package, MessagesSquare } from 'lucide-react';
import { ref as dbRef, update } from 'firebase/database';
import { database } from '../../firebase';
import { type AdminOrder } from './AdminOrdersTable';
import AdminOrderMessagesModal from './AdminOrderMessagesModal';

interface Props {
  order: AdminOrder;
  onClose: () => void;
  onSuccess: (updated: AdminOrder) => void;
}

// NOTE: stored DB value stays `cancelled` (existing orders use it) — only the label reads "Canceled".
const ORDER_STATUSES = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'delivered',   label: 'Delivered'   },
  { value: 'completed',   label: 'Completed'   },
  { value: 'disputed',    label: 'Disputed'    },
  { value: 'cancelled',   label: 'Canceled'    },
];

const PAYMENT_STATUSES = [
  { value: 'paid',     label: 'Paid'     },
  { value: 'released', label: 'Released' },
  { value: 'refunded', label: 'Refunded' },
];

// Plain-language explanation of what each payment status represents.
const PAYMENT_STATUS_HELP: Record<string, string> = {
  paid:     'Buyer has paid and the funds are held in escrow — not yet released to the seller.',
  released: 'Escrow funds have been paid out to the seller (happens when an order is completed).',
  refunded: 'Funds were returned to the buyer. Set this when you side with the buyer on a dispute.',
};

const AdminOrderEditModal = ({ order, onClose, onSuccess }: Props) => {
  const [status,        setStatus]        = useState(order.status);
  const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus || 'paid');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [showMessages, setShowMessages] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        [`orders/${order.orderId}/status`]:        status,
        [`orders/${order.orderId}/paymentStatus`]: paymentStatus,
      };

      // When admin marks completed, set completedAt if not already set
      if (status === 'completed') {
        updates[`orders/${order.orderId}/completedAt`] = Date.now();
      }

      // Sync payment record status to match admin's choice
      if (order.paymentId) {
        updates[`payments/${order.paymentId}/status`] = paymentStatus;
      }

      await update(dbRef(database), updates);

      onSuccess({
        ...order,
        status,
        paymentStatus,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  const changed = status !== order.status || paymentStatus !== (order.paymentStatus || 'paid');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Edit Order</h2>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">{order.orderId}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Order summary */}
        <div className="px-6 pt-5 pb-1">
          <div className="bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-700/50 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 text-xs uppercase tracking-wide">Buyer</span>
              <span className="text-white">{order.buyerName || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 text-xs uppercase tracking-wide">Seller</span>
              <span className="text-slate-300">{order.sellerName || '—'}</span>
            </div>
            {order.serviceTitle && (
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs uppercase tracking-wide">Service</span>
                <span className="text-slate-300 truncate max-w-[200px]">{order.serviceTitle}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500 text-xs uppercase tracking-wide">Amount</span>
              <span className="text-emerald-400 font-semibold">${order.amount.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={() => setShowMessages(true)}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
          >
            <MessagesSquare className="w-3.5 h-3.5" /> Review conversation
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
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Order Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Payment Status</label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors"
            >
              {PAYMENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1.5">{PAYMENT_STATUS_HELP[paymentStatus]}</p>
          </div>

          {status === 'disputed' && (
            <div className="flex items-start gap-2 text-xs text-blue-300 bg-blue-500/10 rounded-lg px-3 py-2.5 border border-blue-500/20">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>To resolve a dispute, set the status to <strong>In Progress</strong> if you side with the buyer (seller keeps working), or <strong>Completed</strong> if you side with the seller (escrow is released). Use Payment Status → <strong>Refunded</strong> to return funds to the buyer.</span>
            </div>
          )}

          {status === 'cancelled' && (
            <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2.5 border border-amber-500/20">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Marking as canceled will hide this order from active order views. Wallet balances are not automatically adjusted — set Payment Status to <strong>Refunded</strong> to return the buyer's funds if needed.</span>
            </div>
          )}
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
            disabled={saving || !changed}
            className="flex-1 py-2 rounded-lg bg-primary hover:bg-blue-400 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {showMessages && <AdminOrderMessagesModal order={order} onClose={() => setShowMessages(false)} />}
    </div>
  );
};

export default AdminOrderEditModal;
