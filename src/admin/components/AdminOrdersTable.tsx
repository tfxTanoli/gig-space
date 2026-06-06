import { useEffect, useState } from 'react';
import { Eye, Pencil } from 'lucide-react';
import AdminPagination from './AdminPagination';

export interface AdminOrder {
  orderId: string;
  buyerName: string;
  buyerId: string;
  sellerName: string;
  sellerId: string;
  serviceTitle: string;
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

const SkeletonRow = ({ cols }: { cols: number }) => (
  <tr className="border-b border-slate-800/50">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-5 py-3">
        <div className="h-4 bg-slate-800 rounded animate-pulse" style={{ width: `${50 + (i % 3) * 20}px` }} />
      </td>
    ))}
  </tr>
);

const AdminOrdersTable = ({ orders, loading, pageSize = 100, onView, onEdit }: Props) => {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [orders.length]);
  const visible    = orders.slice(page * pageSize, (page + 1) * pageSize);
  const hasActions = onView || onEdit;
  const headers    = ['Order ID', 'Buyer', 'Seller', 'Service', 'Status', 'Amount', ...(hasActions ? ['Actions'] : [])];

  return (
    <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Orders</h3>
        {!loading && <span className="text-xs text-slate-500">{orders.length.toLocaleString()} total</span>}
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

                    <td className="px-5 py-3 text-white whitespace-nowrap">{o.buyerName || 'â€”'}</td>
                    <td className="px-5 py-3 text-slate-400 whitespace-nowrap">{o.sellerName || 'â€”'}</td>

                    {/* Service title */}
                    <td className="px-5 py-3 text-slate-400 max-w-[160px] truncate">{o.serviceTitle || 'â€”'}</td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[o.status] ?? 'bg-slate-700 text-slate-400'}`}>
                        {o.status?.replace(/_/g, ' ') || 'â€”'}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-3 text-slate-300 whitespace-nowrap">
                      ${o.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {hasActions && (
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
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

        {!loading && orders.length === 0 && (
          <p className="text-center text-slate-500 text-sm py-8">No orders found</p>
        )}
      </div>

      {!loading && (
        <AdminPagination page={page} pageSize={pageSize} total={orders.length} onPageChange={setPage} />
      )}
    </div>
  );
};

export default AdminOrdersTable;
