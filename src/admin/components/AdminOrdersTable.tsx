import { useEffect, useState } from 'react';
import { Eye, Pencil, ExternalLink } from 'lucide-react';
import AdminPagination from './AdminPagination';

export interface AdminOrder {
  orderId: string;
  buyerName: string;
  buyerId: string;
  sellerName: string;
  sellerId: string;
  serviceId: string;
  serviceTitle: string;
  conversationId: string;
  status: string;
  paymentStatus: string;
  paymentId: string;
  amount: number;
  createdAt: number;
}

interface Props {
  orders: AdminOrder[];
  loading: boolean;
  pageSize?: number;
  onView?:   (o: AdminOrder) => void;
  onEdit?:   (o: AdminOrder) => void;
  onDelete?: (o: AdminOrder) => void;
}

const STATUS_STYLES: Record<string, string> = {
  pending:     'bg-slate-700 text-slate-300',
  in_progress: 'bg-blue-500/10 text-blue-400',
  delivered:   'bg-yellow-500/10 text-yellow-400',
  completed:   'bg-emerald-500/10 text-emerald-400',
  cancelled:   'bg-red-500/10 text-red-400',
  disputed:    'bg-orange-500/10 text-orange-400',
};

// Display labels — note `cancelled` (stored) renders as the American spelling "Canceled".
const STATUS_LABELS: Record<string, string> = {
  pending:     'Pending',
  in_progress: 'In Progress',
  delivered:   'Delivered',
  completed:   'Completed',
  cancelled:   'Canceled',
  disputed:    'Disputed',
};

const SkeletonRow = ({ cols }: { cols: number }) => (
  <tr className="border-b border-slate-800/50">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-5 py-3">
        <div className="h-4 bg-slate-800 rounded animate-pulse" style={{ width: `${50 + (i % 3) * 20}px` }} />
      </td>
    ))}
  </tr>
);

const SELECT_CLASS =
  'bg-surface-raised border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors';

const AdminOrdersTable = ({ orders, loading, pageSize = 100, onView, onEdit }: Props) => {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  useEffect(() => { setPage(0); }, [orders.length, statusFilter]);

  const filtered   = statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);
  const visible    = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const hasActions = onView || onEdit;
  const headers    = ['Order ID', 'Buyer', 'Seller', 'Service', 'Status', 'Amount', ...(hasActions ? ['Actions'] : [])];

  return (
    <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">Orders</h3>
          {!loading && <span className="text-xs text-slate-500">{filtered.length.toLocaleString()} total</span>}
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={SELECT_CLASS} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-800">
              {headers.map((h) => (
                <th
                  key={h}
                  className={`px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide ${h === 'Actions' ? 'text-right' : 'text-left'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={headers.length} />)
              : visible.map((o) => (
                  <tr key={o.orderId} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    {/* Full Order ID */}
                    <td className="px-5 py-3 font-mono text-xs text-slate-400 max-w-[140px]">
                      <span className="break-all">{o.orderId}</span>
                    </td>

                    <td className="px-5 py-3 text-white whitespace-nowrap">{o.buyerName || '—'}</td>
                    <td className="px-5 py-3 text-slate-400 whitespace-nowrap">{o.sellerName || '—'}</td>

                    {/* Service title */}
                    <td className="px-5 py-3 text-slate-400 max-w-[160px] truncate">{o.serviceTitle || '—'}</td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[o.status] ?? 'bg-slate-700 text-slate-400'}`}>
                        {STATUS_LABELS[o.status] ?? (o.status?.replace(/_/g, ' ') || '—')}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-3 text-slate-300 whitespace-nowrap">
                      ${o.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {hasActions && (
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {o.serviceId && (
                            <button
                              onClick={() => window.open(`/service-detail?id=${o.serviceId}`, '_blank', 'noopener,noreferrer')}
                              title="View post"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onView && (
                            <button onClick={() => onView(o)} title="View" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onEdit && (
                            <button onClick={() => onEdit(o)} title="Edit / Resolve" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
          </tbody>
        </table>

        {!loading && filtered.length === 0 && (
          <p className="text-center text-slate-500 text-sm py-8">No orders found</p>
        )}
      </div>

      {!loading && (
        <AdminPagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
      )}
    </div>
  );
};

export default AdminOrdersTable;
