import { useEffect } from 'react';
import { X, Package } from 'lucide-react';
import { type AdminOrder } from './AdminOrdersTable';

interface Props {
  order: AdminOrder;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  in_progress: 'bg-blue-500/10 text-blue-400',
  delivered:   'bg-yellow-500/10 text-yellow-400',
  completed:   'bg-emerald-500/10 text-emerald-400',
  cancelled:   'bg-red-500/10 text-red-400',
};

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-800/60 last:border-0">
    <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
    <span className="text-sm text-white text-right">{value}</span>
  </div>
);

const AdminOrderViewModal = ({ order, onClose }: Props) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Order Details</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <Field label="Order ID" value={<span className="font-mono text-xs">{order.orderId}</span>} />
          <Field label="Buyer" value={order.buyerName || '—'} />
          <Field label="Seller" value={order.sellerName || '—'} />
          <Field label="Status" value={
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[order.status] ?? 'bg-slate-700 text-slate-400'}`}>
              {order.status?.replace(/_/g, ' ') || '—'}
            </span>
          } />
          <Field label="Amount" value={`$${order.amount.toFixed(2)}`} />
          <Field label="Created" value={order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'} />
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

export default AdminOrderViewModal;
