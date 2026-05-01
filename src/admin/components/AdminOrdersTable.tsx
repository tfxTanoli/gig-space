export interface AdminOrder {
  orderId: string;
  buyerName: string;
  sellerName: string;
  status: string;
  amount: number;
  createdAt: number;
}

interface Props {
  orders: AdminOrder[];
  loading: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  in_progress: 'bg-blue-500/10 text-blue-400',
  delivered:   'bg-yellow-500/10 text-yellow-400',
  completed:   'bg-emerald-500/10 text-emerald-400',
  cancelled:   'bg-red-500/10 text-red-400',
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

const AdminOrdersTable = ({ orders, loading }: Props) => (
  <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
    <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-white">Recent Orders</h3>
      {!loading && (
        <span className="text-xs text-slate-500">{orders.length} shown</span>
      )}
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            {['Order ID', 'Buyer', 'Seller', 'Status', 'Amount'].map((h) => (
              <th
                key={h}
                className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
            : orders.map((o) => (
                <tr
                  key={o.orderId}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">
                    {o.orderId.slice(0, 8)}…
                  </td>
                  <td className="px-5 py-3 text-white">{o.buyerName || '—'}</td>
                  <td className="px-5 py-3 text-slate-400">{o.sellerName || '—'}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        STATUS_STYLES[o.status] ?? 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {o.status?.replace(/_/g, ' ') || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-300">${o.amount.toFixed(2)}</td>
                </tr>
              ))}
        </tbody>
      </table>

      {!loading && orders.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-8">No orders found</p>
      )}
    </div>
  </div>
);

export default AdminOrdersTable;
