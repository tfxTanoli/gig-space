import { useEffect, useState } from 'react';
import { X, MessagesSquare, AlertTriangle } from 'lucide-react';
import { adminGetOrderMessages, type AdminMessage } from '../adminApi';
import { type AdminOrder } from './AdminOrdersTable';

interface Props {
  order: AdminOrder;
  onClose: () => void;
}

const fmtTime = (ts: number) =>
  ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

const AdminOrderMessagesModal = ({ order, onClose }: Props) => {
  const [messages, setMessages] = useState<AdminMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { messages } = await adminGetOrderMessages(order.orderId);
        if (!cancelled) setMessages(messages);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load conversation');
      }
    })();
    return () => { cancelled = true; };
  }, [order.orderId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <MessagesSquare className="w-4 h-4 text-orange-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">Dispute Conversation</h2>
              <p className="text-xs text-slate-500 truncate">{order.buyerName || 'Buyer'} ⇄ {order.sellerName || 'Seller'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2.5 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error} — make sure the backend admin API is deployed and reachable.</span>
            </div>
          )}

          {!error && messages === null && (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!error && messages !== null && messages.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-10">No messages found for this order.</p>
          )}

          {!error && messages !== null && messages.length > 0 && (
            <ul className="space-y-3">
              {messages.map((m) => {
                const fromBuyer = m.senderId === order.buyerId;
                return (
                  <li key={m.id} className={`flex flex-col ${fromBuyer ? 'items-start' : 'items-end'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${fromBuyer ? 'bg-slate-800 text-slate-200' : 'bg-blue-600/20 text-blue-100'}`}>
                      <p className="text-[11px] font-semibold mb-0.5 opacity-70">{m.senderName || (fromBuyer ? 'Buyer' : 'Seller')}</p>
                      {m.text && <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>}
                      {m.imageURL && <img src={m.imageURL} alt="attachment" className="mt-1.5 rounded-lg max-h-40 object-cover" />}
                      {!m.text && !m.imageURL && <p className="text-xs italic opacity-60">[{m.type}]</p>}
                    </div>
                    <span className="text-[10px] text-slate-600 mt-0.5 px-1">{fmtTime(m.timestamp)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex-shrink-0">
          <button onClick={onClose} className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderMessagesModal;
